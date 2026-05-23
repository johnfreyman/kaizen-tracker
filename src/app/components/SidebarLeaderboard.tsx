import { Trophy } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import { calculateTotals } from "@/lib/stats";

interface Props {
  onNavigate: (page: string) => void;
}

export default function SidebarLeaderboard({ onNavigate }: Props) {
  const { state } = useTeamStore();

  if (state.roster.length === 0) return null;

  // Include every roster player, even those with 0 hours, so it's
  // always populated from day one — not just after sessions are logged.
  const totals = calculateTotals(state.events, state.roster);
  const ranked = state.roster
    .map((name) => {
      const t = totals[name] ?? { practice: 0, training: 0 };
      return { name, hours: t.practice + t.training };
    })
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

  const visible = ranked.slice(0, 5);
  const overflow = ranked.length - visible.length;
  const hasAnyHours = ranked.some((p) => p.hours > 0);

  return (
    <div className="mx-2.5 mb-2 rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => onNavigate("summary")}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Trophy className="size-3 text-yellow-500/70" />
          <span className="mc-text-muted text-[10px] font-bold uppercase tracking-widest">
            Leaderboard
          </span>
        </div>
        <span className="mc-text-muted text-[10px] group-hover:text-white/40 transition-colors">
          Full →
        </span>
      </button>

      {/* Player rows */}
      <div className="divide-y divide-white/[0.04]">
        {visible.map((player, i) => {
          const initials = player.name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0].toUpperCase())
            .join("");

          const rankColor =
            i === 0 ? "text-yellow-400" :
            i === 1 ? "mc-text-muted" :
            i === 2 ? "text-amber-600/80" :
            "mc-text-muted";

          return (
            <div
              key={player.name}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors"
            >
              <span className={`w-4 text-center text-[10px] font-bold flex-shrink-0 ${rankColor}`}>
                {i + 1}
              </span>
              <div className="size-5 rounded flex items-center justify-center bg-white/[0.07] text-[9px] font-bold mc-text-secondary flex-shrink-0">
                {initials}
              </div>
              <span className="flex-1 mc-text-secondary text-xs truncate">{player.name}</span>
              <span className="mc-mono mc-text-muted text-[11px] tabular-nums flex-shrink-0">
                {hasAnyHours
                  ? player.hours > 0
                    ? `${player.hours % 1 === 0 ? player.hours : player.hours.toFixed(1)}h`
                    : "—"
                  : "0h"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Overflow hint */}
      {overflow > 0 && (
        <button
          onClick={() => onNavigate("summary")}
          className="w-full px-3 py-2 mc-text-muted text-[10px] hover:text-white/40 transition-colors text-center"
        >
          +{overflow} more players
        </button>
      )}
    </div>
  );
}
