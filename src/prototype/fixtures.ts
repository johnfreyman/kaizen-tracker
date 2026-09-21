/**
 * Stage 2 prototype — fixture data.
 *
 * Invented people and invented numbers. No production data, no roster export,
 * no personal data from any real team (spec §6, "Legacy mapping": do not log
 * private roster contents into committed fixtures).
 */

import type { FinalizedSession, Player, PrototypeState, ScenarioId, SubTeam } from "./types";

export const SUB_TEAMS: SubTeam[] = [
  { id: "st-b7", name: "Kaizen Blue 7th Grade", active: true },
  { id: "st-g7", name: "Kaizen Gray 7th Grade", active: true },
  { id: "st-b6", name: "Kaizen Blue 6th Grade", active: true },
  { id: "st-g6", name: "Kaizen Gray 6th Grade", active: true },
];

/** The grouping shown when a coach has configured no sub-teams at all. */
export const DEFAULT_GROUP_NAME = "Kaizen";

function p(
  id: string,
  firstName: string,
  number: string | null,
  subTeamIds: string[],
  extra: Partial<Player> = {},
): Player {
  return { id, firstName, number, subTeamIds, guest: false, retired: false, ...extra };
}

/**
 * Full roster. Deliberately contains every collision the spec calls out:
 *  - #12 is shared by three players across three sub-teams
 *  - two players are named Alex AND both wear #12, so both need a label (R03)
 *  - #0 and #00 are distinct people (D02), and #00 itself is shared
 *  - guests with and without a number (P06)
 *  - one legacy card with no jersey number yet (P05)
 *  - Kayla belongs to Blue 6th AND Blue 7th at the same time, with the one
 *    jersey number she uses on both (D07/D08, audit U01)
 */
const FULL_ROSTER: Player[] = [
  p("pl-01", "Alex", "12", ["st-b7"], { label: "M." }),
  p("pl-02", "Jordan", "7", ["st-b7"]),
  p("pl-03", "Malia", "0", ["st-b7"]),
  p("pl-04", "Sam", "23", ["st-b7"]),
  p("pl-05", "Trevor", "5", ["st-b7"]),

  p("pl-06", "Alex", "12", ["st-g7"], { label: "R." }),
  p("pl-07", "Priya", "00", ["st-g7"]),
  p("pl-08", "Diego", "7", ["st-g7"]),
  p("pl-09", "Nia", "14", ["st-g7"]),

  p("pl-10", "Owen", "3", ["st-b6"]),
  p("pl-11", "Kayla", "12", ["st-b6", "st-b7"]),
  p("pl-12", "Marcus", "9", ["st-b6"]),

  p("pl-13", "Ibrahim", "21", ["st-g6"]),
  p("pl-14", "Sofia", "8", ["st-g6"]),
  p("pl-15", "Ruthie", "00", ["st-g6"]),

  p("pl-16", "Elena", null, [], { guest: true, legacyName: "Elena (guest)" }),
  p("pl-17", "Tomas", "33", [], { guest: true }),

  // Legacy card: the old store only kept a display string, so the first name
  // and number are unknown until the coach reviews it (P05). Never guessed.
  p("pl-18", "T.", null, ["st-g6"], { legacyName: "T. Nguyen" }),
];

const ROUND_PREV = "round-1";
const ROUND_CURRENT = "round-2";

function snapshot(ids: string[], roster: Player[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const id of ids) {
    const found = roster.find((x) => x.id === id);
    map[id] = found ? found.subTeamIds : [];
  }
  return map;
}

const A = (...ids: string[]) => ids;

/**
 * Finalized history.
 *
 * Note the 2.0-hour practice: historical durations are preserved exactly and
 * are never rewritten to 1.5 (R02 / D05 / A02).
 */
const FULL_SESSIONS: FinalizedSession[] = [
  {
    id: "ev-01",
    type: "practice",
    date: "2026-08-18",
    creditHours: 2,
    attendeeIds: A("pl-01", "pl-02", "pl-03", "pl-06", "pl-07", "pl-10", "pl-11", "pl-13"),
    roundId: ROUND_PREV,
    archived: false,
    // No teamAtSession on purpose: legacy membership is unknown, not inferred.
  },
  {
    id: "ev-02",
    type: "training",
    date: "2026-08-25",
    creditHours: 1.5,
    attendeeIds: A("pl-01", "pl-02", "pl-06", "pl-11", "pl-13", "pl-14"),
    roundId: ROUND_PREV,
    archived: true, // archived => outside the initial current pool (D03)
    teamAtSession: snapshot(
      A("pl-01", "pl-02", "pl-06", "pl-11", "pl-13", "pl-14"),
      FULL_ROSTER,
    ),
  },
  {
    id: "ev-03",
    type: "practice",
    date: "2026-09-08",
    creditHours: 1.5,
    attendeeIds: A(
      "pl-01", "pl-02", "pl-03", "pl-04", "pl-06",
      "pl-07", "pl-10", "pl-11", "pl-13", "pl-14",
    ),
    roundId: ROUND_CURRENT,
    archived: false,
    teamAtSession: snapshot(
      A("pl-01", "pl-02", "pl-03", "pl-04", "pl-06", "pl-07", "pl-10", "pl-11", "pl-13", "pl-14"),
      FULL_ROSTER,
    ),
  },
  {
    id: "ev-04",
    type: "training",
    date: "2026-09-10",
    creditHours: 1.5,
    attendeeIds: A("pl-01", "pl-03", "pl-06", "pl-11", "pl-17"),
    roundId: ROUND_CURRENT,
    archived: false,
    teamAtSession: snapshot(A("pl-01", "pl-03", "pl-06", "pl-11", "pl-17"), FULL_ROSTER),
  },
  {
    id: "ev-05",
    type: "practice",
    date: "2026-09-15",
    creditHours: 1.5,
    attendeeIds: A(
      "pl-01", "pl-02", "pl-04", "pl-05", "pl-06", "pl-09", "pl-10", "pl-12", "pl-15",
    ),
    roundId: ROUND_CURRENT,
    archived: false,
    teamAtSession: snapshot(
      A("pl-01", "pl-02", "pl-04", "pl-05", "pl-06", "pl-09", "pl-10", "pl-12", "pl-15"),
      FULL_ROSTER,
    ),
  },
  {
    id: "ev-06",
    type: "training",
    date: "2026-09-17",
    creditHours: 1.5,
    attendeeIds: A("pl-02", "pl-06", "pl-11", "pl-14"),
    roundId: ROUND_CURRENT,
    archived: false,
    teamAtSession: snapshot(A("pl-02", "pl-06", "pl-11", "pl-14"), FULL_ROSTER),
  },
  {
    // F05 regression fixture: archived for reporting, but still assigned to
    // the CURRENT round. Archiving must never remove a current-round ticket,
    // and restoring it must not create one either (eligibility follows round
    // assignment, not the archived flag).
    id: "ev-07",
    type: "training",
    date: "2026-09-19",
    creditHours: 1.5,
    attendeeIds: A("pl-02", "pl-14"),
    roundId: ROUND_CURRENT,
    archived: true,
    teamAtSession: snapshot(A("pl-02", "pl-14"), FULL_ROSTER),
  },
];

export interface Scenario {
  id: ScenarioId;
  name: string;
  blurb: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "team",
    name: "Sub-teams configured",
    blurb:
      "Four sub-teams, shared jersey numbers, duplicate first names, guests and history. " +
      "An existing coach: raffle starts off with tickets already accrued (F03).",
  },
  {
    id: "noSubTeams",
    name: "Default Kaizen only",
    blurb: "No custom sub-teams. Roster entry asks no extra question (R14).",
  },
  {
    id: "legacy",
    name: "Incomplete legacy roster",
    blurb: "Names carried over with no jersey numbers. Coach attendance works; kiosk lookup does not.",
  },
  {
    id: "empty",
    name: "Empty roster",
    blurb: "A genuinely new coach with nobody on the roster yet. Raffle defaults on (R10, F03).",
  },
];

function baseState(): Omit<PrototypeState, "players" | "subTeams" | "sessions" | "scenario"> {
  return {
    rounds: [
      { id: ROUND_PREV, generation: 1 },
      { id: ROUND_CURRENT, generation: 2 },
    ],
    currentRoundId: ROUND_CURRENT,
    // Existing-coach fixtures keep their explicit prior setting (off) so the
    // Keep/Start-fresh activation dialog has real accrued tickets to show.
    // The "empty" (genuinely new-coach) scenario overrides this below (F03).
    raffleEnabled: false,
    exitCode: { mode: "default", pin: "0000" },
    activeSession: null,
    kioskSessionId: null,
    lastFinished: null,
    networkMode: "online",
    localPersistenceFailed: false,
    simulateStorageFailure: false,
  };
}

export function buildScenario(scenario: ScenarioId): PrototypeState {
  const base = baseState();

  if (scenario === "empty") {
    // F03: a genuinely new coach starts with the raffle ON (R10/A17), unlike
    // the existing-coach fixtures above which preserve their explicit "off".
    return { ...base, raffleEnabled: true, scenario, players: [], subTeams: [], sessions: [] };
  }

  if (scenario === "legacy") {
    // Everything arrived as a bare display name. No numbers were ever stored,
    // so nothing is guessed: each card shows "Add number" instead (P05).
    const legacyNames = [
      "Alex M.", "Alex R.", "Jordan", "Malia", "Priya",
      "Owen", "Kayla", "Marcus", "Sofia", "Ruthie",
    ];
    return {
      ...base,
      scenario,
      subTeams: [],
      players: legacyNames.map((name, i) =>
        p(`lg-${i + 1}`, name, null, [], { legacyName: name }),
      ),
      sessions: [],
    };
  }

  if (scenario === "noSubTeams") {
    return {
      ...base,
      scenario,
      subTeams: [],
      players: FULL_ROSTER.map((x) => ({ ...x, subTeamIds: [] })),
      sessions: FULL_SESSIONS.map((s) => ({ ...s, teamAtSession: undefined })),
    };
  }

  return {
    ...base,
    scenario,
    subTeams: SUB_TEAMS.map((t) => ({ ...t })),
    players: FULL_ROSTER.map((x) => ({ ...x, subTeamIds: [...x.subTeamIds] })),
    sessions: FULL_SESSIONS.map((s) => ({
      ...s,
      teamAtSession: s.teamAtSession ? { ...s.teamAtSession } : undefined,
    })),
  };
}
