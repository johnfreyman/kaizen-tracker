import { useEffect, useState } from "react";
import { AlertTriangle, Check, Delete, Search, Undo2 } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { Panel } from "../components/ui";
import { displayName, matchByNumber, subTeamLabel, usePrototypeStore } from "../store";
import type { Player } from "../types";

type Phase =
  | { k: "pad" }
  | { k: "matches"; entry: string; players: Player[] }
  | { k: "none"; entry: string }
  | { k: "confirmed"; player: Player; undone: boolean };

/**
 * Kiosk is a supervised shared-device surface, not player authentication.
 * It deliberately exposes no roster editing, no settings and no email address.
 * A local-save failure is surfaced here too (R02): kiosk renders outside
 * PrototypeApp's Shell, so the coach-facing failure banner there never
 * reaches this screen on its own, and a missed check-in is a missed credit.
 */
export default function KioskScreen({ onExit }: { onExit: () => void }) {
  const { state, actions } = usePrototypeStore();
  const session = state.activeSession;

  const [entry, setEntry] = useState("");
  const [phase, setPhase] = useState<Phase>({ k: "pad" });
  const [writing, setWriting] = useState(false);

  /* Confirmation clears itself and returns to the pad. */
  useEffect(() => {
    if (phase.k !== "confirmed") return;
    const t = setTimeout(() => {
      setPhase({ k: "pad" });
      setEntry("");
    }, 2600);
    return () => clearTimeout(t);
  }, [phase]);

  const exitTarget = state.exitCode.mode === "pin" ? state.exitCode.pin : "0000";

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--mc-bg)" }}>
        <Panel className="max-w-md text-center">
          <h1 className="text-2xl font-bold mc-text">Session finished — ask your coach</h1>
          <p className="mt-2 text-sm mc-text-secondary">
            This device is no longer checking anyone in. It does not fall back to the coach
            dashboard.
          </p>
        </Panel>
      </div>
    );
  }

  /*
   * F04: a session finished elsewhere still needs a way back for the coach.
   * Check-in stays fully disabled (the reducer already rejects setPresent
   * once closedElsewhere is true), but the exit code still works, so the
   * coach is never stranded on a dead screen. Entering the code hands off to
   * the same onExit the number pad uses, which lands on AttendanceScreen's
   * existing "finished on another device" reconciliation panel.
   */
  if (session.closedElsewhere) {
    return <ClosedKiosk exitTarget={exitTarget} onExit={onExit} />;
  }

  const press = (d: string) => {
    if (entry.length >= 4) return;
    setEntry(entry + d);
    if (phase.k !== "pad") setPhase({ k: "pad" });
  };

  /* Nothing happens until Find player is pressed: no auto-submit on a valid
     prefix, so "1" never fires while the player is still typing "12". */
  const submit = () => {
    if (!entry || writing) return;

    if (entry === exitTarget) {
      setEntry("");
      onExit();
      return;
    }

    const found = matchByNumber(state.players, entry);
    setPhase(found.length ? { k: "matches", entry, players: found } : { k: "none", entry });
  };

  const checkIn = (p: Player) => {
    if (writing) return;
    setWriting(true);
    actions.setPresent(p.id, true);
    setPhase({ k: "confirmed", player: p, undone: false });
    setWriting(false);
  };

  const undo = (p: Player) => {
    if (writing) return;
    setWriting(true);
    actions.setPresent(p.id, false);
    setPhase({ k: "confirmed", player: p, undone: true });
    setWriting(false);
  };

  /*
   * R02: kiosk renders standalone, outside PrototypeApp's Shell, so the
   * coach-facing persistence-failure banner never reaches this screen on
   * its own. A save failure here matters just as much — a missed check-in
   * is a missed credit — so it needs its own visible, qualified signal
   * instead of a checkmark that claims more than is actually true. This is
   * a best-effort read of the last known save attempt, not a guarantee
   * about this exact tap (spec §5's real outbox/ack model is Stage 4 work).
   */
  const saveFailed = state.localPersistenceFailed;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--mc-bg)" }}>
      {/* Minimal session context only. */}
      <header className="border-b mc-border px-5 py-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest mc-text-secondary">
          {session.type === "practice" ? "Practice" : "Optional Training"} · {formatDate(session.date)}
        </p>
        <h1 className="mt-1 text-xl font-bold mc-text">Check in</h1>
      </header>

      {/*
       * Dev-only, not a product surface (same framing as PrototypeApp's
       * walkthrough banner). The normal walkthrough controls are hidden
       * while kiosk owns the screen, so F04's "closed while kiosk is
       * active" scenario needs its own reachable trigger here.
       */}
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-center">
        <button
          type="button"
          onClick={actions.closeElsewhere}
          className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Dev: finish this session on another device
        </button>
      </div>

      {/* Plain text only: no settings/roster link, so this never becomes a
          second way out of kiosk beyond the exit code. */}
      {saveFailed && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-center" role="alert">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">
            This device isn't saving check-ins right now. Tell your coach.
          </p>
        </div>
      )}

      <main className="flex-1 w-full max-w-xl mx-auto p-5 space-y-5">
        {phase.k === "confirmed" ? (
          <Panel
            className={
              saveFailed
                ? "border-red-500/40 text-center"
                : phase.undone
                  ? "border-amber-500/40 text-center"
                  : "border-emerald-500/40 text-center"
            }
          >
            <div
              className={`mx-auto size-16 rounded-full flex items-center justify-center ${
                saveFailed ? "bg-red-500/15" : phase.undone ? "bg-amber-500/15" : "bg-emerald-500/15"
              }`}
            >
              {saveFailed ? (
                <AlertTriangle className="size-8 text-red-500" />
              ) : phase.undone ? (
                <Undo2 className="size-8 text-amber-500" />
              ) : (
                <Check className="size-8 text-emerald-500" />
              )}
            </div>
            <h2 className="mt-4 text-2xl font-bold mc-text">
              {saveFailed
                ? phase.undone
                  ? "Undo recorded — not saved yet"
                  : "Checked in — not saved yet"
                : phase.undone
                  ? "Check-in undone"
                  : "You're checked in"}
            </h2>
            <p className="mt-1 text-lg mc-text-secondary">{displayName(phase.player)}</p>
            {saveFailed && (
              <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
                This device isn't saving locally right now. Tell your coach.
              </p>
            )}
            <p className="mt-3 text-sm mc-text-muted">Returning to the number pad…</p>
          </Panel>
        ) : (
          <>
            {/* ── Entry display ───────────────────────────────── */}
            <div
              className="rounded-2xl border mc-border p-6 text-center"
              style={{ backgroundColor: "var(--mc-surface)" }}
            >
              <label htmlFor="kiosk-entry" className="text-sm font-semibold mc-text-secondary">
                Enter your jersey number
              </label>
              <output
                id="kiosk-entry"
                aria-live="polite"
                className="mt-2 block text-5xl font-bold mc-mono mc-text tracking-widest min-h-[3.5rem]"
              >
                {entry || "—"}
              </output>
            </div>

            {/* ── Matches / no match ──────────────────────────── */}
            {phase.k === "none" && (
              <Panel className="border-amber-500/30 text-center">
                <p className="font-semibold mc-text">
                  No player found for #{phase.entry} — try again or ask your coach
                </p>
              </Panel>
            )}

            {phase.k === "matches" && (
              <div className="space-y-3">
                <p className="text-sm mc-text-secondary text-center">
                  {phase.players.length === 1
                    ? "Tap your card to check in."
                    : `${phase.players.length} players wear #${phase.entry}. Tap your card.`}
                </p>
                {/* A single match still requires a tap. */}
                {phase.players.map((p) => {
                  const isPresent = !!session.present[p.id];
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border p-4 flex items-center gap-4 ${
                        isPresent
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "mc-card mc-border"
                      }`}
                    >
                      <div className="size-14 rounded-full bg-white/[0.06] flex items-center justify-center text-xl font-bold mc-mono mc-text shrink-0">
                        {p.number}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="font-bold mc-text truncate">
                          {p.label ? `${p.firstName} ${p.label}` : p.firstName}
                        </div>
                        <div className="text-xs mc-text-secondary truncate">
                          {subTeamLabel(state, p.subTeamIds)}
                        </div>
                        {isPresent && (
                          <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3.5" />
                            Checked in
                          </div>
                        )}
                      </div>
                      {isPresent ? (
                        <button
                          type="button"
                          disabled={writing}
                          onClick={() => undo(p)}
                          className="min-h-14 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 font-semibold text-amber-700 dark:text-amber-300 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Undo2 className="size-4 inline mr-1.5" />
                          Undo check-in
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={writing}
                          onClick={() => checkIn(p)}
                          className="min-h-14 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 font-semibold text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          That's me
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Number pad ──────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <PadKey key={d} onClick={() => press(d)}>
                  {d}
                </PadKey>
              ))}
              <PadKey
                onClick={() => {
                  setEntry("");
                  setPhase({ k: "pad" });
                }}
                aria-label="Clear"
                muted
              >
                Clear
              </PadKey>
              <PadKey onClick={() => press("0")}>0</PadKey>
              <PadKey
                onClick={() => {
                  setEntry(entry.slice(0, -1));
                  setPhase({ k: "pad" });
                }}
                aria-label="Backspace"
                muted
              >
                <Delete className="size-6" />
              </PadKey>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!entry || writing}
              className="w-full min-h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Search className="size-5 inline mr-2" />
              Find player
            </button>

            <p className="text-center text-xs mc-text-muted">
              Coaches: enter the {state.exitCode.mode === "pin" ? "team PIN" : "exit code"} and press
              Find player to return.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

/**
 * F04: the session was finished elsewhere while this device stayed in
 * kiosk. Check-in is gone entirely — there is no player lookup here, only
 * the exit code — so a player at this screen cannot do anything with it.
 * A correct code still hands off to onExit, the coach's way back.
 */
function ClosedKiosk({ exitTarget, onExit }: { exitTarget: string; onExit: () => void }) {
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);

  const press = (d: string) => {
    if (entry.length >= 4) return;
    setEntry(entry + d);
    setWrong(false);
  };

  const submit = () => {
    if (!entry) return;
    if (entry === exitTarget) {
      setEntry("");
      onExit();
      return;
    }
    setWrong(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--mc-bg)" }}>
      <Panel className="max-w-md w-full text-center space-y-5">
        <div>
          <h1 className="text-2xl font-bold mc-text">Session finished — ask your coach</h1>
          <p className="mt-2 text-sm mc-text-secondary">
            This device is no longer checking anyone in. A coach can enter the exit code below to
            leave this screen and reconcile the session — it does not reveal the coach dashboard.
          </p>
        </div>

        <output aria-live="polite" className="block text-4xl font-bold mc-mono mc-text tracking-widest min-h-[3rem]">
          {entry || "—"}
        </output>

        {wrong && (
          <p role="alert" className="text-sm font-semibold text-red-500">
            That code did not match. Try again.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PadKey key={d} onClick={() => press(d)}>
              {d}
            </PadKey>
          ))}
          <PadKey onClick={() => { setEntry(""); setWrong(false); }} aria-label="Clear" muted>
            Clear
          </PadKey>
          <PadKey onClick={() => press("0")}>0</PadKey>
          <PadKey
            onClick={() => { setEntry(entry.slice(0, -1)); setWrong(false); }}
            aria-label="Backspace"
            muted
          >
            <Delete className="size-6" />
          </PadKey>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!entry}
          className="w-full min-h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Coach exit
        </button>
      </Panel>
    </div>
  );
}

function PadKey({
  children,
  onClick,
  muted,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-20 rounded-2xl border mc-border font-bold transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        muted ? "mc-card mc-text-secondary text-sm" : "mc-card mc-card-hover mc-text text-3xl mc-mono"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
