import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Calendar, Check, MonitorSmartphone, Save, UserCircle } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { BigButton, Note, Panel, Pill, SectionTitle } from "../components/ui";
import {
  collidingPlayerIds,
  deliveryLabel,
  displayName,
  presentCount,
  subTeamLabel,
  todayIso,
  usePrototypeStore,
} from "../store";
import type { ScreenId } from "../PrototypeApp";

type SortMode = "team" | "number" | "name";

export default function AttendanceScreen({ go }: { go: (s: ScreenId) => void }) {
  const { state, actions } = usePrototypeStore();
  const session = state.activeSession;

  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("team");
  const [showDate, setShowDate] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const active = useMemo(() => state.players.filter((p) => !p.retired), [state.players]);
  const colliding = useMemo(() => collidingPlayerIds(state.players), [state.players]);

  const visible = useMemo(() => {
    const list =
      teamFilter === "all"
        ? active
        : active.filter((p) =>
            teamFilter === "none" ? p.subTeamIds.length === 0 : p.subTeamIds.includes(teamFilter),
          );
    const copy = [...list];
    copy.sort((a, b) => {
      if (sort === "number") {
        if (a.number === null) return 1;
        if (b.number === null) return -1;
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      }
      if (sort === "team") {
        const t = subTeamLabel(state, a.subTeamIds).localeCompare(subTeamLabel(state, b.subTeamIds));
        if (t !== 0) return t;
      }
      return a.firstName.localeCompare(b.firstName);
    });
    return copy;
  }, [active, teamFilter, sort, state]);

  if (!session) {
    return (
      <Panel>
        <SectionTitle title="No session in progress" hint="Start a practice or an optional training from Home." />
        <BigButton variant="primary" onClick={() => go("home")}>
          <ArrowLeft className="size-5" />
          Back to Home
        </BigButton>
      </Panel>
    );
  }

  /* Another device finalized this session while this screen was open (§5). */
  if (session.closedElsewhere) {
    return (
      <Panel className="border-amber-500/30">
        <SectionTitle
          eyebrow="Conflict"
          title="This session was finished on another device"
          hint="Your marks were not discarded, but they cannot be added to a session that is already final."
        />
        <div className="flex flex-wrap gap-3">
          <BigButton
            variant="primary"
            onClick={() => {
              actions.acknowledgeClosedElsewhere();
              go("home");
            }}
          >
            Back to Home
          </BigButton>
        </div>
        <Note>
          The stale write is rejected as a conflict rather than implicitly reopening the finished
          session. Stage 4 decides how the coach reconciles the two versions.
        </Note>
      </Panel>
    );
  }

  const hiddenSelected = active.filter(
    (p) => session.present[p.id] && !visible.some((v) => v.id === p.id),
  ).length;
  // "Saved on this device" is only true if the local write actually
  // succeeded — a real quota/private-browsing failure must say so instead.
  const delivery =
    state.localPersistenceFailed && session.delivery === "device"
      ? { text: "Local save failed — your marks are still here in memory", tone: "bad" as const }
      : deliveryLabel(session.delivery);
  const isToday = session.date === todayIso();
  const hasSubTeams = state.subTeams.some((t) => t.active);

  return (
    <div className="space-y-5">
      {/* ── Session header ─────────────────────────────────────── */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary">
              {session.type === "practice" ? "Practice" : "Optional Training"}
            </span>
            <h2 className="mt-1 text-2xl md:text-3xl font-bold mc-text">
              {presentCount(session)} present
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill>{isToday ? `Today · ${formatDate(session.date)}` : formatDate(session.date)}</Pill>
              <Pill>{session.creditHours} hours each</Pill>
              <Pill tone={delivery.tone === "ok" ? "ok" : delivery.tone === "warn" ? "warn" : "bad"}>
                {delivery.text}
              </Pill>
            </div>
          </div>

          {/* D04 / P08: low-prominence, secondary, and beside the date. */}
          <button
            type="button"
            onClick={() => setShowDate((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium mc-text-secondary hover:mc-text border mc-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Calendar className="size-4" />
            Change date
          </button>
        </div>

        {showDate && (
          <div className="mt-4 rounded-xl border mc-border p-4">
            <label htmlFor="session-date" className="block text-sm font-semibold mc-text">
              Entering attendance from paper?
            </label>
            <p className="mt-1 text-sm mc-text-secondary">
              Pick the day it happened. There is no start time or duration to enter — the session
              still credits {session.creditHours} hours.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                id="session-date"
                type="date"
                value={session.date}
                max={todayIso()}
                onChange={(e) => actions.changeDate(e.target.value)}
                className="min-h-12 rounded-xl border mc-border bg-transparent px-3 mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {!isToday && (
                <BigButton variant="quiet" onClick={() => actions.changeDate(todayIso())}>
                  Back to today
                </BigButton>
              )}
            </div>
            <Note>
              P08: a backdated training joins the <em>current</em> raffle round at record creation,
              not a guessed historical round. Confirm before Stage 3 fixes the rule.
            </Note>
          </div>
        )}
      </Panel>

      {/* ── Team filter and sort ───────────────────────────────── */}
      {hasSubTeams && (
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary mr-1">
              Team
            </span>
            <FilterChip active={teamFilter === "all"} onClick={() => setTeamFilter("all")}>
              All teams
            </FilterChip>
            {state.subTeams
              .filter((t) => t.active)
              .map((t) => (
                <FilterChip key={t.id} active={teamFilter === t.id} onClick={() => setTeamFilter(t.id)}>
                  {t.name}
                </FilterChip>
              ))}
            {active.some((p) => p.subTeamIds.length === 0) && (
              <FilterChip active={teamFilter === "none"} onClick={() => setTeamFilter("none")}>
                Kaizen (no sub-team)
              </FilterChip>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary mr-1">
              Sort
            </span>
            {(["team", "number", "name"] as SortMode[]).map((m) => (
              <FilterChip key={m} active={sort === m} onClick={() => setSort(m)}>
                {m === "team" ? "By team" : m === "number" ? "By number" : "By name"}
              </FilterChip>
            ))}
          </div>

          {hiddenSelected > 0 && (
            <p className="mt-3 text-sm font-medium text-amber-600 dark:text-amber-300">
              {hiddenSelected} player{hiddenSelected === 1 ? "" : "s"} marked present{" "}
              {hiddenSelected === 1 ? "is" : "are"} hidden by this filter. They are still counted in
              the {presentCount(session)} above.
            </p>
          )}
        </Panel>
      )}

      {/* ── Roster cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map((p) => {
          const isPresent = !!session.present[p.id];
          const needsSetup = p.number === null && !p.guest;
          const needsLabel = colliding.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isPresent}
              aria-label={`${displayName(p)}, ${isPresent ? "present" : "absent"}`}
              onClick={() => actions.setPresent(p.id, !isPresent)}
              className={`relative flex flex-col items-center justify-center gap-2.5 min-h-36 p-4 rounded-2xl border transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isPresent
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "mc-card mc-border mc-text-secondary mc-card-hover"
              }`}
            >
              <div
                className={`size-14 rounded-full flex items-center justify-center font-bold text-lg mc-mono ${
                  isPresent
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-white/[0.06] mc-text-secondary"
                }`}
              >
                {p.number ?? "—"}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold leading-tight mc-text">
                  {p.label ? `${p.firstName} ${p.label}` : p.firstName}
                </div>
                {p.subTeamIds.length > 0 && (
                  <div className="text-[10px] uppercase tracking-wider mc-text-muted">
                    {subTeamLabel(state, p.subTeamIds)}
                  </div>
                )}
                {p.guest && (
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-500">
                    <UserCircle className="size-3" />
                    Guest
                  </span>
                )}
                {needsSetup && (
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Add number
                  </span>
                )}
                {needsLabel && (
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Needs a label
                  </span>
                )}
                {/* Text + icon, never colour alone (A22). */}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    isPresent ? "text-emerald-600 dark:text-emerald-400" : "mc-text-muted"
                  }`}
                >
                  {isPresent ? <Check className="size-3.5" /> : null}
                  {isPresent ? "Present" : "Absent"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <BigButton
          className="w-full"
          onClick={() => {
            actions.enterKiosk();
            go("kiosk");
          }}
        >
          <MonitorSmartphone className="size-5" />
          Enter Kiosk Mode
        </BigButton>
        <BigButton
          variant="primary"
          className="w-full"
          onClick={() => {
            if (presentCount(session) === 0) {
              setConfirmEmpty(true);
              return;
            }
            actions.finish();
            go("home");
          }}
        >
          <Save className="size-5" />
          Finish &amp; Save Attendance
        </BigButton>
      </div>

      {confirmEmpty && (
        <Panel className="border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold mc-text">Nobody is marked present</h3>
              <p className="mt-1 text-sm mc-text-secondary">
                Finish this {session.type === "practice" ? "practice" : "optional training"} with
                zero attendees? No credit and no tickets will be awarded.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <BigButton variant="quiet" onClick={() => setConfirmEmpty(false)}>
                  Keep marking
                </BigButton>
                <BigButton
                  variant="danger"
                  onClick={() => {
                    setConfirmEmpty(false);
                    actions.finish();
                    go("home");
                  }}
                >
                  Finish with zero
                </BigButton>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active
          ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-300"
          : "mc-card mc-border mc-text-secondary mc-card-hover"
      }`}
    >
      {children}
    </button>
  );
}
