import { Trophy } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import { formatRelativeTime } from "@/lib/dates";

const MEDAL_CLASSES = [
  "mc-medal-gold-fg mc-medal-gold-rail",
  "mc-medal-silver-fg mc-medal-silver-rail",
  "mc-medal-bronze-fg mc-medal-bronze-rail",
];

function formatHours(h: number, opts?: { compact?: boolean }) {
  const v = Number.isInteger(h) ? h.toString() : h.toFixed(1);
  return opts?.compact ? `${v}h` : `${v} hrs`;
}

export function LeaderboardPodium() {
  const { state } = useTeamStore();

  const entries = (() => {
    const totals: Record<string, number> = {};

    const allPlayers = new Set([
      ...state.roster,
      ...state.events.flatMap((e) => e.players),
    ]);

    allPlayers.forEach((player) => {
      totals[player] = 0;
    });

    state.events.forEach((event) => {
      event.players.forEach((player) => {
        totals[player] = (totals[player] ?? 0) + event.duration;
      });
    });

    return Object.entries(totals)
      .map(([name, hours]) => ({ name, hours }))
      .filter((e) => e.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .map((e, i) => ({ id: e.name, name: e.name, hours: e.hours, rank: i + 1 }));
  })();

  if (!entries || entries.length === 0) return null;

  const lastUpdated = state.events.reduce<string | null>((latest, event) => {
    if (!event.savedAt) return latest;
    if (!latest || event.savedAt > latest) return event.savedAt;
    return latest;
  }, null);

  const top3 = entries.slice(0, 3);
  // TODO: add expand-on-click for teams with >10 entries
  const rest = entries.slice(3, 10);

  // Ties: if two players share the same hours they get sequential ranks from the store sort —
  // dense re-ranking is a data-layer concern and not handled here (known v1 limitation).
  const colsClass =
    top3.length === 1
      ? "grid-cols-1"
      : top3.length === 2
        ? "grid-cols-2"
        : "grid-cols-1 sm:grid-cols-3";

  return (
    <section
      aria-label="Puttin' in the Work leaderboard"
      className="mc-card rounded-2xl border mc-border p-3.5 sm:p-4"
    >
      <header className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-3.5 mc-text-secondary" aria-hidden />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] mc-text-secondary">
            Puttin' in the Work · This week
          </h2>
        </div>
        {lastUpdated && (
          <span className="text-[11px] mc-text-muted">
            updated {formatRelativeTime(lastUpdated)}
          </span>
        )}
      </header>

      <ol className={`grid gap-2 ${colsClass}`}>
        {top3.map((entry, i) => (
          <li
            key={entry.id}
            className={[
              "flex items-center gap-3 rounded-xl border mc-border bg-black/[0.02] dark:bg-white/[0.02] p-2.5 px-3.5",
              "border-l-[3px]",
              MEDAL_CLASSES[i],
            ].join(" ")}
          >
            <span
              aria-hidden
              className="font-condensed text-[30px] font-extrabold leading-none tabular-nums w-7"
            >
              {entry.rank}
            </span>
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-[15px] font-bold mc-text truncate">{entry.name}</span>
              <span className="text-[12.5px] font-medium mc-text-secondary">
                {formatHours(entry.hours)}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {rest.length > 0 && (
        <ol
          className="mt-2.5 flex items-center gap-5 overflow-x-auto pt-1 text-[12.5px]"
          aria-label="Remaining standings"
        >
          {rest.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline gap-1.5 whitespace-nowrap"
            >
              <span className="font-bold tabular-nums mc-text-muted">#{entry.rank}</span>
              <span className="font-semibold mc-text-secondary">{entry.name}</span>
              <span className="mc-text-muted">{formatHours(entry.hours, { compact: true })}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
