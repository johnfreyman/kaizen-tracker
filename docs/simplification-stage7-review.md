# Stage 7 acceptance and compatibility review — 2026-09-26

## Scope and conclusion

Reviewed the local Stage 6 working tree based on Stage 5 commit `eaeea7c194e2b8a777539863c89d367dc8c5d249`, branch `claude/dazzling-sagan-hxrwfp`. This is an initial Stage 7 review, not a completed release acceptance or a published commit. The initial review inspected isolated Supabase project `viouquduxutuslafiooy`. Following the owner's explicit grant, the read-only live catalog review of `pwgqwcvultxihntvaewo` was completed; see [the compatibility findings](simplification-stage3-compatibility-review.md). No production data, permissions or accounts changed; no new migration, deployment or merge occurred.

The guided iPad rehearsal is complete, but the approved A01–A33 matrix contains broader cases. **Covered** means the named behavior has relevant automated/role/device evidence; it does not imply every browser/device permutation passed. **Partial** names the remaining case. **Gap** is missing functionality or cutover work. The live catalog/admin-membership check is now recorded; it does not replace isolated runtime/release checks.

## Verification completed in this review

- Whole checkout: `npx vitest run` found **104 passing tests, 3 failing tests and 1 suite-import failure** across 20 files. All **49/49 new coach/kiosk/report/raffle tests** pass.
- Saved Stage 5 HEAD was extracted into an isolated temporary directory with the same installed dependencies. It had **86 passing tests, the same 3 failing tests and the same suite-import failure** across 15 files. No additional failure was observed in the current run.
- Existing failures: two prototype kiosk assertions about cleared feedback, one legacy LaunchPage time-preset assertion and `src/lib/stats.test.ts` importing the legacy Supabase client without `VITE_SUPABASE_URL`. These are baseline failures, not repaired or hidden here. Raw logs: `/private/tmp/kaizen-stage7-current-tests.log` and `/private/tmp/kaizen-stage7-baseline-tests.log`.
- Re-ran [Stage 3 authenticated/anonymous role tests](simplification-stage3-role-tests.sql): **145/145 passed**, zero failures. Executed suite MD5 `12cbeb25637fe22342da21a532bfd55f` matches trimmed source.
- Re-ran [Stage 6 raffle role tests](simplification-stage6-role-tests.sql): Keep replay, draw replay, retained tickets, void, fresh-round replay, prior history retention and cross-coach draw visibility passed without an exception. This suite is assertion-based and does not return a numerical check count.
- Both suites end in ROLLBACK. Before/after isolated counts match: **28 sessions, 109 operations, 5 rounds and 2 draws**; `tracker_test` harness schema is absent afterward.
- All seven public tracker RPC wrappers are SECURITY INVOKER, executable by authenticated callers and unavailable to anon. Privileged implementations are in the private schema. The test admin view is unreadable by anon/authenticated. The subsequent live check confirmed one designated administrator and the same admin-view SELECT restriction; other legacy grants differ materially.
- Isolated-project security/performance advisors reported legacy function/grant/search-path and Auth warnings; no tracker security warning or unindexed foreign key appeared. Tracker unused-index notices reflect the small fixtures. Review the [definer-function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [search-path advisory](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) and [password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Executability alone does not establish an authorization bypass: legacy session/archive RPC source checks auth.uid().

## Acceptance matrix

Source requirements: [specification §9](simplification-spec.md#9-acceptance-matrix). Physical observations: [progress record](simplification-progress.md#ipad-rehearsal-setup--2026-09-26).

| ID | Status | Check | Evidence and remaining work |
| --- | --- | --- | --- |
| A01 | Covered | Practice expectation selection and direct training start | CoachApp source, workflow tests, recorded iPad session flows. |
| A02 | Covered | Fixed new credit; historical durations preserved | 1.5-hour starts; Stage 3 C06 checks a corrected historical 2-hour session; report calculation tests. |
| A03 | Covered | Shared numbers and distinguishing labels | Stage 3 P02–P11; kiosk shared-number card tests. Physical shared-card UI was not repeated. |
| A04 | Partial | Rename/renumber preserve identity and history | Stage 3 E01–E04 preserve snapshot/ID; draw uses saved name/ID. Rename after a recorded draw still needs a dedicated integrated case. |
| A05 | Covered | Present/absent changes persist | Durable desired-state operation tests and physical check-in/undo/reload. Ordinary coach-button navigation is source reviewed. |
| A06 | Covered | Kiosk lookup, undo and custom/default PIN | Ten kiosk tests; physical 0 / 00 / no match / undo / custom-PIN exit. PIN reset covered by database/local tests. |
| A07 | Covered | Kiosk navigation and refresh binding | Early kiosk-only render; binding tests; actual airplane-mode Safari full close/reopen. |
| A08 | Partial | Offline persistence and honest save failures | Real offline persistence passed; local-write failures are mocked. Real quota/write-failure acceptance remains open. |
| A09 | Partial | No duplicate start/finish or damage to newer sessions | Operation replay, immutable IDs and A/B/C queue tests; actual concurrent second-device case remains open. |
| A10 | Partial | Coach isolation and expired authentication | 145-check role suite, owner-keyed cache and auth tests. Natural expiry and overlapping browser/auth transitions need integrated checks. |
| A11 | Covered | Training accrues with raffle on/off; practice earns zero | Stage 3 T01/S05 and physical reconnect SQL verification. |
| A12 | Partial | Off/Keep/Fresh/Cancel and reset replay | Nonzero physical flows, fresh-zero result and atomic replay tests pass. All zero-pool choice combinations not separately exercised. |
| A13 | Partial | Reset and old offline work keep original rounds | Stage 3 G01–G04, D01 and SQL round locking. Truly concurrent transactions/devices not rehearsed. |
| A14 | Partial | Corrections retain entitlement and closed-round history | Stage 3 C01–C06 pass. Archive/restore effects need explicit acceptance cases; new coach UI has no archive/restore workflow. |
| A15 | Covered | Weighted ticket draw, saved history, void | Pool contains one row per earned ticket; draw chooses a row uniformly in SQL. Physical draw/exclusion/void and durable replay pass. |
| A16 | Partial | Guest/retired/missing-number identity handling | Database retire/restore/missing-number tests and saved guest-eligibility report test. Remaining guest/retirement behavior needs acceptance checks; prelaunch legacy identity mapping is out of scope under D11. |
| A17 | Covered | Default-on, explicit legacy false, fetch failure | Stage 3 initializes only missing settings; preserves false. API must() rejects failures before local preparation is committed. |
| A18 | Partial | Screen/CSV/PDF/admin totals agree | The fresh local authenticated admin endpoint, Reports, CSV and printable HTML agreed on one invented player and one completed archived session; the view kept the 26 live-shaped columns. An exact release deployment comparison remains. |
| A19 | Partial | Repeat-safe schema and immutable replay | The exact release candidate applied to actual exported public/Auth/Storage schemas and reapplied over five native operations and one saved draw, preserving all canonical fingerprints. Owner 145/145, admin, raffle and purge checks passed; local retirement passed too. The guarded cloud release and subsequent forward-fix path remain. |
| A20 | Partial | Cross-coach isolation, sole admin, privileged view | Live read-only checks found one designated admin and a service-only admin view. The unchanged handler returned 200 to an invented local admin and 403 to two ordinary local users. Release-environment endpoint checks remain. |
| A21 | Partial | First-launch write-preserving recovery | A Mac-side interrupted-update test retained queued attendance, and a physical iPad update from shell 16 to 17 preserved a completed offline Practice through Safari restart, app update, sync and new-shell offline reopen. The guarded purge candidate remains local; release deployment and forward-fix recovery are not rehearsed. Old test-client adaptation is out of scope under D11. |
| A22 | Partial | Phone/tablet touch, focus and accessibility | iPad lookup scrolling/keypad tested; semantic controls and min touch sizes source reviewed. Phone layouts, full keyboard/screen-reader and contrast verification remain open. |
| A23 | Partial | Today/backdate, durable date and fixed credit | Saved original date preserved on physical reconnect; Stage 3 backdated and stale-round cases pass. Physical backdate-from-idle and date-boundary tests remain open. |
| A24 | Partial | Default Kaizen, team controls and attendance filtering | Added coach team/no-sub-team filtering and team/number/name sorting with hidden-present guidance. Six UI/offline-write regressions pass, including shared IDs and current membership changes without expectation changes. Final physical control/layout check remains. |
| A25 | Covered | Historical attribution and no duplicate team credit | Shared-ID report tests, Stage 3 membership snapshots, read-only Blue/Gray baseline and physical Blue report toggles. |
| A26 | Covered | Two memberships, one player/number/credit/ticket | Stage 3 P01/S01/T01/E01 plus shared report/kiosk identity tests. Real two-team roster manipulation was not repeated on iPad. |
| A27 | Partial | Full offline start-from-idle, backdate and reopen sequence | Physical active-kiosk reopen, marks/undo/PIN exit and two offline finishes passed. Offline idle reopen → new practice/backdate sequence is not fully demonstrated. |
| A28 | Partial | Offline A/B finished, C active, lost-reply replay | Client A/B/C queue and server delayed-finish tests pass; iPad completed A/B offline. Real C-active reopening with delayed/lost reconnect still needs one combined run. |
| A29 | Partial | Automatic reconnect and same-owner reauthentication | Physical automatic sync and simulated auth expiry pass; draw/reset online gates source/unit reviewed. Natural expiry and full physical pending gates remain open. |
| A30 | Partial | Missing preparation, real storage failures and interrupted updates | Mock failure tests and shell readiness safeguards pass. Real storage/network failure during undo/finish/update is expressly required and remains open. |
| A31 | Covered | Union of expected teams and one practice credit | Stage 3 S01–S05; deduplicated expected IDs; shared report model. Other-team players excluded from expectation. |
| A32 | Covered | Saved expected-practice denominator and streak | Stage 3 snapshots and report A/C present/absent, intervening other-team and guest-role tests. Optional training never contributes a missed expectation. |
| A33 | Partial | Original rich analytics and aligned exports | Inventory features implemented; shared report/CSV/PDF tests and physical exports. Date/paper/section combinations, saved artifact inspection, actual transfer and full offline report-transition coverage remain open. |

Current status after the owner's first-launch scope clarification: 13 covered, 20 partial, 0 gaps. At the prior admin reconciliation checkpoint, totals were 13 covered, 19 partial, 1 gap.

## Changes needed before release

1. **Admin reconciliation (A18) — isolated candidate applied:** the [service-only view update](simplification-stage7-admin-review.md) now reports the iPad test coach at 3 active players/19 completed sessions. The secured handler and admin rule remain intact. Before release, preserve deployed extra columns and compare canonical totals under an authorized admin session. Prelaunch legacy reconciliation is not required.
2. **First-launch recovery (A21):** rehearse an app update or forward fix that preserves canonical writes and pending offline work. Scope the public launch to the new client; prevent any still-exposed legacy mutation path from bypassing new rules. An adapter for old test clients is not required.
3. **Attendance team filtering (A24) — implemented 2026-09-26:** the local coach list now filters by team or Kaizen without a sub-team and sorts by team, jersey number or name. Hidden marks remain counted; filters use current memberships without rewriting the saved expected union or session snapshots. Six regression tests pass. A physical control/layout check is still pending.
4. **Combined migration repeat/recovery (A19):** the [actual restored release rehearsal](simplification-restored-release-rehearsal.md) now passes exact candidate application/reapplication, retained records and role/admin/raffle/purge checks. Prepare a guarded cloud runner and verify the hosted release/forward-fix path before publication. The full release candidate must not be reapplied after separate legacy retirement.
5. **Compatibility decisions:** use the completed [live catalog comparison](simplification-stage3-compatibility-review.md) to construct an isolated first-launch baseline; ensure `remove_player` and purge behavior cannot damage canonical records after launch, and retain the secured admin boundary. Policies such as excused absences and changing a saved expected set remain separately undecided. No account cleanup is authorized.

## Remaining device checks

A focused second rehearsal can combine offline reopening from idle, backdated practice, A/B finished with C still active through Safari close/reopen and lost reconnect replies; draw/reset gates during pending work; installed-home-screen lifecycle; an app update with pending attendance; natural authentication expiry and same-coach recovery. Actual storage/quota failures and multi-device races need appropriate isolated devices/clients and cannot be claimed from fixture toggles. Phone/accessibility and full PDF/filter combinations still need targeted inspection. Existing passes should be reused rather than redoing the whole first rehearsal.

## Production compatibility inspection result

The owner explicitly granted the separately reserved live read-only access. Focused catalog SELECTs and a designated-admin aggregate succeeded in READ ONLY transactions, followed by ROLLBACK. [The completed comparison](simplification-stage3-compatibility-review.md) records actual columns, grants, functions, triggers, admin-view access and advisor results. No raw attendance/player/authentication rows were returned, production functions executed or production data changed.

The full multi-query inspection script was not executed successfully: its earlier isolated attempts timed out during automatic permission review. Those timeouts do not invalidate the successful focused queries. The script remains a scope/reference artifact.

Live has exactly one designated administrator; admin-view SELECT is revoked from anon/authenticated. Meaningful differences include nullable ownership, stricter test-only checks, raffle defaults, additional purge/view fields, revoked legacy RPCs and broad table privileges. Account cleanup conflicts with both a live NOT NULL field and new history-preserving foreign keys. No cleanup or permission changes were attempted.

This comparison does not close A18, A19 or A21, which require implementation and isolated first-launch/recovery checks. A20 is now partial rather than an uninspected catalog gate. Stage 8 production publication remains a later authorized action. The later D11 clarification below removes old-client and legacy-data compatibility from first-launch acceptance.

## Attendance controls follow-up — 2026-09-26

The owner accepted the proposed attendance team filtering work. Added AttendancePlayers to the existing Expected/Other practice views and optional-training view. Named-team/All teams/Kaizen-without-sub-team controls operate on current prepared memberships; saved expectations remain separate. A shared player appears once, labels/numbers distinguish matching names, missing numbers sort last, and retired filters recover to All teams. The overall count includes marks hidden by either tab or team; hidden-present guidance is announced through a status region. Marking still calls the original durable desired-state operation.

All **55/55 isolated app tests** pass, including six new controls tests covering multi-team identity, numeric/string jersey handling, default Kaizen, membership transfers, disabled marking/retired filters and a real local-write → hide/reveal → finish sequence with unchanged expected IDs. Type check, isolated build and diff check pass. The prior full legacy-suite comparison remains historical; the full suite was not rerun for this contained change.

Updated the existing HTTPS iPad preview to **stage6-shell-16**, retaining older assets. A trusted-CA request through loopback verified page/current JS/CSS/manifest/worker; the bundle includes the controls and version. Browser visual testing was blocked by certificate validation, so no browser screenshot, physical iPad pass or new backend rehearsal is claimed. No database data, permissions or schema changed; no commit, push or deployment occurred. React review checked derived list state, labelled native controls, stable player keys and nonmutating sort/filter behavior.

A24 moved from Gap to Partial at this follow-up; totals were **13 Covered / 18 Partial / 2 Gap**. Admin reconciliation and old-client/cutover were the two gaps at that point; migration/lifecycle compatibility and the remaining acceptance cases were partial. The subsequent admin summary follow-up below moves A18 to Partial.

## Isolated admin summary follow-up — 2026-09-27

The owner selected admin totals as the next Mac-side task. [The result, exact data semantics, tests and remaining release constraints](simplification-stage7-admin-review.md) are documented separately. The final candidate view was applied twice in the isolated project and returned 3 active players/19 completed sessions for the iPad test coach through service_role; anon and authenticated direct SELECT remain revoked. A rollback-only mixed legacy/new fixture passed, the Stage 3 role suite passed 145/145, and 8/8 admin handler plus 4/4 Reports model tests passed. Production was not queried or changed; no admin membership, Edge Function, Auth grant or application data was changed.

A18 moves from Gap to Partial pending legacy import/archive reconciliation and a real authenticated admin/nonadmin comparison. Matrix totals: **13 Covered / 19 Partial / 1 Gap**.

## First-launch scope clarification — 2026-09-27

The owner clarified that the product has never been released and that prelaunch history does not matter. This reaffirms D11 and supersedes the old-client adapter, legacy identity backfill and legacy archive reconciliation work described as release gates above. Those earlier findings remain a record of the catalog review, not tasks required before the first launch. Existing production data/accounts were not deleted or changed by this clarification.

A21 now covers preserving **new canonical writes and pending offline work** during a failed first-launch update or forward fix. It moves from Gap to Partial because physical recovery has not been rehearsed. A18 remains Partial for an authorized admin endpoint comparison and deployed view-column compatibility. Matrix totals at this checkpoint: **13 Covered / 20 Partial / 0 Gap**. The next planned Mac-side task was a clean, isolated first-launch migration and recovery rehearsal, with no legacy import or old-client adapter.

## First-launch Mac-side rehearsal — 2026-09-27

The owner approved the [first-launch rehearsal](simplification-first-launch-rehearsal.md). The canonical-only admin view applied twice; a combined Stage 3/6/admin candidate with the corrected ledger check also applied twice in the isolated test project. The rollback fixture proved empty-owner 0/0 → 1/1 admin counts and old sample rows had no effect. Existing data counts remained 28 sessions/109 operations/5 rounds/2 draws. Stage 3 role checks passed 145/145 and Stage 6 raffle assertions passed. A simulated interrupted update retained queued attendance and recovered after replay; 25 focused tests, type check and isolated build passed.

A18, A19 and A21 remain Partial: the test project is not a blank deployed-like clone, the real admin Edge Function is absent there, and a physical app update was not rehearsed. Matrix totals remain **13 Covered / 20 Partial / 0 Gap**. No production query, cleanup, release, commit or push occurred.

## Fresh local database rehearsal — 2026-09-28

The same-organization free project request was blocked by the account's two-project limit, so the [follow-up rehearsal](simplification-first-launch-rehearsal.md) used a disposable local Supabase stack. It applied a live-catalog-shaped baseline and the combined candidate from empty, then reapplied the candidate over invented saved rows. The unchanged admin Edge Function accepted an invented admin and rejected two nonadmins. The local coach's canonical data matched the protected endpoint, Reports, CSV and printable HTML. A test-only permission candidate removed broad legacy browser writes, including `TRUNCATE`; direct legacy API writes then returned 403. The Stage 3 role suite, raffle assertions and admin rollback assertions passed after adapting one obsolete direct-write test fixture. This local baseline is not an exact live clone, and purge scheduling plus physical update recovery remain open. Matrix totals stay **13 Covered / 20 Partial / 0 Gap**.

## Guarded purge release candidate — 2026-09-28

Read-only live inspection confirmed the daily purge job is active. The owner accepted retaining accounts with canonical tracker history; the [single release review candidate](simplification-first-launch-release-review.md) also retains Storage-object owners. The exact SQL applied fresh locally and reapplied over invented saved data; the lifecycle role suite, two opposing concurrency cases, 145/145 adapted owner checks and raffle checks passed. The scheduled/manual paths no longer write a NULL team name or delete an account with retained data. This is still a local review candidate: the baseline is not a full live clone, no production migration or cron change occurred, and physical iPad recovery remains open. A19 and A21 remain Partial; matrix totals stay **13 Covered / 20 Partial / 0 Gap**.

## Physical iPad app update recovery — 2026-09-28

The owner completed the [guided device check](simplification-progress.md#physical-ipad-update-recovery--2026-09-28). A Practice saved during actual Airplane Mode survived a full Safari restart. With the isolated test network control holding uploads, the iPad loaded shell 17 and retained the completed Practice, then synced the original three operations after the control was released. Read-only server inspection confirmed one completed session, one present player and exactly three operations. After preparing shell 17, another full Safari restart offline showed **Ready offline** and the synced Practice. This closes the physical iPad update checkpoint within A21. A21 remains Partial for the reviewed release migration, purge compatibility in an authorized environment, and actual deployment/forward-fix recovery. Totals remain **13 Covered / 20 Partial / 0 Gap**.

## Release client packaging follow-up — 2026-09-28

The [separate release client candidate](simplification-release-client-review.md) now packages the tested coach app as the root page with ordinary email sign-in and separate device storage, offline cache and service worker. The package excludes the test worker and browser fault controls. A local dummy-key browser check showed the sign-in screen; 58 focused tests, TypeScript and both build modes passed. This addresses the previously missing release entry point, but does not close A18/A19/A21 or any remaining device partial: no production sign-in, database migration, deployment or release-origin recovery was performed. Matrix totals remain **13 Covered / 20 Partial / 0 Gap**.

## Actual backup and release SQL rehearsal — 2026-09-30

The retained project's [private export and restored rehearsal](simplification-restored-release-rehearsal.md) now cover actual exported public/Auth/Storage schemas and saved records. The exact candidate applied as `postgres`, owner checks passed 145/145, and admin/raffle/purge assertions passed. The 26-column protected admin view retained its role boundary. Reapplication preserved five native operations and a saved blank-prize draw. Local legacy retirement preserved all retained records and passed owner/raffle/purge checks again. All four Storage file bytes were separately saved and verified; the local database is stopped. A18/A19/A21 stay Partial for real release access, hosted cutover and release-origin/forward-fix recovery. Totals remain **13 Covered / 20 Partial / 0 Gap**. No cloud migration, deployment or project deletion occurred.
