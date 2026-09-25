import { emptyOwner, STORAGE_VERSION, type OwnerData } from './types';

const DB_NAME = 'kaizen-stage4-test';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;
let testWriteFailure = false;
export function setTestWriteFailure(on: boolean): void { testWriteFailure = on; }

function open(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('owners')) request.result.createObjectStore('owners', { keyPath: 'ownerId' }); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Another tab is blocking the local database update. Close it and retry.'));
    request.onsuccess = () => resolve(request.result);
  }).catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function completion(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Local transaction failed')); tx.onerror = () => reject(tx.error ?? new Error('Local transaction failed')); }); }
function checked(value: OwnerData | undefined, ownerId: string): OwnerData { if (!value) return emptyOwner(ownerId); if (value.version !== STORAGE_VERSION) throw new Error(`Local data version ${value.version} needs a supported migration. Pending attendance remains on this device; do not clear site data.`); return value; }

export async function readOwner(ownerId: string): Promise<OwnerData> { const db = await open(); const tx = db.transaction('owners', 'readonly'); const value = await requestValue(tx.objectStore('owners').get(ownerId)) as OwnerData | undefined; await completion(tx); return checked(value, ownerId); }

// A single readwrite transaction commits the revised local state and its immutable
// operation in one record. No success state is exposed before completion.
export async function changeOwner(ownerId: string, change: (current: OwnerData) => OwnerData): Promise<OwnerData> {
  if (testWriteFailure) throw new Error('Simulated local storage failure');
  const db = await open(); const tx = db.transaction('owners', 'readwrite');
  try {
    const current = checked(await requestValue(tx.objectStore('owners').get(ownerId)) as OwnerData | undefined, ownerId);
    const next = change(structuredClone(current));
    if (next.ownerId !== ownerId || next.version !== STORAGE_VERSION) throw new Error('Owner or storage version changed');
    tx.objectStore('owners').put(next);
    await completion(tx);
    return next;
  } catch (error) { try { tx.abort(); } catch { /* already settled */ } throw error; }
}

export async function enqueue(ownerId: string, kind: string, sessionId: string | null, baseRevision: number, payload: Record<string, unknown>, apply: (data: OwnerData) => void): Promise<OwnerData> {
  const opId = crypto.randomUUID();
  return changeOwner(ownerId, data => {
    apply(data);
    data.queue.push({ id: opId, deviceId: data.deviceId, sequence: data.nextSequence++, kind, sessionId, baseRevision, payload: structuredClone(payload), status: 'pending' });
    return data;
  });
}
