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
