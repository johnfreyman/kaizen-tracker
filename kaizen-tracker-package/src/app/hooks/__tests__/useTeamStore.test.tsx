/** @vitest-environment jsdom */

// -------------------------------------------------------------
// These tests verify that when Supabase operations fail, the hook restores the previous state
// and displays error toast messages.

import { renderHook, act } from "@testing-library/react";
import { useTeamStore, TeamStoreProvider } from "../useTeamStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock supabase client
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/logo.png" } })),
        remove: vi.fn(),
      })),
    },
  } as any,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TeamStoreProvider>{children}</TeamStoreProvider>
);

describe("useTeamStore error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("startSession rolls back on Supabase failure", async () => {
    // Arrange: mock upsert to fail
    (supabase.from as any).mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: new Error("upsert failed") }),
    });

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    // initial activeSession is null
    expect(result.current.state.activeSession).toBeNull();

    const session = { id: "sess1", date: "2023-01-01", type: "Practice" as any, duration: 2 };

    await act(async () => {
      await result.current.startSession(session);
    });

    // Should have rolled back to null
    expect(result.current.state.activeSession).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to start session")
    );
  });

  test("saveSession rolls back on Supabase failure", async () => {
    // Arrange: mock the save_session RPC to fail.
    (supabase.rpc as any).mockResolvedValue({ error: new Error("rpc error") });
    // startSession still uses supabase.from, so mock it as a no-op success.
    (supabase.from as any).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    // Set an active session first
    act(() => {
      result.current.startSession({ id: "s1", date: "2023-01-01", type: "Practice" as any, duration: 1 });
    });
    // Ensure activeSession present
    expect(result.current.state.activeSession).not.toBeNull();

    await act(async () => {
      await result.current.saveSession(["Alice"]);
    });

    // Active session should be restored and events unchanged
    expect(result.current.state.activeSession).not.toBeNull();
    expect(result.current.state.events).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to save session")
    );
    // Verify rpc was called with the correct function name and coach_id key
    expect(supabase.rpc).toHaveBeenCalledWith(
      "save_session",
      expect.objectContaining({ p_event_id: "s1" })
    );
  });

  test("archiveEvents rolls back on Supabase failure", async () => {
    // Arrange: mock the archive_events RPC to fail.
    (supabase.rpc as any).mockResolvedValue({ error: new Error("archival rpc error") });
    (supabase.from as any).mockReturnValue({ upsert: vi.fn() });

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    // Simulate an existing event
    act(() => {
      result.current.state.events.push({
        id: "e1",
        date: "2023-01-01",
        type: "Practice" as any,
        duration: 1,
        players: [],
        savedAt: new Date().toISOString(),
      });
    });

    const success = await result.current.archiveEvents();
    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to archive events")
    );
    // Events array should remain unchanged
    expect(result.current.state.events).toHaveLength(1);
    // Verify rpc was called with the correct function name
    expect(supabase.rpc).toHaveBeenCalledWith(
      "archive_events",
      expect.objectContaining({ p_event_ids: ["e1"] })
    );
  });

  test("restoreArchive rolls back on Supabase failure", async () => {
    // Arrange: mock the restore_archive RPC to fail.
    (supabase.rpc as any).mockResolvedValue({ error: new Error("restore rpc error") });
    (supabase.from as any).mockReturnValue({ upsert: vi.fn() });

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    // Create an archive entry manually
    act(() => {
      result.current.state.archivedEvents.push({
        id: "arch1",
        archivedAt: new Date().toISOString(),
        events: [],
      });
    });

    await act(async () => {
      await result.current.restoreArchive("arch1");
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to restore archive")
    );
    // Archive should still be present after rollback
    expect(result.current.state.archivedEvents).toHaveLength(1);
    // Verify rpc was called with the correct function name
    expect(supabase.rpc).toHaveBeenCalledWith(
      "restore_archive",
      expect.objectContaining({ p_archive_id: "arch1" })
    );
  });

  test("removePlayer rolls back on Supabase failure", async () => {
    const mockDelete = vi.fn().mockResolvedValue({ error: new Error("delete failed") });
    (supabase.from as any).mockImplementation((table: any) => {
        if (table === "roster") return { delete: mockDelete };
        return { upsert: vi.fn(), insert: vi.fn() };
      });

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    // Add a player first
    act(() => {
      result.current.state.roster = ["Bob"];
    });

    await act(async () => {
      await result.current.removePlayer("Bob");
    });

    // Roster should still contain Bob after failure
    expect(result.current.state.roster).toContain("Bob");
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to remove player")
    );
  });

  test("updateSettings rolls back on Supabase failure", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: new Error("upsert failure") });
    (supabase.from as any).mockImplementation(() => ({ upsert: mockUpsert }));

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    const originalName = result.current.state.teamName;

    await act(async () => {
      await result.current.updateSettings({ teamName: "New Name" });
    });

    // Team name should revert to original
    expect(result.current.state.teamName).toBe(originalName);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to update settings")
    );
  });
});
