import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import CoachDetailPanel from "./admin/CoachDetailPanel";
import { CoachSummaryRow } from "./admin/CoachDetailDrawer";
import { AdminActivityFeed } from "./admin/AdminActivityFeed";
import AdminActionBar from "./admin/AdminActionBar";
import {
  LogOut,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Users,
  ShieldOff,
  UserX,
  AlertTriangle,
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
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTeamStore } from "../hooks/useTeamStore";
import { TeamLogo } from "./admin/TeamLogo";
import { getPurgeState } from "./admin/getPurgeState";
import { PurgeBadge } from "./admin/PurgeBadge";

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

export function getSemanticStatus(row: CoachSummaryRow, hasActiveSession = false): SemanticStatus {
  if (!row.email_verified) return "critical";
  if (!row.team_name) return "warning";

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
  | "unverified"
  | "no-team-setup"
  | "active-today"
  | "active-this-week"
  | "purge-queue";

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
  { id: "purge-queue", label: "Purge Queue", icon: Clock },
];

function matchesFilter(row: CoachSummaryRow, filter: FilterType): boolean {
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
    case "purge-queue": {
      const purgeState = getPurgeState(row);
      return purgeState !== null && (purgeState.stage === "scheduled" || purgeState.stage === "imminent");
    }
    default:
      return true;
  }
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

// ---------------------------------------------------------------------------
// KPI Tile
// ---------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  subLabel,
  dotClass,
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  subLabel?: string;
  dotClass?: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-150 min-w-[140px] h-[90px] text-left relative select-none cursor-pointer active:scale-[0.97]",
        isActive
          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm text-slate-900",
      ].join(" ")}
    >
      <div className="flex flex-col">
        <span className={`text-[12px] font-semibold tracking-wide leading-none ${isActive ? "text-slate-300" : "text-slate-500"}`}>
          {label}
        </span>
        <span className={`text-2xl font-bold tracking-tight mt-1.5 leading-none tabular-nums ${isActive ? "text-white" : "text-slate-900"}`}>
          {value.toLocaleString()}
        </span>
      </div>
      {subLabel && (
        <span className={`text-[10px] font-medium tracking-wide mt-1 leading-none ${isActive ? "text-slate-400" : "text-slate-400"}`}>
          {subLabel}
        </span>
      )}
      {dotClass && (
        <span className={`absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
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
  const [isPaneCollapsed, setIsPaneCollapsed] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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
  // Search filter (client-side)
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

    const healthy = rows.filter((r) => getSemanticStatus(r) === "healthy").length;
    const warning = rows.filter((r) => getSemanticStatus(r) === "warning").length;
    const critical = rows.filter((r) => getSemanticStatus(r) === "critical").length;
    const inactive = rows.filter((r) => getSemanticStatus(r) === "inactive").length;
    const newAccts = rows.filter((r) => getSemanticStatus(r) === "new").length;

    const activeToday = rows.filter(
      (r) => r.last_active_at && now - new Date(r.last_active_at).getTime() < day
    ).length;

    const purgeCoaches = rows.filter((r) => {
      const p = getPurgeState(r);
      return p !== null && p.stage !== "nudge";
    });
    const purgeQueue = purgeCoaches.length;
    const purgeImminent = purgeCoaches.filter((r) => getPurgeState(r)?.stage === "imminent").length;

    return { total: rows.length, healthy, warning, critical, inactive, newAccts, activeToday, purgeQueue, purgeImminent };
  }, [rows]);

  // -------------------------------------------------------------------------
  // KPI tiles — single flat row, no sparklines or trend indicators
  // -------------------------------------------------------------------------
  const kpiTiles = useMemo(() => [
    { key: "total",        label: "Total",          value: stats.total,         filter: "clear-all" as const },
    { key: "active-today", label: "Active today",   value: stats.activeToday,   filter: "active-today" as FilterType,    dotClass: "bg-violet-600", subLabel: "last 24h" },
    { key: "healthy",      label: "Healthy",        value: stats.healthy,       filter: "healthy" as FilterType,         dotClass: "bg-emerald-500" },
    { key: "warning",      label: "Warning",        value: stats.warning,       filter: "warning" as FilterType,         dotClass: "bg-amber-400" },
    { key: "critical",     label: "Critical",       value: stats.critical,      filter: "critical" as FilterType,        dotClass: "bg-red-500" },
    { key: "inactive",     label: "Inactive",       value: stats.inactive,      filter: "inactive" as FilterType,        dotClass: "bg-slate-400" },
    { key: "new",          label: "New",            value: stats.newAccts,      filter: "new" as FilterType,             dotClass: "bg-blue-500" },
    { key: "purge-queue",  label: "Purge queue",    value: stats.purgeQueue,    filter: "purge-queue" as FilterType,     dotClass: "bg-orange-550", subLabel: stats.purgeImminent > 0 ? `${stats.purgeImminent} in <7d` : "on the clock" },
  ], [stats]);

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
        (gridRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : sorted.length - 1;
        setSelectedCoach(sorted[prev]);
        (gridRef.current?.children[prev] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
              Coach health &amp; activity
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

      {/* ── KPI Tile strip ──────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="overflow-x-auto no-scrollbar px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 min-w-max animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-[120px] h-[60px] bg-gray-100 rounded-xl border border-slate-200" />
              ))}
            </div>
          ) : !error ? (
            <div className="flex items-center gap-2 min-w-max">
              {kpiTiles.map((tile) => {
                const isActive =
                  tile.filter === "clear-all"
                    ? activeFilters.size === 0
                    : activeFilters.has(tile.filter as FilterType);
                return (
                  <KpiTile
                    key={tile.key}
                    label={tile.label}
                    value={tile.value}
                    subLabel={"subLabel" in tile ? tile.subLabel : undefined}
                    dotClass={"dotClass" in tile ? tile.dotClass : undefined}
                    isActive={isActive}
                    onClick={() => {
                      if (tile.filter === "clear-all") {
                        setActiveFilters(new Set());
                      } else {
                        toggleFilter(tile.filter as FilterType);
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Master-detail body ──────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── LEFT: Coach grid pane ─────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-gray-100 bg-white/70 min-h-0">

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
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-indigo-500 border-indigo-500" : "border-gray-300"}`}>
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

              {/* Expand detail pane (shown when pane is collapsed) */}
              {isPaneCollapsed && (
                <button
                  onClick={() => setIsPaneCollapsed(false)}
                  title="Expand detail panel"
                  className="flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
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

          {/* Scrollable card grid container */}
          <div
            ref={listRef}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Coach accounts list — use arrow keys to navigate"
            className="flex-1 overflow-y-auto overscroll-contain min-h-0 outline-none select-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"
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

            {/* Card grid */}
            <div
              ref={gridRef}
              className={`p-3 grid gap-2.5 ${isPaneCollapsed ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {/* Skeleton cards */}
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 animate-pulse space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-11 h-11 rounded-lg bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-200 rounded w-4/5" />
                      <div className="h-3 bg-gray-200 rounded w-3/5" />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-4 bg-gray-200 rounded w-16" />
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              ))}

              {/* Data cards */}
              {!isLoading && sorted.map((row) => {
                const isSelected = selectedCoach?.coach_id === row.coach_id;
                const status = getSemanticStatus(row, false);
                const STATUS_CFG = {
                  healthy: { dot: SEMANTIC_CONFIG.healthy.dotClass, label: SEMANTIC_CONFIG.healthy.label },
                  warning: { dot: SEMANTIC_CONFIG.warning.dotClass, label: SEMANTIC_CONFIG.warning.label },
                  critical: { dot: SEMANTIC_CONFIG.critical.dotClass, label: SEMANTIC_CONFIG.critical.label },
                  inactive: { dot: SEMANTIC_CONFIG.inactive.dotClass, label: SEMANTIC_CONFIG.inactive.label },
                  new: { dot: SEMANTIC_CONFIG.new.dotClass, label: SEMANTIC_CONFIG.new.label },
                };

                const purge = getPurgeState(row);

                const activeBadges: { label: string; bg: string; icon: React.ElementType }[] = [];
                if (!row.email_verified && !purge) {
                  activeBadges.push({ label: "Unverified", bg: "bg-red-50 text-red-700 border-red-200", icon: ShieldOff });
                }
                if (!row.team_name) {
                  activeBadges.push({ label: "No Team Setup", bg: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle });
                }
                if (row.last_active_at) {
                  const days = (Date.now() - new Date(row.last_active_at).getTime()) / 86400000;
                  if (days > 30) activeBadges.push({ label: "Inactive 30d", bg: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock });
                } else {
                  activeBadges.push({ label: "Inactive 30d", bg: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock });
                }

                return (
                  <div
                    key={row.coach_id}
                    onClick={() => setSelectedCoach(row)}
                    className={`p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 flex flex-col gap-2 ${
                      isSelected
                        ? "border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/40 shadow-sm"
                        : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300 active:scale-[0.98]"
                    }`}
                  >
                    {/* Top row: logo + team name / email */}
                    <div className="flex items-start gap-2.5">
                      <TeamLogo team={row.team_name} logoUrl={row.team_logo} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[13px] text-slate-900 truncate">
                            {row.team_name ?? <span className="italic text-slate-400 font-normal">No team registered</span>}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CFG[status].dot}`}
                            title={STATUS_CFG[status].label}
                            aria-label={`Status: ${STATUS_CFG[status].label}`}
                          />
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[8px] font-bold shrink-0 uppercase">
                            {row.email[0]}
                          </div>
                          <span className="text-[11px] text-gray-500 truncate">{row.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Issue badges */}
                    {!isCompact && (activeBadges.length > 0 || purge) && (
                      <div className="flex flex-wrap gap-1">
                        {purge && <PurgeBadge state={purge} />}
                        {activeBadges.map((badge, idx) => {
                          const BadgeIcon = badge.icon;
                          return (
                            <span key={idx} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border ${badge.bg}`}>
                              <BadgeIcon className="w-2.5 h-2.5 shrink-0" />
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{row.session_count} sessions</span>
                        <span className="text-gray-300">·</span>
                        <span>{row.player_count} players</span>
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
                      <span className={status === "inactive" ? "text-gray-400" : "text-slate-600"}>
                        {relativeTime(row.last_active_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

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
              <span>↑↓ keys to select · Esc to clear</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: 420 px detail pane ────────────────────────────── */}
        {!isPaneCollapsed && (
          <div className="w-[420px] shrink-0 flex flex-col border-l border-gray-100 min-h-0">
            {/* Pane header with collapse button */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
              <span className="text-xs font-semibold text-gray-500 truncate">
                {selectedCoach ? selectedCoach.email : "Activity Feed"}
              </span>
              <button
                onClick={() => setIsPaneCollapsed(true)}
                title="Collapse panel"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 ml-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {selectedCoach
                ? <CoachDetailPanel coach={selectedCoach} />
                : <AdminActivityFeed />
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
