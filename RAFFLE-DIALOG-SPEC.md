# Raffle winner dialog — simplify the celebration

The current post-spin dialog ("🎉 Bradley Hsi wins! What would you like
to do with the current attendance data?") staples a destructive data
workflow onto a celebration moment. The win and the reset/archive
decision are separate concerns and should be separated in the UI.

This handoff splits them into:
1. A celebratory winner card (no data decisions).
2. A separate, always-available "Reset wheel" action on the Raffle page.
3. Season archival relocated to Settings, where consequential actions
   belong.

Run tickets in order. Total scope is a few hours.

---

## Files referenced

| Path | Purpose |
|---|---|
| `src/app/components/RafflePage.tsx` | Houses the current dialog. |
| `src/app/components/SettingsPage.tsx` | New home for Archive Season. |
| `src/app/hooks/useTeamStore.tsx` | Existing actions: whatever currently powers "Clear Wheel Only" and "Archive Season". |

---

## Model selection

| Ticket | Model | Why |
|---|---|---|
| 1 — Simplify the winner dialog | **Claude Sonnet 4.6 (Thinking)** | Touches behavior + a11y. |
| 2 — Inline Reset wheel button | **Claude Sonnet 4.6** | New small UI. |
| 3 — Move Archive Season to Settings | **Gemini 3.5 Flash (Medium)** | Mechanical move. |

---

## Ticket 1 — Replace the winner dialog with a celebration-only card

**Goal:** When a player wins, the user sees a happy moment, not a data
form. Dialog has no destructive actions, dismisses easily, and offers
exactly one optional next step.

**Files:** `src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> In `src/app/components/RafflePage.tsx`, replace the existing post-spin archive dialog (the modal that currently shows "🎉 {player} wins!" with the three buttons "Keep Data", "Clear Wheel Only", "Archive Season") with a simpler celebration card.
>
> **New structure:**
> ```tsx
> {winner && (
>   <div
>     role="dialog"
>     aria-modal="true"
>     aria-labelledby="winner-title"
>     className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
>     onClick={(e) => { if (e.target === e.currentTarget) setWinner(null); }}
>   >
>     <div className="w-full max-w-md rounded-3xl border mc-border bg-[#11161d] p-8 shadow-2xl">
>       <div className="text-center">
>         <div className="text-5xl">🎉</div>
>         <h2 id="winner-title" className="mt-3 text-2xl font-bold mc-text">
>           {winner} wins{prize ? ` ${prize}` : ""}!
>         </h2>
>         {/* Optional: small line about how they earned it */}
>         <p className="mt-1 text-sm mc-text-secondary">
>           Earned through optional training attendance.
>         </p>
>       </div>
>
>       <div className="mt-6 flex items-center justify-center gap-2">
>         <button
>           type="button"
>           onClick={() => setWinner(null)}
>           className="rounded-xl border mc-border bg-white/[0.04] px-4 py-2.5 text-sm font-semibold mc-text hover:bg-white/[0.08]"
>         >
>           Close
>         </button>
>         <button
>           type="button"
>           onClick={() => { setWinner(null); spinWheel(); }}
>           className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-[#11161d] hover:bg-amber-400"
>         >
>           Spin again
>         </button>
>       </div>
>     </div>
>   </div>
> )}
> ```
>
> Add a keyboard handler so **Escape** closes the dialog:
> ```ts
> useEffect(() => {
>   if (!winner) return;
>   const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setWinner(null); };
>   window.addEventListener("keydown", onKey);
>   return () => window.removeEventListener("keydown", onKey);
> }, [winner]);
> ```
>
> **Remove** all references in this dialog (and only this dialog) to:
> - `Clear Wheel Only` / "Clear Wheel"
> - `Archive Season`
> - The "What would you like to do with the current attendance data?" copy
>
> The store actions powering those still exist — they're moving to other locations in Tickets 2 and 3. Don't delete the store actions themselves.
>
> Run `npm run dev`. Spin the wheel; confirm:
> 1. Dialog shows winner name (and prize if Ticket 3 of `RAFFLE-SPEC.md` has shipped).
> 2. Esc closes; clicking the dark backdrop closes; clicking the card does NOT close.
> 3. "Spin again" closes the dialog and starts a new spin without any data being cleared.

**Acceptance:** Winner moment is celebratory and non-destructive. No data is touched without an explicit user choice elsewhere.

---

## Ticket 2 — Add an always-visible "Reset wheel" action

**Goal:** The "clear current attendance" action still needs to exist —
just not buried inside a celebration. Surface it as a small secondary
button in the page header, with its own confirm.

**Files:** `src/app/components/RafflePage.tsx`.

**Prompt to paste:**

> In `src/app/components/RafflePage.tsx`, add a "Reset wheel" button to the page header (the slim header introduced in `RAFFLE-SPEC.md` Ticket 1, or if that hasn't shipped, add it near the existing title — top-right corner).
>
> Visually: text-button style, not a primary CTA. `text-xs font-semibold mc-text-secondary hover:mc-text underline-offset-2 hover:underline`. Icon optional (`RefreshCw` from lucide).
>
> ```tsx
> <button
>   type="button"
>   onClick={() => setConfirmReset(true)}
>   disabled={getEntryCounts().length === 0}
>   className="text-xs font-semibold mc-text-secondary hover:mc-text disabled:opacity-40 disabled:cursor-not-allowed"
>   title="Clear all entries from this week's wheel"
> >
>   ↺ Reset wheel
> </button>
> ```
>
> When clicked, open a confirm dialog (reuse the existing dialog styling pattern in the codebase — don't roll a new one). Copy:
>
> > **Reset the wheel?**
> > This removes every player's current entries from the wheel. Past winners and season totals are not affected.
> >
> > **[ Cancel ]   [ Reset wheel ]** (Reset is destructive — red/rose styling)
>
> The Reset action should call **the same store action** that the deleted "Clear Wheel Only" button used to call. Don't invent a new one; just relocate the trigger.
>
> Default action (Esc, click-outside, focus on cancel) = Cancel. The destructive button is right-side and styled `bg-rose-600 text-white hover:bg-rose-500`.
>
> Run `npm run dev`. Test:
> 1. Reset wheel is disabled when no entries exist.
> 2. Confirm dialog appears; Esc + click-outside default to Cancel.
> 3. Clicking the red Reset button clears the wheel and the page re-renders empty.

**Acceptance:** Reset wheel is discoverable in one click from the page header, requires an explicit confirm, and is the only place this action lives.

---

## Ticket 3 — Relocate "Archive Season" to Settings

**Goal:** Archive Season is a once-or-twice-a-year action. It belongs in
Settings with the other consequential controls, not in a weekly raffle
dialog.

**Files:** `src/app/components/SettingsPage.tsx`,
`src/app/components/RafflePage.tsx` (only to remove the leftover action,
if Ticket 1 didn't fully strip it).

**Prompt to paste:**

> 1. In `src/app/components/SettingsPage.tsx`, add a new section near the bottom (after general settings, before any "Danger zone"):
>
>    > **Season management**
>    >
>    > [card] Archive current season
>    > Move all current player attendance to history and start fresh. Use this at the end of a season.
>    > → [ Archive season → ]
>
>    Visual: same card pattern as other Settings entries. Action button in the right-aligned slot. On click, open a confirm dialog:
>
>    > **Archive this season?**
>    > All player attendance from the current period will be moved to history. This cannot be undone. Past raffle winners are preserved.
>    >
>    > [ Cancel ]   [ Archive season ]   (destructive: rose-600)
>
>    Wire it to **the same store action** the old "Archive Season" button in RafflePage called. Don't invent a new one.
>
> 2. If `RafflePage.tsx` still has any reference to Archive Season (button, label, dialog branch, store-action call from the celebration dialog), remove it. Search for `Archive Season`, `archiveSeason`, and the old multi-action dialog markup. The store action itself stays — only the trigger moves.
>
> 3. (Optional, can be follow-up) Add a small empty-state copy to Settings explaining when to use this: "Most teams archive at the end of a season — typically June or November." Keep it short, one line.
>
> Run `npm run dev`. Test:
> 1. Settings now has a clear Archive Season action.
> 2. RafflePage has no Archive Season references anywhere.
> 3. Archive flow still works end-to-end: confirm → store cleared → archived data visible in whatever "history" view the app uses.

**Acceptance:** Archive Season has exactly one home (Settings). The Raffle page has zero references to it. The destructive action requires explicit, non-celebratory user intent.

---

## Out of scope

- **Auto-archive at season end** — would require a "season end date" setting, a notification system, and probably a job runner. Worth doing eventually but separate scope.
- **Undo for Reset wheel** — if a coach mis-clicks, they can't undo. Adding undo means buffering the cleared state for ~30s in memory + a toast. Useful but secondary; do once the basics ship.
- **Animations** — the new winner card could use a small entry animation (`scale 0.95 → 1`, fade in). Skipped here; add via the Tailwind `animate-in` utility or framer-motion if it's already in the project.

---

## Why this is a better pattern

Three principles being applied:

1. **One moment, one decision.** Each UI surface should ask the user one thing. The old dialog asked: did you see who won, and also what do you want to do with the data? — two unrelated decisions stacked.
2. **Destructive actions need deliberate triggers.** Burying "clear all data" in a celebration toast means accidental clicks are likely. A dedicated button + confirm makes the user's intent explicit.
3. **Frequency drives placement.** Weekly action → page header. Seasonal action → Settings. Daily action → primary CTA. The old dialog made a yearly action and a weekly action equally prominent inside a moment that should have been zero-action.
