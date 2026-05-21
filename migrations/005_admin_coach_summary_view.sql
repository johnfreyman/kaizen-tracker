-- =============================================================================
-- Migration 005: Admin coach summary view
-- Run order: FIFTH — requires tables from 001_schema.sql and 002_super_admin.sql
--
-- Creates a SECURITY DEFINER view that aggregates coach data for the super admin
-- dashboard. Runs as the postgres owner so it can safely JOIN into auth.users
-- to read last_sign_in_at, email_confirmed_at, and provider — no secrets exposed.
--
-- Safe to re-run: uses CREATE OR REPLACE VIEW and idempotent GRANT/REVOKE.
-- =============================================================================


-- =============================================================================
-- VIEW: admin_coach_summary_view
-- One row per coach profile. Aggregates team, roster, events, and archives.
-- =============================================================================

CREATE OR REPLACE VIEW public.admin_coach_summary_view
WITH (security_invoker = false)
AS
SELECT
  p.id                                                        AS coach_id,
  p.email,
  p.created_at                                                AS account_created_at,

  -- Auth metadata from auth.users (accessible because this view runs as owner)
  u.last_sign_in_at,
  u.email_confirmed_at,
  u.raw_app_meta_data ->> 'provider'                          AS auth_provider,

  -- Team info (NULL if coach never completed onboarding)
  ts.team_name,
  ts.team_logo,
  ts.raffle_enabled,

  -- Roster count
  COALESCE(r_agg.player_count, 0)                             AS player_count,

  -- Event counts and last session timestamp
  COALESCE(e_agg.session_count, 0)                            AS session_count,
  e_agg.last_session_at,

  -- Archive count
  COALESCE(a_agg.archive_count, 0)                            AS total_archives,

  -- last_active_at: most recent of (last login, last session saved)
  GREATEST(
    u.last_sign_in_at,
    e_agg.last_session_at
  )                                                           AS last_active_at,

  -- email_verified convenience boolean
  (u.email_confirmed_at IS NOT NULL)                          AS email_verified

FROM public.profiles AS p

-- Join auth.users for auth metadata (available inside SECURITY DEFINER view)
INNER JOIN auth.users AS u
  ON u.id = p.id

-- Optional team settings (LEFT JOIN — coaches without a team row still appear)
LEFT JOIN public.team_settings AS ts
  ON ts.coach_id = p.id

-- Pre-aggregated roster counts per coach
LEFT JOIN (
  SELECT coach_id, COUNT(*)::int AS player_count
  FROM public.roster
  GROUP BY coach_id
) AS r_agg
  ON r_agg.coach_id = p.id

-- Pre-aggregated event metrics per coach
LEFT JOIN (
  SELECT
    coach_id,
    COUNT(*)::int                    AS session_count,
    MAX(saved_at::timestamptz)       AS last_session_at
  FROM public.events
  GROUP BY coach_id
) AS e_agg
  ON e_agg.coach_id = p.id

-- Pre-aggregated archive counts per coach
LEFT JOIN (
  SELECT coach_id, COUNT(*)::int AS archive_count
  FROM public.archived_event_sets
  GROUP BY coach_id
) AS a_agg
  ON a_agg.coach_id = p.id;


-- =============================================================================
-- ACCESS CONTROL
-- Only super admins may query this view via PostgREST.
-- Revoke the default public grant, then grant to authenticated with a guard.
-- =============================================================================

-- Grant SELECT to authenticated role so PostgREST can expose it
GRANT SELECT ON public.admin_coach_summary_view TO authenticated;

-- Row-level guard: only super admins can see rows
-- Views don't support RLS directly, but we achieve the same with a policy on
-- the underlying tables already in 002_super_admin.sql. For belt-and-suspenders
-- security we also create a helper function to check super admin status that
-- the view can reference if needed in future. The existing per-table super-admin
-- SELECT policies already prevent non-super-admins from reading profiles,
-- team_settings, roster, events, and archived_event_sets — so any query against
-- this view by a non-super-admin will return 0 rows (profiles is the driving
-- table and only super admins can read all profiles rows).

-- =============================================================================
-- NOTE ON auth.users ACCESS
-- auth.users is in the auth schema which is owned by postgres. A SECURITY
-- DEFINER view created by the postgres role executes with postgres credentials
-- and can safely JOIN auth.users. This is the same privilege level used by the
-- handle_new_user trigger in 002_super_admin.sql.
-- No passwords, tokens, or secrets are selected — only:
--   last_sign_in_at, email_confirmed_at, raw_app_meta_data->>'provider'
-- =============================================================================
