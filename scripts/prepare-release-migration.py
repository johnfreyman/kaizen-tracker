#!/usr/bin/env python3
"""Prepare the rehearsed first-launch SQL with atomic release guards.

This writes a reviewed SQL artifact; it does not connect to a database.
Apply through Supabase's migration tool, which executes it in one transaction.
For psql, use --single-transaction --set ON_ERROR_STOP=1.
"""
import argparse
import hashlib
from pathlib import Path

EXPECTED_SHA256 = '75ed2e0aaa3d513cd7ac5aca24e6e7581f980be8ba2aecf9154608ceb9dc4b99'
ROOT = Path(__file__).resolve().parents[1]

PRECHECK = """-- First-launch release runner. Must run in a single transaction.
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $release_preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Release must execute as postgres';
  END IF;
  IF (SELECT pg_get_userbyid(proowner) FROM pg_proc
      WHERE oid = 'public.process_purge_lifecycle()'::regprocedure) <> 'postgres' THEN
    RAISE EXCEPTION 'Purge ownership differs from the rehearsal';
  END IF;
  IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='public')
      <> 'pg_database_owner' THEN
    RAISE EXCEPTION 'Public schema ownership differs from the rehearsal';
  END IF;
  IF to_regclass('public.tracker_players') IS NOT NULL THEN
    RAISE EXCEPTION 'First launch has already started; review before reapplying';
  END IF;
END $release_preflight$;

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
    WHERE n.nspname IN ('public','auth','storage') AND c.relkind='r'
    ORDER BY n.nspname,c.relname
  LOOP
    EXECUTE format(
      'INSERT INTO kaizen_release_saved_fingerprints SELECT %L,count(*),'
      'md5(coalesce(string_agg(to_jsonb(t)::text,E''\\n'' ORDER BY to_jsonb(t)::text),'''')) FROM %s t',
      r.name,r.name);
  END LOOP;
END $release_snapshot$;
"""

POSTCHECK = """
DO $release_postcheck$
DECLARE r record; v_count bigint; v_digest text; v_role text; v_privilege text;
BEGIN
  FOR r IN SELECT * FROM kaizen_release_saved_fingerprints LOOP
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'
      'E''\\n'' ORDER BY to_jsonb(t)::text),'''')) FROM %s t',r.relation_name)
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
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    candidate = ROOT / 'docs/simplification-first-launch-release-review-candidate.sql'
    source = candidate.read_bytes()
    if hashlib.sha256(source).hexdigest() != EXPECTED_SHA256:
        raise SystemExit('Candidate differs from the restored rehearsal; review before release.')
    if args.output.resolve() == candidate.resolve():
        raise SystemExit('The runner must not overwrite the reviewed candidate.')
    output = PRECHECK + '\n-- Rehearsed candidate SHA-256: ' + EXPECTED_SHA256 + '\n' + source.decode() + POSTCHECK
    args.output.write_text(output)
    args.output.chmod(0o600)
    print(f'Prepared guarded release SQL: {args.output.resolve()}')
    print('SHA-256:', hashlib.sha256(output.encode()).hexdigest())


if __name__ == '__main__':
    main()
