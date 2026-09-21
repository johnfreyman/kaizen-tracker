/**
 * Stage 2 prototype — logical types.
 *
 * These mirror the *proposed* data contract in docs/simplification-spec.md §6.
 * They are deliberately local to the prototype: Stage 3 chooses the real
 * columns/tables after inspecting an isolated environment. Nothing here is a
 * schema commitment.
 */

export type SessionType = "practice" | "training";

export interface SubTeam {
  id: string;
  name: string;
  /** Retired sub-teams disappear from future choices but keep their history. */
  active: boolean;
}

export interface Player {
  /** Stable identity. Never derived from name or jersey number. */
  id: string;
  firstName: string;
  /** Distinguishing initial or short label, only when cards would collide. */
  label?: string;
  /** Digit string, 1-3 chars. `null` means "setup needed" (legacy card). */
  number: string | null;
  /**
   * Simultaneous sub-team memberships (D07). An empty array means the
   * default Kaizen grouping (no custom sub-teams chosen for this player).
   * The jersey number lives on the player, never per membership (D08).
   */
  subTeamIds: string[];
  guest: boolean;
  retired: boolean;
  /** Retained raw legacy name, for historical readability. */
  legacyName?: string;
}

export interface FinalizedSession {
  id: string;
  type: SessionType;
  /** Local calendar date, date-only. */
  date: string;
  /** Historical values are preserved exactly; new sessions are 1.5. */
  creditHours: number;
  attendeeIds: string[];
  /** Immutable round assignment, fixed at record creation. */
  roundId: string;
  /** Reporting/organization flag only. Never changes round eligibility (F05). */
  archived: boolean;
  /**
   * Sub-team membership-set snapshot taken when the session was recorded.
   * Map absent => membership is entirely unknown for that session (legacy
   * records). A present entry mapped to `[]` is a known fact: that player
   * had no sub-team (default Kaizen) at the time, not an unknown value.
   */
  teamAtSession?: Record<string, string[]>;
  /** Carried over from the active session unchanged (D10). Practice only. */
  expected?: ExpectedSnapshot;
}

export interface RaffleRound {
  id: string;
  generation: number;
}

/** How the *current* attendance draft has been delivered, not a session kind. */
export type DeliveryState = "device" | "pending" | "failed" | "cloud";

/**
 * D10: who a practice is for, resolved once when the coach confirms
 * "Who's expected?" and never recomputed from later roster/membership
 * changes. Optional training never has one. A practice created before D10
 * (or restored from old localStorage) also has none — treated as unknown,
 * the same way a session with no `teamAtSession` snapshot is legacy/unknown.
 */
export interface ExpectedSnapshot {
  /** Selected sub-team ids. Empty when `allKaizen` is true. */
  teamIds: string[];
  /** The explicit "All Kaizen" choice — distinct from selecting every team,
   *  since it also reaches players with no sub-team (e.g. guests). */
  allKaizen: boolean;
  /** Deduplicated player ids resolved at confirmation time. */
  playerIds: string[];
}

export interface ActiveSession {
  id: string;
  type: SessionType;
  date: string;
  creditHours: number;
  /** Bound at creation whether or not the raffle is switched on. */
  roundId: string;
  present: Record<string, boolean>;
  revision: number;
  delivery: DeliveryState;
  /** Set when another device finalized this session out from under the kiosk. */
  closedElsewhere: boolean;
  /** Practice only (D10). */
  expected?: ExpectedSnapshot;
}

export interface ExitCode {
  /** "default" is the approved 0000; "pin" is a coach-set replacement (D01). */
  mode: "default" | "pin";
  pin: string;
}

export interface PrototypeState {
  players: Player[];
  subTeams: SubTeam[];
  sessions: FinalizedSession[];
  rounds: RaffleRound[];
  currentRoundId: string;
  raffleEnabled: boolean;
  exitCode: ExitCode;
  activeSession: ActiveSession | null;
  /** Kiosk is bound to a session id so it survives a refresh. */
  kioskSessionId: string | null;
  lastFinished: { id: string; summary: string } | null;
  /** Dev-only switch: makes the next finish fail or stay pending. */
  networkMode: "online" | "offline" | "failing";
  /** True after a local (browser storage) write actually failed. */
  localPersistenceFailed: boolean;
  /** Dev-only switch: makes the next local storage write fail on purpose. */
  simulateStorageFailure: boolean;
  scenario: ScenarioId;
}

export type ScenarioId = "team" | "noSubTeams" | "legacy" | "empty";
