import { useState } from "react";
import { Play, Calendar as CalendarIcon, Clock, ChevronRight, Users, Target, CalendarDays, Info } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTeamStore, ActiveSession, EventType, EVENT_TYPES, TeamEvent } from "../hooks/useTeamStore";

interface LaunchPageProps {
  onNavigate: (page: string) => void;
}

export default function LaunchPage({ onNavigate }: LaunchPageProps) {
  const { state, startSession } = useTeamStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [eventType, setEventType] = useState<EventType>(
    EVENT_TYPES.PRACTICE
  );
  const getNextHalfHour = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const h = now.getHours();
    if (minutes === 0 || minutes === 30) {
      return `${String(h).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    } else if (minutes < 30) {
      return `${String(h).padStart(2, "0")}:30`;
    } else {
      return `${String((h + 1) % 24).padStart(2, "0")}:00`;
    }
  };

  const formatTimeLabel = (value: string) => {
    try {
      return new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return value;
    }
  };

  const FALLBACK_QUICK_TIMES = [
    { value: "16:00", label: "4:00 PM" },
    { value: "17:00", label: "5:00 PM" },
    { value: "18:00", label: "6:00 PM" },
  ];

  const QUICK_TIMES = (() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const freq: Record<string, number> = {};
    state.events
      .filter((e) => new Date(e.date) >= thirtyDaysAgo)
      .forEach((e) => {
        const t = e.date.slice(11, 16);
        if (t) freq[t] = (freq[t] ?? 0) + 1;
      });

    const uniqueTimes = Object.keys(freq);
    if (uniqueTimes.length >= 1) {
      return uniqueTimes
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, 3)
        .map((value) => ({ value, label: formatTimeLabel(value) }));
    }
    return FALLBACK_QUICK_TIMES;
  })();

  const commonDurations = (() => {
    const freq: Record<number, number> = {};
    state.events
      .slice(0, 60)
      .forEach((e) => {
        const d = e.duration;
        if (typeof d === "number") {
          freq[d] = (freq[d] ?? 0) + 1;
        }
      });

    const uniqueDurations = Object.keys(freq).map(Number);
    if (uniqueDurations.length >= 3) {
      const sorted = uniqueDurations.sort((a, b) => {
        const diff = freq[b] - freq[a];
        if (diff !== 0) return diff;
        return a - b;
      });
      return sorted.slice(0, 6);
    } else {
      return [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    }
  })();

  const [durationInput, setDurationInput] = useState(() => {
    return state.events[0]?.duration.toString() ?? "1.5";
  });
  const [durationMode, setDurationMode] = useState<"presets" | "custom">(() => {
    const lastUsed = state.events[0]?.duration;
    if (lastUsed === undefined) return "presets";
    return commonDurations.includes(lastUsed) ? "presets" : "custom";
  });

  const [startTime, setStartTime] = useState(
    () => QUICK_TIMES[0]?.value || getNextHalfHour()
  );

  const parsedDuration = parseFloat(durationInput);
  const isDurationValid =
    !isNaN(parsedDuration) &&
    parsedDuration >= 0.5 &&
    parsedDuration <= 4 &&
    Number.isInteger(parsedDuration * 2);

  const isTimeInPast = (() => {
    if (!startTime) return false;
    const now = new Date();
    const selDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    );
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (selDate.getTime() !== today.getTime()) return false;
    const [hours, minutes] = startTime.split(":").map(Number);
    const sessionDateTime = new Date(selectedDate);
    sessionDateTime.setHours(hours, minutes, 0, 0);
    return sessionDateTime < now;
  })();

  const selectPreset = (val: number) => {
    setDurationMode("presets");
    setDurationInput(val.toString());
  };

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setShowCalendar(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDurationValid) return;

    // Robust local YYYY-MM-DD calculation avoids timezone conversion shifts
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const yyyymmdd = `${year}-${month}-${day}`;
    const combinedDateTime = `${yyyymmdd}T${startTime}`;

    const session: ActiveSession = {
      id: crypto.randomUUID(),
      date: combinedDateTime,
      type: eventType,
      duration: parsedDuration,
    };

    startSession(session);
    onNavigate("attendance");
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold mc-text leading-tight">
          Today's session
        </h1>
        <p className="mt-1.5 text-sm mc-text-secondary">
          {todayLabel} ·{" "}
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="underline decoration-transparent underline-offset-2 hover:decoration-current focus-visible:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-sm transition"
          >
            {state.roster.length} {state.roster.length === 1 ? "player" : "players"} on roster
          </button>
        </p>
      </header>

      {/* Prominent Active Session Alert Container */}
      {state.activeSession && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 flex items-start gap-4 animate-fade-in text-amber-800 dark:text-amber-300">
          <div className="p-2.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-xl flex-shrink-0">
            <Info className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-amber-900 dark:text-amber-200 text-sm">Active Session in Progress</h4>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
              There is already an active <span className="font-bold text-amber-900 dark:text-amber-200">{state.activeSession.type}</span> session started ({state.activeSession.duration} hrs). Starting a new session below will overwrite this active session.
            </p>
          </div>
        </div>
      )}

      {/* Session Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.08] overflow-hidden p-6 md:p-8 space-y-10 transition-all duration-300"
        style={{ backgroundColor: "var(--mc-surface)" }}
      >
        {/* Date and Time Group */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest mc-text-secondary border-b mc-border pb-2 flex items-center gap-2">
            <CalendarIcon className="size-4" /> Date & Time Configuration
          </h3>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Event Date */}
            <div className="relative">
              <label className="block mb-2 font-bold mc-text-secondary text-sm uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays className="size-4 text-blue-500" /> Date
              </label>
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border mc-border bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all text-left focus:outline-none mc-text"
              >
                <span className="font-semibold text-sm">
                  {formatDisplayDate(selectedDate)}
                </span>
                <CalendarIcon className="w-5 h-5 mc-text-muted flex-shrink-0" />
              </button>

              {showCalendar && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCalendar(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-50 rounded-xl border mc-border p-4 mc-text shadow-2xl" style={{ background: "var(--mc-surface)" }}>
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      className="rdp-custom"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Start Time */}
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider mc-text-secondary mb-2">
                Start time
              </legend>

              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-4 py-3 rounded-lg bg-[var(--mc-card)] border mc-border text-base font-semibold mc-text focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />

                <span className="text-sm mc-text-muted">or</span>

                <div className="flex gap-1.5">
                  {QUICK_TIMES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setStartTime(t.value)}
                      className={[
                        "px-3 py-2 rounded-md text-sm font-medium border transition",
                        startTime === t.value
                          ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                          : "mc-border mc-text-secondary hover:mc-text hover:bg-white/5",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {isTimeInPast && (
                <p className="mt-2 text-xs text-amber-400">
                  That's in the past. Did you mean tomorrow?
                </p>
              )}
            </fieldset>
          </div>
        </div>

        {/* Event Type Section */}
        <fieldset className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest mc-text-secondary border-b mc-border pb-2 flex items-center gap-2">
            <Target className="size-4" /> Session Type
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(EVENT_TYPES).map((type) => {
              const isSelected = eventType === type;
              const isPractice = type === EVENT_TYPES.PRACTICE;
              return (
                <label
                  key={type}
                  className="relative block cursor-pointer select-none h-full"
                >
                  <input
                    type="radio"
                    name="eventType"
                    value={type}
                    checked={isSelected}
                    onChange={(e) =>
                      setEventType(e.target.value as EventType)
                    }
                    className="sr-only"
                  />
                  <div
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 text-center transition-all duration-200 active:scale-[0.99] group h-full ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10 text-white scale-[1.01]"
                        : "border-white/[0.08] bg-white/[0.03] mc-text-secondary hover:border-white/[0.15] hover:bg-white/[0.06] hover:scale-[1.01]"
                    }`}
                  >
                    {/* Event Type Icon Indicator */}
                    <div className={`p-3.5 rounded-xl mb-4 transition-all duration-200 ${
                      isSelected
                        ? isPractice ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                        : "bg-white/[0.06] mc-text-muted group-hover:bg-white/[0.1]"
                    }`}>
                      {isPractice ? <Users className="size-6" /> : <Target className="size-6" />}
                    </div>

                    <span className="font-extrabold text-base tracking-tight mb-1">
                      {isPractice ? "Practice" : "Optional Training"}
                    </span>
                    <span className={`text-xs font-medium leading-relaxed max-w-xs ${isSelected ? "text-white/70" : "mc-text-muted"}`}>
                      {isPractice
                        ? "Official team practice for rostered players."
                        : "Voluntary sessions for skill development, conditioning, and extra work."}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Duration Selection */}
        <fieldset className="space-y-4">
          <div className="flex items-center justify-between border-b mc-border pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest mc-text-secondary flex items-center gap-2">
              <Clock className="size-4" /> Duration
            </h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border transition-all duration-200 ${
              isDurationValid 
                ? "bg-blue-500/10 text-blue-300 border-blue-500/25" 
                : "bg-red-500/10 text-red-300 border-red-500/25 animate-pulse"
            }`}>
              {isDurationValid ? `${parsedDuration} ${parsedDuration === 1 ? "hour" : "hours"}` : "Invalid Duration"}
            </span>
          </div>

          <div className="space-y-4">
            {/* Durations Pill Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {commonDurations.map((val) => {
                const isSelected = durationMode === "presets" && parsedDuration === val;
                const isLastUsed = state.events[0]?.duration === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectPreset(val)}
                    className={`py-3.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                      isSelected
                        ? "bg-blue-600 border-transparent text-white scale-[1.02] transform"
                        : "bg-white/[0.03] border mc-border hover:border-white/[0.15] hover:bg-white/[0.06] mc-text-secondary"
                    }`}
                  >
                    <span className="flex flex-col items-center justify-center">
                      <span>
                        {val === 0.5 ? "30 min" : `${val} ${val === 1 ? "hr" : "hrs"}`}
                      </span>
                      {isLastUsed && (
                        <span className={`text-[10px] font-medium leading-none mt-1 ${isSelected ? "mc-text" : "mc-text-muted"}`}>
                          last used
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setDurationMode("custom")}
                className={`py-3.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                  durationMode === "custom"
                    ? "bg-blue-600 border-transparent text-white scale-[1.02] transform"
                    : "bg-white/[0.03] border mc-border hover:border-white/[0.15] hover:bg-white/[0.06] mc-text-secondary"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Input Reveal */}
            {durationMode === "custom" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border mc-border rounded-xl animate-fade-in" style={{ background: "var(--mc-card)" }}>
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0.5"
                      max="4"
                      step="0.5"
                      value={durationInput}
                      onChange={(e) => setDurationInput(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border text-center font-extrabold transition-all focus:outline-none focus:ring-4 ${
                        isDurationValid
                          ? "mc-border focus:border-blue-500 focus:ring-blue-500/10"
                          : "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-100"
                      }`}
                      style={isDurationValid ? { background: "var(--mc-card)", color: "var(--mc-text-primary)" } : { color: "var(--mc-text-primary)" }}
                      placeholder="e.g. 1.5"
                    />
                  </div>
                  <span className="text-sm font-bold mc-text-muted">hours</span>
                </div>

                {/* Range validation error banner */}
                {!isDurationValid && (
                  <span className="text-xs font-bold text-red-300 animate-pulse bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-1.5 self-start sm:self-auto">
                    Must be 0.5–4.0 (0.5 steps)
                  </span>
                )}
              </div>
            )}
          </div>
        </fieldset>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isDurationValid || !startTime}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-4.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/[0.04] disabled:mc-text-muted text-white font-extrabold rounded-xl transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed text-base tracking-wide group"
        >
          <Play className="size-5 fill-current transition-transform group-hover:scale-110 duration-200" />
          Start Session
          <ChevronRight className="size-4 ml-0.5 transition-transform group-hover:translate-x-1 duration-200" />
        </button>
      </form>

      {/* ── Past Sessions ─────────────────────────────────────────── */}
      <PastSessions events={state.events} guestPlayers={state.guestPlayers} />
    </div>
  );
}

// ─── Past Sessions sub-component ──────────────────────────────────────────────

const PAGE_SIZE = 20;

function PastSessions({
  events,
  guestPlayers,
}: {
  events: TeamEvent[];
  guestPlayers: string[];
}) {
  const [page, setPage] = useState(1);

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const visible = sorted.slice(0, page * PAGE_SIZE);
  const hasMore = sorted.length > visible.length;

  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="size-4 mc-text-muted" />
        <h3 className="text-xs font-bold uppercase tracking-widest mc-text-secondary">
          Past sessions
        </h3>
        <span className="ml-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium mc-text-muted">
          {sorted.length}
        </span>
      </div>

      <div className="space-y-2">
        {visible.map((ev) => (
          <SessionCard key={ev.id} ev={ev} guestPlayers={guestPlayers} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="w-full py-2.5 rounded-xl border mc-border bg-white/[0.03] text-xs font-semibold mc-text-muted hover:mc-text hover:bg-white/[0.06] transition-all"
        >
          Load more ({sorted.length - visible.length} remaining)
        </button>
      )}
    </div>
  );
}

function SessionCard({
  ev,
  guestPlayers,
}: {
  ev: TeamEvent;
  guestPlayers: string[];
}) {
  const dateLabel = new Date(
    ev.date.includes("T") ? ev.date : `${ev.date}T12:00:00`
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold mc-text">
            {ev.type} · {dateLabel}
          </div>
          <div className="text-xs mc-text-muted">
            {ev.duration}h · {ev.players.length} present
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(ev.players.join(", ")).catch(() => {});
          }}
          className="shrink-0 text-[11px] font-semibold mc-text-muted hover:text-blue-500 transition-colors"
        >
          Copy roster
        </button>
      </div>
      {ev.players.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ev.players.map((player) => {
            const isGuest = guestPlayers.includes(player);
            return (
              <span
                key={player}
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                  isGuest
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/25"
                    : "bg-white/[0.06] mc-text-secondary"
                }`}
              >
                {player}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
