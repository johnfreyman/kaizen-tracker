import React from "react";
import { Bell, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { NUDGE_WINDOW_DAYS, type PurgeState } from "./getPurgeState";

interface PurgeBadgeProps {
  state: PurgeState | null | undefined;
  size?: "sm" | "md";
}

/**
 * Countdown pill for unverified coaches. Replaces the generic "Unverified"
 * badge with a stage-specific signal:
 *   nudge         amber  "Nudge phase · day N/7"
 *   scheduled     slate  "Purges in Nd"
 *   imminent      red    "Purges in Nd"
 *   soft_deleted  gray   "Purged"
 */
export function PurgeBadge({ state, size = "sm" }: PurgeBadgeProps) {
  if (!state) return null;

  const cfg = {
    nudge: {
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      Icon: Bell,
      label: `Nudge phase · day ${state.daysOld}/${NUDGE_WINDOW_DAYS}`,
    },
    scheduled: {
      tone: "bg-slate-50 text-slate-700 border-slate-200",
      Icon: Clock,
      label: `Purges in ${state.daysRemaining}d`,
    },
    imminent: {
      tone: "bg-red-50 text-red-700 border-red-300",
      Icon: AlertTriangle,
      label: `Purges in ${state.daysRemaining}d`,
    },
    soft_deleted: {
      tone: "bg-gray-100 text-gray-500 border-gray-300",
      Icon: Trash2,
      label: "Purged",
    },
  }[state.stage];

  const px = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-medium ${cfg.tone} ${px}`}>
      <cfg.Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}
