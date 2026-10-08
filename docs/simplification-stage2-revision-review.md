# Independent Stage 2 revision review

Reviewed 2026-09-20 (America/Los_Angeles; 2026-09-21 UTC).
Source: `92eb4df` on `origin/claude/dazzling-sagan-hxrwfp`, descended from audit commit `adcc727`.

## Publication status

This review describes `92eb4df`. Before publication, Claude pushed `3f1d398` addressing R01/R02 with component tests. Preserve this report as historical evidence; the bounded fix prompt below has been acted on. This publication did not independently rerun the follow-up tests. Read the latest progress handoff for continuation and approved D09.

## Verdict (at the reviewed commit)

The revision materially addresses multi-team membership and the original audit, but F01 is not fully closed and the persistence-failure demonstration omits kiosk mode. Complete the bounded follow-up below before treating Stage 2 as the final Stage 3 contract. No Stage 3 implementation or production action was performed by this review.

## Findings

### R01 — P2: Retired history is still hidden in two reporting paths

`src/prototype/screens/ProgressScreen.tsx:33,76–78,148` filters retired players out of `roster`, then reuses that list for historical All teams. Selecting a specific historical team instead includes retired players through `historicalTeamRows`. The same player therefore disappears when broadening the report to All teams. A retired player with only unknown legacy membership has no specific-team route to recover their row.

Separately, the attribution/filter controls require at least one currently active sub-team. Retiring every sub-team removes access to historical team filtering despite retained snapshots. This leaves the retired-history portion of original F01 unresolved.

Reproduced with rendered-component tests: retire fixture Alex while retaining attendance; historical All teams omits the renamed audit player, selecting Blue 7th shows them. Retire every fixture team; Team at session control is absent. Fix historical All teams to include historical attendees regardless of current retirement, and expose historical controls whenever relevant history exists.

### R02 — P2: Kiosk check-in still conceals local persistence failure

`src/prototype/PrototypeApp.tsx:49–67` returns the kiosk before rendering `PersistenceFailureBanner`. `src/prototype/screens/KioskScreen.tsx` displays successful check-in/undo feedback without consulting `localPersistenceFailed`.

Reproduced using the revision's simulated-storage-failure path: open kiosk, enter 7, select a matching card; the component shows "You're checked in" with no failed-save warning. This is a prototype feedback gap, not a claim about a deployed backend. Show a kiosk-appropriate warning and qualify unsuccessful-save feedback without exposing coach navigation. Real durable writes and recovery remain later-stage work.

## Independent verification

- Reviewed the remote branch in `/private/tmp/kaizen-revision-review`, exported from Git without switching the user's checkout.
- Type checking passed. Production build passed to `/private/tmp/kaizen-revision-build`.
- Full branch suite: 31 tests passed, one failed (LaunchPage's existing dated preset assertion); stats.test.ts separately failed collection due to missing configuration. All 16 added prototype tests passed. These match the previously recorded baseline failure categories; the suite is not fully green.
- Production CSS hash remains `index-DZ3ExIO7.css`; JavaScript is now `index-CAFHf2CU.js`. The shared dialog ref-forwarding change affects the production bundle. This is disclosed in Claude's detailed progress document; "production unaffected" is too broad if understood as byte-identical. No live deployment was performed.
- Three additional temporary rendered-component tests reproduced R01's two cases and R02 (3/3 reproductions passed). These assertions document the defects; they are not acceptance tests showing correct behavior. Test harness: `/private/tmp/kaizen-revision-review/src/prototype/review-regressions.test.tsx`; output: `/private/tmp/kaizen-review-regressions.log`. Local storage was replaced with an in-memory test adapter due to this Node environment; failures were exercised with the existing prototype simulation.
- This review did not independently repeat Claude's 36 browser checks or assess screen-reader/device behavior. No Supabase, database, migrations, backend authorization, deployment, merge or push was performed. Existing `.DS_Store` changes were preserved.
- F02, F03, F04 and F05 have corresponding source changes; pure-function tests cover F02/F03/F05. The duplicate-edit tests use a validation helper that is not the actual UI save path; add/edit component regression coverage would strengthen future protection.

## Exact next-stage handoff

Next action is a small Stage 2 follow-up, not Stage 3. Use Claude Sonnet with High effort (continuing the revision task is appropriate).

```text
Continue only johnfreyman/kaizen-tracker from claude/dazzling-sagan-hxrwfp
at 92eb4df or its verified descendant. Preserve unrelated changes. Keep
fixture-only scope and the exact branch's no-deploy guard. Do not deploy,
merge, access production, add migrations, or begin Stage 3.

Read simplification spec/progress/audit and the independent revision review.
Close R01: historical All teams must include retired attendees and unknown
legacy history; historical controls must remain available after every team
is retired. Preserve deduplicated totals and current-roster behavior.
Close R02: expose local-save failure inside kiosk and avoid unqualified
successful check-in/undo feedback when persistence failed. Keep coach
navigation protected. This does not require the real offline backend yet.

Add committed component regressions for retired historical All teams,
all-teams-retired historical navigation, and kiosk failed-save feedback.
Exercise recovery from failure. Verify the actual add/edit Save controls
reject duplicate cards and preserve the valid stored identity.
Run focused tests, type/build checks, and phone/tablet walkthroughs.
Report existing suite failures separately. A shared dialog change means the
production bundle can change even though prototype code stays excluded.

Update progress/audit statuses and retain the Stage 3 handoff. STOP after
this follow-up. Carry unresolved product policies forward explicitly;
prototype defaults are not owner approval.
```

After that follow-up, resolve consequential open product policies and arrange an isolated database before Stage 3 schema/migration rehearsal. The existing revision progress document lists PIN replacement, backdated raffle assignment, pending offline finish, retirement, kiosk routing and session targeting; do not silently convert these recommendations into approved requirements.


## Approved scope update — offline gym use (D09)

The owner subsequently approved reliable offline gym use. Read D09 and the latest final handoff in `simplification-progress.md` before continuing. Prepared-device offline reopening and multiple locally finished sessions awaiting synchronization are now required; pending-finish blocking is no longer an open decision. Initial attendance scope is one iPad per session, with synchronized online raffle draws. Claude subsequently addressed R01/R02 in `3f1d398`; this publication does not independently verify those fixes or claim full offline operation is implemented. Stage 3 must account for the expanded queue/cache contract; actual offline coach/kiosk implementation and device acceptance stay in their assigned later stages. These documents are published on the revision branch alongside its existing follow-up history.
