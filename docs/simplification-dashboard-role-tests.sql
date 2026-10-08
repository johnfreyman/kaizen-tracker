-- Rollback-only checks for the restored admin dashboard, local rehearsal only.
BEGIN;
SET LOCAL ROLE postgres;
SELECT set_config('kaizen_test.admin', (SELECT user_id::text FROM public.super_admins LIMIT 1), true);
INSERT INTO auth.users(id,email,aud,role,email_confirmed_at)
VALUES ('f6000000-0000-4000-8000-000000000099','dashboard-fixture@example.test','authenticated','authenticated',now());
INSERT INTO auth.sessions(id,user_id)
VALUES ('f6000000-0000-4000-8000-000000000098','f6000000-0000-4000-8000-000000000099');
INSERT INTO auth.refresh_tokens(id,token,user_id,revoked,session_id)
VALUES (999000001,'local-dashboard-fixture-only','f6000000-0000-4000-8000-000000000099',false,'f6000000-0000-4000-8000-000000000098');

DO $permissions$
BEGIN
  IF has_function_privilege('anon','public.admin_revoke_coach_sessions_v1(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.admin_revoke_coach_sessions_v1(uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.admin_revoke_coach_sessions_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Account-control helper permissions differ';
  END IF;
  IF has_table_privilege('service_role','public.tracker_exit_codes','SELECT')
    OR has_table_privilege('service_role','public.tracker_operations','SELECT')
    OR has_table_privilege('authenticated','public.admin_coach_summary_view','SELECT') THEN
    RAISE EXCEPTION 'Sensitive tables or privileged summary were exposed';
  END IF;
END $permissions$;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub','f6000000-0000-4000-8000-000000000099','role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $coach_denied$
BEGIN
  BEGIN
    PERFORM public.admin_revoke_coach_sessions_v1('f6000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'Ordinary coach executed account-control helper';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $coach_denied$;

SET LOCAL ROLE postgres;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('kaizen_test.admin'),'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $service_control$
DECLARE v_admin uuid := current_setting('kaizen_test.admin')::uuid; v_count integer;
BEGIN
  BEGIN
    PERFORM public.admin_revoke_coach_sessions_v1(v_admin);
    RAISE EXCEPTION 'Superuser sessions were not protected';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT public.admin_revoke_coach_sessions_v1('f6000000-0000-4000-8000-000000000099') INTO v_count;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one revoked fixture session'; END IF;
END $service_control$;

SET LOCAL ROLE postgres;
DO $retention$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.sessions WHERE user_id='f6000000-0000-4000-8000-000000000099')
    OR EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE session_id='f6000000-0000-4000-8000-000000000098') THEN
    RAISE EXCEPTION 'Fixture session or refresh token remains';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='f6000000-0000-4000-8000-000000000099')
    OR NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id=current_setting('kaizen_test.admin')::uuid) THEN
    RAISE EXCEPTION 'Coach or superuser account changed';
  END IF;
END $retention$;
ROLLBACK;
