import { TeamEvent, EVENT_TYPES } from "@/app/hooks/useTeamStore";

/**
 * Calculates total practice and training hours per player from a list of events and team roster.
 */
export function calculateTotals(
  events: TeamEvent[],
  roster: string[]
): Record<string, { practice: number; training: number }> {
  const totals: Record<string, { practice: number; training: number }> = {};

  const allPlayers = new Set([
    ...roster,
    ...events.flatMap((e) => e.players),
  ]);

  allPlayers.forEach((player) => {
    totals[player] = { practice: 0, training: 0 };
  });

  events.forEach((event) => {
    event.players.forEach((player) => {
      if (!totals[player]) totals[player] = { practice: 0, training: 0 };
      if (event.type === EVENT_TYPES.PRACTICE) {
        totals[player].practice += event.duration;
      } else {
        totals[player].training += event.duration;
      }
    });
  });

  return totals;
}

/**
 * Formats a value as a percentage of the total, rounded to the nearest integer.
 * Returns "0%" if total is zero.
 */
export function percent(value: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export interface PlayerAttendanceRecord {
  name: string;
  practice: number;
  training: number;
  attended: number;
  missed: number;
  rate: number;
  streak: number;
  bestStreak: number;
}

export interface MonthlyTrendRecord {
  label: string;
  hours: number;
  attendance: number;
}

export interface DayOfWeekRecord {
  day: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
  sessions: number;
  attendance: number;
}

export interface AttendanceInsights {
  topAttendee?: PlayerAttendanceRecord;
  needsLove?: PlayerAttendanceRecord;
  longestStreak?: PlayerAttendanceRecord;
}

/**
 * Returns events from the last days (inclusive) or all if "all".
 */
export function filterEventsByRange(
  events: TeamEvent[],
  days: number | "all"
): TeamEvent[] {
  if (days === "all") {
    return events;
  }
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  return events.filter((e) => e.date >= cutoffStr);
}

/**
 * Calculates per-player attendance metrics, streaks, and attendance rate. Guests are excluded.
 */
export function playerAttendance(
  events: TeamEvent[],
  roster: string[],
  guestPlayers: string[]
): PlayerAttendanceRecord[] {
  const regularPlayers = roster.filter((p) => !guestPlayers.includes(p));

  const totals: Record<
    string,
    {
      practice: number;
      training: number;
      attended: number;
      missed: number;
      rate: number;
      streak: number;
      bestStreak: number;
    }
  > = {};

  regularPlayers.forEach((player) => {
    totals[player] = {
      practice: 0,
      training: 0,
      attended: 0,
      missed: 0,
      rate: 0,
      streak: 0,
      bestStreak: 0,
    };
  });

  // Accumulate practice/training hours for regular players
  events.forEach((ev) => {
    ev.players.forEach((p) => {
      if (totals[p]) {
        if (ev.type === EVENT_TYPES.PRACTICE) {
          totals[p].practice += ev.duration;
        } else if (ev.type === EVENT_TYPES.OPTIONAL_TRAINING) {
          totals[p].training += ev.duration;
        }
      }
    });
  });

  const practices = events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
  const sortedPracs = [...practices].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  regularPlayers.forEach((p) => {
    let curStreak = 0;
    let bestStreak = 0;
    let attended = 0;

    sortedPracs.forEach((ev) => {
      if (ev.players.includes(p)) {
        curStreak++;
        attended++;
        bestStreak = Math.max(bestStreak, curStreak);
      } else {
        curStreak = 0;
      }
    });

    totals[p].streak = curStreak;
    totals[p].bestStreak = bestStreak;
    totals[p].attended = attended;
    totals[p].missed = sortedPracs.length - attended;
    totals[p].rate = sortedPracs.length ? attended / sortedPracs.length : 0;
  });

  return regularPlayers.map((p) => ({
    name: p,
    ...totals[p],
  }));
}

/**
 * Groups events by month to calculate monthly hours and average practice attendance % across regular players.
 */
export function monthlyTrend(
  events: TeamEvent[],
  roster: string[],
  guestPlayers: string[]
): MonthlyTrendRecord[] {
  const regularPlayers = roster.filter((p) => !guestPlayers.includes(p));
  const byMonth: Record<string, { hours: number; rates: number[] }> = {};

  events.forEach((ev) => {
    const m = ev.date.slice(0, 7); // "YYYY-MM"
    if (!byMonth[m]) {
      byMonth[m] = { hours: 0, rates: [] };
    }
    byMonth[m].hours += ev.duration;
    if (ev.type === EVENT_TYPES.PRACTICE) {
      const regCount = ev.players.filter((p) =>
        regularPlayers.includes(p)
      ).length;
      const rate = regularPlayers.length ? regCount / regularPlayers.length : 0;
      byMonth[m].rates.push(rate);
    }
  });

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, d]) => {
      const [, mo] = m.split("-");
      const monthIndex = parseInt(mo, 10) - 1;
      const label = monthNames[monthIndex] || "";
      const avgAttendance = d.rates.length
        ? Math.round(
            (d.rates.reduce((sum, r) => sum + r, 0) / d.rates.length) * 100
          )
        : 0;

      return {
        label,
        hours: Number(d.hours.toFixed(1)),
        attendance: avgAttendance,
      };
    });
}

/**
 * Calculates sessions and average attendance by day of week for practice sessions.
 */
export function dayOfWeekBreakdown(
  events: TeamEvent[],
  roster: string[],
  guestPlayers: string[]
): DayOfWeekRecord[] {
  const regularPlayers = roster.filter((p) => !guestPlayers.includes(p));
  const practices = events.filter((e) => e.type === EVENT_TYPES.PRACTICE);

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const dow = daysOfWeek.map((day) => ({ day, count: 0, rateSum: 0 }));

  practices.forEach((ev) => {
    const hasTime =
      ev.date.includes("T") ||
      ev.date.includes(" ") ||
      ev.date.includes(":");
    const parsedString = hasTime ? ev.date : `${ev.date}T12:00:00`;
    const d = new Date(parsedString).getDay();
    if (d >= 0 && d <= 6) {
      dow[d].count++;
      const regCount = ev.players.filter((p) =>
        regularPlayers.includes(p)
      ).length;
      const rate = regularPlayers.length ? regCount / regularPlayers.length : 0;
      dow[d].rateSum += rate;
    }
  });

  return dow
    .filter((d) => d.count > 0)
    .map((d) => ({
      day: d.day,
      sessions: d.count,
      attendance: Math.round((d.rateSum / d.count) * 100),
    }));
}

/**
 * Picks topAttendee, needsLove, and longestStreak from player attendance records.
 */
export function insightsFromAttendance(
  att: PlayerAttendanceRecord[]
): AttendanceInsights {
  if (att.length === 0) {
    return {
      topAttendee: undefined,
      needsLove: undefined,
      longestStreak: undefined,
    };
  }

  const ranked = [...att].sort((a, b) => b.rate - a.rate);
  const topAttendee = ranked[0];
  const needsLove = ranked[ranked.length - 1];
  const longestStreak = ranked.reduce(
    (best, p) => (p.bestStreak > best.bestStreak ? p : best),
    ranked[0]
  );

  return {
    topAttendee,
    needsLove,
    longestStreak,
  };
}
