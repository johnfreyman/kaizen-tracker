/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildScenario } from "../fixtures";
import { PrototypeStoreProvider, reducer } from "../store";
import AttendanceScreen from "./AttendanceScreen";

afterEach(() => cleanup());

it("opens a selected-team practice with only expected cards, while keeping other players available", () => {
  const state = reducer(buildScenario("team"), {
    type: "startPractice",
    teamIds: ["st-b7", "st-g7"],
    allKaizen: false,
  });
  render(
    <PrototypeStoreProvider initialState={state}>
      <AttendanceScreen go={vi.fn()} />
    </PrototypeStoreProvider>,
  );

  expect(screen.getByRole("button", { name: "Jordan · #7, absent" })).toBeDefined();
  // Kayla also plays for Blue 6th, but her Blue 7th membership makes her expected.
  expect(screen.getByRole("button", { name: "Kayla · #12, absent" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Owen · #3, absent" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Other players/ }));
  expect(screen.getByRole("button", { name: "Owen · #3, absent" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Owen · #3, absent" }));
  expect(state.activeSession?.expected?.playerIds).not.toContain("pl-10");

  fireEvent.click(screen.getByRole("button", { name: /Expected players/ }));
  expect(screen.queryByRole("button", { name: "Owen · #3, present" })).toBeNull();
  expect(screen.getByText(/1 player marked present is hidden by this filter/)).toBeDefined();
});

it("keeps optional training open to the full active roster", () => {
  const state = reducer(buildScenario("team"), { type: "start", sessionType: "training" });
  render(
    <PrototypeStoreProvider initialState={state}>
      <AttendanceScreen go={vi.fn()} />
    </PrototypeStoreProvider>,
  );
  expect(screen.getByRole("button", { name: "Owen · #3, absent" })).toBeDefined();
  expect(screen.queryByRole("button", { name: /Expected players/ })).toBeNull();
});
