-- TEMPORARY LOCAL REHEARSAL BASELINE ONLY. Do not apply to production.
-- Reproduces relevant live-catalog differences using schema metadata captured
-- in an earlier authorized read-only review; contains no production rows.

ALTER TABLE public.active_session ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.archived_event_sets ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.roster ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.team_settings ALTER COLUMN coach_id DROP NOT NULL;

ALTER TABLE public.coach_purge_state ADD COLUMN IF NOT EXISTS original_deadline timestamptz;
UPDATE public.coach_purge_state SET original_deadline = purge_deadline WHERE original_deadline IS NULL;
ALTER TABLE public.coach_purge_state ALTER COLUMN original_deadline SET NOT NULL;

CREATE OR REPLACE FUNCTION public.init_purge_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_confirmed timestamptz; v_deadline timestamptz;
BEGIN
  SELECT email_confirmed_at INTO v_confirmed FROM auth.users WHERE id = NEW.id;
  IF v_confirmed IS NULL THEN
    v_deadline := COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days';
    INSERT INTO public.coach_purge_state (coach_id,purge_deadline,original_deadline)
    VALUES (NEW.id,v_deadline,v_deadline) ON CONFLICT (coach_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $fn$
BEGIN
  INSERT INTO public.profiles (id,email) VALUES (NEW.id,NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $fn$;

-- The live view has 26 columns; replacing the source-derived 21-column view
-- requires a drop in this empty disposable database.
DROP VIEW public.admin_coach_summary_view;
CREATE VIEW public.admin_coach_summary_view WITH (security_invoker = false) AS
 SELECT p.id AS coach_id,
    p.email,
    p.created_at AS account_created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    (u.raw_app_meta_data ->> 'provider'::text) AS auth_provider,
    ts.team_name,
    ts.team_logo,
    ts.raffle_enabled,
    COALESCE(r_agg.player_count, 0) AS player_count,
    COALESCE(e_agg.session_count, 0) AS session_count,
    e_agg.last_session_at,
    COALESCE(a_agg.archive_count, 0) AS total_archives,
    GREATEST(u.last_sign_in_at, e_agg.last_session_at) AS last_active_at,
    (u.email_confirmed_at IS NOT NULL) AS email_verified,
    ps.purge_status,
    ps.purge_deadline,
    ps.hard_delete_at,
    ps.soft_deleted_at,
    ps.extended_count,
    ps.original_deadline,
    ps.reminder_7d_sent_at,
    ps.reminder_30d_sent_at,
    ps.reminder_60d_sent_at,
    ps.reminder_83d_sent_at,
    GREATEST(ps.reminder_7d_sent_at, ps.reminder_30d_sent_at, ps.reminder_60d_sent_at, ps.reminder_83d_sent_at) AS last_reminder_sent_at
   FROM ((((((profiles p
     JOIN auth.users u ON ((u.id = p.id)))
     LEFT JOIN team_settings ts ON ((ts.coach_id = p.id)))
     LEFT JOIN coach_purge_state ps ON ((ps.coach_id = p.id)))
     LEFT JOIN ( SELECT roster.coach_id,
            (count(*))::integer AS player_count
           FROM roster
          GROUP BY roster.coach_id) r_agg ON ((r_agg.coach_id = p.id)))
     LEFT JOIN ( SELECT events.coach_id,
            (count(*))::integer AS session_count,
            max((events.saved_at)::timestamp with time zone) AS last_session_at
           FROM events
          GROUP BY events.coach_id) e_agg ON ((e_agg.coach_id = p.id)))
     LEFT JOIN ( SELECT archived_event_sets.coach_id,
            (count(*))::integer AS archive_count
           FROM archived_event_sets
          GROUP BY archived_event_sets.coach_id) a_agg ON ((a_agg.coach_id = p.id)))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM super_admins sa
          WHERE (sa.user_id = p.id))));

-- The actual live catalog exposes broad legacy table grants. Reproduce them
-- here so the first-launch hardening candidate has a meaningful baseline.
GRANT ALL PRIVILEGES ON public.active_session TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.activity_log TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.archived_event_sets TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.coach_purge_state TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.events TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.profiles TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.roster TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.super_admins TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.team_settings TO anon, authenticated;
REVOKE ALL ON public.admin_coach_summary_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_coach_summary_view TO service_role;

-- Live public functions are not executable by browser roles.
DO $revoke_legacy$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
  END LOOP;
END $revoke_legacy$;
