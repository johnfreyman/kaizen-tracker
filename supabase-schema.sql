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

-- Disable RLS so the anon key can read/write freely (personal app)
ALTER TABLE team_settings       DISABLE ROW LEVEL SECURITY;
ALTER TABLE roster              DISABLE ROW LEVEL SECURITY;
ALTER TABLE events              DISABLE ROW LEVEL SECURITY;
ALTER TABLE active_session      DISABLE ROW LEVEL SECURITY;
ALTER TABLE archived_event_sets DISABLE ROW LEVEL SECURITY;
