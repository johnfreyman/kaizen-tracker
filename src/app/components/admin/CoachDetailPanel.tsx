import { useEffect, useState, useCallback, useRef } from "react";
import {
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
  MousePointerClick,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";
import type { CoachSummaryRow } from "./CoachDetailDrawer";

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

type TabId = "info" | "team" | "sessions" | "diagnostics" | "actions";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
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
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center shadow-sm border border-indigo-100">
          <MousePointerClick className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
          <Users className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
      <div>
        <p className="font-semibold text-gray-700 text-sm">Select a coach</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[180px] leading-relaxed">
          Click any row in the list to view their profile and manage their account.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function InfoTab({ coach }: { coach: CoachSummaryRow }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Email" icon={Mail} value={coach.email} />
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
      <Field
        label="Coach ID"
        icon={Database}
        value={
          <span className="font-mono text-[11px] text-gray-500 break-all">
            {coach.coach_id}
          </span>
        }
        className="sm:col-span-2"
      />
    </div>
  );
}

function TeamTab({ coach }: { coach: CoachSummaryRow }) {
  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
        {coach.team_logo ? (
          <img
            src={coach.team_logo}
            alt={coach.team_name ?? "Team"}
            className="size-14 rounded-xl object-cover shadow-sm border border-gray-100 shrink-0"
          />
        ) : (
          <div className="size-14 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0">
            <Users className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate">
            {coach.team_name ?? (
              <span className="italic text-gray-400 font-normal">
                No team name set
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {coach.player_count} player{coach.player_count !== 1 ? "s" : ""} on roster
          </p>
          {coach.raffle_enabled && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
              <Zap className="w-3 h-3" />
              Raffle enabled
            </span>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Total Sessions"
          icon={Calendar}
          value={
            <span className="text-indigo-700 font-bold text-base">
              {coach.session_count}
            </span>
          }
        />
        <Field
          label="Archives"
          icon={Archive}
          value={
            <span className="text-indigo-700 font-bold text-base">
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
    </div>
  );
}

function SessionsTab({
  isLoading,
  error,
  detail,
}: {
  isLoading: boolean;
  error: string | null;
  detail: CoachDetail | null;
}) {
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : detail?.recentSessions.length === 0 ? (
        <div className="text-center py-10">
          <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No sessions recorded yet</p>
        </div>
      ) : (
        <>
          {detail?.activeSession && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div>
                <span className="font-semibold">Active session in progress · </span>
                {detail.activeSession.type} · {detail.activeSession.date} ·{" "}
                {detail.activeSession.duration}min
              </div>
            </div>
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Recent Sessions (last 5)
          </p>
          <div className="space-y-2">
            {detail?.recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm text-xs hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-800">{s.date}</span>
                    <span className="text-gray-400 ml-1.5">{s.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <span>{s.duration}min</span>
                  <span className="text-gray-300">·</span>
                  <span>{s.player_count} players</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400">{relativeTime(s.saved_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DiagnosticsTab({
  coach,
  isLoading,
  detail,
}: {
  coach: CoachSummaryRow;
  isLoading: boolean;
  detail: CoachDetail | null;
}) {
  const estimatedDbRows =
    1 + coach.player_count + coach.session_count + coach.total_archives + 1;
  const lastSaveAt = detail?.recentSessions[0]?.saved_at ?? null;

  return (
    <div className="space-y-4">
      {/* Live sync diagnostics */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
          Sync Status
        </p>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <FieldSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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
              className="col-span-2"
            />
          </div>
        )}
      </div>

      {/* Storage usage */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
          Storage Usage
        </p>
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
            icon={HardDrive}
            value={
              <span className="text-gray-700">
                ~{estimatedDbRows.toLocaleString()}
              </span>
            }
          />
        </div>
        <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
          Estimate: 1 profile + {coach.player_count} roster +{" "}
          {coach.session_count} events + {coach.total_archives} archives ={" "}
          ~{estimatedDbRows} rows
        </div>
      </div>
    </div>
  );
}

function ActionsTab({
  coach,
  actionLoading,
  pendingConfirm,
  setPendingConfirm,
  onResetPassword,
  onExportData,
  onServerSideAction,
}: {
  coach: CoachSummaryRow;
  actionLoading: string | null;
  pendingConfirm: string | null;
  setPendingConfirm: (v: string | null) => void;
  onResetPassword: () => void;
  onExportData: () => void;
  onServerSideAction: (label: string) => void;
}) {
  return (
    <div className="space-y-2">
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
            onConfirm={onResetPassword}
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
        onClick={() => onServerSideAction("Resend Onboarding Email")}
      />

      {/* Export data */}
      <ActionButton
        label="Export Coach Data"
        icon={Download}
        variant="success"
        loading={actionLoading === "export"}
        disabled={!!actionLoading}
        onClick={onExportData}
      />

      {/* Disable account */}
      <ActionButton
        label="Disable Account"
        icon={UserX}
        variant="danger"
        disabled={!!actionLoading}
        onClick={() => onServerSideAction("Disable Account")}
      />

      {/* Force logout */}
      <ActionButton
        label="Force Logout"
        icon={LogOut}
        variant="warning"
        disabled={!!actionLoading}
        onClick={() => onServerSideAction("Force Logout")}
      />

      <p className="text-[10px] text-gray-400 pt-1 leading-relaxed">
        Disable, force-logout, and onboarding actions require server-side admin
        access via Supabase Dashboard or a privileged Edge Function.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABS config
// ---------------------------------------------------------------------------

const TABS: Tab[] = [
  { id: "info", label: "Info", icon: Mail },
  { id: "team", label: "Team", icon: Users },
  { id: "sessions", label: "Sessions", icon: Calendar },
  { id: "diagnostics", label: "Diagnostics", icon: AlertTriangle },
  { id: "actions", label: "Actions", icon: ShieldCheck },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CoachDetailPanelProps {
  coach: CoachSummaryRow | null;
}

export default function CoachDetailPanel({ coach }: CoachDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [detail, setDetail] = useState<CoachDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  // Track previous coach id for animation keying
  const prevCoachId = useRef<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Reset tab & fire animation when coach changes
  useEffect(() => {
    if (coach?.coach_id !== prevCoachId.current) {
      prevCoachId.current = coach?.coach_id ?? null;
      setActiveTab("info");
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
    toast.info(
      `"${label}" requires server-side admin access — use the Supabase Dashboard or a privileged Edge Function.`
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const accountStatus = coach ? getAccountStatus(coach) : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-100">
      {!coach ? (
        <EmptyState />
      ) : (
        <div
          key={animKey}
          className="flex flex-col h-full animate-panel-slide-in"
          style={{
            animation: "panelSlideIn 0.2s ease-out both",
          }}
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-white">
            {/* Status badge + email */}
            <div className="flex items-start gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-gray-900 truncate max-w-full">
                {coach.email}
              </h2>
              {accountStatus && (
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0",
                    accountStatus.className
                  )}
                >
                  {accountStatus.label}
                </span>
              )}
            </div>

            {/* Stat pills */}
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-100 shadow-sm text-xs text-gray-600 font-medium">
                <Users className="w-3 h-3 text-blue-400" />
                {coach.player_count} players
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-100 shadow-sm text-xs text-gray-600 font-medium">
                <Calendar className="w-3 h-3 text-indigo-400" />
                {coach.session_count} sessions
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-100 shadow-sm text-xs text-gray-600 font-medium">
                <Archive className="w-3 h-3 text-violet-400" />
                {coach.total_archives} archives
              </span>
              {coach.team_name && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-100 shadow-sm text-xs text-gray-600 font-medium truncate max-w-[140px]">
                  {coach.team_logo && (
                    <img
                      src={coach.team_logo}
                      alt=""
                      className="w-3.5 h-3.5 rounded object-cover shrink-0"
                    />
                  )}
                  {coach.team_name}
                </span>
              )}
            </div>
          </div>

          {/* ── Tabs ────────────────────────────────────────────── */}
          <div
            className="shrink-0 flex items-center gap-0.5 px-3 pt-2 pb-0 border-b border-gray-100 bg-white overflow-x-auto"
            role="tablist"
            aria-label="Coach detail sections"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all",
                    "border-b-2 -mb-px",
                    isActive
                      ? "border-indigo-500 text-indigo-600 bg-indigo-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Tab panels (scrollable body) ─────────────────────── */}
          <div
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="flex-1 overflow-y-auto overscroll-contain p-4 scrollbar-gutter-stable"
            style={{ scrollbarGutter: "stable" }}
          >
            <div
              key={activeTab}
              style={{ animation: "tabFadeIn 0.15s ease-out both" }}
            >
              {activeTab === "info" && <InfoTab coach={coach} />}
              {activeTab === "team" && <TeamTab coach={coach} />}
              {activeTab === "sessions" && (
                <SessionsTab
                  isLoading={isLoadingDetail}
                  error={detailError}
                  detail={detail}
                />
              )}
              {activeTab === "diagnostics" && (
                <DiagnosticsTab
                  coach={coach}
                  isLoading={isLoadingDetail}
                  detail={detail}
                />
              )}
              {activeTab === "actions" && (
                <ActionsTab
                  coach={coach}
                  actionLoading={actionLoading}
                  pendingConfirm={pendingConfirm}
                  setPendingConfirm={setPendingConfirm}
                  onResetPassword={handleResetPassword}
                  onExportData={handleExportData}
                  onServerSideAction={handleServerSideAction}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations injected via a style tag */}
      <style>{`
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
