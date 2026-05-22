import { useState, useCallback } from "react";
import { RefreshCw, Clock, UserX, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { PurgeBadge } from "./PurgeBadge";
import { PURGE_WINDOW_DAYS, type PurgeState } from "./getPurgeState";
import type { CoachSummaryRow } from "@/app/components/admin/CoachDetailDrawer";

interface VerificationTimelineProps {
  coach: CoachSummaryRow;
  state: PurgeState;
  /** Called after a successful resend or extend so the parent can refresh the coach row. */
  onRefreshCoach?: () => void;
  /** Called after a successful purge so the parent can dismiss the detail pane. */
  onPurgeSuccess?: () => void;
}

/**
 * Verification + purge lifecycle panel for the detail pane.
 * Render conditionally — only when getPurgeState(coach) is non-null.
 */
export function VerificationTimeline({
  coach,
  state,
  onRefreshCoach,
  onPurgeSuccess,
}: VerificationTimelineProps) {
  const daysOld = state.daysOld;

  const [loading, setLoading] = useState<"resend" | "extend" | "purge" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleResend = useCallback(async () => {
    setLoading("resend");
    setActionError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: coach.email,
      });
      if (error) throw error;
      toast.success("Verification email resent.");
      onRefreshCoach?.();
    } catch (err: any) {
      setActionError(err.message ?? "Failed to resend email.");
    } finally {
      setLoading(null);
    }
  }, [coach.email, onRefreshCoach]);

  const handleExtend = useCallback(async () => {
    setLoading("extend");
    setActionError(null);
    try {
      const { error } = await supabase.rpc("admin_extend_purge_deadline", {
        p_coach_id: coach.coach_id,
        p_days: 30,
      });
      if (error) throw error;
      toast.success("Purge deadline extended by 30 days.");
      onRefreshCoach?.();
    } catch (err: any) {
      setActionError(err.message ?? "Failed to extend deadline.");
    } finally {
      setLoading(null);
    }
  }, [coach.coach_id, onRefreshCoach]);

  const handlePurgeNow = useCallback(async () => {
    if (
      !window.confirm(
        "Soft-delete this coach? PII will be anonymized; aggregate counts retained for 275 days."
      )
    )
      return;
    setLoading("purge");
    setActionError(null);
    try {
      const { error } = await supabase.rpc("admin_purge_now", {
        p_coach_id: coach.coach_id,
      });
      if (error) throw error;
      toast.success("Coach account purged.");
      onRefreshCoach?.();
      onPurgeSuccess?.();
    } catch (err: any) {
      setActionError(err.message ?? "Failed to purge coach.");
    } finally {
      setLoading(null);
    }
  }, [coach.coach_id, onRefreshCoach, onPurgeSuccess]);

  // TODO(backend): replace with rows from activity_log filtered by coach_id
  //                + action in ('verification_sent', 'reminder_sent', 'final_notice_sent')
  const events = [
    { day: 0,  label: "Account created",          sent: true, kind: "anchor" as const },
    { day: 7,  label: "Reminder #1 (7-day)",      sent: !!coach.reminder_7d_sent_at, kind: "auto" as const },
    { day: 30, label: "Reminder #2 (30-day)",     sent: !!coach.reminder_30d_sent_at, kind: "auto" as const },
    { day: 60, label: "Reminder #3 (60-day)",     sent: !!coach.reminder_60d_sent_at, kind: "auto" as const },
    { day: 83, label: "Final notice (7d remain)", sent: !!coach.reminder_83d_sent_at, kind: "notice" as const },
    { day: 90, label: "Scheduled purge",          sent: false, kind: "purge" as const },
  ];

  const stageBlurb = {
    nudge: "In nudge phase — automated reminders firing. No admin action required yet.",
    scheduled: `Final notice was sent ${Math.max(0, daysOld - 30)}d ago. Account purges on ${new Date(
      state.purgeDate,
    ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`,
    imminent: `Purges in ${state.daysRemaining}d. Last chance to extend or recover.`,
    soft_deleted: `Account purged${state.hardDeleteAt ? `. Hard-delete on ${new Date(state.hardDeleteAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.` : "."}`,
  }[state.stage];

  const anyLoading = loading !== null;

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
          onClick={handleResend}
          disabled={anyLoading}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "resend"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />
          }
          Resend email
        </button>
        <button
          onClick={handleExtend}
          disabled={anyLoading}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "extend"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Clock className="w-3 h-3" />
          }
          Extend 30d
        </button>
        <button
          onClick={handlePurgeNow}
          disabled={anyLoading}
          className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 text-[11.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "purge"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <UserX className="w-3 h-3" />
          }
          Purge now
        </button>
      </div>

      {actionError && (
        <p className="mt-2 text-[11px] text-red-600 leading-snug">{actionError}</p>
      )}
    </div>
  );
}
