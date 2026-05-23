import { X } from "lucide-react";
import { useDashboardAlerts, AlertSeverity } from "../hooks/useDashboardAlerts";

interface Props {
  onNavigate?: (page: string) => void;
}

export default function AlertSurface({ onNavigate }: Props) {
  const { alerts, dismiss } = useDashboardAlerts();

  // Slice to the top 3 alerts for legacy presentation
  const visibleAlerts = alerts.slice(0, 3);

  if (visibleAlerts.length === 0) return null;

  const severityStyles: Record<AlertSeverity, string> = {
    danger:  "border-red-500/30    bg-red-500/8    text-red-700 dark:text-red-300",
    warning: "border-amber-500/30  bg-amber-500/8  text-amber-800 dark:text-amber-300",
    info:    "border-blue-500/20   bg-blue-500/6   text-blue-700 dark:text-blue-300",
  };

  const iconStyles: Record<AlertSeverity, string> = {
    danger:  "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info:    "text-blue-600 dark:text-blue-400",
  };

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => {
        const IconComponent = alert.icon;
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${severityStyles[alert.severity]}`}
          >
            <span className={`mt-0.5 flex-shrink-0 ${iconStyles[alert.severity]}`}>
              <IconComponent className="size-4" />
            </span>
            <span className="flex-1 leading-snug">{alert.message}</span>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {alert.action && onNavigate && (
                <button
                  onClick={() => onNavigate(alert.action!.page)}
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
        );
      })}
    </div>
  );
}
