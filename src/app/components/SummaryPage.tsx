import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  Award,
  Flame,
  AlertTriangle,
  Download,
  TrendingUp,
  Clock,
  Users,
  Calendar,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import {
  filterEventsByRange,
  playerAttendance,
  monthlyTrend,
  dayOfWeekBreakdown,
  insightsFromAttendance,
  type PlayerAttendanceRecord,
} from "@/lib/stats";
import { exportReportCSV } from "@/lib/csv";

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = "30" | "90" | "180" | "all";
type SortKey = "name" | "rate" | "practice" | "training" | "streak";
type SortDir = "asc" | "desc";

// ─── Tooltip style ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  borderRadius: 10,
  fontSize: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

// ─── Small atoms ─────────────────────────────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-gray-900 text-white"
          : "bg-white text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${accent}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900 tabular-nums">
          {value}
        </span>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  name,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  detail: string;
  tone: "good" | "info" | "warn";
}) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    info: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  };
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div
        className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </div>
        <div className="mt-0.5 truncate text-base font-semibold text-gray-900">
          {name}
        </div>
        <div className="mt-0.5 text-xs text-gray-500">{detail}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SummaryPageProps {
  openExportPdf?: boolean;
  onExportPdfOpened?: () => void;
  onNavigate?: (page: string) => void;
}

export default function SummaryPage({
  onNavigate,
}: SummaryPageProps = {}) {
  const { state } = useTeamStore();
  const { events, roster, guestPlayers } = state;

  const [range, setRange] = useState<Range>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // ── Scoped events ──────────────────────────────────────────────────────────
  const scoped = useMemo(
    () => filterEventsByRange(events, range === "all" ? "all" : Number(range)),
    [events, range]
  );

  const practices = useMemo(
    () => scoped.filter((e) => e.type === EVENT_TYPES.PRACTICE),
    [scoped]
  );
  const optional = useMemo(
    () => scoped.filter((e) => e.type === EVENT_TYPES.OPTIONAL_TRAINING),
    [scoped]
  );
  const practiceHrs = practices.reduce((s, e) => s + e.duration, 0);
  const optionalHrs = optional.reduce((s, e) => s + e.duration, 0);

  // ── Player attendance ──────────────────────────────────────────────────────
  const att = useMemo(
    () => playerAttendance(scoped, roster, guestPlayers),
    [scoped, roster, guestPlayers]
  );

  const teamAvg = att.length
    ? att.reduce((s, p) => s + p.rate, 0) / att.length
    : 0;

  const guestCount = useMemo(
    () =>
      scoped.flatMap((e) => e.players).filter((p) => guestPlayers.includes(p))
        .length,
    [scoped, guestPlayers]
  );

  const insights = useMemo(() => insightsFromAttendance(att), [att]);

  // ── Charts data ────────────────────────────────────────────────────────────
  const trend = useMemo(
    () => monthlyTrend(scoped, roster, guestPlayers),
    [scoped, roster, guestPlayers]
  );

  const dowData = useMemo(
    () => dayOfWeekBreakdown(scoped, roster, guestPlayers),
    [scoped, roster, guestPlayers]
  );

  // DoW insight callout
  const dowInsightDay = useMemo(() => {
    if (!dowData.length) return null;
    const teamAvgPct = Math.round(teamAvg * 100);
    return (
      dowData.find((d) => d.attendance <= teamAvgPct - 10) ?? null
    );
  }, [dowData, teamAvg]);

  // ── Sorted player table ────────────────────────────────────────────────────
  const sortedAtt = useMemo(() => {
    const arr = [...att];
    arr.sort((a, b) => {
      const av = a[sortKey as keyof PlayerAttendanceRecord] ?? 0;
      const bv = b[sortKey as keyof PlayerAttendanceRecord] ?? 0;
      if (typeof av === "string")
        return sortDir === "asc"
          ? (av as string).localeCompare(bv as string)
          : (bv as string).localeCompare(av as string);
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return arr;
  }, [att, sortKey, sortDir]);

  const sortedPractices = useMemo(
    () => [...practices].sort((a, b) => a.date.localeCompare(b.date)),
    [practices]
  );

  function handleSortBy(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  // ── Att % cell colour ──────────────────────────────────────────────────────
  function attColor(rate: number) {
    if (rate >= 0.8) return "bg-emerald-50 text-emerald-700";
    if (rate >= 0.5) return "bg-amber-50 text-amber-700";
    return "bg-rose-50 text-rose-700";
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (!events.length) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
          <BarChart3 className="mx-auto mb-4 size-12 text-gray-300" />
          <p className="text-lg font-semibold text-gray-600">
            No events logged yet.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Log practice and training sessions to see reports here.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── 1. Header bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
            Reports
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Team performance
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {scoped.length} events · {roster.length} players ·{" "}
            {range === "all" ? "all time" : `last ${range} days`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            {(
              [
                ["30", "30d"],
                ["90", "90d"],
                ["180", "6m"],
                ["all", "All"],
              ] as [Range, string][]
            ).map(([v, l]) => (
              <Pill key={v} active={range === v} onClick={() => setRange(v)}>
                {l}
              </Pill>
            ))}
          </div>
          <button
            onClick={() =>
              exportReportCSV({ events: scoped, roster, guestPlayers, range })
            }
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Download className="size-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* ── 2. KPI strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          label="Events"
          value={scoped.length}
          sub={`${practices.length} practice`}
          accent="bg-indigo-500"
        />
        <Kpi
          label="Practice hrs"
          value={practiceHrs.toFixed(1)}
          sub="logged"
          accent="bg-blue-500"
        />
        <Kpi
          label="Optional hrs"
          value={optionalHrs.toFixed(1)}
          sub="logged"
          accent="bg-purple-500"
        />
        <Kpi
          label="Avg attendance"
          value={`${Math.round(teamAvg * 100)}%`}
          sub="across roster"
          accent="bg-emerald-500"
        />
        <Kpi
          label="Guest appearances"
          value={guestCount}
          sub={`${guestPlayers.length} on roster`}
          accent="bg-amber-500"
        />
      </div>

      {/* ── 3. Insights row ────────────────────────────────────────────────── */}
      {att.length > 0 && insights.topAttendee && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InsightCard
            tone="good"
            icon={<Award className="size-4" />}
            label="Top attendee"
            name={insights.topAttendee.name}
            detail={`${Math.round(insights.topAttendee.rate * 100)}% practice attendance · ${insights.topAttendee.attended} of ${practices.length}`}
          />
          <InsightCard
            tone="info"
            icon={<Flame className="size-4" />}
            label="Longest streak"
            name={insights.longestStreak!.name}
            detail={`${insights.longestStreak!.bestStreak} practices in a row${insights.longestStreak!.streak >= 3 ? " · still going" : ""}`}
          />
          <InsightCard
            tone="warn"
            icon={<AlertTriangle className="size-4" />}
            label="Needs follow-up"
            name={insights.needsLove!.name}
            detail={`${Math.round(insights.needsLove!.rate * 100)}% attendance · missed ${insights.needsLove!.missed} of ${practices.length}`}
          />
        </div>
      )}

      {/* ── 4. Trends + Day-of-week ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trends over time */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-gray-400" />
            <h3 className="text-base font-bold text-gray-900">
              Trends over time
            </h3>
          </div>
          {trend.length < 2 ? (
            <div className="flex h-56 items-center justify-center text-sm italic text-gray-400">
              Log events across at least two months to see trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={trend}
                margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="gHrs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop
                      offset="100%"
                      stopColor="#3b82f6"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="gAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop
                      offset="100%"
                      stopColor="#10b981"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="L"
                  tickFormatter={(v) => `${v}h`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="R"
                  orientation="right"
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, name) =>
                    name === "Attendance %" ? [`${v}%`, name] : [`${v}h`, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="L"
                  type="monotone"
                  dataKey="hours"
                  name="Hours"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gHrs)"
                />
                <Area
                  yAxisId="R"
                  type="monotone"
                  dataKey="attendance"
                  name="Attendance %"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gAtt)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Day-of-week breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="size-4 text-gray-400" />
            <h3 className="text-base font-bold text-gray-900">
              Practice by day of week
            </h3>
          </div>
          {!dowData.length ? (
            <div className="flex h-56 items-center justify-center text-sm italic text-gray-400">
              No practice sessions logged yet.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={dowData}
                  margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="L"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="R"
                    orientation="right"
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    yAxisId="L"
                    dataKey="sessions"
                    name="Sessions"
                    fill="#c7d2fe"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    yAxisId="R"
                    dataKey="attendance"
                    name="Attendance %"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              {dowInsightDay && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <strong>Insight:</strong> {dowInsightDay.day} sessions average{" "}
                  {dowInsightDay.attendance}% attendance vs.{" "}
                  {Math.round(teamAvg * 100)}% team average — worth a look.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 5. Players ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        {/* card header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-gray-400" />
            <h3 className="text-base font-bold text-gray-900">Players</h3>
            <span className="ml-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
              {att.length}
            </span>
          </div>
          <div className="text-xs text-gray-500">Click a row to drill in</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
          {/* Left: bar chart */}
          <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="size-2 rounded-sm bg-indigo-500" /> Attendance %
            </div>
            {att.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm italic text-gray-400">
                No player data yet.
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, sortedAtt.length * 28)}
              >
                <BarChart
                  data={sortedAtt.map((p) => ({
                    player: p.name,
                    "Attendance %": Math.round(p.rate * 100),
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                  />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="player"
                    width={80}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="Attendance %"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Right: sortable table */}
          <div className="overflow-x-auto p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {(
                    [
                      ["name", "Player"],
                      ["rate", "Att %"],
                      ["practice", "Prac h"],
                      ["training", "Opt h"],
                      ["streak", "Streak"],
                    ] as [SortKey, string][]
                  ).map(([k, l]) => (
                    <th
                      key={k}
                      onClick={() => handleSortBy(k)}
                      className="cursor-pointer px-2 py-2 hover:text-gray-900"
                    >
                      {l}
                      {sortIcon(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAtt.map((p) => {
                  const active = selectedPlayer === p.name;
                  return (
                    <>
                      <tr
                        key={p.name}
                        onClick={() =>
                          setSelectedPlayer(active ? null : p.name)
                        }
                        className={`cursor-pointer border-b border-gray-100 last:border-b-0 ${
                          active ? "bg-indigo-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-2 py-2 font-medium text-gray-900">
                          {p.name}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${attColor(p.rate)}`}
                          >
                            {Math.round(p.rate * 100)}%
                          </span>
                        </td>
                        <td className="px-2 py-2 tabular-nums text-gray-700">
                          {p.practice.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-gray-700">
                          {p.training.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-gray-700">
                          {p.streak > 0 ? (
                            <span className="text-emerald-700">
                              ↑ {p.streak}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                      {/* Expanded timeline strip */}
                      {active && (
                        <tr key={`${p.name}-expand`}>
                          <td
                            colSpan={5}
                            className="border-b border-gray-100 bg-gray-50 px-4 py-3"
                          >
                            <div className="mb-1 text-[11px] font-semibold text-gray-500">
                              {p.name} · session history
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {sortedPractices.map((ev) => {
                                const present = ev.players.includes(p.name);
                                return (
                                  <div
                                    key={ev.id}
                                    title={`${ev.date} · ${present ? "present" : "absent"}`}
                                    className={`size-4 rounded ${present ? "bg-indigo-500" : "bg-gray-200"}`}
                                  />
                                );
                              })}
                            </div>
                            <div className="mt-1.5 text-[11px] text-gray-400">
                              Each square = one practice, chronological. Indigo
                              = attended.
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 6. Session log ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between p-5 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-gray-400" />
              <h3 className="text-base font-bold text-gray-900">Session log</h3>
              <span className="ml-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                {scoped.length}
              </span>
            </div>
            <span className="text-xs text-gray-500">Expand ↓</span>
          </summary>

          <div className="border-t border-gray-100 p-5">
            <div className="space-y-2">
              {scoped
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 10)
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {ev.type} ·{" "}
                          {new Date(
                            ev.date.includes("T")
                              ? ev.date
                              : `${ev.date}T12:00:00`
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ev.duration}h · {ev.players.length} present
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const text = ev.players.join(", ");
                          navigator.clipboard.writeText(text).catch(() => {});
                        }}
                        className="shrink-0 text-[11px] font-semibold text-gray-500 hover:text-indigo-600"
                      >
                        Copy roster
                      </button>
                    </div>
                    {/* Player chips */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ev.players.map((player) => {
                        const isGuest = guestPlayers.includes(player);
                        return (
                          <span
                            key={player}
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                              isGuest
                                ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {player}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
            {scoped.length > 10 && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => onNavigate?.("launch")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  View all sessions
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
