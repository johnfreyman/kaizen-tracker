import { client, loadRaffleSnapshot, sendOperation } from './api';
import { changeOwner, readOwner } from './db';
import { activeSession, type Operation, type OwnerData, type RaffleSnapshot } from './types';

export type RaffleChoice = { kind: 'set_raffle_v1'; mode: 'off' | 'keep' | 'fresh' } | { kind: 'draw_v1'; prize: string; excludeLastN: number } | { kind: 'void_draw_v1'; drawId: string };

function requireOnline(data: OwnerData): void {
  if (!navigator.onLine || data.testOffline) throw new Error('Connect this device before changing the raffle.');
  if (!data.prepared) throw new Error('Prepare this device online first.');
  if (data.queue.length || data.pendingPin) throw new Error('Synchronize and review saved work before changing the raffle.');
  if (data.kioskSessionId) throw new Error('Exit kiosk before changing the raffle.');
}
async function checkCoach(ownerId: string) {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== ownerId) throw new Error('Sign in as this coach before changing the raffle.');
}
export async function refreshRaffle(ownerId: string, excludeLastN: number): Promise<RaffleSnapshot> {
  const data = await readOwner(ownerId);
  requireOnline(data);
  await checkCoach(ownerId);
  const snapshot = await loadRaffleSnapshot(excludeLastN);
  if (!activeSession(data) && !data.pendingRaffle) await changeOwner(ownerId, latest => {
    if (latest.prepared && !latest.queue.length && !latest.pendingRaffle && !activeSession(latest)) {
      latest.prepared.roundId = snapshot.round_id;
      latest.prepared.roundRevision = snapshot.round_revision;
      latest.prepared.raffleEnabled = snapshot.raffle_enabled;
    }
    return latest;
  });
  return snapshot;
}

export async function runRaffle(ownerId: string, shown: RaffleSnapshot, choice?: RaffleChoice): Promise<{ data: OwnerData; snapshot: RaffleSnapshot; result: Record<string, unknown> }> {
  let data = await readOwner(ownerId);
  requireOnline(data);
  await checkCoach(ownerId);
  if (!data.pendingRaffle) {
    if (!choice) throw new Error('No raffle request is waiting to retry.');
    if ((choice.kind === 'draw_v1' || (choice.kind === 'set_raffle_v1' && choice.mode === 'fresh')) && activeSession(data)) throw new Error('Finish the active session before drawing or starting a new round.');
    const fresh = await loadRaffleSnapshot(choice.kind === 'draw_v1' ? choice.excludeLastN : 0);
    if (fresh.round_id !== shown.round_id || fresh.round_revision !== shown.round_revision || (choice.kind === 'draw_v1' && fresh.pool_hash !== shown.pool_hash) || (choice.kind === 'set_raffle_v1' && fresh.pool_count !== shown.pool_count)) throw new Error('The raffle changed. Refresh its ticket count before confirming.');
    const payload = choice.kind === 'set_raffle_v1' ? { round_id: shown.round_id, mode: choice.mode }
      : choice.kind === 'draw_v1' ? { round_id: shown.round_id, draw_id: crypto.randomUUID(), prize: choice.prize.trim().slice(0, 120), exclude_last_n: choice.excludeLastN, pool_hash: shown.pool_hash }
        : { round_id: shown.round_id, draw_id: choice.drawId };
    data = await changeOwner(ownerId, latest => {
      requireOnline(latest);
      if (latest.pendingRaffle) throw new Error('A raffle request is already waiting. Retry it first.');
      if ((choice.kind === 'draw_v1' || (choice.kind === 'set_raffle_v1' && choice.mode === 'fresh')) && activeSession(latest)) throw new Error('Finish the active session before drawing or starting a new round.');
      latest.pendingRaffle = { id: crypto.randomUUID(), deviceId: latest.deviceId, sequence: latest.nextSequence++, kind: choice.kind, sessionId: null, baseRevision: shown.round_revision, payload, status: 'pending' };
      return latest;
    });
  }
  const operation: Operation = data.pendingRaffle!;
  try {
    const result = await sendOperation(operation);
    const openedRound = operation.kind === 'set_raffle_v1' && operation.payload.mode === 'fresh';
    if (typeof result.round_id !== 'string' || !result.round_id || (openedRound ? result.round_id === operation.payload.round_id : result.round_id !== operation.payload.round_id) || typeof result.round_revision !== 'number') throw new Error('The raffle response was incomplete. Retry the saved request.');
    if (operation.kind === 'draw_v1' && (result.draw_id !== operation.payload.draw_id || typeof result.display_name !== 'string')) throw new Error('The winner response was incomplete. Retry the saved request.');
    const snapshot = await loadRaffleSnapshot(typeof operation.payload.exclude_last_n === 'number' ? operation.payload.exclude_last_n : 0);
    const next = await changeOwner(ownerId, latest => {
      if (latest.pendingRaffle?.id !== operation.id || !latest.prepared) throw new Error('The saved raffle request changed.');
      latest.prepared.roundId = snapshot.round_id;
      latest.prepared.roundRevision = snapshot.round_revision;
      latest.prepared.raffleEnabled = snapshot.raffle_enabled;
      if (latest.rafflePreferences?.roundId !== snapshot.round_id) latest.rafflePreferences = { roundId: snapshot.round_id, prize: '', excludeLastN: 0 };
      delete latest.pendingRaffle;
      return latest;
    });
    return { data: next, snapshot, result };
  } catch (error) {
    if (['40001', '55000', '22023'].includes((error as { code?: string }).code ?? '')) {
      const snapshot = await loadRaffleSnapshot(0);
      await changeOwner(ownerId, latest => { if (latest.pendingRaffle?.id === operation.id) delete latest.pendingRaffle; if (latest.prepared) { latest.prepared.roundId = snapshot.round_id; latest.prepared.roundRevision = snapshot.round_revision; latest.prepared.raffleEnabled = snapshot.raffle_enabled; } return latest; });
      throw new Error('The raffle request was rejected. The current round and tickets have been refreshed; review them and try again.');
    }
    throw error;
  }
}

export async function saveRafflePreferences(ownerId: string, roundId: string, prize: string, excludeLastN: number): Promise<OwnerData> {
  if (!Number.isInteger(excludeLastN) || excludeLastN < 0 || excludeLastN > 20) throw new Error('Choose 0 to 20 recent winners.');
  return changeOwner(ownerId, data => { data.rafflePreferences = { roundId, prize: prize.slice(0, 120), excludeLastN }; return data; });
}
