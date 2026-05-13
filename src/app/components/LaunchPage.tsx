import { useState } from "react";
import { Play, Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTeamStore } from "../hooks/useTeamStore";
import { ActiveSession } from "../hooks/useTeamStore";

type Page = "launch" | "attendance" | "summary" | "settings";

interface LaunchPageProps {
  onNavigate: (page: Page) => void;
}

export default function LaunchPage({ onNavigate }: LaunchPageProps) {
  const { startSession } = useTeamStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [eventType, setEventType] = useState<"Practice" | "Optional Training">(
    "Practice"
  );
  const [duration, setDuration] = useState(1);

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

    const session: ActiveSession = {
      id: crypto.randomUUID(),
      date: selectedDate.toISOString().split("T")[0],
      type: eventType,
      duration,
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
            {["Practice", "Optional Training"].map((type) => (
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
                    setEventType(e.target.value as "Practice" | "Optional Training")
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

        {/* Duration */}
        <fieldset>
          <legend className="block mb-3 font-semibold text-gray-900">
            Duration
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {[1, 1.5, 2].map((hrs) => (
              <label
                key={hrs}
                className="relative block cursor-pointer"
              >
                <input
                  type="radio"
                  name="duration"
                  value={hrs}
                  checked={duration === hrs}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="sr-only"
                />
                <div
                  className={`flex items-center justify-center min-h-16 px-4 py-3 rounded-2xl border-2 font-bold transition-all ${
                    duration === hrs
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {hrs} {hrs === 1 ? "hour" : "hours"}
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all shadow-lg hover:shadow-xl"
        >
          <Play className="size-5" />
          Start Session
        </button>
      </form>
    </div>
  );
}
