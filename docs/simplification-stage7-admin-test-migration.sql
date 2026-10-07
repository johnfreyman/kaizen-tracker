-- Stage 7 isolated admin-summary candidate, 2026-09-27.
-- Apply ONLY to viouquduxutuslafiooy for this rehearsal.
-- Production pwgqwcvultxihntvaewo is read-only for this work.
-- Requires the Stage 3 tracker tables. It changes no attendance, roster,
-- authentication, administrator membership or Edge Function code.
--
-- Existing columns retain their names, order and types. The deployed view has
-- five additional purge/reminder columns absent from the source-derived test
-- schema; keep those columns when the underlying purge state contains them.
-- This view joins auth.users, which service_role cannot read directly.
-- Use the existing deployed SECURITY DEFINER view mode, and restrict direct
-- SELECT to service_role. The protected handler verifies admin membership.
-- CREATE OR REPLACE without an explicit option resets security_invoker.
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
      SELECT owner.coach_id, count(*)::integer AS player_count
      FROM (
        -- If a backfill reuses roster.id, count that identity only once.
        -- A retired canonical identity also suppresses its old roster row.
        SELECT r.coach_id, r.id
        FROM public.roster r
        WHERE NOT EXISTS (
          SELECT 1 FROM public.tracker_players t
          WHERE t.coach_id = r.coach_id AND t.id = r.id
        )
        UNION ALL
        SELECT t.coach_id, t.id
        FROM public.tracker_players t
        WHERE t.retired_at IS NULL
      ) owner
      GROUP BY owner.coach_id
    ) r_agg ON r_agg.coach_id = p.id
    LEFT JOIN (
      SELECT session_rows.coach_id,
             count(*)::integer AS session_count,
             max(session_rows.saved_at) AS last_session_at
      FROM (
        -- A matching UUID/text event ID identifies the same imported session.
        -- Other legacy events and completed tracker sessions both remain.
        SELECT e.coach_id, e.saved_at::timestamptz AS saved_at
        FROM public.events e
        WHERE NOT EXISTS (
          SELECT 1 FROM public.tracker_sessions s
          WHERE s.coach_id = e.coach_id
            AND s.state = 'completed'
            AND s.id::text = lower(e.id)
        )
        UNION ALL
        SELECT s.coach_id, s.completed_at AS saved_at
        FROM public.tracker_sessions s
        WHERE s.state = 'completed'
      ) session_rows
      GROUP BY session_rows.coach_id
    ) e_agg ON e_agg.coach_id = p.id
    LEFT JOIN (
      SELECT archive_rows.coach_id, count(*)::integer AS archive_count
      FROM (
        SELECT a.coach_id FROM public.archived_event_sets a
        UNION ALL
        SELECT s.coach_id FROM public.tracker_sessions s
        WHERE s.state = 'completed' AND s.archived_at IS NOT NULL
      ) archive_rows
      GROUP BY archive_rows.coach_id
    ) a_agg ON a_agg.coach_id = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.super_admins sa WHERE sa.user_id = p.id
    )
  $view$, v_extra);
  EXECUTE v_query;
END
$admin_view$;

-- The verified admin-coach-actions handler reads through service_role.
-- The view must remain inaccessible directly to ordinary browser roles.
REVOKE ALL ON public.admin_coach_summary_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_coach_summary_view TO service_role;
