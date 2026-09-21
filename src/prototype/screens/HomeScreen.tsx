import { Dumbbell, Gift, ListChecks, RefreshCw, Settings as SettingsIcon, TrendingUp, Users } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { BigButton, EmptyState, Note, Panel, Pill, SectionTitle } from "../components/ui";
import { currentRoundTickets, deliveryLabel, presentCount, usePrototypeStore } from "../store";
import type { ScreenId } from "../PrototypeApp";

export default function HomeScreen({ go }: { go: (s: ScreenId) => void }) {
  const { state, actions } = usePrototypeStore();
  const session = state.activeSession;
  const rosterEmpty = state.players.length === 0;
  const pending = session?.delivery === "pending" || session?.delivery === "failed";
  const tickets = currentRoundTickets(state).length;

  return (
    <div className="space-y-6">
      {/* ── Start / resume ─────────────────────────────────────── */}
      <Panel>
        <SectionTitle
          eyebrow="Today"
          title={formatDate(new Date().toISOString().slice(0, 10), {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          hint="Optional Training opens attendance directly. Practice starts with a short Who's expected? step — still no start time, duration or timer."
        />

        {session ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">
                <span className="size-1.5 rounded-full bg-blue-500 animate-session-pulse" />
                In progress
              </Pill>
              <Pill>{formatDate(session.date)}</Pill>
              <Pill>{presentCount(session)} marked present</Pill>
              {session.date !== new Date().toISOString().slice(0, 10) && (
                <Pill tone="warn">Backdated entry</Pill>
              )}
            </div>
            <BigButton variant="primary" className="w-full" onClick={() => go("attendance")}>
              Resume {session.type === "practice" ? "Practice" : "Optional Training"}
            </BigButton>
            <p className="text-sm mc-text-secondary">
              Starting a new session cannot overwrite this one. Finish or resume it first.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <BigButton
              variant="primary"
              className="w-full text-base"
              disabled={rosterEmpty}
              onClick={() => go("expected")}
            >
              <Dumbbell className="size-5" />
              Start Practice
            </BigButton>
            <BigButton
              className="w-full text-base"
              disabled={rosterEmpty}
              onClick={() => {
                actions.start("training");
                go("attendance");
              }}
            >
              <ListChecks className="size-5" />
              Start Optional Training
            </BigButton>
          </div>
        )}

        {rosterEmpty && (
          <div className="mt-5">
            <EmptyState
              title="No players on the roster yet"
              body="Add players before starting a session. An empty roster is a starting point, not a dead end."
              action={
                <BigButton variant="primary" onClick={() => go("roster")}>
                  <Users className="size-5" />
                  Add players
                </BigButton>
              }
            />
          </div>
        )}
      </Panel>

      {/* ── Pending delivery ───────────────────────────────────── */}
      {pending && session && (
        <Panel className="border-amber-500/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-bold mc-text">{deliveryLabel(session.delivery).text}</h3>
              <p className="mt-1 text-sm mc-text-secondary max-w-lg">
                Nothing was lost. Tickets and credited hours are not awarded until the cloud
                confirms this session, so the raffle still shows {tickets} tickets.
              </p>
            </div>
            <BigButton onClick={actions.retrySync}>
              <RefreshCw className="size-4" />
              Retry sync
            </BigButton>
          </div>
          <Note>
            P02 recommends blocking a second session until this one syncs. That is the behavior
            shown here; confirm it before Stage 4 implements the queue.
          </Note>
        </Panel>
      )}

      {/* ── Everything else ────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BigButton className="w-full" onClick={() => go("roster")}>
          <Users className="size-5" />
          Roster
        </BigButton>
        <BigButton className="w-full" onClick={() => go("progress")}>
          <TrendingUp className="size-5" />
          Progress
        </BigButton>
        {state.raffleEnabled && (
          <BigButton className="w-full" onClick={() => go("raffle")}>
            <Gift className="size-5" />
            Raffle
          </BigButton>
        )}
        <BigButton className="w-full" onClick={() => go("settings")}>
          <SettingsIcon className="size-5" />
          Settings
        </BigButton>
      </div>

      {!state.raffleEnabled && (
        <Panel>
          <p className="text-sm mc-text-secondary">
            The raffle is switched off, so draw tools are hidden. Players are still earning:{" "}
            <span className="font-semibold mc-text">{tickets} tickets</span> have accrued from
            optional trainings in the current round.{" "}
            <button
              type="button"
              className="font-semibold text-blue-500 underline underline-offset-4"
              onClick={() => go("settings")}
            >
              Turn the raffle on in Settings
            </button>
          </p>
        </Panel>
      )}
    </div>
  );
}
