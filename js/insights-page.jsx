/* global React, Recharts */
const { useState, useMemo } = React;
const {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} = Recharts;

/* ---------- mock data (resembles a real club team) ---------- */
const ROSTER = [
  "Maya R.", "Jordan T.", "Sam K.", "Priya N.", "Liam G.",
  "Chloé M.", "Diego A.", "Ava S.", "Noah W.", "Zara H.",
  "Eli P.", "Ines C.",
];
const GUESTS = ["Mateo (guest)", "Ren (guest)"];

// Deterministic pseudo-random so the mock looks plausible.
function rng(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

const EVENTS = (() => {
  const r = rng(7);
  const list = [];
  const start = new Date("2026-02-01");
  for (let i = 0; i < 38; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + Math.floor(i * 3.4));
    const isPractice = r() > 0.28;
    const present = [...ROSTER, ...GUESTS].filter(p =>
      GUESTS.includes(p) ? r() < 0.35 : r() < 0.72 + (ROSTER.indexOf(p) < 4 ? 0.2 : -0.05)
    );
    list.push({
      id: `e${i}`,
      date: d.toISOString().slice(0, 10),
      type: isPractice ? "Practice" : "Optional Training",
      duration: isPractice ? 1.5 : 1,
      players: present,
    });
  }
  return list;
})();

/* ---------- derived stats ---------- */
function useStats(events, range) {
  return useMemo(() => {
    const cutoff = range === "all" ? null : (() => {
      const d = new Date(); d.setDate(d.getDate() - Number(range)); return d.toISOString().slice(0,10);
    })();
    const scoped = cutoff ? events.filter(e => e.date >= cutoff) : events;
    const practices = scoped.filter(e => e.type === "Practice");
    const optional  = scoped.filter(e => e.type === "Optional Training");
    const practiceHrs = practices.reduce((s,e)=>s+e.duration,0);
    const optionalHrs = optional .reduce((s,e)=>s+e.duration,0);

    const totals = {};
    [...ROSTER, ...GUESTS].forEach(p => totals[p] = { practice: 0, training: 0, attended: 0, missed: 0, streak: 0, bestStreak: 0 });
    scoped.forEach(ev => {
      ev.players.forEach(p => {
        if (!totals[p]) totals[p] = { practice: 0, training: 0, attended: 0, missed: 0, streak: 0, bestStreak: 0 };
        if (ev.type === "Practice") totals[p].practice += ev.duration;
        else totals[p].training += ev.duration;
      });
    });
    // attendance streaks against practices only, chronological
    const sortedPracs = [...practices].sort((a,b)=>a.date.localeCompare(b.date));
    ROSTER.forEach(p => {
      let cur = 0, best = 0, attended = 0;
      sortedPracs.forEach(ev => {
        if (ev.players.includes(p)) { cur++; attended++; best = Math.max(best, cur); }
        else cur = 0;
      });
      totals[p].streak    = cur;
      totals[p].bestStreak = best;
      totals[p].attended  = attended;
      totals[p].missed    = sortedPracs.length - attended;
      totals[p].rate      = sortedPracs.length ? attended / sortedPracs.length : 0;
    });

    // monthly trend
    const byMonth = {};
    scoped.forEach(ev => {
      const m = ev.date.slice(0,7);
      if (!byMonth[m]) byMonth[m] = { hours: 0, rates: [] };
      byMonth[m].hours += ev.duration;
      if (ev.type === "Practice") {
        const reg = ev.players.filter(p => !GUESTS.includes(p)).length;
        byMonth[m].rates.push(reg / ROSTER.length);
      }
    });
    const trend = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([m, d]) => {
      const [y, mo] = m.split("-");
      return {
        label: new Date(+y, +mo - 1, 1).toLocaleDateString(undefined, { month: "short" }),
        hours: +d.hours.toFixed(1),
        attendance: d.rates.length ? Math.round(d.rates.reduce((a,b)=>a+b,0) / d.rates.length * 100) : 0,
      };
    });

    // day-of-week breakdown (practices only)
    const dow = [0,1,2,3,4,5,6].map(i => ({ day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i], count: 0, rateSum: 0 }));
    sortedPracs.forEach(ev => {
      const d = new Date(ev.date).getDay();
      dow[d].count++;
      dow[d].rateSum += ev.players.filter(p => !GUESTS.includes(p)).length / ROSTER.length;
    });
    const dowData = dow.filter(d => d.count > 0).map(d => ({
      day: d.day,
      sessions: d.count,
      attendance: Math.round((d.rateSum / d.count) * 100),
    }));

    // insights
    const ranked = ROSTER.map(p => ({ name: p, ...totals[p] })).sort((a,b) => b.rate - a.rate);
    const topAttendee = ranked[0];
    const needsLove   = ranked[ranked.length - 1];
    const longestStreak = ranked.reduce((best, p) => p.bestStreak > best.bestStreak ? p : best, ranked[0]);
    const guestCount = scoped.flatMap(e => e.players).filter(p => GUESTS.includes(p)).length;

    return {
      scoped, practices, optional, practiceHrs, optionalHrs,
      totals, trend, dowData,
      ranked,
      topAttendee, needsLove, longestStreak, guestCount,
      teamAvg: ranked.reduce((s,p) => s + p.rate, 0) / ranked.length,
    };
  }, [events, range]);
}

/* ---------- atoms ---------- */
function Kpi({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${accent || "bg-indigo-500"}`}></span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900 tabular-nums">{value}</span>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
    </div>
  );
}

function Insight({ icon, label, name, detail, tone }) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    info: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  };
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${tones[tone]}`}>
        <span className="text-base">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
        <div className="mt-0.5 truncate text-base font-semibold text-gray-900">{name}</div>
        <div className="mt-0.5 text-xs text-gray-500">{detail}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-base font-bold text-gray-900">{children}</h3>
      </div>
      {action}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
      }`}>
      {children}
    </button>
  );
}

/* ---------- main page ---------- */
function InsightsPage({ tweaks }) {
  const [range, setRange] = useState("all");
  const [sortKey, setSortKey] = useState("rate");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const stats = useStats(EVENTS, range);
  const showDow = tweaks.showDow;
  const layout = tweaks.layout; // "stacked" | "tabs"
  const [tab, setTab] = useState("overview");

  const sortedRoster = useMemo(() => {
    const arr = stats.ranked.slice();
    arr.sort((a,b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [stats, sortKey, sortDir]);

  const sortBy = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const tooltipStyle = {
    borderRadius: 10, fontSize: 12, border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  };

  /* sections as fragments so layout variant can swap them around */
  const HeaderBar = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Reports</div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Team performance</h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.scoped.length} events · {ROSTER.length} players ·{" "}
          {range === "all" ? "all time" : `last ${range} days`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {[["30","30d"], ["90","90d"], ["180","6m"], ["all","All"]].map(([v, l]) => (
            <Pill key={v} active={range === v} onClick={() => setRange(v)}>{l}</Pill>
          ))}
        </div>
        <button className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <span>↓</span> Export
        </button>
      </div>
    </div>
  );

  const KpiStrip = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Kpi label="Events" value={stats.scoped.length} sub={`${stats.practices.length} practice`} accent="bg-indigo-500" />
      <Kpi label="Practice hrs" value={stats.practiceHrs.toFixed(1)} sub="logged" accent="bg-blue-500" />
      <Kpi label="Optional hrs" value={stats.optionalHrs.toFixed(1)} sub="logged" accent="bg-purple-500" />
      <Kpi label="Avg attendance" value={`${Math.round(stats.teamAvg * 100)}%`} sub="across roster" accent="bg-emerald-500" />
      <Kpi label="Guest appearances" value={stats.guestCount} sub={`${GUESTS.length} on roster`} accent="bg-amber-500" />
    </div>
  );

  const InsightsRow = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Insight tone="good"  icon="★" label="Top attendee"
        name={stats.topAttendee.name}
        detail={`${Math.round(stats.topAttendee.rate*100)}% practice attendance · ${stats.topAttendee.attended} of ${stats.practices.length}`} />
      <Insight tone="info"  icon="🔥" label="Longest streak"
        name={stats.longestStreak.name}
        detail={`${stats.longestStreak.bestStreak} practices in a row${stats.longestStreak.streak >= 3 ? " · still going" : ""}`} />
      <Insight tone="warn"  icon="⚠" label="Needs follow-up"
        name={stats.needsLove.name}
        detail={`${Math.round(stats.needsLove.rate*100)}% attendance · missed ${stats.needsLove.missed} of ${stats.practices.length}`} />
    </div>
  );

  const TrendCard = (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <SectionTitle icon="∿">Trends over time</SectionTitle>
      {stats.trend.length < 2 ? (
        <div className="flex h-56 items-center justify-center text-sm italic text-gray-400">
          Log events across at least two months to see trends.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={stats.trend} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="gHrs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAtt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="L" tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="R" orientation="right" tickFormatter={v => `${v}%`}
                   domain={[0,100]} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v, name) => name === "Attendance %" ? [`${v}%`, name] : [`${v}h`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area yAxisId="L" type="monotone" dataKey="hours"      name="Hours"        stroke="#3b82f6" strokeWidth={2} fill="url(#gHrs)" />
            <Area yAxisId="R" type="monotone" dataKey="attendance" name="Attendance %" stroke="#10b981" strokeWidth={2} fill="url(#gAtt)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const DowCard = showDow && (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <SectionTitle icon="▦">Practice by day of week</SectionTitle>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={stats.dowData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="L" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis yAxisId="R" orientation="right" tickFormatter={v => `${v}%`} domain={[0,100]} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar yAxisId="L" dataKey="sessions"   name="Sessions"     fill="#c7d2fe" radius={[6,6,0,0]} />
          <Bar yAxisId="R" dataKey="attendance" name="Attendance %" fill="#6366f1" radius={[6,6,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <strong>Insight:</strong> Tuesday sessions average {stats.dowData.find(d=>d.day==="Tue")?.attendance ?? "—"}% attendance vs.
        {" "}{Math.round(stats.teamAvg*100)}% team average — worth a look.
      </div>
    </div>
  );

  /* combined player section — chart + table side-by-side */
  const PlayerSection = (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">◫</span>
          <h3 className="text-base font-bold text-gray-900">Players</h3>
          <span className="ml-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
            {ROSTER.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          Click a row to drill in
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
        {/* chart */}
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="size-2 rounded-sm bg-indigo-500"></span> Attendance %
            <span className="ml-2 size-2 rounded-sm bg-blue-400"></span> Practice hrs
            <span className="ml-2 size-2 rounded-sm bg-purple-400"></span> Optional hrs
          </div>
          <ResponsiveContainer width="100%" height={Math.max(220, sortedRoster.length * 28)}>
            <BarChart data={sortedRoster.map(p => ({
              player: p.name,
              "Attendance %": Math.round(p.rate * 100),
              Practice: +p.practice.toFixed(1),
              "Optional Training": +p.training.toFixed(1),
            }))} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="player" width={80} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Attendance %" fill="#6366f1" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* table */}
        <div className="overflow-x-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {[
                  ["name",     "Player"],
                  ["rate",     "Att %"],
                  ["practice", "Prac h"],
                  ["training", "Opt h"],
                  ["streak",   "Streak"],
                ].map(([k, l]) => (
                  <th key={k}
                      onClick={() => sortBy(k)}
                      className="cursor-pointer px-2 py-2 hover:text-gray-900">
                    {l}{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map(p => {
                const active = selectedPlayer === p.name;
                return (
                  <tr key={p.name}
                      onClick={() => setSelectedPlayer(active ? null : p.name)}
                      className={`cursor-pointer border-b border-gray-100 last:border-b-0 ${
                        active ? "bg-indigo-50" : "hover:bg-gray-50"
                      }`}>
                    <td className="px-2 py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="px-2 py-2 tabular-nums">
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                        p.rate >= 0.8 ? "bg-emerald-50 text-emerald-700" :
                        p.rate >= 0.5 ? "bg-amber-50 text-amber-700" :
                                        "bg-rose-50 text-rose-700"
                      }`}>{Math.round(p.rate * 100)}%</span>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-gray-700">{p.practice.toFixed(1)}</td>
                    <td className="px-2 py-2 tabular-nums text-gray-700">{p.training.toFixed(1)}</td>
                    <td className="px-2 py-2 tabular-nums text-gray-700">
                      {p.streak > 0
                        ? <span className="text-emerald-700">↑ {p.streak}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPlayer && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">{selectedPlayer} · session history</div>
            <button onClick={() => setSelectedPlayer(null)} className="text-xs text-gray-500 hover:text-gray-900">close ×</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {stats.practices.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(ev => {
              const present = ev.players.includes(selectedPlayer);
              return (
                <div key={ev.id}
                  title={`${ev.date} · ${present ? "present" : "absent"}`}
                  className={`size-4 rounded ${present ? "bg-indigo-500" : "bg-gray-200"}`}></div>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-gray-500">
            Each square = one practice, chronological. Indigo = attended.
          </div>
        </div>
      )}
    </div>
  );

  const SessionsCard = (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <details>
        <summary className="flex cursor-pointer items-center justify-between p-5 hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">⌗</span>
            <h3 className="text-base font-bold text-gray-900">Session log</h3>
            <span className="ml-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
              {stats.scoped.length}
            </span>
          </div>
          <span className="text-xs text-gray-500">Expand ↓</span>
        </summary>
        <div className="border-t border-gray-100 p-5">
          <div className="space-y-2">
            {stats.scoped.slice().reverse().slice(0,10).map(ev => (
              <div key={ev.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {ev.type} · {new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {ev.duration}h · {ev.players.length} present
                    </div>
                  </div>
                  <button className="shrink-0 text-[11px] font-semibold text-gray-500 hover:text-indigo-600">
                    Copy roster
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ev.players.map(p => (
                    <span key={p}
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                        p.includes("(guest)")
                          ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">
            View all sessions →
          </button>
        </div>
      </details>
    </div>
  );

  /* layout assembly */
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {HeaderBar}
      {KpiStrip}
      {InsightsRow}

      {layout === "tabs" ? (
        <>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
            {[["overview","Overview"],["players","Players"],["trends","Trends"]].map(([v,l]) => (
              <Pill key={v} active={tab===v} onClick={()=>setTab(v)}>{l}</Pill>
            ))}
          </div>
          {tab === "overview" && (<>
            <div className={`grid grid-cols-1 gap-6 ${showDow ? "lg:grid-cols-2" : ""}`}>
              {TrendCard}
              {DowCard}
            </div>
            {SessionsCard}
          </>)}
          {tab === "players" && PlayerSection}
          {tab === "trends" && (<div className="space-y-6">{TrendCard}{DowCard}</div>)}
        </>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-6 ${showDow ? "lg:grid-cols-2" : ""}`}>
            {TrendCard}
            {DowCard}
          </div>
          {PlayerSection}
          {SessionsCard}
        </>
      )}
    </div>
  );
}

window.InsightsPage = InsightsPage;
