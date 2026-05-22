import { useState, useMemo } from "react";
import { AlertTriangle, Info, X, Flame, Clock, Users } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import { useSessionTimer } from "../hooks/useSessionTimer";

type AlertSeverity = "danger" | "warning" | "info";

interface Alert {
  id: string;
  priority: number;
  severity: AlertSeverity;
  icon: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}

const MILESTONE_TARGETS = [10, 25, 50, 75, 100, 150, 200, 300, 500];
const MILESTONE_BUFFER = 5;

interface Props {
  onNavigate?: (page: string) => void;
}

export default function AlertSurface({ onNavigate }: Props) {
  const { state } = useTeamStore();
  const elapsed = useSessionTimer(state.activeSession);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (id: string) =>
    setDismissed((prev) => new Set([...prev, id]));

  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];

    // 1 — Session overdue (danger)
    if (state.activeSession) {
      const plannedSeconds = state.activeSession.duration * 3600;
      const bufferSeconds = 15 * 60;
      if (elapsed > plannedSeconds + bufferSeconds) {
        const overMinutes = Math.floor((elapsed - plannedSeconds) / 60);
        result.push({
          id: "session-overdue",
          priority: 1,
          severity: "danger",
          icon: <Clock className="size-4" />,
          message: `Session is ${overMinutes} min over the planned duration.`,
          action: onNavigate
            ? { label: "Save & End →", onClick: () => onNavigate("attendance") }
            : undefined,
        });
      }
    }

    // 2 — Session started on wrong day (warning)
    if (state.activeSession) {
      const sessionDay = state.activeSession.date.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      if (sessionDay !== today) {
        result.push({
          id: "session-wrong-day",
          priority: 2,
          severity: "warning",
          icon: <AlertTriangle className="size-4" />,
          message: `Active session was started on ${sessionDay}, not today.`,
        });
      }
    }

    // 3 — Roster empty (warning)
    if (state.roster.length === 0) {
      result.push({
        id: "roster-empty",
        priority: 3,
        severity: "warning",
        icon: <Users className="size-4" />,
        message: "Your roster is empty. Add players before starting a session.",
        action: onNavigate
          ? { label: "Settings →", onClick: () => onNavigate("settings") }
          : undefined,
      });
    }

    // 4 — Team not set up (info)
    if (state.teamName === "Team Name" && !state.teamLogo) {
      result.push({
        id: "team-not-setup",
        priority: 4,
        severity: "info",
        icon: <Info className="size-4" />,
        message: "Customize your team name and logo in Settings.",
        action: onNavigate
          ? { label: "Settings →", onClick: () => onNavigate("settings") }
          : undefined,
      });
    }

    // 5 — Milestone close (info, one per player, highest priority player first)
    if (state.events.length > 0) {
      const totals: Record<string, number> = {};
      state.events.forEach((e) =>
        e.players.forEach((p) => {
          totals[p] = (totals[p] ?? 0) + e.duration;
        })
      );

      let closestGap = Infinity;
      let closestPlayer = "";
      let closestMilestone = 0;

      for (const [player, hours] of Object.entries(totals)) {
        for (const milestone of MILESTONE_TARGETS) {
          const gap = milestone - hours;
          if (gap > 0 && gap <= MILESTONE_BUFFER && gap < closestGap) {
            closestGap = gap;
            closestPlayer = player;
            closestMilestone = milestone;
          }
        }
      }

      if (closestPlayer) {
        result.push({
          id: `milestone-${closestPlayer}-${closestMilestone}`,
          priority: 5,
          severity: "info",
          icon: <Flame className="size-4" />,
          message: `${closestPlayer} is ${closestGap.toFixed(1)}h away from ${closestMilestone}h milestone.`,
        });
      }
    }

    // 6 — Hot streak: player in 5+ consecutive events (info)
    if (state.events.length >= 5) {
      const recentFive = state.events.slice(0, 5);
      for (const player of state.roster) {
        if (recentFive.every((e) => e.players.includes(player))) {
          result.push({
            id: `hot-streak-${player}`,
            priority: 6,
            severity: "info",
            icon: <Flame className="size-4" />,
            message: `${player} has attended the last 5 sessions in a row! 🔥`,
          });
          break; // one per render to avoid noise
        }
      }
    }

    return result
      .filter((a) => !dismissed.has(a.id))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
  }, [state, elapsed, dismissed, onNavigate]);

  if (alerts.length === 0) return null;

  const severityStyles: Record<AlertSeverity, string> = {
    danger:  "border-red-500/30    bg-red-500/8    text-red-300",
    warning: "border-amber-500/30  bg-amber-500/8  text-amber-300",
    info:    "border-blue-500/20   bg-blue-500/6   text-blue-300",
  };

  const iconStyles: Record<AlertSeverity, string> = {
    danger:  "text-red-400",
    warning: "text-amber-400",
    info:    "text-blue-400",
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${severityStyles[alert.severity]}`}
        >
          <span className={`mt-0.5 flex-shrink-0 ${iconStyles[alert.severity]}`}>
            {alert.icon}
          </span>
          <span className="flex-1 leading-snug">{alert.message}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {alert.action && (
              <button
                onClick={alert.action.onClick}
                className="text-xs font-semibold opacity-80 hover:opacity-100 underline underline-offset-2 transition-opacity"
              >
                {alert.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(alert.id)}
              className="opacity-40 hover:opacity-70 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
