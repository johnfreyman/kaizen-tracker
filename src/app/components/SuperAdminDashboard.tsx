import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import CoachDetailPanel from "./admin/CoachDetailPanel";
import { CoachSummaryRow } from "./admin/CoachDetailDrawer";
import {
  LogOut,
  ChevronDown,
  ChevronUp,
  ChevronRight,
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
// Status badge logic
// ---------------------------------------------------------------------------

type StatusType = "active" | "inactive" | "unverified" | "no-team-setup";

function getStatus(row: CoachSummaryRow): StatusType {
  if (!row.email_verified) return "unverified";
  if (!row.team_name) return "no-team-setup";
  if (!row.last_active_at) return "inactive";
  const daysSinceActive =
    (Date.now() - new Date(row.last_active_at).getTime()) /
    (1000 * 60 * 60 * 24);
  return daysSinceActive <= 30 ? "active" : "inactive";
}

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; className: string; dotClass: string; icon: React.ElementType }
> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    dotClass: "bg-emerald-500",
    icon: Activity,
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    dotClass: "bg-amber-400",
    icon: UserX,
  },
  unverified: {
    label: "Unverified",
    className: "bg-red-100 text-red-600 border border-red-200",
    dotClass: "bg-red-500",
    icon: ShieldOff,
  },
  "no-team-setup": {
    label: "No Setup",
    className: "bg-gray-100 text-gray-500 border border-gray-200",
    dotClass: "bg-gray-400",
    icon: AlertTriangle,
  },
};

// ---------------------------------------------------------------------------
// Filtering logic
// ---------------------------------------------------------------------------

export type FilterType = 
  | "recently-active" 
  | "active" 
  | "inactive" 
  | "needs-attention" 
  | "raffle-enabled" 
  | "unverified" 
  | "no-team-setup" 
  | "has-sessions";

const FILTER_OPTIONS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: "recently-active", label: "Recently Active", icon: Activity },
  { id: "active", label: "Active", icon: CheckCircle2 },
  { id: "inactive", label: "Inactive", icon: UserX },
  { id: "needs-attention", label: "Needs Attention", icon: AlertTriangle },
  { id: "raffle-enabled", label: "Raffle Enabled", icon: Zap },
  { id: "has-sessions", label: "Has Sessions", icon: Calendar },
  { id: "unverified", label: "Unverified", icon: ShieldOff },
  { id: "no-team-setup", label: "No Setup", icon: AlertTriangle },
];

function matchesFilter(row: CoachSummaryRow, filter: FilterType): boolean {
  switch (filter) {
    case "recently-active":
      if (!row.last_active_at) return false;
      return (Date.now() - new Date(row.last_active_at).getTime()) <= 7 * 24 * 60 * 60 * 1000;
    case "active":
      return getStatus(row) === "active";
    case "inactive":
      return getStatus(row) === "inactive";
    case "needs-attention":
      return !row.email_verified || !row.team_name;
    case "raffle-enabled":
      return row.raffle_enabled === true;
    case "unverified":
      return !row.email_verified;
    case "no-team-setup":
      return !row.team_name;
    case "has-sessions":
      return row.session_count > 0;
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

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {[160, 120, 60, 55, 55, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3.5 rounded-full bg-gray-200"
            style={{ width: w }}
          />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="h-3.5 w-3 rounded-full bg-gray-200 ml-auto" />
      </td>
    </tr>
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

function StatusDot({ status }: { status: StatusType }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`}
      title={cfg.label}
    />
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

  // Ref for keyboard navigation — track focused row index within filtered list
  const listRef = useRef<HTMLTableSectionElement>(null);
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
    const active = rows.filter((r) => getStatus(r) === "active").length;
    const unverified = rows.filter((r) => !r.email_verified).length;
    const noSetup = rows.filter((r) => r.email_verified && !r.team_name).length;
    return { total: rows.length, active, unverified, noSetup };
  }, [rows]);

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
      if (!sorted.length) return;

      const currentIdx = selectedCoach
        ? sorted.findIndex((r) => r.coach_id === selectedCoach.coach_id)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < sorted.length - 1 ? currentIdx + 1 : 0;
        setSelectedCoach(sorted[next]);
        // Scroll the row into view
        const row = listRef.current?.children[next] as HTMLElement | undefined;
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : sorted.length - 1;
        setSelectedCoach(sorted[prev]);
        const row = listRef.current?.children[prev] as HTMLElement | undefined;
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (e.key === "Escape") {
        setSelectedCoach(null);
      } else if (e.key === "Enter" && currentIdx >= 0) {
        // Re-confirm selection (useful for screen readers)
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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/40 to-blue-50/30 overflow-hidden">

      {/* ── Top header bar ──────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">
              Super Admin
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Coach health &amp; activity
            </p>
          </div>
        </div>

        {/* Summary chips */}
        {!isLoading && !error && (
          <div className="hidden md:flex items-center gap-2">
            {[
              {
                label: "Total",
                value: stats.total,
                color: "bg-blue-50 text-blue-700 border-blue-100",
              },
              {
                label: "Active",
                value: stats.active,
                color: "bg-emerald-50 text-emerald-700 border-emerald-100",
              },
              {
                label: "Unverified",
                value: stats.unverified,
                color: "bg-red-50 text-red-600 border-red-100",
              },
              {
                label: "No Setup",
                value: stats.noSetup,
                color: "bg-amber-50 text-amber-700 border-amber-100",
              },
            ].map(({ label, value, color }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${color}`}
              >
                <span className="text-base font-bold leading-none">{value}</span>
                {label}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={logout}
          title="Log out"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white shadow border border-gray-200 text-gray-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all font-semibold text-sm"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </header>

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

          {/* Scrollable table container */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            <table
              className="w-full text-sm"
              aria-label="Coach list"
            >
              {/* Sticky thead */}
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
                <tr>
                  <SortableTh
                    label="Coach"
                    sortKey="email"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-left"
                  />
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">
                    Status
                  </th>
                  <SortableTh
                    label="Sessions"
                    sortKey="session_count"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-center"
                  />
                  <SortableTh
                    label="Players"
                    sortKey="player_count"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-center"
                  />
                  <SortableTh
                    label="Created"
                    sortKey="account_created_at"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-left"
                  />
                  <SortableTh
                    label="Active"
                    sortKey="last_active_at"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-left"
                  />
                  <th className="px-3 py-3 w-5" />
                </tr>
              </thead>

              <tbody
                ref={listRef}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                aria-label="Coach rows — use arrow keys to navigate"
                className="outline-none"
              >
                {/* Skeleton rows */}
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}

                {/* Data rows */}
                {!isLoading &&
                  sorted.map((row) => {
                    const status = getStatus(row);
                    const isSelected = selectedCoach?.coach_id === row.coach_id;
                    const pyClass = density === "compact" ? "py-1.5" : "py-2.5";

                    return (
                      <tr
                        key={row.coach_id}
                        onClick={() => setSelectedCoach(row)}
                        aria-selected={isSelected}
                        className={`
                          cursor-pointer border-b border-gray-50 transition-colors duration-100
                          ${isSelected
                            ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                            : "hover:bg-gray-50/80 border-l-2 border-l-transparent"
                          }
                        `}
                      >
                        {/* Email + join date */}
                        <td className={`px-4 ${pyClass}`}>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className={`font-medium leading-tight truncate max-w-[160px] ${
                                isSelected ? "text-indigo-700" : "text-gray-900"
                              }`}
                            >
                              {row.email}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {shortDate(row.account_created_at)}
                            </span>
                          </div>
                        </td>

                        {/* Status dot */}
                        <td className={`px-4 ${pyClass}`}>
                          <div className="flex items-center gap-1.5">
                            <StatusDot status={status} />
                            <span className="text-xs text-gray-500">
                              {STATUS_CONFIG[status].label}
                            </span>
                          </div>
                        </td>

                        {/* Sessions */}
                        <td className={`px-4 ${pyClass} text-center`}>
                          <span className="inline-flex items-center justify-center w-7 h-5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                            {row.session_count}
                          </span>
                        </td>

                        {/* Players */}
                        <td className={`px-4 ${pyClass} text-center`}>
                          <span className="inline-flex items-center justify-center w-7 h-5 rounded-md bg-gray-100 text-gray-600 text-xs font-bold">
                            {row.player_count}
                          </span>
                        </td>

                        {/* Created */}
                        <td className={`px-4 ${pyClass}`}>
                          <span className="text-xs text-gray-600">
                            {shortDate(row.account_created_at)}
                          </span>
                        </td>

                        {/* Last active */}
                        <td className={`px-4 ${pyClass}`}>
                          <span className="text-xs text-gray-600">
                            {relativeTime(row.last_active_at)}
                          </span>
                        </td>

                        {/* Arrow */}
                        <td className={`pr-3 ${pyClass} text-right`}>
                          <ChevronRight
                            className={`size-3.5 transition-colors ${
                              isSelected ? "text-indigo-400" : "text-gray-300"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}

                {/* Empty state */}
                {!isLoading && !error && sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
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
                            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                          >
                            Clear filters and search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* List footer */}
          {!isLoading && (
            <div className="shrink-0 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-[11px] text-gray-400">
              <span>
                {search
                  ? `${sorted.length} of ${rows.length} coaches`
                  : `${rows.length} coach${rows.length !== 1 ? "es" : ""}`}
              </span>
              <span>
                ↑↓ to navigate · Esc to clear
              </span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Detail Panel ───────────────────────────────── */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <CoachDetailPanel coach={selectedCoach} />
        </div>
      </div>
    </div>
  );
}
