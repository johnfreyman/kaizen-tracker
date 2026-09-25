import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>[]>(), filters: new Map<string, string[][]>() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getUser: vi.fn() },
  from(table: string) {
    let selected: Record<string, unknown>[] = [], range: [number, number] | null = null, limit = 1000;
    const query = {
      select() { selected = db.rows.get(table) ?? []; return query; },
      in(column: string, values: string[]) { db.filters.set(table, [...(db.filters.get(table) ?? []), values]); selected = selected.filter(row => values.includes(String(row[column]))); return query; },
      order() { return query; },
      limit(value: number) { limit = value; return query; },
      range(from: number, to: number) { range = [from, to]; return query; },
      maybeSingle() { return Promise.resolve({ data: selected[0] ?? null, error: null, status: 200 }); },
      then(resolve: (result: { data: Record<string, unknown>[]; error: null; status: number }) => unknown) { const data = range ? selected.slice(range[0], range[1] + 1) : selected.slice(0, limit); return Promise.resolve(resolve({ data, error: null, status: 200 })); },
    };
    return query;
  },
}) }));

beforeEach(() => {
  vi.stubEnv('MODE', 'stage4-test');
  vi.stubEnv('VITE_STAGE4_SUPABASE_URL', 'https://viouquduxutuslafiooy.supabase.co');
  vi.stubEnv('VITE_STAGE4_SUPABASE_KEY', 'sb_publishable_test');
  db.rows.clear(); db.filters.clear();
});

describe('paged Stage 4 reads', () => {
  it('loads every child row for the selected sessions beyond the default 1000-row cap', async () => {
    const other = 'other-session';
    db.rows.set('tracker_sessions', [{ id: 'session-1', kind: 'Practice', session_date: '2026-09-23', credit_hours: 1.5, round_id: 'round', all_kaizen: true, needs_round_review: false, state: 'completed', revision: 1205 }]);
    const ids = Array.from({ length: 1205 }, (_, index) => `player-${String(index).padStart(4, '0')}`);
    db.rows.set('tracker_attendance', [...ids.map(player_id => ({ session_id: 'session-1', player_id, present: true })), { session_id: other, player_id: 'outside', present: true }]);
    db.rows.set('tracker_session_expected_players', ids.map(player_id => ({ session_id: 'session-1', player_id })));
    db.rows.set('tracker_session_expected_teams', [{ session_id: 'session-1', team_id: 'blue' }]);
    db.rows.set('tracker_session_roster', ids.map(player_id => ({ session_id: 'session-1', player_id, first_name: player_id, jersey_number: null, short_label: '', is_guest: false })));
    db.rows.set('tracker_session_memberships', ids.map(player_id => ({ session_id: 'session-1', player_id, team_id: 'blue' })));
    const { loadServerSessions } = await import('./api');
    const sessions = await loadServerSessions();
    expect(sessions[0].roster).toHaveLength(1205);
    expect(sessions[0].expectedIds).toHaveLength(1205);
    expect(Object.keys(sessions[0].present)).toHaveLength(1205);
    expect(sessions[0].roster[1204]?.team_ids).toEqual(['blue']);
    expect(db.filters.get('tracker_attendance')).toEqual([['session-1'], ['session-1'], ['session-1']]);
  });

  it('pages players and memberships when preparing a device', async () => {
    const ids = Array.from({ length: 1205 }, (_, index) => `player-${String(index).padStart(4, '0')}`);
    db.rows.set('tracker_players', ids.map(id => ({ id, first_name: id, jersey_number: null, short_label: '', is_guest: false, retired_at: null, revision: 0 })));
    db.rows.set('tracker_memberships', ids.map(player_id => ({ player_id, team_id: 'blue' })));
    db.rows.set('tracker_sub_teams', [{ id: 'blue', name: 'Blue', revision: 0, retired_at: null }]);
    const { client, prepareFromServer } = await import('./api');
    vi.mocked(client.auth.getUser).mockResolvedValue({ data: { user: { id: 'coach' } }, error: null } as never);
    client.rpc = vi.fn().mockResolvedValue({ data: { round_id: 'round', round_revision: 0, raffle_enabled: true }, error: null });
    const result = await prepareFromServer('coach');
    expect(result.players).toHaveLength(1205);
    expect(result.players[1204]?.team_ids).toEqual(['blue']);
  });

  it('keeps the HTTP status when an RPC returns a PostgREST error', async () => {
    const { client, sendOperation } = await import('./api');
    client.rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST002', message: 'unavailable' }, status: 503 });
    await expect(sendOperation({ id: 'op', deviceId: 'device', sequence: 1, kind: 'start_v1', sessionId: 'session', baseRevision: 0, payload: {}, status: 'pending' })).rejects.toMatchObject({ code: 'PGRST002', status: 503 });
  });
});
