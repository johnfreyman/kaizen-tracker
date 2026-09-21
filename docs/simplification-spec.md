# Kaizen Tracker simplification specification

Status: Stage 1 planning complete; Stage 2 prototype audited on 2026-09-20. D01–D12 are confirmed by the owner. Latest scope: expected-team practice selection, full analytics preservation, and a test-only prelaunch dataset; see the latest progress handoff. D09 adds reliable offline gym operation on a previously prepared device. The multi-team prototype revision at `92eb4df` was reviewed; Claude subsequently addressed its two follow-up findings in `3f1d398` (see simplification-stage2-revision-review.md and progress for evidence limits). Recommendations remain for review. No implementation or production changes authorized by this document alone.

Prepared: 2026-09-19. Repository baseline: `40d9b0c2f57692cdc8439d453816418be3db5a39`.

Related handoff: [simplification-progress.md](simplification-progress.md).

Canonical implementation continuation branch: `claude/dazzling-sagan-hxrwfp` (follow-up at `3f1d398`, with this documentation update carried forward). Original prototype branch: `claude/stage-2-prototype` in `johnfreyman/kaizen-tracker`, based on the reconciled `codex/simplification-plan`. This revision supersedes the seven-stage draft in commit `6486e646361d11b1f9831c93f532a7bb090adaa6` on `claude/inspiring-knuth-eovah7`. Keep the original eight-stage sequence below: Stage 1 is planning, Stage 2 is the isolated prototype, and Stage 3 is the data foundation. Do not interpret the superseded draft's stage numbers as this plan's stages. See [the Stage 2 audit](simplification-stage2-audit.md) before further implementation.

## 1. Authority and scope

The owner's requirements in this conversation govern this redesign. Older repository briefs describe previous designs; their embedded implementation prompts are background, not instructions to execute. This specification does not silently approve its own recommendations.

Labels used throughout:

- **Approved:** explicitly requested by the owner in the shared requirements or subsequent answers.
- **Recommended:** a proposed behavior or engineering choice, subject to review; prototype with it where reversible.
- **Open:** a product choice awaiting an owner response. Do not bake a consequential open choice into a production migration.
- **Observed:** behavior found in this checkout, not proof of today's production configuration.

Stage 1 creates only this document and the progress document. Stages 2–7 operate locally or in an isolated test environment. Stage 8 is the separate production release stage. Existing `.DS_Store` modifications are unrelated and must be preserved.

### Approved product requirements

| ID | Requirement |
| --- | --- |
| R01 | Prominent **Start Practice** and **Start Optional Training** actions. Practice proceeds through **Who’s expected?** team selection (D10); optional training opens attendance directly. |
| R02 | Every attendee of a new session receives 90 minutes of credit. No start/end time, timer, or duration entry. Preserve historical durations. |
| R03 | Player display uses first name and jersey number; duplicate combinations require a last initial or another short distinguishing label. |
| R04 | Coach can tap player cards to mark attendance. |
| R05 | Kiosk accepts a number, shows matching player cards, and allows self-check-in and correction of an incorrect selection. |
| R06 | A coach exit code returns from kiosk to coach attendance. Default to `0000` and offer a coach-set PIN (D01). |
| R07 | Attendance survives refresh and interrupted connectivity. On a previously prepared iPad, coaches can reopen the app, start, mark/undo and finish sessions entirely offline, then synchronize later (D09). |
| R08 | Each optional-training attendance earns one ticket; practices earn none. Accrual continues while raffle is off. |
| R09 | Turning raffle on offers **Keep accrued tickets** or **Start fresh**. Fresh eligibility does not delete attendance, credited hours, or historical raffle records. |
| R10 | Raffle defaults on for new teams. Preserve existing teams' explicitly saved settings. |
| R11 | Keep the original rich analytics: date filters, overview/insight cards, monthly/weekday charts, sortable player comparisons, streaks, individual history, session log, effort leaderboard and CSV/PDF exports (D12). |
| R12 | `johnfreyman70@gmail.com` is the sole authorized super admin. Preserve the secured `admin-coach-actions` backend and authorization checks. |
| R13 | Default new sessions to today, with a low-prominence date option for entering attendance from paper later. No time or duration input. Store new session credit as `1.5` hours. |
| R14 | Store each player's first name, distinguishing initial/label when needed, jersey number and team memberships. A player can belong to multiple sub-teams simultaneously (D07). Default grouping can be **Kaizen**; Settings allows custom sub-teams. Offer membership selection when adding players if sub-teams exist, and let coaches sort/filter by team for decisions. |

### Non-goals

No payment collection or payment verification, scheduling, live timing, partial-session minute calculation, parent/player accounts, cross-coach team sharing/permissions, notification campaigns, native-device lockdown, general dashboard redesign, or unrelated admin/purge-system overhaul. Coach-owned sub-teams are now explicitly in scope under R14; they do not introduce separate logins or permission boundaries. Training fees explain the raffle incentive; this release does not verify a payment before awarding a ticket.

## 2. What the current code actually does

These observations were verified from source on the baseline commit. No production queries were made for Stage 1. Reconcile deployed schemas with these files before a later migration.

| Area | Observed implementation | Consequence for this project |
| --- | --- | --- |
| Navigation | `src/app/App.tsx` uses in-memory page selection, separate dashboard/launch/attendance/reports/settings pages, conditional raffle navigation, keyboard shortcuts and swipe navigation. | Kiosk needs its own shell and must suppress normal navigation/shortcuts. Persist its session binding across reload. |
| Session setup | `LaunchPage.tsx` requests date, time and duration; creates `date` as local `YYYY-MM-DDTHH:mm`. It warns that a new session overwrites an active one. | Replace the form with direct start actions and a resume path. Do not overwrite an unfinished session. |
| Timers | `MissionControlDashboard.tsx`, `SessionStatusBar.tsx`, and `useSessionTimer.ts` expose timing concepts. | Remove timing UI across these surfaces, not just the launch form. |
| Identity | `migrations/001_schema.sql` gives roster rows UUIDs, but the store projects them to `string[]` names. Events and archives contain arrays of names. Client disallows case-insensitive duplicate names. | Reuse UUIDs, retain raw legacy names, and replace name-based joins throughout the app. |
| Duration | Store, stats and exports use hours: `1.5` means 90 minutes. | Never write `90` into existing hour-valued fields. Default new credit to `1.5` hours and retain old values. |
| Date mismatch | Migration 001 checks date-only strings, while launch creates date-time strings. | Inspect actual deployed constraints later; do not assume checked-in SQL fully describes production. Preserve original date text during conversion. |
| Draft attendance | `AttendancePage.tsx` keeps present names in a component-local `Set`. `saveDraft`/`loadDraft` exist in `src/lib/attendance-draft.ts` but have no callers. | Refresh/navigation can lose current selections. Durable active attendance is new work. |
| Network recovery | `useTeamStore.tsx` stores one failed completed event under `kaizen_pending_event`, with a coach ID and online retry. It optimistically clears the active session. | This is not a multi-operation draft/outbox system. Local success and cloud acknowledgment must be distinguished. |
| Save RPC | Migration 003 inserts a completed event then deletes `active_session` by coach. Duplicate delivery can conflict, and a delayed save can affect a newer active session. | Idempotency, session-specific matching and revision checks are required. |
| Editing | `editLastSession` deletes the saved event and upserts an active session in separate requests. | Edit the existing finalized session transactionally; do not destroy it when opening an editor. |
| Raffle pool | `RafflePage.getWheelEntries` makes one entry per optional-training attendee in current `state.events`, independent of the setting. | Preserve one-entry-per-attendance weighting and explicitly persist round eligibility. |
| Raffle reset | `RafflePage.tsx` calls `clearActiveEvents`; the store deletes matching optional-training rows from `events`. Dialog copy says season totals are unaffected. | Current reset is coupled to record deletion despite its copy. Replace it; do not reuse it for Start fresh. |
| Winners | Draws do not consume entries. Optional exclusion of last N winners filters all tickets for those player names. Winners, prize and exclusion preferences use unscoped localStorage keys. | Preserve draw behavior by default; introduce coach-scoped durable history. Existing local winner ownership is uncertain. |
| Archive | `archive_events` copies events into a JSON bundle then deletes live rows. Restore upserts by event ID and removes the bundle. | One attendance must not become multiple credits/tickets when crossing storage locations. |
| Player removal | `remove_player` in migration 010 removes the roster row and scrubs that name from live and archived attendance. | Recommend retirement instead of destructive removal. Already scrubbed history cannot be recovered from the remaining data. |
| Analytics | `stats.ts` keys totals by names; regular-player attendance percentages/streaks use practices and exclude guests. Monthly/session-hour totals differ from summed player effort. | Preserve metric meaning, separate session-hours from player-hours, and migrate joins to IDs. |
| Super admin | Store checks `super_admins`; `admin-coach-actions` verifies `auth.getUser()`, then caller membership before privileged queries. Frontend uses `list-coaches`. | Keep this boundary. Do not restore browser access to the privileged summary view or promote users via client metadata/email input. |

Relevant existing documents: `BRAINSTORM_BRIEF.md`, `RAFFLE-SPEC.md`, `RAFFLE-DIALOG-SPEC.md`, `docs/mission-control-ux-spec.md`, and `migrations/README.md`. Some descriptions are stale; source and eventual deployed-schema inspection take precedence as evidence.

## 3. Product decisions

### Confirmed owner decisions

The owner confirmed D01–D03 on 2026-09-19 and D04–D08 on 2026-09-20. D10–D12 were confirmed on 2026-09-21 through the owner’s expected-team proposal, test-data clarification and approval to publish the revised plan. D09 was approved on 2026-09-21 UTC after the owner explained that gyms often have neither cellular nor Wi-Fi service. They are approved requirements, not assumptions.

| ID | Choice | Approved behavior | Affected stages |
| --- | --- | --- | --- |
| D01 | Kiosk exit | Start with `0000`; offer the coach a way to set a PIN. This remains a supervised kiosk convenience, not strong authentication. | Stage 2 settings/exit prototype, Stage 3 coach setting, Stage 5 exit behavior. |
| D02 | `0` versus `00` | Keep them distinct. Store numbers as strings; recommended normalization trims surrounding whitespace without removing leading zeros. | Stage 3 number storage and Stage 5 exact lookup. |
| D03 | Initial raffle pool | Current, unarchived trainings only. Preserve archived training history without adding it to the initial current pool. | Stage 3 fixture/round semantics and Stage 6 initial round; no real-history reconstruction under D11. |
| D04 | Enter attendance later | Keep a discreet date option so a coach can enter paper attendance for an earlier day. | Stage 2 prototype and Stage 4 session flow. |
| D05 | Credit units | `1.5` hours is approved for new practices and optional trainings; historical credit stays unchanged. | Stage 3 contract and Stages 4/6 credit/analytics. |
| D06 | Sub-teams | Settings supports named sub-teams, roster entry offers membership selection, and coaches can sort/filter by team. Default grouping can be Kaizen. Examples: Kaizen Blue 7th Grade, Kaizen Gray 7th Grade, Kaizen Blue 6th Grade and Kaizen Gray 6th Grade. Examples are not mandatory seed data. | Stage 2 prototype, Stage 3 membership foundation, Stage 4 roster and Stage 6 reporting. |
| D07 | Simultaneous memberships | Yes: players can belong to multiple teams at once. Maintain one player identity with multiple memberships, not duplicated player records. Each player/session still credits 1.5 hours and earns at most one optional-training ticket regardless of memberships. | Stage 2 revision, Stage 3 many-to-many foundation, Stages 4–6 filters, kiosk and reporting. |
| D08 | Jersey number across teams | Each player uses one jersey number across all their teams. Store it on the player, not as a separate number per membership. Preserve `0` versus `00`. | Stage 2 revision, Stage 3 player contract and Stage 5 lookup. |
| D09 | Offline gym use | Prepare the app/roster/settings while connected, then reopen and operate offline in coach or kiosk mode. Persist each change before successful feedback; retain work through refresh/close/reopen. A locally finished session awaiting sync does not block the next session. Automatically synchronize while the app is open and connected, without duplicate credit/tickets. Initial scope: one attendance iPad per session; synchronize before raffle draws. | Stage 3 queue/API/cache contract, Stage 4 offline app and coach flow, Stage 5 kiosk, Stage 6 draw gate, Stage 7 real-device rehearsal. |
| D10 | Expected practice attendees | After Start Practice, show **Who’s expected?** selectable team cards, **All Kaizen**, and **Take attendance**. Select one or several teams; snapshot the union of expected player IDs once. Only expected practices affect a player’s attendance percentage and streak; other teams’ practices do not count against them. Optional training opens directly and absence has no practice penalty. Later team/roster changes do not rewrite saved expectations. | Stage 2 focused prototype, Stage 3 expected-roster contract, Stage 4 coach flow, Stage 6 analytics. |
| D11 | Prelaunch data scope | Owner confirms the app has never officially been used; existing accounts/players/attendance are test/sample data. No real-history reconstruction or ambiguous legacy-identity backfill is required. This is not authorization to delete accounts, reset existing data or alter production. Preserve real records once official use starts. | Stage 3 isolated clean-schema rehearsal; deliberate test-data cleanup, if requested, separate from this work. |
| D12 | Rich analytics | Preserve the original Reports capabilities inventoried in simplification-analytics-inventory.md while keeping attendance simple. Adapt to stable IDs, expected practice attendees, multiple memberships and offline sync status. The prototype totals table is not the final analytics scope. | Stage 3 stores supporting data; Stage 6 restores/adapts full reports; Stage 7 verifies shared metrics and exports. |

Recommended PIN details for the prototype: four digits to avoid jersey-number collisions; changing the PIN replaces the default exit code rather than leaving `0000` as a bypass. Settings outside kiosk allow the signed-in coach to change/reset it. Persist the coach preference and make the active exit verifier available through interrupted connectivity. Length, recovery presentation and storage design remain implementation recommendations for review, not additional owner decisions.

### Recommendations that do not require blocking the prototype

These are proposals, not newly approved requirements. Include them in the Stage 2 walkthrough; record any owner corrections before dependent implementation.

| ID | Recommendation and rationale |
| --- | --- |
| P01 | Check-ins persist immediately as provisional attendance. **Finish & Save Attendance** finalizes credits and tickets once. Drafts show counts, not spendable raffle tickets. This avoids counting abandoned sessions. |
| P02 | Retain the recommendation to resume rather than overwrite an actively edited session. **Superseded in part by approved D09:** a locally finished session awaiting sync must not block another session. Preserve multiple pending sessions with independent identities and ordered operations. |
| P03 | Require an online, fully synchronized state with no active session before Start fresh. Bind each new session to the current raffle round at creation, regardless of whether raffle is enabled. Corrections keep that original round. |
| P04 | Keep existing draw semantics: a draw records a winner without consuming tickets. Preserve optional last-N exclusion as a draw filter, with new teams defaulting to no exclusion. It must not change accrued totals. Scope new exclusions to the current round. |
| P05 | Existing players receive a coach-reviewed first-name/number setup step; never invent jersey numbers or blindly split culturally diverse names. Allow manual coach attendance while setup is incomplete; only players with numbers appear in kiosk lookup. |
| P06 | Preserve guests as identifiable players with stable IDs. They can receive credit and optional-training tickets, matching the current pool. Keep guests out of regular-roster practice percentage/streak denominators. Guests without a number use coach attendance. |
| P07 | Retire a player from the active roster instead of scrubbing history. Retired players retain existing current-round tickets; exclusion from future draws, if desired, is a separate explicit action and outside the basic removal flow. |
| P08 | Implement approved D04 with a small **Change date** action beside **Today** on attendance, after session entry (practice expectation confirmation under D10, direct entry for training). Keep that chosen date across resume/sync and show it in the finish summary. Use date-only local-calendar semantics; retain raw legacy dates. Date edits never move existing raffle eligibility between rounds. For a newly entered backdated training, recommend the current round at record creation, not a guessed historical round; review this policy in Stage 2. |
| P09 | Keep an attendance correction workflow for the last finalized session; broader history editing is not required. Corrections update the same session and do not erase past draw results. An affected draw remains an auditable historical result. |
| P10 | Archive remains a reporting/season organization action; it does not reset or revive raffle eligibility. Keep current-season analytics scope by default and retain archived access. |
| P11 | No automatic weekly raffle reset, ticket expiration or round close after a draw. Start fresh is the explicit round boundary. |
| P12 | Sub-teams organize one coach's program. Use approved multiple memberships with stable player/sub-team IDs, snapshot membership sets for new history, and leave unavailable historical membership unknown. Keep one coach-wide raffle and one ticket per player/session regardless of group filtering. Filtering cards must not unmark hidden attendees or redefine who was expected at a session. Proposed per-team reports may overlap for multi-team players; clearly label that team totals are not additive, and deduplicate whole-program totals. D10 now approves expected-team practice selection and expected-player denominators; presentation-only filters still never change saved expectations. |

Membership cardinality is resolved by D07 and jersey placement by D08. Sub-team-specific raffles remain unapproved. D10 separately approves expected-player practice denominators; it does not make every report filter redefine expectations.

Stage 1 completion does not mean these recommendations were approved. Stages 3–6 must resolve any disputed recommendation affecting stored data before committing to that behavior.

## 4. Screen and interaction contract

### Home

- Primary actions: **Start Practice**, **Start Optional Training**. Optional training opens attendance directly. Practice opens the short **Who’s expected?** team-card selection, then **Take attendance**; no time/duration setup.
- Secondary: **Roster**, **Progress**, **Raffle** when enabled, **Settings**. Preserve theme, team identity and existing exports without crowding the start flow.
- If a session exists: **Resume Practice/Training** and a clear date. New start actions cannot overwrite it.
- Default to today; keep backdating behind a small **Change date** action on the attendance screen, not another required start step (recommended presentation of D04).
- If a finish is pending: show **Saved on this device — waiting to sync** and **Retry sync**. Allow a new session once the previous finish is durably queued, even before cloud acknowledgment (D09). Never replace the queued session.
- An empty roster directs the coach to add players; it is not a silent dead end.
- No elapsed time, countdown, start/end time or duration control in session banners, keyboard menus, mobile navigation or the home page.

### Who’s expected? (approved D10)

- Show this short step only after **Start Practice**. Offer active team cards with clear selected states, an explicit **All Kaizen** choice and **Take attendance**. A multi-team player appears once in the union; no selection must not silently mean everyone. With no custom teams, offer the single default Kaizen group.
- Save selected team IDs and resolved expected-player IDs with the practice when attendance begins. Current roster membership changes and later filtering never mutate that snapshot. Preserve it through refresh and, once D09 is implemented, offline reopen/sync.
- Marking present/absent remains separate from who was expected. Optional trainings have no expected-attendance absence denominator.
- Recommended exception handling, not yet a blanket-approved policy: a discreet **Adjust players** action before attendance and a way to mark an unexpected participant present. Before production analytics implementation, resolve excused absences, corrections to an already-saved expectation set, and whether an unexpected appearance extends a streak. Do not infer these from D10. Unexpected attendance can retain credit without being misclassified as expected or pushing attendance above 100%.

### Roster

- Structured first name, jersey number, optional distinguishing label and team membership; preserve guest status.
- Settings offers **Sub-teams** with **Add sub-team** and editable names. With none configured, players use the default Kaizen grouping and roster entry needs no extra decision. When sub-teams exist, show a multi-select or checkboxes while adding/editing a player; changing one membership must not remove the others.
- Show a small team label on cards and **All teams** / team filters plus sorting/grouping by team on coach roster and Progress. Recommended attendance filtering is presentation-only: retain selected players hidden by the filter and display the overall present count. Kiosk number matches include team labels and remain unambiguous across teams.
- Display `Alex · #12`; if another Alex wears 12, ask the coach to distinguish the cards, e.g. `Alex M. · #12` and `Alex R. · #12`. Editing an existing card may be needed too.
- A shared initial is not sufficient if cards are still identical; accept a short unique label. Do not demand full legal names.
- Names are trimmed and compared with a documented case-insensitive policy for collision detection, while original casing/diacritics are preserved for display. Name normalization is never identity.
- Recommended numbers are digit strings of 1–3 characters; `0` and `00` are distinct as approved in D02. Four-digit exit input is processed only on explicit submit. Do not auto-submit at the first valid prefix.
- Number/label edits preserve player ID. Incomplete legacy cards remain selectable by coach with **Add number** guidance. Do not make up shared sentinel numbers.
- Retire confirmation explicitly says historical attendance and tickets are retained under P07.
- Moving a player between sub-teams retains their player ID, attendance, hours and tickets. Recommended sub-team retirement removes it from future choices without erasing historical membership; do not delete its players.
- Show each person once in All teams and kiosk results, even when several memberships match. Show membership labels on their card. Checking in from any team view changes the same player/session attendance; it never creates a second credit or ticket.

### Coach attendance

- Session type/date, number present, large roster cards, **Enter Kiosk Mode**, **Finish & Save Attendance**.
- **Change date** is secondary and available before finalizing, including after marks were entered. Changing it preserves selections and 1.5-hour credit. Backdated paper entry uses the same session flow; returning to a new session defaults to today again.
- Tap a card to set present; tap again to set absent. Use explicit desired-state writes, not a remote toggle operation that reverses on retry.
- Color, icon and text indicate selection; keyboard interaction and accessible names are required.
- Save draft changes immediately to durable local storage and synchronize when available. Show device-saved versus cloud-saved status accurately.
- Finish freezes a version of attendance, credits each attendee once, and returns to a simple summary/home after acknowledgment. Zero-attendee finish requires explicit confirmation.
- Canceling an edit leaves the last finalized version intact. Opening an editor does not remove credits, tickets or the historical event.

### Kiosk

1. Number pad with **Find player**, clear/backspace, and minimal session context.
2. Enter number and submit. Show all matching cards, including distinctions and checked-in states. A single match still requires a tap.
3. Tap an absent card: mark that exact player present, display confirmation, then clear input and return to the number pad. Disable repeat submission while the local write is pending.
4. Look up the number again to see present status; choose **Undo check-in** on the selected card to correct a mistake. Show undo feedback and reset.
5. No match: **No player found for #... — try again or ask your coach**. Do not expose roster editing or email addresses.
6. Enter/submit `0000` by default, or the coach's configured PIN, to return to coach attendance. Exiting does not finish, clear or restart the session. Offer PIN setup/change in coach Settings; demonstrate default and custom-code paths in Stage 2.

Kiosk uses the same session/player IDs as manual attendance. Disable coach navigation, command palette and swipe shortcuts while active. Restore kiosk mode after refresh when the bound session remains active. If the session was closed elsewhere, show **Session finished — ask your coach** rather than a working coach dashboard. This is a supervised shared-device UI, not player authentication or operating-system lockdown.

### Progress and raffle

- Progress retains attendance counts, practice/training credit, trends and existing export access. Label estimated effort **Credited hours**.
- Raffle OFF hides draw tools, not earning. Settings explains that tickets keep accumulating.
- OFF → ON opens a dialog: **Use existing raffle tickets? Your players have earned {N} tickets from optional trainings.** Buttons: **Keep {N} tickets**, **Start fresh**, **Cancel**. For zero, use grammatical zero-ticket copy with the same semantics.
- Keep is the recommended primary action. Start fresh explains: **Begin a new raffle round with zero eligible tickets. Attendance, credited hours and previous raffle results stay unchanged.**
- Cancel changes nothing. The enable/round choice is one atomic server operation. A stale dialog refreshes its count before confirmation rather than silently resetting a newer round.
- ON → OFF is a visibility/draw-availability change only. OFF does not close the round. No repeat dialog merely on page reload.

## 5. Session state and reliability contract

Recommended model: session lifecycle and delivery status are separate. D10 adds expectation selection before practice creation; optional training still starts directly. Offline is not a second kind of session.

| State/action | Required transition/result |
| --- | --- |
| Idle → Start | Create unique session ID once; type, local date and 1.5 hours; snapshot the round and roster membership used for attendance reporting. |
| Active → mark/unmark | Persist `(coach, session, player, desired present state, operation ID, expected revision)`; same operation replay returns same result. |
| Active → kiosk / exit | Change local presentation only. Do not create a new session or credit. |
| Active → refresh/close/reopen offline | Load the cached app and coach-scoped data on the prepared device; recover session/kiosk binding, attendance and queued operations without a network request being required for entry. Reconcile when reachable. |
| Active → Finish | Freeze attendance revision and durably queue finalization before confirming local completion. Permit the next local session; deliver queued operations when connected. Repeat delivery cannot duplicate sessions, attendance, credits or tickets. |
| Finishing → network failure | Retain pending finalize and local attendance; show waiting-to-sync. Do not claim cloud completion or permit a draw based on pending tickets. |
| Finishing → validation/authorization failure | Show actionable failure; retain recoverable draft. Do not clear selections in a finally block. |
| Finishing → acknowledgment | Mark completed, clear only acknowledged operations for this exact session, show saved summary. |
| Completed → correction | Edit a versioned draft of the same session; atomic commit revises attendance/credits/tickets in its original round. |
| Stale write to completed session | Reject as a conflict; never implicitly reopen or overwrite final attendance. |
| Auth expired | Pause remote sync and retain coach-scoped queued work. On a prepared, not-explicitly-signed-out device, preserve offline attendance access for that local owner; require the same coach to reauthenticate online before upload. Cached identity is never server authorization. |
| Coach switch/logout | Never display or replay another coach's draft, tickets or winners. Warn of pending local work; namespace caches and queues by owner. |

Use a durable queue, not the existing single global pending-event slot. IndexedDB is a recommended implementation choice, not a new product dependency. Persist local intent before showing a successful tap. Expose persistence failure (quota/private browsing) rather than silently promising recovery.

Distinguish a locally open session from locally finished sessions awaiting delivery. The first release uses one attendance iPad per session (D09); simultaneous disconnected editing of the same session on several devices is outside this release. Stage 3 must define session sequencing so a server record still awaiting finalization does not prevent subsequent offline sessions from being preserved and later synchronized. Compare revisions on changes; accept non-conflicting operations deliberately, surface true conflicts for coach resolution, and do not use the device clock as the sole authority. After lost acknowledgments, retry the same operation ID. Finishing a session must target that session ID, never delete a different active session by coach alone.

### Approved offline gym contract (D09)

- School guest Wi-Fi is optional for attendance. Initial sign-in/setup and preparation require connectivity: cache the app shell and required assets, roster, memberships, settings, exit-code verifier and known raffle-round identity. Show an accurate readiness/last-sync indicator; never call a device ready if a required cache/write failed.
- A prepared device must open the app after it has been closed, in airplane mode, with no existing session required. Start practice/training, choose a date, mark/undo, enter/exit kiosk and finish without internet. Offline reopening is now in scope; first-ever use on an unprepared device is not.
- Persist every attendance intent and session transition before successful feedback, including kiosk check-in/undo and finish. Show **Saved on this iPad · Waiting to sync**, **All changes synced**, or a clear local-save failure. Do not present a failed local write as safely recorded. Distinguish local credit/tickets awaiting sync from the authoritative draw pool.
- Retain multiple locally finished, unsynchronized sessions and allow the next session to start. Never overwrite an older queue item. Retry automatically when the app is open and usable connectivity returns; retry on reopening as well. Do not promise background sync while the app is closed. A connection indicator alone is not a server acknowledgment.
- Persist stable session/operation identities and per-session ordering. Delayed acknowledgments may clear only their own acknowledged operations; they must not clear a newer active session. Replayed starts, marks, undos and finishes cannot duplicate attendance, hours or tickets. Preserve pending work through application updates and failed network/auth requests.
- Initial operating scope is one attendance iPad per session. Preserve conflict detection for stale/other-device changes; never silently use last-write-wins or weaken coach ownership. Stage 3 defines an explicit recoverable handoff/conflict path, not unsupported simultaneous offline collaboration.
- Do not reset rounds or draw while offline or while known attendance remains unsynchronized. Start fresh additionally requires no active session; server guards round revision/session state against races. Sessions created offline retain their cached original round ID. If another device has advanced the round, retain and flag that assignment for reconciliation; never silently place old work in the new pool. The server cannot prove that an unseen disconnected device has no pending work.
- Stage 3 chooses durable storage/cache/auth/update contracts; IndexedDB and a service-worker-backed installable web app are engineering recommendations, not proof of reliability. Explain that first-time setup, signing in again and remote sync need internet, and that clearing browser/site data can remove unsynced local records. Do not promise recovery after device loss or deliberate storage deletion.


## 6. Proposed data contract

Logical entities, not final SQL. Stage 3 chooses additive columns/tables after inspecting the actual environment. Prefer versioned operations to changing the meaning of existing RPC arguments.

| Entity | Core fields and invariants |
| --- | --- |
| Player | Existing roster UUID when resolvable; coach ID; first name; number string; distinguishing label; guest flag; active/retired; retained legacy name/display snapshot. Never key history by number/name. |
| Sub-team / membership | Stable coach-owned sub-team ID, display name, active/retired status; many-to-many player/sub-team membership with unique owner/player/team combination. Default current grouping Kaizen when none configured; preserve existing program names/settings. Session membership snapshots support sets of teams. The jersey number belongs to the player (D08). Never use a mutable team name in a player identity key. |
| Session | Stable existing event ID when migrated; coach; type; local calendar date; raw legacy date; credit hours; active/completed state; revision; creation/finalization audit timestamps; immutable original raffle-round assignment. |
| Attendance | Coach/session/player composite ownership; unique session/player record; present state and revision; source operation IDs; display snapshot for historical readability. |
| Reporting membership | Session roster/guest/sub-team snapshots for new sessions so later changes do not rewrite historical attribution. Legacy membership marked unknown where unavailable. Session target/expected roster is separate from a UI team filter; D10 defines expected practice attendees as the union of selected teams, captured once; preserve the selected team IDs and resolved expected-player IDs separately from reporting filters. |
| Raffle round | Coach; ID; generation/revision; open/closed state; boundary audit timestamps. Exactly one current round even while raffle is off. |
| Ticket entitlement | Unique original training-session/player pair; immutable round assignment; eligible/revoked state or equivalent derived membership. Reinstatement updates the same entitlement in the same round. |
| Draw | Coach/round; idempotency key; eligible-pool snapshot or verifiable revision; selected ticket/player; displayed name; prize; timestamp; exclusions. Undo is a recorded void, not silent deletion. |
| Prelaunch sample data | D11 removes the real-history mapping requirement. Use invented isolated fixtures; do not copy private records or reset existing sample accounts without separate authorization. |
| Outbox | Owner/device/session/operation identity, desired change, base revision, per-session ordering/dependencies and queued/acknowledged/conflict state; retains multiple locally finished sessions beside the next active session. A retry must not become a new intent or clear another session. |
| Offline preparation | Owner-scoped roster/settings/membership/round snapshots, cached app/schema versions, readiness and last successful sync; durable kiosk/session binding. Prepared offline access is distinct from fresh server authorization. |

Use either stored ticket entitlements or a tested derivation from immutable session-round membership; do not maintain an unrelated counter that can drift from attendance. Requirements are invariant regardless of representation.

All browser-accessible records need both appropriate object grants and coach ownership controls. Validate foreign ownership at the database/server boundary, including conflicting IDs supplied to upserts and archive restores. Never trust client-supplied owner IDs or user-editable metadata for authorization. Preserve existing super-admin membership verification; no new role-management UI is needed.

Do not grant browser SELECT on `admin_coach_summary_view` to make the simplification work. New tables/columns must remain compatible with admin aggregate queries, exports and the authorized backend. Confirm the sole admin account as a release check, not by auto-promoting whichever user submits that email.

## 7. Raffle and analytics invariants

### Raffle examples

| Scenario | Expected result under recommendations |
| --- | --- |
| Player attends two finalized trainings and one practice; raffle off | 2 accrued tickets, 4.5 credited hours for these new sessions. |
| Turn on and keep | Same 2 tickets; no attendance/hour changes. |
| Turn off, attend another finalized training, turn on and keep | 3 tickets in the same round. |
| Turn on and start fresh | 0 tickets in new round; earlier 4.5/6.0-hour history remains exactly as recorded. |
| Attend another new-round training | 1 ticket in current round. |
| Remove then restore attendance on old-round training | Old entitlement is revoked/reinstated there; current round stays at 1. |
| Add a previously absent player to an old session | Entitlement belongs to that session's original round; not the current round merely because the edit is new. |
| Archive or restore a session | Reporting location changes; its identity, credit and round assignment do not. |
| Repeat a finish/reset request after lost response | Return original result; do not award twice or open another empty round. |
| Draw a winner | Record result once; accrued tickets stay. Optional exclusions change the draw pool only. |

No stored player-total counter is authoritative over the underlying attendance. Historical draw records preserve what was drawn at the time even if attendance is later corrected; show a correction/void trail as appropriate.

### Analytics semantics

- Per-player credit: sum recorded credit hours of distinct finalized sessions attended. New session value is 1.5 hours; historical values are unchanged, including old sessions later corrected.
- Session-hours: sum session durations once per session. Player-hours: sum attendee credits. Five attendees at one new practice = 1.5 session-hours and 7.5 player-hours. Label these distinctly.
- Preserve existing practice-based attendance percentages/streaks; optional-training absence does not lower them. Under D10, use each practice’s saved expected-player set as the denominator and streak sequence. Practices where the player was not expected do not break their streak. D11 removes the need to reconstruct real prelaunch history.
- Preserve existing guest exclusion from regular-roster percentages; guest attendance and credit remain available where currently shown.
- Player renames/numbers affect display, not totals or winner matching. Report missing historical membership as a limitation instead of silently recalculating unsupported denominators.
- D10 approves practice targeting by team selection. Saved expected-player IDs are distinct from current team filters. Proposed team reporting offers clearly labeled **Current roster** comparisons and **Team at session** historical attribution. In historical mode, filter qualifying attendance by recorded membership sets, not current memberships; calculate the displayed hours from that selected attendance. Do not move old credit between historical groups when a player transfers. Legacy records with unknown membership remain in overall totals and an explicit unknown group. Whole-program totals count each player/session once even when the player has multiple memberships.
- Raffle visibility, keep, reset and draw leave analytics unchanged. Reporting filters/season archive may change the selected scope, but records remain accessible and lifetime reconciliation counts each session once.
- CSV/PDF and admin session counts use the same canonical IDs and data adapters as the app; no double-counting live/archive copies.

## 8. Data foundation, release and recovery (revised by D11)

The earlier legacy reconstruction plan is superseded: the owner confirms that existing data is test/sample data, not real historical usage. Keep historical commits as the record of the prior plan, not as an instruction to perform unnecessary reconstruction.

### Stage 3 — isolated schema and operation rehearsal

1. Inspect the available schema, constraints, grants, views, triggers and RPC contracts in an isolated environment. Do not assume every checked-in migration matches the deployed-like structure. Do not query or change production for this stage.
2. Design stable coach-owned players, multiple memberships, sessions, expected-player snapshots (D10), attendance, independent raffle rounds and durable operation identities (D09). Preserve the sole super-admin and secured backend boundary.
3. Use invented fixtures in a clean isolated database to verify constraints, cross-coach rejection, repeat-safe setup and idempotent start/mark/undo/finish/reset operations. Replaying a delivered operation must not duplicate attendance, hours, rounds or tickets or clear a newer active session. Test multiple locally finished sessions waiting for delivery.
4. Reuse existing schema where appropriate, but do not require real-history name matching, archive reconstruction, uncertain old winner imports or a live-data backfill reconciliation project. Existing sample accounts/data must remain untouched unless separately authorized for cleanup.
5. Retain tests with synthetic varied durations, archived sessions and older rounds to prove future history is preserved. D11 does not authorize destructive raffle resets or retirement that erases attendance after launch.
6. If no isolated environment is available, report that gap rather than substituting production. The offline app shell/queue UI belongs to Stages 4–5, not this stage.

### Stage 8 — separately authorized release

- Record the exact reviewed commit, schema changes, backups/recovery approach and deployment order. Server contracts and ownership checks precede the compatible frontend.
- Define how old test-client writes are rejected or safely handled after schema changes; prevent legacy destructive reset/removal from bypassing the new rules.
- Test-data deletion/account cleanup/reset requires a separate explicit request and a scoped list. Test status alone is not deletion authorization.
- Validate reports, expected-attendance percentages, credit, raffle eligibility and privileged access in the release checks. Once official use starts, all real attendance, expectations, credit and draw history must remain recoverable through updates.
- Recovery must preserve pending offline operations and any real post-launch writes. Rehearse a compatible rollback or forward fix; do not blindly restore an old snapshot over newer attendance.

## 9. Acceptance matrix

Each criterion must be demonstrated in Stage 7 against the approved decision log. Stage 1 does not assert these pass yet.

| ID | Scenario and pass condition | Stage |
| --- | --- | --- |
| A01 | Practice opens Who’s expected?, then attendance after team confirmation; optional training opens attendance directly. No time/duration prompt or timer. | 2, 4 |
| A02 | Each new attendance credits 1.5 hours; correcting a historical 2-hour event retains its 2-hour duration. | 3, 4, 6 |
| A03 | Same number shows multiple cards; same first-name/number requires a distinguishing label; collisions remaining after an initial cannot save unresolved. | 3–5 |
| A04 | Rename/renumber keeps history, credits, ticket ownership and prior draw identity. | 3, 6 |
| A05 | Manual present/absent changes are immediately clear and persist across navigation/refresh. | 4 |
| A06 | Kiosk handles one/multiple/no matches, distinct `0`/`00`, repeated entry, correct undo, cleared input and exit without ending session. Default `0000` and coach-set PIN flows work; under the recommended replacement policy, `0000` stops working after a custom PIN is set. | 2, 5 |
| A07 | Kiosk blocks ordinary coach navigation and stays in its session presentation on refresh. | 5 |
| A08 | Offline changes survive refresh and reconnect with accurate local/pending/synced labels; persistence failure is visible in coach AND kiosk modes, with no false successful-save feedback. | 4, 5 |
| A09 | Double-start, double-finish, lost acknowledgment, delayed retry and a second device cannot duplicate credit or delete another active session. | 3, 4 |
| A10 | Coach switch/expired auth cannot expose or submit another coach's cached work. | 3, 4 |
| A11 | Practice earns zero; each finalized training attendee earns one while raffle off or on. | 6 |
| A12 | Keep/Start fresh/Cancel work with zero and nonzero accrued tickets; off/on and reset retries are atomic and idempotent. | 6 |
| A13 | A reset racing another device or pending old-session update cannot migrate old tickets into a new round. | 3, 6 |
| A14 | Attendance undo/correction updates one original entitlement; old-session edits and archive restore cannot revive closed-round eligibility. | 6 |
| A15 | Draw is weighted by eligible tickets; recording/undoing a draw preserves history and does not alter attendance/credit. | 6 |
| A16 | Guests, retired players, missing numbers and ambiguous legacy identities follow the reviewed recommendations without lost history. | 3–6 |
| A17 | New teams default on, explicit legacy false stays false, settings fetch failure cannot reset settings. | 3, 6 |
| A18 | Analytics, CSV/PDF and admin counts reconcile; raffle actions do not alter underlying effort totals. | 6, 7 |
| A19 | Isolated schema setup/rehearsal is repeat-safe; operation retries duplicate no records. D11 excludes real-history reconstruction; existing test accounts/data are untouched without separate cleanup authorization. | 3, 7 |
| A20 | Coach A cannot read/write Coach B's records through APIs/RPCs or supplied foreign IDs. Only the designated admin has admin membership; browser access to the privileged view remains closed. | 3, 7, 8 |
| A21 | Old-client mutation attempts after cutover are safely adapted or rejected; tested recovery preserves new writes. | 7, 8 |
| A22 | Phone/tablet layouts, keyboard/focus behavior, touch targets, labels and contrast make check-in usable without relying only on color. | 2, 4, 5, 7 |
| A23 | Start defaults to today; a discreet date action permits an earlier date without time/duration controls. Selecting a date preserves attendance across refresh/sync and still credits 1.5 hours; an existing session's date correction does not move its raffle round. | 2–4, 6 |
| A24 | No custom sub-teams gives a simple default Kaizen group; Settings can add named sub-teams and roster entry offers selection. Team sort/filter handles shared names/numbers, preserves hidden attendance selections and overall totals, and transfers preserve player identity/history. | 2–6 |
| A25 | Historical team attribution does not change on transfer; unknown legacy membership is explicit. Group filters cannot duplicate player/session credit or raffle tickets or grant access to another coach's data. | 3, 6, 7 |
| A26 | One player belongs to two teams; either team filter finds the same player, All teams/kiosk show them once, and one training yields 1.5 credited hours and one ticket. Removing one membership preserves the other and historical membership sets. Jersey lookup uses the one player-wide number approved in D08. | 2–7 |
| A27 | Prepare a supported iPad online, close the app, enable airplane mode, reopen without an existing session, start practice/training, mark/undo, backdate, use kiosk and exit, finish, close/reopen again; all saved data and correct kiosk binding survive without network access. | 4, 5, 7 |
| A28 | Offline, finish session A, start/finish B, start C, then close/reopen. Reconnect with delayed/lost acknowledgments and repeat delivery: A/B each finalize once, C remains intact, hours and training tickets reconcile exactly. | 3, 4, 7 |
| A29 | While app is open, connectivity restoration triggers sync automatically; reopening later also retries. Auth expiration pauses upload until the same coach reauthenticates, preserving offline records and preventing cross-coach access. Draw/reset stays unavailable offline or with known pending work. | 3–7 |
| A30 | Missing preparation, failed/quota-limited local writes and interrupted app updates never falsely report readiness or safe attendance. Exercise failed check-in AND undo/finish, recovery, stale cached round conflicts and queue preservation using real storage/network failures; fixture toggles alone do not satisfy acceptance. | 3–7 |
| A31 | Select two practice teams sharing a player; confirm one expected-player entry, one attendance and one 1.5-hour credit, no practice raffle ticket. Other-team-only players are not automatically expected. All Kaizen includes the whole eligible program roster once. | 2–7 |
| A32 | Player expected at practices A/C, present A and absent C: 50% practice attendance; intervening B for another team neither counts as a miss nor breaks the streak. A later membership edit does not change saved A/B/C expectations. Optional-training absence has no penalty. | 2, 3, 6, 7 |
| A33 | Original report features in the analytics inventory remain accessible; shared expected-practice percentage definitions agree on screen and in CSV/PDF. Multi-team filters and offline-to-synced transitions never duplicate credit or change saved expectations. | 6, 7 |

## 10. Build sequence and handoff boundaries

| Stage | Deliverable | Model / effort recommendation | Dependency / exit |
| --- | --- | --- | --- |
| 1 | This specification and progress handoff | Astra / High | Complete documentation; approved choices and recommendations distinguished. |
| 2 | Fixture-driven isolated prototype and audit revision | Claude Sonnet / High for the revision | Next: demonstrate D10 expected-team selection while retaining the completed audit fixes. D09 remains a future reliability implementation; D12 records full reporting scope. Review remaining recommendations separately. No schema work. |
| 3 | Identity, memberships, expected attendance, rounds and isolated schema/operation rehearsal | Claude Opus 5 / High | Resolve data-affecting decisions; stable IDs, multi-session offline operation ordering, cached ownership/round contracts and reconciliation tests pass in isolation (D09). |
| 4 | Coach session/roster workflow | Sol / High | Stage 3 API/data contract; prepared-device offline launch, durable multi-session queue, reliable save/resume and new duration default (D09). |
| 5 | Kiosk workflow | Claude Sonnet / High | Stage 4 attendance semantics and approved number/exit policy. |
| 6 | Raffle activation, rounds and analytics integration | Claude Opus 5 / High | Stage 3 round model and Stage 4 finalization; independent reset. |
| 7 | Independent review and full acceptance rehearsal | Astra / Extra high | A01–A33 checked, including actual iPad airplane-mode close/reopen and reconnection; existing test failures separated from regressions. |
| 8 | Authorized production release and verification | Sol / High | Reviewed exact commit, migration rehearsal and recovery point. |

Execute sequentially, carrying code and these documents forward. These are model recommendations from the prior build plan, not permission to start tasks or delegate work automatically.

## 11. Stage 1 verification and limits

Source review covered session setup/store, attendance, draft helpers, RPC migrations, player removal, raffle earning/reset/draw, analytics, exports, settings/navigation and admin authorization. Repository/ancestor instruction discovery found no applicable `AGENTS.md`; use fresh discovery in later stages.

No application source, SQL, dependency, environment or deployment changes are included. No production data or settings were accessed during Stage 1. A baseline local test run is recorded in the progress document. Browser acceptance and database migration tests are future-stage work, not completed checks.

The plan preserves the remaining stored data; it cannot recover previously deleted training attendance, previously scrubbed player names or unavailable browser-local raffle results. A later deployment inventory is necessary because checked-in migrations and production may differ.
