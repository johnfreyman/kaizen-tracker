-- =============================================================================
-- Migration 008: Purge lifecycle fixes
-- Run order: EIGHTH — patches objects created by 007
--
-- Pre-production: drops & recreates objects freely.
--
-- Fixes:
--   1. Add original_deadline column (immutable anchor for days_old)
--   2. Reset ALL reminder timestamps on admin_extend_purge_deadline
--   3. Fix last_reminder_sent_at view alias → GREATEST(…)
--   4. Expose individual reminder columns in the view for the UI
-- =============================================================================


-- =============================================================================
-- FIX 1: original_deadline — immutable anchor for days_old
-- =============================================================================

-- Add column (NOT NULL needs a default for existing rows; backfill then drop default)
ALTER TABLE public.coach_purge_state
  ADD COLUMN IF NOT EXISTS original_deadline TIMESTAMPTZ;

-- Backfill from purge_deadline minus extensions, or just use
-- profiles.created_at + 90 days (which is the true original deadline).
UPDATE public.coach_purge_state ps
SET original_deadline = COALESCE(p.created_at, ps.created_at) + INTERVAL '90 days'
FROM public.profiles p
WHERE p.id = ps.coach_id
  AND ps.original_deadline IS NULL;

-- Catch any orphans (no matching profile) — use the purge_state's own created_at
UPDATE public.coach_purge_state
SET original_deadline = created_at + INTERVAL '90 days'
WHERE original_deadline IS NULL;

-- Now enforce NOT NULL
ALTER TABLE public.coach_purge_state
  ALTER COLUMN original_deadline SET NOT NULL;


-- =============================================================================
-- Update init_purge_state trigger to set original_deadline at insert time
-- =============================================================================

CREATE OR REPLACE FUNCTION public.init_purge_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed TIMESTAMPTZ;
  v_deadline  TIMESTAMPTZ;
BEGIN
  SELECT email_confirmed_at INTO v_confirmed
    FROM auth.users WHERE id = NEW.id;

  IF v_confirmed IS NULL THEN
    v_deadline := COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days';

    INSERT INTO public.coach_purge_state (coach_id, purge_deadline, original_deadline)
    VALUES (NEW.id, v_deadline, v_deadline)
    ON CONFLICT (coach_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from 007, no need to re-create — CREATE OR REPLACE
-- updated the function body in place.


-- =============================================================================
-- FIX 2: Reset ALL reminders on extend, not just _83d
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_extend_purge_deadline(
  p_coach_id  UUID,
  p_days      INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_deadline TIMESTAMPTZ;
  v_new_deadline TIMESTAMPTZ;
  v_status       TEXT;
BEGIN
  -- Caller must be super admin
  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT purge_status, purge_deadline
    INTO v_status, v_old_deadline
    FROM public.coach_purge_state
    WHERE coach_id = p_coach_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No purge state found for coach %', p_coach_id;
  END IF;

  IF v_status = 'soft_deleted' THEN
    RAISE EXCEPTION 'Cannot extend — coach already soft-deleted';
  END IF;

  v_new_deadline := v_old_deadline + (p_days || ' days')::INTERVAL;

  UPDATE public.coach_purge_state
    SET purge_deadline       = v_new_deadline,
        extended_count       = extended_count + 1,
        -- Reset ALL reminders so cron re-fires them at new thresholds
        reminder_7d_sent_at  = NULL,
        reminder_30d_sent_at = NULL,
        reminder_60d_sent_at = NULL,
        reminder_83d_sent_at = NULL,
        updated_at           = NOW()
    WHERE coach_id = p_coach_id;

  INSERT INTO public.activity_log (event_type, coach_id, metadata)
  VALUES (
    'purge_deadline_extended',
    p_coach_id,
    jsonb_build_object(
      'old_deadline', v_old_deadline,
      'new_deadline', v_new_deadline,
      'days_added',   p_days,
      'admin_uid',    auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'coach_id',       p_coach_id,
    'old_deadline',   v_old_deadline,
    'new_deadline',   v_new_deadline,
    'extended_count', (SELECT extended_count FROM public.coach_purge_state WHERE coach_id = p_coach_id)
  );
END;
$$;

-- Grants already exist from 007; CREATE OR REPLACE preserves them.


-- =============================================================================
-- FIX 3 + 4: Recreate view with GREATEST(…) for last_reminder_sent_at
--            AND expose individual reminder columns for the timeline UI
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
  (u.email_confirmed_at IS NOT NULL)                          AS email_verified,

  -- ── Purge lifecycle columns (NULL for verified coaches) ──────────────────
  ps.purge_status,
  ps.purge_deadline,
  ps.hard_delete_at,
  ps.soft_deleted_at,
  ps.extended_count,
  ps.original_deadline,

  -- Individual reminder timestamps (for timeline UI)
  ps.reminder_7d_sent_at,
  ps.reminder_30d_sent_at,
  ps.reminder_60d_sent_at,
  ps.reminder_83d_sent_at,

  -- FIX 3: last_reminder_sent_at is now the GREATEST of all reminder timestamps
  GREATEST(
    ps.reminder_7d_sent_at,
    ps.reminder_30d_sent_at,
    ps.reminder_60d_sent_at,
    ps.reminder_83d_sent_at
  )                                                           AS last_reminder_sent_at

FROM public.profiles AS p

-- Join auth.users for auth metadata (available inside SECURITY DEFINER view)
INNER JOIN auth.users AS u
  ON u.id = p.id

-- Optional team settings (LEFT JOIN — coaches without a team row still appear)
LEFT JOIN public.team_settings AS ts
  ON ts.coach_id = p.id

-- Purge lifecycle state (LEFT JOIN — verified coaches have no row)
LEFT JOIN public.coach_purge_state AS ps
  ON ps.coach_id = p.id

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
  ON a_agg.coach_id = p.id

-- Exclude super admin accounts — they are operators, not coaches
WHERE NOT EXISTS (
  SELECT 1 FROM public.super_admins sa WHERE sa.user_id = p.id
);

-- Re-grant SELECT (CREATE OR REPLACE VIEW resets grants)
GRANT SELECT ON public.admin_coach_summary_view TO authenticated;
