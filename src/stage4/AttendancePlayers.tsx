import { useState } from 'react';
import { displayPlayer, type Player, type Team } from './types';

type Props = {
  players: Player[];
  currentPlayers: Player[];
  teams: Team[];
  present: Record<string, boolean>;
  busy: boolean;
  onMark: (playerId: string, present: boolean) => void;
};
type Sort = 'team' | 'number' | 'name';

export default function AttendancePlayers({ players, currentPlayers, teams, present, busy, onMark }: Props) {
  const [teamFilter, setTeamFilter] = useState('all');
  const [sort, setSort] = useState<Sort>('team');
  const activeTeams = teams.filter(team => !team.retired_at).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const teamNames = new Map(activeTeams.map(team => [team.id, team.name]));
  const currentById = new Map(currentPlayers.map(player => [player.id, player]));
  const memberships = (player: Player) => (currentById.get(player.id) ?? player).team_ids.filter(id => teamNames.has(id));
  const teamLabel = (player: Player) => memberships(player).map(id => teamNames.get(id)!).sort((a, b) => a.localeCompare(b)).join(' + ') || 'Kaizen';
  // A renamed/retired team cannot leave an invisible, stale filter selected.
  const filter = teamFilter === 'none' || teamNames.has(teamFilter) ? teamFilter : 'all';
  const uniquePlayers = [...new Map(players.map(player => [player.id, player])).values()];
  const visible = uniquePlayers.filter(player => filter === 'all' || (filter === 'none' ? memberships(player).length === 0 : memberships(player).includes(filter)));
  visible.sort((a, b) => {
    if (sort === 'team') {
      const result = teamLabel(a).localeCompare(teamLabel(b));
      if (result) return result;
    }
    if (sort === 'number') {
      if (a.jersey_number === null && b.jersey_number !== null) return 1;
      if (b.jersey_number === null && a.jersey_number !== null) return -1;
      const result = (a.jersey_number ?? '').localeCompare(b.jersey_number ?? '', undefined, { numeric: true })
        || (a.jersey_number ?? '').localeCompare(b.jersey_number ?? '');
      if (result) return result;
    }
    return displayPlayer(a).localeCompare(displayPlayer(b)) || a.id.localeCompare(b.id);
  });
  const visibleIds = new Set(visible.map(player => player.id));
  const presentIds = Object.keys(present).filter(id => present[id]);
  const hiddenPresent = presentIds.filter(id => !visibleIds.has(id)).length;

  return <section aria-label="Attendance list">
    <div className="attendance-controls">
      {activeTeams.length > 0 ? <label>Show team
        <select value={filter} onChange={event => setTeamFilter(event.target.value)}>
          <option value="all">All teams</option>
          {activeTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          <option value="none">Kaizen (no sub-team)</option>
        </select>
      </label> : <p>Kaizen · All players</p>}
      <label>Sort players
        <select value={sort} onChange={event => setSort(event.target.value as Sort)}>
          <option value="team">By team</option>
          <option value="number">By jersey number</option>
          <option value="name">By name</option>
        </select>
      </label>
    </div>
    <p>Team filters only change this list. Check-ins and practice expectations stay saved.</p>
    <div role="status" aria-live="polite" className="attendance-counts">
      <strong>{presentIds.length} present overall</strong>
      <span>{visible.length} player{visible.length === 1 ? '' : 's'} shown</span>
      {hiddenPresent > 0 && <p>{hiddenPresent} marked player{hiddenPresent === 1 ? ' is' : 's are'} hidden in this view and still counted.</p>}
    </div>
    <div className="player-grid" role="group" aria-label="Attendance players">
      {visible.map(player => <button key={player.id} disabled={busy} className={`player-card ${present[player.id] ? 'present' : ''}`} aria-pressed={!!present[player.id]} onClick={() => onMark(player.id, !present[player.id])}>
        <strong>{displayPlayer(player)}</strong>
        {activeTeams.length > 0 && <span>{teamLabel(player)}</span>}
        <span>{present[player.id] ? 'Present · tap to undo' : 'Tap to mark present'}</span>
      </button>)}
    </div>
    {visible.length === 0 && <p>No players in this view. Choose another team or player tab.</p>}
  </section>;
}
