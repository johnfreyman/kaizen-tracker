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
  saved_at TEXT    NOT NULL
);

-- Active session (0 or 1 rows, lock_id must = 1)
CREATE TABLE IF NOT EXISTS active_session (
  lock_id  SMALLINT PRIMARY KEY DEFAULT 1,
  id       TEXT NOT NULL,
  date     TEXT NOT NULL,
  type     TEXT NOT NULL,
  duration NUMERIC NOT NULL,
  CONSTRAINT enforce_single_row CHECK (lock_id = 1)
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
DROP POLICY IF EXISTS "Allow authenticated read on team_settings" ON team_settings;
DROP POLICY IF EXISTS "Allow authenticated write on team_settings" ON team_settings;
CREATE POLICY "Allow authenticated read on team_settings" ON team_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on team_settings" ON team_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for roster
DROP POLICY IF EXISTS "Allow authenticated read on roster" ON roster;
DROP POLICY IF EXISTS "Allow authenticated write on roster" ON roster;
CREATE POLICY "Allow authenticated read on roster" ON roster FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on roster" ON roster FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for events
DROP POLICY IF EXISTS "Allow authenticated read on events" ON events;
DROP POLICY IF EXISTS "Allow authenticated write on events" ON events;
CREATE POLICY "Allow authenticated read on events" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on events" ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for active_session
DROP POLICY IF EXISTS "Allow authenticated read on active_session" ON active_session;
DROP POLICY IF EXISTS "Allow authenticated write on active_session" ON active_session;
CREATE POLICY "Allow authenticated read on active_session" ON active_session FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on active_session" ON active_session FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for archived_event_sets
DROP POLICY IF EXISTS "Allow authenticated read on archived_event_sets" ON archived_event_sets;
DROP POLICY IF EXISTS "Allow authenticated write on archived_event_sets" ON archived_event_sets;
CREATE POLICY "Allow authenticated read on archived_event_sets" ON archived_event_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write on archived_event_sets" ON archived_event_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed a pre-confirmed default admin user (email: admin@kaizentracker.com, default passcode: kaizen2026)
-- (Users can instantly unlock the app with the passcode, bypassing email confirmation)
INSERT INTO auth.users (
  instance_id,
  id,
  provider,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  phone
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'local',
  'authenticated',
  'admin@kaizentracker.com',
  crypt('kaizen2026', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  null
) ON CONFLICT (email) DO NOTHING;
