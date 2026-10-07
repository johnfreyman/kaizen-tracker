// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
vi.mock('./api', () => ({}));
import AttendancePlayers from './AttendancePlayers';
import { changeOwner, readOwner } from './db';
import { finishSession, markPresent, startSession } from './workflow';
import { SHELL_VERSION, type OwnerData, type Player, type Prepared, type Team } from './types';

afterEach(cleanup);
const teams: Team[] = [
  { id: 'red', name: 'Red', revision: 0, retired_at: null },
  { id: 'blue', name: 'Blue', revision: 0, retired_at: null },
];
function player(id: string, name: string, number: string | null, teamIds: string[], label = ''): Player {
  return { id, first_name: name, jersey_number: number, team_ids: teamIds, short_label: label, is_guest: false, retired_at: null, revision: 0 };
}
const players = [
  player('shared', 'Kayla', '0', ['blue', 'red']),
  player('red-only', 'Owen', '00', ['red']),
  player('jules-a', 'Jules', '7', ['blue'], 'A'),
  player('jules-b', 'Jules', '7', ['red'], 'B'),
  player('unassigned', 'Alex', null, []),
  player('ten', 'Zoe', '10', ['red']),
];
const prepared: Prepared = { version: 1, shellVersion: SHELL_VERSION, shellAssets: 'test', savedAt: '2026-09-26T00:00:00Z', players, teams, roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } };
const cards = () => within(screen.getByRole('group', { name: 'Attendance players' })).getAllByRole('button');
function renderList(overrides: Partial<Parameters<typeof AttendancePlayers>[0]> = {}) {
  const props = { players, currentPlayers: players, teams, present: {}, busy: false, onMark: vi.fn(), ...overrides };
  return { ...render(<AttendancePlayers {...props} />), props };
}

describe('coach attendance teams and sorting', () => {
  it('finds the same shared identity under either team and marks only the selected labelled player', () => {
    const { props } = renderList();
    expect(cards()).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'blue' } });
    expect(cards()).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Kayla · #0/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'red' } });
    expect(cards()).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Kayla · #0/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Jules B · #7/ }));
    expect(props.onMark).toHaveBeenCalledWith('jules-b', true);
    expect(props.onMark).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'all' } });
    expect(screen.getAllByRole('button', { name: /Kayla · #0/ })).toHaveLength(1);
  });

  it('sorts numbers numerically, keeps 0 and 00 distinct, and puts missing numbers last', () => {
    renderList();
    fireEvent.change(screen.getByLabelText('Sort players'), { target: { value: 'number' } });
    expect(cards().map(card => card.querySelector('strong')!.textContent)).toEqual(['Kayla · #0', 'Owen · #00', 'Jules A · #7', 'Jules B · #7', 'Zoe · #10', 'Alex']);
    fireEvent.change(screen.getByLabelText('Sort players'), { target: { value: 'name' } });
    expect(cards()[0].textContent).toContain('Alex');
    fireEvent.change(screen.getByLabelText('Sort players'), { target: { value: 'team' } });
    expect(cards()[0].textContent).toContain('Jules A');
  });

  it('shows unassigned Kaizen players and a simple default list without custom teams', () => {
    const result = renderList();
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'none' } });
    expect(cards()).toHaveLength(1);
    expect(cards()[0].textContent).toContain('Alex');
    result.rerender(<AttendancePlayers {...result.props} teams={[]} />);
    expect(screen.queryByLabelText('Show team')).toBeNull();
    expect(screen.getByText('Kaizen · All players')).toBeTruthy();
    expect(cards()).toHaveLength(6);
  });

  it('uses current memberships for filtering without rewriting saved session players', () => {
    const snapshot = structuredClone(players);
    const current = players.map(p => p.id === 'shared' ? { ...p, team_ids: ['red'] } : p);
    renderList({ players: snapshot, currentPlayers: current, present: { shared: true } });
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'blue' } });
    expect(screen.queryByRole('button', { name: /Kayla/ })).toBeNull();
    expect(screen.getByText('1 marked player is hidden in this view and still counted.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'red' } });
    expect(screen.getByRole('button', { name: /Kayla/ }).getAttribute('aria-pressed')).toBe('true');
    expect(snapshot.find(p => p.id === 'shared')!.team_ids).toEqual(['blue', 'red']);
  });

  it('recovers a retired team filter and disables marking during a save', () => {
    const result = renderList({ busy: true });
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'blue' } });
    expect(cards().every(card => (card as HTMLButtonElement).disabled)).toBe(true);
    result.rerender(<AttendancePlayers {...result.props} teams={teams.map(t => t.id === 'blue' ? { ...t, retired_at: '2026-09-26' } : t)} />);
    expect((screen.getByLabelText('Show team') as HTMLSelectElement).value).toBe('all');
    expect(cards()).toHaveLength(6);
  });

  it('preserves hidden marks, saved expectations and finish through real offline writes', async () => {
    const ownerId = crypto.randomUUID();
    const initial = await changeOwner(ownerId, owner => { owner.prepared = structuredClone(prepared); return owner; });
    const started = await startSession(ownerId, initial, 'Practice', ['blue'], false, '2026-09-25');
    const expectedIds = [...started.sessions[0].expectedIds];
    function Harness() {
      const [data, setData] = useState<OwnerData>(started);
      const [other, setOther] = useState(false);
      const session = data.sessions[0];
      const candidates = players.filter(p => other !== session.expectedIds.includes(p.id));
      return <>
        <button onClick={() => setOther(!other)}>{other ? 'Expected players' : 'Other players'}</button>
        <AttendancePlayers players={candidates} currentPlayers={players} teams={teams} present={session.present} busy={false}
          onMark={(id, present) => { void readOwner(ownerId).then(current => markPresent(ownerId, current, id, present)).then(setData); }} />
      </>;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Kayla/ }));
    await waitFor(() => expect(screen.getByText('1 present overall')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'red' } });
    expect(screen.getByRole('button', { name: /Kayla/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Other players' }));
    expect(screen.getByText('1 marked player is hidden in this view and still counted.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Owen/ }));
    await waitFor(() => expect(screen.getByText('2 present overall')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Show team'), { target: { value: 'blue' } });
    expect(screen.queryByRole('button', { name: /Owen/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expected players' }));
    expect(screen.getByRole('button', { name: /Kayla/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('2 present overall')).toBeTruthy();
    const saved = await readOwner(ownerId);
    expect(saved.queue.map(op => op.kind)).toEqual(['start_v1', 'set_present_v1', 'set_present_v1']);
    expect(saved.sessions[0].expectedIds).toEqual(expectedIds);
    expect(saved.sessions[0].selectedTeamIds).toEqual(['blue']);
    const finished = await finishSession(ownerId, saved);
    expect(finished.sessions[0].present).toEqual({ shared: true, 'red-only': true });
    expect(finished.sessions[0].creditHours).toBe(1.5);
    expect(finished.sessions[0].expectedIds).toEqual(expectedIds);
    expect(finished.queue[finished.queue.length - 1].kind).toBe('finish_v1');
    expect((await readOwner(ownerId)).sessions[0].state).toBe('completed');
  });
});
