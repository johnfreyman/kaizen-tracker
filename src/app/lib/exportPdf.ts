import { TeamEvent, ArchivedEventSet, EVENT_TYPES } from "@/app/hooks/useTeamStore";
import { calculateTotals, percent } from "@/lib/stats";
import { formatDate } from "@/lib/dates";

export type SortColumn =
  | "player"
  | "practice"
  | "practicePercent"
  | "optional"
  | "optPercent"
  | "lastAttended";

export type SortDir = "asc" | "desc";

export type DateRange = "7d" | "30d" | "season" | "custom";

export interface ExportPdfSections {
  cover: boolean;
  playerTable: boolean;
  attendanceDistribution: boolean;
  eventLog: boolean;
  archivedEvents: boolean;
  coachNotes: boolean;
}

export interface ExportPdfArgs {
  teamName: string;
  teamLogo?: string;
  events: TeamEvent[];
  roster: string[];
  dateRange: DateRange;
  customStart?: string;
  customEnd?: string;
  sortCol: SortColumn;
  sortDir: SortDir;
  sections: ExportPdfSections;
  paperSize: "letter" | "a4" | "legal";
  orientation: "portrait" | "landscape";
  filename: string;
  archivedEventsBundles?: ArchivedEventSet[];
}

const TIER_OK  = "#12b76a";
const TIER_MID = "#f79009";
const TIER_LOW = "#f04438";

function tierColor(pct: number): string {
  if (pct >= 100) return TIER_OK;
  if (pct >= 50)  return TIER_MID;
  return TIER_LOW;
}

function tierTextColor(pct: number): string {
  if (pct >= 100) return "#027a48";
  if (pct >= 50)  return "#b54708";
  return "#b42318";
}

function sortPlayers(
  players: string[],
  totals: Record<string, { practice: number; training: number }>,
  lastAttended: Record<string, string>,
  totalPracticePossible: number,
  totalTrainingPossible: number,
  sortCol: SortColumn,
  sortDir: SortDir
): string[] {
  return [...players].sort((a, b) => {
    const pa = totals[a] ?? { practice: 0, training: 0 };
    const pb = totals[b] ?? { practice: 0, training: 0 };
    let diff = 0;
    switch (sortCol) {
      case "player":
        diff = a.localeCompare(b);
        break;
      case "practice":
        diff = pa.practice - pb.practice;
        break;
      case "practicePercent":
        diff =
          (totalPracticePossible > 0 ? pa.practice / totalPracticePossible : 0) -
          (totalPracticePossible > 0 ? pb.practice / totalPracticePossible : 0);
        break;
      case "optional":
        diff = pa.training - pb.training;
        break;
      case "optPercent":
        diff =
          (totalTrainingPossible > 0 ? pa.training / totalTrainingPossible : 0) -
          (totalTrainingPossible > 0 ? pb.training / totalTrainingPossible : 0);
        break;
      case "lastAttended": {
        diff = (lastAttended[a] ?? "").localeCompare(lastAttended[b] ?? "");
        break;
      }
    }
    return sortDir === "desc" ? -diff : diff;
  });
}

function groupEventsByWeek(events: TeamEvent[]): Map<string, TeamEvent[]> {
  const groups = new Map<string, TeamEvent[]>();
  [...events]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((e) => {
      const d = new Date(e.date.includes("T") ? e.date : `${e.date}T12:00:00`);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const group = groups.get(key) ?? [];
      group.push(e);
      groups.set(key, group);
    });
  return groups;
}

function dateRangeLabel(args: ExportPdfArgs): string {
  if (args.dateRange === "7d")  return "Last 7 days";
  if (args.dateRange === "30d") return "Last 30 days";
  if (args.dateRange === "custom" && args.customStart && args.customEnd) {
    return `${formatDate(args.customStart)} – ${formatDate(args.customEnd)}`;
  }
  return "This season";
}

export function exportPdf(args: ExportPdfArgs): void {
  const {
    teamName, events, roster, sortCol, sortDir, sections,
    paperSize, orientation, filename, archivedEventsBundles = [],
  } = args;

  const totals = calculateTotals(events, roster);
  const totalPracticePossible = events
    .filter((e) => e.type === EVENT_TYPES.PRACTICE)
    .reduce((sum, e) => sum + e.duration, 0);
  const totalTrainingPossible = events
    .filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING)
    .reduce((sum, e) => sum + e.duration, 0);

  const lastAttended: Record<string, string> = {};
  events.forEach((e) => {
    e.players.forEach((p) => {
      if (!lastAttended[p] || e.date > lastAttended[p]) lastAttended[p] = e.date;
    });
  });

  const allPlayers = Object.keys(totals);
  const sorted = sortPlayers(
    allPlayers, totals, lastAttended,
    totalPracticePossible, totalTrainingPossible,
    sortCol, sortDir
  );

  const practiceEvents = events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
  const avgAttendance =
    practiceEvents.length > 0 && roster.length > 0
      ? Math.round(
          (practiceEvents.reduce((s, e) => s + e.players.length, 0) /
            (practiceEvents.length * roster.length)) * 100
        )
      : 0;

  const rangeLabel = dateRangeLabel(args);
  const generatedDate = new Date().toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
  const pageSize = paperSize === "a4" ? "210mm 297mm" : paperSize === "legal" ? "8.5in 14in" : "8.5in 11in";
  const pageOrient = orientation;

  // ── Section: Cover ──────────────────────────────────────────────────────────
  const coverHtml = sections.cover ? `
    <div class="page cover-page">
      <div class="cover-eyebrow">Session Summary Report</div>
      <h1 class="cover-title">${teamName || "Kaizen Tracker"}</h1>
      <div class="cover-range">${rangeLabel} · ${events.length} event${events.length !== 1 ? "s" : ""}</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Events</div><div class="kpi-value">${events.length}</div></div>
        <div class="kpi"><div class="kpi-label">Practice Hours</div><div class="kpi-value">${totalPracticePossible.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div></div>
        <div class="kpi"><div class="kpi-label">Optional Training</div><div class="kpi-value">${totalTrainingPossible.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Attendance</div><div class="kpi-value">${avgAttendance}%</div></div>
      </div>
      <div class="cover-foot">
        <span>Generated ${generatedDate}</span>
        <span>Roster: ${roster.length} athlete${roster.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  ` : "";

  // ── Section: Player Table ───────────────────────────────────────────────────
  const playerTableHtml = sections.playerTable ? `
    <div class="page">
      <div class="section-eyebrow">Player Totals</div>
      <h2 class="section-title">Practice &amp; optional training by athlete</h2>
      <p class="section-meta">Sorted by ${sortCol} · ${sortDir === "desc" ? "descending" : "ascending"}</p>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th class="num">Practice Hrs</th>
            <th>Practice %</th>
            <th class="num">Optional</th>
            <th>Opt %</th>
            <th class="num">Last Attended</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.length === 0
            ? `<tr><td colspan="6" class="empty">No data for this date range.</td></tr>`
            : sorted.map((player) => {
                const pt = totals[player] ?? { practice: 0, training: 0 };
                const practPct = totalPracticePossible > 0
                  ? Math.round((pt.practice / totalPracticePossible) * 100) : 0;
                const optPct = totalTrainingPossible > 0
                  ? Math.round((pt.training / totalTrainingPossible) * 100) : 0;
                const barColor = tierColor(practPct);
                const textColor = tierTextColor(practPct);
                const optBarColor = tierColor(optPct);
                const optTextColor = tierTextColor(optPct);
                return `
                  <tr>
                    <td class="name">${player}</td>
                    <td class="num">${pt.practice.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td>
                      <div class="bar-cell">
                        <div class="bar-track"><div class="bar-fill" style="width:${practPct}%;background:${barColor}"></div></div>
                        <span style="color:${textColor}">${practPct}%</span>
                      </div>
                    </td>
                    <td class="num">${pt.training.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td>
                      <div class="bar-cell">
                        <div class="bar-track"><div class="bar-fill" style="width:${optPct}%;background:${optBarColor}"></div></div>
                        <span style="color:${optTextColor}">${optPct}%</span>
                      </div>
                    </td>
                    <td class="num">${lastAttended[player] ? formatDate(lastAttended[player]) : "—"}</td>
                  </tr>
                `;
              }).join("")
          }
        </tbody>
      </table>
      <div class="legend">
        <span class="leg leg-ok">100% · on track</span>
        <span class="leg leg-mid">50–99% · watchable</span>
        <span class="leg leg-low">Below 50% · needs check-in</span>
      </div>
    </div>
  ` : "";

  // ── Section: Attendance Distribution ───────────────────────────────────────
  const attendanceDistHtml = sections.attendanceDistribution ? (() => {
    const buckets: { label: string; color: string; textColor: string; count: number }[] = [
      { label: "100% attendance",   color: TIER_OK,  textColor: "#027a48", count: 0 },
      { label: "50–99% attendance", color: TIER_MID, textColor: "#b54708", count: 0 },
      { label: "< 50% attendance",  color: TIER_LOW, textColor: "#b42318", count: 0 },
    ];
    sorted.forEach((player) => {
      const pt = totals[player] ?? { practice: 0 };
      const pct = totalPracticePossible > 0 ? Math.round((pt.practice / totalPracticePossible) * 100) : 0;
      if (pct >= 100) buckets[0].count++;
      else if (pct >= 50) buckets[1].count++;
      else buckets[2].count++;
    });
    const barsHtml = sorted.map((player) => {
      const pt = totals[player] ?? { practice: 0 };
      const pct = totalPracticePossible > 0 ? Math.round((pt.practice / totalPracticePossible) * 100) : 0;
      const color = tierColor(pct);
      const textColor = tierTextColor(pct);
      return `
        <div class="dist-row">
          <div class="dist-name">${player}</div>
          <div class="dist-bar-wrap">
            <div class="dist-track"><div class="dist-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>
          </div>
          <div class="dist-pct" style="color:${textColor}">${pct}%</div>
        </div>`;
    }).join("");
    return `
      <div class="page">
        <div class="section-eyebrow">Attendance Distribution</div>
        <h2 class="section-title">Practice participation overview</h2>
        <p class="section-meta">${rangeLabel} · ${sorted.length} athlete${sorted.length !== 1 ? "s" : ""}</p>
        <div class="tier-grid">
          ${buckets.map((b) => `
            <div class="tier-card">
              <div class="tier-dot" style="background:${b.color}"></div>
              <div class="tier-count" style="color:${b.textColor}">${b.count}</div>
              <div class="tier-label">${b.label}</div>
            </div>`).join("")}
        </div>
        <div class="dist-list">${barsHtml}</div>
      </div>`;
  })() : "";

  // ── Section: Event Log ──────────────────────────────────────────────────────
  const eventLogHtml = sections.eventLog ? (() => {
    const grouped = groupEventsByWeek(events);
    if (grouped.size === 0) return "";
    const weeksHtml = Array.from(grouped.entries()).map(([week, evts]) => `
      <div class="week-group">
        <div class="week-label">Week of ${week}</div>
        ${evts.map((e) => `
          <div class="event-row">
            <div class="event-meta">
              <span class="event-type">${e.type}</span>
              <span class="event-date">${formatDate(e.date)}</span>
              <span class="event-dur">${e.duration}h</span>
            </div>
            <div class="event-players">${e.players.length} present: ${e.players.join(", ") || "—"}</div>
          </div>
        `).join("")}
      </div>
    `).join("");
    return `
      <div class="page">
        <div class="section-eyebrow">Event Log</div>
        <h2 class="section-title">Sessions grouped by week</h2>
        ${weeksHtml}
      </div>
    `;
  })() : "";

  // ── Section: Archived Events ────────────────────────────────────────────────
  const archivedHtml = sections.archivedEvents && archivedEventsBundles.length > 0 ? `
    <div class="page">
      <div class="section-eyebrow">Archived Events</div>
      <h2 class="section-title">Previously archived session history</h2>
      ${archivedEventsBundles.map((bundle) => `
        <div class="week-group">
          <div class="week-label">Archived ${formatDate(bundle.archivedAt, { month: "short", day: "numeric", year: "numeric" })} · ${bundle.events.length} event${bundle.events.length !== 1 ? "s" : ""}</div>
          ${bundle.events.map((e) => `
            <div class="event-row">
              <div class="event-meta">
                <span class="event-type">${e.type}</span>
                <span class="event-date">${formatDate(e.date)}</span>
                <span class="event-dur">${e.duration}h</span>
              </div>
              <div class="event-players">${e.players.length} present: ${e.players.join(", ") || "—"}</div>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  ` : "";

  // ── Section: Coach Notes ────────────────────────────────────────────────────
  const coachNotesHtml = sections.coachNotes ? `
    <div class="page notes-page">
      <div class="section-eyebrow">Coach Notes</div>
      <h2 class="section-title">Notes</h2>
      <div class="notes-lines">
        ${Array.from({ length: 18 }).map(() => `<div class="notes-line"></div>`).join("")}
      </div>
    </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${teamName} — Session Summary</title>
      <style>
        @media print {
          @page {
            size: ${pageSize} ${pageOrient};
            margin: 0.6in;
          }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: avoid; }
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          margin: 0; padding: 32px 40px 40px;
          color: #101828; font-size: 13px; line-height: 1.5;
        }
        .page { margin-bottom: 48px; }

        /* Cover */
        .cover-eyebrow {
          font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
          color: #475467; margin-bottom: 12px;
        }
        .cover-title {
          font-size: 36px; font-weight: 700; letter-spacing: -0.02em;
          color: #101828; margin: 0 0 10px; line-height: 1.05;
        }
        .cover-range {
          display: inline-block; font-size: 12px; color: #475467;
          border: 1px solid #d0d5dd; border-radius: 999px;
          padding: 4px 12px; margin-bottom: 24px; background: #f9fafb;
        }
        .kpi-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
          margin-bottom: 24px;
        }
        .kpi {
          border: 1px solid #e4e7ec; border-radius: 10px;
          padding: 14px 16px; background: #f9fafb;
        }
        .kpi-label {
          font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
          color: #667085;
        }
        .kpi-value {
          font-size: 32px; font-weight: 700; color: #101828; margin-top: 4px;
        }
        .cover-foot {
          display: flex; gap: 24px; font-size: 11px; color: #667085;
          border-top: 1px solid #eaecf0; padding-top: 12px; margin-top: 8px;
        }

        /* Section headers */
        .section-eyebrow {
          font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
          color: #475467; margin-bottom: 4px;
        }
        .section-title {
          font-size: 18px; font-weight: 700; color: #101828; margin: 0 0 4px;
        }
        .section-meta {
          font-size: 11px; color: #98a2b3; margin: 0 0 14px;
        }

        /* Table */
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th {
          text-align: left; padding: 8px 10px;
          font-size: 9.5px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: #475467;
          border-bottom: 1.5px solid #d0d5dd;
        }
        td {
          padding: 9px 10px; font-size: 12px; color: #1d2939;
          border-bottom: 1px solid #f2f4f7;
        }
        td.name { font-weight: 600; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        th.num { text-align: right; }
        td.empty { text-align: center; color: #98a2b3; }
        .bar-cell {
          display: flex; align-items: center; gap: 6px; min-width: 90px;
        }
        .bar-track {
          flex: 1; height: 5px; border-radius: 99px; background: #f2f4f7;
          overflow: hidden;
        }
        .bar-fill { height: 100%; border-radius: 99px; }
        .bar-cell span { font-size: 11px; font-weight: 700; min-width: 28px; text-align: right; }

        /* Legend */
        .legend {
          display: flex; gap: 16px; margin-top: 12px; font-size: 11px; color: #475467;
        }
        .leg::before { content: "■ "; }
        .leg-ok { color: #027a48; }
        .leg-mid { color: #b54708; }
        .leg-low { color: #b42318; }

        /* Event log */
        .week-group { margin-bottom: 20px; }
        .week-label {
          font-size: 10px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: #98a2b3;
          border-bottom: 1px solid #eaecf0; padding-bottom: 4px; margin-bottom: 6px;
        }
        .event-row {
          border: 1px solid #eaecf0; border-radius: 6px;
          padding: 7px 10px; margin-bottom: 5px;
        }
        .event-meta {
          display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: #101828;
          margin-bottom: 2px;
        }
        .event-type { color: #101828; }
        .event-date, .event-dur { color: #475467; font-weight: 400; }
        .event-players { font-size: 11px; color: #475467; }

        /* Notes */
        .notes-page .notes-lines { margin-top: 24px; }
        .notes-line {
          height: 32px; border-bottom: 1px solid #d0d5dd; margin-bottom: 0;
        }

        /* Attendance distribution */
        .tier-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;
        }
        .tier-card {
          border: 1px solid #e4e7ec; border-radius: 8px; padding: 12px 14px;
          background: #f9fafb; display: flex; flex-direction: column; gap: 4px;
        }
        .tier-dot {
          width: 10px; height: 10px; border-radius: 50%; margin-bottom: 2px;
        }
        .tier-count { font-size: 28px; font-weight: 700; line-height: 1; }
        .tier-label { font-size: 10px; color: #667085; }
        .dist-list { display: flex; flex-direction: column; gap: 5px; }
        .dist-row { display: flex; align-items: center; gap: 8px; }
        .dist-name {
          width: 100px; font-size: 11px; color: #344054; overflow: hidden;
          white-space: nowrap; text-overflow: ellipsis; flex-shrink: 0;
        }
        .dist-bar-wrap { flex: 1; }
        .dist-track { height: 6px; border-radius: 99px; background: #f2f4f7; overflow: hidden; }
        .dist-fill { height: 100%; border-radius: 99px; }
        .dist-pct { width: 32px; font-size: 11px; font-weight: 700; text-align: right; flex-shrink: 0; }

        /* Footer */
        .page::after {
          content: "${teamName} · Attendance & Training";
          display: block; margin-top: 32px; padding-top: 10px;
          border-top: 1px solid #eaecf0;
          font-size: 10px; color: #98a2b3;
        }
        .cover-page::after { display: none; }
      </style>
    </head>
    <body>
      ${coverHtml}
      ${playerTableHtml}
      ${attendanceDistHtml}
      ${eventLogHtml}
      ${archivedHtml}
      ${coachNotesHtml}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) {
    alert("Please allow pop-ups to generate the PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();

  // If the filename hint is set, update the popup title so "Save as PDF" picks it up
  win.document.title = filename;
}
