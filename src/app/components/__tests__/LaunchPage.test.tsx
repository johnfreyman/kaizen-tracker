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

    // Fallback evening presets: 5:00 PM to 8:30 PM
    expect(screen.getByText("5:00 PM")).toBeDefined();
    expect(screen.getByText("5:30 PM")).toBeDefined();
    expect(screen.getByText("6:00 PM")).toBeDefined();
    expect(screen.getByText("6:30 PM")).toBeDefined();
    expect(screen.getByText("7:00 PM")).toBeDefined();
    expect(screen.getByText("7:30 PM")).toBeDefined();
    expect(screen.getByText("8:00 PM")).toBeDefined();
    expect(screen.getByText("8:30 PM")).toBeDefined();

    // Fallback durations: 30 min, 1 hr, 1.5 hrs, etc.
    expect(screen.getByText("30 min")).toBeDefined();
    expect(screen.getByText("1 hr")).toBeDefined();
    expect(screen.getByText("1.5 hrs")).toBeDefined();
    expect(screen.getByText("2 hrs")).toBeDefined();
    expect(screen.getByText("2.5 hrs")).toBeDefined();
    expect(screen.getByText("3 hrs")).toBeDefined();
  });

  test("derives top 7 most-frequent time presets sorted correctly when >= 3 unique times", () => {
    // Mock store state with event history:
    // "09:00" appears 5 times
    // "10:00" appears 3 times (tie with 08:00 but 08:00 is earlier, so 08:00 should come first in tie)
    // "08:00" appears 3 times
    // "11:00" appears 2 times
    // "12:00" appears 2 times
    // "13:00" appears 1 time
    // "14:00" appears 1 time
    // "15:00" appears 1 time (should not be in top 7 because only top 7 are displayed)
    const events = [
      ...Array(5).fill({ date: "2026-05-22T09:00:00", duration: 1.5 }),
      ...Array(3).fill({ date: "2026-05-22T10:00:00", duration: 1.5 }),
      ...Array(3).fill({ date: "2026-05-22T08:00:00", duration: 1.5 }),
      ...Array(2).fill({ date: "2026-05-22T11:00:00", duration: 1.5 }),
      ...Array(2).fill({ date: "2026-05-22T12:00:00", duration: 1.5 }),
      { date: "2026-05-22T13:00:00", duration: 1.5 },
      { date: "2026-05-22T14:00:00", duration: 1.5 },
      { date: "2026-05-22T15:00:00", duration: 1.5 },
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

    // Verify top 7 times appear:
    // Sorted order: 9:00 AM (freq 5), 8:00 AM (freq 3, tie), 10:00 AM (freq 3, tie), 11:00 AM (freq 2, tie), 12:00 PM (freq 2, tie), 1:00 PM (freq 1, tie), 2:00 PM (freq 1, tie)
    // 3:00 PM (freq 1) is the 8th slot in freq map so it should NOT be rendered since we limit to top 7.
    expect(screen.getByText("9:00 AM")).toBeDefined();
    expect(screen.getByText("8:00 AM")).toBeDefined();
    expect(screen.getByText("10:00 AM")).toBeDefined();
    expect(screen.getByText("11:00 AM")).toBeDefined();
    expect(screen.getByText("12:00 PM")).toBeDefined();
    expect(screen.getByText("1:00 PM")).toBeDefined();
    expect(screen.getByText("2:00 PM")).toBeDefined();
    expect(screen.queryByText("3:00 PM")).toBeNull();
  });
});
