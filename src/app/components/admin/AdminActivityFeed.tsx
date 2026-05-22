import { useEffect, useRef, useState } from "react";
import {
  FileText,
  UserPlus,
  Archive,
  ArchiveRestore,
  Gift,
  AlertCircle,
  Activity,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  id: string;
  event_type: string;
  coach_id: string | null;
  coach_email: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
}

type FilterKey = "all" | "warnings" | "errors" | "coach_actions" | "system";

// ---------------------------------------------------------------------------
// Event metadata registry
// ---------------------------------------------------------------------------

interface EventMeta {
  Icon: React.ElementType;
  label: (m: Record<string, unknown> | null) => string;
  iconColor: string;
  iconBg: string;
  severity: "info" | "warning" | "error";
  category: "coach_action" | "system";
}

const EVENT_META: Record<string, EventMeta> = {
  session_saved: {
    Icon: FileText,
    label: () => "Session saved",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    severity: "info",
    category: "coach_action",
  },
  coach_signup: {
    Icon: UserPlus,
    label: () => "Coach signed up",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    severity: "info",
    category: "system",
  },
  archive_created: {
    Icon: Archive,
    label: () => "Events archived",
    iconColor: "text-gray-500",
    iconBg: "bg-gray-100",
    severity: "info",
    category: "coach_action",
  },
  archive_restored: {
    Icon: ArchiveRestore,
    label: () => "Archive restored",
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
    severity: "info",
    category: "coach_action",
  },
  raffle_toggled: {
    Icon: Gift,
    label: (m) => (m?.enabled ? "Raffle enabled" : "Raffle disabled"),
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    severity: "warning",
    category: "coach_action",
  },
  failed_sync: {
    Icon: AlertCircle,
    label: () => "Sync failed",
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    severity: "error",
    category: "system",
  },
};

const FALLBACK_META: EventMeta = {
  Icon: Activity,
  label: () => "Platform event",
  iconColor: "text-gray-400",
  iconBg: "bg-gray-100",
  severity: "info",
  category: "system",
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "warnings", label: "Warnings" },
  { key: "errors", label: "Errors" },
  { key: "coach_actions", label: "Coach Actions" },
  { key: "system", label: "System" },
];

function matchesFilter(entry: ActivityEntry, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const meta = EVENT_META[entry.event_type] ?? FALLBACK_META;
  if (filter === "warnings") return meta.severity === "warning";
  if (filter === "errors") return meta.severity === "error";
  if (filter === "coach_actions") return meta.category === "coach_action";
  if (filter === "system") return meta.category === "system";
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const MAX_LIVE_ENTRIES = 100;
const NEW_HIGHLIGHT_MS = 3000;

export function AdminActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [isLive, setIsLive] = useState(false);
  const offsetRef = useRef(0);

  // Clear new-entry highlights after a short window
  useEffect(() => {
    if (newIds.size === 0) return;
    const t = setTimeout(() => setNewIds(new Set()), NEW_HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [newIds]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    supabase
      .from("activity_log")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setEntries(data as ActivityEntry[]);
        setHasMore(data.length === PAGE_SIZE);
        offsetRef.current = data.length;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-activity-feed")
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload: { new: ActivityEntry }) => {
          const entry = payload.new;
          setEntries((prev) => {
            if (prev.some((e) => e.id === entry.id)) return prev;
            return [entry, ...prev].slice(0, MAX_LIVE_ENTRIES);
          });
          setNewIds((prev) => new Set([...prev, entry.id]));
          offsetRef.current += 1;
        }
      )
      .subscribe((status: string) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadMore() {
    setIsLoadingMore(true);
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("occurred_at", { ascending: false })
      .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

    if (!error && data) {
      const incoming = (data as ActivityEntry[]).filter(
        (d) => !entries.some((p) => p.id === d.id)
      );
      setEntries((prev) => [...prev, ...incoming]);
      setHasMore(data.length === PAGE_SIZE);
      offsetRef.current += data.length;
    }
    setIsLoadingMore(false);
  }

  const filtered = entries.filter((e) => matchesFilter(e, activeFilter));

  return (
    <div className="flex flex-col h-full bg-white/70">

      {/* Header & Tabs Navigation Container */}
      <div className="shrink-0 px-5 pt-4 border-b border-gray-100 bg-white/95 backdrop-blur-sm space-y-4">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Activity Feed</span>
            </h2>
            <span className="text-gray-300 text-xs">•</span>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/60 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-400 border border-gray-200/60 leading-none">
                Offline
              </span>
            )}
          </div>
          {!isLoading && entries.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200/50">
              {entries.length} events
            </span>
          )}
        </div>

        {/* Tab Navigation Section */}
        <div className="border-t border-gray-100 -mx-5 px-5">
          <nav className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth" aria-label="Activity Feed Filters">
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`relative pb-3 pt-2 text-[11px] font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    isActive
                      ? "text-indigo-600 font-bold"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  style={{ minHeight: "44px" }}
                >
                  <span className="px-1 py-1 block">{f.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-150" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 animate-pulse"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <Activity className="w-8 h-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">
              {activeFilter === "all"
                ? "No activity yet"
                : "No events match this filter"}
            </p>
          </div>
        ) : (
          <>
            {filtered.map((entry) => {
              const meta = EVENT_META[entry.event_type] ?? FALLBACK_META;
              const { Icon, label, iconColor, iconBg, severity } = meta;
              const isNew = newIds.has(entry.id);

              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${
                    isNew ? "bg-indigo-50/60" : "hover:bg-gray-50/40"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">
                        {label(entry.metadata)}
                      </span>
                      {severity === "warning" && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                          warn
                        </span>
                      )}
                      {severity === "error" && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
                          error
                        </span>
                      )}
                    </div>

                    {entry.coach_email && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {entry.coach_email}
                      </p>
                    )}

                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(entry.occurred_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="px-4 py-3">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[10px] text-gray-400 font-medium">
          Select a coach from the list to view details
        </p>
      </div>
    </div>
  );
}
