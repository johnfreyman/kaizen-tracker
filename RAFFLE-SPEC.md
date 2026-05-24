# Raffle page — visual + functional improvements

`src/app/components/RafflePage.tsx` works, but it has the same
light-card-on-dark-shell mismatch as the rest of the app and is missing
a few features coaches consistently ask for (recent winners, prize
labels, ineligible-player visibility). This handoff fixes both.

Run the tickets in order. Tickets 1–2 are visual and small. Tickets 3–5
are functional and can each ship independently.

---

## Files referenced

| Path | Purpose |
|---|---|
| `src/app/components/RafflePage.tsx` | The page being modified. |
| `src/app/hooks/useTeamStore.tsx` | Adds `raffleWinners` history (Ticket 3). |
| `src/lib/csv.ts` | New, or extend the one from `REPORTS-SPEC.md` Ticket 5. |

---

## Model selection

| Ticket | Model | Why |
|---|---|---|
| 1 — Theme the cards | **Claude Sonnet 4.6** | Layout + token swap, needs review. |
| 2 — Fix slice label rotation | **Claude Sonnet 4.6 (Thinking)** | Canvas math; the existing renderer is in this file. |
| 3 — Winners history + prize field | **Claude Sonnet 4.6 (Thinking)** | Touches `useTeamStore` schema. |
| 4 — Ineligible roster surface | **Gemini 3.5 Flash (Medium)** | Pure derivation + render. |
| 5 — Silent draw + exclude-recent toggle | **Claude Sonnet 4.6** | New UI controls. |

---

## Ticket 1 — Match the rest of the dark shell

**Goal:** Stop the page from looking like a different product. Drop the
cream/yellow hero entirely; convert both card surfaces to the dark token
treatment used elsewhere.

**Files:** `src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> In `src/app/components/RafflePage.tsx`:
>
> 1. **Delete the hero card** (the `<div className="bg-gradient-to-br from-white to-yellow-50 …">` block, ~lines 277–289). Replace with a slim header:
>    ```tsx
>    <div className="flex items-end justify-between flex-wrap gap-3">
>      <div>
>        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Raffle</div>
>        <h1 className="mt-1 text-2xl font-bold mc-text">Attendance prize wheel</h1>
>        <p className="mt-1 text-sm mc-text-secondary">Each optional training attendance earns one slice.</p>
>      </div>
>      {/* Ticket 3 will add a prize input + last-winner pill here */}
>    </div>
>    ```
> 2. **Convert the wheel card** (`<div className="lg:col-span-3 bg-white/90 …">`) and **entries card** (`<div className="lg:col-span-2 bg-white/90 …">`) to the dark surface used elsewhere — replace `bg-white/90 backdrop-blur-sm shadow-xl border border-gray-200` with `bg-white/[0.03] border mc-border`. Use the `mc-text*` utilities from `LIGHT-MODE-SPEC.md` Ticket 1 for the headings inside.
> 3. **Wheel canvas background**: the empty-wheel fill at the top of `drawWheel` (`ctx.fillStyle = "#eef3f8"`) should be `rgba(255,255,255,0.04)`; the outer stroke `"#153e75"` → `"rgba(255,255,255,0.12)"`. The full-wheel stroke `"#122033"` → `"rgba(0,0,0,0.5)"` (it's drawn on top of colored slices, dark outline reads in both modes).
> 4. **Spin button** stays as-is — the blue gradient is intentional brand and reads in both modes.
> 5. **"Wheel Entries" list rows**: replace `border-gray-200 bg-white` with `mc-border bg-white/[0.04]`. Replace `text-blue-700` count with `text-amber-400` (matches the eyebrow).
> 6. **Empty state**: replace the `bg-gray-50/60 border-dashed border-gray-300 text-gray-500` block with `bg-white/[0.02] border-dashed mc-border mc-text-muted`.
>
> Run `npm run dev` and screenshot the page in dark mode. The page should now look like the rest of the dashboard, not a light island.

**Acceptance:** No light card surfaces on the page. Hero gone. Page matches Dashboard/Reports in dark mode.

---

## Ticket 2 — Make slice labels readable

**Goal:** Right now slice labels rotate with their slice, so anything in
the bottom half of the wheel is upside-down. Flip those labels.

**Files:** `src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> In `drawWheel` inside `RafflePage.tsx`, the per-slice label block currently rotates the canvas to `mid` (slice midpoint angle) then draws text right-aligned at `radius - 24`. That puts labels in the lower hemisphere upside-down.
>
> Replace the label-drawing section (inside the `entries.forEach` loop, the `ctx.save() … ctx.restore()` block that draws each label) with logic that flips labels in the bottom half so they read left-to-right from outside the wheel:
>
> ```ts
> const mid = start + sliceAngle / 2;
> ctx.save();
> ctx.rotate(mid);
>
> // Normalize mid to [-π, π] for the flip check. After our `-Math.PI/2`
> // offset, `mid` runs from -π/2 (top) clockwise; labels need flipping
> // when the slice midpoint angle (in the rotated frame) points "down".
> const flip = Math.cos(mid) < 0;
> if (flip) {
>   ctx.translate(radius - 24, 0);
>   ctx.rotate(Math.PI);
>   ctx.textAlign = "left";
> } else {
>   ctx.textAlign = "right";
> }
> ctx.fillStyle = "#ffffff";
> ctx.font = entries.length > 18
>   ? "700 18px Inter, sans-serif"
>   : "800 24px Inter, sans-serif";
> ctx.shadowColor = "rgba(0,0,0,0.35)";
> ctx.shadowBlur = 3;
> const label = entry.label.length > 14
>   ? `${entry.label.slice(0, 12)}…`
>   : entry.label;
> ctx.fillText(label, flip ? 0 : radius - 24, 8);
> ctx.restore();
> ```
>
> Spin the wheel a few times in dev and confirm every label is readable at every rotation. No label should ever appear upside-down or with letters running right-to-left.

**Acceptance:** All labels readable head-on. Specifically: after a spin lands with names in the 4-o'clock through 8-o'clock arc, those names read forward, not backward.

---

## Ticket 3 — Recent winners log + prize field

**Goal:** Coaches want to see who's won lately (to avoid feeling like
they pick favorites) and what they won. Persist a small history; show
the last 5 above the wheel.

**Files:** `src/app/hooks/useTeamStore.tsx`,
`src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> 1. In `src/app/hooks/useTeamStore.tsx`, extend the persisted state with a `raffleWinners` array:
>    ```ts
>    interface RaffleWinner {
>      id: string;          // crypto.randomUUID()
>      player: string;
>      prize: string;       // empty string OK
>      wonAt: string;       // ISO timestamp
>    }
>    ```
>    Persist alongside existing local state (same storage mechanism — don't invent a new one). Expose `recordRaffleWinner(winner: Omit<RaffleWinner, "id" | "wonAt">)` and `clearRaffleHistory()` from the hook. Default to `[]` for existing accounts.
> 2. In `RafflePage.tsx`:
>    - Add a `prize` state (`useState("")`) and a small `<input>` in the header (below the title): "What's today's prize?" placeholder, max 60 chars, styled like other inputs in the app. Persist the typed value to `localStorage` under `kaizen.raffle.prize` so it survives reload but isn't synced.
>    - In the spin completion handler (the final `setTimeout` inside `animate`), call `recordRaffleWinner({ player: winnerEntry.player, prize })` before the archive prompt.
>    - Add a "Recent winners" sub-card on the right rail, **above** "Wheel Entries". Show the last 5 entries: player name, prize (if set), relative time ("2 days ago" — use the existing date helper in `@/lib/dates`). When empty, render nothing (no empty state, just hide the card).
>    - Update the winner-toast text: `"${player} wins${prize ? ' ' + prize : ''}! Entry earned ${formatDate(date)}."`
> 3. Update the archive confirm dialog title to include the prize too: `"🎉 ${player} wins${prize ? ' ' + prize : ''}!"`.
>
> Run `npm run dev`. Spin 3 times with different prize text and confirm the history persists across page reloads.

**Acceptance:** Prize field above wheel; recent-winners card shows latest 5; data survives reload; winner toast and archive dialog both include the prize.

---

## Ticket 4 — Surface ineligible roster members

**Goal:** Anyone with zero optional-training attendance is invisible on
this page. Coaches ask "why isn't Mason on here?" — answer it inline.

**Files:** `src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> In `RafflePage.tsx`, below the Wheel Entries list, add an "Not yet eligible" section.
>
> Derivation: take `state.roster`, subtract everyone already in `getEntryCounts()`, subtract `state.guestPlayers`. The remainder is the ineligible list.
>
> Render:
> - If the ineligible list is empty, render nothing.
> - Otherwise a collapsed `<details>` (closed by default) with summary `"Not yet eligible · {N}"` and body listing each name as a chip (`bg-white/[0.04] mc-text-muted px-2 py-0.5 rounded-md text-xs`). Below the chips, a one-line hint: `"These players are on the roster but haven't been marked present at an Optional Training session yet."`
>
> Run `npm run dev` and confirm the section appears for a team with at least one roster member who hasn't attended optional training, and is hidden when everyone's attended at least one.

**Acceptance:** Ineligible players are discoverable in one click; the section disappears cleanly when there are none.

---

## Ticket 5 — Silent draw + exclude-recent-winners toggle

**Goal:** Two power-user controls. **Silent draw** picks a winner
without the spin animation (useful on mobile / when you've already done
the dramatic version once). **Exclude recent** removes the last N
winners from the entry pool so the same kid doesn't win three weeks
running.

**Files:** `src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> In `RafflePage.tsx`:
>
> 1. Below the Spin button, add a small row of secondary controls:
>    ```
>    [ Draw silently ]    Exclude last [ 2 v ] winners
>    ```
>    Style as subtle text-buttons / inline select (`text-xs mc-text-secondary`), not big primary buttons.
> 2. **Exclude select** options: `0`, `1`, `2`, `3`, `5`. Default `0`. Persist to `localStorage` under `kaizen.raffle.excludeLastN`.
> 3. When computing `wheelEntries`, filter out any entry whose `player` is in the last N winners from `state.raffleWinners` (newest-first). If the filtered list is empty, show a tooltip on hover of the exclude select: "All players are excluded — lower this number to spin." and disable Spin / Draw silently.
> 4. **Draw silently**: picks a `winningIndex` the same way as `spinWheel`, but skips the rotation animation and confetti. Just sets `winner` text, calls `recordRaffleWinner`, and triggers the archive dialog after a 600ms delay. Show a brief "Picked!" pulse on the entry that won (border ring + scale 1.02 for 600ms) so it's not jarring.
> 5. Update the Recent winners card from Ticket 3 so each entry has a small "↺ undo" affordance on hover for the most-recent winner only — clicking it removes that record (calls a new `undoLastRaffleWinner()` action on the store). Useful when a coach mis-clicks "Draw silently".
>
> Run `npm run dev`. Test: spin once to seed history, set exclude to 1, spin again — the first winner should not appear in the new wheel. Use Draw silently and confirm no animation/confetti.

**Acceptance:** Silent draw works without animation; exclude-recent reduces the entry pool correctly; undo on most-recent winner is available.

---

## Out of scope (future)

- **CSV export of winners** — pairs with `REPORTS-SPEC.md` Ticket 5. Add `exportWinnersCSV` once that lands; surface a small Export link on the Recent winners card.
- **Slice weighting** — currently each attendance = one slice, which compounds quickly for top attendees. Some coaches want capped weighting (max 3 slices per player) or sqrt-weighting. Add as a Settings toggle once the basics ship.
- **Theme the rest of the dashboard's light cards.** This page is a microcosm of a bigger issue; the systematic fix lives in `LIGHT-MODE-SPEC.md`. Once that ships, revisit Raffle to make sure the new tokens look right.

---

## If something goes off the rails

If Ticket 2's canvas math produces letters that "flip" mid-spin (i.e. the label snaps between flipped and unflipped while the wheel is rotating), it means the `flip` check is being recomputed on every frame against the *base* `mid`, when it should be checked against the *currently-rotated* angle. Bake it once per draw using `(mid + rotationRadians)` and the snap goes away.
