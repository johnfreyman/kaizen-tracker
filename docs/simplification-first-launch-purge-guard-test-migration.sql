-- FIRST-LAUNCH TEST CANDIDATE ONLY. Do not apply separately to production.
-- Requires the canonical tracker tables from the combined Stage 3/6 candidate.
-- Policy: scheduled purge may remove empty unverified accounts, but must never
-- soft-delete or hard-delete an account that has saved canonical tracker data.

CREATE OR REPLACE FUNCTION tracker_private.owner_has_canonical_data_v1(p_coach_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.tracker_players WHERE coach_id = p_coach_id)
      OR EXISTS (SELECT 1 FROM public.tracker_sub_teams WHERE coach_id = p_coach_id)
      OR EXISTS (SELECT 1 FROM public.tracker_rounds WHERE coach_id = p_coach_id)
      OR EXISTS (SELECT 1 FROM public.tracker_sessions WHERE coach_id = p_coach_id)
      OR EXISTS (SELECT 1 FROM public.tracker_operations WHERE coach_id = p_coach_id)
      OR EXISTS (SELECT 1 FROM public.tracker_exit_codes WHERE coach_id = p_coach_id)
      OR EXISTS (SELECT 1 FROM public.tracker_draws WHERE coach_id = p_coach_id)
$fn$;
REVOKE ALL ON FUNCTION tracker_private.owner_has_canonical_data_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- Supabase Auth cannot hard-delete a user who still owns Storage objects.
-- An uploaded team logo is saved data too; leave it and its owner untouched
-- until a separate, reviewed Storage cleanup policy exists.
CREATE OR REPLACE FUNCTION tracker_private.owner_has_retained_data_v1(p_coach_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT tracker_private.owner_has_canonical_data_v1(p_coach_id)
      OR EXISTS (
        SELECT 1 FROM storage.objects
        WHERE owner = p_coach_id OR owner_id = p_coach_id::text
      )
$fn$;
REVOKE ALL ON FUNCTION tracker_private.owner_has_retained_data_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- Every new owner initialization inserts a round, and every accepted write
-- request inserts an operation-ledger row. Reject both after soft deletion.
-- Locking the Auth row before checking state puts this path in the same order
-- as the scheduled purge, including when the two transactions race.
CREATE OR REPLACE FUNCTION tracker_private.reject_soft_deleted_write_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  PERFORM 1 FROM auth.users WHERE id = NEW.coach_id FOR KEY SHARE;
  IF EXISTS (
    SELECT 1 FROM public.coach_purge_state
    WHERE coach_id = NEW.coach_id AND purge_status = 'soft_deleted'
  ) THEN
    RAISE EXCEPTION 'Coach account is soft-deleted; tracker writes are unavailable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION tracker_private.reject_soft_deleted_write_v1()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tracker_rounds_soft_delete_guard ON public.tracker_rounds;
CREATE TRIGGER tracker_rounds_soft_delete_guard
  BEFORE INSERT ON public.tracker_rounds FOR EACH ROW
  EXECUTE FUNCTION tracker_private.reject_soft_deleted_write_v1();
DROP TRIGGER IF EXISTS tracker_operations_soft_delete_guard ON public.tracker_operations;
CREATE TRIGGER tracker_operations_soft_delete_guard
  BEFORE INSERT ON public.tracker_operations FOR EACH ROW
  EXECUTE FUNCTION tracker_private.reject_soft_deleted_write_v1();

-- Replace the existing scheduled entry point in place. The live cron job calls
-- this exact signature, so its schedule does not need to be changed here.
CREATE OR REPLACE FUNCTION public.process_purge_lifecycle()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  r record;
BEGIN
  -- A protected coach stays active. In particular, do not pseudonymize their
  -- profile or alter team settings merely because their deadline has passed.
  FOR r IN
    SELECT ps.coach_id
    FROM public.coach_purge_state ps
    WHERE ps.purge_status = 'active' AND ps.purge_deadline <= now()
    ORDER BY ps.coach_id
  LOOP
    -- Canonical inserts take a foreign-key key-share lock on auth.users.
    -- Lock that row first, then recheck the purge state and history, so a
    -- concurrent save cannot slip between the history check and soft delete.
    -- Auth verification also locks auth.users before its purge-state trigger.
    PERFORM 1 FROM auth.users
      WHERE id = r.coach_id AND email_confirmed_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    PERFORM 1 FROM public.coach_purge_state ps
      WHERE ps.coach_id = r.coach_id AND ps.purge_status = 'active'
        AND ps.purge_deadline <= now()
      FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF tracker_private.owner_has_retained_data_v1(r.coach_id) THEN
      CONTINUE;
    END IF;

    UPDATE public.profiles
      SET email = 'purged-' || r.coach_id || '@deleted.local'
      WHERE id = r.coach_id;

    -- The deployed team_name column is NOT NULL.
    UPDATE public.team_settings
      SET team_name = 'Deleted team', team_logo = ''
      WHERE coach_id = r.coach_id;

    UPDATE public.coach_purge_state
      SET purge_status = 'soft_deleted', soft_deleted_at = now(),
          hard_delete_at = now() + interval '275 days',
          purged_by = 'cron', updated_at = now()
      WHERE coach_id = r.coach_id;

    -- Do not copy the original email into an enduring activity-log row.
    INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata)
    VALUES ('purge_soft_deleted', r.coach_id,
            'purged-' || r.coach_id || '@deleted.local',
            jsonb_build_object('trigger', 'cron'));
  END LOOP;

  -- Existing reminder timestamps are kept, but protected coaches are not
  -- advanced through purge milestones or logged as reminder recipients.
  FOR r IN
    SELECT ps.coach_id FROM public.coach_purge_state ps
    WHERE ps.purge_status = 'active' AND ps.reminder_7d_sent_at IS NULL
      AND now() >= ps.original_deadline - interval '83 days'
      AND NOT tracker_private.owner_has_retained_data_v1(ps.coach_id)
      AND EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.id = ps.coach_id AND u.email_confirmed_at IS NULL)
    FOR UPDATE OF ps SKIP LOCKED
  LOOP
    UPDATE public.coach_purge_state
      SET reminder_7d_sent_at = now(), updated_at = now()
      WHERE coach_id = r.coach_id;
    INSERT INTO public.activity_log (event_type, coach_id, metadata)
    VALUES ('purge_reminder_sent', r.coach_id, jsonb_build_object('milestone', '7d'));
  END LOOP;

  FOR r IN
    SELECT ps.coach_id FROM public.coach_purge_state ps
    WHERE ps.purge_status = 'active' AND ps.reminder_30d_sent_at IS NULL
      AND now() >= ps.original_deadline - interval '60 days'
      AND NOT tracker_private.owner_has_retained_data_v1(ps.coach_id)
      AND EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.id = ps.coach_id AND u.email_confirmed_at IS NULL)
    FOR UPDATE OF ps SKIP LOCKED
  LOOP
    UPDATE public.coach_purge_state
      SET reminder_30d_sent_at = now(), updated_at = now()
      WHERE coach_id = r.coach_id;
    INSERT INTO public.activity_log (event_type, coach_id, metadata)
    VALUES ('purge_reminder_sent', r.coach_id, jsonb_build_object('milestone', '30d'));
  END LOOP;

  FOR r IN
    SELECT ps.coach_id FROM public.coach_purge_state ps
    WHERE ps.purge_status = 'active' AND ps.reminder_60d_sent_at IS NULL
      AND now() >= ps.original_deadline - interval '30 days'
      AND NOT tracker_private.owner_has_retained_data_v1(ps.coach_id)
      AND EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.id = ps.coach_id AND u.email_confirmed_at IS NULL)
    FOR UPDATE OF ps SKIP LOCKED
  LOOP
    UPDATE public.coach_purge_state
      SET reminder_60d_sent_at = now(), updated_at = now()
      WHERE coach_id = r.coach_id;
    INSERT INTO public.activity_log (event_type, coach_id, metadata)
    VALUES ('purge_reminder_sent', r.coach_id, jsonb_build_object('milestone', '60d'));
  END LOOP;

  FOR r IN
    SELECT ps.coach_id FROM public.coach_purge_state ps
    WHERE ps.purge_status = 'active' AND ps.reminder_83d_sent_at IS NULL
      AND now() >= ps.original_deadline - interval '7 days'
      AND NOT tracker_private.owner_has_retained_data_v1(ps.coach_id)
      AND EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.id = ps.coach_id AND u.email_confirmed_at IS NULL)
    FOR UPDATE OF ps SKIP LOCKED
  LOOP
    UPDATE public.coach_purge_state
      SET reminder_83d_sent_at = now(), updated_at = now()
      WHERE coach_id = r.coach_id;
    INSERT INTO public.activity_log (event_type, coach_id, metadata)
    VALUES ('purge_reminder_sent', r.coach_id, jsonb_build_object('milestone', '83d'));
  END LOOP;

  -- Recheck immediately before hard deletion. The non-cascading canonical
  -- foreign keys also prevent a concurrent canonical write from being lost.
  FOR r IN
    SELECT ps.coach_id FROM public.coach_purge_state ps
    WHERE ps.purge_status = 'soft_deleted'
      AND ps.hard_delete_at IS NOT NULL AND ps.hard_delete_at <= now()
    ORDER BY ps.coach_id
  LOOP
    PERFORM 1 FROM auth.users
      WHERE id = r.coach_id AND email_confirmed_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    PERFORM 1 FROM public.coach_purge_state ps
      WHERE ps.coach_id = r.coach_id AND ps.purge_status = 'soft_deleted'
        AND ps.hard_delete_at IS NOT NULL AND ps.hard_delete_at <= now()
      FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF tracker_private.owner_has_retained_data_v1(r.coach_id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.activity_log (event_type, coach_id, metadata)
    VALUES ('purge_hard_deleted', r.coach_id, jsonb_build_object('trigger', 'cron'));
    DELETE FROM auth.users WHERE id = r.coach_id;
  END LOOP;
END
$fn$;
REVOKE ALL ON FUNCTION public.process_purge_lifecycle()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_purge_lifecycle() TO service_role;

-- The current live manual entry point only soft-deletes. Refuse that action
-- when canonical data exists, because it would pseudonymize an account that
-- the scheduled hard-delete guard is obliged to retain.
CREATE OR REPLACE FUNCTION public.admin_purge_now(p_coach_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_status text;
  v_verified_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT email_confirmed_at INTO v_verified_at
    FROM auth.users WHERE id = p_coach_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coach not found: %', p_coach_id;
  END IF;
  IF v_verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Verified coach cannot be purged'
      USING ERRCODE = '55000';
  END IF;
  SELECT purge_status INTO v_status
  FROM public.coach_purge_state WHERE coach_id = p_coach_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No purge state found for coach %', p_coach_id;
  END IF;
  IF v_status = 'soft_deleted' THEN
    RAISE EXCEPTION 'Coach already soft-deleted';
  END IF;
  IF tracker_private.owner_has_retained_data_v1(p_coach_id) THEN
    RAISE EXCEPTION 'Coach has saved data; manual purge requires separate review'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.profiles
    SET email = 'purged-' || p_coach_id || '@deleted.local'
    WHERE id = p_coach_id;
  UPDATE public.team_settings
    SET team_name = 'Deleted team', team_logo = ''
    WHERE coach_id = p_coach_id;
  UPDATE public.coach_purge_state
    SET purge_status = 'soft_deleted', soft_deleted_at = now(),
        hard_delete_at = now() + interval '275 days',
        purged_by = 'admin:' || auth.uid()::text, updated_at = now()
    WHERE coach_id = p_coach_id;
  INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata)
  VALUES ('purge_soft_deleted', p_coach_id,
          'purged-' || p_coach_id || '@deleted.local',
          jsonb_build_object('trigger', 'admin', 'admin_uid', auth.uid()));

  RETURN jsonb_build_object(
    'coach_id', p_coach_id, 'purge_status', 'soft_deleted',
    'hard_delete_at', (SELECT hard_delete_at FROM public.coach_purge_state
                       WHERE coach_id = p_coach_id)
  );
END
$fn$;
-- Preserve the live access boundary: this manual function is not an exposed
-- browser or service-role RPC, even though it checks super-admin membership.
REVOKE ALL ON FUNCTION public.admin_purge_now(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Verification already cancels a pending purge. If verification occurs after
-- soft deletion, restore the profile email from Auth and give the team a safe
-- default name; the former team name/logo cannot be reconstructed.
CREATE OR REPLACE FUNCTION public.clear_purge_on_verify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_status text;
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    SELECT purge_status INTO v_status FROM public.coach_purge_state
    WHERE coach_id = NEW.id FOR UPDATE;
    IF FOUND THEN
      IF v_status = 'soft_deleted' THEN
        UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
        UPDATE public.team_settings SET team_name = 'Kaizen Tracker'
          WHERE coach_id = NEW.id AND team_name = 'Deleted team';
      END IF;
      DELETE FROM public.coach_purge_state WHERE coach_id = NEW.id;
      INSERT INTO public.activity_log (event_type, coach_id, metadata)
      VALUES ('purge_cancelled_verified', NEW.id,
              jsonb_build_object('reason', 'email_verified',
                                 'previous_status', v_status));
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.clear_purge_on_verify()
  FROM PUBLIC, anon, authenticated;
