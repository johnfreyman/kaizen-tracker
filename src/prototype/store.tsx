/**
 * Stage 2 prototype store.
 *
 * Entirely in-memory plus one namespaced localStorage key so a refresh can be
 * demonstrated (R07). There is no Supabase client, no fetch, no RPC and no
 * migration here: the prototype must not touch production or any database
 * (spec §10, Stage 2 exit criteria).
 *
 * Where the real app will need a durable outbox, revisions and server-side
 * idempotency (spec §5), this file keeps the *shape* of those ideas — an
 * operation id, a revision counter and a delivery state distinct from the
 * session lifecycle — so the walkthrough shows the intended behavior without
 * pretending to implement the reliability guarantees.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import { DEFAULT_GROUP_NAME, buildScenario } from "./fixtures";
import type {
  ActiveSession,
  DeliveryState,
  FinalizedSession,
  Player,
  PrototypeState,
  ScenarioId,
  SessionType,
} from "./types";

// Bumped for the Stage 2 revision: Player.subTeamId (scalar) became
// Player.subTeamIds (array). A browser holding an old-shaped cached state
// would otherwise crash on the new array-based reads below.
const STORAGE_KEY = "kaizen-stage2-prototype-v2";

/** New sessions credit 1.5 hours (D05). Never 90. */
export const NEW_SESSION_CREDIT_HOURS = 1.5;

export function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

let opCounter = 0;
const nextOpId = () => `op-${Date.now().toString(36)}-${++opCounter}`;

/**
 * Who D10's "Who's expected?" step would snapshot right now: the whole
 * eligible roster for the explicit All Kaizen choice (reaching players with
 * no sub-team, e.g. guests), or the union of current members of the
 * selected teams. Each player is visited once, so one on several selected
 * teams is never counted twice.
 */
export function resolveExpectedPlayerIds(
  state: PrototypeState,
  teamIds: string[],
  allKaizen: boolean,
): string[] {
  const eligible = state.players.filter((p) => !p.retired);
  const chosen = allKaizen
    ? eligible
    : eligible.filter((p) => p.subTeamIds.some((id) => teamIds.includes(id)));
  return chosen.map((p) => p.id);
}

type Action =
  | { type: "reset"; scenario: ScenarioId }
  | { type: "start"; sessionType: SessionType }
  | { type: "startPractice"; teamIds: string[]; allKaizen: boolean }
  | { type: "setPresent"; playerId: string; present: boolean; opId: string }
  | { type: "changeDate"; date: string }
  | { type: "finish" }
  | { type: "retrySync" }
  | { type: "discardPending" }
  | { type: "enterKiosk" }
  | { type: "exitKiosk" }
  | { type: "closeElsewhere" }
  | { type: "acknowledgeClosedElsewhere" }
  | { type: "dismissSummary" }
  | { type: "setNetwork"; mode: PrototypeState["networkMode"] }
  | { type: "setSimulateStorageFailure"; on: boolean }
  | { type: "setLocalPersistenceFailed"; failed: boolean }
  | { type: "addPlayer"; player: Player }
  | { type: "updatePlayer"; playerId: string; patch: Partial<Player> }
  | { type: "addSubTeam"; name: string }
  | { type: "renameSubTeam"; id: string; name: string }
  | { type: "retireSubTeam"; id: string }
  | { type: "setExitPin"; pin: string }
  | { type: "resetExitCode" }
  | { type: "setRaffle"; enabled: boolean }
  | { type: "startFreshRound" };

export function reducer(state: PrototypeState, action: Action): PrototypeState {
  switch (action.type) {
    case "reset":
      return buildScenario(action.scenario);

    case "start": {
      // P02: one unfinished session per coach. Never silently replaced.
      if (state.activeSession) return state;
      return {
        ...state,
        lastFinished: null,
        activeSession: {
          id: `sess-${Date.now().toString(36)}`,
          type: action.sessionType,
          date: todayIso(),
          creditHours: NEW_SESSION_CREDIT_HOURS,
          roundId: state.currentRoundId, // bound at creation, raffle on or off (P03)
          present: {},
          revision: 0,
          delivery: "device",
          closedElsewhere: false,
        },
      };
    }

    case "startPractice": {
      // Same P02 guard as "start": never silently replace or orphan an
      // existing session. Cancel on the "Who's expected?" screen never
      // reaches here at all, so it cannot create anything either.
      if (state.activeSession) return state;
      const playerIds = resolveExpectedPlayerIds(state, action.teamIds, action.allKaizen);
      return {
        ...state,
        lastFinished: null,
        activeSession: {
          id: `sess-${Date.now().toString(36)}`,
          type: "practice",
          date: todayIso(),
          creditHours: NEW_SESSION_CREDIT_HOURS,
          roundId: state.currentRoundId,
          present: {},
          revision: 0,
          delivery: "device",
          closedElsewhere: false,
          expected: {
            teamIds: action.allKaizen ? [] : action.teamIds,
            allKaizen: action.allKaizen,
            playerIds,
          },
        },
      };
    }

    case "setPresent": {
      const s = state.activeSession;
      if (!s || s.closedElsewhere) return state;
      // Explicit desired-state write, not a toggle that reverses on retry (§4).
      if (s.present[action.playerId] === action.present) return state;
      return {
        ...state,
        activeSession: {
          ...s,
          present: { ...s.present, [action.playerId]: action.present },
          revision: s.revision + 1,
          delivery: state.networkMode === "online" ? "device" : s.delivery,
        },
      };
    }

    case "changeDate": {
      const s = state.activeSession;
      if (!s) return state;
      // Selections and the 1.5-hour credit survive a date change (A23).
      return { ...state, activeSession: { ...s, date: action.date, revision: s.revision + 1 } };
    }

    case "finish": {
      const s = state.activeSession;
      if (!s || s.closedElsewhere) return state;

      if (state.networkMode === "failing") {
        return { ...state, activeSession: { ...s, delivery: "failed" } };
      }
      if (state.networkMode === "offline") {
        // Saved on the device, not acknowledged by the cloud. No tickets yet.
        return { ...state, activeSession: { ...s, delivery: "pending" } };
      }

      const attendeeIds = Object.entries(s.present)
        .filter(([, v]) => v)
        .map(([id]) => id);
      const teamAtSession: Record<string, string[]> = {};
      for (const id of attendeeIds) {
        teamAtSession[id] = state.players.find((p) => p.id === id)?.subTeamIds ?? [];
      }
      const finalized: FinalizedSession = {
        id: s.id,
        type: s.type,
        date: s.date,
        creditHours: s.creditHours,
        attendeeIds,
        roundId: s.roundId, // keeps its original round even if backdated (P08)
        archived: false,
        teamAtSession,
        expected: s.expected, // saved once at creation; never recomputed (D10)
      };
      return {
        ...state,
        sessions: [...state.sessions, finalized],
        activeSession: null,
        kioskSessionId: null,
        lastFinished: {
          id: s.id,
          summary: `${attendeeIds.length} present · ${s.creditHours} hours credited each`,
        },
      };
    }

    case "retrySync": {
      const s = state.activeSession;
      if (!s) return state;
      if (state.networkMode !== "online") return state;
      return reducer({ ...state, activeSession: { ...s, delivery: "device" } }, { type: "finish" });
    }

    case "discardPending": {
      const s = state.activeSession;
      if (!s) return state;
      return { ...state, activeSession: { ...s, delivery: "device" } };
    }

    case "enterKiosk": {
      const s = state.activeSession;
      if (!s) return state;
      return { ...state, kioskSessionId: s.id };
    }

    case "exitKiosk":
      // Exiting never finishes, clears or restarts the session (§4 Kiosk).
      return { ...state, kioskSessionId: null };

    case "closeElsewhere": {
      const s = state.activeSession;
      if (!s) return state;
      return { ...state, activeSession: { ...s, closedElsewhere: true } };
    }

    case "acknowledgeClosedElsewhere": {
      // The coach's reconciliation exit from a session finished elsewhere
      // (F04): clears the stale session so Home stops offering to "Resume"
      // a training that is already finished. It never revives it.
      const s = state.activeSession;
      if (!s || !s.closedElsewhere) return state;
      return { ...state, activeSession: null, kioskSessionId: null };
    }

    case "dismissSummary":
      return { ...state, lastFinished: null };

    case "setNetwork":
      return { ...state, networkMode: action.mode };

    case "setSimulateStorageFailure":
      return { ...state, simulateStorageFailure: action.on };

    case "setLocalPersistenceFailed":
      // Bail out with the same reference when nothing changed, so the save
      // effect below does not dispatch itself into an infinite loop.
      if (state.localPersistenceFailed === action.failed) return state;
      return { ...state, localPersistenceFailed: action.failed };

    case "addPlayer":
      return { ...state, players: [...state.players, action.player] };

    case "updatePlayer":
      // Identity is the id. Renames and renumbers never move history (A04).
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, ...action.patch } : p,
        ),
      };

    case "addSubTeam":
      return {
        ...state,
        subTeams: [
          ...state.subTeams,
          { id: `st-${Date.now().toString(36)}`, name: action.name, active: true },
        ],
      };

    case "renameSubTeam":
      return {
        ...state,
        subTeams: state.subTeams.map((t) =>
          t.id === action.id ? { ...t, name: action.name } : t,
        ),
      };

    case "retireSubTeam":
      // Retiring hides it from future choices. Its players and the historical
      // membership snapshots are left alone (§4 Roster).
      return {
        ...state,
        subTeams: state.subTeams.map((t) =>
          t.id === action.id ? { ...t, active: false } : t,
        ),
      };

    case "setExitPin":
      // Recommended replacement policy: the custom PIN replaces 0000 rather
      // than leaving it as a bypass (§3, A06). Flagged for owner review.
      return { ...state, exitCode: { mode: "pin", pin: action.pin } };

    case "resetExitCode":
      return { ...state, exitCode: { mode: "default", pin: "0000" } };

    case "setRaffle":
      // ON -> OFF is visibility only. It does not close the round.
      return { ...state, raffleEnabled: action.enabled };

    case "startFreshRound": {
      const generation = state.rounds.length + 1;
      const id = `round-${generation}`;
      // Attendance, credited hours and previous results are untouched.
      return {
        ...state,
        rounds: [...state.rounds, { id, generation }],
        currentRoundId: id,
        raffleEnabled: true,
      };
    }

    default:
      return state;
  }
}

function load(scenario: ScenarioId): PrototypeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PrototypeState;
      if (parsed && Array.isArray(parsed.players)) return parsed;
    }
  } catch {
    // Private browsing or a quota failure. The prototype still runs; it just
    // cannot demonstrate refresh recovery.
  }
  return buildScenario(scenario);
}

/**
 * Attempts the real write, or a simulated one when the dev toggle is on, and
 * reports success instead of swallowing the failure. The simulated path
 * exercises the exact same failure branch a genuine quota/private-browsing
 * exception would take, including this toggle itself failing to persist on
 * the next refresh — the same risk a real storage failure carries.
 */
function trySave(state: PrototypeState, simulateFailure: boolean): boolean {
  try {
    if (simulateFailure) throw new DOMException("Simulated quota exceeded", "QuotaExceededError");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

interface StoreValue {
  state: PrototypeState;
  dispatch: (a: Action) => void;
  /** Convenience wrappers so screens read declaratively. */
  actions: {
    reset: (s: ScenarioId) => void;
    start: (t: SessionType) => void;
    startPractice: (teamIds: string[], allKaizen: boolean) => void;
    setPresent: (playerId: string, present: boolean) => void;
    changeDate: (date: string) => void;
    finish: () => void;
    retrySync: () => void;
    enterKiosk: () => void;
    exitKiosk: () => void;
    closeElsewhere: () => void;
    acknowledgeClosedElsewhere: () => void;
    dismissSummary: () => void;
    setNetwork: (m: PrototypeState["networkMode"]) => void;
    setSimulateStorageFailure: (on: boolean) => void;
    addPlayer: (p: Player) => void;
    updatePlayer: (id: string, patch: Partial<Player>) => void;
    addSubTeam: (name: string) => void;
    renameSubTeam: (id: string, name: string) => void;
    retireSubTeam: (id: string) => void;
    setExitPin: (pin: string) => void;
    resetExitCode: () => void;
    setRaffle: (enabled: boolean) => void;
    startFreshRound: () => void;
  };
}

const StoreContext = createContext<StoreValue | null>(null);

export function PrototypeStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  /** Test-only seam: skips `load()`/localStorage so a test can render an
   *  exact state (a retired attendee, every sub-team retired, a simulated
   *  storage failure) without driving the whole UI to reach it. The real
   *  app never passes this, so its behavior is unchanged. */
  initialState?: PrototypeState;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    "team" as ScenarioId,
    (scenario) => initialState ?? load(scenario),
  );

  useEffect(() => {
    const ok = trySave(state, state.simulateStorageFailure);
    dispatch({ type: "setLocalPersistenceFailed", failed: !ok });
  }, [state]);

  const actions = useMemo<StoreValue["actions"]>(
    () => ({
      reset: (scenario) => dispatch({ type: "reset", scenario }),
      start: (sessionType) => dispatch({ type: "start", sessionType }),
      startPractice: (teamIds, allKaizen) => dispatch({ type: "startPractice", teamIds, allKaizen }),
      setPresent: (playerId, present) =>
        dispatch({ type: "setPresent", playerId, present, opId: nextOpId() }),
      changeDate: (date) => dispatch({ type: "changeDate", date }),
      finish: () => dispatch({ type: "finish" }),
      retrySync: () => dispatch({ type: "retrySync" }),
      enterKiosk: () => dispatch({ type: "enterKiosk" }),
      exitKiosk: () => dispatch({ type: "exitKiosk" }),
      closeElsewhere: () => dispatch({ type: "closeElsewhere" }),
      acknowledgeClosedElsewhere: () => dispatch({ type: "acknowledgeClosedElsewhere" }),
      dismissSummary: () => dispatch({ type: "dismissSummary" }),
      setNetwork: (mode) => dispatch({ type: "setNetwork", mode }),
      setSimulateStorageFailure: (on) => dispatch({ type: "setSimulateStorageFailure", on }),
      addPlayer: (player) => dispatch({ type: "addPlayer", player }),
      updatePlayer: (playerId, patch) => dispatch({ type: "updatePlayer", playerId, patch }),
      addSubTeam: (name) => dispatch({ type: "addSubTeam", name }),
      renameSubTeam: (id, name) => dispatch({ type: "renameSubTeam", id, name }),
      retireSubTeam: (id) => dispatch({ type: "retireSubTeam", id }),
      setExitPin: (pin) => dispatch({ type: "setExitPin", pin }),
      resetExitCode: () => dispatch({ type: "resetExitCode" }),
      setRaffle: (enabled) => dispatch({ type: "setRaffle", enabled }),
      startFreshRound: () => dispatch({ type: "startFreshRound" }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, dispatch, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePrototypeStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("usePrototypeStore must be used inside PrototypeStoreProvider");
  return ctx;
}

/* ── Derived reads ─────────────────────────────────────────────── */

/** `Alex M. · #12`, or `Elena · Add number` for an incomplete legacy card. */
export function displayName(p: Player): string {
  const name = p.label ? `${p.firstName} ${p.label}` : p.firstName;
  return p.number === null ? name : `${name} · #${p.number}`;
}

export function subTeamName(state: PrototypeState, id: string): string {
  return state.subTeams.find((t) => t.id === id)?.name ?? "Unknown team";
}

/** Every membership joined for a compact single-line display (D07). */
export function subTeamLabel(state: PrototypeState, ids: string[]): string {
  if (ids.length === 0) return DEFAULT_GROUP_NAME;
  return ids.map((id) => subTeamName(state, id)).join(" + ");
}

/**
 * Cards collide when the same first name + label + number would render
 * identically. A shared number alone is fine; a shared first name alone is
 * fine (R03). Team membership never factors in: it is not part of identity.
 */
export function collidingPlayerIds(players: Player[]): Set<string> {
  const seen = new Map<string, string[]>();
  for (const p of players) {
    if (p.retired) continue;
    const key = displayName(p).toLowerCase();
    seen.set(key, [...(seen.get(key) ?? []), p.id]);
  }
  const out = new Set<string>();
  for (const ids of seen.values()) {
    if (ids.length > 1) ids.forEach((id) => out.add(id));
  }
  return out;
}

/**
 * Would a player displaying as `candidateName` collide with an existing,
 * non-retired card? Shared by the add and edit paths (F02) so an edit can
 * never bypass the validation an add is held to.
 */
export function wouldCollide(
  state: PrototypeState,
  candidateName: string,
  excludePlayerId?: string,
): boolean {
  const key = candidateName.toLowerCase();
  return state.players.some(
    (p) => p.id !== excludePlayerId && !p.retired && displayName(p).toLowerCase() === key,
  );
}

export interface PlayerEditValidity {
  valid: boolean;
  reason?: "empty-name" | "duplicate-card";
}

/** Same rule an add is held to: no blank identity, no unresolved identical card. */
export function playerEditIsValid(
  state: PrototypeState,
  playerId: string,
  candidate: Pick<Player, "firstName" | "label" | "number">,
): PlayerEditValidity {
  const firstName = candidate.firstName.trim();
  if (firstName === "") return { valid: false, reason: "empty-name" };
  const label = candidate.label?.trim() || undefined;
  const existing = state.players.find((p) => p.id === playerId);
  const name = displayName({ ...(existing as Player), ...candidate, firstName, label });
  if (wouldCollide(state, name, playerId)) return { valid: false, reason: "duplicate-card" };
  return { valid: true };
}

/** Exact string match, so `0` and `00` never collapse (D02). */
export function matchByNumber(players: Player[], entry: string): Player[] {
  return players.filter((p) => !p.retired && p.number !== null && p.number === entry);
}

export interface TicketLine {
  playerId: string;
  sessionId: string;
  roundId: string;
}

/**
 * One entitlement per (optional training, player). Derived from immutable
 * session/round membership rather than a separate counter that can drift
 * (§6, "Ticket entitlement").
 *
 * Eligibility follows each session's immutable round assignment alone
 * (F05). `archived` is a reporting/organization flag (P10) and never
 * excludes a session here: D03's "archived history is preserved, not
 * pooled" is satisfied by seeding old archived fixtures into a non-current
 * round (see ev-02), not by filtering on `archived` — that would revive or
 * revoke a current-round ticket on every future archive/restore.
 */
export function ticketLines(state: PrototypeState): TicketLine[] {
  const out: TicketLine[] = [];
  for (const s of state.sessions) {
    if (s.type !== "training") continue;
    for (const playerId of s.attendeeIds) {
      out.push({ playerId, sessionId: s.id, roundId: s.roundId });
    }
  }
  return out;
}

export function currentRoundTickets(state: PrototypeState): TicketLine[] {
  return ticketLines(state).filter((t) => t.roundId === state.currentRoundId);
}

export interface HistoricalTeamRow {
  player: Player;
  qualifyingSessionIds: string[];
  creditedHours: number;
  practices: number;
  trainings: number;
  tickets: number;
  /** Other teams this same player also qualifies for historically (P12, F01). */
  otherTeams: string[];
}

/**
 * "Team at session" totals for one specific team, computed from session
 * membership snapshots rather than each player's current membership (F01).
 * A transfer never moves a past session's hours to the player's new team:
 * only sessions whose own snapshot names `teamId` qualify. Sessions with no
 * snapshot at all (legacy/unknown) never qualify for a specific team.
 */
export function historicalTeamRows(state: PrototypeState, teamId: string): HistoricalTeamRow[] {
  const rows: HistoricalTeamRow[] = [];
  for (const p of state.players) {
    const qualifying = state.sessions.filter((s) => {
      if (!s.attendeeIds.includes(p.id) || !s.teamAtSession) return false;
      return (s.teamAtSession[p.id] ?? []).includes(teamId);
    });
    if (qualifying.length === 0) continue;

    let creditedHours = 0;
    let practices = 0;
    let trainings = 0;
    const qualifyingIds = new Set<string>();
    for (const s of qualifying) {
      creditedHours += s.creditHours;
      if (s.type === "practice") practices += 1;
      else trainings += 1;
      qualifyingIds.add(s.id);
    }
    const tickets = currentRoundTickets(state).filter(
      (t) => t.playerId === p.id && qualifyingIds.has(t.sessionId),
    ).length;

    // Explicitly label overlap: every other team this player also qualifies
    // for historically, so a reader never mistakes per-team totals as additive.
    const otherTeamIds = new Set<string>();
    for (const s of state.sessions) {
      if (!s.attendeeIds.includes(p.id) || !s.teamAtSession) continue;
      for (const id of s.teamAtSession[p.id] ?? []) if (id !== teamId) otherTeamIds.add(id);
    }
    const otherTeams = [...otherTeamIds].map((id) => subTeamName(state, id));

    rows.push({
      player: p,
      qualifyingSessionIds: [...qualifyingIds],
      creditedHours,
      practices,
      trainings,
      tickets,
      otherTeams,
    });
  }
  return rows;
}

export interface PlayerTotals {
  creditedHours: number;
  practices: number;
  trainings: number;
  tickets: number;
}

export function playerTotals(state: PrototypeState, playerId: string): PlayerTotals {
  let creditedHours = 0;
  let practices = 0;
  let trainings = 0;
  for (const s of state.sessions) {
    if (!s.attendeeIds.includes(playerId)) continue;
    creditedHours += s.creditHours; // historical values kept as recorded (A02)
    if (s.type === "practice") practices += 1;
    else trainings += 1;
  }
  const tickets = currentRoundTickets(state).filter((t) => t.playerId === playerId).length;
  return { creditedHours, practices, trainings, tickets };
}

export interface ExpectedPracticeStats {
  expectedCount: number;
  presentCount: number;
  /** null when the player was never named in any saved expected snapshot. */
  percent: number | null;
  currentStreak: number;
}

/**
 * D10 demonstration only (spec: expose a small fixture demonstration of
 * expected-only practice attendance/streak behavior; do not rebuild all
 * analytics yet). The denominator and streak use only practices whose
 * *saved* expected snapshot names this player — never every practice on
 * today's roster, and never recomputed from today's membership. A practice
 * the player was not expected at neither counts as a miss nor breaks the
 * streak, because it never enters `qualifying` at all.
 */
export function expectedPracticeStats(state: PrototypeState, playerId: string): ExpectedPracticeStats {
  const qualifying = state.sessions
    .filter((s) => s.type === "practice" && s.expected?.playerIds.includes(playerId))
    // Stable tie-breaker for same-day sessions; date alone is not unique.
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const expectedCount = qualifying.length;
  const presentCount = qualifying.filter((s) => s.attendeeIds.includes(playerId)).length;
  const percent = expectedCount === 0 ? null : Math.round((presentCount / expectedCount) * 100);

  let currentStreak = 0;
  for (let i = qualifying.length - 1; i >= 0; i--) {
    if (!qualifying[i].attendeeIds.includes(playerId)) break;
    currentStreak += 1;
  }

  return { expectedCount, presentCount, percent, currentStreak };
}

/** Session-hours counts each session once; player-hours sums attendee credit. */
export function programTotals(state: PrototypeState) {
  let sessionHours = 0;
  let playerHours = 0;
  for (const s of state.sessions) {
    sessionHours += s.creditHours;
    playerHours += s.creditHours * s.attendeeIds.length;
  }
  return { sessionHours, playerHours };
}

export function presentCount(session: ActiveSession | null): number {
  if (!session) return 0;
  return Object.values(session.present).filter(Boolean).length;
}

export function deliveryLabel(d: DeliveryState): { text: string; tone: "ok" | "warn" | "bad" } {
  switch (d) {
    case "cloud":
      return { text: "Saved to the cloud", tone: "ok" };
    case "pending":
      return { text: "Saved on this device — waiting to sync", tone: "warn" };
    case "failed":
      return { text: "Save failed — your marks are still here", tone: "bad" };
    default:
      return { text: "Saved on this device", tone: "ok" };
  }
}
