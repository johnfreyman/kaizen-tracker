-- =============================================================================
-- Migration 007: Purge lifecycle for unverified coaches
-- Run order: SEVENTH — requires tables from 001, 002, 005, 006
--
-- Implements a 90-day soft-delete / 365-day hard-delete lifecycle for coaches
-- who never verify their email.
--
-- Safe to re-run: every statement uses IF NOT EXISTS, CREATE OR REPLACE,
-- DROP … IF EXISTS, or ON CONFLICT DO NOTHING.
-- =============================================================================


-- =============================================================================
-- TABLE: coach_purge_state
-- One row per unverified coach. Tracks lifecycle status, deadline, reminder
-- idempotency, and admin overrides. Verified coaches never have a row; if a
-- coach verifies, their row is deleted by the clear_purge_on_verify trigger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_purge_state (
  coach_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Lifecycle status (state machine)
  --   'active'       → normal unverified account, clock is ticking
  --   'soft_deleted' → day-90 anonymization complete, row retained for metrics
  purge_status    TEXT NOT NULL DEFAULT 'active'
                  CHECK (purge_status IN ('active', 'soft_deleted')),

  -- Deadline tracking
  purge_deadline  TIMESTAMPTZ NOT NULL,            -- soft-delete fires at this timestamp
  hard_delete_at  TIMESTAMPTZ,                     -- set when soft-deleted; = soft_delete_time + 275d

  -- Reminder idempotency — tracks which milestones have been sent
  reminder_7d_sent_at   TIMESTAMPTZ,
  reminder_30d_sent_at  TIMESTAMPTZ,
  reminder_60d_sent_at  TIMESTAMPTZ,
  reminder_83d_sent_at  TIMESTAMPTZ,

  -- Admin overrides
  extended_count  INT NOT NULL DEFAULT 0,           -- how many times "Extend 30d" was used
  purged_by       TEXT,                              -- 'cron' | 'admin:<uid>' — who triggered soft-delete

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_deleted_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- INDEXES
-- =============================================================================

-- Cron: "all active rows past their deadline"
CREATE INDEX IF NOT EXISTS idx_purge_active_deadline
  ON public.coach_purge_state (purge_deadline)
  WHERE purge_status = 'active';

-- Cron: "all soft-deleted rows past hard_delete_at"
CREATE INDEX IF NOT EXISTS idx_purge_hard_delete
  ON public.coach_purge_state (hard_delete_at)
  WHERE purge_status = 'soft_deleted';


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.coach_purge_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_select_purge_state" ON public.coach_purge_state;
CREATE POLICY "super_admins_select_purge_state"
  ON public.coach_purge_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE user_id = auth.uid()
    )
  );

-- No direct client writes — all mutations go through RPCs or cron (service_role).


-- =============================================================================
-- TRIGGER: init_purge_state
-- When a new profile row is inserted AND the corresponding auth.users row has
-- email_confirmed_at IS NULL, auto-create a coach_purge_state row with
-- purge_deadline = created_at + 90 days.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.init_purge_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed TIMESTAMPTZ;
BEGIN
  SELECT email_confirmed_at INTO v_confirmed
    FROM auth.users WHERE id = NEW.id;

  IF v_confirmed IS NULL THEN
    INSERT INTO public.coach_purge_state (coach_id, purge_deadline)
    VALUES (NEW.id, COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days')
    ON CONFLICT (coach_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_purge_state ON public.profiles;
CREATE TRIGGER trg_init_purge_state
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.init_purge_state();


-- =============================================================================
-- TRIGGER: clear_purge_on_verify
-- When auth.users.email_confirmed_at transitions from NULL to non-NULL, delete
-- the coach_purge_state row (coach is verified, no longer subject to purge)
-- and log the event.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.clear_purge_on_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Only log + delete if there is actually a purge state row
    IF EXISTS (SELECT 1 FROM public.coach_purge_state WHERE coach_id = NEW.id) THEN
      DELETE FROM public.coach_purge_state WHERE coach_id = NEW.id;

      INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata)
      VALUES (
        'purge_cancelled_verified',
        NEW.id,
        NEW.email,
        jsonb_build_object('reason', 'email_verified')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_purge_on_verify ON auth.users;
CREATE TRIGGER trg_clear_purge_on_verify
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_purge_on_verify();


-- =============================================================================
-- VIEW: admin_coach_summary_view (updated)
-- Adds purge-lifecycle columns via LEFT JOIN to coach_purge_state.
-- All existing columns are preserved — no breaking change.
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
  ps.reminder_83d_sent_at                                     AS last_reminder_sent_at

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


-- =============================================================================
-- RPC: admin_extend_purge_deadline
-- Adds p_days (default 30) to the purge deadline. Resets the 83d final-warning
-- reminder so it fires again relative to the new deadline.
-- Uses SELECT … FOR UPDATE to prevent races with the cron.
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
        -- Reset the 83d reminder so it fires again relative to new deadline
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

REVOKE ALL    ON FUNCTION public.admin_extend_purge_deadline(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_purge_deadline(UUID, INT) TO authenticated;


-- =============================================================================
-- RPC: admin_purge_now
-- Immediately soft-deletes a coach: anonymize PII, null team_name, update
-- purge state, and log the action. Uses SELECT … FOR UPDATE to prevent races.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_purge_now(
  p_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  TEXT;
  v_email   TEXT;
BEGIN
  -- Caller must be super admin
  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT purge_status INTO v_status
    FROM public.coach_purge_state
    WHERE coach_id = p_coach_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No purge state found for coach %', p_coach_id;
  END IF;

  IF v_status = 'soft_deleted' THEN
    RAISE EXCEPTION 'Coach already soft-deleted';
  END IF;

  -- Capture email before anonymization
  SELECT email INTO v_email FROM public.profiles WHERE id = p_coach_id;

  -- Anonymize PII in profiles
  UPDATE public.profiles
    SET email = 'purged-' || p_coach_id || '@deleted.local'
    WHERE id = p_coach_id;

  -- Null team data (retain row for aggregate counts)
  UPDATE public.team_settings
    SET team_name = NULL, team_logo = ''
    WHERE coach_id = p_coach_id;

  -- Update purge state
  UPDATE public.coach_purge_state
    SET purge_status    = 'soft_deleted',
        soft_deleted_at = NOW(),
        hard_delete_at  = NOW() + INTERVAL '275 days',
        purged_by       = 'admin:' || auth.uid()::TEXT,
        updated_at      = NOW()
    WHERE coach_id = p_coach_id;

  -- Log to activity_log
  INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata)
  VALUES (
    'purge_soft_deleted',
    p_coach_id,
    'purged-' || p_coach_id || '@deleted.local',
    jsonb_build_object(
      'trigger',        'admin',
      'admin_uid',      auth.uid(),
      'original_email', v_email
    )
  );

  RETURN jsonb_build_object(
    'coach_id',       p_coach_id,
    'purge_status',   'soft_deleted',
    'hard_delete_at', (SELECT hard_delete_at FROM public.coach_purge_state WHERE coach_id = p_coach_id)
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.admin_purge_now(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_now(UUID) TO authenticated;


-- =============================================================================
-- BACKFILL: existing unverified coaches
-- Creates coach_purge_state rows for all unverified, non-admin coaches that
-- don't already have one. Uses COALESCE for created_at to handle NULL.
--
-- WARNING: Accounts older than 90 days will have purge_deadline in the past.
-- The cron's first run will soft-delete them. Audit the results and manually
-- extend any accounts you want to preserve before enabling the cron.
-- =============================================================================

INSERT INTO public.coach_purge_state (coach_id, purge_deadline)
SELECT p.id, COALESCE(p.created_at, NOW()) + INTERVAL '90 days'
FROM public.profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE u.email_confirmed_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.coach_purge_state ps WHERE ps.coach_id = p.id)
ON CONFLICT (coach_id) DO NOTHING;
