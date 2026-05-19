import { useState } from "react";
import { Trophy, Calendar, Users, Settings as SettingsIcon, Gift, Lock, LogOut } from "lucide-react";
import LaunchPage from "./components/LaunchPage";
import AttendancePage from "./components/AttendancePage";
import SummaryPage from "./components/SummaryPage";
import SettingsPage from "./components/SettingsPage";
import RafflePage from "./components/RafflePage";
import LeaderboardTicker from "./components/LeaderboardTicker";
import { TeamStoreProvider, useTeamStore } from "./hooks/useTeamStore";

type Page = "launch" | "attendance" | "summary" | "settings" | "raffle";

function PasscodeLogin() {
  const { login, authError } = useTeamStore();
  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    setIsSubmitting(true);
    await login(passcode);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl space-y-8 animate-fade-in text-white">
        <div className="text-center space-y-3">
          <div className="relative size-16 mx-auto flex items-center justify-center rounded-2xl bg-white/20 border border-white/30 shadow-lg overflow-hidden">
            <Lock className="size-8 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Kaizen Tracker</h2>
          <p className="text-white/80 text-sm">Enter passcode to access team attendance and hours.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <input
              type="password"
              placeholder="••••••••"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-center text-2xl font-bold tracking-widest placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition-all text-white disabled:opacity-50"
              autoFocus
            />
          </div>

          {authError && (
            <p className="text-red-300 text-sm font-semibold text-center bg-red-950/30 py-2 px-3 rounded-xl border border-red-900/30">
              {authError.toLowerCase().includes("invalid login credentials")
                ? "Incorrect passcode. Please try again."
                : authError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !passcode}
            className="w-full py-4 bg-gradient-to-r from-yellow-300 to-orange-400 text-orange-950 font-bold rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="size-5 border-2 border-orange-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              "Unlock Application"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppContent() {
  const [activePage, setActivePage] = useState<Page>("launch");
  const { state, isLoading, isAuthenticated, isAuthLoading, logout } = useTeamStore();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-semibold">Establishing connection…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PasscodeLogin />;
  }

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
                {state.teamName || "Kaizen Tracker"}
              </h1>
              <p className="text-sm text-gray-600">Attendance & training hours</p>
            </div>
          </div>

          {/* Navigation & Logout */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/80 backdrop-blur-sm p-2 rounded-2xl shadow-lg">
            <nav className="grid grid-cols-2 md:flex gap-2">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActivePage(id)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                    activePage === id
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </nav>
            <div className="hidden md:block w-px h-8 bg-gray-200" />
            <button
              onClick={logout}
              title="Lock application"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all border border-transparent hover:border-red-100 cursor-pointer"
            >
              <LogOut className="size-4" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Leaderboard Ticker */}
        <LeaderboardTicker />

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
    </TeamStoreProvider>
  );
}
