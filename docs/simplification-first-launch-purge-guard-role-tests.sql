-- Rollback-only first-launch lifecycle rehearsal. Run only against the
-- disposable local baseline after the combined and purge-guard candidates.
BEGIN;

INSERT INTO auth.users (id, email, aud, role, email_confirmed_at) VALUES
  ('f1a00000-0000-4000-8000-00000000000a', 'protected-active@example.test', 'authenticated', 'authenticated', NULL),
  ('f1b00000-0000-4000-8000-00000000000b', 'empty-cron@example.test', 'authenticated', 'authenticated', NULL),
  ('f1c00000-0000-4000-8000-00000000000c', 'protected-soft@example.test', 'authenticated', 'authenticated', NULL),
  ('f1d00000-0000-4000-8000-00000000000d', 'empty-manual@example.test', 'authenticated', 'authenticated', NULL),
  ('f1e00000-0000-4000-8000-00000000000e', 'admin@example.test', 'authenticated', 'authenticated', now()),
  ('f1f00000-0000-4000-8000-00000000000f', 'verify-later@example.test', 'authenticated', 'authenticated', NULL),
  ('f1a10000-0000-4000-8000-00000000000a', 'already-verified@example.test', 'authenticated', 'authenticated', now()),
  ('f1a20000-0000-4000-8000-00000000000a', 'logo-owner@example.test', 'authenticated', 'authenticated', NULL);
INSERT INTO public.super_admins (user_id)
VALUES ('f1e00000-0000-4000-8000-00000000000e');

INSERT INTO public.team_settings (coach_id, team_name) VALUES
  ('f1a00000-0000-4000-8000-00000000000a', 'Protected A'),
  ('f1b00000-0000-4000-8000-00000000000b', 'Empty B'),
  ('f1c00000-0000-4000-8000-00000000000c', 'Protected C'),
  ('f1d00000-0000-4000-8000-00000000000d', 'Empty D'),
  ('f1f00000-0000-4000-8000-00000000000f', 'Verify F'),
  ('f1a10000-0000-4000-8000-00000000000a', 'Verified G'),
  ('f1a20000-0000-4000-8000-00000000000a', 'Logo H');

INSERT INTO storage.buckets (id,name) VALUES ('purge-test','purge-test');
INSERT INTO storage.objects (bucket_id,name,owner,owner_id) VALUES
  ('purge-test','logo.png','f1a20000-0000-4000-8000-00000000000a',
   'f1a20000-0000-4000-8000-00000000000a');

-- Simulate an inherited stale purge row for a verified account.
INSERT INTO public.coach_purge_state
  (coach_id,purge_deadline,original_deadline) VALUES
  ('f1a10000-0000-4000-8000-00000000000a',
   now()-interval '1 day',now()-interval '90 days');

-- A and C have saved canonical data; C is already past hard-delete time.
INSERT INTO public.tracker_rounds (coach_id, generation) VALUES
  ('f1a00000-0000-4000-8000-00000000000a', 1),
  ('f1c00000-0000-4000-8000-00000000000c', 1);
UPDATE public.coach_purge_state
  SET purge_deadline = now() - interval '1 day',
      original_deadline = now() - interval '90 days'
  WHERE coach_id IN ('f1a00000-0000-4000-8000-00000000000a',
                     'f1b00000-0000-4000-8000-00000000000b',
                     'f1a20000-0000-4000-8000-00000000000a');
UPDATE public.coach_purge_state
  SET purge_status = 'soft_deleted', soft_deleted_at = now() - interval '276 days',
      hard_delete_at = now() - interval '1 day'
  WHERE coach_id = 'f1c00000-0000-4000-8000-00000000000c';

-- Browser roles must not be able to invoke either privileged purge path.
DO $privileges$
BEGIN
  IF has_function_privilege('anon', 'public.process_purge_lifecycle()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_purge_lifecycle()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.process_purge_lifecycle()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_purge_now(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.admin_purge_now(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated',
        'tracker_private.owner_has_canonical_data_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated',
        'tracker_private.owner_has_retained_data_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'purge execution grants are broader than intended';
  END IF;
END $privileges$;

SET LOCAL ROLE service_role;
SELECT public.process_purge_lifecycle();
SET LOCAL ROLE postgres;

DO $scheduled_soft$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id = 'f1a00000-0000-4000-8000-00000000000a')
     OR NOT EXISTS (SELECT 1 FROM public.coach_purge_state
                    WHERE coach_id = 'f1a00000-0000-4000-8000-00000000000a'
                      AND purge_status = 'active' AND reminder_7d_sent_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.profiles
                    WHERE id = 'f1a00000-0000-4000-8000-00000000000a'
                      AND email = 'protected-active@example.test')
     OR NOT EXISTS (SELECT 1 FROM public.team_settings
                    WHERE coach_id = 'f1a00000-0000-4000-8000-00000000000a'
                      AND team_name = 'Protected A') THEN
    RAISE EXCEPTION 'scheduled purge altered a protected active coach';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coach_purge_state
                 WHERE coach_id = 'f1b00000-0000-4000-8000-00000000000b'
                   AND purge_status = 'soft_deleted' AND hard_delete_at > now())
     OR NOT EXISTS (SELECT 1 FROM public.team_settings
                    WHERE coach_id = 'f1b00000-0000-4000-8000-00000000000b'
                      AND team_name = 'Deleted team')
     OR NOT EXISTS (SELECT 1 FROM public.profiles
                    WHERE id = 'f1b00000-0000-4000-8000-00000000000b'
                      AND email = 'purged-f1b00000-0000-4000-8000-00000000000b@deleted.local') THEN
    RAISE EXCEPTION 'empty coach did not soft-delete without violating team_name';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id = 'f1c00000-0000-4000-8000-00000000000c')
     OR NOT EXISTS (SELECT 1 FROM public.tracker_rounds
                    WHERE coach_id = 'f1c00000-0000-4000-8000-00000000000c') THEN
    RAISE EXCEPTION 'scheduled hard delete removed a coach with tracker data';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coach_purge_state
                 WHERE coach_id = 'f1a10000-0000-4000-8000-00000000000a'
                   AND purge_status = 'active' AND reminder_7d_sent_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.team_settings
                    WHERE coach_id = 'f1a10000-0000-4000-8000-00000000000a'
                      AND team_name = 'Verified G') THEN
    RAISE EXCEPTION 'stale purge state altered a verified coach';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coach_purge_state
                 WHERE coach_id = 'f1a20000-0000-4000-8000-00000000000a'
                   AND purge_status = 'active')
     OR NOT EXISTS (SELECT 1 FROM storage.objects
                    WHERE owner_id = 'f1a20000-0000-4000-8000-00000000000a')
     OR NOT EXISTS (SELECT 1 FROM public.team_settings
                    WHERE coach_id = 'f1a20000-0000-4000-8000-00000000000a'
                      AND team_name = 'Logo H') THEN
    RAISE EXCEPTION 'scheduled purge altered an owner of saved Storage data';
  END IF;
END $scheduled_soft$;

-- Now the empty soft-deleted B is past its hard-delete deadline.
UPDATE public.coach_purge_state SET hard_delete_at = now() - interval '1 day'
WHERE coach_id = 'f1b00000-0000-4000-8000-00000000000b';
SET LOCAL ROLE service_role;
SELECT public.process_purge_lifecycle();
SET LOCAL ROLE postgres;
DO $scheduled_hard$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users
             WHERE id = 'f1b00000-0000-4000-8000-00000000000b')
     OR EXISTS (SELECT 1 FROM public.profiles
                WHERE id = 'f1b00000-0000-4000-8000-00000000000b')
     OR EXISTS (SELECT 1 FROM public.team_settings
                WHERE coach_id = 'f1b00000-0000-4000-8000-00000000000b')
     OR NOT EXISTS (SELECT 1 FROM auth.users
                    WHERE id = 'f1c00000-0000-4000-8000-00000000000c') THEN
    RAISE EXCEPTION 'hard-delete boundary failed';
  END IF;
END $scheduled_hard$;

-- Manual action is rejected for a protected coach and for a nonadmin caller.
SELECT set_config('request.jwt.claim.sub', 'f1e00000-0000-4000-8000-00000000000e', true);
DO $manual_protected$
BEGIN
  BEGIN
    PERFORM public.admin_purge_now('f1a00000-0000-4000-8000-00000000000a');
    RAISE EXCEPTION 'manual purge accepted protected coach';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM !~ 'saved data' THEN RAISE; END IF;
  END;
END $manual_protected$;
DO $manual_storage$
BEGIN
  BEGIN
    PERFORM public.admin_purge_now('f1a20000-0000-4000-8000-00000000000a');
    RAISE EXCEPTION 'manual purge accepted Storage owner';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM !~ 'saved data' THEN RAISE; END IF;
  END;
END $manual_storage$;
DO $manual_verified$
BEGIN
  BEGIN
    PERFORM public.admin_purge_now('f1a10000-0000-4000-8000-00000000000a');
    RAISE EXCEPTION 'manual purge accepted verified coach';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM !~ 'Verified coach' THEN RAISE; END IF;
  END;
END $manual_verified$;
SELECT set_config('request.jwt.claim.sub', 'f1d00000-0000-4000-8000-00000000000d', true);
DO $manual_nonadmin$
BEGIN
  BEGIN
    PERFORM public.admin_purge_now('f1d00000-0000-4000-8000-00000000000d');
    RAISE EXCEPTION 'manual purge accepted nonadmin';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'Forbidden' THEN RAISE; END IF;
  END;
END $manual_nonadmin$;

SELECT set_config('request.jwt.claim.sub', 'f1e00000-0000-4000-8000-00000000000e', true);
SELECT public.admin_purge_now('f1d00000-0000-4000-8000-00000000000d');
DO $manual_empty$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.coach_purge_state
                 WHERE coach_id = 'f1d00000-0000-4000-8000-00000000000d'
                   AND purge_status = 'soft_deleted')
     OR NOT EXISTS (SELECT 1 FROM public.team_settings
                    WHERE coach_id = 'f1d00000-0000-4000-8000-00000000000d'
                      AND team_name = 'Deleted team') THEN
    RAISE EXCEPTION 'manual purge failed for empty coach';
  END IF;
END $manual_empty$;

SELECT public.admin_purge_now('f1f00000-0000-4000-8000-00000000000f');
UPDATE auth.users SET email_confirmed_at = now()
WHERE id = 'f1f00000-0000-4000-8000-00000000000f';
DO $verified_after_soft$
BEGIN
  IF EXISTS (SELECT 1 FROM public.coach_purge_state
             WHERE coach_id = 'f1f00000-0000-4000-8000-00000000000f')
     OR NOT EXISTS (SELECT 1 FROM public.profiles
                    WHERE id = 'f1f00000-0000-4000-8000-00000000000f'
                      AND email = 'verify-later@example.test')
     OR NOT EXISTS (SELECT 1 FROM public.team_settings
                    WHERE coach_id = 'f1f00000-0000-4000-8000-00000000000f'
                      AND team_name = 'Kaizen Tracker') THEN
    RAISE EXCEPTION 'verification after soft deletion did not restore profile';
  END IF;
END $verified_after_soft$;

-- Normal writes after soft deletion are refused. The hard-delete guard still
-- protects against a privileged backfill that introduces canonical history.
DO $reject_late_write$
BEGIN
  BEGIN
    INSERT INTO public.tracker_rounds (coach_id, generation)
    VALUES ('f1d00000-0000-4000-8000-00000000000d', 1);
    RAISE EXCEPTION 'soft-deleted coach accepted a new tracker round';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM !~ 'soft-deleted' THEN RAISE; END IF;
  END;
END $reject_late_write$;
DO $reject_late_operation$
BEGIN
  BEGIN
    INSERT INTO public.tracker_operations
      (coach_id, operation_id, device_id, device_sequence,
       kind, base_revision, request)
    VALUES ('f1d00000-0000-4000-8000-00000000000d', gen_random_uuid(),
            gen_random_uuid(), 1, 'start_v1', 0, '{}'::jsonb);
    RAISE EXCEPTION 'soft-deleted coach accepted a new operation';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM !~ 'soft-deleted' THEN RAISE; END IF;
  END;
END $reject_late_operation$;
ALTER TABLE public.tracker_rounds DISABLE TRIGGER tracker_rounds_soft_delete_guard;
INSERT INTO public.tracker_rounds (coach_id, generation)
VALUES ('f1d00000-0000-4000-8000-00000000000d', 1);
ALTER TABLE public.tracker_rounds ENABLE TRIGGER tracker_rounds_soft_delete_guard;
UPDATE public.coach_purge_state SET hard_delete_at = now() - interval '1 day'
WHERE coach_id = 'f1d00000-0000-4000-8000-00000000000d';
SET LOCAL ROLE service_role;
SELECT public.process_purge_lifecycle();
SET LOCAL ROLE postgres;
DO $late_data$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id = 'f1d00000-0000-4000-8000-00000000000d')
     OR NOT EXISTS (SELECT 1 FROM public.tracker_rounds
                    WHERE coach_id = 'f1d00000-0000-4000-8000-00000000000d')
     OR (SELECT count(*) FROM public.activity_log
         WHERE coach_id = 'f1d00000-0000-4000-8000-00000000000d'
           AND event_type = 'purge_soft_deleted') <> 1 THEN
    RAISE EXCEPTION 'late canonical data was not protected or purge replay duplicated';
  END IF;
END $late_data$;

ROLLBACK;
