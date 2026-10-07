# First-launch Mac-side rehearsal — 2026-09-27

## Scope and result

The owner confirmed that Kaizen Tracker has never been released. This rehearsal treats earlier roster, attendance and archive records as disposable **test history for counting purposes**. It did not delete those records. All database changes were confined to isolated Supabase project `viouquduxutuslafiooy`; production project `pwgqwcvultxihntvaewo` was not queried or changed during this work.

The [canonical-only admin view candidate](simplification-first-launch-admin-test-migration.sql) was applied twice. The [combined Stage 3 + Stage 6 + admin candidate](simplification-first-launch-combined-test-migration.sql) was then applied twice, including a widened Stage 3 operation-kind constraint so repeat setup accepts Stage 6 raffle operations already stored. All four isolated migrations succeeded. This proves repeat application over the existing **source-derived test schema and fixtures**. It does not prove creation on a blank project or compatibility with every difference in the live catalog.

## Data and security checks

- The protected admin view counts active `tracker_players`, completed `tracker_sessions` and archived completed tracker sessions. It ignores prelaunch legacy roster/events/archive rows. It retains the existing test view's 21-column contract and `security_invoker=false`; direct SELECT remains denied to `anon` and `authenticated` and granted to `service_role`. The existing `admin-coach-actions` handler was not edited.
- After both combined applications, a service-role read showed the iPad test coach at **3 active players, 19 completed sessions, 0 archives**. The empty test coach stayed **0/0/0**.
- The [rollback-only SQL test](simplification-first-launch-admin-role-tests.sql) checked direct canonical aggregates, added legacy sample records without changing admin totals, and started an empty coach at zero before adding one canonical player/practice/attendance. Its admin counts became **1/1/0**. All fixture writes rolled back, including legacy logging side effects; subsequent checks confirmed the empty coach returned to zero.
- Existing database totals remained **28 sessions, 109 operations, 5 rounds and 2 draws** after both combined applications and rollback tests. Six stored raffle operations were accepted by the widened check.
- The Stage 3 owner/role suite passed **145/145**, including anonymous admin-view denial. The Stage 6 raffle assertions passed without an exception. Both suites rolled back their fixtures.
- The isolated security advisor still reports inherited legacy function-search-path, executable-definer and leaked-password-protection findings; it reported no new admin-view finding. [Search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [definer-function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), and [password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain reference points for the release review.

## Interrupted-update recovery check

Added a focused workflow test that saves start, check-in and finish operations to IndexedDB, receives a temporary 503, refreshes server data while retaining the queue and local attendance, then replays the same operation IDs successfully. A failed app-shell preparation leaves the delivered attendance untouched; a later successful preparation updates the shell and keeps the completed session. The focused workflow, Reports and admin-handler suites passed **25/25**. Type check and isolated app build passed. Reports tests exercise screen-model calculations plus CSV and printable HTML from the same saved sessions.

This is a **simulated Mac-side update**, not a physical iPad update or a rollback of a deployed app. The test project has no deployed `admin-coach-actions` Edge Function and no isolated super-admin login fixture, so an actual authenticated admin/nonadmin endpoint comparison was not possible here. Handler authorization is covered by its eight mocked tests and the database service-role/read-grant checks, but remains an end-to-end release check.

## Remaining before first launch

1. Rehearse the combined migration against a fresh, deployed-like isolated database with the live catalog's extra purge/view columns and permission differences. The current test project contains older fixtures and lacks those extra columns. This candidate is **not** a production migration.
2. Compare a real protected admin endpoint response with Reports/CSV/PDF over the same canonical coach and verify a nonadmin is rejected. The isolated project currently has no Edge Function deployed.
3. Review and close still-exposed legacy mutation permissions so they cannot change canonical post-launch records. Old test-client adaptation and legacy-data import are not required.
4. Run the remaining physical iPad update, offline persistence and failure cases when the device is available. A first-launch deployment and any cleanup of test accounts/data need their own reviewed scope; neither occurred here.

The SQL and test files are local, uncommitted and unpushed.

## Fresh local database follow-up — 2026-09-28

The owner approved a new rehearsal project in the same Supabase organization. The cost check returned $0/month, but project creation failed because that account already has its maximum two active free projects. No project was paused, deleted or upgraded. Instead, a disposable local Supabase stack was started in `/private/tmp/kaizen-first-launch-rehearsal-2026-09-28` using Docker. Its data is invented; no production rows were copied. A read-only inspection of live function definitions helped shape the local baseline; production was not changed.

The local migration chain applied repository migrations 001–007 and 009, then the [temporary live-catalog baseline](simplification-first-launch-live-baseline-local.sql), then the [combined candidate](simplification-first-launch-combined-test-migration.sql). The baseline reproduces five nullable legacy owner columns, `original_deadline`, the live view's **26-column order**, revoked public-function execution and broad legacy table grants. It is a catalog-based approximation, not a full dump of live functions, triggers or data. Migrations 008 and 010 were deliberately excluded. The fresh reset completed without error. A later application of the combined candidate over saved local records also succeeded.

The previous live grants included browser-role `TRUNCATE` on all nine legacy tables. Because table row policies do not constrain `TRUNCATE`, this is a concrete first-launch permission gap. The new [legacy hardening candidate](simplification-first-launch-legacy-hardening-test-migration.sql) revokes browser-role `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` on those tables while retaining existing `SELECT` and server privileges. It applied twice locally. All nine tables then denied `TRUNCATE` and `INSERT` to `anon` and `authenticated`, retained authenticated `SELECT` and retained service-role `INSERT`. Actual coach-token POSTs to legacy `roster` and `team_settings` returned HTTP 403 / SQLSTATE 42501; coach reads still worked. This SQL is a test candidate, not an applied production change.

Three invented Auth users signed in through the local Auth API. The repository's unchanged `admin-coach-actions` Edge Function returned HTTP 200 for the invented super admin and HTTP 403 for both ordinary users. One coach had one canonical player and one completed archived Practice with 1.5 credited player-hours, plus separate legacy sample rows. The protected endpoint returned **1 player / 1 completed session / 1 archive**. Reports, CSV and printable HTML built from the same authenticated canonical API rows agreed on the player/session count and hours; the legacy sample rows did not change the admin totals. A second application of the combined migration preserved those records, and a later comparison produced the same result. Final persistent local counts were one tracker session, zero operations, one round, zero draws and one legacy event; rollback-only test operations did not persist.

The Stage 3 role suite passed **145/145** on the fresh schema before hardening. After hardening, its original run stopped at an obsolete direct `team_settings` UPDATE fixture, as intended by the new privilege rule. A temporary local copy performed that one fixture setup as the database owner; all **145/145** checks then passed with hardened grants. The Stage 6 raffle replay/void/start-fresh suite passed with an invented earned ticket inserted inside its rollback transaction. The admin count/empty-owner/legacy-isolation rollback suite passed. No real raffle draw or test fixture remained after rollback.

This closes the fresh-schema and local endpoint portions of the Mac-side rehearsal, but it does not prove an exact production clone or a production deployment. Before first launch, turn the candidates into a reviewed release migration, resolve live purge-function/scheduling compatibility with the new history foreign keys, and test the applied release version against an authorized environment. A physical iPad update and offline recovery check remain separate. Nothing was deployed, committed or pushed here.

## Physical iPad follow-up — 2026-09-28

The separate [physical iPad update and offline recovery check](simplification-progress.md#physical-ipad-update-recovery--2026-09-28) has now passed. The earlier pending-device statements above describe the state of the Mac-side rehearsal at the time. The first-launch release migration and deployed forward-fix recovery remain untested.
