import { useState, useRef, useCallback } from "react";
import {
  Home,
  Calendar,
  Users,
  BarChart2,
  Gift,
  Settings as SettingsIcon,
  LogOut,
  Trophy,
  Menu,
  ChevronRight,
} from "lucide-react";
import MissionControlDashboard from "./components/MissionControlDashboard";
import LaunchPage from "./components/LaunchPage";
import AttendancePage from "./components/AttendancePage";
import SummaryPage from "./components/SummaryPage";
import SettingsPage from "./components/SettingsPage";
import RafflePage from "./components/RafflePage";

import SessionStatusBar from "./components/SessionStatusBar";
import SidebarLeaderboard from "./components/SidebarLeaderboard";
import LoginPage from "./components/LoginPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import { TeamStoreProvider, useTeamStore } from "./hooks/useTeamStore";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import OnboardingPage from "./components/OnboardingPage";
import CommandPalette from "./components/CommandPalette";
import { Toaster } from "./components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { useTheme } from "./hooks/useTheme";
import { Drawer, DrawerContent } from "./components/ui/drawer";

type Page = "dashboard" | "launch" | "attendance" | "summary" | "settings" | "raffle";

const PAGE_TITLES: Record<Page, string> = {
  dashboard:  "Mission Control",
  launch:     "Session Setup",
  attendance: "Attendance",
  summary:    "Reports",
  raffle:     "Raffle",
  settings:   "Settings",
};

function AppContent() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportPdfTrigger, setExportPdfTrigger] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { state, isLoading, isAuthenticated, isPasswordRecovery, isSuperAdmin, isNewCoach, logout } =
    useTeamStore();
  const { resolved: theme } = useTheme();
  const isLight = theme === "light";
  const isNewAccount = state.teamName === "Team Name" && !state.teamLogo;
  const mainRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((page: string) => setActivePage(page as Page), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useKeyboardShortcuts({ onNavigate: navigate, onOpenPalette: openPalette });

  // Mobile swipe — left advances, right goes back through the main nav order
  const NAV_ORDER: Page[] = ["dashboard", "launch", "attendance", "summary"];
  useSwipeNavigation({
    targetRef: mainRef,
    onSwipeLeft: () => {
      const idx = NAV_ORDER.indexOf(activePage);
      if (idx < NAV_ORDER.length - 1) navigate(NAV_ORDER[idx + 1]);
    },
    onSwipeRight: () => {
      const idx = NAV_ORDER.indexOf(activePage);
      if (idx > 0) navigate(NAV_ORDER[idx - 1]);
    },
  });

  /* ── Loading ─────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/40 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) return <ResetPasswordPage />;
  if (!isAuthenticated)   return <LoginPage />;
  if (isSuperAdmin)       return <SuperAdminDashboard />;
  if (isNewCoach)         return <OnboardingPage />;

  /* ── Nav item definitions ────────────────────────────────────── */
  const mainNavItems = [
    { id: "dashboard" as Page, label: "Dashboard",  icon: Home },
    { id: "launch"    as Page, label: "Session",    icon: Calendar },
    { id: "attendance"as Page, label: "Attendance", icon: Users },
    { id: "summary"   as Page, label: "Reports",    icon: BarChart2 },
    ...(state.raffleEnabled ? [{ id: "raffle" as Page, label: "Raffle", icon: Gift }] : []),
  ];

  const bottomNavItems = [
    { id: "dashboard"  as const, label: "Home",      icon: Home },
    { id: "launch"     as const, label: "Session",   icon: Calendar },
    { id: "attendance" as const, label: "Attend",    icon: Users },
    { id: "summary"    as const, label: "Reports",   icon: BarChart2 },
    { id: "more"       as const, label: "More",      icon: Menu },
  ];

  const moreNavItems = [
    ...(state.raffleEnabled ? [{ id: "raffle" as Page, label: "Raffle", icon: Gift }] : []),
    { id: "settings" as Page, label: "Settings", icon: SettingsIcon },
    { id: "logout" as Page, label: "Log out", icon: LogOut, action: logout },
  ];

  const isSessionActive = !!state.activeSession;

  return (
    /* ── Root shell ─────────────────────────────────────────────── */
    <div className={isLight ? "mc-light" : "dark"}>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onExportPdf={() => {
          navigate("summary");
          setExportPdfTrigger(true);
        }}
      />
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--mc-bg)" }}>

        {/* ── Sidebar (desktop only) ─────────────────────────────── */}
        <aside className="hidden md:flex flex-col md:w-14 lg:w-56 flex-shrink-0 border-r mc-border" style={{ backgroundColor: "var(--mc-surface)" }}>

          {/* Logo + team */}
          <div className="flex items-center md:justify-center lg:justify-start md:gap-0 lg:gap-3 md:px-0 lg:px-4 h-14 border-b mc-border flex-shrink-0">
            <div className="size-8 rounded-lg overflow-hidden flex items-center justify-center bg-blue-600/20 flex-shrink-0">
              {state.teamLogo ? (
                <img src={state.teamLogo} alt="Team logo" className="size-full object-cover" />
              ) : (
                <Trophy className="size-4 text-blue-400" />
              )}
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="mc-text text-sm font-semibold truncate leading-tight">
                {state.teamName || "My Team"}
              </div>
              <div className="mc-text-muted text-[10px] uppercase tracking-wider">Mission Control</div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
            {mainNavItems.map(({ id, label, icon: Icon }) => {
              const isActive = activePage === id;
              const showBadge = id === "attendance" && isSessionActive;
              return (
                <button
                  key={id}
                  onClick={() => setActivePage(id)}
                  title={label}
                  className={`group relative w-full flex items-center md:justify-center lg:justify-start gap-3 md:px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/12 text-blue-300"
                      : "mc-text-secondary hover:mc-text hover:bg-white/[0.05]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-blue-400 rounded-r-full" />
                  )}
                  <div className="relative flex-shrink-0">
                    <Icon className={`size-4 ${isActive ? "text-blue-400" : ""}`} />
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 animate-session-pulse lg:hidden" />
                    )}
                  </div>
                  <span className="hidden lg:block">{label}</span>
                  {showBadge && (
                    <span className="hidden lg:block ml-auto size-1.5 rounded-full bg-emerald-400 animate-session-pulse" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Leaderboard — full sidebar only */}
          <div className="hidden lg:block">
            <SidebarLeaderboard onNavigate={navigate} />
          </div>

          {/* Footer: Settings + Logout */}
          <div className="flex-shrink-0 px-2.5 py-3 border-t mc-border space-y-0.5">
            <button
              onClick={() => setActivePage("settings")}
              title="Settings"
              className={`relative w-full flex items-center md:justify-center lg:justify-start gap-3 md:px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activePage === "settings"
                  ? "bg-blue-600/12 text-blue-300"
                  : isNewAccount
                  ? "text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/8 animate-pulse"
                  : "mc-text-secondary hover:mc-text hover:bg-white/[0.05]"
              }`}
            >
              {activePage === "settings" && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-blue-400 rounded-r-full" />
              )}
              <SettingsIcon className="size-4 flex-shrink-0" />
              <span className="hidden lg:block">Settings</span>
            </button>

            <button
              onClick={logout}
              title="Log out"
              className="w-full flex items-center md:justify-center lg:justify-start gap-3 md:px-2 lg:px-3 py-2 rounded-lg text-sm font-medium mc-text-muted hover:text-red-400 hover:bg-red-500/8 transition-all"
            >
              <LogOut className="size-4 flex-shrink-0" />
              <span className="hidden lg:block">Log out</span>
            </button>
          </div>
        </aside>

        {/* ── Main column ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* TopBar */}
          <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 md:px-6 backdrop-blur-sm border-b mc-border z-40" style={{ backgroundColor: "color-mix(in srgb, var(--mc-bg) 90%, transparent)" }}>
            {/* Mobile: team logo + name | Desktop: page title */}
            <div className="flex items-center gap-3">
              {/* Mobile logo */}
              <div className="flex md:hidden items-center gap-2.5">
                <div className="size-7 rounded-md overflow-hidden flex items-center justify-center bg-blue-600/20 flex-shrink-0">
                  {state.teamLogo ? (
                    <img src={state.teamLogo} alt="Team logo" className="size-full object-cover" />
                  ) : (
                    <Trophy className="size-3.5 text-blue-400" />
                  )}
                </div>
                <span className="mc-text text-sm font-semibold">
                  {state.teamName || "My Team"}
                </span>
              </div>
              {/* Desktop page title */}
              <h1 className="hidden md:block mc-text-secondary text-sm font-semibold">
                {PAGE_TITLES[activePage]}
              </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Active session indicator (mobile only — desktop uses status bar) */}
              {isSessionActive && (
                <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-session-pulse" />
                  <span className="text-emerald-300 text-[11px] font-bold uppercase tracking-wider">Live</span>
                </div>
              )}

              {/* Logout (desktop — it's in the sidebar too, but keep for overflow) */}
              <button
                onClick={logout}
                title="Log out"
                className="md:hidden size-9 rounded-lg flex items-center justify-center mc-text-muted hover:text-red-400 hover:bg-red-500/8 transition-all"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>

          {/* Session Status Bar */}
          <SessionStatusBar onNavigate={navigate} />

          {/* Scrollable page content */}
          <main ref={mainRef} className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 md:pb-8 animate-fade-in">
              <ErrorBoundary key={activePage}>
                {activePage === "dashboard"  && <MissionControlDashboard onNavigate={navigate} />}
                {activePage === "launch"     && <LaunchPage onNavigate={navigate} />}
                {activePage === "attendance" && <AttendancePage onNavigate={navigate} />}
                {activePage === "summary"    && (
                  <SummaryPage
                    openExportPdf={exportPdfTrigger}
                    onExportPdfOpened={() => setExportPdfTrigger(false)}
                    onNavigate={navigate}
                  />
                )}

                {activePage === "raffle"     && <RafflePage />}
                {activePage === "settings"   && <SettingsPage />}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      {/* ── Mobile bottom nav ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 backdrop-blur-md border-t mc-border" style={{ backgroundColor: "color-mix(in srgb, var(--mc-surface) 96%, transparent)" }}>
        <div className="flex items-center justify-around h-full px-1">
          {bottomNavItems.map(({ id, label, icon: Icon }) => {
            const isActive = id === "more"
              ? (activePage === "raffle" || activePage === "settings")
              : activePage === id;
            const showDot = id === "attendance"
              ? isSessionActive
              : id === "more"
              ? (activePage === "raffle" || activePage === "settings")
              : false;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === "more") {
                    setMoreOpen(true);
                  } else {
                    setActivePage(id as Page);
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-1 px-3 h-full min-w-[56px] transition-colors ${
                  isActive ? "text-blue-400" : "mc-text-muted hover:mc-text-secondary"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-3 h-0.5 bg-blue-400 rounded-b-full" />
                )}
                <div className="relative">
                  <Icon className="size-5" />
                  {showDot && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 border border-[#090e16] animate-session-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── More Drawer ───────────────────────────────────────── */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="border-t mc-border bg-[var(--mc-surface)] px-4 pb-8 rounded-t-3xl outline-none">
          <div className="space-y-1.5 py-4">
            {moreNavItems.map(({ id, label, icon: Icon, action }) => (
              <button
                key={id}
                onClick={() => {
                  setMoreOpen(false);
                  if (action) {
                    action();
                  } else {
                    setActivePage(id as Page);
                  }
                }}
                className="w-full h-[56px] flex items-center justify-between px-4 py-2 rounded-xl mc-text hover:mc-text hover:bg-white/[0.05] active:bg-white/[0.08] transition-all cursor-pointer animate-fade-in"
              >
                <div className="flex items-center gap-3.5">
                  <div className="size-9 rounded-lg bg-white/[0.03] flex items-center justify-center border mc-border">
                    <Icon className="size-4.5 mc-text-secondary" />
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <ChevronRight className="size-4 mc-text-muted" />
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default function App() {
  return (
    <TeamStoreProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
      <Toaster />
    </TeamStoreProvider>
  );
}
