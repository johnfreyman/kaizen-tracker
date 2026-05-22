import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Data shape — computed in SuperAdminDashboard and passed as a single prop
// ---------------------------------------------------------------------------

export interface ChartDayPoint {
  label: string;
  sessions: number;
  active: number;
}

export interface ChartWeekPoint {
  label: string;
  count: number;
}

export interface StorageTier {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface HeatmapCell {
  date: string;
  count: number;
  dow: number;   // 0=Sun … 6=Sat
  week: number;  // 0 = oldest week shown
}

export interface DashboardChartData {
  days14: ChartDayPoint[];
  weeks8: ChartWeekPoint[];
  storageDistribution: StorageTier[];
  heatmapCells: HeatmapCell[];
}

// ---------------------------------------------------------------------------
// Minimal tooltip shared across charts
// ---------------------------------------------------------------------------

function MiniTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs shadow-lg pointer-events-none">
      <p className="text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-gray-900 font-bold">{payload[0].value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity heatmap (GitHub-style, pure SVG)
// ---------------------------------------------------------------------------

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function ActivityHeatmap({ cells }: { cells: HeatmapCell[] }) {
  if (!cells.length) return null;

  const maxCount = Math.max(...cells.map((c) => c.count), 1);
  const CELL = 10;
  const GAP = 2;
  const weeks = Math.max(...cells.map((c) => c.week)) + 1;
  const svgW = weeks * (CELL + GAP);
  const svgH = 7 * (CELL + GAP);

  function cellColor(count: number): string {
    if (count === 0) return "#f1f5f9";
    const t = Math.min(count / maxCount, 1);
    if (t < 0.25) return "#bfdbfe";
    if (t < 0.5) return "#93c5fd";
    if (t < 0.75) return "#60a5fa";
    return "#3b82f6";
  }

  return (
    <div className="flex items-start gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
      {/* Day-of-week labels */}
      <div className="flex flex-col gap-[2px] pt-px shrink-0">
        {DOW_LABELS.map((d, i) => (
          <span
            key={i}
            className="text-[9px] text-gray-400 font-medium select-none"
            style={{ height: CELL, lineHeight: `${CELL}px` }}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <svg width={svgW} height={svgH} className="shrink-0 overflow-visible">
        {cells.map((cell, i) => (
          <rect
            key={i}
            x={cell.week * (CELL + GAP)}
            y={cell.dow * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            fill={cellColor(cell.count)}
          >
            <title>{`${cell.date}: ${cell.count} active`}</title>
          </rect>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-1 ml-2 self-end pb-0.5 shrink-0">
        <span className="text-[9px] text-gray-400">less</span>
        {["#f1f5f9", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6"].map((c) => (
          <rect
            key={c}
            width={CELL}
            height={CELL}
            style={{ display: "inline-block", width: CELL, height: CELL, borderRadius: 2, backgroundColor: c }}
          />
        ))}
        <span className="text-[9px] text-gray-400">more</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

interface DashboardChartsProps {
  data: DashboardChartData;
  isOpen: boolean;
  onToggle: () => void;
}

export function DashboardCharts({ data, isOpen, onToggle }: DashboardChartsProps) {
  // Compute week-over-week trend badges from the 14-day data
  const sessWeekCur = data.days14.slice(7).reduce((a, d) => a + d.sessions, 0);
  const sessWeekPrv = data.days14.slice(0, 7).reduce((a, d) => a + d.sessions, 0);
  const actWeekCur  = data.days14.slice(7).reduce((a, d) => a + d.active, 0);
  const actWeekPrv  = data.days14.slice(0, 7).reduce((a, d) => a + d.active, 0);

  function trendPct(cur: number, prv: number) {
    if (prv === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prv) / prv) * 100);
  }

  const sessTrend = trendPct(sessWeekCur, sessWeekPrv);
  const actTrend  = trendPct(actWeekCur, actWeekPrv);

  return (
    <div className="shrink-0 border-b border-gray-100 bg-gradient-to-b from-white/80 to-slate-50/50 backdrop-blur-sm">
      {/* ── Toggle header ───────────────────────────────────────── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-white/60 transition-colors focus:outline-none"
      >
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
          Analytics Overview
        </span>
        {isOpen
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        }
      </button>

      {isOpen && (
        <div>
          {/* ── Four mini charts ──────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 pb-4">

            {/* Session Activity — 14-day area */}
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                  Sessions (14d)
                </span>
                {sessTrend !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold ${sessTrend > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {sessTrend > 0
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />
                    }
                    {Math.abs(sessTrend)}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={data.days14} margin={{ top: 8, right: 6, left: -22, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dc-sess-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={4}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-4}
                    width={18}
                  />
                  <Tooltip content={<MiniTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#dc-sess-grad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Active Coaches — 14-day area */}
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                  Active Coaches (14d)
                </span>
                {actTrend !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold ${actTrend > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {actTrend > 0
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />
                    }
                    {Math.abs(actTrend)}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={data.days14} margin={{ top: 8, right: 6, left: -22, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dc-act-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={4}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-4}
                    width={18}
                  />
                  <Tooltip content={<MiniTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#dc-act-grad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* New Accounts — 8-week bar */}
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-2">
                New Accounts (8w)
              </span>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={data.weeks8} margin={{ top: 8, right: 6, left: -22, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={4}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-4}
                    width={18}
                  />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="#8b5cf6"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Storage Distribution — segmented horizontal progress bar with clear labels */}
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-2.5">
                Storage Distribution
              </span>
              
              <div className="flex flex-col justify-between flex-1">
                {/* Single segmented visual bar */}
                <div className="flex h-3 bg-gray-100 rounded-full overflow-hidden mb-3 shadow-inner">
                  {data.storageDistribution.map((tier) => (
                    tier.pct > 0 && (
                      <div
                        key={tier.label}
                        className="h-full transition-all duration-700 hover:opacity-90 relative"
                        style={{ width: `${tier.pct}%`, backgroundColor: tier.color }}
                        title={`${tier.label}: ${tier.count} coaches (${tier.pct}%)`}
                      />
                    )
                  ))}
                </div>

                {/* Clear Segment Labels (Legend) */}
                <div className="grid grid-cols-1 gap-1.5 flex-1 justify-center">
                  {data.storageDistribution.map((tier) => (
                    <div key={tier.label} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
                        <span className="font-semibold text-slate-600 leading-none">{tier.label}</span>
                      </div>
                      <span className="font-bold text-slate-500 shrink-0">{tier.count} ({tier.pct}%)</span>
                    </div>
                  ))}
                </div>

                {/* Spike alert */}
                {data.storageDistribution[2]?.count > 0 && (
                  <p className="text-[9px] text-amber-600 font-semibold mt-2.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                    {data.storageDistribution[2].count} coach{data.storageDistribution[2].count !== 1 ? "es" : ""} near limit
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* ── Activity Heatmap ──────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-2">
            <div className="px-4 mb-1.5">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                Activity Heatmap (12w) — last active per coach
              </span>
            </div>
            <ActivityHeatmap cells={data.heatmapCells} />
          </div>
        </div>
      )}
    </div>
  );
}
