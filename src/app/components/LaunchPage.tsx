import { useState } from "react";
import { Play, Calendar as CalendarIcon, Clock, ChevronRight, Users, Target, CalendarDays, Info } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTeamStore, ActiveSession, EventType, EVENT_TYPES } from "../hooks/useTeamStore";

type Page = "launch" | "attendance" | "summary" | "settings";

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
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
    { label: "7:00 PM", value: "19:00" },
    { label: "7:30 PM", value: "19:30" },
    { label: "8:00 PM", value: "20:00" },
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
  const [startTime, setStartTime] = useState(initialTime);
  const [timeMode, setTimeMode] = useState<"presets" | "custom">(() => {
    return commonTimes.some((t) => t.value === initialTime) ? "presets" : "custom";
  });

  const selectTimePreset = (val: string) => {
    setTimeMode("presets");
    setStartTime(val);
  };

  const enableCustomTime = () => {
    setTimeMode("custom");
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
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider text-blue-100 border border-white/10">
              <Play className="size-3 fill-current" /> Event Launcher
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Set up today's team event.
            </h2>
            <p className="mt-3 text-blue-100/90 text-sm md:text-base max-w-xl leading-relaxed">
              Configure the event details below so players can instantly check in and record their training hours.
            </p>
          </div>
          {/* Roster Stat Badge */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl text-white">
              <Users className="size-6" />
            </div>
            <div>
              <div className="text-xs text-blue-100 font-bold uppercase tracking-wider">Roster Size</div>
              <div className="text-xl font-extrabold">{state.roster.length} active players</div>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Active Session Alert Container */}
      {state.activeSession && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-4 animate-fade-in shadow-sm">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl flex-shrink-0">
            <Info className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-amber-900 text-sm">Active Session in Progress</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              There is already an active <span className="font-bold">{state.activeSession.type}</span> session started ({state.activeSession.duration} hrs). Starting a new event below will overwrite this active session.
            </p>
          </div>
        </div>
      )}

      {/* Session Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 space-y-10 transition-all duration-300"
      >
        {/* Date and Time Group */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-2">
            <CalendarIcon className="size-4" /> Date & Time Configuration
          </h3>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Event Date */}
            <div className="relative">
              <label className="block mb-2 font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays className="size-4 text-blue-600" /> Event Date
              </label>
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/10 transition-all text-left focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm"
              >
                <span className="text-slate-800 font-semibold text-sm">
                  {formatDisplayDate(selectedDate)}
                </span>
                <CalendarIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </button>

              {showCalendar && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCalendar(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4">
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
              <label className="block mb-2 font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="size-4 text-blue-600" /> Start Time
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
                      className={`py-3.5 px-2 rounded-2xl text-sm font-bold border transition-all active:scale-[0.98] ${
                        isSelected
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white shadow-lg shadow-blue-500/15 scale-[1.02] transform"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={enableCustomTime}
                  className={`col-span-3 py-3.5 px-2 rounded-2xl text-sm font-bold border transition-all active:scale-[0.98] ${
                    timeMode === "custom"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white shadow-lg shadow-blue-500/15 scale-[1.02] transform"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  Custom time
                </button>
              </div>

              {/* Custom Time Input Reveal */}
              {timeMode === "custom" && (
                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl animate-fade-in max-w-sm mt-3">
                  <div className="relative group">
                    <input
                      type="time"
                      required
                      step="900"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-500 focus:border-blue-500 focus:outline-none text-slate-800 font-semibold text-sm transition-all focus:ring-4 focus:ring-blue-500/10 shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Type Section */}
        <fieldset className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Target className="size-4" /> Select Event Type
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(EVENT_TYPES).map((type) => {
              const isSelected = eventType === type;
              const isPractice = type === EVENT_TYPES.PRACTICE;
              return (
                <label
                  key={type}
                  className="relative block cursor-pointer select-none"
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
                    className={`flex flex-col items-center p-6 rounded-2xl border-2 text-center transition-all duration-200 active:scale-[0.99] group ${
                      isSelected
                        ? "border-blue-600 bg-gradient-to-tr from-blue-50/30 to-indigo-50/30 text-blue-900 shadow-md ring-4 ring-blue-500/5 scale-[1.01]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/50 hover:scale-[1.01]"
                    }`}
                  >
                    {/* Event Type Icon Indicator */}
                    <div className={`p-3.5 rounded-2xl mb-4 transition-all duration-200 ${
                      isSelected
                        ? isPractice ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                    }`}>
                      {isPractice ? <Users className="size-6" /> : <Target className="size-6" />}
                    </div>

                    <span className="font-extrabold text-base tracking-tight mb-1">
                      {isPractice ? "Practice" : "Training Type / Focus Area"}
                    </span>
                    <span className={`text-xs font-medium leading-relaxed max-w-xs ${isSelected ? "text-blue-900/80" : "text-slate-400"}`}>
                      {isPractice
                        ? "Official team practice session (standard mandatory block)"
                        : "Voluntary extra work (e.g., Conditioning, Skill Work)"}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Duration Selection */}
        <fieldset className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock className="size-4" /> Duration
            </h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border transition-all duration-200 ${
              isDurationValid 
                ? "bg-blue-50 text-blue-700 border-blue-200" 
                : "bg-red-50 text-red-700 border-red-200 animate-pulse"
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
                    className={`py-3.5 px-2 rounded-2xl text-sm font-bold border transition-all active:scale-[0.98] ${
                      isSelected
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white shadow-lg shadow-blue-500/15 scale-[1.02] transform"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {val === 0.5 ? "30 min" : `${val} ${val === 1 ? "hr" : "hrs"}`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setDurationMode("custom")}
                className={`py-3.5 px-2 rounded-2xl text-sm font-bold border transition-all active:scale-[0.98] ${
                  durationMode === "custom"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white shadow-lg shadow-blue-500/15 scale-[1.02] transform"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Input Reveal */}
            {durationMode === "custom" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-slate-50 border border-slate-200/80 rounded-2xl animate-fade-in">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0.5"
                      max="4"
                      step="0.5"
                      value={durationInput}
                      onChange={(e) => setDurationInput(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-center font-extrabold text-slate-900 transition-all focus:outline-none focus:ring-4 ${
                        isDurationValid
                          ? "border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-500/10"
                          : "border-red-500 bg-red-50/30 focus:border-red-500 focus:ring-red-100"
                      }`}
                      placeholder="e.g. 1.5"
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-500">hours</span>
                </div>

                {/* Range validation error banner */}
                {!isDurationValid && (
                  <span className="text-xs font-bold text-red-600 animate-pulse bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 self-start sm:self-auto">
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
          className="w-full flex items-center justify-center gap-2.5 px-6 py-4.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-extrabold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/15 active:scale-[0.98] disabled:cursor-not-allowed text-base tracking-wide group"
        >
          <Play className="size-5 fill-current transition-transform group-hover:scale-110 duration-200" />
          Start Session
          <ChevronRight className="size-4 ml-0.5 transition-transform group-hover:translate-x-1 duration-200" />
        </button>
      </form>
    </div>
  );
}
