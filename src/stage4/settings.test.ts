import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeOwner, enqueue, readOwner } from './db';
import { SHELL_VERSION, STORAGE_VERSION, type PinVerifier } from './types';

const api = vi.hoisted(() => ({ sendOperation: vi.fn(), loadExitCode: vi.fn() }));
vi.mock('./api', () => ({ sendOperation: api.sendOperation, loadExitCode: api.loadExitCode }));
import { changePin } from './settings';

const verifier: PinVerifier = { alg: 'PBKDF2-SHA256', iterations: 200000, salt: 'salt', hash: 'hash' };
async function owner() {
  const id = crypto.randomUUID();
  const data = await changeOwner(id, value => { value.prepared = { version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: 'test', savedAt: '', players: [], teams: [], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } }; return value; });
  return { id, data };
}
beforeEach(() => { vi.stubGlobal('navigator', { onLine: true }); api.sendOperation.mockReset(); api.loadExitCode.mockReset(); });

describe('online PIN settings', () => {
  it('retries a dropped response using one request and updates the cache from the accepted result', async () => {
    const { id, data } = await owner();
    const ledger = new Map<string, { mode: string; revision: number }>();
    api.sendOperation.mockImplementation(async op => {
      if (!ledger.has(op.id)) ledger.set(op.id, { mode: 'custom', revision: 1 });
      if (api.sendOperation.mock.calls.length === 1) throw new Error('response lost');
      return ledger.get(op.id);
    });
    await expect(changePin(id, data, verifier)).rejects.toThrow('response lost');
    const pending = await readOwner(id);
    expect(pending.queue).toHaveLength(0);
    expect(pending.pendingPin?.payload).toEqual({ verifier });
    const done = await changePin(id, pending);
    expect(ledger.size).toBe(1);
    expect(api.sendOperation.mock.calls[0][0]).toEqual(api.sendOperation.mock.calls[1][0]);
    expect(done.pendingPin).toBeUndefined();
    expect(done.prepared?.exitCode).toEqual({ mode: 'custom', revision: 1, verifier });
  });

  it('refreshes a stale PIN revision without touching attendance work', async () => {
    const { id, data } = await owner();
    const queued = await enqueue(id, 'start_v1', crypto.randomUUID(), 0, {}, () => {});
    api.sendOperation.mockRejectedValue({ code: '40001', message: 'stale' });
    api.loadExitCode.mockResolvedValue({ mode: 'custom', revision: 5, verifier });
    await expect(changePin(id, queued, verifier)).rejects.toThrow('Another device changed');
    const after = await readOwner(id);
    expect(after.prepared?.exitCode).toEqual({ mode: 'custom', revision: 5, verifier });
    expect(after.pendingPin).toBeUndefined();
    expect(after.queue).toEqual(queued.queue);
  });
});
