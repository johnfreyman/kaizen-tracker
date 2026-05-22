-- =============================================================================
-- Migration 003: Atomic operations via transactional RPCs
-- Run order: THIRD — requires tables created by 001_schema.sql
--
-- Safe to run on a fresh or existing Supabase project. Every statement is
-- idempotent (CREATE OR REPLACE FUNCTION / DROP … IF EXISTS).
--
-- These functions replace three non-atomic two-phase HTTP operations in the
-- client with single transactional RPC calls. Each function:
--   • Runs both DML statements inside a single Postgres transaction.
--   • Verifies auth.uid() = p_coach_id to prevent privilege escalation.
--   • Is declared SECURITY DEFINER so it executes with the permissions of the
--     function owner (postgres role), not the calling user — required for the
--     auth.uid() check to work correctly inside the transaction.
--   • Revokes the default PUBLIC execute grant and re-grants only to the
--     authenticated role so anonymous callers cannot invoke these functions.
-- =============================================================================


-- =============================================================================
-- FUNCTION: save_session
-- Atomically inserts a completed event into `events` and removes the coach's
-- row from `active_session` in a single transaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_session(
  p_coach_id  UUID,
  p_event_id  TEXT,
  p_date      TEXT,
  p_type      TEXT,
  p_duration  NUMERIC,
  p_players   JSONB,
  p_saved_at  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privilege escalation guard: caller must be the coach they are acting as.
  IF auth.uid() IS DISTINCT FROM p_coach_id THEN
    RAISE EXCEPTION 'Unauthorized: caller is not the target coach'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Insert the completed event.
  INSERT INTO public.events (coach_id, id, date, type, duration, players, saved_at)
  VALUES (p_coach_id, p_event_id, p_date, p_type, p_duration, p_players, p_saved_at);

  -- Delete the in-progress session for this coach.
  DELETE FROM public.active_session
  WHERE coach_id = p_coach_id;
END;
$$;

-- Restrict execution to authenticated users only.
REVOKE ALL    ON FUNCTION public.save_session(UUID, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.save_session(UUID, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT) TO authenticated;


-- =============================================================================
-- FUNCTION: archive_events
-- Atomically inserts an archive set into `archived_event_sets` and deletes the
-- source events from `events` in a single transaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.archive_events(
  p_coach_id    UUID,
  p_archive_id  TEXT,
  p_archived_at TEXT,
  p_events      JSONB,
  p_event_ids   TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privilege escalation guard.
  IF auth.uid() IS DISTINCT FROM p_coach_id THEN
    RAISE EXCEPTION 'Unauthorized: caller is not the target coach'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Insert the archive bundle.
  INSERT INTO public.archived_event_sets (coach_id, id, archived_at, events)
  VALUES (p_coach_id, p_archive_id, p_archived_at, p_events);

  -- Remove the archived events from the live events table.
  DELETE FROM public.events
  WHERE coach_id = p_coach_id
    AND id = ANY(p_event_ids);
END;
$$;

REVOKE ALL    ON FUNCTION public.archive_events(UUID, TEXT, TEXT, JSONB, TEXT[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.archive_events(UUID, TEXT, TEXT, JSONB, TEXT[]) TO authenticated;


-- =============================================================================
-- FUNCTION: restore_archive
-- Atomically upserts events from an archive back into `events` and deletes the
-- archive row from `archived_event_sets` in a single transaction.
--
-- p_events_to_restore: JSONB array of event objects with keys:
--   id, date, type, duration, players, saved_at
-- The coach_id is not stored inside each element — it is supplied as p_coach_id
-- and injected during the upsert.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_archive(
  p_coach_id           UUID,
  p_archive_id         TEXT,
  p_events_to_restore  JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event JSONB;
BEGIN
  -- Privilege escalation guard.
  IF auth.uid() IS DISTINCT FROM p_coach_id THEN
    RAISE EXCEPTION 'Unauthorized: caller is not the target coach'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Upsert each event from the archive back into the live events table.
  -- On conflict (same id) update all mutable columns so "overwrite" semantics
  -- are honoured. The client filters p_events_to_restore to only the events it
  -- actually wants restored (e.g. after applying the "skip" strategy), so this
  -- function does not need to implement conflict-resolution logic itself.
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events_to_restore)
  LOOP
    INSERT INTO public.events (coach_id, id, date, type, duration, players, saved_at)
    VALUES (
      p_coach_id,
      v_event->>'id',
      v_event->>'date',
      v_event->>'type',
      (v_event->>'duration')::NUMERIC,
      v_event->'players',
      v_event->>'saved_at'
    )
    ON CONFLICT (id) DO UPDATE
      SET date     = EXCLUDED.date,
          type     = EXCLUDED.type,
          duration = EXCLUDED.duration,
          players  = EXCLUDED.players,
          saved_at = EXCLUDED.saved_at;
  END LOOP;

  -- Remove the archive bundle now that events are restored.
  DELETE FROM public.archived_event_sets
  WHERE id = p_archive_id
    AND coach_id = p_coach_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.restore_archive(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.restore_archive(UUID, TEXT, JSONB) TO authenticated;
