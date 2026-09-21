# Kaizen Tracker simplification progress

Updated: 2026-09-20.

Specification: [simplification-spec.md](simplification-spec.md).
Baseline application commit: `40d9b0c2f57692cdc8439d453816418be3db5a39`.

## Scope and current status

Stage 1 documentation is complete. The initial Stage 2 prototype is implemented and independently audited; a focused Stage 2 revision is next before the Stage 3 data contract is finalized. The owner says the design is on the right track and has confirmed D07–D08: multiple simultaneous sub-team memberships and one jersey number per player across teams. D01–D08 are confirmed; the remaining recommendations are not blanket-approved. Stage 3 has not started. See [the audit](simplification-stage2-audit.md) for findings, evidence and limits.

Canonical continuation branch: `codex/simplification-plan` in `johnfreyman/kaizen-tracker`. Stage 2 work continues on `claude/stage-2-prototype`, branched from that head. Use these documents from the newer branch, not the unchanged `main` checkout or the superseded seven-stage draft.

Published review: [draft PR #1](https://github.com/johnfreyman/kaizen-tracker/pull/1). It remains unmerged. The initial reconciliation commit is `428d59a274965c172324958f3f8fa2b407f9880b`; use the latest branch head for subsequent handoffs.

| Stage | State | Deliverable / next gate |
| --- | --- | --- |
| 1. Product specification and migration plan | Complete | Source audit, approved requirements/decisions, recommendations, flows, data invariants, acceptance matrix and recovery plan documented. |
| 2. Screen flows and prototype | Initial prototype complete; audit revision required | Multiple memberships plus audit U01/F01–F05, repeatable checks and revised walkthrough. |
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
| 4 | Should a pending offline finish **block** starting a different session (P02)? The prototype blocks it. | Stage 4 queue design. |
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
- Full offline cold-start, payment verification and device-level kiosk lockdown are not included.
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

## Exact next-stage handoff

Recommended model: **Claude Sonnet, High effort** for the focused Stage 2 revision. Stage 3 remains **Claude Opus 5, High effort** after the revised walkthrough and resolution of consequential data policies. This handoff does not authorize another stage by itself.

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

Resolve the applicable PIN, backdated-training round, pending-finish,
retirement and team-attribution policies before finalizing operations that
encode them. A labeled recommendation is not approval. Do not copy the
prototype's simplified local storage or name/group filters into production.
Stage 3 must inspect an isolated deployed-like schema, preserve historical
records, rehearse additive backfill twice, and verify cross-coach ownership
and idempotent operations using actual database roles. If an isolated
environment is unavailable, report that gap rather than using production.

### Before the walkthrough

To open the prototype: `npm install`, then `npm run dev`, then visit `/prototype.html` on the dev server — not `/`, which is the current working app. The amber **Walkthrough controls** bar switches roster fixtures and simulates offline, failed saves and a session finished on another device. Everything is fixture data held in the browser; the *Empty roster* button resets it.
