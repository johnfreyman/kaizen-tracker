import { createClient } from '@supabase/supabase-js';
import type { Operation, Prepared, Player, Session, Team, PinVerifier } from './types';
import { SHELL_VERSION, STORAGE_VERSION } from './types';

const url = import.meta.env.VITE_STAGE4_SUPABASE_URL;
const key = import.meta.env.VITE_STAGE4_SUPABASE_KEY;
if (import.meta.env.MODE !== 'stage4-test' || url !== 'https://viouquduxutuslafiooy.supabase.co' || !key?.startsWith('sb_publishable_')) {
  throw new Error('Stage 4 may connect only to the isolated test project.');
}
export const client = createClient(url, key, { auth: { storageKey: 'kaizen-stage4-test-auth' } });

function must<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error('The test project returned no data.');
  return result.data;
}
const byteaToBase64 = (value: string): string => {
  if (!value.startsWith('\\x')) throw new Error('Unsupported PIN verifier encoding.');
  const hex = value.slice(2);
  return btoa(String.fromCharCode(...(hex.match(/.{2}/g) ?? []).map(part => parseInt(part, 16))));
};

export async function prepareFromServer(ownerId: string): Promise<Prepared> {
  const identity = await client.auth.getUser();
  if (identity.error) throw identity.error;
  if (identity.data.user?.id !== ownerId) throw new Error('Sign in as the same coach to prepare this iPad.');
  const initialized = must(await client.rpc('tracker_initialize_owner_v1')) as { round_id: string; round_revision: number; raffle_enabled: boolean };
  const [p, t, m, exit] = await Promise.all([
    client.from('tracker_players').select('id,first_name,jersey_number,short_label,is_guest,retired_at,revision'),
    client.from('tracker_sub_teams').select('id,name,revision,retired_at'),
    client.from('tracker_memberships').select('player_id,team_id'),
    client.from('tracker_exit_codes').select('mode,revision,verifier_alg,verifier_iterations,verifier_salt,verifier_hash').maybeSingle(),
  ]);
  const rawPlayers = must(p) as Omit<Player, 'team_ids'>[];
  const memberships = must(m) as { player_id: string; team_id: string }[];
  const players: Player[] = rawPlayers.map(player => ({ ...player, team_ids: memberships.filter(row => row.player_id === player.id).map(row => row.team_id) }));
  const teams = must(t) as Team[];
  if (exit.error) throw exit.error;
  const exitRow = exit.data;
  let verifier: PinVerifier | null = null;
  if (exitRow?.mode === 'custom') {
    if (!exitRow.verifier_alg || !exitRow.verifier_iterations || !exitRow.verifier_salt || !exitRow.verifier_hash) throw new Error('Incomplete PIN verifier on server.');
    verifier = { alg: 'PBKDF2-SHA256', iterations: exitRow.verifier_iterations, salt: byteaToBase64(exitRow.verifier_salt), hash: byteaToBase64(exitRow.verifier_hash) };
  }
  return { version: STORAGE_VERSION, shellVersion: SHELL_VERSION, shellAssets: '', savedAt: new Date().toISOString(), players, teams, roundId: initialized.round_id, roundRevision: initialized.round_revision, raffleEnabled: initialized.raffle_enabled, exitCode: { mode: exitRow?.mode === 'custom' ? 'custom' : 'default', revision: exitRow?.revision ?? 0, verifier } };
}

export async function sendOperation(op: Operation): Promise<Record<string, unknown>> {
  const envelope = { p_operation_id: op.id, p_device_id: op.deviceId, p_device_sequence: op.sequence, p_base_revision: op.baseRevision, p_payload: op.payload };
  let result;
  if (op.kind === 'correct_v1') result = await client.rpc('tracker_correct_session_v1', { ...envelope, p_session_id: op.sessionId });
  else if (op.kind === 'set_exit_pin_v1' || op.kind === 'reset_exit_pin_v1') result = await client.rpc('tracker_apply_settings_operation_v1', { ...envelope, p_kind: op.kind });
  else if (op.kind.includes('player') || op.kind.includes('team')) result = await client.rpc('tracker_apply_roster_operation_v1', { ...envelope, p_kind: op.kind });
  else result = await client.rpc('tracker_apply_operation_v1', { ...envelope, p_kind: op.kind, p_session_id: op.sessionId });
  return must(result) as Record<string, unknown>;
}

export async function loadServerSessions(): Promise<Session[]> {
  const [sessions, attendance, expected, selected, roster, memberships] = await Promise.all([
    client.from('tracker_sessions').select('id,kind,session_date,credit_hours,round_id,all_kaizen,needs_round_review,state,revision').order('created_at', { ascending: false }).limit(100),
    client.from('tracker_attendance').select('session_id,player_id,present'),
    client.from('tracker_session_expected_players').select('session_id,player_id'),
    client.from('tracker_session_expected_teams').select('session_id,team_id'),
    client.from('tracker_session_roster').select('session_id,player_id,first_name,jersey_number,short_label,is_guest'),
    client.from('tracker_session_memberships').select('session_id,player_id,team_id'),
  ]);
  const rows = must(sessions) as Array<{ id: string; kind: Session['kind']; session_date: string; credit_hours: number; round_id: string; all_kaizen: boolean; needs_round_review: boolean; state: Session['state']; revision: number }>;
  const marks = must(attendance) as Array<{session_id: string; player_id: string; present: boolean}>;
  const exp = must(expected) as Array<{session_id: string; player_id: string}>;
  const teams = must(selected) as Array<{session_id: string; team_id: string}>;
  const people = must(roster) as Array<{session_id: string; player_id: string; first_name: string; jersey_number: string | null; short_label: string; is_guest: boolean}>;
  const member = must(memberships) as Array<{session_id: string; player_id: string; team_id: string}>;
  return rows.map(s => ({ id: s.id, kind: s.kind, date: s.session_date, creditHours: Number(s.credit_hours), roundId: s.round_id, allKaizen: s.all_kaizen, needsRoundReview: s.needs_round_review, state: s.state, revision: s.revision, expectedIds: exp.filter(x => x.session_id === s.id).map(x => x.player_id), selectedTeamIds: teams.filter(x => x.session_id === s.id).map(x => x.team_id), present: Object.fromEntries(marks.filter(x => x.session_id === s.id).map(x => [x.player_id, x.present])), roster: people.filter(x => x.session_id === s.id).map(x => ({ id: x.player_id, first_name: x.first_name, jersey_number: x.jersey_number, short_label: x.short_label, is_guest: x.is_guest, retired_at: null, revision: 0, team_ids: member.filter(y => y.session_id === s.id && y.player_id === x.player_id).map(y => y.team_id) })) }));
}
