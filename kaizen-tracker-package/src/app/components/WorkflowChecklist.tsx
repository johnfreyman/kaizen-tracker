import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";

interface ChecklistItem {
  id: string;
  label: string;
  auto: boolean;          // true = system checks it; false = user checks it
  checked: boolean;
  action?: { label: string; onClick: () => void };
}

type Phase = "pre" | "active" | "post";

function getPhase(
  activeSession: { id: string } | null,
  events: { saved_at?: string; id: string }[],
  lastSavedSessionId: string | null
): Phase {
  if (activeSession) return "active";
  if (lastSavedSessionId) {
    const saved = events.find((e) => e.id === lastSavedSessionId);
    if (saved) return "post";
  }
  return "pre";
}

interface Props {
  onNavigate?: (page: string) => void;
}

export default function WorkflowChecklist({ onNavigate }: Props) {
  const { state } = useTeamStore();
  const [collapsed, setCollapsed] = useState(false);
  const [manualChecked, setManualChecked] = useState<Set<string>>(new Set());
  const [lastSavedSessionId, setLastSavedSessionId] = useState<string | null>(null);
  const [prevActiveSession, setPrevActiveSession] = useState(state.activeSession);

  // Detect when session transitions from active → null (session was saved)
  useEffect(() => {
    if (prevActiveSession && !state.activeSession) {
      setLastSavedSessionId(prevActiveSession.id);
      setManualChecked(new Set());
    }
    setPrevActiveSession(state.activeSession);
  }, [state.activeSession, prevActiveSession]);

  // Persist manual checks per session
  const storageKey = state.activeSession
    ? `mc-checklist-${state.activeSession.id}`
    : lastSavedSessionId
    ? `mc-checklist-post-${lastSavedSessionId}`
    : "mc-checklist-pre";

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setManualChecked(new Set(JSON.parse(raw)));
      } catch {
        /* ignore */
      }
    } else {
      setManualChecked(new Set());
    }
  }, [storageKey]);

  const toggleManual = (id: string) => {
    setManualChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  };

  const phase = getPhase(
    state.activeSession,
    state.events as { id: string }[],
    lastSavedSessionId
  );

  const items = useMemo<ChecklistItem[]>(() => {
    if (phase === "pre") {
      return [
        {
          id: "confirm-roster",
          label: "Confirm roster is up to date",
          auto: false,
          checked: manualChecked.has("confirm-roster"),
          action: onNavigate
            ? { label: "Settings →", onClick: () => onNavigate("settings") }
            : undefined,
        },
        {
          id: "start-session",
          label: "Start a session",
          auto: state.activeSession !== null,
          checked: state.activeSession !== null || manualChecked.has("start-session"),
          action: onNavigate
            ? { label: "Quick Start →", onClick: () => onNavigate("dashboard") }
            : undefined,
        },
      ];
    }

    if (phase === "active") {
      return [
        {
          id: "session-started",
          label: `Session started — ${state.activeSession!.type}`,
          auto: true,
          checked: true,
        },
        {
          id: "take-attendance",
          label: "Take attendance",
          auto: false,
          checked: manualChecked.has("take-attendance"),
          action: onNavigate
            ? { label: "Attendance →", onClick: () => onNavigate("attendance") }
            : undefined,
        },
        {
          id: "save-end",
          label: "Save & end session",
          auto: false,
          checked: manualChecked.has("save-end"),
          action: onNavigate
            ? { label: "Attendance →", onClick: () => onNavigate("attendance") }
            : undefined,
        },
      ];
    }

    // post
    const postItems: ChecklistItem[] = [
      {
        id: "session-saved",
        label: "Session saved",
        auto: true,
        checked: true,
      },
      {
        id: "review-stats",
        label: "Review session stats",
        auto: false,
        checked: manualChecked.has("review-stats"),
        action: onNavigate
          ? { label: "Reports →", onClick: () => onNavigate("summary") }
          : undefined,
      },
    ];

    if (state.raffleEnabled) {
      postItems.push({
        id: "spin-raffle",
        label: "Spin the raffle",
        auto: false,
        checked: manualChecked.has("spin-raffle"),
        action: onNavigate
          ? { label: "Raffle →", onClick: () => onNavigate("raffle") }
          : undefined,
      });
    }

    return postItems;
  }, [phase, state.activeSession, state.raffleEnabled, manualChecked, onNavigate]);

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const allDone = checkedCount === totalCount;

  const phaseLabels: Record<Phase, string> = {
    pre:    "Pre-Session",
    active: "Session Active",
    post:   "Post-Session",
  };

  const phaseColors: Record<Phase, string> = {
    pre:    "text-blue-400   border-blue-500/20   bg-blue-500/6",
    active: "text-emerald-400 border-emerald-500/20 bg-emerald-500/6",
    post:   "text-violet-400  border-violet-500/20  bg-violet-500/6",
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${phaseColors[phase]}`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-widest opacity-70">
            {phaseLabels[phase]}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            allDone
              ? "bg-current/20 opacity-80"
              : "bg-current/10 opacity-60"
          }`}>
            {checkedCount}/{totalCount}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="size-3.5 opacity-40" />
        ) : (
          <ChevronUp className="size-3.5 opacity-40" />
        )}
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-2.5 border-t border-current/10">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 pt-2.5">
              <button
                onClick={() => !item.auto && toggleManual(item.id)}
                disabled={item.auto}
                className={`mt-0.5 flex-shrink-0 transition-opacity ${item.auto ? "cursor-default" : "hover:opacity-80"}`}
                aria-label={item.checked ? "Checked" : "Mark complete"}
              >
                {item.checked ? (
                  <CheckCircle2 className="size-4 text-current" />
                ) : (
                  <Circle className="size-4 opacity-30" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm font-medium leading-snug ${
                    item.checked ? "line-through opacity-50" : "opacity-80"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {item.action && !item.checked && (
                <button
                  onClick={item.action.onClick}
                  className="flex-shrink-0 text-xs font-semibold opacity-60 hover:opacity-90 underline underline-offset-2 transition-opacity"
                >
                  {item.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
