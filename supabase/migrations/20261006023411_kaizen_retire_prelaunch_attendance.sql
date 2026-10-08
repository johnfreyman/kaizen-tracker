-- Legacy retirement wrapper. Apply in a single transaction, only to the retained project.
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $retirement_role$ BEGIN
 IF current_user <> 'postgres' OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.process_purge_lifecycle()'::regprocedure) <> 'postgres' THEN
 RAISE EXCEPTION 'Execution and purge owner must match postgres rehearsal'; END IF;
END $retirement_role$;
LOCK TABLE public.roster, public.events, public.active_session, public.archived_event_sets IN ACCESS EXCLUSIVE MODE;
DO $retirement_counts$ BEGIN
 IF (SELECT count(*) FROM public.roster) <> 20 OR (SELECT count(*) FROM public.events) <> 17 OR (SELECT count(*) FROM public.active_session) <> 2 OR (SELECT count(*) FROM public.archived_event_sets) <> 0 THEN
 RAISE EXCEPTION 'Legacy counts differ from reviewed private backup; inspect before retirement'; END IF;
END $retirement_counts$;
CREATE TEMP TABLE kaizen_release_saved_fingerprints (
  relation_name text PRIMARY KEY, row_count bigint NOT NULL, digest text NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE kaizen_release_saved_cron ON COMMIT DROP AS
  SELECT to_jsonb(j) AS job FROM cron.job j;
DO $release_snapshot$
DECLARE r record;
BEGIN
  FOR r IN SELECT format('%I.%I',n.nspname,c.relname) AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND c.relkind='r' AND NOT (n.nspname='public' AND c.relname IN ('roster','events','active_session','archived_event_sets'))
    ORDER BY n.nspname,c.relname
  LOOP
    EXECUTE format(
      'INSERT INTO kaizen_release_saved_fingerprints SELECT %L,count(*),'
      'md5(coalesce(string_agg(to_jsonb(t)::text,E''\n'' ORDER BY to_jsonb(t)::text),'''')) FROM %s t',
      r.name,r.name);
  END LOOP;
END $release_snapshot$;

-- Candidate SHA256: 0cc6bf864ca18f480a439788fbffcc2aa0c004f2256450d056fda9aeb7c8b786
-- REVIEW CANDIDATE ONLY. Never apply before the new coach client and admin
-- replacement have passed release checks. This destroys prelaunch legacy
-- attendance rows; take and verify a private backup first.
-- Apply to the retained Kaizen Tracker project only after the separate
-- first-launch release migration has installed canonical tracker objects.
-- A separate project deletion is not part of this SQL.


SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF to_regclass('public.roster') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.active_session') IS NULL
     OR to_regclass('public.archived_event_sets') IS NULL THEN
    RAISE EXCEPTION 'Expected four legacy attendance tables; inspect schema before retirement';
  END IF;
  IF to_regclass('public.tracker_players') IS NULL
     OR to_regclass('public.tracker_sessions') IS NULL
     OR to_regclass('public.tracker_operations') IS NULL
     OR to_regprocedure('public.tracker_initialize_owner_v1()') IS NULL
     OR to_regclass('public.admin_coach_summary_view') IS NULL THEN
    RAISE EXCEPTION 'Canonical tracker and admin summary must be installed first';
  END IF;
  IF position('tracker_players' IN pg_get_viewdef('public.admin_coach_summary_view'::regclass, true)) = 0
     OR position('tracker_sessions' IN pg_get_viewdef('public.admin_coach_summary_view'::regclass, true)) = 0 THEN
    RAISE EXCEPTION 'Admin summary still depends on legacy attendance; replace it first';
  END IF;
  -- DROP TABLE removes attached triggers even with RESTRICT. Refuse any new
  -- trigger that has not been individually reviewed here.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.oid IN ('public.roster'::regclass, 'public.events'::regclass,
                    'public.active_session'::regclass,
                    'public.archived_event_sets'::regclass)
      AND NOT t.tgisinternal
      AND ROW(c.relname, t.tgname) NOT IN (
        ROW('events', 'trg_log_session_saved'),
        ROW('archived_event_sets', 'trg_log_archive_created'),
        ROW('archived_event_sets', 'trg_log_archive_restored')
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected legacy table trigger; inspect before retirement';
  END IF;
END
$preflight$;

-- Drop named legacy logging triggers before their functions. The signup,
-- raffle-settings, purge and admin functions/triggers remain in place.
DROP TRIGGER trg_log_session_saved ON public.events;
DROP TRIGGER trg_log_archive_created ON public.archived_event_sets;
DROP TRIGGER trg_log_archive_restored ON public.archived_event_sets;

DROP FUNCTION public.save_session(uuid, text, text, text, numeric, jsonb, text);
DROP FUNCTION public.archive_events(uuid, text, text, jsonb, text[]);
DROP FUNCTION public.restore_archive(uuid, text, jsonb);
-- The local rehearsal baseline excludes migration 010, while the live catalog
-- contains this destructive legacy helper.
DROP FUNCTION IF EXISTS public.remove_player(uuid, text);
DROP FUNCTION public.log_session_saved();
DROP FUNCTION public.log_archive_created();
DROP FUNCTION public.log_archive_restored();

-- RESTRICT catches catalog-tracked external dependencies such as views and
-- foreign keys. It does not detect every PL/pgSQL function-body reference;
-- inspect the live function inventory separately before execution.
DROP TABLE public.active_session RESTRICT;
DROP TABLE public.archived_event_sets RESTRICT;
DROP TABLE public.events RESTRICT;
DROP TABLE public.roster RESTRICT;

DO $postcheck$
BEGIN
  IF to_regclass('public.roster') IS NOT NULL
     OR to_regclass('public.events') IS NOT NULL
     OR to_regclass('public.active_session') IS NOT NULL
     OR to_regclass('public.archived_event_sets') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy attendance tables remain after retirement';
  END IF;
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.super_admins') IS NULL
     OR to_regclass('public.team_settings') IS NULL
     OR to_regclass('public.coach_purge_state') IS NULL
     OR to_regclass('public.activity_log') IS NULL
     OR to_regclass('public.tracker_players') IS NULL
     OR to_regclass('public.tracker_sessions') IS NULL
     OR to_regclass('public.admin_coach_summary_view') IS NULL THEN
    RAISE EXCEPTION 'A required support or canonical object is missing';
  END IF;
END
$postcheck$;



DO $release_postcheck$
DECLARE r record; v_count bigint; v_digest text; v_role text; v_privilege text;
BEGIN
  FOR r IN SELECT * FROM kaizen_release_saved_fingerprints LOOP
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'
      'E''\n'' ORDER BY to_jsonb(t)::text),'''')) FROM %s t',r.relation_name)
      INTO v_count,v_digest;
    IF v_count <> r.row_count OR v_digest <> r.digest THEN
      RAISE EXCEPTION 'Saved records changed in %; aborting release',r.relation_name;
    END IF;
  END LOOP;
  IF EXISTS ((SELECT to_jsonb(j) FROM cron.job j EXCEPT SELECT job FROM kaizen_release_saved_cron)
    UNION ALL (SELECT job FROM kaizen_release_saved_cron EXCEPT SELECT to_jsonb(j) FROM cron.job j)) THEN
    RAISE EXCEPTION 'Scheduled job configuration changed';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'tracker_%') <> 14 THEN
    RAISE EXCEPTION 'Expected 14 canonical tracker tables';
  END IF;
  FOR r IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'tracker_%'
  LOOP
    IF NOT r.relrowsecurity OR NOT has_table_privilege('authenticated',r.oid,'SELECT')
      OR has_table_privilege('anon',r.oid,'SELECT') THEN
      RAISE EXCEPTION 'Tracker read security differs on %',r.relname;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(v_role,r.oid,v_privilege) THEN
          RAISE EXCEPTION 'Unexpected % grant for % on %',v_privilege,v_role,r.relname;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR r IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname = ANY(ARRAY['active_session','activity_log',
      'archived_event_sets','coach_purge_state','events','profiles','roster','super_admins','team_settings'])
  LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(v_role,r.oid,v_privilege) THEN
          RAISE EXCEPTION 'Legacy write grant remains for % on %',v_role,r.relname;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
      AND table_name='admin_coach_summary_view') <> 26
    OR has_table_privilege('anon','public.admin_coach_summary_view','SELECT')
    OR has_table_privilege('authenticated','public.admin_coach_summary_view','SELECT')
    OR NOT has_table_privilege('service_role','public.admin_coach_summary_view','SELECT') THEN
    RAISE EXCEPTION 'Protected admin view contract differs';
  END IF;
  FOR r IN SELECT p.oid,p.proname,p.proowner FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'tracker_%'
  LOOP
    IF pg_get_userbyid(r.proowner) <> 'postgres'
      OR has_function_privilege('anon',r.oid,'EXECUTE')
      OR NOT has_function_privilege('authenticated',r.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Tracker RPC security differs on %',r.proname;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='tracker_private' AND pg_get_userbyid(p.proowner)<>'postgres') THEN
    RAISE EXCEPTION 'Private helper ownership differs';
  END IF;
  IF has_function_privilege('anon','public.process_purge_lifecycle()','EXECUTE')
    OR has_function_privilege('authenticated','public.process_purge_lifecycle()','EXECUTE') THEN
    RAISE EXCEPTION 'Scheduled purge is exposed to browser roles';
  END IF;
END $release_postcheck$;
NOTIFY pgrst, 'reload schema';
