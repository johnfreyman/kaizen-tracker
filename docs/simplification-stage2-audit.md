# Stage 2 prototype audit

Audited: 2026-09-20. Source commit: `d54c587ed4bdb10d23122b8357ba849348da8278` on `claude/stage-2-prototype`.

**Revision status (2026-09-21):** all findings below (U01, F01–F05) have been addressed by the Stage 2 revision on `claude/dazzling-sagan-hxrwfp`. A same-day independent review of that revision then found two further gaps, R01 and R02 (see below); both are also addressed, on the same branch. See [the Stage 2 revision entry](simplification-progress.md#stage-2-revision--2026-09-21) and [the follow-up entry](simplification-progress.md#stage-2-revision-follow-up--r01r02--2026-09-21) in the progress document for the full change/verification record. This original audit's findings, evidence and limits are preserved unchanged below as the historical record of what was found; only status notes were appended.

## Verdict

The main coach/kiosk flow is a useful basis for the product. Keep the design direction, but complete a focused Stage 2 revision before treating its data/reporting behavior as the Stage 3 contract. This is a fixture-only prototype, not evidence of production reliability. This audit changes documentation only; it does not fix the findings or start another implementation stage.

The owner has now confirmed **multiple simultaneous sub-team memberships** and **one jersey number per player across every team** (D07–D08). The original single-membership assumption was labeled correctly when built, but is now superseded. Use one stable player, multiple memberships, one number, one attendance per session and one optional-training ticket per attendance.

*(2026-09-21: this verdict described the audited commit. The revision below implements it; Stage 3 still owns turning this into a real schema.)*

## Findings

All priorities below refer to correcting the prototype/next-stage contract; these are not newly shipped production regressions.

### F01 — P2: Historical team filtering uses current membership

Source: [ProgressScreen.tsx](../src/prototype/screens/ProgressScreen.tsx), lines 22–44.

**Browser reproduction:** in Roster, move fixture Alex M. from Blue 7th to Gray 7th. In Progress select Team at session, then Blue 7th: Alex disappears. Select Gray 7th: Alex appears with 8 hours even though the historical Group cell says Blue 7th / Unknown. The mode changes the group label but still filters by `player.subTeamId` and calculates all-time totals.

**Required correction:** in historical mode, filter attendance using session membership snapshots, then calculate totals from those qualifying records. Preserve unknown membership explicitly and retain access to retired groups/players' history. With multiple memberships, deduplicate player/session records in whole-program totals; make any overlapping team totals explicit. Test a transfer and a shared-team player with known expected sums, not only the presence of labels.

**Revision (2026-09-21):** Addressed. `historicalTeamRows(state, teamId)` in `store.tsx` filters to sessions whose own `teamAtSession` snapshot names that team and sums only those; a transfer (`updatePlayer`) cannot move past hours because old snapshots are never rewritten. Each row carries `otherTeams` for explicit overlap labelling ("also counted under …"). Retired sub-teams and "Unknown (legacy record)" stay reachable as their own groups. Verified with expected sums (not just labels) in `store.test.ts` and reproduced live: a transferred single-team player (Alex M.) keeps his old team's hours unchanged and gets only the new session under his new team; a simultaneous-membership player (Kayla) shows identical, full (non-split) hours under both of her teams in the browser walkthrough.

### F02 — P2: Editing bypasses the duplicate-card validation

Source: [RosterScreen.tsx](../src/prototype/screens/RosterScreen.tsx), lines 150–183; [store.tsx](../src/prototype/store.tsx), `updatePlayer`.

**Browser reproduction:** edit Alex M.'s label to R., matching the other Alex #12, then click Done. The screen warns that two cards are identical, but commits the change anyway; it remains after refresh. Inline editing writes each keystroke directly to the store. Blank names are also allowed by that path (source inspection).

**Required correction:** draft edits with explicit Save/Cancel and the same trimmed-name/card-distinction validation as Add. Block ambiguous or empty committed identities while preserving the existing valid card. Multi-team badges should help recognition, but must not be used as mutable identity keys or to excuse identical player cards. Test add and edit paths, including refresh after a rejected edit.

**Revision (2026-09-21):** Addressed. `PlayerRow` now edits a local draft (re-synced on entering edit mode) and only calls `updatePlayer` from Save; a blank name or a collision (via the shared `wouldCollide` helper Add already used) disables Save and shows an inline reason instead of writing anything. Cancel discards the draft. Verified in `store.test.ts` (`playerEditIsValid`/`wouldCollide` cases) and live: renaming Alex M.'s label to collide with Alex R. shows the error and a disabled Save, and a page refresh after that rejected attempt still shows exactly one "Alex R." card.

### F03 — P2: The new-coach fixture defaults raffle to off

Source: [fixtures.ts](../src/prototype/fixtures.ts), lines 193–213.

**Browser reproduction:** select Empty roster in Walkthrough controls, then Settings: Raffle is off. That scenario is explicitly described as a new coach, but inherits `raffleEnabled: false` from the common fixture base. It does not demonstrate R10/A17.

**Required correction:** a genuinely new-coach fixture starts enabled. Retain a separate existing-coach/off fixture for testing accrued-ticket activation and preservation of explicit old settings. Test both rather than changing every scenario to on.

**Revision (2026-09-21):** Addressed. The `"empty"` (new-coach) scenario now overrides `raffleEnabled: true`; the `"team"` (existing-coach) scenario keeps the shared `false` default with its accrued tickets, so the Keep/Start-fresh dialog still has a real count to test. Verified in `store.test.ts` and live: Settings shows "Raffle is on" immediately after switching to Empty roster, and the "team" scenario still opens on "Raffle is off" with tickets accrued.

### F04 — P2: A closed-session kiosk has no coach escape

Source: [KioskScreen.tsx](../src/prototype/screens/KioskScreen.tsx), lines 36–50; [PrototypeApp.tsx](../src/prototype/PrototypeApp.tsx), kiosk binding restoration.

**Source-confirmed:** `closedElsewhere` returns only a notice before rendering the number pad or exit handler. The kiosk binding survives refresh. If the bound session closes, the coach cannot enter the code to recover, and normal coach navigation is intentionally absent. This closed-kiosk transition was not independently reproduced through the current walkthrough controls; they disappear inside kiosk.

**Required correction:** keep check-in disabled but offer a code-protected coach exit/reconciliation route from the closed-session state. Do not automatically reveal the coach dashboard to players. Add a fixture/test that reaches closure while kiosk is active, verifies refresh remains closed, and verifies coach recovery.

**Revision (2026-09-21):** Addressed. `KioskScreen` now renders a dedicated `ClosedKiosk` view once `closedElsewhere` is true: a code pad and **Coach exit** button, with no player lookup at all (check-in was already rejected server-side; the UI now matches). The correct code reuses the same `onExit` handoff into `AttendanceScreen`'s existing conflict panel, whose "Back to Home" now also clears the stale session (`acknowledgeClosedElsewhere`, new) so Home does not keep offering to resume it. Because the walkthrough panel is hidden while kiosk owns the screen, a small labelled dev-only trigger was added inside `KioskScreen` itself to reach closure while kiosk is active. Browser-verified end to end: enter kiosk → force closure → player pad is gone, code pad appears → refresh → still closed → wrong code rejected → correct code lands on the coach conflict panel → Back to Home offers a clean Start again.

### F05 — P2: Ticket derivation conflates initial migration eligibility with later archive status

Source: [store.tsx](../src/prototype/store.tsx), lines 406–415.

**Source-confirmed:** `ticketLines` excludes every archived training regardless of its immutable round. D03 excludes archived history when seeding the *first* current pool; P10/A14 then require archive/restore to preserve that round's eligibility. Reusing this helper for future archive behavior would remove a current-round ticket when its session is archived and revive it on restore. There is no archive action in this prototype, so this is a contract/helper defect, not a claimed browser reproduction.

**Required correction:** assign migrated archived fixtures to non-current rounds; derive current eligibility from round assignment and attendance, not a perpetual archive exclusion. Include a current-round archived fixture and demonstrate unchanged ticket count on archive/restore. Keep old archived fixtures out of the initial current pool.

**Revision (2026-09-21):** Addressed. `ticketLines` no longer checks `archived` at all; eligibility is `roundId === currentRoundId` alone. `ev-02` (old archived history) still sits outside the current pool, now because it is bound to the previous round rather than because it is archived. A new fixture, `ev-07`, is archived *and* in the current round, so the distinction is demonstrable: RaffleScreen shows it as "still counted in this round," separately from earlier-round archived trainings. `store.test.ts` asserts the ticket count for `ev-07` is identical whether its `archived` flag is `true` or `false` (the archive/restore regression fixture), and that un-archiving `ev-02` still does not add it to the current pool.

## Approved scope update U01 — multiple teams, one player number

Source: [types.ts](../src/prototype/types.ts), `Player.subTeamId` and scalar `teamAtSession`; corresponding roster, attendance, kiosk, settings counts and Progress consumers.

Replace scalar membership with a membership set/list in the prototype and a many-to-many contract for Stage 3. Keep jersey number on the player. Add fixtures where one player belongs to Blue 6th and Blue 7th. Show them once in All teams/kiosk, in either matching team filter, and preserve their other membership when one is removed. One training must yield one attendance, 1.5 hours and one ticket, even when filtering between both teams. Historical snapshots contain membership sets and survive later edits.

**Revision (2026-09-21):** Addressed in the prototype (the many-to-many *contract* is Stage 3's own item, not restated as done here). `Player.subTeamId` is now `Player.subTeamIds: string[]`; `FinalizedSession.teamAtSession` is now `Record<string, string[]>`. Kayla (`pl-11`, `#12`) belongs to Blue 6th and Blue 7th simultaneously. Verified: she appears once under "All teams," is found under either team's filter, and her two current-round trainings each yield exactly one ticket (`store.test.ts`); removing one membership via edit leaves the other and all past history untouched.

## Verification performed independently

The audit traced the local UI → fixture reducer → namespaced browser persistence → displayed state. There is no application API/database boundary in this prototype to verify.

- `tsc --noEmit`: passed.
- `vite build` to `/private/tmp/kaizen-prototype-audit-build`: passed. Only the normal app HTML/assets were emitted; no prototype entry. Generated CSS `index-DZ3ExIO7.css` and JS `index-B6EMAJLU.js` match the filenames/hashes reported in Stage 2. No separate baseline rebuild was performed in this audit.
- Existing test suite: 15 passed, 1 failed of 16 collected. The LaunchPage time-preset failure remains; `stats.test.ts` separately fails collection because `VITE_SUPABASE_URL` is missing. No app tests were changed. Report: `/private/tmp/kaizen-prototype-audit-tests.json`.
- Browser: direct practice start, manual attendance, hidden selected-player warning, attendance refresh/resume, native keyboard backdating and refresh, and displayed 1.5-hour credit passed.
- Kiosk: shared #12 lookup returned three cards; existing check-in state, undo, refresh retaining kiosk, #0 versus #00 lookup and default 0000 exit passed.
- Raffle: Start fresh changed the fixture pool from 9 to 0 while Alex M. retained 8 credited hours. This verifies the fixture reset example, not historical winner preservation (the prototype has no draw history model).
- Simulated offline finish retained one mark and the backdated date; returning the fixture switch to Online and Retry sync finalized the training, changing Alex M. from 8 to 9.5 hours and from 0 to 1 current-round ticket. This is a simulation, not a real offline/network guarantee.
- Reproduced F01, F02 and F03 through the UI. F04/F05 are source findings with their limits stated above.
- Phone attendance at 430×932 and tablet Progress at 1024×768 had no page-level horizontal overflow. Captured browser warning/error logs were empty for the exercised paths. Temporary viewport override was reset.
- Confirmed the prototype branch did not modify `src/app/`, Supabase functions, migrations, package files or the normal app entry relative to the reconciled plan. Production access/deployment was not used.

## Revision re-verification — 2026-09-21

Performed by the same session that implemented the revision (source: `claude/dazzling-sagan-hxrwfp`, based on the audited head at `adcc727`), not a separate independent auditor — treat this as a documented self-check, not a repeat of the independent-audit posture above.

- `tsc --noEmit`: 0 errors.
- `vitest run`: 31 passed, 1 failed of 32 collected across 5 files. The new `src/prototype/store.test.ts` (16 tests covering U01, F01, F02, F03, F05 with expected totals) all pass. The 1 failure and the 1 collection-blocked file are the same pre-existing `LaunchPage`/`stats.test.ts` baseline issues noted throughout this project — not new regressions.
- `vite build` to a temporary directory: `index-DZ3ExIO7.css` byte-identical to the hash recorded above and in Stage 2. The JS hash changed by ~30 bytes, solely from one `forwardRef` line added to `src/app/components/ui/dialog.tsx` (see below) — no prototype code reaches the bundle.
- Browser (headless Chromium, phone 430×932 and tablet 1024×768): 36 scripted checks, all passing, specifically including the F01–F05 and U01 scenarios described in each finding's Revision note above, plus the persistence-failure banner and the activation dialog's Escape/focus-trap/focus-return behavior. No unexpected console/page errors; one pre-existing, environment-only failure (an external Google Fonts fetch in `prototype.html`, already present before this revision, unrelated to any code change) was identified and excluded.
- Two additional defects were found and fixed while wiring the accessible dialog, beyond F01–F05: `BigButton` (`src/prototype/components/ui.tsx`) did not forward its ref, so `<DialogTrigger asChild>` could not attach Radix's focus-return target — a reproducible `console.error`, not a style nit. The same gap existed in the shared `DialogOverlay` (`src/app/components/ui/dialog.tsx`), which is the one change to `src/app/` in this revision: a mechanical, behavior-preserving `forwardRef` wrap, made because the handoff explicitly asked to reuse this primitive and reusing it surfaced the defect for every consumer of `Dialog`, not only this prototype.

## Independent revision review — 2026-09-21

A second pass reviewed the Stage 2 revision above and found two further gaps before treating it as closed. Both were addressed on the same branch immediately after, source commit `92eb4df` (this review's own starting point).

### R01 — P2: Historical "All teams" silently dropped retired attendees; retiring every sub-team hid the historical controls entirely

Source: [ProgressScreen.tsx](../src/prototype/screens/ProgressScreen.tsx), `historicalAllRows` (sourced from the active-only `roster`, not `state.players`) and the `activeTeams.length > 0` gate around the whole Attribute-to/Team panel.

**Finding:** `historicalAllRows` mapped over `roster` — `state.players.filter(p => !p.retired)` — so a retired player's entire attendance history vanished from "Team at session > All teams," not just from the current roster. Separately, the whole "Attribute to"/"Team" panel, including the "Team at session" toggle itself, was gated on `activeTeams.length > 0`; retiring every sub-team removed the panel along with it, so a coach could no longer reach the historical view that explains who used to play for a now-retired team. F01's fix (`historicalTeamRows`) already correctly included retired players once a *specific* team was selected — only the unfiltered "All teams" case and the panel's own visibility were wrong.

**Required correction:** source "Team at session > All teams" from every player who has ever attended, including retired ones, labelled as such; preserve current-roster mode's existing exclusion of retired players unchanged. Gate the historical controls on whether any sub-team was ever created (`state.subTeams.length > 0`), not on whether one is still active, so retiring every team cannot strand a coach without the "Team at session" toggle or a way to select a specific (now-retired) team's history.

**Follow-up (2026-09-21):** Addressed. `historicalAllRows` now sources from `state.players`, and each row carries `retired`, rendered as a "Retired" pill. The panel gate changed from `activeTeams.length > 0` to `state.subTeams.length > 0`; `teamFilterOptions` already listed retired teams by id and needed no change. Verified with committed component tests (`ProgressScreen.test.tsx`, rendering the real screen against a `PrototypeStoreProvider`, not just calling `historicalTeamRows` directly) and live: retiring Alex M. drops him from Current roster and the roster count, but he reappears labelled Retired under Team at session > All teams with his history intact and program-wide totals unchanged; retiring all four sub-teams still surfaces the "Team at session" toggle and a "(retired)" team chip that renders real historical rows.

### R02 — P2: Kiosk never exposed a local-save failure, and check-in/undo feedback stayed unqualified even while one was active

Source: [KioskScreen.tsx](../src/prototype/screens/KioskScreen.tsx) — the Stage 2 revision's `PersistenceFailureBanner` lives in `PrototypeApp.tsx`'s `Shell`, which kiosk fully bypasses (`Shell` returns only `<KioskScreen>` while kiosk owns the screen).

**Finding:** The revision's own local-persistence-failure fix (`state.localPersistenceFailed`, the Shell banner, the qualified `AttendanceScreen` delivery pill) never reached kiosk, because kiosk is a standalone render tree outside the Shell that carries that banner. A check-in or undo during an active local-save failure still showed the plain "You're checked in" / "Check-in undone" confirmation — the same unqualified-success problem the revision fixed for the coach's own attendance screen, left unfixed for the player-facing surface where a missed save is a missed credit.

**Required correction:** expose the local-save failure inside kiosk itself, and stop showing an unqualified success confirmation for check-in/undo while it is active — without adding any coach-navigation affordance beyond the existing exit code, and without needing the real offline/outbox backend yet.

**Follow-up (2026-09-21):** Addressed. Kiosk now shows its own failure banner (plain text, no links) whenever `state.localPersistenceFailed` is true, and the confirmation panel switches to "Checked in — not saved yet" / "Undo recorded — not saved yet" with a warning tone and an explanatory line, reverting to the normal confirmation once storage recovers. Verified with committed component tests (`KioskScreen.test.tsx`, using a test-only harness that drives the same `setSimulateStorageFailure` action the coach-facing dev toggle uses, since kiosk deliberately cannot reach that toggle itself) covering the healthy state, the failing state for both check-in and undo, live recovery within one render, and that no navigation/settings/roster affordance appears alongside the banner. Browser-verified the same sequence end to end, including exiting and re-entering kiosk around the recovery step.

## Limits and follow-through

- ~~Local persistence failures are swallowed in `store.tsx`…~~ **Addressed (2026-09-21), extended (2026-09-21):** `trySave` reports success/failure into `state.localPersistenceFailed`; a banner replaces the false "Saved on this device" claim, and a dev toggle simulates the failure deterministically. The first pass only reached the coach-facing Shell and AttendanceScreen — R02 (independent revision review, same day) found kiosk was still claiming unqualified success while failing, since it renders outside the Shell entirely; that gap is now closed too. Stage 4 still owns proving *real* recovery (quota/private-browsing behavior across actual browsers) — this remains a fixture-level demonstration.
- PIN replacement, backdated-training round assignment, pending-finish policy, retirement, session targeting and overlapping-team attribution remain recommendations unless separately confirmed. “On the right track” is not blanket approval of every data policy. **Still true after the revision** — see the "Open decisions carried forward" table in the progress document; none of these were resolved by this pass.
- ~~The previous 63 browser checks were reported by Claude but no corresponding test file appears in the branch diff.~~ **Addressed (2026-09-21):** `src/prototype/store.test.ts` now commits 16 focused regressions for the revised membership/filtering/validation/raffle-default/archive behaviors, with expected totals a reviewer can re-run (`npx vitest run`).
- ~~Reuse accessible dialog primitives for the activation dialog before shipping…~~ **Addressed (2026-09-21):** the dialog is now built on `@/app/components/ui/dialog` with a real `DialogTrigger`; Escape dismissal, focus trapping and focus return to the trigger were all browser-verified (see above). Full screen-reader/device testing is still not performed.
- No real database, RLS, auth, service worker, real network outage, custom-PIN flow or full six-journey regression was claimed by this audit. Backend security and migration checks belong to subsequent isolated stages. **Still true** — this revision remains fixture-only, same as the original prototype.

## Recommended next steps

1. ~~**Stage 2 revision — Claude Sonnet, High thinking:** implement U01 and F01–F05 in the fixture prototype, add focused repeatable tests and update the walkthrough. Do not start database work.~~ **Done (2026-09-21)** — see "Revision (2026-09-21)" under each finding above and the Stage 2 revision entry in the progress document.
2. ~~Independent revision review: R01/R02 above.~~ **Done (2026-09-21)** — see "Independent revision review" above and the follow-up entry in the progress document. Fixture-only scope was kept; no schema, Supabase, migration, production, deploy, merge or PR work.
3. Review the revised multiple-membership flows and explicitly resolve remaining data policies before the affected Stage 3 operations are finalized. Unresolved policies may remain documented gaps; do not silently cement them as defaults because a prototype used them. **Still open** — none of the "Open decisions carried forward" table's items were resolved by this revision or its follow-up.
4. **Stage 3 — Claude Opus 5, High thinking:** isolated additive data foundation and migration rehearsal, with stable player IDs, player-owned jersey numbers, many-to-many membership, membership snapshots and idempotent attendance/round operations. No production changes. **Not started.**

The exact next-task prompt is in [simplification-progress.md](simplification-progress.md#exact-next-stage-handoff).
