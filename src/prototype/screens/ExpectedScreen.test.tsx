/** @vitest-environment jsdom */
/**
 * D10 component regressions: the actual "Who's expected?" Take
 * attendance/Cancel controls, not just resolveExpectedPlayerIds, must
 * withhold or produce a real session with the correct saved snapshot.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExpectedScreen from "./ExpectedScreen";
import { buildScenario } from "../fixtures";
import { PrototypeStoreProvider, usePrototypeStore } from "../store";
import type { PrototypeState } from "../types";
import type { ScreenId } from "../PrototypeApp";

// See RosterScreen.test.tsx: this project doesn't enable Vitest `globals`,
// so @testing-library/react's auto afterEach(cleanup) never self-installs.
afterEach(() => cleanup());

/** Exposes the resulting active session's saved snapshot so a test can
 *  inspect what the real Take attendance control actually dispatched. */
function Harness({ go }: { go: (s: ScreenId) => void }) {
  const { state } = usePrototypeStore();
  return (
    <div>
      <div data-testid="active-session">
        {state.activeSession ? JSON.stringify(state.activeSession.expected) : "none"}
      </div>
      <ExpectedScreen go={go} />
    </div>
  );
}

function renderExpected(initialState: PrototypeState, go = vi.fn()) {
  render(
    <PrototypeStoreProvider initialState={initialState}>
      <Harness go={go} />
    </PrototypeStoreProvider>,
  );
  return { go };
}

describe("D10: Who's expected? team selection", () => {
  it("disables Take attendance until an explicit choice is made, then saves the selected team's snapshot", () => {
    const { go } = renderExpected(buildScenario("team"));

    const takeAttendance = screen.getByRole("button", { name: "Take attendance" });
    expect(takeAttendance.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Kaizen Blue 7th Grade/ }));
    expect(takeAttendance.hasAttribute("disabled")).toBe(false);

    fireEvent.click(takeAttendance);
    expect(go).toHaveBeenCalledWith("attendance");

    const saved = JSON.parse(screen.getByTestId("active-session").textContent!);
    expect(saved.allKaizen).toBe(false);
    expect(saved.teamIds).toEqual(["st-b7"]);
    expect(saved.playerIds).toContain("pl-11"); // Kayla, via Blue 7th
    expect(saved.playerIds).not.toContain("pl-07"); // Priya, Gray 7th only
  });

  it("All Kaizen is mutually exclusive with a specific team and reaches the whole roster", () => {
    const { go } = renderExpected(buildScenario("team"));

    fireEvent.click(screen.getByRole("button", { name: /Kaizen Blue 7th Grade/ }));
    fireEvent.click(screen.getByRole("button", { name: /^All Kaizen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Take attendance" }));
    expect(go).toHaveBeenCalledWith("attendance");

    const saved = JSON.parse(screen.getByTestId("active-session").textContent!);
    expect(saved.allKaizen).toBe(true);
    expect(saved.teamIds).toEqual([]);
    expect(saved.playerIds).toContain("pl-16"); // Elena, a guest with no sub-team
  });

  it("Cancel returns to Home without creating any session", () => {
    const { go } = renderExpected(buildScenario("team"));

    fireEvent.click(screen.getByRole("button", { name: /Kaizen Blue 7th Grade/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(go).toHaveBeenCalledWith("home");
    expect(screen.getByTestId("active-session").textContent).toBe("none");
  });

  it("shows only the default Kaizen choice, already reachable, when there are no active sub-teams", () => {
    const { go } = renderExpected(buildScenario("noSubTeams"));

    expect(screen.queryByRole("button", { name: /^All Kaizen/ })).toBeNull();
    const takeAttendance = screen.getByRole("button", { name: "Take attendance" });
    expect(takeAttendance.hasAttribute("disabled")).toBe(false);

    fireEvent.click(takeAttendance);
    expect(go).toHaveBeenCalledWith("attendance");
    const saved = JSON.parse(screen.getByTestId("active-session").textContent!);
    expect(saved.allKaizen).toBe(true);
  });
});
