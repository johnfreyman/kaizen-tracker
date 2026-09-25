// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { changeOwner } from './db';
import { AUTH_STORAGE_KEY, lastOwner, rememberOwner } from './deviceAuth';
import { SHELL_VERSION, STORAGE_VERSION } from './types';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn(), getUser: vi.fn() }));
vi.mock('./api', () => ({ client: { auth }, loadExitCode: vi.fn(), loadServerSessions: vi.fn(), prepareFromServer: vi.fn(), sendOperation: vi.fn() }));
vi.mock('./shell', () => ({ shellFingerprint: () => 'test-shell', shellCacheReady: async () => true, prepareShell: vi.fn(), dropNextAcknowledgment: vi.fn(), expireNextAuthCheck: vi.fn(), setSimulatedOffline: vi.fn() }));
import CoachApp from './CoachApp';

async function savedCoach() {
  const id = crypto.randomUUID();
  await changeOwner(id, data => { data.prepared = { version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: 'test-shell', savedAt: '', players: [{ id: 'player-1', first_name: 'Kayla', jersey_number: '0', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: ['blue'] }], teams: [{ id: 'blue', name: 'Blue', revision: 0, retired_at: null }], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } }; return data; });
  rememberOwner(id);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ expires_at: 1, user: { id } }));
  return id;
}
beforeEach(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); }, clear: () => memory.clear() });
  vi.stubGlobal('navigator', { ...window.navigator, onLine: false });
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: { message: 'fetch failed' } });
  auth.onAuthStateChange.mockReset().mockImplementation(callback => { queueMicrotask(() => callback('INITIAL_SESSION', null)); return { data: { subscription: { unsubscribe() {} } } }; });
  auth.signOut.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('offline auth recovery', () => {
  it('opens saved owner data after an expired token and allows attendance while upload is paused', async () => {
    await savedCoach();
    render(<CoachApp />);
    const start = await screen.findByRole('button', { name: 'Start Practice' });
    await waitFor(() => expect(start.hasAttribute('disabled')).toBe(false));
    expect(screen.getByText(/Sync paused/)).toBeTruthy();
    fireEvent.click(start);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take attendance' }));
    expect(await screen.findByRole('button', { name: /Kayla/ })).toBeTruthy();
  });

  it('signs out locally offline and stays signed out after reload', async () => {
    await savedCoach();
    const first = render(<CoachApp />);
    await screen.findByRole('button', { name: 'Start Practice' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(lastOwner()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(auth.signOut).not.toHaveBeenCalled();
    first.unmount();
    render(<CoachApp />);
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByRole('button', { name: 'Start Practice' })).toBeNull();
  });

  it('keeps saved Coach A work bound when another coach auth event arrives', async () => {
    await savedCoach();
    render(<CoachApp />);
    await screen.findByRole('button', { name: 'Start Practice' });
    const listener = auth.onAuthStateChange.mock.calls[0][0];
    listener('SIGNED_IN', { user: { id: 'coach-b' } });
    await waitFor(() => expect(screen.getByText(/Sign in as the coach whose work/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeTruthy();
    expect(lastOwner()).not.toBe('coach-b');
  });
});
