import { useState, useEffect } from "react";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "mc-theme";

function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
    } catch {
      return "dark";
    }
  });

  const resolved = resolveTheme(theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("mc-light", resolved === "light");

    // Keep Radix/shadcn dark class in sync
    root.classList.toggle("dark", resolved === "dark");

    // Sync system theme changes when in "system" mode
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const r = resolveTheme("system");
      document.documentElement.classList.toggle("mc-light", r === "light");
      document.documentElement.classList.toggle("dark", r === "dark");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, resolved]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch { /* ignore */ }
  };

  return { theme, resolved, setTheme };
}
