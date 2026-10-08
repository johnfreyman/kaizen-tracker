-- First-launch rehearsal candidate. Apply only to an isolated test database.
-- The shipped Stage 4 client reads and writes canonical tracker tables through
-- owner-scoped RPCs. Direct browser writes to these nine prelaunch tables are
-- obsolete. Live grants currently include TRUNCATE, which bypasses row-level
-- security, so close that grant as part of the same first-launch migration.
-- This deliberately leaves SELECT in place for the existing admin/status
-- policies and preserves service_role/owner privileges for server workflows.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.active_session,
     public.activity_log,
     public.archived_event_sets,
     public.coach_purge_state,
     public.events,
     public.profiles,
     public.roster,
     public.super_admins,
     public.team_settings
  FROM PUBLIC, anon, authenticated;
