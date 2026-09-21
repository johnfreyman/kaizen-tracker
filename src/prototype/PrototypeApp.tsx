/**
 * Stage 2 prototype shell.
 *
 * Isolated on purpose: this file is only reachable from /prototype.html on a
 * local dev server. It is not imported by src/app/App.tsx, it adds no route to
 * the working app, and `vite build` does not emit it because index.html is
 * still the only build input. Nothing here touches Supabase, the
 * admin-coach-actions backend or any authorization path.
 */

import { useEffect, useState } from "react";
import { FlaskConical, Home, Settings as SettingsIcon, TrendingUp, Users, Gift } from "lucide-react";
import { ThemeProvider, useTheme } from "@/app/hooks/useTheme";
import { Pill } from "./components/ui";
import { PrototypeStoreProvider, usePrototypeStore } from "./store";
import { SCENARIOS } from "./fixtures";
import HomeScreen from "./screens/HomeScreen";
import AttendanceScreen from "./screens/AttendanceScreen";
import KioskScreen from "./screens/KioskScreen";
import RosterScreen from "./screens/RosterScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProgressScreen from "./screens/ProgressScreen";
import RaffleScreen from "./screens/RaffleScreen";

export type ScreenId = "home" | "attendance" | "kiosk" | "roster" | "settings" | "progress" | "raffle";

const NAV: { id: ScreenId; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "roster", label: "Roster", Icon: Users },
  { id: "progress", label: "Progress", Icon: TrendingUp },
  { id: "raffle", label: "Raffle", Icon: Gift },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

function Shell() {
  const { state, actions } = usePrototypeStore();
  const { resolved } = useTheme();
  const [screen, setScreen] = useState<ScreenId>("home");

  /* Kiosk survives a refresh while its bound session is still active. */
  useEffect(() => {
    if (state.kioskSessionId && state.activeSession?.id === state.kioskSessionId) {
      setScreen("kiosk");
    }
  }, [state.kioskSessionId, state.activeSession?.id]);

  const inKiosk = screen === "kiosk" && state.kioskSessionId !== null;

  /* Coach navigation, shortcuts and swipe are all absent while the kiosk is up. */
  if (inKiosk) {
    return (
      <div className={resolved === "light" ? "mc-light" : "dark"}>
        <KioskScreen
          onExit={() => {
            actions.exitKiosk();
            setScreen("attendance");
          }}
        />
      </div>
    );
  }

  return (
    <div className={resolved === "light" ? "mc-light" : "dark"}>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--mc-bg)" }}>
        <DevBanner />
        {state.localPersistenceFailed && <PersistenceFailureBanner />}

        <header
          className="sticky top-0 z-30 border-b mc-border backdrop-blur-sm"
          style={{ backgroundColor: "color-mix(in srgb, var(--mc-bg) 92%, transparent)" }}
        >
          <nav aria-label="Prototype" className="mx-auto max-w-5xl flex gap-1 overflow-x-auto px-3 py-2">
            {NAV.filter((n) => n.id !== "raffle" || state.raffleEnabled).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={screen === id ? "page" : undefined}
                onClick={() => setScreen(id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 min-h-11 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  screen === id ? "mc-nav-active" : "mc-text-secondary hover:mc-text"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl p-4 md:p-6 pb-24">
          {screen === "home" && <HomeScreen go={setScreen} />}
          {screen === "attendance" && <AttendanceScreen go={setScreen} />}
          {screen === "roster" && <RosterScreen />}
          {screen === "progress" && <ProgressScreen />}
          {screen === "raffle" && <RaffleScreen />}
          {screen === "settings" && <SettingsScreen />}
        </main>

        {state.lastFinished && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t mc-border p-4" style={{ backgroundColor: "var(--mc-surface)" }}>
            <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm mc-text">
                <strong className="font-bold">Attendance saved.</strong>{" "}
                <span className="mc-text-secondary">{state.lastFinished.summary}</span>
              </p>
              <button
                type="button"
                onClick={actions.dismissSummary}
                className="min-h-11 rounded-lg border mc-border px-4 text-sm font-semibold mc-text-secondary hover:mc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dev-only controls. These exist so a reviewer can reach the edge states the
 * spec asks to see without a backend: they are not product surfaces and would
 * not ship.
 */
function DevBanner() {
  const { state, actions } = usePrototypeStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="mx-auto max-w-5xl px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <FlaskConical className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            Stage 2 prototype · fixture data only · no database, no production
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto min-h-9 rounded-lg border border-amber-500/40 px-3 text-xs font-bold text-amber-700 dark:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {open ? "Hide" : "Walkthrough controls"}
          </button>
        </div>

        {open && (
          <div className="mt-3 space-y-3 pb-1">
            <Row label="Roster fixture">
              {SCENARIOS.map((s) => (
                <DevChip
                  key={s.id}
                  active={state.scenario === s.id}
                  onClick={() => actions.reset(s.id)}
                  title={s.blurb}
                >
                  {s.name}
                </DevChip>
              ))}
            </Row>

            <Row label="Network">
              {(["online", "offline", "failing"] as const).map((m) => (
                <DevChip key={m} active={state.networkMode === m} onClick={() => actions.setNetwork(m)}>
                  {m === "online" ? "Online" : m === "offline" ? "Offline (pending save)" : "Save fails"}
                </DevChip>
              ))}
            </Row>

            <Row label="Conflicts">
              <DevChip
                active={false}
                onClick={actions.closeElsewhere}
                disabled={!state.activeSession}
              >
                Finish this session on another device
              </DevChip>
            </Row>

            <Row label="Storage">
              <DevChip
                active={!state.simulateStorageFailure}
                onClick={() => actions.setSimulateStorageFailure(false)}
              >
                OK
              </DevChip>
              <DevChip
                active={state.simulateStorageFailure}
                onClick={() => actions.setSimulateStorageFailure(true)}
                title="A refresh while this is on reverts to the last successful save, including this toggle — the same risk a real quota/private-browsing failure carries."
              >
                Simulate save failure
              </DevChip>
            </Row>

            <div className="flex flex-wrap gap-2 pt-1">
              <Pill>{state.players.filter((p) => !p.retired).length} players</Pill>
              <Pill>{state.sessions.length} finalized sessions</Pill>
              <Pill>{state.subTeams.filter((t) => t.active).length} sub-teams</Pill>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Replaces the silent swallow that used to sit under "Saved on this device"
 * (audit limits section): a local write actually failed, so this is shown
 * instead of quietly claiming the save succeeded.
 */
function PersistenceFailureBanner() {
  return (
    <div className="border-b border-red-500/30 bg-red-500/10" role="alert">
      <div className="mx-auto max-w-5xl px-4 py-2.5">
        <p className="text-xs font-semibold text-red-700 dark:text-red-300">
          This device could not save your latest changes locally — storage may be full or private
          browsing is blocking it. Keep this tab open; changes only exist in memory until it
          recovers.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-widest text-amber-700/80 dark:text-amber-300/80">
        {label}
      </span>
      {children}
    </div>
  );
}

function DevChip({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active
          ? "border-amber-600 bg-amber-500/25 text-amber-800 dark:text-amber-200"
          : "border-amber-500/30 text-amber-700/90 dark:text-amber-300/90 hover:bg-amber-500/15"
      }`}
    >
      {children}
    </button>
  );
}

export default function PrototypeApp() {
  return (
    <ThemeProvider>
      <PrototypeStoreProvider>
        <Shell />
      </PrototypeStoreProvider>
    </ThemeProvider>
  );
}
