import { useEffect, useState, Fragment } from "react";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTeamStore } from "../hooks/useTeamStore";

interface CoachSummary {
  coachId: string;
  email: string;
  teamName: string;
  teamLogo: string;
  playerCount: number;
  sessionCount: number;
  raffleEnabled: boolean;
  players: string[];
  recentSessions: string[];
}

export default function SuperAdminDashboard() {
  const { logout } = useTeamStore();
  const [summaries, setSummaries] = useState<CoachSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllData() {
      try {
        const [profilesRes, settingsRes, rosterRes, eventsRes] = await Promise.all([
          supabase.from("profiles").select("id, email"),
          supabase.from("team_settings").select("coach_id, team_name, team_logo, raffle_enabled"),
          supabase.from("roster").select("coach_id, name"),
          supabase.from("events").select("coach_id, date, saved_at"),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (rosterRes.error) throw rosterRes.error;
        if (eventsRes.error) throw eventsRes.error;

        const profiles = profilesRes.data ?? [];
        const settings = settingsRes.data ?? [];
        const rosterRows = rosterRes.data ?? [];
        const eventRows = eventsRes.data ?? [];

        const settingsMap = new Map(settings.map((s) => [s.coach_id, s]));

        const rosterByCoach = new Map<string, string[]>();
        for (const r of rosterRows) {
          const list = rosterByCoach.get(r.coach_id) ?? [];
          list.push(r.name);
          rosterByCoach.set(r.coach_id, list);
        }

        const eventsByCoach = new Map<string, { date: string; saved_at: string }[]>();
        for (const e of eventRows) {
          const list = eventsByCoach.get(e.coach_id) ?? [];
          list.push({ date: e.date, saved_at: e.saved_at });
          eventsByCoach.set(e.coach_id, list);
        }

        const data: CoachSummary[] = profiles.map((profile) => {
          const ts = settingsMap.get(profile.id);
          const players = (rosterByCoach.get(profile.id) ?? []).sort((a, b) =>
            a.localeCompare(b)
          );
          const coachEvents = eventsByCoach.get(profile.id) ?? [];
          const recentSessions = [...coachEvents]
            .sort((a, b) => b.saved_at.localeCompare(a.saved_at))
            .slice(0, 5)
            .map((e) => e.date);

          return {
            coachId: profile.id,
            email: profile.email,
            teamName: ts?.team_name ?? "—",
            teamLogo: ts?.team_logo ?? "",
            playerCount: players.length,
            sessionCount: coachEvents.length,
            raffleEnabled: ts?.raffle_enabled ?? false,
            players,
            recentSessions,
          };
        });

        setSummaries(data);
      } catch (err: any) {
        setError(err.message || "Failed to load data.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllData();
  }, []);

  const toggleRow = (coachId: string) => {
    setExpandedCoachId((prev) => (prev === coachId ? null : coachId));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">All coaches across the platform</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-600 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all border border-transparent hover:border-red-100 font-semibold text-sm"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </header>

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="size-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Coach
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Team
                  </th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Players
                  </th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Sessions
                  </th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Raffle
                  </th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <Fragment key={s.coachId}>
                    <tr
                      onClick={() => toggleRow(s.coachId)}
                      className={`cursor-pointer transition-colors ${
                        i !== summaries.length - 1 ? "border-b border-gray-100" : ""
                      } ${
                        expandedCoachId === s.coachId
                          ? "bg-blue-50/60"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-5 py-4 text-gray-800 font-medium">{s.email}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {s.teamLogo ? (
                            <img
                              src={s.teamLogo}
                              alt={s.teamName}
                              className="size-8 rounded-lg object-cover shrink-0 shadow-sm"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-gray-100 shrink-0" />
                          )}
                          <span className="text-gray-800">{s.teamName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-700">
                        {s.playerCount}
                      </td>
                      <td className="px-5 py-4 text-center text-gray-700">
                        {s.sessionCount}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.raffleEnabled
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.raffleEnabled ? "On" : "Off"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {expandedCoachId === s.coachId ? (
                          <ChevronDown className="size-4 text-gray-400 ml-auto" />
                        ) : (
                          <ChevronRight className="size-4 text-gray-400 ml-auto" />
                        )}
                      </td>
                    </tr>

                    {expandedCoachId === s.coachId && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={6} className="px-5 pb-5 pt-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Players ({s.playerCount})
                              </p>
                              {s.players.length === 0 ? (
                                <p className="text-gray-400 text-sm italic">No players</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {s.players.map((name) => (
                                    <span
                                      key={name}
                                      className="px-2.5 py-1 rounded-full bg-white text-gray-700 text-xs font-medium shadow-sm border border-gray-200"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Recent Sessions
                              </p>
                              {s.recentSessions.length === 0 ? (
                                <p className="text-gray-400 text-sm italic">No sessions</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {s.recentSessions.map((date, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm text-gray-700 flex items-center gap-2"
                                    >
                                      <span className="size-1.5 rounded-full bg-blue-400 shrink-0" />
                                      {date}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}

                {summaries.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-gray-400 text-sm"
                    >
                      No coaches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
