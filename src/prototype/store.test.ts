/**
 * Focused regression tests for the Stage 2 revision (U01, F01-F05).
 *
 * These are pure-function tests against plain PrototypeState objects: no
 * React rendering and no jsdom, so they run fast and cannot be confused with
 * the real app's Supabase-backed tests. `reducer` is exported for exactly
 * this purpose — dispatching actions against a fixture state without
 * mounting the provider.
 */
import { describe, expect, it } from "vitest";
import { buildScenario } from "./fixtures";
import {
  currentRoundTickets,
  expectedPracticeStats,
  historicalTeamRows,
  playerEditIsValid,
  playerTotals,
  programTotals,
  reducer,
  resolveExpectedPlayerIds,
  wouldCollide,
} from "./store";
import type { FinalizedSession, PrototypeState } from "./types";

describe("U01: multiple simultaneous sub-team memberships, one jersey number", () => {
  it("keeps Kayla's one jersey number across both of her teams", () => {
    const state = buildScenario("team");
    const kayla = state.players.find((p) => p.id === "pl-11")!;
    expect(kayla.subTeamIds).toEqual(["st-b6", "st-b7"]);
    expect(kayla.number).toBe("12");
  });

  it("credits one training attendance once, regardless of how many teams match", () => {
    const state = buildScenario("team");
    // ev-04 and ev-06 are Kayla's current-round trainings.
    const kaylaTickets = currentRoundTickets(state).filter((t) => t.playerId === "pl-11");
    expect(kaylaTickets).toHaveLength(2);
    expect(kaylaTickets.map((t) => t.sessionId).sort()).toEqual(["ev-04", "ev-06"]);
    expect(playerTotals(state, "pl-11").tickets).toBe(2);
  });

  it("shows a multi-team player once in All teams and finds her under either team filter", () => {
    const state = buildScenario("team");
    expect(state.players.filter((p) => p.id === "pl-11")).toHaveLength(1);
    const blue6 = state.players.filter((p) => !p.retired && p.subTeamIds.includes("st-b6"));
    const blue7 = state.players.filter((p) => !p.retired && p.subTeamIds.includes("st-b7"));
    expect(blue6.some((p) => p.id === "pl-11")).toBe(true);
    expect(blue7.some((p) => p.id === "pl-11")).toBe(true);
  });

  it("keeps whole-program totals deduplicated for a multi-team player", () => {
    const state = buildScenario("team");
    const totals = programTotals(state);
    const expectedSessionHours = state.sessions.reduce((sum, s) => sum + s.creditHours, 0);
    const expectedPlayerHours = state.sessions.reduce((sum, s) => sum + s.creditHours * s.attendeeIds.length, 0);
    expect(totals.sessionHours).toBe(expectedSessionHours);
    expect(totals.playerHours).toBe(expectedPlayerHours);
  });

  it("keeps a removed membership from affecting the remaining one or past history", () => {
    let state: PrototypeState = buildScenario("team");
    const before = historicalTeamRows(state, "st-b6").find((r) => r.player.id === "pl-11");
    expect(before).toBeDefined();

    state = reducer(state, { type: "updatePlayer", playerId: "pl-11", patch: { subTeamIds: ["st-b7"] } });

    expect(state.players.find((p) => p.id === "pl-11")!.subTeamIds).toEqual(["st-b7"]);
    // Removing the Blue 6th membership does not touch her Blue 6th history.
    const afterBlue6 = historicalTeamRows(state, "st-b6").find((r) => r.player.id === "pl-11");
    expect(afterBlue6?.creditedHours).toBe(before?.creditedHours);
  });
});

describe("F01: historical team filtering uses session membership snapshots", () => {
  it("does not move a transferred player's past hours onto their new team", () => {
    let state: PrototypeState = buildScenario("team");
    expect(state.players.find((p) => p.id === "pl-01")!.subTeamIds).toEqual(["st-b7"]);

    const beforeBlue7 = historicalTeamRows(state, "st-b7").find((r) => r.player.id === "pl-01")!;
    expect(beforeBlue7.creditedHours).toBeGreaterThan(0);
    expect(historicalTeamRows(state, "st-g7").find((r) => r.player.id === "pl-01")).toBeUndefined();

    // Transfer Alex M. to Gray 7th.
    state = reducer(state, { type: "updatePlayer", playerId: "pl-01", patch: { subTeamIds: ["st-g7"] } });

    // Blue 7th's historical total is unaffected by a current-membership change.
    const afterBlue7 = historicalTeamRows(state, "st-b7").find((r) => r.player.id === "pl-01");
    expect(afterBlue7?.creditedHours).toBe(beforeBlue7.creditedHours);
    // Gray 7th still has no qualifying snapshot yet — the transfer alone
    // does not retroactively attribute old sessions to the new team.
    expect(historicalTeamRows(state, "st-g7").find((r) => r.player.id === "pl-01")).toBeUndefined();

    // Finalize a new session after the transfer.
    state = reducer(state, { type: "start", sessionType: "practice" });
    state = reducer(state, { type: "setPresent", playerId: "pl-01", present: true, opId: "op-t1" });
    state = reducer(state, { type: "finish" });

    const gray7 = historicalTeamRows(state, "st-g7").find((r) => r.player.id === "pl-01")!;
    expect(gray7.creditedHours).toBe(1.5); // only the new post-transfer session
    const blue7Final = historicalTeamRows(state, "st-b7").find((r) => r.player.id === "pl-01")!;
    expect(blue7Final.creditedHours).toBe(beforeBlue7.creditedHours); // still unchanged
  });

  it("labels overlap explicitly for a player who qualifies for two teams at once", () => {
    const state = buildScenario("team");
    const blue6Row = historicalTeamRows(state, "st-b6").find((r) => r.player.id === "pl-11")!;
    const blue7Row = historicalTeamRows(state, "st-b7").find((r) => r.player.id === "pl-11")!;
    expect(blue6Row.otherTeams).toContain("Kaizen Blue 7th Grade");
    expect(blue7Row.otherTeams).toContain("Kaizen Blue 6th Grade");
    // Both are full, non-split totals — proof the two views are not additive.
    expect(blue6Row.creditedHours).toBe(blue7Row.creditedHours);
  });

  it("never attributes a legacy session with no snapshot to a specific team", () => {
    const state = buildScenario("team");
    // ev-01 has no teamAtSession and includes pl-01; it must not leak into
    // any specific-team historical total.
    const rows = historicalTeamRows(state, "st-b7");
    const row = rows.find((r) => r.player.id === "pl-01")!;
    expect(row.qualifyingSessionIds).not.toContain("ev-01");
  });
});

describe("F02: edits are validated the same as adds", () => {
  it("rejects an edit that would collide with an existing card", () => {
    const state = buildScenario("team");
    // Alex M. (pl-01) renaming his label to "R." collides with Alex R. (#12).
    const result = playerEditIsValid(state, "pl-01", { firstName: "Alex", label: "R.", number: "12" });
    expect(result).toEqual({ valid: false, reason: "duplicate-card" });
  });

  it("accepts an edit that keeps the card unique", () => {
    const state = buildScenario("team");
    const result = playerEditIsValid(state, "pl-01", { firstName: "Alex", label: "Z.", number: "12" });
    expect(result).toEqual({ valid: true });
  });

  it("rejects a blank name", () => {
    const state = buildScenario("team");
    const result = playerEditIsValid(state, "pl-01", { firstName: "   ", label: "M.", number: "12" });
    expect(result).toEqual({ valid: false, reason: "empty-name" });
  });

  it("shares its collision rule with the add path via wouldCollide", () => {
    const state = buildScenario("team");
    expect(wouldCollide(state, "Alex R. · #12")).toBe(true); // add path, no exclusion
    expect(wouldCollide(state, "Alex R. · #12", "pl-06")).toBe(false); // editing the same card
  });
});

describe("F03: raffle defaults", () => {
  it("starts a genuinely new coach with the raffle enabled", () => {
    expect(buildScenario("empty").raffleEnabled).toBe(true);
  });

  it("preserves an existing coach's explicit off setting alongside accrued tickets", () => {
    const state = buildScenario("team");
    expect(state.raffleEnabled).toBe(false);
    expect(currentRoundTickets(state).length).toBeGreaterThan(0);
  });
});

describe("F05: raffle eligibility follows immutable round assignment, not archive status", () => {
  it("keeps an old-round archived training's ticket out of the current pool even if restored", () => {
    const state = buildScenario("team");
    const restored: PrototypeState = {
      ...state,
      sessions: state.sessions.map((s) => (s.id === "ev-02" ? { ...s, archived: false } : s)),
    };
    expect(currentRoundTickets(state).some((t) => t.sessionId === "ev-02")).toBe(false);
    expect(currentRoundTickets(restored).some((t) => t.sessionId === "ev-02")).toBe(false);
    expect(currentRoundTickets(restored).length).toBe(currentRoundTickets(state).length);
  });

  it("keeps a current-round archived training's ticket count unchanged across archive and restore", () => {
    const state = buildScenario("team");
    const fixture = state.sessions.find((s) => s.id === "ev-07")! as FinalizedSession;
    expect(fixture.archived).toBe(true);
    expect(fixture.roundId).toBe(state.currentRoundId);

    const restored: PrototypeState = {
      ...state,
      sessions: state.sessions.map((s) => (s.id === "ev-07" ? { ...s, archived: false } : s)),
    };

    const archivedCount = currentRoundTickets(state).filter((t) => t.sessionId === "ev-07").length;
    const restoredCount = currentRoundTickets(restored).filter((t) => t.sessionId === "ev-07").length;
    expect(archivedCount).toBe(fixture.attendeeIds.length);
    expect(restoredCount).toBe(fixture.attendeeIds.length);
    expect(currentRoundTickets(state).length).toBe(currentRoundTickets(restored).length);
  });
});

describe("D10: Who's expected? practice selection", () => {
  it("counts a player on two selected teams once, and excludes another team's player", () => {
    const state = buildScenario("team");
    // Kayla (pl-11) is on both st-b6 and st-b7; selecting both must not
    // double-count her. Priya (pl-07, st-g7 only) must not appear.
    const ids = resolveExpectedPlayerIds(state, ["st-b6", "st-b7"], false);
    expect(ids.filter((id) => id === "pl-11")).toHaveLength(1);
    expect(ids).not.toContain("pl-07");
  });

  it("All Kaizen resolves the whole eligible roster, distinct from any specific team union", () => {
    const state = buildScenario("team");
    const allTeamsUnion = resolveExpectedPlayerIds(
      state,
      state.subTeams.map((t) => t.id),
      false,
    );
    const allKaizen = resolveExpectedPlayerIds(state, [], true);
    const nonRetired = state.players.filter((p) => !p.retired).length;
    expect(allKaizen).toHaveLength(nonRetired);
    // Guests (Elena, Tomas) belong to no sub-team, so a team union misses
    // them while the explicit All Kaizen choice reaches everyone.
    expect(allTeamsUnion.length).toBeLessThan(allKaizen.length);
    expect(allKaizen).toContain("pl-16");
  });

  it("never overwrites or orphans an existing active session", () => {
    let state: PrototypeState = buildScenario("team");
    state = reducer(state, { type: "startPractice", teamIds: ["st-b7"], allKaizen: false });
    const firstId = state.activeSession!.id;

    state = reducer(state, { type: "startPractice", teamIds: ["st-g6"], allKaizen: false });
    expect(state.activeSession!.id).toBe(firstId);
    expect(state.activeSession!.expected!.teamIds).toEqual(["st-b7"]);
  });

  it("saves the expected snapshot on the finalized session and keeps it after a later membership change", () => {
    let state: PrototypeState = buildScenario("team");
    state = reducer(state, { type: "startPractice", teamIds: ["st-b7"], allKaizen: false });
    const expectedAtStart = state.activeSession!.expected!.playerIds;
    expect(expectedAtStart).toContain("pl-11"); // Kayla, via st-b7

    state = reducer(state, { type: "setPresent", playerId: "pl-02", present: true, opId: "op-e1" });
    state = reducer(state, { type: "finish" });

    const finalized = state.sessions.find((s) => s.id === state.lastFinished!.id)!;
    expect(finalized.expected!.playerIds.slice().sort()).toEqual(expectedAtStart.slice().sort());

    // Remove Kayla from the very team that made her expected here.
    state = reducer(state, { type: "updatePlayer", playerId: "pl-11", patch: { subTeamIds: ["st-b6"] } });
    const finalizedAgain = state.sessions.find((s) => s.id === finalized.id)!;
    expect(finalizedAgain.expected!.playerIds).toContain("pl-11");
  });

  it("is 50% for two players with mixed present/absent against the expected denominator, excluding another team's player entirely", () => {
    // A tiny two-player team, decoupled from the shared fixture roster so
    // these percentages are exact. Both practices land on today's date
    // (todayIso() is used for every new session), so this also proves the
    // id tie-breaker keeps chronological order stable for same-day sessions.
    let state: PrototypeState = {
      ...buildScenario("empty"),
      subTeams: [
        { id: "t-x", name: "Team X", active: true },
        { id: "t-y", name: "Team Y", active: true },
      ],
      players: [
        { id: "p-a", firstName: "A", number: "1", subTeamIds: ["t-x"], guest: false, retired: false },
        { id: "p-c", firstName: "C", number: "2", subTeamIds: ["t-x"], guest: false, retired: false },
        { id: "p-b", firstName: "B", number: "3", subTeamIds: ["t-y"], guest: false, retired: false },
      ],
    };

    // Practice 1: A present, C absent.
    state = reducer(state, { type: "startPractice", teamIds: ["t-x"], allKaizen: false });
    state = reducer(state, { type: "setPresent", playerId: "p-a", present: true, opId: "op-1" });
    state = reducer(state, { type: "finish" });

    // Practice 2: C present, A absent.
    state = reducer(state, { type: "startPractice", teamIds: ["t-x"], allKaizen: false });
    state = reducer(state, { type: "setPresent", playerId: "p-c", present: true, opId: "op-2" });
    state = reducer(state, { type: "finish" });

    expect(expectedPracticeStats(state, "p-a")).toEqual({
      expectedCount: 2,
      presentCount: 1,
      percent: 50,
      currentStreak: 0, // most recent practice (2) was a miss
    });
    expect(expectedPracticeStats(state, "p-c")).toEqual({
      expectedCount: 2,
      presentCount: 1,
      percent: 50,
      currentStreak: 1, // most recent practice (2) was a hit
    });
    // B is on a different, unselected team and was never named in either
    // snapshot: excluded entirely, not counted as two missed practices.
    expect(expectedPracticeStats(state, "p-b")).toEqual({
      expectedCount: 0,
      presentCount: 0,
      percent: null,
      currentStreak: 0,
    });
  });
});
