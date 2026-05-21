import { useEffect, useState, useMemo } from "react";
import CoachDetailDrawer, { CoachSummaryRow } from "./admin/CoachDetailDrawer";
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
  { label: string; className: string; icon: React.ElementType }
> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    icon: Activity,
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    icon: UserX,
  },
  unverified: {
    label: "Unverified",
    className: "bg-red-100 text-red-600 border border-red-200",
    icon: ShieldOff,
  },
  "no-team-setup": {
    label: "No Setup",
    className: "bg-gray-100 text-gray-500 border border-gray-200",
    icon: AlertTriangle,
  },
};

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
      {[180, 140, 80, 70, 90, 90].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div
            className="h-4 rounded-full bg-gray-200"
            style={{ width: w }}
          />
        </td>
      ))}
      <td className="px-5 py-4">
        <div className="h-4 w-4 rounded-full bg-gray-200 ml-auto" />
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
      className={`px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs cursor-pointer select-none hover:text-gray-800 transition-colors group ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
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

interface StatusBadgeProps {
  status: StatusType;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
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

  // -------------------------------------------------------------------------
  // Data fetch — single view query, no N+1
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function fetch() {
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
    fetch();
  }, []);

  // -------------------------------------------------------------------------
  // Sorting — client-side, O(n log n), no extra API calls
  // -------------------------------------------------------------------------
  const handleSort = (key: SortKey) => {
    setSortDir((prev) => (sortKey === key && prev === "asc" ? "desc" : "asc"));
    setSortKey(key);
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

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
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6 space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Coach health &amp; activity across the platform
            </p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-600 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all border border-transparent hover:border-red-100 font-semibold text-sm"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </header>

        {/* Summary stat cards */}
        {!isLoading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Total Coaches",
                value: stats.total,
                icon: Users,
                color: "text-blue-600 bg-blue-50 border-blue-100",
              },
              {
                label: "Active (30d)",
                value: stats.active,
                icon: Activity,
                color: "text-emerald-600 bg-emerald-50 border-emerald-100",
              },
              {
                label: "Unverified",
                value: stats.unverified,
                icon: ShieldOff,
                color: "text-red-500 bg-red-50 border-red-100",
              },
              {
                label: "No Team Setup",
                value: stats.noSetup,
                icon: AlertTriangle,
                color: "text-amber-600 bg-amber-50 border-amber-100",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-2xl border bg-white/70 backdrop-blur-sm px-4 py-3 shadow-sm ${color}`}
              >
                <span className={`p-2 rounded-xl ${color.split(" ").slice(1).join(" ")}`}>
                  <Icon className={`w-4 h-4 ${color.split(" ")[0]}`} />
                </span>
                <div>
                  <p className="text-2xl font-bold text-gray-900 leading-none">
                    {value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <SortableTh
                    label="Coach"
                    sortKey="email"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-left"
                  />
                  <SortableTh
                    label="Team"
                    sortKey="team_name"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-left"
                  />
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Status
                  </th>
                  <SortableTh
                    label="Players"
                    sortKey="player_count"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-center"
                  />
                  <SortableTh
                    label="Sessions"
                    sortKey="session_count"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-center"
                  />
                  <SortableTh
                    label="Last Active"
                    sortKey="last_active_at"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-left"
                  />
                  <th className="px-5 py-3.5 w-8" />
                </tr>
              </thead>

              <tbody>
                {/* Skeleton rows */}
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}

                {/* Data rows */}
                {!isLoading &&
                  sorted.map((row, i) => {
                    const status = getStatus(row);
                    const isSelected = selectedCoach?.coach_id === row.coach_id;
                    const isLast = i === sorted.length - 1;

                    return (
                      <tr
                        key={row.coach_id}
                        onClick={() => setSelectedCoach(row)}
                        className={`cursor-pointer transition-colors ${
                          !isLast ? "border-b border-gray-100" : ""
                        } ${isSelected ? "bg-blue-50/50" : "hover:bg-gray-50/80"}`}
                      >
                        {/* Email */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-gray-900 leading-tight">
                              {row.email}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              Joined {shortDate(row.account_created_at)}
                            </span>
                          </div>
                        </td>

                        {/* Team */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            {row.team_logo ? (
                              <img
                                src={row.team_logo}
                                alt={row.team_name ?? ""}
                                className="size-7 rounded-lg object-cover shrink-0 shadow-sm"
                              />
                            ) : (
                              <div className="size-7 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                                <Users className="w-3.5 h-3.5 text-gray-400" />
                              </div>
                            )}
                            <span className="text-gray-800">
                              {row.team_name ?? (
                                <span className="text-gray-400 italic">
                                  Not set
                                </span>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-4">
                          <StatusBadge status={status} />
                        </td>

                        {/* Players */}
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                            {row.player_count}
                          </span>
                        </td>

                        {/* Sessions */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                              {row.session_count}
                            </span>
                            {row.last_session_at && (
                              <span className="text-[10px] text-gray-400">
                                {relativeTime(row.last_session_at)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Last Active */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-800 font-medium">
                              {relativeTime(row.last_active_at)}
                            </span>
                            {row.last_sign_in_at && (
                              <span className="text-[11px] text-gray-400">
                                Login: {shortDate(row.last_sign_in_at)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Open drawer */}
                        <td className="px-5 py-4">
                          <ChevronRight className="size-4 text-gray-400 ml-auto" />
                        </td>
                      </tr>
                    );
                  })}

                {/* Empty state */}
                {!isLoading && !error && sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-gray-100">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="font-semibold text-gray-700">
                          No coaches found
                        </p>
                        <p className="text-sm text-gray-400 max-w-xs">
                          Coach accounts will appear here once users sign up and
                          complete onboarding.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {!isLoading && sorted.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 flex items-center justify-between">
              <span>
                {sorted.length} coach{sorted.length !== 1 ? "es" : ""}
              </span>
              <span>
                Sorted by{" "}
                <strong className="text-gray-600">
                  {sortKey.replace(/_/g, " ")}
                </strong>{" "}
                ({sortDir === "asc" ? "ascending" : "descending"})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Coach detail drawer — lazy-loads data on open */}
      <CoachDetailDrawer
        coach={selectedCoach}
        onClose={() => setSelectedCoach(null)}
      />
    </div>
  );
}
