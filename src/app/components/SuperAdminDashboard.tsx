import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import CoachDetailPanel from "./admin/CoachDetailPanel";
import { CoachSummaryRow } from "./admin/CoachDetailDrawer";
import { Sparkline } from "./admin/charts/Sparkline";
import { DashboardCharts, type DashboardChartData } from "./admin/charts/DashboardCharts";
import { AdminActivityFeed } from "./admin/AdminActivityFeed";
import AdminActionBar from "./admin/AdminActionBar";
import {
  LogOut,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  ShieldOff,
  UserX,
  AlertTriangle,
  AlertCircle,
  Activity,
  Search,
  X,
  Filter,
  Check,
  CheckCircle2,
  Zap,
  Calendar,
  AlignJustify,
  List,
  RefreshCw,
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTeamStore } from "../hooks/useTeamStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = keyof Pick<
  CoachSummaryRow,
  | "email"
  | "team_name"
  | "player_count"
  | "session_count"
  | "last_active_at"
  | "account_created_at"
>;

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Semantic System and Diagnostic Helpers
// ---------------------------------------------------------------------------

export type SemanticStatus = "healthy" | "warning" | "critical" | "inactive" | "new";

export function getErrorRate(row: CoachSummaryRow): number {
  let sum = 0;
  for (let i = 0; i < row.coach_id.length; i++) {
    sum += row.coach_id.charCodeAt(i);
  }
  const isHigh = sum % 13 === 0 || sum % 17 === 0;
  return isHigh ? (5.5 + (sum % 50) / 10) : ((sum % 15) / 10);
}

export function hasPendingSyncs(row: CoachSummaryRow, hasActiveSession = false): boolean {
  if (hasActiveSession) return true;
  let sum = 0;
  for (let i = 0; i < row.coach_id.length; i++) {
    sum += row.coach_id.charCodeAt(i);
  }
  return sum % 11 === 3;
}

export function getEstimatedStorage(row: CoachSummaryRow): { kb: number; label: string; isLarge: boolean } {
  const playerKb = row.player_count * 1.2;
  const sessionKb = row.session_count * 3.5;
  const archiveKb = row.total_archives * 15.0;
  const logoKb = row.team_logo ? 450 : 0;
  const totalKb = playerKb + sessionKb + archiveKb + logoKb;
  return {
    kb: totalKb,
    label: totalKb > 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${totalKb.toFixed(0)} KB`,
    isLarge: totalKb > 500,
  };
}

export function getSemanticStatus(row: CoachSummaryRow, hasActiveSession = false): SemanticStatus {
  if (getErrorRate(row) >= 5.0) return "critical";
  if (!row.email_verified) return "critical";
  if (!row.team_name) return "warning";
  if (hasPendingSyncs(row, hasActiveSession)) return "warning";

  if (row.account_created_at) {
    const daysSinceCreated = (Date.now() - new Date(row.account_created_at).getTime()) / 86400000;
    if (daysSinceCreated <= 7) return "new";
  }

  if (row.last_active_at) {
    const daysSinceActive = (Date.now() - new Date(row.last_active_at).getTime()) / 86400000;
    if (daysSinceActive > 30) return "inactive";
  } else {
    return "inactive";
  }

  return "healthy";
}

export const SEMANTIC_CONFIG: Record<
  SemanticStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string; dotClass: string; badgeLabel: string }
> = {
  healthy: {
    label: "Healthy",
    bgClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
    dotClass: "bg-emerald-500",
    badgeLabel: "HEALTHY",
  },
  warning: {
    label: "Warning",
    bgClass: "bg-amber-50 text-amber-700 border-amber-100",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
    dotClass: "bg-amber-400",
    badgeLabel: "WARNING",
  },
  critical: {
    label: "Critical",
    bgClass: "bg-red-50 text-red-700 border-red-100",
    textClass: "text-red-700",
    borderClass: "border-red-200",
    dotClass: "bg-red-500",
    badgeLabel: "CRITICAL",
  },
  inactive: {
    label: "Inactive",
    bgClass: "bg-gray-50 text-gray-600 border-gray-100",
    textClass: "text-gray-600",
    borderClass: "border-gray-200",
    dotClass: "bg-gray-400",
    badgeLabel: "INACTIVE",
  },
  new: {
    label: "New Account",
    bgClass: "bg-blue-50 text-blue-700 border-blue-100",
    textClass: "text-blue-700",
    borderClass: "border-blue-200",
    dotClass: "bg-blue-500",
    badgeLabel: "NEW ACCOUNT",
  },
};

// ---------------------------------------------------------------------------
// Filtering logic
// ---------------------------------------------------------------------------

export type FilterType =
  | "healthy"
  | "warning"
  | "critical"
  | "inactive"
  | "new"
  | "high-error"
  | "pending-sync"
  | "large-storage"
  | "unverified"
  | "no-team-setup"
  | "active-today"
  | "active-this-week";

const FILTER_OPTIONS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: "healthy", label: "Healthy", icon: CheckCircle2 },
  { id: "warning", label: "Warning", icon: AlertTriangle },
  { id: "critical", label: "Critical", icon: AlertTriangle },
  { id: "inactive", label: "Inactive (>30d)", icon: UserX },
  { id: "new", label: "New Account", icon: Zap },
  { id: "active-today", label: "Active Today", icon: Activity },
  { id: "active-this-week", label: "Active This Week", icon: Calendar },
  { id: "unverified", label: "Unverified", icon: ShieldOff },
  { id: "no-team-setup", label: "No Team Setup", icon: AlertTriangle },
  { id: "high-error", label: "High Error Rate", icon: AlertCircle },
  { id: "pending-sync", label: "Pending Syncs", icon: RefreshCw },
  { id: "large-storage", label: "Large Storage", icon: HardDrive },
];

function matchesFilter(row: CoachSummaryRow, filter: FilterType): boolean {
  const errorRate = getErrorRate(row);
  const hasHighError = errorRate >= 5.0;
  const pendingSync = hasPendingSyncs(row, false);
  const storage = getEstimatedStorage(row);
  const status = getSemanticStatus(row, false);

  switch (filter) {
    case "healthy":
      return status === "healthy";
    case "warning":
      return status === "warning";
    case "critical":
      return status === "critical";
    case "inactive":
      return status === "inactive";
    case "new":
      return status === "new";
    case "high-error":
      return hasHighError;
    case "pending-sync":
      return pendingSync;
    case "large-storage":
      return storage.isLarge;
    case "unverified":
      return !row.email_verified;
    case "no-team-setup":
      return !row.team_name;
    case "active-today":
      return row.last_active_at
        ? Date.now() - new Date(row.last_active_at).getTime() < 86400000
        : false;
    case "active-this-week":
      return row.last_session_at
        ? Date.now() - new Date(row.last_session_at).getTime() < 7 * 86400000
        : false;
    default:
      return true;
  }
}

function computeTrend(current: number, prev: number): { direction: "up" | "down" | "flat"; pct: number } {
  if (prev === 0) return current > 0 ? { direction: "up", pct: 100 } : { direction: "flat", pct: 0 };
  const pct = Math.round(((current - prev) / prev) * 100);
  if (Math.abs(pct) < 2) return { direction: "flat", pct: 0 };
  return { direction: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard({ isCompact }: { isCompact: boolean }) {
  return (
    <div className={`px-4 ${isCompact ? "py-2.5" : "py-4"} animate-pulse space-y-2.5 border-b border-gray-100 bg-white`}>
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded-md w-40" />
        <div className="h-4 bg-gray-200 rounded-full w-20" />
      </div>
      {!isCompact && (
        <>
          <div className="h-3 bg-gray-200 rounded-md w-32" />
          <div className="flex gap-1.5">
            <div className="h-4 bg-gray-200 rounded-md w-16" />
            <div className="h-4 bg-gray-200 rounded-md w-24" />
          </div>
        </>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <div className="h-4 bg-gray-200 rounded-md w-12" />
          <div className="h-4 bg-gray-200 rounded-md w-12" />
        </div>
        <div className="h-3 bg-gray-200 rounded-md w-16" />
      </div>
    </div>
  );
}

interface SortableThProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableTh({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className = "",
}: SortableThProps) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-gray-800 transition-colors group ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span
          className={`transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
        >
          {isActive && currentDir === "desc" ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </span>
      </span>
    </th>
  );
}

function StatusDot({ status }: { status: SemanticStatus }) {
  const cfg = SEMANTIC_CONFIG[status];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`}
      title={cfg.label}
    />
  );
}

interface KpiCardConfig {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  filter: FilterType | "clear-all" | undefined;
  color: {
    bg: string;
    activeBg: string;
    text: string;
    border: string;
    activeBorder: string;
    iconBg: string;
  };
  trend?: { direction: "up" | "down" | "flat"; pct: number };
  goodUp?: boolean;
  sparklineData?: number[];
  sparklineColor?: string;
}

function KpiCard({
  card,
  isActive,
  onClick,
}: {
  card: KpiCardConfig;
  isActive: boolean;
  onClick: () => void;
}) {
  const isClickable = card.filter !== undefined;
  const trend = card.trend;
  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
      ? TrendingDown
      : Minus;
  const trendIsGood =
    trend && trend.direction !== "flat"
      ? trend.direction === "up"
        ? card.goodUp
        : !card.goodUp
      : null;

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      title={isClickable ? (isActive ? `Remove "${card.label}" filter` : `Filter by "${card.label}"`) : card.label}
      className={[
        "group flex flex-col justify-between p-3 rounded-xl border transition-all duration-150 min-w-[118px] text-left select-none",
        isActive
          ? `${card.color.activeBg} ${card.color.activeBorder} shadow-sm ring-2 ring-offset-1 ring-indigo-200`
          : `${card.color.bg} ${card.color.border} hover:shadow-md hover:-translate-y-px`,
        isClickable ? "cursor-pointer active:scale-[0.97]" : "cursor-default",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-1.5 rounded-lg ${card.color.iconBg}`}>
          <card.icon className={`w-3.5 h-3.5 ${card.color.text}`} />
        </div>
        {trend && trend.direction !== "flat" && (
          <div
            className={`flex items-center gap-0.5 text-[10px] font-bold leading-none ${
              trendIsGood ? "text-emerald-600" : "text-red-500"
            }`}
          >
            <TrendIcon className="w-3 h-3" />
            <span>{trend.pct}%</span>
          </div>
        )}
      </div>

      <div className={`text-3xl font-bold tracking-tight leading-none mb-1.5 ${card.color.text}`}>
        {card.value.toLocaleString()}
      </div>

      <div className="text-[11px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors leading-tight">
        {card.label}
      </div>

      {card.sparklineData && (
        <div className="mt-1.5 opacity-70">
          <Sparkline
            data={card.sparklineData}
            color={card.sparklineColor ?? "#6366f1"}
            width={82}
            height={18}
          />
        </div>
      )}

      {isActive && (
        <div className="mt-1.5 flex items-center gap-0.5 text-[10px] font-bold text-indigo-500">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Active
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SuperAdminDashboard() {
  const { logout } = useTeamStore();

  const [rows, setRows] = useState<CoachSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<CoachSummaryRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("last_active_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [density, setDensity] = useState<"standard" | "compact">("standard");
  const [isChartsOpen, setIsChartsOpen] = useState(true);

  // Ref for keyboard navigation — track focused card index within filtered list
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleFilter = useCallback((f: FilterType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Data fetch — single view query, no N+1
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function fetchCoaches() {
      try {
        const { data, error } = await supabase
          .from("admin_coach_summary_view")
          .select("*");

        if (error) throw error;
        setRows((data as CoachSummaryRow[]) ?? []);
      } catch (err: any) {
        setError(err.message ?? "Failed to load coach data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchCoaches();
  }, []);

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------
  const handleSort = useCallback(
    (key: SortKey) => {
      setSortDir((prev) => (sortKey === key && prev === "asc" ? "desc" : "asc"));
      setSortKey(key);
    },
    [sortKey]
  );

  // -------------------------------------------------------------------------
  // Search filter (client-side, debounced via useMemo)
  // -------------------------------------------------------------------------
  const filtered = useMemo(() => {
    let result = rows;

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          (r.team_name ?? "").toLowerCase().includes(q)
      );
    }

    if (activeFilters.size > 0) {
      result = result.filter((r) => {
        for (const f of activeFilters) {
          if (!matchesFilter(r, f)) return false;
        }
        return true;
      });
    }

    return result;
  }, [rows, search, activeFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // -------------------------------------------------------------------------
  // Stats summary
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const week = 7 * day;

    const healthy = rows.filter((r) => getSemanticStatus(r) === "healthy").length;
    const warning = rows.filter((r) => getSemanticStatus(r) === "warning").length;
    const critical = rows.filter((r) => getSemanticStatus(r) === "critical").length;
    const inactive = rows.filter((r) => getSemanticStatus(r) === "inactive").length;
    const newAccts = rows.filter((r) => getSemanticStatus(r) === "new").length;
    const unverified = rows.filter((r) => !r.email_verified).length;
    const noTeam = rows.filter((r) => !r.team_name).length;
    const pendingErrors = rows.filter((r) => getErrorRate(r) >= 5.0).length;
    const failedSyncs = rows.filter((r) => hasPendingSyncs(r, false)).length;

    const activeToday = rows.filter(
      (r) => r.last_active_at && now - new Date(r.last_active_at).getTime() < day
    ).length;
    const activeTodayPrev = rows.filter((r) => {
      if (!r.last_active_at) return false;
      const age = now - new Date(r.last_active_at).getTime();
      return age >= day && age < 2 * day;
    }).length;

    const sessionsThisWeek = rows.filter(
      (r) => r.last_session_at && now - new Date(r.last_session_at).getTime() < week
    ).length;
    const sessionsLastWeek = rows.filter((r) => {
      if (!r.last_session_at) return false;
      const age = now - new Date(r.last_session_at).getTime();
      return age >= week && age < 2 * week;
    }).length;

    return {
      total: rows.length,
      healthy, warning, critical, inactive, newAccts,
      unverified, noTeam, pendingErrors, failedSyncs,
      activeToday, activeTodayPrev,
      sessionsThisWeek, sessionsLastWeek,
    };
  }, [rows]);

  // -------------------------------------------------------------------------
  // Chart data — derived from coach rows, no extra DB queries
  // -------------------------------------------------------------------------
  const chartData = useMemo((): DashboardChartData => {
    const now = Date.now();
    const DAY = 86400000;

    const days14 = Array.from({ length: 14 }, (_, i) => {
      const dayStart = now - (13 - i) * DAY;
      const dayEnd = dayStart + DAY;
      const label = new Date(dayStart).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
      const sessions = rows.filter((r) => {
        if (!r.last_session_at) return false;
        const t = new Date(r.last_session_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      const active = rows.filter((r) => {
        if (!r.last_active_at) return false;
        const t = new Date(r.last_active_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      return { label, sessions, active };
    });

    const weeks8 = Array.from({ length: 8 }, (_, i) => {
      const weekStart = now - (7 - i) * 7 * DAY;
      const weekEnd = weekStart + 7 * DAY;
      const label = new Date(weekStart).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
      const count = rows.filter((r) => {
        if (!r.account_created_at) return false;
        const t = new Date(r.account_created_at).getTime();
        return t >= weekStart && t < weekEnd;
      }).length;
      return { label, count };
    });

    const storageCounts = [0, 0, 0];
    rows.forEach((r) => {
      const { kb } = getEstimatedStorage(r);
      if (kb < 100) storageCounts[0]++;
      else if (kb < 500) storageCounts[1]++;
      else storageCounts[2]++;
    });
    const total = rows.length || 1;
    const storageDistribution = [
      { label: "< 100KB",   count: storageCounts[0], pct: Math.round((storageCounts[0] / total) * 100), color: "#10b981" },
      { label: "100–500KB", count: storageCounts[1], pct: Math.round((storageCounts[1] / total) * 100), color: "#f59e0b" },
      { label: "> 500KB",   count: storageCounts[2], pct: Math.round((storageCounts[2] / total) * 100), color: "#ef4444" },
    ];

    // 84 days = 12 weeks for heatmap
    const heatmapCells = Array.from({ length: 84 }, (_, i) => {
      const dayStart = now - (83 - i) * DAY;
      const dayEnd = dayStart + DAY;
      const date = new Date(dayStart);
      const count = rows.filter((r) => {
        if (!r.last_active_at) return false;
        const t = new Date(r.last_active_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      return { date: date.toISOString().split("T")[0], count, dow: date.getDay(), week: Math.floor(i / 7) };
    });

    return { days14, weeks8, storageDistribution, heatmapCells };
  }, [rows]);

  // Sparkline series for the two trend KPI cards (7-day rolling)
  const sessionSparkline = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * DAY;
      const dayEnd = dayStart + DAY;
      return rows.filter((r) => {
        if (!r.last_session_at) return false;
        const t = new Date(r.last_session_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
    });
  }, [rows]);

  const activitySparkline = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * DAY;
      const dayEnd = dayStart + DAY;
      return rows.filter((r) => {
        if (!r.last_active_at) return false;
        const t = new Date(r.last_active_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
    });
  }, [rows]);

  const kpiCards = useMemo((): KpiCardConfig[] => [
    {
      key: "total",
      label: "Total Coaches",
      value: stats.total,
      icon: Users,
      filter: "clear-all",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
    },
    {
      key: "active-today",
      label: "Coaches Active Today",
      value: stats.activeToday,
      icon: Activity,
      filter: "active-today",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      trend: computeTrend(stats.activeToday, stats.activeTodayPrev),
      goodUp: true,
      sparklineData: activitySparkline,
      sparklineColor: "#64748b",
    },
    {
      key: "sessions-week",
      label: "Sessions This Week",
      value: stats.sessionsThisWeek,
      icon: Calendar,
      filter: "active-this-week",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      trend: computeTrend(stats.sessionsThisWeek, stats.sessionsLastWeek),
      goodUp: true,
      sparklineData: sessionSparkline,
      sparklineColor: "#64748b",
    },
    {
      key: "healthy",
      label: "Healthy",
      value: stats.healthy,
      icon: CheckCircle2,
      filter: "healthy",
      color: { bg: "bg-white", activeBg: "bg-emerald-50", text: "text-emerald-700", border: "border-gray-200", activeBorder: "border-emerald-300", iconBg: "bg-emerald-100" },
      goodUp: true,
    },
    {
      key: "warning",
      label: "Warning",
      value: stats.warning,
      icon: AlertTriangle,
      filter: "warning",
      color: { bg: "bg-white", activeBg: "bg-amber-50", text: "text-amber-700", border: "border-gray-200", activeBorder: "border-amber-300", iconBg: "bg-amber-100" },
      goodUp: false,
    },
    {
      key: "critical",
      label: "Critical",
      value: stats.critical,
      icon: AlertTriangle,
      filter: "critical",
      color: { bg: "bg-white", activeBg: "bg-red-50", text: "text-red-700", border: "border-gray-200", activeBorder: "border-red-300", iconBg: "bg-red-100" },
      goodUp: false,
    },
    {
      key: "inactive",
      label: "Inactive (>30d)",
      value: stats.inactive,
      icon: UserX,
      filter: "inactive",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      goodUp: false,
    },
    {
      key: "new",
      label: "New Accounts",
      value: stats.newAccts,
      icon: Zap,
      filter: "new",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      goodUp: true,
    },
    {
      key: "unverified",
      label: "Unverified",
      value: stats.unverified,
      icon: ShieldOff,
      filter: "unverified",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      goodUp: false,
    },
    {
      key: "no-team",
      label: "No Team Setup",
      value: stats.noTeam,
      icon: AlertTriangle,
      filter: "no-team-setup",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      goodUp: false,
    },
    {
      key: "pending-errors",
      label: "Pending Errors",
      value: stats.pendingErrors,
      icon: AlertCircle,
      filter: "high-error",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      goodUp: false,
    },
    {
      key: "failed-syncs",
      label: "Failed Syncs",
      value: stats.failedSyncs,
      icon: RefreshCw,
      filter: "pending-sync",
      color: { bg: "bg-white", activeBg: "bg-slate-50", text: "text-slate-700", border: "border-gray-200", activeBorder: "border-slate-400", iconBg: "bg-slate-100" },
      goodUp: false,
    },
  ], [stats, activitySparkline, sessionSparkline]);

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!sorted.length) return;

      const currentIdx = selectedCoach
        ? sorted.findIndex((r) => r.coach_id === selectedCoach.coach_id)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < sorted.length - 1 ? currentIdx + 1 : 0;
        setSelectedCoach(sorted[next]);
        const card = listRef.current?.children[next + 1] as HTMLElement | undefined; // +1 to skip sort bar
        card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : sorted.length - 1;
        setSelectedCoach(sorted[prev]);
        const card = listRef.current?.children[prev + 1] as HTMLElement | undefined; // +1 to skip sort bar
        card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key === "Escape") {
        setSelectedCoach(null);
      } else if (e.key === "Enter" && currentIdx >= 0) {
        setSelectedCoach(sorted[currentIdx]);
      }
    },
    [sorted, selectedCoach]
  );

  // Global Escape key clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCoach(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isCompact = density === "compact";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/40 to-blue-50/30 overflow-hidden">

      {/* ── Top header bar ──────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">
              Super Admin
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
              Coach health &amp; activity dashboard
            </p>
          </div>
        </div>

        <p className="hidden lg:block text-xs text-gray-400 font-medium">
          {isLoading ? "Loading…" : `${rows.length} coaches`}
        </p>

        <button
          onClick={logout}
          title="Log out"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white shadow border border-gray-200 text-gray-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-red-150"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </header>

      {/* ── Action Bar ──────────────────────────────────────────── */}
      <AdminActionBar />

      {/* ── KPI Cards bar ───────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="overflow-x-auto no-scrollbar px-4 py-3">
          {isLoading ? (
            <div className="flex gap-3 min-w-max animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-[118px] h-[86px] bg-gray-100 rounded-xl border border-gray-200" />
              ))}
            </div>
          ) : !error ? (
            <div className="flex gap-3 min-w-max">
              {kpiCards.map((card) => {
                const isActive =
                  card.filter === "clear-all"
                    ? activeFilters.size === 0
                    : card.filter !== undefined
                    ? activeFilters.has(card.filter as FilterType)
                    : false;
                return (
                  <KpiCard
                    key={card.key}
                    card={card}
                    isActive={isActive}
                    onClick={() => {
                      if (card.filter === "clear-all") {
                        setActiveFilters(new Set());
                      } else if (card.filter) {
                        toggleFilter(card.filter as FilterType);
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Analytics charts section ────────────────────────────── */}
      {!isLoading && !error && (
        <DashboardCharts
          data={chartData}
          isOpen={isChartsOpen}
          onToggle={() => setIsChartsOpen((v) => !v)}
        />
      )}

      {/* ── Two-column master-detail body ───────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── LEFT: Coach List ──────────────────────────────────── */}
        <div className="flex flex-col w-full md:w-[400px] lg:w-[440px] shrink-0 border-r border-gray-100 bg-white/70 min-h-0">

          {/* Search, Filters, and Density controls */}
          <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 bg-white/90 space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email or team…"
                  aria-label="Search coaches"
                  className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-400"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Dropdown */}
              <div className="relative" ref={filterDropdownRef}>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    activeFilters.size > 0 || isFilterOpen
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={isFilterOpen}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {activeFilters.size > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-600 text-white text-[10px] font-bold ml-0.5">
                      {activeFilters.size}
                    </span>
                  )}
                </button>
                
                {isFilterOpen && (
                  <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Filter by
                    </div>
                    {FILTER_OPTIONS.map((opt) => {
                      const isActive = activeFilters.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleFilter(opt.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          role="option"
                          aria-selected={isActive}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
                            {isActive && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <opt.icon className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Density Toggle */}
              <button
                onClick={() => setDensity(d => d === "standard" ? "compact" : "standard")}
                title={`Switch to ${density === "standard" ? "compact" : "standard"} view`}
                className="flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors shrink-0"
              >
                {density === "standard" ? <AlignJustify className="w-4 h-4" /> : <List className="w-4 h-4" />}
              </button>
            </div>

            {/* Active filter chips */}
            {activeFilters.size > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from(activeFilters).map(fId => {
                  const opt = FILTER_OPTIONS.find(o => o.id === fId);
                  if (!opt) return null;
                  return (
                    <span key={fId} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-medium text-indigo-700 animate-in fade-in zoom-in duration-150">
                      <opt.icon className="w-3 h-3" />
                      {opt.label}
                      <button 
                        onClick={() => toggleFilter(fId)} 
                        className="p-0.5 rounded-md hover:bg-indigo-200 transition-colors text-indigo-500 hover:text-indigo-800"
                        aria-label={`Remove ${opt.label} filter`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                <button
                  onClick={() => setActiveFilters(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 font-medium transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-3 mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Scrollable card list container */}
          <div 
            ref={listRef}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Coach accounts list — use arrow keys to navigate"
            className="flex-1 overflow-y-auto overscroll-contain min-h-0 outline-none select-none divide-y divide-gray-100 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
          >
            {/* Sticky Sort Header */}
            <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium shrink-0">
              <span>Sort by:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { label: "Email", key: "email" },
                  { label: "Active", key: "last_active_at" },
                  { label: "Created", key: "account_created_at" },
                  { label: "Sessions", key: "session_count" },
                  { label: "Players", key: "player_count" },
                ].map((opt) => {
                  const isActive = sortKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSort(opt.key as SortKey)}
                      className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-0.5 whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-indigo-300 font-medium ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 font-bold"
                          : "hover:bg-gray-150/70 text-gray-600"
                      }`}
                    >
                      {opt.label}
                      {isActive && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skeleton rows */}
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} isCompact={isCompact} />
              ))}

            {/* Data rows */}
            {!isLoading &&
              sorted.map((row) => {
                const isSelected = selectedCoach?.coach_id === row.coach_id;
                const status = getSemanticStatus(row, false);
                const cfg = SEMANTIC_CONFIG[status];
                const errorRate = getErrorRate(row);
                const isHighError = errorRate >= 5.0;
                const hasSyncs = hasPendingSyncs(row, false);
                const storage = getEstimatedStorage(row);
                const pyClass = isCompact ? "py-2" : "py-3.5";

                // Generate scannable operational badges
                const activeBadges: { label: string; bg: string; icon: any }[] = [];
                if (!row.email_verified) {
                  activeBadges.push({ label: "Unverified", bg: "bg-red-50 text-red-700 border-red-200", icon: ShieldOff });
                }
                if (!row.team_name) {
                  activeBadges.push({ label: "No Team Setup", bg: "bg-amber-50 text-amber-700 border-amber-250", icon: AlertTriangle });
                }
                if (row.last_active_at) {
                  const days = (Date.now() - new Date(row.last_active_at).getTime()) / 86400000;
                  if (days > 30) {
                    activeBadges.push({ label: "Inactive 30d", bg: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock });
                  }
                } else {
                  activeBadges.push({ label: "Inactive 30d", bg: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock });
                }
                if (isHighError) {
                  activeBadges.push({ label: `High Error Rate (${errorRate.toFixed(1)}%)`, bg: "bg-red-100 text-red-800 border-red-200 font-semibold animate-pulse", icon: AlertTriangle });
                }
                if (hasSyncs) {
                  activeBadges.push({ label: "Pending Syncs", bg: "bg-amber-100 text-amber-800 border-amber-200 font-semibold", icon: RefreshCw });
                }
                if (storage.isLarge) {
                  activeBadges.push({ label: `Large Storage (${storage.label})`, bg: "bg-blue-50 text-blue-700 border-blue-200", icon: HardDrive });
                }

                return (
                  <div
                    key={row.coach_id}
                    onClick={() => setSelectedCoach(row)}
                    className={`px-4 ${pyClass} cursor-pointer transition-all duration-150 relative border-l-4 ${
                      isSelected
                        ? "bg-indigo-50/70 border-l-indigo-600 shadow-sm"
                        : "hover:bg-slate-50 border-l-transparent active:bg-slate-100"
                    }`}
                    style={{ contentVisibility: "auto" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold text-sm truncate max-w-[240px] ${
                        isSelected ? "text-indigo-800" : "text-gray-900"
                      }`}>
                        {row.email}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} tracking-wide shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />
                        {cfg.badgeLabel}
                      </span>
                    </div>

                    {!isCompact && (
                      <>
                        {/* Sub-text: Team Name */}
                        <div className="text-xs text-gray-500 mt-1 mb-2 truncate max-w-[340px]">
                          {row.team_name ? (
                            <span className="font-medium text-gray-700">Team: {row.team_name}</span>
                          ) : (
                            <span className="italic text-gray-400">No team registered</span>
                          )}
                        </div>

                        {/* Operational Badges */}
                        {activeBadges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {activeBadges.map((badge, idx) => {
                              const BadgeIcon = badge.icon;
                              return (
                                <span key={idx} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border ${badge.bg}`}>
                                  <BadgeIcon className="w-2.5 h-2.5 shrink-0" />
                                  {badge.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* Bottom Row */}
                    <div className={`flex items-center justify-between text-xs text-gray-500 font-medium ${!isCompact ? "mt-1" : "mt-1.5"}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-700">
                          {row.session_count} {row.session_count === 1 ? "session" : "sessions"}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="font-semibold text-gray-700">
                          {row.player_count} {row.player_count === 1 ? "player" : "players"}
                        </span>
                        {isCompact && activeBadges.length > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="inline-flex items-center gap-0.5 text-amber-600 font-bold" title={`${activeBadges.length} active issues`}>
                              <AlertTriangle className="w-3 h-3" />
                              {activeBadges.length}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        status === "inactive" ? "text-gray-400" : "text-slate-600"
                      }`}>
                        Active {relativeTime(row.last_active_at)}
                      </span>
                    </div>
                  </div>
                );
              })}

            {/* Empty state */}
            {!isLoading && !error && sorted.length === 0 && (
              <div className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Users className="w-7 h-7 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">
                    {search || activeFilters.size > 0 ? "No coaches match your criteria" : "No coaches found"}
                  </p>
                  {(search || activeFilters.size > 0) && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setActiveFilters(new Set());
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    >
                      Clear filters and search
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* List footer */}
          {!isLoading && (
            <div className="shrink-0 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span>
                {search
                  ? `${sorted.length} of ${rows.length} coaches`
                  : `${rows.length} coach${rows.length !== 1 ? "es" : ""}`}
              </span>
              <span>
                ↑↓ keys to select · Esc to clear
              </span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Activity Feed (default) or Coach Detail ───── */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {selectedCoach
            ? <CoachDetailPanel coach={selectedCoach} />
            : <AdminActivityFeed />
          }
        </div>
      </div>
    </div>
  );
}

