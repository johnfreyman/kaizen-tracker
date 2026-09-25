-- Stage 3 isolated role/replay test suite (2026-09-23, extended for D13-D15).
--
-- Run ONLY against the Stage 3 test project (Kaizen Tracker Stage 3 Test,
-- viouquduxutuslafiooy), after simplification-stage3-test-migration.sql.
-- Everything happens in one transaction that ends in ROLLBACK: the invented
-- coaches, rows, helper schema and results vanish, so the suite is
-- repeatable and leaves the test project exactly as it found it.
--
-- Roles are real: each check runs after SET LOCAL ROLE authenticated/anon
-- with a JWT subject claim, so RLS, grants and auth.uid() behave as they do
-- for browser callers. Every expected rejection must match BOTH its SQLSTATE
-- and its message, so a check cannot pass for an unintended cause. The last
-- SELECT reports pass/fail with each check's detail.
--
-- This proves database behavior only. It says nothing about the Stage 4
-- browser/IndexedDB outbox or real offline reliability.
--
-- PIN verifiers below are real PBKDF2-SHA256 outputs (600000 iterations,
-- 32 bytes), identical from Node's WebCrypto and pbkdf2Sync:
--   4827 / salt "kaizen-test-salt" -> f5sqB5UrkErch74HLptMMvuWzk17ToK5psamLw5Rn0o=
--   1359 / salt "kaizen-salt-0002" -> K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk=
--   7702 / salt "kaizen-salt-000b" -> lm17G4bpKVKDz+MFxHkTPGTcgERq5RsRAHMWld3Tiac=

BEGIN;

DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'stage3-coach-a@example.test') THEN
    RAISE EXCEPTION 'refusing to run: this is not the Stage 3 test project';
  END IF;
END $guard$;

-- ── Throwaway harness (rolled back with everything else) ──────────────────
CREATE SCHEMA tracker_test;
GRANT USAGE ON SCHEMA tracker_test TO authenticated, anon;
CREATE TABLE tracker_test.results (
  seq bigserial PRIMARY KEY, name text NOT NULL, passed boolean NOT NULL, detail text);
CREATE TABLE tracker_test.ops (name text PRIMARY KEY, seq bigserial NOT NULL);
CREATE TABLE tracker_test.vars (k text PRIMARY KEY, v jsonb);
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tracker_test TO authenticated, anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA tracker_test TO authenticated, anon;

CREATE FUNCTION tracker_test.id(p text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT md5(p)::uuid $$;

CREATE FUNCTION tracker_test.ok(p_name text, p_passed boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO tracker_test.results (name, passed, detail)
  VALUES (p_name, coalesce(p_passed, false), p_detail) $$;

-- Passes only if p_sql raises the expected SQLSTATE AND its message matches
-- p_message (a regular expression), so the cause itself is asserted.
CREATE FUNCTION tracker_test.rejects(p_name text, p_sql text, p_state text, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    PERFORM tracker_test.ok(p_name, SQLSTATE = p_state AND SQLERRM ~ p_message,
                            SQLSTATE || ' ' || SQLERRM);
    RETURN;
  END;
  PERFORM tracker_test.ok(p_name, false, 'accepted; a rejection was expected');
END $$;

-- A statement reads tables with a snapshot taken before any operation it
-- calls. So each check reads the effect of an operation in a later statement,
-- with the operation's result saved by put() first.
CREATE FUNCTION tracker_test.put(p_k text, p_v jsonb) RETURNS jsonb LANGUAGE sql AS $$
  INSERT INTO tracker_test.vars VALUES (p_k, p_v)
  ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v $$;
CREATE FUNCTION tracker_test.get(p_k text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT v FROM tracker_test.vars WHERE k = p_k $$;

-- A named operation always maps to the same operation ID and device
-- sequence, so calling it again is a true replay of the same request.
CREATE FUNCTION tracker_test.seq_for(p_name text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO tracker_test.ops (name) VALUES (p_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING seq $$;

CREATE FUNCTION tracker_test.roster(p_op text, p_kind text, p_base bigint, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tracker_apply_roster_operation_v1(
    tracker_test.id('op:' || p_op),
    tracker_test.id('device:' || coalesce(auth.uid()::text, 'anon')),
    tracker_test.seq_for(p_op), p_kind, p_base, p_payload) $$;

CREATE FUNCTION tracker_test.sess(p_op text, p_kind text, p_session uuid, p_base bigint, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tracker_apply_operation_v1(
    tracker_test.id('op:' || p_op),
    tracker_test.id('device:' || coalesce(auth.uid()::text, 'anon')),
    tracker_test.seq_for(p_op), p_kind, p_session, p_base, p_payload) $$;

CREATE FUNCTION tracker_test.correct(p_op text, p_session uuid, p_base bigint, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tracker_correct_session_v1(
    tracker_test.id('op:' || p_op),
    tracker_test.id('device:' || coalesce(auth.uid()::text, 'anon')),
    tracker_test.seq_for(p_op), p_session, p_base, p_payload) $$;

CREATE FUNCTION tracker_test.settings(p_op text, p_kind text, p_base bigint, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tracker_apply_settings_operation_v1(
    tracker_test.id('op:' || p_op),
    tracker_test.id('device:' || coalesce(auth.uid()::text, 'anon')),
    tracker_test.seq_for(p_op), p_kind, p_base, p_payload) $$;

CREATE FUNCTION tracker_test.verifier(p_salt text, p_hash text, p_iterations int DEFAULT 600000)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('verifier', jsonb_build_object(
    'alg', 'PBKDF2-SHA256', 'iterations', p_iterations, 'salt', p_salt, 'hash', p_hash)) $$;

CREATE FUNCTION tracker_test.player(
  p_id text, p_first text, p_number text, p_label text, p_guest boolean, p_teams text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('player_id', tracker_test.id('player:' || p_id),
    'first_name', p_first, 'jersey_number', p_number, 'short_label', p_label,
    'is_guest', p_guest,
    'team_ids', coalesce((SELECT jsonb_agg(tracker_test.id('team:' || t)) FROM unnest(p_teams) t),
                         '[]'::jsonb)) $$;

-- The prepared-device snapshot a Stage 4 client would send: every active
-- (non-retired) player with their current teams, plus the expected union.
CREATE FUNCTION tracker_test.start_payload(p_kind text, p_date date, p_teams text[], p_all boolean)
RETURNS jsonb LANGUAGE sql AS $$
  WITH roster AS (
    SELECT p.id, jsonb_build_object('player_id', p.id, 'first_name', p.first_name,
      'jersey_number', p.jersey_number, 'short_label', p.short_label, 'is_guest', p.is_guest,
      'team_ids', coalesce((SELECT jsonb_agg(m.team_id ORDER BY m.team_id)
                              FROM public.tracker_memberships m
                             WHERE m.coach_id = p.coach_id AND m.player_id = p.id), '[]'::jsonb)) AS snap
    FROM public.tracker_players p
    WHERE p.coach_id = auth.uid() AND p.retired_at IS NULL
  ), sel AS (SELECT tracker_test.id('team:' || t) AS team_id FROM unnest(p_teams) t)
  SELECT jsonb_build_object(
    'round_id', (SELECT r.id FROM public.tracker_rounds r WHERE r.coach_id = auth.uid() AND r.is_current),
    'kind', p_kind, 'session_date', p_date, 'all_kaizen', p_all,
    'selected_team_ids', coalesce((SELECT jsonb_agg(team_id) FROM sel), '[]'::jsonb),
    'expected_player_ids', CASE
       WHEN p_kind <> 'Practice' THEN '[]'::jsonb
       WHEN p_all THEN coalesce((SELECT jsonb_agg(id) FROM roster), '[]'::jsonb)
       ELSE coalesce((SELECT jsonb_agg(DISTINCT m.player_id)
                        FROM public.tracker_memberships m JOIN roster r ON r.id = m.player_id
                       WHERE m.coach_id = auth.uid() AND m.team_id IN (SELECT team_id FROM sel)),
                     '[]'::jsonb) END,
    'roster', coalesce((SELECT jsonb_agg(snap ORDER BY id) FROM roster), '[]'::jsonb),
    'prepared_cache_version', 'role-test-v1') $$;

-- Invented coaches, created and discarded inside this transaction only.
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('c3a00000-0000-4000-8000-00000000000a', 'stage3-roletest-a@example.test', 'authenticated', 'authenticated'),
  ('c3b00000-0000-4000-8000-00000000000b', 'stage3-roletest-b@example.test', 'authenticated', 'authenticated');

-- ═══ Coach A ══════════════════════════════════════════════════════════════
SELECT set_config('request.jwt.claims',
  '{"sub":"c3a00000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT tracker_test.put('a_init', public.tracker_initialize_owner_v1());
SELECT tracker_test.ok('A01 new coach: one current round, raffle on by default',
  (tracker_test.get('a_init')->>'raffle_enabled')::boolean
  AND (SELECT count(*) FROM public.tracker_rounds WHERE is_current) = 1,
  tracker_test.get('a_init')::text);
SELECT tracker_test.put('r1', to_jsonb((SELECT id FROM public.tracker_rounds WHERE is_current)));

-- ── Sub-teams ──
SELECT tracker_test.put('team_b6', tracker_test.roster('a-team-b6', 'create_team_v1', 0,
  jsonb_build_object('team_id', tracker_test.id('team:b6'), 'name', 'Blue 6th Grade')));
SELECT tracker_test.ok('R01 create sub-team returns revision 0',
  (tracker_test.get('team_b6')->>'revision')::int = 0, tracker_test.get('team_b6')::text);
SELECT tracker_test.ok('R02 replay of the same create returns the stored result',
  tracker_test.roster('a-team-b6', 'create_team_v1', 0,
    jsonb_build_object('team_id', tracker_test.id('team:b6'), 'name', 'Blue 6th Grade'))
  = tracker_test.get('team_b6'));
SELECT tracker_test.ok('R02b replay created no second row',
  (SELECT count(*) FROM public.tracker_sub_teams WHERE id = tracker_test.id('team:b6')) = 1);
SELECT tracker_test.rejects('R03 same operation ID with a changed payload is rejected',
  $q$SELECT tracker_test.roster('a-team-b6', 'create_team_v1', 0,
       jsonb_build_object('team_id', tracker_test.id('team:b6'), 'name', 'Blue Six'))$q$,
  '23505', 'operation id reused with different request');
SELECT tracker_test.ok('R03b rejected payload changed nothing',
  (SELECT name FROM public.tracker_sub_teams WHERE id = tracker_test.id('team:b6')) = 'Blue 6th Grade');
SELECT tracker_test.roster('a-team-b7', 'create_team_v1', 0,
  jsonb_build_object('team_id', tracker_test.id('team:b7'), 'name', 'Blue 7th Grade'));
SELECT tracker_test.roster('a-team-g7', 'create_team_v1', 0,
  jsonb_build_object('team_id', tracker_test.id('team:g7'), 'name', 'Gray 7th'));
SELECT tracker_test.rejects('R04 duplicate active sub-team name (case-insensitive)',
  $q$SELECT tracker_test.roster('a-team-dup', 'create_team_v1', 0,
       jsonb_build_object('team_id', tracker_test.id('team:dup'), 'name', ' blue 6TH grade '))$q$,
  '23505', 'an active sub-team already uses this name');
SELECT tracker_test.rejects('R05 rename with a stale base revision',
  $q$SELECT tracker_test.roster('a-rename-g7-stale', 'rename_team_v1', 3,
       jsonb_build_object('team_id', tracker_test.id('team:g7'), 'name', 'Gray 7th Grade'))$q$,
  '40001', 'stale sub-team revision');
SELECT tracker_test.ok('R06 rename with the current revision advances it',
  (tracker_test.roster('a-rename-g7', 'rename_team_v1', 0,
     jsonb_build_object('team_id', tracker_test.id('team:g7'), 'name', 'Gray 7th Grade'))->>'revision')::int = 1);

-- ── Players: one player-wide number, 0 vs 00, memberships, collisions ──
SELECT tracker_test.put('kayla', tracker_test.roster('a-p-kayla', 'create_player_v1', 0,
  tracker_test.player('kayla', 'Kayla', '12', '', false, ARRAY['b6', 'b7'])));
SELECT tracker_test.ok('P01 player on two sub-teams: two membership rows, one number',
  (SELECT count(*) FROM public.tracker_memberships WHERE player_id = tracker_test.id('player:kayla')) = 2
  AND (SELECT jersey_number FROM public.tracker_players WHERE id = tracker_test.id('player:kayla')) = '12');
SELECT tracker_test.ok('P01b a membership row has no jersey number column (D08)',
  NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.tracker_memberships'::regclass
               AND attnum > 0 AND NOT attisdropped AND attname ILIKE '%number%'));
SELECT tracker_test.roster('a-p-sam0', 'create_player_v1', 0,
  tracker_test.player('sam0', 'Sam', '0', '', false, ARRAY['b7']));
SELECT tracker_test.roster('a-p-sam00', 'create_player_v1', 0,
  tracker_test.player('sam00', 'Sam', '00', '', false, ARRAY['b7']));
SELECT tracker_test.ok('P02 "0" and "00" are distinct stored numbers and distinct cards',
  (SELECT array_agg(jersey_number ORDER BY jersey_number) FROM public.tracker_players
    WHERE id IN (tracker_test.id('player:sam0'), tracker_test.id('player:sam00'))) = ARRAY['0', '00']);
SELECT tracker_test.roster('a-p-alex', 'create_player_v1', 0,
  tracker_test.player('alex', 'Alex', '12', '', false, ARRAY['b7']));
SELECT tracker_test.rejects('P03 identical card (same first name, number and label) is rejected',
  $q$SELECT tracker_test.roster('a-p-alex2-bad', 'create_player_v1', 0,
       tracker_test.player('alex2', 'Alex', '12', '', false, ARRAY['b7']))$q$,
  '23505', 'card collision: add or change a short label');
SELECT tracker_test.ok('P04 a short label resolves the collision',
  (tracker_test.roster('a-p-alex2', 'create_player_v1', 0,
     tracker_test.player('alex2', 'Alex', '12', 'M.', false, ARRAY['b7']))->>'revision')::int = 0);
SELECT tracker_test.rejects('P04b collision check ignores case and surrounding space',
  $q$SELECT tracker_test.roster('a-p-alex3', 'create_player_v1', 0,
       tracker_test.player('alex3', ' ALEX ', '12', 'm.', false, ARRAY['b7']))$q$,
  '23505', 'card collision: add or change a short label');
SELECT tracker_test.roster('a-p-priya', 'create_player_v1', 0,
  tracker_test.player('priya', 'Priya', ' 7 ', '', false, ARRAY['g7']));
SELECT tracker_test.ok('P05 surrounding space is trimmed from the number, digits kept',
  (SELECT jersey_number FROM public.tracker_players WHERE id = tracker_test.id('player:priya')) = '7');
SELECT tracker_test.rejects('P06 non-digit number rejected',
  $q$SELECT tracker_test.roster('a-p-bad1', 'create_player_v1', 0,
       tracker_test.player('bad1', 'Zed', 'A1', '', false, ARRAY[]::text[]))$q$,
  '22023', 'invalid player payload');
SELECT tracker_test.rejects('P06b four-digit number rejected',
  $q$SELECT tracker_test.roster('a-p-bad2', 'create_player_v1', 0,
       tracker_test.player('bad2', 'Zed', '1234', '', false, ARRAY[]::text[]))$q$,
  '22023', 'invalid player payload');
SELECT tracker_test.rejects('P07 payload without the number key is rejected, not silently cleared',
  $q$SELECT tracker_test.roster('a-p-bad3', 'create_player_v1', 0,
       tracker_test.player('bad3', 'Zed', '9', '', false, ARRAY[]::text[]) - 'jersey_number')$q$,
  '22023', 'invalid player payload');
SELECT tracker_test.ok('P08 a player may have no number yet (setup needed)',
  (tracker_test.roster('a-p-owen', 'create_player_v1', 0,
     tracker_test.player('owen', 'Owen', NULL, '', false, ARRAY['b6']))->>'jersey_number') IS NULL);
SELECT tracker_test.roster('a-p-elena', 'create_player_v1', 0,
  tracker_test.player('elena', 'Elena', NULL, '', true, ARRAY[]::text[]));
SELECT tracker_test.rejects('P09 unknown sub-team in memberships is rejected',
  $q$SELECT tracker_test.roster('a-p-bad4', 'create_player_v1', 0,
       tracker_test.player('bad4', 'Zed', '9', '', false, ARRAY['nope']))$q$,
  '42501', 'foreign or unknown sub-team');
SELECT tracker_test.rejects('P10 update with a stale base revision',
  $q$SELECT tracker_test.roster('a-u-kayla-stale', 'update_player_v1', 4,
       tracker_test.player('kayla', 'Kayla', '12', '', false, ARRAY['b6', 'b7']))$q$,
  '40001', 'stale player revision');
SELECT tracker_test.rejects('P11 edit into an identical card is rejected',
  $q$SELECT tracker_test.roster('a-u-alex2-bad', 'update_player_v1', 0,
       tracker_test.player('alex2', 'Alex', '12', '', false, ARRAY['b7']))$q$,
  '23505', 'card collision: add or change a short label');
SELECT tracker_test.ok('P11b rejected edit left the stored identity untouched',
  (SELECT short_label = 'M.' AND revision = 0 FROM public.tracker_players
    WHERE id = tracker_test.id('player:alex2')));

-- ── Practice: expected union, unexpected attendee, replay ──
SELECT tracker_test.put('s1_payload',
  tracker_test.start_payload('Practice', '2026-09-20', ARRAY['b6', 'b7'], false));
SELECT tracker_test.put('s1_start', tracker_test.sess('a-s1-start', 'start_v1',
  tracker_test.id('session:s1'), 0, tracker_test.get('s1_payload')));
SELECT tracker_test.ok('S01 two selected teams: shared player expected once, union of 6',
  (SELECT count(*) FROM public.tracker_session_expected_players
    WHERE session_id = tracker_test.id('session:s1')) = 6
  AND (SELECT count(*) FROM public.tracker_session_expected_players
        WHERE session_id = tracker_test.id('session:s1') AND player_id = tracker_test.id('player:kayla')) = 1);
SELECT tracker_test.ok('S01b other-team and no-team players are not expected',
  NOT EXISTS (SELECT 1 FROM public.tracker_session_expected_players
               WHERE session_id = tracker_test.id('session:s1')
                 AND player_id IN (tracker_test.id('player:priya'), tracker_test.id('player:elena'))));
SELECT tracker_test.ok('S01c both selected teams and both of the shared player''s memberships are saved',
  (SELECT count(*) FROM public.tracker_session_expected_teams WHERE session_id = tracker_test.id('session:s1')) = 2
  AND (SELECT count(*) FROM public.tracker_session_memberships
        WHERE session_id = tracker_test.id('session:s1') AND player_id = tracker_test.id('player:kayla')) = 2);
SELECT tracker_test.ok('S02 start replay returns the stored result, one session',
  tracker_test.sess('a-s1-start', 'start_v1', tracker_test.id('session:s1'), 0,
    tracker_test.get('s1_payload')) = tracker_test.get('s1_start'));
SELECT tracker_test.ok('S02b still exactly one session row',
  (SELECT count(*) FROM public.tracker_sessions WHERE id = tracker_test.id('session:s1')) = 1);
SELECT tracker_test.put('s1_mark_kayla', tracker_test.sess('a-s1-kayla', 'set_present_v1',
  tracker_test.id('session:s1'), 0,
  jsonb_build_object('player_id', tracker_test.id('player:kayla'), 'present', true)));
SELECT tracker_test.ok('S03 mark replay returns the stored result',
  tracker_test.sess('a-s1-kayla', 'set_present_v1', tracker_test.id('session:s1'), 0,
    jsonb_build_object('player_id', tracker_test.id('player:kayla'), 'present', true))
  = tracker_test.get('s1_mark_kayla'));
SELECT tracker_test.ok('S03b replay did not advance the revision or duplicate attendance',
  (SELECT revision FROM public.tracker_sessions WHERE id = tracker_test.id('session:s1')) = 1
  AND (SELECT count(*) FROM public.tracker_attendance WHERE session_id = tracker_test.id('session:s1')) = 1);
SELECT tracker_test.sess('a-s1-priya', 'set_present_v1', tracker_test.id('session:s1'), 1,
  jsonb_build_object('player_id', tracker_test.id('player:priya'), 'present', true,
    'snapshot', jsonb_build_object('team_ids', jsonb_build_array(tracker_test.id('team:g7')))));
SELECT tracker_test.ok('S04 unexpected attendee is credited but not added to the expected set',
  EXISTS (SELECT 1 FROM public.tracker_attendance WHERE session_id = tracker_test.id('session:s1')
           AND player_id = tracker_test.id('player:priya') AND present)
  AND (SELECT count(*) FROM public.tracker_session_expected_players
        WHERE session_id = tracker_test.id('session:s1')) = 6);
SELECT tracker_test.sess('a-s1-finish', 'finish_v1', tracker_test.id('session:s1'), 2, '{}'::jsonb);
SELECT tracker_test.ok('S05 practice attendance: 1.5 credit each, no raffle ticket',
  (SELECT credit_hours FROM public.tracker_sessions WHERE id = tracker_test.id('session:s1')) = 1.50
  AND NOT EXISTS (SELECT 1 FROM public.tracker_ticket_entitlements
                   WHERE session_id = tracker_test.id('session:s1')));

-- ── Roster edits after a saved session never rewrite its history ──
SELECT tracker_test.ok('E01 edit name label number and drop a membership after the session',
  (tracker_test.roster('a-u-kayla', 'update_player_v1', 0,
     tracker_test.player('kayla', 'Kayla', '21', 'K.', false, ARRAY['b6']))->>'revision')::int = 1);
SELECT tracker_test.ok('E02 saved roster snapshot keeps the old number and label',
  (SELECT jersey_number = '12' AND short_label = '' FROM public.tracker_session_roster
    WHERE session_id = tracker_test.id('session:s1') AND player_id = tracker_test.id('player:kayla')));
SELECT tracker_test.ok('E03 saved membership and expected snapshots unchanged',
  (SELECT count(*) FROM public.tracker_session_memberships
    WHERE session_id = tracker_test.id('session:s1') AND player_id = tracker_test.id('player:kayla')) = 2
  AND (SELECT count(*) FROM public.tracker_session_expected_players
        WHERE session_id = tracker_test.id('session:s1')) = 6
  AND (SELECT count(*) FROM public.tracker_memberships
        WHERE player_id = tracker_test.id('player:kayla')) = 1);
SELECT tracker_test.roster('a-rename-b7', 'rename_team_v1', 0,
  jsonb_build_object('team_id', tracker_test.id('team:b7'), 'name', 'Blue 7th (renamed)'));
SELECT tracker_test.ok('E04 renaming a selected team keeps the saved team ID selection',
  EXISTS (SELECT 1 FROM public.tracker_session_expected_teams
           WHERE session_id = tracker_test.id('session:s1') AND team_id = tracker_test.id('team:b7')));
SELECT tracker_test.roster('a-p-nia', 'create_player_v1', 0,
  tracker_test.player('nia', 'Nia', '14', '', false, ARRAY['g7']));

-- ── Training while raffle is off still accrues tickets ──
UPDATE public.team_settings SET raffle_enabled = false WHERE coach_id = auth.uid();
SELECT tracker_test.sess('a-s2-start', 'start_v1', tracker_test.id('session:s2'), 0,
  tracker_test.start_payload('Optional Training', '2026-09-21', ARRAY[]::text[], false));
SELECT tracker_test.sess('a-s2-sam0', 'set_present_v1', tracker_test.id('session:s2'), 0,
  jsonb_build_object('player_id', tracker_test.id('player:sam0'), 'present', true));
SELECT tracker_test.sess('a-s2-priya', 'set_present_v1', tracker_test.id('session:s2'), 1,
  jsonb_build_object('player_id', tracker_test.id('player:priya'), 'present', true));
SELECT tracker_test.sess('a-s2-finish', 'finish_v1', tracker_test.id('session:s2'), 2, '{}'::jsonb);
SELECT tracker_test.ok('T01 raffle off, training still earns one ticket per attendee in round 1',
  (SELECT raffle_enabled FROM public.team_settings WHERE coach_id = auth.uid()) = false
  AND (SELECT count(*) FROM public.tracker_ticket_entitlements
        WHERE session_id = tracker_test.id('session:s2')
          AND round_id = (tracker_test.get('r1')#>>'{}')::uuid) = 2);
SELECT tracker_test.ok('T01b training has no expected set',
  NOT EXISTS (SELECT 1 FROM public.tracker_session_expected_players
               WHERE session_id = tracker_test.id('session:s2')));

-- ── Start fresh: new round, nothing deleted (no "Reset wheel") ──
SELECT tracker_test.put('att_before_reset', to_jsonb((SELECT count(*) FROM public.tracker_attendance)));
SELECT tracker_test.put('r2_result', tracker_test.sess('a-start-fresh', 'start_fresh_v1', NULL, 0,
  jsonb_build_object('round_id', (tracker_test.get('r1')#>>'{}')::uuid)));
SELECT tracker_test.ok('F01 start fresh opens generation 2 and deletes no attendance',
  (tracker_test.get('r2_result')->>'generation')::int = 2
  AND (SELECT count(*) FROM public.tracker_attendance) = (tracker_test.get('att_before_reset')#>>'{}')::bigint);
SELECT tracker_test.ok('F02 old tickets stay in round 1; the new round starts empty',
  (SELECT count(*) FROM public.tracker_ticket_entitlements
    WHERE round_id = (tracker_test.get('r1')#>>'{}')::uuid) = 2
  AND (SELECT count(*) FROM public.tracker_ticket_entitlements
        WHERE round_id = (tracker_test.get('r2_result')->>'round_id')::uuid) = 0);

-- ── D14 case 1: training newly entered from paper, dated before the reset ──
SELECT tracker_test.put('s5_start', tracker_test.sess('a-s5-start', 'start_v1',
  tracker_test.id('session:s5'), 0,
  tracker_test.start_payload('Optional Training', '2026-08-15', ARRAY[]::text[], false)));
SELECT tracker_test.sess('a-s5-sam00', 'set_present_v1', tracker_test.id('session:s5'), 0,
  jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'present', true));
SELECT tracker_test.sess('a-s5-owen', 'set_present_v1', tracker_test.id('session:s5'), 1,
  jsonb_build_object('player_id', tracker_test.id('player:owen'), 'present', true));
SELECT tracker_test.sess('a-s5-finish', 'finish_v1', tracker_test.id('session:s5'), 2, '{}'::jsonb);
SELECT tracker_test.ok('G01 D14: a newly entered backdated training joins the current round, no review',
  (tracker_test.get('s5_start')->>'round_id')::uuid = (tracker_test.get('r2_result')->>'round_id')::uuid
  AND (tracker_test.get('s5_start')->>'needs_round_review')::boolean = false
  AND (SELECT s.round_id = (tracker_test.get('r2_result')->>'round_id')::uuid
          AND NOT s.needs_round_review AND s.session_date = '2026-08-15'
          AND s.session_date < r.opened_at::date AND r.is_current
       FROM public.tracker_sessions s
       JOIN public.tracker_rounds r ON r.coach_id = s.coach_id AND r.id = s.round_id
       WHERE s.id = tracker_test.id('session:s5')),
  tracker_test.get('s5_start')::text);
SELECT tracker_test.ok('G01b its tickets count in the current round pool despite the older date',
  (SELECT count(*) FROM public.tracker_ticket_entitlements
    WHERE session_id = tracker_test.id('session:s5')
      AND round_id = (tracker_test.get('r2_result')->>'round_id')::uuid) = 2
  AND NOT EXISTS (SELECT 1 FROM public.tracker_ticket_entitlements
                   WHERE session_id = tracker_test.id('session:s5')
                     AND round_id = (tracker_test.get('r1')#>>'{}')::uuid));

-- ── D14 case 2: a session recorded offline before the reset, delivered after ──
-- The device prepared round 1 and recorded this training before another
-- device's Start fresh; it now syncs carrying its cached round 1.
SELECT tracker_test.put('s6_payload', jsonb_set(
  tracker_test.start_payload('Optional Training', '2026-09-19', ARRAY[]::text[], false),
  '{round_id}', tracker_test.get('r1')));
SELECT tracker_test.put('s6_start', tracker_test.sess('a-s6-start', 'start_v1',
  tracker_test.id('session:s6'), 0, tracker_test.get('s6_payload')));
SELECT tracker_test.sess('a-s6-elena', 'set_present_v1', tracker_test.id('session:s6'), 0,
  jsonb_build_object('player_id', tracker_test.id('player:elena'), 'present', true));
SELECT tracker_test.sess('a-s6-finish', 'finish_v1', tracker_test.id('session:s6'), 1, '{}'::jsonb);
SELECT tracker_test.ok('G02 D14: an offline-recorded session keeps its original round and is flagged for review',
  (tracker_test.get('s6_start')->>'round_id')::uuid = (tracker_test.get('r1')#>>'{}')::uuid
  AND (tracker_test.get('s6_start')->>'needs_round_review')::boolean
  AND (SELECT s.round_id = (tracker_test.get('r1')#>>'{}')::uuid AND s.needs_round_review
          AND s.state = 'completed' AND NOT r.is_current
       FROM public.tracker_sessions s
       JOIN public.tracker_rounds r ON r.coach_id = s.coach_id AND r.id = s.round_id
       WHERE s.id = tracker_test.id('session:s6')),
  tracker_test.get('s6_start')::text);
SELECT tracker_test.ok('G02b a retried delivery returns the stored result and never rebinds',
  tracker_test.sess('a-s6-start', 'start_v1', tracker_test.id('session:s6'), 0,
    tracker_test.get('s6_payload')) = tracker_test.get('s6_start'));
SELECT tracker_test.ok('G02c its ticket stays in the old round; the current pool is unchanged',
  EXISTS (SELECT 1 FROM public.tracker_ticket_entitlements
           WHERE session_id = tracker_test.id('session:s6')
             AND player_id = tracker_test.id('player:elena')
             AND round_id = (tracker_test.get('r1')#>>'{}')::uuid)
  AND (SELECT count(*) FROM public.tracker_ticket_entitlements
        WHERE round_id = (tracker_test.get('r2_result')->>'round_id')::uuid) = 2);
SELECT tracker_test.ok('G04 the stale-round review surface lists only the offline-delivered session',
  (SELECT array_agg(id) FROM public.tracker_sessions WHERE needs_round_review)
    = ARRAY[tracker_test.id('session:s6')]);

-- A synthetic legacy 2-hour training in round 1, written as the table owner
-- (the only way such a record exists; no operation creates non-1.5 credit).
RESET ROLE;
INSERT INTO public.tracker_sessions
  (id, coach_id, session_date, kind, credit_hours, state, revision, round_id, created_at, completed_at)
VALUES (tracker_test.id('session:legacy2h'), 'c3a00000-0000-4000-8000-00000000000a',
        '2026-08-01', 'Optional Training', 2.00, 'completed', 0,
        (tracker_test.get('r1')#>>'{}')::uuid, now(), now());
INSERT INTO public.tracker_session_roster
  (coach_id, session_id, player_id, first_name, jersey_number, short_label, is_guest)
SELECT coach_id, tracker_test.id('session:legacy2h'), id, first_name, jersey_number, short_label, is_guest
FROM public.tracker_players WHERE id IN (tracker_test.id('player:sam0'), tracker_test.id('player:sam00'));
INSERT INTO public.tracker_attendance
  (coach_id, session_id, player_id, present, revision, source_operation_id)
VALUES ('c3a00000-0000-4000-8000-00000000000a', tracker_test.id('session:legacy2h'),
        tracker_test.id('player:sam0'), true, 0, tracker_test.id('legacy-import'));

-- Defense in depth: even the table owner cannot alter protected history.
SELECT tracker_test.rejects('C09 owner SQL cannot change credit hours',
  $q$UPDATE public.tracker_sessions SET credit_hours = 1.5 WHERE id = tracker_test.id('session:legacy2h')$q$,
  '23514', 'credit, kind and expected scope are immutable');
SELECT tracker_test.rejects('C09b owner SQL cannot move the raffle round',
  $q$UPDATE public.tracker_sessions SET round_id = (tracker_test.get('r2_result')->>'round_id')::uuid
      WHERE id = tracker_test.id('session:s2')$q$,
  '23514', 'owner and raffle round are immutable');
SELECT tracker_test.rejects('C09c owner SQL cannot reopen a completed session',
  $q$UPDATE public.tracker_sessions SET state = 'active', completed_at = NULL
      WHERE id = tracker_test.id('session:s2')$q$,
  '23514', 'cannot be reopened or re-dated');
SELECT tracker_test.rejects('C09d owner SQL cannot re-date a completed session',
  $q$UPDATE public.tracker_sessions SET session_date = '2026-09-01'
      WHERE id = tracker_test.id('session:s2')$q$,
  '23514', 'cannot be reopened or re-dated');
SELECT tracker_test.rejects('C09e D14: owner SQL cannot move the offline-delivered session to the new round',
  $q$UPDATE public.tracker_sessions SET round_id = (tracker_test.get('r2_result')->>'round_id')::uuid
      WHERE id = tracker_test.id('session:s6')$q$,
  '23514', 'owner and raffle round are immutable');

SELECT set_config('request.jwt.claims',
  '{"sub":"c3a00000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- ── Correction of an older-round training ──
SELECT tracker_test.put('r2_count_before_c1', to_jsonb((SELECT count(*) FROM public.tracker_ticket_entitlements
  WHERE round_id = (tracker_test.get('r2_result')->>'round_id')::uuid)));
SELECT tracker_test.put('c1_payload', jsonb_build_object('reason', 'paper sheet check',
  'changes', jsonb_build_array(
    jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'present', true),
    jsonb_build_object('player_id', tracker_test.id('player:priya'), 'present', false))));
SELECT tracker_test.put('c1', tracker_test.correct('a-c1', tracker_test.id('session:s2'), 3,
  tracker_test.get('c1_payload')));
SELECT tracker_test.ok('C01 correction: same session, next revision, original round and credit',
  (tracker_test.get('c1')->>'revision')::int = 4
  AND (tracker_test.get('c1')->>'round_id')::uuid = (tracker_test.get('r1')#>>'{}')::uuid
  AND (tracker_test.get('c1')->>'credit_hours')::numeric = 1.50
  AND (SELECT round_id = (tracker_test.get('r1')#>>'{}')::uuid AND credit_hours = 1.50
         AND state = 'completed' AND session_date = '2026-09-21'
       FROM public.tracker_sessions WHERE id = tracker_test.id('session:s2')),
  tracker_test.get('c1')::text);
SELECT tracker_test.ok('C01b corrected tickets change only in the old round',
  (SELECT array_agg(player_id ORDER BY player_id) FROM public.tracker_ticket_entitlements
    WHERE session_id = tracker_test.id('session:s2'))
    = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[tracker_test.id('player:sam0'),
                                                        tracker_test.id('player:sam00')]) x)
  AND (SELECT count(*) FROM public.tracker_ticket_entitlements
        WHERE round_id = (tracker_test.get('r2_result')->>'round_id')::uuid)
      = (tracker_test.get('r2_count_before_c1')#>>'{}')::bigint);
SELECT tracker_test.ok('C01c absent is recorded on the same row; nothing deleted',
  (SELECT present FROM public.tracker_attendance WHERE session_id = tracker_test.id('session:s2')
    AND player_id = tracker_test.id('player:priya')) = false);
SELECT tracker_test.ok('C01d one audit row with before/after and the reason',
  (SELECT count(*) = 1 AND min(from_revision) = 3 AND min(to_revision) = 4
          AND min(reason) = 'paper sheet check'
          AND bool_and(changes @> jsonb_build_array(jsonb_build_object(
                'player_id', tracker_test.id('player:priya'), 'before', true, 'after', false)))
     FROM public.tracker_session_corrections WHERE session_id = tracker_test.id('session:s2')));
SELECT tracker_test.ok('C02 correction replay returns the stored result, no second audit row',
  tracker_test.correct('a-c1', tracker_test.id('session:s2'), 3, tracker_test.get('c1_payload'))
  = tracker_test.get('c1'));
SELECT tracker_test.ok('C02b replay left revision and audit unchanged',
  (SELECT revision FROM public.tracker_sessions WHERE id = tracker_test.id('session:s2')) = 4
  AND (SELECT count(*) FROM public.tracker_session_corrections
        WHERE session_id = tracker_test.id('session:s2')) = 1);
SELECT tracker_test.rejects('C03 same correction ID with a changed payload is rejected',
  $q$SELECT tracker_test.correct('a-c1', tracker_test.id('session:s2'), 3,
       jsonb_build_object('changes', jsonb_build_array(
         jsonb_build_object('player_id', tracker_test.id('player:priya'), 'present', true))))$q$,
  '23505', 'operation id reused with different request');
SELECT tracker_test.rejects('C04 a new correction on a stale revision is rejected',
  $q$SELECT tracker_test.correct('a-c1-stale', tracker_test.id('session:s2'), 3,
       jsonb_build_object('changes', jsonb_build_array(
         jsonb_build_object('player_id', tracker_test.id('player:priya'), 'present', true))))$q$,
  '40001', 'stale session revision');

-- ── Correction of the practice: expected set stays frozen ──
SELECT tracker_test.rejects('C05 an unsnapshotted new player needs an owned snapshot',
  $q$SELECT tracker_test.correct('a-c2-nosnap', tracker_test.id('session:s1'), 3,
       jsonb_build_object('changes', jsonb_build_array(
         jsonb_build_object('player_id', tracker_test.id('player:nia'), 'present', true))))$q$,
  '42501', 'unexpected player needs owned snapshot');
SELECT tracker_test.put('c2', tracker_test.correct('a-c2', tracker_test.id('session:s1'), 3,
  jsonb_build_object('changes', jsonb_build_array(
    jsonb_build_object('player_id', tracker_test.id('player:owen'), 'present', true),
    jsonb_build_object('player_id', tracker_test.id('player:nia'), 'present', true,
      'snapshot', jsonb_build_object('team_ids', jsonb_build_array(tracker_test.id('team:g7'))))))));
SELECT tracker_test.ok('C05b practice correction credits both; expected set and teams unchanged',
  (tracker_test.get('c2')->>'revision')::int = 4
  AND (SELECT count(*) FROM public.tracker_attendance
        WHERE session_id = tracker_test.id('session:s1') AND present) = 4
  AND (SELECT count(*) FROM public.tracker_session_expected_players
        WHERE session_id = tracker_test.id('session:s1')) = 6
  AND (SELECT count(*) FROM public.tracker_session_expected_teams
        WHERE session_id = tracker_test.id('session:s1')) = 2
  AND NOT EXISTS (SELECT 1 FROM public.tracker_session_expected_players
                   WHERE session_id = tracker_test.id('session:s1')
                     AND player_id = tracker_test.id('player:nia')),
  tracker_test.get('c2')::text);

-- ── Legacy 2-hour credit survives correction ──
SELECT tracker_test.put('c3', tracker_test.correct('a-c3', tracker_test.id('session:legacy2h'), 0,
  jsonb_build_object('changes', jsonb_build_array(
    jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'present', true)))));
SELECT tracker_test.ok('C06 a legacy 2-hour session keeps 2.00 hours and its old round after correction',
  (tracker_test.get('c3')->>'credit_hours')::numeric = 2.00
  AND (SELECT credit_hours = 2.00 AND round_id = (tracker_test.get('r1')#>>'{}')::uuid
       FROM public.tracker_sessions WHERE id = tracker_test.id('session:legacy2h')));

-- ── D15: retire and restore keep identity, history, credit and tickets ──
-- Sam #00 has history in round 1 (S2, legacy 2h) and a ticket in the
-- current round 2 (S5) when he is retired.
SELECT tracker_test.put('sam00_before', jsonb_build_object(
  'attendance', (SELECT count(*) FROM public.tracker_attendance WHERE player_id = tracker_test.id('player:sam00')),
  'present', (SELECT count(*) FROM public.tracker_attendance WHERE player_id = tracker_test.id('player:sam00') AND present),
  'snapshots', (SELECT count(*) FROM public.tracker_session_roster WHERE player_id = tracker_test.id('player:sam00')),
  'tickets', (SELECT count(*) FROM public.tracker_ticket_entitlements WHERE player_id = tracker_test.id('player:sam00')),
  'memberships', (SELECT count(*) FROM public.tracker_memberships WHERE player_id = tracker_test.id('player:sam00'))));
SELECT tracker_test.put('q_retire', tracker_test.roster('a-retire-sam00', 'retire_player_v1', 0,
  jsonb_build_object('player_id', tracker_test.id('player:sam00'))));
SELECT tracker_test.ok('Q01 retire: same player, next revision, marked retired',
  (tracker_test.get('q_retire')->>'revision')::int = 1
  AND (tracker_test.get('q_retire')->>'retired')::boolean
  AND (SELECT retired_at IS NOT NULL AND revision = 1 FROM public.tracker_players
        WHERE id = tracker_test.id('player:sam00')),
  tracker_test.get('q_retire')::text);
SELECT tracker_test.put('q_retire_replay', tracker_test.roster('a-retire-sam00', 'retire_player_v1', 0,
  jsonb_build_object('player_id', tracker_test.id('player:sam00'))));
SELECT tracker_test.ok('Q02 retire replay returns the stored result and applies nothing again',
  tracker_test.get('q_retire_replay') = tracker_test.get('q_retire')
  AND (SELECT revision FROM public.tracker_players WHERE id = tracker_test.id('player:sam00')) = 1);
SELECT tracker_test.rejects('Q03 retiring an already retired player is rejected',
  $q$SELECT tracker_test.roster('a-retire-sam00-again', 'retire_player_v1', 1,
       jsonb_build_object('player_id', tracker_test.id('player:sam00')))$q$,
  '55000', 'player is already retired');
SELECT tracker_test.rejects('Q04 retire with a stale base revision',
  $q$SELECT tracker_test.roster('a-retire-sam00-stale', 'retire_player_v1', 0,
       jsonb_build_object('player_id', tracker_test.id('player:sam00')))$q$,
  '40001', 'stale player revision');
SELECT tracker_test.ok('Q05 retirement keeps attendance, snapshots, memberships and every earned ticket',
  jsonb_build_object(
    'attendance', (SELECT count(*) FROM public.tracker_attendance WHERE player_id = tracker_test.id('player:sam00')),
    'present', (SELECT count(*) FROM public.tracker_attendance WHERE player_id = tracker_test.id('player:sam00') AND present),
    'snapshots', (SELECT count(*) FROM public.tracker_session_roster WHERE player_id = tracker_test.id('player:sam00')),
    'tickets', (SELECT count(*) FROM public.tracker_ticket_entitlements WHERE player_id = tracker_test.id('player:sam00')),
    'memberships', (SELECT count(*) FROM public.tracker_memberships WHERE player_id = tracker_test.id('player:sam00')))
  = tracker_test.get('sam00_before'),
  tracker_test.get('sam00_before')::text);
SELECT tracker_test.ok('Q05b D15: retirement alone keeps his current-round ticket eligible',
  EXISTS (SELECT 1 FROM public.tracker_ticket_entitlements e
           JOIN public.tracker_rounds r ON r.coach_id = e.coach_id AND r.id = e.round_id
          WHERE e.player_id = tracker_test.id('player:sam00')
            AND e.session_id = tracker_test.id('session:s5') AND r.is_current));
SELECT tracker_test.ok('Q06 a retired player is left out of the next prepared roster and expected set',
  NOT (tracker_test.start_payload('Practice', '2026-09-23', ARRAY['b7'], false)->'roster'
         @> jsonb_build_array(jsonb_build_object('player_id', tracker_test.id('player:sam00'))))
  AND NOT (tracker_test.start_payload('Practice', '2026-09-23', ARRAY['b7'], false)->'expected_player_ids'
         @> to_jsonb(ARRAY[tracker_test.id('player:sam00')]))
  AND EXISTS (SELECT 1 FROM public.tracker_session_roster
               WHERE session_id = tracker_test.id('session:s2')
                 AND player_id = tracker_test.id('player:sam00')));
SELECT tracker_test.rejects('Q07 editing a retired player asks for a restore first',
  $q$SELECT tracker_test.roster('a-u-sam00-retired', 'update_player_v1', 1,
       tracker_test.player('sam00', 'Sam', '00', '', false, ARRAY['b7']))$q$,
  '55000', 'restore the player before editing');
SELECT tracker_test.rejects('Q07b a retire payload with extra keys is rejected',
  $q$SELECT tracker_test.roster('a-retire-extra', 'retire_player_v1', 1,
       jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'delete', true))$q$,
  '22023', 'invalid retire/restore payload');

-- Start fresh while he is retired: eligibility moves by round, nothing is deleted.
SELECT tracker_test.put('att_before_r3', to_jsonb((SELECT count(*) FROM public.tracker_attendance)));
SELECT tracker_test.put('r3_result', tracker_test.sess('a-start-fresh-2', 'start_fresh_v1', NULL, 0,
  jsonb_build_object('round_id', (tracker_test.get('r2_result')->>'round_id')::uuid)));
SELECT tracker_test.ok('Q08 start fresh after retirement: his ticket stays in round 2 history, round 3 starts empty',
  (tracker_test.get('r3_result')->>'generation')::int = 3
  AND (SELECT count(*) FROM public.tracker_attendance) = (tracker_test.get('att_before_r3')#>>'{}')::bigint
  AND EXISTS (SELECT 1 FROM public.tracker_ticket_entitlements
               WHERE player_id = tracker_test.id('player:sam00')
                 AND session_id = tracker_test.id('session:s5')
                 AND round_id = (tracker_test.get('r2_result')->>'round_id')::uuid)
  AND (SELECT count(*) FROM public.tracker_ticket_entitlements
        WHERE round_id = (tracker_test.get('r3_result')->>'round_id')::uuid) = 0);

-- A new active card now reads exactly like the retired player's card.
SELECT tracker_test.roster('a-p-sam00b', 'create_player_v1', 0,
  tracker_test.player('sam00b', 'Sam', '00', '', false, ARRAY['b7']));
SELECT tracker_test.rejects('Q09 restoring onto an identical active card is rejected',
  $q$SELECT tracker_test.roster('a-restore-sam00-bad', 'restore_player_v1', 1,
       jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'short_label', ''))$q$,
  '23505', 'restore with a distinguishing short label');
SELECT tracker_test.ok('Q09b the rejected restore changed neither player and created no second identity',
  (SELECT retired_at IS NOT NULL AND revision = 1 AND short_label = '' FROM public.tracker_players
    WHERE id = tracker_test.id('player:sam00'))
  AND (SELECT retired_at IS NULL AND revision = 0 AND short_label = '' FROM public.tracker_players
        WHERE id = tracker_test.id('player:sam00b'))
  AND (SELECT count(*) FROM public.tracker_players WHERE first_name = 'Sam' AND jersey_number = '00') = 2);
SELECT tracker_test.put('q_restore', tracker_test.roster('a-restore-sam00', 'restore_player_v1', 1,
  jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'short_label', 'B.')));
SELECT tracker_test.ok('Q10 restore with a distinguishing label brings back the same identity',
  (tracker_test.get('q_restore')->>'revision')::int = 2
  AND NOT (tracker_test.get('q_restore')->>'retired')::boolean
  AND (SELECT retired_at IS NULL AND short_label = 'B.' AND revision = 2 FROM public.tracker_players
        WHERE id = tracker_test.id('player:sam00'))
  AND (SELECT count(*) FROM public.tracker_players WHERE first_name = 'Sam' AND jersey_number = '00') = 2
  AND (SELECT count(*) FROM public.tracker_memberships WHERE player_id = tracker_test.id('player:sam00')) = 1,
  tracker_test.get('q_restore')::text);
SELECT tracker_test.ok('Q10b history still shows his card as it was then; he is on the next roster again',
  (SELECT short_label = '' FROM public.tracker_session_roster
    WHERE session_id = tracker_test.id('session:s2') AND player_id = tracker_test.id('player:sam00'))
  AND tracker_test.start_payload('Practice', '2026-09-23', ARRAY['b7'], false)->'roster'
        @> jsonb_build_array(jsonb_build_object('player_id', tracker_test.id('player:sam00'))));
SELECT tracker_test.ok('Q11 restore replay returns the stored result',
  tracker_test.roster('a-restore-sam00', 'restore_player_v1', 1,
    jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'short_label', 'B.'))
  = tracker_test.get('q_restore'));
SELECT tracker_test.rejects('Q12 restoring an active player is rejected',
  $q$SELECT tracker_test.roster('a-restore-sam00-again', 'restore_player_v1', 2,
       jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'short_label', 'B.'))$q$,
  '55000', 'player is not retired');
SELECT tracker_test.rejects('Q13 restore with a stale base revision',
  $q$SELECT tracker_test.roster('a-restore-sam00-stale', 'restore_player_v1', 1,
       jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'short_label', 'C.'))$q$,
  '40001', 'stale player revision');

-- ── Delayed finish cannot close a newer session ──
SELECT tracker_test.sess('a-s3-start', 'start_v1', tracker_test.id('session:s3'), 0,
  tracker_test.start_payload('Practice', '2026-09-22', ARRAY[]::text[], true));
SELECT tracker_test.sess('a-s3-owen', 'set_present_v1', tracker_test.id('session:s3'), 0,
  jsonb_build_object('player_id', tracker_test.id('player:owen'), 'present', true));
SELECT tracker_test.put('s3_finish', tracker_test.sess('a-s3-finish', 'finish_v1',
  tracker_test.id('session:s3'), 1, '{}'::jsonb));
SELECT tracker_test.sess('a-s4-start', 'start_v1', tracker_test.id('session:s4'), 0,
  tracker_test.start_payload('Optional Training', '2026-09-22', ARRAY[]::text[], false));
SELECT tracker_test.ok('D01 a delayed replay of finish A returns its old result',
  tracker_test.sess('a-s3-finish', 'finish_v1', tracker_test.id('session:s3'), 1, '{}'::jsonb)
  = tracker_test.get('s3_finish'));
SELECT tracker_test.ok('D01b the newer session is still active and untouched',
  (SELECT state = 'active' AND revision = 0 FROM public.tracker_sessions
    WHERE id = tracker_test.id('session:s4')));
SELECT tracker_test.rejects('G03 D14: start fresh is refused while a delivered session is active',
  $q$SELECT tracker_test.sess('a-start-fresh-blocked', 'start_fresh_v1', NULL, 0,
       jsonb_build_object('round_id', (SELECT id FROM public.tracker_rounds WHERE is_current)))$q$,
  '40001', 'active session blocks raffle reset');
SELECT tracker_test.rejects('D02 a new finish for the completed session is rejected',
  $q$SELECT tracker_test.sess('a-s3-finish-again', 'finish_v1', tracker_test.id('session:s3'), 2, '{}'::jsonb)$q$,
  '40001', 'stale or completed session');
SELECT tracker_test.put('c4', tracker_test.correct('a-c4', tracker_test.id('session:s3'), 2,
  jsonb_build_object('changes', jsonb_build_array(
    jsonb_build_object('player_id', tracker_test.id('player:kayla'), 'present', true)))));
SELECT tracker_test.ok('D03 correcting a completed session while a newer one is active',
  (tracker_test.get('c4')->>'revision')::int = 3
  AND (SELECT revision = 3 FROM public.tracker_sessions WHERE id = tracker_test.id('session:s3'))
  AND (SELECT state = 'active' AND revision = 0 FROM public.tracker_sessions
        WHERE id = tracker_test.id('session:s4')));
SELECT tracker_test.rejects('C07 an active session cannot be corrected (use set_present_v1)',
  $q$SELECT tracker_test.correct('a-c-active', tracker_test.id('session:s4'), 0,
       jsonb_build_object('changes', jsonb_build_array(
         jsonb_build_object('player_id', tracker_test.id('player:owen'), 'present', true))))$q$,
  '55000', 'only a completed session can be corrected');

-- ── D13: kiosk exit PIN ──
SELECT tracker_test.ok('K01 before any change the coach has no PIN row: the default 0000 applies',
  (SELECT count(*) FROM public.tracker_exit_codes) = 0);
SELECT tracker_test.put('k_set', tracker_test.settings('a-pin-set', 'set_exit_pin_v1', 0,
  tracker_test.verifier('a2FpemVuLXRlc3Qtc2FsdA==', 'f5sqB5UrkErch74HLptMMvuWzk17ToK5psamLw5Rn0o=')));
SELECT tracker_test.ok('K02 a custom PIN replaces 0000: custom mode, the exact verifier, no PIN stored',
  tracker_test.get('k_set')->>'mode' = 'custom' AND (tracker_test.get('k_set')->>'revision')::int = 1
  AND (SELECT mode = 'custom' AND revision = 1 AND verifier_alg = 'PBKDF2-SHA256'
          AND verifier_iterations = 600000
          AND convert_from(verifier_salt, 'UTF8') = 'kaizen-test-salt'
          AND verifier_hash = decode('f5sqB5UrkErch74HLptMMvuWzk17ToK5psamLw5Rn0o=', 'base64')
       FROM public.tracker_exit_codes),
  tracker_test.get('k_set')::text);
SELECT tracker_test.put('k_set_replay', tracker_test.settings('a-pin-set', 'set_exit_pin_v1', 0,
  tracker_test.verifier('a2FpemVuLXRlc3Qtc2FsdA==', 'f5sqB5UrkErch74HLptMMvuWzk17ToK5psamLw5Rn0o=')));
SELECT tracker_test.ok('K03 set replay returns the stored result and applies nothing again',
  tracker_test.get('k_set_replay') = tracker_test.get('k_set')
  AND (SELECT revision FROM public.tracker_exit_codes) = 1);
SELECT tracker_test.rejects('K04 same PIN operation ID with a different verifier is rejected',
  $q$SELECT tracker_test.settings('a-pin-set', 'set_exit_pin_v1', 0,
       tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk='))$q$,
  '23505', 'operation id reused with different request');
SELECT tracker_test.rejects('K05 a PIN change from a stale revision is rejected',
  $q$SELECT tracker_test.settings('a-pin-set-stale', 'set_exit_pin_v1', 0,
       tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk='))$q$,
  '40001', 'stale exit PIN revision');
SELECT tracker_test.rejects('K06 a payload carrying a plaintext PIN is rejected',
  $q$SELECT tracker_test.settings('a-pin-plaintext', 'set_exit_pin_v1', 1,
       tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk=')
       || jsonb_build_object('pin', '1359'))$q$,
  '22023', 'invalid exit PIN verifier');
SELECT tracker_test.ok('K06b the rejected plaintext PIN left no ledger row and no stored change',
  NOT EXISTS (SELECT 1 FROM public.tracker_operations
               WHERE operation_id = tracker_test.id('op:a-pin-plaintext'))
  AND (SELECT revision = 1 AND mode = 'custom' FROM public.tracker_exit_codes));
SELECT tracker_test.rejects('K07 a weak verifier (1000 iterations) is rejected',
  $q$SELECT tracker_test.settings('a-pin-weak', 'set_exit_pin_v1', 1,
       tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk=', 1000))$q$,
  '22023', 'invalid exit PIN verifier');
SELECT tracker_test.rejects('K07b a verifier hash that is not 32 bytes is rejected',
  $q$SELECT tracker_test.settings('a-pin-short', 'set_exit_pin_v1', 1,
       tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'c2hvcnQ='))$q$,
  '22023', 'invalid exit PIN verifier');
SELECT tracker_test.rejects('K07c an unknown verifier algorithm is rejected',
  $q$SELECT tracker_test.settings('a-pin-sha1', 'set_exit_pin_v1', 1,
       jsonb_set(tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk='),
                 '{verifier,alg}', '"SHA-1"'))$q$,
  '22023', 'invalid exit PIN verifier');
SELECT tracker_test.put('k_replace', tracker_test.settings('a-pin-replace', 'set_exit_pin_v1', 1,
  tracker_test.verifier('a2FpemVuLXNhbHQtMDAwMg==', 'K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk=')));
SELECT tracker_test.ok('K08 a signed-in coach replaces the PIN without the old one; the old verifier is gone',
  (tracker_test.get('k_replace')->>'revision')::int = 2
  AND (SELECT mode = 'custom' AND revision = 2
          AND convert_from(verifier_salt, 'UTF8') = 'kaizen-salt-0002'
          AND verifier_hash = decode('K9qgjwTJFuzpvsPCzM/NXI4gw/nUwtKgLOQcNvU/OHk=', 'base64')
       FROM public.tracker_exit_codes));
SELECT tracker_test.rejects('K09 reset takes an empty payload',
  $q$SELECT tracker_test.settings('a-pin-reset-bad', 'reset_exit_pin_v1', 2,
       jsonb_build_object('pin', '0000'))$q$,
  '22023', 'reset takes an empty payload');
SELECT tracker_test.put('k_reset', tracker_test.settings('a-pin-reset', 'reset_exit_pin_v1', 2, '{}'::jsonb));
SELECT tracker_test.ok('K10 reset returns to the default 0000 and clears the verifier',
  tracker_test.get('k_reset')->>'mode' = 'default' AND (tracker_test.get('k_reset')->>'revision')::int = 3
  AND (SELECT mode = 'default' AND revision = 3 AND verifier_alg IS NULL AND verifier_iterations IS NULL
          AND verifier_salt IS NULL AND verifier_hash IS NULL
       FROM public.tracker_exit_codes));
SELECT tracker_test.put('k_reset_replay',
  tracker_test.settings('a-pin-reset', 'reset_exit_pin_v1', 2, '{}'::jsonb));
SELECT tracker_test.ok('K11 reset replay returns the stored result and applies nothing again',
  tracker_test.get('k_reset_replay') = tracker_test.get('k_reset')
  AND (SELECT revision FROM public.tracker_exit_codes) = 3);

-- ═══ Coach B ══════════════════════════════════════════════════════════════
SELECT set_config('request.jwt.claims',
  '{"sub":"c3b00000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
SELECT public.tracker_initialize_owner_v1();
-- B05 isolated: B has no teams or players yet, so the only condition that can
-- fail is the existing ID. The cause is asserted by its message, not only its
-- SQLSTATE (the earlier run passed B05 on a duplicate team name instead).
SELECT tracker_test.ok('B05pre coach B has no sub-teams or players yet',
  (SELECT count(*) FROM public.tracker_sub_teams) = 0
  AND (SELECT count(*) FROM public.tracker_players) = 0);
SELECT tracker_test.rejects('B05 replaying coach A''s create-team ID and payload fails on the existing ID',
  $q$SELECT tracker_test.roster('a-team-b6', 'create_team_v1', 0,
       jsonb_build_object('team_id', tracker_test.id('team:b6'), 'name', 'Blue 6th Grade'))$q$,
  '23505', '^sub-team id already exists$');
SELECT tracker_test.rejects('B05b claiming coach A''s player UUID with a valid card fails on the existing ID',
  $q$SELECT tracker_test.roster('b-p-steal-kayla', 'create_player_v1', 0,
       tracker_test.player('kayla', 'Zed', '77', '', false, ARRAY[]::text[]))$q$,
  '23505', '^player id already exists$');
SELECT tracker_test.ok('B05c those rejections left no row and no ledger entry for coach B',
  (SELECT count(*) FROM public.tracker_sub_teams) = 0
  AND (SELECT count(*) FROM public.tracker_players) = 0
  AND (SELECT count(*) FROM public.tracker_operations) = 0);
SELECT tracker_test.roster('b-team', 'create_team_v1', 0,
  jsonb_build_object('team_id', tracker_test.id('team:bteam'), 'name', 'Blue 6th Grade'));
SELECT tracker_test.ok('B01 coach B can use the same team name as coach A (per-coach uniqueness)',
  (SELECT count(*) FROM public.tracker_sub_teams) = 1);
SELECT tracker_test.rejects('B05d with a same-named team now present, the ID is still reported first',
  $q$SELECT tracker_test.roster('a-team-b6', 'create_team_v1', 0,
       jsonb_build_object('team_id', tracker_test.id('team:b6'), 'name', 'Blue 6th Grade'))$q$,
  '23505', '^sub-team id already exists$');
SELECT tracker_test.roster('b-p-own', 'create_player_v1', 0,
  tracker_test.player('bplayer', 'Kayla', '12', '', false, ARRAY['bteam']));
SELECT tracker_test.ok('B02 coach B sees none of coach A''s rows in any tracker table',
  (SELECT count(*) FROM public.tracker_players WHERE coach_id <> auth.uid()) = 0
  AND (SELECT count(*) FROM public.tracker_players) = 1
  AND (SELECT count(*) FROM public.tracker_sessions) = 0
  AND (SELECT count(*) FROM public.tracker_attendance) = 0
  AND (SELECT count(*) FROM public.tracker_session_expected_players) = 0
  AND (SELECT count(*) FROM public.tracker_session_corrections) = 0
  AND (SELECT count(*) FROM public.tracker_ticket_entitlements) = 0
  AND (SELECT count(*) FROM public.tracker_exit_codes) = 0
  AND (SELECT count(*) FROM public.tracker_operations WHERE kind <> 'create_team_v1'
                                                        AND kind <> 'create_player_v1') = 0);
SELECT tracker_test.rejects('B03 coach B cannot edit coach A''s player',
  $q$SELECT tracker_test.roster('b-edit-kayla', 'update_player_v1', 1,
       tracker_test.player('kayla', 'Hacked', '99', '', false, ARRAY[]::text[]))$q$,
  '42501', '^player not found$');
SELECT tracker_test.rejects('B03b coach B cannot retire coach A''s player',
  $q$SELECT tracker_test.roster('b-retire-kayla', 'retire_player_v1', 1,
       jsonb_build_object('player_id', tracker_test.id('player:kayla')))$q$,
  '42501', '^player not found$');
SELECT tracker_test.rejects('B03c coach B cannot restore coach A''s player',
  $q$SELECT tracker_test.roster('b-restore-sam00', 'restore_player_v1', 2,
       jsonb_build_object('player_id', tracker_test.id('player:sam00'), 'short_label', 'Z.'))$q$,
  '42501', '^player not found$');
SELECT tracker_test.rejects('B04 coach B cannot add a membership in coach A''s team',
  $q$SELECT tracker_test.roster('b-p-foreign-team', 'create_player_v1', 0,
       tracker_test.player('bplayer2', 'Zed', '5', '', false, ARRAY['b6']))$q$,
  '42501', 'foreign or unknown sub-team');
SELECT tracker_test.rejects('B06 coach B cannot finish coach A''s session',
  $q$SELECT tracker_test.sess('b-finish-a', 'finish_v1', tracker_test.id('session:s4'), 0, '{}'::jsonb)$q$,
  '42501', '^session not found$');
SELECT tracker_test.rejects('B07 coach B cannot correct coach A''s session',
  $q$SELECT tracker_test.correct('b-correct-a', tracker_test.id('session:s2'), 4,
       jsonb_build_object('changes', jsonb_build_array(
         jsonb_build_object('player_id', tracker_test.id('player:bplayer'), 'present', true,
           'snapshot', jsonb_build_object('team_ids', '[]'::jsonb)))))$q$,
  '42501', '^session not found$');
SELECT tracker_test.rejects('B08 coach B cannot start a session using coach A''s player',
  $q$SELECT tracker_test.sess('b-start-foreign', 'start_v1', tracker_test.id('session:b1'), 0,
       jsonb_set(tracker_test.start_payload('Optional Training', '2026-09-22', ARRAY[]::text[], false),
         '{roster}', jsonb_build_array(jsonb_build_object(
           'player_id', tracker_test.id('player:kayla'), 'team_ids', '[]'::jsonb))))$q$,
  '42501', 'foreign or invalid roster/team id');
SELECT tracker_test.put('bk_set', tracker_test.settings('b-pin-set', 'set_exit_pin_v1', 0,
  tracker_test.verifier('a2FpemVuLXNhbHQtMDAwYg==', 'lm17G4bpKVKDz+MFxHkTPGTcgERq5RsRAHMWld3Tiac=')));
SELECT tracker_test.ok('BK1 coach B sets a separate PIN; the two coaches'' PINs are independent',
  (tracker_test.get('bk_set')->>'revision')::int = 1
  AND (SELECT count(*) FROM public.tracker_exit_codes) = 1,
  tracker_test.get('bk_set')::text);
SELECT tracker_test.ok('B09 rejected cross-coach calls left no ledger entries for coach B',
  NOT EXISTS (SELECT 1 FROM public.tracker_operations WHERE operation_id IN (
    tracker_test.id('op:b-edit-kayla'), tracker_test.id('op:b-retire-kayla'),
    tracker_test.id('op:b-restore-sam00'), tracker_test.id('op:b-p-foreign-team'),
    tracker_test.id('op:a-team-b6'), tracker_test.id('op:b-p-steal-kayla'),
    tracker_test.id('op:b-finish-a'), tracker_test.id('op:b-correct-a'),
    tracker_test.id('op:b-start-foreign'))));
SELECT tracker_test.rejects('X01 direct INSERT into players is denied',
  $q$INSERT INTO public.tracker_players (id, coach_id, first_name) VALUES
       (tracker_test.id('player:direct'), auth.uid(), 'Direct')$q$,
  '42501', 'permission denied for table tracker_players');
SELECT tracker_test.rejects('X02 direct UPDATE of sessions is denied',
  $q$UPDATE public.tracker_sessions SET revision = revision$q$,
  '42501', 'permission denied for table tracker_sessions');
SELECT tracker_test.rejects('X03 direct DELETE of attendance is denied',
  $q$DELETE FROM public.tracker_attendance$q$,
  '42501', 'permission denied for table tracker_attendance');
SELECT tracker_test.rejects('X04 direct UPDATE of memberships is denied',
  $q$UPDATE public.tracker_memberships SET team_id = team_id$q$,
  '42501', 'permission denied for table tracker_memberships');
SELECT tracker_test.rejects('X05 direct INSERT of a correction audit row is denied',
  $q$INSERT INTO public.tracker_session_corrections
       (coach_id, session_id, operation_id, from_revision, to_revision, changes)
     VALUES (auth.uid(), gen_random_uuid(), gen_random_uuid(), 0, 1, '[]')$q$,
  '42501', 'permission denied for table tracker_session_corrections');
SELECT tracker_test.rejects('X06 direct INSERT into the operation ledger is denied',
  $q$INSERT INTO public.tracker_operations
       (coach_id, operation_id, device_id, device_sequence, kind, base_revision, request)
     VALUES (auth.uid(), gen_random_uuid(), gen_random_uuid(), 1, 'finish_v1', 0, '{}')$q$,
  '42501', 'permission denied for table tracker_operations');
SELECT tracker_test.rejects('X07 the private ledger helper is not callable by a coach',
  $q$SELECT tracker_private.claim_operation_v1(auth.uid(), gen_random_uuid(), gen_random_uuid(),
       1, 'finish_v1', NULL, 0, '{}')$q$,
  '42501', 'permission denied for function claim_operation_v1');
SELECT tracker_test.rejects('X08 direct INSERT of an exit PIN row is denied',
  $q$INSERT INTO public.tracker_exit_codes (coach_id) VALUES (auth.uid())$q$,
  '42501', 'permission denied for table tracker_exit_codes');
SELECT tracker_test.rejects('X09 direct UPDATE of an exit PIN row is denied',
  $q$UPDATE public.tracker_exit_codes SET mode = 'default'$q$,
  '42501', 'permission denied for table tracker_exit_codes');

-- ═══ Anonymous ════════════════════════════════════════════════════════════
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
SELECT tracker_test.rejects('N01 anon cannot initialize an owner',
  $q$SELECT public.tracker_initialize_owner_v1()$q$,
  '42501', 'permission denied for function tracker_initialize_owner_v1');
SELECT tracker_test.rejects('N02 anon cannot call the roster operation',
  $q$SELECT tracker_test.roster('anon-team', 'create_team_v1', 0,
       jsonb_build_object('team_id', gen_random_uuid(), 'name', 'Anon'))$q$,
  '42501', 'permission denied for function tracker_apply_roster_operation_v1');
SELECT tracker_test.rejects('N03 anon cannot call the correction operation',
  $q$SELECT tracker_test.correct('anon-correct', tracker_test.id('session:s2'), 4, '{"changes":[]}')$q$,
  '42501', 'permission denied for function tracker_correct_session_v1');
SELECT tracker_test.rejects('N04 anon cannot call the session operation',
  $q$SELECT tracker_test.sess('anon-finish', 'finish_v1', tracker_test.id('session:s4'), 0, '{}')$q$,
  '42501', 'permission denied for function tracker_apply_operation_v1');
SELECT tracker_test.rejects('N05 anon cannot read players',
  $q$SELECT count(*) FROM public.tracker_players$q$,
  '42501', 'permission denied for table tracker_players');
SELECT tracker_test.rejects('N06 anon cannot read correction audit',
  $q$SELECT count(*) FROM public.tracker_session_corrections$q$,
  '42501', 'permission denied for table tracker_session_corrections');
SELECT tracker_test.rejects('N07 anon cannot read ticket entitlements',
  $q$SELECT count(*) FROM public.tracker_ticket_entitlements$q$,
  '42501', 'permission denied for view tracker_ticket_entitlements');
SELECT tracker_test.rejects('N08 anon cannot read the admin summary view',
  $q$SELECT count(*) FROM public.admin_coach_summary_view$q$,
  '42501', 'permission denied for view admin_coach_summary_view');
SELECT tracker_test.rejects('N09 anon cannot call the PIN operation',
  $q$SELECT tracker_test.settings('anon-pin', 'reset_exit_pin_v1', 0, '{}')$q$,
  '42501', 'permission denied for function tracker_apply_settings_operation_v1');
SELECT tracker_test.rejects('N10 anon cannot read exit PIN verifiers',
  $q$SELECT count(*) FROM public.tracker_exit_codes$q$,
  '42501', 'permission denied for table tracker_exit_codes');

-- ═══ Final integrity, as the table owner ══════════════════════════════════
RESET ROLE;
SELECT tracker_test.ok('I01 coach B''s attempts left coach A''s player as A last saved it',
  (SELECT first_name = 'Kayla' AND short_label = 'K.' AND jersey_number = '21' AND revision = 1
          AND retired_at IS NULL
     FROM public.tracker_players WHERE id = tracker_test.id('player:kayla')));
SELECT tracker_test.ok('I02 practice expected snapshot intact after edits, corrections and retirement',
  (SELECT count(*) FROM public.tracker_session_expected_players
    WHERE session_id = tracker_test.id('session:s1')) = 6
  AND (SELECT count(*) FROM public.tracker_session_expected_teams
        WHERE session_id = tracker_test.id('session:s1')) = 2);
SELECT tracker_test.ok('I03 whole-program player-hours: one credit per present player/session',
  (SELECT sum(s.credit_hours) FROM public.tracker_attendance a
     JOIN public.tracker_sessions s ON s.coach_id = a.coach_id AND s.id = a.session_id
    WHERE a.coach_id = 'c3a00000-0000-4000-8000-00000000000a' AND a.present AND s.state = 'completed')
  = 1.5 * 4 + 1.5 * 2 + 2.00 * 2 + 1.5 * 2 + 1.5 * 1 + 1.5 * 2);
SELECT tracker_test.ok('I04 no tracker function deletes history rows (only current memberships)',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname IN ('tracker_private', 'public')
                 AND p.proname LIKE '%\_v1' AND p.prosrc ~* 'delete\s+from\s+public\.tracker_(?!memberships\y)'));
SELECT tracker_test.ok('I05 every applied operation has a stored result',
  NOT EXISTS (SELECT 1 FROM public.tracker_operations
               WHERE coach_id IN ('c3a00000-0000-4000-8000-00000000000a',
                                  'c3b00000-0000-4000-8000-00000000000b')
                 AND result IS NULL));
SELECT tracker_test.ok('I06 no ledger request anywhere carries a plaintext PIN',
  NOT EXISTS (SELECT 1 FROM public.tracker_operations
               WHERE request->'payload' ? 'pin' OR request->'payload'->'verifier' ? 'pin'));
SELECT tracker_test.ok('I07 each coach''s PIN state is its own: A reset to default, B custom',
  (SELECT mode = 'default' AND revision = 3 FROM public.tracker_exit_codes
    WHERE coach_id = 'c3a00000-0000-4000-8000-00000000000a')
  AND (SELECT mode = 'custom' AND revision = 1
          AND verifier_hash = decode('lm17G4bpKVKDz+MFxHkTPGTcgERq5RsRAHMWld3Tiac=', 'base64')
       FROM public.tracker_exit_codes WHERE coach_id = 'c3b00000-0000-4000-8000-00000000000b'));
SELECT tracker_test.rejects('I08 even the table owner cannot mark a PIN custom without a verifier',
  $q$UPDATE public.tracker_exit_codes SET mode = 'custom'
      WHERE coach_id = 'c3a00000-0000-4000-8000-00000000000a'$q$,
  '23514', 'tracker_exit_codes_verifier_matches_mode');
SELECT tracker_test.rejects('I08b even the table owner cannot remove one part of a custom verifier',
  $q$UPDATE public.tracker_exit_codes SET verifier_hash = NULL
      WHERE coach_id = 'c3b00000-0000-4000-8000-00000000000b'$q$,
  '23514', 'tracker_exit_codes_verifier_matches_mode');
SELECT tracker_test.ok('I09 retire/restore kept one identity per person: no duplicate row, nobody left retired',
  (SELECT count(*) FROM public.tracker_players WHERE id = tracker_test.id('player:sam00')) = 1
  AND (SELECT count(*) FROM public.tracker_players
        WHERE coach_id = 'c3a00000-0000-4000-8000-00000000000a' AND retired_at IS NOT NULL) = 0);

-- suite_md5 fingerprints the text sent as one string, up to any trailer the
-- SQL client appends. Compare it with
-- `head -c -1 docs/simplification-stage3-role-tests.sql | md5sum`.
SELECT count(*) FILTER (WHERE passed) AS passed,
       count(*) AS total,
       coalesce(jsonb_agg(jsonb_build_object('check', name, 'detail', detail) ORDER BY seq)
                  FILTER (WHERE NOT passed), '[]'::jsonb) AS failures,
       md5(split_part(current_query(), E'\n\n-- source: ', 1)) AS suite_md5,
       jsonb_agg(name || coalesce(' :: ' || detail, '') ORDER BY seq) AS checks
FROM tracker_test.results;

ROLLBACK;
