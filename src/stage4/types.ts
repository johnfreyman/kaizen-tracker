export const STORAGE_VERSION = 1;
export const SHELL_VERSION = 'stage6-shell-18';

export type Player = { id: string; first_name: string; jersey_number: string | null; short_label: string; is_guest: boolean; retired_at: string | null; revision: number; team_ids: string[] };
export type Team = { id: string; name: string; revision: number; retired_at: string | null };
export type ExitCode = { mode: 'default' | 'custom'; revision: number; verifier: PinVerifier | null };
export type PinVerifier = { alg: 'PBKDF2-SHA256'; iterations: number; salt: string; hash: string };
export type Prepared = { version: number; shellVersion: string; shellAssets: string; savedAt: string; players: Player[]; teams: Team[]; roundId: string; roundRevision: number; raffleEnabled: boolean; exitCode: ExitCode };
export type Session = { id: string; kind: 'Practice' | 'Optional Training'; date: string; creditHours: number; roundId: string; expectedIds: string[]; selectedTeamIds: string[]; allKaizen: boolean; roster: Player[]; present: Record<string, boolean>; state: 'active' | 'completed'; revision: number; archivedAt?: string | null; needsRoundReview?: boolean };
export type Operation = { id: string; deviceId: string; sequence: number; kind: string; sessionId: string | null; baseRevision: number; payload: Record<string, unknown>; status: 'pending' | 'conflict' | 'failed'; error?: string; errorCode?: string; serverReview?: { revision: number | null; summary: string; loadedAt: string } };
export type RaffleTicket = { session_id: string; player_id: string; display_name: string };
export type RaffleDraw = { id: string; round_id: string; player_id: string; display_name: string; prize: string; drawn_at: string; voided_at: string | null; pool_count: number };
export type RaffleSnapshot = { round_id: string; round_revision: number; generation: number; raffle_enabled: boolean; tickets: RaffleTicket[]; pool_count: number; pool_hash: string; excluded_player_ids: string[]; draws: RaffleDraw[] };
export type OwnerData = { version: number; ownerId: string; deviceId: string; nextSequence: number; prepared: Prepared | null; sessions: Session[]; queue: Operation[]; pendingPin?: Operation; pendingRaffle?: Operation; rafflePreferences?: { roundId: string; prize: string; excludeLastN: number }; kioskSessionId?: string; kioskClosedSessionId?: string; lastSyncAt: string | null; testOffline?: boolean };
export function emptyOwner(ownerId: string): OwnerData { return { version: STORAGE_VERSION, ownerId, deviceId: crypto.randomUUID(), nextSequence: 1, prepared: null, sessions: [], queue: [], lastSyncAt: null }; }
export function activeSession(data: OwnerData): Session | undefined { return data.sessions.find(s => s.state === 'active'); }
export function displayPlayer(p: Player): string { return `${p.first_name}${p.short_label ? ` ${p.short_label}` : ''}${p.jersey_number === null ? '' : ` · #${p.jersey_number}`}`; }
export function expectedPlayers(data: OwnerData, teamIds: string[], allKaizen: boolean): string[] { return [...new Set((data.prepared?.players ?? []).filter(p => !p.retired_at && (allKaizen || p.team_ids.some(id => teamIds.includes(id)))).map(p => p.id))]; }
