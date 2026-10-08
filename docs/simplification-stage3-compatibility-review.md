# Stage 3 live compatibility review — 2026-09-26

## Result and authorized scope

**The read-only catalog comparison is complete. Stage 3 release compatibility remains incomplete.** The owner explicitly granted inspection of live Kaizen project `pwgqwcvultxihntvaewo` to compare structure, permissions, stored functions and the designated-admin aggregate. Queries used BEGIN TRANSACTION READ ONLY, catalog/aggregate SELECTs and ROLLBACK. No production function was executed, migration applied, account changed or application deployed. No raw player, attendance or authentication records were returned.

Compared with isolated project `viouquduxutuslafiooy`, which holds the Stage 3/6 candidate schema and synthetic fixtures. This supersedes earlier statements that the live catalog and sole-admin membership were unauthorized/unverified; those statements describe the earlier rehearsal. The secured admin handler was source reviewed, not invoked against production. Catalog checks cannot establish every end-to-end authorization behavior.

Evidence: local catalog snapshot at `/private/tmp/kaizen-stage3-compatibility-catalog-2026-09-26.json`. It contains structure, permissions, function-definition SHA-256 hashes, trigger/view definitions, advisor results and the admin aggregate; full function bodies were omitted from the saved snapshot. The [inspection script](simplification-stage3-compatibility-inspect.sql) documents the query scope. Focused SELECT queries succeeded; the earlier whole-script attempts are still recorded as permission-review timeouts, not successes.

## Confirmed administrator controls

- Exactly **one** row in the designated-admin aggregate; all matching membership belongs to the specified administrator. No email/user rows were returned.
- `admin_coach_summary_view` SELECT: **anon false; authenticated false; service_role true**.
- `super_admins` RLS allows authenticated users to SELECT their own status; no INSERT/UPDATE/DELETE policy is present.
- Local `supabase/functions/admin-coach-actions/index.ts` checks the caller with Auth, then verifies that caller's membership using their JWT, before creating the service-role client.
- The live admin view excludes super-admin profiles and counts legacy roster/events/archives. Its `security_invoker=false` option differs from the candidate's explicit invoker setting; direct browser access is revoked in both inspected projects. Keep the privileged handler and browser restriction when adapting the view.

These checks close the catalog/membership portion of A20. Authenticated admin/nonadmin endpoint tests and reconciliation of new totals still belong to the isolated release rehearsal.

## Live versus test comparison

The live public schema contains **9 tables and 1 view**, with RLS on all nine tables. The test schema adds **14 tracker tables and 1 tracker view**. Existing 15 public legacy policy definitions match between projects.

Column order differs; the meaningful differences below ignore ordinal position.

| Area | Live catalog | Isolated catalog / release implication |
| --- | --- | --- |
| Legacy ownership | Nullable coach_id on active_session, archived_event_sets, events, roster and team_settings; default auth.uid() | Test makes these NOT NULL. A release backfill must explicitly handle unowned records; their existence/count was not queried. |
| Legacy validation | 22 constraints on the shared objects | Test adds seven checks: session/event type, event date/duration/players, roster name and team-name length. Real data is not proven to satisfy them. |
| Legacy indexes | 16 public indexes | Test adds coach indexes on active_session/roster and composite coach/time indexes on events/archives. The synthetic baseline is not a performance clone. |
| Raffle default | team_settings.raffle_enabled defaults false | Test defaults true. Candidate owner initialization inserts true only for a missing row and preserves explicit existing false; final release must preserve that distinction. |
| Purge state | original_deadline is required | Test lacks this column. Live admin view also exposes original_deadline plus four reminder timestamps absent from the test view. Preserve the deployed view contract. |
| Public functions | 18, all SECURITY DEFINER with explicit search paths; none executable by anon/authenticated | Test has 20 including seven tracker wrappers; its legacy execution grants/search paths differ. Test advisor warnings cannot be attributed to live unchanged. |
| Legacy mutation RPCs | save_session, archive_events, restore_archive, remove_player, admin_extend_purge_deadline and admin_purge_now are also unavailable to service_role | Do not restore broad execute grants to match the test environment. Old-client behavior and intended callers must be rehearsed explicitly. |
| Triggers | Eight user triggers across public/auth, including auth signup and verification | Four test-only tracker triggers plus differences in trigger function bodies. Signup/lifecycle rehearsal needs the actual deployed definitions. |
| Browser table grants | anon/authenticated hold broad privileges, including TRUNCATE on all nine legacy tables | RLS predicates protect ordinary row operations, but do not govern TRUNCATE. Review and narrow unused privileges in an isolated candidate. No truncate or exploit was attempted. |

The TRUNCATE finding describes database privileges, not a demonstrated public HTTP exploit. PostgreSQL documents that whole-table TRUNCATE operations are outside row security: [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html). Public API reachability was not investigated.

## Function compatibility findings

### 1. Old clients and canonical operations

The live definitions of save_session, archive_events and restore_archive match the isolated legacy definitions, but their execution privileges differ. Each checks the caller's auth.uid() against the supplied coach ID. save_session writes legacy events and deletes that coach's legacy active_session; it does not use tracker operation IDs.

Local old-client source (`src/app/hooks/useTeamStore.tsx`) still calls those RPCs and directly writes roster, settings, active sessions and archives. Live owner policies permit those ordinary direct writes. Revoked RPC execution does not provide a complete old-client cutover strategy.

**Required:** rehearse either an adapter or a clear rejection/recovery path for both RPCs and direct writes, preserving post-cutover records and offline pending work. Catalog evidence predicts denied RPC calls for the named roles; no production runtime failure was elicited.

### 2. Player removal and preserved history

Live remove_player exists; it was deliberately excluded from the isolated legacy setup. Its definition checks coach ownership, deletes matching roster names, removes those names from event players and removes them from nested archived event arrays. Browser and service-role execution is currently revoked.

**Required:** preserve the approved retirement/restore behavior and explicitly account for this legacy path. Do not enable or install migration 010 as part of the new release.

### 3. Purge conflicts

Live process_purge_lifecycle exists and is executable by service_role. Its body eventually deletes auth.users. The new tracker foreign keys reference auth.users without cascading deletion, so history-bearing users would block that hard delete. Presence of the function does not prove a cron schedule is active; scheduling and lifecycle execution were not inspected.

Both that function and admin_purge_now set team_settings.team_name to NULL during soft deletion, while the live column is NOT NULL. Source/catalog comparison therefore predicts a constraint failure when that update reaches a matching settings row. No cleanup function was executed.

**Required:** resolve cleanup/history preservation as an explicit release policy, then test the chosen behavior with synthetic records in isolation. Migration 008 remains outside this work; no persistent purge was installed or retried.

**2026-09-28 read-only follow-up:** `cron.job` contains one active job named `process-purge-lifecycle`, scheduled `0 3 * * *`; its command invokes `process_purge_lifecycle()`. The current function definition confirms it sets `team_settings.team_name = NULL` during soft deletion and later runs `DELETE FROM auth.users`. The earlier statement that scheduling was uninspected describes the 2026-09-26 snapshot only. No job, function, account or purge-state row was changed or processed in this follow-up. The time zone of the configured cron schedule was not independently verified.

### 4. Signup and logging

Live handle_new_user only inserts a profile on auth signup. Live logging functions have explicit search paths, unlike several isolated copies. Live-only helpers also include handle_auth_user_created, sync_user and rls_auto_enable; the observed auth signup trigger calls handle_new_user, not those alternate signup helpers.

**Required:** use the observed trigger wiring and actual function definitions when building a deployed-like rehearsal. Merely loading the repository's selected legacy migrations does not reproduce the live catalog.

## Live advisors

The security advisor returned **one warning: leaked-password protection disabled**. It did not report the isolated project's mutable-search-path or executable-definer warnings. See [password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth setting was changed.

Performance advisor returned **2 unindexed foreign keys** (events and archived_event_sets coach_id), **15 RLS initialization-plan findings**, and **6 multiple-permissive-policy findings**. These are inherited legacy issues, with no live tracker schema present. See [foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS initialization plans](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) and [permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies). Advisor absence is not proof that the broad TRUNCATE grants are appropriate.

## Next isolated release work

1. Build an isolated baseline from the observed live catalog, including nullable ownership, real defaults, extra purge/view columns, revoked function grants and trigger wiring. Use synthetic data; no production record export was authorized.
2. Prepare one additive Stage 3+6 release migration. Include guarded legacy backfill with diagnostics for ambiguous names, missing ownership, malformed dates/durations and active sessions; do not infer that production records meet the stricter fixture checks.
3. Adapt the service-only admin aggregate to canonical records while preserving existing output columns and the verified admin handler. Compare admin/report/export totals.
4. Resolve old-client writes, destructive removal, lifecycle/history behavior and unnecessary privileges. Never broaden the live grants just to make old fixture tests pass.
5. Apply the final candidate twice in isolation with accepted attendance and Stage 6 ledger rows present. The historical Stage 3 script narrows the operation-kind CHECK and cannot simply be rerun after Stage 6.
6. Re-run coach/anon/admin isolation tests; exercise old-client handling, signup, retirement, chosen lifecycle behavior and write-preserving recovery. No new admin account or production cleanup is implied.
7. Complete the remaining Stage 7 device cases, including physical verification of the now-implemented attendance team controls, from [the evidence matrix](simplification-stage7-review.md).

The read-only review is complete. The prelaunch legacy backfill and old-client adapter in this dated plan were superseded by the owner's 2026-09-27 clarification: the product has never been released and prior test records do not matter. Current first-launch work is an isolated canonical migration/admin/recovery rehearsal, remaining acceptance checks and separately authorized production release. This clarification does not authorize deleting existing accounts or data. After launch, canonical writes and pending offline work must survive updates and recovery.
