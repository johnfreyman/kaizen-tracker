import { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  Archive,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
  Info,
  Search,
  FileText,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts";
import { useTeamStore, EVENT_TYPES, type TeamEvent } from "../hooks/useTeamStore";
import { formatDate } from "@/lib/dates";
import { calculateTotals, percent } from "@/lib/stats";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import ExportPdfDrawer from "./ExportPdfDrawer";
import PlayerDetailDrawer from "./PlayerDetailDrawer";

type Trend = "up" | "down" | "stable";
type PlayerFilter = "all" | "active" | "attention";
type SortColumn =
  | "player"
  | "practice"
  | "practicePercent"
  | "optional"
  | "optPercent"
  | "lastAttended";
type SortDir = "asc" | "desc";
type DateRange = "7d" | "30d" | "season" | "custom";

const TIER_COLORS = {
  full: "#10b981",  // emerald-500
  mid:  "#f59e0b",  // amber-400
  low:  "#f87171",  // red-400
};

function tierColor(pct: number) {
  if (pct >= 100) return TIER_COLORS.full;
  if (pct >= 50)  return TIER_COLORS.mid;
  return TIER_COLORS.low;
}

// ── Trend helpers ────────────────────────────────────────────────────────────

function computeAttendanceTrend(events: TeamEvent[], rosterSize: number): Trend {
  const sorted = [...events]
    .filter((e) => e.type === EVENT_TYPES.PRACTICE)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sorted.length < 2) return "stable";
  const mid = Math.floor(sorted.length / 2);
  const avgFirst  = sorted.slice(0, mid).reduce((s, e) => s + e.players.length, 0) / mid;
  const avgSecond = sorted.slice(mid).reduce((s, e) => s + e.players.length, 0) / (sorted.length - mid);
  const threshold = Math.max(rosterSize * 0.05, 0.5);
  if (avgSecond - avgFirst > threshold) return "up";
  if (avgFirst - avgSecond > threshold) return "down";
  return "stable";
}

function computeHoursTrend(events: TeamEvent[]): Trend {
  const sorted = [...events]
    .filter((e) => e.type === EVENT_TYPES.PRACTICE)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sorted.length < 2) return "stable";
  const mid = Math.floor(sorted.length / 2);
  const avgFirst  = sorted.slice(0, mid).reduce((s, e) => s + e.duration, 0) / mid;
  const avgSecond = sorted.slice(mid).reduce((s, e) => s + e.duration, 0) / (sorted.length - mid);
  if (avgSecond - avgFirst > 0.1)  return "up";
  if (avgFirst - avgSecond > 0.1)  return "down";
  return "stable";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === "up")
    return (
      <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-semibold">
        <TrendingUp className="size-3.5" />↑
      </span>
    );
  if (trend === "down")
    return (
      <span className="flex items-center gap-0.5 text-red-400 text-xs font-semibold">
        <TrendingDown className="size-3.5" />↓
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-white/25 text-xs font-semibold">
      <Minus className="size-3.5" />→
    </span>
  );
}

// ── Practice Bar ─────────────────────────────────────────────────────────────

function PracticeBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const barColor =
    pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  const textColor =
    pct >= 100 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-30 ml-1 inline-block" />;
  return dir === "asc" ? (
    <ChevronUp className="size-3 text-purple-300 ml-1 inline-block" />
  ) : (
    <ChevronDown className="size-3 text-purple-300 ml-1 inline-block" />
  );
}

function ColTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center ml-1 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="size-3 text-white/20 hover:text-white/50 transition-colors" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[180px] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal leading-snug rounded-lg bg-[#1e2333] text-white/80 border border-white/[0.10] shadow-xl"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const DARK_TOOLTIP = {
  borderRadius: 10,
  fontSize: 12,
  backgroundColor: "#1e2333",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
};

// ── Skeleton loaders ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg bg-white/[0.06] animate-pulse ${className ?? ""}`} />
  );
}

function SummaryPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 border border-white/[0.08]"
            style={{ backgroundColor: "var(--mc-surface)" }}
          >
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
      <div
        className="rounded-2xl border border-white/[0.08] overflow-hidden"
        style={{ backgroundColor: "var(--mc-surface)" }}
      >
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ opacity: 1 - i * 0.15 }}>
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface SummaryPageProps {
  openExportPdf?: boolean;
  onExportPdfOpened?: () => void;
  onNavigate?: (page: string) => void;
}

export default function SummaryPage({ openExportPdf, onExportPdfOpened, onNavigate = () => {} }: SummaryPageProps = {}) {
  const { state, archiveEvents, isLoading } = useTeamStore();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (openExportPdf) {
      setShowExportDrawer(true);
      onExportPdfOpened?.();
    }
  }, [openExportPdf, onExportPdfOpened]);
  const [sortCol, setSortCol] = useState<SortColumn>("player");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dateRange, setDateRange] = useState<DateRange>("season");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("all");

  // ── Date filtering ─────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const now = new Date();
    if (dateRange === "7d") {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return state.events.filter((e) => new Date(e.date) >= cutoff);
    }
    if (dateRange === "30d") {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return state.events.filter((e) => new Date(e.date) >= cutoff);
    }
    if (dateRange === "custom" && customStart && customEnd) {
      const start = new Date(customStart);
      const end   = new Date(customEnd + "T23:59:59");
      return state.events.filter((e) => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });
    }
    return state.events;
  }, [state.events, dateRange, customStart, customEnd]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totals = calculateTotals(filteredEvents, state.roster);
  const totalPracticePossible = filteredEvents
    .filter((e) => e.type === EVENT_TYPES.PRACTICE)
    .reduce((sum, e) => sum + e.duration, 0);
  const totalTrainingPossible = filteredEvents
    .filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING)
    .reduce((sum, e) => sum + e.duration, 0);

  const attendanceTrend = computeAttendanceTrend(filteredEvents, state.roster.length);
  const hoursTrend      = computeHoursTrend(filteredEvents);

  const practiceEvents = filteredEvents.filter((e) => e.type === EVENT_TYPES.PRACTICE);
  const avgAttendanceRate =
    practiceEvents.length > 0 && state.roster.length > 0
      ? Math.round(
          (practiceEvents.reduce((sum, e) => sum + e.players.length, 0) /
            (practiceEvents.length * state.roster.length)) *
            100
        )
      : 0;

  // ── Last attended map ──────────────────────────────────────────────────────
  const lastAttended = useMemo(() => {
    const map: Record<string, string> = {};
    filteredEvents.forEach((event) => {
      event.players.forEach((player) => {
        if (!map[player] || event.date > map[player]) map[player] = event.date;
      });
    });
    return map;
  }, [filteredEvents]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const players = Object.keys(totals);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const pt_a = totals[a] ?? { practice: 0, training: 0 };
      const pt_b = totals[b] ?? { practice: 0, training: 0 };
      let diff = 0;
      switch (sortCol) {
        case "player":
          diff = a.localeCompare(b);
          break;
        case "practice":
          diff = pt_a.practice - pt_b.practice;
          break;
        case "practicePercent":
          diff =
            (totalPracticePossible > 0 ? pt_a.practice / totalPracticePossible : 0) -
            (totalPracticePossible > 0 ? pt_b.practice / totalPracticePossible : 0);
          break;
        case "optional":
          diff = pt_a.training - pt_b.training;
          break;
        case "optPercent":
          diff =
            (totalTrainingPossible > 0 ? pt_a.training / totalTrainingPossible : 0) -
            (totalTrainingPossible > 0 ? pt_b.training / totalTrainingPossible : 0);
          break;
        case "lastAttended": {
          const aDate = lastAttended[a] ?? "";
          const bDate = lastAttended[b] ?? "";
          diff = aDate.localeCompare(bDate);
          break;
        }
      }
      return sortDir === "asc" ? diff : -diff;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.join(","), sortCol, sortDir, totalPracticePossible, totalTrainingPossible, lastAttended]);

  // ── Player filter (search + chips) ────────────────────────────────────────
  const filteredPlayers = useMemo(() => {
    const today = new Date();
    const cutoffStr = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    return sortedPlayers.filter((player) => {
      if (playerSearch && !player.toLowerCase().includes(playerSearch.toLowerCase()))
        return false;
      if (playerFilter === "active") {
        const last = lastAttended[player];
        return !!last && last >= cutoffStr;
      }
      if (playerFilter === "attention") {
        const pt = totals[player] ?? { practice: 0 };
        const pct =
          totalPracticePossible > 0
            ? Math.round((pt.practice / totalPracticePossible) * 100)
            : 0;
        return pct < 80;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedPlayers, playerSearch, playerFilter, lastAttended, totalPracticePossible]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const barChartData = useMemo(() => {
    return players
      .map((player) => {
        const pt  = totals[player] ?? { practice: 0 };
        const pct = totalPracticePossible > 0
          ? Math.round((pt.practice / totalPracticePossible) * 100)
          : 0;
        return { player, pct };
      })
      .sort((a, b) => b.pct - a.pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.join(","), totalPracticePossible]);

  const donutData = useMemo(() => {
    const buckets = { full: 0, mid: 0, low: 0 };
    players.forEach((player) => {
      const pt  = totals[player] ?? { practice: 0 };
      const pct = totalPracticePossible > 0
        ? Math.round((pt.practice / totalPracticePossible) * 100)
        : 0;
      if (pct >= 100) buckets.full++;
      else if (pct >= 50) buckets.mid++;
      else buckets.low++;
    });
    return [
      { name: "100% attendance",  value: buckets.full, color: TIER_COLORS.full },
      { name: "50–99% attendance", value: buckets.mid,  color: TIER_COLORS.mid },
      { name: "<50% attendance",  value: buckets.low,  color: TIER_COLORS.low },
    ].filter((d) => d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.join(","), totalPracticePossible]);

  const barYAxisWidth = useMemo(() => {
    if (barChartData.length === 0) return 60;
    const maxLen = Math.max(...barChartData.map((d) => d.player.length));
    return Math.min(Math.max(maxLen * 7, 60), 140);
  }, [barChartData]);

  const barChartHeight = Math.max(200, barChartData.length * 32 + 40);

  // ── Averages row ───────────────────────────────────────────────────────────
  const playerCount   = sortedPlayers.length;
  const avgPracticeHours =
    playerCount > 0
      ? sortedPlayers.reduce((s, p) => s + (totals[p]?.practice ?? 0), 0) / playerCount
      : 0;
  const avgOptHours =
    playerCount > 0
      ? sortedPlayers.reduce((s, p) => s + (totals[p]?.training ?? 0), 0) / playerCount
      : 0;
  const _sortedDates      = Object.values(lastAttended).sort();
  const latestAttendanceDate =
    _sortedDates.length > 0 ? _sortedDates[_sortedDates.length - 1] : null;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function handleExport() {
    const header = [
      "Player",
      "Practice Hours",
      "Practice %",
      "Optional Hours",
      "Optional %",
      "Last Attended",
    ];
    const rows = sortedPlayers.map((player) => {
      const pt = totals[player] ?? { practice: 0, training: 0 };
      const practPct =
        totalPracticePossible > 0
          ? Math.round((pt.practice / totalPracticePossible) * 100)
          : 0;
      const optPct =
        totalTrainingPossible > 0
          ? Math.round((pt.training / totalTrainingPossible) * 100)
          : 0;
      return [
        player,
        pt.practice,
        `${practPct}%`,
        pt.training,
        `${optPct}%`,
        lastAttended[player] ? formatDate(lastAttended[player]) : "—",
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "participation-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleArchiveEvents = () => {
    if (state.events.length === 0) return;
    setShowArchiveConfirm(true);
  };

  // ── Column config ──────────────────────────────────────────────────────────
  const columns: { label: string; col: SortColumn; tooltip: string }[] = [
    { label: "Player", col: "player", tooltip: "Athlete name" },
    {
      label: "Practice Hrs",
      col: "practice",
      tooltip: "Total practice hours attended within the selected date range",
    },
    {
      label: "Practice %",
      col: "practicePercent",
      tooltip: "Percentage of total scheduled practice hours the athlete attended",
    },
    {
      label: "Optional",
      col: "optional",
      tooltip: "Hours attended in optional training sessions",
    },
    {
      label: "Opt %",
      col: "optPercent",
      tooltip: "Percentage of total optional training hours the athlete attended",
    },
    {
      label: "Last Attended",
      col: "lastAttended",
      tooltip: "Date of the athlete's most recent session attendance",
    },
  ];

  const DATE_RANGE_LABELS: Record<DateRange, string> = {
    "7d":    "Last 7 days",
    "30d":   "Last 30 days",
    season:  "This season",
    custom:  "Custom",
  };

  const showCharts = players.length > 0 && totalPracticePossible > 0;

  if (isLoading) return <SummaryPageSkeleton />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Team participation summary
          </h2>
          <p className="mt-1 text-white/40 text-sm">
            Review practice hours, optional training, and participation percentages.
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex flex-col gap-2 sm:items-end flex-shrink-0">
          <div
            className="flex rounded-xl border border-white/[0.08] overflow-hidden"
            style={{ backgroundColor: "var(--mc-surface)" }}
          >
            {(["7d", "30d", "season", "custom"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  dateRange === r
                    ? "bg-purple-600/30 text-purple-300 border-x border-purple-500/30"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                {DATE_RANGE_LABELS[r]}
              </button>
            ))}
          </div>

          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-white/70 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-purple-500/50"
              />
              <span className="text-white/25 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-white/70 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-purple-500/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="rounded-2xl p-5 border border-white/[0.08]"
          style={{ backgroundColor: "var(--mc-surface)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-purple-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Total Events
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <strong className="text-3xl font-bold text-white">
              {filteredEvents.length}
            </strong>
            <TrendBadge trend={attendanceTrend} />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 border border-white/[0.08]"
          style={{ backgroundColor: "var(--mc-surface)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-purple-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Practice Hours
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <strong className="text-3xl font-bold text-white">
              {totalPracticePossible.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
            </strong>
            <TrendBadge trend={hoursTrend} />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 border border-white/[0.08]"
          style={{ backgroundColor: "var(--mc-surface)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4 text-purple-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Avg Attendance
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <strong className="text-3xl font-bold text-white">
              {avgAttendanceRate}%
            </strong>
            <TrendBadge trend={attendanceTrend} />
          </div>
        </div>
      </div>

      {/* ── Attendance Overview Charts ──────────────────────────────────────── */}
      {showCharts && (
        <div
          className="rounded-2xl border border-white/[0.08] overflow-hidden"
          style={{ backgroundColor: "var(--mc-surface)" }}
        >
          <div className="px-5 py-4 border-b border-white/[0.08]">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest">
              Attendance Overview
            </h3>
          </div>

          <div className="p-5 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Left — donut chart + legend */}
            <div className="flex flex-col items-center gap-5 lg:w-52 flex-shrink-0 w-full">
              <div className="relative w-44 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      dataKey="value"
                      paddingAngle={donutData.length > 1 ? 3 : 0}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      contentStyle={DARK_TOOLTIP}
                      formatter={(value: number, name: string) => [
                        `${value} player${value !== 1 ? "s" : ""}`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white leading-none">
                    {avgAttendanceRate}%
                  </span>
                  <span className="text-[10px] text-white/35 uppercase tracking-wider mt-0.5">
                    avg
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2 w-full">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-xs text-white/50 truncate">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-white/70 tabular-nums flex-shrink-0">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px self-stretch bg-white/[0.06]" />
            <div className="lg:hidden w-full h-px bg-white/[0.06]" />

            {/* Right — horizontal bar chart */}
            <div className="flex-1 min-w-0 w-full">
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">
                Practice % by player
              </p>
              <ResponsiveContainer width="100%" height={barChartHeight}>
                <BarChart
                  data={barChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
                  barCategoryGap="25%"
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={6}
                  />
                  <YAxis
                    type="category"
                    dataKey="player"
                    width={barYAxisWidth}
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    contentStyle={DARK_TOOLTIP}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    formatter={(value: number) => [`${value}%`, "Practice attendance"]}
                  />
                  <Bar
                    dataKey="pct"
                    radius={[0, 4, 4, 0]}
                    background={{ fill: "rgba(255,255,255,0.03)", radius: 4 }}
                    label={{
                      position: "right",
                      fill: "rgba(255,255,255,0.35)",
                      fontSize: 11,
                      formatter: (v: number) => `${v}%`,
                    }}
                  >
                    {barChartData.map((entry, i) => (
                      <Cell key={i} fill={tierColor(entry.pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Player Totals Table */}
      <div
        className="rounded-2xl border border-white/[0.08] overflow-hidden"
        style={{ backgroundColor: "var(--mc-surface)" }}
      >
        <div className="px-5 py-4 border-b border-white/[0.08] space-y-3">
          {/* Row 1: title + action buttons */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest">
              Player Totals
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/35 hover:text-white/65 hover:bg-white/[0.06] border border-white/[0.08] transition-all"
              >
                <Download className="size-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => setShowExportDrawer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/35 hover:text-white/65 hover:bg-white/[0.06] border border-white/[0.08] transition-all"
              >
                <FileText className="size-3.5" />
                Export PDF
              </button>
              <button
                onClick={handleArchiveEvents}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/35 hover:text-white/65 hover:bg-white/[0.06] border border-white/[0.08] transition-all"
              >
                <Archive className="size-3.5" />
                Archive Events
              </button>
            </div>
          </div>

          {/* Row 2: search + filter chips + count */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/25 pointer-events-none" />
              <input
                type="text"
                placeholder="Search players…"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs text-white/70 placeholder-white/25 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-purple-500/50 w-36 sm:w-44"
              />
            </div>

            {/* Filter chips */}
            {(
              [
                { value: "all"       as PlayerFilter, label: "All"             },
                { value: "active"    as PlayerFilter, label: "Active"          },
                { value: "attention" as PlayerFilter, label: "Needs attention" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPlayerFilter(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  playerFilter === value
                    ? "bg-purple-600/30 text-purple-300 border-purple-500/30"
                    : "text-white/40 hover:text-white/60 border-white/[0.08] hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </button>
            ))}

            {/* Count */}
            <span className="ml-auto text-[11px] text-white/25 tabular-nums">
              {filteredPlayers.length === sortedPlayers.length
                ? `${sortedPlayers.length} player${sortedPlayers.length !== 1 ? "s" : ""}`
                : `Showing ${filteredPlayers.length} of ${sortedPlayers.length} players`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {columns.map(({ label, col, tooltip }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-purple-400/80 cursor-pointer select-none hover:text-purple-300 transition-colors whitespace-nowrap"
                  >
                    {label}
                    <SortIcon active={sortCol === col} dir={sortDir} />
                    <ColTooltip text={tooltip} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody key={`${sortCol}:${sortDir}:${playerSearch}:${playerFilter}`} className="animate-fade-in">
              {sortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2.5">
                      <Users className="size-8 text-white/10" />
                      <p className="text-white/50 text-sm font-medium">
                        {state.roster.length === 0 ? "No players added yet" : "No sessions logged yet"}
                      </p>
                      <p className="text-white/30 text-xs max-w-xs leading-relaxed">
                        {state.roster.length === 0
                          ? "Add players in Settings, then log a session to see participation data."
                          : "Start a session in Session Setup to begin tracking attendance."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2.5">
                      <Search className="size-8 text-white/10" />
                      <p className="text-white/50 text-sm font-medium">No players match your filters</p>
                      <p className="text-white/30 text-xs">
                        Try adjusting your search or filter selection.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, idx) => {
                  const playerTotals = totals[player] ?? { practice: 0, training: 0 };
                  return (
                    <tr
                      key={player}
                      onClick={() => setSelectedPlayer(player)}
                      className={`border-b border-white/[0.04] transition-colors cursor-pointer group ${
                        idx % 2 !== 0 ? "bg-white/[0.015]" : ""
                      } hover:bg-purple-500/[0.06]`}
                    >
                      <td className="px-5 py-3.5 font-semibold text-white/85 text-sm group-hover:text-white transition-colors">
                        {player}
                      </td>
                      <td className="px-5 py-3.5 text-white/55 text-sm tabular-nums">
                        {playerTotals.practice.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <PracticeBar
                          value={playerTotals.practice}
                          total={totalPracticePossible}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-white/55 text-sm tabular-nums">
                        {playerTotals.training.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-white/55 text-sm tabular-nums">
                        {percent(playerTotals.training, totalTrainingPossible)}
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-sm">
                        {lastAttended[player] ? formatDate(lastAttended[player]) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Averages footer row */}
            {sortedPlayers.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-white/[0.08] bg-white/[0.03]">
                  <td className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white/45">
                    Team Avg
                  </td>
                  <td className="px-5 py-3 text-white/40 text-sm tabular-nums">
                    {avgPracticeHours.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <PracticeBar value={avgPracticeHours} total={totalPracticePossible} />
                  </td>
                  <td className="px-5 py-3 text-white/40 text-sm tabular-nums">
                    {avgOptHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-5 py-3 text-white/40 text-sm tabular-nums">
                    {percent(avgOptHours, totalTrainingPossible)}
                  </td>
                  <td className="px-5 py-3 text-white/30 text-sm">
                    {latestAttendanceDate ? formatDate(latestAttendanceDate) : "—"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Export PDF Drawer */}
      <ExportPdfDrawer
        open={showExportDrawer}
        onClose={() => setShowExportDrawer(false)}
        teamName={state.teamName}
        teamLogo={state.teamLogo}
        events={filteredEvents}
        roster={state.roster}
        dateRange={dateRange}
        customStart={customStart}
        customEnd={customEnd}
        sortCol={sortCol}
        sortDir={sortDir}
        archivedEventsBundles={state.archivedEvents}
      />

      {/* Player Detail Drawer */}
      <PlayerDetailDrawer
        playerName={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onNavigate={onNavigate}
        filteredEvents={filteredEvents}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive logged events?</AlertDialogTitle>
            <AlertDialogDescription>
              Archive all logged events? You can restore them later from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isArchiving}
              onClick={async (e) => {
                e.preventDefault();
                setIsArchiving(true);
                try {
                  await archiveEvents();
                  setShowArchiveConfirm(false);
                } finally {
                  setIsArchiving(false);
                }
              }}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
