import { Note, Panel, Pill, SectionTitle } from "../components/ui";
import { currentRoundTickets, displayName, ticketLines, usePrototypeStore } from "../store";

export default function RaffleScreen() {
  const { state } = usePrototypeStore();
  const current = currentRoundTickets(state);
  const all = ticketLines(state);
  const archivedTrainings = state.sessions.filter((s) => s.type === "training" && s.archived);
  // F05: eligibility follows round assignment, not the archived flag, so an
  // archived training can still be inside the current round.
  const archivedOutsideCurrentRound = archivedTrainings.filter((s) => s.roundId !== state.currentRoundId);
  const archivedInCurrentRound = archivedTrainings.filter((s) => s.roundId === state.currentRoundId);

  const byPlayer = new Map<string, number>();
  for (const t of current) byPlayer.set(t.playerId, (byPlayer.get(t.playerId) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle
          eyebrow="Raffle"
          title={`${current.length} eligible tickets`}
          hint="One entry per optional-training attendance. Practices earn nothing."
        />
        <div className="flex flex-wrap gap-2">
          <Pill tone="accent">Current round: {state.currentRoundId}</Pill>
          <Pill>{all.length - current.length} tickets in earlier rounds</Pill>
          {archivedOutsideCurrentRound.length > 0 && (
            <Pill tone="warn">
              {archivedOutsideCurrentRound.length} archived training
              {archivedOutsideCurrentRound.length === 1 ? "" : "s"} from earlier rounds
            </Pill>
          )}
          {archivedInCurrentRound.length > 0 && (
            <Pill tone="ok">
              {archivedInCurrentRound.length} archived training
              {archivedInCurrentRound.length === 1 ? "" : "s"} still counted in this round
            </Pill>
          )}
        </div>
      </Panel>

      <Panel>
        <h3 className="font-bold mc-text mb-3">Who is in this round</h3>
        {byPlayer.size === 0 ? (
          <p className="text-sm mc-text-secondary">
            Nobody has attended an optional training in this round yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...byPlayer.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([playerId, count]) => {
                const p = state.players.find((x) => x.id === playerId);
                return (
                  <li
                    key={playerId}
                    className="flex items-center justify-between rounded-xl border mc-border px-4 py-3"
                  >
                    <span className="font-semibold mc-text">
                      {p ? displayName(p) : "Former player"}
                    </span>
                    <Pill tone="accent">
                      {count} ticket{count === 1 ? "" : "s"}
                    </Pill>
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>

      <Note>
        Drawing is Stage 6 work and is not prototyped here. The behaviors to preserve: a draw
        records a winner without consuming tickets, optional last-N exclusion filters the draw pool
        only, and ticket eligibility follows each session's immutable round assignment — archiving
        or restoring a session never adds or removes a current-round ticket (F05). The initial
        migration still seeds old archived history outside the first current pool (D03).
      </Note>
    </div>
  );
}
