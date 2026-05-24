import { useState, useMemo, useCallback } from "react";
import { AlertTriangle, Info, Flame, Clock, Users, LucideIcon } from "lucide-react";
import { useTeamStore } from "./useTeamStore";
import { useSessionTimer } from "./useSessionTimer";
import { formatDate } from "@/lib/dates";

export type AlertSeverity = "danger" | "warning" | "info";

export interface DashboardAlert {
  id: string;
  priority: number;
  severity: AlertSeverity;
  icon: LucideIcon;
  message: string;
  action?: { label: string; page: string };
}

const MILESTONE_TARGETS = [10, 25, 50, 75, 100, 150, 200, 300, 500];
const MILESTONE_BUFFER = 5;

export function useDashboardAlerts() {
  const { state } = useTeamStore();
  const elapsed = useSessionTimer(state.activeSession);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  const alerts = useMemo<DashboardAlert[]>(() => {
    const result: DashboardAlert[] = [];

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
          icon: Clock,
          message: `Session is ${overMinutes} min over the planned duration.`,
          action: { label: "Save & End →", page: "attendance" },
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
          icon: AlertTriangle,
          message: `Active session was started on ${formatDate(sessionDay)}, not today.`,
        });
      }
    }

    // 3 — Roster empty (warning)
    if (state.roster.length === 0) {
      result.push({
        id: "roster-empty",
        priority: 3,
        severity: "warning",
        icon: Users,
        message: "Your roster is empty. Add players before starting a session.",
        action: { label: "Settings →", page: "settings" },
      });
    }

    // 4 — Team not set up (info)
    if (state.teamName === "Team Name" && !state.teamLogo) {
      result.push({
        id: "team-not-setup",
        priority: 4,
        severity: "info",
        icon: Info,
        message: "Customize your team name and logo in Settings.",
        action: { label: "Settings →", page: "settings" },
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
          icon: Flame,
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
            icon: Flame,
            message: `${player} has attended the last 5 sessions in a row! 🔥`,
          });
          break; // one per render to avoid noise
        }
      }
    }

    return result.filter((a) => !dismissed.has(a.id));
  }, [state, elapsed, dismissed]);

  return { alerts, dismiss };
}
