# Team attendance tracker audit

Reviewed October 7, 2026. Scope: Claude Design audit, supplied screenshots, current working source, public release assets, authenticated live navigation, and read-only Supabase inspection.

## Assessment

The production tracker has stronger attendance storage and access controls than the version Claude reviewed, but the coach experience still exposes too much setup and recovery machinery. “Prepare while online” and “Refresh prepared data” are real production dependencies. Actual fault-testing controls are excluded from the published release.

Claude's PDF identifies its baseline as `main @ 40d9b0c`. Local HEAD is `eaeea7c`, with substantial additional uncommitted release work. The production app uses `src/stage4`, the release entry point, and canonical `tracker_*` tables. The old `useTeamStore` attendance implementation is no longer the production coach workflow. Consequently, treating all of the PDF's findings as current production vulnerabilities would be misleading.

No app code, production records, permissions, account settings, emails, or deployments were changed for this audit. This report is the only intended repository addition.

## Why the preparation controls remain

The original offline requirement explicitly included reopening a previously prepared iPad without connectivity. Preparation implements that requirement by caching the application assets and downloading the roster, team memberships, raffle round, exit-code verifier, and session history into coach-scoped browser storage.

`CoachApp.tsx:207` derives readiness from the saved schema version, shell version, current asset fingerprint, and verified cache. At line 219, both session-start buttons require that readiness even when the browser is online. `prepareDevice` at line 162 is the explicit trigger. Signing in does not automatically prepare the device.

This explains the screenshots without assuming leftover test controls:

- A new browser profile or device has no prepared data.
- Signing out clears the prepared snapshot, so the next sign-in requires preparation again.
- A release with changed assets invalidates readiness until the current shell is prepared.
- The first screenshot shows Chrome Incognito. Its site data is removed after all Incognito windows close; this can cause a fresh preparation requirement on subsequent visits. This is a plausible contributing cause, not a verified explanation of that specific browser session. See [Chrome's Incognito documentation](https://support.google.com/chrome/answer/95464?hl=en).

The published main bundle contains the preparation labels but does not contain “Browser test controls,” “Simulate gym offline,” “Drop next operation acknowledgment,” or `SET_TEST_OFFLINE`. The published release worker exactly matches `public/sw-release.js` and handles only shell preparation and ordinary same-origin caching.

Recommendation: retain offline durability, automatically prepare after sign-in and safely refresh while connected, and make “Refresh offline copy” a secondary recovery action in Settings. Replace “Prepare this iPad,” “PIN verifier,” and “prepared data” with device-neutral language. Do not merely delete the buttons: the present implementation depends on them.

## Prioritized independent findings

Priority meanings: P1 = resolve before broader coach rollout; P2 = important workflow or correctness repair; P3 = polish or maintenance. No current P0 exploit was established by this review.

### A1 · P1 · Production cannot be reproduced from the current Git commit

**Evidence:** Git reports modified release configuration and core application files, and untracked `release.html`, `public/sw-release.js`, `runtime.ts`, reports, raffle components, and the dashboard migration. `git ls-files` returns no tracked entries for these examples. The release checkpoint explicitly records publication of local uncommitted source. The live manifest confirms the release bundle and lazy admin bundle.

**Impact:** A clean checkout of the current commit lacks essential published functionality. Repository-only audits review an obsolete implementation, and a Git deployment cannot reliably recreate production. This is the central reason Claude's review diverges from the live system.

**Recommendation:** Reconcile the release source, migration history, and deployment configuration in a reviewed commit and tag. Keep private backups and credentials out of Git. Validate the resulting checkout through a clean install, typecheck, focused tests, and release build. Update the README to identify the actual release entry point and supported development environment.

### A2 · P1 · Purge reminders are recorded as sent without delivery

**Evidence:** Read-only inspection of the live `process_purge_lifecycle()` definition shows the 7/30/60/83-day branches updating `*_sent_at` and inserting `purge_reminder_sent`. There is no mail delivery or dispatch in those branches, no user trigger on `activity_log`, and the only scheduled job is the purge job. No external email worker was established by this audit.

**Impact:** The internal record asserts delivery without evidence. Eligible unverified accounts can progress toward deletion without the notification promised by the field/event names.

**Qualification:** The current function skips verified users and users protected by retained canonical/Storage data. It also checks protection again before deletion. Claude's description of unrestricted impact therefore overstates the current scope.

**Recommendation:** Use a durable notification queue and record provider acceptance separately from attempted delivery. Until notification delivery is implemented and verified, explicitly choose a policy for eligible-account deletion rather than relying on these timestamps. Do not retroactively treat existing timestamps as proof of email receipt.

### A3 · P1 · Reports can claim a recent history refresh without downloading history

**Evidence:** `CoachApp.tsx:89` only uploads an existing queue and returns immediately when the queue is empty. `workflow.ts:218` advances `lastSyncAt` when an operation is acknowledged. That path does not fetch session history or the roster; after upload it only refreshes the exit code. `ReportsScreen.tsx:56` labels the same timestamp “History last refreshed.” CSV and printable reports repeat that label through `reports.ts`.

**Reproduction scenario from code:** Prepare device B; save attendance on device A; open Reports on B. Reopening or reconnecting B does not pull A's sessions. If B uploads one of its own changes, its report can display a fresh “History last refreshed” timestamp while still lacking A's data. This two-device scenario was not executed against production.

**Impact:** A coach can export incomplete history with an inaccurate freshness label. “All saved changes synced” describes the local outgoing queue, not agreement with the server.

**Recommendation:** Track successful upload and successful server snapshot refresh separately. Refresh server data on online startup/focus and provide a visible Reports refresh action, preserving queued edits. Label offline/local reports accurately. Verify with two devices, including pending changes and reconnects.

### A4 · P2 · Manual offline preparation blocks the primary task and creates misleading empty states

**Evidence:** Live Home showed disabled Start Practice and Start Optional Training until preparation. Roster still exposed its Add player form without a prepared snapshot. Reports showed zero totals and enabled export controls, alongside a smaller notice that server history had not been refreshed. Settings asserted “Default code 0000 active” when the PIN setting had not been loaded. These observations match `CoachApp.tsx:206-238` and `ReportsScreen.tsx:54-58`.

**Impact:** Initial device setup looks like a broken app; unloaded data resembles an empty roster or zero attendance. The default PIN statement can be wrong when a custom PIN exists on the server.

**Recommendation:** Automatically initialize and download data after sign-in. Show explicit loading/unavailable states until records arrive. Gate dependent forms and exports; represent an unloaded PIN as unknown. Keep the primary Home action focused on taking attendance. Confirm offline readiness only after durable writes and asset caching succeed.

### A5 · P2 · An app update with pending changes cannot be completed by the apparent refresh action

**Evidence:** `CoachApp.tsx:166` chooses `refreshKeepingQueue` when queued changes exist. `workflow.ts:25-40` deliberately preserves the old shell version/fingerprint and does not call `prepareShell`. Readiness still requires the new shell. The existing workflow test at line 122 explicitly demonstrates that the shell is prepared only after replaying the queue and calling preparation again.

**Impact:** After an update, a coach can press refresh successfully yet remain unable to start another session. A blocked/conflicting queue makes this particularly confusing. This is a workflow trap, not evidence that the queue is lost.

**Recommendation:** Either safely stage the new shell independently of pending attendance, or explain the exact blocker and guide the coach through recovery. Once synchronization completes, finish the required preparation automatically. Test this with an active session, several completed offline sessions, and a blocked operation; never clear pending work to force readiness.

### A6 · P2 · History provides no way to correct sessions beyond the first ten

**Evidence:** `CoachApp.tsx:234` renders completed sessions with `.slice(0, 10)`, with no search, pagination, or “Load more.” Correction is reachable through those cards. Reports' recent-session list is also limited to ten and supplies no correction link.

**Impact:** Records remain stored and can contribute to reports, but the eleventh and older completed sessions are inaccessible through the normal correction workflow. This becomes a routine problem after a few weeks of use.

**Recommendation:** Add searchable/paginated history with date and session-type filters and direct correction access. Verify at least eleven completed sessions, including backdated entries.

### A7 · P2 · Recovery screens expose implementation details instead of coach decisions

**Evidence:** `CoachApp.tsx:218` renders operation names, database errors, raw `JSON.stringify(op.payload)`, server revisions, and “Resend this change on current revision.” `workflow.ts:225` includes backend error codes in coach-facing text.

**Impact:** Recovery requires understanding the storage protocol. Coaches cannot readily tell which attendance mark is affected or what discarding dependent changes will remove.

**Recommendation:** Show the session date, player/team, requested change, current saved value, and affected-change count. Use plain actions such as “Keep my change” or “Use saved version” only when their actual semantics match. Keep technical details in an expandable support section. Preserve explicit review before discarding or overwriting intent.

### A8 · P2 · Navigation does not preserve location, and important controls lack state semantics

**Evidence:** `CoachApp.tsx:33` stores the page solely in React state, initialized to Home; navigation at line 214 does not update the URL. On the live site, Settings, Roster and Reports retain the same root URL. Selected navigation uses CSS without `aria-current`; report sorting buttons do not expose `aria-sort`. The New team name input relies on a placeholder rather than an explicit label.

**Impact:** Refresh loses the current page and report filters. Browser Back cannot traverse app pages. Assistive technology gets less information about the selected page and sort order.

**Recommendation:** Add URL-backed page navigation, preserve useful filters, mark the current page and sort state, and label the team input. Check keyboard navigation, focus after page changes, narrow-screen navigation, and iPad VoiceOver. No claim of a complete accessibility audit is made here.

### A9 · P2/P3 · Remaining security hardening and repository hygiene

The live Supabase security advisor reports one warning: leaked-password protection is disabled. Assess enabling it on an eligible plan; Supabase documents it as available on Pro and above. See [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The deployed admin function correctly authenticates callers, checks superuser membership, derives target email from coach ID, and implements restore-account. However, its `view-as-coach` branch still permits superuser targets and CORS remains wildcard. These are remaining privileged-access hardening items, not evidence that an ordinary coach can impersonate an admin. Remove an unused impersonation endpoint or explicitly protect privileged targets and audit its use. Restrict browser origins as defense in depth; CORS is not the authorization boundary.

React remains an optional peer dependency while runtime/type versions differ; the README and default development instructions are obsolete; scratch scripts, generated output, and Supabase temporary metadata are not excluded by the current `.gitignore`. Clean these up deliberately after dependency and usage review. A publishable key or project reference is not itself a secret, and making the repository private would not substitute for correct authorization.

## Disposition of Claude's 23 findings

| # | Claude finding | Current disposition |
|---|---|---|
| 01 | Coaches can read admin summary | **Fixed live.** Both anonymous and authenticated browser roles lack SELECT on the view. |
| 02 | Purge fails on NULL team name | **Fixed live.** Uses `Deleted team`; last three scheduled runs succeeded. This does not prove every purge branch ran. |
| 03 | Purge reminders never sent | **Still applicable, narrower impact.** See A2 and retained-data protections. |
| 04 | Public purge RPC; unsafe trigger search paths | **Purge RPC fixed live.** Anonymous/authenticated execution denied; empty search path. Legacy attendance tables/functions retired. No complete catalog-wide trigger audit claimed. |
| 05 | Cross-coach overwrite through restore_archive | **Obsolete for live release.** No public restore_archive function remains; old event tables are gone. |
| 06 | Edit-last-session deletes before restoring | **Obsolete coach path.** Current correction workflow queues `correct_v1` without deleting the session. |
| 07 | Offline queue stores only one session | **Replaced.** IndexedDB holds ordered operations and multiple sessions; the multi-session test passes. |
| 08 | Raffle reset deletes training history | **Replaced.** Current raffle uses round operations; it does not call legacy clearActiveEvents. |
| 09 | Raffle state leaks between coaches | **Replaced.** Preferences are in owner-scoped storage; draws are server records with owner RLS. Preferences remain device-local, a separate design choice. |
| 10 | Players identified by mutable names | **Replaced.** Stable IDs, saved session snapshots, retirement/restoration. |
| 11 | Admin trusts supplied target email | **Main defect fixed in deployed function.** Email derives from coachId. Superuser impersonation target protection and wildcard CORS remain hardening items. |
| 12 | No way to unsuspend | **Fixed in deployed function.** `restore-account` clears the ban. |
| 13 | Dependency/tooling inconsistencies | **Still applicable.** Current tests/typecheck pass; clean-install reliability and explicit dependency declarations still need cleanup. |
| 14 | Public scratch/config/build artifacts | **Still relevant repository hygiene.** Current repository visibility was not reverified. Publishable config alone is not a credential leak. |
| 15 | No tracked migration process | **Partially addressed.** Live Supabase has three recorded migrations; local `supabase/migrations` contains only the untracked dashboard migration. Reconcile an authoritative baseline/history. |
| 16 | Dead files/dependencies | **Cleanup candidate.** Legacy assets coexist with the new app. Prove non-use before deletion; do not delete every old component, since the restored admin uses some. |
| 17 | Stale README | **Confirmed.** Refers to obsolete setup/migrations, a missing env example, and a machine-local link. |
| 18 | No URL routing | **Still applicable in the replacement app.** See A8. |
| 19 | Old shell light-mode leaks | **Not established in the new coach shell.** The cited old App/theme code is not the current coach layout; admin styling needs its own check. |
| 20 | Wrong default for onboarding nudge | **Old implementation.** Current onboarding has different, more consequential gaps; see A4. |
| 21 | Raw database errors | **Still applicable through new code.** See A7. |
| 22 | Swipe listener hijacks horizontal scrolling | **Old implementation.** No equivalent swipe listener found in the current coach shell. |
| 23 | Misspelled browser title/native label | **Web release fixed.** Live title is “Kaizen Tracker · Coach Attendance.” Old index typo and Capacitor label remain in repository files. |

## Evidence and verification limits

- Read both PDF pages and rendered them for inspection. Its own scope excludes page-level accessibility/performance and acknowledges no live execution.
- Inspected live Home, Settings, Roster and Reports using the existing signed-in browser session. Did not prepare the account, enter attendance, change settings, draw a raffle, send mail, or trigger account actions.
- Retrieved the public release manifest and main bundle. Main asset: `/assets/release-CAZ9Zqa2.js`, 482,832 bytes, SHA-256 `3488b36acefdd94bc071aeb551c6fd13d8dc104b1317c289174556a4cbeffc72`. Worker: `stage6-shell-18`, byte-identical to local release worker. Bundle text supports the cited UI behaviors; a complete rebuilt-bundle equality check was not performed.
- Read live permission metadata, policies, purge definition, scheduler status, migration history, deployed admin function version 8, and security advisor. All 14 canonical tracker tables have RLS and owner-scoped SELECT policies; anonymous SELECT is denied. The admin view denies browser roles. This is targeted verification, not a penetration test or proof that every privileged RPC is defect-free.
- **80 focused tests passed:** 63 coach/admin-detail tests and 17 admin-handler tests. `tsc --noEmit` passed. Handler tests mock the SDK/runtime; they do not prove real email delivery or account-action behavior.
- Physical iPad airplane-mode, multi-device freshness, screen-reader behavior, network performance, and clean-install/release reproducibility were not rerun. Earlier device checks are historical evidence in the release checkpoint, not new results from this audit.

## Suggested implementation order

1. Capture the actual release in version control and reconcile migration history; retain recovery artifacts privately.
2. Correct purge notification claims/policy and report freshness semantics.
3. Automate initial download and offline preparation, with safe handling of pending work and upgrades.
4. Add complete searchable History, plain-language conflict recovery, and URL navigation.
5. Finish accessibility, dependency, documentation, and unused-code cleanup.

The acceptance target for the coach experience is simple: sign in, see loaded team data, start attendance, and receive an accurate “Saved” or “Saved on this device” status. Offline preparation should normally happen in the background; manual recovery should appear only when there is something the coach can meaningfully resolve.
