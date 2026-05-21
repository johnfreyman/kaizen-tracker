-- Migration: Setup Super Admin Role & User Profiles
-- Run this in your Supabase dashboard: SQL Editor → New query → paste & run

-- =========================================================================
-- 1. CREATE PROFILES TABLE & SECURITY RULES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Owner-only access policy (each coach can read/write their own profile)
DROP POLICY IF EXISTS "Coaches can manage their own profiles" ON public.profiles;
CREATE POLICY "Coaches can manage their own profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- =========================================================================
-- 2. CREATE AUTOMATIC PROFILE CREATION TRIGGER
-- =========================================================================

-- Trigger function to automatically insert a profile row on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users after insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- 3. CREATE SUPER_ADMINS TABLE & SECURITY RULES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Owner-only read policy (a user can only check/read their own super admin status)
DROP POLICY IF EXISTS "Allow authenticated read of own status" ON public.super_admins;
CREATE POLICY "Allow authenticated read of own status" ON public.super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- =========================================================================
-- 4. GRANT SUPER ADMIN ACCESS TO AN EXISTING USER
-- =========================================================================
--
-- NEVER hardcode emails or passwords in this file.
-- Follow these steps to promote a user to super admin:
--
-- Step 1 — Ensure the user account exists.
--   If the account does not exist yet, create it via the Supabase dashboard:
--     Authentication → Users → "Add user" → enter email + strong password
--
-- Step 2 — Look up the user's UUID:
--     SELECT id FROM auth.users WHERE email = 'your-admin@example.com';
--
-- Step 3 — Insert into super_admins (replace the UUID placeholder):
--     INSERT INTO public.super_admins (user_id)
--     VALUES ('<UUID-FROM-STEP-2>')
--     ON CONFLICT (user_id) DO NOTHING;
--
-- Step 4 — Verify the profile row was created by the trigger, or insert manually:
--     INSERT INTO public.profiles (id, email, created_at)
--     VALUES ('<UUID-FROM-STEP-2>', 'your-admin@example.com', now())
--     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;


-- =========================================================================
-- 5. PERMISSIVE SELECT POLICIES FOR SUPER ADMINS
-- =========================================================================

-- Super admin SELECT-only policies allow users in super_admins to read all rows
-- on the five data tables and profiles regardless of coach_id / owner constraints.

-- Table: team_settings
DROP POLICY IF EXISTS "Super admins can view all team_settings" ON public.team_settings;
CREATE POLICY "Super admins can view all team_settings" ON public.team_settings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- Table: roster
DROP POLICY IF EXISTS "Super admins can view all roster" ON public.roster;
CREATE POLICY "Super admins can view all roster" ON public.roster
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- Table: events
DROP POLICY IF EXISTS "Super admins can view all events" ON public.events;
CREATE POLICY "Super admins can view all events" ON public.events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- Table: active_session
DROP POLICY IF EXISTS "Super admins can view all active_session" ON public.active_session;
CREATE POLICY "Super admins can view all active_session" ON public.active_session
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- Table: archived_event_sets
DROP POLICY IF EXISTS "Super admins can view all archived_event_sets" ON public.archived_event_sets;
CREATE POLICY "Super admins can view all archived_event_sets" ON public.archived_event_sets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- Table: profiles (allows super admins to read all user profiles)
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));
