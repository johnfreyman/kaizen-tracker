import { useEffect } from "react";

type NavTarget = "dashboard" | "launch" | "attendance" | "summary" | "charts" | "settings" | "raffle";

const KEY_MAP: Record<string, NavTarget> = {
  h: "dashboard",
  s: "launch",
  a: "attendance",
  r: "summary",
  c: "charts",
};

interface Options {
  onNavigate: (page: string) => void;
  onOpenPalette: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts({ onNavigate, onOpenPalette, disabled }: Options) {
  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      // Skip single-key shortcuts when an input/textarea/select is focused
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const dest = KEY_MAP[e.key.toLowerCase()];
      if (dest) {
        e.preventDefault();
        onNavigate(dest);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNavigate, onOpenPalette, disabled]);
}
