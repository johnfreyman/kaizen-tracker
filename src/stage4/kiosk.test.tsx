// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { changeOwner, readOwner, setTestWriteFailure } from './db';
import { derivePin, verifyPin } from './pin';
import { SHELL_VERSION, STORAGE_VERSION, type Prepared } from './types';

const api = vi.hoisted(() => ({ getUser: vi.fn(), loadExitCode: vi.fn(), loadServerSessions: vi.fn() }));
vi.mock('./api', () => ({ client: { auth: { getUser: api.getUser } }, loadExitCode: api.loadExitCode, loadServerSessions: api.loadServerSessions }));
import KioskScreen from './KioskScreen';
import { enterKiosk, exitKiosk, kioskMatches, refreshKioskState } from './kiosk';
import { markPresent, startSession } from './workflow';

const players: Prepared['players'] = [
  { id: 'zero', first_name: 'Kayla', jersey_number: '0', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: ['blue', 'red'] },
  { id: 'double-zero', first_name: 'Owen', jersey_number: '00', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: ['red'] },
  { id: 'seven-a', first_name: 'Jules', jersey_number: '7', short_label: 'A', is_guest: false, retired_at: null, revision: 0, team_ids: ['blue'] },
  { id: 'seven-b', first_name: 'Jules', jersey_number: '7', short_label: 'B', is_guest: false, retired_at: null, revision: 0, team_ids: ['red'] },
];
const prepared: Prepared = { version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: 'test', savedAt: '2026-09-25T00:00:00Z', players, teams: [{ id: 'blue', name: 'Blue', revision: 0, retired_at: null }, { id: 'red', name: 'Red', revision: 0, retired_at: null }], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } };

async function activeOwner() {
  const id = crypto.randomUUID();
  const data = await changeOwner(id, owner => { owner.prepared = structuredClone(prepared); return owner; });
  const started = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-25');
  return { id, data: await enterKiosk(id, started) };
}

beforeEach(() => {
  setTestWriteFailure(false);
  vi.stubGlobal('navigator', { ...window.navigator, onLine: true });
  api.getUser.mockReset(); api.loadExitCode.mockReset(); api.loadServerSessions.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Stage 5 kiosk binding and PIN', () => {
  it('persists the binding, checks in through the same outbox, and exits without finishing', async () => {
    const { id, data } = await activeOwner();
    expect((await readOwner(id)).kioskSessionId).toBe(data.sessions[0].id);
    expect(kioskMatches(data, '0').map(p => p.id)).toEqual(['zero']);
    expect(kioskMatches(data, '00').map(p => p.id)).toEqual(['double-zero']);
    expect(kioskMatches(data, '7').map(p => p.id)).toEqual(['seven-a', 'seven-b']);
    const checkedIn = await markPresent(id, data, 'zero', true);
    expect(checkedIn.sessions[0].present.zero).toBe(true);
    expect(checkedIn.queue.map(op => op.kind)).toEqual(['start_v1', 'set_present_v1']);
    const exited = await exitKiosk(id, await readOwner(id), '0000');
    expect(exited.kioskSessionId).toBeUndefined();
    expect(exited.sessions[0].state).toBe('active');
    expect(exited.queue).toHaveLength(2);
  });

  it('rejects default 0000 after a custom PIN and keeps the kiosk bound on an incorrect code', async () => {
    const { id } = await activeOwner();
    const verifier = await derivePin('2468');
    const custom = await changeOwner(id, data => { data.prepared!.exitCode = { mode: 'custom', revision: 1, verifier }; return data; });
    expect(await verifyPin('2468', custom.prepared!.exitCode)).toBe(true);
    expect(await verifyPin('0000', custom.prepared!.exitCode)).toBe(false);
    await expect(exitKiosk(id, custom, '0000')).rejects.toThrow('Incorrect coach PIN');
    expect((await readOwner(id)).kioskSessionId).toBe(custom.kioskSessionId);
    const exited = await exitKiosk(id, await readOwner(id), '2468');
    expect(exited.kioskSessionId).toBeUndefined();
  });

  it('keeps the prior attendance and binding when a local kiosk write fails', async () => {
    const { id, data } = await activeOwner();
    setTestWriteFailure(true);
    await expect(markPresent(id, data, 'zero', true)).rejects.toThrow('Simulated local storage failure');
    setTestWriteFailure(false);
    const saved = await readOwner(id);
    expect(saved.sessions[0].present.zero).toBeUndefined();
    expect(saved.queue).toHaveLength(1);
    expect(saved.kioskSessionId).toBe(data.kioskSessionId);
  });

  it('does not reveal coach controls when clearing the kiosk binding fails', async () => {
    const { id, data } = await activeOwner();
    setTestWriteFailure(true);
    await expect(exitKiosk(id, data, '0000')).rejects.toThrow('Simulated local storage failure');
    setTestWriteFailure(false);
    expect((await readOwner(id)).kioskSessionId).toBe(data.kioskSessionId);
  });

  it('shows a remotely finished session while preserving locally queued work', async () => {
    const { id, data } = await activeOwner();
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.loadExitCode.mockResolvedValue({ mode: 'default', revision: 2, verifier: null });
    api.loadServerSessions.mockResolvedValue([{ ...data.sessions[0], state: 'completed', revision: 2 }]);
    const refreshed = await refreshKioskState(id, data);
    expect(refreshed.kioskClosedSessionId).toBe(data.kioskSessionId);
    expect(refreshed.sessions[0].state).toBe('active');
    expect(refreshed.queue).toHaveLength(1);
    expect(refreshed.prepared!.exitCode.revision).toBe(2);
  });

  it('accepts a signed-in reset only after this kiosk refreshes its cached PIN', async () => {
    const { id } = await activeOwner();
    const verifier = await derivePin('2468');
    const custom = await changeOwner(id, data => { data.prepared!.exitCode = { mode: 'custom', revision: 1, verifier }; return data; });
    await expect(exitKiosk(id, custom, '0000')).rejects.toThrow('Incorrect coach PIN');
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.loadExitCode.mockResolvedValue({ mode: 'default', revision: 2, verifier: null });
    api.loadServerSessions.mockResolvedValue([custom.sessions[0]]);
    const refreshed = await refreshKioskState(id, custom);
    expect(refreshed.prepared!.exitCode.revision).toBe(2);
    expect((await exitKiosk(id, refreshed, '0000')).kioskSessionId).toBeUndefined();
  });
});

describe('kiosk feedback', () => {
  it('requires a card tap for one match and never confirms a failed local save', async () => {
    const { data } = await activeOwner();
    const onMark = vi.fn().mockRejectedValue(new Error('Simulated local storage failure'));
    render(<KioskScreen data={data} authPaused={false} onMark={onMark} onExit={vi.fn()} onRefresh={vi.fn().mockResolvedValue(undefined)} onSignIn={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Jersey number (1–3 digits) or coach exit PIN (4 digits)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find player' }));
    expect(screen.getByRole('heading', { name: 'Tap your card to check in' })).toBeTruthy();
    expect(onMark).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Kayla/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not saved on this device'));
    expect(screen.queryByText('You’re checked in')).toBeNull();
  });

  it('shows the finished message without coach navigation or check-in controls', async () => {
    const { data } = await activeOwner();
    data.kioskClosedSessionId = data.kioskSessionId;
    render(<KioskScreen data={data} authPaused={false} onMark={vi.fn()} onExit={vi.fn()} onRefresh={vi.fn().mockResolvedValue(undefined)} onSignIn={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Session finished — ask your coach' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Find player' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Coach exit' })).toBeTruthy();
  });

  it('shows both players with a shared number and marks only the chosen identity', async () => {
    const { data } = await activeOwner();
    const onMark = vi.fn().mockResolvedValue(undefined);
    render(<KioskScreen data={data} authPaused={false} onMark={onMark} onExit={vi.fn()} onRefresh={vi.fn().mockResolvedValue(undefined)} onSignIn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Jersey number (1–3 digits) or coach exit PIN (4 digits)'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find player' }));
    expect(screen.getByRole('heading', { name: '2 players wear #7. Tap your card.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Jules A · #7/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Jules B · #7/ }));
    await waitFor(() => expect(onMark).toHaveBeenCalledWith('seven-b', true));
    expect(onMark).toHaveBeenCalledTimes(1);
  });

  it('accepts four keypad digits as a coach PIN and keeps the kiosk open after an incorrect code', async () => {
    const { data } = await activeOwner();
    const onExit = vi.fn().mockRejectedValueOnce(new Error('Incorrect coach PIN.')).mockResolvedValueOnce(undefined);
    const onMark = vi.fn();
    render(<KioskScreen data={data} authPaused={false} onMark={onMark} onExit={onExit} onRefresh={vi.fn().mockResolvedValue(undefined)} onSignIn={vi.fn()} />);
    for (const digit of '1234') fireEvent.click(screen.getByRole('button', { name: `Digit ${digit}` }));
    expect((screen.getByLabelText('Jersey number (1–3 digits) or coach exit PIN (4 digits)') as HTMLInputElement).value).toBe('1234');
    fireEvent.click(screen.getByRole('button', { name: 'Exit kiosk' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Incorrect coach PIN.'));
    expect((screen.getByLabelText('Jersey number (1–3 digits) or coach exit PIN (4 digits)') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Player check-in' })).toBeTruthy();
    expect(onMark).not.toHaveBeenCalled();
    for (const digit of '2468') fireEvent.click(screen.getByRole('button', { name: `Digit ${digit}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit kiosk' }));
    await waitFor(() => expect(onExit).toHaveBeenCalledWith('2468'));
    expect(onExit).toHaveBeenCalledTimes(2);
  });
});
