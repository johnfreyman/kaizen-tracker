import { useTeamStore } from "../hooks/useTeamStore";
import { useSessionTimer, formatElapsed } from "../hooks/useSessionTimer";

interface Props {
  onNavigate: (page: string) => void;
}

export default function SessionStatusBar({ onNavigate }: Props) {
  const { state } = useTeamStore();
  const elapsed = useSessionTimer(state.activeSession);

  if (!state.activeSession) return null;

  const isPractice = state.activeSession.type === "Practice";

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 h-9 bg-emerald-500/10 border-b border-emerald-500/20">
      <div className="flex items-center gap-2.5">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-session-pulse" />
        <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">Live</span>
        <span className="text-white/30 text-xs">·</span>
        <span className="text-white/60 text-xs font-medium">{state.activeSession.type}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="mc-mono text-white/70 text-xs tabular-nums">
          {formatElapsed(elapsed)}
        </span>
        <span className="text-white/20 text-xs">·</span>
        <span className="text-white/40 text-xs">{state.roster.length} players</span>
        <button
          onClick={() => onNavigate("attendance")}
          className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
            isPractice
              ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              : "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
          }`}
        >
          Manage →
        </button>
      </div>
    </div>
  );
}
