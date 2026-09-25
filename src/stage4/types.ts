export const STORAGE_VERSION = 1;
export const SHELL_VERSION = 'stage5-shell-11';

export type Player = { id: string; first_name: string; jersey_number: string | null; short_label: string; is_guest: boolean; retired_at: string | null; revision: number; team_ids: string[] };
export type Team = { id: string; name: string; revision: number; retired_at: string | null };
export type ExitCode = { mode: 'default' | 'custom'; revision: number; verifier: PinVerifier | null };
export type PinVerifier = { alg: 'PBKDF2-SHA256'; iterations: number; salt: string; hash: string };
export type Prepared = { version: number; shellVersion: string; shellAssets: string; savedAt: string; players: Player[]; teams: Team[]; roundId: string; roundRevision: number; raffleEnabled: boolean; exitCode: ExitCode };
export type Session = { id: string; kind: 'Practice' | 'Optional Training'; date: string; creditHours: number; roundId: string; expectedIds: string[]; selectedTeamIds: string[]; allKaizen: boolean; roster: Player[]; present: Record<string, boolean>; state: 'active' | 'completed'; revision: number; needsRoundReview?: boolean };
export type Operation = { id: string; deviceId: string; sequence: number; kind: string; sessionId: string | null; baseRevision: number; payload: Record<string, unknown>; status: 'pending' | 'conflict' | 'failed'; error?: string; errorCode?: string; serverReview?: { revision: number | null; summary: string; loadedAt: string } };
export type OwnerData = { version: number; ownerId: string; deviceId: string; nextSequence: number; prepared: Prepared | null; sessions: Session[]; queue: Operation[]; pendingPin?: Operation; kioskSessionId?: string; kioskClosedSessionId?: string; lastSyncAt: string | null; testOffline?: boolean };
export function emptyOwner(ownerId: string): OwnerData { return { version: STORAGE_VERSION, ownerId, deviceId: crypto.randomUUID(), nextSequence: 1, prepared: null, sessions: [], queue: [], lastSyncAt: null }; }
export function activeSession(data: OwnerData): Session | undefined { return data.sessions.find(s => s.state === 'active'); }
export function displayPlayer(p: Player): string { return `${p.first_name}${p.short_label ? ` ${p.short_label}` : ''}${p.jersey_number === null ? '' : ` · #${p.jersey_number}`}`; }
export function expectedPlayers(data: OwnerData, teamIds: string[], allKaizen: boolean): string[] { return [...new Set((data.prepared?.players ?? []).filter(p => !p.retired_at && (allKaizen || p.team_ids.some(id => teamIds.includes(id)))).map(p => p.id))]; }
