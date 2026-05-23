import { useState, useMemo } from "react";
import { Check, Circle, LucideIcon } from "lucide-react";
import { useDashboardAlerts } from "../hooks/useDashboardAlerts";
import { useWorkflowSteps } from "../hooks/useWorkflowSteps";

interface Props {
  onNavigate: (page: string) => void;
}

type InboxItem = {
  id: string;
  severity: "alert" | "todo" | "tip";
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

const getSeverityRank = (severity: "alert" | "todo" | "tip") => {
  if (severity === "alert") return 3;
  if (severity === "todo") return 2;
  return 1;
};

const getRelativeWeight = (id: string): number => {
  if (id.startsWith("session-overdue")) return 100;
  if (id.startsWith("session-wrong-day")) return 95;
  if (id.startsWith("roster-empty")) return 90;
  if (id.startsWith("confirm-roster")) return 80;
  if (id.startsWith("start-session")) return 75;
  if (id.startsWith("session-started")) return 70;
  if (id.startsWith("take-attendance")) return 65;
  if (id.startsWith("save-end")) return 60;
  if (id.startsWith("review-stats")) return 55;
  if (id.startsWith("spin-raffle")) return 50;
  if (id.startsWith("team-not-setup")) return 40;
  if (id.startsWith("milestone")) return 30;
  if (id.startsWith("hot-streak")) return 20;
  return 10;
};

export default function InboxCard({ onNavigate }: Props) {
  const { alerts } = useDashboardAlerts();
  const { items: checklistItems } = useWorkflowSteps();
  const [expanded, setExpanded] = useState(false);

  const combinedItems = useMemo<InboxItem[]>(() => {
    const list: InboxItem[] = [];

    // 1. Add Alerts
    alerts.forEach((alert) => {
      const severity = alert.severity === "info" ? "tip" : "alert";
      list.push({
        id: alert.id,
        severity,
        icon: alert.icon,
        title: alert.message,
        action: alert.action
          ? {
              label: alert.action.label,
              onClick: () => onNavigate(alert.action!.page),
            }
          : undefined,
      });
    });

    // 2. Add Unchecked Checklist Items as Todos
    checklistItems
      .filter((item) => !item.checked)
      .forEach((item) => {
        list.push({
          id: item.id,
          severity: "todo",
          icon: Circle,
          title: item.label,
          action: item.action
            ? {
                label: item.action.label,
                onClick: () => onNavigate(item.action!.page),
              }
            : undefined,
        });
      });

    // 3. Sort by severity (alert > todo > tip), then by virtual createdAt weight desc
    return list.sort((a, b) => {
      const rankA = getSeverityRank(a.severity);
      const rankB = getSeverityRank(b.severity);
      if (rankA !== rankB) return rankB - rankA;

      const weightA = getRelativeWeight(a.id);
      const weightB = getRelativeWeight(b.id);
      return weightB - weightA;
    });
  }, [alerts, checklistItems, onNavigate]);

  const hasMore = combinedItems.length > 3;
  const visibleItems = expanded ? combinedItems : combinedItems.slice(0, 3);

  const severityIconColors: Record<"alert" | "todo" | "tip", string> = {
    alert: "text-red-400",
    todo: "text-blue-400",
    tip: "mc-text-muted",
  };

  const severityRowBorders: Record<"alert" | "todo" | "tip", string> = {
    alert: "border-l-2 border-red-500/50 pl-[18px]",
    todo: "border-l-2 border-blue-500/50 pl-[18px]",
    tip: "border-l-2 border-transparent pl-5",
  };

  return (
    <div className="rounded-2xl border mc-border bg-[var(--mc-surface)] overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b mc-border">
        <h3 className="mc-text-secondary text-xs font-bold uppercase tracking-widest">Inbox</h3>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 transition-colors"
          >
            {expanded ? "Show less ↑" : `See all (${combinedItems.length}) →`}
          </button>
        )}
      </div>

      {/* Content */}
      {combinedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center mc-text-muted gap-2 animate-hero-enter">
          <div className="size-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Check className="size-4.5" />
          </div>
          <p className="text-xs font-medium tracking-wide">You're all caught up</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {visibleItems.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === visibleItems.length - 1;
            return (
              <div
                key={item.id}
                className={`grid grid-cols-[20px_1fr_auto] items-center gap-3 h-[56px] pr-5 ${
                  severityRowBorders[item.severity]
                } ${!isLast ? "border-b border-white/[0.04]" : ""}`}
              >
                {/* Icon */}
                <Icon className={`size-4.5 flex-shrink-0 ${severityIconColors[item.severity]}`} />

                {/* Content */}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium mc-text leading-snug truncate">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="text-[11px] mc-text-muted leading-none truncate">
                      {item.description}
                    </span>
                  )}
                </div>

                {/* Action */}
                {item.action && (
                  <button
                    onClick={item.action.onClick}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 transition-colors"
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
