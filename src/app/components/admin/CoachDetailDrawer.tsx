import { useEffect, useState, useCallback } from "react";
import {
  X,
  Mail,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldOff,
  Users,
  Archive,
  Activity,
  AlertTriangle,
  Database,
  Image as ImageIcon,
  Download,
  UserX,
  LogOut,
  Send,
  Loader2,
  HardDrive,
  Zap,
  RefreshCw,
  CheckCircle2,
  ServerOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";

// ---------------------------------------------------------------------------
// Types — exported so SuperAdminDashboard can import the shared interface
// ---------------------------------------------------------------------------

export interface CoachSummaryRow {
  coach_id: string;
  email: string;
  account_created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  auth_provider: string | null;
  team_name: string | null;
  team_logo: string | null;
  raffle_enabled: boolean | null;
  player_count: number;
  session_count: number;
  last_session_at: string | null;
  total_archives: number;
  last_active_at: string | null;
  email_verified: boolean;
}

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

export interface CoachDetailDrawerProps {
  coach: CoachSummaryRow | null;
  onClose: () => void;
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

function getAccountStatus(coach: CoachSummaryRow): {
  label: string;
  className: string;
} {
  if (!coach.email_verified)
    return { label: "Unverified", className: "bg-red-100 text-red-600 border-red-200" };
  if (!coach.team_name)
    return { label: "No Team Setup", className: "bg-gray-100 text-gray-500 border-gray-200" };
  if (!coach.last_active_at)
    return { label: "Inactive", className: "bg-amber-100 text-amber-700 border-amber-200" };
  const daysSince =
    (Date.now() - new Date(coach.last_active_at).getTime()) / 86_400_000;
  return daysSince <= 30
    ? { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
    : { label: "Inactive", className: "bg-amber-100 text-amber-700 border-amber-200" };
}

// ---------------------------------------------------------------------------
// Primitive sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-gray-100">
        <span className="p-1.5 rounded-lg bg-white shadow-sm border border-gray-100">
          <Icon className="w-3.5 h-3.5 text-indigo-500" />
        </span>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {Icon && (
        <span className="mt-0.5 p-1 bg-white rounded-md shrink-0 border border-gray-100 shadow-sm">
          <Icon className="w-3 h-3 text-gray-400" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
          {label}
        </p>
        <div className="text-sm text-gray-800 font-medium break-all leading-snug">
          {value}
        </div>
      </div>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="flex items-start gap-2">
      <Skeleton className="w-6 h-6 rounded-md shrink-0 bg-gray-200" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-2.5 w-14 rounded bg-gray-200" />
        <Skeleton className="h-4 w-28 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  variant = "default",
  loading = false,
  disabled = false,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: "default" | "danger" | "warning" | "success";
  loading?: boolean;
  disabled?: boolean;
}) {
  const variantClass: Record<string, string> = {
    default:
      "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300",
    danger:
      "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium",
        "transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full",
        variantClass[variant]
      )}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        <Icon className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

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
    <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
      <p className="mb-2.5 font-medium text-xs">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? "Working…" : "Confirm"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function UnavailableBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-md">
      <ServerOff className="w-2.5 h-2.5" />
      No log table
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CoachDetailDrawer({ coach, onClose }: CoachDetailDrawerProps) {
  const isOpen = !!coach;

  const [detail, setDetail] = useState<CoachDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Lazy-load detail data whenever the drawer opens for a new coach
  useEffect(() => {
    if (!coach) {
      setDetail(null);
      setDetailError(null);
      setPendingConfirm(null);
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
        if (!cancelled) setDetailError(err.message ?? "Failed to load coach details.");
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
      toast.success("Coach data exported.");
    } catch (err: any) {
      toast.error(err.message ?? "Export failed.");
    } finally {
      setActionLoading(null);
    }
  }, [coach]);

  const handleServerSideAction = useCallback((label: string) => {
    toast.info(`"${label}" requires server-side admin access — use the Supabase Dashboard or a privileged Edge Function.`);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const estimatedDbRows = coach
    ? 1 + coach.player_count + coach.session_count + coach.total_archives + 1
    : 0;

  const accountStatus = coach ? getAccountStatus(coach) : null;
  const lastSaveAt = detail?.recentSessions[0]?.saved_at ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={coach ? `Coach details: ${coach.email}` : "Coach details"}
        className={cn(
          "fixed top-0 right-0 h-full z-50 w-full sm:max-w-[560px] bg-white shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {coach && (
          <>
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {coach.email}
                  </h2>
                  {accountStatus && (
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                        accountStatus.className
                      )}
                    >
                      {accountStatus.label}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">
                  {coach.coach_id}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body (scrollable) ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">

              {/* ── SECTION 1: Coach Info ──────────────────────────── */}
              <Section title="Coach Info" icon={Mail}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Email"
                    icon={Mail}
                    value={coach.email}
                  />
                  <Field
                    label="Auth Provider"
                    icon={ShieldCheck}
                    value={
                      coach.auth_provider
                        ? coach.auth_provider.charAt(0).toUpperCase() +
                          coach.auth_provider.slice(1)
                        : "—"
                    }
                  />
                  <Field
                    label="Created"
                    icon={Calendar}
                    value={shortDate(coach.account_created_at)}
                  />
                  <Field
                    label="Last Login"
                    icon={Clock}
                    value={
                      coach.last_sign_in_at ? (
                        <span>
                          {relativeTime(coach.last_sign_in_at)}
                          <span className="text-gray-400 font-normal">
                            {" · "}
                            {shortDate(coach.last_sign_in_at)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )
                    }
                  />
                  <Field
                    label="Last Active"
                    icon={Activity}
                    value={
                      coach.last_active_at ? (
                        <span>
                          {relativeTime(coach.last_active_at)}
                          <span className="text-gray-400 font-normal">
                            {" · "}
                            {shortDate(coach.last_active_at)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">No activity</span>
                      )
                    }
                  />
                  <Field
                    label="Email Verified"
                    icon={coach.email_verified ? ShieldCheck : ShieldOff}
                    value={
                      coach.email_verified ? (
                        <span className="text-emerald-600">Verified</span>
                      ) : (
                        <span className="text-red-500">Not verified</span>
                      )
                    }
                  />
                </div>
              </Section>

              {/* ── SECTION 2: Team Snapshot ───────────────────────── */}
              <Section title="Team Snapshot" icon={Users}>
                {/* Team header */}
                <div className="flex items-center gap-3 pb-2">
                  {coach.team_logo ? (
                    <img
                      src={coach.team_logo}
                      alt={coach.team_name ?? "Team"}
                      className="size-12 rounded-xl object-cover shadow-sm border border-gray-100"
                    />
                  ) : (
                    <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200">
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {coach.team_name ?? (
                        <span className="italic text-gray-400">No team name</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {coach.player_count} player
                      {coach.player_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {coach.raffle_enabled && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                      <Zap className="w-3 h-3" />
                      Raffle on
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Total Sessions"
                    icon={Calendar}
                    value={
                      <span className="text-indigo-700 font-bold">
                        {coach.session_count}
                      </span>
                    }
                  />
                  <Field
                    label="Archives"
                    icon={Archive}
                    value={
                      <span className="text-indigo-700 font-bold">
                        {coach.total_archives}
                      </span>
                    }
                  />
                  <Field
                    label="Last Session"
                    icon={Clock}
                    value={
                      coach.last_session_at
                        ? relativeTime(coach.last_session_at)
                        : <span className="text-gray-400">No sessions yet</span>
                    }
                  />
                  <Field
                    label="Raffle Usage"
                    icon={Zap}
                    value={
                      coach.raffle_enabled ? (
                        <span className="text-violet-700">Enabled</span>
                      ) : (
                        <span className="text-gray-400">Disabled</span>
                      )
                    }
                  />
                </div>

                {/* Recent sessions list */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Recent Sessions
                  </p>
                  {isLoadingDetail ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-8 w-full rounded-lg bg-gray-200" />
                      ))}
                    </div>
                  ) : detailError ? (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {detailError}
                    </p>
                  ) : detail?.recentSessions.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No sessions recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail?.recentSessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">
                              {s.date}
                            </span>
                            <span className="text-gray-400">{s.type}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <span>{s.duration}min</span>
                            <span className="text-gray-300">·</span>
                            <span>{s.player_count} players</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              {/* ── SECTION 3: Diagnostics ────────────────────────── */}
              <Section title="Diagnostics" icon={AlertTriangle}>
                {isLoadingDetail ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <FieldSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Pending Save"
                      icon={RefreshCw}
                      value={
                        detail?.activeSession ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                            Session in progress
                          </span>
                        ) : (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            None
                          </span>
                        )
                      }
                    />
                    <Field
                      label="Last Save"
                      icon={Clock}
                      value={
                        lastSaveAt
                          ? relativeTime(lastSaveAt)
                          : <span className="text-gray-400">—</span>
                      }
                    />
                    <Field
                      label="Failed Sync Count"
                      icon={AlertTriangle}
                      value={<UnavailableBadge />}
                    />
                    <Field
                      label="Offline Recovery Events"
                      icon={RefreshCw}
                      value={<UnavailableBadge />}
                    />
                    <Field
                      label="Recent Errors"
                      icon={AlertTriangle}
                      value={<UnavailableBadge />}
                      className="sm:col-span-2"
                    />
                    {detail?.activeSession && (
                      <div className="sm:col-span-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <p className="font-semibold mb-0.5">Active session found</p>
                        <p>
                          {detail.activeSession.type} · {detail.activeSession.date} ·{" "}
                          {detail.activeSession.duration}min
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* ── SECTION 4: Storage Usage ───────────────────────── */}
              <Section title="Storage Usage" icon={HardDrive}>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Logo Upload"
                    icon={ImageIcon}
                    value={
                      coach.team_logo ? (
                        <span className="text-emerald-600">1 logo stored</span>
                      ) : (
                        <span className="text-gray-400">No logo</span>
                      )
                    }
                  />
                  <Field
                    label="Archive Sets"
                    icon={Archive}
                    value={
                      <span className="text-indigo-700 font-bold">
                        {coach.total_archives}
                      </span>
                    }
                  />
                  <Field
                    label="Session Count"
                    icon={Database}
                    value={
                      <span className="text-indigo-700 font-bold">
                        {coach.session_count}
                      </span>
                    }
                  />
                  <Field
                    label="Estimated DB Rows"
                    icon={Database}
                    value={
                      <span className="text-gray-700">
                        ~{estimatedDbRows.toLocaleString()}
                      </span>
                    }
                  />
                </div>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
                  Estimate: 1 profile + {coach.player_count} roster +{" "}
                  {coach.session_count} events + {coach.total_archives} archives = ~
                  {estimatedDbRows} rows
                </div>
              </Section>

              {/* ── SECTION 5: Admin Actions ───────────────────────── */}
              <Section title="Admin Actions" icon={ShieldCheck}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                  {/* Reset password */}
                  <div>
                    <ActionButton
                      label="Reset Password"
                      icon={RefreshCw}
                      variant="default"
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
                        message={`Send a password reset email to ${coach.email}?`}
                        loading={actionLoading === "reset-password"}
                        onConfirm={handleResetPassword}
                        onCancel={() => setPendingConfirm(null)}
                      />
                    )}
                  </div>

                  {/* Resend onboarding */}
                  <ActionButton
                    label="Resend Onboarding"
                    icon={Send}
                    variant="default"
                    disabled={!!actionLoading}
                    onClick={() => handleServerSideAction("Resend Onboarding Email")}
                  />

                  {/* Disable account */}
                  <div>
                    <ActionButton
                      label="Disable Account"
                      icon={UserX}
                      variant="danger"
                      disabled={!!actionLoading}
                      onClick={() => handleServerSideAction("Disable Account")}
                    />
                  </div>

                  {/* Export data */}
                  <ActionButton
                    label="Export Coach Data"
                    icon={Download}
                    variant="success"
                    loading={actionLoading === "export"}
                    disabled={!!actionLoading}
                    onClick={handleExportData}
                  />

                  {/* Force logout */}
                  <div className="sm:col-span-2">
                    <ActionButton
                      label="Force Logout"
                      icon={LogOut}
                      variant="warning"
                      disabled={!!actionLoading}
                      onClick={() => handleServerSideAction("Force Logout")}
                    />
                  </div>
                </div>
              </Section>

              {/* bottom padding for mobile scroll */}
              <div className="h-4" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
