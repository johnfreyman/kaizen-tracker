-- REVIEW CANDIDATE ONLY. Never apply before the new coach client and admin
-- replacement have passed release checks. This destroys prelaunch legacy
-- attendance rows; take and verify a private backup first.
-- Apply to the retained Kaizen Tracker project only after the separate
-- first-launch release migration has installed canonical tracker objects.
-- A separate project deletion is not part of this SQL.

BEGIN;
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

COMMIT;
