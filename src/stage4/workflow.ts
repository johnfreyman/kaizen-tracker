import { activeSession, expectedPlayers, type OwnerData, type Player, type Session, type Team } from './types';
import { changeOwner, enqueue } from './db';
import { client, loadServerSessions, prepareFromServer, sendOperation } from './api';
import { prepareShell } from './shell';

export function today(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function snapshot(player: Player) { return { player_id: player.id, first_name: player.first_name, jersey_number: player.jersey_number, short_label: player.short_label, is_guest: player.is_guest, team_ids: player.team_ids }; }
function requirePrepared(data: OwnerData) { if (!data.prepared) throw new Error('Prepare this iPad online first.'); return data.prepared; }

export async function prepare(ownerId: string, current: OwnerData): Promise<OwnerData> {
  if (current.queue.length) throw new Error('Sync or review pending work before refreshing the prepared roster.');
  const shellAssets = await prepareShell();
  const prepared = await prepareFromServer(ownerId);
  prepared.shellAssets = shellAssets;
  const serverSessions = await loadServerSessions();
  return changeOwner(ownerId, data => {
    if (data.queue.length) throw new Error('Pending work appeared during preparation. Retry after sync.');
    data.prepared = prepared;
    data.sessions = serverSessions;
    data.lastSyncAt = new Date().toISOString();
    return data;
  });
}

export async function startSession(ownerId: string, current: OwnerData, kind: Session['kind'], teamIds: string[], allKaizen: boolean, date: string): Promise<OwnerData> {
  if (activeSession(current)) throw new Error('Finish the current session first.');
  const prepared = requirePrepared(current);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`)) || date > today()) throw new Error('Choose a valid date through today.');
  if (kind === 'Practice' && !allKaizen && !teamIds.length) throw new Error('Select a team or All Kaizen.');
  if (kind === 'Optional Training') { teamIds = []; allKaizen = false; }
  const roster = prepared.players.filter(p => !p.retired_at).map(p => structuredClone(p));
  const expectedIds = kind === 'Practice' ? expectedPlayers(current, teamIds, allKaizen) : [];
  const id = crypto.randomUUID();
  const session: Session = { id, kind, date, creditHours: 1.5, roundId: prepared.roundId, expectedIds, selectedTeamIds: teamIds, allKaizen, roster, present: {}, state: 'active', revision: 0 };
  const payload = { kind, session_date: date, round_id: prepared.roundId, all_kaizen: allKaizen, selected_team_ids: teamIds, expected_player_ids: expectedIds, roster: roster.map(snapshot), prepared_cache_version: prepared.shellVersion };
  return enqueue(ownerId, 'start_v1', id, 0, payload, data => { if (activeSession(data)) throw new Error('A session is already active.'); data.sessions.unshift(session); });
}

export async function markPresent(ownerId: string, current: OwnerData, playerId: string, present: boolean): Promise<OwnerData> {
  const session = activeSession(current); if (!session) throw new Error('No active session.');
  const player = session.roster.find(p => p.id === playerId) ?? current.prepared?.players.find(p => p.id === playerId && !p.retired_at);
  if (!player) throw new Error('Player is not in the prepared roster.');
  const payload: Record<string, unknown> = { player_id: playerId, present };
  if (!session.roster.some(p => p.id === playerId)) payload.snapshot = snapshot(player);
  return enqueue(ownerId, 'set_present_v1', session.id, session.revision, payload, data => {
    const target = data.sessions.find(s => s.id === session.id)!;
    if (!target.roster.some(p => p.id === playerId)) target.roster.push(structuredClone(player));
    target.present[playerId] = present;
    target.revision += 1;
  });
}

export async function finishSession(ownerId: string, current: OwnerData): Promise<OwnerData> {
  const session = activeSession(current); if (!session) throw new Error('No active session.');
  return enqueue(ownerId, 'finish_v1', session.id, session.revision, {}, data => { const target = data.sessions.find(s => s.id === session.id)!; target.state = 'completed'; target.revision += 1; });
}

export async function correctAttendance(ownerId: string, current: OwnerData, sessionId: string, playerId: string, present: boolean, reason: string): Promise<OwnerData> {
  const session = current.sessions.find(s => s.id === sessionId && s.state === 'completed');
  if (!session) throw new Error('Choose a completed session.');
  const player = session.roster.find(p => p.id === playerId) ?? current.prepared?.players.find(p => p.id === playerId);
  if (!player) throw new Error('Player is not in the roster.');
  const change: Record<string, unknown> = { player_id: playerId, present };
  if (!session.roster.some(p => p.id === playerId)) change.snapshot = snapshot(player);
  return enqueue(ownerId, 'correct_v1', session.id, session.revision, { changes: [change], reason: reason.slice(0, 500) }, data => {
    const target = data.sessions.find(s => s.id === session.id)!;
    if (!target.roster.some(p => p.id === playerId)) target.roster.push(structuredClone(player));
    target.present[playerId] = present; target.revision += 1;
  });
}

export async function saveTeam(ownerId: string, current: OwnerData, name: string, teamId?: string): Promise<OwnerData> {
  const prepared = requirePrepared(current); const existing = prepared.teams.find(t => t.id === teamId); const id = existing?.id ?? crypto.randomUUID();
  if (!name.trim()) throw new Error('Enter a team name.');
  const kind = existing ? 'rename_team_v1' : 'create_team_v1';
  return enqueue(ownerId, kind, null, existing?.revision ?? 0, { team_id: id, name: name.trim() }, data => {
    const teams = data.prepared!.teams;
    if (existing) { const team = teams.find(t => t.id === id)!; team.name = name.trim(); team.revision += 1; }
    else teams.push({ id, name: name.trim(), revision: 0, retired_at: null });
  });
}

export async function savePlayer(ownerId: string, current: OwnerData, fields: Pick<Player, 'first_name' | 'jersey_number' | 'short_label' | 'is_guest' | 'team_ids'>, playerId?: string): Promise<OwnerData> {
  const prepared = requirePrepared(current); const existing = prepared.players.find(p => p.id === playerId); const id = existing?.id ?? crypto.randomUUID();
  const first = fields.first_name.trim(), label = fields.short_label.trim();
  if (!first) throw new Error('Enter a first name.');
  if (fields.jersey_number !== null && !/^\d{1,3}$/.test(fields.jersey_number)) throw new Error('Jersey number must be one to three digits.');
  if (prepared.players.some(p => p.id !== id && !p.retired_at && p.first_name.trim().toLowerCase() === first.toLowerCase() && p.jersey_number === fields.jersey_number && p.short_label.trim().toLowerCase() === label.toLowerCase())) throw new Error('This card matches another player. Add a distinguishing label.');
  const payload = { player_id: id, first_name: first, jersey_number: fields.jersey_number, short_label: label, is_guest: fields.is_guest, team_ids: fields.team_ids };
  return enqueue(ownerId, existing ? 'update_player_v1' : 'create_player_v1', null, existing?.revision ?? 0, payload, data => {
    const players = data.prepared!.players;
    if (existing) Object.assign(players.find(p => p.id === id)!, fields, { first_name: first, short_label: label, revision: existing.revision + 1 });
    else players.push({ id, ...fields, first_name: first, short_label: label, retired_at: null, revision: 0 });
  });
}

export async function retireOrRestore(ownerId: string, current: OwnerData, playerId: string, restore: boolean, label = ''): Promise<OwnerData> {
  const player = requirePrepared(current).players.find(p => p.id === playerId); if (!player) throw new Error('Player not found.');
  if (restore && current.prepared!.players.some(p => p.id !== player.id && !p.retired_at && p.first_name.toLowerCase() === player.first_name.toLowerCase() && p.jersey_number === player.jersey_number && p.short_label.toLowerCase() === label.trim().toLowerCase())) throw new Error('Restoring this card needs a distinguishing label.');
  const payload = restore ? { player_id: playerId, short_label: label.trim() } : { player_id: playerId };
  return enqueue(ownerId, restore ? 'restore_player_v1' : 'retire_player_v1', null, player.revision, payload, data => {
    const target = data.prepared!.players.find(p => p.id === playerId)!;
    target.retired_at = restore ? null : new Date().toISOString();
    if (restore) target.short_label = label.trim();
    target.revision += 1;
  });
}

export type SyncResult = { data: OwnerData; state: 'synced' | 'waiting' | 'auth' | 'conflict' | 'failed'; error?: string };
export async function sync(ownerId: string, current: OwnerData): Promise<SyncResult> {
  if (!navigator.onLine || current.testOffline) return { data: current, state: 'waiting' };
  const identity = await client.auth.getUser();
  if (identity.error?.status === 0) return { data: current, state: 'waiting', error: 'Waiting for connectivity.' };
  if (identity.error || identity.data.user?.id !== ownerId) return { data: current, state: 'auth', error: 'Sign in again as the same coach to sync.' };
  let data = current;
  while (data.queue.length) {
    const op = data.queue[0];
    if (op.status === 'conflict' || op.status === 'failed') return { data, state: op.status, error: op.error };
    try {
      const result = await sendOperation(op);
      if (op.sessionId && result.session_id !== op.sessionId) throw new Error('Server acknowledged another session.');
      data = await changeOwner(ownerId, latest => {
        const head = latest.queue[0]; if (head?.id !== op.id) throw new Error('Queue changed during sync.');
        const session = latest.sessions.find(s => s.id === op.sessionId);
        if (session && result.needs_round_review === true) session.needsRoundReview = true;
        latest.queue.shift();
        latest.lastSyncAt = new Date().toISOString();
        return latest;
      });
    } catch (error) {
      const issue = error as { code?: string; status?: number; message?: string };
      if (issue.status === 401 || issue.status === 403 || issue.code === '42501') return { data, state: 'auth', error: 'Sign in again as the same coach to sync.' };
      const conflict = ['40001', '23505', '55000', '22023', '22P02'].includes(issue.code ?? '');
      if (!conflict && (!navigator.onLine || !issue.code)) return { data, state: 'waiting', error: 'Waiting to retry the same saved operation.' };
      data = await changeOwner(ownerId, latest => { const head = latest.queue[0]; if (head?.id !== op.id) throw new Error('Queue changed during failure handling.'); head.status = conflict ? 'conflict' : 'failed'; head.error = `${issue.code ?? 'ERROR'}: ${issue.message ?? String(error)}`; return latest; });
      return { data, state: conflict ? 'conflict' : 'failed', error: data.queue[0]?.error };
    }
  }
  return { data, state: 'synced' };
}

export function sessionDelivery(data: OwnerData, sessionId: string): 'waiting' | 'conflict' | 'failed' | 'synced' {
  const ops = data.queue.filter(op => op.sessionId === sessionId);
  if (ops.some(op => op.status === 'conflict')) return 'conflict';
  if (ops.some(op => op.status === 'failed')) return 'failed';
  return ops.length ? 'waiting' : 'synced';
}
