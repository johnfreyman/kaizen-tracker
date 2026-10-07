# Stage 7 admin totals reconciliation — isolated test project, 2026-09-27

## Result

The [admin summary candidate](simplification-stage7-admin-test-migration.sql) is installed only in isolated project `viouquduxutuslafiooy`. It updates the existing `admin_coach_summary_view` to count active canonical tracker players and completed tracker sessions alongside legacy records. The protected `admin-coach-actions` handler and designated-admin membership were not edited. Production project `pwgqwcvultxihntvaewo` was not queried or changed during this work.

The iPad test coach's service-role view row now reads **3 active players, 19 completed sessions, 0 archives**. Before the change it read 0/0/0 from legacy tables. Independent base-table aggregates read 3/19/0, consistent with the final synthetic rehearsal report baseline. Another test coach has 1 player/1 completed session; a coach with no data stays 0/0. One separate synthetic coach has 8 completed sessions and one archived tracker session, and the new view reports 8 sessions/1 archive.

## What the candidate counts

- Players: active `tracker_players` plus legacy `roster` identities that do not have the same coach/player UUID in tracker. Retiring a canonical identity suppresses its old matching roster row.
- Sessions: completed `tracker_sessions` plus legacy `events` without the same coach and UUID/text ID. Active tracker sessions are excluded. `last_session_at` uses the most recent saved legacy event or canonical completion timestamp; `last_active_at` also considers the last sign-in.
- Archives: legacy archive sets plus completed tracker sessions with `archived_at` set. This preserves both types of historical record for the admin display, though legacy archive sets and new archived sessions are different units.
- The view keeps the existing columns, names, order and types. It conditionally keeps five additional purge/reminder columns found in the deployed catalog but absent from the source-derived test catalog. Those additional columns were source/catalog reviewed, not executed in a production-like clone.

Matching IDs are safe to count once. Unmatched imported legacy events cannot be deduplicated from new UUIDs without a mapping. **The owner has since clarified that the product has never been released and prelaunch records do not need import.** This mixed-data behavior is test evidence, not a first-launch requirement. The final admin view should report the canonical launch dataset consistently with Reports. A18 remains Partial for deployed view-column compatibility and an actual admin endpoint comparison.

## Security and isolated verification

The candidate explicitly sets `security_invoker=false` and revokes direct SELECT from PUBLIC, anon and authenticated, while granting SELECT only to service_role. This privileged view needs `auth.users` metadata; service_role cannot directly SELECT that table in the isolated setup. Setting `security_invoker=true` caused a service-role permission error, so that intermediate isolated test setting was replaced. The existing handler still verifies the caller through Auth and checks their `super_admins` membership before it uses service_role. [Supabase's API security guide](https://supabase.com/docs/guides/api/securing-your-api) distinguishes object grants from RLS; [its view guide](https://supabase.com/docs/guides/database/views) documents view security. No browser grant or Auth-table grant was widened.

The final candidate was successfully applied **twice** in isolation (migration records `stage7_admin_canonical_summary_test_v3_service_only` and `stage7_admin_canonical_summary_test_v4_repeat`). Earlier isolated iterations v1 and v2 were also recorded by the migration tool: v1 omitted the view option, and v2 used invoker mode that could not read auth.users through service_role. The final candidate corrects both; production was untouched.

- Read-only service-role query after the second application returned 3/19/0 for the iPad test coach. The view has 21 columns and `security_invoker=false`; anon/authenticated SELECT are false, service_role SELECT true.
- [Rollback-only mixed-record test](simplification-stage7-admin-role-tests.sql) added one distinct legacy player, event and archive set plus matching-ID legacy duplicates. The view grew by exactly one player, one session and one archive. The synthetic writes and logging side effects were rolled back. Follow-up counts show no legacy-row residue.
- Existing Stage 3 role suite: **145/145 passed**, zero failures, including denial of anonymous admin-view access. Its fixture transaction rolled back.
- Admin handler tests: **8/8 passed** for verified admin, rejected nonadmin/expired sessions, fail-closed lookup and service-role read; Reports model tests: **4/4 passed**. Type check and diff check passed.
- Isolated security advisor still reports legacy function/search-path and leaked-password warnings; no new view-specific finding appeared. No unrelated security settings changed.

The service-role view query proves database access for the protected path, while handler tests use mocks. An actual admin/nonadmin authenticated Edge Function run was not performed because the isolated project intentionally has no super-admin fixture.

## Remaining release work

The first-launch migration needs an isolated rehearsal that preserves the live view's extra columns and compares a real authorized admin/nonadmin endpoint result with Reports over canonical records. It does not need legacy backfill, an archive-unit reconciliation or an old test-client adapter. Recovery must still preserve canonical writes and pending offline work after launch. The present mixed-data view is an isolated test candidate, not an approved production migration. No commit, push, production migration or deployment was authorized by this isolated test.
