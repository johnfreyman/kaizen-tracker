import { activeSession, expectedPlayers, type Operation, type OwnerData, type Player, type Session } from './types';
import { changeOwner, enqueue } from './db';
import { client, loadExitCode, loadServerSessions, prepareFromServer, sendOperation } from './api';
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

export async function refreshKeepingQueue(ownerId: string): Promise<OwnerData> {
  const [serverPrepared, serverSessions] = await Promise.all([prepareFromServer(ownerId), loadServerSessions()]);
  return changeOwner(ownerId, data => {
    const pendingSessions = new Set(data.queue.map(op => op.sessionId).filter(Boolean));
    const pendingPlayers = new Set(data.queue.map(op => op.payload.player_id).filter((id): id is string => typeof id === 'string'));
    const pendingTeams = new Set(data.queue.map(op => op.payload.team_id).filter((id): id is string => typeof id === 'string'));
    const local = data.prepared;
    serverPrepared.shellAssets = local?.shellAssets ?? '';
    serverPrepared.shellVersion = local?.shellVersion ?? serverPrepared.shellVersion;
    serverPrepared.players = [...serverPrepared.players.filter(p => !pendingPlayers.has(p.id)), ...(local?.players.filter(p => pendingPlayers.has(p.id)) ?? [])];
    serverPrepared.teams = [...serverPrepared.teams.filter(t => !pendingTeams.has(t.id)), ...(local?.teams.filter(t => pendingTeams.has(t.id)) ?? [])];
    data.prepared = serverPrepared;
    data.sessions = [...serverSessions.filter(s => !pendingSessions.has(s.id)), ...data.sessions.filter(s => pendingSessions.has(s.id))];
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
  if (prepared.teams.some(t => t.id !== id && !t.retired_at && t.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) throw new Error('An active team already has this name.');
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
function classify(issue: { code?: string; status?: number }): 'auth' | 'waiting' | 'conflict' | 'failed' {
  if (issue.status === 401 || issue.code === 'PGRST301' || issue.code === 'PGRST303') return 'auth';
  if (['40001', '23505', '55000', '22023', '22P02', '42501'].includes(issue.code ?? '')) return 'conflict';
  if (!issue.code || (issue.status ?? 0) >= 500 || /^PGRST00[0-3]$/.test(issue.code) || /^08/.test(issue.code) || ['40P01', '57014', '53300'].includes(issue.code) || /^57P0/.test(issue.code)) return 'waiting';
  return 'failed';
}

export async function reviewBlocked(ownerId: string, opId: string): Promise<OwnerData> {
  const current = await changeOwner(ownerId, data => data);
  const op = current.queue.find(item => item.id === opId);
  if (!op || op.status === 'pending') throw new Error('No blocked change to review.');
  let revision: number | null = null, summary = 'The server has no matching record.';
  if (op.sessionId) {
    const session = (await loadServerSessions(op.sessionId))[0];
    if (session) { revision = session.revision; summary = `${session.kind} ${session.date}: ${session.state}, revision ${revision}; ${Object.values(session.present).filter(Boolean).length} present.`; }
  } else if (op.kind.includes('player') || op.kind.includes('team')) {
    const roster = await prepareFromServer(ownerId);
    const entity = op.kind.includes('player') ? roster.players.find(p => p.id === op.payload.player_id) : roster.teams.find(t => t.id === op.payload.team_id);
    if (entity) { revision = entity.revision; summary = JSON.stringify(entity); }
  }
  return changeOwner(ownerId, data => {
    const target = data.queue.find(item => item.id === opId);
    if (!target || target.status === 'pending') throw new Error('Review state changed.');
    target.serverReview = { revision, summary, loadedAt: new Date().toISOString() };
    return data;
  });
}

function sameRevisionTarget(a: Operation, b: Operation): boolean {
  if (a.sessionId) return b.sessionId === a.sessionId;
  const playerId = a.payload.player_id, teamId = a.payload.team_id;
  return (typeof playerId === 'string' && b.payload.player_id === playerId) || (typeof teamId === 'string' && b.payload.team_id === teamId);
}
function dependsOn(a: Operation, b: Operation): boolean {
  if (a.sessionId && b.sessionId === a.sessionId) return true;
  const entityId = a.payload.player_id ?? a.payload.team_id;
  return typeof entityId === 'string' && JSON.stringify(b.payload).includes(entityId);
}
export async function resendBlocked(ownerId: string, opId: string): Promise<OwnerData> {
  return changeOwner(ownerId, data => {
    const index = data.queue.findIndex(op => op.id === opId), head = data.queue[index];
    if (index !== 0 || !head || !['40001', '55000'].includes(head.errorCode ?? '') || head.serverReview?.revision === null || head.serverReview?.revision === undefined) throw new Error('Refresh and review the blocked change first.');
    const oldBase = head.baseRevision, nextBase = head.serverReview.revision;
    head.id = crypto.randomUUID(); head.baseRevision = nextBase; head.status = 'pending'; delete head.error; delete head.errorCode; delete head.serverReview;
    for (const later of data.queue.slice(1)) if (sameRevisionTarget(head, later)) later.baseRevision += nextBase - oldBase;
    return data;
  });
}
export async function discardBlocked(ownerId: string, opId: string): Promise<OwnerData> {
  const current = await changeOwner(ownerId, data => data), head = current.queue[0];
  if (!head || head.id !== opId || head.status === 'pending') throw new Error('The blocked change changed.');
  const affected = new Set<string>([head.id]);
  const selected: Operation[] = [head];
  for (const op of current.queue.slice(1)) if (selected.some(earlier => dependsOn(earlier, op))) { selected.push(op); affected.add(op.id); }
  const sessionIds = [...new Set(selected.map(op => op.sessionId).filter((id): id is string => !!id))];
  const serverSessions = await Promise.all(sessionIds.map(async id => (await loadServerSessions(id))[0]));
  const serverRoster = selected.some(op => op.payload.player_id || op.payload.team_id) ? await prepareFromServer(ownerId) : null;
  return changeOwner(ownerId, data => {
    if (data.queue[0]?.id !== opId) throw new Error('Queue changed during review.');
    data.queue = data.queue.filter(op => !affected.has(op.id));
    data.sessions = data.sessions.filter(s => !sessionIds.includes(s.id));
    data.sessions.unshift(...serverSessions.filter((s): s is Session => !!s));
    if (serverRoster && data.prepared) {
      const playerIds = selected.map(op => op.payload.player_id).filter((id): id is string => typeof id === 'string');
      const teamIds = selected.map(op => op.payload.team_id).filter((id): id is string => typeof id === 'string');
      data.prepared.players = [...data.prepared.players.filter(p => !playerIds.includes(p.id)), ...serverRoster.players.filter(p => playerIds.includes(p.id))];
      data.prepared.teams = [...data.prepared.teams.filter(t => !teamIds.includes(t.id)), ...serverRoster.teams.filter(t => teamIds.includes(t.id))];
    }
    return data;
  });
}

export async function sync(ownerId: string, current: OwnerData): Promise<SyncResult> {
  if (!navigator.onLine || current.testOffline) return { data: current, state: 'waiting' };
  const identity = await client.auth.getUser();
  if (identity.error && classify(identity.error) === 'waiting') return { data: current, state: 'waiting', error: 'Waiting for connectivity.' };
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
      const issue = error as { code?: string; status?: number; message?: string }, state = classify(issue);
      if (state === 'auth') return { data, state, error: 'Sign in again as the same coach to sync.' };
      if (state === 'waiting') return { data, state, error: 'Waiting to retry the same saved operation.' };
      data = await changeOwner(ownerId, latest => { const head = latest.queue[0]; if (head?.id !== op.id) throw new Error('Queue changed during failure handling.'); head.status = state; head.errorCode = issue.code; head.error = `${issue.code ?? issue.status ?? 'ERROR'}: ${issue.message ?? String(error)}`; return latest; });
      if (issue.code === '40001' || issue.code === '55000') { try { data = await reviewBlocked(ownerId, op.id); } catch { /* keep local intent for review after connectivity returns */ } }
      return { data, state, error: data.queue[0]?.error };
    }
  }
  try { const exitCode = await loadExitCode(); data = await changeOwner(ownerId, latest => { if (latest.prepared) latest.prepared.exitCode = exitCode; return latest; }); }
  catch { return { data, state: 'waiting', error: 'Attendance synced; PIN settings refresh is waiting.' }; }
  return { data, state: 'synced' };
}

export function sessionDelivery(data: OwnerData, sessionId: string): 'waiting' | 'conflict' | 'failed' | 'synced' {
  const ops = data.queue.filter(op => op.sessionId === sessionId);
  if (ops.some(op => op.status === 'conflict')) return 'conflict';
  if (ops.some(op => op.status === 'failed')) return 'failed';
  return ops.length ? 'waiting' : 'synced';
}
