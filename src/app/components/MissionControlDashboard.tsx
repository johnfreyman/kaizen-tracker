import { Play, Users, ChevronRight, Activity, Trophy, Target, Clock } from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import { useSessionTimer, formatElapsed } from "../hooks/useSessionTimer";
import { formatDate } from "@/lib/dates";
import { calculateTotals } from "@/lib/stats";

interface Props {
  onNavigate: (page: string) => void;
}

export default function MissionControlDashboard({ onNavigate }: Props) {
  const { state } = useTeamStore();
  const elapsed = useSessionTimer(state.activeSession);

  const practiceEvents = state.events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
  const optionalEvents = state.events.filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING);
  const totalPracticeHrs = practiceEvents.reduce((s, e) => s + e.duration, 0);
  const totalOptionalHrs = optionalEvents.reduce((s, e) => s + e.duration, 0);

  const totals = calculateTotals(state.events, state.roster);
  const leaderboard = Object.entries(totals)
    .map(([name, t]) => ({ name, hours: t.practice + t.training }))
    .filter((p) => p.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-4 animate-hero-enter">
      {/* ── Hero Panel ─────────────────────────────────────────── */}
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
          lastEventDate={state.events[0]?.date ?? null}
          hasEvents={state.events.length > 0}
          onStart={() => onNavigate("launch")}
          onConfigure={() => onNavigate("launch")}
        />
      )}

      {/* ── Stats Tiles ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* ── Content Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sessions */}
        <SectionCard
          title="Recent Sessions"
          action={state.events.length > 5 ? { label: "View all →", onClick: () => onNavigate("summary") } : undefined}
          empty={state.events.length === 0}
          emptyMessage="No sessions logged yet. Start your first session above."
        >
          <div className="divide-y divide-white/[0.05]">
            {state.events.slice(0, 6).map((event) => (
              <div key={event.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`size-2 rounded-full flex-shrink-0 ${
                      event.type === EVENT_TYPES.PRACTICE ? "bg-blue-400" : "bg-violet-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-white/80 text-sm font-medium truncate">{event.type}</div>
                    <div className="text-white/30 text-xs">{formatDate(event.date)}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="text-white/60 text-sm">{event.players.length} players</div>
                  <div className="text-white/30 text-xs">
                    {event.duration}h
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Leaderboard */}
        <SectionCard
          title="Leaderboard"
          action={
            leaderboard.length > 0
              ? { label: "Full report →", onClick: () => onNavigate("summary") }
              : undefined
          }
          empty={leaderboard.length === 0}
          emptyMessage="Leaderboard will appear once players accumulate hours."
        >
          <div className="divide-y divide-white/[0.05]">
            {leaderboard.map((player, i) => (
              <div key={player.name} className="flex items-center gap-4 px-5 py-3">
                <span
                  className={`w-6 text-center text-xs font-bold flex-shrink-0 ${
                    i === 0
                      ? "text-yellow-400"
                      : i === 1
                      ? "text-white/50"
                      : i === 2
                      ? "text-amber-600"
                      : "text-white/25"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="size-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white/60 flex-shrink-0">
                  {player.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-white/80 text-sm font-medium truncate">{player.name}</span>
                <div className="flex items-baseline gap-1 flex-shrink-0">
                  <span className="mc-mono text-white/70 text-sm font-semibold tabular-nums">
                    {player.hours % 1 === 0 ? player.hours : player.hours.toFixed(1)}
                  </span>
                  <span className="text-white/30 text-xs">h</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
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
          ? "border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-emerald-900/25 to-transparent"
          : "border-violet-500/25 bg-gradient-to-br from-violet-950/50 via-violet-900/25 to-transparent"
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
              Take Attendance
            </button>
            <button
              onClick={onAttendance}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white/60 hover:text-white/80 bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] transition-colors"
            >
              Save & End
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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-blue-950/40 via-indigo-950/20 to-transparent p-6 md:p-8">
      <div className="absolute -top-20 -right-20 size-56 rounded-full blur-3xl bg-blue-600/6 pointer-events-none" />

      <div className="relative space-y-5">
        <div>
          <div className="text-white/35 text-sm font-medium">{today}</div>
          <h2 className="mt-2 text-white font-bold leading-tight" style={{ fontSize: "clamp(1.5rem,3.5vw,2rem)" }}>
            Ready for today's session?
          </h2>
          <p className="mt-1.5 text-white/45 text-sm">
            {rosterSize} {rosterSize === 1 ? "player" : "players"} on roster
            {hasEvents && lastEventDate ? ` · Last session: ${formatDate(lastEventDate)}` : ""}
            {!hasEvents ? " · No sessions logged yet" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onStart}
            className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
          >
            <Play className="size-4 fill-current" />
            Start Today's Practice
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={onConfigure}
            className="flex items-center gap-1.5 px-3 py-3 text-white/40 hover:text-white/65 font-medium text-sm transition-colors"
          >
            Configure ▾
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
    blue:    { icon: "text-blue-400   bg-blue-500/10",   val: "text-blue-50" },
    emerald: { icon: "text-emerald-400 bg-emerald-500/10", val: "text-emerald-50" },
    violet:  { icon: "text-violet-400  bg-violet-500/10",  val: "text-violet-50" },
  };
  const p = palettes[color];

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 flex flex-col gap-3 hover:bg-white/[0.05] transition-colors">
      <div className={`size-8 rounded-lg flex items-center justify-center ${p.icon}`}>{icon}</div>
      <div>
        <div className={`mc-mono text-2xl font-bold tabular-nums leading-none ${p.val}`}>{value}</div>
        <div className="text-white/35 text-xs mt-1">{label}</div>
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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <h3 className="text-white/55 text-xs font-bold uppercase tracking-widest">{title}</h3>
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
        <div className="px-5 py-8 text-white/25 text-sm text-center">{emptyMessage}</div>
      ) : (
        children
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 min-w-[120px]">
      <div className="text-white/35 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-white/80 text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
