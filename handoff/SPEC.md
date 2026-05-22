# Super Admin Dashboard — V2 Implementation Spec

This folder is a handoff package for replacing the existing
`src/app/components/SuperAdminDashboard.tsx` with the V2 layout that
addresses the issues called out in design review (claustrophobic list,
fabricated metrics, mis-labelled charts, single-stage purge flow).

Run the tickets below **in order**. Each is small enough to land as
its own PR. Each lists a recommended Antigravity model — pick based on
how much credit you want to spend; the cheapest model that can do the
job is the right answer.

---

## Files in this package

| Path | Purpose |
|---|---|
| `SuperAdminDashboard-v2.html` | Self-contained mock of the target. Open in a browser to inspect. |
| `snippets/getPurgeState.ts` | Drop-in helper: returns lifecycle stage for unverified coaches. |
| `snippets/TeamLogo.tsx` | 44 px logo tile — `<img>` when `team_logo` set, otherwise generated monogram, otherwise dashed placeholder. |
| `snippets/PurgeBadge.tsx` | Stage-specific countdown pill (nudge / scheduled / imminent). |
| `snippets/VerificationTimeline.tsx` | Timeline panel + action buttons for the detail pane. |
| `SPEC.md` | This file. |

---

## Conventions used in every prompt

- Open `SuperAdminDashboard-v2.html` in a side panel so the agent can
  see the target visually.
- Paste the **whole prompt block** verbatim — they're written to be
  copy-pasted, not paraphrased.
- After each ticket: run `npx tsc --noEmit` and `npm run dev`; verify
  the dashboard still loads before merging.
- The Tailwind classes in the snippets use **only** classes already in
  the existing codebase. No new tokens, no `tailwind.config` changes.

---

## Model selection cheat-sheet

| Workload | Model | Why |
|---|---|---|
| Mechanical deletion, find-and-replace | **Gemini 3.5 Flash (Medium)** | Cheapest tier; no reasoning required. |
| React/Tailwind component rewrites | **Claude Sonnet 4.6 (Thinking)** | Best React + Tailwind output in the lineup; spends thinking on layout decisions. |
| Multi-file refactor across the dashboard | **Claude Code extension** | Has full-repo context, better at coordinated edits than the Antigravity-native modes. |
| Backend / SQL migration / cron design | **Claude Opus 4.6 (Thinking)** | Schema decisions are expensive to get wrong; pay for it once. |
| Typecheck / lint triage | **Gemini 3.5 Flash (High)** | Reading errors and summarizing — Flash is fine. |

If a ticket fails on the cheap model, retry once on the next tier up.
Don't start every ticket on Opus — you'll burn credits on work the
cheap models can do.

---

## Ticket 1 — Strip fabricated metrics

**Goal:** Remove the synthetic `error rate` / `pending sync` / `storage`
fabrications from `SuperAdminDashboard.tsx`. These derive their values
from a hash of `coach_id` and surface in KPIs, filter chips, row badges,
and the storage chart — admins act on numbers that aren't real.

**Recommended model:** Gemini 3.5 Flash (Medium) — pure deletion work.

**Files:** `src/app/components/SuperAdminDashboard.tsx`,
`src/app/components/admin/charts/DashboardCharts.tsx`.

**Prompt to paste:**

> In `src/app/components/SuperAdminDashboard.tsx`:
>
> 1. Delete the functions `getErrorRate`, `hasPendingSyncs`, and `getEstimatedStorage`.
> 2. In `getSemanticStatus`, remove the line that returns `"critical"` when `getErrorRate(row) >= 5.0`.
> 3. From `FILTER_OPTIONS`, remove the entries with id `"high-error"`, `"pending-sync"`, and `"large-storage"`.
> 4. From `matchesFilter`, remove the corresponding `case` branches.
> 5. From the `stats` `useMemo`, delete the `pendingErrors` and `failedSyncs` keys.
> 6. From `kpiCards`, delete the two cards keyed `"pending-errors"` and `"failed-syncs"`.
> 7. In the row-card render block, delete the badges keyed `isHighError` and `hasSyncs`. Keep the `Unverified`, `No Team Setup`, and `Inactive 30d` badges.
> 8. In `src/app/components/admin/charts/DashboardCharts.tsx`: remove the storage distribution chart and its props. We'll re-add it when we have real units; the current one renders KB values labelled "GB".
>
> Don't change anything else. Run `npx tsc --noEmit` and report any errors.

**Acceptance:** dashboard still loads; the four offending KPI cards
and the storage chart are gone; no TypeScript errors.

---

## Ticket 2 — Swap to V2 layout

**Goal:** Replace the 400-px master / right-detail layout with a
2-column card grid (~60% width) + collapsible 420-px detail pane.

**Recommended model:** Claude Sonnet 4.6 (Thinking).
*Or:* drive this through the **Claude Code extension** if you'd rather
have it edit `SuperAdminDashboard.tsx` and `TeamLogo.tsx` in one
coordinated pass.

**Files:** `src/app/components/SuperAdminDashboard.tsx`,
new `src/app/components/admin/TeamLogo.tsx`.

**Prompt to paste:**

> Open `handoff/SuperAdminDashboard-v2.html` in a preview tab so you can see the target layout.
>
> 1. Copy `handoff/snippets/TeamLogo.tsx` to `src/app/components/admin/TeamLogo.tsx`. Adjust the import path at the top if your alias differs (the file already uses `@/`).
> 2. In `src/app/components/SuperAdminDashboard.tsx`, replace the two-column master/detail body (the `<div className="flex-1 flex min-h-0 overflow-hidden">…</div>` block) with the V2 layout:
>    - Left side: a 2-column CSS grid of coach cards (`grid grid-cols-2 gap-2.5`). When the detail pane is collapsed, switch to `grid-cols-3`.
>    - Right side: a 420 px detail pane that contains the existing `<CoachDetailPanel>` when a coach is selected, the existing `<AdminActivityFeed>` otherwise. Add a collapse/expand button in its header.
>    - The list pane should be `flex-1 min-w-0`, the detail pane `w-[420px] shrink-0`.
> 3. Each card uses the new `<TeamLogo team={row.team_name} logoUrl={row.team_logo} size={44} />` at the top-left. Card content: team name (title), email + small avatar (subtitle), issue badges row, footer row with `session_count` / `player_count` / `relativeTime(last_active_at)`. Match the visual rhythm from the reference mock (rounded-xl, border-slate-200, hover:shadow-sm, selected = border-indigo-400 + ring).
> 4. Keep all existing functionality: keyboard nav, search, filters, sort, density toggle. Don't change `useTeamStore`, the data fetch, or `CoachSummaryRow`.
>
> Run `npx tsc --noEmit` and `npm run dev`. Paste any TypeScript or runtime errors.

**Acceptance:** dashboard loads with the new layout; cards lead with
team logo; detail pane collapses to show 3-column list; everything
that worked before still works.

---

## Ticket 3 — Purge lifecycle UI

**Goal:** Add the read-only purge lifecycle UI (no backend yet — that's
Ticket 4). Cards show a countdown pill, KPI strip gets a Purge queue
tile, detail pane gets a verification timeline.

**Recommended model:** Claude Sonnet 4.6 (Thinking).

**Files:** `src/app/components/SuperAdminDashboard.tsx`,
new `src/app/components/admin/PurgeBadge.tsx`,
new `src/app/components/admin/VerificationTimeline.tsx`,
new `src/app/components/admin/getPurgeState.ts`.

**Prompt to paste:**

> Copy these three files into the project:
>
> - `handoff/snippets/getPurgeState.ts` → `src/app/components/admin/getPurgeState.ts`
> - `handoff/snippets/PurgeBadge.tsx` → `src/app/components/admin/PurgeBadge.tsx`
> - `handoff/snippets/VerificationTimeline.tsx` → `src/app/components/admin/VerificationTimeline.tsx`
>
> Then in `src/app/components/SuperAdminDashboard.tsx`:
>
> 1. Import `getPurgeState` and `PurgeBadge`.
> 2. In the row card, when `getPurgeState(row)` is non-null, render `<PurgeBadge state={purge} />` and filter the generic "Unverified" badge out of the issues list (the purge pill carries that signal more usefully).
> 3. Add a new KPI tile labelled `Purge queue`: count = number of coaches where `getPurgeState(row)?.stage !== "nudge"`. Sub-label: `${imminent} in <7d` when imminent > 0, otherwise `"on the clock"`. Filter id `"purge-queue"`. Place it at the end of the strip.
> 4. Add `"purge-queue"` to `FILTER_OPTIONS` and to `matchesFilter` (returns true when stage is `"scheduled"` or `"imminent"`).
> 5. In `CoachDetailPanel` (or wherever the right pane renders the selected coach), render `<VerificationTimeline coach={coach} state={purge} />` when `getPurgeState(coach)` is non-null. Place it above the existing stat grid. Pass no-op handlers for now — Ticket 4 wires the actions.
>
> Run `npx tsc --noEmit` and confirm at least one coach in your dev DB shows the purge pill.

**Acceptance:** unverified coaches show a stage-coloured countdown
pill; Purge queue tile renders with a count; selecting an unverified
coach reveals the timeline panel in the detail pane.

---

## Ticket 4 — Backend (schema + worker)

**Goal:** Make the purge lifecycle real — schedule + send reminders,
soft-delete at day 90, hard-delete at day 365, log every transition.

**Recommended model:** Claude Opus 4.6 (Thinking) for the design pass,
then Claude Sonnet 4.6 for migration SQL. *Or:* use the Claude Code
extension for the whole ticket — it'll have your existing migrations
and Supabase setup in context, which matters here.

**Why a separate ticket:** this is where Antigravity is most likely to
guess wrong about your stack. Review the design output before letting
it write code.

**Phase 4a — schema design (Opus):**

> Read `migrations/001_schema.sql` through `migrations/006_activity_log.sql` and `src/app/components/admin/CoachDetailDrawer.tsx` (the `CoachSummaryRow` interface). Propose a migration that supports a 90-day verification purge lifecycle:
>
> - Track per-coach purge state without breaking the existing `admin_coach_summary_view`.
> - Idempotent: re-running the cron must not double-send reminders or re-purge an already-purged coach.
> - Soft-delete at day 90 (anonymize email, null team_name, retain row + aggregate counts for metrics). Hard-delete at day 365.
> - Every state transition writes to the existing `activity_log` table — use that, don't invent a parallel log.
> - Admin "Extend 30d" and "Purge now" actions must be expressible as RPCs.
>
> Output: a markdown design doc covering (a) schema changes, (b) the cron's pseudocode, (c) the RPC signatures, (d) edge cases (account with no `account_created_at`, already-deleted-but-row-extant, race between cron and admin action). **Do not write code yet.** I'll review the design first.

**Phase 4b — migration + cron (Sonnet, after you've reviewed 4a):**

> Implement the design from the previous message. Output one SQL migration `migrations/007_verification_purge.sql` and one Supabase Edge Function `supabase/functions/verification-cron/index.ts`. Update `admin_coach_summary_view` (likely a new migration 008 if the view depends on the new columns) so the dashboard query still works in a single round-trip. Don't touch `SuperAdminDashboard.tsx` — the read side already handles all of this through `getPurgeState`.

**Phase 4c — wire the admin actions (Sonnet):**

> Replace the no-op handlers in `VerificationTimeline` with calls to the RPCs defined in `007_verification_purge.sql`. `onResend` triggers a fresh verification email, `onExtend` calls `admin_extend_purge(coach_id)`, `onPurgeNow` calls `admin_force_purge(coach_id)` after a `confirm()`. All three should toast-on-success and refresh the coach row.

**Acceptance:** cron runs daily on Supabase scheduler; sending a test
unverified account through it produces the expected emails at T+1h /
T+3d / T+7d / T+30d and a soft-delete at T+90d; admin actions in the
dashboard succeed and appear in `activity_log`.

---

## Optional follow-ups

These aren't on the critical path but came up in the design review and
are worth tracking:

- **Filter combinator bug.** Multi-selecting `Healthy` + `Warning`
  returns zero results today because filters are AND'd. Treat status
  filters as OR within the status dimension; AND across dimensions.
- **Misleading 14-day session chart.** `last_session_at` is a single
  most-recent timestamp; the chart shows each coach only on the day of
  their *latest* session. Fix needs a real `sessions` table query, not
  the summary view. Tag with `// TODO(metrics-honest)` until then.
- **"Sessions Active Today" KPI label** doesn't match its value
  (`sessionsThisWeek`). Either rename or repoint.
- **Row a11y.** Card rows are `<div onClick>`. Convert to `<button>`
  or `role="option"` inside a `role="listbox"` parent.

---

## If something goes off the rails

Restore from main and split the failing ticket into smaller prompts —
"add the file, then wire it" is two prompts, not one. The agent does
much better when the unit of work is one file at a time.
