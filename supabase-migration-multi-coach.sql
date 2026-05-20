-- Migration: Add Multi-Coach Support
-- Run this in your Supabase dashboard: SQL Editor → New query → paste & run

-- =========================================================================
-- 1. ADD COACH ID TO ALL TABLES
-- =========================================================================

ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE active_session ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE archived_event_sets ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Default coach_id to the authenticated user's ID on insert
ALTER TABLE team_settings ALTER COLUMN coach_id SET DEFAULT auth.uid();
ALTER TABLE roster ALTER COLUMN coach_id SET DEFAULT auth.uid();
ALTER TABLE events ALTER COLUMN coach_id SET DEFAULT auth.uid();
ALTER TABLE active_session ALTER COLUMN coach_id SET DEFAULT auth.uid();
ALTER TABLE archived_event_sets ALTER COLUMN coach_id SET DEFAULT auth.uid();

-- Migrate any existing database rows to the first auth user if one exists
DO $$
DECLARE
  default_user_id UUID;
BEGIN
  SELECT id INTO default_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF default_user_id IS NOT NULL THEN
    UPDATE team_settings SET coach_id = default_user_id WHERE coach_id IS NULL;
    UPDATE roster SET coach_id = default_user_id WHERE coach_id IS NULL;
    UPDATE events SET coach_id = default_user_id WHERE coach_id IS NULL;
    UPDATE active_session SET coach_id = default_user_id WHERE coach_id IS NULL;
    UPDATE archived_event_sets SET coach_id = default_user_id WHERE coach_id IS NULL;
  END IF;
END $$;


-- =========================================================================
-- 1.5. ENFORCE ONE ROW PER COACH (UNIQUE CONSTRAINTS)
-- =========================================================================

-- Ensure each coach can have exactly one team settings row and one active session
ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS team_settings_coach_id_key;
ALTER TABLE team_settings ADD CONSTRAINT team_settings_coach_id_key UNIQUE (coach_id);

ALTER TABLE active_session DROP CONSTRAINT IF EXISTS active_session_coach_id_key;
ALTER TABLE active_session ADD CONSTRAINT active_session_coach_id_key UNIQUE (coach_id);


-- =========================================================================
-- 2. UPDATE PRIMARY KEYS AND CONSTRAINTS (TEAM SETTINGS & ACTIVE SESSION)
-- =========================================================================

-- Team Settings: Convert id from SMALLINT to UUID and drop single-row constraint
ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS enforce_single_row;
ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS team_settings_pkey;
ALTER TABLE team_settings DROP COLUMN IF EXISTS id;
ALTER TABLE team_settings ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- Active Session: Convert lock_id from SMALLINT to UUID and drop single-row constraint
ALTER TABLE active_session DROP CONSTRAINT IF EXISTS enforce_single_row;
ALTER TABLE active_session DROP CONSTRAINT IF EXISTS active_session_pkey;
ALTER TABLE active_session DROP COLUMN IF EXISTS lock_id;
ALTER TABLE active_session ADD COLUMN lock_id UUID PRIMARY KEY DEFAULT gen_random_uuid();


-- =========================================================================
-- 3. UPDATE PRIMARY KEY FOR ROSTER
-- =========================================================================

-- Roster: Drop text primary key (name) and replace with a UUID id
ALTER TABLE roster DROP CONSTRAINT IF EXISTS roster_pkey;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- Enforce uniqueness of player name per coach
ALTER TABLE roster DROP CONSTRAINT IF EXISTS roster_coach_id_name_key;
ALTER TABLE roster ADD CONSTRAINT roster_coach_id_name_key UNIQUE (coach_id, name);


-- =========================================================================
-- 4. REPLACE ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_event_sets ENABLE ROW LEVEL SECURITY;

-- Drop old public/authenticated-wide policies
DROP POLICY IF EXISTS "Allow authenticated read on team_settings" ON team_settings;
DROP POLICY IF EXISTS "Allow authenticated write on team_settings" ON team_settings;

DROP POLICY IF EXISTS "Allow authenticated read on roster" ON roster;
DROP POLICY IF EXISTS "Allow authenticated write on roster" ON roster;

DROP POLICY IF EXISTS "Allow authenticated read on events" ON events;
DROP POLICY IF EXISTS "Allow authenticated write on events" ON events;

DROP POLICY IF EXISTS "Allow authenticated read on active_session" ON active_session;
DROP POLICY IF EXISTS "Allow authenticated write on active_session" ON active_session;

DROP POLICY IF EXISTS "Allow authenticated read on archived_event_sets" ON archived_event_sets;
DROP POLICY IF EXISTS "Allow authenticated write on archived_event_sets" ON archived_event_sets;

-- Create new policies scoped to auth.uid()
CREATE POLICY "Coaches can only access their own team_settings" ON team_settings
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own roster" ON roster
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own events" ON events
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own active_session" ON active_session
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can only access their own archived_event_sets" ON archived_event_sets
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
