# Single-project first-launch cutover — 2026-09-29

> Current status, 2026-10-07: The in-place cutover is complete: public-origin iPad checks passed, legacy attendance paths were retired after verified recovery, the retained superuser dashboard was restored and checked, and Stage 3 Test was permanently deleted with explicit approval. Kaizen Tracker is the only remaining Kaizen project. See [the release checkpoint](simplification-hosted-release-checkpoint.md). The planning statements below record the earlier decision checkpoint.

## Chosen destination

The owner chose to keep the existing Supabase project **Kaizen Tracker** (`pwgqwcvultxihntvaewo`) as the one long term project. The separate **Kaizen Tracker Stage 3 Test** project (`viouquduxutuslafiooy`) remains a temporary rehearsal environment until release-origin checks finish, then can be deleted as a separate final action. The release client already targets the retained project.

This means replacing the old tracker **inside** the retained project; deleting the retained Supabase project would also delete Auth, Storage, functions, keys, and database configuration. No production mutation or project deletion was performed for this plan.

## What stays and what retires

Read-only live catalog inspection on 2026-09-29 reconfirmed nine public legacy tables and their related functions/triggers. The [first-launch database candidate](simplification-first-launch-release-review.md) creates the new canonical `tracker_*` tables and operations in place, changes the admin view to canonical counts, narrows legacy browser write access, and guards account purge against new tracker history.

| Keep in Kaizen Tracker | Reason |
| --- | --- |
| Supabase project, Auth users and API URL | The new release client targets this project; preserving existing coach sign-in is the simplest cutover. Test accounts can be reviewed separately. |
| `profiles`, `super_admins` | Sign-up/profile behavior and protected admin access use them. |
| `team_settings` | New owner initialization and raffle settings still use it. |
| `coach_purge_state`, `activity_log` | The reviewed account lifecycle and admin view still use them. |
| `admin_coach_summary_view`, after replacement | The protected admin function reads this view; it must keep its deployed column contract and service-only access. |
| New `tracker_*` objects and `tracker_private` operations | These are the new roster, attendance, history, PIN, raffle and safety contract. |

| Retire after cutover verification | Reason |
| --- | --- |
| `roster`, `events`, `active_session`, `archived_event_sets` | These store the old name-based tracker data. The new coach app uses canonical `tracker_*` records. A [separate retirement candidate](simplification-first-launch-legacy-retirement-review.md) has passed a local rehearsal. |
| `save_session`, `archive_events`, `restore_archive`, `remove_player` | Old mutation RPCs must no longer be callable or present once no old client is served. `remove_player` can scrub old history. |
| Old event/archive log triggers and their functions | They attach to the retired tables. The profile and raffle log triggers remain in use. |

The retired tables may contain prelaunch test records; the owner has said the product has never been released and prior tracker history is unnecessary. That statement does not yet establish an exact backup or cleanup execution window. Avoid `DROP ... CASCADE`; list and review every dependency before a separate removal migration. The database candidate currently **does not** delete the old records or tables.

## Execution order

1. **Finish isolated rehearsal:** Use Stage 3 Test for remaining database role checks and the existing iPad test client, plus a fresh local catalog-shaped rehearsal where needed. Confirm the iPad has no pending local operations before removing the test project. The physical test-build recovery passed; the release build, which points only to the retained project, has not been exercised against a live backend.
2. **Record a recovery point:** Export the retained project's database schema/data with a tested restore path, inventory Storage objects and Edge Function/configuration dependencies, and record the exact reviewed client/migration revisions. Free Plan dashboard backups are not downloadable; the Supabase CLI `db dump` route is the documented alternative. Keep exports private and outside the repository.
3. **Apply the new contract in place:** Review and apply the self-contained candidate to the retained project in a controlled release window. Its admin, purge, legacy-write and canonical changes should be atomic where possible. Verify coach/noncoach/admin access, signup, raffle, purge safety, and repeated operation delivery before serving the new client.
4. **Switch the hosted app:** Build and deploy the release client with the retained project's publishable key after server checks pass. Verify an authorized coach on the release origin, prepare an iPad, check offline attendance and reconnect, then confirm reports, kiosk and raffle. Do not send clients to the test project's URL.
5. **Remove old tracker data paths:** After the new app and forward-fix path are verified, apply the [separate reviewed removal candidate](simplification-first-launch-legacy-retirement-review.md) for the four old attendance tables and obsolete functions/triggers. The owner approved retiring the old admin detail screens for first launch; preserve the secured admin backend and shared support tables listed above. Confirm the protected admin view and account lifecycle still work after removal.
6. **Retire the temporary project:** Once no device, preview, or test depends on Stage 3 Test and its needed data/configuration is saved, delete that project. Project deletion is irreversible and removes its Auth, database, Storage, functions, and backups. The retained Kaizen Tracker project remains the sole active Kaizen project.

## Open checks before any destructive step

- Actual public/Auth/Storage exports have now passed the [restored release and legacy-retirement rehearsal](simplification-restored-release-rehearsal.md), including the 26-column admin view and purge-function permissions. The live daily schedule was preserved in the private inventory; no scheduled job ran locally. Hosting, managed configuration recovery and release-origin checks remain.
- The retained project's existing Auth accounts and Storage ownership need an explicit cleanup scope if the owner wants them removed; they are not the old tracker tables. New app sign-in may depend on an existing account.
- The default web build still serves the old prototype; the host must be configured for `release:build` at cutover. The branch is deployment-disabled until that is reviewed.
- The owner approved retiring the old admin screens for first launch on 2026-09-29. They remain in repository history/source, but must not be served at the release origin. The release entry excludes them; the protected admin backend remains.
- No production migration, record deletion, project deletion, deployment, commit or push is authorized by this planning document alone.

## Execution checkpoint — 2026-09-29

The owner said **Go** to retiring the old admin screens and preparing the private backup and release rehearsal. Read-only inspection reconfirmed the retained project is healthy on PostgreSQL 17.6, with nine public legacy tables, five Auth users, one Storage bucket and four Storage objects. The daily purge job remains active at `0 3 * * *`, owned by `postgres`. The deployed protected admin function is version 6. These counts establish backup scope, not permission to discard shared accounts or files. Backup completion and a verified restore are still required before cutover.

On 2026-09-30 the private export and restore completed, along with exact local migration/reapplication, role/admin/raffle/purge checks and legacy retirement. The four Storage file contents were separately preserved. [The verification record](simplification-restored-release-rehearsal.md) describes the evidence and remaining hosted release/iPad gates. Neither cloud project changed, and no temporary project was deleted.
