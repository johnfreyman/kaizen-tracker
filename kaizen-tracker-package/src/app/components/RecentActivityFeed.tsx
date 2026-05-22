import { Calendar, Archive, UserPlus, Flame } from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";

/* ── Relative timestamp ───────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Activity item type ───────────────────────────────────────────── */

interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  description: string;
  detail: string;
  timestamp: string;
}

const MILESTONE_TARGETS = [10, 25, 50, 75, 100, 150, 200, 300, 500];

/* ── Main component ───────────────────────────────────────────────── */

interface Props {
  onNavigate?: (page: string) => void;
}

export default function RecentActivityFeed({ onNavigate }: Props) {
  const { state } = useTeamStore();

  const items: ActivityItem[] = [];

  // Sessions → activity entries
  for (const event of state.events) {
    items.push({
      id: `event-${event.id}`,
      icon: <Calendar className="size-3.5" />,
      iconBg:
        event.type === EVENT_TYPES.PRACTICE
          ? "bg-blue-500/15 text-blue-400"
          : "bg-violet-500/15 text-violet-400",
      description:
        event.type === EVENT_TYPES.PRACTICE ? "Practice saved" : "Optional training saved",
      detail: `${event.players.length} players · ${event.duration}h`,
      timestamp: event.date,
    });
  }

  // Archives → activity entries
  for (const archive of state.archivedEvents) {
    items.push({
      id: `archive-${archive.id}`,
      icon: <Archive className="size-3.5" />,
      iconBg: "bg-amber-500/15 text-amber-400",
      description: "Archive created",
      detail: `${archive.events.length} sessions archived`,
      timestamp: archive.archivedAt,
    });
  }

  // Milestones — scan events chronologically, detect when a player first crossed a threshold
  // Build cumulative hours per player in event order (events are newest-first, so reverse)
  const chronoEvents = [...state.events].reverse();
  const runningTotals: Record<string, number> = {};
  for (const event of chronoEvents) {
    for (const player of event.players) {
      const before = runningTotals[player] ?? 0;
      const after = before + event.duration;
      runningTotals[player] = after;
      for (const target of MILESTONE_TARGETS) {
        if (before < target && after >= target) {
          items.push({
            id: `milestone-${player}-${target}`,
            icon: <Flame className="size-3.5" />,
            iconBg: "bg-orange-500/15 text-orange-400",
            description: `${player} hit ${target}h milestone`,
            detail: "🔥 Keep it up!",
            timestamp: event.date,
          });
        }
      }
    }
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const visible = items.slice(0, 7);
  const hasMore = items.length > 7;

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <h3 className="text-white/55 text-xs font-bold uppercase tracking-widest">
          Recent Activity
        </h3>
        {hasMore && onNavigate && (
          <button
            onClick={() => onNavigate("summary")}
            className="text-blue-400/70 hover:text-blue-400 text-xs font-medium transition-colors"
          >
            View all →
          </button>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-white/[0.04]">
        {visible.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <span
              className={`flex-shrink-0 size-7 rounded-lg flex items-center justify-center ${item.iconBg}`}
            >
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-white/75 text-sm font-medium truncate">
                {item.description}
              </div>
              <div className="text-white/30 text-xs truncate">{item.detail}</div>
            </div>
            <div className="flex-shrink-0 text-white/25 text-xs">
              {timeAgo(item.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
