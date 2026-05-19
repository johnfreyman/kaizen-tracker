import { Trophy } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";
import { useEffect, useRef, useCallback } from "react";

export default function LeaderboardTicker() {
  const { state } = useTeamStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const xRef = useRef<number | null>(null);

  const getPlayerTotals = () => {
    const totals: Record<string, number> = {};

    const allPlayers = new Set([
      ...state.roster,
      ...state.events.flatMap((e) => e.players),
    ]);

    allPlayers.forEach((player) => {
      totals[player] = 0;
    });

    state.events.forEach((event) => {
      event.players.forEach((player) => {
        if (!totals[player]) totals[player] = 0;
        totals[player] += event.duration;
      });
    });

    return Object.entries(totals)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 20);
  };

  const leaderboard = getPlayerTotals();
  const hasEventsWithAttendance = state.events.some((event) => event.players && event.players.length > 0);
  const hasData = hasEventsWithAttendance && leaderboard.length > 0 && leaderboard[0].hours > 0;

  const SPEED = 200;

  const renderEndMarker = (copyId: string) => (
    <div
      key={`end-marker-${copyId}`}
      className="inline-flex items-center gap-2 px-3 shrink-0"
      aria-label="End of leaderboard"
    >
      {state.teamLogo ? (
        <img
          src={state.teamLogo}
          alt=""
          className="size-8 rounded-full border-2 border-white/70 bg-white object-cover shadow-sm"
        />
      ) : (
        <span
          className="relative size-8 overflow-hidden rounded-full border-2 border-white/80 bg-orange-400 shadow-sm"
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-orange-950/45" />
          <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-orange-950/45" />
          <span className="absolute -left-1 top-0 h-full w-4 rounded-r-full border-r-2 border-orange-950/45" />
          <span className="absolute -right-1 top-0 h-full w-4 rounded-l-full border-l-2 border-orange-950/45" />
        </span>
      )}
    </div>
  );

  const renderLeaderboardItems = (copyId: string) => (
    <>
      {leaderboard.map((player, index) => (
        <div
          key={`${copyId}-${player.name}`}
          className="inline-flex items-center gap-2 px-3 shrink-0"
        >
          <span className="font-bold text-yellow-300">#{index + 1}</span>
          <span className="font-semibold">{player.name}</span>
          <span className="text-blue-100">•</span>
          <span className="font-bold">
            {player.hours.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}{" "}
            hrs
          </span>
        </div>
      ))}
      {renderEndMarker(copyId)}
    </>
  );

  const animate = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const trackWidth = content.scrollWidth / 2;

    if (xRef.current === null) {
      xRef.current = 0;
    }

    xRef.current -= SPEED / 60;

    if (xRef.current <= -trackWidth) {
      xRef.current += trackWidth;
    }

    content.style.transform = `translateX(${xRef.current}px)`;
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!hasData) return;

    xRef.current = null;

    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 50);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [hasData, leaderboard.map((p) => `${p.name}:${p.hours}`).join(","), animate]);

  if (!hasEventsWithAttendance) {
    return (
      <div className="bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm rounded-2xl p-4 border border-blue-100/50 flex items-center gap-3 text-sm text-blue-700 font-medium shadow-sm mb-4">
        <Trophy className="size-5 text-blue-600 flex-shrink-0 animate-pulse" />
        <span>No events logged yet — start a session to see the leaderboard.</span>
      </div>
    );
  }

  if (!hasData) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white py-2 overflow-hidden relative mb-4 rounded-2xl shadow-lg">
      <div className="flex items-center gap-2 px-4 mb-1">
        <Trophy className="size-4 flex-shrink-0" />
        <span className="font-bold text-sm uppercase tracking-wider">
          Puttin' In The Work Leaderboard
        </span>
      </div>

      <div ref={containerRef} className="relative overflow-hidden">
        <div
          ref={contentRef}
          className="flex whitespace-nowrap will-change-transform py-1"
          style={{ transform: "translateX(0)" }}
        >
          <div className="flex gap-8 pr-8 shrink-0">
            {renderLeaderboardItems("primary")}
          </div>
          <div className="flex gap-8 pr-8 shrink-0">
            {renderLeaderboardItems("loop")}
          </div>
        </div>
      </div>
    </div>
  );
}
