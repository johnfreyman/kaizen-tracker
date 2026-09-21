# Kaizen Tracker simplification progress

Updated: 2026-09-21.

Specification: [simplification-spec.md](simplification-spec.md).
Baseline application commit: `40d9b0c2f57692cdc8439d453816418be3db5a39`.

## Scope and current status

Stage 1 documentation is complete. The initial Stage 2 prototype was implemented, independently audited, and revised to address the audit: multiple simultaneous sub-team memberships (U01) and audit findings F01–F05 are implemented and verified. A same-day independent review of that revision found two further gaps, R01 and R02, which are also now addressed. See [the audit](simplification-stage2-audit.md) for the original findings and all revision statuses. D01–D09 are confirmed, including offline gym use; the remaining recommendations (P01–P12 and the open decisions below) are still not blanket-approved by this work. Stage 3 has not started — see the handoff at the bottom of this document.

Canonical continuation branch: `codex/simplification-plan` in `johnfreyman/kaizen-tracker`. Stage 2 work continues on `claude/stage-2-prototype`, branched from that head; this revision was implemented on `claude/dazzling-sagan-hxrwfp`, branched from the `claude/stage-2-prototype` head that includes the audit (commit `adcc727`). Use these documents from the newer branch, not the unchanged `main` checkout or the superseded seven-stage draft.

Published review: [draft PR #1](https://github.com/johnfreyman/kaizen-tracker/pull/1). It remains unmerged. The initial reconciliation commit is `428d59a274965c172324958f3f8fa2b407f9880b`; use the latest branch head for subsequent handoffs.

| Stage | State | Deliverable / next gate |
| --- | --- | --- |
| 1. Product specification and migration plan | Complete | Source audit, approved requirements/decisions, recommendations, flows, data invariants, acceptance matrix and recovery plan documented. |
| 2. Screen flows and prototype | Revision + follow-up complete | Multiple memberships (U01), audit F01–F05, and follow-up review findings R01–R02 implemented, with committed tests and browser walkthroughs. Product recommendations (P01–P12) and the open decisions below remain for Stage 3 review. |
| 3. Data foundation | Not started | Resolve data-affecting choices including sub-team membership, inspect real schema in an isolated environment, rehearse additive migration. |
| 4. Coach attendance | Not started | Reliable session/attendance operations and simplified cards. |
| 5. Kiosk | Not started | Number matching, correction, exit and recovery. |
| 6. Raffle and analytics | Not started | Independent rounds and preservation of effort totals. |
| 7. Review and testing | Not started | Full acceptance and migration/recovery rehearsal. |
| 8. Production release | Not started | Separate release authorization and production validation. |

## Changes made in Stage 1

- Created `docs/simplification-spec.md` with R01–R12 approved requirements, D01–D03 confirmed decisions, P01–P11 recommendations and A01–A22 acceptance criteria.
- Documented existing name-keyed attendance, hour-valued durations, unwired draft helpers, a single pending-save slot, non-idempotent legacy save, destructive raffle reset/player removal, local-only winner history and secured admin backend.
- Defined proposed stable identity, explicit attendance writes, session lifecycle, coach-scoped recovery, independent raffle rounds and metric meanings.
- Planned additive backfill, ambiguous legacy mapping, older-client compatibility, release gates and data-preserving recovery.
- Preserved the pre-existing `.DS_Store` change. No app source, migration, dependency, environment or production modification.

## Verification record

- Read repository and ancestor instruction locations; no applicable `AGENTS.md` found.
- Traced relevant TypeScript and SQL paths; checked draft helper call sites and the actual raffle reset implementation rather than relying on old brief claims.
- Local baseline test run: `npm test -- --run --reporter=json --outputFile=/private/tmp/kaizen-stage1-tests.json` (console output in `/private/tmp/kaizen-stage1-tests.log`). Exit 1: 15 tests passed and 1 failed among 16 collected tests. The passing files were the store hooks (7 tests) and admin backend (8 tests). The LaunchPage preset test could not find `9:00 AM`. Separately, `src/lib/stats.test.ts` failed to load because `VITE_SUPABASE_URL` was missing, so its tests were not collected. These are baseline failures with application code unchanged; this was not a clean full-suite pass.
- Initial Stage 1 documentation checks passed: relative links, balanced fences, whitespace, unique IDs and documentation-only scope. See the reconciliation record below for the revised counts and publication guard.
- Production, browser and migration tests: not run; out of scope for this documentation stage.

## Confirmed owner decisions

Owner responses received during Stage 1 on 2026-09-19:

1. **D01:** default kiosk exit code `0000`, with an option for the coach to set a PIN.
2. **D02:** keep jersey numbers `0` and `00` distinct.
3. **D03:** seed the first current raffle pool from current, unarchived trainings only.

P01–P11 and detailed PIN behavior are recommendations for the Stage 2 walkthrough. Particularly review finalized-session credit, reset with no pending session, guest eligibility, non-consuming draws, player retirement and archive independence before implementing dependent data rules.

Additional owner decisions on 2026-09-20:

4. **D04:** retain a low-prominence date option for backdated paper attendance.
5. **D05:** store new credit as `1.5` hours.
6. **D06:** store team membership, allow Settings-managed sub-teams and offer roster assignment plus team sorting/filtering; default grouping can be Kaizen.

Additional owner decisions during the prototype audit:

7. **D07:** players can belong to multiple sub-teams simultaneously. Keep one stable player identity and do not duplicate attendance, hours or tickets across memberships.
8. **D08:** each player uses one jersey number across all teams; the number belongs to the player, not to a membership.

P12 still contains proposed reporting/attribution policies. Membership cardinality and jersey placement are now resolved; update the single-membership prototype rather than treating its old assumption as the data contract.

## Reconciliation of Claude's plan — 2026-09-20

### What happened and what was checked

- The original local Stage 1 documents were untracked and never pushed. Claude therefore correctly found neither file in its fresh `main` checkout; the missing handoff was a publication gap, not evidence the prior planning had not occurred.
- GitHub comparison confirmed `claude/inspiring-knuth-eovah7` is exactly one commit ahead of baseline: `6486e646361d11b1f9831c93f532a7bb090adaa6`, adding only the two planning documents. No app or migration files changed in that commit. There was no existing PR at inspection.
- `seating-charts` retains its own Git remote. Its local checkout had unrelated untracked `Freyman-Family-History/` and `PRINT-ALL-SPEC.md`; these were left untouched. The remote main tree contained no Kaizen/simplification path or `.gitmodules`, and the branch list contained no `claude/inspiring-knuth-eovah7`. Its latest main commit was dated 2026-09-12. These checks found no seating-chart repository contamination from this work; they do not inspect Claude's private session filesystem or attachments.
- Claude's reported `/home/user/kaizen-tracker` is in its environment, not this Mac. Attaching/cloning an existing repository does not itself create another GitHub repository. No repository or clone needs deletion based on the verified changes. Claude session attachments cannot be changed through the available repository tools.

### Reconciled decisions

- Retain the original eight-stage numbering. Stage 1 planning is complete; Stage 2 is the isolated interactive prototype. Claude's fixed-credit stage maps into our Stage 4, not a new Stage 1.
- Incorporate approved D04–D06 throughout flows, data planning, acceptance checks and handoff. Multi/sub-team support is no longer a non-goal.
- Keep the stable-ID design recommendation. The existing roster already has UUIDs; the store drops them. Deriving identity from mutable display strings risks broken history after a rename/number change and cannot safely distinguish players across teams. Additive mapping preserves legacy records instead of rewriting history blindly.
- Keep the durable owner-scoped queue and server idempotency/revision plan. Existing draft helpers use one global slot and silently ignore storage failures; wiring them alone does not satisfy reliable account isolation, retries or interrupted saves.
- Keep immutable raffle-round membership. A date-based `raffle_epoch` alone does not specify late-entered attendance, backdating, edits, archive restores or delayed retries. Preserve these behaviors explicitly; do not copy the cutoff proposal without resolving them.
- Retain current-trainings-only initial eligibility, default `0000` plus custom PIN, and distinct `0`/`00`, which Claude's draft did not fully carry forward.
- Keep the real-schema check before migration implementation. Stage 2 fixtures need no production access or live database. Stages 3–7 require an isolated database for migration/RLS/recovery verification.

### Validation and publication

- Reviewed both Claude documents and the exact two-file remote diff, plus current roster schema, draft helpers, store operations and the dated LaunchPage test fixture.
- Claude reported 19 passed / 1 failed with placeholder environment variables; this is its environment's result, not a replacement for our recorded 15 passed / 1 failed plus stats collection failure. Source confirms the fixed May fixture and time-dependent preset logic; do not treat those test counts as contradictory or delete unrelated tests simply to make the suite green.
- No application code, SQL, dependency or production changes in this reconciliation. Added `vercel.json` to disable Git-triggered deployments for **only** `codex/simplification-plan`, allowing the handoff to be published without deploying. This uses [Vercel's branch-specific configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled). It does not alter the production branch or live project settings.
- Publish the reconciled documents on the continuation branch with Claude's original commit retained as an ancestor. Keep the draft PR unmerged; Stage 8 remains the release gate. Do not delete Claude's branch or unrelated files.
- Revised documentation checks passed: links resolve, fences balance, no trailing whitespace, and all 14 requirements, 6 confirmed decisions, 12 proposals and 25 acceptance criteria have unique entries. The Vercel JSON parses and disables only the exact continuation branch. No `.github` workflow directory was present in this checkout. Application tests were not repeated for planning/configuration-only edits; baseline results remain above.
- Created the continuation branch from Claude's exact commit; both original documents remain recoverable in Git history. Publication is a draft PR against unchanged `main`, not a merge or production release. Verify the PR head and the branch's no-deploy guard before continuing work in another environment.
- Post-publication inspection confirmed PR #1 is open/draft and contains exactly the two documents and `vercel.json`; `main` remains at `40d9b0c2f57692cdc8439d453816418be3db5a39`. The only remaining unrelated local modification is `.DS_Store`. No deployment was requested.

## Stage 2 — isolated prototype — 2026-09-20

Branch `claude/stage-2-prototype`, based on `codex/simplification-plan` at `fb10fec69fcf3a2d18a6095dbda9144bb8f9f54a`. The branch-specific no-deploy rule in `vercel.json` was extended to this exact branch before any push; the production branch and the live project settings were not changed.

### Files changed

| File | Purpose |
| --- | --- |
| `prototype.html` | Dev-only entry. Vite serves it at `/prototype.html`; `index.html` remains the only rollup input, so the page is never emitted into `dist/`. |
| `src/prototype/types.ts` | Logical types mirroring spec §6. Local to the prototype; not a schema commitment. |
| `src/prototype/fixtures.ts` | Invented roster, sub-teams and finalized history. No production or real-team data. |
| `src/prototype/store.tsx` | In-memory reducer plus one namespaced `localStorage` key. No Supabase client, no fetch, no RPC. |
| `src/prototype/PrototypeApp.tsx` | Shell, screen switching, kiosk takeover and the dev walkthrough panel. |
| `src/prototype/components/ui.tsx` | Panel/button/pill helpers built on the existing Mission Control tokens. |
| `src/prototype/screens/*.tsx` | Home, Attendance, Kiosk, Roster, Settings, Progress, Raffle. |
| `src/prototype/prototype.css` | The prototype's own Tailwind entry. |
| `src/styles/tailwind.css` | Adds `@source not '../prototype/**'` so prototype utilities stay out of the production stylesheet. |
| `vercel.json` | Adds `claude/stage-2-prototype: false` alongside the existing rule. |

No file under `src/app/`, `supabase/`, `migrations/` or `dist/` was modified. `package.json` and `package-lock.json` are unchanged. The pre-existing `.DS_Store` entry was left alone.

### What the prototype demonstrates

- **Home:** Start Practice and Start Optional Training as the only start actions, a resume state that new starts cannot overwrite, and a waiting-to-sync panel with Retry sync. No elapsed time, countdown, start/end time or duration control appears anywhere.
- **Attendance:** large tappable cards with explicit present/absent writes, a secondary **Change date** beside the date, and **Finish & Save Attendance** with a zero-attendee confirmation. Changing the date preserves every mark and the 1.5-hour credit.
- **Kiosk:** number pad, `Find player` submit only, all matching cards with team labels, a required tap even on a single match, undo on a checked-in card, and both exit paths. It suppresses coach navigation entirely and restores itself after a refresh while its bound session is active.
- **Roster:** first-name/label/number setup, collision detection on the rendered card, one sub-team per player, transfer, and retirement copy that states history and tickets are kept.
- **Settings:** add/rename/retire sub-teams, PIN replacement for the default exit code, and the raffle activation dialog with real fixture counts.
- **Progress:** credited hours with practices and trainings counted separately, session-hours labelled distinctly from player-hours, and **Current roster** versus **Team at session** attribution with an explicit unknown group for legacy records.
- **Edge states:** empty roster, incomplete legacy roster, no number match, pending save, failed save and session-finished-elsewhere, all reachable from a dev-only walkthrough panel that is not a product surface.

### Findings

1. **The prototype would have changed the production stylesheet.** Sharing the app's Tailwind source scan added 3.31 kB of unused CSS to the production bundle even though no prototype code was imported. Excluding `src/prototype` from that scan and giving the prototype its own stylesheet restored a byte-identical build. Any future dev-only surface in `src/` needs the same treatment.
2. **There is no router, so "an isolated route" had to be an isolated entry.** `src/app/App.tsx` keeps page selection in memory. A second HTML entry keeps the prototype out of the working app *and* out of `vite build` without touching either. The consequence for Stage 5: in-memory page state cannot restore kiosk mode after a refresh by itself — the prototype had to persist the session binding and re-enter the kiosk on mount. Decide in Stage 5 whether the kiosk gets a real URL instead.
3. **The four-digit exit code is safe only because jersey numbers are capped at three characters.** That cap is currently a recommendation, not a stored constraint. If Stage 3 permits a four-digit number, a jersey lookup and the kiosk exit become ambiguous. Recommend Stage 3 make the 1–3 character rule an actual constraint.
4. **Collision detection must compare the rendered card, not the name.** Two Alexes both wearing #12 are distinguishable as soon as *one* of them carries a label; they collide only when neither does. Sharing a number alone, or a first name alone, is never a collision. The prototype flags existing identical cards and disables **Add to roster** while a new card would be identical.
5. **A team filter needs an explicit hidden-selection message.** Filtering to one sub-team otherwise shows a present count that looks wrong for the visible cards. The prototype keeps hidden marks, reports the overall count, and names how many marked players the filter is hiding. Recommend Stage 4 keep this.
6. **The unknown group is not hypothetical.** The fixture's oldest practice carries no membership snapshot, so under **Team at session** it lands in *Unknown (legacy record)* rather than being attributed to anyone's current sub-team. This is the behavior spec §7 asks for, and it is visible in the walkthrough.

### Verification — exactly what was run

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 15 passed, 1 failed of 16 collected, across 4 files (2 failing files). Identical to the recorded baseline: the `LaunchPage` preset test cannot find `9:00 AM`, and `src/lib/stats.test.ts` still fails to load because `VITE_SUPABASE_URL` is missing. **Neither is a regression from Stage 2**, and no existing test was altered or deleted to make the suite green.
- `npx vite build` into a temporary output directory (so the tracked `dist/` was never overwritten): emitted `index-DZ3ExIO7.css` (215.60 kB) and `index-B6EMAJLU.js` (1,239.80 kB) — the same filenames, content hashes and sizes as a build of this branch before the Stage 2 commit. The production bundle is byte-identical.
- Browser walkthrough: headless Chromium via Playwright against `vite` on `localhost:5199`, at a 430×932 phone viewport and a 1024×768 tablet viewport. **63 scripted checks, all passing.** They cover the six required journeys (start and mark one player; enter the kiosk for a training; undo a mistaken check-in; enable the raffle with accrued tickets; enter backdated paper attendance; add, assign and filter sub-teams without losing selections) plus: refresh recovery of marks, absence of any time or duration input, `#12` matching three players across three sub-teams, `0` and `00` resolving to different people, the no-match message, exit with the default `0000`, `0000` ceasing to work once a PIN is set, exit with the custom PIN, the Keep/Start fresh/Cancel dialog against the real fixture count of 9, Cancel changing nothing, Start fresh producing a zero-ticket round while credited hours stay at 8 for the fixture's most-attended player, the archived training staying out of the pool, pending and failed save states retaining marks, the session-finished-elsewhere conflict, the empty and legacy rosters, the default-Kaizen scenario, the R03 collision and add-player block, no uncaught JavaScript errors, and no horizontal scroll at tablet width.
- **Not tested, and not claimed:** production, any database, RLS or authorization behavior, migrations, real offline or service-worker behavior, screen-reader output, and real iOS/Android devices. The prototype has no backend, so it demonstrates intended behavior only — it does not establish the reliability guarantees in spec §5.

### Open decisions and owner review points

Review these during the walkthrough. None of them is settled by the prototype showing one behavior.

| # | Question | Blocks |
| --- | --- | --- |
| 1 | **Resolved by D07–D08:** multiple simultaneous memberships, one player-wide jersey number. Initial prototype uses one membership; revise it. | Stage 2 revision; Stage 3 uses many-to-many membership. |
| 2 | Should a coach-set PIN **replace** `0000`, or should `0000` keep working as a fallback? The prototype replaces it. | Stage 3 coach setting, Stage 5 exit. |
| 3 | Should a backdated optional training join the **current** round (P08), or the round that was open on the date entered? The prototype uses the current round. | Stage 3 round assignment. |
| 4 | **Resolved by D09:** a durably queued offline finish must NOT block the next session. The prototype's blocking behavior is superseded. | Stage 3 queue contract; Stage 4 implementation. |
| 5 | Is **retirement** the right replacement for today's destructive player removal (P07)? | Stage 3 removal path. |
| 6 | Should the kiosk have its own URL rather than in-memory state? See finding 2. | Stage 5. |
| 7 | Should sessions be able to **target** one sub-team, which would change attendance-rate denominators? Not approved by the request to sort by team, and not prototyped. | Stage 6 reporting. |

### Smaller notes for the walkthrough

- On a narrow phone, a sub-team row in Settings wraps its Retire button onto its own line. Cosmetic; left as-is rather than churning the layout before the owner sees it.
- Guest exclusion from regular-roster percentages and streaks is not re-implemented in the prototype; the existing `src/lib/stats.ts` behavior is preserved and migrates to stable ids in Stage 6.
- Drawing a winner is Stage 6 work and is deliberately absent. The Raffle screen shows the eligible pool only.

## Existing issues and limitations

- Current reset deletes optional-training records; player removal scrubs attendance. Do not carry these implementations into the new reset/removal flow.
- Existing SQL and client date formats differ; later stages must inspect the actual schema and cannot assume all migration files were applied exactly as checked in.
- Browser-local winner records are not owner-scoped; imports require verified ownership, and inaccessible local data cannot be reconstructed.
- Historical names may refer to a retired/reused identity; do not silently merge people or claim previously lost history was recovered.
- D09 now requires offline reopening on a previously prepared device. First-ever offline setup, payment verification and device-level kiosk lockdown remain excluded.
- Baseline LaunchPage failure and stats test setup failure are recorded above; do not describe them as regressions from this documentation stage.

## Independent Stage 2 audit — 2026-09-20

Audited source: `d54c587ed4bdb10d23122b8357ba849348da8278`. Full report: [simplification-stage2-audit.md](simplification-stage2-audit.md).

- Recorded approved D07–D08 in the specification, including multi-select roster assignment, membership-set snapshots, player-wide jersey numbers and one credit/ticket per player/session.
- Browser-confirmed incorrect historical filtering after a transfer (F01), ambiguous identities saved through Edit (F02), and raffle off for the new-coach fixture (F03).
- Source-confirmed missing coach exit from closed kiosk (F04) and archive-dependent ticket derivation conflicting with immutable rounds (F05). Their browser-reproduction limits are stated in the report.
- Independently verified manual marks, filtering, native backdating and refresh, kiosk lookup/undo/refresh/default exit, fixture raffle reset preserving hours, and simulated pending save/retry. No browser warning/error logs for the exercised paths; no page-level overflow at phone/tablet widths tested.
- Type checking and temporary production build passed. Existing tests remain 15 passed / 1 failed plus stats collection blocked by missing configuration. No test failures were hidden or rewritten.
- Changes in this audit: `docs/simplification-spec.md`, this progress file and new `docs/simplification-stage2-audit.md`. No prototype/application code, migration, dependency or deployment settings changed. The existing no-deploy rule for `claude/stage-2-prototype` remains in place; unrelated `.DS_Store` is preserved.
- This audit is not a bug-fix pass. Findings remain open. The next step is a bounded Stage 2 revision, not an automatic advance into Stage 3.

## Stage 2 revision — 2026-09-21

Branch `claude/dazzling-sagan-hxrwfp`, based on `claude/stage-2-prototype` at `adcc727` (the audited head). Implements U01 and audit findings F01–F05 exactly as scoped by the handoff below. No Supabase/production calls, migrations, real roster data, backend authorization changes, deployments or PR merges. The existing no-deploy guard in `vercel.json` was extended to this exact branch before any push (`claude/dazzling-sagan-hxrwfp: false`), alongside the unchanged existing entries.

### U01 — multiple simultaneous memberships, one jersey number

`Player.subTeamId` (scalar, nullable) became `Player.subTeamIds` (array; empty means the default Kaizen grouping). The jersey number stays on the player alone (D08), never per membership. `FinalizedSession.teamAtSession` became a membership-*set* snapshot (`Record<string, string[]>`) instead of one team per attendee. Roster add/edit now offers a checkbox group (`SubTeamCheckboxes`, shared by both paths) instead of a single `<select>`. Kayla (`pl-11`, `#12`) is the fixture's simultaneous-membership player: Blue 6th **and** Blue 7th at once. Every list that shows players (All teams, kiosk matches, Progress "All teams") already showed one row per player id, so multi-membership needed no separate de-duplication — only the filter predicates changed, from `=== teamId` to `.includes(teamId)`. The stale "single membership, still open" note and hint text in `RosterScreen.tsx` were rewritten to state D07/D08 as confirmed.

### F01 — historical team filtering now uses session snapshots

Added `historicalTeamRows(state, teamId)` in `store.tsx`: for a specific team filter in Progress's "Team at session" mode, it filters to sessions whose *own* snapshot names that team, then sums hours/practices/trainings/tickets from only that qualifying subset — instead of reusing the player's all-time `playerTotals` under a relabelled group. A transfer (`updatePlayer` changing `subTeamIds`) therefore cannot move a past session's hours onto the new team, because old snapshots are never touched. Every row from `historicalTeamRows` also carries `otherTeams`: the other teams that same player qualifies for historically, rendered as "also counted under …" so a reader never mistakes two teams' totals as additive; a persistent note next to the team filter says the same for "Current roster" mode. Retired sub-teams and sessions with no snapshot at all stay reachable: the team-filter chip list in "Team at session" mode is built from every team any snapshot ever names (active or retired), and "Unknown (legacy record)" remains its own group under "All teams" rather than silently disappearing.

### F02 — edits are a draft with Save/Cancel, validated like Add

`PlayerRow` in `RosterScreen.tsx` no longer calls `updatePlayer` on every keystroke. It holds a local `draft`, re-synced whenever the row (re)enters edit mode, and reuses the exact same collision rule Add uses (`wouldCollide`, extracted from the inline duplicate check `AddPlayerForm` already had). A blank first name or a rename that would render identically to another card disables Save and shows an inline reason; Cancel discards the draft and restores the last-saved card untouched. A pure `playerEditIsValid` helper exposes the same rule outside the component for the committed tests.

### F03 — new-coach fixture starts with the raffle on

The `"empty"` scenario (labelled "a new coach with nobody on the roster yet") now overrides `raffleEnabled: true` in `buildScenario`, instead of inheriting the shared `false` default. The `"team"` scenario (an existing coach, described in its own blurb as starting off with tickets already accrued) keeps the explicit `false` default, so the Keep/Start-fresh activation dialog still has a real accrued-ticket count to exercise.

### F04 — closed-session kiosk offers a coach exit

`KioskScreen` no longer collapses "no session" and "closed elsewhere" into the same bare notice. A `closedElsewhere` session now renders `ClosedKiosk`: the notice plus a number pad and a **Coach exit** button, with no player lookup at all — check-in stays fully disabled (the reducer already rejected `setPresent` once `closedElsewhere` was true; now the UI matches). The bound-kiosk-survives-refresh effect in `PrototypeApp.tsx` needed no change: it already re-enters `KioskScreen` regardless of `closedElsewhere`, so a refresh lands back on the same closed screen. Entering the correct code calls the same `onExit` the normal pad uses, which returns to `AttendanceScreen`'s existing "finished on another device" conflict panel. That panel's "Back to Home" button previously left a phantom `activeSession` behind (Home would still offer to "Resume" a session that had already finished elsewhere); it now dispatches a new `acknowledgeClosedElsewhere` action that clears it, so Home offers a clean Start again. Since the walkthrough panel's own controls are hidden while kiosk owns the screen, a small labelled dev-only "finish this session on another device" control was added inside `KioskScreen` itself so this transition stays reachable and testable while kiosk is active.

### F05 — raffle eligibility follows round assignment, not archive status

`ticketLines` no longer excludes every `archived` session. Eligibility for the current round is (and was already) governed entirely by `roundId === state.currentRoundId`; archived is now purely a reporting flag, matching P10. `ev-02` (the fixture's original archived-history example) still sits outside the current pool, but because it is assigned to the *previous* round, not because it is archived. A new fixture, `ev-07`, is a training archived for reporting but assigned to the *current* round, to make the distinction demonstrable: RaffleScreen now shows separate pills for "archived training(s) from earlier rounds" versus "archived training(s) still counted in this round," and both the committed tests and the live screen show its ticket count is identical whether `archived` is `true` or `false`.

### Also fixed: a visible local-persistence failure, and dialogs that are actually accessible

- The store's `localStorage.setItem` failure was previously swallowed with a comment claiming it "surfaces in the dev panel," which nothing did. `trySave` now reports success/failure into `state.localPersistenceFailed`; a banner replaces the false "Saved on this device" claim, and `AttendanceScreen`'s own delivery pill turns into "Local save failed — your marks are still here in memory" rather than continuing to claim a successful device save. A new dev-only "Simulate save failure" toggle exercises the identical failure branch a real quota/private-browsing exception would take (including that toggle itself failing to persist on the next refresh — the same risk a genuine failure carries).
- The raffle activation dialog was a raw `role="dialog"` div. It is now built on the app's existing `@/app/components/ui/dialog` (Radix) primitives, wired through a real `DialogTrigger` rather than a plain `onClick`. That second detail mattered in practice: without it, Radix cannot return focus to the trigger on close. Getting there required two small ref-forwarding fixes, one of which is the sole change to `src/app/` in this revision:
  - `src/prototype/components/ui.tsx`: `BigButton` now uses `React.forwardRef`, needed because `<DialogTrigger asChild>` clones its child and attaches a ref to it — a plain function component silently drops that ref (a real, reproducible `console.error`, not a style preference).
  - `src/app/components/ui/dialog.tsx`: `DialogOverlay` had the same gap and is fixed the same way. This is the one exception to Stage 2's "no file under `src/app/` modified" invariant, made deliberately: the handoff explicitly asked to reuse the app's accessible dialog primitives, and reusing them surfaced a latent, pre-existing defect in that shared file (it would affect every other consumer of `Dialog`, such as `InviteCoachModal`/`PlayerTypeDialog`, not just this prototype). The fix is a mechanical, behavior-preserving `forwardRef` wrap — the same pattern current shadcn/ui ships — and does not touch any route, business logic, or the admin-coach-actions backend.

### Verification — exactly what was run

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 31 passed, 1 failed of 32 collected, across 5 files (2 failing files). The new `src/prototype/store.test.ts` contributes 16 tests, covering U01, F01, F02, F03 and F05 with expected totals (not just label presence) — all 16 pass. The two failing/blocked files are identical to the previously recorded baseline: `LaunchPage.test.tsx`'s dated `9:00 AM` preset assertion, and `src/lib/stats.test.ts` still failing to collect because `VITE_SUPABASE_URL` is missing. **Neither is a regression from this revision.**
- `npx vite build` into a temporary output directory (the tracked `dist/` was never touched): emitted the same three files as before (`index.html`, one CSS, one JS). `index-DZ3ExIO7.css` (215.60 kB) is byte-identical to the hash recorded in Stage 2 and the audit. The JS bundle's hash changed (1,239.80 kB → 1,239.83 kB, about 30 bytes) — this is expected and solely attributable to the one `forwardRef` line added to `src/app/components/ui/dialog.tsx` above; no prototype code is included (`grep` for `prototype` in the built JS matches only JavaScript's/React's own `.prototype` mechanics).
- Browser walkthrough: headless Chromium via Playwright against `vite` on `localhost:5199`, at a 430×932 phone viewport and a 1024×768 tablet viewport. **36 scripted checks, all passing.** Beyond the existing six core journeys, this run specifically added and passed: a shared-membership player (Kayla) found under either team filter and exactly once under "All teams"; a rejected duplicate-card edit that never persists past a refresh; "Team at session" showing the same, full, non-split hours for Kayla under both of her teams with an explicit overlap label; the new-coach fixture starting with the raffle on; the existing-coach fixture keeping it off with accrued tickets; the RaffleScreen pill distinguishing an archived-but-current-round training from ones in earlier rounds; the activation dialog opening, Escape-dismissing, and returning focus to its trigger button; a simulated local-storage failure showing and clearing its banner; and the full F04 sequence — entering kiosk, forcing a remote finish, confirming the player pad is replaced by a code-only pad, surviving a refresh, rejecting a wrong code, accepting the right one, landing on the coach's conflict panel, and returning to a clean Home. No unexpected console errors or page errors were captured; one pre-existing, environment-only failure (`ERR_CERT_AUTHORITY_INVALID` for `prototype.html`'s external Google Fonts `<link>`, which cannot reach the internet from this sandbox) was identified, confirmed unrelated to any code in this revision — it predates it — and excluded.
- **Not tested, and not claimed:** the same limits as the original Stage 2 prototype — no production, database, RLS, authorization, migration, real offline/service-worker behavior, screen-reader output, or real device testing. This remains a fixture-only demonstration of intended behavior, not the Stage 3 data/reliability contract.

### Open decisions carried forward, unresolved by this revision

U01's cardinality/jersey question (row 1 of the original open-decisions table) is now resolved and implemented. The rest are unchanged and still require an explicit owner decision before Stage 3 finalizes the corresponding operation — this revision does not approve any of them by having used one behavior:

| # | Question | Blocks |
| --- | --- | --- |
| 2 | Should a coach-set PIN **replace** `0000`, or should `0000` keep working as a fallback? Still replaces it here. | Stage 3 coach setting, Stage 5 exit. |
| 3 | Should a backdated optional training join the **current** round (P08), or the round that was open on the date entered? Still uses the current round here. | Stage 3 round assignment. |
| 4 | **Resolved by D09:** a durably queued offline finish must NOT block the next session. The prototype's blocking behavior is superseded. | Stage 3 queue contract; Stage 4 implementation. |
| 5 | Is **retirement** the right replacement for today's destructive player removal (P07)? | Stage 3 removal path. |
| 6 | Should the kiosk have its own URL rather than in-memory state? | Stage 5. |
| 7 | Should sessions be able to **target** one sub-team, changing attendance-rate denominators? Not approved by the request to sort by team, and not prototyped. | Stage 6 reporting. |

P01–P12 in the specification remain recommendations, not approvals, exactly as before this revision.

## Stage 2 revision follow-up (R01/R02) — 2026-09-21

Branch `claude/dazzling-sagan-hxrwfp`, continuing from the Stage 2 revision at `92eb4df`. A same-day independent review of that revision (see [the audit](simplification-stage2-audit.md#independent-revision-review--2026-09-21) for the findings themselves) surfaced two further gaps, R01 and R02, both now closed. Same fixture-only scope and no-deploy guard as before: no Supabase/production calls, migrations, real roster data, backend authorization changes, deployments, merges or PRs.

### R01 — retired attendees and all-teams-retired navigation

`ProgressScreen`'s "Team at session > All teams" view was built from `roster` (`state.players.filter(p => !p.retired)`) — the same active-only list Current roster mode correctly uses — so a retired player's history disappeared from historical reporting entirely, not just from the current roster. Separately, the whole Attribute-to/Team panel, including the "Team at session" toggle, was gated on `activeTeams.length > 0`; retiring every sub-team removed it along with the panel, closing off the one view that still explains a now-retired team's history.

Fixed: `historicalAllRows` now sources from `state.players` (every player, retired or not) and tags each row with `retired`, shown as a "Retired" pill. The panel's gate changed to `state.subTeams.length > 0` (any sub-team ever created, active or not), so it survives every team being retired. Current roster mode, program-wide totals (session-hours/player-hours), and the specific-team historical view (`historicalTeamRows`, which already iterated `state.players` correctly) are unchanged.

### R02 — local-save failure inside kiosk

The revision's persistence-failure banner and qualified delivery-status pill live in `PrototypeApp.tsx`'s `Shell`, which kiosk never renders (`Shell` returns only `<KioskScreen>` while kiosk owns the screen). A local-save failure during an actual check-in or undo therefore stayed invisible to the kiosk, and the confirmation panel kept claiming an unqualified "You're checked in" / "Check-in undone" regardless.

Fixed: kiosk now shows its own plain-text failure banner whenever `state.localPersistenceFailed` is true, and the confirmation panel becomes "Checked in — not saved yet" / "Undo recorded — not saved yet" (warning tone, explanatory line) for as long as the failure lasts, reverting to the normal confirmation once storage recovers. No new coach-navigation affordance was added — the only way out of kiosk is still the exit code. This is still a best-effort read of the last known save attempt, not the real outbox/acknowledgment model spec §5 describes for Stage 4; it does not require that backend to exist yet, matching the handoff's own scope note.

### Verification — exactly what was run

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 45 passed, 1 failed of 46 collected, across 8 files (2 failing files). Three new component-test files were added — `ProgressScreen.test.tsx` (5 tests), `KioskScreen.test.tsx` (4 tests) and `RosterScreen.test.tsx` (5 tests) — all rendering the real screens against a `PrototypeStoreProvider` (not calling the pure store helpers directly), covering exactly the three things asked for: a retired player's historical row and totals, historical navigation surviving every sub-team being retired, and kiosk's failure exposure/qualified feedback/live recovery. The Add and Edit `RosterScreen` tests specifically drive the actual Save button, not `wouldCollide`/`playerEditIsValid` in isolation, confirming a duplicate attempt disables Save and leaves the previously stored identity unchanged after Cancel. The 1 failure and 1 collection-blocked file are the same pre-existing `LaunchPage`/`stats.test.ts` baseline issues recorded throughout this project — reported separately here because they are not regressions from this follow-up.
- `npx vite build` into a temporary directory: `index-DZ3ExIO7.css` and the JS bundle are both byte-identical to the Stage 2 revision's build (same hashes as recorded there) — this follow-up touched only `src/prototype/`, so the one shared-dialog-driven bundle change already documented in the revision is unchanged and no new one was introduced. No prototype code reaches the bundle.
- Browser walkthrough: headless Chromium, phone 430×932 and tablet 1024×768. **20 scripted checks, all passing:** retiring a player through the real Roster UI removes them from Current roster and the roster count but surfaces them (labelled Retired) under Team at session > All teams; retiring all four sub-teams through Settings still leaves the Team at session toggle and a "(retired)" team filter reachable and renders real rows; enabling the storage-failure dev toggle from the coach controls, then entering kiosk, shows the failure banner inside kiosk with no coach navigation visible, and check-in confirmation reads "Checked in — not saved yet"; turning the toggle back off and re-entering kiosk restores the plain "You're checked in" confirmation. No unexpected console/page errors; the same pre-existing, environment-only Google Fonts certificate failure noted in the revision was excluded.
- **Not tested, and not claimed:** the same limits as the Stage 2 revision — no production, database, RLS, authorization, migration, real offline/service-worker behavior, screen-reader output or real device testing.

Unresolved product policies are unchanged by this follow-up: the "Open decisions carried forward" table above still applies in full, and P01–P12 remain recommendations, not approvals. Neither R01 nor R02 was a data-affecting policy question — both were completeness gaps in already-approved behavior (retirement keeps history per P07; a local-save failure must be visible per the revision's own persistence-failure fix), so closing them does not resolve or imply approval of any open item in that table.

## Stage 2 revision handoff (fulfilled — 2026-09-21)

Recommended model: **Claude Sonnet, High effort** for the focused Stage 2 revision. Stage 3 remains **Claude Opus 5, High effort** after the revised walkthrough and resolution of consequential data policies. This handoff does not authorize another stage by itself.

This exact prompt was carried out on 2026-09-21 (see "Stage 2 revision" above); it is kept here as the historical record of what was requested. The live pointer for what to do next is the **Exact next-stage handoff** section below.

Copy this when requesting the revision:

```text
Work only in johnfreyman/kaizen-tracker, starting from the latest
claude/stage-2-prototype branch, including the independent audit documents.
Verify the remote and head before editing. Preserve unrelated changes,
including .DS_Store. Do not work in seating-charts or start from main.

Read repository instructions, docs/simplification-spec.md,
docs/simplification-progress.md and docs/simplification-stage2-audit.md.
Implement only the Stage 2 prototype revision described below. The audited
prototype commit was d54c587; use the newer branch head containing the audit.

Confirmed D07-D08: one player can belong to several sub-teams simultaneously,
but uses ONE jersey number across them. Retain one stable player identity.
Use multiple membership selection in add/edit, membership-set history
snapshots, and correct matching in roster, attendance, kiosk and reports.
All teams and kiosk show the player once. One training attendance yields
1.5 hours and one raffle ticket even if several team filters match. Removing
one membership preserves others and historical memberships. Keep 0 and 00
as distinct strings. Update the stale single-membership assumption copy.

Address audit F01-F05:
- Historical team filtering must use session membership snapshots and sum
  only qualifying attendance; preserve unknown and retired history. Team
  transfer must not move past hours to the new team. Explicitly label any
  overlapping team totals and deduplicate whole-program totals.
- Validate edits as well as adds. Draft edits with Save/Cancel; do not persist
  empty names or unresolved identical cards. Preserve stable identity.
- New-coach fixtures start with raffle enabled. Keep a separate existing
  coach/off fixture for the activation dialog and preserved old settings.
- Closed-session kiosk stops check-in but offers code-protected coach exit;
  demonstrate closure while kiosk is active and recovery after refresh.
- Derive raffle eligibility from immutable round membership, independent of
  later archive/restore. Seed old archived fixtures outside the initial current
  pool; include a current-round archive/restore regression fixture.

Demonstrate a visible local-persistence failure state instead of claiming
Saved on this device after a failed write. Keep reliability limitations clear:
fixture network switches are not proof of real offline recovery. Use the
existing accessible dialog primitives for modal focus/keyboard behavior.

Add focused committed tests with expected totals for multiple memberships,
transfer/history filtering, rejected edits, raffle defaults and archive/round
eligibility. Browser-check the existing core flows plus new multi-team and
closed-kiosk recovery journeys at phone and tablet sizes. Re-run type/build
checks and distinguish existing baseline failures from new regressions.
Keep the production bundle free of prototype code.

Fixture-only work: no Supabase or production calls, migrations, real roster
data, backend authorization changes, deployments or PR merges. Preserve the
normal app and secured admin-coach-actions backend. If using a differently
named branch, extend the existing branch-specific no-deploy guard for that
exact branch before pushing, without disabling production.

Update progress and audit finding statuses with actual results. Record which
product recommendations remain unresolved; do not infer approval from this
prototype. Prepare a Stage 3 handoff using many-to-many memberships, one
player-owned jersey number, stable IDs, independent raffle rounds and an
isolated migration rehearsal. STOP after the Stage 2 revision; do not start
Stage 3 or the real coach attendance rewrite.
```

### Stage 3 gate after the revision

Apply approved D09 for pending finishes. Resolve the applicable PIN,
backdated-training round, retirement and team-attribution policies before finalizing operations that
encode them. A labeled recommendation is not approval. Do not copy the
prototype's simplified local storage or name/group filters into production.
Stage 3 must inspect an isolated deployed-like schema, preserve historical
records, rehearse additive backfill twice, and verify cross-coach ownership
and idempotent operations using actual database roles. If an isolated
environment is unavailable, report that gap rather than using production.

### Before the walkthrough

To open the prototype: `npm install`, then `npm run dev`, then visit `/prototype.html` on the dev server — not `/`, which is the current working app. The amber **Walkthrough controls** bar switches roster fixtures and simulates offline, failed saves, a storage-write failure, and a session finished on another device. Everything is fixture data held in the browser; the *Empty roster* button resets it.

## Stage 3 data handoff (read with final D09 addendum)

Recommended model: **Claude Opus 5, High effort**, per the specification's build sequence (§10). This handoff does not authorize Stage 4 or any production change by itself.

Copy this when requesting Stage 3:

```text
Work only in johnfreyman/kaizen-tracker, starting from the latest
claude/dazzling-sagan-hxrwfp branch (the Stage 2 revision), or the newer
branch head if that revision was published elsewhere. Verify the remote and
head before editing. Preserve unrelated changes, including .DS_Store. Do
not work in seating-charts or start from main.

Read repository instructions, docs/simplification-spec.md,
docs/simplification-progress.md (including the Stage 2 revision section and
its "Open decisions carried forward" table) and
docs/simplification-stage2-audit.md.

This is Stage 3: the data foundation and migration rehearsal. Work in an
isolated, non-production environment only. Do not touch production data,
run a production migration, or use the live Supabase project. If an
isolated database/environment is unavailable, report that gap rather than
substituting production.

1. Inspect the actual deployed-like schema, constraints, grants, views,
   triggers and RPC definitions rather than assuming the checked-in
   migration files were applied exactly as written (spec S8.A).
2. Design additive tables/columns for: a stable player identity (existing
   roster UUIDs reused where unambiguous, never derived from name or
   number); a player-owned jersey number, one per player across every team
   and never per membership (D08); a many-to-many player/sub-team
   membership table with a unique owner/player/team combination, matching
   the Stage 2 revision's subTeamIds contract (D07); a session-membership
   snapshot so historical attribution never depends on a player's current
   membership (this is F01's fix as a real schema, not the fixture-only
   snapshot the prototype used); and independent raffle rounds with an
   immutable per-session round assignment, so ticket eligibility depends on
   round assignment alone and never on archived status (F05).
3. Do not carry the prototype's in-memory reducer or its single
   localStorage key into this stage. Design a durable, coach-scoped
   outbox with operation ids, revisions and idempotent RPCs (spec S5-S6).
   Apply D09: multiple locally finished sessions may await sync beside a new
   active session. Specify prepared-device offline reopening, owner-scoped
   cache/auth recovery, ordered replay and immutable cached round binding.
   Implementation of the offline app remains Stages 4–5; verify A27–A30 later.
4. Rehearse the additive backfill twice in the isolated environment; the
   second pass must produce no extra attendance/ticket/draw/round records.
   Seed the initial current raffle pool from current, unarchived trainings
   only (D03), assigning older archived history to non-current rounds
   rather than filtering by the archived flag.
5. Resolve, or explicitly re-confirm as still open, each item in the Stage
   2 revision's "Open decisions carried forward" table before encoding it
   into a migration or RPC contract: PIN replace-vs-fallback, backdated
   training round assignment, retirement vs. destructive removal, kiosk
   URL vs. in-memory binding, and whether a session can target one
   sub-team. Pending-finish blocking is no longer on this list: D09
   resolved it (a durably queued local finish must not block the next
   session). A recommendation the prototype happened to use is not owner
   approval.
6. Verify cross-coach ownership and idempotent operations using actual
   database roles in the isolated environment, not only UI mocks. Confirm
   the sole super admin (johnfreyman70@gmail.com) and the secured
   admin-coach-actions backend remain the only privileged path; do not
   grant browser SELECT on any admin aggregate view or promote a user via
   client-supplied metadata.

Update docs/simplification-progress.md with the Stage 3 state, evidence,
and any newly surfaced gaps, using the same "exactly what was run"
standard as the Stage 2 revision. Do not claim Stage 4 (coach attendance)
work. STOP after the Stage 3 data foundation and migration rehearsal; do
not start the real coach attendance rewrite or any production deployment.
```

## Independent revision review — 2026-09-20 local / 2026-09-21 UTC

Reviewed remote `claude/dazzling-sagan-hxrwfp` at `92eb4df` in an isolated temporary export without switching this checkout. See [simplification-stage2-revision-review.md](simplification-stage2-revision-review.md) for findings, verification and the exact next handoff. This addendum records a review of the newer branch; the earlier sections in this checkout predate that revision.

Type/build checks and all 16 added tests pass. Full suite: 31 passed, one existing failed test, plus a separate existing collection failure. Three temporary component reproductions confirm remaining historical-retirement visibility gaps (R01; F01 partially open) and hidden kiosk save failures (R02). The production JS bundle changes through the shared dialog fix; no deployment occurred. Claude's browser checks were not independently repeated in this review.

Subsequent branch status: Claude committed the R01/R02 follow-up at `3f1d398`. Its reported results are preserved above; this documentation publication does not independently re-audit that implementation. Next: confirm follow-up acceptance, resolve applicable product policies and prepare the isolated Stage 3 environment. No stage implementation, production access, merge or push was performed. Local application files and the unrelated `.DS_Store` change remain untouched.


## Approved offline gym scope and exact continuation handoff — 2026-09-21 UTC

The owner approved the proposed offline plan with “Yes, add it.” D09 is now approved in the specification, expanding R07. This is a documentation update, not permission to begin another implementation stage.

### Changes and remaining work

- A previously prepared iPad must reopen without internet, even with no session already started, and support start, backdating, attendance/undo, kiosk/exit and finish.
- Confirm success only after durable local storage, with clear pending/synced/failure feedback in coach and kiosk modes. Cache readiness must reflect actual app/data availability.
- A locally finished session waiting for sync must not block another session. P02's former blocking policy and the old offline-reopening exclusion are superseded. A multi-session queue must survive restarts, delayed acknowledgments, interrupted updates and retry without duplication or clearing newer work.
- Automatically retry while the app is open and connectivity returns, and when it reopens. No promise of closed-app background sync. Initial scope: one attendance iPad per session; sync before drawing or resetting raffle eligibility. Cached offline ownership does not bypass server authentication.
- Stage 3 must define queue ordering, session/operation identity, cached owner/round semantics, auth expiration and recoverable stale-device conflicts. Stages 4–5 implement offline app loading and coach/kiosk behavior; Stage 6 enforces draw readiness; Stage 7 proves A27–A30 on an actual supported iPad and against isolated services.
- R01/R02 were addressed by Claude in `3f1d398`; independent acceptance remains to be confirmed. PIN replacement, newly backdated training round policy, retirement and session targeting remain separate unresolved policies; D09 does not approve them. Service worker/IndexedDB details remain implementation recommendations.

### Validation

Documentation consistency review checked R07/D09, P02, Home/session transitions, offline scope, outbox contract, A08/A27–A30 and stage handoffs. No application tests were run for this documentation-only change, and no offline behavior is claimed implemented or tested. No code, dependency, schema, production settings or deployment changed. Existing local review documents and `.DS_Store` were preserved. These updates are included in this documentation publication on Claude's branch, on top of `3f1d398`.

### Exact handoff

```text
Continue johnfreyman/kaizen-tracker from claude/dazzling-sagan-hxrwfp
at the latest published head including 3f1d398 and this documentation update.
Read the approved D09 specification, this progress document, and the
independent revision review before continuing.
Preserve existing changes and the branch-specific no-deploy guard.

The bounded Stage 2 R01/R02 follow-up is already committed in 3f1d398;
do not repeat it blindly. Confirm acceptance of that work and retain its
reported evidence. D09 is approved; fixture-only offline behavior remains
simulation. Do not claim the prototype can reliably reopen offline. STOP
before Stage 3 unless it is separately requested.

When Stage 3 is requested, extend its isolated data/migration rehearsal to
support D09: offline-created stable session/operation identities, multiple
finished unsynced sessions beside the next active session, ordered replay,
idempotent finalization, exact-session acknowledgments, coach/device-scoped
cache/outbox, auth-expiration recovery and immutable cached round binding.
A pending finish must not block the next local session. Preserve historical
credit, memberships, tickets, sole-admin authorization and all owner boundaries.
Resolve consequential remaining policies explicitly; do not assume a stale
cached round can be silently reassigned to the newest round.

Specify preparation/readiness, offline close/reopen, app/cache update and
storage-failure contracts for Stages 4–5; do not implement those later stages
as part of Stage 3. Keep initial attendance operation to one iPad per session
and require online synchronized state for draws/resets. Rehearse migration
and queue/idempotency contracts only in an isolated environment. If no such
environment exists, report the gap; never substitute production.

Retain A27–A30 as actual Stage 7 verification gates: prepared iPad airplane-
mode close/reopen, start/finish A and B while offline, retain active C, recover
all after reopening and repeated/lost acknowledgments, and reconcile exact
hours/tickets. Test real storage/network/auth failures, not only toggles.
Update progress with evidence and unresolved issues; no production deployment.
```

## Documentation publication checkpoint

Published documentation is based on remote `3f1d398`, preserving Claude's implementation and verification notes. Only the specification, progress document and independent review are included. The exact branch remains deployment-disabled. Documentation checks cover unique requirement/decision/acceptance IDs, balanced fences and conflict/whitespace checks. No application tests were rerun for this publication; new follow-up results above remain attributed to Claude. Remaining work: confirm the follow-up, resolve remaining product decisions, then separately authorize Stage 3 in isolation.

## Stage 2 follow-up acceptance confirmed — 2026-09-21

Continuing on `claude/dazzling-sagan-hxrwfp`, pulled to `3147635` (the documentation publication above) before this pass. No source files needed further changes: the R01/R02 fixes and their component tests, committed at `3f1d398`, were already correct. This entry is the requested independent confirmation and fresh verification evidence, not a re-implementation — the "Exact handoff" above explicitly asked not to repeat that work blindly.

### What was confirmed, and how

- **R01** (retired attendees and unknown legacy history stay visible under "Team at session > All teams"; those controls survive every sub-team being retired): re-verified against the freshly pulled state with both a full test run and a fresh browser pass.
- **R02** (kiosk exposes a local-save failure and never shows an unqualified check-in/undo success while one is active): same fresh re-verification.
- Regression tests: `ProgressScreen.test.tsx`, `KioskScreen.test.tsx` and `RosterScreen.test.tsx` (14 tests total) plus `store.test.ts` (16 tests) all still pass unmodified.

### Verification — exactly what was run, fresh, after the pull

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 45 passed, 1 failed of 46 collected, across 8 files. **Reported separately, as requested:** the 1 failure is `LaunchPage.test.tsx`'s pre-existing dated `9:00 AM` preset assertion, and `src/lib/stats.test.ts` still fails collection because `VITE_SUPABASE_URL` is missing from this environment. Both predate this branch and are not regressions from any work here.
- `npx vite build` to a temporary directory: `index-DZ3ExIO7.css` and `index-CAFHf2CU.js` are byte-identical to the hashes recorded in the Stage 2 revision and its R01/R02 follow-up — this confirmation touched no source, so the one shared-dialog-driven bundle change already disclosed there is unchanged and no new one was introduced.
- Browser walkthrough: headless Chromium, phone 430×932 led this pass (earlier passes led with desktop), plus a tablet 1024×768 spot check. **16 scripted checks, all passing:** retiring a player through the real Roster UI removes them from Current roster but surfaces them, labelled Retired, under Team at session > All teams; retiring every sub-team through Settings still leaves the Team at session toggle and a "(retired)" filter chip reachable, at phone width with no horizontal overflow; enabling the storage-failure dev toggle from the coach controls, then entering kiosk, shows the failure banner with no coach navigation visible and "Checked in — not saved yet" instead of an unqualified success; turning the toggle off and re-entering kiosk restores the plain "You're checked in" confirmation. No unexpected console/page errors; the same pre-existing, environment-only Google Fonts certificate failure noted throughout this project was excluded.

### D09 (offline gym use) — preserved in the handoff only

D09 is confirmed approved (see `simplification-spec.md` and `simplification-stage2-revision-review.md`). Per this task's explicit scope, it is preserved in the Stage 3 data handoff above (step 3: durable multi-session queue, ordered replay, owner-scoped cache/auth recovery, immutable cached round binding — data/contract design only) and in D09's own row of the confirmed-decisions table. **No offline implementation, service worker, IndexedDB, queue code or Stage 3 work was started or is claimed working.** The prototype remains a fixture-only, in-memory demonstration with no real offline capability; D09's acceptance criteria (A27–A30 in the specification) remain future-stage verification gates, not something this pass attempted.

### Unresolved product policies

Unchanged by this confirmation pass. The "Open decisions carried forward" table (under the Stage 2 revision above) still applies, minus the pending-finish item D09 resolved. P01–P12 remain recommendations, not approvals. Nothing here infers additional owner approval from the prototype's existing behavior.

No Supabase/production calls, migrations, deployments, merges or PRs were made. The branch-specific no-deploy guard in `vercel.json` is unchanged. Stopping here, before Stage 3, as requested.
