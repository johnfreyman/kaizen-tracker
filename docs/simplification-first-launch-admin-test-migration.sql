-- First-launch admin summary candidate for the isolated Stage 3 test project.
-- Counts only canonical tracker records. Prelaunch legacy rows are test data.
-- Do not apply this file to production without a separate reviewed release.
-- Keep existing view column order/types and service-only direct access.
DO $admin_view$
DECLARE
  v_extra text := '';
  v_query text;
BEGIN
  IF to_regclass('public.admin_coach_summary_view') IS NULL
     OR to_regclass('public.tracker_players') IS NULL
     OR to_regclass('public.tracker_sessions') IS NULL THEN
    RAISE EXCEPTION 'Admin summary and canonical tracker tables are required';
  END IF;

  -- The deployed purge state/view has five more columns than the source-derived
  -- isolated fixture. Retain them in their existing positions when present.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coach_purge_state'
      AND column_name = 'original_deadline'
  ) THEN
    v_extra := $fields$
    ps.original_deadline,
    ps.reminder_7d_sent_at,
    ps.reminder_30d_sent_at,
    ps.reminder_60d_sent_at,
    ps.reminder_83d_sent_at,
    $fields$;
  END IF;

  v_query := format($view$
    CREATE OR REPLACE VIEW public.admin_coach_summary_view
    WITH (security_invoker = false) AS
    SELECT
      p.id AS coach_id,
      p.email,
      p.created_at AS account_created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      u.raw_app_meta_data ->> 'provider' AS auth_provider,
      ts.team_name,
      ts.team_logo,
      ts.raffle_enabled,
      COALESCE(r_agg.player_count, 0)::integer AS player_count,
      COALESCE(e_agg.session_count, 0)::integer AS session_count,
      e_agg.last_session_at,
      COALESCE(a_agg.archive_count, 0)::integer AS total_archives,
      GREATEST(u.last_sign_in_at, e_agg.last_session_at) AS last_active_at,
      (u.email_confirmed_at IS NOT NULL) AS email_verified,
      ps.purge_status,
      ps.purge_deadline,
      ps.hard_delete_at,
      ps.soft_deleted_at,
      ps.extended_count,
      %s
      GREATEST(
        ps.reminder_7d_sent_at, ps.reminder_30d_sent_at,
        ps.reminder_60d_sent_at, ps.reminder_83d_sent_at
      ) AS last_reminder_sent_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.team_settings ts ON ts.coach_id = p.id
    LEFT JOIN public.coach_purge_state ps ON ps.coach_id = p.id
    LEFT JOIN (
      SELECT coach_id, count(*)::integer AS player_count
      FROM public.tracker_players
      WHERE retired_at IS NULL
      GROUP BY coach_id
    ) r_agg ON r_agg.coach_id = p.id
    LEFT JOIN (
      SELECT coach_id,
             count(*)::integer AS session_count,
             max(completed_at) AS last_session_at
      FROM public.tracker_sessions
      WHERE state = 'completed'
      GROUP BY coach_id
    ) e_agg ON e_agg.coach_id = p.id
    LEFT JOIN (
      SELECT coach_id, count(*)::integer AS archive_count
      FROM public.tracker_sessions
      WHERE state = 'completed' AND archived_at IS NOT NULL
      GROUP BY coach_id
    ) a_agg ON a_agg.coach_id = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.super_admins sa WHERE sa.user_id = p.id
    )
  $view$, v_extra);
  EXECUTE v_query;
END
$admin_view$;

-- Only the protected admin-coach-actions handler uses service_role to read it.
REVOKE ALL ON public.admin_coach_summary_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_coach_summary_view TO service_role;
