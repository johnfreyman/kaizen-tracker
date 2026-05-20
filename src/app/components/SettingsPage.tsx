import { useState } from "react";
import { Save, UserPlus, X, Upload, Gift, FileText, Archive, RotateCcw, Trash2, Trophy } from "lucide-react";
import { useTeamStore, EVENT_TYPES, ConflictResolutionStrategy } from "../hooks/useTeamStore";
import PlayerTypeDialog from "./PlayerTypeDialog";
import { formatDate } from "@/lib/dates";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";

export default function SettingsPage() {
  const { state, updateSettings, addPlayer, removePlayer, restoreArchive, deleteArchive, isGuest, uploadLogo } = useTeamStore();
  const [teamName, setTeamName] = useState(state.teamName);
  const [raffleEnabled, setRaffleEnabled] = useState(state.raffleEnabled);
  const [pendingPlayerName, setPendingPlayerName] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [restoreReviewArchiveId, setRestoreReviewArchiveId] = useState<string | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictResolutionStrategy>("overwrite");

  // State variables for dialogs and confirmations
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [archiveIdToDelete, setArchiveIdToDelete] = useState<string | null>(null);
  const [playerToRemove, setPlayerToRemove] = useState<string | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isRemovingPlayer, setIsRemovingPlayer] = useState(false);

  // Redesigned Alert Visual Tester state
  const [isAlertTesterOpen, setIsAlertTesterOpen] = useState(false);
  const [alertResetKey, setAlertResetKey] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState({
    info: true,
    success: true,
    warning: true,
    destructive: true,
    outline: true,
  });

  const resetAlerts = () => {
    setActiveAlerts({
      info: true,
      success: true,
      warning: true,
      destructive: true,
      outline: true,
    });
    setAlertResetKey((prev) => prev + 1);
  };

  const generatePrintableSummary = () => {
    const totals = calculateTotals(state.events, state.roster);
    const totalPracticePossible = state.events
      .filter((e) => e.type === EVENT_TYPES.PRACTICE)
      .reduce((sum, e) => sum + e.duration, 0);
    const totalTrainingPossible = state.events
      .filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING)
      .reduce((sum, e) => sum + e.duration, 0);
    const totalPossible = totalPracticePossible + totalTrainingPossible;

    const players = Object.keys(totals).sort((a, b) => a.localeCompare(b));

    // Generate HTML for print
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to generate the PDF.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${state.teamName} - Session Summary</title>
        <style>
          @media print {
            @page { margin: 0.5in; }
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            color: #122033;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #153e75;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0 0 5px;
            color: #153e75;
            font-size: 32px;
          }
          .header p {
            margin: 5px 0;
            color: #68778b;
            font-size: 14px;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            text-align: center;
            padding: 15px;
            background: #f8fbff;
            border: 2px solid #153e75;
            border-radius: 8px;
          }
          .stat-card h3 {
            margin: 0 0 5px;
            font-size: 14px;
            color: #68778b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .stat-card p {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
            color: #153e75;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #d9e2ee;
          }
          th {
            background: #153e75;
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          tr:hover {
            background: #f8fbff;
          }
          .event-history {
            margin-top: 30px;
          }
          .event-history h2 {
            color: #153e75;
            border-bottom: 2px solid #153e75;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .event-item {
            padding: 10px;
            border: 1px solid #d9e2ee;
            border-radius: 4px;
            margin-bottom: 10px;
            background: white;
          }
          .event-item strong {
            color: #153e75;
          }
          .event-item small {
            color: #68778b;
            display: block;
            margin-top: 5px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #68778b;
            font-size: 12px;
            border-top: 1px solid #d9e2ee;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${state.teamName || "Kaizen Tracker"}</h1>
          <p>Session Summary Report</p>
          <p>Generated on ${new Date().toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</p>
        </div>

        <div class="stats">
          <div class="stat-card">
            <h3>Total Events</h3>
            <p>${state.events.length}</p>
          </div>
          <div class="stat-card">
            <h3>Practice Hours</h3>
            <p>${totalPracticePossible.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}</p>
          </div>
          <div class="stat-card">
            <h3>Training Hours</h3>
            <p>${totalTrainingPossible.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}</p>
          </div>
        </div>

        <h2 style="color: #153e75; margin-bottom: 15px;">Player Totals</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Practice Hours</th>
              <th>Practice %</th>
              <th>Optional Hours</th>
              <th>Optional %</th>
              <th>Total Hours</th>
              <th>Total %</th>
            </tr>
          </thead>
          <tbody>
            ${
              players.length === 0
                ? '<tr><td colspan="7" style="text-align: center; color: #68778b;">No roster or event data yet.</td></tr>'
                : players
                    .map((player) => {
                      const playerTotals = totals[player];
                      const totalHours =
                        playerTotals.practice + playerTotals.training;
                      return `
                      <tr>
                        <td><strong>${player}</strong></td>
                        <td>${playerTotals.practice.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}</td>
                        <td>${percent(
                          playerTotals.practice,
                          totalPracticePossible
                        )}</td>
                        <td>${playerTotals.training.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}</td>
                        <td>${percent(
                          playerTotals.training,
                          totalTrainingPossible
                        )}</td>
                        <td><strong>${totalHours.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}</strong></td>
                        <td><strong>${percent(totalHours, totalPossible)}</strong></td>
                      </tr>
                    `;
                    })
                    .join("")
            }
          </tbody>
        </table>

        <div class="event-history">
          <h2>Event History</h2>
          ${
            state.events.length === 0
              ? '<p style="color: #68778b; text-align: center;">No events have been logged yet.</p>'
              : state.events
                  .map(
                    (event) => `
                  <div class="event-item">
                    <strong>${event.type} • ${formatDate(event.date)}</strong>
                    <small>${event.duration} ${
                      event.duration === 1 ? "hour" : "hours"
                    } • ${event.players.length} present: ${
                      event.players.join(", ") || "No players"
                    }</small>
                  </div>
                `
                  )
                  .join("")
          }
        </div>

        ${
          state.archivedEvents.length > 0
            ? `
        <div class="event-history" style="margin-top: 40px;">
          <h2>Archived Events</h2>
          ${state.archivedEvents
            .map(
              (archive) => `
            <div style="margin-bottom: 30px;">
              <h3 style="color: #153e75; font-size: 16px; margin-bottom: 10px;">
                Archived on ${formatDate(archive.archivedAt, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })} (${archive.events.length} events)
              </h3>
              ${archive.events
                .map(
                  (event) => `
                <div class="event-item">
                  <strong>${event.type} • ${formatDate(event.date)}</strong>
                  <small>${event.duration} ${
                    event.duration === 1 ? "hour" : "hours"
                  } • ${event.players.length} present: ${
                    event.players.join(", ") || "No players"
                  }</small>
                </div>
              `
                )
                .join("")}
            </div>
          `
            )
            .join("")}
        </div>
        `
            : ""
        }

        <div class="footer">
          <p>${state.teamName || "Kaizen Tracker"} • Attendance & Training Hours</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleRestoreArchive = (archiveId: string) => {
    setRestoreReviewArchiveId(archiveId);
    setConflictStrategy("overwrite"); // Reset strategy to default
  };

  const handleDeleteArchive = (archiveId: string) => {
    setArchiveIdToDelete(archiveId);
  };



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      teamName: teamName.trim() || "Team Name",
      raffleEnabled
    });
    toast.success("Settings saved successfully.");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      await uploadLogo(file);
      toast.success("Team logo updated successfully.");
    } catch (err) {
      // Error handles in the hook via toast
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleAddPlayer = () => {
    setNewPlayerName("");
    setShowAddPlayerDialog(true);
  };

  const handlePlayerTypeSelect = async (isGuestPlayer: boolean) => {
    if (!pendingPlayerName) return;

    const nameLower = pendingPlayerName.trim().toLowerCase();
    if (state.roster.some((p) => p.toLowerCase() === nameLower)) {
      toast.error("That player is already on the roster.");
      return;
    }

    setIsAddingPlayer(true);
    try {
      await addPlayer(pendingPlayerName, isGuestPlayer);
      setPendingPlayerName("");
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleRemovePlayer = (player: string) => {
    setPlayerToRemove(player);
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Settings
            </span>
            <h2 className="mt-2 text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
              Customize your team.
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl">
              Update team branding and manage the roster stored on this device.
            </p>
          </div>
          <button
            onClick={generatePrintableSummary}
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-indigo-600 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 focus:ring-4 focus:ring-indigo-200 transition-all shadow-md hover:shadow-lg"
          >
            <FileText className="size-5" />
            Generate PDF
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Team Settings Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 space-y-6"
        >
          <div>
            <label className="block mb-2 font-semibold text-gray-900">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold text-gray-900">
              Team Logo
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingLogo}
                onChange={handleLogoUpload}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {isUploadingLogo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600 animate-pulse">
                  Uploading...
                </div>
              )}
            </div>
            {state.teamLogo && (
              <div className="mt-4 p-4 bg-gray-50 rounded-2xl">
                <img
                  src={state.teamLogo}
                  alt="Team logo preview"
                  className="size-20 object-cover rounded-xl mx-auto"
                />
                <p className="text-xs text-gray-500 text-center mt-2">
                  Current logo
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={raffleEnabled}
                onChange={(e) => setRaffleEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
              />
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Gift className="size-4 text-purple-600" />
                  Enable Prize Wheel
                </div>
                <p className="text-sm text-gray-600">
                  Show a raffle wheel in the navigation. Players earn entries by
                  attending optional training.
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all shadow-lg"
          >
            <Save className="size-5" />
            Save Settings
          </button>
        </form>

        {/* Roster Management */}
        <div className="lg:col-span-3 bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Roster</h3>
            <button
              onClick={handleAddPlayer}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-100 focus:ring-4 focus:ring-blue-200 transition-all"
            >
              <UserPlus className="size-4" />
              Add Player
            </button>
          </div>

          {state.roster.length === 0 ? (
            <div className="bg-gray-50/60 border border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
              No players on the roster yet.
            </div>
          ) : (
            <div className="space-y-3">
              {state.roster.map((player) => {
                const playerIsGuest = isGuest(player);
                return (
                  <div
                    key={player}
                    className="flex items-center justify-between gap-4 p-4 border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      {playerIsGuest ? (
                        <span className="text-[32px] leading-none drop-shadow-md" title="Guest">
                          🏀
                        </span>
                      ) : (
                        <>
                          {state.teamLogo ? (
                            <img
                              src={state.teamLogo}
                              alt="Team"
                              className="size-8 rounded-full object-cover drop-shadow-md"
                            />
                          ) : (
                            <div className="size-8 rounded-full bg-white flex items-center justify-center shadow-lg border-2 border-gray-200">
                            <Trophy className="size-4 text-blue-600" />
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{player}</div>
                        <div className="text-sm text-gray-500">
                          {playerIsGuest ? "Guest" : "Roster player"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePlayer(player)}
                      title={`Remove ${player}`}
                      className="size-10 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 focus:ring-4 focus:ring-red-200 transition-all font-bold text-xl"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Archived Events */}
      {state.archivedEvents.length > 0 && (
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Archive className="size-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">Archived Events</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            View and restore previously archived event sets.
          </p>

          <div className="space-y-3">
            {state.archivedEvents.map((archive) => (
              <div
                key={archive.id}
                className="p-4 border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {archive.events.length} events archived
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(archive.archivedAt, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestoreArchive(archive.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                      title="Restore archive"
                    >
                      <RotateCcw className="size-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteArchive(archive.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Delete archive"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-indigo-600 font-semibold hover:text-indigo-700">
                    View events ({archive.events.length})
                  </summary>
                  <div className="mt-3 space-y-3 pl-4 border-l-2 border-indigo-200">
                    {archive.events.map((event) => (
                      <div key={event.id} className="text-gray-600">
                        <div className="font-semibold text-gray-900">
                          {event.type} - {formatDate(event.date)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {event.duration} {event.duration === 1 ? "hour" : "hours"} • {event.players.length} {event.players.length === 1 ? "player" : "players"}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">Attended:</span> {event.players.length > 0 ? event.players.join(", ") : "No players"}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
      {pendingPlayerName && (
        <PlayerTypeDialog
          playerName={pendingPlayerName}
          onSelect={handlePlayerTypeSelect}
          onCancel={() => setPendingPlayerName("")}
          isLoading={isAddingPlayer}
        />
      )}

      {restoreReviewArchiveId && (() => {
        const reviewArchive = state.archivedEvents.find((a) => a.id === restoreReviewArchiveId);
        if (!reviewArchive) return null;

        const currentEventsMap = new Map(state.events.map((e) => [e.id, e]));
        const archiveEvents = reviewArchive.events;
        const conflicts = archiveEvents.filter((e) => currentEventsMap.has(e.id)).map((e) => ({
          archived: e,
          current: currentEventsMap.get(e.id)!,
        }));
        const newEvents = archiveEvents.filter((e) => !currentEventsMap.has(e.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col my-8 max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50/50">
                <div className="flex items-center gap-3">
                  <Archive className="size-7 text-indigo-600 animate-pulse" />
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">Review Restoration</h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                      Archived on {formatDate(reviewArchive.archivedAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoreReviewArchiveId(null)}
                  className="p-2 hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                >
                  <X className="size-6" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 min-h-0">
                {/* Summary Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-sm font-semibold text-indigo-600/80">Total Archived</span>
                    <span className="text-2xl md:text-3xl font-black text-indigo-900 mt-1">
                      {archiveEvents.length} <span className="text-sm font-normal text-indigo-500">events</span>
                    </span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-sm font-semibold text-emerald-600/80">New Events to Add</span>
                    <span className="text-2xl md:text-3xl font-black text-emerald-950 mt-1">
                      {newEvents.length} <span className="text-sm font-normal text-emerald-500">events</span>
                    </span>
                  </div>
                  <div className={`p-4 rounded-2xl flex flex-col justify-center border ${conflicts.length > 0 ? "bg-amber-50/50 border-amber-200/50" : "bg-slate-50/50 border-slate-100"}`}>
                    <span className={`text-sm font-semibold ${conflicts.length > 0 ? "text-amber-600" : "text-slate-500"}`}>Conflicting IDs</span>
                    <span className={`text-2xl md:text-3xl font-black mt-1 ${conflicts.length > 0 ? "text-amber-950" : "text-slate-600"}`}>
                      {conflicts.length} <span className="text-sm font-normal text-slate-400">conflicts</span>
                    </span>
                  </div>
                </div>

                {/* New Events List */}
                {newEvents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">New Events ({newEvents.length})</h4>
                    <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-4 space-y-3 max-h-[200px] overflow-y-auto">
                      {newEvents.map((e) => (
                        <div key={e.id} className="flex justify-between items-center text-sm p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <div>
                            <span className="font-semibold text-slate-800">{e.type}</span>
                            <span className="text-slate-400 mx-2">•</span>
                            <span className="text-slate-500">{formatDate(e.date)}</span>
                          </div>
                          <div className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                            {e.duration} hr{e.duration !== 1 && "s"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts Section */}
                {conflicts.length > 0 && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex gap-3">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <h4 className="font-bold text-amber-900 text-sm md:text-base">Conflict Strategy Settings Needed</h4>
                        <p className="text-xs md:text-sm text-amber-800/90 mt-1">
                          There are <strong>{conflicts.length} conflicting events</strong> already present in your active tracking. Please choose your conflict resolution policy below.
                        </p>
                      </div>
                    </div>

                    {/* Strategy Selector (Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Overwrite */}
                      <button
                        type="button"
                        onClick={() => setConflictStrategy("overwrite")}
                        className={`p-4 text-left rounded-2xl border transition-all flex flex-col justify-between h-full relative ${
                          conflictStrategy === "overwrite"
                            ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            conflictStrategy === "overwrite" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            Overwrite
                          </span>
                          <h5 className="font-bold text-slate-800 mt-2 text-sm">Last-Write-Wins</h5>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Replace current active events with their archived versions. Existing versions will be overwritten.
                          </p>
                        </div>
                      </button>

                      {/* Skip */}
                      <button
                        type="button"
                        onClick={() => setConflictStrategy("skip")}
                        className={`p-4 text-left rounded-2xl border transition-all flex flex-col justify-between h-full relative ${
                          conflictStrategy === "skip"
                            ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            conflictStrategy === "skip" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            Skip Duplicates
                          </span>
                          <h5 className="font-bold text-slate-800 mt-2 text-sm">Keep Current</h5>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Keep active events exactly as they are. Only restore new, non-conflicting archived events.
                          </p>
                        </div>
                      </button>

                      {/* Error */}
                      <button
                        type="button"
                        onClick={() => setConflictStrategy("error")}
                        className={`p-4 text-left rounded-2xl border transition-all flex flex-col justify-between h-full relative ${
                          conflictStrategy === "error"
                            ? "border-red-600 bg-red-50/30 ring-2 ring-red-600/20"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            conflictStrategy === "error" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            Fail / Abort
                          </span>
                          <h5 className="font-bold text-slate-800 mt-2 text-sm">Raise Error</h5>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Strict validation policy. Throw a clear error notification and halt the restoration process.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Conflict Diffs (Comparison View) */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-6">Conflict Comparison ({conflicts.length})</h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {conflicts.map((conflict, index) => (
                          <div key={conflict.archived.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-slate-100 p-2.5 border-b border-slate-200 flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-600">Conflict #{index + 1}</span>
                              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">ID: {conflict.archived.id.slice(0, 8)}...</span>
                            </div>

                            {/* Side-by-side or stacked diff grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">
                              {/* Current Event */}
                              <div className={`p-4 ${conflictStrategy === "skip" ? "bg-slate-50/40" : "bg-red-50/10"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-slate-400 uppercase">Current Event</span>
                                  {conflictStrategy === "skip" && (
                                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                      Preserved
                                    </span>
                                  )}
                                  {conflictStrategy === "overwrite" && (
                                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                      Overwritten
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-800 text-sm">{conflict.current.type}</div>
                                  <div className="text-xs text-slate-500">Date: {formatDate(conflict.current.date)}</div>
                                  <div className="text-xs text-slate-500">Duration: {conflict.current.duration} hr{conflict.current.duration !== 1 && "s"}</div>
                                  <div className="text-xs text-slate-600 mt-2 line-clamp-2">
                                    <span className="font-semibold text-slate-500">Attended:</span> {conflict.current.players.length > 0 ? conflict.current.players.join(", ") : "None"}
                                  </div>
                                </div>
                              </div>

                              {/* Archived Event */}
                              <div className={`p-4 ${conflictStrategy === "overwrite" ? "bg-emerald-50/20" : "bg-slate-50/40"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-indigo-500 uppercase">Archived Event</span>
                                  {conflictStrategy === "overwrite" && (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                      Restored
                                    </span>
                                  )}
                                  {conflictStrategy === "skip" && (
                                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                      Skipped
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-800 text-sm">{conflict.archived.type}</div>
                                  <div className="text-xs text-slate-500">Date: {formatDate(conflict.archived.date)}</div>
                                  <div className="text-xs text-slate-500">Duration: {conflict.archived.duration} hr{conflict.archived.duration !== 1 && "s"}</div>
                                  <div className="text-xs text-slate-600 mt-2 line-clamp-2">
                                    <span className="font-semibold text-slate-500">Attended:</span> {conflict.archived.players.length > 0 ? conflict.archived.players.join(", ") : "None"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setRestoreReviewArchiveId(null)}
                  className="w-full sm:w-auto px-6 py-3 font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all text-center"
                >
                  Cancel
                </button>

                {conflictStrategy === "error" && conflicts.length > 0 ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-6 py-3 font-semibold text-red-400 bg-red-50 border border-red-200 rounded-xl cursor-not-allowed text-center"
                  >
                    Cannot Restore (Abort Strategy Selected)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await restoreArchive(reviewArchive.id, conflictStrategy);
                      setRestoreReviewArchiveId(null);
                    }}
                    className="w-full sm:w-auto px-6 py-3 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-700/30 active:shadow-indigo-800/40 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center"
                  >
                    Confirm & Restore
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Player Dialog */}
      <Dialog open={showAddPlayerDialog} onOpenChange={setShowAddPlayerDialog}>
        <DialogContent className="sm:max-w-[425px] bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Add Player to Roster</DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter the name of the player you would like to add.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player Name"
              autoFocus
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPlayerName.trim()) {
                  setPendingPlayerName(newPlayerName.trim());
                  setShowAddPlayerDialog(false);
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddPlayerDialog(false)} className="rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newPlayerName.trim()}
              onClick={() => {
                setPendingPlayerName(newPlayerName.trim());
                setShowAddPlayerDialog(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Archive Confirmation Alert */}
      <AlertDialog open={archiveIdToDelete !== null} onOpenChange={(open) => !open && setArchiveIdToDelete(null)}>
        <AlertDialogContent className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">Delete Archived Events?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Permanently delete this archived event set? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all shadow-md"
              onClick={() => {
                if (archiveIdToDelete) {
                  deleteArchive(archiveIdToDelete);
                  toast.success("Archived event set deleted successfully.");
                  setArchiveIdToDelete(null);
                }
              }}
            >
              Delete Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Player Confirmation Alert */}
      <AlertDialog open={playerToRemove !== null} onOpenChange={(open) => !open && setPlayerToRemove(null)}>
        <AlertDialogContent className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">Remove Player from Roster?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to remove <span className="font-semibold text-gray-900">{playerToRemove}</span> from the roster? Existing event history will stay saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50" disabled={isRemovingPlayer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all shadow-md"
              disabled={isRemovingPlayer}
              onClick={async (e) => {
                e.preventDefault();
                if (playerToRemove) {
                  setIsRemovingPlayer(true);
                  try {
                    await removePlayer(playerToRemove);
                    setPlayerToRemove(null);
                  } finally {
                    setIsRemovingPlayer(false);
                  }
                }
              }}
            >
              {isRemovingPlayer ? "Removing..." : "Remove Player"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Redesigned Alert Visual Tester Panel */}
      <div className="bg-gradient-to-br from-white to-slate-50/50 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80 space-y-6 transition-all duration-300">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Gift className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Alert Redesign Visual Tester</h3>
              <p className="text-xs text-slate-500 font-medium">Verify alert hierarchy, theme variant colors, auto-injected icons, and dismiss animations.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAlerts}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-95"
            >
              <RotateCcw className="size-4" />
              Reset Alerts
            </button>
            <button
              type="button"
              onClick={() => setIsAlertTesterOpen(!isAlertTesterOpen)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all active:scale-95"
            >
              {isAlertTesterOpen ? "Collapse Tester" : "Expand Tester"}
            </button>
          </div>
        </div>

        {isAlertTesterOpen && (
          <div className="space-y-4 pt-2 animate-in fade-in-0 duration-300">
            {activeAlerts.info && (
              <Alert
                key={`info-${alertResetKey}`}
                variant="info"
                dismissible
                onClose={() => setActiveAlerts((prev) => ({ ...prev, info: false }))}
                title="System Information (Info State)"
                description="This is a redesigned info alert with HSL-tailored blue gradients, glassmorphism, responsive hover micro-shifts, and transition-delayed height collapse dismissal."
              />
            )}

            {activeAlerts.success && (
              <Alert
                key={`success-${alertResetKey}`}
                variant="success"
                dismissible
                onClose={() => setActiveAlerts((prev) => ({ ...prev, success: false }))}
                title="Operation Completed (Success State)"
                description="Your changes have been saved successfully. Notice the vibrant yet elegant background and matching text/icon themes."
              />
            )}

            {activeAlerts.warning && (
              <Alert
                key={`warning-${alertResetKey}`}
                variant="warning"
                dismissible
                onClose={() => setActiveAlerts((prev) => ({ ...prev, warning: false }))}
                title="Caution Required (Warning State)"
                description="This action cannot be fully reverted without restoration. Please double check all player roster entries before submitting."
              />
            )}

            {activeAlerts.destructive && (
              <Alert
                key={`destructive-${alertResetKey}`}
                variant="destructive"
                dismissible
                onClose={() => setActiveAlerts((prev) => ({ ...prev, destructive: false }))}
                title="Crucial Failure / Destructive Action (Error State)"
                description="A network write operation timed out while communicating with the database server. Please verify your internet connection."
              />
            )}

            {activeAlerts.outline && (
              <Alert
                key={`outline-${alertResetKey}`}
                variant="outline"
                dismissible
                onClose={() => setActiveAlerts((prev) => ({ ...prev, outline: false }))}
                title="Minimalist Accent (Outline State)"
                description="This border-only variant offers sleek aesthetics with neutral line-work, perfectly suited for high-density dashboard layouts."
              />
            )}

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Technical Highlights</span>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                <li><strong>Auto-Icon Injection:</strong> Icons are contextually loaded based on variant properties.</li>
                <li><strong>Dynamic Exit Animation:</strong> Clicking <code className="bg-slate-200/60 px-1 py-0.5 rounded">X</code> invokes a dual-state height & opacity collapse over 300ms, completely avoiding layout jumps.</li>
                <li><strong>State-Safe:</strong> Resetting re-keys the components to clean React mount cycles.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
