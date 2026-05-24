import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import { formatDate, formatRelativeTime } from "@/lib/dates";
import DevSpinConsole from "./DevSpinConsole";
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
  const { state, archiveEvents, clearActiveEvents, raffleWinners, recordRaffleWinner, undoLastRaffleWinner } = useTeamStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelEntries, setWheelEntries] = useState<WheelEntry[]>([]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [pendingWinnerPlayerName, setPendingWinnerPlayerName] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [prize, setPrize] = useState(() => localStorage.getItem("kaizen.raffle.prize") ?? "");
  const [excludeLastN, setExcludeLastN] = useState(() => {
    const stored = localStorage.getItem("kaizen.raffle.excludeLastN");
    return stored ? Number(stored) : 0;
  });
  const [pulsingEntry, setPulsingEntry] = useState<string | null>(null);
  const [rawEntryCount, setRawEntryCount] = useState(0);

  // Dev visual testing states
  const [testWinnerIndex, setTestWinnerIndex] = useState<number | null>(null);
  const [isDevConsoleOpen, setIsDevConsoleOpen] = useState(false);

  // Guard: If not in DEV, force testWinnerIndex to null unconditionally
  const activeTestWinnerIndex = import.meta.env.DEV ? testWinnerIndex : null;

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
    const rotationRadians = (rotationDegrees * Math.PI) / 180;
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
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
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

      // The screen-space direction of this slice is (wheel rotation + local mid).
      // A label points left on screen when cos of that combined angle is < 0 —
      // those labels need a 180° flip so they read forward instead of upside-down.
      const flip = Math.cos(rotationRadians + mid) < 0;
      if (flip) {
        ctx.translate(radius - 24, 0);
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
      } else {
        ctx.textAlign = "right";
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = entries.length > 18
        ? "700 18px Inter, sans-serif"
        : "800 24px Inter, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 3;
      const label = entry.label.length > 14
        ? `${entry.label.slice(0, 12)}…`
        : entry.label;
      ctx.fillText(label, flip ? 0 : radius - 24, 8);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
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
    // Guard against non-DEV environments to ensure test seeds can never be forced in production
    const targetIdx = import.meta.env.DEV && typeof fixedIndex === "number" ? fixedIndex : undefined;

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
          `${winnerEntry.player} wins${prize ? " " + prize : ""}! Entry earned ${formatDate(winnerEntry.date)}.`
        );
        drawWheel(wheelEntries, finalRotation);

        recordRaffleWinner({ player: winnerEntry.player, prize });

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
    const allEntries = getWheelEntries();
    setRawEntryCount(allEntries.length);

    const filtered =
      excludeLastN > 0
        ? (() => {
            const excluded = new Set(
              raffleWinners.slice(0, excludeLastN).map((w) => w.player)
            );
            return allEntries.filter((e) => !excluded.has(e.player));
          })()
        : allEntries;

    setWheelEntries(filtered);
    setWinner((prev) => {
      if (allEntries.length === 0) {
        if (prev === "Events archived! Start logging new training sessions for the next raffle.") {
          return prev;
        }
        return "Log optional training sessions to build the wheel.";
      }
      if (prev === "Log optional training sessions to build the wheel.") {
        return "";
      }
      return prev;
    });
  };

  const drawSilently = () => {
    if (!wheelEntries.length || isSpinning) return;

    const winningIndex = Math.floor(Math.random() * wheelEntries.length);
    const winnerEntry = wheelEntries[winningIndex];

    setWinner(
      `${winnerEntry.player} wins${prize ? " " + prize : ""}! Entry earned ${formatDate(winnerEntry.date)}.`
    );
    recordRaffleWinner({ player: winnerEntry.player, prize });

    setPulsingEntry(winnerEntry.player);
    setTimeout(() => setPulsingEntry(null), 600);

    setTimeout(() => {
      setPendingWinnerPlayerName(winnerEntry.player);
      setShowArchiveConfirm(true);
    }, 600);
  };

  useEffect(() => {
    refreshWheel();
  }, [state.events, excludeLastN, raffleWinners]);

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
      {/* Slim header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Raffle</div>
          <h1 className="mt-1 text-2xl font-bold mc-text">Attendance prize wheel</h1>
          <p className="mt-1 text-sm mc-text-secondary">Each optional training attendance earns one slice.</p>
          <input
            type="text"
            value={prize}
            onChange={(e) => {
              setPrize(e.target.value);
              localStorage.setItem("kaizen.raffle.prize", e.target.value);
            }}
            placeholder="What's today's prize?"
            maxLength={60}
            className="mt-3 w-full max-w-sm rounded-xl border mc-border bg-white/[0.04] px-3 py-2 text-sm mc-text placeholder:mc-text-muted focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>
      </div>

      {/* Raffle Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Wheel Card */}
        <div className="lg:col-span-3 bg-white/[0.03] border mc-border rounded-3xl p-6 md:p-8">
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
              {isSpinning ? "Spinning..." : "Spin the Wheel"}
            </button>

            {/* Secondary controls */}
            {(() => {
              const allExcluded = rawEntryCount > 0 && wheelEntries.length === 0;
              return (
                <div className="flex items-center gap-5 text-xs mc-text-secondary">
                  <button
                    onClick={drawSilently}
                    disabled={isSpinning || wheelEntries.length === 0}
                    className="hover:mc-text underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Draw silently
                  </button>
                  <span
                    className="flex items-center gap-1.5"
                    title={allExcluded ? "All players are excluded — lower this number to spin." : undefined}
                  >
                    Exclude last
                    <select
                      value={excludeLastN}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setExcludeLastN(n);
                        localStorage.setItem("kaizen.raffle.excludeLastN", String(n));
                      }}
                      className="bg-transparent border mc-border rounded px-1 py-0.5 text-xs mc-text-secondary cursor-pointer"
                    >
                      {[0, 1, 2, 3, 5].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    winners
                  </span>
                </div>
              );
            })()}

            {/* Winner Display */}
            {winner && (
              <p className="text-center font-bold text-blue-700 text-lg px-4">
                {winner}
              </p>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Recent Winners Card — hidden when empty */}
          {raffleWinners.length > 0 && (
            <div className="bg-white/[0.03] border mc-border rounded-3xl p-6">
              <h3 className="text-base font-bold mc-text mb-3">Recent winners</h3>
              <div className="space-y-2">
                {raffleWinners.slice(0, 5).map((w, i) => (
                  <div key={w.id} className="group flex items-center justify-between gap-3 p-2.5 border mc-border rounded-xl bg-white/[0.04]">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold mc-text truncate">{w.player}</p>
                      {w.prize && <p className="text-xs mc-text-secondary truncate">{w.prize}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {i === 0 && (
                        <button
                          onClick={undoLastRaffleWinner}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs mc-text-muted hover:text-red-400"
                          title="Undo this winner"
                        >
                          ↺ undo
                        </button>
                      )}
                      <span className="text-xs mc-text-muted whitespace-nowrap">{formatRelativeTime(w.wonAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entries List */}
          <div className="bg-white/[0.03] border mc-border rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold mc-text">Wheel Entries</h3>
              <button
                onClick={refreshWheel}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                title="Refresh wheel"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm mc-text-secondary mb-4">
              Players appear once for every optional training session they attended.
            </p>

            {wheelEntries.length === 0 ? (
              <div className="bg-white/[0.02] border border-dashed mc-border rounded-2xl p-8 text-center mc-text-muted">
                No raffle entries yet. Save an Optional Training session with players
                marked present.
              </div>
            ) : (
              <div className="space-y-2">
                {getEntryCounts().map(([player, count]) => (
                  <div
                    key={player}
                    className={`flex items-center justify-between gap-4 p-3 border rounded-2xl bg-white/[0.04] transition-all duration-300 ${
                      pulsingEntry === player
                        ? "border-amber-400 ring-2 ring-amber-400 scale-[1.02]"
                        : "mc-border"
                    }`}
                  >
                    <strong className="mc-text">{player}</strong>
                    <span className="text-sm font-bold text-amber-400">
                      {count} {count === 1 ? "slice" : "slices"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Archive Post-Win Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>🎉 {pendingWinnerPlayerName} wins{prize ? " " + prize : ""}!</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 mc-text-secondary">
              <p>What would you like to do with the current attendance data?</p>
              <div className="space-y-2 mt-2 text-xs">
                <p>
                  <strong className="mc-text block font-semibold text-amber-400">Clear Wheel Only</strong>
                  Resets the wheel for the next weekly raffle. Active player attendance will be deleted, but not saved to the archived history.
                </p>
                <p>
                  <strong className="mc-text block font-semibold text-indigo-400">Archive Season</strong>
                  Clears the wheel and moves all active player attendance to Settings history. Typically done at the end of a season.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center mt-4">
            <AlertDialogCancel
              disabled={isArchiving || isClearing}
              onClick={() => {
                setShowArchiveConfirm(false);
                setPendingWinnerPlayerName(null);
              }}
              className="w-full sm:w-auto"
            >
              Keep Data
            </AlertDialogCancel>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
              <button
                disabled={isArchiving || isClearing}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsClearing(true);
                  try {
                    const success = await clearActiveEvents({ type: EVENT_TYPES.OPTIONAL_TRAINING });
                    if (success) {
                      setWinner("Wheel entries cleared! Start logging new training sessions.");
                      setWheelEntries([]);
                      setWheelRotation(0);
                      setShowArchiveConfirm(false);
                      setPendingWinnerPlayerName(null);
                    }
                  } finally {
                    setIsClearing(false);
                  }
                }}
                className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-white/[0.04] hover:bg-white/[0.08] border mc-border mc-text h-10 px-4 py-2"
              >
                {isClearing ? "Clearing..." : "Clear Wheel Only"}
              </button>
              <AlertDialogAction
                className="bg-indigo-600 hover:bg-indigo-700 h-10 rounded-xl w-full sm:w-auto"
                disabled={isArchiving || isClearing}
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
                {isArchiving ? "Archiving..." : "Archive Season"}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {import.meta.env.DEV && (
        <DevSpinConsole
          testWinnerIndex={activeTestWinnerIndex}
          setTestWinnerIndex={setTestWinnerIndex}
          isDevConsoleOpen={isDevConsoleOpen}
          setIsDevConsoleOpen={setIsDevConsoleOpen}
          wheelEntries={wheelEntries}
          isSpinning={isSpinning}
          spinWheel={spinWheel}
        />
      )}
    </div>
  );
}
