import { useMemo, useState } from "react";
import { Note, Panel, Pill, SectionTitle } from "../components/ui";
import { DEFAULT_GROUP_NAME } from "../fixtures";
import {
  expectedPracticeStats,
  historicalTeamRows,
  playerTotals,
  programTotals,
  subTeamLabel,
  subTeamName,
  usePrototypeStore,
} from "../store";
import type { Player } from "../types";

type Attribution = "current" | "atSession";

interface Row {
  player: Player;
  group: string;
  otherTeams: string[];
  creditedHours: number;
  practices: number;
  trainings: number;
  tickets: number;
  retired?: boolean;
}

export default function ProgressScreen() {
  const { state } = usePrototypeStore();
  const [attribution, setAttribution] = useState<Attribution>("current");
  const [team, setTeam] = useState("all");

  const totals = programTotals(state);
  const activeTeams = state.subTeams.filter((t) => t.active);
  const roster = state.players.filter((p) => !p.retired);
  // R01: retirement removes a player from the active roster, never from
  // history (P07). "Team at session" reports on who actually attended, so
  // its "All teams" view must not silently drop retired attendees.
  const everyPlayer = state.players;

  // Every sub-team id a session snapshot ever names, active or retired:
  // historical attribution must stay reachable after a sub-team retires.
  const historicalTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of state.sessions) {
      if (!s.teamAtSession) continue;
      for (const memberIds of Object.values(s.teamAtSession)) memberIds.forEach((id) => ids.add(id));
    }
    return [...ids];
  }, [state.sessions]);

  const teamFilterOptions = useMemo(() => {
    if (attribution === "current") return activeTeams.map((t) => ({ id: t.id, label: t.name }));
    return historicalTeamIds.map((id) => {
      const t = state.subTeams.find((x) => x.id === id);
      return { id, label: t ? (t.active ? t.name : `${t.name} (retired)`) : "Unknown team" };
    });
  }, [attribution, activeTeams, historicalTeamIds, state.subTeams]);

  const hasUnknownHistory = useMemo(() => state.sessions.some((s) => !s.teamAtSession), [state.sessions]);

  // D10 demonstration only: players named in at least one saved "Who's
  // expected?" snapshot. Not wired into the totals/table above (spec: do
  // not rebuild all analytics yet).
  const expectedDemoPlayers = useMemo(
    () => everyPlayer.filter((p) => expectedPracticeStats(state, p.id).expectedCount > 0),
    [everyPlayer, state],
  );

  /**
   * "Current roster" groups by who a player plays for today, and totals are
   * their all-time record — unaffected by which team filter is chosen.
   *
   * "Team at session" instead reads the membership snapshot recorded with
   * each session (F01). Picking one specific team there recomputes totals
   * from only the sessions whose own snapshot names that team, so a
   * transfer never moves old credit onto the player's new team, and a
   * player with no qualifying history for that team simply is not a row.
   */
  const currentRows: Row[] = useMemo(
    () =>
      roster.map((p) => {
        const t = playerTotals(state, p.id);
        const group = p.subTeamIds.length === 0 ? DEFAULT_GROUP_NAME : subTeamLabel(state, p.subTeamIds);
        return { player: p, group, otherTeams: [], ...t };
      }),
    [roster, state],
  );

  const historicalAllRows: Row[] = useMemo(
    () =>
      everyPlayer.map((p) => {
        const t = playerTotals(state, p.id);
        const groups = new Set<string>();
        for (const s of state.sessions) {
          if (!s.attendeeIds.includes(p.id)) continue;
          if (!s.teamAtSession) {
            groups.add("Unknown (legacy record)");
            continue;
          }
          const ids = s.teamAtSession[p.id] ?? [];
          if (ids.length === 0) groups.add(DEFAULT_GROUP_NAME);
          else ids.forEach((id) => groups.add(subTeamName(state, id)));
        }
        const group = groups.size === 0 ? "—" : [...groups].join(" · ");
        return { player: p, group, otherTeams: [], retired: p.retired, ...t };
      }),
    [everyPlayer, state],
  );

  const historicalTeamRowsForSelection: Row[] = useMemo(() => {
    if (attribution !== "atSession" || team === "all") return [];
    return historicalTeamRows(state, team).map((r) => ({
      player: r.player,
      group: subTeamName(state, team),
      otherTeams: r.otherTeams,
      creditedHours: r.creditedHours,
      practices: r.practices,
      trainings: r.trainings,
      tickets: r.tickets,
      retired: r.player.retired,
    }));
  }, [attribution, team, state]);

  let visible: Row[];
  if (attribution === "current") {
    visible = team === "all" ? currentRows : currentRows.filter((r) => r.player.subTeamIds.includes(team));
  } else {
    visible = team === "all" ? historicalAllRows : historicalTeamRowsForSelection;
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle
          eyebrow="Progress"
          title="Credited hours"
          hint="Effort is labelled credited hours. Raffle settings never change these numbers."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border mc-border p-4">
            <div className="text-xs font-bold uppercase tracking-widest mc-text-secondary">
              Session-hours
            </div>
            <div className="mt-1 text-3xl font-bold mc-mono mc-text">{totals.sessionHours}</div>
            <p className="mt-1 text-xs mc-text-muted">Each session counted once.</p>
          </div>
          <div className="rounded-xl border mc-border p-4">
            <div className="text-xs font-bold uppercase tracking-widest mc-text-secondary">
              Player-hours
            </div>
            <div className="mt-1 text-3xl font-bold mc-mono mc-text">{totals.playerHours}</div>
            <p className="mt-1 text-xs mc-text-muted">Every attendee's credit added up.</p>
          </div>
        </div>
        <Note>
          These are different measures and are labelled as such. Five attendees at one new practice
          is 1.5 session-hours and 7.5 player-hours. Both already count each player and session once,
          even for a player on several teams at once (D07) — team-filtered totals below do not.
        </Note>
      </Panel>

      {/*
       * R01: gate on whether any sub-team was ever created, not on whether
       * one is still active. Retiring every sub-team must not strand a coach
       * without a way back into "Team at session" — that historical view is
       * exactly what still explains who used to play for a now-retired team.
       */}
      {state.subTeams.length > 0 && (
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary mr-1">
              Attribute to
            </span>
            <Chip
              active={attribution === "current"}
              onClick={() => {
                setAttribution("current");
                setTeam("all");
              }}
            >
              Current roster
            </Chip>
            <Chip
              active={attribution === "atSession"}
              onClick={() => {
                setAttribution("atSession");
                setTeam("all");
              }}
            >
              Team at session
            </Chip>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary mr-1">
              Team
            </span>
            <Chip active={team === "all"} onClick={() => setTeam("all")}>
              All teams
            </Chip>
            {teamFilterOptions.map((o) => (
              <Chip key={o.id} active={team === o.id} onClick={() => setTeam(o.id)}>
                {o.label}
              </Chip>
            ))}
          </div>

          {team !== "all" && (
            <Note>
              Team totals can overlap: a player on several teams at once (D07) counts in full under
              every team they qualify for here — they are not additive across teams. The
              program-wide totals above and the All teams view already count each player and
              session once (P12).
            </Note>
          )}
          {attribution === "atSession" && team === "all" && (
            <p className="mt-3 text-xs mc-text-muted">
              All teams under Team at session includes retired players (labelled Retired) alongside
              the current roster — retirement removes someone from new sessions, not from history
              (P07).{" "}
              {hasUnknownHistory &&
                "Some early sessions have no recorded team-at-session snapshot; that attendance stays in “Unknown (legacy record)” rather than being guessed into a team."}
            </p>
          )}
        </Panel>
      )}

      <Panel className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Credited hours and tickets per player</caption>
            <thead>
              <tr className="border-b mc-border text-left mc-text-secondary">
                <th scope="col" className="px-4 py-3 font-semibold">Player</th>
                <th scope="col" className="px-4 py-3 font-semibold">Group</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Practices</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Trainings</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Credited hours</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.player.id} className="border-b mc-border last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-semibold mc-text">
                    {r.player.label ? `${r.player.firstName} ${r.player.label}` : r.player.firstName}
                    {r.player.number !== null && (
                      <span className="mc-text-muted font-normal mc-mono"> · #{r.player.number}</span>
                    )}
                    {r.retired && (
                      <span className="ml-2 align-middle">
                        <Pill tone="neutral">Retired</Pill>
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 mc-text-secondary">
                    {r.group}
                    {r.otherTeams.length > 0 && (
                      <span className="block text-[10px] mc-text-muted">
                        also counted under {r.otherTeams.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right mc-mono mc-text">{r.practices}</td>
                  <td className="px-4 py-3 text-right mc-mono mc-text">{r.trainings}</td>
                  <td className="px-4 py-3 text-right mc-mono font-semibold mc-text">
                    {r.creditedHours}
                  </td>
                  <td className="px-4 py-3 text-right mc-mono mc-text">{r.tickets}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center mc-text-secondary">
                    No qualifying attendance for this team under this attribution.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {expectedDemoPlayers.length > 0 && (
        <Panel className="p-0 overflow-hidden">
          <div className="p-5 md:p-6 pb-0">
            <SectionTitle
              eyebrow="Demonstration (D10)"
              title="Expected-practice attendance"
              hint="Counts only practices with a saved Who's expected? snapshot naming the player — not every practice on today's roster. A small proof of the expected-only denominator and streak, not the final shared analytics (D12, Stage 6)."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Expected-only practice attendance and streak per player</caption>
              <thead>
                <tr className="border-b mc-border text-left mc-text-secondary">
                  <th scope="col" className="px-4 py-3 font-semibold">Player</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Expected</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Present</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Percent</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Current streak</th>
                </tr>
              </thead>
              <tbody>
                {expectedDemoPlayers.map((p) => {
                  const s = expectedPracticeStats(state, p.id);
                  return (
                    <tr key={p.id} className="border-b mc-border last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-semibold mc-text">
                        {p.label ? `${p.firstName} ${p.label}` : p.firstName}
                      </th>
                      <td className="px-4 py-3 text-right mc-mono mc-text">{s.expectedCount}</td>
                      <td className="px-4 py-3 text-right mc-mono mc-text">{s.presentCount}</td>
                      <td className="px-4 py-3 text-right mc-mono mc-text">{s.percent}%</td>
                      <td className="px-4 py-3 text-right mc-mono mc-text">{s.currentStreak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-5 md:p-6 pt-0">
            <Note tone="assumption">
              Guest exclusion, excused absences and unexpected-attendance streak treatment are not
              decided yet. This table never feeds the totals above.
            </Note>
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2">
        <Pill>Practices and optional trainings are counted separately</Pill>
        <Pill>Historical durations are shown as recorded, not rewritten to 1.5</Pill>
      </div>

      <Note>
        Guest exclusion from regular-roster percentages and streaks is preserved by the existing
        stats module and is not re-implemented here. Stage 6 migrates those joins to stable ids.
      </Note>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active
          ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-300"
          : "mc-card mc-border mc-text-secondary mc-card-hover"
      }`}
    >
      {children}
    </button>
  );
}
