import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { useWorkflowSteps, Phase } from "../hooks/useWorkflowSteps";

interface Props {
  onNavigate?: (page: string) => void;
}

export default function WorkflowChecklist({ onNavigate }: Props) {
  const { items, toggleManual, phase, checkedCount, totalCount, allDone } = useWorkflowSteps();
  const [collapsed, setCollapsed] = useState(false);

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
              {item.action && !item.checked && onNavigate && (
                <button
                  onClick={() => onNavigate(item.action!.page)}
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
