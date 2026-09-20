/**
 * Small presentational helpers for the prototype.
 *
 * These reuse the app's existing Mission Control tokens (`mc-card`,
 * `mc-border`, `--mc-surface`, the emerald "present" treatment) so the
 * walkthrough looks like the product, not like a separate design.
 */

import type { ReactNode } from "react";
import { cn } from "@/app/components/ui/utils";

export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border mc-border p-5 md:p-6", className)}
      style={{ backgroundColor: "var(--mc-surface)" }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, hint }: { eyebrow?: string; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-widest mc-text-secondary">{eyebrow}</span>
      )}
      <h2 className="mt-1 text-xl md:text-2xl font-bold mc-text">{title}</h2>
      {hint && <p className="mt-1 text-sm mc-text-secondary">{hint}</p>}
    </div>
  );
}

/**
 * Notes are how the prototype carries a *recommendation* into the walkthrough
 * without it reading as an approved rule. The owner reviews anything in a note.
 */
export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "assumption" }) {
  const isAssumption = tone === "assumption";
  return (
    <p
      className={cn(
        "mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed",
        isAssumption
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      )}
    >
      <span className="font-semibold uppercase tracking-wide mr-1.5">
        {isAssumption ? "Assumption" : "For review"}
      </span>
      {children}
    </p>
  );
}

/** Minimum 56px tall: usable on a phone with a ball in the other hand. */
export function BigButton({
  children,
  onClick,
  variant = "default",
  disabled,
  className,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "quiet" | "danger";
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const styles: Record<string, string> = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white border-transparent",
    default: "mc-card mc-card-hover mc-text border mc-border",
    quiet: "bg-transparent mc-text-secondary border mc-border hover:mc-text",
    danger:
      "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/15",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2.5 min-h-14 px-5 rounded-xl border font-semibold",
        "transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-[var(--mc-bg)]",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/[0.06] mc-text-secondary border-white/10",
    ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    bad: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
    accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-dashed mc-border p-8 text-center"
      style={{ backgroundColor: "var(--mc-surface)" }}
    >
      <p className="font-semibold mc-text">{title}</p>
      <p className="mt-1.5 text-sm mc-text-secondary max-w-md mx-auto">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
