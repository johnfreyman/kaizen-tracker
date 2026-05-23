import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";

/* ── Week helpers ─────────────────────────────────────────────────── */

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addWeeks(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
}

/* ── Sparkline SVG ────────────────────────────────────────────────── */

function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "#3b82f6",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible flex-shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

/* ── Main component ───────────────────────────────────────────────── */

export default function TrainingSummaryCard() {
  const { state } = useTeamStore();

  const now = new Date();
  const thisMonday = getMondayOfWeek(now);

  // Build 6 weekly buckets: [5 weeks ago … this week]
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = addWeeks(new Date(thisMonday), i - 5);
    const end = addWeeks(new Date(start), 1);
    return { start, end, practice: 0, optional: 0 };
  });

  for (const event of state.events) {
    const eventDate = new Date(event.date);
    for (const week of weeks) {
      if (eventDate >= week.start && eventDate < week.end) {
        if (event.type === EVENT_TYPES.PRACTICE) week.practice += event.duration;
        else week.optional += event.duration;
        break;
      }
    }
  }

  const totalByWeek = weeks.map((w) => w.practice + w.optional);
  const thisWeek = weeks[5];
  const lastWeek = weeks[4];

  const thisTotal = thisWeek.practice + thisWeek.optional;
  const lastTotal = lastWeek.practice + lastWeek.optional;

  let trend: "up" | "down" | "flat" = "flat";
  if (lastTotal > 0) {
    if (thisTotal > lastTotal * 1.05) trend = "up";
    else if (thisTotal < lastTotal * 0.95) trend = "down";
  } else if (thisTotal > 0) {
    trend = "up";
  }

  const hasAnyData = totalByWeek.some((v) => v > 0);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "mc-text-muted";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="mc-text-secondary text-xs font-bold uppercase tracking-widest">
          Training Summary
        </h3>
        <TrendIcon className={`size-4 ${trendColor}`} />
      </div>

      {/* This week stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 px-3 py-2.5">
          <div className="mc-text-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
            Practice
          </div>
          <div className="mc-mono mc-text text-lg font-bold tabular-nums leading-none">
            {thisWeek.practice % 1 === 0
              ? thisWeek.practice
              : thisWeek.practice.toFixed(1)}
            <span className="mc-text-muted text-xs font-normal ml-1">hrs</span>
          </div>
        </div>
        <div className="rounded-xl bg-violet-500/8 border border-violet-500/15 px-3 py-2.5">
          <div className="mc-text-muted text-[10px] font-semibold uppercase tracking-wider mb-1">
            Optional
          </div>
          <div className="mc-mono mc-text text-lg font-bold tabular-nums leading-none">
            {thisWeek.optional % 1 === 0
              ? thisWeek.optional
              : thisWeek.optional.toFixed(1)}
            <span className="mc-text-muted text-xs font-normal ml-1">hrs</span>
          </div>
        </div>
      </div>

      {/* 6-week sparkline */}
      {hasAnyData ? (
        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <div className="mc-text-muted text-[10px]">6-week trend</div>
            {lastTotal > 0 && (
              <div className={`text-[10px] font-semibold ${trendColor}`}>
                {trend === "up" && `+${((thisTotal - lastTotal) / lastTotal * 100).toFixed(0)}% vs last wk`}
                {trend === "down" && `${((thisTotal - lastTotal) / lastTotal * 100).toFixed(0)}% vs last wk`}
                {trend === "flat" && "On pace"}
              </div>
            )}
          </div>
          <div className="flex items-end gap-1">
            {weeks.map((week, i) => {
              const total = week.practice + week.optional;
              const maxTotal = Math.max(...totalByWeek, 0.1);
              const pct = (total / maxTotal) * 100;
              const isThis = i === 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-sm overflow-hidden" style={{ height: "32px" }}>
                    <div
                      className={`w-full rounded-sm transition-all ${
                        isThis ? "bg-blue-500/60" : "bg-white/10"
                      }`}
                      style={{ height: `${Math.max(pct, total > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {weeks.map((_, i) => (
              <div key={i} className="flex-1 text-center text-[9px] mc-text-muted truncate">
                {i === 5 ? "This" : i === 4 ? "Last" : ""}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mc-text-muted text-xs text-center py-2">
          No sessions logged this week yet.
        </div>
      )}
    </div>
  );
}

export { Sparkline };
