// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { changeOwner, readOwner } from './db';
import { AUTH_STORAGE_KEY, lastOwner, passwordSetupPending, rememberOwner } from './deviceAuth';
import { SHELL_VERSION, STORAGE_VERSION } from './types';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock('./api', () => ({ client: { auth }, loadExitCode: vi.fn(), loadServerSessions: vi.fn(), prepareFromServer: vi.fn(), sendOperation: vi.fn() }));
vi.mock('./shell', () => ({ shellFingerprint: () => 'test-shell', shellCacheReady: async () => true, prepareShell: vi.fn(), dropNextAcknowledgment: vi.fn(), expireNextAuthCheck: vi.fn(), setSimulatedOffline: vi.fn() }));
const authRedirect = vi.hoisted(() => ({ passwordSetup: false, error: false }));
vi.mock('./deviceAuth', async importOriginal => ({
  ...await importOriginal<typeof import('./deviceAuth')>(),
  get INITIAL_PASSWORD_SETUP() { return authRedirect.passwordSetup; },
  get INITIAL_AUTH_REDIRECT_ERROR() { return authRedirect.error; },
}));
import CoachApp from './CoachApp';

async function savedCoach() {
  const id = crypto.randomUUID();
  await changeOwner(id, data => { data.prepared = { version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: 'test-shell', savedAt: '', players: [{ id: 'player-1', first_name: 'Kayla', jersey_number: '0', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: ['blue'] }], teams: [{ id: 'blue', name: 'Blue', revision: 0, retired_at: null }], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } }; return data; });
  rememberOwner(id);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ expires_at: 1, user: { id } }));
  return id;
}
beforeEach(() => {
  authRedirect.passwordSetup = false; authRedirect.error = false;
  auth.getUser.mockReset(); auth.updateUser.mockReset(); auth.signInWithPassword.mockReset();
  history.replaceState(null, '', '/');
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); }, clear: () => memory.clear() });
  vi.stubGlobal('navigator', { ...window.navigator, onLine: false });
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: { message: 'fetch failed' } });
  auth.onAuthStateChange.mockReset().mockImplementation(callback => { queueMicrotask(() => callback('INITIAL_SESSION', null)); return { data: { subscription: { unsubscribe() {} } } }; });
  auth.signOut.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('offline auth recovery', () => {
  it('opens saved data even when the expired-session check has not returned', async () => {
    await savedCoach();
    auth.getSession.mockReturnValue(new Promise(() => {}));
    auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe() {} } } }));
    render(<CoachApp />);
    const start = await screen.findByRole('button', { name: 'Start Practice' });
    await waitFor(() => expect(start.hasAttribute('disabled')).toBe(false));
    expect(screen.getByText(/Sync paused/)).toBeTruthy();
  });

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
    await screen.findByRole('heading', { name: 'Use this coach account?' });
    expect(screen.queryByRole('button', { name: 'Start Practice' })).toBeNull();
    expect(lastOwner()).not.toBe('coach-b');
  });
});

describe('automatic device setup (audit A4)', () => {
  async function signedInWithoutPreparation() {
    const id = crypto.randomUUID();
    await changeOwner(id, data => data);
    rememberOwner(id);
    vi.stubGlobal('navigator', { ...window.navigator, onLine: true });
    auth.getSession.mockResolvedValue({ data: { session: { user: { id } } }, error: null });
    auth.onAuthStateChange.mockImplementation(callback => { queueMicrotask(() => callback('INITIAL_SESSION', { user: { id } })); return { data: { subscription: { unsubscribe() {} } } }; });
    return id;
  }

  it('prepares the device after sign-in without a button press', async () => {
    const api = await import('./api');
    const shell = await import('./shell');
    vi.mocked(api.prepareFromServer).mockResolvedValue({ version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: '', savedAt: new Date().toISOString(), players: [{ id: 'player-1', first_name: 'Kayla', jersey_number: '0', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: [] }], teams: [], roundId: 'round', roundRevision: 0, raffleEnabled: false, exitCode: { mode: 'default', revision: 0, verifier: null } });
    vi.mocked(api.loadServerSessions).mockResolvedValue([]);
    vi.mocked(shell.prepareShell).mockResolvedValue('test-shell');
    await signedInWithoutPreparation();
    render(<CoachApp />);
    const start = await screen.findByRole('button', { name: 'Start Practice' });
    await waitFor(() => expect(start.hasAttribute('disabled')).toBe(false));
    expect(vi.mocked(api.prepareFromServer)).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Prepare while online' })).toBeNull();
    expect(screen.getByText('Ready offline')).toBeTruthy();
  });

  it('shows loading and unknown states instead of an empty roster, zero report or a guessed PIN', async () => {
    const api = await import('./api');
    vi.mocked(api.prepareFromServer).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.loadServerSessions).mockReturnValue(new Promise(() => {}));
    await signedInWithoutPreparation();
    render(<CoachApp />);
    await screen.findByText('Getting this device ready…');
    fireEvent.click(screen.getByRole('button', { name: 'Roster' }));
    expect(screen.getByText('Loading your roster…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add player' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
    expect(screen.getByText('Loading your history…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText(/PIN setting not loaded yet/)).toBeTruthy();
    expect(screen.queryByText(/Default code 0000 active/)).toBeNull();
  });
});

describe('history and navigation (audit A6, A8)', () => {
  it('reaches every completed session, filters by type and date, and keeps the page in the URL', async () => {
    const id = await savedCoach();
    await changeOwner(id, data => {
      const kayla = data.prepared!.players[0];
      data.sessions = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, kind: (i % 5 === 0 ? 'Optional Training' : 'Practice') as 'Practice' | 'Optional Training', date: `2026-08-${String(i + 1).padStart(2, '0')}`, creditHours: 1.5, roundId: 'round', expectedIds: [kayla.id], selectedTeamIds: [], allKaizen: true, roster: [kayla], present: { [kayla.id]: true }, state: 'completed' as const, revision: 2 }));
      return data;
    });
    render(<CoachApp />);
    await screen.findByRole('button', { name: 'Start Practice' });
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(location.hash).toBe('#history');
    expect(screen.getByRole('button', { name: 'History' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByRole('button', { name: 'Correct attendance' })).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Show 20 more' }));
    expect(screen.getAllByRole('button', { name: 'Correct attendance' })).toHaveLength(25);
    expect(screen.getByText('Practice · 2026-08-02')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Optional Training' } });
    expect(screen.getAllByRole('button', { name: 'Correct attendance' })).toHaveLength(5);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-15' } });
    expect(screen.getByText('2 sessions found')).toBeTruthy();
  });
});

describe('server history refresh after upload (audit A3)', () => {
  it('downloads another device’s sessions after uploading local attendance', async () => {
    const api = await import('./api');
    const id = await savedCoach();
    const saved = await readOwner(id);
    vi.mocked(api.prepareFromServer).mockReset().mockImplementation(async () => structuredClone(saved.prepared!));
    vi.mocked(api.loadServerSessions).mockReset().mockResolvedValue([]);
    vi.mocked(api.loadExitCode).mockResolvedValue(saved.prepared!.exitCode);
    vi.mocked(api.sendOperation).mockReset().mockResolvedValue({ session_id: 'local-session' });
    auth.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    auth.getSession.mockResolvedValue({ data: { session: { user: { id } } }, error: null });
    auth.onAuthStateChange.mockImplementation(callback => { queueMicrotask(() => callback('INITIAL_SESSION', { user: { id } })); return { data: { subscription: { unsubscribe() {} } } }; });
    render(<CoachApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Practice' }).hasAttribute('disabled')).toBe(false));
    expect(api.loadServerSessions).not.toHaveBeenCalled();

    const session = { id: 'other-device-session', kind: 'Practice' as const, date: '2026-08-28', creditHours: 1.5, roundId: 'round', expectedIds: ['player-1'], selectedTeamIds: ['blue'], allKaizen: false, roster: saved.prepared!.players, present: { 'player-1': true }, state: 'completed' as const, revision: 2 };
    vi.mocked(api.loadServerSessions).mockResolvedValue([session]);
    await changeOwner(id, data => { data.queue.push({ id: 'local-change', deviceId: data.deviceId, sequence: 1, kind: 'finish_v1', sessionId: 'local-session', baseRevision: 1, payload: {}, status: 'pending' }); return data; });
    vi.stubGlobal('navigator', { ...window.navigator, onLine: true });
    fireEvent(window, new Event('online'));

    await waitFor(() => expect(api.sendOperation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.loadServerSessions).toHaveBeenCalledTimes(1));
    expect((await readOwner(id)).queue).toHaveLength(0);
    expect((await readOwner(id)).sessions.map(session => session.id)).toContain('other-device-session');
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText('Practice · 2026-08-28')).toBeTruthy();
  });

  it('downloads history on reconnect even when no local changes need uploading', async () => {
    const api = await import('./api');
    const id = await savedCoach();
    const saved = await readOwner(id);
    vi.mocked(api.prepareFromServer).mockReset().mockImplementation(async () => structuredClone(saved.prepared!));
    const session = { id: 'remote-only-session', kind: 'Practice' as const, date: '2026-08-29', creditHours: 1.5, roundId: 'round', expectedIds: [], selectedTeamIds: [], allKaizen: true, roster: saved.prepared!.players, present: {}, state: 'completed' as const, revision: 2 };
    vi.mocked(api.loadServerSessions).mockReset().mockResolvedValue([session]);
    vi.mocked(api.sendOperation).mockReset();
    auth.getSession.mockResolvedValue({ data: { session: { user: { id } } }, error: null });
    auth.onAuthStateChange.mockImplementation(callback => { queueMicrotask(() => callback('INITIAL_SESSION', { user: { id } })); return { data: { subscription: { unsubscribe() {} } } }; });
    render(<CoachApp />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Practice' }).hasAttribute('disabled')).toBe(false));
    expect(api.loadServerSessions).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { ...window.navigator, onLine: true });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(api.loadServerSessions).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect((await readOwner(id)).sessions.map(session => session.id)).toContain('remote-only-session'));
    expect(api.sendOperation).not.toHaveBeenCalled();
  });
});


describe('invited coach onboarding', () => {
  function invitedSession(id = 'invited-coach') {
    const user = { id, email: 'new-coach@example.test' };
    auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null });
    auth.onAuthStateChange.mockImplementation(callback => { queueMicrotask(() => callback('INITIAL_SESSION', { user })); return { data: { subscription: { unsubscribe() {} } } }; });
    auth.getUser.mockResolvedValue({ data: { user }, error: null });
    return user;
  }
  it('asks a fresh invited coach to create a password before preparing team data', async () => {
    authRedirect.passwordSetup = true;
    const user = invitedSession(crypto.randomUUID());
    const api = await import('./api'); vi.mocked(api.prepareFromServer).mockClear();
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Set your password' });
    expect(screen.getByText(`For ${user.email}`)).toBeTruthy();
    expect(lastOwner()).toBe(user.id);
    expect(api.prepareFromServer).not.toHaveBeenCalled();
    const shell = await import('./shell');
    vi.mocked(api.prepareFromServer).mockResolvedValue({ version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: '', savedAt: '', players: [], teams: [], roundId: 'invited-round', roundRevision: 0, raffleEnabled: false, exitCode: { mode: 'default', revision: 0, verifier: null } });
    vi.mocked(api.loadServerSessions).mockResolvedValue([]);
    vi.mocked(shell.prepareShell).mockResolvedValue('test-shell');
    auth.updateUser.mockResolvedValue({ error: null });
    vi.stubGlobal('navigator', { ...window.navigator, onLine: true });
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'synthetic-coach-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await screen.findByRole('button', { name: 'Start Practice' });
    await waitFor(() => expect(screen.getByText('Ready offline')).toBeTruthy());
    expect(passwordSetupPending(user.id)).toBe(false);
    expect(api.prepareFromServer).toHaveBeenCalledTimes(1);
  });
  it('resumes password creation after the invitation URL has been consumed and the app reloads', async () => {
    authRedirect.passwordSetup = true;
    invitedSession(crypto.randomUUID());
    const first = render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Set your password' });
    first.unmount(); authRedirect.passwordSetup = false;
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Set your password' });
  });
  it('switches to the invited coach explicitly and preserves the previous coach’s pending work', async () => {
    const previousId = await savedCoach();
    await changeOwner(previousId, data => { data.queue.push({ id: 'previous-change', deviceId: data.deviceId, sequence: 1, kind: 'finish_v1', sessionId: 'previous-session', baseRevision: 1, payload: {}, status: 'pending' }); return data; });
    const previous = await readOwner(previousId);
    authRedirect.passwordSetup = true; const user = invitedSession(crypto.randomUUID());
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Use this coach account?' });
    expect(lastOwner()).toBe(previousId);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to password setup' }));
    await screen.findByRole('heading', { name: 'Set your password' });
    expect(lastOwner()).toBe(user.id);
    expect(await readOwner(previousId)).toEqual(previous);
    expect((await readOwner(user.id)).queue).toHaveLength(0);
  });
  it('offers password setup when a previously consumed invitation has no redirect marker', async () => {
    const previousId = await savedCoach(); const user = invitedSession(crypto.randomUUID());
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Use this coach account?' });
    fireEvent.click(screen.getByRole('button', { name: 'Set a password and switch' }));
    await screen.findByRole('heading', { name: 'Set your password' });
    expect(lastOwner()).toBe(user.id);
    expect((await readOwner(previousId)).prepared).not.toBeNull();
  });
  it('lets the user keep the previous coach without clearing its offline copy', async () => {
    const previousId = await savedCoach(); const previous = await readOwner(previousId);
    invitedSession(crypto.randomUUID()); auth.signOut.mockResolvedValue({ error: null });
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Use this coach account?' });
    fireEvent.click(screen.getByRole('button', { name: 'Keep previous coach' }));
    await screen.findByRole('heading', { name: 'Upload paused' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(lastOwner()).toBe(previousId); expect(await readOwner(previousId)).toEqual(previous);
  });
  it('refuses to switch if the authenticated account changes before confirmation', async () => {
    const previousId = await savedCoach(); invitedSession(crypto.randomUUID());
    auth.getUser.mockResolvedValue({ data: { user: { id: 'unexpected-coach' } }, error: null });
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Use this coach account?' });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to this coach' }));
    await screen.findByText(/This sign-in has changed/);
    expect(lastOwner()).toBe(previousId);
  });
  it('shows an actionable expired-link message instead of a password form', async () => {
    authRedirect.error = true;
    render(<CoachApp />);
    await screen.findByRole('heading', { name: 'Sign-in link could not be opened' });
    expect(screen.getByText(/new invitation or password-reset link/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Set your password' })).toBeNull();
  });
});
