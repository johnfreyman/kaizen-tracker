import { useState, useEffect } from "react";
import { Save, UserPlus, Edit, Trophy } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import PlayerTypeDialog from "./PlayerTypeDialog";
import LeaderboardTicker from "./LeaderboardTicker";
import { formatDate } from "@/lib/dates";
import { toast } from "sonner";
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

export default function AttendancePage({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  const { state, saveSession, addPlayer, editLastSession, isGuest } = useTeamStore();
  const [presentPlayers, setPresentPlayers] = useState<Set<string>>(new Set());
  const [pendingPlayerName, setPendingPlayerName] = useState("");
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [showNoPlayersConfirm, setShowNoPlayersConfirm] = useState(false);
  const [showEditSessionConfirm, setShowEditSessionConfirm] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  useEffect(() => {
    if (!state.activeSession) {
      setPresentPlayers(new Set());
    }
  }, [state.activeSession]);

  const hasPerfectAttendanceStreak = (playerName: string) => {
    const recentEvents = state.events.slice(0, 5);
    if (recentEvents.length < 5) return false;

    return recentEvents.every(event => event.players.includes(playerName));
  };

  const togglePresent = (playerName: string) => {
    const newSet = new Set(presentPlayers);
    if (newSet.has(playerName)) {
      newSet.delete(playerName);
    } else {
      newSet.add(playerName);
    }
    setPresentPlayers(newSet);
  };

  const handleSaveSession = async () => {
    if (!state.activeSession) return;

    if (presentPlayers.size === 0) {
      setShowNoPlayersConfirm(true);
      return;
    }

    setIsSavingSession(true);
    try {
      await saveSession(Array.from(presentPlayers));
      setPresentPlayers(new Set());
    } finally {
      setIsSavingSession(false);
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

  const handleEditLastSession = () => {
    if (state.activeSession) {
      setShowEditSessionConfirm(true);
      return;
    }

    const lastEvent = editLastSession();
    if (lastEvent) {
      setPresentPlayers(new Set(lastEvent.players));
    }
  };


  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  };

  return (
    <div className="space-y-6">
      {/* Leaderboard Ticker */}
      <LeaderboardTicker onNavigate={onNavigate} />

      {/* Session Banner */}
      <div
        className="rounded-2xl border border-white/[0.08] overflow-hidden p-6 md:p-8 md:flex md:items-center md:justify-between gap-4"
        style={{ backgroundColor: "var(--mc-surface)" }}
      >
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-white/55">
            Current Session
          </span>
          <h2 className="mt-1 text-2xl md:text-3xl font-bold text-white">
            {state.activeSession
              ? state.activeSession.type
              : "No active session"}
          </h2>
          <p className="mt-1 text-white/45">
            {state.activeSession
              ? `${formatDate(state.activeSession.date)} • ${
                  state.activeSession.duration
                } ${state.activeSession.duration === 1 ? "hour" : "hours"}`
              : "Start a session from the Launch page."}
          </p>
        </div>
        <button
          onClick={handleSaveSession}
          disabled={!state.activeSession || isSavingSession}
          className="hidden md:flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSavingSession ? (
            <>
              <span className="size-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-5" />
              Save Session
            </>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={handleAddPlayer}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <UserPlus className="size-5" />
          <span>Add Player</span>
        </button>
        {state.events.length > 0 && (
          <button
            onClick={handleEditLastSession}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Edit className="size-5" />
            <span>Edit Last Session</span>
          </button>
        )}
      </div>

      {/* Player Grid */}
      {state.roster.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-white/40"
          style={{ backgroundColor: "var(--mc-surface)" }}
        >
          No players yet. Add players from Attendance or Settings.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {state.roster.map((player) => {
            const isPresent = presentPlayers.has(player);
            const hasStreak = hasPerfectAttendanceStreak(player);
            const playerIsGuest = isGuest(player);
            return (
              <button
                key={player}
                onClick={() => {
                  if (!state.activeSession) {
                    toast.warning("Start a session first.");
                    return;
                  }
                  togglePresent(player);
                }}
                className={`relative flex flex-col items-center justify-center gap-3 min-h-36 p-5 rounded-2xl border transition-all ${
                  isPresent
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : "bg-white/[0.03] border-white/[0.07] text-white/70 hover:border-white/[0.15] hover:bg-white/[0.06] hover:scale-[1.02]"
                }`}
              >
                {hasStreak && (
                  <div className="absolute -top-1 -right-1 size-8 rounded-full bg-orange-500 flex items-center justify-center border border-white/[0.08]">
                    <span className="text-lg" title="5 event streak!">🔥</span>
                  </div>
                )}
                {playerIsGuest ? (
                  <span
                    className="absolute -top-1 -left-1 text-[28px] leading-none drop-shadow-md"
                    title="Guest"
                  >
                    🏀
                  </span>
                ) : (
                  <>
                    {state.teamLogo ? (
                      <img
                        src={state.teamLogo}
                        alt="Team"
                        className="absolute -top-1 -left-1 size-7 rounded-full object-cover drop-shadow-md"
                      />
                    ) : (
                      <div className="absolute -top-1 -left-1 size-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                        <Trophy className="size-3.5 text-blue-400" />
                      </div>
                    )}
                  </>
                )}
                <div className={`size-14 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                  isPresent
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-white/[0.06] text-white/70"
                }`}>
                  {getInitials(player)}
                </div>
                <div className="text-center space-y-0.5">
                  <div className="text-sm font-semibold leading-tight">
                    {player}
                  </div>
                  <div className="text-xs opacity-60">
                    {isPresent ? "✓ Present" : "Tap to mark"}
                  </div>
                </div>
              </button>
            );
          })}
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

      {/* Add Player Dialog */}
      <Dialog open={showAddPlayerDialog} onOpenChange={setShowAddPlayerDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Player to Roster</DialogTitle>
            <DialogDescription>
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPlayerName.trim()) {
                  setPendingPlayerName(newPlayerName.trim());
                  setShowAddPlayerDialog(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddPlayerDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newPlayerName.trim()}
              onClick={() => {
                setPendingPlayerName(newPlayerName.trim());
                setShowAddPlayerDialog(false);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Session with No Players Alert */}
      <AlertDialog open={showNoPlayersConfirm} onOpenChange={setShowNoPlayersConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Players Marked Present</AlertDialogTitle>
            <AlertDialogDescription>
              No players are marked present. Save this session anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingSession}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
              disabled={isSavingSession}
              onClick={async (e) => {
                e.preventDefault();
                setIsSavingSession(true);
                try {
                  await saveSession(Array.from(presentPlayers));
                  setPresentPlayers(new Set());
                  setShowNoPlayersConfirm(false);
                } finally {
                  setIsSavingSession(false);
                }
              }}
            >
              {isSavingSession ? "Saving..." : "Save Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active Session in Progress Alert */}
      <AlertDialog open={showEditSessionConfirm} onOpenChange={setShowEditSessionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active Session in Progress</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session. Loading the last session will replace it. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
              onClick={() => {
                const lastEvent = editLastSession();
                if (lastEvent) {
                  setPresentPlayers(new Set(lastEvent.players));
                }
                setShowEditSessionConfirm(false);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky Action Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 px-4 pb-[80px] md:pb-[24px] transition-transform duration-200 ease-in-out pointer-events-none ${
          state.activeSession ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-5xl mx-auto w-full pointer-events-auto bg-[var(--mc-elev)] border border-white/[0.08] rounded-2xl px-4 py-3 shadow-2xl backdrop-blur flex items-center justify-between gap-4">
          <div className="text-white/90 text-sm md:text-base">
            <span className="opacity-80">
              <b className="font-bold text-white">{presentPlayers.size}</b> of {state.roster.length} present
            </span>
          </div>
          <button
            onClick={handleSaveSession}
            disabled={!state.activeSession || isSavingSession}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[160px]"
          >
            {isSavingSession ? (
              <>
                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-5" />
                Save Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
