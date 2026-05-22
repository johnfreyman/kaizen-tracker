import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, Clock, UserX, UserCheck, Users } from "lucide-react";
import { useTeamStore, EVENT_TYPES } from "../hooks/useTeamStore";
import { calculateTotals } from "@/lib/stats";

const COLORS = {
  practice: "#3b82f6",
  training: "#8b5cf6",
  missed: "#ef4444",
  guest: "#22c55e",
  attendance: "#6366f1",
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm italic text-gray-400">
      {message}
    </div>
  );
}

function chartHeight(n: number) {
  return Math.max(220, Math.min(n * 36 + 60, 520));
}

export default function ChartsPage() {
  const { state } = useTeamStore();
  const { events, roster, guestPlayers } = state;

  const hasPractice = events.some((e) => e.type === EVENT_TYPES.PRACTICE);

  // Y-axis width based on longest player name
  const yAxisWidth = useMemo(() => {
    const max = Math.max(...roster.map((p) => p.length), 0);
    return Math.min(Math.max(max * 7, 60), 120);
  }, [roster]);

  // Chart 1: Practice attendance rate per player
  const attendanceData = useMemo(() => {
    const practices = events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
    const regularPlayers = roster.filter((p) => !guestPlayers.includes(p));
    if (!practices.length || !regularPlayers.length) return [];
    return regularPlayers
      .map((player) => ({
        player,
        "Attendance %": Math.round(
          (practices.filter((e) => e.players.includes(player)).length /
            practices.length) *
            100
        ),
      }))
      .sort((a, b) => b["Attendance %"] - a["Attendance %"]);
  }, [events, roster, guestPlayers]);

  // Chart 2: Hours by player (stacked practice + optional)
  const hoursData = useMemo(() => {
    const regularPlayers = roster.filter((p) => !guestPlayers.includes(p));
    if (!events.length || !regularPlayers.length) return [];
    const totals = calculateTotals(events, regularPlayers);
    return regularPlayers
      .map((player) => ({
        player,
        Practice: +(totals[player]?.practice ?? 0).toFixed(1),
        "Optional Training": +(totals[player]?.training ?? 0).toFixed(1),
      }))
      .filter((d) => d.Practice > 0 || d["Optional Training"] > 0)
      .sort(
        (a, b) =>
          b.Practice + b["Optional Training"] - (a.Practice + a["Optional Training"])
      );
  }, [events, roster, guestPlayers]);

  // Chart 3: Missed practice sessions per player
  const missedData = useMemo(() => {
    const practices = events.filter((e) => e.type === EVENT_TYPES.PRACTICE);
    const regularPlayers = roster.filter((p) => !guestPlayers.includes(p));
    if (!practices.length || !regularPlayers.length) return [];
    return regularPlayers
      .map((player) => ({
        player,
        Missed: practices.filter((e) => !e.players.includes(player)).length,
      }))
      .sort((a, b) => b.Missed - a.Missed);
  }, [events, roster, guestPlayers]);

  // Chart 4: Guest player session attendance counts
  const guestData = useMemo(() => {
    if (!guestPlayers.length) return [];
    return guestPlayers
      .map((player) => ({
        player,
        "Sessions Attended": events.filter((e) =>
          e.players.includes(player)
        ).length,
      }))
      .sort((a, b) => b["Sessions Attended"] - a["Sessions Attended"]);
  }, [events, guestPlayers]);

  // Chart 5: Monthly trends — total hours + avg practice attendance %
  const trendsData = useMemo(() => {
    if (!events.length) return [];
    const regularPlayersCount = roster.length - guestPlayers.length;
    const byMonth: Record<
      string,
      { totalHours: number; practiceRates: number[] }
    > = {};
    events.forEach((event) => {
      const month = event.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { totalHours: 0, practiceRates: [] };
      byMonth[month].totalHours += event.duration;
      if (event.type === EVENT_TYPES.PRACTICE && regularPlayersCount > 0) {
        const regularAttendees = event.players.filter(p => !guestPlayers.includes(p)).length;
        byMonth[month].practiceRates.push(
          Math.round((regularAttendees / regularPlayersCount) * 100)
        );
      }
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [year, mo] = month.split("-");
        const label = new Date(+year, +mo - 1, 1).toLocaleDateString(
          undefined,
          { month: "short", year: "2-digit" }
        );
        return {
          label,
          "Total Hours": +data.totalHours.toFixed(1),
          "Avg Attendance %":
            data.practiceRates.length > 0
              ? Math.round(
                  data.practiceRates.reduce((a, b) => a + b, 0) /
                    data.practiceRates.length
                )
              : 0,
        };
      });
  }, [events, roster, guestPlayers]);

  const tooltipStyle = {
    borderRadius: 12,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  };

  if (!events.length) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-xl md:p-8">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Analytics
          </span>
          <h2 className="mt-2 text-3xl font-bold leading-tight text-gray-900 md:text-5xl">
            Charts &amp; trends.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-gray-600">
            Visual breakdowns of attendance, hours, guest participation, and
            team trends.
          </p>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white/90 p-12 text-center shadow-xl">
          <TrendingUp className="mx-auto mb-4 size-12 text-gray-300" />
          <p className="text-lg font-semibold text-gray-600">
            No events logged yet.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Log practice and training sessions to see charts here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-xl md:p-8">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Analytics
        </span>
        <h2 className="mt-2 text-3xl font-bold leading-tight text-gray-900 md:text-5xl">
          Charts &amp; trends.
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-gray-600">
          Visual breakdowns of attendance, hours, guest participation, and team
          trends.
        </p>
      </div>

      {/* Row 1: Attendance Rate + Hours by Player */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Practice Attendance Rate */}
        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="size-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900">
              Practice Attendance Rate
            </h3>
          </div>
          {!hasPractice || !attendanceData.length ? (
            <EmptyChart message="No practice events logged." />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={chartHeight(attendanceData.length)}
            >
              <BarChart
                layout="vertical"
                data={attendanceData}
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="player"
                  width={yAxisWidth}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Attendance"]}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="Attendance %"
                  fill={COLORS.attendance}
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 2: Training Hours by Player */}
        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="size-5 text-purple-500" />
            <h3 className="text-lg font-bold text-gray-900">
              Training Hours by Player
            </h3>
          </div>
          {!hoursData.length ? (
            <EmptyChart message="No hours logged yet." />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={chartHeight(hoursData.length)}
            >
              <BarChart
                layout="vertical"
                data={hoursData}
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}h`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="player"
                  width={yAxisWidth}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [`${v}h`, name]}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar
                  dataKey="Practice"
                  stackId="hrs"
                  fill={COLORS.practice}
                  name="Practice"
                />
                <Bar
                  dataKey="Optional Training"
                  stackId="hrs"
                  fill={COLORS.training}
                  name="Optional Training"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Missed Sessions + Guest Participation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 3: Missed Sessions */}
        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserX className="size-5 text-red-500" />
            <h3 className="text-lg font-bold text-gray-900">
              Missed Practice Sessions
            </h3>
          </div>
          {!hasPractice || !missedData.length ? (
            <EmptyChart message="No practice events logged." />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={chartHeight(missedData.length)}
            >
              <BarChart
                layout="vertical"
                data={missedData}
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="player"
                  width={yAxisWidth}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => [v, "Sessions Missed"]}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="Missed"
                  fill={COLORS.missed}
                  radius={[0, 6, 6, 0]}
                  name="Sessions Missed"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 4: Guest Participation */}
        <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">
              Guest Participation
            </h3>
          </div>
          {!guestData.length ? (
            <EmptyChart message="No guest players on the roster." />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={chartHeight(guestData.length)}
            >
              <BarChart
                layout="vertical"
                data={guestData}
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="player"
                  width={yAxisWidth}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => [v, "Sessions Attended"]}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="Sessions Attended"
                  fill={COLORS.guest}
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Trends Over Time */}
      <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Trends Over Time</h3>
        </div>
        {trendsData.length < 2 ? (
          <EmptyChart message="Log events across at least 2 months to see trends." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={trendsData}
              margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="gradHours" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.practice}
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.practice}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="gradAttendance"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS.training}
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.training}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}h`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === "Avg Attendance %"
                    ? [`${v}%`, name]
                    : [`${v}h`, name]
                }
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="Total Hours"
                stroke={COLORS.practice}
                strokeWidth={2}
                fill="url(#gradHours)"
                dot={{ r: 4, fill: COLORS.practice }}
                activeDot={{ r: 6 }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="Avg Attendance %"
                stroke={COLORS.training}
                strokeWidth={2}
                fill="url(#gradAttendance)"
                dot={{ r: 4, fill: COLORS.training }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
