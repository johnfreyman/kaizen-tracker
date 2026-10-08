/** @vitest-environment jsdom */
/**
 * R01 component regressions: retirement must not erase a player from
 * historical "Team at session" reporting, and retiring every sub-team must
 * not strand a coach without a way back into that historical view.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProgressScreen from "./ProgressScreen";
import { buildScenario } from "../fixtures";
import { PrototypeStoreProvider } from "../store";
import type { PrototypeState } from "../types";

// See RosterScreen.test.tsx: this project doesn't enable Vitest `globals`,
// so @testing-library/react's auto afterEach(cleanup) never self-installs.
afterEach(() => cleanup());

function renderWithState(initialState: PrototypeState) {
  return render(
    <PrototypeStoreProvider initialState={initialState}>
      <ProgressScreen />
    </PrototypeStoreProvider>,
  );
}

describe("R01: historical All teams includes retired attendees", () => {
  it("hides a retired player from current-roster mode but shows their history under Team at session", () => {
    const base = buildScenario("team");
    const state: PrototypeState = {
      ...base,
      players: base.players.map((p) => (p.id === "pl-01" ? { ...p, retired: true } : p)),
    };
    renderWithState(state);

    // Current roster (the default view): unchanged, still excludes the retired player.
    expect(screen.queryByText("Alex M.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Team at session" }));

    // Historical "All teams" now includes him, explicitly labelled retired.
    expect(screen.getByText("Alex M.")).toBeDefined();
    expect(screen.getByText("Retired")).toBeDefined();
  });

  it("does not change program-wide totals when a player is retired", () => {
    // Session-hours/player-hours are sums over sessions, never over roster
    // membership, so retiring a player must not move these numbers.
    const base = buildScenario("team");
    const withRetired: PrototypeState = {
      ...base,
      players: base.players.map((p) => (p.id === "pl-01" ? { ...p, retired: true } : p)),
    };
    renderWithState(withRetired);

    const expectedSessionHours = withRetired.sessions.reduce((sum, s) => sum + s.creditHours, 0);
    const expectedPlayerHours = withRetired.sessions.reduce(
      (sum, s) => sum + s.creditHours * s.attendeeIds.length,
      0,
    );
    const sessionHoursTile = screen.getByText("Session-hours").parentElement;
    const playerHoursTile = screen.getByText("Player-hours").parentElement;
    expect(sessionHoursTile?.textContent).toContain(String(expectedSessionHours));
    expect(playerHoursTile?.textContent).toContain(String(expectedPlayerHours));
  });

  it("keeps unknown-legacy-history attendees reachable under All teams", () => {
    // ev-01 has no teamAtSession snapshot at all (legacy/unknown). Its
    // attendees must still surface under All teams, in the Unknown group,
    // for every one of them — not just the first row found.
    const state = buildScenario("team");
    renderWithState(state);

    fireEvent.click(screen.getByRole("button", { name: "Team at session" }));

    expect(screen.getByText("Ibrahim")).toBeDefined();
    const unknownMentions = screen.getAllByText(/Unknown \(legacy record\)/);
    expect(unknownMentions.length).toBeGreaterThan(0);
  });
});

describe("R01: historical controls survive every sub-team being retired", () => {
  it("keeps the Attribute-to panel, Team at session, and a retired-team filter reachable", () => {
    const base = buildScenario("team");
    const state: PrototypeState = {
      ...base,
      subTeams: base.subTeams.map((t) => ({ ...t, active: false })),
    };
    renderWithState(state);

    // Previously this whole panel (and the toggle inside it) disappeared
    // once activeTeams was empty, taking "Team at session" with it.
    const teamAtSessionBtn = screen.getByRole("button", { name: "Team at session" });
    fireEvent.click(teamAtSessionBtn);

    const retiredTeamChip = screen.getByRole("button", { name: "Kaizen Blue 7th Grade (retired)" });
    fireEvent.click(retiredTeamChip);

    // Selecting a fully-retired team still produces real historical rows.
    expect(screen.getByText("Alex M.")).toBeDefined();
  });

  it("still lets Current roster mode render with nothing to filter by", () => {
    const base = buildScenario("team");
    const state: PrototypeState = {
      ...base,
      subTeams: base.subTeams.map((t) => ({ ...t, active: false })),
    };
    renderWithState(state);

    // Current roster stays the default and stays usable: every player shows
    // up, just with no active-team filter chips beyond "All teams".
    expect(screen.getByRole("button", { name: "All teams" })).toBeDefined();
    expect(screen.getByText("Alex M.")).toBeDefined();
  });
});

describe("D10: expected-practice attendance demonstration", () => {
  it("shows a labelled demonstration table with expected-only percentages, excluding another team's player", () => {
    renderWithState(buildScenario("team"));

    // Scoped by the table's own accessible name: "Owen"/"Marcus" also
    // appear in the main Current roster table above, which is a different,
    // unscoped match this must not collide with.
    const demoTable = screen.getByRole("table", { name: /Expected-only practice attendance/ });
    const owenRow = within(demoTable).getByText("Owen").closest("tr")!;
    expect(within(owenRow).getByText("50%")).toBeDefined();

    // Priya (Gray 7th) was never named in the Blue 6th expected snapshot.
    expect(within(demoTable).queryByText("Priya")).toBeNull();
  });
});
