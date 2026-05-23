"use client";

import { useState, useEffect } from "react";
import { Download, X, FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { TeamEvent, ArchivedEventSet, EVENT_TYPES } from "@/app/hooks/useTeamStore";
import { calculateTotals } from "@/lib/stats";
import {
  exportPdf,
  ExportPdfSections,
  SortColumn,
  SortDir,
  DateRange,
} from "@/app/lib/exportPdf";

interface Props {
  open: boolean;
  onClose: () => void;
  teamName: string;
  teamLogo?: string;
  events: TeamEvent[];
  roster: string[];
  dateRange: DateRange;
  customStart?: string;
  customEnd?: string;
  sortCol: SortColumn;
  sortDir: SortDir;
  archivedEventsBundles?: ArchivedEventSet[];
  initialSections?: Partial<ExportPdfSections>;
}

const DEFAULT_SECTIONS: ExportPdfSections = {
  cover: true,
  playerTable: true,
  attendanceDistribution: true,
  eventLog: true,
  archivedEvents: false,
  coachNotes: false,
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function pageCount(sections: ExportPdfSections, hasArchives: boolean): number {
  let n = 0;
  if (sections.cover)                         n++;
  if (sections.playerTable)                   n++;
  if (sections.attendanceDistribution)        n++;
  if (sections.eventLog)                      n++;
  if (sections.archivedEvents && hasArchives) n++;
  if (sections.coachNotes)                    n++;
  return n;
}

export default function ExportPdfDrawer({
  open,
  onClose,
  teamName,
  teamLogo,
  events,
  roster,
  dateRange,
  customStart,
  customEnd,
  sortCol,
  sortDir,
  archivedEventsBundles = [],
  initialSections,
}: Props) {
  const [sections, setSections] = useState<ExportPdfSections>(DEFAULT_SECTIONS);
  const [paperSize, setPaperSize] = useState<"letter" | "a4" | "legal">("letter");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [filename, setFilename] = useState("");

  // Reset local state whenever the drawer opens
  useEffect(() => {
    if (open) {
      setSections({ ...DEFAULT_SECTIONS, ...initialSections });
      setPaperSize("letter");
      setOrientation("portrait");
      setFilename(`${slugify(teamName || "team")}-summary-${todayStr()}`);
    }
  // initialSections is intentionally excluded — it's only applied on open, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teamName]);

  // Derived preview stats
  const totals = calculateTotals(events, roster);
  const practiceEvents = events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
  const totalPracticePossible = practiceEvents.reduce((s, e) => s + e.duration, 0);
  const avgAttendance =
    practiceEvents.length > 0 && roster.length > 0
      ? Math.round(
          (practiceEvents.reduce((s, e) => s + e.players.length, 0) /
            (practiceEvents.length * roster.length)) * 100
        )
      : 0;

  const rangeLabel =
    dateRange === "7d"     ? "Last 7 days"  :
    dateRange === "30d"    ? "Last 30 days" :
    dateRange === "custom" ? "Custom range" :
    "This season";

  const pages = pageCount(sections, archivedEventsBundles.length > 0);
  const hasArchives = archivedEventsBundles.length > 0;

  function toggle(key: keyof ExportPdfSections) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  function handleDownload() {
    exportPdf({
      teamName,
      teamLogo,
      events,
      roster,
      dateRange,
      customStart,
      customEnd,
      sortCol,
      sortDir,
      sections,
      paperSize,
      orientation,
      filename: filename || `${slugify(teamName || "team")}-summary-${todayStr()}`,
      archivedEventsBundles,
    });
    onClose();
  }

  // Preview thumbnail — miniature snapshot of the cover page
  const topPlayers = Object.entries(totals)
    .map(([name, t]) => ({
      name,
      pct: totalPracticePossible > 0 ? Math.round((t.practice / totalPracticePossible) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  const sectionItems: { key: keyof ExportPdfSections; label: string; desc: string; pages: string; disabled?: boolean }[] = [
    {
      key: "cover",
      label: "Cover & KPI summary",
      desc: `${teamName || "Team"} · ${rangeLabel} · ${events.length} event${events.length !== 1 ? "s" : ""}`,
      pages: "p. 1",
    },
    {
      key: "playerTable",
      label: "Player totals table",
      desc: `${Object.keys(totals).length} players · sorted by ${sortCol}, ${sortDir}`,
      pages: "p. 2",
    },
    {
      key: "attendanceDistribution",
      label: "Attendance distribution",
      desc: "Donut chart + practice % bars by player",
      pages: "+1 p.",
    },
    {
      key: "eventLog",
      label: "Event log",
      desc: `${events.length} session${events.length !== 1 ? "s" : ""} grouped by week`,
      pages: "+1 p.",
    },
    {
      key: "archivedEvents",
      label: "Archived events",
      desc: hasArchives
        ? `${archivedEventsBundles.length} archive${archivedEventsBundles.length !== 1 ? "s" : ""}`
        : "No archives in this range",
      pages: "+p.",
      disabled: !hasArchives,
    },
    {
      key: "coachNotes",
      label: "Coach notes",
      desc: "Blank lined page for handwritten notes",
      pages: "+1 p.",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] flex flex-col gap-0 p-0 border-white/[0.08]"
        style={{ backgroundColor: "var(--mc-surface)", color: "var(--mc-text-1)" }}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-white/[0.08] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-semibold text-white">
                Export report as PDF
              </SheetTitle>
              <SheetDescription className="text-xs text-white/35 mt-0.5">
                {teamName || "Team"} · {rangeLabel} · {events.length} event{events.length !== 1 ? "s" : ""}
              </SheetDescription>
            </div>
            <button
              onClick={onClose}
              className="size-7 rounded-lg flex items-center justify-center text-white/35 hover:text-white/70 border border-white/[0.08] hover:bg-white/[0.06] transition-all shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* File settings */}
          <div className="px-6 py-5 border-b border-white/[0.04]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">File</p>
            <div className="mb-3">
              <label className="text-xs text-white/55 font-medium mb-1.5 block">Filename</label>
              <div className="flex items-center gap-0 rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs text-white/80 bg-transparent focus:outline-none font-mono"
                />
                <span className="px-3 py-2 text-xs text-white/25 font-mono border-l border-white/[0.06] shrink-0">.pdf</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/55 font-medium mb-1.5 block">Paper size</label>
                <div className="flex rounded-lg border border-white/[0.08] overflow-hidden bg-white/[0.02] h-9">
                  {(["letter", "a4", "legal"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPaperSize(s)}
                      className={`flex-1 text-xs font-semibold transition-all ${
                        paperSize === s
                          ? "bg-purple-600/20 text-purple-300"
                          : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      {s === "letter" ? "Letter" : s === "a4" ? "A4" : "Legal"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/55 font-medium mb-1.5 block">Orientation</label>
                <div className="flex rounded-lg border border-white/[0.08] overflow-hidden bg-white/[0.02] h-9">
                  {(["portrait", "landscape"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      className={`flex-1 text-xs font-semibold transition-all ${
                        orientation === o
                          ? "bg-purple-600/20 text-purple-300"
                          : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      {o === "portrait" ? "Portrait" : "Landscape"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="px-6 py-5 border-b border-white/[0.04]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Sections</p>
            <div className="space-y-2">
              {sectionItems.map(({ key, label, desc, pages, disabled }) => {
                const checked = sections[key] && !disabled;
                return (
                  <button
                    key={key}
                    disabled={disabled}
                    onClick={() => !disabled && toggle(key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                      disabled
                        ? "opacity-40 cursor-not-allowed border-white/[0.06] bg-transparent"
                        : checked
                        ? "border-blue-500/30 bg-blue-500/[0.07]"
                        : "border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className={`size-4 rounded flex items-center justify-center shrink-0 border ${
                      checked ? "bg-blue-500 border-blue-500" : "border-white/20"
                    }`}>
                      {checked && (
                        <svg className="size-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white/85">{label}</div>
                      <div className="text-xs text-white/35 truncate">{desc}</div>
                    </div>
                    <span className="text-[10px] text-white/25 font-mono shrink-0">{pages}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview thumbnail */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
              Preview · {pages} page{pages !== 1 ? "s" : ""}
            </p>
            <div
              className="rounded-lg p-4 text-[#1b1812]"
              style={{ background: "#f6f3ec", aspectRatio: "8.5/11", maxHeight: "280px", fontFamily: "sans-serif" }}
            >
              <div style={{ borderBottom: "1px solid #e7e0d0", paddingBottom: "6px", marginBottom: "8px" }}>
                <div style={{ fontFamily: "monospace", fontSize: "7px", letterSpacing: ".2em", textTransform: "uppercase", color: "#8a8472" }}>
                  {teamName} · {rangeLabel}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px" }}>Session Summary Report</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px", marginBottom: "8px" }}>
                {[
                  { k: "Events", v: events.length },
                  { k: "Practice", v: `${totalPracticePossible.toFixed(1)}h` },
                  { k: "Avg att.", v: `${avgAttendance}%` },
                ].map(({ k, v }) => (
                  <div key={k} style={{ background: "#fbf8f1", border: "1px solid #ece6d9", borderRadius: "4px", padding: "4px 6px" }}>
                    <div style={{ fontFamily: "monospace", fontSize: "6px", color: "#8a8472", textTransform: "uppercase", letterSpacing: ".1em" }}>{k}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "1px" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {topPlayers.map(({ name, pct }) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ fontSize: "7.5px", color: "#4b4639", width: "52px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {name.split(" ").map((n) => n[0]).join("")}. {name.split(" ").slice(-1)[0]}
                    </div>
                    <div style={{ flex: 1, height: "3px", background: "#f0ead9", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%", borderRadius: "99px",
                        background: pct >= 100 ? "#12b76a" : pct >= 50 ? "#f79009" : "#f04438",
                      }} />
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "7px", color: "#8a8472", width: "18px", textAlign: "right" }}>{pct}</div>
                  </div>
                ))}
                {topPlayers.length === 0 && (
                  <div style={{ fontSize: "8px", color: "#8a8472", textAlign: "center", paddingTop: "8px" }}>No player data</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] shrink-0 flex gap-3" style={{ backgroundColor: "var(--mc-elev, #11161f)" }}>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-white/40 border border-white/[0.08] hover:text-white/65 hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={pages === 0}
            className="flex-1 h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(180deg, #3b82f6, #2563eb)", boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 6px 16px -6px rgba(37,99,235,0.6)" }}
          >
            <Download className="size-4" />
            Download PDF
            <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded ml-1">⌘⌥P</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Named export so SummaryPage can import just the trigger icon
export { FileText as ExportPdfIcon };
