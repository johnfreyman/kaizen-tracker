# Restored database release rehearsal — 2026-09-30

## Result

The retained **Kaizen Tracker** project's actual exports restored successfully into a disposable local PostgreSQL 17.6 database. The exact [release candidate](simplification-first-launch-release-review-candidate.sql) and separate [legacy retirement candidate](simplification-first-launch-legacy-retirement-candidate.sql) passed there. Neither cloud project, its scheduled job, nor the hosted app was changed. The local database was stopped after verification.

This replaces the earlier approximate-baseline limitation for the exported public, Auth and Storage schemas and their saved records. It does not establish a cloud deployment, a complete clone of every managed service, or release-origin iPad readiness.

## Private recovery files

The completed export is `/Users/jfreyman/Documents/kaizen-release-backups/2026-09-29/database-20260930T204329Z`. Its five required files are roles, application schema, data, Auth schema and Storage schema. All SHA-256 checksums matched the manifest. The live project has no `supabase_migrations` schema; a read-only check confirmed that absence. The launcher now treats that exact missing-history result as optional while continuing to stop on required exports or other errors. Three isolated completion/error checks passed, followed by a successful real five-file export.

Four public Storage files were downloaded separately into `/Users/jfreyman/Documents/kaizen-release-backups/2026-09-29/storage-files-2026-09-30`. All sizes matched the database metadata, and saved SHA-256 checksums were independently rechecked. Their ownership, paths and metadata stay in the private manifest. The database backup contains Storage metadata; file bytes are in this separate folder. No files were uploaded, altered or removed from Supabase.

The private folder also preserves the deployed admin function version 6 and the live catalog/configuration inventory. Detailed SQL, fingerprints and logs are under `restore-rehearsal-2026-09-30`. The export manifest now records the successful local restore and links to that verification record. Raw account records, password hashes, session records and backup files are outside this repository.

## Restore and execution role

The database had no network access or exposed ports, and `cron.launch_active_jobs` was off. Auth and Storage services did not run. Roles, managed Auth/Storage schema snapshots, application schema and data restored in one transaction with errors stopping execution. Two Auth triggers were deferred until their public functions existed; data triggers were disabled during the import and restored afterward. All five Auth accounts and four Storage-object rows were present.

The first local migration used `supabase_admin`. That created private helpers under a different owner from the existing `postgres`-owned purge function, and the purge suite correctly failed on helper execution permission. A fresh restore and read-only live ownership check established the correct setup: database owner `postgres`, public schema owner `pg_database_owner`, and release execution role `postgres`. After matching those settings and applying as `postgres`, every suite passed. The SQL candidate did not need a permission workaround. The release runner must enforce this same execution role; running it as an arbitrary superuser is not an equivalent rehearsal.

## Verified checks

| Check | Result |
| --- | --- |
| Exact release SQL as one transaction | Passed; SHA-256 `75ed2e0aaa3d513cd7ac5aca24e6e7581f980be8ba2aecf9154608ceb9dc4b99` |
| Saved data preservation on initial application | All 40 exported table fingerprints matched before/after |
| Owner/role/replay suite | 145/145 passed, zero failures |
| Protected admin summary suite | Passed; view retains 26 columns, denies anon/coach reads and permits service-role reads |
| Raffle replay, void and start-fresh suite | Passed |
| Scheduled/manual purge safety suite | Passed, including saved tracker history, Storage ownership, late verification and rejected writes after soft deletion |
| Reapplication over saved new operations | Passed; all 14 canonical table fingerprints unchanged, including five native operations, one completed Optional Training and one draw with a blank prize |
| Old-table retirement against restored schema | Passed locally; four old tables removed, all 54 retained table fingerprints unchanged |
| Checks after retirement | Owner 145/145, raffle and purge suites passed again; protected admin totals remained one player/one completed session for the invented coach |
| Final retained original-record comparison | All 36 remaining exported tables matched the original backup, excluding the one explicitly identified local invented coach and the four intentionally retired local tables |

Role tests and admin/raffle/purge fixtures rolled back. The temporary owner-suite copy seeded its existing environment guard locally and performed the one obsolete direct `team_settings` fixture update as the database owner. Its 145 assertions were unchanged. The repeat-application fixture used actual roster, start, attendance, finish and draw RPCs, then remained only in the stopped local database. No real coach login or admin endpoint request was made against production.

The release candidate was reapplied **before** legacy retirement. Its legacy privilege block still expects the old tables, so do not rerun that full candidate after retirement; later fixes require a separate reviewed migration.

## Next release work

1. Prepare the retained project's release runner with the checked SQL hash, an atomic transaction, the `postgres` execution-role guard, timeouts and post-apply checks. Refresh the backup before the release window if live records have changed.
2. Prepare hosting to serve the new coach build using the retained project's publishable key. Verify the staged deployment, actual coach/admin access and the forward-fix procedure before directing coaches to it. The existing default build and deployment guard have not changed.
3. Complete release-origin iPad preparation, offline attendance, sync, kiosk and reports checks. Physical test-build recovery already passed; this is the remaining check of the published app.
4. Retire the four old tables after those release checks, then delete the temporary test project after confirming no device has pending test work.

Auth/hosting settings, secrets, nonexported managed schemas and scheduled-job configuration are separate recovery considerations. The daily job's definition remains in the private catalog inventory; no scheduler job ran locally. The unchanged live daily job continues to use its existing function until an actual release migration is applied. A transient automatic approval-review usage-limit failure blocked the final verification/stop attempt; the owner asked to continue, the retry succeeded, and no work remains blocked by that failure.
