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
-- 4. SEED SUPER ADMIN USER ACCOUNT
-- =========================================================================

-- Ensure pgcrypto extension is active for bcrypt-hashed password seeding
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_admin_id UUID;
  admin_email CONSTANT TEXT := 'REDACTED_ADMIN_EMAIL';
  admin_password CONSTANT TEXT := 'REDACTED_PASSWORD';
BEGIN
  -- Check if the user already exists in auth.users
  SELECT id INTO new_admin_id FROM auth.users WHERE email = admin_email;

  -- If user doesn't exist, insert into auth.users and auth.identities
  IF new_admin_id IS NULL THEN
    new_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      phone
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      null
    );

    -- Link the email identity to support email password login in GoTrue / Supabase Auth
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = admin_email AND provider = 'email') THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        new_admin_id,
        json_build_object('sub', new_admin_id::text, 'email', admin_email),
        'email',
        admin_email,
        now(),
        now(),
        now()
      );
    END IF;
  END IF;

  -- Ensure profile row exists (if trigger didn't run or wasn't active during seeding)
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (new_admin_id, admin_email, now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Ensure super admin registration row exists
  INSERT INTO public.super_admins (user_id)
  VALUES (new_admin_id)
  ON CONFLICT (user_id) DO NOTHING;

END $$;


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
