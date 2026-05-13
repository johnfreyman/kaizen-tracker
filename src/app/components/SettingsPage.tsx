import { useState } from "react";
import { Save, UserPlus, X, Upload, Gift, FileText, Archive, RotateCcw, Trash2, Trophy } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import PlayerTypeDialog from "./PlayerTypeDialog";

export default function SettingsPage() {
  const { state, updateSettings, addPlayer, removePlayer, restoreArchive, deleteArchive, isGuest } = useTeamStore();
  const [teamName, setTeamName] = useState(state.teamName);
  const [raffleEnabled, setRaffleEnabled] = useState(state.raffleEnabled);
  const [pendingPlayerName, setPendingPlayerName] = useState("");

  const generatePrintableSummary = () => {
    // Calculate totals
    const calculateTotals = () => {
      const totals: Record<string, { practice: number; training: number }> = {};
      const allPlayers = new Set([
        ...state.roster,
        ...state.events.flatMap((e) => e.players),
      ]);

      allPlayers.forEach((player) => {
        totals[player] = { practice: 0, training: 0 };
      });

      state.events.forEach((event) => {
        event.players.forEach((player) => {
          if (!totals[player]) totals[player] = { practice: 0, training: 0 };
          if (event.type === "Practice") {
            totals[player].practice += event.duration;
          } else {
            totals[player].training += event.duration;
          }
        });
      });

      return totals;
    };

    const totals = calculateTotals();
    const totalPracticePossible = state.events
      .filter((e) => e.type === "Practice")
      .reduce((sum, e) => sum + e.duration, 0);
    const totalTrainingPossible = state.events
      .filter((e) => e.type === "Optional Training")
      .reduce((sum, e) => sum + e.duration, 0);
    const totalPossible = totalPracticePossible + totalTrainingPossible;

    const formatDate = (dateString: string) => {
      return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const percent = (value: number, total: number) => {
      if (!total) return "0%";
      return `${Math.round((value / total) * 100)}%`;
    };

    const players = Object.keys(totals).sort((a, b) => a.localeCompare(b));

    // Generate HTML for print
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to generate the PDF");
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
                Archived on ${new Date(archive.archivedAt).toLocaleDateString(undefined, {
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
    if (confirm("Restore this archived event set? Events will be added back to your current events.")) {
      restoreArchive(archiveId);
    }
  };

  const handleDeleteArchive = (archiveId: string) => {
    if (confirm("Permanently delete this archived event set? This cannot be undone.")) {
      deleteArchive(archiveId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      teamName: teamName.trim() || "Kaizen Tracker",
      raffleEnabled
    });
    alert("Settings saved.");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ teamLogo: reader.result as string });
      alert("Team logo updated.");
    };
    reader.readAsDataURL(file);
  };

  const handleAddPlayer = () => {
    const name = prompt("Enter player name:");
    if (!name) return;

    setPendingPlayerName(name.trim());
  };

  const handlePlayerTypeSelect = (isGuestPlayer: boolean) => {
    if (!pendingPlayerName) return;
    const success = addPlayer(pendingPlayerName, isGuestPlayer);
    setPendingPlayerName("");
    if (!success) {
      alert("That player is already on the roster.");
    }
  };

  const handleRemovePlayer = (player: string) => {
    if (
      confirm(
        `Remove ${player} from the roster? Existing event history will stay saved.`
      )
    ) {
      removePlayer(player);
    }
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
                onChange={handleLogoUpload}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
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
                      {formatDate(archive.archivedAt)}
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
                          {event.type} - {new Date(`${event.date}T12:00:00`).toLocaleDateString()}
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
        />
      )}
    </div>
  );
}
