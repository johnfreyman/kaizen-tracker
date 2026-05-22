-- ============================================================
-- 006_activity_log.sql
-- Operational activity log for the super admin dashboard.
--
-- Captures:
--   session_saved      — events INSERT
--   coach_signup       — profiles INSERT
--   archive_created    — archived_event_sets INSERT
--   archive_restored   — archived_event_sets DELETE
--   raffle_toggled     — team_settings UPDATE (raffle_enabled)
--
-- Backfills historical data from existing rows on first run.
-- ============================================================

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  coach_id    UUID,
  coach_email TEXT,
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at
  ON public.activity_log (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_event_type
  ON public.activity_log (event_type);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_select_activity_log"
  ON public.activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE user_id = auth.uid()
    )
  );

-- ── Realtime ───────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

-- ── Trigger: session saved ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_session_saved()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.coach_id;
  INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata, occurred_at)
  VALUES (
    'session_saved',
    NEW.coach_id,
    v_email,
    jsonb_build_object(
      'session_id',   NEW.id,
      'session_type', NEW.type,
      'duration',     NEW.duration
    ),
    COALESCE(NEW.saved_at::TIMESTAMPTZ, NOW())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_session_saved ON public.events;
CREATE TRIGGER trg_log_session_saved
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.log_session_saved();

-- ── Trigger: coach signup ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_coach_signup()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.activity_log (event_type, coach_id, coach_email, occurred_at)
  VALUES ('coach_signup', NEW.id, NEW.email, COALESCE(NEW.created_at, NOW()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_coach_signup ON public.profiles;
CREATE TRIGGER trg_log_coach_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_coach_signup();

-- ── Trigger: archive created ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_archive_created()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.coach_id;
  INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata, occurred_at)
  VALUES (
    'archive_created',
    NEW.coach_id,
    v_email,
    jsonb_build_object('archive_id', NEW.id),
    COALESCE(NEW.archived_at::TIMESTAMPTZ, NOW())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_archive_created ON public.archived_event_sets;
CREATE TRIGGER trg_log_archive_created
  AFTER INSERT ON public.archived_event_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_archive_created();

-- ── Trigger: archive restored (DELETE) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_archive_restored()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = OLD.coach_id;
  INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata)
  VALUES (
    'archive_restored',
    OLD.coach_id,
    v_email,
    jsonb_build_object('archive_id', OLD.id)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_archive_restored ON public.archived_event_sets;
CREATE TRIGGER trg_log_archive_restored
  AFTER DELETE ON public.archived_event_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_archive_restored();

-- ── Trigger: raffle toggled ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_raffle_toggled()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF OLD.raffle_enabled IS DISTINCT FROM NEW.raffle_enabled THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = NEW.coach_id;
    INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata)
    VALUES (
      'raffle_toggled',
      NEW.coach_id,
      v_email,
      jsonb_build_object('enabled', NEW.raffle_enabled)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_raffle_toggled ON public.team_settings;
CREATE TRIGGER trg_log_raffle_toggled
  AFTER UPDATE OF raffle_enabled ON public.team_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_raffle_toggled();

-- ── Backfill: coach signups ────────────────────────────────────────────────

INSERT INTO public.activity_log (event_type, coach_id, coach_email, occurred_at)
SELECT 'coach_signup', p.id, p.email, COALESCE(p.created_at, NOW())
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.super_admins sa WHERE sa.user_id = p.id
);

-- ── Backfill: recent 100 sessions ─────────────────────────────────────────

INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata, occurred_at)
SELECT
  'session_saved',
  e.coach_id,
  p.email,
  jsonb_build_object(
    'session_id',   e.id,
    'session_type', e.type,
    'duration',     e.duration
  ),
  COALESCE(e.saved_at::TIMESTAMPTZ, NOW())
FROM (
  SELECT * FROM public.events ORDER BY saved_at DESC LIMIT 100
) e
JOIN public.profiles p ON p.id = e.coach_id;

-- ── Backfill: archives ─────────────────────────────────────────────────────

INSERT INTO public.activity_log (event_type, coach_id, coach_email, metadata, occurred_at)
SELECT
  'archive_created',
  ae.coach_id,
  p.email,
  jsonb_build_object('archive_id', ae.id),
  COALESCE(ae.archived_at::TIMESTAMPTZ, NOW())
FROM public.archived_event_sets ae
JOIN public.profiles p ON p.id = ae.coach_id;
