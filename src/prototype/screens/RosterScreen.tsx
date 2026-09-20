import { useMemo, useState } from "react";
import { AlertTriangle, Plus, UserCircle, UserMinus } from "lucide-react";
import { BigButton, EmptyState, Note, Panel, Pill, SectionTitle } from "../components/ui";
import {
  collidingPlayerIds,
  displayName,
  playerTotals,
  subTeamName,
  usePrototypeStore,
} from "../store";
import type { Player } from "../types";

export default function RosterScreen() {
  const { state, actions } = usePrototypeStore();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const activeTeams = state.subTeams.filter((t) => t.active);
  const hasSubTeams = activeTeams.length > 0;
  const colliding = useMemo(() => collidingPlayerIds(state.players), [state.players]);

  const roster = state.players.filter((p) => !p.retired);
  const visible = filter === "all" ? roster : roster.filter((p) => (p.subTeamId ?? "none") === filter);

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle
            eyebrow="Roster"
            title={`${roster.length} player${roster.length === 1 ? "" : "s"}`}
            hint={
              hasSubTeams
                ? "Players belong to one sub-team. Sort and filter are presentation only."
                : "No custom sub-teams, so everyone is simply Kaizen."
            }
          />
          <BigButton variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-5" />
            Add player
          </BigButton>
        </div>

        {colliding.size > 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {colliding.size} cards would look identical. Add a last initial or a short label so
              the coach and the kiosk can tell them apart.
            </p>
          </div>
        )}

        {hasSubTeams && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              All teams
            </Chip>
            {activeTeams.map((t) => (
              <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>
                {t.name}
              </Chip>
            ))}
            {roster.some((p) => p.subTeamId === null) && (
              <Chip active={filter === "none"} onClick={() => setFilter("none")}>
                Kaizen (no sub-team)
              </Chip>
            )}
          </div>
        )}
      </Panel>

      {adding && <AddPlayerForm onDone={() => setAdding(false)} />}

      {roster.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          body="Add the first player to start taking attendance. Nothing is invented for you — names and numbers come from the coach."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              needsLabel={colliding.has(p.id)}
              editing={editing === p.id}
              onToggleEdit={() => setEditing(editing === p.id ? null : p.id)}
            />
          ))}
        </div>
      )}

      {hasSubTeams && (
        <Note tone="assumption">
          Each player holds <strong>one</strong> sub-team. The owner's question — can a player
          belong to several at once? — is still open, so P12's single membership is prototyped and
          labelled rather than assumed settled. Stage 3 cannot fix cardinality until it is answered.
        </Note>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  needsLabel,
  editing,
  onToggleEdit,
}: {
  player: Player;
  needsLabel: boolean;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  const { state, actions } = usePrototypeStore();
  const totals = playerTotals(state, player.id);
  const activeTeams = state.subTeams.filter((t) => t.active);
  const [confirmRetire, setConfirmRetire] = useState(false);

  return (
    <Panel className="p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="size-14 rounded-full bg-white/[0.06] flex items-center justify-center text-xl font-bold mc-mono mc-text shrink-0">
          {player.number ?? "—"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold mc-text">
            {player.label ? `${player.firstName} ${player.label}` : player.firstName}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Pill>{subTeamName(state, player.subTeamId)}</Pill>
            {player.guest && (
              <Pill tone="accent">
                <UserCircle className="size-3" />
                Guest
              </Pill>
            )}
            {player.number === null && !player.guest && <Pill tone="warn">Add number</Pill>}
            {needsLabel && <Pill tone="warn">Needs a label</Pill>}
            <Pill>{totals.creditedHours} credited hours</Pill>
            <Pill>{totals.tickets} tickets</Pill>
          </div>
          {player.legacyName && player.legacyName !== displayName(player) && (
            <p className="mt-1.5 text-xs mc-text-muted">Carried over as “{player.legacyName}”</p>
          )}
        </div>
        <BigButton variant="quiet" onClick={onToggleEdit}>
          {editing ? "Done" : "Edit"}
        </BigButton>
      </div>

      {editing && (
        <div className="mt-4 border-t mc-border pt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name">
              <input
                className={inputCls}
                value={player.firstName}
                onChange={(e) => actions.updatePlayer(player.id, { firstName: e.target.value })}
              />
            </Field>
            <Field label="Distinguishing label" hint="Only if two cards look the same">
              <input
                className={inputCls}
                placeholder="M."
                value={player.label ?? ""}
                onChange={(e) =>
                  actions.updatePlayer(player.id, { label: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Jersey number" hint="0 and 00 are different people">
              <input
                className={inputCls}
                inputMode="numeric"
                maxLength={3}
                placeholder="Not set"
                value={player.number ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                  actions.updatePlayer(player.id, { number: v === "" ? null : v });
                }}
              />
            </Field>
          </div>

          {activeTeams.length > 0 && (
            <Field label="Sub-team" hint="Moving a player keeps their hours, tickets and history">
              <select
                className={inputCls}
                value={player.subTeamId ?? "none"}
                onChange={(e) =>
                  actions.updatePlayer(player.id, {
                    subTeamId: e.target.value === "none" ? null : e.target.value,
                  })
                }
              >
                <option value="none">Kaizen (no sub-team)</option>
                {activeTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {confirmRetire ? (
              <>
                <p className="text-sm mc-text-secondary flex-1 min-w-[16rem]">
                  Retire {player.firstName}? Their attendance, credited hours and existing tickets
                  are kept. They stop appearing on new session cards.
                </p>
                <BigButton variant="quiet" onClick={() => setConfirmRetire(false)}>
                  Cancel
                </BigButton>
                <BigButton
                  variant="danger"
                  onClick={() => {
                    actions.updatePlayer(player.id, { retired: true });
                    setConfirmRetire(false);
                  }}
                >
                  Retire player
                </BigButton>
              </>
            ) : (
              <BigButton variant="quiet" onClick={() => setConfirmRetire(true)}>
                <UserMinus className="size-4" />
                Retire from roster
              </BigButton>
            )}
          </div>
          <Note>
            P07 replaces the current destructive removal, which scrubs the name from live and
            archived attendance. Retirement is shown here; confirm before Stage 3.
          </Note>
        </div>
      )}
    </Panel>
  );
}

function AddPlayerForm({ onDone }: { onDone: () => void }) {
  const { state, actions } = usePrototypeStore();
  const activeTeams = state.subTeams.filter((t) => t.active);
  const [firstName, setFirstName] = useState("");
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [subTeamId, setSubTeamId] = useState<string>(activeTeams[0]?.id ?? "none");
  const [guest, setGuest] = useState(false);

  const candidate: Player = {
    id: "candidate",
    firstName: firstName.trim(),
    label: label.trim() || undefined,
    number: number === "" ? null : number,
    subTeamId: subTeamId === "none" ? null : subTeamId,
    guest,
    retired: false,
  };
  const clash =
    firstName.trim() !== "" &&
    state.players.some(
      (p) => !p.retired && displayName(p).toLowerCase() === displayName(candidate).toLowerCase(),
    );

  return (
    <Panel>
      <SectionTitle title="Add a player" hint="First name and jersey number. No last name required." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First name">
          <input className={inputCls} autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Distinguishing label" hint="Optional">
          <input className={inputCls} placeholder="M." value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Jersey number" hint="Leave blank to add later">
          <input
            className={inputCls}
            inputMode="numeric"
            maxLength={3}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          />
        </Field>
      </div>

      {/* R14: the sub-team question only appears when sub-teams exist. */}
      {activeTeams.length > 0 && (
        <div className="mt-4">
          <Field label="Sub-team">
            <select className={inputCls} value={subTeamId} onChange={(e) => setSubTeamId(e.target.value)}>
              <option value="none">Kaizen (no sub-team)</option>
              {activeTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <label className="mt-4 flex items-center gap-3 text-sm font-medium mc-text">
        <input
          type="checkbox"
          className="size-5"
          checked={guest}
          onChange={(e) => setGuest(e.target.checked)}
        />
        Guest player
      </label>

      {clash && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          A card already reads “{displayName(candidate)}”. Add a last initial or a short label so
          the two can be told apart.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <BigButton variant="quiet" onClick={onDone}>
          Cancel
        </BigButton>
        <BigButton
          variant="primary"
          disabled={!firstName.trim() || clash}
          onClick={() => {
            actions.addPlayer({ ...candidate, id: `pl-${Date.now().toString(36)}` });
            onDone();
          }}
        >
          Add to roster
        </BigButton>
      </div>
    </Panel>
  );
}

const inputCls =
  "w-full min-h-12 rounded-xl border mc-border bg-transparent px-3 mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mc-text">{label}</span>
      {hint && <span className="block text-xs mc-text-muted mb-1.5">{hint}</span>}
      <span className={hint ? "" : "block mt-1.5"}>{children}</span>
    </label>
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
