// Audit A7: describe a blocked change in coach terms instead of storage terms.
import { displayPlayer, type Operation, type OwnerData } from './types';

const ACTIONS: Record<string, string> = {
  start_v1: 'Start session', set_present_v1: 'Attendance mark', finish_v1: 'Finish session', correct_v1: 'Attendance correction',
  create_player_v1: 'Add player', update_player_v1: 'Edit player', retire_player_v1: 'Retire player', restore_player_v1: 'Restore player',
  create_team_v1: 'Add team', rename_team_v1: 'Rename team',
};

export function blockedReason(op: Operation): string {
  switch (op.errorCode) {
    case '40001': case '55000': return 'This record was changed on another device before your change arrived.';
    case '23505': return 'This matches a record that already exists.';
    case '42501': return 'This account is not allowed to make this change.';
    default: return 'The server did not accept this change.';
  }
}

export function describeChange(op: Operation, data: OwnerData): { action: string; detail: string } {
  const action = ACTIONS[op.kind] ?? 'Saved change';
  const session = data.sessions.find(s => s.id === op.sessionId);
  const where = session ? `${session.kind} · ${session.date}` : '';
  const playerId = typeof op.payload.player_id === 'string' ? op.payload.player_id : (op.payload.changes as { player_id?: string }[] | undefined)?.[0]?.player_id;
  const player = playerId ? (session?.roster.find(p => p.id === playerId) ?? data.prepared?.players.find(p => p.id === playerId)) : undefined;
  const who = player ? displayPlayer(player) : typeof op.payload.first_name === 'string' ? op.payload.first_name : '';
  const present = typeof op.payload.present === 'boolean' ? op.payload.present : (op.payload.changes as { present?: boolean }[] | undefined)?.[0]?.present;
  const team = typeof op.payload.name === 'string' ? op.payload.name : '';
  const value = present === true ? 'mark present' : present === false ? 'mark absent' : team ? `“${team}”` : '';
  return { action, detail: [where, who, value].filter(Boolean).join(' · ') || 'No further details' };
}

/** Number of saved changes that "Use saved version" would remove with this one. */
export function affectedCount(op: Operation, data: OwnerData): number {
  const ids = [op.sessionId, op.payload.player_id, op.payload.team_id].filter((id): id is string => typeof id === 'string');
  return data.queue.filter(item => item.id === op.id || (item.sessionId && item.sessionId === op.sessionId) || ids.some(id => JSON.stringify(item.payload).includes(id))).length;
}
