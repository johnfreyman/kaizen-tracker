-- =============================================================================
-- Migration 010: Atomic player removal with cascade through event history
-- Run order: after 009_consent_storage.sql
--
-- Problem: the previous client-side removePlayer() only deleted from `roster`.
-- A removed player's name was left inside:
--   • events.players          (JSONB array of name strings per event row)
--   • archived_event_sets.events[*].players  (same, nested inside JSONB blob)
--
-- This function replaces that client call with a single transactional RPC that:
--   1. Deletes the player row from `roster`.
--   2. Filters the player's name out of every matching events.players array.
--   3. Filters the player's name out of every nested players array inside
--      archived_event_sets.events.
--
-- All three DML statements execute inside one transaction, so partial removal
-- is impossible. Rows are only updated when they actually contain the name
-- (the WHERE clauses use JSONB containment) to avoid unnecessary writes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_player(
  p_coach_id    UUID,
  p_player_name TEXT
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

  -- 1. Remove from roster.
  DELETE FROM public.roster
  WHERE coach_id = p_coach_id
    AND name     = p_player_name;

  -- 2. Remove the player name from events.players JSONB arrays.
  --    Only touches rows where the array actually contains the name.
  UPDATE public.events
  SET players = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM   jsonb_array_elements(players) AS elem
    WHERE  elem <> to_jsonb(p_player_name)
  )
  WHERE coach_id = p_coach_id
    AND players @> jsonb_build_array(p_player_name);

  -- 3. Remove the player name from every nested players array inside
  --    archived_event_sets.events (a JSONB array of event objects).
  --    Only touches archive rows where at least one event contains the name.
  UPDATE public.archived_event_sets
  SET events = (
    SELECT jsonb_agg(
      CASE
        WHEN (event_obj -> 'players') @> jsonb_build_array(p_player_name)
        THEN jsonb_set(
          event_obj,
          '{players}',
          (
            SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
            FROM   jsonb_array_elements(event_obj -> 'players') AS p
            WHERE  p <> to_jsonb(p_player_name)
          )
        )
        ELSE event_obj
      END
    )
    FROM jsonb_array_elements(events) AS event_obj
  )
  WHERE coach_id = p_coach_id
    AND EXISTS (
      SELECT 1
      FROM   jsonb_array_elements(events) AS ev
      WHERE  (ev -> 'players') @> jsonb_build_array(p_player_name)
    );
END;
$$;

REVOKE ALL     ON FUNCTION public.remove_player(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_player(UUID, TEXT) TO authenticated;
