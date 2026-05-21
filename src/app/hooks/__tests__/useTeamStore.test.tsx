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
    // auth is not used in these tests
    auth: { getSession: vi.fn() },
    from: vi.fn(() => ({
      upsert: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })),
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
    const mockInsert = vi.fn().mockResolvedValue({ error: new Error("insert error") });
    const mockDelete = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockImplementation((table: any) => {
        if (table === "events") return { insert: mockInsert };
        if (table === "active_session") return { delete: mockDelete };
        return { upsert: vi.fn() };
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
  });

  test("archiveEvents rolls back on Supabase failure", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: new Error("archival insert error") });
    const mockDelete = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockImplementation((table: any) => {
        if (table === "archived_event_sets") return { insert: mockInsert };
        if (table === "events") return { delete: mockDelete };
        return { upsert: vi.fn() };
      });

    const { result } = renderHook(() => useTeamStore(), { wrapper });
    // Populate events directly
    act(() => {
      result.current.updateSettings({}); // no‑op to trigger state update
    });
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
  });

  test("restoreArchive rolls back on Supabase failure", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: new Error("upsert error") });
    const mockDelete = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockImplementation((table: any) => {
        if (table === "events") return { upsert: mockUpsert };
        if (table === "archived_event_sets") return { delete: mockDelete };
        return { insert: vi.fn(), delete: vi.fn() };
      });

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
    // Archive should still be present
    expect(result.current.state.archivedEvents).toHaveLength(1);
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
