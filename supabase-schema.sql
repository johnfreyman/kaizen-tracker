-- Run this in your Supabase dashboard: SQL Editor → New query → paste & run

-- Team settings (single enforced row, id must = 1)
CREATE TABLE IF NOT EXISTS team_settings (
  id         SMALLINT PRIMARY KEY DEFAULT 1,
  team_name  TEXT    NOT NULL DEFAULT 'Kaizen Tracker',
  team_logo  TEXT    NOT NULL DEFAULT '',
  raffle_enabled BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT enforce_single_row CHECK (id = 1)
);

-- Roster
CREATE TABLE IF NOT EXISTS roster (
  name     TEXT    PRIMARY KEY,
  is_guest BOOLEAN NOT NULL DEFAULT false
);

-- Events (players stored as a JSON array)
CREATE TABLE IF NOT EXISTS events (
  id       TEXT    PRIMARY KEY,
  date     TEXT    NOT NULL,
  type     TEXT    NOT NULL,
  duration NUMERIC NOT NULL,
  players  JSONB   NOT NULL DEFAULT '[]',
  saved_at TEXT    NOT NULL,
  CONSTRAINT check_event_type CHECK (type IN ('Practice', 'Optional Training'))
);

-- Active session (0 or 1 rows, lock_id must = 1)
CREATE TABLE IF NOT EXISTS active_session (
  lock_id  SMALLINT PRIMARY KEY DEFAULT 1,
  id       TEXT NOT NULL,
  date     TEXT NOT NULL,
  type     TEXT NOT NULL,
  duration NUMERIC NOT NULL,
  CONSTRAINT enforce_single_row CHECK (lock_id = 1),
  CONSTRAINT check_session_type CHECK (type IN ('Practice', 'Optional Training'))
);

-- Archived event sets (events stored as JSONB)
CREATE TABLE IF NOT EXISTS archived_event_sets (
  id          TEXT        PRIMARY KEY,
  archived_at TEXT        NOT NULL,
  events      JSONB       NOT NULL DEFAULT '[]'
);

-- Enable Row Level Security (RLS)
ALTER TABLE team_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster              ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_session      ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_event_sets ENABLE ROW LEVEL SECURITY;

-- Policies for team_settings
CREATE POLICY "Allow authenticated read on team_settings" ON team_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on team_settings" ON team_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for roster
CREATE POLICY "Allow authenticated read on roster" ON roster FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on roster" ON roster FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for events
CREATE POLICY "Allow authenticated read on events" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on events" ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for active_session
CREATE POLICY "Allow authenticated read on active_session" ON active_session FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on active_session" ON active_session FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for archived_event_sets
CREATE POLICY "Allow authenticated read on archived_event_sets" ON archived_event_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on archived_event_sets" ON archived_event_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ADMIN USER SETUP (do NOT add credentials to this file)
-- Create the initial coach/admin account manually via the Supabase dashboard:
--   Authentication → Users → "Add user" → enter email + strong password → "Create user"
-- The new user's profile row will be created automatically by the handle_new_user trigger
-- (defined in supabase-migration-super-admin.sql). No SQL seeding needed here.

-- Enable Supabase Storage team-assets bucket & RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-assets', 'team-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read access on team-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert on team-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update on team-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete on team-assets" ON storage.objects;

CREATE POLICY "Allow public read access on team-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-assets');

CREATE POLICY "Allow authenticated insert on team-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'team-assets');

CREATE POLICY "Allow authenticated update on team-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'team-assets');

CREATE POLICY "Allow authenticated delete on team-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'team-assets');



