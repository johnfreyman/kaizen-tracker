import { useState, useEffect } from "react";
import { Save, UserPlus, X, Upload, Gift, FileText, Archive, RotateCcw, Trash2, Trophy, Sun, Moon, Monitor } from "lucide-react";
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
  const { state, updateSettings, addPlayer, removePlayer, restoreArchive, deleteArchive, isGuest, uploadLogo } = useTeamStore();
  const { theme, setTheme } = useTheme();
  const [teamName, setTeamName] = useState(state.teamName);
  const [raffleEnabled, setRaffleEnabled] = useState(state.raffleEnabled);
  const [pendingPlayerName, setPendingPlayerName] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Helper to resize image using canvas (max 512px)
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
      if (width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), file.type));
    URL.revokeObjectURL(objectUrl);
    const resizedFile = new File([blob], file.name, { type: file.type });
    return resizedFile;
  };

  // Handle file selection with validation and preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset previous errors
    setValidationError(null);
    // Validate type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setValidationError('Unsupported file format. Please use PNG, JPEG, WebP, or SVG.');
      return;
    }
    // Validate size (2 MiB)
    const maxSize = 2 * 1024 * 1024; // 2 MiB
    if (file.size > maxSize) {
      setValidationError('File is too large. Maximum size is 2 MiB.');
      return;
    }
    // Create preview URL (original or resized)
    let preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setSelectedFile(file);
    // Resize before upload (skip SVG as it scales without rasterisation)
    let fileToUpload = file;
    if (file.type !== 'image/svg+xml') {
      try {
        fileToUpload = await resizeImage(file);
      } catch (err) {
        console.error('Resize error', err);
        setValidationError('Failed to process image.');
        return;
      }
    }
    // Upload with progress indicator
    setIsUploadingLogo(true);
    setUploadProgress(0);
    try {
      // Supabase storage upload does not expose progress, so we simulate with a short interval
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 200);
      await uploadLogo(fileToUpload);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setPreviewUrl(null);
      toast.success('Team logo updated successfully.');
    } catch (err) {
      // Error handling is performed inside uploadLogo
    } finally {
      setIsUploadingLogo(false);
      setUploadProgress(0);
    }
  };

  const [restoreReviewArchiveId, setRestoreReviewArchiveId] = useState<string | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictResolutionStrategy>("overwrite");
  const [showExportDrawer, setShowExportDrawer] = useState(false);

  // State variables for dialogs and confirmations
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [archiveIdToDelete, setArchiveIdToDelete] = useState<string | null>(null);
  const [playerToRemove, setPlayerToRemove] = useState<string | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isRemovingPlayer, setIsRemovingPlayer] = useState(false);

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
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={isUploadingLogo}
                onChange={handleFileSelect}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Supported formats: PNG, JPEG, WebP, SVG &middot; Max 2 MiB &middot; Resized to 512px
              </p>
              {/* Validation error */}
              {validationError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Upload Error</AlertTitle>
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              {/* Preview */}
              {previewUrl && (
                <div className="mt-4 flex items-center gap-4">
                  <img src={previewUrl} alt="Logo preview" className="h-20 w-20 object-cover rounded-xl" />
                  <span className="text-sm text-gray-600">Preview</span>
                </div>
              )}
              {/* Upload progress */}
              {isUploadingLogo && (
                <div className="mt-2 w-full">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-width duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Uploading... {uploadProgress}%</p>
                </div>
              )}
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

          {/* Appearance */}
          <div>
            <div className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
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
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Archive className="size-6 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">Archived Events</h3>
            </div>
            <button
              onClick={() => setShowExportDrawer(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <FileText className="size-4" />
              Print full archive
            </button>
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

      {/* Export PDF Drawer — opened from "Print full archive" link in Archived Events */}
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
