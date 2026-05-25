import { useState } from "react";
import { Play, Users, Activity, Target, Clock } from "lucide-react";
import { useTeamStore, EVENT_TYPES, ActiveSession } from "../hooks/useTeamStore";
import { useSessionTimer, formatElapsed } from "../hooks/useSessionTimer";
import { formatDate } from "@/lib/dates";
import InboxCard from "./InboxCard";
import TrainingSummaryCard from "./TrainingSummaryCard";
import LeaderboardStrip from "./LeaderboardStrip";
import RecentActivityFeed from "./RecentActivityFeed";
import RewardsCard from "./RewardsCard";
import { LeaderboardPodium } from "./LeaderboardPodium";

interface Props {
  onNavigate: (page: string) => void;
}

function buildSmartSession(): ActiveSession {
  const now = new Date();
  // Snap to nearest 15 min
  const snapped = new Date(now);
  snapped.setMinutes(Math.round(now.getMinutes() / 15) * 15, 0, 0);
  if (snapped.getMinutes() === 60) { snapped.setHours(snapped.getHours() + 1); snapped.setMinutes(0); }

  const y = snapped.getFullYear();
  const mo = String(snapped.getMonth() + 1).padStart(2, "0");
  const d = String(snapped.getDate()).padStart(2, "0");
  const h = String(snapped.getHours()).padStart(2, "0");
  const mi = String(snapped.getMinutes()).padStart(2, "0");

  return {
    id: crypto.randomUUID(),
    date: `${y}-${mo}-${d}T${h}:${mi}`,
    type: EVENT_TYPES.PRACTICE,
    duration: 1.5,
  };
}

export default function MissionControlDashboard({ onNavigate }: Props) {
  const { state, startSession } = useTeamStore();
  const [showActivity, setShowActivity] = useState(false);

  const handleSmartStart = async () => {
    await startSession(buildSmartSession());
    onNavigate("attendance");
  };
  const elapsed = useSessionTimer(state.activeSession);

  const practiceEvents = state.events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
  const optionalEvents = state.events.filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING);
  const totalPracticeHrs = practiceEvents.reduce((s, e) => s + e.duration, 0);
  const totalOptionalHrs = optionalEvents.reduce((s, e) => s + e.duration, 0);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const heroKey = state.activeSession ? "active" : "idle";

  return (
    <div className="space-y-4 animate-hero-enter" data-screen-label="Dashboard">
      {/* ── Mobile Leaderboard Strip (mobile only) ──────────────── */}
      <div className="md:hidden stagger-1">
        <LeaderboardStrip onNavigate={onNavigate} />
      </div>

      {/* ── Leaderboard Podium (temporary: side-by-side with ticker for review) ── */}
      <div className="stagger-1">
        <LeaderboardPodium />
      </div>

      {/* ── Hero Panel — key forces re-animation on state change ── */}
      <div key={heroKey} className="stagger-2 animate-hero-state">
        {state.activeSession ? (
          <ActiveSessionHero
            session={state.activeSession}
            elapsed={elapsed}
            rosterSize={state.roster.length}
            onAttendance={() => onNavigate("attendance")}
          />
        ) : (
          <IdleHero
            today={today}
            rosterSize={state.roster.length}
            // Option A: last *completed* session only.
            // events[] contains only saved (finished) sessions — in-progress sessions
            // live in activeSession, never here. The array is ordered by saved_at DESC
            // (Supabase query + local prepend), so index 0 is always the most-recently
            // committed session. We read .date (the session's start datetime) for display.
            // If events[] is empty, no fragment is shown.
            lastEventDate={state.events[0]?.date ?? null}
            hasEvents={state.events.length > 0}
            onStart={handleSmartStart}
            onConfigure={() => onNavigate("launch")}
          />
        )}
      </div>

      {/* ── Unified Inbox Card ─────────────────────────────────── */}
      <div className="stagger-3">
        <InboxCard onNavigate={onNavigate} />
      </div>

      {/* ── Stats Tiles ────────────────────────────────────────── */}
      <div className="stagger-5 space-y-2">
        <div className="grid grid-cols-3 gap-4">
          {state.activeSession ? (
            <>
              <StatTile label="On Roster" value={String(state.roster.length)} icon={<Users className="size-4" />} color="blue" />
              <StatTile label="Duration" value={`${state.activeSession.duration}h`} icon={<Clock className="size-4" />} color="emerald" />
              <StatTile label="Events Logged" value={String(state.events.length)} icon={<Activity className="size-4" />} color="violet" />
            </>
          ) : (
            <>
              <StatTile label="Total Events" value={String(state.events.length)} icon={<Activity className="size-4" />} color="blue" />
              <StatTile
                label="Practice Hrs"
                value={totalPracticeHrs % 1 === 0 ? String(totalPracticeHrs) : totalPracticeHrs.toFixed(1)}
                icon={<Users className="size-4" />}
                color="emerald"
              />
              <StatTile
                label="Optional Hrs"
                value={totalOptionalHrs % 1 === 0 ? String(totalOptionalHrs) : totalOptionalHrs.toFixed(1)}
                icon={<Target className="size-4" />}
                color="violet"
              />
            </>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setShowActivity(!showActivity)}
            className="text-xs font-semibold text-blue-400/60 hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            {showActivity ? "Recent activity ↑" : "Recent activity →"}
          </button>
        </div>
      </div>

      {/* ── Intelligence Row: Training Summary + Rewards ───────── */}
      <div className={`stagger-6 grid gap-4 ${state.raffleEnabled ? "md:grid-cols-2" : "grid-cols-1"}`}>
        <TrainingSummaryCard />
        <RewardsCard onNavigate={onNavigate} />
      </div>

      {/* ── Recent Activity Feed (collapsible) ─────────────────── */}
      {showActivity && (
        <div className="stagger-7 animate-hero-enter">
          {state.events.length > 0 ? (
            <RecentActivityFeed onNavigate={onNavigate} />
          ) : (
            <div className="rounded-2xl border mc-border px-5 py-8 mc-text-muted text-sm text-center" style={{ background: "var(--mc-card)" }}>
              No sessions logged yet. Start your first session above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function ActiveSessionHero({
  session,
  elapsed,
  rosterSize,
  onAttendance,
}: {
  session: { type: string; duration: number; date: string };
  elapsed: number;
  rosterSize: number;
  onAttendance: () => void;
}) {
  const isPractice = session.type === "Practice";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 md:p-8 ${
        isPractice
          ? "border-emerald-500/30 bg-gradient-to-br from-[#022c22] via-[#043e30] to-[#022c22]"
          : "border-violet-500/30 bg-gradient-to-br from-[#2e1065] via-[#3b0764] to-[#2e1065]"
      }`}
    >
      {/* Decorative glow */}
      <div
        className={`absolute -top-16 -right-16 size-48 rounded-full blur-3xl pointer-events-none ${
          isPractice ? "bg-emerald-500/8" : "bg-violet-500/8"
        }`}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        {/* Left: status + timer */}
        <div className="space-y-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest ${
              isPractice
                ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-300"
                : "bg-violet-500/12 border-violet-500/25 text-violet-300"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current animate-session-pulse" />
            Live · {session.type}
          </div>

          <div>
            <div className="mc-mono text-white font-bold tabular-nums leading-none" style={{ fontSize: "clamp(2.25rem,5vw,3rem)" }}>
              {formatElapsed(elapsed)}
            </div>
            <div className="mt-1.5 text-white/40 text-sm">
              {session.duration} hr{session.duration !== 1 ? "s" : ""} planned · {rosterSize} players on roster
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onAttendance}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors text-white ${
                isPractice
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-violet-600 hover:bg-violet-500"
              }`}
            >
              <Users className="size-4" />
              Take Attendance →
            </button>
          </div>
        </div>

        {/* Right: session details */}
        <div className="flex sm:flex-col gap-3 flex-shrink-0">
          <InfoChip label="Type" value={session.type} />
          <InfoChip label="Roster" value={`${rosterSize} players`} />
        </div>
      </div>
    </div>
  );
}

function IdleHero({
  today,
  rosterSize,
  lastEventDate,
  hasEvents,
  onStart,
  onConfigure,
}: {
  today: string;
  rosterSize: number;
  lastEventDate: string | null;
  hasEvents: boolean;
  onStart: () => void;
  onConfigure: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border mc-border p-6 md:p-8" style={{ background: "var(--mc-card)" }}>
      <div className="absolute -top-20 -right-20 size-56 rounded-full blur-3xl bg-blue-600/6 pointer-events-none" />

      <div className="relative space-y-5">
        <div>
          <div className="mc-text-muted text-sm font-medium">{today}</div>
          <h2 className="mt-2 mc-text font-bold leading-tight" style={{ fontSize: "clamp(1.5rem,3.5vw,2rem)" }}>
            Ready for today's session?
          </h2>
          <p className="mt-1.5 mc-text-secondary text-sm">
            {rosterSize} {rosterSize === 1 ? "player" : "players"} on roster
            {hasEvents && lastEventDate ? ` · Last session: ${formatDate(lastEventDate)}` : ""}
            {!hasEvents ? " · No sessions logged yet" : ""}
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
            >
              <Play className="size-4 fill-current" />
              Quick Start
            </button>
            <span className="mc-text-muted text-xs">Practice · 1.5h · starts now</span>
          </div>
          <button
            onClick={onConfigure}
            className="text-blue-600 dark:text-blue-400/60 hover:text-blue-500 dark:hover:text-blue-400 font-medium text-xs transition-colors"
          >
            Set up manually →
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "violet";
}) {
  const palettes = {
    blue:    { icon: "text-blue-400   bg-blue-500/10",   val: "mc-text" },
    emerald: { icon: "text-emerald-400 bg-emerald-500/10", val: "mc-text" },
    violet:  { icon: "text-violet-400  bg-violet-500/10",  val: "mc-text" },
  };
  const p = palettes[color];

  return (
    <div className="rounded-xl border mc-border p-5 flex flex-col gap-3 mc-card-hover transition-colors" style={{ background: "var(--mc-card)" }}>
      <div className={`size-8 rounded-lg flex items-center justify-center ${p.icon}`}>{icon}</div>
      <div>
        <div className={`mc-mono text-3xl font-bold tabular-nums leading-none ${p.val}`}>{value}</div>
        <div className="mc-text-muted text-[11px] mt-1">{label}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  action,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  empty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border mc-border overflow-hidden" style={{ background: "var(--mc-card)" }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b mc-border">
        <h3 className="mc-text-secondary text-xs font-bold uppercase tracking-widest">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-blue-400/80 hover:text-blue-400 text-xs font-medium transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
      {empty ? (
        <div className="px-5 py-8 mc-text-muted text-sm text-center">{emptyMessage}</div>
      ) : (
        children
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border mc-border rounded-xl px-4 py-3 min-w-[120px]" style={{ background: "var(--mc-card)" }}>
      <div className="mc-text-muted text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      <div className="mc-text-secondary text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
