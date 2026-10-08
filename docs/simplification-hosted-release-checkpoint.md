# Hosted first-launch checkpoint — 2026-09-30

## Current result

The new coach app serves at [teamtracker.leftbraincreative.xyz](https://teamtracker.leftbraincreative.xyz/). Supabase **Kaizen Tracker** (`pwgqwcvultxihntvaewo`) remains the retained project. Public-origin iPad feature checks and verified backup/restore passed; the four previous attendance tables were retired on 2026-10-05. On 2026-10-07 the superuser dashboard was restored and published with overview, account controls and canonical coach details. Its authenticated browser check passed. The owner clarified that prelaunch coach/user/player data is disposable and requested preserving the superuser account and dashboard. The temporary test project was permanently deleted on 2026-10-07 after explicit action-time approval.

The four obsolete attendance tables have been dropped. The temporary Stage 3 Test project has been deleted; Kaizen Tracker is the sole remaining Kaizen project. No commit or push occurred; the deployed build includes the existing local, uncommitted release work, on top of source HEAD `eaeea7c`.

## Database update

### Superuser dashboard restoration — 2026-10-07

The release includes an Admin navigation item for the retained superuser, using the same Auth session as coach attendance. The existing dashboard appearance is retained. Coach details read canonical roster, team and saved-session snapshots through the protected backend; they do not query retired attendance tables or expose PIN verifiers, operation bodies or raw Auth records. Password invitation/recovery links use the public root and offer password setup. No actual email, account suspension, session revocation or password change was performed during publication.

Migration `20261007211057_restore_superuser_dashboard` grants server reads on the 12 allowed canonical detail tables and adds a narrow refresh-session revocation helper. Its private security-definer function has an empty search path, checks the actual caller's superuser membership and rejects superuser targets. The public wrapper is security invoker. Anonymous and service-role execution are denied; authenticated execution is subject to the function's authorization check. The protected summary view remains inaccessible to ordinary browser roles. All 54 existing table fingerprints were unchanged after migration; one superuser, five Auth accounts, four Storage objects and all canonical smoke-test records remain. The security advisor has no new database finding; its prior Auth leaked-password warning remains.

The deployed `admin-coach-actions` backend is version 8 with JWT verification enabled and server-side administrator checks. All 80 focused tests and TypeScript passed. The rollback-only local role suite passed, including ordinary-user denial, superuser protection and fixture session/refresh-token revocation. The published backend returns HTTP 401 to unsigned requests. After the owner signed in, the Admin overview loaded four coach accounts and the live activity feed. Selecting a coach loaded the account access state, canonical roster and attendance history without errors; this prelaunch coach has zero canonical players/sessions, correctly shown as empty states. Mocked account actions do not establish real email delivery.

Vercel production deployment `dpl_GqXgSHmKbDvDiuzNKA77faembmG8` was staged with `--prod --skip-domain`, all seven staged file hashes matched the prepared static build, and that same deployment was promoted to the public address. All seven public-origin file hashes also matched. The lazy admin bundle shares the release Auth client. Shell/worker version is `stage6-shell-18`; existing devices should reload online and refresh prepared data before their next offline use. Private recovery artifacts are in `dashboard-restoration-2026-10-07` under the existing release backup parent. The local migration filename was aligned to Supabase's applied version; its SQL SHA-256 is `d4dd0cae6e139a1ca059fef2cf501a911167ef7f0b14ca6bf03c07978f30b828`. Backend source SHA-256 is `714006b8d0e2239fe4d061421db68dc41ebf693b578b926c348ec38012e99ffd`.

The sections below retain the initial publication and retirement chronology. No source commit or push occurred.

The exact rehearsed candidate retains SHA-256 `75ed2e0aaa3d513cd7ac5aca24e6e7581f980be8ba2aecf9154608ceb9dc4b99`. [The preparation script](../scripts/prepare-release-migration.py) checks that hash and wraps it with the `postgres` execution-role guard, 5-second lock timeout, 120-second statement timeout, saved-record fingerprints, scheduler configuration comparison and permission/ownership assertions. It prepares SQL without connecting to a database. Apply it only inside one transaction.

The wrapper passed on another fresh restore in the isolated local PostgreSQL database. Local restoration used the existing `postgres` database because pg_cron is configured for that database; an initial scratch-database attempt failed before any release SQL ran. The local database is stopped again. The wrapper SHA-256 is `7892a29007f8767bda250a84a59d0ec888fad8d0b52afdbed3a6fc5c52370c58`.

Before live application, all 40 backed-up public/Auth/Storage table fingerprints still matched the private backup. Supabase applied the guarded update atomically as migration `20260930215729_kaizen_first_launch_canonical_tracker`. The transaction's data and scheduler checks passed. A separate post-application fingerprint comparison again matched all 40 original tables.

Post-application inspection confirmed:

- 14 canonical tracker tables, all with row-level security enabled.
- All five original Auth accounts and four Storage-object records preserved.
- The admin view retains 26 columns, denies anonymous and coach reads, and permits service-role reads. A service-role query successfully read four coach summaries.
- Zero new tracker operations at the migration checkpoint; no synthetic users or test sessions were added to production.
- No scheduler execution was invoked. Its existing configuration was preserved.
- The security advisor reported no database findings. The pre-existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; Auth configuration was not changed.

The candidate and runner comments retain their original rehearsal provenance. This checkpoint records their actual authorized release execution. Do not rerun the first-launch wrapper once canonical tables exist. After legacy retirement, use a separately reviewed forward-fix migration, since the original candidate references the legacy tables.

## Hosting

The existing Vercel project is `kaizen-tracker`, ID `prj_5tifPemANoJvD1NLbYcmxNJa3Ysv`, in `john-freyman-s-projects`. Previous production deployment: `dpl_3VAMRp8psyrs2RqQ2pXyD6JpiKJ1`.

The release was built locally with the retained project's current publishable key. The key was accepted by the live Auth settings endpoint (HTTP 200; email sign-in enabled, signup disabled). No service-role key was packaged. The published output excludes the test project, fault controls, test worker, old admin screens and old admin endpoint.

Vercel deployment `dpl_65zkqTQkhx65j4FzJRFPvinEsizH` reached READY. Only static Build Output API artifacts were uploaded from a separate publication folder; private database dumps and hosting recovery files were outside it. It was first uploaded with `--prod --skip-domain`: the automatic project alias moved, while custom domains remained on the previous deployment until promotion.

All six hosted files matched the local build by SHA-256: root and release HTML, asset manifest, worker, JavaScript and CSS. HTML, manifest and worker revalidate; hashed assets can be cached. The hosted normal coach sign-in screen rendered. All 58 focused application tests and TypeScript checks passed again.

After database checks passed, the deployment was promoted. An unauthenticated HTTPS request confirmed that the custom public address serves the exact verified root HTML. Its sign-in form also rendered in the browser. Earlier browser logs contained errors from Vercel's own Google sign-in screen; no app-origin loading error was observed in this check.

The project and repository hosting settings now select `npm run release:build` and `dist`. The production environment has the retained project's URL and publishable key. Branch deployment guards are still in place. Older remote source without `release:build` cannot successfully build through the configured project default; publish reviewed release source before resuming a normal Git deployment workflow.

## Private recovery record

`/Users/jfreyman/Documents/kaizen-release-backups/2026-09-29/hosted-release-2026-09-30` preserves the verified build output, source archive, runner, verification manifest, pre/post hosting settings, domain inventory, saved-row fingerprints and local guard logs. The original five-file database backup and separate four-file Storage backup remain in the same private parent folder.

Once coaches save new canonical work, do not roll the database or app back to the old tracker: the old client cannot operate against the new contract. Preserve new records and use a reviewed forward fix or redeploy the same verified new build. The previous hosted deployment is recovery context, not a compatible fallback for newly saved attendance.

## Remaining first-launch checks

### Verified backup and live retirement — 2026-10-05

The owner completed the refreshed private database export at `database-20261006T022213Z` under the private backup parent folder. All seven exported files matched their manifest hashes, and the backup contains both completed live sessions and the saved raffle draw. Restoring the exports into the isolated PostgreSQL 17.6 container succeeded, with no network, no exposed ports and scheduled execution disabled. All 57 exported application/account/file/history table fingerprints matched Supabase. Two managed-service history tables (`auth.schema_migrations` and `storage.migrations`) have schema definitions but their rows are intentionally omitted by the logical data export; they are not a complete clone of Supabase's managed services.

The retirement candidate SHA-256 is `0cc6bf864ca18f480a439788fbffcc2aa0c004f2256450d056fda9aeb7c8b786`. Its guarded wrapper SHA-256 is `b574d154dbb86706a80c24cd43ca948d492887204caec72a2515e53abec0f6ac`: it enforces the `postgres` role, reviewed legacy counts, short lock/statement timeouts, retained-row fingerprints, scheduler preservation and protected API permissions in one transaction. The exact wrapper passed locally; only the four legacy tables disappeared and all 55 retained table fingerprints were unchanged. Admin, raffle and purge checks passed with their fixtures rolled back. The admin check was adapted to assert retired-table absence instead of inserting obsolete legacy rows. The local database was stopped afterward.

The live function inventory showed no retained function dependencies on the old attendance tables. The deployed JWT-verified admin backend is version 7; its source is identical to the saved version 6, has server-side user and super-admin checks, reads the canonical summary and contains no legacy-table references. It was preserved in the private recovery record.

Supabase applied the guarded cleanup as migration `20261006023411_kaizen_retire_prelaunch_attendance`. It removed the old `roster` (20 rows), `events` (17 rows), `active_session` (2 rows) and empty `archived_event_sets`, plus the individually reviewed legacy write/log functions and triggers. The post-transaction check found zero legacy tables and all 14 canonical tables. All 54 retained non-migration-history table fingerprints matched the live pre-cleanup snapshot; migration history gained the one expected record. Five Auth accounts, four Storage objects, one new player, two completed sessions and one draw remain. The protected 26-column admin view and active daily purge schedule remain unchanged. No purge was invoked. The security advisor reported no database findings; its existing leaked-password protection warning remains unchanged.

Private recovery and verification files are saved under `recovery-and-retirement-2026-10-05` in the private backup folder. The backup manifest is marked restore-tested. Do not reapply the original first-launch candidate after this retirement; any later database repair must be a separately reviewed forward fix that preserves canonical records.

### Final feature check — 2026-10-05

The owner confirmed the live raffle displayed one eligible ticket for Test #99. After tapping Draw winner once with a blank prize and no recent-winner exclusions, the owner confirmed Test #99 won, one draw-history entry appeared and one eligible ticket remained. Read-only production corroboration found draw `3292d01e-adfa-44f6-a3c0-3042b1d4e8b6`, a blank prize, pool count 1, exactly one draw for this coach, no void marker, one remaining Optional Training ticket and 3.00 player credited hours. The public-origin raffle check passed. All planned iPad feature checks are now complete; database retirement and temporary-project cleanup remain.

### Device check follow-up — 2026-10-04

Reports follow-up: With Last 30 days and All Kaizen, the owner confirmed two completed sessions, three player credited hours and 100% average practice attendance on the live iPad report. The CSV was saved/opened in Files; the owner confirmed Test #99 has 1.5 Practice hours, 1.5 Optional hours and 3 credited hours. The owner also confirmed the printable report was saved/opened as a PDF in Files, with Test #99 showing 3 credited hours, readable text and no clipping. Public-origin report totals, CSV delivery and printable PDF delivery passed. The raffle UI check remains.

Kiosk follow-up: On the live iPad app, the owner started Optional Training, entered kiosk mode, looked up jersey 99, checked in Test, and entered the default four-digit code to exit. The owner confirmed return to coach attendance, then finished the session and confirmed one present and Synced in History. A read-only production check confirms both sessions are completed at revision 2, each with one present and 1.50 credited hours. Practice has zero raffle tickets; Optional Training has one. Kiosk lookup/check-in/exit and Optional Training completion/sync passed. Report totals and raffle UI checks remain.

After identifying the local test tab, the owner opened the published app on the iPad, signed in and confirmed **Ready offline** with the plain **Coach attendance** heading (no test-project label). Public-origin iPad sign-in and preparation passed by owner report. The owner added Test #99; a read-only production check confirmed the player exists. In Airplane Mode with Wi-Fi off, the owner started an All Kaizen Practice, marked Test #99 present and completed it. History showed one present and waiting to sync. Fully closing and reopening Safari offline retained that completed session and its pending state. After reconnecting, the owner confirmed “All saved changes synced” and “Synced” in History. Read-only production corroboration found session `c1a90da2-488c-4d95-8339-d7e50bda867b`, dated 2026-10-04, completed at revision 2 with one present player and three saved operations. Public-origin offline attendance, full Safari-close persistence and reconnection/sync have passed. Kiosk, reports and raffle checks remain. The coach's exit-code mode is default; no verifier or credential was retrieved.

The owner reported Ready offline, three roster players (Owen, Kayla and Jules), a completed offline All Kaizen Practice with Kayla present, persistence after fully closing/reopening Safari offline, and successful synchronization after reconnection. Read-only corroboration found the matching new Practice in **Stage 3 Test**, dated 2026-10-04, completed at revision 2 with one present player, three saved operations and three active roster players. The retained live project still has no canonical players or sessions. These reports therefore do not yet establish public-origin iPad readiness. The owner confirmed the iPad address is `https://192.168.0.161:4173/stage4.html`, the local test build. The next step is opening the published custom address in a new Safari tab, signing in and preparing that separate origin before repeating the device checks. The Mac's ambient public-origin tab is not evidence of the iPad's address. No project or device data was cleared.

1. Public-origin sign-in and Home opening passed, evidenced by the owner's screenshot on 2026-09-30.
2. Public-origin preparation, offline attendance, Safari close/reopen, reconnection/sync, kiosk lookup/check-in/exit and report totals/CSV/PDF passed on 2026-10-04; raffle passed on 2026-10-05. Earlier physical test-project results remain useful evidence but do not substitute for these public-origin checks.
3. Current database backup, isolated restore, legacy retirement and retained-data/admin/purge verification passed on 2026-10-05.
4. Temporary-project cleanup completed on 2026-10-07. The owner explicitly approved permanent deletion after declaring prelaunch test data disposable. The test-project client and old local test URL can no longer synchronize; use the published retained-project app.


### Temporary project removed — 2026-10-07

After signing in to Supabase, the owner explicitly approved permanently deleting **Kaizen Tracker Stage 3 Test** (`viouquduxutuslafiooy`), including its test database, Auth, Storage and functions. The exact name/reference were checked in Settings and the final deletion dialog. Supabase returned to the organization project list without the test project, and an independent MCP project inventory confirmed its absence. The prior read-only check found zero superusers in the deleted project.

The retained **Kaizen Tracker** (`pwgqwcvultxihntvaewo`) is still ACTIVE_HEALTHY. Its sole retained superuser remains present; five Auth accounts, four Storage objects, one canonical player, two sessions and one draw remain. The restored dashboard and published release stay on the retained project. No other project was changed. Cleanup evidence and a screenshot are preserved with the private dashboard recovery record. No commit or push occurred.
