"use client";

import { useMemo } from "react";
import { Check, X, Calendar, Clock, Flame, UserCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { useTeamStore, EVENT_TYPES, type TeamEvent } from "../hooks/useTeamStore";
import { formatDate } from "@/lib/dates";

interface PlayerDetailDrawerProps {
  playerName: string | null;
  onClose: () => void;
  onNavigate: (page: string) => void;
  filteredEvents?: TeamEvent[];
}

const TIER_COLORS = {
  full: "#10b981",  // emerald-500
  mid:  "#f59e0b",  // amber-400
  low:  "#f87171",  // red-400
};

const getTier = (pct: number) => {
  if (pct >= 100) return { label: "Full", color: TIER_COLORS.full };
  if (pct >= 50) return { label: "Mid", color: TIER_COLORS.mid };
  return { label: "Low", color: TIER_COLORS.low };
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
};

const getAvatarGradient = (name: string) => {
  const hash = name.split("").reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  const gradients = [
    "from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30",
    "from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30",
    "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
    "from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30",
  ];
  return gradients[hash % gradients.length];
};

export default function PlayerDetailDrawer({
  playerName,
  onClose,
  onNavigate,
  filteredEvents = [],
}: PlayerDetailDrawerProps) {
  const { isGuest } = useTeamStore();

  const open = !!playerName;

  // Compute stats for selected player
  const stats = useMemo(() => {
    if (!playerName) return { practiceHours: 0, practicePercent: 0, lastAttendedDate: null as string | null };

    const playerEvents = filteredEvents.filter((e) => e.players.includes(playerName));
    
    // 1. Total practice hours attended
    const practiceHours = playerEvents
      .filter((e) => e.type === EVENT_TYPES.PRACTICE)
      .reduce((sum, e) => sum + e.duration, 0);

    // 2. Total practice possible
    const totalPracticePossible = filteredEvents
      .filter((e) => e.type === EVENT_TYPES.PRACTICE)
      .reduce((sum, e) => sum + e.duration, 0);

    // 3. Practice %
    const practicePercent = totalPracticePossible > 0
      ? Math.round((practiceHours / totalPracticePossible) * 100)
      : 0;

    // 4. Last attended date
    const lastAttendedDate = playerEvents.length > 0 ? playerEvents[0].date : null;

    return {
      practiceHours,
      practicePercent,
      lastAttendedDate,
    };
  }, [playerName, filteredEvents]);

  const timelineEvents = useMemo(() => {
    return [...filteredEvents].slice(0, 12).reverse();
  }, [filteredEvents]);

  if (!playerName) return null;

  const initials = getInitials(playerName);
  const avatarGradient = getAvatarGradient(playerName);
  const playerIsGuest = isGuest(playerName);
  const tier = getTier(stats.practicePercent);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col gap-0 p-0 border-l border-white/[0.08] bg-[var(--mc-surface)] rounded-none h-full outline-none"
        style={{ color: "var(--mc-text-1)" }}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-6 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-4">
            {/* Gradient Avatar */}
            <div className={`size-16 rounded-full flex items-center justify-center font-bold text-lg bg-gradient-to-br border shadow-lg shrink-0 ${avatarGradient}`}>
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl font-bold text-white leading-tight truncate">
                  {playerName}
                </SheetTitle>
                {playerIsGuest && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium tracking-wider uppercase text-blue-400 shrink-0">
                    <UserCircle className="size-3" />
                    Guest
                  </span>
                )}
              </div>

              {/* Tier Pill */}
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0"
                  style={{
                    backgroundColor: `${tier.color}15`,
                    color: tier.color,
                    borderColor: `${tier.color}30`,
                  }}
                >
                  {tier.label} Tier
                </span>
                <span className="text-[11px] text-white/35">
                  Participation Tier
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* 3 Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 px-6 py-5 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
          {/* Practice Hrs */}
          <div className="rounded-xl p-3.5 border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1 truncate">
              Practice Hrs
            </div>
            <div className="text-xl font-bold text-white tabular-nums leading-none">
              {stats.practiceHours.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
            </div>
          </div>

          {/* Practice % */}
          <div className="rounded-xl p-3.5 border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1 truncate">
              Practice %
            </div>
            <div className="text-xl font-bold text-white tabular-nums leading-none">
              {stats.practicePercent}%
            </div>
          </div>

          {/* Last Attended */}
          <div className="rounded-xl p-3.5 border border-white/[0.06] bg-white/[0.02] min-w-0">
            <div className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1 truncate">
              Last Attended
            </div>
            <div className="text-xs font-semibold text-white/80 leading-none truncate mt-1">
              {stats.lastAttendedDate ? formatDate(stats.lastAttendedDate) : "—"}
            </div>
          </div>
        </div>

        {/* Attendance Timeline */}
        <div className="px-6 py-5 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
              Attendance Timeline
            </h4>
            <span className="text-[9px] text-white/25">Last 12 sessions</span>
          </div>

          <div className="flex items-center justify-between gap-1 h-9 px-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            {timelineEvents.map((event) => {
              const isPresent = event.players.includes(playerName);
              let dotColor = "bg-red-500 border-red-400/30 text-red-100 hover:bg-red-400";
              if (isPresent) {
                if (event.type === EVENT_TYPES.PRACTICE) {
                  dotColor = "bg-emerald-500 border-emerald-400/30 text-emerald-100 hover:bg-emerald-400";
                } else {
                  dotColor = "bg-amber-500 border-amber-400/30 text-amber-100 hover:bg-amber-400";
                }
              }

              return (
                <Tooltip key={event.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`size-3 rounded-full border transition-all hover:scale-125 cursor-pointer ${dotColor}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-[200px] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal leading-snug rounded-lg bg-[#1e2333] text-white/90 border border-white/[0.10] shadow-xl"
                  >
                    <div className="font-semibold text-white">{event.type}</div>
                    <div className="text-[10px] text-white/55 mt-0.5">{formatDate(event.date)}</div>
                    <div className="text-[10px] font-medium mt-1 flex items-center gap-1">
                      {isPresent ? (
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <Check className="size-3" /> Present
                        </span>
                      ) : (
                        <span className="text-red-400 flex items-center gap-0.5">
                          <X className="size-3" /> Absent
                        </span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {timelineEvents.length === 0 && (
              <div className="w-full text-center text-xs text-white/20">
                No sessions logged in this range.
              </div>
            )}
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
            Sessions ({filteredEvents.length})
          </h4>
          <div className="space-y-2">
            {filteredEvents.map((event) => {
              const isPresent = event.players.includes(playerName);
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-all"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white/85 text-xs">
                      {formatDate(event.date)}
                    </div>
                    <div className="text-[10px] text-white/35 mt-0.5 flex items-center gap-1.5">
                      <span>{event.type}</span>
                      <span className="text-white/10">•</span>
                      <span>{event.duration} {event.duration === 1 ? "hour" : "hours"}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isPresent ? (
                      <div className="flex items-center justify-center size-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Check className="size-3.5" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center size-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                        <X className="size-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredEvents.length === 0 && (
              <div className="text-center py-10 text-xs text-white/20">
                No sessions logged in this range.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] shrink-0 bg-[var(--mc-elev, #11161f)]">
          <button
            onClick={() => {
              onClose();
              onNavigate("launch");
            }}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white/80 border border-white/[0.08] hover:text-white hover:bg-white/[0.04] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Schedule make-up training
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
