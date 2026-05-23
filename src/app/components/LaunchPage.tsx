import { useState } from "react";
import { Play, Calendar as CalendarIcon, Clock, ChevronRight, Users, Target, CalendarDays, Info } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTeamStore, ActiveSession, EventType, EVENT_TYPES } from "../hooks/useTeamStore";

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
  const [durationInput, setDurationInput] = useState("1.5");
  const [durationMode, setDurationMode] = useState<"presets" | "custom">("presets");
  const commonTimes = [
    { label: "5:00 PM", value: "17:00" },
    { label: "5:30 PM", value: "17:30" },
    { label: "6:00 PM", value: "18:00" },
    { label: "6:30 PM", value: "18:30" },
    { label: "7:00 PM", value: "19:00" },
    { label: "7:30 PM", value: "19:30" },
    { label: "8:00 PM", value: "20:00" },
    { label: "8:30 PM", value: "20:30" },
  ];

  const getNearest15Time = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(roundedMinutes);
    }

    const hours = String(now.getHours()).padStart(2, '0');
    const minutesStr = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutesStr}`;
  };

  const initialTime = getNearest15Time();
  const [startTime, setStartTime] = useState(() => {
    const matchesPreset = commonTimes.some((t) => t.value === initialTime);
    return matchesPreset ? initialTime : "18:00";
  });
  const [timeMode, setTimeMode] = useState<"presets" | "custom">("presets");

  const selectTimePreset = (val: string) => {
    setTimeMode("presets");
    setStartTime(val);
  };

  const enableCustomTime = () => {
    setTimeMode("custom");
    const currentSnapped = getNearest15Time();
    // If we're transitioning to custom and still on the default fallback preset, snap to the actual current system time!
    if (startTime === "18:00") {
      setStartTime(currentSnapped);
    }
  };

  const commonDurations = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
  const parsedDuration = parseFloat(durationInput);
  const isDurationValid =
    !isNaN(parsedDuration) &&
    parsedDuration >= 0.5 &&
    parsedDuration <= 4 &&
    Number.isInteger(parsedDuration * 2);

  const selectPreset = (val: number) => {
    setDurationMode("presets");
    setDurationInput(val.toString());
  };

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
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-blue-950/40 to-transparent p-8 text-white">
        <div className="absolute -top-20 -right-20 size-56 rounded-full blur-3xl bg-blue-600/6 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider text-blue-300 border border-white/[0.08]">
              <Play className="size-3 fill-current" /> Event Launcher
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Set up today's team event.
            </h2>
            <p className="mt-3 text-white/45 text-sm md:text-base max-w-xl leading-relaxed">
              Configure the event details below so players can instantly check in and record their training hours.
            </p>
          </div>
          {/* Roster Stat Badge */}
          <div className="flex-shrink-0 bg-white/[0.06] border border-white/[0.08] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-white/[0.08] rounded-lg text-white">
              <Users className="size-6" />
            </div>
            <div>
              <div className="text-xs text-white/40 font-bold uppercase tracking-widest">Roster Size</div>
              <div className="text-xl font-extrabold text-white">{state.roster.length} active players</div>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Active Session Alert Container */}
      {state.activeSession && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 flex items-start gap-4 animate-fade-in text-amber-300">
          <div className="p-2.5 bg-amber-500/15 text-amber-300 rounded-xl flex-shrink-0">
            <Info className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-amber-200 text-sm">Active Session in Progress</h4>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              There is already an active <span className="font-bold text-amber-200">{state.activeSession.type}</span> session started ({state.activeSession.duration} hrs). Starting a new event below will overwrite this active session.
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
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/55 border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <CalendarIcon className="size-4" /> Date & Time Configuration
          </h3>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Event Date */}
            <div className="relative">
              <label className="block mb-2 font-bold text-white/55 text-sm uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays className="size-4 text-blue-500" /> Event Date
              </label>
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all text-left focus:outline-none text-white"
              >
                <span className="text-white font-semibold text-sm">
                  {formatDisplayDate(selectedDate)}
                </span>
                <CalendarIcon className="w-5 h-5 text-white/40 flex-shrink-0" />
              </button>

              {showCalendar && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCalendar(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-50 bg-[#1e2333] rounded-xl border border-white/[0.1] p-4 text-white shadow-2xl">
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
            <div className="space-y-3">
              <label className="block mb-2 font-bold text-white/55 text-sm uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="size-4 text-blue-500" /> Start Time
              </label>
              
              {/* Preset Time Buttons Grid */}
              <div className="grid grid-cols-3 gap-3">
                {commonTimes.map(({ label, value }) => {
                  const isSelected = timeMode === "presets" && startTime === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectTimePreset(value)}
                      className={`py-3.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                        isSelected
                          ? "bg-blue-600 border-transparent text-white scale-[1.02] transform"
                          : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] text-white/70"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={enableCustomTime}
                  className={`py-3.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                    timeMode === "custom"
                      ? "bg-blue-600 border-transparent text-white scale-[1.02] transform"
                      : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] text-white/70"
                  }`}
                >
                  Custom time
                </button>
              </div>

              {/* Custom Time Input Reveal */}
              {timeMode === "custom" && (
                <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-xl animate-fade-in max-w-sm mt-3">
                  <div className="relative group">
                    <input
                      type="time"
                      required
                      step="900"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] focus:border-blue-500 focus:outline-none text-white font-semibold text-sm transition-all focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Type Section */}
        <fieldset className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/55 border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <Target className="size-4" /> Select Event Type
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
                        : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/[0.15] hover:bg-white/[0.06] hover:scale-[1.01]"
                    }`}
                  >
                    {/* Event Type Icon Indicator */}
                    <div className={`p-3.5 rounded-xl mb-4 transition-all duration-200 ${
                      isSelected
                        ? isPractice ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                        : "bg-white/[0.06] text-white/50 group-hover:bg-white/[0.1]"
                    }`}>
                      {isPractice ? <Users className="size-6" /> : <Target className="size-6" />}
                    </div>

                    <span className="font-extrabold text-base tracking-tight mb-1 text-white">
                      {isPractice ? "Practice" : "Optional Training"}
                    </span>
                    <span className={`text-xs font-medium leading-relaxed max-w-xs ${isSelected ? "text-white/70" : "text-white/40"}`}>
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
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/55 flex items-center gap-2">
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
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectPreset(val)}
                    className={`py-3.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                      isSelected
                        ? "bg-blue-600 border-transparent text-white scale-[1.02] transform"
                        : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] text-white/70"
                    }`}
                  >
                    {val === 0.5 ? "30 min" : `${val} ${val === 1 ? "hr" : "hrs"}`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setDurationMode("custom")}
                className={`py-3.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] ${
                  durationMode === "custom"
                    ? "bg-blue-600 border-transparent text-white scale-[1.02] transform"
                    : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] text-white/70"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Input Reveal */}
            {durationMode === "custom" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white/[0.02] border border-white/[0.08] rounded-xl animate-fade-in">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0.5"
                      max="4"
                      step="0.5"
                      value={durationInput}
                      onChange={(e) => setDurationInput(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border text-center font-extrabold text-white transition-all focus:outline-none focus:ring-4 ${
                        isDurationValid
                          ? "border-white/[0.08] bg-white/[0.03] focus:border-blue-500 focus:ring-blue-500/10"
                          : "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-100"
                      }`}
                      placeholder="e.g. 1.5"
                    />
                  </div>
                  <span className="text-sm font-bold text-white/40">hours</span>
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
          disabled={!isDurationValid}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-4.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/[0.04] disabled:text-white/20 text-white font-extrabold rounded-xl transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed text-base tracking-wide group"
        >
          <Play className="size-5 fill-current transition-transform group-hover:scale-110 duration-200" />
          Start Session
          <ChevronRight className="size-4 ml-0.5 transition-transform group-hover:translate-x-1 duration-200" />
        </button>
      </form>
    </div>
  );
}
