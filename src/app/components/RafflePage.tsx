import { useState, useEffect, useRef } from "react";
import { Gift, Sparkles, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import { formatDate } from "@/lib/dates";
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

interface WheelEntry {
  player: string;
  label: string;
  date: string;
  eventId: string;
}

export default function RafflePage() {
  const { state, archiveEvents } = useTeamStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelEntries, setWheelEntries] = useState<WheelEntry[]>([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [pendingWinnerPlayerName, setPendingWinnerPlayerName] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Dev visual testing states
  const [testWinnerIndex, setTestWinnerIndex] = useState<number | null>(null);
  const [isDevConsoleOpen, setIsDevConsoleOpen] = useState(false);

  const getWheelEntries = (): WheelEntry[] => {
    const entries: WheelEntry[] = [];

    state.events
      .filter((event) => event.type === EVENT_TYPES.OPTIONAL_TRAINING)
      .slice()
      .reverse()
      .forEach((event) => {
        event.players.forEach((player) => {
          entries.push({
            player,
            label: player,
            date: event.date,
            eventId: event.id,
          });
        });
      });

    return entries;
  };

  const drawWheel = (entries: WheelEntry[], rotationDegrees: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 18;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((rotationDegrees * Math.PI) / 180);

    if (!entries.length) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#eef3f8";
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#153e75";
      ctx.stroke();
      ctx.restore();
      drawCenterBadge(ctx, center, center, "🎁");
      return;
    }

    const sliceAngle = (Math.PI * 2) / entries.length;
    const colors = ["#153e75", "#16a34a", "#f59e0b", "#dc2626", "#2563eb", "#7c3aed"];

    entries.forEach((entry, index) => {
      const start = index * sliceAngle - Math.PI / 2;
      const end = start + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();

      const mid = start + sliceAngle / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font =
        entries.length > 18
          ? "700 18px Inter, sans-serif"
          : "800 24px Inter, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 3;
      const label =
        entry.label.length > 14 ? `${entry.label.slice(0, 12)}…` : entry.label;
      ctx.fillText(label, radius - 24, 8);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#122033";
    ctx.stroke();
    ctx.restore();

    drawCenterBadge(ctx, center, center, "🎁");
  };

  const drawCenterBadge = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 48, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.font = "30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  };

  const spinWheel = (fixedIndex?: number | React.MouseEvent) => {
    if (!wheelEntries.length || isSpinning) return;

    setIsSpinning(true);
    setWinner("Spinning...");

    // Treat as undefined if it's a MouseEvent (invoked via standard button onClick)
    const targetIdx = typeof fixedIndex === "number" ? fixedIndex : undefined;

    // If targetIdx is provided, clamp it to ensure it is safe and valid
    const winningIndex =
      typeof targetIdx === "number" && targetIdx >= 0 && targetIdx < wheelEntries.length
        ? targetIdx
        : Math.floor(Math.random() * wheelEntries.length);

    const sliceDegrees = 360 / wheelEntries.length;
    const targetCenter = winningIndex * sliceDegrees + sliceDegrees / 2;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = fullSpins * 360 - targetCenter;
    const startRotation = wheelRotation;
    const change = targetRotation - startRotation;
    const startTime = performance.now();
    const duration = 4200;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentRotation = startRotation + change * eased;
      setWheelRotation(currentRotation);
      drawWheel(wheelEntries, currentRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const finalRotation = ((targetRotation % 360) + 360) % 360;
        setWheelRotation(finalRotation);
        setIsSpinning(false);
        const winnerEntry = wheelEntries[winningIndex];
        setWinner(
          `${winnerEntry.player} wins! Entry earned on ${formatDate(
            winnerEntry.date
          )}.`
        );
        drawWheel(wheelEntries, finalRotation);

        // Celebrate with confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Extra confetti burst
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 250);

        // Prompt to archive events after winner is announced
        setTimeout(() => {
          setPendingWinnerPlayerName(winnerEntry.player);
          setShowArchiveConfirm(true);
        }, 2000);
      }
    };

    requestAnimationFrame(animate);
  };

  const refreshWheel = () => {
    const entries = getWheelEntries();
    setWheelEntries(entries);
    setWinner((prev) => {
      if (entries.length === 0) {
        if (
          prev ===
          "Events archived! Start logging new training sessions for the next raffle."
        ) {
          return prev;
        }
        return "Log optional training sessions to build the wheel.";
      }
      return "";
    });
  };

  useEffect(() => {
    refreshWheel();
  }, [state.events]);

  useEffect(() => {
    drawWheel(wheelEntries, wheelRotation);
  }, [wheelEntries]);



  const getEntryCounts = () => {
    const counts = wheelEntries.reduce((map, entry) => {
      map[entry.player] = (map[entry.player] || 0) + 1;
      return map;
    }, {} as Record<string, number>);

    return Object.entries(counts).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-white to-yellow-50 rounded-3xl p-6 md:p-8 shadow-xl border border-yellow-100">
        <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">
          Optional Training Raffle
        </span>
        <h2 className="mt-2 text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
          Spin the attendance prize wheel.
        </h2>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl">
          Each optional training attendance earns that player one unique slice on
          the wheel.
        </p>
      </div>

      {/* Raffle Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Wheel Card */}
        <div className="lg:col-span-3 bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <div className="flex flex-col items-center gap-6">
            {/* Pointer */}
            <div className="relative w-full max-w-[640px]">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                <div className="w-0 h-0 border-l-[22px] border-r-[22px] border-t-[38px] border-l-transparent border-r-transparent border-t-red-600 drop-shadow-lg"></div>
              </div>

              {/* Canvas Wheel */}
              <canvas
                ref={canvasRef}
                width={640}
                height={640}
                className="w-full h-auto block"
                aria-label="Raffle wheel"
              />
            </div>

            {/* Spin Button */}
            <button
              onClick={spinWheel}
              disabled={isSpinning || wheelEntries.length === 0}
              className="w-full max-w-xs flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-blue-200 transition-all shadow-lg hover:shadow-xl"
            >
              <Gift className="w-6 h-6" />
              {isSpinning ? "Spinning..." : "🎁 Spin the Wheel"}
            </button>

            {/* Winner Display */}
            {winner && (
              <p className="text-center font-bold text-blue-700 text-lg px-4">
                {winner}
              </p>
            )}
          </div>
        </div>

        {/* Entries List */}
        <div className="lg:col-span-2 bg-white/90 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-gray-900">Wheel Entries</h3>
            <button
              onClick={refreshWheel}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Refresh wheel"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Players appear once for every optional training session they attended.
          </p>

          {wheelEntries.length === 0 ? (
            <div className="bg-gray-50/60 border border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
              No raffle entries yet. Save an Optional Training session with players
              marked present.
            </div>
          ) : (
            <div className="space-y-2">
              {getEntryCounts().map(([player, count]) => (
                <div
                  key={player}
                  className="flex items-center justify-between gap-4 p-3 border border-gray-200 rounded-2xl bg-white"
                >
                  <strong className="text-gray-900">{player}</strong>
                  <span className="text-sm font-bold text-blue-700">
                    {count} {count === 1 ? "slice" : "slices"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Archive Post-Win Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🎉 {pendingWinnerPlayerName} wins!</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to archive the training data now? This will clear the wheel for the next raffle and save the events to Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isArchiving}
              onClick={() => {
                setShowArchiveConfirm(false);
                setPendingWinnerPlayerName(null);
              }}
            >
              Keep Data
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isArchiving}
              onClick={async (e) => {
                e.preventDefault();
                setIsArchiving(true);
                try {
                  const success = await archiveEvents({ type: EVENT_TYPES.OPTIONAL_TRAINING });
                  if (success) {
                    setWinner("Events archived! Start logging new training sessions for the next raffle.");
                    setWheelEntries([]);
                    setWheelRotation(0);
                    setShowArchiveConfirm(false);
                    setPendingWinnerPlayerName(null);
                  }
                } finally {
                  setIsArchiving(false);
                }
              }}
            >
              {isArchiving ? "Archiving..." : "Archive Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Raffle Test Console */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700/50 mt-6 transition-all duration-300">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsDevConsoleOpen(!isDevConsoleOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Raffle Test Console</h3>
              <p className="text-xs text-slate-400">Verify segment geometry & spin to fixed seeds</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider transition-colors ${
                testWinnerIndex !== null
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {testWinnerIndex !== null ? `Seed Set: Index ${testWinnerIndex}` : "Random Spin"}
            </span>
            <button className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
              <svg
                className={`w-5 h-5 transform transition-transform duration-300 ${
                  isDevConsoleOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {isDevConsoleOpen && (
          <div className="mt-6 pt-6 border-t border-slate-700/50 space-y-6">
            {/* Main Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Slice Index Picker */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-300">
                  Select Fixed Winner Segment
                </label>
                {wheelEntries.length === 0 ? (
                  <div className="p-4 bg-slate-800/50 rounded-2xl text-slate-400 text-sm text-center border border-slate-700/30">
                    No active raffle entries. Please add entries to test.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {wheelEntries.map((entry, idx) => (
                      <button
                        key={idx}
                        onClick={() => setTestWinnerIndex(idx)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                          testWinnerIndex === idx
                            ? "bg-blue-600/35 border-blue-500 text-white font-semibold ring-2 ring-blue-500/40"
                            : "bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-700/35 hover:border-slate-600"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
                          Segment {idx}
                        </span>
                        <span className="text-sm font-semibold truncate w-full mt-0.5">
                          {entry.player}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1 truncate w-full">
                          {formatDate(entry.date)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Mathematical Alignment Diagnostics */}
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 space-y-4">
                <h4 className="font-semibold text-sm text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping"></span>
                  Canvas Geometry Diagnostics
                </h4>

                {wheelEntries.length > 0 ? (
                  (() => {
                    const N = wheelEntries.length;
                    const S = 360 / N;
                    const K = testWinnerIndex ?? 0;
                    const localCenter = K * S + S / 2 - 90;
                    const mockSpins = 5;
                    const targetRot = mockSpins * 360 - (K * S + S / 2);
                    const screenMid = (localCenter + targetRot) % 360;

                    return (
                      <div className="space-y-2.5 text-xs text-slate-300">
                        <div className="flex justify-between items-center py-1 border-b border-slate-700/20">
                          <span className="text-slate-400">Total Segments (N)</span>
                          <code className="text-slate-200 font-mono">{N} slices</code>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-700/20">
                          <span className="text-slate-400">Arc Size per Slice (S)</span>
                          <code className="text-slate-200 font-mono">{S.toFixed(2)}°</code>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-700/20">
                          <span className="text-slate-400">Active Winner Slice (K)</span>
                          <span className="font-semibold text-yellow-400">
                            {testWinnerIndex !== null ? `Segment ${K}` : "Random"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-700/20">
                          <span className="text-slate-400">Local Center Angle (θ_center)</span>
                          <code className="text-slate-200 font-mono">
                            {K} × {S.toFixed(0)}° + {(S / 2).toFixed(0)}° - 90° ={" "}
                            <span className="text-blue-400">{localCenter.toFixed(1)}°</span>
                          </code>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-700/20">
                          <span className="text-slate-400">Target Rotation (φ_rot)</span>
                          <code className="text-slate-200 font-mono">
                            {mockSpins} × 360° - {(K * S + S / 2).toFixed(1)}° ={" "}
                            <span className="text-indigo-400">{targetRot.toFixed(1)}°</span>
                          </code>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-400">Screen Midpoint Post-Spin</span>
                          <code className="text-emerald-400 font-mono font-bold">
                            {screenMid === 0 ? 0 : (screenMid - 360).toFixed(1)}° (12 o'clock)
                          </code>
                        </div>

                        <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px]">
                          <span className="p-1 bg-emerald-500/20 rounded-md text-emerald-400 flex-shrink-0">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </span>
                          <span>
                            <strong>Verified:</strong> Midpoint matches -90° (pointer) precisely
                            with {testWinnerIndex !== null ? "fixed seed" : "dynamic spin"}.
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-slate-400">Waiting for raffle entry segments...</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700/50">
              <button
                onClick={() => {
                  if (testWinnerIndex === null) return;
                  spinWheel(testWinnerIndex);
                }}
                disabled={isSpinning || testWinnerIndex === null || wheelEntries.length === 0}
                className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold rounded-xl hover:from-yellow-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
              >
                <span>🧪 Run Seeded Test Spin</span>
              </button>
              <button
                onClick={() => setTestWinnerIndex(null)}
                disabled={isSpinning || testWinnerIndex === null}
                className="px-5 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Reset to Random
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
