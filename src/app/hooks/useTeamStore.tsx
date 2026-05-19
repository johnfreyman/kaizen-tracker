import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

const LOCAL_STORAGE_KEY = "kaizenTrackerState";

export interface TeamEvent {
  id: string;
  date: string;
  type: "Practice" | "Optional Training";
  duration: number;
  players: string[];
  savedAt: string;
}

export interface ActiveSession {
  id: string;
  date: string;
  type: "Practice" | "Optional Training";
  duration: number;
}

export interface ArchivedEventSet {
  id: string;
  archivedAt: string;
  events: TeamEvent[];
}

export interface TeamState {
  teamName: string;
  teamLogo: string;
  roster: string[];
  events: TeamEvent[];
  activeSession: ActiveSession | null;
  raffleEnabled: boolean;
  archivedEvents: ArchivedEventSet[];
  guestPlayers: string[];
}

const defaultState: TeamState = {
  teamName: "Kaizen Tracker",
  teamLogo: "",
  roster: [
    "Ben Freyman",
    "Bradley Hsi",
    "Crew Stephens",
    "Kailil Green",
    "Kaiyin Ramirez",
    "Mason Bailey",
    "Matteo Bailey",
    "Moses Boyd"
  ],
  events: [],
  activeSession: null,
  raffleEnabled: false,
  archivedEvents: [],
  guestPlayers: [],
};

function readLocalState(): TeamState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(saved) };
  } catch {
    return { ...defaultState };
  }
}

async function seedSupabase(s: TeamState) {
  await supabase.from("team_settings").upsert({
    id: 1,
    team_name: s.teamName,
    team_logo: s.teamLogo,
    raffle_enabled: s.raffleEnabled,
  });

  if (s.roster.length > 0) {
    await supabase.from("roster").upsert(
      s.roster.map((name) => ({ name, is_guest: s.guestPlayers.includes(name) }))
    );
  }

  if (s.events.length > 0) {
    await supabase.from("events").upsert(
      s.events.map((e) => ({
        id: e.id,
        date: e.date,
        type: e.type,
        duration: e.duration,
        players: e.players,
        saved_at: e.savedAt,
      }))
    );
  }

  if (s.activeSession) {
    await supabase.from("active_session").upsert({
      lock_id: 1,
      id: s.activeSession.id,
      date: s.activeSession.date,
      type: s.activeSession.type,
      duration: s.activeSession.duration,
    });
  }

  if (s.archivedEvents.length > 0) {
    await supabase.from("archived_event_sets").upsert(
      s.archivedEvents.map((a) => ({
        id: a.id,
        archived_at: a.archivedAt,
        events: a.events,
      }))
    );
  }
}

async function loadFromSupabase(): Promise<TeamState> {
  const [settingsRes, rosterRes, eventsRes, sessionRes, archivesRes] = await Promise.all([
    supabase.from("team_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("roster").select("*"),
    supabase.from("events").select("*").order("saved_at", { ascending: false }),
    supabase.from("active_session").select("*").eq("lock_id", 1).maybeSingle(),
    supabase.from("archived_event_sets").select("*").order("archived_at", { ascending: false }),
  ]);

  // First run — no settings row yet: migrate localStorage data into Supabase
  if (!settingsRes.data) {
    const local = readLocalState();
    await seedSupabase(local);
    return local;
  }

  const settings = settingsRes.data;
  const roster: { name: string; is_guest: boolean }[] = rosterRes.data ?? [];
  const events: {
    id: string; date: string; type: string;
    duration: number; players: string[]; saved_at: string;
  }[] = eventsRes.data ?? [];
  const session = sessionRes.data as {
    id: string; date: string; type: string; duration: number;
  } | null;
  const archives: { id: string; archived_at: string; events: TeamEvent[] }[] =
    archivesRes.data ?? [];

  return {
    teamName: settings.team_name,
    teamLogo: settings.team_logo,
    raffleEnabled: settings.raffle_enabled,
    roster: roster.map((r) => r.name),
    guestPlayers: roster.filter((r) => r.is_guest).map((r) => r.name),
    events: events.map((e) => ({
      id: e.id,
      date: e.date,
      type: e.type as "Practice" | "Optional Training",
      duration: e.duration,
      players: e.players,
      savedAt: e.saved_at,
    })),
    activeSession: session
      ? {
          id: session.id,
          date: session.date,
          type: session.type as "Practice" | "Optional Training",
          duration: session.duration,
        }
      : null,
    archivedEvents: archives.map((a) => ({
      id: a.id,
      archivedAt: a.archived_at,
      events: a.events,
    })),
  };
}

interface TeamStoreContextType {
  state: TeamState;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  login: (passcode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  startSession: (session: ActiveSession) => void;
  saveSession: (presentPlayers: string[]) => void;
  addPlayer: (name: string, isGuest?: boolean) => boolean;
  removePlayer: (name: string) => void;
  updateSettings: (settings: { teamName?: string; teamLogo?: string; raffleEnabled?: boolean }) => void;
  archiveEvents: () => void;
  restoreArchive: (archiveId: string) => void;
  deleteArchive: (archiveId: string) => void;
  editLastSession: () => TeamEvent | null;
  isGuest: (playerName: string) => boolean;
}

const TeamStoreContext = createContext<TeamStoreContextType | null>(null);

export function TeamStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeamState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setIsLoading(true);
    loadFromSupabase()
      .then((data) => {
        setState(data);
      })
      .catch((err) => {
        console.error("Failed to load data from Supabase:", err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (passcode: string): Promise<boolean> => {
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState(defaultState);
  };

  const updateState = (updates: Partial<TeamState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const startSession = (session: ActiveSession) => {
    updateState({ activeSession: session });
    Promise.resolve(
      supabase
        .from("active_session")
        .upsert({ lock_id: 1, id: session.id, date: session.date, type: session.type, duration: session.duration })
    ).catch(console.error);
  };

  const saveSession = (presentPlayers: string[]) => {
    const current = stateRef.current;
    if (!current.activeSession) return;

    const event: TeamEvent = {
      ...current.activeSession,
      players: presentPlayers,
      savedAt: new Date().toISOString(),
    };

    updateState({ events: [event, ...current.events], activeSession: null });

    Promise.all([
      supabase.from("events").insert({
        id: event.id,
        date: event.date,
        type: event.type,
        duration: event.duration,
        players: event.players,
        saved_at: event.savedAt,
      }),
      supabase.from("active_session").delete().eq("lock_id", 1),
    ]).catch(console.error);
  };

  const addPlayer = (name: string, isGuest = false): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const current = stateRef.current;
    if (current.roster.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return false;

    const newRoster = [...current.roster, trimmed].sort((a, b) => a.localeCompare(b));
    updateState({
      roster: newRoster,
      guestPlayers: isGuest ? [...current.guestPlayers, trimmed] : current.guestPlayers,
    });
    Promise.resolve(
      supabase.from("roster").insert({ name: trimmed, is_guest: isGuest })
    ).catch(console.error);
    return true;
  };

  const removePlayer = (name: string) => {
    const current = stateRef.current;
    updateState({
      roster: current.roster.filter((p) => p !== name),
      guestPlayers: current.guestPlayers.filter((p) => p !== name),
    });
    Promise.resolve(
      supabase.from("roster").delete().eq("name", name)
    ).catch(console.error);
  };

  const isGuest = (playerName: string) => stateRef.current.guestPlayers.includes(playerName);

  const updateSettings = (settings: { teamName?: string; teamLogo?: string; raffleEnabled?: boolean }) => {
    const current = stateRef.current;
    updateState(settings);
    Promise.resolve(
      supabase.from("team_settings").upsert({
        id: 1,
        team_name: settings.teamName ?? current.teamName,
        team_logo: settings.teamLogo ?? current.teamLogo,
        raffle_enabled: settings.raffleEnabled ?? current.raffleEnabled,
      })
    ).catch(console.error);
  };

  const archiveEvents = () => {
    const current = stateRef.current;
    if (current.events.length === 0) return;

    const archive: ArchivedEventSet = {
      id: crypto.randomUUID(),
      archivedAt: new Date().toISOString(),
      events: [...current.events],
    };

    updateState({ events: [], archivedEvents: [archive, ...current.archivedEvents] });

    const eventIds = current.events.map((e) => e.id);
    Promise.all([
      supabase.from("archived_event_sets").insert({
        id: archive.id,
        archived_at: archive.archivedAt,
        events: archive.events,
      }),
      supabase.from("events").delete().in("id", eventIds),
    ]).catch(console.error);
  };

  const restoreArchive = (archiveId: string) => {
    const current = stateRef.current;
    const archive = current.archivedEvents.find((a) => a.id === archiveId);
    if (!archive) return;

    updateState({
      events: [...archive.events, ...current.events],
      archivedEvents: current.archivedEvents.filter((a) => a.id !== archiveId),
    });

    Promise.all([
      supabase.from("events").upsert(
        archive.events.map((e) => ({
          id: e.id,
          date: e.date,
          type: e.type,
          duration: e.duration,
          players: e.players,
          saved_at: e.savedAt,
        }))
      ),
      supabase.from("archived_event_sets").delete().eq("id", archiveId),
    ]).catch(console.error);
  };

  const deleteArchive = (archiveId: string) => {
    const current = stateRef.current;
    updateState({ archivedEvents: current.archivedEvents.filter((a) => a.id !== archiveId) });
    Promise.resolve(
      supabase.from("archived_event_sets").delete().eq("id", archiveId)
    ).catch(console.error);
  };

  const editLastSession = (): TeamEvent | null => {
    const current = stateRef.current;
    if (current.events.length === 0) return null;

    const lastEvent = current.events[0];
    const session: ActiveSession = {
      id: lastEvent.id,
      date: lastEvent.date,
      type: lastEvent.type,
      duration: lastEvent.duration,
    };

    updateState({ events: current.events.slice(1), activeSession: session });

    Promise.all([
      supabase.from("events").delete().eq("id", lastEvent.id),
      supabase.from("active_session").upsert({
        lock_id: 1,
        id: session.id,
        date: session.date,
        type: session.type,
        duration: session.duration,
      }),
    ]).catch(console.error);

    return lastEvent;
  };

  return (
    <TeamStoreContext.Provider
      value={{
        state,
        isLoading,
        isAuthenticated,
        isAuthLoading,
        authError,
        login,
        logout,
        startSession,
        saveSession,
        addPlayer,
        removePlayer,
        updateSettings,
        archiveEvents,
        restoreArchive,
        deleteArchive,
        editLastSession,
        isGuest,
      }}
    >
      {children}
    </TeamStoreContext.Provider>
  );
}

export function useTeamStore() {
  const context = useContext(TeamStoreContext);
  if (!context) throw new Error("useTeamStore must be used within TeamStoreProvider");
  return context;
}
