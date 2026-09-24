import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeOwner, enqueue, readOwner, setTestWriteFailure } from './db';
import { SHELL_VERSION, STORAGE_VERSION, type Prepared } from './types';

const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  sendOperation: vi.fn(),
}));
vi.mock('./api', () => ({
  client: { auth: { getUser: api.getUser } },
  sendOperation: api.sendOperation,
}));
vi.mock('./shell', () => ({ prepareShell: vi.fn() }));

import { finishSession, markPresent, startSession, sync } from './workflow';

const player = { id: 'player-1', first_name: 'Kayla', jersey_number: '0', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: ['blue'] };
const prepared: Prepared = {
  version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: 'test', savedAt: '2026-09-23T00:00:00Z',
  players: [player], teams: [{ id: 'blue', name: 'Blue', retired_at: null, revision: 0 }],
  roundId: 'round-1', roundRevision: 0, raffleEnabled: true,
  exitCode: { mode: 'default', revision: 0, verifier: null },
};

async function owner() {
  const id = crypto.randomUUID();
  return { id, data: await changeOwner(id, data => { data.prepared = structuredClone(prepared); return data; }) };
}

beforeEach(() => {
  setTestWriteFailure(false);
  vi.stubGlobal('navigator', { onLine: true });
  api.getUser.mockReset();
  api.sendOperation.mockReset();
});

describe('durable offline attendance', () => {
  it('commits each visible change with an immutable, ordered operation', async () => {
    const { id, data } = await owner();
    const started = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-22');
    const marked = await markPresent(id, started, player.id, true);
    const finished = await finishSession(id, marked);
    const reopened = await readOwner(id);
    expect(reopened).toEqual(finished);
    expect(reopened.sessions[0]).toMatchObject({ date: '2026-09-22', state: 'completed', present: { [player.id]: true }, revision: 2 });
    expect(reopened.queue.map(op => [op.kind, op.sequence, op.baseRevision])).toEqual([
      ['start_v1', 1, 0], ['set_present_v1', 2, 0], ['finish_v1', 3, 1],
    ]);
    expect(new Set(reopened.queue.map(op => op.id)).size).toBe(3);
  });

  it('preserves all earlier work when a local transaction fails', async () => {
    const { id, data } = await owner();
    const started = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-23');
    setTestWriteFailure(true);
    await expect(markPresent(id, started, player.id, true)).rejects.toThrow('Simulated local storage failure');
    setTestWriteFailure(false);
    expect(await readOwner(id)).toEqual(started);
  });

  it('keeps two locally finished sessions and a newer active session in one queue', async () => {
    const { id, data } = await owner();
    const a = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-22');
    const aDone = await finishSession(id, a);
    const b = await startSession(id, aDone, 'Optional Training', [], false, '2026-09-22');
    const bDone = await finishSession(id, b);
    const c = await startSession(id, bDone, 'Practice', ['blue'], false, '2026-09-23');
    const reopened = await readOwner(id);
    expect(reopened).toEqual(c);
    expect(reopened.sessions.map(s => s.state)).toEqual(['active', 'completed', 'completed']);
    expect(reopened.queue.map(op => op.kind)).toEqual(['start_v1', 'finish_v1', 'start_v1', 'finish_v1', 'start_v1']);
    expect(reopened.queue.map(op => op.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(reopened.sessions.map(s => s.id)).size).toBe(3);
  });

  it('keeps different coaches separate and blocks unknown storage versions', async () => {
    const a = await owner(), b = await owner();
    await startSession(a.id, a.data, 'Practice', ['blue'], false, '2026-09-23');
    expect((await readOwner(b.id)).queue).toHaveLength(0);
    await changeOwner(b.id, data => { data.version = STORAGE_VERSION; return data; });
    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('kaizen-stage4-test', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = raw.transaction('owners', 'readwrite');
      tx.objectStore('owners').put({ ...b.data, version: 999 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    raw.close();
    await expect(readOwner(b.id)).rejects.toThrow('supported migration');
    expect((await readOwner(a.id)).queue).toHaveLength(1);
  });

  it('retries a lost response with the same operation ID and payload', async () => {
    const { id, data } = await owner();
    const started = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-23');
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.sendOperation.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue({ session_id: started.sessions[0].id });
    const waiting = await sync(id, started);
    expect(waiting.state).toBe('waiting');
    expect((await readOwner(id)).queue[0]).toEqual(started.queue[0]);
    const done = await sync(id, await readOwner(id));
    expect(done.state).toBe('synced');
    expect(api.sendOperation.mock.calls[0][0]).toEqual(api.sendOperation.mock.calls[1][0]);
    expect((await readOwner(id)).queue).toHaveLength(0);
  });

  it('retains a conflict without discarding later queued changes', async () => {
    const { id, data } = await owner();
    const started = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-23');
    const marked = await markPresent(id, started, player.id, true);
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.sendOperation.mockRejectedValue({ code: '40001', message: 'revision conflict' });
    const result = await sync(id, marked);
    expect(result.state).toBe('conflict');
    expect((await readOwner(id)).queue.map(op => op.status)).toEqual(['conflict', 'pending']);
    expect((await readOwner(id)).sessions[0].present[player.id]).toBe(true);
  });

  it('requires the same signed-in coach before sending any queued operation', async () => {
    const { id, data } = await owner();
    const started = await startSession(id, data, 'Practice', ['blue'], false, '2026-09-23');
    api.getUser.mockResolvedValue({ data: { user: { id: 'another-coach' } }, error: null });
    const result = await sync(id, started);
    expect(result.state).toBe('auth');
    expect(api.sendOperation).not.toHaveBeenCalled();
    expect((await readOwner(id)).queue).toHaveLength(1);
  });
});
