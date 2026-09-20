import { useMemo, useState } from "react";
import { Note, Panel, Pill, SectionTitle } from "../components/ui";
import { playerTotals, programTotals, subTeamName, usePrototypeStore } from "../store";

type Attribution = "current" | "atSession";

export default function ProgressScreen() {
  const { state } = usePrototypeStore();
  const [attribution, setAttribution] = useState<Attribution>("current");
  const [team, setTeam] = useState("all");

  const totals = programTotals(state);
  const activeTeams = state.subTeams.filter((t) => t.active);
  const roster = state.players.filter((p) => !p.retired);

  /**
   * "Current roster" groups by who a player plays for today.
   * "Team at session" uses the membership snapshot recorded with each session,
   * so a transfer never moves old credit between groups. Sessions with no
   * snapshot stay in an explicit Unknown group rather than being guessed.
   */
  const rows = useMemo(() => {
    return roster.map((p) => {
      const t = playerTotals(state, p.id);
      let group: string;
      if (attribution === "current") {
        group = subTeamName(state, p.subTeamId);
      } else {
        const groups = new Set<string>();
        for (const s of state.sessions) {
          if (!s.attendeeIds.includes(p.id)) continue;
          if (!s.teamAtSession) groups.add("Unknown (legacy record)");
          else groups.add(subTeamName(state, s.teamAtSession[p.id] ?? null));
        }
        group = groups.size === 0 ? "—" : [...groups].join(" · ");
      }
      return { player: p, ...t, group };
    });
  }, [roster, state, attribution]);

  const visible =
    team === "all"
      ? rows
      : rows.filter((r) => (r.player.subTeamId ?? "none") === team);

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
          is 1.5 session-hours and 7.5 player-hours.
        </Note>
      </Panel>

      {activeTeams.length > 0 && (
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary mr-1">
              Attribute to
            </span>
            <Chip active={attribution === "current"} onClick={() => setAttribution("current")}>
              Current roster
            </Chip>
            <Chip active={attribution === "atSession"} onClick={() => setAttribution("atSession")}>
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
            {activeTeams.map((t) => (
              <Chip key={t.id} active={team === t.id} onClick={() => setTeam(t.id)}>
                {t.name}
              </Chip>
            ))}
          </div>
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
                  </th>
                  <td className="px-4 py-3 mc-text-secondary">{r.group}</td>
                  <td className="px-4 py-3 text-right mc-mono mc-text">{r.practices}</td>
                  <td className="px-4 py-3 text-right mc-mono mc-text">{r.trainings}</td>
                  <td className="px-4 py-3 text-right mc-mono font-semibold mc-text">
                    {r.creditedHours}
                  </td>
                  <td className="px-4 py-3 text-right mc-mono mc-text">{r.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

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
