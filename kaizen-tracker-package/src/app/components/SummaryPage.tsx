import { useState } from "react";
import { BarChart3, Calendar, Clock, Archive } from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import { formatDate } from "@/lib/dates";
import { calculateTotals, percent } from "@/lib/stats";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export default function SummaryPage() {
  const { state, archiveEvents } = useTeamStore();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const totals = calculateTotals(state.events, state.roster);
  const totalPracticePossible = state.events
    .filter((e) => e.type === EVENT_TYPES.PRACTICE)
    .reduce((sum, e) => sum + e.duration, 0);
  const totalTrainingPossible = state.events
    .filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING)
    .reduce((sum, e) => sum + e.duration, 0);
  const totalPossible = totalPracticePossible + totalTrainingPossible;


  const handleArchiveEvents = () => {
    if (state.events.length === 0) return;
    setShowArchiveConfirm(true);
  };

  const players = Object.keys(totals).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl p-6 md:p-8 shadow-xl border border-purple-100">
        <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
          Dashboard
        </span>
        <h2 className="mt-2 text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
          Team participation summary.
        </h2>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl">
          Review practice hours, optional training hours, and participation
          percentages.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="size-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-600">
              Total Events
            </span>
          </div>
          <strong className="text-4xl font-bold text-gray-900">
            {state.events.length}
          </strong>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="size-5 text-green-600" />
            <span className="text-sm font-semibold text-gray-600">
              Practice Hours
            </span>
          </div>
          <strong className="text-4xl font-bold text-gray-900">
            {totalPracticePossible.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </strong>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="size-5 text-purple-600" />
            <span className="text-sm font-semibold text-gray-600">
              Optional Training Hours
            </span>
          </div>
          <strong className="text-4xl font-bold text-gray-900">
            {totalTrainingPossible.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </strong>
        </div>
      </div>

      {/* Player Totals Table */}
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <h3 className="text-xl font-bold text-gray-900">Player Totals</h3>
          <button
            onClick={handleArchiveEvents}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 focus:ring-4 focus:ring-blue-200 transition-all"
          >
            <Archive className="size-4" />
            Archive Logged Events
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Player
                </th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Practice Hours
                </th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Practice %
                </th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Optional Hours
                </th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Optional %
                </th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Total Hours
                </th>
                <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-blue-600">
                  Total %
                </th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                    No roster or event data yet.
                  </td>
                </tr>
              ) : (
                players.map((player) => {
                  const playerTotals = totals[player];
                  const totalHours =
                    playerTotals.practice + playerTotals.training;

                  return (
                    <tr key={player} className="border-b border-gray-100">
                      <td className="px-3 py-4 font-semibold text-gray-900">
                        {player}
                      </td>
                      <td className="px-3 py-4 text-gray-700">
                        {playerTotals.practice.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-3 py-4 text-gray-700">
                        {percent(playerTotals.practice, totalPracticePossible)}
                      </td>
                      <td className="px-3 py-4 text-gray-700">
                        {playerTotals.training.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-3 py-4 text-gray-700">
                        {percent(playerTotals.training, totalTrainingPossible)}
                      </td>
                      <td className="px-3 py-4 font-semibold text-gray-900">
                        {totalHours.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-3 py-4 font-semibold text-gray-900">
                        {percent(totalHours, totalPossible)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event History */}
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Logged Events</h3>

        {state.events.length === 0 ? (
          <div className="bg-gray-50/60 border border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
            No events have been logged yet.
          </div>
        ) : (
          <div className="space-y-3">
            {state.events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-4 p-4 border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">
                    {event.type} • {formatDate(event.date)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {event.duration}{" "}
                    {event.duration === 1 ? "hour" : "hours"} •{" "}
                    {event.players.length} present
                  </div>
                </div>
                <div className="text-sm text-gray-500 text-right truncate max-w-xs">
                  {event.players.join(", ") || "No players"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive logged events?</AlertDialogTitle>
            <AlertDialogDescription>
              Archive all logged events? You can restore them later from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isArchiving}
              onClick={async (e) => {
                e.preventDefault();
                setIsArchiving(true);
                try {
                  await archiveEvents();
                  setShowArchiveConfirm(false);
                } finally {
                  setIsArchiving(false);
                }
              }}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
