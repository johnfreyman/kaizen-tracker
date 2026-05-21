import { useState } from "react";
import { Trophy, Calendar, Users, Settings as SettingsIcon, Gift, LogOut } from "lucide-react";
import LaunchPage from "./components/LaunchPage";
import AttendancePage from "./components/AttendancePage";
import SummaryPage from "./components/SummaryPage";
import SettingsPage from "./components/SettingsPage";
import RafflePage from "./components/RafflePage";
import LeaderboardTicker from "./components/LeaderboardTicker";
import LoginPage from "./components/LoginPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import { TeamStoreProvider, useTeamStore } from "./hooks/useTeamStore";
import { Toaster } from "./components/ui/sonner";

type Page = "launch" | "attendance" | "summary" | "settings" | "raffle";

function AppContent() {
  const [activePage, setActivePage] = useState<Page>("launch");
  const { state, isLoading, isAuthenticated, isPasswordRecovery, logout } = useTeamStore();
  const isNewAccount = state.teamName === "Team Name" && !state.teamLogo;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-semibold">Loading from Supabase…</p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPasswordPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const navItems = [
    { id: "launch" as Page, label: "Launch", icon: Calendar },
    { id: "attendance" as Page, label: "Attendance", icon: Users },
    { id: "summary" as Page, label: "Summary", icon: Trophy },
    ...(state.raffleEnabled ? [{ id: "raffle" as Page, label: "Raffle", icon: Gift }] : []),
    { id: "settings" as Page, label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* Header */}
        <header className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative size-16 flex items-center justify-center rounded-2xl bg-white shadow-lg overflow-hidden">
              {state.teamLogo ? (
                <img
                  src={state.teamLogo}
                  alt="Team logo"
                  className="size-full object-cover"
                />
              ) : (
                <Trophy className="size-8 text-blue-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {state.teamName || "Team Name"}
              </h1>
              <p className="text-sm text-gray-600">Attendance & training hours</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Navigation */}
            <nav className="grid grid-cols-2 md:flex gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-2xl shadow-lg flex-1 md:flex-none">
              {navItems.map(({ id, label, icon: Icon }) => {
                const shouldPulse = id === "settings" && isNewAccount;
                return (
                  <button
                    key={id}
                    onClick={() => setActivePage(id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                      activePage === id
                        ? "bg-blue-600 text-white shadow-md"
                        : shouldPulse
                        ? "text-blue-600 bg-blue-50 border border-blue-200 shadow-md shadow-blue-500/10 animate-pulse hover:bg-blue-100"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className={`size-4 ${shouldPulse ? "text-blue-500" : ""}`} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Log out"
              className="flex items-center justify-center p-3 size-12 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg text-gray-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all border border-transparent hover:border-red-100"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>

        {/* Leaderboard Ticker */}
        <LeaderboardTicker onNavigate={setActivePage} />

        {/* Page Content */}
        <main className="animate-fade-in">
          {activePage === "launch" && <LaunchPage onNavigate={setActivePage} />}
          {activePage === "attendance" && <AttendancePage />}
          {activePage === "summary" && <SummaryPage />}
          {activePage === "raffle" && <RafflePage />}
          {activePage === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TeamStoreProvider>
      <AppContent />
      <Toaster />
    </TeamStoreProvider>
  );
}
