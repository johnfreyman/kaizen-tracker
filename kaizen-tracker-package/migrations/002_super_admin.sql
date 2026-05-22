-- =============================================================================
-- Migration 002: Super admin role and user profiles
-- Run order: SECOND — requires tables created by 001_schema.sql
--
-- Safe to run on a fresh Supabase project. Every statement is idempotent.
-- =============================================================================


-- =============================================================================
-- PROFILES TABLE
-- Mirrors auth.users so super-admin queries don't need direct auth schema access.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can manage their own profiles" ON public.profiles;
CREATE POLICY "Coaches can manage their own profiles"
  ON public.profiles FOR ALL TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- =============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- Inserts a profiles row whenever a new user signs up so the record always exists.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- SUPER_ADMINS TABLE
-- Presence of a user_id row grants platform-wide read access (SELECT only).
-- Write access is still blocked by the per-coach RLS policies in 001_schema.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- A user can only check their own super-admin status; they cannot enumerate others.
DROP POLICY IF EXISTS "Allow authenticated read of own status" ON public.super_admins;
CREATE POLICY "Allow authenticated read of own status"
  ON public.super_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- =============================================================================
-- SUPER ADMIN SELECT POLICIES
-- Additive to the per-coach policies in 001_schema.sql — Postgres evaluates all
-- matching policies with OR, so a super admin satisfies either policy and gets
-- read access to all coaches' data without needing write access.
-- =============================================================================

DROP POLICY IF EXISTS "Super admins can view all team_settings"       ON public.team_settings;
DROP POLICY IF EXISTS "Super admins can view all roster"              ON public.roster;
DROP POLICY IF EXISTS "Super admins can view all events"              ON public.events;
DROP POLICY IF EXISTS "Super admins can view all active_session"      ON public.active_session;
DROP POLICY IF EXISTS "Super admins can view all archived_event_sets" ON public.archived_event_sets;
DROP POLICY IF EXISTS "Super admins can view all profiles"            ON public.profiles;

CREATE POLICY "Super admins can view all team_settings"
  ON public.team_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all roster"
  ON public.roster FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all events"
  ON public.events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all active_session"
  ON public.active_session FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all archived_event_sets"
  ON public.archived_event_sets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));


-- =============================================================================
-- PROMOTING A USER TO SUPER ADMIN
-- Do not run this block as part of the migration — execute it manually after
-- the migration completes, substituting the real UUID.
--
-- Step 1 — Find the user's UUID:
--     SELECT id FROM auth.users WHERE email = 'admin@example.com';
--
-- Step 2 — Insert into super_admins:
--     INSERT INTO public.super_admins (user_id)
--     VALUES ('<UUID-FROM-STEP-1>')
--     ON CONFLICT (user_id) DO NOTHING;
--
-- Step 3 — Verify a profile row exists (the trigger handles new sign-ups, but
--           existing users need a manual backfill if they predate the trigger):
--     INSERT INTO public.profiles (id, email, created_at)
--     SELECT id, email, created_at FROM auth.users WHERE id = '<UUID-FROM-STEP-1>'
--     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
-- =============================================================================
