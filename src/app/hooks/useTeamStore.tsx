import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const EVENT_TYPES = {
  PRACTICE: "Practice",
  OPTIONAL_TRAINING: "Optional Training",
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export function isEventType(value: unknown): value is EventType {
  return value === EVENT_TYPES.PRACTICE || value === EVENT_TYPES.OPTIONAL_TRAINING;
}

export interface TeamEvent {
  id: string;
  date: string;
  type: EventType;
  duration: number;
  players: string[];
  savedAt: string;
}

export interface ActiveSession {
  id: string;
  date: string;
  type: EventType;
  duration: number;
}

export interface ArchivedEventSet {
  id: string;
  archivedAt: string;
  events: TeamEvent[];
}

export type ConflictResolutionStrategy = "overwrite" | "skip" | "error";


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
  teamName: "Team Name",
  teamLogo: "",
  roster: [],
  events: [],
  activeSession: null,
  raffleEnabled: false,
  archivedEvents: [],
  guestPlayers: [],
};

async function checkSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function loadFromSupabase(userId: string): Promise<{ state: TeamState; isNewCoach: boolean }> {
  const [settingsRes, rosterRes, eventsRes, sessionRes, archivesRes] = await Promise.all([
    supabase.from("team_settings").select("*").eq("coach_id", userId).maybeSingle(),
    supabase.from("roster").select("*").eq("coach_id", userId),
    supabase.from("events").select("*").eq("coach_id", userId).order("saved_at", { ascending: false }),
    supabase.from("active_session").select("*").eq("coach_id", userId).maybeSingle(),
    supabase.from("archived_event_sets").select("*").eq("coach_id", userId).order("archived_at", { ascending: false }),
  ]);

  if (!settingsRes.data) {
    return { state: { ...defaultState }, isNewCoach: true };
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
    state: {
      teamName: settings.team_name,
      teamLogo: settings.team_logo,
      raffleEnabled: settings.raffle_enabled,
      roster: roster.map((r) => r.name),
      guestPlayers: roster.filter((r) => r.is_guest).map((r) => r.name),
      events: events.map((e) => ({
        id: e.id,
        date: e.date,
        type: isEventType(e.type) ? e.type : EVENT_TYPES.PRACTICE,
        duration: e.duration,
        players: e.players,
        savedAt: e.saved_at,
      })),
      activeSession: session
        ? {
            id: session.id,
            date: session.date,
            type: isEventType(session.type) ? session.type : EVENT_TYPES.PRACTICE,
            duration: session.duration,
          }
        : null,
      archivedEvents: archives.map((a) => ({
        id: a.id,
        archivedAt: a.archived_at,
        events: a.events,
      })),
    },
    isNewCoach: false,
  };
}

interface TeamStoreContextType {
  state: TeamState;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  isNewCoach: boolean;
  isPasswordRecovery: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  startSession: (session: ActiveSession) => Promise<void>;
  saveSession: (presentPlayers: string[]) => Promise<void>;
  addPlayer: (name: string, isGuest?: boolean) => Promise<boolean>;
  removePlayer: (name: string) => Promise<void>;
  updateSettings: (settings: { teamName?: string; teamLogo?: string; raffleEnabled?: boolean }) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  archiveEvents: (options?: { type?: EventType }) => Promise<boolean>;
  restoreArchive: (archiveId: string, strategy?: ConflictResolutionStrategy) => Promise<void>;
  deleteArchive: (archiveId: string) => Promise<void>;
  editLastSession: () => TeamEvent | null;
  isGuest: (playerName: string) => boolean;
  completeOnboarding: () => void;
}

const TeamStoreContext = createContext<TeamStoreContextType | null>(null);

export function TeamStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeamState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isNewCoach, setIsNewCoach] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const stateRef = useRef(state);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let subscription: any = null;

    const initAuth = async () => {
      setIsLoading(true);
      setIsAuthLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const hasSession = !!session;
        currentUserIdRef.current = session?.user?.id ?? null;
        setIsAuthenticated(hasSession);
        
        if (hasSession && currentUserIdRef.current) {
          const superAdmin = await checkSuperAdmin(currentUserIdRef.current);
          setIsSuperAdmin(superAdmin);
          if (!superAdmin) {
            const { state: data, isNewCoach: newCoach } = await loadFromSupabase(currentUserIdRef.current);
            setState(data);
            setIsNewCoach(newCoach);
          }
        } else {
          setState(defaultState);
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error("Failed to initialize session data:", err);
      } finally {
        setIsAuthLoading(false);
        setIsLoading(false);
      }

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        const hasSession = !!newSession;
        const newUserId = newSession?.user?.id ?? null;

        if (event === 'PASSWORD_RECOVERY') {
          currentUserIdRef.current = newUserId;
          setIsAuthenticated(true);
          setIsPasswordRecovery(true);
          setIsLoading(false);
          setIsAuthLoading(false);
          return;
        }

        // Only trigger the load / loading screen if the authenticated user has actually changed.
        // This avoids redundant loading transitions on token refresh, background sync, or window focus events.
        const isUserChanged = newUserId !== currentUserIdRef.current;

        if (isUserChanged) {
          currentUserIdRef.current = newUserId;
          setIsAuthenticated(hasSession);
          setAuthError(null);
          
          if (hasSession && newUserId) {
            setIsLoading(true);
            try {
              const superAdmin = await checkSuperAdmin(newUserId);
              setIsSuperAdmin(superAdmin);
              if (!superAdmin) {
                const { state: data, isNewCoach: newCoach } = await loadFromSupabase(newUserId);
                setState(data);
                setIsNewCoach(newCoach);
              }
            } catch (err) {
              console.error("Failed to load data on auth change:", err);
            } finally {
              setIsLoading(false);
            }
          } else {
            setState(defaultState);
            setIsSuperAdmin(false);
            setIsLoading(false);
          }
        }
      });
      subscription = sub;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      }
      return true;
    } catch (err: any) {
      setAuthError(err.message || "An authentication error occurred.");
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<boolean> => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      return true;
    } catch (err: any) {
      setAuthError(err.message || "A registration error occurred.");
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState(defaultState);
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (currentUserIdRef.current) {
        const { state: data, isNewCoach: newCoach } = await loadFromSupabase(currentUserIdRef.current);
        setState(data);
        setIsNewCoach(newCoach);
      }
      setIsPasswordRecovery(false);
      toast.success("Password updated successfully.");
      return true;
    } catch (err: any) {
      console.error("Failed to update password:", err);
      toast.error(`Failed to update password: ${err.message || "Unknown error"}`);
      return false;
    }
  };

  const updateState = (updates: Partial<TeamState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const startSession = async (session: ActiveSession) => {
    const previousSession = stateRef.current.activeSession;
    updateState({ activeSession: session });
    try {
      const { error } = await supabase
        .from("active_session")
        .upsert(
          { coach_id: currentUserIdRef.current, id: session.id, date: session.date, type: session.type, duration: session.duration },
          { onConflict: 'coach_id' }
        );
      if (error) throw error;
      toast.success("Session started successfully.");
    } catch (err: any) {
      console.error("Failed to start session:", err);
      updateState({ activeSession: previousSession });
      toast.error(`Failed to start session: ${err.message || "Unknown error"}`);
    }
  };

  const saveSession = async (presentPlayers: string[]) => {
    const current = stateRef.current;
    if (!current.activeSession) return;

    const previousEvents = current.events;
    const previousActiveSession = current.activeSession;

    const event: TeamEvent = {
      ...current.activeSession,
      players: presentPlayers,
      savedAt: new Date().toISOString(),
    };

    updateState({ events: [event, ...current.events], activeSession: null });

    try {
      const [insertRes, deleteRes] = await Promise.all([
        supabase.from("events").insert({
          coach_id: currentUserIdRef.current,
          id: event.id,
          date: event.date,
          type: event.type,
          duration: event.duration,
          players: event.players,
          saved_at: event.savedAt,
        }),
        supabase.from("active_session").delete().eq("coach_id", currentUserIdRef.current),
      ]);

      if (insertRes.error) throw insertRes.error;
      if (deleteRes.error) throw deleteRes.error;

      toast.success("Session saved successfully.");
    } catch (err: any) {
      console.error("Failed to save session:", err);
      updateState({ events: previousEvents, activeSession: previousActiveSession });
      toast.error(`Failed to save session: ${err.message || "Unknown error"}`);
    }
  };

  const addPlayer = async (name: string, isGuest = false): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const current = stateRef.current;
    if (current.roster.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return false;

    const previousRoster = current.roster;
    const previousGuestPlayers = current.guestPlayers;

    const newRoster = [...current.roster, trimmed].sort((a, b) => a.localeCompare(b));
    updateState({
      roster: newRoster,
      guestPlayers: isGuest ? [...current.guestPlayers, trimmed] : current.guestPlayers,
    });

    try {
      const { error } = await supabase.from("roster").insert({ coach_id: currentUserIdRef.current, name: trimmed, is_guest: isGuest });
      if (error) throw error;
      toast.success(`${trimmed} added to roster.`);
      return true;
    } catch (err: any) {
      console.error("Failed to add player to database:", err);
      updateState({ roster: previousRoster, guestPlayers: previousGuestPlayers });
      toast.error(`Failed to add player: ${err.message || "Unknown error"}`);
      return false;
    }
  };

  const removePlayer = async (name: string) => {
    const current = stateRef.current;
    const previousRoster = current.roster;
    const previousGuestPlayers = current.guestPlayers;

    updateState({
      roster: current.roster.filter((p) => p !== name),
      guestPlayers: current.guestPlayers.filter((p) => p !== name),
    });

    try {
      const { error } = await supabase.from("roster").delete().eq("name", name);
      if (error) throw error;
      toast.success(`${name} removed from roster.`);
    } catch (err: any) {
      console.error("Failed to remove player:", err);
      updateState({ roster: previousRoster, guestPlayers: previousGuestPlayers });
      toast.error(`Failed to remove player: ${err.message || "Unknown error"}`);
    }
  };

  const isGuest = (playerName: string) => stateRef.current.guestPlayers.includes(playerName);

  const updateSettings = async (settings: { teamName?: string; teamLogo?: string; raffleEnabled?: boolean }) => {
    const current = stateRef.current;
    const previousSettings = {
      teamName: current.teamName,
      teamLogo: current.teamLogo,
      raffleEnabled: current.raffleEnabled,
    };

    updateState(settings);

    try {
      const { error } = await supabase.from("team_settings").upsert(
        {
          coach_id: currentUserIdRef.current,
          team_name: settings.teamName ?? current.teamName,
          team_logo: settings.teamLogo ?? current.teamLogo,
          raffle_enabled: settings.raffleEnabled ?? current.raffleEnabled,
        },
        { onConflict: 'coach_id' }
      );
      if (error) throw error;
      toast.success("Settings updated.");
    } catch (err: any) {
      console.error("Failed to update settings:", err);
      updateState(previousSettings);
      toast.error(`Failed to update settings: ${err.message || "Unknown error"}`);
    }
  };

  const archiveEvents = async (options?: { type?: EventType }): Promise<boolean> => {
    const current = stateRef.current;
    const eventsToArchive = options?.type
      ? current.events.filter((e) => e.type === options.type)
      : current.events;

    if (eventsToArchive.length === 0) return false;

    const previousEvents = current.events;
    const previousArchivedEvents = current.archivedEvents;

    const remainingEvents = options?.type
      ? current.events.filter((e) => e.type !== options.type)
      : [];

    const archive: ArchivedEventSet = {
      id: crypto.randomUUID(),
      archivedAt: new Date().toISOString(),
      events: [...eventsToArchive],
    };

    updateState({ events: remainingEvents, archivedEvents: [archive, ...current.archivedEvents] });

    const eventIds = eventsToArchive.map((e) => e.id);
    try {
      const insertRes = await supabase.from("archived_event_sets").insert({
        coach_id: currentUserIdRef.current,
        id: archive.id,
        archived_at: archive.archivedAt,
        events: archive.events,
      });
      if (insertRes.error) throw insertRes.error;

      const deleteRes = await supabase.from("events").delete().in("id", eventIds);
      if (deleteRes.error) throw deleteRes.error;

      toast.success("Events archived successfully.");
      return true;
    } catch (err: any) {
      console.error("Failed to archive events:", err);
      updateState({ events: previousEvents, archivedEvents: previousArchivedEvents });
      toast.error(`Failed to archive events: ${err.message || "Unknown error"}`);
      return false;
    }
  };

  const restoreArchive = async (archiveId: string, strategy: ConflictResolutionStrategy = "overwrite") => {
    const current = stateRef.current;
    const archive = current.archivedEvents.find((a) => a.id === archiveId);
    if (!archive) return;

    const previousEvents = current.events;
    const previousArchivedEvents = current.archivedEvents;

    // Check for ID conflicts
    const currentEventIds = new Set(current.events.map((e) => e.id));
    const conflictingEvents = archive.events.filter((e) => currentEventIds.has(e.id));

    if (conflictingEvents.length > 0 && strategy === "error") {
      toast.error(`Restore aborted: Found ${conflictingEvents.length} duplicate event ID(s).`);
      return;
    }

    let eventsToRestore = [...archive.events];
    let mergedEventsList: TeamEvent[] = [];

    if (strategy === "skip") {
      eventsToRestore = archive.events.filter((e) => !currentEventIds.has(e.id));
      mergedEventsList = [...eventsToRestore, ...current.events];
    } else {
      // overwrite (last-write-wins)
      const currentEventsMap = new Map(current.events.map((e) => [e.id, e]));
      eventsToRestore.forEach((e) => {
        currentEventsMap.set(e.id, e); // overwrites the existing active event
      });
      mergedEventsList = Array.from(currentEventsMap.values());
    }

    // Sort by savedAt descending to maintain perfect display order
    mergedEventsList.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

    updateState({
      events: mergedEventsList,
      archivedEvents: current.archivedEvents.filter((a) => a.id !== archiveId),
    });

    try {
      if (eventsToRestore.length > 0) {
        const [upsertRes, deleteRes] = await Promise.all([
          supabase.from("events").upsert(
            eventsToRestore.map((e) => ({
              coach_id: currentUserIdRef.current,
              id: e.id,
              date: e.date,
              type: e.type,
              duration: e.duration,
              players: e.players,
              saved_at: e.savedAt,
            })),
            { onConflict: "id" }
          ),
          supabase.from("archived_event_sets").delete().eq("id", archiveId),
        ]);

        if (upsertRes.error) throw upsertRes.error;
        if (deleteRes.error) throw deleteRes.error;
      } else {
        // Nothing to upsert (e.g. all skipped), just delete the archive set
        const { error } = await supabase.from("archived_event_sets").delete().eq("id", archiveId);
        if (error) throw error;
      }

      toast.success("Archive restored successfully.");
    } catch (err: any) {
      console.error("Failed to restore archive:", err);
      updateState({ events: previousEvents, archivedEvents: previousArchivedEvents });
      toast.error(`Failed to restore archive: ${err.message || "Unknown error"}`);
    }
  };

  const deleteArchive = async (archiveId: string) => {
    const current = stateRef.current;
    const previousArchivedEvents = current.archivedEvents;

    updateState({ archivedEvents: current.archivedEvents.filter((a) => a.id !== archiveId) });

    try {
      const { error } = await supabase.from("archived_event_sets").delete().eq("id", archiveId);
      if (error) throw error;
      toast.success("Archive deleted successfully.");
    } catch (err: any) {
      console.error("Failed to delete archive:", err);
      updateState({ archivedEvents: previousArchivedEvents });
      toast.error(`Failed to delete archive: ${err.message || "Unknown error"}`);
    }
  };

  const editLastSession = (): TeamEvent | null => {
    const current = stateRef.current;
    if (current.events.length === 0) return null;

    const lastEvent = current.events[0];
    const previousEvents = current.events;
    const previousActiveSession = current.activeSession;

    const session: ActiveSession = {
      id: lastEvent.id,
      date: lastEvent.date,
      type: lastEvent.type,
      duration: lastEvent.duration,
    };

    updateState({ events: current.events.slice(1), activeSession: session });

    (async () => {
      try {
        const [deleteRes, upsertRes] = await Promise.all([
          supabase.from("events").delete().eq("id", lastEvent.id),
          supabase.from("active_session").upsert(
            {
              id: session.id,
              date: session.date,
              type: session.type,
              duration: session.duration,
            },
            { onConflict: 'coach_id' }
          ),
        ]);

        if (deleteRes.error) throw deleteRes.error;
        if (upsertRes.error) throw upsertRes.error;

        toast.success("Loaded last session for editing.");
      } catch (err: any) {
        console.error("Failed to load last session for editing:", err);
        updateState({ events: previousEvents, activeSession: previousActiveSession });
        toast.error(`Failed to edit last session: ${err.message || "Unknown error"}`);
      }
    })();

    return lastEvent;
  };

  const uploadLogo = async (file: File) => {
    try {
      const current = stateRef.current;
      const fileExt = file.name.split(".").pop();
      const fileName = `logos/${currentUserIdRef.current}/${crypto.randomUUID()}.${fileExt}`;

      // Upload file to the "team-assets" storage bucket
      const { error: uploadError } = await supabase.storage
        .from("team-assets")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("team-assets")
        .getPublicUrl(fileName);

      // Save previous logo URL to clean up later if necessary
      const oldLogoUrl = current.teamLogo;

      // Update database settings with the new public URL
      await updateSettings({ teamLogo: publicUrl });

      // Clean up the old file in the storage bucket if it was also a Supabase Storage asset
      if (oldLogoUrl && oldLogoUrl.includes("/storage/v1/object/public/team-assets/")) {
        try {
          const oldPath = oldLogoUrl.split("/storage/v1/object/public/team-assets/").pop();
          if (oldPath) {
            await supabase.storage.from("team-assets").remove([oldPath]);
          }
        } catch (cleanupErr) {
          console.warn("Failed to delete old logo from storage:", cleanupErr);
        }
      }
    } catch (err: any) {
      console.error("Failed to upload team logo:", err);
      toast.error(`Failed to upload logo: ${err.message || "Unknown error"}`);
      throw err;
    }
  };

  const completeOnboarding = () => setIsNewCoach(false);

  return (
    <TeamStoreContext.Provider
      value={{
        state,
        isLoading,
        isAuthenticated,
        isAuthLoading,
        authError,
        isNewCoach,
        isPasswordRecovery,
        isSuperAdmin,
        login,
        updatePassword,
        signUp,
        logout,
        startSession,
        saveSession,
        addPlayer,
        removePlayer,
        updateSettings,
        uploadLogo,
        archiveEvents,
        restoreArchive,
        deleteArchive,
        editLastSession,
        isGuest,
        completeOnboarding,
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
