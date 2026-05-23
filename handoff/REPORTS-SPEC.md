# Reports + Analytics — Combine into one page

Pair this folder with `Reports Combined.html` at the project root. That's
the visual target; open it in a preview tab alongside Antigravity while
you run the tickets.

The goal: replace `SummaryPage.tsx` ("Reports") and `ChartsPage.tsx`
("Analytics") with a single **Reports** page that pairs tables and
charts, adds a date range filter + per-session roster chips for billing,
and surfaces a few derived insights (top attendee, longest streak,
needs follow-up).

Run the tickets **in order**. Each is small enough for one PR.

---

## Files referenced

| Path | Purpose |
|---|---|
| `Reports Combined.html` (project root) | Self-contained mock of the target. |
| `js/insights-page.jsx` | React source of the mock — useful to crib from. |
| `src/app/components/SummaryPage.tsx` | Current "Reports" page — being replaced. |
| `src/app/components/ChartsPage.tsx` | Current "Analytics" page — being deleted. |
| `src/app/App.tsx` | Nav config — `summary` stays, `charts` removed. |
| `src/lib/stats.ts` | Existing `calculateTotals` / `percent` — keep, extend. |

---

## Conventions

- Open `Reports Combined.html` in a side panel so the agent can see
  the target visually.
- Paste each prompt **verbatim** — they're written for copy-paste.
- After each ticket: `npx tsc --noEmit` and `npm run dev`; the dashboard
  should still load.
- Tailwind classes used in the mock are all already in the codebase
  (this is the same palette `SummaryPage.tsx` uses). No new tokens.

---

## Model selection

| Ticket | Model | Why |
|---|---|---|
| 1 — Stats helpers | **Gemini 3.5 Flash (Medium)** | Pure functions + unit tests. |
| 2 — Combined page | **Claude Sonnet 4.6 (Thinking)** | React + Tailwind layout work. |
| 3 — Nav + delete `ChartsPage` | **Gemini 3.5 Flash (Medium)** | Find-and-replace. |
| 4 — Move Session log to Session page | **Claude Sonnet 4.6** | Small refactor across two files. |
| 5 — CSV export (optional) | **Claude Sonnet 4.6** | Small new utility. |

If a ticket fails on the cheap model, retry once on the next tier up.

---

## Ticket 1 — Extend `stats.ts` with the derived metrics

**Goal:** All the new numbers the combined page needs (attendance rate,
streaks, day-of-week breakdown, monthly trend) live in `src/lib/stats.ts`
so the component stays presentational.

**Files:** `src/lib/stats.ts`, new `src/lib/stats.test.ts`.

**Prompt to paste:**

> In `src/lib/stats.ts`, add the following exported pure functions. Import `TeamEvent` and `EVENT_TYPES` from `@/app/hooks/useTeamStore` like the existing code does.
>
> 1. `filterEventsByRange(events: TeamEvent[], days: number | "all"): TeamEvent[]` — returns events from the last `days` (inclusive) or all if `"all"`.
> 2. `playerAttendance(events, roster, guestPlayers): Array<{ name: string; practice: number; training: number; attended: number; missed: number; rate: number; streak: number; bestStreak: number }>` — `rate` = attended ÷ total practices; `streak` = current consecutive practice attendance (chronological), `bestStreak` = max ever. Guests are excluded.
> 3. `monthlyTrend(events, roster, guestPlayers): Array<{ label: string; hours: number; attendance: number }>` — `label` is short month ("Mar"), `attendance` is avg practice attendance % across regular players.
> 4. `dayOfWeekBreakdown(events, roster, guestPlayers): Array<{ day: "Sun"|"Mon"|…; sessions: number; attendance: number }>` — practices only, days with no sessions omitted.
> 5. `insightsFromAttendance(att)` — returns `{ topAttendee, needsLove, longestStreak }` picking by `rate`, `rate` ascending, and `bestStreak` respectively.
>
> Crib the math from `js/insights-page.jsx` in this repo — its `useStats` hook does exactly this. Replace the inline `useMemo` calculation with calls to these helpers in the React port (Ticket 2).
>
> Add `src/lib/stats.test.ts` covering: empty events, all-guest event, single practice with one absentee, streak math (3 in a row → streak: 3, miss → 0).
>
> Run `npx tsc --noEmit` and `npx vitest run` and paste any failures.

**Acceptance:** new helpers exported and unit-tested; existing
`calculateTotals` and `percent` untouched.

---

## Ticket 2 — Replace `SummaryPage.tsx` with the combined view

**Goal:** Port the React mock at `js/insights-page.jsx` to TypeScript at
`src/app/components/SummaryPage.tsx`. Same content, same sections, same
behaviour.

**Files:** `src/app/components/SummaryPage.tsx` (rewrite).

**Prompt to paste:**

> Open `Reports Combined.html` and `js/insights-page.jsx` in a side panel — that's the design target. Rewrite `src/app/components/SummaryPage.tsx` to render the same layout in TypeScript.
>
> Use the helpers added in Ticket 1 from `@/lib/stats`. Read events / roster / guestPlayers from `useTeamStore` exactly like the current `SummaryPage` does. Charts come from the `recharts` package already in `package.json` (see `ChartsPage.tsx` for the import shape).
>
> Sections, in order:
> 1. **Header bar** — small "Reports" eyebrow, "Team performance" h1, subtitle with event/player counts, date-range pill group (`30d` / `90d` / `6m` / `All`), Export button (no-op for now — Ticket 5).
> 2. **KPI strip** — 5 tiles: Events, Practice hrs, Optional hrs, Avg attendance, Guest appearances.
> 3. **Insights row** — 3 callout cards from `insightsFromAttendance`: Top attendee (emerald), Longest streak (indigo), Needs follow-up (amber). Each card: icon + uppercase label + name + one-line detail.
> 4. **Trends + Day-of-week** — 2-col grid. Left: `AreaChart` of hours + attendance % over months. Right: `BarChart` of sessions and attendance % by day of week, with a short insight callout under it if any day's attendance is more than 10pts below the team average.
> 5. **Players** — single card. Left half: vertical bar chart of attendance %. Right half: sortable table (`Player` / `Att %` / `Prac h` / `Opt h` / `Streak`). Click a row to expand a session-by-session timeline strip (indigo square = attended, gray = absent). Color-code the Att % cell: ≥80% emerald, ≥50% amber, else rose.
> 6. **Session log** — collapsible (`<details>`). When expanded, list the most recent 20 sessions. Each session shows **every player as a chip**, with guests styled amber + ring (`bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200`) so a coach can see who was present for billing. Per-row "Copy roster" button copies the comma-joined player list to clipboard via `navigator.clipboard.writeText`.
>
> Remove the "Archive Logged Events" button from this page — it doesn't belong in a stats view. Move it to `SettingsPage.tsx` instead (small action card titled "Archive logged events", same confirm dialog).
>
> Keep all existing data flow: don't change `useTeamStore`. Don't import `figma/ImageWithFallback`. Use `lucide-react` icons matching the mock (`BarChart3`, `Clock`, `TrendingUp`, `Users`, `Calendar`, `Award`, `Flame`, `AlertTriangle`, `Download`).
>
> Run `npx tsc --noEmit` and `npm run dev`. Paste any errors.

**Acceptance:** Reports page in the running app matches `Reports Combined.html`; every section works on real `useTeamStore` data; archive moved to Settings.

---

## Ticket 3 — Remove the Analytics nav entry and delete `ChartsPage`

**Goal:** Drop the second nav item now that its content lives in Reports.

**Files:** `src/app/App.tsx`, delete `src/app/components/ChartsPage.tsx`,
`src/app/components/CommandPalette.tsx`.

**Prompt to paste:**

> 1. In `src/app/App.tsx`:
>    - Remove the `charts` entry from the `Page` union type.
>    - Remove `charts: "Analytics"` from `PAGE_TITLES`.
>    - Remove the `{ id: "charts", label: "Analytics", icon: TrendingUp }` item from `mainNavItems`.
>    - Remove `"charts"` from `NAV_ORDER`.
>    - Remove the import of `ChartsPage` and its route render.
> 2. In `src/app/components/CommandPalette.tsx`, remove the `nav-analytics` command entry.
> 3. Delete `src/app/components/ChartsPage.tsx`.
> 4. Run `npx tsc --noEmit` and `npm run dev`; verify Reports still loads and the sidebar no longer shows Analytics.

**Acceptance:** Analytics is gone from the sidebar, command palette, swipe nav, and the codebase. No TypeScript errors.

---

## Ticket 4 — Move the session log off Reports onto the Session page

**Goal:** The session log is operational data, not a report. Reports
keeps a *summary* of recent sessions (the collapsed `<details>`); the
full historical list lives on the Session page.

**Files:** `src/app/components/LaunchPage.tsx` (or wherever the Session
page lives — check `App.tsx`'s `launch` route),
`src/app/components/SummaryPage.tsx`.

**Prompt to paste:**

> 1. On the Session page, add a "Past sessions" section below the existing setup UI. Render the same per-session card from `SummaryPage`'s session log — every player as a chip, guests amber, "Copy roster" action. Paginate or virtualize past 20 rows if the team has many events.
> 2. On `SummaryPage`, change the Session log section: keep the collapsed `<details>` but cap it at the most recent 10 sessions, and replace "View all sessions →" with a link/button that navigates to the Session page.
> 3. Run `npx tsc --noEmit` and `npm run dev`.

**Acceptance:** Session page shows the full chronological log; Reports shows the most-recent 10 with a clear link to the full list.

---

## Ticket 5 — CSV export (optional follow-up)

**Goal:** The Export button in Reports actually exports.

**Files:** new `src/lib/csv.ts`, `src/app/components/SummaryPage.tsx`.

**Prompt to paste:**

> Add `src/lib/csv.ts` with a single `exportReportCSV(opts: { events, roster, guestPlayers, range })` function. Output two sheets joined by a blank line:
>
> 1. Per-player totals: `Player,Practice Hours,Optional Hours,Total Hours,Practice Attendance %,Current Streak,Best Streak`
> 2. Per-session log: `Date,Type,Duration,Player Count,Players` (comma-quoted)
>
> Use the helpers from Ticket 1 — no duplicate math. Trigger a download via a `Blob` + temporary `<a download>`.
>
> Wire it to the Export button in `SummaryPage.tsx`. Filename: `team-report-${range}-${YYYYMMDD}.csv`.

**Acceptance:** clicking Export downloads a well-formed CSV that opens cleanly in Excel and Google Sheets.

---

## Out of scope (good follow-ups, separate PRs)

- **Per-player drill-in page.** The mock's expand-on-row timeline is OK
  for now. A real `/players/:name` view (full session list, parent
  contact, notes) is its own ticket.
- **Compare to previous period.** "↑ 12% vs. last 30 days" badges on
  the KPI strip — needs a second `useStats` call and a delta helper.
- **Calendar heatmap.** Alternative to the day-of-week bar chart for
  teams that practice on irregular schedules.
- **Saved views.** Persist the date-range pick across reloads (probably
  in `localStorage`, key it per coach).

---

## If something goes off the rails

The combined page is the largest piece. If Ticket 2 produces a mess,
split it: do the header + KPI strip first as one PR; trends + day-of-week
as a second; Players section as a third; Session log as a fourth. Each
slice still renders the existing data, so you can ship them
incrementally behind the same nav entry.
