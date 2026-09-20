# Kaizen Tracker simplification progress

Updated: 2026-09-20.

Specification: [simplification-spec.md](simplification-spec.md).
Baseline application commit: `40d9b0c2f57692cdc8439d453816418be3db5a39`.

## Scope and current status

Stage 1 documentation is complete. Stage 2 is complete: an isolated, fixture-driven prototype now exists on `claude/stage-2-prototype` and is ready for the owner walkthrough. D01–D06 are confirmed; P01–P12 are demonstrated in the prototype as labelled recommendations and are still awaiting review. Stage 3 has not been started, and no database, migration or production change has been made. Do not equate a working prototype with approval of the recommendations it shows.

Canonical continuation branch: `codex/simplification-plan` in `johnfreyman/kaizen-tracker`. Stage 2 work continues on `claude/stage-2-prototype`, branched from that head. Use these documents from the newer branch, not the unchanged `main` checkout or the superseded seven-stage draft.

Published review: [draft PR #1](https://github.com/johnfreyman/kaizen-tracker/pull/1). It remains unmerged. The initial reconciliation commit is `428d59a274965c172324958f3f8fa2b407f9880b`; use the latest branch head for subsequent handoffs.

| Stage | State | Deliverable / next gate |
| --- | --- | --- |
| 1. Product specification and migration plan | Complete | Source audit, approved requirements/decisions, recommendations, flows, data invariants, acceptance matrix and recovery plan documented. |
| 2. Screen flows and prototype | Complete | Isolated fixture prototype at `/prototype.html`; confirmed choices demonstrated and recommendations surfaced for review. Owner walkthrough is the next gate. |
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

P12 describes proposed sub-team reporting behavior. One versus multiple simultaneous memberships was asked separately; pending an answer, prototype one and clearly label it as an assumption. This choice blocks final data cardinality, not the fixture prototype.

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
| 1 | **Can a player belong to more than one sub-team at once?** Still unanswered. The prototype uses one membership and labels it an assumption on screen. | Stage 3 cardinality. Nothing else. |
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

## Exact next-stage handoff

Recommended model: **Claude Opus 5, High effort**. Stage 3 has not been authorized or started by this handoff, and it must not begin until the owner has walked through the Stage 2 prototype and answered at least question 1 in the table above.

Copy this when the owner requests Stage 3:

```text
Work only in johnfreyman/kaizen-tracker, starting from the latest
claude/stage-2-prototype branch, which is based on codex/simplification-plan.
Do not work in johnfreyman/seating-charts. Verify the remote and the branch
head before editing, and preserve unrelated local changes including .DS_Store.
If your environment requires a differently named work branch, base it on
claude/stage-2-prototype and extend the branch-specific no-deploy rule in
vercel.json for that exact branch before any push; do not disable production.

Read repository instructions, docs/simplification-spec.md and
docs/simplification-progress.md. These supersede the seven-stage plan in
commit 6486e64. Read the Stage 2 section for what was built, what was
verified and the seven open decisions. If these files are absent, retrieve
the correct branch; do not invent a replacement plan or start from main.

Implement Stage 3 only: the data foundation and a migration REHEARSAL.
Before writing any migration, check the owner's answers recorded above.
Question 1, multiple simultaneous sub-team memberships, sets membership
cardinality and must be answered before that table is designed. Questions 2,
3, 4 and 5 change stored behavior; if any is still unanswered, implement the
reversible option, record it as unresolved, and do not treat the prototype's
choice as approval.

Work in an ISOLATED environment only. Inspect the deployed-like schema,
constraints, grants, views, triggers and RPC definitions rather than
replaying the numbered files in migrations/, which may not match what is
deployed. Never point any of this at production, and never run a migration
against it.

Carry forward R01-R14 and confirmed D01-D06. Deliver:
- Stable player identity reusing existing roster UUIDs where unambiguous,
  with retained raw legacy names and an explicit exceptions list. Never merge
  two people by first name or jersey number.
- Sub-team and membership entities, with a default Kaizen grouping and
  session membership snapshots so a transfer never rewrites history.
- Session, attendance and revision entities; 1.5-hour credit for new
  sessions and untouched historical durations.
- Raffle round and ticket entitlement derived from immutable session/round
  membership, seeded per D03 from current unarchived trainings only.
- Versioned, idempotent RPCs with operation ids and revision checks. Finishing
  must target a session id and must never delete a different active session
  by coach alone.
- Additive changes only: no dropped fields, no rewritten history.
Make the 1-3 character jersey number rule a real constraint, so a four-digit
kiosk exit code can never collide with a jersey lookup (Stage 2 finding 3).

Test cross-coach isolation with actual access roles in the isolated
database, not UI mocks. Rehearse the backfill twice; the second pass must
add no attendance, ticket, draw or round records. Keep johnfreyman70@gmail.com
as the sole authorized super admin, preserve the secured admin-coach-actions
backend and its authorization checks, and do not grant browser SELECT on
admin_coach_summary_view.

Leave the Stage 2 prototype in place and unchanged unless a data decision
makes one of its screens wrong; if so, update the screen and say why.
State exactly what was run and what was not. Update this progress file with
files changed, findings, resolved and remaining decisions, reconciliation
counts, and the Stage 4 handoff. Stop at Stage 3. Do not deploy, merge the
PR, change production, run a migration against production, or start the
coach attendance rewrite.
```

### Before the walkthrough

To open the prototype: `npm install`, then `npm run dev`, then visit `/prototype.html` on the dev server — not `/`, which is the current working app. The amber **Walkthrough controls** bar switches roster fixtures and simulates offline, failed saves and a session finished on another device. Everything is fixture data held in the browser; the *Empty roster* button resets it.
