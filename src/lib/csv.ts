import { TeamEvent } from "@/app/hooks/useTeamStore";
import {
  filterEventsByRange,
  playerAttendance,
} from "@/lib/stats";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CsvRange = "30" | "90" | "180" | "all";

export interface ExportReportCSVOpts {
  events: TeamEvent[];
  roster: string[];
  guestPlayers: string[];
  range: CsvRange;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wraps a value in double-quotes and escapes any embedded double-quotes. */
function q(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Formats a Date as YYYYMMDD for use in the filename. */
function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Parses an event date string into a human-readable label. */
function formatEventDate(date: string): string {
  const parsed = new Date(
    date.includes("T") ? date : `${date}T12:00:00`
  );
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Builds and immediately triggers a CSV download with two sections:
 *
 * 1. Per-player totals row (practice hrs, optional hrs, total hrs, att %, current streak, best streak)
 * 2. Per-session log (date, type, duration, player count, comma-quoted player list)
 *
 * Uses the same `filterEventsByRange` + `playerAttendance` helpers as SummaryPage —
 * no duplicated math.
 *
 * Filename: `team-report-{range}-{YYYYMMDD}.csv`
 */
export function exportReportCSV({
  events,
  roster,
  guestPlayers,
  range,
}: ExportReportCSVOpts): void {
  const days: number | "all" = range === "all" ? "all" : Number(range);
  const scoped = filterEventsByRange(events, days);

  // ── Section 1: Per-player totals ──────────────────────────────────────────
  const att = playerAttendance(scoped, roster, guestPlayers);

  const playerHeader = [
    "Player",
    "Practice Hours",
    "Optional Hours",
    "Total Hours",
    "Practice Attendance %",
    "Current Streak",
    "Best Streak",
  ].join(",");

  const playerRows = att.map((p) =>
    [
      q(p.name),
      q(p.practice.toFixed(1)),
      q(p.training.toFixed(1)),
      q((p.practice + p.training).toFixed(1)),
      q(`${Math.round(p.rate * 100)}%`),
      q(p.streak),
      q(p.bestStreak),
    ].join(",")
  );

  // ── Section 2: Per-session log ────────────────────────────────────────────
  const sessionHeader = [
    "Date",
    "Type",
    "Duration",
    "Player Count",
    "Players",
  ].join(",");

  const sessionRows = [...scoped]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((ev) =>
      [
        q(formatEventDate(ev.date)),
        q(ev.type),
        q(ev.duration),
        q(ev.players.length),
        q(ev.players.join(", ")),
      ].join(",")
    );

  // ── Assemble ──────────────────────────────────────────────────────────────
  const lines: string[] = [
    playerHeader,
    ...playerRows,
    "",                   // blank separator line between sheets
    sessionHeader,
    ...sessionRows,
  ];

  const csv = lines.join("\r\n");

  // ── Download ──────────────────────────────────────────────────────────────
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const filename = `team-report-${range}-${yyyymmdd(new Date())}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Clean up on the next tick so the browser has time to initiate the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
