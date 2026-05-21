-- =============================================================================
-- Migration 001: Initial schema
-- Run order: FIRST — must complete before 002_super_admin.sql
--
-- Safe to run on a fresh Supabase project. Every statement is idempotent
-- (IF NOT EXISTS / DROP … IF EXISTS) so it can be re-run without side effects.
-- =============================================================================


-- =============================================================================
-- TABLES
-- =============================================================================

-- One row per coach; coach_id is the natural unique key.
CREATE TABLE IF NOT EXISTS public.team_settings (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID     NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  team_name      TEXT     NOT NULL DEFAULT 'Kaizen Tracker',
  team_logo      TEXT     NOT NULL DEFAULT '',
  raffle_enabled BOOLEAN  NOT NULL DEFAULT false
);

-- One row per player per coach; (coach_id, name) must be unique.
CREATE TABLE IF NOT EXISTS public.roster (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name     TEXT    NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT roster_coach_id_name_key UNIQUE (coach_id, name)
);

-- One row per saved event; id is a client-generated UUID stored as TEXT.
CREATE TABLE IF NOT EXISTS public.events (
  id       TEXT    PRIMARY KEY,
  coach_id UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  date     TEXT    NOT NULL,
  type     TEXT    NOT NULL,
  duration NUMERIC NOT NULL,
  players  JSONB   NOT NULL DEFAULT '[]',
  saved_at TEXT    NOT NULL,
  CONSTRAINT check_event_type CHECK (type IN ('Practice', 'Optional Training'))
);

-- At most one in-progress session per coach; coach_id is the natural unique key.
CREATE TABLE IF NOT EXISTS public.active_session (
  lock_id  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  id       TEXT    NOT NULL,
  date     TEXT    NOT NULL,
  type     TEXT    NOT NULL,
  duration NUMERIC NOT NULL,
  CONSTRAINT check_session_type CHECK (type IN ('Practice', 'Optional Training'))
);

-- One row per archived set; id is a client-generated UUID stored as TEXT.
CREATE TABLE IF NOT EXISTS public.archived_event_sets (
  id          TEXT  PRIMARY KEY,
  coach_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  archived_at TEXT  NOT NULL,
  events      JSONB NOT NULL DEFAULT '[]'
);


-- =============================================================================
-- INDEXES
-- =============================================================================

-- team_settings and active_session: UNIQUE (coach_id) already creates an index.

-- events: coach-scoped list ordered newest-first (matches the SELECT … ORDER BY saved_at DESC query)
CREATE INDEX IF NOT EXISTS idx_events_coach_saved_at
  ON public.events (coach_id, saved_at DESC);

-- roster: coach-scoped lookups (UNIQUE constraint covers exact lookups; this covers list scans)
CREATE INDEX IF NOT EXISTS idx_roster_coach_id
  ON public.roster (coach_id);

-- archived_event_sets: coach-scoped list ordered newest-first
CREATE INDEX IF NOT EXISTS idx_archived_sets_coach_archived_at
  ON public.archived_event_sets (coach_id, archived_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.team_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_session      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_event_sets ENABLE ROW LEVEL SECURITY;

-- Drop first so this file is safe to re-run
DROP POLICY IF EXISTS "Coaches can only access their own team_settings"       ON public.team_settings;
DROP POLICY IF EXISTS "Coaches can only access their own roster"              ON public.roster;
DROP POLICY IF EXISTS "Coaches can only access their own events"              ON public.events;
DROP POLICY IF EXISTS "Coaches can only access their own active_session"      ON public.active_session;
DROP POLICY IF EXISTS "Coaches can only access their own archived_event_sets" ON public.archived_event_sets;

CREATE POLICY "Coaches can only access their own team_settings"
  ON public.team_settings FOR ALL TO authenticated
  USING     (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own roster"
  ON public.roster FOR ALL TO authenticated
  USING     (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own events"
  ON public.events FOR ALL TO authenticated
  USING     (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own active_session"
  ON public.active_session FOR ALL TO authenticated
  USING     (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own archived_event_sets"
  ON public.archived_event_sets FOR ALL TO authenticated
  USING     (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());


-- =============================================================================
-- STORAGE: team-assets bucket
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-assets', 'team-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read — any visitor can load team logos embedded in the UI.
DROP POLICY IF EXISTS "Allow public read access on team-assets"    ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert on team-assets"  ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update on team-assets"  ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete on team-assets"  ON storage.objects;

CREATE POLICY "Allow public read access on team-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-assets');

-- Write policies are path-scoped: coaches can only write inside logos/<their-uid>/.
-- The app always uploads to that path (logos/{userId}/{uuid}.ext), so this is
-- equivalent to the previous any-path policy for legitimate use and closes the
-- cross-tenant write gap.
CREATE POLICY "Allow authenticated insert on team-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-assets'
    AND name LIKE 'logos/' || auth.uid()::text || '/%'
  );

CREATE POLICY "Allow authenticated update on team-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'team-assets'
    AND name LIKE 'logos/' || auth.uid()::text || '/%'
  );

CREATE POLICY "Allow authenticated delete on team-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'team-assets'
    AND name LIKE 'logos/' || auth.uid()::text || '/%'
  );
