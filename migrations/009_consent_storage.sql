-- =============================================================================
-- Migration 009: Consent storage on team_settings
-- Run order: after 008_purge_lifecycle_fixes.sql
--
-- Adds two columns to team_settings so that the coach's acceptance of the
-- data/privacy agreement is recorded server-side with a timestamp.
--
--   consent_agreed_at  — when the coach clicked "I Agree" (NULL = legacy row
--                        created before this migration, or row not yet agreed)
--   consent_version    — agreement version string (e.g. "1.0") so future
--                        material changes can be detected and re-prompted
--
-- Safe to run on an existing project: ADD COLUMN IF NOT EXISTS is idempotent.
-- =============================================================================

ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS consent_agreed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version   TEXT;
