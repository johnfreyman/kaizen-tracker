import { useState, useEffect } from "react";
import { Save, UserPlus, X, Gift, FileText, Archive, RotateCcw, Trash2, Trophy, Sun, Moon, Monitor } from "lucide-react";
import ExportPdfDrawer from "./ExportPdfDrawer";
import { useTeamStore, ConflictResolutionStrategy } from "../hooks/useTeamStore";
import { useTheme, type Theme } from "../hooks/useTheme";
import PlayerTypeDialog from "./PlayerTypeDialog";
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
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";

export default function SettingsPage() {
  const { state, updateSettings, addPlayer, removePlayer, archiveEvents, restoreArchive, deleteArchive, isGuest, uploadLogo } = useTeamStore();
  const { theme, setTheme } = useTheme();
  const [teamName, setTeamName] = useState(state.teamName);
  const [raffleEnabled, setRaffleEnabled] = useState(state.raffleEnabled);
  const [pendingPlayerName, setPendingPlayerName] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resizeImage = async (file: File): Promise<File> => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    const maxDim = 512;
    let { width, height } = img;
    if (width > height) {
      if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
    } else {
      if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), file.type));
    URL.revokeObjectURL(objectUrl);
    return new File([blob], file.name, { type: file.type });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidationError(null);
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setValidationError('Unsupported file format. Please use PNG, JPEG, WebP, or SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setValidationError('File is too large. Maximum size is 2 MiB.');
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
    let fileToUpload = file;
    if (file.type !== 'image/svg+xml') {
      try { fileToUpload = await resizeImage(file); }
      catch (err) { console.error('Resize error', err); setValidationError('Failed to process image.'); return; }
    }
    setIsUploadingLogo(true);
    setUploadProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 200);
      await uploadLogo(fileToUpload);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setPreviewUrl(null);
      toast.success('Team logo updated successfully.');
    } catch (_err) {
      // handled inside uploadLogo
    } finally {
      setIsUploadingLogo(false);
      setUploadProgress(0);
    }
  };

  const [restoreReviewArchiveId, setRestoreReviewArchiveId] = useState<string | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictResolutionStrategy>("overwrite");
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [archiveIdToDelete, setArchiveIdToDelete] = useState<string | null>(null);
  const [playerToRemove, setPlayerToRemove] = useState<string | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isRemovingPlayer, setIsRemovingPlayer] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleRestoreArchive = (archiveId: string) => {
    setRestoreReviewArchiveId(archiveId);
    setConflictStrategy("overwrite");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ teamName: teamName.trim() || "Team Name", raffleEnabled });
    toast.success("Settings saved successfully.");
  };

  const handleAddPlayer = () => { setNewPlayerName(""); setShowAddPlayerDialog(true); };

  const handlePlayerTypeSelect = async (isGuestPlayer: boolean) => {
    if (!pendingPlayerName) return;
    const nameLower = pendingPlayerName.trim().toLowerCase();
    if (state.roster.some((p) => p.toLowerCase() === nameLower)) {
      toast.error("That player is already on the roster.");
      return;
    }
    setIsAddingPlayer(true);
    try { await addPlayer(pendingPlayerName, isGuestPlayer); setPendingPlayerName(""); }
    finally { setIsAddingPlayer(false); }
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="rounded-3xl p-6 md:p-8 shadow-xl border mc-border bg-gradient-to-br from-[var(--mc-card)] to-indigo-50 dark:to-indigo-500/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Settings
            </span>
            <h2 className="mt-2 text-3xl md:text-5xl font-bold mc-text leading-tight">
              Customize your team.
            </h2>
            <p className="mt-3 text-lg mc-text-secondary max-w-2xl">
              Update team branding and manage the roster stored on this device.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Team Settings Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 rounded-3xl p-6 md:p-8 shadow-xl border mc-border space-y-6"
          style={{ background: "var(--mc-card)" }}
        >
          <div>
            <label className="block mb-2 font-semibold mc-text">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              className="w-full px-4 py-3 rounded-2xl border mc-border mc-text placeholder:mc-text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              style={{ background: "var(--mc-surface)", color: "var(--mc-text-primary)" }}
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold mc-text">
              Team Logo
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={isUploadingLogo}
                onChange={handleFileSelect}
                className="w-full px-4 py-3 rounded-2xl border mc-border mc-text file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 dark:file:bg-blue-500/15 file:text-blue-700 dark:file:text-blue-400 file:font-semibold hover:file:bg-blue-100 dark:hover:file:bg-blue-500/25 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--mc-surface)" }}
              />
              <p className="mt-1.5 text-xs mc-text-muted">
                Supported formats: PNG, JPEG, WebP, SVG &middot; Max 2 MiB &middot; Resized to 512px
              </p>
              {validationError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Upload Error</AlertTitle>
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              {previewUrl && (
                <div className="mt-4 flex items-center gap-4">
                  <img src={previewUrl} alt="Logo preview" className="h-20 w-20 object-cover rounded-xl" />
                  <span className="text-sm mc-text-secondary">Preview</span>
                </div>
              )}
              {isUploadingLogo && (
                <div className="mt-2 w-full">
                  <div className="w-full rounded-full h-2.5" style={{ background: "var(--mc-card-hover)" }}>
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-width duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Uploading... {uploadProgress}%</p>
                </div>
              )}
              {state.teamLogo && (
                <div className="mt-4 p-4 rounded-2xl" style={{ background: "var(--mc-surface)" }}>
                  <img src={state.teamLogo} alt="Team logo preview" className="size-20 object-cover rounded-xl mx-auto" />
                  <p className="text-xs mc-text-muted text-center mt-2">Current logo</p>
                </div>
              )}
            </div>
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
                <div className="font-semibold mc-text flex items-center gap-2">
                  <Gift className="size-4 text-purple-600 dark:text-purple-400" />
                  Enable Prize Wheel
                </div>
                <p className="text-sm mc-text-secondary">
                  Show a raffle wheel in the navigation. Players earn entries by
                  attending optional training.
                </p>
              </div>
            </label>
          </div>

          {/* Appearance */}
          <div>
            <div className="font-semibold mc-text flex items-center gap-2 mb-3">
              <Sun className="size-4 text-amber-500" />
              Appearance
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "dark",   label: "Dark",   icon: <Moon   className="size-4" /> },
                  { value: "light",  label: "Light",  icon: <Sun    className="size-4" /> },
                  { value: "system", label: "System", icon: <Monitor className="size-4" /> },
                ] as { value: Theme; label: string; icon: React.ReactNode }[]
              ).map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all ${
                    theme === value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
                      : "mc-border mc-text-secondary hover:bg-[var(--mc-card-hover)]"
                  }`}
                  style={theme !== value ? { background: "var(--mc-card)" } : undefined}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
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
        <div className="lg:col-span-3 rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold mc-text">Roster</h3>
            <button
              onClick={handleAddPlayer}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-semibold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/25 focus:ring-4 focus:ring-blue-200 transition-all"
            >
              <UserPlus className="size-4" />
              Add Player
            </button>
          </div>

          {state.roster.length === 0 ? (
            <div className="border border-dashed mc-border rounded-2xl p-8 text-center mc-text-muted" style={{ background: "var(--mc-surface)" }}>
              No players on the roster yet.
            </div>
          ) : (
            <div className="space-y-3">
              {state.roster.map((player) => {
                const playerIsGuest = isGuest(player);
                return (
                  <div
                    key={player}
                    className="flex items-center justify-between gap-4 p-4 border mc-border rounded-2xl transition-shadow hover:shadow-md"
                    style={{ background: "var(--mc-surface)" }}
                  >
                    <div className="flex items-center gap-3">
                      {playerIsGuest ? (
                        <span className="text-[32px] leading-none drop-shadow-md" title="Guest">🏀</span>
                      ) : (
                        <>
                          {state.teamLogo ? (
                            <img src={state.teamLogo} alt="Team" className="size-8 rounded-full object-cover drop-shadow-md" />
                          ) : (
                            <div className="size-8 rounded-full flex items-center justify-center shadow-lg border-2 mc-border" style={{ background: "var(--mc-card)" }}>
                              <Trophy className="size-4 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <div className="font-semibold mc-text">{player}</div>
                        <div className="text-sm mc-text-muted">
                          {playerIsGuest ? "Guest" : "Roster player"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setPlayerToRemove(player)}
                      title={`Remove ${player}`}
                      className="size-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/25 focus:ring-4 focus:ring-red-200 transition-all font-bold text-xl"
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

      {/* Archive Logged Events */}
      {state.events.length > 0 && (
        <div className="rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-card)" }}>
          <div className="flex items-center gap-3 mb-2">
            <Archive className="size-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold mc-text">Archive logged events</h3>
          </div>
          <p className="text-sm mc-text-secondary mb-4">
            Move all {state.events.length} current event{state.events.length !== 1 ? "s" : ""} into an archive set so you can start a fresh season. Archived events can be restored from the panel below.
          </p>
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-semibold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-all"
          >
            <Archive className="size-4" />
            Archive events
          </button>
        </div>
      )}

      {/* Archived Events */}
      {state.archivedEvents.length > 0 && (
        <div className="rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-card)" }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Archive className="size-6 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xl font-bold mc-text">Archived Events</h3>
            </div>
            <button
              onClick={() => setShowExportDrawer(true)}
              className="flex items-center gap-1.5 text-sm mc-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileText className="size-4" />
              Print full archive
            </button>
          </div>
          <p className="text-sm mc-text-secondary mb-4">
            View and restore previously archived event sets.
          </p>

          <div className="space-y-3">
            {state.archivedEvents.map((archive) => (
              <div
                key={archive.id}
                className="p-4 border mc-border rounded-2xl transition-shadow hover:shadow-md"
                style={{ background: "var(--mc-surface)" }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-semibold mc-text">
                      {archive.events.length} events archived
                    </div>
                    <div className="text-sm mc-text-muted">
                      {formatDate(archive.archivedAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestoreArchive(archive.id)}
                      className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15 rounded-xl transition-colors"
                      title="Restore archive"
                    >
                      <RotateCcw className="size-5" />
                    </button>
                    <button
                      onClick={() => setArchiveIdToDelete(archive.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-xl transition-colors"
                      title="Delete archive"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300">
                    View events ({archive.events.length})
                  </summary>
                  <div className="mt-3 space-y-3 pl-4 border-l-2 border-indigo-200 dark:border-indigo-500/30">
                    {archive.events.map((event) => (
                      <div key={event.id} className="mc-text-secondary">
                        <div className="font-semibold mc-text">
                          {event.type} - {formatDate(event.date)}
                        </div>
                        <div className="text-sm mc-text-secondary mt-1">
                          {event.duration} {event.duration === 1 ? "hour" : "hours"} • {event.players.length} {event.players.length === 1 ? "player" : "players"}
                        </div>
                        <div className="text-sm mc-text-secondary mt-1">
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

      {/* Restore Review Modal */}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in">
            <div className="rounded-3xl max-w-4xl w-full shadow-2xl border mc-border flex flex-col my-8 max-h-[85vh] overflow-hidden" style={{ background: "var(--mc-surface)" }}>
              {/* Header */}
              <div className="p-6 md:p-8 border-b mc-border flex items-center justify-between bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 to-transparent">
                <div className="flex items-center gap-3">
                  <Archive className="size-7 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  <div>
                    <h3 className="text-xl md:text-2xl font-black mc-text">Review Restoration</h3>
                    <p className="text-xs md:text-sm mc-text-muted font-medium mt-0.5">
                      Archived on {formatDate(reviewArchive.archivedAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoreReviewArchiveId(null)}
                  className="p-2 hover:bg-[var(--mc-card-hover)] mc-text-muted hover:mc-text rounded-xl transition-all"
                >
                  <X className="size-6" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 min-h-0">
                {/* Summary Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/30 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Total Archived</span>
                    <span className="text-2xl md:text-3xl font-black text-indigo-900 dark:text-indigo-300 mt-1">
                      {archiveEvents.length} <span className="text-sm font-normal text-indigo-500">events</span>
                    </span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">New Events to Add</span>
                    <span className="text-2xl md:text-3xl font-black text-emerald-900 dark:text-emerald-300 mt-1">
                      {newEvents.length} <span className="text-sm font-normal text-emerald-500">events</span>
                    </span>
                  </div>
                  <div className={`p-4 rounded-2xl flex flex-col justify-center border ${conflicts.length > 0 ? "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30" : "border mc-border"}`} style={conflicts.length === 0 ? { background: "var(--mc-card)" } : undefined}>
                    <span className={`text-sm font-semibold ${conflicts.length > 0 ? "text-amber-600 dark:text-amber-400" : "mc-text-muted"}`}>Conflicting IDs</span>
                    <span className={`text-2xl md:text-3xl font-black mt-1 ${conflicts.length > 0 ? "text-amber-900 dark:text-amber-300" : "mc-text-secondary"}`}>
                      {conflicts.length} <span className="text-sm font-normal mc-text-muted">conflicts</span>
                    </span>
                  </div>
                </div>

                {/* New Events List */}
                {newEvents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold mc-text-muted uppercase tracking-wider mb-3">New Events ({newEvents.length})</h4>
                    <div className="rounded-2xl border mc-border p-4 space-y-3 max-h-[200px] overflow-y-auto" style={{ background: "var(--mc-card)" }}>
                      {newEvents.map((e) => (
                        <div key={e.id} className="flex justify-between items-center text-sm p-2 rounded-xl border mc-border shadow-sm" style={{ background: "var(--mc-surface)" }}>
                          <div>
                            <span className="font-semibold mc-text">{e.type}</span>
                            <span className="mc-text-muted mx-2">•</span>
                            <span className="mc-text-secondary">{formatDate(e.date)}</span>
                          </div>
                          <div className="text-xs bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/30">
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
                    <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex gap-3">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm md:text-base">Conflict Strategy Settings Needed</h4>
                        <p className="text-xs md:text-sm text-amber-800 dark:text-amber-400 mt-1">
                          There are <strong>{conflicts.length} conflicting events</strong> already present in your active tracking. Please choose your conflict resolution policy below.
                        </p>
                      </div>
                    </div>

                    {/* Strategy Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { value: "overwrite" as ConflictResolutionStrategy, badge: "Overwrite", title: "Last-Write-Wins", desc: "Replace current active events with their archived versions. Existing versions will be overwritten.", danger: false },
                        { value: "skip" as ConflictResolutionStrategy, badge: "Skip Duplicates", title: "Keep Current", desc: "Keep active events exactly as they are. Only restore new, non-conflicting archived events.", danger: false },
                        { value: "error" as ConflictResolutionStrategy, badge: "Fail / Abort", title: "Raise Error", desc: "Strict validation policy. Throw a clear error notification and halt the restoration process.", danger: true },
                      ].map(({ value, badge, title, desc, danger }) => {
                        const active = conflictStrategy === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setConflictStrategy(value)}
                            className={`p-4 text-left rounded-2xl border transition-all flex flex-col justify-between h-full relative ${
                              active
                                ? danger
                                  ? "border-red-600 bg-red-50 dark:bg-red-500/10 ring-2 ring-red-600/20"
                                  : "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-indigo-600/20"
                                : "mc-border hover:bg-[var(--mc-card-hover)]"
                            }`}
                            style={!active ? { background: "var(--mc-card)" } : undefined}
                          >
                            <div>
                              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                active
                                  ? danger ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                                  : "mc-text-muted"
                              }`}
                              style={!active ? { background: "var(--mc-card-hover)" } : undefined}>
                                {badge}
                              </span>
                              <h5 className="font-bold mc-text mt-2 text-sm">{title}</h5>
                              <p className="text-xs mc-text-muted mt-1 leading-relaxed">{desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Conflict Diffs */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold mc-text-muted uppercase tracking-wider mt-6">Conflict Comparison ({conflicts.length})</h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {conflicts.map((conflict, index) => (
                          <div key={conflict.archived.id} className="border mc-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-2.5 border-b mc-border flex justify-between items-center" style={{ background: "var(--mc-surface)" }}>
                              <span className="text-xs font-bold mc-text-secondary">Conflict #{index + 1}</span>
                              <span className="text-[10px] font-mono mc-text-muted px-2 py-0.5 rounded" style={{ background: "var(--mc-card-hover)" }}>ID: {conflict.archived.id.slice(0, 8)}...</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--mc-card-border)]" style={{ background: "var(--mc-card)" }}>
                              {/* Current Event */}
                              <div className={`p-4 ${conflictStrategy === "skip" ? "opacity-60" : ""}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold mc-text-muted uppercase">Current Event</span>
                                  {conflictStrategy === "skip" && (
                                    <span className="text-[10px] font-bold mc-text-secondary px-2 py-0.5 rounded-full" style={{ background: "var(--mc-card-hover)" }}>Preserved</span>
                                  )}
                                  {conflictStrategy === "overwrite" && (
                                    <span className="text-[10px] font-bold bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">Overwritten</span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold mc-text text-sm">{conflict.current.type}</div>
                                  <div className="text-xs mc-text-secondary">Date: {formatDate(conflict.current.date)}</div>
                                  <div className="text-xs mc-text-secondary">Duration: {conflict.current.duration} hr{conflict.current.duration !== 1 && "s"}</div>
                                  <div className="text-xs mc-text-secondary mt-2 line-clamp-2">
                                    <span className="font-semibold">Attended:</span> {conflict.current.players.length > 0 ? conflict.current.players.join(", ") : "None"}
                                  </div>
                                </div>
                              </div>

                              {/* Archived Event */}
                              <div className={`p-4 ${conflictStrategy === "overwrite" ? "" : "opacity-60"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-indigo-500 uppercase">Archived Event</span>
                                  {conflictStrategy === "overwrite" && (
                                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full">Restored</span>
                                  )}
                                  {conflictStrategy === "skip" && (
                                    <span className="text-[10px] font-bold mc-text-secondary px-2 py-0.5 rounded-full" style={{ background: "var(--mc-card-hover)" }}>Skipped</span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold mc-text text-sm">{conflict.archived.type}</div>
                                  <div className="text-xs mc-text-secondary">Date: {formatDate(conflict.archived.date)}</div>
                                  <div className="text-xs mc-text-secondary">Duration: {conflict.archived.duration} hr{conflict.archived.duration !== 1 && "s"}</div>
                                  <div className="text-xs mc-text-secondary mt-2 line-clamp-2">
                                    <span className="font-semibold">Attended:</span> {conflict.archived.players.length > 0 ? conflict.archived.players.join(", ") : "None"}
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
              <div className="p-6 md:p-8 border-t mc-border flex flex-col-reverse sm:flex-row sm:justify-end gap-3 rounded-b-3xl" style={{ background: "var(--mc-surface)" }}>
                <button
                  type="button"
                  onClick={() => setRestoreReviewArchiveId(null)}
                  className="w-full sm:w-auto px-6 py-3 font-semibold mc-text-secondary hover:mc-text hover:bg-[var(--mc-card-hover)] rounded-xl transition-all text-center"
                >
                  Cancel
                </button>

                {conflictStrategy === "error" && conflicts.length > 0 ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-6 py-3 font-semibold text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl cursor-not-allowed text-center"
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
                    className="w-full sm:w-auto px-6 py-3 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center"
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
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-surface)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold mc-text">Add Player to Roster</DialogTitle>
            <DialogDescription className="mc-text-secondary">
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
              className="w-full px-4 py-3 rounded-2xl border mc-border mc-text placeholder:mc-text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              style={{ background: "var(--mc-card)", color: "var(--mc-text-primary)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPlayerName.trim()) {
                  setPendingPlayerName(newPlayerName.trim());
                  setShowAddPlayerDialog(false);
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddPlayerDialog(false)} className="rounded-xl mc-border mc-text-secondary hover:bg-[var(--mc-card-hover)]">
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

      {/* Delete Archive Confirmation */}
      <AlertDialog open={archiveIdToDelete !== null} onOpenChange={(open) => !open && setArchiveIdToDelete(null)}>
        <AlertDialogContent className="rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-surface)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold mc-text">Delete Archived Events?</AlertDialogTitle>
            <AlertDialogDescription className="mc-text-secondary">
              Permanently delete this archived event set? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl mc-border mc-text-secondary hover:bg-[var(--mc-card-hover)]">Cancel</AlertDialogCancel>
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

      {/* Remove Player Confirmation */}
      <AlertDialog open={playerToRemove !== null} onOpenChange={(open) => !open && setPlayerToRemove(null)}>
        <AlertDialogContent className="rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-surface)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold mc-text">Remove Player from Roster?</AlertDialogTitle>
            <AlertDialogDescription className="mc-text-secondary">
              Are you sure you want to remove <span className="font-semibold mc-text">{playerToRemove}</span> from the roster? Existing event history will stay saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl mc-border mc-text-secondary hover:bg-[var(--mc-card-hover)]" disabled={isRemovingPlayer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all shadow-md"
              disabled={isRemovingPlayer}
              onClick={async (e) => {
                e.preventDefault();
                if (playerToRemove) {
                  setIsRemovingPlayer(true);
                  try { await removePlayer(playerToRemove); setPlayerToRemove(null); }
                  finally { setIsRemovingPlayer(false); }
                }
              }}
            >
              {isRemovingPlayer ? "Removing..." : "Remove Player"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirm Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent className="rounded-3xl p-6 md:p-8 shadow-xl border mc-border" style={{ background: "var(--mc-surface)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold mc-text">Archive all events?</AlertDialogTitle>
            <AlertDialogDescription className="mc-text-secondary">
              This will move all {state.events.length} logged event{state.events.length !== 1 ? "s" : ""} into an archive set. You can restore them at any time from the Archived Events section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isArchiving} className="rounded-xl mc-border mc-text-secondary hover:bg-[var(--mc-card-hover)]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isArchiving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md"
              onClick={async (e) => {
                e.preventDefault();
                setIsArchiving(true);
                try { await archiveEvents(); setShowArchiveConfirm(false); }
                finally { setIsArchiving(false); }
              }}
            >
              {isArchiving ? "Archiving…" : "Archive events"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportPdfDrawer
        open={showExportDrawer}
        onClose={() => setShowExportDrawer(false)}
        teamName={state.teamName}
        teamLogo={state.teamLogo}
        events={state.events}
        roster={state.roster}
        dateRange="season"
        sortCol="player"
        sortDir="asc"
        archivedEventsBundles={state.archivedEvents}
        initialSections={{ archivedEvents: true }}
      />
    </div>
  );
}
