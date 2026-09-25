import { useState } from "react";
import { Check, Users } from "lucide-react";
import { BigButton, Note, Panel, Pill, SectionTitle } from "../components/ui";
import { resolveExpectedPlayerIds, usePrototypeStore } from "../store";
import type { ScreenId } from "../PrototypeApp";

/**
 * D10: "Who's expected?" — shown only after Start Practice, before the
 * session exists. Nothing is dispatched until "Take attendance" is
 * pressed, so Cancel (or navigating away) can never create an orphan
 * session or overwrite one already in progress (spec §4 Home).
 */
export default function ExpectedScreen({ go }: { go: (s: ScreenId) => void }) {
  const { state, actions } = usePrototypeStore();
  const activeTeams = state.subTeams.filter((t) => t.active);
  const showDefaultOnly = activeTeams.length === 0;

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [allKaizen, setAllKaizen] = useState(false);

  const effectiveAllKaizen = showDefaultOnly || allKaizen;
  const effectiveTeamIds = showDefaultOnly ? [] : selectedTeamIds;
  const expectedPreview = resolveExpectedPlayerIds(state, effectiveTeamIds, effectiveAllKaizen);
  const canConfirm = showDefaultOnly || allKaizen || selectedTeamIds.length > 0;

  function toggleTeam(id: string) {
    setAllKaizen(false);
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function chooseAllKaizen() {
    setAllKaizen(true);
    setSelectedTeamIds([]);
  }

  function confirm() {
    if (!canConfirm) return;
    actions.startPractice(effectiveTeamIds, effectiveAllKaizen);
    go("attendance");
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle
          eyebrow="Start Practice"
          title="Who's expected?"
          hint="Attendance and streaks for this practice will only ever count players named here. Later roster or membership changes cannot rewrite it once saved."
        />

        {showDefaultOnly ? (
          <div
            className="flex items-center gap-4 rounded-2xl border mc-border p-5"
            style={{ backgroundColor: "var(--mc-surface)" }}
          >
            <div className="size-12 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-300 shrink-0">
              <Users className="size-6" />
            </div>
            <div>
              <div className="font-semibold mc-text">Kaizen</div>
              <p className="text-sm mc-text-secondary">
                No custom sub-teams are set up, so this practice is for the whole roster —{" "}
                {expectedPreview.length} player{expectedPreview.length === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activeTeams.map((t) => {
                const count = resolveExpectedPlayerIds(state, [t.id], false).length;
                const selected = !allKaizen && selectedTeamIds.includes(t.id);
                return (
                  <TeamCard
                    key={t.id}
                    selected={selected}
                    onClick={() => toggleTeam(t.id)}
                    title={t.name}
                    subtitle={`${count} player${count === 1 ? "" : "s"}`}
                  />
                );
              })}
            </div>

            <TeamCard
              wide
              selected={allKaizen}
              onClick={chooseAllKaizen}
              title="All Kaizen"
              subtitle={`Whole program · ${resolveExpectedPlayerIds(state, [], true).length} players`}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Pill tone={canConfirm ? "accent" : "neutral"}>
            {canConfirm
              ? `${expectedPreview.length} player${expectedPreview.length === 1 ? "" : "s"} expected`
              : "Choose a team or All Kaizen"}
          </Pill>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <BigButton variant="quiet" className="w-full" onClick={() => go("home")}>
            Cancel
          </BigButton>
          <BigButton variant="primary" className="w-full" disabled={!canConfirm} onClick={confirm}>
            Take attendance
          </BigButton>
        </div>

        <Note>
          Select one or several teams; a player on more than one selected team is only expected once.
          Marking someone present or absent during attendance is separate from this list — excused
          absences, correcting an already-saved list and unexpected-attendance streak treatment are
          not decided yet (D10 leaves them as recommendations, not settled policy).
        </Note>
      </Panel>
    </div>
  );
}

function TeamCard({
  selected,
  onClick,
  title,
  subtitle,
  wide,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative flex items-center gap-3 min-h-16 p-4 rounded-2xl border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        wide ? "w-full" : ""
      } ${
        selected
          ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300"
          : "mc-card mc-border mc-text-secondary mc-card-hover"
      }`}
    >
      <div
        className={`size-8 rounded-full flex items-center justify-center shrink-0 border ${
          selected ? "bg-blue-500 border-blue-500 text-white" : "mc-border"
        }`}
      >
        {selected && <Check className="size-4" />}
      </div>
      <div className="min-w-0">
        <div className="font-semibold mc-text truncate">{title}</div>
        <div className="text-xs mc-text-muted">{subtitle}</div>
      </div>
    </button>
  );
}
