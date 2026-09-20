# Kaizen Tracker simplification progress

Updated: 2026-09-20.

Specification: [simplification-spec.md](simplification-spec.md).
Baseline application commit: `40d9b0c2f57692cdc8439d453816418be3db5a39`.

## Scope and current status

Stage 1 documentation is complete. The owner subsequently requested reconciliation with Claude's separate plan and added date/sub-team requirements; this follow-up is planning/repository cleanup only. D01–D06 are confirmed; recommendations remain for the Stage 2 walkthrough. No later stage has been started. Do not equate a completed plan with approval of every recommendation inside it.

Canonical continuation branch: `codex/simplification-plan` in `johnfreyman/kaizen-tracker`. Use these documents from that branch, not the unchanged `main` checkout or the superseded seven-stage draft.

| Stage | State | Deliverable / next gate |
| --- | --- | --- |
| 1. Product specification and migration plan | Complete | Source audit, approved requirements/decisions, recommendations, flows, data invariants, acceptance matrix and recovery plan documented. |
| 2. Screen flows and prototype | Not started | Isolated fixtures; demonstrate confirmed choices and review recommendations before data implementation. |
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

## Existing issues and limitations

- Current reset deletes optional-training records; player removal scrubs attendance. Do not carry these implementations into the new reset/removal flow.
- Existing SQL and client date formats differ; later stages must inspect the actual schema and cannot assume all migration files were applied exactly as checked in.
- Browser-local winner records are not owner-scoped; imports require verified ownership, and inaccessible local data cannot be reconstructed.
- Historical names may refer to a retired/reused identity; do not silently merge people or claim previously lost history was recovered.
- Full offline cold-start, payment verification and device-level kiosk lockdown are not included.
- Baseline LaunchPage failure and stats test setup failure are recorded above; do not describe them as regressions from this documentation stage.

## Exact next-stage handoff

Recommended model: **Claude Sonnet, Medium effort**. Stage 2 has not been authorized or started by this handoff.

Copy this when the owner requests Stage 2; it includes the repository/branch guard missing from the previous handoff:

```text
Work only in johnfreyman/kaizen-tracker, starting from the latest
codex/simplification-plan branch. Do not work in johnfreyman/seating-charts.
Verify the remote and branch before editing. Preserve unrelated local changes.
If your environment requires a differently named work branch, base it on
codex/simplification-plan and extend the branch-specific no-deploy rule in
vercel.json for that exact branch before any push; do not disable production.

Read repository instructions, docs/simplification-spec.md and
docs/simplification-progress.md. These supersede the seven-stage plan in
commit 6486e64. If these revised files are absent, retrieve the correct branch;
do not invent a replacement plan or start coding from main.

Implement Stage 2 only: an isolated, fixture-driven interactive prototype.
Inspect the existing design system and current code before changing anything.

Carry forward all R01–R14 approved requirements and confirmed D01–D06:
default kiosk exit 0000 with a coach-set PIN option; distinct 0 and 00 jersey
numbers; initial current raffle pool from current unarchived trainings only.
New sessions credit 1.5 hours; preserve historical durations. Keep a discreet
date option for entering paper attendance later. Add Settings-managed
sub-teams, a default Kaizen grouping, roster assignment and team sort/filter.
Follow any recorded membership answer; otherwise label one sub-team per player
as a prototype assumption. P01–P12 and detailed PIN/round/team reporting rules
are recommendations for review, not silently approved database policies.

Show:
- Home with Start Practice and Start Optional Training and a resume state.
- Secondary Change date for paper attendance, default today, no time inputs.
- Coach roster cards, present/absent states and Finish & Save Attendance.
- Kiosk number pad, matching cards, check-in, undo and coach exit.
- Coach Settings for changing the default exit code to a PIN, and both exit paths.
- First-name/jersey setup, shared numbers, and duplicate-name distinctions.
- Settings-managed sub-teams, default Kaizen, roster assignment and team
  sort/filter. Include Blue/Gray 6th/7th Grade fixtures, shared jersey numbers,
  and a player transfer that preserves history and tickets.
- Progress with credited hours and practice/training separation.
- Raffle activation with real fixture counts: Keep, Start fresh and Cancel.
- Empty roster, incomplete legacy roster, no number match, offline/pending
  save, failed save and session-finished-elsewhere states.

Use the existing theme/components and large phone/tablet touch targets.
Keep time inputs and timers out of all proposed session surfaces.
Use fixture data only; no production access or writes, no migrations and
no changes to the working app's normal routes or backend authorization.
Make the prototype reachable through an isolated development entry/route.

Demonstrate six journeys: start and mark one player, enter kiosk for training,
undo a mistaken check-in, enable raffle with accrued tickets, enter backdated
paper attendance, and add/assign/filter sub-teams without losing selections.
Keep johnfreyman70@gmail.com as the sole authorized super admin and preserve
the secured admin-coach-actions backend and its authorization checks.
Run appropriate local build/browser checks and state exactly what was tested.
Update this progress file with files changed, findings, remaining decisions,
owner review points and the Stage 3 handoff. Stop at Stage 2. Do not deploy,
merge the PR, change production, or implement the data foundation in this stage.
```
