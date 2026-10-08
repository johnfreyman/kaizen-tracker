# First-launch database release review — 2026-09-28

## Decision and artifact

The owner accepted this first-launch policy: **do not automatically delete an account with saved postlaunch tracker data**. The candidate also protects an account that owns a Supabase Storage object, such as an uploaded logo. Empty unverified accounts may still follow the existing 90-day soft-delete and later 275-day hard-delete lifecycle. This is a release **review candidate**, not an authorized production change.

The [single self-contained candidate](simplification-first-launch-release-review-candidate.sql) combines the rehearsed Stage 3/6 canonical schema and operations, the 26-column service-only admin view, [legacy browser-write revocations](simplification-first-launch-legacy-hardening-test-migration.sql), and the [purge lifecycle guard](simplification-first-launch-purge-guard-test-migration.sql). It excludes repository migrations 008 and 010. The [live-catalog-shaped baseline](simplification-first-launch-live-baseline-local.sql) exists only for local testing and is **not** part of the release candidate.

## Live read-only findings

- `cron.job` has one active `process-purge-lifecycle` job, owned by `postgres`, with schedule `0 3 * * *`. No cron configuration was changed or job invoked in production. The schedule's time zone was not independently verified.
- The current live scheduled function sets `team_settings.team_name = NULL` at soft deletion, although that column is required, and later executes `DELETE FROM auth.users`. The current manual purge function also writes `team_name = NULL`. New tracker records reference `auth.users` without cascading deletion.
- Live `storage.objects` has both `owner uuid` and `owner_id text`. Supabase Auth deletion can also fail when the user owns Storage objects. No live user, purge-state, or Storage-object rows were read.

## Candidate behavior

- A private retained-data check covers tracker players, teams, rounds, sessions, operations, PIN records, raffle draws, and owned Storage objects. The scheduled job skips soft deletion, reminders and hard deletion for such accounts. The manual purge path rejects them with a clear error.
- Empty unverified accounts can soft-delete without writing `NULL` to the required team name. New activity-log entries omit the original email. Empty accounts can later hard-delete; existing legacy rows cascade as before.
- The scheduled and manual paths lock the Auth row before checking purge state and saved data. New tracker round or operation inserts use a private trigger that waits for the same Auth row and rejects writes after soft deletion. The non-cascading tracker foreign keys remain an additional hard-delete backstop.
- A late email verification still cancels purge state. If it follows soft deletion, the profile email is restored from Auth and the team gets the default name `Kaizen Tracker`; the former team name/logo cannot be recovered.
- The scheduled function keeps its existing signature and job schedule. `anon` and `authenticated` cannot execute the purge functions; `service_role` can execute the scheduled function, as in the live catalog. The manual function remains unavailable to browser and service roles.

## Local rehearsal evidence

The disposable local Supabase database used repository legacy migrations 001–007 and 009, then a temporary baseline shaped from the authorized live catalog, then the **exact self-contained candidate**. A fresh reset applied it successfully. The final candidate also reapplied as one transaction over invented saved player, session and legacy-event rows. The saved coach remained active after calling the scheduled function; the admin view retained 26 columns; the invented player/session/event counts remained 1/1/1; and legacy browser `INSERT` stayed revoked.

The [rollback-only lifecycle suite](simplification-first-launch-purge-guard-role-tests.sql) passed with invented accounts for: active canonical history, empty account soft/hard deletion, history on an already soft-deleted account, saved Storage ownership, stale purge state on a verified account, manual admin and nonadmin actions, late verification recovery, rejected writes after soft deletion, and function grants. Two additional local concurrency checks passed: a save committed first and preserved its account; a purge committed first and the concurrent new tracker write was rejected. No test user or purge action from the rollback suite persisted.

The Stage 3 owner suite passed **145/145** after replacing its one obsolete direct legacy `team_settings` UPDATE with owner-only fixture setup in a temporary local copy. The Stage 6 raffle replay/void/start-fresh rollback suite passed. The local security advisor reported five inherited mutable-search-path warnings from source-derived legacy logging functions and no new warning for the purge guard. The authorized live security advisor previously reported only disabled leaked-password protection; local legacy warnings should not be attributed to live unchanged.

## Release boundary

This baseline is an approximation of the live catalog, not a clone of every deployed function, trigger, schedule and row. The free organization is at its two-project limit, so no fresh remote staging project was created. Before production publication, review the exact SQL against a production-shaped staging snapshot, verify a backup/recovery method, and run the migration atomically with post-apply role/admin/purge checks. The physical iPad **test-build** update/offline recovery check subsequently passed; see the [progress record](simplification-progress.md#physical-ipad-update-recovery--2026-09-28). Release-origin recovery remains open in the [release client review](simplification-release-client-review.md). No production SQL, cron change, account cleanup, deployment, commit or push was performed for this review.

## Actual export rehearsal follow-up — 2026-09-30

[The completed restored rehearsal](simplification-restored-release-rehearsal.md) now replaces the earlier approximate baseline for exported public/Auth/Storage schemas and saved records. The private export restored atomically, the exact candidate applied as the live `postgres` role, owner checks passed 145/145, and admin/raffle/purge assertions passed. Reapplication preserved five native operations and a saved draw; local legacy retirement preserved all retained records and passed the role/raffle/purge checks again. Four Storage files were separately preserved and verified. This does not establish cloud deployment or release-origin iPad readiness. An actual release runner must enforce the checked execution role and transaction; the candidate has not been applied to either cloud project.
