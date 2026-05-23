# Light mode contrast fix — wire components to the theme tokens

`theme.css` defines a full light-mode palette under `.mc-light`
(`--mc-text-primary`, `--mc-text-secondary`, `--mc-text-muted`,
`--mc-card-border`, etc.). It works in isolation — but most components
write `text-white/85`, `text-white/45`, `text-white/25`, etc. as
hardcoded Tailwind classes. Those stay white regardless of mode, so when
the surface flips to light the text becomes invisible.

This handoff swaps the hardcoded white-alpha classes for utility classes
that read from the `--mc-text-*` tokens, so light mode actually works
without having to touch every call site twice.

---

## Recommended approach

**Don't** add `dark:` / light variants per element — that doubles every
className and is easy to miss. Instead introduce three utility classes
that read the existing tokens, then sweep-and-replace the hardcoded
classes by alpha tier.

| Hardcoded class                            | Replace with        | Reads token              |
|--------------------------------------------|---------------------|--------------------------|
| `text-white/85`, `text-white/80`, `text-white/90`, `text-white` | `mc-text`           | `--mc-text-primary`      |
| `text-white/45`, `text-white/50`, `text-white/55`, `text-white/60`, `text-white/65`, `text-white/70`, `text-white/75` | `mc-text-secondary` | `--mc-text-secondary`    |
| `text-white/20`, `text-white/25`, `text-white/30`, `text-white/35`, `text-white/40` | `mc-text-muted`     | `--mc-text-muted`        |

Borders + dividers follow the same pattern — `border-white/[0.07]` etc.
becomes `mc-border`.

---

## Model selection

| Ticket | Model | Why |
|---|---|---|
| 1 — Add utility classes | **Gemini 3.5 Flash (Medium)** | Two-line CSS additions. |
| 2 — Sweep `App.tsx` (sidebar) | **Claude Sonnet 4.6** | Highest-traffic shell; needs review. |
| 3 — Sweep other components | **Claude Sonnet 4.6 (Thinking)** | ~20 files, watch for false positives. |
| 4 — Visual smoke test | **Gemini 3.5 Flash (Medium)** | Mechanical screenshot pass. |

---

## Ticket 1 — Add tokenized utility classes

**Files:** `src/styles/theme.css`.

**Prompt to paste:**

> At the bottom of `src/styles/theme.css`, before the final closing braces, add a `@layer utilities` block with these classes. Each reads from the existing CSS variables defined above so light-mode overrides apply automatically.
>
> ```css
> @layer utilities {
>   .mc-text             { color: var(--mc-text-primary); }
>   .mc-text-secondary   { color: var(--mc-text-secondary); }
>   .mc-text-muted       { color: var(--mc-text-muted); }
>   .mc-border           { border-color: var(--mc-card-border); }
>   .mc-card             { background-color: var(--mc-card); border-color: var(--mc-card-border); }
>   .mc-card-hover:hover { background-color: var(--mc-card-hover); }
>
>   /* Hover variants — match how the hardcoded `hover:text-white/75` etc. were used */
>   .hover\:mc-text:hover           { color: var(--mc-text-primary); }
>   .hover\:mc-text-secondary:hover { color: var(--mc-text-secondary); }
> }
> ```
>
> Don't change anything else. Confirm `npm run dev` still compiles.

**Acceptance:** classes exist; site still loads; visual unchanged so far.

---

## Ticket 2 — Convert the sidebar in `App.tsx`

The sidebar (in `src/app/App.tsx`) is the worst offender — team name,
nav labels, leaderboard heading, Log out button all use `text-white/*`.
It's also small enough to fix in one pass, so do it first as a proof.

**Files:** `src/app/App.tsx`.

**Prompt to paste:**

> In `src/app/App.tsx`, replace every hardcoded `text-white/N` class inside the `<aside>` sidebar (lines ~123–200) and the bottom mobile nav (~270–290) with the new tokenized utilities:
>
> - `text-white`, `text-white/80`, `text-white/85`, `text-white/90` → `mc-text`
> - `text-white/45`, `text-white/55`, `text-white/65`, `text-white/70`, `text-white/75` → `mc-text-secondary`
> - `text-white/20`, `text-white/25`, `text-white/30`, `text-white/35`, `text-white/40` → `mc-text-muted`
> - `hover:text-white/60`, `hover:text-white/75`, `hover:text-white` → `hover:mc-text-secondary` or `hover:mc-text` (use `mc-text` for the strongest hover)
> - `border-white/[0.07]` → `mc-border`
> - `hover:bg-white/[0.05]` → keep as-is — these read fine in both modes because they're alpha-on-token-bg.
>
> Two exceptions — DO NOT change these because they sit on top of a permanently-blue/indigo gradient background:
> - The team-logo trophy `<Trophy className="size-4 text-blue-400" />` — leave.
> - Any text inside the `LeaderboardTicker` gradient bar — leave.
>
> Run `npm run dev`. Toggle the theme (via `useTheme`) and confirm the sidebar nav labels, leaderboard names, and Log out button are now readable in **both** light and dark mode. Take screenshots of both and attach to the PR.

**Acceptance:** sidebar labels, leaderboard list, Log out button, mobile nav all readable in both modes. No `text-white/*` classes remain inside `<aside>` or the bottom `<nav>`.

---

## Ticket 3 — Sweep the remaining components

Once Ticket 2 looks right, do the rest. Group them so each PR is small.

**Group A (high traffic):**
- `src/app/components/MissionControlDashboard.tsx`
- `src/app/components/SidebarLeaderboard.tsx`
- `src/app/components/SessionStatusBar.tsx`
- `src/app/components/RecentActivityFeed.tsx`

**Group B (specialty surfaces — review carefully):**
- `src/app/components/LeaderboardStrip.tsx`
- `src/app/components/RewardsCard.tsx`
- `src/app/components/TrainingSummaryCard.tsx`
- `src/app/components/CommandPalette.tsx`

**Group C (gradients — usually leave alone):**
- `src/app/components/LoginPage.tsx` — sits on permanent dark gradient. Skip.
- `src/app/components/ResetPasswordPage.tsx` — same. Skip.
- `src/app/components/LaunchPage.tsx` — only the hero gradient block. Inspect each occurrence.
- `src/app/components/AttendancePage.tsx` — only colored buttons. Skip those.
- `src/app/components/RafflePage.tsx` — buttons on gradient. Skip those.

**Prompt to paste (run once per group):**

> Open the files in Group A (or B). For each file, replace `text-white/N` with the tokenized utilities using this mapping:
>
> | Original | Replacement |
> |---|---|
> | `text-white/80`, `text-white/85`, `text-white/90`, `text-white` (alone) | `mc-text` |
> | `text-white/45`, `text-white/50`, `text-white/55`, `text-white/60`, `text-white/65`, `text-white/70`, `text-white/75` | `mc-text-secondary` |
> | `text-white/20`, `text-white/25`, `text-white/28`, `text-white/30`, `text-white/35`, `text-white/40` | `mc-text-muted` |
>
> **Important — DO NOT replace** any `text-white/N` class that appears on an element whose **parent** has a `bg-blue-*`, `bg-indigo-*`, `bg-gradient-*`, `bg-red-*`, `bg-emerald-*`, `bg-amber-*` etc. background — those backgrounds stay colored in light mode, so the text should remain white. Look at the parent chain before each substitution.
>
> Also leave alone:
> - `border-white/[N]` inside gradient/colored panels.
> - Any `bg-white/[N]` (these are alpha-on-token; they work in both modes).
>
> After each file, run `npm run dev` and screenshot the relevant page in both light and dark mode. Paste both screenshots in the PR description.

**Acceptance per group:** every page that the modified components feed into is readable in both themes; no regression in dark mode (token primary is still `rgba(255,255,255,0.90)` so it should look identical).

---

## Ticket 4 — Smoke test pass

**Files:** none (manual check).

Walk every screen in both themes. Anything still unreadable → file as
a follow-up bug with screenshot + file:line.

**Checklist:**

| Screen | Light | Dark |
|---|---|---|
| Login | ☐ skip (intentional gradient) | ☐ |
| Onboarding | ☐ | ☐ |
| Mission Control dashboard | ☐ | ☐ |
| Session setup (Launch) | ☐ | ☐ |
| Attendance | ☐ | ☐ |
| Reports (new combined page) | ☐ | ☐ |
| Raffle | ☐ | ☐ |
| Settings | ☐ | ☐ |
| Sidebar (every screen) | ☐ | ☐ |
| Mobile bottom nav | ☐ | ☐ |
| Command palette (`⌘K`) | ☐ keep dark | ☐ |
| Super-admin dashboard | ☐ | ☐ |

---

## Quick reference — why this works

The tokens are already correct:

```css
:root {
  --mc-text-primary:   rgba(255,255,255,0.90);   /* dark default */
  --mc-text-secondary: rgba(255,255,255,0.50);
  --mc-text-muted:     rgba(255,255,255,0.28);
}

.mc-light {
  --mc-text-primary:   rgba(0,0,0,0.88);          /* light override */
  --mc-text-secondary: rgba(0,0,0,0.55);
  --mc-text-muted:     rgba(0,0,0,0.35);
}
```

Once a component renders with `className="mc-text"` instead of
`text-white/85`, swapping the root class between `dark` and `mc-light`
re-paints every label automatically. No component-level light/dark
forks needed.

---

## Out of scope

- **Theme toggle UI.** `useTheme.ts` already exists; if there's no
  visible toggle, that's a separate small task (probably one button in
  Settings).
- **Chart colors.** `recharts` strokes are hardcoded hex in
  `ChartsPage` / `SummaryPage`. They're fine on light surfaces but
  could be tokenized for consistency later.
- **Status pills** (`bg-emerald-50 text-emerald-700` etc.) — these
  already work in both modes; leave them.
