import { useEffect, useState, useCallback, useRef } from "react";
import {
  Send,
  Loader2,
  MousePointerClick,
  Users,
  RefreshCw,
  LogOut,
  UserX,
  Download,
  AlertTriangle,
  Calendar,
  Clock,
  ShieldOff,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";
import type { CoachSummaryRow } from "./CoachDetailDrawer";
import {
  getSemanticStatus,
  SEMANTIC_CONFIG,
} from "../SuperAdminDashboard";
import { getPurgeState } from "./getPurgeState";
import { PurgeBadge } from "./PurgeBadge";
import { VerificationTimeline } from "./VerificationTimeline";
import { TeamLogo } from "./TeamLogo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentSession {
  id: string;
  date: string;
  type: string;
  duration: number;
  player_count: number;
  saved_at: string;
}

interface ActiveSessionData {
  id: string;
  date: string;
  type: string;
  duration: number;
}

interface CoachDetail {
  recentSessions: RecentSession[];
  activeSession: ActiveSessionData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Uppercase section label */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </p>
  );
}

/** A label/value row inside the Account section */
function AccountRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={cn("text-slate-800 text-right truncate", valueClass)}>
        {value}
      </span>
    </div>
  );
}

/** Action button — full-width text button, no border chrome */
function TextAction({
  label,
  icon: Icon,
  onClick,
  danger = false,
  loading = false,
  disabled = false,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium",
        "hover:bg-slate-100 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        danger ? "text-red-600" : "text-slate-700"
      )}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        <Icon className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{label}</span>
    </button>
  );
}

/** Inline confirm strip */
function ConfirmBanner({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="mx-2.5 mb-1 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 animate-in fade-in slide-in-from-top-1 duration-150">
      <p className="font-semibold mb-2">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Working…" : "Confirm"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-amber-700 text-[10px] font-bold hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-50/20">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center shadow border border-indigo-100/50">
          <MousePointerClick className="w-7 h-7 text-indigo-500 animate-bounce" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow-md">
          <Users className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
      <div>
        <p className="font-bold text-gray-800 text-sm">Select a Coach Profile</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[220px] leading-relaxed font-medium">
          Click any row in the admin roster to explore their real-time activity,
          metrics, and account controls.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CoachDetailPanelProps {
  coach: CoachSummaryRow | null;
}

export default function CoachDetailPanel({ coach }: CoachDetailPanelProps) {
  const [detail, setDetail] = useState<CoachDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  // Track previous coach id for animation keying
  const prevCoachId = useRef<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Reset states & fire animation when coach changes
  useEffect(() => {
    if (coach?.coach_id !== prevCoachId.current) {
      prevCoachId.current = coach?.coach_id ?? null;
      setPendingConfirm(null);
      setAnimKey((k) => k + 1);
    }
  }, [coach?.coach_id]);

  // Lazy-load detail data whenever a new coach is selected
  useEffect(() => {
    if (!coach) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    setDetailError(null);
    setDetail(null);

    async function load() {
      try {
        const [sessionsRes, activeRes] = await Promise.all([
          supabase
            .from("events")
            .select("id, date, type, duration, players, saved_at")
            .eq("coach_id", coach!.coach_id)
            .order("saved_at", { ascending: false })
            .limit(5),
          supabase
            .from("active_session")
            .select("id, date, type, duration")
            .eq("coach_id", coach!.coach_id)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        if (sessionsRes.error) throw sessionsRes.error;

        const sessions: RecentSession[] = (sessionsRes.data ?? []).map(
          (s: any) => ({
            id: s.id,
            date: s.date,
            type: s.type,
            duration: Number(s.duration),
            player_count: Array.isArray(s.players) ? s.players.length : 0,
            saved_at: s.saved_at,
          })
        );

        setDetail({
          recentSessions: sessions,
          activeSession: activeRes.data
            ? {
                id: activeRes.data.id,
                date: activeRes.data.date,
                type: activeRes.data.type,
                duration: Number(activeRes.data.duration),
              }
            : null,
        });
      } catch (err: any) {
        if (!cancelled)
          setDetailError(err.message ?? "Failed to load coach details.");
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [coach?.coach_id]);

  // ---------------------------------------------------------------------------
  // Admin actions
  // ---------------------------------------------------------------------------

  const handleResetPassword = useCallback(async () => {
    if (!coach) return;
    setActionLoading("reset-password");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(coach.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${coach.email}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send reset email.");
    } finally {
      setActionLoading(null);
      setPendingConfirm(null);
    }
  }, [coach]);

  const handleExportData = useCallback(async () => {
    if (!coach) return;
    setActionLoading("export");
    try {
      const [eventsRes, rosterRes, archivesRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, date, type, duration, saved_at")
          .eq("coach_id", coach.coach_id)
          .order("saved_at", { ascending: false }),
        supabase
          .from("roster")
          .select("id, name, is_guest")
          .eq("coach_id", coach.coach_id),
        supabase
          .from("archived_event_sets")
          .select("id, archived_at")
          .eq("coach_id", coach.coach_id)
          .order("archived_at", { ascending: false }),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (rosterRes.error) throw rosterRes.error;
      if (archivesRes.error) throw archivesRes.error;

      const exportData = {
        exported_at: new Date().toISOString(),
        coach: {
          id: coach.coach_id,
          email: coach.email,
          account_created_at: coach.account_created_at,
          auth_provider: coach.auth_provider,
          email_verified: coach.email_verified,
        },
        team: { name: coach.team_name, raffle_enabled: coach.raffle_enabled },
        roster: rosterRes.data ?? [],
        sessions: eventsRes.data ?? [],
        archives: archivesRes.data ?? [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coach-${coach.email.split("@")[0]}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Coach data exported successfully.");
    } catch (err: any) {
      toast.error(err.message ?? "Export failed.");
    } finally {
      setActionLoading(null);
    }
  }, [coach]);

  const handleServerSideAction = useCallback((label: string) => {
    toast.info(
      `"${label}" requires server-side admin access — use the Supabase Dashboard or a privileged Edge Function.`
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const purge = coach ? getPurgeState(coach) : null;
  const status = coach ? getSemanticStatus(coach, !!detail?.activeSession) : "healthy";
  const cfg = SEMANTIC_CONFIG[status];

  // Open issue badges (no Purge — that's handled by PurgeBadge)
  const issueBadges: { label: string; bg: string; icon: React.ElementType }[] = [];
  if (coach) {
    if (!coach.team_name) {
      issueBadges.push({
        label: "No team",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: AlertTriangle,
      });
    }
    if (coach.last_active_at) {
      const days = (Date.now() - new Date(coach.last_active_at).getTime()) / 86400000;
      if (days > 30) {
        issueBadges.push({
          label: "Inactive 30d",
          bg: "bg-gray-100 text-gray-700 border-gray-200",
          icon: Clock,
        });
      }
    } else {
      issueBadges.push({
        label: "Inactive 30d",
        bg: "bg-gray-100 text-gray-700 border-gray-200",
        icon: Clock,
      });
    }
  }

  const hasOpenIssues = purge !== null || issueBadges.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-100">
      {!coach ? (
        <EmptyState />
      ) : (
        <div
          key={animKey}
          className="flex flex-col h-full overflow-hidden"
          style={{ animation: "panelSlideIn 0.2s ease-out both" }}
        >
          {/* ── Section 1: Header ── */}
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-start gap-3">
              {/* Logo */}
              <TeamLogo team={coach.team_name} logoUrl={coach.team_logo} size={44} />

              {/* Name + email */}
              <div className="min-w-0 flex-1">
                <p
                  className="text-[14px] font-semibold text-slate-800 truncate leading-snug"
                  title={coach.team_name ?? undefined}
                >
                  {coach.team_name ?? (
                    <span className="italic text-slate-400 font-normal">No team registered</span>
                  )}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[8px] font-bold shrink-0 uppercase">
                    {coach.email[0]}
                  </div>
                  <span
                    className="text-[12px] text-slate-500 truncate"
                    title={coach.email}
                  >
                    {coach.email}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable divide-y divide-slate-100">

            {/* ── Section 2: Status row ── */}
            <div className="px-4 py-3 flex items-center justify-between">
              <SectionLabel>Status</SectionLabel>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-wide",
                  cfg.bgClass,
                  cfg.borderClass
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotClass)} />
                {cfg.badgeLabel}
              </span>
            </div>

            {/* ── Section 3: Open issues (conditional) ── */}
            {hasOpenIssues && (
              <div className="px-4 py-3 space-y-2">
                <SectionLabel>Open Issues</SectionLabel>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {purge && <PurgeBadge state={purge} size="md" />}
                  {issueBadges.map((badge, idx) => {
                    const BadgeIcon = badge.icon;
                    return (
                      <span
                        key={idx}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border",
                          badge.bg
                        )}
                      >
                        <BadgeIcon className="w-3 h-3 shrink-0" />
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Section 4: Verification timeline (conditional) ── */}
            {purge && (
              <div className="px-4 py-3">
                <VerificationTimeline
                  coach={coach}
                  state={purge}
                  onResend={() => handleServerSideAction("Resend Verification Email")}
                  onExtend={() => handleServerSideAction("Extend Purge Window")}
                  onPurgeNow={() => handleServerSideAction("Purge Coach Now")}
                />
              </div>
            )}

            {/* ── Section 5: Stats — 2×2 hairline grid ── */}
            <div className="py-3">
              <div className="px-4 mb-2">
                <SectionLabel>Stats</SectionLabel>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100 border-y border-slate-100">
                {[
                  { label: "Players", value: coach.player_count },
                  { label: "Sessions", value: coach.session_count },
                  { label: "Archives", value: coach.total_archives },
                  { label: "Raffle", value: coach.raffle_enabled ? "On" : "Off" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white px-4 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      {label}
                    </p>
                    <p className="text-[18px] font-bold tabular-nums text-slate-800 leading-snug">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 6: Account ── */}
            <div className="px-4 py-3 space-y-2.5">
              <SectionLabel>Account</SectionLabel>
              <div className="space-y-2 mt-1">
                <AccountRow label="Joined" value={shortDate(coach.account_created_at)} />
                <AccountRow
                  label="Last sign-in"
                  value={coach.last_sign_in_at ? relativeTime(coach.last_sign_in_at) : "Never"}
                />
                <AccountRow
                  label="Last active"
                  value={relativeTime(coach.last_active_at)}
                />
                <AccountRow
                  label="Last session"
                  value={coach.last_session_at ? relativeTime(coach.last_session_at) : "—"}
                />
                <AccountRow
                  label="Auth provider"
                  value={
                    coach.auth_provider
                      ? coach.auth_provider.charAt(0).toUpperCase() + coach.auth_provider.slice(1)
                      : "—"
                  }
                />
                <AccountRow
                  label="Email verified"
                  value={coach.email_verified ? "Yes" : "No"}
                  valueClass={coach.email_verified ? undefined : "text-red-600 font-semibold"}
                />
              </div>
            </div>

            {/* ── Section 7: Recent sessions ── */}
            <div className="px-4 py-3 space-y-2">
              <SectionLabel>Recent Sessions</SectionLabel>

              {detail?.activeSession && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <span className="truncate">
                    Active:{" "}
                    <span className="font-bold">{detail.activeSession.type}</span> ·{" "}
                    {detail.activeSession.duration} min
                  </span>
                </div>
              )}

              {isLoadingDetail ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : detailError ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {detailError}
                </div>
              ) : !detail || detail.recentSessions.length === 0 ? (
                <div className="text-center py-5 border border-dashed border-slate-200 rounded-lg">
                  <Calendar className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-400 italic">No saved sessions found.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {detail.recentSessions.map((s, idx) => (
                    <div
                      key={s.id}
                      className={cn(
                        "py-2",
                        idx < detail.recentSessions.length - 1 && "border-b border-slate-50"
                      )}
                    >
                      {/* Line 1: date on left, type + duration on right */}
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-slate-800">{s.date}</span>
                        <span className="text-[11px] text-slate-500">
                          {s.type} · {s.duration} min
                        </span>
                      </div>
                      {/* Line 2: player count */}
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {s.player_count} player{s.player_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 8: Actions ── */}
            <div className="px-4 py-3 space-y-0.5">
              <div className="mb-1">
                <SectionLabel>Actions</SectionLabel>
              </div>

              {/* Resend verification — disabled if already verified */}
              <TextAction
                label="Resend verification"
                icon={Send}
                disabled={coach.email_verified || !!actionLoading}
                onClick={() => handleServerSideAction("Resend Verification Email")}
              />

              {/* View as coach */}
              <TextAction
                label="View as coach"
                icon={ArrowUpRight}
                disabled={!!actionLoading}
                onClick={() => handleServerSideAction("View As Coach")}
              />

              {/* Export data */}
              <TextAction
                label="Export data"
                icon={Download}
                loading={actionLoading === "export"}
                disabled={!!actionLoading}
                onClick={handleExportData}
              />

              {/* Reset password */}
              <div>
                <TextAction
                  label="Reset password"
                  icon={RefreshCw}
                  loading={actionLoading === "reset-password"}
                  disabled={!!actionLoading}
                  onClick={() =>
                    setPendingConfirm(
                      pendingConfirm === "reset-password" ? null : "reset-password"
                    )
                  }
                />
                {pendingConfirm === "reset-password" && (
                  <ConfirmBanner
                    message={`Send password reset email to ${coach.email}?`}
                    loading={actionLoading === "reset-password"}
                    onConfirm={handleResetPassword}
                    onCancel={() => setPendingConfirm(null)}
                  />
                )}
              </div>

              {/* Force logout */}
              <TextAction
                label="Force logout"
                icon={LogOut}
                disabled={!!actionLoading}
                onClick={() => handleServerSideAction("Force Logout")}
              />

              {/* Suspend account — danger */}
              <TextAction
                label="Suspend account"
                icon={UserX}
                danger
                disabled={!!actionLoading}
                onClick={() => handleServerSideAction("Disable Account")}
              />
            </div>

          </div>
        </div>
      )}

      {/* Keyframe animation */}
      <style>{`
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
