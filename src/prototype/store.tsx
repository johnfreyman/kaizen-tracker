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

const STORAGE_KEY = "kaizen-stage2-prototype";

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

type Action =
  | { type: "reset"; scenario: ScenarioId }
  | { type: "start"; sessionType: SessionType }
  | { type: "setPresent"; playerId: string; present: boolean; opId: string }
  | { type: "changeDate"; date: string }
  | { type: "finish" }
  | { type: "retrySync" }
  | { type: "discardPending" }
  | { type: "enterKiosk" }
  | { type: "exitKiosk" }
  | { type: "closeElsewhere" }
  | { type: "dismissSummary" }
  | { type: "setNetwork"; mode: PrototypeState["networkMode"] }
  | { type: "addPlayer"; player: Player }
  | { type: "updatePlayer"; playerId: string; patch: Partial<Player> }
  | { type: "addSubTeam"; name: string }
  | { type: "renameSubTeam"; id: string; name: string }
  | { type: "retireSubTeam"; id: string }
  | { type: "setExitPin"; pin: string }
  | { type: "resetExitCode" }
  | { type: "setRaffle"; enabled: boolean }
  | { type: "startFreshRound" };

function reducer(state: PrototypeState, action: Action): PrototypeState {
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
      const teamAtSession: Record<string, string | null> = {};
      for (const id of attendeeIds) {
        teamAtSession[id] = state.players.find((p) => p.id === id)?.subTeamId ?? null;
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

    case "dismissSummary":
      return { ...state, lastFinished: null };

    case "setNetwork":
      return { ...state, networkMode: action.mode };

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
    // cannot demonstrate refresh recovery. Surfaced in the dev panel.
  }
  return buildScenario(scenario);
}

interface StoreValue {
  state: PrototypeState;
  dispatch: (a: Action) => void;
  /** Convenience wrappers so screens read declaratively. */
  actions: {
    reset: (s: ScenarioId) => void;
    start: (t: SessionType) => void;
    setPresent: (playerId: string, present: boolean) => void;
    changeDate: (date: string) => void;
    finish: () => void;
    retrySync: () => void;
    enterKiosk: () => void;
    exitKiosk: () => void;
    closeElsewhere: () => void;
    dismissSummary: () => void;
    setNetwork: (m: PrototypeState["networkMode"]) => void;
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

export function PrototypeStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, "team" as ScenarioId, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore — see load() */
    }
  }, [state]);

  const actions = useMemo<StoreValue["actions"]>(
    () => ({
      reset: (scenario) => dispatch({ type: "reset", scenario }),
      start: (sessionType) => dispatch({ type: "start", sessionType }),
      setPresent: (playerId, present) =>
        dispatch({ type: "setPresent", playerId, present, opId: nextOpId() }),
      changeDate: (date) => dispatch({ type: "changeDate", date }),
      finish: () => dispatch({ type: "finish" }),
      retrySync: () => dispatch({ type: "retrySync" }),
      enterKiosk: () => dispatch({ type: "enterKiosk" }),
      exitKiosk: () => dispatch({ type: "exitKiosk" }),
      closeElsewhere: () => dispatch({ type: "closeElsewhere" }),
      dismissSummary: () => dispatch({ type: "dismissSummary" }),
      setNetwork: (mode) => dispatch({ type: "setNetwork", mode }),
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

export function subTeamName(state: PrototypeState, id: string | null): string {
  if (id === null) return DEFAULT_GROUP_NAME;
  return state.subTeams.find((t) => t.id === id)?.name ?? "Unknown team";
}

/**
 * Cards collide when the same first name + label + number would render
 * identically. A shared number alone is fine; a shared first name alone is
 * fine (R03).
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
 */
export function ticketLines(state: PrototypeState): TicketLine[] {
  const out: TicketLine[] = [];
  for (const s of state.sessions) {
    if (s.type !== "training") continue;
    if (s.archived) continue; // D03: archived history is preserved, not pooled
    for (const playerId of s.attendeeIds) {
      out.push({ playerId, sessionId: s.id, roundId: s.roundId });
    }
  }
  return out;
}

export function currentRoundTickets(state: PrototypeState): TicketLine[] {
  return ticketLines(state).filter((t) => t.roundId === state.currentRoundId);
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
