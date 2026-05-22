import { useState, useEffect, useRef } from "react";
import { Gift, Sparkles, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import { formatDate } from "@/lib/dates";
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
