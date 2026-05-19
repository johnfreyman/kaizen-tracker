import { useState } from "react";
import { Play, Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTeamStore, ActiveSession, EventType, EVENT_TYPES } from "../hooks/useTeamStore";

type Page = "launch" | "attendance" | "summary" | "settings";

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
}

export default function LaunchPage({ onNavigate }: LaunchPageProps) {
  const { startSession } = useTeamStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [eventType, setEventType] = useState<EventType>(
    EVENT_TYPES.PRACTICE
  );
  const [durationInput, setDurationInput] = useState("1");

  const parsedDuration = parseFloat(durationInput);
  const isDurationValid =
    !isNaN(parsedDuration) &&
    parsedDuration >= 0.5 &&
    parsedDuration <= 4 &&
    Number.isInteger(parsedDuration * 2);

  const selectPreset = (val: number) => {
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

    const session: ActiveSession = {
      id: crypto.randomUUID(),
      date: selectedDate.toISOString().split("T")[0],
      type: eventType,
      duration: parsedDuration,
    };

    startSession(session);
    onNavigate("attendance");
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-100">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Start a Session
        </span>
        <h2 className="mt-2 text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
          Set up today's team event.
        </h2>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl">
          Choose the event date, type, and duration before players mark themselves
          present.
        </p>
      </div>

      {/* Session Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 space-y-6"
      >
        {/* Event Date */}
        <div className="relative">
          <label className="block mb-2 font-semibold text-gray-900">
            Event Date
          </label>
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
          >
            <CalendarIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-gray-900 font-medium">
              {formatDisplayDate(selectedDate)}
            </span>
          </button>

          {showCalendar && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCalendar(false)}
              />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
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

        {/* Event Type */}
        <fieldset>
          <legend className="block mb-3 font-semibold text-gray-900">
            Event Type
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(EVENT_TYPES).map((type) => (
              <label
                key={type}
                className="relative block cursor-pointer"
              >
                <input
                  type="radio"
                  name="eventType"
                  value={type}
                  checked={eventType === type}
                  onChange={(e) =>
                    setEventType(e.target.value as EventType)
                  }
                  className="sr-only"
                />
                <div
                  className={`flex items-center justify-center min-h-16 px-4 py-3 rounded-2xl border-2 font-bold transition-all ${
                    eventType === type
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {type}
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Duration Selection */}
        <fieldset className="space-y-4">
          <div className="flex items-center justify-between">
            <legend className="font-semibold text-gray-900">
              Duration
            </legend>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
              isDurationValid 
                ? "bg-blue-50 text-blue-700 border-blue-200" 
                : "bg-red-50 text-red-700 border-red-200 animate-pulse"
            }`}>
              {isDurationValid ? `${parsedDuration} ${parsedDuration === 1 ? "hour" : "hours"}` : "Invalid Duration"}
            </span>
          </div>

          <div className="bg-gray-50/60 rounded-3xl p-5 border border-gray-200 space-y-5">
            {/* Range Slider and Number Input Row */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full flex-1 flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400">0.5h</span>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={isDurationValid ? parsedDuration : 1}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                />
                <span className="text-xs font-semibold text-gray-400">4.0h</span>
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className={`w-full sm:w-28 px-3 py-2 rounded-2xl border text-center font-bold text-gray-900 transition-all focus:outline-none focus:ring-2 ${
                    isDurationValid
                      ? "border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-100"
                      : "border-red-500 bg-red-50/30 focus:border-red-500 focus:ring-red-100"
                  }`}
                  placeholder="Hrs"
                />
                <span className="text-sm font-bold text-gray-500">hours</span>
              </div>
            </div>

            {/* Quick Select Chips and Error Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Presets:</span>
                <div className="flex gap-1.5">
                  {[1.0, 1.5, 2.0].map((preset) => {
                    const isActive = isDurationValid && parsedDuration === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => selectPreset(preset)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                          isActive
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10 -translate-y-0.5"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {preset.toFixed(1)}h
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Message */}
              {!isDurationValid && (
                <div className="text-xs font-bold text-red-600 flex items-center gap-1 animate-pulse">
                  <span>⚠️</span>
                  <span>Enter a multiple of 0.5 between 0.5 and 4.0.</span>
                </div>
              )}
            </div>
          </div>
        </fieldset>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isDurationValid}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="size-5" />
          Start Session
        </button>
      </form>
    </div>
  );
}
