# Stage 2 prototype audit

Audited: 2026-09-20. Source commit: `d54c587ed4bdb10d23122b8357ba849348da8278` on `claude/stage-2-prototype`.

## Verdict

The main coach/kiosk flow is a useful basis for the product. Keep the design direction, but complete a focused Stage 2 revision before treating its data/reporting behavior as the Stage 3 contract. This is a fixture-only prototype, not evidence of production reliability. This audit changes documentation only; it does not fix the findings or start another implementation stage.

The owner has now confirmed **multiple simultaneous sub-team memberships** and **one jersey number per player across every team** (D07–D08). The original single-membership assumption was labeled correctly when built, but is now superseded. Use one stable player, multiple memberships, one number, one attendance per session and one optional-training ticket per attendance.

## Findings

All priorities below refer to correcting the prototype/next-stage contract; these are not newly shipped production regressions.

### F01 — P2: Historical team filtering uses current membership

Source: [ProgressScreen.tsx](../src/prototype/screens/ProgressScreen.tsx), lines 22–44.

**Browser reproduction:** in Roster, move fixture Alex M. from Blue 7th to Gray 7th. In Progress select Team at session, then Blue 7th: Alex disappears. Select Gray 7th: Alex appears with 8 hours even though the historical Group cell says Blue 7th / Unknown. The mode changes the group label but still filters by `player.subTeamId` and calculates all-time totals.

**Required correction:** in historical mode, filter attendance using session membership snapshots, then calculate totals from those qualifying records. Preserve unknown membership explicitly and retain access to retired groups/players' history. With multiple memberships, deduplicate player/session records in whole-program totals; make any overlapping team totals explicit. Test a transfer and a shared-team player with known expected sums, not only the presence of labels.

### F02 — P2: Editing bypasses the duplicate-card validation

Source: [RosterScreen.tsx](../src/prototype/screens/RosterScreen.tsx), lines 150–183; [store.tsx](../src/prototype/store.tsx), `updatePlayer`.

**Browser reproduction:** edit Alex M.'s label to R., matching the other Alex #12, then click Done. The screen warns that two cards are identical, but commits the change anyway; it remains after refresh. Inline editing writes each keystroke directly to the store. Blank names are also allowed by that path (source inspection).

**Required correction:** draft edits with explicit Save/Cancel and the same trimmed-name/card-distinction validation as Add. Block ambiguous or empty committed identities while preserving the existing valid card. Multi-team badges should help recognition, but must not be used as mutable identity keys or to excuse identical player cards. Test add and edit paths, including refresh after a rejected edit.

### F03 — P2: The new-coach fixture defaults raffle to off

Source: [fixtures.ts](../src/prototype/fixtures.ts), lines 193–213.

**Browser reproduction:** select Empty roster in Walkthrough controls, then Settings: Raffle is off. That scenario is explicitly described as a new coach, but inherits `raffleEnabled: false` from the common fixture base. It does not demonstrate R10/A17.

**Required correction:** a genuinely new-coach fixture starts enabled. Retain a separate existing-coach/off fixture for testing accrued-ticket activation and preservation of explicit old settings. Test both rather than changing every scenario to on.

### F04 — P2: A closed-session kiosk has no coach escape

Source: [KioskScreen.tsx](../src/prototype/screens/KioskScreen.tsx), lines 36–50; [PrototypeApp.tsx](../src/prototype/PrototypeApp.tsx), kiosk binding restoration.

**Source-confirmed:** `closedElsewhere` returns only a notice before rendering the number pad or exit handler. The kiosk binding survives refresh. If the bound session closes, the coach cannot enter the code to recover, and normal coach navigation is intentionally absent. This closed-kiosk transition was not independently reproduced through the current walkthrough controls; they disappear inside kiosk.

**Required correction:** keep check-in disabled but offer a code-protected coach exit/reconciliation route from the closed-session state. Do not automatically reveal the coach dashboard to players. Add a fixture/test that reaches closure while kiosk is active, verifies refresh remains closed, and verifies coach recovery.

### F05 — P2: Ticket derivation conflates initial migration eligibility with later archive status

Source: [store.tsx](../src/prototype/store.tsx), lines 406–415.

**Source-confirmed:** `ticketLines` excludes every archived training regardless of its immutable round. D03 excludes archived history when seeding the *first* current pool; P10/A14 then require archive/restore to preserve that round's eligibility. Reusing this helper for future archive behavior would remove a current-round ticket when its session is archived and revive it on restore. There is no archive action in this prototype, so this is a contract/helper defect, not a claimed browser reproduction.

**Required correction:** assign migrated archived fixtures to non-current rounds; derive current eligibility from round assignment and attendance, not a perpetual archive exclusion. Include a current-round archived fixture and demonstrate unchanged ticket count on archive/restore. Keep old archived fixtures out of the initial current pool.

## Approved scope update U01 — multiple teams, one player number

Source: [types.ts](../src/prototype/types.ts), `Player.subTeamId` and scalar `teamAtSession`; corresponding roster, attendance, kiosk, settings counts and Progress consumers.

Replace scalar membership with a membership set/list in the prototype and a many-to-many contract for Stage 3. Keep jersey number on the player. Add fixtures where one player belongs to Blue 6th and Blue 7th. Show them once in All teams/kiosk, in either matching team filter, and preserve their other membership when one is removed. One training must yield one attendance, 1.5 hours and one ticket, even when filtering between both teams. Historical snapshots contain membership sets and survive later edits.

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

## Limits and follow-through

- Local persistence failures are swallowed in `store.tsx` despite the “Saved on this device” label and a comment claiming they surface in the dev panel. Keep this as an explicit reliability limitation; the revision should demonstrate a visible persistence-failed state. Stage 4 must persist intent before successful feedback and prove real recovery.
- PIN replacement, backdated-training round assignment, pending-finish policy, retirement, session targeting and overlapping-team attribution remain recommendations unless separately confirmed. “On the right track” is not blanket approval of every data policy.
- The previous 63 browser checks were reported by Claude but no corresponding test file appears in the branch diff. Commit focused regressions for the revised membership/filtering/validation behaviors so the next reviewer can reproduce them.
- Reuse accessible dialog primitives for the activation dialog before shipping: `aria-modal` alone does not implement focus trapping, Escape dismissal or focus return. Full screen-reader/device testing was not performed here.
- No real database, RLS, auth, service worker, real network outage, custom-PIN flow or full six-journey regression was claimed by this audit. Backend security and migration checks belong to subsequent isolated stages.

## Recommended next steps

1. **Stage 2 revision — Claude Sonnet, High thinking:** implement U01 and F01–F05 in the fixture prototype, add focused repeatable tests and update the walkthrough. Do not start database work.
2. Review the revised multiple-membership flows and explicitly resolve remaining data policies before the affected Stage 3 operations are finalized. Unresolved policies may remain documented gaps; do not silently cement them as defaults because a prototype used them.
3. **Stage 3 — Claude Opus 5, High thinking:** isolated additive data foundation and migration rehearsal, with stable player IDs, player-owned jersey numbers, many-to-many membership, membership snapshots and idempotent attendance/round operations. No production changes.

The exact next-task prompt is in [simplification-progress.md](simplification-progress.md).
