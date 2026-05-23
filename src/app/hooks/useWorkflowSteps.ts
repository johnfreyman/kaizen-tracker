import { useState, useEffect, useMemo, useCallback } from "react";
import { useTeamStore } from "./useTeamStore";

export interface ChecklistItem {
  id: string;
  label: string;
  auto: boolean;          // true = system checks it; false = user checks it
  checked: boolean;
  action?: { label: string; page: string };
}

export type Phase = "pre" | "active" | "post";

function getPhase(
  activeSession: { id: string } | null,
  events: { id: string }[],
  lastSavedSessionId: string | null
): Phase {
  if (activeSession) return "active";
  if (lastSavedSessionId) {
    const saved = events.find((e) => e.id === lastSavedSessionId);
    if (saved) return "post";
  }
  return "pre";
}

export function useWorkflowSteps() {
  const { state } = useTeamStore();
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

  const toggleManual = useCallback((id: string) => {
    setManualChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }, [storageKey]);

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
          action: { label: "Settings →", page: "settings" },
        },
        {
          id: "start-session",
          label: "Start a session",
          auto: state.activeSession !== null,
          checked: state.activeSession !== null || manualChecked.has("start-session"),
          action: { label: "Quick Start →", page: "dashboard" },
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
          action: { label: "Attendance →", page: "attendance" },
        },
        {
          id: "save-end",
          label: "Save & end session",
          auto: false,
          checked: manualChecked.has("save-end"),
          action: { label: "Attendance →", page: "attendance" },
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
        action: { label: "Reports →", page: "summary" },
      },
    ];

    if (state.raffleEnabled) {
      postItems.push({
        id: "spin-raffle",
        label: "Spin the raffle",
        auto: false,
        checked: manualChecked.has("spin-raffle"),
        action: { label: "Raffle →", page: "raffle" },
      });
    }

    return postItems;
  }, [phase, state.activeSession, state.raffleEnabled, manualChecked]);

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const allDone = checkedCount === totalCount;

  return {
    items,
    toggleManual,
    phase,
    checkedCount,
    totalCount,
    allDone,
  };
}
