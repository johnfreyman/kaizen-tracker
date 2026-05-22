import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Command,
  UserPlus,
  Download,
  FileText,
  Megaphone,
  Activity,
  MoreHorizontal,
  AlertTriangle,
  X,
  ChevronRight,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../ui/utils";

// ---------------------------------------------------------------------------
// Action Definitions
// ---------------------------------------------------------------------------

type ActionType = "primary" | "secondary" | "danger";

interface AdminAction {
  id: string;
  label: string;
  icon: React.ElementType;
  type: ActionType;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  onExecute: () => void;
}

// ---------------------------------------------------------------------------
// Command Palette Component
// ---------------------------------------------------------------------------

function CommandPalette({
  isOpen,
  onClose,
  actions,
}: {
  isOpen: boolean;
  onClose: () => void;
  actions: AdminAction[];
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredActions = useMemo(() => {
    if (!query) return actions;
    const q = query.toLowerCase();
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i < filteredActions.length - 1 ? i + 1 : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : filteredActions.length - 1));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const action = filteredActions[selectedIndex];
        if (action) {
          onClose();
          action.onExecute();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <div
          className="w-full max-w-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto border border-slate-200 animate-in slide-in-from-top-4 zoom-in-95 duration-200 flex flex-col max-h-[70vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none outline-none text-slate-800 text-lg placeholder:text-slate-400"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action List */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-2">
            {filteredActions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No commands found.
              </div>
            ) : (
              filteredActions.map((action, idx) => {
                const isActive = idx === selectedIndex;
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => {
                      onClose();
                      action.onExecute();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors select-none",
                      isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0",
                          action.type === "danger"
                            ? "bg-red-50 text-red-600"
                            : "bg-white text-slate-600 shadow-sm border border-slate-100"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          action.type === "danger" ? "text-red-700" : "text-slate-700"
                        )}
                      >
                        {action.label}
                      </span>
                    </div>
                    {isActive && (
                      <span className="text-indigo-600">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          
          <div className="bg-slate-50 border-t border-slate-100 px-4 py-2.5 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Navigation</span>
            <span className="flex gap-2">
              <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">↑↓</span>
              <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">Enter</span>
              <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">Esc</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Admin Action Bar Component
// ---------------------------------------------------------------------------

export default function AdminActionBar() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Define the available actions
  const actions: AdminAction[] = useMemo(
    () => [
      {
        id: "invite-coach",
        label: "Invite Coach",
        icon: UserPlus,
        type: "primary",
        onExecute: () => toast.info("Invite Coach modal would open here."),
      },
      {
        id: "export-data",
        label: "Export Data",
        icon: Download,
        type: "secondary",
        onExecute: () => toast.success("Data export initiated."),
      },
      {
        id: "view-audit-logs",
        label: "View Audit Logs",
        icon: FileText,
        type: "secondary",
        onExecute: () => toast.info("Audit logs viewer would open here."),
      },
      {
        id: "send-announcement",
        label: "Send Announcement",
        icon: Megaphone,
        type: "danger",
        requiresConfirmation: true,
        confirmationMessage: "This will send an email/push notification to all coaches. Proceed?",
        onExecute: () => toast.success("Announcement broadcast sent."),
      },
      {
        id: "open-diagnostics",
        label: "Open Diagnostics",
        icon: Activity,
        type: "secondary",
        onExecute: () => toast.info("Diagnostics dashboard would open here."),
      },
      {
        id: "bulk-actions",
        label: "Bulk Actions",
        icon: Layers,
        type: "danger",
        requiresConfirmation: true,
        confirmationMessage: "Are you sure you want to perform a bulk action? This might affect multiple accounts.",
        onExecute: () => toast.info("Bulk actions modal would open here."),
      },
    ],
    []
  );

  const topLevelActions = actions.slice(0, 3);
  const dropdownActions = actions.slice(3);

  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Execution wrapper (handles confirmation)
  const executeAction = (action: AdminAction) => {
    setIsDropdownOpen(false);
    if (action.requiresConfirmation) {
      setPendingAction(action);
    } else {
      action.onExecute();
    }
  };

  return (
    <>
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-[10]">
        <div className="flex items-center justify-between px-6 py-2.5 overflow-x-auto no-scrollbar">
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Open Command Menu"
            >
              <Command className="w-4 h-4 text-indigo-500" />
              <span>Command Menu</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 font-sans text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 rounded shadow-sm">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
            <div className="w-px h-5 bg-slate-200 mx-2" />
            
            {/* Top Level Quick Actions */}
            <div className="flex items-center gap-2">
              {topLevelActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => executeAction(action)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm active:scale-95 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <action.icon className="w-4 h-4 text-slate-500" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* More Actions Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-200",
                isDropdownOpen
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <span>More</span>
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-100 z-50">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Advanced Actions
                </div>
                {dropdownActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => executeAction(action)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
                      action.type === "danger"
                        ? "text-red-600 hover:bg-red-50"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <action.icon className={cn("w-4 h-4", action.type === "danger" ? "text-red-500" : "text-slate-400")} />
                    <span className="truncate">{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Action</h3>
              </div>
              <p className="text-sm text-slate-600 mb-6 font-medium">
                {pendingAction.confirmationMessage ?? `Are you sure you want to execute "${pendingAction.label}"?`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingAction(null)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    pendingAction.onExecute();
                    setPendingAction(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        actions={actions.map(a => ({
          ...a,
          onExecute: () => executeAction(a)
        }))}
      />
    </>
  );
}
