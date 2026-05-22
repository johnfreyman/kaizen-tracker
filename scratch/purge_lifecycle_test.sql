-- =============================================================================
-- Purge Lifecycle End-to-End Test Script
-- Test account: johnfreyman70+testc@gmail.com
--
-- All queries resolve the UUID from the email automatically.
-- Run each stage block sequentially in the Supabase SQL Editor.
-- =============================================================================


-- =============================================================================
-- STAGE 0: Confirm initial state
-- Expect: purge_status='active', deadlines ~90 days out, all reminders NULL
-- =============================================================================

SELECT
  coach_id,
  purge_status,
  purge_deadline,
  original_deadline,
  reminder_7d_sent_at,
  reminder_30d_sent_at,
  reminder_60d_sent_at,
  reminder_83d_sent_at
FROM public.coach_purge_state
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');


-- =============================================================================
-- STAGE 1: Day 7 Reminder  (simulate account is 7 days old)
-- =============================================================================

UPDATE public.coach_purge_state
SET original_deadline = NOW() + INTERVAL '83 days',
    purge_deadline    = NOW() + INTERVAL '83 days'
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT public.process_purge_lifecycle();

-- Verify: reminder_7d_sent_at populated, reminder_30d_sent_at NULL
SELECT reminder_7d_sent_at, reminder_30d_sent_at
FROM public.coach_purge_state
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT event_type, metadata, occurred_at
FROM public.activity_log
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com')
ORDER BY occurred_at DESC LIMIT 5;


-- =============================================================================
-- STAGE 2: Day 30 Reminder  (simulate account is 30 days old)
-- =============================================================================

UPDATE public.coach_purge_state
SET original_deadline = NOW() + INTERVAL '60 days',
    purge_deadline    = NOW() + INTERVAL '60 days'
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT public.process_purge_lifecycle();

-- Verify: reminder_30d_sent_at populated, reminder_60d_sent_at NULL
SELECT reminder_30d_sent_at, reminder_60d_sent_at
FROM public.coach_purge_state
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT event_type, metadata, occurred_at
FROM public.activity_log
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com')
ORDER BY occurred_at DESC LIMIT 5;


-- =============================================================================
-- STAGE 3: Day 60 Reminder  (simulate account is 60 days old)
-- =============================================================================

UPDATE public.coach_purge_state
SET original_deadline = NOW() + INTERVAL '30 days',
    purge_deadline    = NOW() + INTERVAL '30 days'
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT public.process_purge_lifecycle();

-- Verify: reminder_60d_sent_at populated, reminder_83d_sent_at NULL
SELECT reminder_60d_sent_at, reminder_83d_sent_at
FROM public.coach_purge_state
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT event_type, metadata, occurred_at
FROM public.activity_log
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com')
ORDER BY occurred_at DESC LIMIT 5;


-- =============================================================================
-- STAGE 4: Day 83 Final Notice  (simulate account is 83 days old)
-- =============================================================================

UPDATE public.coach_purge_state
SET original_deadline = NOW() + INTERVAL '7 days',
    purge_deadline    = NOW() + INTERVAL '7 days'
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT public.process_purge_lifecycle();

-- Verify: reminder_83d_sent_at populated
SELECT reminder_83d_sent_at
FROM public.coach_purge_state
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT event_type, metadata, occurred_at
FROM public.activity_log
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com')
ORDER BY occurred_at DESC LIMIT 5;


-- =============================================================================
-- STAGE 5: Soft-Delete  (simulate 90+ days old — deadline expired)
-- =============================================================================

UPDATE public.coach_purge_state
SET purge_deadline = NOW() - INTERVAL '1 minute'
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

SELECT public.process_purge_lifecycle();

-- Verify purge state
SELECT purge_status, soft_deleted_at, hard_delete_at, purged_by
FROM public.coach_purge_state
WHERE coach_id = (SELECT id FROM auth.users WHERE email = 'johnfreyman70+testc@gmail.com');

-- Verify PII anonymization (email should now be purged-<uuid>@deleted.local)
SELECT email FROM public.profiles
WHERE id = (SELECT id FROM auth.users WHERE email LIKE 'purged-%@deleted.local' ORDER BY updated_at DESC LIMIT 1);

-- Verify team settings nullification
SELECT team_name, team_logo FROM public.team_settings
WHERE coach_id = (SELECT id FROM auth.users WHERE email LIKE 'purged-%@deleted.local' ORDER BY updated_at DESC LIMIT 1);

-- Verify activity log
SELECT event_type, metadata, occurred_at
FROM public.activity_log
WHERE coach_id = (SELECT id FROM auth.users WHERE email LIKE 'purged-%@deleted.local' ORDER BY updated_at DESC LIMIT 1)
ORDER BY occurred_at DESC LIMIT 5;


-- =============================================================================
-- STAGE 6: Hard-Delete  (simulate 275+ days post soft-delete)
--
-- NOTE: After Stage 5 the email in auth.users is anonymized, so we need
-- to capture the UUID from activity_log before running this stage.
-- Run the query below first to get the UUID, then substitute below.
-- =============================================================================

-- Helper: find the UUID from the activity log written during soft-delete
SELECT coach_id FROM public.activity_log
WHERE event_type = 'purge_soft_deleted'
ORDER BY occurred_at DESC LIMIT 1;

-- Once you have the UUID, substitute it in the two queries below:

UPDATE public.coach_purge_state
SET hard_delete_at = NOW() - INTERVAL '1 minute'
WHERE coach_id = 'PASTE-UUID-FROM-ABOVE-QUERY';

SELECT public.process_purge_lifecycle();

-- Verify cascade deletion (all three should be false)
SELECT EXISTS(SELECT 1 FROM auth.users              WHERE id       = 'PASTE-UUID-FROM-ABOVE-QUERY') AS user_exists;
SELECT EXISTS(SELECT 1 FROM public.profiles         WHERE id       = 'PASTE-UUID-FROM-ABOVE-QUERY') AS profile_exists;
SELECT EXISTS(SELECT 1 FROM public.coach_purge_state WHERE coach_id = 'PASTE-UUID-FROM-ABOVE-QUERY') AS purge_state_exists;

-- Activity log row survives cascade
SELECT event_type, metadata, occurred_at
FROM public.activity_log
WHERE coach_id = 'PASTE-UUID-FROM-ABOVE-QUERY'
ORDER BY occurred_at DESC LIMIT 10;
