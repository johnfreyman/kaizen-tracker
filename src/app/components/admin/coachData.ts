import { supabase } from '@/lib/supabase';

export type AdminPlayer = { id: string; first_name: string; jersey_number: string | null; short_label: string; is_guest: boolean; retired_at: string | null };
export type AdminSession = { id: string; session_date: string; kind: string; credit_hours: number; state: string; completed_at: string | null; created_at: string; archived_at: string | null };
export type AdminSessionPlayer = Omit<AdminPlayer, 'id' | 'retired_at'> & { session_id: string; player_id: string };
export type CoachData = {
  coachId: string;
  account: { bannedUntil: string | null };
  players: AdminPlayer[];
  teams: Array<{ id: string; name: string }>;
  memberships: Array<{ player_id: string; team_id: string }>;
  sessions: AdminSession[];
  sessionRoster: AdminSessionPlayer[];
  attendance: Array<{ session_id: string; player_id: string; present: boolean }>;
  expectedPlayers: unknown[]; expectedTeams: unknown[]; sessionMemberships: unknown[];
  rounds: unknown[]; draws: unknown[]; corrections: unknown[];
};

export function adminPlayerName(player: Pick<AdminPlayer, 'first_name' | 'jersey_number' | 'short_label'>): string {
  return [player.first_name, player.jersey_number !== null ? `#${player.jersey_number}` : '', player.short_label].filter(Boolean).join(' · ');
}

export async function loadCoachData(coachId: string): Promise<CoachData> {
  const { data, error } = await supabase.functions.invoke('admin-coach-actions', { body: { action: 'coach-data', coachId } });
  if (error) {
    let message = error.message;
    try { const body = await error.context?.json(); if (body?.error) message = body.error; } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (data?.coachId !== coachId || !['players', 'teams', 'memberships', 'sessions', 'sessionRoster', 'attendance', 'expectedPlayers', 'expectedTeams', 'sessionMemberships', 'rounds', 'draws', 'corrections'].every(key => Array.isArray(data[key]))) {
    throw new Error('The coach details response was incomplete.');
  }
  return data as CoachData;
}
