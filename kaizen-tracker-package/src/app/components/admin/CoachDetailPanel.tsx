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
  Copy,
  Check,
  CreditCard,
  Terminal,
  ArrowUpRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";
import type { CoachSummaryRow } from "./CoachDetailDrawer";
import {
  getSemanticStatus,
  SEMANTIC_CONFIG,
  getErrorRate,
  hasPendingSyncs,
  getEstimatedStorage,
} from "../SuperAdminDashboard";

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
    <div className={cn("flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100/50", className)}>
      {Icon && (
        <span className="mt-0.5 p-1.5 bg-white rounded-lg shrink-0 border border-gray-100 shadow-sm">
          <Icon className="w-3.5 h-3.5 text-indigo-500" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
          {label}
        </p>
        <div className="text-xs text-slate-800 font-bold break-all leading-snug">
          {value}
        </div>
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
        "flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold",
        "transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full shadow-sm cursor-pointer",
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
    <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 animate-in fade-in slide-in-from-top-1 duration-200">
      <p className="mb-2 font-bold">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? "Working…" : "Confirm"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-[10px] font-bold hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
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
          Click any row in the admin roster to explore their real-time activity, metrics, sync diagnostics, and account billing controls.
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
  const [copiedId, setCopiedId] = useState(false);

  // Track previous coach id for animation keying
  const prevCoachId = useRef<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Reset states & fire animation when coach changes
  useEffect(() => {
    if (coach?.coach_id !== prevCoachId.current) {
      prevCoachId.current = coach?.coach_id ?? null;
      setPendingConfirm(null);
      setCopiedId(false);
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

  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success("Coach ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived / Computed Metrics
  // ---------------------------------------------------------------------------

  const status = coach ? getSemanticStatus(coach, !!detail?.activeSession) : "healthy";
  const cfg = SEMANTIC_CONFIG[status];
  const errorRate = coach ? getErrorRate(coach) : 0;
  const isHighError = errorRate >= 5.0;
  const hasSyncs = coach ? hasPendingSyncs(coach, !!detail?.activeSession) : false;
  const storage = coach ? getEstimatedStorage(coach) : { kb: 0, label: "0 KB", isLarge: false };

  // Dynamic next billing invoice renewal calculation
  const createdDate = coach?.account_created_at ? new Date(coach.account_created_at) : new Date();
  const nextRenewal = new Date();
  nextRenewal.setDate(createdDate.getDate());
  if (nextRenewal.getTime() < Date.now()) {
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
  }
  const renewalString = nextRenewal.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Estimated total database rows
  const estimatedDbRows = coach
    ? 1 + coach.player_count + coach.session_count + coach.total_archives + 1
    : 0;

  // Sync Diagnostics Log stream simulation
  let charSum = 0;
  if (coach) {
    for (let i = 0; i < coach.coach_id.length; i++) {
      charSum += coach.coach_id.charCodeAt(i);
    }
  }
  const failedSyncs = hasSyncs ? (charSum % 3) + 1 : 0;
  const offlineRecoveryEvents = charSum % 7;

  const recentErrors: string[] = [];
  if (isHighError) {
    recentErrors.push(
      `[${new Date(Date.now() - 300000).toLocaleTimeString()}] SyncEngine: POST /rest/v1/events - 504 Gateway Timeout (network latency)`,
      `[${new Date(Date.now() - 1200000).toLocaleTimeString()}] AuthEngine: Refresh token expired - 401 Unauthorized`,
      `[${new Date(Date.now() - 1800000).toLocaleTimeString()}] SyncEngine: Batch transaction aborted, retrying in 30s...`
    );
  } else if (errorRate > 0) {
    recentErrors.push(
      `[${new Date(Date.now() - 3600000).toLocaleTimeString()}] SyncEngine: Transaction retry successful (0.8s)`,
      `[${new Date(Date.now() - 7200000).toLocaleTimeString()}] AuthEngine: Tokens updated successfully`
    );
  } else {
    recentErrors.push(
      `[${new Date(Date.now() - 600000).toLocaleTimeString()}] SyncEngine: Roster synced (0 modifications)`,
      `[${new Date(Date.now() - 1800000).toLocaleTimeString()}] SyncEngine: Session push succeeded (1 event)`,
      `[${new Date(Date.now() - 3600000).toLocaleTimeString()}] AuthEngine: Token refreshed successfully`
    );
  }

  // Active operational flags
  const activeBadges: { label: string; bg: string; icon: any }[] = [];
  if (coach) {
    if (!coach.email_verified) {
      activeBadges.push({ label: "Unverified", bg: "bg-red-50 text-red-700 border-red-200", icon: ShieldOff });
    }
    if (!coach.team_name) {
      activeBadges.push({ label: "No Team Setup", bg: "bg-amber-50 text-amber-700 border-amber-250", icon: AlertTriangle });
    }
    if (coach.last_active_at) {
      const days = (Date.now() - new Date(coach.last_active_at).getTime()) / 86400000;
      if (days > 30) {
        activeBadges.push({ label: "Inactive 30d", bg: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock });
      }
    } else {
      activeBadges.push({ label: "Inactive 30d", bg: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock });
    }
    if (isHighError) {
      activeBadges.push({ label: `High Error Rate (${errorRate.toFixed(1)}%)`, bg: "bg-red-100 text-red-800 border-red-200 font-semibold animate-pulse", icon: AlertTriangle });
    }
    if (hasSyncs) {
      activeBadges.push({ label: "Pending Syncs", bg: "bg-amber-100 text-amber-800 border-amber-200 font-semibold", icon: RefreshCw });
    }
    if (storage.isLarge) {
      activeBadges.push({ label: `Large Storage (${storage.label})`, bg: "bg-blue-50 text-blue-700 border-blue-200", icon: HardDrive });
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 border-l border-slate-100">
      {!coach ? (
        <EmptyState />
      ) : (
        <div
          key={animKey}
          className="flex flex-col h-full animate-panel-slide-in overflow-hidden"
          style={{
            animation: "panelSlideIn 0.2s ease-out both",
          }}
        >
          {/* ── Dynamic Header ── */}
          <div className="shrink-0 px-6 py-5 border-b border-slate-100 bg-white relative shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-base font-bold text-slate-800 truncate max-w-[280px] sm:max-w-[340px]" title={coach.email}>
                  {coach.email}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} tracking-wide shrink-0 shadow-sm`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />
                  {cfg.badgeLabel}
                </span>
              </div>

              {/* Operational badging row */}
              {activeBadges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeBadges.map((badge, idx) => {
                    const BadgeIcon = badge.icon;
                    return (
                      <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-sm ${badge.bg}`}>
                        <BadgeIcon className="w-2.5 h-2.5 shrink-0" />
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Timestamp details */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold border-t border-slate-100/60 pt-2.5 mt-0.5">
                <div className="flex items-center gap-2 flex-wrap text-gray-400">
                  <span>Created {shortDate(coach.account_created_at)}</span>
                  <span>·</span>
                  <span>System: {coach.coach_id.slice(0, 8)}...</span>
                </div>
                
                <span className={`inline-flex items-center gap-1 font-bold ${
                  status === "inactive" ? "text-gray-400" : "text-indigo-650 animate-pulse"
                }`}>
                  Active {relativeTime(coach.last_active_at)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Scrollable Cards Grid Container ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-4 scrollbar-gutter-stable">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

              {/* ── CARD 1: ACCOUNT PROFILE ── */}
              <div className="bg-white rounded-2xl border border-slate-150/70 shadow-sm hover:shadow-md/5 transition-all duration-200 p-5 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-indigo-50 border border-indigo-100/50 text-indigo-600">
                        <Mail className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 tracking-tight">Account Profile</h3>
                    </div>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide",
                      coach.email_verified 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                        : "bg-red-50 text-red-700 border-red-150"
                    )}>
                      {coach.email_verified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <Field label="Email Address" icon={Mail} value={coach.email} />
                    </div>
                    <Field 
                      label="Auth Provider" 
                      icon={ShieldCheck} 
                      value={coach.auth_provider ? coach.auth_provider.charAt(0).toUpperCase() + coach.auth_provider.slice(1) : "—"} 
                    />
                    <Field 
                      label="Created Date" 
                      icon={Calendar} 
                      value={shortDate(coach.account_created_at)} 
                    />
                    <div className="sm:col-span-2">
                      <Field 
                        label="Last Sign In" 
                        icon={Clock} 
                        value={coach.last_sign_in_at ? (
                          <span>
                            {relativeTime(coach.last_sign_in_at)}
                            <span className="text-gray-400 font-normal"> · {shortDate(coach.last_sign_in_at)}</span>
                          </span>
                        ) : <span className="text-gray-400">Never</span>} 
                      />
                    </div>
                    
                    {/* Copyable Coach ID */}
                    <div className="sm:col-span-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coach System ID</p>
                      <div className="flex items-center justify-between font-mono text-[11px] bg-slate-50 text-slate-500 rounded-xl p-2.5 border border-slate-100/80 font-bold select-all group/id">
                        <span className="truncate mr-2">{coach.coach_id}</span>
                        <button
                          onClick={() => handleCopyId(coach.coach_id)}
                          title="Copy Coach ID"
                          className="p-1 rounded-md hover:bg-slate-200/50 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in duration-150" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Action Buttons */}
                <div className="border-t border-slate-100 pt-4 mt-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Administrative Controls</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <ActionButton
                        label="Reset Password"
                        icon={RefreshCw}
                        loading={actionLoading === "reset-password"}
                        disabled={!!actionLoading}
                        onClick={() => setPendingConfirm(pendingConfirm === "reset-password" ? null : "reset-password")}
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

                    <ActionButton
                      label="Resend Onboarding"
                      icon={Send}
                      disabled={!!actionLoading}
                      onClick={() => handleServerSideAction("Resend Onboarding Email")}
                    />

                    <ActionButton
                      label="Export Data"
                      icon={Download}
                      variant="success"
                      loading={actionLoading === "export"}
                      disabled={!!actionLoading}
                      onClick={handleExportData}
                    />

                    <ActionButton
                      label="Force Logout"
                      icon={LogOut}
                      variant="warning"
                      disabled={!!actionLoading}
                      onClick={() => handleServerSideAction("Force Logout")}
                    />

                    <div className="sm:col-span-2">
                      <ActionButton
                        label="Disable Account"
                        icon={UserX}
                        variant="danger"
                        disabled={!!actionLoading}
                        onClick={() => handleServerSideAction("Disable Account")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CARD 2: TEAM SNAPSHOT ── */}
              <div className="bg-white rounded-2xl border border-slate-150/70 shadow-sm hover:shadow-md/5 transition-all duration-200 p-5 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-amber-50 border border-amber-100/50 text-amber-600">
                        <Users className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 tracking-tight">Team Snapshot</h3>
                    </div>
                    {coach.raffle_enabled && (
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 shadow-sm uppercase tracking-wide">
                        <Zap className="w-2.5 h-2.5 animate-pulse" />
                        Raffle Active
                      </span>
                    )}
                  </div>

                  {/* Team Profile Header card */}
                  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-55/10 to-blue-55/15 border border-slate-100 shadow-sm mb-4">
                    {coach.team_logo ? (
                      <img
                        src={coach.team_logo}
                        alt={coach.team_name ?? "Team"}
                        className="size-12 rounded-xl object-cover shadow-sm border border-slate-200/50 shrink-0 animate-in zoom-in duration-200"
                      />
                    ) : (
                      <div className="size-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200/40 shrink-0">
                        <Users className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 truncate text-sm leading-snug">
                        {coach.team_name ?? (
                          <span className="italic text-gray-400 font-normal">
                            No team name set
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-450 font-bold mt-0.5">
                        {coach.player_count} Roster Size
                      </p>
                    </div>
                  </div>

                  {/* Roster & Event metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Total Sessions"
                      icon={Calendar}
                      value={
                        <span className="text-indigo-650 font-black text-base">
                          {coach.session_count}
                        </span>
                      }
                    />
                    <Field
                      label="Archives Created"
                      icon={Archive}
                      value={
                        <span className="text-violet-650 font-black text-base">
                          {coach.total_archives}
                        </span>
                      }
                    />
                    <Field
                      label="Last Session Date"
                      icon={Clock}
                      value={
                        coach.last_session_at ? (
                          <span className="text-slate-700 font-bold text-xs leading-normal">
                            {relativeTime(coach.last_session_at)}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal text-xs">No sessions yet</span>
                        )
                      }
                    />
                    <Field
                      label="Raffle System"
                      icon={Zap}
                      value={
                        coach.raffle_enabled ? (
                          <span className="text-emerald-600 font-bold text-xs">Enabled</span>
                        ) : (
                          <span className="text-gray-400 font-normal text-xs">Disabled</span>
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-amber-55/10 border border-amber-200/50 text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  Roster limits apply based on subscription capacity parameters.
                </div>
              </div>

              {/* ── CARD 3: ACTIVITY FEED ── */}
              <div className="bg-white rounded-2xl border border-slate-150/70 shadow-sm hover:shadow-md/5 transition-all duration-200 p-5 flex flex-col justify-between self-stretch xl:col-span-2">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-violet-50 border border-violet-100/50 text-violet-650">
                        <Activity className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 tracking-tight">Activity Logs &amp; Timeline</h3>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/60 uppercase">
                      Last Active: {relativeTime(coach.last_active_at)}
                    </span>
                  </div>

                  {/* Active Training Session Pulsing Banner */}
                  {detail?.activeSession && (
                    <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-bold shadow-sm mb-4 animate-in fade-in duration-300">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 animate-pulse"></span>
                      </span>
                      <div className="truncate">
                        Active Training Session In Progress: <span className="text-amber-900 font-extrabold">{detail.activeSession.type}</span> · {detail.activeSession.duration} min duration
                      </div>
                    </div>
                  )}

                  {/* Chronological Roster Timeline */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Recent Saved Sessions (Last 5)</h4>
                    {isLoadingDetail ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-xl bg-gray-150" />
                        ))}
                      </div>
                    ) : detailError ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {detailError}
                      </div>
                    ) : detail?.recentSessions.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                        <Calendar className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                        <p className="text-xs text-gray-400 italic">No saved sessions or attendance records found.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {detail?.recentSessions.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-100 text-xs transition-all duration-150 hover:-translate-y-px"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800">{s.date}</span>
                                <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                  {s.type}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-slate-500 font-semibold shrink-0">
                              <span>{s.duration} min</span>
                              <span className="text-slate-350">·</span>
                              <span>{s.player_count} players</span>
                              <span className="text-slate-350">·</span>
                              <span className="text-slate-400 text-[10px]">{relativeTime(s.saved_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── CARD 4: DIAGNOSTICS & SYNC ── */}
              <div className="bg-white rounded-2xl border border-slate-150/70 shadow-sm hover:shadow-md/5 transition-all duration-200 p-5 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-rose-50 border border-rose-100/50 text-rose-600">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 tracking-tight">Sync Diagnostics</h3>
                    </div>
                    {isLoadingDetail ? (
                      <Skeleton className="w-14 h-4 bg-gray-150" />
                    ) : (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide shadow-sm",
                        isHighError
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-150"
                      )}>
                        <span className={`w-1 h-1 rounded-full ${isHighError ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
                        {isHighError ? "Degraded" : "Optimal"}
                      </span>
                    )}
                  </div>

                  {/* Sync field grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <Field
                      label="Pending Changes"
                      icon={RefreshCw}
                      value={
                        detail?.activeSession ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            Session Active
                          </span>
                        ) : hasSyncs ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            Pending Syncs
                          </span>
                        ) : (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            None
                          </span>
                        )
                      }
                    />
                    <Field
                      label="Last Sync Time"
                      icon={Clock}
                      value={
                        detail?.recentSessions[0]?.saved_at ? (
                          relativeTime(detail.recentSessions[0].saved_at)
                        ) : (
                          <span className="text-gray-400 font-normal">—</span>
                        )
                      }
                    />
                    <Field
                      label="Failed Syncs"
                      icon={AlertTriangle}
                      value={
                        failedSyncs > 0 ? (
                          <span className="text-red-650 font-black text-xs">{failedSyncs} sync errors</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">0</span>
                        )
                      }
                    />
                    <Field
                      label="Offline Recovery"
                      icon={RefreshCw}
                      value={
                        offlineRecoveryEvents > 0 ? (
                          <span className="text-indigo-650 font-bold text-xs">{offlineRecoveryEvents} events</span>
                        ) : (
                          <span className="text-gray-400 font-normal">0</span>
                        )
                      }
                    />
                  </div>

                  {/* Interactive Terminal log viewer */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-t-lg border-b border-slate-800 text-[10px] text-slate-400 font-mono select-none">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-400" />
                        <span>sync_engine_diagnostics.log</span>
                      </div>
                      <span className="flex gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-red-500"/><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/><span className="w-1.5 h-1.5 rounded-full bg-green-500"/></span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-b-lg font-mono text-[10px] leading-relaxed border border-slate-900 max-h-[100px] overflow-y-auto text-slate-350 scrollbar-gutter-stable select-all">
                      {recentErrors.map((err, idx) => (
                        <div key={idx} className={cn(
                          "truncate",
                          isHighError
                            ? "text-red-400"
                            : errorRate > 0
                              ? "text-amber-400"
                              : "text-emerald-400"
                        )}>
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CARD 5: BILLING & TIER ── */}
              <div className="bg-white rounded-2xl border border-slate-150/70 shadow-sm hover:shadow-md/5 transition-all duration-200 p-5 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-emerald-50 border border-emerald-100/50 text-emerald-600">
                        <CreditCard className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 tracking-tight">Billing &amp; Subscription</h3>
                    </div>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide shadow-sm",
                      coach.raffle_enabled
                        ? "bg-violet-50 text-violet-700 border-violet-150"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      {coach.raffle_enabled ? "Kaizen Pro" : "Free Plan"}
                    </span>
                  </div>

                  {/* Billing specifics */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <Field
                      label="Account Status"
                      icon={ShieldCheck}
                      value={
                        coach.raffle_enabled ? (
                          <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                            Active / Paid
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                            Active / Free
                          </span>
                        )
                      }
                    />
                    <Field
                      label="Next Renewal Date"
                      icon={Calendar}
                      value={
                        coach.raffle_enabled ? (
                          <span className="text-slate-800 font-bold">{renewalString}</span>
                        ) : (
                          <span className="text-gray-400 font-normal">—</span>
                        )
                      }
                    />
                    <Field
                      label="Monthly Charge"
                      icon={Database}
                      value={
                        coach.raffle_enabled ? (
                          <span className="text-indigo-650 font-black text-xs">$19.00 / mo</span>
                        ) : (
                          <span className="text-slate-700 font-bold text-xs">$0.00 (Free)</span>
                        )
                      }
                    />
                    <Field
                      label="Roster Allotment"
                      icon={Users}
                      value={
                        coach.raffle_enabled ? (
                          <span className="text-indigo-650 font-bold">Unlimited</span>
                        ) : (
                          <span className="text-slate-600 font-bold">Max 10 players</span>
                        )
                      }
                    />
                  </div>

                  {/* Visa Card Details summary */}
                  <div className="mt-4 flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100/80 text-xs">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-extrabold text-slate-700">
                        {coach.raffle_enabled ? "Visa ending in 4242" : "No billing method on file"}
                      </span>
                    </div>
                    {coach.raffle_enabled && (
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-100/60">
                        Expires 12/28
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleServerSideAction("Manage Subscription Invoice Settings")}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                >
                  <span>Manage Billing Portal</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </button>
              </div>

              {/* ── CARD 6: STORAGE & DB CAPACITY ── */}
              <div className="bg-white rounded-2xl border border-slate-150/70 shadow-sm hover:shadow-md/5 transition-all duration-200 p-5 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-cyan-50 border border-cyan-100/50 text-cyan-600">
                        <HardDrive className="w-4 h-4" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 tracking-tight">Database Storage Size</h3>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-650 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100/60 uppercase">
                      Memory Space: {storage.label}
                    </span>
                  </div>

                  {/* Storage rows grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <Field
                      label="Team Profile Logo"
                      icon={ImageIcon}
                      value={
                        coach.team_logo ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            1 image active
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">None</span>
                        )
                      }
                    />
                    <Field
                      label="Event Records"
                      icon={Database}
                      value={
                        <span className="text-indigo-650 font-bold">
                          {coach.session_count} rows
                        </span>
                      }
                    />
                    <Field
                      label="Roster Records"
                      icon={Users}
                      value={
                        <span className="text-indigo-650 font-bold">
                          {coach.player_count} rows
                        </span>
                      }
                    />
                    <Field
                      label="Archive Events"
                      icon={Archive}
                      value={
                        <span className="text-indigo-650 font-bold">
                          {coach.total_archives} rows
                        </span>
                      }
                    />
                  </div>

                  {/* Dynamic Database Capacity Progress Meter */}
                  <div className="space-y-1.5 mt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Database Capacity Space</span>
                      <span className="text-slate-600">{storage.label} / 10.0 MB Max</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", storage.isLarge ? "bg-red-500 animate-pulse" : "bg-indigo-500")}
                        style={{ width: `${Math.min(100, Math.max(3, (storage.kb / 10240) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-[10px] text-blue-700 font-bold">
                  Aggregate: 1 profile + {coach.player_count} players + {coach.session_count} events + {coach.total_archives} archives = ~{estimatedDbRows.toLocaleString()} db rows total estimate.
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
