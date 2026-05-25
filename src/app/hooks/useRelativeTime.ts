import { useEffect, useState } from "react";

/** Returns a human-readable relative time, updating every 60s. */
export function useRelativeTime(target: Date | null | undefined): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return "";
  const diffMin = Math.round((target.getTime() - now) / 60_000);

  if (diffMin >= -2 && diffMin <= 2) return "starts now";
  if (diffMin > 2 && diffMin < 60) return `starts in ${diffMin}m`;
  if (diffMin >= 60 && diffMin < 60 * 12) {
    const h = Math.round(diffMin / 60);
    return `starts in ${h}h`;
  }
  if (diffMin >= 60 * 12) {
    return `starts ${target.toLocaleDateString(undefined, { weekday: "short" })}`;
  }
  // diffMin < -2 → started in the past
  const ago = Math.abs(diffMin);
  if (ago < 60) return `started ${ago}m ago`;
  if (ago < 60 * 12) return `started ${Math.round(ago / 60)}h ago`;
  return "ended";
}
