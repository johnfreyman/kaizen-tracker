import { Timer, Users, ArrowRight } from "lucide-react";
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
    <div className={`flex-shrink-0 flex items-center justify-between px-4 md:px-6 h-10 border-b transition-colors ${
      isPractice
        ? "bg-emerald-500/10 border-emerald-500/20"
        : "bg-violet-500/10 border-violet-500/20"
    }`}>
      {/* Left: live badge + session type */}
      <div className="flex items-center gap-2.5">
        <span className={`size-1.5 rounded-full animate-session-pulse ${isPractice ? "bg-emerald-500 dark:bg-emerald-400" : "bg-violet-500 dark:bg-violet-400"}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${
          isPractice ? "text-emerald-700 dark:text-emerald-300" : "text-violet-700 dark:text-violet-300"
        }`}>Live</span>
        <span className="mc-text-muted text-xs">·</span>
        <span className="mc-text-secondary text-xs font-medium">{state.activeSession.type}</span>
      </div>

      {/* Right: elapsed timer + players + CTA */}
      <div className="flex items-center gap-3">
        {/* Elapsed time — icon makes clear this is a running timer, not a clock */}
        <div className="flex items-center gap-1.5 mc-text-secondary text-xs">
          <Timer className="size-3 mc-text-muted" />
          <span className="mc-mono tabular-nums">{formatElapsed(elapsed)}</span>
          <span className="mc-text-muted">elapsed</span>
        </div>

        <span className="mc-text-muted text-xs">·</span>

        <div className="flex items-center gap-1 mc-text-muted text-xs">
          <Users className="size-3" />
          <span>{state.roster.length}</span>
        </div>

        {/* Attendance CTA — visually a proper button with border */}
        <button
          onClick={() => onNavigate("attendance")}
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold border transition-all active:scale-95 ${
            isPractice
              ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/22 hover:border-emerald-500/50"
              : "bg-violet-500/12 border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-500/22 hover:border-violet-500/50"
          }`}
        >
          Take Attendance
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  );
}
