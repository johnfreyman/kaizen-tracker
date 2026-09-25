# Next task: expected-team practice selection (Stage 2 only)

Recommended model: Claude Sonnet, High effort.

```text
Work only in johnfreyman/kaizen-tracker on claude/dazzling-sagan-hxrwfp.
Pull the latest branch, including the planning update after 79f4021, before
editing. Read repository instructions and docs/simplification-spec.md,
docs/simplification-progress.md, docs/simplification-analytics-inventory.md,
and the audit/revision-review documents. Preserve unrelated changes.

Implement only a focused Stage 2 fixture-prototype update:

1. Start Practice opens “Who’s expected?” with selectable active team cards,
   an explicit All Kaizen choice and a Take attendance button. Select one or
   several teams. With no sub-teams, show the default Kaizen choice. Do not
   silently interpret an empty selection as everyone. Cancel must not create
   an orphan session or overwrite an existing one.
2. On confirmation, save selected team IDs and a deduplicated snapshot of
   expected player IDs with the practice. A player on two selected teams is
   expected once. Attendance, membership snapshots and expected-player
   snapshots are distinct. Later roster edits/filtering cannot change who
   was expected in that saved practice. Retain the snapshot across refresh.
3. Continue into the existing coach/kiosk attendance flow. Preserve number
   lookup (0 versus 00), undo, exit, save-failure feedback and retired-history
   fixes. One attendee receives one 1.5-hour practice credit and no ticket.
4. Start Optional Training still opens attendance directly and never imposes
   a practice-absence penalty. Keep date entry discreet; add no time or
   duration controls.
5. Add fixtures and committed tests with known expectations: a shared-team
   player selected once; another team's player not expected; changing later
   membership does not rewrite saved expectations; expected A/C, present A,
   absent C = 50%, with B for another team excluded from missed practices and
   streak sequence. Expose a small fixture demonstration of expected-only
   practice attendance/streak behavior; do not rebuild all analytics yet.
6. Exception handling (excused absences, editing an already-saved expected
   list, unexpected attendance and streak treatment) remains separate policy.
   Label any demonstration assumptions; do not silently settle them. Do not
   auto-add unexpected players to expectations merely for marking present.

D09 offline gym use remains approved and must be retained in the Stage 3
handoff: prepared-device offline reopening, multiple completed unsynced
sessions beside the next active one, safe replay and no duplicate credit.
Do not implement or claim a real service worker, offline queue or backend in
this fixture stage. Raffle draws require synchronization in the final app.

D11: the owner confirms existing accounts/players/events are test/sample
records. Drop unnecessary real-history reconstruction from the Stage 3
handoff. This does not authorize deleting test accounts, resetting any
existing database or changing production. Once launched, history must be
preserved. D12: keep the original rich analytics inventory as Stage 6 scope;
the prototype totals table is not the finished reporting feature set.

Verify type/build checks, committed component/domain tests, and phone/tablet
walkthroughs of practice selection, cancel, refresh, deduplication and direct
training entry. Report existing failures separately from new regressions.
Keep prototype code out of the production build. Preserve the exact branch's
no-deploy guard before pushing. No production calls, migrations, deployment,
merge, backend authorization changes or Stage 3 implementation.

Update progress with actual results, limitations and the exact Stage 3
handoff. Stage 3 must store expected-player sets and support original report
metrics, multiple memberships, offline operations and independent raffle
rounds in an isolated database. STOP after this prototype update for review.
```
