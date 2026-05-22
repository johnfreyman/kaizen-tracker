import { Trophy } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import { Sparkline } from "./TrainingSummaryCard";

/* ── Week helpers (duplicated locally to avoid circular deps) ─────── */

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addWeeks(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
}

/* ── Rank badge colors ─────────────────────────────────────────────── */

const RANK_STYLES = [
  "bg-amber-400/20  text-amber-300  border-amber-400/30",
  "bg-white/10      text-white/60   border-white/15",
  "bg-orange-700/20 text-orange-400 border-orange-700/30",
];

/* ── Main component ────────────────────────────────────────────────── */

interface Props {
  onNavigate?: (page: string) => void;
}

export default function LeaderboardStrip({ onNavigate }: Props) {
  const { state } = useTeamStore();

  const hasEventsWithAttendance = state.events.some(
    (e) => e.players && e.players.length > 0
  );
  if (!hasEventsWithAttendance) return null;

  // Compute total hours per player
  const totals: Record<string, number> = {};
  state.events.forEach((e) =>
    e.players.forEach((p) => {
      totals[p] = (totals[p] ?? 0) + e.duration;
    })
  );

  const top5 = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (top5.length === 0) return null;

  // Build per-player 6-week attendance sparkline data
  const now = new Date();
  const thisMonday = getMondayOfWeek(now);
  const weekStarts = Array.from({ length: 6 }, (_, i) =>
    addWeeks(new Date(thisMonday), i - 5)
  );

  const getPlayerSparkline = (playerName: string): number[] => {
    return weekStarts.map((start) => {
      const end = addWeeks(new Date(start), 1);
      return state.events
        .filter(
          (e) =>
            e.players.includes(playerName) &&
            new Date(e.date) >= start &&
            new Date(e.date) < end
        )
        .reduce((sum, e) => sum + e.duration, 0);
    });
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Trophy className="size-3.5 text-amber-400" />
          <h3 className="text-white/55 text-xs font-bold uppercase tracking-widest">
            Leaderboard
          </h3>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate("summary")}
            className="text-blue-400/70 hover:text-blue-400 text-xs font-medium transition-colors"
          >
            Full standings →
          </button>
        )}
      </div>

      {/* Player rows */}
      <div className="divide-y divide-white/[0.04]">
        {top5.map(([name, hours], idx) => {
          const sparkData = getPlayerSparkline(name);
          const rankStyle = RANK_STYLES[idx] ?? "bg-white/5 text-white/35 border-white/10";
          const initials = name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0].toUpperCase())
            .join("");

          return (
            <div
              key={name}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Rank */}
              <span
                className={`flex-shrink-0 size-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${rankStyle}`}
              >
                {idx + 1}
              </span>

              {/* Avatar */}
              <div className="flex-shrink-0 size-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>

              {/* Name + hours */}
              <div className="flex-1 min-w-0">
                <div className="text-white/80 text-sm font-semibold truncate">{name}</div>
                <div className="text-white/30 text-xs mc-mono">
                  {hours % 1 === 0 ? hours : hours.toFixed(1)} hrs total
                </div>
              </div>

              {/* Sparkline — 6-week trend */}
              <Sparkline
                data={sparkData}
                width={56}
                height={22}
                color={idx === 0 ? "#fbbf24" : "#3b82f6"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
