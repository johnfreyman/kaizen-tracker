import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "kaizenTrackerState";

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

function loadState(): TeamState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(saved) };
  } catch {
    return { ...defaultState };
  }
}

function saveState(state: TeamState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface TeamStoreContextType {
  state: TeamState;
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
  const [state, setState] = useState<TeamState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updateState = (updates: Partial<TeamState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const startSession = (session: ActiveSession) => {
    updateState({ activeSession: session });
  };

  const saveSession = (presentPlayers: string[]) => {
    if (!state.activeSession) return;

    const event: TeamEvent = {
      ...state.activeSession,
      players: presentPlayers,
      savedAt: new Date().toISOString(),
    };

    updateState({
      events: [event, ...state.events],
      activeSession: null,
    });
  };

  const addPlayer = (name: string, isGuest: boolean = false) => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const exists = state.roster.some(
      (p) => p.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return false;

    const newRoster = [...state.roster, trimmed].sort((a, b) =>
      a.localeCompare(b)
    );

    const newGuestPlayers = isGuest
      ? [...state.guestPlayers, trimmed]
      : state.guestPlayers;

    updateState({
      roster: newRoster,
      guestPlayers: newGuestPlayers
    });
    return true;
  };

  const removePlayer = (name: string) => {
    updateState({
      roster: state.roster.filter((p) => p !== name),
      guestPlayers: state.guestPlayers.filter((p) => p !== name),
    });
  };

  const isGuest = (playerName: string) => {
    return state.guestPlayers.includes(playerName);
  };

  const updateSettings = (settings: { teamName?: string; teamLogo?: string; raffleEnabled?: boolean }) => {
    updateState(settings);
  };

  const archiveEvents = () => {
    if (state.events.length === 0) return;

    const archive: ArchivedEventSet = {
      id: crypto.randomUUID(),
      archivedAt: new Date().toISOString(),
      events: [...state.events],
    };

    updateState({
      events: [],
      archivedEvents: [archive, ...state.archivedEvents],
    });
  };

  const restoreArchive = (archiveId: string) => {
    const archive = state.archivedEvents.find((a) => a.id === archiveId);
    if (!archive) return;

    updateState({
      events: [...archive.events, ...state.events],
      archivedEvents: state.archivedEvents.filter((a) => a.id !== archiveId),
    });
  };

  const deleteArchive = (archiveId: string) => {
    updateState({
      archivedEvents: state.archivedEvents.filter((a) => a.id !== archiveId),
    });
  };

  const editLastSession = (): TeamEvent | null => {
    if (state.events.length === 0) return null;

    const lastEvent = state.events[0];
    const remainingEvents = state.events.slice(1);

    // Convert the event back to an active session
    const session: ActiveSession = {
      id: lastEvent.id,
      date: lastEvent.date,
      type: lastEvent.type,
      duration: lastEvent.duration,
    };

    updateState({
      events: remainingEvents,
      activeSession: session,
    });

    return lastEvent;
  };

  return (
    <TeamStoreContext.Provider
      value={{
        state,
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
  if (!context) {
    throw new Error("useTeamStore must be used within TeamStoreProvider");
  }
  return context;
}
