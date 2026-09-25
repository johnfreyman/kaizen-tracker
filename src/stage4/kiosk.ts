import { client, loadExitCode, loadServerSessions } from './api';
import { changeOwner } from './db';
import { verifyPin } from './pin';
import { activeSession, type OwnerData, type Player } from './types';

export function kioskMatches(data: OwnerData, number: string): Player[] {
  if (!/^\d{1,3}$/.test(number)) return [];
  return (data.prepared?.players ?? []).filter(player => !player.retired_at && player.jersey_number === number);
}

export async function enterKiosk(ownerId: string, current: OwnerData): Promise<OwnerData> {
  const session = activeSession(current);
  if (!session || !current.prepared) throw new Error('Start attendance and prepare this iPad before entering kiosk.');
  if (current.pendingPin) throw new Error('Confirm the pending PIN request before entering kiosk.');
  return changeOwner(ownerId, data => {
    if (activeSession(data)?.id !== session.id || !data.prepared || data.pendingPin) throw new Error('The session or PIN setting changed. Review it before entering kiosk.');
    data.kioskSessionId = session.id;
    delete data.kioskClosedSessionId;
    return data;
  });
}

export async function exitKiosk(ownerId: string, current: OwnerData, pin: string): Promise<OwnerData> {
  if (!current.kioskSessionId || !current.prepared) throw new Error('The prepared kiosk session is unavailable.');
  if (!await verifyPin(pin, current.prepared.exitCode)) throw new Error('Incorrect coach PIN.');
  return changeOwner(ownerId, data => {
    if (data.kioskSessionId !== current.kioskSessionId) throw new Error('The kiosk session changed. Try again.');
    delete data.kioskSessionId;
    delete data.kioskClosedSessionId;
    return data;
  });
}

export async function refreshKioskState(ownerId: string, current: OwnerData): Promise<OwnerData> {
  if (!navigator.onLine || current.testOffline) throw new Error('Reconnect this iPad before checking the session and exit code.');
  if (!current.kioskSessionId) throw new Error('No kiosk session is bound to this iPad.');
  const identity = await client.auth.getUser();
  if (identity.error || identity.data.user?.id !== ownerId) throw new Error('Sign in as this coach to refresh the session and exit code.');
  const [exitCode, serverSession] = await Promise.all([loadExitCode(), loadServerSessions(current.kioskSessionId)]);
  return changeOwner(ownerId, data => {
    if (data.kioskSessionId !== current.kioskSessionId || !data.prepared) throw new Error('The kiosk session changed. Try again.');
    data.prepared.exitCode = exitCode;
    if (serverSession[0]?.state === 'completed') {
      data.kioskClosedSessionId = current.kioskSessionId;
      if (!data.queue.some(operation => operation.sessionId === current.kioskSessionId)) {
        data.sessions = data.sessions.map(session => session.id === current.kioskSessionId ? serverSession[0] : session);
      }
    }
    return data;
  });
}
