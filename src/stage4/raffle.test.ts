import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeOwner, enqueue, readOwner, setTestWriteFailure } from './db';
import { SHELL_VERSION, STORAGE_VERSION, type RaffleSnapshot } from './types';

const api = vi.hoisted(() => ({ getUser: vi.fn(), snapshot: vi.fn(), send: vi.fn() }));
vi.mock('./api', () => ({ client: { auth: { getUser: api.getUser } }, loadRaffleSnapshot: api.snapshot, sendOperation: api.send }));
import { runRaffle } from './raffle';

const snapshot: RaffleSnapshot = { round_id: 'round', round_revision: 0, generation: 1, raffle_enabled: true, tickets: [{ session_id: 'training', player_id: 'player', display_name: 'Kayla · #0' }], pool_count: 1, pool_hash: 'abc', excluded_player_ids: [], draws: [] };
async function owner() {
  const id = crypto.randomUUID();
  await changeOwner(id, data => { data.prepared = { version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: 'test', savedAt: '', players: [], teams: [], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } }; return data; });
  return id;
}
beforeEach(() => {
  setTestWriteFailure(false);
  vi.stubGlobal('navigator', { onLine: true });
  api.getUser.mockReset(); api.snapshot.mockReset().mockResolvedValue(structuredClone(snapshot)); api.send.mockReset();
});
afterEach(() => { setTestWriteFailure(false); vi.unstubAllGlobals(); });

describe('Stage 6 raffle requests', () => {
  it('persists a draw before sending and retries a lost acknowledgment with the same identity', async () => {
    const id = await owner();
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.send.mockRejectedValueOnce(new Error('connection lost')).mockImplementation(async operation => ({ round_id: 'round', round_revision: 1, draw_id: operation.payload.draw_id, display_name: 'Kayla · #0' }));
    await expect(runRaffle(id, snapshot, { kind: 'draw_v1', prize: 'Ball', excludeLastN: 0 })).rejects.toThrow('connection lost');
    const saved = (await readOwner(id)).pendingRaffle!;
    expect(saved.kind).toBe('draw_v1');
    expect(saved.payload).toMatchObject({ prize: 'Ball', pool_hash: 'abc' });
    const result = await runRaffle(id, snapshot);
    expect(result.result.display_name).toBe('Kayla · #0');
    expect(api.send.mock.calls[0][0]).toEqual(api.send.mock.calls[1][0]);
    expect((await readOwner(id)).pendingRaffle).toBeUndefined();
  });

  it('blocks a draw while attendance is queued and makes no server request', async () => {
    const id = await owner();
    await changeOwner(id, data => { data.queue.push({ id: 'queued', deviceId: data.deviceId, sequence: 1, kind: 'finish_v1', sessionId: 'session', baseRevision: 0, payload: {}, status: 'pending' }); return data; });
    await expect(runRaffle(id, snapshot, { kind: 'draw_v1', prize: '', excludeLastN: 0 })).rejects.toThrow('Synchronize');
    expect(api.send).not.toHaveBeenCalled();
  });

  it('never sends a draw if saving its request fails locally', async () => {
    const id = await owner();
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    setTestWriteFailure(true);
    await expect(runRaffle(id, snapshot, { kind: 'draw_v1', prize: '', excludeLastN: 0 })).rejects.toThrow('Simulated local storage failure');
    setTestWriteFailure(false);
    expect(api.send).not.toHaveBeenCalled();
  });

  it('requires a fresh ticket snapshot before a draw', async () => {
    const id = await owner();
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.snapshot.mockResolvedValue({ ...snapshot, pool_hash: 'different' });
    await expect(runRaffle(id, snapshot, { kind: 'draw_v1', prize: '', excludeLastN: 0 })).rejects.toThrow('Refresh');
    expect((await readOwner(id)).pendingRaffle).toBeUndefined();
    expect(api.send).not.toHaveBeenCalled();
  });
  it('confirms a fresh round after a lost response and keeps the same request identity', async () => {
    const id = await owner();
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.send.mockRejectedValueOnce(new Error('lost')).mockResolvedValue({ round_id: 'new-round', round_revision: 0 });
    await expect(runRaffle(id, snapshot, { kind: 'set_raffle_v1', mode: 'fresh' })).rejects.toThrow('lost');
    const waiting = (await readOwner(id)).pendingRaffle!;
    await expect(enqueue(id, 'start_v1', 'new-session', 0, {}, data => { data.prepared!.roundId = 'wrong'; })).rejects.toThrow('Confirm the saved raffle request');
    expect((await readOwner(id)).prepared?.roundId).toBe('round');
    api.snapshot.mockResolvedValue({ ...snapshot, round_id: 'new-round', generation: 2, pool_count: 0, tickets: [] });
    const result = await runRaffle(id, snapshot);
    expect(result.data.pendingRaffle).toBeUndefined();
    expect(result.data.prepared?.roundId).toBe('new-round');
    expect(api.send.mock.calls[1][0].id).toBe(waiting.id);
  });

  it('refreshes a rejected request without leaving a pending operation', async () => {
    const id = await owner();
    api.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
    api.send.mockRejectedValue({ code: '40001' });
    api.snapshot.mockResolvedValueOnce(snapshot).mockResolvedValue({ ...snapshot, round_revision: 2 });
    await expect(runRaffle(id, snapshot, { kind: 'draw_v1', prize: '', excludeLastN: 0 })).rejects.toThrow('rejected');
    expect((await readOwner(id)).pendingRaffle).toBeUndefined();
    expect((await readOwner(id)).prepared?.roundRevision).toBe(2);
  });

});
