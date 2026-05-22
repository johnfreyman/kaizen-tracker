import { useState } from "react";
import {
  Home,
  Calendar,
  Users,
  BarChart2,
  TrendingUp,
  Gift,
  Settings as SettingsIcon,
  LogOut,
  Trophy,
} from "lucide-react";
import MissionControlDashboard from "./components/MissionControlDashboard";
import LaunchPage from "./components/LaunchPage";
import AttendancePage from "./components/AttendancePage";
import SummaryPage from "./components/SummaryPage";
import SettingsPage from "./components/SettingsPage";
import RafflePage from "./components/RafflePage";
import ChartsPage from "./components/ChartsPage";
import SessionStatusBar from "./components/SessionStatusBar";
import SidebarLeaderboard from "./components/SidebarLeaderboard";
import LoginPage from "./components/LoginPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import { TeamStoreProvider, useTeamStore } from "./hooks/useTeamStore";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import OnboardingPage from "./components/OnboardingPage";
import { Toaster } from "./components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";

type Page = "dashboard" | "launch" | "attendance" | "summary" | "charts" | "settings" | "raffle";

const PAGE_TITLES: Record<Page, string> = {
  dashboard:  "Mission Control",
  launch:     "Session Setup",
  attendance: "Attendance",
  summary:    "Reports",
  charts:     "Analytics",
  raffle:     "Raffle",
  settings:   "Settings",
};

function AppContent() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const { state, isLoading, isAuthenticated, isPasswordRecovery, isSuperAdmin, isNewCoach, logout } =
    useTeamStore();
  const isNewAccount = state.teamName === "Team Name" && !state.teamLogo;
  const navigate = (page: string) => setActivePage(page as Page);

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
    { id: "charts"    as Page, label: "Analytics",  icon: TrendingUp },
    ...(state.raffleEnabled ? [{ id: "raffle" as Page, label: "Raffle", icon: Gift }] : []),
  ];

  const bottomNavItems = [
    { id: "dashboard"  as Page, label: "Home",      icon: Home },
    { id: "launch"     as Page, label: "Session",   icon: Calendar },
    { id: "attendance" as Page, label: "Attend",    icon: Users },
    { id: "summary"    as Page, label: "Reports",   icon: BarChart2 },
    { id: "settings"   as Page, label: "Settings",  icon: SettingsIcon },
  ];

  const isSessionActive = !!state.activeSession;

  return (
    /* ── Root shell ─────────────────────────────────────────────── */
    <div className="dark">
      <div className="flex h-screen overflow-hidden bg-[#0d1117]">

        {/* ── Sidebar (desktop only) ─────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-[#090e16] border-r border-white/[0.07]">

          {/* Logo + team */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] flex-shrink-0">
            <div className="size-8 rounded-lg overflow-hidden flex items-center justify-center bg-blue-600/20 flex-shrink-0">
              {state.teamLogo ? (
                <img src={state.teamLogo} alt="Team logo" className="size-full object-cover" />
              ) : (
                <Trophy className="size-4 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-white/85 text-sm font-semibold truncate leading-tight">
                {state.teamName || "My Team"}
              </div>
              <div className="text-white/25 text-[10px] uppercase tracking-wider">Mission Control</div>
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
                  className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/12 text-blue-300"
                      : "text-white/45 hover:text-white/75 hover:bg-white/[0.05]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-blue-400 rounded-r-full" />
                  )}
                  <Icon className={`size-4 flex-shrink-0 ${isActive ? "text-blue-400" : ""}`} />
                  <span>{label}</span>
                  {showBadge && (
                    <span className="ml-auto size-1.5 rounded-full bg-emerald-400 animate-session-pulse" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Leaderboard — always visible in sidebar */}
          <SidebarLeaderboard onNavigate={navigate} />

          {/* Footer: Settings + Logout */}
          <div className="flex-shrink-0 px-2.5 py-3 border-t border-white/[0.07] space-y-0.5">
            <button
              onClick={() => setActivePage("settings")}
              className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activePage === "settings"
                  ? "bg-blue-600/12 text-blue-300"
                  : isNewAccount
                  ? "text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/8 animate-pulse"
                  : "text-white/45 hover:text-white/75 hover:bg-white/[0.05]"
              }`}
            >
              {activePage === "settings" && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-blue-400 rounded-r-full" />
              )}
              <SettingsIcon className="size-4 flex-shrink-0" />
              <span>Settings</span>
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/30 hover:text-red-400 hover:bg-red-500/8 transition-all"
            >
              <LogOut className="size-4 flex-shrink-0" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* ── Main column ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* TopBar */}
          <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 md:px-6 bg-[#0d1117]/90 backdrop-blur-sm border-b border-white/[0.07] z-40">
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
                <span className="text-white/80 text-sm font-semibold">
                  {state.teamName || "My Team"}
                </span>
              </div>
              {/* Desktop page title */}
              <h1 className="hidden md:block text-white/70 text-sm font-semibold">
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
                className="md:hidden size-9 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/8 transition-all"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>

          {/* Session Status Bar */}
          <SessionStatusBar onNavigate={navigate} />

          {/* Scrollable page content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 md:pb-8 animate-fade-in">
              <ErrorBoundary key={activePage}>
                {activePage === "dashboard"  && <MissionControlDashboard onNavigate={navigate} />}
                {activePage === "launch"     && <LaunchPage onNavigate={navigate} />}
                {activePage === "attendance" && <AttendancePage onNavigate={navigate} />}
                {activePage === "summary"    && <SummaryPage />}
                {activePage === "charts"     && <ChartsPage />}
                {activePage === "raffle"     && <RafflePage />}
                {activePage === "settings"   && <SettingsPage />}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      {/* ── Mobile bottom nav ──────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-[#090e16]/96 backdrop-blur-md border-t border-white/[0.07]">
        <div className="flex items-center justify-around h-full px-1">
          {bottomNavItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id;
            const showDot = id === "attendance" && isSessionActive;
            return (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                className={`relative flex flex-col items-center justify-center gap-1 px-3 h-full min-w-[56px] transition-colors ${
                  isActive ? "text-blue-400" : "text-white/35 hover:text-white/60"
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
