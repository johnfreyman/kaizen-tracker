# Stage 3 isolated database rehearsal — 2026-09-22

This is a **test-project result**, not a production rollout or proof of the live Kaizen schema. The owner authorized a separate free Supabase project after database branching was unavailable. All SQL and invented records below went only to **Kaizen Tracker Stage 3 Test** (`viouquduxutuslafiooy`, organization `cmycydiglowyfqdyizwv`, `us-west-1`). The connected live project (`pwgqwcvultxihntvaewo`) was not queried or changed. No application code, deployment, merge, sample account, or production data changed.

## Setup and exact scope

- Confirmed the test project was `ACTIVE_HEALTHY` and had no public tables or migration records before setup.
- Applied repository migrations `001_schema.sql` through `007_purge_lifecycle.sql` in order, then `009_consent_storage.sql`. `008_purge_lifecycle_fixes.sql` was rejected by automatic approval review because it installs a persistent daily purge able to irreversibly delete authenticated users and cascaded records. It was not retried, split, or worked around. `010_remove_player_cascade.sql` was left out as an unrelated destructive legacy path. This source-derived baseline is not an exact live-schema clone.
- Inspected legacy tables, RLS, grants, views and functions. Before the test migration, `admin_coach_summary_view` allowed browser `anon` and `authenticated` SELECT and was not `security_invoker`. The test migration removed both browser grants and made it `security_invoker`; catalog checks then showed both SELECT grants false. The secured `admin-coach-actions` backend was untouched. The live view's grants and the sole super-admin account remain unverified release checks.
- Applied the exact [test migration](simplification-stage3-test-migration.sql) as `stage3_test_data_foundation_v1`, again as `stage3_test_data_foundation_v1_repeat` after a cached-membership validation fix, and again as `stage3_test_data_foundation_index_fix` after adding two foreign-key indexes. Each full application succeeded with synthetic records present; it did not wipe them. This tests repeat-safe setup, not a legacy data backfill. The Supabase CLI was unavailable, so this SQL is deliberately **not** in the release `migrations/` directory.
- Synthetic owners were `stage3-coach-a@example.test` and `stage3-coach-b@example.test`, represented by invented auth UUIDs. No super-admin was added. Database calls impersonated the actual Postgres `authenticated` role with each synthetic JWT subject; direct read and RPC paths were checked. The connector masked rejected SQL calls as `INVALID_ARGUMENT`, so rejection was also checked by absence of persisted rows or operation-ledger entries.

## Observed results

| Case | Result in the isolated database |
| --- | --- |
| New and existing raffle settings | New coach A initialized with raffle enabled; coach B's explicitly saved disabled setting stayed disabled. Reinitialization after A's reset returned the same current round. |
| Identity and expected roster | `0` and `00` remained distinct text numbers. Blue 7th and Gray 7th selections both included the same shared player, but saved one expected-player row. The practice stored three roster members and three membership snapshots, including the shared player's two memberships. |
| Membership changes | Removing a current Gray 7th membership did not rewrite the saved two-team session snapshot. A later start from a prepared older cache accepted that owned historical membership snapshot, while an incorrect expected-player union was rejected with no session saved. |
| Expected-only analytics and unexpected attendance | A synthetic Blue 6th practice expected Alex but recorded Kayla arriving unexpectedly. Across two other selected Kayla practices (one present, one absent), Kayla had 1 of 2 expected attendances = 50%; the Blue 6th practice did not enter that denominator or break that expected sequence. Her unexpected attendance still credited another `1.50` hours, giving `3.00` hours across those three practices. The final streak presentation and exception policy remain Stage 6 work. |
| Idempotency and hours | Repeating the same start, mark, undo, re-mark and finish operations returned the original results. One practice attendance credited `1.50` hours and no ticket. Reusing an operation ID with a different payload was rejected. |
| Offline-shaped ordering | On the same date, two trainings started, marked and finished before practice C started. A delayed replay of training A's finish returned the old result and left C active. This proves database operation ordering/replay only; there is no client IndexedDB outbox or offline browser behavior yet. |
| Tickets, reset and archive | Two completed training attendances earned two tickets while raffle was off. Reset during an active session was rejected. After C finished, one reset opened generation 2; its replay opened no further round. Historical tickets stayed on generation 1, current eligibility became zero, and the original `4.50` player-hours remained. An invented archived `2.00`-hour old-round training retained one historical entitlement; restoring and rearchiving did not remove it or change the `2.00` hours. |
| Stale round | An offline-shaped start carrying the cached old round after reset was retained on that old round and flagged `needs_round_review`; finishing its training did not create a current-round ticket. No silent reassignment occurred. |
| Owner isolation | Coach B could read only B's own player and no A sessions or attendance. B could not finish A's session. Coach A could not start with B's player. The rejected mutations left no operation ledger entry. `anon` could not execute initialization; direct `authenticated` INSERT into attendance was denied. |
| Admin aggregate | Test-project browser SELECT on `admin_coach_summary_view` was revoked; the service role retained access. This is not evidence about production grants. |

## Security and performance review

The new tracker tables have owner-scoped RLS and browser read grants only; writes go through versioned operations. The new private definer functions use a fixed empty search path and explicit `auth.uid()` ownership checks, while the public wrapper is invoker security. No new tracker warning appeared in the Supabase security advisor. The first performance advisor run found two new unindexed foreign keys; both indexes were added to the test SQL and a repeated application cleared those warnings. Remaining unused-index notices reflect the tiny synthetic dataset, so they are not a reason to remove useful indexes.

The source-derived **legacy** baseline still produced security-advisor warnings: six old functions with mutable `search_path`, 13 old definer functions executable by `anon` and 13 by `authenticated`, plus the project's leaked-password-protection configuration. Old RLS performance notices also remain. These were not introduced by the new tracker schema and were not altered in this bounded Stage 3 exercise. Before release, inspect actual deployed grants and definitions and close unnecessary privileges; do not assume the test project's legacy state matches production.

## Local checks and remaining work

`npx tsc --noEmit` passed, and `npx vitest run supabase/functions/admin-coach-actions/index.test.ts` passed 8/8. No app flow changed, so no browser or production-bundle result is claimed for Stage 3.

Stage 3 is **partially rehearsed, not complete**. The separate project did not provide a deployed-like clone because migrations 008 and 010 were omitted and the live schema was not inspected. No reviewed release migration was generated. The versioned API currently covers initialize, start, mark/undo, finish and start-fresh; roster/team CRUD, completed-session corrections, draw records, PIN storage/recovery and client outbox are future work. The expected-attendance percentage and unexpected-credit arithmetic was checked directly in the database, but full streak presentation, explicit auth-expiry resume, draw gating and browser offline persistence have not run end-to-end. Product choices about custom PIN replacement, backdated training round assignment, player retirement and reporting corrections remain open.

**Exact next handoff:** first reconcile this test SQL with an authorized deployed-like schema and the three unresolved data policies; review the inherited database grants and sole-admin state. Convert the reviewed test SQL into a proper additive repository migration and rerun it twice in isolation with the synthetic role/replay suite. Then Stage 4 can implement roster/team writes and the prepared-iPad IndexedDB outbox against these versioned operations, followed by phone/tablet offline/reconnect testing. Keep production, migrations on the live project and deployment outside Stages 1–7.

## Continuation — roster/team writes and completed-session corrections (2026-09-23)

Same boundary as above: every call went to **Kaizen Tracker Stage 3 Test** (`viouquduxutuslafiooy`), confirmed by `get_project` (name, `ACTIVE_HEALTHY`, `us-west-1`) before any SQL. The live project `pwgqwcvultxihntvaewo` was not named in any call. Migration 008 was not retried or worked around, and 010 stays out. `pg_cron` is not installed in the test project, so no scheduled purge can run there. No super-admin fixture was added. `admin-coach-actions`, `002_super_admin.sql` and the app code were not changed.

### What was added to the test SQL

Appended to [simplification-stage3-test-migration.sql](simplification-stage3-test-migration.sql). The previously rehearsed first 548 lines are byte-identical to commit `240f1b8`.

- **Roster and sub-team writes** via a new invoker wrapper `public.tracker_apply_roster_operation_v1(operation_id, device_id, device_sequence, kind, base_revision, payload)`, which calls the private definer function `tracker_private.apply_roster_operation_v1`. The kinds are `create_team_v1`, `rename_team_v1`, `create_player_v1` and `update_player_v1`. A player payload is the full desired state: `player_id`, `first_name`, `jersey_number` (required key, may be `null` for "setup needed"), `short_label`, `is_guest` and `team_ids`. The rules:
  - One number per player. Membership rows have no number column.
  - Only surrounding spaces are trimmed, so `0` and `00` stay distinct.
  - An identical active card (same first name, number and label; case- and space-insensitive) is rejected until a short label makes it distinct.
  - Multiple memberships are stored as one row per player and team.
  - Unknown or foreign teams are rejected.
  - Players and sub-teams gain a `revision`, so a stale offline draft is rejected instead of silently winning.
  - Session roster, membership and expected snapshots are never touched, so edits cannot rewrite history. Only current memberships are replaced.
  - Active sub-team names are unique per coach.
- **Completed-session correction** via `public.tracker_correct_session_v1(operation_id, device_id, device_sequence, session_id, base_revision, payload)` → `tracker_private.correct_session_v1`. The payload is `changes` (one entry per player: `player_id`, `present`, and an owned `snapshot` only for a player never snapshotted in that session) plus an optional `reason`. The rules:
  - Only a completed session can be corrected; an active one uses `set_present_v1`.
  - The base revision must match. The correction updates the same attendance rows, raises the session revision by one, and writes one audit row to the new `tracker_session_corrections` table (before/after per player, reason, from/to revision).
  - It never changes round, credit, kind, date, expected teams or expected players.
  - Tickets and credit stay derived, so a correction in an older round changes only that round's pool.
- **Shared ledger claim**: `tracker_private.claim_operation_v1` gives both new entry points the same duplicate/changed-payload behavior as `apply_operation_v1`, in the same `tracker_operations` ledger. The ledger `kind` check was widened to the five new kinds. `apply_operation_v1` itself is unchanged.
- **Defense in depth**: a second trigger, `tracker_session_history_immutable`, stops anyone, even the table owner, from changing a session's credit, kind or `all_kaizen`, or reopening or re-dating a completed session. The existing trigger still protects the owner and round.
- **Grants**: the new tables allow owner-scoped SELECT only. Private functions revoke `PUBLIC`/`anon`/`authenticated` and grant only what the wrappers need. The ledger helper and trigger functions are not executable by browser roles.
- **Deliberately not added** (open policies or out of scope): player retire/remove, sub-team retire, PIN storage/recovery, a round rule for newly backdated training, correcting a saved expected list, re-dating a completed session, and draw records. `start_v1` still binds whatever round the client sends, normally the current one, regardless of `session_date`. That matches P08's recommendation but is **not** an owner decision. If the owner picks the historical-date round instead, `start_v1` must change.

### Commands run and results

| Step | Tool / command | Result |
| --- | --- | --- |
| Identity check | `get_project viouquduxutuslafiooy`, `list_migrations` | "Kaizen Tracker Stage 3 Test", healthy; legacy 001–007 and 009 plus the three earlier Stage 3 applications; no 008/010. |
| Pre-state | read-only catalog query | 2 synthetic auth users; tracker counts 4 players / 4 teams / 9 sessions / 7 attendance / 25 operations; no active session; no `pg_cron`. |
| Rollback probe | `BEGIN … CREATE TABLE … SELECT … ROLLBACK`, then `to_regclass` | The connector returns the in-transaction result and the rollback leaves nothing behind. |
| Apply 1 | `apply_migration stage3_test_roster_correction_v1` (whole file) | Success. Stored statement MD5 `b5e2fcaa23ca3062d5b5507c27d52b41` equals the repository file, proving the applied SQL is byte-identical. |
| Role suite, run 1 | [simplification-stage3-role-tests.sql](simplification-stage3-role-tests.sql) via `execute_sql` | **90/90 passed.** Afterward the counts were unchanged (4/4/9/7/25), with no harness schema and no test accounts left. |
| Apply 2 (repeat) | `apply_migration stage3_test_roster_correction_v1_repeat` (whole file, over existing data) | Success, same MD5. Existing data unchanged, existing players keep `revision = 0`, and exactly one kind check, two session triggers and one correction policy. |
| Role suite, run 2 | same file, with every check's reason included in the report | **90/90 passed**; each rejection had the intended SQLSTATE and message (below). |
| Advisors | `get_advisors security`, `get_advisors performance` | No tracker object flagged. Details below. |
| Local | `npx tsc --noEmit`; `npx vitest run supabase/functions/admin-coach-actions/index.test.ts` | 0 errors; 8/8 passed. |

The role suite is one transaction that ends in `ROLLBACK`. It creates two invented coaches (`stage3-roletest-a/b@example.test`, never committed), a throwaway `tracker_test` helper schema, and all fixtures. Each check runs after `SET LOCAL ROLE authenticated` or `anon` with a JWT `sub` claim, so RLS, grants and `auth.uid()` behave as they would for a browser caller. A guard refuses to run unless the project's synthetic marker account exists.

### What the 90 checks cover

| Area | Checks | Observed |
| --- | --- | --- |
| Sub-teams | R01–R06 | Create; same-ID replay returns the stored result with one row; same ID with a changed payload → `23505 operation id reused with different request`; duplicate active name → `23505`; stale rename → `40001`; rename raises the revision. |
| Players | P01–P11b | Two memberships, one number, and no number column on memberships; `0`/`00` stored distinctly; identical card → `23505 card collision`, resolved by label `M.`; case/space variants collide; ` 7 ` trimmed to `7`; `A1`, `1234` and a missing number key → `22023`; `null` number allowed; unknown team → `42501`; stale update → `40001`; a rejected edit leaves label and revision unchanged. |
| Expected union / unexpected attendee | S01–S05 | Blue 6th + Blue 7th saved 6 expected players with the shared player once; other-team and no-team players are not expected; both teams and the shared player's two memberships are snapshotted. Start and mark replays return stored results without a second row or revision. An unexpected attendee is credited but not added to the expected set. Practice credits 1.50 and gives no ticket. |
| Roster edits after a saved session | E01–E04 | After editing the number (12→21), label and memberships, the saved roster snapshot still shows `12` with no label. Saved memberships (2) and expected players (6) are unchanged, and a renamed team keeps its ID in the saved selection. |
| Tickets while raffle is off | T01–T01b | With `raffle_enabled = false` (set by the coach through the existing owner policy), a training still produced one entitlement per attendee in round 1. Training has no expected set. |
| Start fresh | F01–F02 | Generation 2 opened, the attendance count was unchanged (no "Reset wheel" deletion), and old tickets stay in round 1 while round 2 starts empty. |
| Corrections | C01–C07, C09 | Correcting an old-round training: same session, revision 3→4, round 1 and 1.50 credit kept, date kept, and entitlements changed only in round 1. "Absent" updates the same row. One audit row records before/after and the reason. Replay returns the stored result; a changed payload → `23505`; a stale revision → `40001`. A new player needs an owned snapshot (`42501`), and adding one to a practice left its expected set (6) and teams (2) unchanged. A synthetic legacy 2.00-hour session kept 2.00 hours and its old round after correction. Correcting an active session → `55000`. Even table-owner SQL cannot change credit, move the round, reopen or re-date (`23514`). |
| Delayed finish | D01–D03 | A delayed replay of finish A returns A's old result, and the newer session stays active at revision 0. A new finish for completed A → `40001`. A correction to A while B is active leaves B untouched. |
| Coach B and direct tables | B01–B09, X01–X07 | B can reuse A's team name. B sees none of A's rows in any tracker table or view. B cannot edit A's player (`42501 player not found`), use A's team or player (`42501`), or finish or correct A's session (`42501 session not found`). B replaying A's create-team operation ID and payload was rejected (`23505`) because B already had an active team with that name. Rejected calls left no ledger rows. Direct INSERT/UPDATE/DELETE on players, sessions, attendance, memberships, corrections and the ledger, and calling the private ledger helper, were all denied (`42501 permission denied`). |
| Anonymous | N01–N08 | Every tracker function, table and view, and the admin summary view, is denied (`42501`). |
| Integrity | I01–I05 | A's player is exactly as A last saved it. The practice expected snapshot is intact. Whole-program player-hours = 16.00 (one credit per present player/session, legacy 2.00 kept). No tracker function contains a `DELETE` of history rows (only current memberships). Every applied operation has a stored result. |

### Advisors after the repeat application

- **Security:** no tracker finding. The same inherited legacy warnings as before remain: 6 functions with a mutable `search_path`, 13 legacy `SECURITY DEFINER` functions each executable by `anon` and by `authenticated` (including legacy `save_session`, `archive_events`, `restore_archive`, `admin_purge_now`), and leaked-password protection disabled. None was changed; they need a separate reviewed hardening pass before any release.
- **Performance:** no unindexed foreign keys, including the new `tracker_session_corrections` foreign keys (covered by its primary key and unique key). The `auth_rls_initplan` and multiple-permissive-policy warnings are on legacy tables only; tracker policies already use `(select auth.uid())`. There are 11 unused-index notices (8 legacy, 3 tracker), expected with a tiny synthetic dataset.

### Findings and limits

- A coach can learn that an unknown UUID already exists: creating a team or player with an ID another coach used returns "id already exists". Nothing about the owner or contents leaks, and client IDs are random v4 UUIDs, so the risk is low. Note it for release review.
- The rehearsal record's earlier remark that the connector masked rejections as `INVALID_ARGUMENT` did not recur: rejected calls inside the suite reported their real SQLSTATE and message. The suite still checks absence of rows as well.
- This is still a **source-derived test project, not a deployed-like clone**. The live schema, live grants and the sole-super-admin account were not inspected. The SQL remains an isolated-rehearsal candidate under `docs/`, not a release migration. The Supabase CLI is unavailable here.
- This proves database behavior only. No browser, IndexedDB outbox, offline, auth-expiry or reconnect behavior was exercised. That is Stage 4.
