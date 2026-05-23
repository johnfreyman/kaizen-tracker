import { Gift, Sparkles, Trophy } from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";

interface Props {
  onNavigate?: (page: string) => void;
}

export default function RewardsCard({ onNavigate }: Props) {
  const { state } = useTeamStore();

  if (!state.raffleEnabled) return null;

  // Eligible = distinct players who attended at least one optional training
  // in the current (non-archived) event set
  const eligiblePlayers = new Set<string>();
  for (const event of state.events) {
    if (event.type === EVENT_TYPES.OPTIONAL_TRAINING) {
      event.players.forEach((p) => eligiblePlayers.add(p));
    }
  }
  const eligibleCount = eligiblePlayers.size;

  // Last winner: scan all events for any "raffle_winner" metadata — we don't have
  // that field, so we'll show a last-spin entry count instead.
  const optionalEntries = state.events
    .filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING)
    .reduce((sum, e) => sum + e.players.length, 0);

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-orange-500/5 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-amber-500/15">
        <Gift className="size-3.5 text-amber-400" />
        <h3 className="text-amber-300/70 text-xs font-bold uppercase tracking-widest flex-1">
          Rewards
        </h3>
        {eligibleCount > 0 && (
          <span className="text-[10px] font-semibold text-amber-300/60 bg-amber-500/12 px-2 py-0.5 rounded-full">
            {eligibleCount} eligible
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4">
        {eligibleCount === 0 ? (
          <p className="mc-text-muted text-sm">
            No eligible players yet. Attend optional training to enter the raffle.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Trophy className="size-5 text-amber-400" />
            </div>
            <div>
              <div className="mc-text text-sm font-semibold">
                {eligibleCount} player{eligibleCount !== 1 ? "s" : ""} in the draw
              </div>
              <div className="mc-text-muted text-xs">
                {optionalEntries} total raffle {optionalEntries === 1 ? "entry" : "entries"}
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => onNavigate?.("raffle")}
          disabled={eligibleCount === 0}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            eligibleCount > 0
              ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/25 hover:border-amber-500/40 animate-[shimmer_2.5s_ease-in-out_infinite]"
              : "bg-white/5 mc-text-muted cursor-not-allowed border border-white/8"
          }`}
        >
          <Sparkles className="size-4" />
          Spin the Wheel
        </button>
      </div>
    </div>
  );
}
