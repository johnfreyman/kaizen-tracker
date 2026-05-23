import { describe, it, expect } from "vitest";
import {
  filterEventsByRange,
  playerAttendance,
  monthlyTrend,
  dayOfWeekBreakdown,
  insightsFromAttendance,
} from "./stats";
import { TeamEvent, EVENT_TYPES } from "@/app/hooks/useTeamStore";

describe("empty state", () => {
  it("handles empty events and roster safely", () => {
    const events: TeamEvent[] = [];
    const roster: string[] = [];
    const guests: string[] = [];

    expect(filterEventsByRange(events, "all")).toEqual([]);
    expect(filterEventsByRange(events, 30)).toEqual([]);
    expect(playerAttendance(events, roster, guests)).toEqual([]);
    expect(monthlyTrend(events, roster, guests)).toEqual([]);
    expect(dayOfWeekBreakdown(events, roster, guests)).toEqual([]);
    expect(insightsFromAttendance([])).toEqual({
      topAttendee: undefined,
      needsLove: undefined,
      longestStreak: undefined,
    });
  });
});

describe("all-guest event", () => {
  it("excludes guests and calculates regular roster metrics", () => {
    const roster = ["Alice", "Bob", "Charlie (guest)"];
    const guests = ["Charlie (guest)"];
    const events: TeamEvent[] = [
      {
        id: "1",
        date: "2026-05-20",
        type: EVENT_TYPES.PRACTICE,
        duration: 1.5,
        players: ["Charlie (guest)"],
        savedAt: "2026-05-20T12:00:00Z",
      },
    ];

    const attendance = playerAttendance(events, roster, guests);
    expect(attendance).toHaveLength(2); // Only Alice and Bob

    // Alice should have 0 attended, 1 missed, 0% rate
    const alice = attendance.find((a) => a.name === "Alice");
    expect(alice).toEqual({
      name: "Alice",
      practice: 0,
      training: 0,
      attended: 0,
      missed: 1,
      rate: 0,
      streak: 0,
      bestStreak: 0,
    });

    const trend = monthlyTrend(events, roster, guests);
    expect(trend).toEqual([
      {
        label: "May",
        hours: 1.5,
        attendance: 0, // 0 / 2 regular players
      },
    ]);

    const dow = dayOfWeekBreakdown(events, roster, guests);
    // 2026-05-20 is a Wednesday (3)
    expect(dow).toEqual([
      {
        day: "Wed",
        sessions: 1,
        attendance: 0,
      },
    ]);
  });
});

describe("single practice with one absentee", () => {
  it("calculates correct statistics", () => {
    const roster = ["Alice", "Bob"];
    const guests: string[] = [];
    const events: TeamEvent[] = [
      {
        id: "1",
        date: "2026-05-20",
        type: EVENT_TYPES.PRACTICE,
        duration: 2.0,
        players: ["Alice"],
        savedAt: "2026-05-20T12:00:00Z",
      },
    ];

    const attendance = playerAttendance(events, roster, guests);
    const alice = attendance.find((a) => a.name === "Alice");
    const bob = attendance.find((a) => a.name === "Bob");

    expect(alice).toEqual({
      name: "Alice",
      practice: 2.0,
      training: 0,
      attended: 1,
      missed: 0,
      rate: 1.0,
      streak: 1,
      bestStreak: 1,
    });

    expect(bob).toEqual({
      name: "Bob",
      practice: 0,
      training: 0,
      attended: 0,
      missed: 1,
      rate: 0.0,
      streak: 0,
      bestStreak: 0,
    });

    const insights = insightsFromAttendance(attendance);
    expect(insights.topAttendee?.name).toBe("Alice");
    expect(insights.needsLove?.name).toBe("Bob");
    expect(insights.longestStreak?.name).toBe("Alice");
  });
});

describe("streak math", () => {
  it("properly tracks consecutive attendance", () => {
    const roster = ["Alice"];
    const guests: string[] = [];
    
    // 3 practices in a row
    const events: TeamEvent[] = [
      {
        id: "1",
        date: "2026-05-18",
        type: EVENT_TYPES.PRACTICE,
        duration: 1.0,
        players: ["Alice"],
        savedAt: "2026-05-18T12:00:00Z",
      },
      {
        id: "2",
        date: "2026-05-19",
        type: EVENT_TYPES.PRACTICE,
        duration: 1.0,
        players: ["Alice"],
        savedAt: "2026-05-19T12:00:00Z",
      },
      {
        id: "3",
        date: "2026-05-20",
        type: EVENT_TYPES.PRACTICE,
        duration: 1.0,
        players: ["Alice"],
        savedAt: "2026-05-20T12:00:00Z",
      },
    ];

    let attendance = playerAttendance(events, roster, guests);
    expect(attendance[0].streak).toBe(3);
    expect(attendance[0].bestStreak).toBe(3);

    // A miss resets current streak but keeps bestStreak
    const eventsWithMiss = [
      ...events,
      {
        id: "4",
        date: "2026-05-21",
        type: EVENT_TYPES.PRACTICE,
        duration: 1.0,
        players: [], // Missed
        savedAt: "2026-05-21T12:00:00Z",
      },
    ];

    attendance = playerAttendance(eventsWithMiss, roster, guests);
    expect(attendance[0].streak).toBe(0);
    expect(attendance[0].bestStreak).toBe(3);

    // An optional training does not affect practice streak or practice stats
    const eventsWithOptional = [
      ...eventsWithMiss,
      {
        id: "5",
        date: "2026-05-22",
        type: EVENT_TYPES.OPTIONAL_TRAINING,
        duration: 1.5,
        players: ["Alice"],
        savedAt: "2026-05-22T12:00:00Z",
      },
    ];

    attendance = playerAttendance(eventsWithOptional, roster, guests);
    expect(attendance[0].streak).toBe(0);
    expect(attendance[0].bestStreak).toBe(3);
    expect(attendance[0].training).toBe(1.5);
    expect(attendance[0].practice).toBe(3.0); // Only practice events contribute
  });
});
