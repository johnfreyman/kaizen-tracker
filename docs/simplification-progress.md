# Kaizen Tracker — Simplification Progress

Plan of record: `docs/simplification-spec.md`
Branch: `claude/inspiring-knuth-eovah7`
Base commit: `40d9b0c` on `main`

| Stage | Title | Status |
|---|---|---|
| 0 | Plan and baseline | **Complete** |
| 1 | Fixed-credit sessions | Not started — **awaiting plan approval** |
| 2 | Player identity | Not started |
| 3 | Durable attendance | Not started |
| 4 | Kiosk mode | Not started |
| 5 | Raffle tickets | Not started |
| 6 | Raffle enable dialog and defaults | Not started |
| 7 | Verification | Not started |

---

## Stage 0 — Plan and baseline

Date: 2026-09-20

### Changes

| File | Change |
|---|---|
| `docs/simplification-spec.md` | New. The plan of record: 16 approved requirements, findings from the current code, 8 design assumptions, and 7 stages with exit tests. |
| `docs/simplification-progress.md` | New. This file. |

No application code changed. No migration ran. Production was not touched.

### Test results — baseline

Commands run in the container, on the unmodified code.

| Command | Result |
|---|---|
| `npm install` | Pass (exit 0) |
| `npx tsc --noEmit` | Pass (exit 0) |
| `npx vitest run` | **19 passed, 1 failed** (4 files) |

A `.env` file with placeholder values was needed. `src/lib/supabase.ts` throws
on import when `VITE_SUPABASE_URL` is missing, which stopped `stats.test.ts`
from collecting. The file is in `.gitignore` and holds no real credentials.

### The one failing test

`src/app/components/__tests__/LaunchPage.test.tsx` →
"derives top 3 most-frequent time presets sorted correctly when >= 1 unique
times".

**Cause: the test has expired. It is not a code defect, and this work did not
cause it.** The fixture uses events dated `2026-05-22`. `LaunchPage` keeps
only events from the last 30 days when it builds the quick-time list. Today is
`2026-09-20`, so every fixture event is dropped, the list falls back to
4/5/6 PM, and `9:00 AM` is never rendered.

Stage 1 removes the quick-time feature, so this test is deleted with it. No
separate fix is needed.

### Findings that change the work

1. **The destructive raffle reset is the main risk.** "Reset wheel" on
   `RafflePage.tsx` calls `clearActiveEvents`, which **deletes event rows**.
   That erases attendance and credited hours. Requirement R15 forbids it.
   Stage 6 replaces it with a `raffle_epoch` cutoff. Until Stage 6 ships, this
   button can lose a coach's data.
2. **Three requirements are already met.** R7 (tap to mark) is in
   `AttendancePage.tsx`. R12, R13, and R14 hold in effect, because the wheel is
   derived from optional-training events and not from a stored counter. Stage 5
   moves that logic into a tested module rather than rewriting it.
3. **Kiosk mode does not exist at all.** No `kiosk`, `jersey`, or exit-code
   code is in `src/`. Stage 4 is the largest stage.
4. **Attendance marks are not persisted.** `src/lib/attendance-draft.ts`
   already exports `saveDraft` / `loadDraft` / `clearDraft`, but **no file
   calls them**. Stage 3 is mostly wiring, not new code.
5. **A schema question needs an answer before any migration.**
   `migrations/001_schema.sql` constrains `events.date` to
   `^\d{4}-\d{2}-\d{2}$`, but `LaunchPage.tsx` writes `2026-09-20T16:00`, which
   that anchored pattern rejects. Either the live database carries a different
   constraint, or saves fail. Verify against the live schema at the start of
   Stage 1.

### Open issues

| # | Issue | Owner | Blocks |
|---|---|---|---|
| O1 | Verify the live `events.date` constraint against `001_schema.sql`. | Needs a read of the live schema. | Stage 1 exit test |
| O2 | Decide whether a coach may back-date a session. The spec assumes the date picker stays; R3 removes only the *time* and *duration*. | Product owner | Stage 1 |
| O3 | Decide the exit-code length and whether one code serves every device. Assumption A6 says a hashed 4-to-6-digit PIN. | Product owner | Stage 4 |
| O4 | Raffle winner history lives in `localStorage`, not Supabase. It is lost when a coach clears the browser. Out of scope, but R15 names "historical raffle records". | Product owner | Stage 6 scope |
| O5 | No local Supabase stack is running in this container. Stages 2, 4, and 6 add migrations that need an isolated database to test. | Product owner / setup | Stages 2, 4, 6 |

### Not done, and why

- **No application code was written.** The chosen path was plan first, then
  implement Stage 1 after approval.
- **No migration was applied anywhere.** Constraint C3 forbids production
  changes in stages 1 to 7, and no isolated database is available yet (O5).
- **The pre-existing LaunchPage test failure was left alone.** Stage 1 deletes
  the feature it covers.

---

## Next-stage handoff

**Next stage: Stage 1 — Fixed-credit sessions. Start only after the product
owner approves `docs/simplification-spec.md`, in particular assumptions A1, A2,
and A8 and open issue O2.**

Covers R1, R2, R3, R4.

Do this, in order:

1. **Answer O1 first.** Read the live `events` table definition. Compare the
   `date` CHECK constraint against `migrations/001_schema.sql` line 37. Record
   the answer in this file. Do not change production.
2. **Rewrite `src/app/components/LaunchPage.tsx`:**
   - Delete `QUICK_TIMES`, `FALLBACK_QUICK_TIMES`, `getNextHalfHour`,
     `formatTimeLabel`, `startTime`, `isTimeInPast`, `commonDurations`,
     `durationInput`, `durationMode`, `parsedDuration`, `isDurationValid`, and
     `selectPreset`.
   - Replace the form with two large buttons: **Start Practice** and **Start
     Optional Training**. Each one starts a session directly. Keep the existing
     active-session warning block above them.
   - Keep the `DayPicker` date control only if O2 says back-dating stays.
     Default it to today.
3. **Write the fixed credit.** Add
   `export const SESSION_CREDIT_HOURS = 1.5;` to
   `src/app/hooks/useTeamStore.tsx` with a comment that says 90 minutes.
   `LaunchPage` sets `duration: SESSION_CREDIT_HOURS` on the new
   `ActiveSession`. Change nothing in `saveSession`, in `stats.ts`, or in any
   existing row. This is R4.
4. **Write the date as 10 characters**, `YYYY-MM-DD`, with no `T` and no time.
   Keep the existing local-timezone calculation, which is already correct:
   ```ts
   const yyyymmdd = `${year}-${month}-${day}`;
   ```
   Drop the `combinedDateTime` variable.
5. **Update `src/app/components/__tests__/LaunchPage.test.tsx`:** delete the
   two quick-time preset tests (one of which already fails, see above). Add
   tests that each button starts a session with `duration === 1.5`, with the
   right `type`, and with a date of length 10.
6. **Check for other readers of the time part.** `LaunchPage.tsx` is the only
   writer of `T` in `date`, but confirm with:
   ```sh
   grep -rn "slice(11" src/
   ```
   `src/lib/stats.ts` `filterEventsByRange` compares `e.date >= cutoffStr`
   against a 10-character string. That comparison stays correct for both the
   old datetime rows and the new date-only rows. Do not change it.
7. **Run the exit test for Stage 1:**
   ```sh
   npx tsc --noEmit && npx vitest run
   ```
   Then start each session type in `npm run dev` and confirm the saved event
   holds `duration: 1.5` and a 10-character date. Open Reports and confirm a
   historical event still shows its original duration.
8. **Update this file** with the changes, the test results, the remaining
   issues, and the handoff for Stage 2.

Do not start Stage 2. Do not deploy. Do not run a migration against
production.
