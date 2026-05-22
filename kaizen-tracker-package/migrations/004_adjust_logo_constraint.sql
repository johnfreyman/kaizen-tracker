-- =============================================================================
-- Migration 004: Adjust team_logo length constraint
-- Run order: FOURTH — must run after 001_schema.sql
--
-- Safely increases the CHECK constraint on team_logo from 200 to 2048 characters
-- to support long storage URLs.
-- =============================================================================

ALTER TABLE public.team_settings 
  DROP CONSTRAINT IF EXISTS team_settings_team_logo_check,
  ADD CONSTRAINT team_settings_team_logo_check CHECK (char_length(team_logo) <= 2048);
