import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home,
  Calendar,
  Users,
  BarChart2,
  Gift,
  Settings,
  Play,
  Search,
  ArrowRight,
  FileText,
} from "lucide-react";
import { useTeamStore, EVENT_TYPES, ActiveSession } from "../hooks/useTeamStore";

function buildSmartSession(): ActiveSession {
  const now = new Date();
  const snapped = new Date(now);
  snapped.setMinutes(Math.round(now.getMinutes() / 15) * 15, 0, 0);
  if (snapped.getMinutes() === 60) {
    snapped.setHours(snapped.getHours() + 1);
    snapped.setMinutes(0);
  }
  const y = snapped.getFullYear();
  const mo = String(snapped.getMonth() + 1).padStart(2, "0");
  const d = String(snapped.getDate()).padStart(2, "0");
  const h = String(snapped.getHours()).padStart(2, "0");
  const mi = String(snapped.getMinutes()).padStart(2, "0");
  return {
    id: crypto.randomUUID(),
    date: `${y}-${mo}-${d}T${h}:${mi}`,
    type: EVENT_TYPES.PRACTICE,
    duration: 1.5,
  };
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: "navigate" | "action";
  keywords?: string[];
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onExportPdf?: () => void;
}

export default function CommandPalette({ open, onClose, onNavigate, onExportPdf }: Props) {
  const { state, startSession } = useTeamStore();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleNavigate = useCallback(
    (page: string) => {
      onNavigate(page);
      onClose();
    },
    [onNavigate, onClose]
  );

  const handleSmartStart = useCallback(async () => {
    await startSession(buildSmartSession());
    onNavigate("attendance");
    onClose();
  }, [startSession, onNavigate, onClose]);

  const commands: Command[] = [
    {
      id: "nav-dashboard",
      label: "Dashboard",
      description: "Mission Control home",
      icon: <Home className="size-4" />,
      group: "navigate",
      keywords: ["home", "mission control"],
      action: () => handleNavigate("dashboard"),
    },
    {
      id: "nav-session",
      label: "Session Setup",
      description: "Configure and start a session",
      icon: <Calendar className="size-4" />,
      group: "navigate",
      keywords: ["launch", "start", "configure", "setup"],
      action: () => handleNavigate("launch"),
    },
    {
      id: "nav-attendance",
      label: "Attendance",
      description: "Mark players present",
      icon: <Users className="size-4" />,
      group: "navigate",
      keywords: ["players", "mark", "present"],
      action: () => handleNavigate("attendance"),
    },
    {
      id: "nav-reports",
      label: "Reports",
      description: "Session history and player totals",
      icon: <BarChart2 className="size-4" />,
      group: "navigate",
      keywords: ["summary", "history", "stats"],
      action: () => handleNavigate("summary"),
    },

    {
      id: "nav-settings",
      label: "Settings",
      description: "Team name, logo, preferences",
      icon: <Settings className="size-4" />,
      group: "navigate",
      keywords: ["team", "logo", "preferences"],
      action: () => handleNavigate("settings"),
    },
    ...(state.raffleEnabled
      ? [
          {
            id: "nav-raffle",
            label: "Raffle",
            description: "Spin the wheel",
            icon: <Gift className="size-4" />,
            group: "navigate" as const,
            keywords: ["wheel", "prize", "draw"],
            action: () => handleNavigate("raffle"),
          },
        ]
      : []),
    ...(!state.activeSession
      ? [
          {
            id: "action-quick-start",
            label: "Quick Start Session",
            description: "Practice · 1.5h · starts now",
            icon: <Play className="size-4" />,
            group: "action" as const,
            keywords: ["begin", "go", "practice"],
            action: handleSmartStart,
          },
        ]
      : [
          {
            id: "action-take-attendance",
            label: "Take Attendance",
            description: "Mark who's here for the active session",
            icon: <Users className="size-4" />,
            group: "action" as const,
            keywords: ["present", "mark", "check"],
            action: () => handleNavigate("attendance"),
          },
        ]),
    {
      id: "action-export-pdf",
      label: "Export PDF report",
      description: "Download a PDF of the current Reports page",
      icon: <FileText className="size-4" />,
      group: "action" as const,
      keywords: ["pdf", "download", "export", "report", "print"],
      action: () => {
        if (onExportPdf) {
          onExportPdf();
        } else {
          handleNavigate("summary");
        }
        onClose();
      },
    },
  ];

  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keep active item in view
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelectorAll("[data-cmd-item]")[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIdx]?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  const navCmds = filtered.filter((c) => c.group === "navigate");
  const actionCmds = filtered.filter((c) => c.group === "action");

  let globalIdx = 0;

  const renderGroup = (cmds: Command[], label: string) => {
    if (cmds.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/25">
          {label}
        </div>
        {cmds.map((cmd) => {
          const idx = globalIdx++;
          const isActive = idx === activeIdx;
          return (
            <button
              key={cmd.id}
              data-cmd-item
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={cmd.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                isActive
                  ? "bg-blue-600/15 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <span
                className={`flex-shrink-0 size-8 rounded-lg flex items-center justify-center ${
                  isActive ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.06] text-white/40"
                }`}
              >
                {cmd.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-none">{cmd.label}</div>
                {cmd.description && (
                  <div className="text-xs text-white/35 mt-0.5 truncate">{cmd.description}</div>
                )}
              </div>
              {isActive && <ArrowRight className="size-3.5 text-white/30 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-[#111827] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-hero-enter">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
          <Search className="size-4 text-white/35 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-white/90 placeholder-white/30 text-sm outline-none"
          />
          <kbd className="flex-shrink-0 text-[10px] text-white/25 bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          className="p-2 max-h-[60vh] overflow-y-auto space-y-1"
        >
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-white/30 text-sm">
              No commands match "{query}"
            </div>
          ) : (
            <>
              {renderGroup(navCmds, "Navigate")}
              {renderGroup(actionCmds, "Actions")}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/[0.05] flex items-center gap-4 text-[10px] text-white/20">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
