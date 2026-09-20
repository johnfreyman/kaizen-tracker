# Kaizen Tracker — Simplification Spec

Status: **draft for approval**
Date: 2026-09-20
Branch: `claude/inspiring-knuth-eovah7`
Progress record: `docs/simplification-progress.md`

This document is the plan of record for the simplification work. It divides
the approved requirements into seven stages. Each stage is a small, testable
change set.

---

## 1. Approved requirements

These 16 statements come from the product owner. Do not change them without
the owner's agreement.

| # | Requirement |
|---|---|
| R1 | Coaches see prominent **Start Practice** and **Start Optional Training** buttons. |
| R2 | New practices and optional trainings each credit 90 minutes per attendee. |
| R3 | No start/end time, timer, or duration entry is necessary. |
| R4 | Historical durations stay as they are. |
| R5 | Players use a first name and a jersey number. |
| R6 | A duplicate first-name/number pair needs a last initial or another short label. |
| R7 | Coaches can tap player cards to mark attendance. |
| R8 | Kiosk users type a jersey number, see the matching player cards, and select their own card. |
| R9 | Kiosk users can undo an incorrect selection. |
| R10 | A coach exit code returns the app from kiosk mode to the attendance screen. |
| R11 | Attendance survives refreshes and interrupted connectivity. |
| R12 | Each optional-training attendance earns one raffle ticket. |
| R13 | Practices earn no raffle tickets. |
| R14 | Tickets accrue when the raffle feature is enabled and when it is disabled. |
| R15 | When a coach enables the raffle, the app offers **Keep accrued tickets** or **Start fresh**. Start fresh changes raffle eligibility only. It does not delete attendance, credited hours, or historical raffle records. |
| R16 | The raffle defaults to enabled for new teams. Existing teams keep their saved setting. |

Two constraints apply to every stage:

- **C1** — Keep the analytics pages and their numbers correct.
- **C2** — Keep `supabase/functions/admin-coach-actions` and its authorization
  checks. `johnfreyman70@gmail.com` stays the only super admin.
- **C3** — Stages 1 to 7 do not deploy and do not change production. Test in a
  local or isolated environment.

---

## 2. What the code does today

Findings from a read of the repository at commit `40d9b0c`.

### 2.1 Session start (R1, R2, R3)

`src/app/components/LaunchPage.tsx` asks the coach for four things: event
type, date, start time, and duration. The duration control offers presets
(0.5 h to 3.0 h) and a custom field. Valid durations are 0.5 h to 4.0 h in
half-hour steps.

The page writes `date` as `YYYY-MM-DDTHH:mm` and `duration` as a number of
hours.

### 2.2 Data model

`migrations/001_schema.sql` defines five tables. All are coach-scoped and
protected by row-level security.

| Table | Relevant columns |
|---|---|
| `team_settings` | `team_name`, `team_logo`, `raffle_enabled BOOLEAN NOT NULL DEFAULT false` |
| `roster` | `name TEXT`, `is_guest BOOLEAN`, `UNIQUE (coach_id, name)` |
| `events` | `date TEXT`, `type TEXT`, `duration NUMERIC`, `players JSONB` (array of name strings), `saved_at TEXT` |
| `active_session` | `id`, `date`, `type`, `duration` |
| `archived_event_sets` | `events JSONB` |

A player is a **name string**. `events.players` holds an array of those
strings. Archived sets hold copies of the same strings. There is no player
identifier.

### 2.3 Attendance (R7, R11)

`src/app/components/AttendancePage.tsx` already uses tappable player cards.
R7 is satisfied.

The present-player set is React state only:

```ts
const [presentPlayers, setPresentPlayers] = useState<Set<string>>(new Set());
```

A refresh loses it. `src/lib/attendance-draft.ts` exports `saveDraft`,
`loadDraft`, and `clearDraft`, but **no file calls them**. The offline path is
different and does work: a failed save writes the finished event to
`localStorage` and a browser `online` event retries it.

### 2.4 Kiosk (R8, R9, R10)

Kiosk mode does not exist. A search for `kiosk`, `jersey`, and `exit code`
across `src/` returns nothing. `BRAINSTORM_BRIEF.md` §3 lists kiosk mode as an
open idea, not as built work.

### 2.5 Raffle (R12 to R16)

`src/app/components/RafflePage.tsx` builds the wheel from live events:

```ts
state.events.filter((event) => event.type === EVENT_TYPES.OPTIONAL_TRAINING)
```

One wheel slice per attendance. Practices give none. So R12 and R13 already
hold in effect, and R14 holds too, because slices are derived from events and
not from a stored counter.

Three gaps remain:

1. **Reset is destructive.** The "Reset wheel" button calls
   `clearActiveEvents({ type: OPTIONAL_TRAINING })`, which **deletes the event
   rows** from the `events` table. That erases attendance and credited hours.
   R15 forbids this.
2. **No enable dialog.** `SettingsPage.tsx` has a plain on/off switch. There is
   no Keep/Start-fresh choice.
3. **Wrong default.** `raffle_enabled` defaults to `false` in the database and
   in `defaultState`. R16 wants `true` for new teams.

Raffle winners are stored in `localStorage` under `kaizen.raffle.winners`, not
in Supabase.

### 2.6 Analytics (C1)

`src/lib/stats.ts` sums `event.duration` per player into `practice` and
`training` hours. The unit is **hours as a decimal**. 90 minutes is `1.5`.

### 2.7 Open question to verify

`migrations/001_schema.sql` line 37 constrains the event date:

```sql
date TEXT NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$')
```

`LaunchPage.tsx` writes `2026-09-20T16:00`, which the anchored pattern
rejects. Either the live database carries a different constraint, or saves
fail. **Verify against the live schema in Stage 1 before any migration.**
Stage 1 removes the time-of-day part, which also removes this risk.

---

## 3. Design decisions

These are **assumptions**, not approved requirements. Each one is open to
correction at plan review.

| # | Decision | Reason |
|---|---|---|
| A1 | Store 90 minutes as `duration = 1.5` in the existing `NUMERIC` column. Do not add a minutes column. | `stats.ts`, reports, and exports already use decimal hours. A unit change would touch every analytics path and risk C1. |
| A2 | Keep `events.players` as an array of display-name strings. | Every event row, every archive, and every statistics helper reads these strings. A change to identifiers is a data migration across JSONB, and it is not needed by any of the 16 requirements. |
| A3 | Add `first_name`, `jersey_number`, and `label` to `roster`. Derive `name` from them and keep `name` as the unique key. | Gives R5 and R6 structured data without breaking A2. |
| A4 | Display name format: `First #Number`, or `First L. #Number` when a label exists. | Short, and it reads well on a card. |
| A5 | Kiosk mode is a screen state inside the app, not a separate route. | It must not be reachable by a typed URL, and it shares the store. |
| A6 | The coach exit code is a 4-digit to 6-digit PIN in `team_settings`, hashed. | Simple for a coach at a gym door. Hashing avoids storing a live code in plain text. |
| A7 | "Start fresh" writes a `raffle_epoch` timestamp in `team_settings`. The wheel counts only optional-training attendance after that time. | Satisfies R15 exactly: eligibility changes, no row is deleted. |
| A8 | New events write the fixed credit. Old events keep the value already in the row. | R4. No backfill, no update of history. |

---

## 4. Stages

Each stage lists its requirements, its files, and its exit test. A stage is
done only when its exit test passes.

### Stage 1 — Fixed-credit sessions

**Covers:** R1, R2, R3, R4.

**Change:**

- Replace the LaunchPage form with two large buttons: **Start Practice** and
  **Start Optional Training**. Keep the date picker only if the owner wants
  back-dating; otherwise use today's date.
- Remove the start-time control, the duration presets, and the custom duration
  field.
- Set `duration = 1.5` for every new session.
- Write `date` as `YYYY-MM-DD` with no time part.
- Leave `saveSession`, `stats.ts`, and every existing row untouched.

**Files:** `src/app/components/LaunchPage.tsx`,
`src/app/components/__tests__/LaunchPage.test.tsx`,
`src/app/hooks/useTeamStore.tsx` (constant only).

**Exit test:** Start each session type. Confirm the saved event holds
`duration: 1.5` and a 10-character date. Confirm a report that mixes old
events and new events shows old durations unchanged.

### Stage 2 — Player identity

**Covers:** R5, R6.

**Change:**

- Migration `011_player_identity.sql`: add `first_name TEXT`,
  `jersey_number TEXT`, `label TEXT` to `roster`. Backfill `first_name` from
  the existing `name`. Leave `jersey_number` empty for old rows.
- Add a unique constraint on `(coach_id, lower(first_name), jersey_number,
  coalesce(label,''))`.
- Change the add-player dialog to ask for first name and jersey number.
- When the pair already exists, require a short label and say why.
- Derive the display name per A4 and keep writing it to `roster.name`.

**Files:** `migrations/011_player_identity.sql`,
`src/app/hooks/useTeamStore.tsx`, `src/app/components/PlayerTypeDialog.tsx`,
`src/app/components/AttendancePage.tsx`,
`src/app/components/SettingsPage.tsx`.

**Exit test:** Add two players named Jordan with number 12. The second add
fails until a label is given. Old roster rows still load and still match their
event history.

### Stage 3 — Durable attendance

**Covers:** R11.

**Change:**

- Call `saveDraft` from `AttendancePage` on every tap, keyed by the active
  session id.
- Call `loadDraft` when the page mounts and an active session exists.
- Call `clearDraft` after a successful save and after a discard.
- Confirm the existing offline retry still works with the draft in place.

**Files:** `src/app/components/AttendancePage.tsx`,
`src/lib/attendance-draft.ts` (no change expected),
`src/app/hooks/useTeamStore.tsx`.

**Exit test:** Mark five players, refresh the browser, and confirm the five
are still marked. Go offline, save, go online, and confirm one event syncs and
no duplicate appears.

### Stage 4 — Kiosk mode

**Covers:** R8, R9, R10. Depends on Stage 2 and Stage 3.

**Change:**

- Add a kiosk screen state with a number pad.
- A typed jersey number filters the roster to the matching cards.
- A tap on a card marks that player present and shows a short confirmation
  with an **Undo** control.
- Kiosk mode hides navigation, settings, reports, and the raffle.
- An exit control asks for the coach PIN and returns to the attendance screen.
- Kiosk writes through the same draft store as Stage 3.

**Files:** new `src/app/components/KioskPage.tsx`, new
`src/app/components/KioskExitDialog.tsx`, `src/app/App.tsx`,
`src/app/components/SettingsPage.tsx` (set the PIN),
`migrations/012_kiosk_exit_code.sql`.

**Exit test:** Type a number, select a card, and confirm the mark. Undo it and
confirm the mark is gone. Try three wrong PINs and confirm the app stays in
kiosk mode. Enter the correct PIN and confirm the app returns to the
attendance screen.

### Stage 5 — Raffle tickets

**Covers:** R12, R13, R14.

**Change:**

- Move ticket derivation out of `RafflePage.tsx` into `src/lib/raffle.ts`.
- One ticket per optional-training attendance. Zero for practice.
- Derive tickets from events, so they accrue while the raffle is off.
- Show the ticket count in the player detail drawer, whatever the raffle
  setting is.

**Files:** new `src/lib/raffle.ts`, new `src/lib/raffle.test.ts`,
`src/app/components/RafflePage.tsx`,
`src/app/components/PlayerDetailDrawer.tsx`.

**Exit test:** Unit tests for the ticket function. With the raffle off, save an
optional training, then turn the raffle on and confirm the tickets are there.

### Stage 6 — Raffle enable dialog and defaults

**Covers:** R15, R16. Depends on Stage 5.

**Change:**

- Migration `013_raffle_defaults.sql`: set the `raffle_enabled` column default
  to `true` and add `raffle_epoch TIMESTAMPTZ NULL`. **Do not update existing
  rows** — an existing team keeps the value it saved.
- New-coach state defaults to `raffleEnabled: true`.
- When a coach turns the raffle on, show a dialog with **Keep accrued
  tickets** and **Start fresh**.
- Start fresh sets `raffle_epoch = now()`. Keep leaves it as it is.
- `src/lib/raffle.ts` counts only attendance after `raffle_epoch`.
- **Delete the destructive reset path.** Replace the `clearActiveEvents` call
  in `RafflePage.tsx` with the epoch reset. Keep `clearActiveEvents` in the
  store only if another caller needs it; otherwise remove it.

**Files:** `migrations/013_raffle_defaults.sql`,
`src/app/hooks/useTeamStore.tsx`, `src/app/components/SettingsPage.tsx`,
`src/app/components/RafflePage.tsx`, `src/lib/raffle.ts`.

**Exit test:** Start fresh, then confirm the event count, the credited hours,
and the winner history are all unchanged, and only the wheel is empty. A new
coach sees the raffle on. A coach who had saved "off" still sees it off.

### Stage 7 — Verification

**Covers:** C1, C2, C3 and a full regression pass.

**Change:** No feature work.

- Run the full test suite and `npx tsc --noEmit`.
- Walk every page and compare the analytics numbers against a set of known
  events.
- Confirm `admin-coach-actions` is unchanged and its tests pass.
- Confirm no migration in this branch has run against production.
- Write the deployment note for the owner. **Do not deploy.**

**Exit test:** A green test run, and a checklist in the progress document with
one line per requirement, R1 to R16.

---

## 5. Order and dependencies

```
Stage 1  ──▶  Stage 2  ──▶  Stage 3  ──▶  Stage 4
                                  │
Stage 5  ──▶  Stage 6  ───────────┴──▶  Stage 7
```

Stage 5 can start at any time. Stage 4 needs Stage 2 (jersey numbers) and
Stage 3 (durable marks).

---

## 6. Out of scope

These are not in the 16 requirements. Do not build them in this work.

- Multi-team or sub-team support.
- Parent or player accounts.
- A native mobile application.
- Moving raffle winners from `localStorage` into Supabase.
- A theme or visual redesign.
- The open tickets in `RAFFLE-SPEC.md` and `handoff/REPORTS-SPEC.md`.
