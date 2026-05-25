/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LaunchPage from "../LaunchPage";
import { useTeamStore } from "../../hooks/useTeamStore";
import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the hook and constants
vi.mock("../../hooks/useTeamStore", () => ({
  useTeamStore: vi.fn(),
  EVENT_TYPES: {
    PRACTICE: "Practice",
    OPTIONAL_TRAINING: "Optional Training",
  },
}));

describe("LaunchPage Dynamic Presets", () => {
  const mockStartSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders standard evening presets for brand-new accounts with 0 events", () => {
    // Mock store state for brand-new account (0 events)
    vi.mocked(useTeamStore).mockReturnValue({
      state: {
        teamName: "Team Name",
        teamLogo: "",
        roster: ["Player A"],
        events: [],
        activeSession: null,
        raffleEnabled: false,
        archivedEvents: [],
        guestPlayers: [],
      },
      startSession: mockStartSession,
    } as any);

    render(<LaunchPage onNavigate={vi.fn()} />);

    // Fallback evening presets: 4:00 PM, 5:00 PM, 6:00 PM
    expect(screen.getByText("4:00 PM")).toBeDefined();
    expect(screen.getByText("5:00 PM")).toBeDefined();
    expect(screen.getByText("6:00 PM")).toBeDefined();

    // Fallback durations: 30 min, 1 hr, 1.5 hrs, etc.
    expect(screen.getByText("30 min")).toBeDefined();
    expect(screen.getByText("1 hr")).toBeDefined();
    expect(screen.getByText("1.5 hrs")).toBeDefined();
    expect(screen.getByText("2 hrs")).toBeDefined();
    expect(screen.getByText("2.5 hrs")).toBeDefined();
    expect(screen.getByText("3 hrs")).toBeDefined();
  });

  test("derives top 3 most-frequent time presets sorted correctly when >= 1 unique times", () => {
    // Mock store state with event history:
    // "09:00" appears 5 times
    // "10:00" appears 3 times
    // "08:00" appears 3 times
    // "11:00" appears 2 times
    const events = [
      ...Array(5).fill({ date: "2026-05-22T09:00:00", duration: 1.5 }),
      ...Array(3).fill({ date: "2026-05-22T10:00:00", duration: 1.5 }),
      ...Array(3).fill({ date: "2026-05-22T08:00:00", duration: 1.5 }),
      ...Array(2).fill({ date: "2026-05-22T11:00:00", duration: 1.5 }),
    ].map((e, i) => ({ ...e, id: `e${i}`, players: [], savedAt: `2026-05-22T00:00:${i}` }));

    // Most recent event is 09:00 AM, duration 1.5
    events[0] = { id: "e0", date: "2026-05-22T09:00:00", duration: 1.5, players: [], savedAt: "2026-05-22T20:00:00" };

    vi.mocked(useTeamStore).mockReturnValue({
      state: {
        teamName: "Team Name",
        teamLogo: "",
        roster: ["Player A"],
        events,
        activeSession: null,
        raffleEnabled: false,
        archivedEvents: [],
        guestPlayers: [],
      },
      startSession: mockStartSession,
    } as any);

    render(<LaunchPage onNavigate={vi.fn()} />);

    // Verify top 3 times appear:
    expect(screen.getByText("9:00 AM")).toBeDefined();
    expect(screen.getByText("8:00 AM")).toBeDefined();
    expect(screen.getByText("10:00 AM")).toBeDefined();
    expect(screen.queryByText("11:00 AM")).toBeNull();
  });
});
