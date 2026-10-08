import { useState } from "react";
import { KeyRound, Plus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { BigButton, Note, Panel, Pill, SectionTitle } from "../components/ui";
import { currentRoundTickets, usePrototypeStore } from "../store";

export default function SettingsScreen() {
  const { state, actions } = usePrototypeStore();
  const [newTeam, setNewTeam] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeTeams = state.subTeams.filter((t) => t.active);
  const tickets = currentRoundTickets(state).length;
  // A player on several teams is correctly counted once per team they are
  // actually on (D07) — that is a roster-size count, not a credit total.
  const playersOnTeam = (id: string) =>
    state.players.filter((p) => !p.retired && p.subTeamIds.includes(id)).length;

  return (
    <div className="space-y-5">
      {/* ── Sub-teams ──────────────────────────────────────────── */}
      <Panel>
        <SectionTitle
          eyebrow="Settings"
          title="Sub-teams"
          hint="Optional groups inside one coach's program. They do not create separate logins or permissions."
        />

        {activeTeams.length === 0 ? (
          <p className="text-sm mc-text-secondary">
            No sub-teams yet. Everyone is grouped as <strong className="mc-text">Kaizen</strong> and
            adding a player asks no extra question.
          </p>
        ) : (
          <div className="space-y-2.5">
            {activeTeams.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border mc-border p-3">
                <input
                  aria-label={`Sub-team name for ${t.name}`}
                  className="flex-1 min-w-[12rem] min-h-11 rounded-lg border mc-border bg-transparent px-3 mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={t.name}
                  onChange={(e) => actions.renameSubTeam(t.id, e.target.value)}
                />
                <Pill>
                  <Users className="size-3" />
                  {playersOnTeam(t.id)}
                </Pill>
                <BigButton variant="quiet" onClick={() => actions.retireSubTeam(t.id)}>
                  Retire
                </BigButton>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            aria-label="New sub-team name"
            placeholder="Kaizen Blue 8th Grade"
            className="flex-1 min-w-[14rem] min-h-14 rounded-xl border mc-border bg-transparent px-4 mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
          />
          <BigButton
            variant="primary"
            disabled={!newTeam.trim()}
            onClick={() => {
              actions.addSubTeam(newTeam.trim());
              setNewTeam("");
            }}
          >
            <Plus className="size-5" />
            Add sub-team
          </BigButton>
        </div>

        <Note>
          Retiring a sub-team removes it from future choices and never deletes its players or
          rewrites who they played for historically.
        </Note>
      </Panel>

      {/* ── Kiosk exit code ────────────────────────────────────── */}
      <Panel>
        <SectionTitle
          eyebrow="Kiosk"
          title="Exit code"
          hint="A supervised convenience for getting back to the coach screen. It is not a password."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={state.exitCode.mode === "pin" ? "accent" : "neutral"}>
            <KeyRound className="size-3" />
            {state.exitCode.mode === "pin" ? "Team PIN set" : "Default code 0000"}
          </Pill>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            aria-label="New four digit PIN"
            inputMode="numeric"
            maxLength={4}
            placeholder="4 digits"
            className="min-h-14 w-40 rounded-xl border mc-border bg-transparent px-4 text-xl mc-mono tracking-widest mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            value={pinDraft}
            onChange={(e) => {
              setPinDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
              setPinError("");
            }}
          />
          <BigButton
            variant="primary"
            onClick={() => {
              if (pinDraft.length !== 4) {
                setPinError("Use exactly four digits, so it can never be a jersey number.");
                return;
              }
              actions.setExitPin(pinDraft);
              setPinDraft("");
            }}
          >
            Set PIN
          </BigButton>
          {state.exitCode.mode === "pin" && (
            <BigButton variant="quiet" onClick={actions.resetExitCode}>
              Reset to 0000
            </BigButton>
          )}
        </div>
        {pinError && <p className="mt-2 text-sm text-red-500 font-medium">{pinError}</p>}

        <Note>
          Recommended replacement policy: once a PIN is set, <strong>0000 stops working</strong>{" "}
          rather than staying as a bypass. Length, recovery and storage are recommendations for
          review, not extra owner decisions.
        </Note>
      </Panel>

      {/* ── Raffle ─────────────────────────────────────────────── */}
      <Panel>
        <SectionTitle
          eyebrow="Raffle"
          title={state.raffleEnabled ? "Raffle is on" : "Raffle is off"}
          hint="Switching the raffle off only hides the draw tools. Players keep earning tickets."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={state.raffleEnabled ? "ok" : "neutral"}>
            {state.raffleEnabled ? "Draw tools visible" : "Draw tools hidden"}
          </Pill>
          <Pill tone="accent">{tickets} tickets accrued this round</Pill>
        </div>

        <div className="mt-4">
          {state.raffleEnabled ? (
            <BigButton onClick={() => actions.setRaffle(false)}>Turn raffle off</BigButton>
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              {/* DialogTrigger (not a plain onClick) is what lets Radix return
                  focus here on close — without it, Escape/close drops focus
                  to <body> instead of back onto this button. */}
              <DialogTrigger asChild>
                <BigButton variant="primary">Turn raffle on</BigButton>
              </DialogTrigger>
              <ActivationDialogContent onDone={() => setDialogOpen(false)} />
            </Dialog>
          )}
        </div>

        {state.raffleEnabled && (
          <Note>
            Turning the raffle off does not close the round. Nothing re-prompts on reload, and no
            round boundary happens without an explicit Start fresh.
          </Note>
        )}
      </Panel>
    </div>
  );
}

/**
 * OFF -> ON activation content. The count is read at render time, so a
 * stale dialog shows the current number rather than silently resetting a
 * newer round.
 *
 * Built on the app's existing Radix dialog primitives rather than a raw
 * `role="dialog"` div: focus trapping, Escape dismissal and focus return to
 * the trigger all come from there instead of being reimplemented by hand —
 * which requires the opening button to be a real `DialogTrigger`, not just
 * a button that calls `setOpen(true)` next to an independent `Dialog`.
 */
function ActivationDialogContent({ onDone }: { onDone: () => void }) {
  const { state, actions } = usePrototypeStore();
  const n = currentRoundTickets(state).length;

  return (
    <DialogContent className="max-w-lg mc-border" style={{ backgroundColor: "var(--mc-surface)" }}>
      <DialogHeader>
        <DialogTitle className="mc-text">Use existing raffle tickets?</DialogTitle>
        <DialogDescription className="mc-text-secondary">
          {n === 0
            ? "Your players have not earned any tickets from optional trainings yet."
            : `Your players have earned ${n} ticket${n === 1 ? "" : "s"} from optional trainings.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <BigButton
          variant="primary"
          className="w-full"
          onClick={() => {
            actions.setRaffle(true);
            onDone();
          }}
        >
          {n === 0 ? "Start with zero tickets" : `Keep ${n} ticket${n === 1 ? "" : "s"}`}
        </BigButton>

        <div className="rounded-xl border mc-border p-4">
          <BigButton
            className="w-full"
            onClick={() => {
              actions.startFreshRound();
              onDone();
            }}
          >
            Start fresh
          </BigButton>
          <p className="mt-2.5 text-xs mc-text-secondary">
            Begin a new raffle round with zero eligible tickets. Attendance, credited hours and
            previous raffle results stay unchanged.
          </p>
        </div>

        <BigButton variant="quiet" className="w-full" onClick={onDone}>
          Cancel
        </BigButton>
      </div>

      <Note>
        The real enable-and-choose-round step must be one atomic server operation, and Start fresh
        must require an online, fully synchronized state with no active session (P03). The
        prototype shows the copy and the choice, not that guarantee.
      </Note>
    </DialogContent>
  );
}
