const DRAFT_KEY = "kaizen_attendance_draft";
const PENDING_EVENT_KEY = "kaizen_pending_event";

export interface PendingEventRecord {
  coachId: string;
  event: {
    id: string;
    date: string;
    type: string;
    duration: number;
    players: string[];
    savedAt: string;
  };
}

export function saveDraft(sessionId: string, presentPlayers: string[]): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ sessionId, presentPlayers }));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export function loadDraft(sessionId: string): string[] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { sessionId: string; presentPlayers: string[] };
    return draft.sessionId === sessionId ? draft.presentPlayers : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function savePendingEvent(coachId: string, event: PendingEventRecord["event"]): void {
  try {
    localStorage.setItem(PENDING_EVENT_KEY, JSON.stringify({ coachId, event }));
  } catch {
    // ignore
  }
}

export function loadPendingEvent(): PendingEventRecord | null {
  try {
    const raw = localStorage.getItem(PENDING_EVENT_KEY);
    return raw ? (JSON.parse(raw) as PendingEventRecord) : null;
  } catch {
    return null;
  }
}

export function clearPendingEvent(): void {
  try {
    localStorage.removeItem(PENDING_EVENT_KEY);
  } catch {
    // ignore
  }
}
