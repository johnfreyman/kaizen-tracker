import { createContext, useContext, useState, useEffect, createElement } from "react";
import type { ReactNode } from "react";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "mc-theme";

function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

interface ThemeContextValue {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
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
    root.classList.toggle("dark", resolved === "dark");

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

  return createElement(ThemeContext.Provider, { value: { theme, resolved, setTheme } }, children);
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
