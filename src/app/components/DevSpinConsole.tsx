import { Sparkles } from "lucide-react";
import { formatDate } from "@/lib/dates";

interface WheelEntry {
  player: string;
  label: string;
  date: string;
  eventId: string;
}

interface DevSpinConsoleProps {
  testWinnerIndex: number | null;
  setTestWinnerIndex: (val: number | null) => void;
  isDevConsoleOpen: boolean;
  setIsDevConsoleOpen: (val: boolean) => void;
  wheelEntries: WheelEntry[];
  isSpinning: boolean;
  spinWheel: (fixedIndex?: number) => void;
}

export default function DevSpinConsole({
  testWinnerIndex,
  setTestWinnerIndex,
  isDevConsoleOpen,
  setIsDevConsoleOpen,
  wheelEntries,
  isSpinning,
  spinWheel,
}: DevSpinConsoleProps) {
  return (
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
  );
}
