# Old tracker retirement rehearsal — 2026-09-29

## Scope

The [single-project cutover](simplification-single-project-cutover.md) keeps Supabase project `pwgqwcvultxihntvaewo` and eventually removes its prelaunch, name-based attendance tracker. This review prepares a **separate, destructive follow-up migration**; it does not change either cloud project. The [SQL candidate](simplification-first-launch-legacy-retirement-candidate.sql) is not part of the additive first-launch migration and must not run before the hosted new client, retirement of the old admin interface, verified backup and forward-fix path are ready.

Read-only live catalog inspection reconfirmed the four legacy attendance tables (`roster`, `events`, `active_session`, `archived_event_sets`), old write/log functions and three log triggers. The candidate checks that the canonical tracker and canonical-count admin view exist, then drops the named old triggers/functions and four tables with `RESTRICT`. It retains Auth users, `profiles`, `super_admins`, `team_settings`, `coach_purge_state`, `activity_log`, the protected admin view, account lifecycle and all `tracker_*` objects. It does not delete the Stage 3 Test project or clean up old activity-log entries, existing Auth accounts or Storage objects.

## Local rehearsal

The previously used disposable local Supabase database at `/private/tmp/kaizen-first-launch-rehearsal-2026-09-28` was restarted from migrations 001–007 and 009, a catalog-shaped baseline, and the exact first-launch release-review candidate. No production rows were copied. One invented coach, team setting, canonical round/player/completed session and legacy event were added. The retirement SQL completed in a single transaction. The four old tables were absent afterward; one canonical player, one canonical session, one settings row and one protected admin summary row remained.

After removal, the adapted rollback-only Stage 3 role suite passed **145/145** with zero failures. Only its environment guard was changed to recognize the local synthetic coach; the assertions were unchanged. The rollback-only Stage 6 raffle replay/void/start-fresh and purge-lifecycle suites completed without error. These tests do not establish that the old admin UI has been replaced or that a live deployment can safely drop its old tables.

The local database was stopped after testing with its disposable volume preserved. The final candidate was rerun from a fresh local reset after adding an unexpected-trigger guard; the same retained-data, role, raffle and lifecycle checks passed.

## Gate before applying to Kaizen Tracker

- The owner approved retiring the old admin screens for first launch on 2026-09-29. The old detail components remain in source and still query the four legacy tables, but the release entry excludes them and the release origin must stop serving their old bundle. Preserve the protected `admin-coach-actions` backend and canonical-count view, which remained available in the local rehearsal. Verify the hosted release package before dropping the old tables.
- The private database export and local restore are verified, and all four Storage files are saved separately with checked hashes. Refresh that recovery point if live state changes. Auth/hosting settings and secrets remain separate recovery considerations; do not put exports in this repository.
- The [actual restored-schema retirement rehearsal](simplification-restored-release-rehearsal.md) passed, including owner 145/145, raffle and purge checks, with all retained record fingerprints identical. Verify the hosted new coach app, real admin/nonadmin behavior, release-origin iPad recovery and forward-fix path before removing live tables. No complete cloud-service clone is claimed.
- Reconfirm the live dependency graph immediately before execution. The script deliberately has no `CASCADE`, rejects unexpected attached triggers, and fails on catalog-tracked external dependencies. PostgreSQL does not reliably track every function-body reference; manually inspect the live function inventory too. Review the exact objects and data counts to be destroyed in the release window.

No production SQL, account deletion, project deletion, deployment, commit or push occurred in this follow-up.

## Actual backup follow-up — 2026-09-30

The candidate also passed against the retained project's exported public/Auth/Storage schemas and records. It removed four old tables only in the isolated local copy, preserving all 54 retained table fingerprints. Owner 145/145, raffle and purge suites passed after removal; the 26-column protected admin view still reported the invented coach's one player/one completed session. All 36 original retained exported tables matched the backup after excluding the explicit local fixture. The stopped rehearsal database and private verification record are described in [the restored rehearsal](simplification-restored-release-rehearsal.md). Neither cloud project changed.
