import { useState, useEffect } from "react";
import { ActiveSession } from "./useTeamStore";

export function useSessionTimer(activeSession: ActiveSession | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return;
    }
    const sessionStart = new Date(activeSession.date).getTime();
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - sessionStart) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  return elapsed;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
