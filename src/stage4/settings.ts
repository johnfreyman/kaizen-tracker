import { loadExitCode, sendOperation } from './api';
import { changeOwner } from './db';
import type { Operation, OwnerData, PinVerifier } from './types';

export async function changePin(ownerId: string, current: OwnerData, verifier?: PinVerifier): Promise<OwnerData> {
  if (!navigator.onLine || current.testOffline) throw new Error('Connect to change the PIN.');
  if (!current.prepared) throw new Error('Prepare this iPad first.');
  let data = current;
  if (!data.pendingPin) data = await changeOwner(ownerId, latest => {
    if (!latest.prepared || latest.pendingPin) throw new Error('A PIN change is already waiting for its result.');
    const op: Operation = { id: crypto.randomUUID(), deviceId: latest.deviceId, sequence: latest.nextSequence++, kind: verifier ? 'set_exit_pin_v1' : 'reset_exit_pin_v1', sessionId: null, baseRevision: latest.prepared.exitCode.revision, payload: verifier ? { verifier } : {}, status: 'pending' };
    latest.pendingPin = op;
    return latest;
  });
  const op = data.pendingPin!;
  try {
    const result = await sendOperation(op);
    if ((result.mode !== 'custom' && result.mode !== 'default') || typeof result.revision !== 'number') throw new Error('PIN response was incomplete; retry the same request.');
    return changeOwner(ownerId, latest => {
      if (latest.pendingPin?.id !== op.id || !latest.prepared) throw new Error('PIN request changed during upload.');
      latest.prepared.exitCode = { mode: result.mode as 'custom' | 'default', revision: result.revision as number, verifier: result.mode === 'custom' ? op.payload.verifier as PinVerifier : null };
      delete latest.pendingPin;
      return latest;
    });
  } catch (error) {
    if ((error as { code?: string }).code === '40001') {
      const exitCode = await loadExitCode();
      await changeOwner(ownerId, latest => { if (latest.prepared) latest.prepared.exitCode = exitCode; if (latest.pendingPin?.id === op.id) delete latest.pendingPin; return latest; });
      throw new Error('Another device changed the PIN. The current server setting is now shown; choose a new change if needed.');
    }
    throw error;
  }
}

export async function discardPendingPin(ownerId: string): Promise<OwnerData> {
  const exitCode = await loadExitCode();
  return changeOwner(ownerId, latest => { if (latest.prepared) latest.prepared.exitCode = exitCode; delete latest.pendingPin; return latest; });
}
