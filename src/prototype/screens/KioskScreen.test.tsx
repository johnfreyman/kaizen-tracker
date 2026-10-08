/** @vitest-environment jsdom */
/**
 * R02 component regressions: kiosk renders standalone, outside
 * PrototypeApp's Shell, so a local-save failure must be exposed inside
 * kiosk itself, and check-in/undo confirmation must never claim an
 * unqualified success while that failure is active. Recovery restores the
 * normal, unqualified confirmation.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import KioskScreen from "./KioskScreen";
import { buildScenario } from "../fixtures";
import { PrototypeStoreProvider, usePrototypeStore } from "../store";
import type { PrototypeState } from "../types";

// See RosterScreen.test.tsx: this project doesn't enable Vitest `globals`,
// so @testing-library/react's auto afterEach(cleanup) never self-installs.
afterEach(() => cleanup());

/** Test-only harness: exposes the dev storage-failure toggle that in the
 *  real app lives in PrototypeApp's DevBanner, unreachable from inside
 *  kiosk on purpose — this drives the same action it would. */
function Harness({ onExit }: { onExit: () => void }) {
  const { actions } = usePrototypeStore();
  return (
    <div>
      <button onClick={() => actions.setSimulateStorageFailure(true)}>test-fail-on</button>
      <button onClick={() => actions.setSimulateStorageFailure(false)}>test-fail-off</button>
      <KioskScreen onExit={onExit} />
    </div>
  );
}

function renderKiosk(initialState: PrototypeState, onExit = vi.fn()) {
  return render(
    <PrototypeStoreProvider initialState={initialState}>
      <Harness onExit={onExit} />
    </PrototypeStoreProvider>,
  );
}

function activeSessionState(): PrototypeState {
  const base = buildScenario("team");
  return {
    ...base,
    activeSession: {
      id: "sess-kiosk-test",
      type: "practice",
      date: "2026-09-21",
      creditHours: 1.5,
      roundId: base.currentRoundId,
      present: {},
      revision: 0,
      delivery: "device",
      closedElsewhere: false,
    },
    kioskSessionId: "sess-kiosk-test",
  };
}

// #0 (Malia) and #23 (Sam) are each worn by exactly one fixture player, so a
// lookup resolves straight to a single "That's me" card with no picking.
function checkInByNumber(digits: string[]) {
  for (const d of digits) fireEvent.click(screen.getByRole("button", { name: d }));
  fireEvent.click(screen.getByRole("button", { name: "Find player" }));
  fireEvent.click(screen.getByRole("button", { name: "That's me" }));
}

/** The confirmation panel replaces the number pad for 2.6s (real time) before
 *  clearing itself. Fake-advance past that instead of slowing the suite. */
function skipConfirmationTimeout() {
  act(() => {
    vi.advanceTimersByTime(2700);
  });
}

describe("R02: kiosk exposes a local-save failure and qualifies check-in feedback", () => {
  it("shows no failure banner and an unqualified success when storage is healthy", () => {
    renderKiosk(activeSessionState());

    expect(screen.queryByText(/isn't saving check-ins right now/)).toBeNull();

    checkInByNumber(["0"]); // Malia, #0
    expect(screen.getByText("You're checked in")).toBeDefined();
    expect(screen.queryByText(/not saved yet/)).toBeNull();
  });

  it("exposes the failure and qualifies check-in feedback once storage fails, then recovers", () => {
    vi.useFakeTimers();
    try {
      renderKiosk(activeSessionState());

      fireEvent.click(screen.getByText("test-fail-on"));
      expect(screen.getByText(/isn't saving check-ins right now/)).toBeDefined();

      checkInByNumber(["0"]); // Malia, #0
      expect(screen.getByText("Checked in — not saved yet")).toBeDefined();
      expect(screen.queryByText("You're checked in")).toBeNull();
      expect(screen.getByText(/isn't saving locally right now/)).toBeDefined();

      skipConfirmationTimeout(); // back to the pad

      // Recovery: once storage is healthy again, a later check-in is a
      // plain, unqualified success — the qualification does not stick.
      fireEvent.click(screen.getByText("test-fail-off"));
      expect(screen.queryByText(/isn't saving check-ins right now/)).toBeNull();

      checkInByNumber(["2", "3"]); // Sam, #23
      expect(screen.getByText("You're checked in")).toBeDefined();
      expect(screen.queryByText(/not saved yet/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("qualifies undo feedback the same way while storage is failing", () => {
    vi.useFakeTimers();
    try {
      renderKiosk(activeSessionState());
      checkInByNumber(["0"]); // Malia checked in while healthy
      skipConfirmationTimeout(); // back to the pad

      fireEvent.click(screen.getByText("test-fail-on"));
      expect(screen.getByText(/isn't saving check-ins right now/)).toBeDefined();

      // Look Malia back up and undo the check-in while storage is failing.
      fireEvent.click(screen.getByRole("button", { name: "0" }));
      fireEvent.click(screen.getByRole("button", { name: "Find player" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo check-in" }));

      expect(screen.getByText("Undo recorded — not saved yet")).toBeDefined();
      expect(screen.queryByText("Check-in undone")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps coach navigation unreachable even while the failure banner is shown", () => {
    renderKiosk(activeSessionState());
    fireEvent.click(screen.getByText("test-fail-on"));
    expect(screen.getByText(/isn't saving check-ins right now/)).toBeDefined();

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.queryByText("Roster")).toBeNull();
  });
});
