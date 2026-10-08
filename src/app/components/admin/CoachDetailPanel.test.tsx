// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CoachDetailPanel from './CoachDetailPanel';
import type { CoachSummaryRow } from './CoachDetailDrawer';
import type { CoachData } from './coachData';

const { invoke, from } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn(() => { throw new Error('No direct coach reads'); }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke }, from } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const row = (id: string) => ({ coach_id: id, email: `${id}@example.test`, email_verified: true, team_name: 'All Kaizen', player_count: 1, session_count: 1, total_archives: 0, last_active_at: null, last_session_at: null, team_logo: null } as CoachSummaryRow);
function fixture(coachId: string, firstName = 'Test'): CoachData {
  return { coachId, account: { bannedUntil: null }, players: [{ id: 'player', first_name: firstName, jersey_number: '99', short_label: '', is_guest: false, retired_at: null }], teams: [], memberships: [],
    sessions: [{ id: 'session', session_date: '2026-10-05', kind: 'Practice', credit_hours: 1.5, state: 'completed', completed_at: '2026-10-05T20:00:00Z', created_at: '2026-10-05T18:00:00Z', archived_at: null }],
    sessionRoster: [{ session_id: 'session', player_id: 'player', first_name: firstName, jersey_number: '99', short_label: '', is_guest: false }], attendance: [{ session_id: 'session', player_id: 'player', present: true }],
    expectedPlayers: [], expectedTeams: [], sessionMemberships: [], rounds: [], draws: [], corrections: [] };
}
describe('canonical coach detail panel', () => {
  it('loads through the protected backend and shows roster, recorded attendance and hours', async () => {
    invoke.mockResolvedValue({ data: fixture('coach-a'), error: null });
    render(<CoachDetailPanel coach={row('coach-a')} />);
    await screen.findByText('Test · #99');
    expect(invoke).toHaveBeenCalledWith('admin-coach-actions', { body: { action: 'coach-data', coachId: 'coach-a' } });
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText('Practice · 1.5 hours each')).toBeTruthy();
    fireEvent.click(screen.getByText('View attendance', { selector: 'summary' }));
    expect(screen.getByText('Test · #99 · Present')).toBeTruthy();
  });
  it('ignores a delayed response after selecting another coach', async () => {
    let resolveOld!: (value: object) => void;
    invoke.mockImplementation((_name, { body }) => body.coachId === 'coach-a' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ data: fixture('coach-b', 'Beta'), error: null }));
    const view = render(<CoachDetailPanel coach={row('coach-a')} />);
    view.rerender(<CoachDetailPanel coach={row('coach-b')} />);
    await screen.findByText('Beta · #99');
    resolveOld({ data: fixture('coach-a', 'Old coach'), error: null });
    await waitFor(() => expect(screen.queryByText('Old coach · #99')).toBeNull());
  });
  it('shows backend failures rather than treating them as empty attendance', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Access denied' } });
    render(<CoachDetailPanel coach={row('coach-a')} />);
    await screen.findByText('Access denied');
    expect(screen.queryByText('No saved sessions found.')).toBeNull();
  });
});
