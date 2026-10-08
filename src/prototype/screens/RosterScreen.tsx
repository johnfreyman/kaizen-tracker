import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, UserCircle, UserMinus } from "lucide-react";
import { BigButton, EmptyState, Note, Panel, Pill, SectionTitle } from "../components/ui";
import { DEFAULT_GROUP_NAME } from "../fixtures";
import {
  collidingPlayerIds,
  displayName,
  playerTotals,
  subTeamName,
  usePrototypeStore,
  wouldCollide,
} from "../store";
import type { Player, SubTeam } from "../types";

export default function RosterScreen() {
  const { state, actions } = usePrototypeStore();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const activeTeams = state.subTeams.filter((t) => t.active);
  const hasSubTeams = activeTeams.length > 0;
  const colliding = useMemo(() => collidingPlayerIds(state.players), [state.players]);

  const roster = state.players.filter((p) => !p.retired);
  const visible =
    filter === "all"
      ? roster
      : roster.filter((p) => (filter === "none" ? p.subTeamIds.length === 0 : p.subTeamIds.includes(filter)));

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle
            eyebrow="Roster"
            title={`${roster.length} player${roster.length === 1 ? "" : "s"}`}
            hint={
              hasSubTeams
                ? "Players can belong to several sub-teams at once. Sort and filter are presentation only."
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
            {roster.some((p) => p.subTeamIds.length === 0) && (
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
        <Note>
          A player can belong to several sub-teams at once (D07); the jersey number stays one per
          player across every team they are on (D08). A card shows every current membership.
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

  /*
   * F02: edits are a draft with explicit Save/Cancel, held to the same
   * trimmed-name/card-distinction validation as Add, instead of writing
   * every keystroke straight to the store. Re-sync the draft whenever this
   * row (re)enters edit mode, so a stale draft from a prior open never
   * leaks in.
   */
  const [draft, setDraft] = useState<Player>(player);
  useEffect(() => {
    if (editing) setDraft(player);
  }, [editing, player]);

  const trimmedFirst = draft.firstName.trim();
  const trimmedLabel = draft.label?.trim() || undefined;
  const candidateName = displayName({ ...draft, firstName: trimmedFirst, label: trimmedLabel });
  const emptyName = trimmedFirst === "";
  const clash = !emptyName && wouldCollide(state, candidateName, player.id);
  const canSave = !emptyName && !clash;

  const cancelEdit = () => {
    setDraft(player);
    setConfirmRetire(false);
    onToggleEdit();
  };

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
            {player.subTeamIds.length === 0 ? (
              <Pill>{DEFAULT_GROUP_NAME}</Pill>
            ) : (
              player.subTeamIds.map((id) => <Pill key={id}>{subTeamName(state, id)}</Pill>)
            )}
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
        <BigButton variant="quiet" onClick={editing ? cancelEdit : onToggleEdit}>
          {editing ? "Cancel" : "Edit"}
        </BigButton>
      </div>

      {editing && (
        <div className="mt-4 border-t mc-border pt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name">
              <input
                className={inputCls}
                value={draft.firstName}
                onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
              />
            </Field>
            <Field label="Distinguishing label" hint="Only if two cards look the same">
              <input
                className={inputCls}
                placeholder="M."
                value={draft.label ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </Field>
            <Field label="Jersey number" hint="0 and 00 are different people">
              <input
                className={inputCls}
                inputMode="numeric"
                maxLength={3}
                placeholder="Not set"
                value={draft.number ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                  setDraft((d) => ({ ...d, number: v === "" ? null : v }));
                }}
              />
            </Field>
          </div>

          {activeTeams.length > 0 && (
            <SubTeamCheckboxes
              activeTeams={activeTeams}
              selected={draft.subTeamIds}
              onChange={(subTeamIds) => setDraft((d) => ({ ...d, subTeamIds }))}
              hint="Moving a player keeps their hours, tickets and history. Removing one membership never removes the others."
            />
          )}

          {emptyName && (
            <p className="text-sm font-medium text-red-500">First name cannot be empty.</p>
          )}
          {!emptyName && clash && (
            <p className="text-sm font-medium text-red-500">
              A card already reads “{candidateName}”. Add or change a label so the two can be told
              apart.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <BigButton variant="quiet" onClick={cancelEdit}>
              Cancel
            </BigButton>
            <BigButton
              variant="primary"
              disabled={!canSave}
              onClick={() => {
                actions.updatePlayer(player.id, {
                  firstName: trimmedFirst,
                  label: trimmedLabel,
                  number: draft.number,
                  subTeamIds: draft.subTeamIds,
                  guest: draft.guest,
                });
                onToggleEdit();
              }}
            >
              Save
            </BigButton>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t mc-border pt-4">
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
                    onToggleEdit();
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

/** Shared by Add and Edit so both hold to the exact same membership control. */
function SubTeamCheckboxes({
  activeTeams,
  selected,
  onChange,
  hint,
}: {
  activeTeams: SubTeam[];
  selected: string[];
  onChange: (ids: string[]) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-semibold mc-text">
        Sub-teams <span className="font-normal text-xs mc-text-muted">— select every team this player is on</span>
      </legend>
      {hint && <p className="mt-0.5 text-xs mc-text-muted">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap gap-2">
        {activeTeams.map((t) => {
          const checked = selected.includes(t.id);
          return (
            <label
              key={t.id}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium cursor-pointer transition-colors ${
                checked
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300"
                  : "mc-card mc-border mc-text-secondary"
              }`}
            >
              <input
                type="checkbox"
                className="size-4"
                checked={checked}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, t.id] : selected.filter((id) => id !== t.id))
                }
              />
              {t.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AddPlayerForm({ onDone }: { onDone: () => void }) {
  const { state, actions } = usePrototypeStore();
  const activeTeams = state.subTeams.filter((t) => t.active);
  const [firstName, setFirstName] = useState("");
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [subTeamIds, setSubTeamIds] = useState<string[]>([]);
  const [guest, setGuest] = useState(false);

  const candidate: Player = {
    id: "candidate",
    firstName: firstName.trim(),
    label: label.trim() || undefined,
    number: number === "" ? null : number,
    subTeamIds,
    guest,
    retired: false,
  };
  const clash = firstName.trim() !== "" && wouldCollide(state, displayName(candidate));

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

      {/* R14: the sub-team question only appears when sub-teams exist. A
          player can check as many as apply at once (D07). */}
      {activeTeams.length > 0 && (
        <div className="mt-4">
          <SubTeamCheckboxes activeTeams={activeTeams} selected={subTeamIds} onChange={setSubTeamIds} />
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
