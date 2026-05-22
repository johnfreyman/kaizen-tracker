import React from "react";
import { RefreshCw, Clock, UserX } from "lucide-react";
import { PurgeBadge } from "./PurgeBadge";
import { PURGE_WINDOW_DAYS, type PurgeState } from "./getPurgeState";
import type { CoachSummaryRow } from "@/app/components/admin/CoachDetailDrawer";

interface VerificationTimelineProps {
  coach: CoachSummaryRow;
  state: PurgeState;
  /** Admin actions — wire to your supabase RPCs / activity_log writes. */
  onResend?: () => void;
  onExtend?: () => void;
  onPurgeNow?: () => void;
}

/**
 * Verification + purge lifecycle panel for the detail pane.
 * Render conditionally — only when getPurgeState(coach) is non-null.
 *
 * The timeline events shown here are synthesized from account_created_at
 * for the design mock. In production, drive them from a real
 * `verification_events` table or the existing `activity_log` (migration 006).
 */
export function VerificationTimeline({
  coach,
  state,
  onResend,
  onExtend,
  onPurgeNow,
}: VerificationTimelineProps) {
  const daysOld = state.daysOld;

  // TODO(backend): replace with rows from activity_log filtered by coach_id
  //                + action in ('verification_sent', 'reminder_sent', 'final_notice_sent')
  const events = [
    { day: 0, label: "Account created", sent: true, kind: "anchor" as const },
    { day: 0, label: "Verification email sent", sent: daysOld >= 0, kind: "auto" as const },
    { day: 3, label: "Reminder #1", sent: daysOld >= 3, kind: "auto" as const },
    { day: 7, label: "Reminder #2", sent: daysOld >= 7, kind: "auto" as const },
    { day: 30, label: "Final notice", sent: daysOld >= 30, kind: "notice" as const },
    { day: PURGE_WINDOW_DAYS, label: "Scheduled purge", sent: false, kind: "purge" as const },
  ];

  const stageBlurb = {
    nudge: "In nudge phase — automated reminders firing. No admin action required yet.",
    scheduled: `Final notice was sent ${Math.max(0, daysOld - 30)}d ago. Account purges on ${new Date(
      state.purgeDate,
    ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`,
    imminent: `Purges in ${state.daysRemaining}d. Last chance to extend or recover.`,
  }[state.stage];

  return (
    <div className="px-4 py-3 border-b border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Verification &amp; purge
        </span>
        <PurgeBadge state={state} size="md" />
      </div>

      <p className={`text-[11.5px] leading-snug mb-2.5 ${state.stage === "imminent" ? "text-red-700" : "text-slate-600"}`}>
         {stageBlurb}
      </p>

      <ol className="relative pl-4 space-y-1.5">
        <span className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200" />
        {events.map((ev) => {
          const isPurge = ev.kind === "purge";
          const dotCls = !ev.sent
            ? isPurge
              ? "bg-white border-2 border-red-400"
              : "bg-white border-2 border-slate-300"
            : ev.kind === "notice"
              ? "bg-amber-500"
              : "bg-slate-400";
          const textCls = !ev.sent
            ? isPurge
              ? "text-red-700 font-semibold"
              : "text-slate-400"
            : "text-slate-700";
          const dateLabel = ev.sent
            ? ev.day === 0
              ? "day 0"
              : `day ${ev.day}`
            : `in ${Math.max(0, ev.day - daysOld)}d`;
          return (
            <li key={ev.label} className="flex items-center gap-2 text-[11.5px]">
              <span className={`absolute -left-px w-[11px] h-[11px] rounded-full ${dotCls}`} aria-hidden />
              <span className={`flex-1 ${textCls}`}>{ev.label}</span>
              <span className="text-[10.5px] text-slate-400 tabular-nums">{dateLabel}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          onClick={onResend}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11.5px] font-medium transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Resend email
        </button>
        <button
          onClick={onExtend}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11.5px] font-medium transition-colors"
        >
          <Clock className="w-3 h-3" /> Extend 30d
        </button>
        <button
          onClick={onPurgeNow}
          className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 text-[11.5px] font-medium transition-colors"
        >
          <UserX className="w-3 h-3" /> Purge now
        </button>
      </div>
    </div>
  );
}
