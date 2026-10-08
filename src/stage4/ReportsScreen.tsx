import { useMemo, useState } from 'react';
import { createReport, reportCsv, type PlayerReport, type ReportRange, type TeamMode } from './reports';
import ReportExport from './ReportExport';
import { canShareCsv, downloadCsvFile, shareCsvFile } from './csvExport';
import type { OwnerData } from './types';

type Sort = 'name' | 'rate' | 'practice' | 'training' | 'hours' | 'streak';
const percentage = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`;

export default function ReportsScreen({ data, exportOnly = false }: { data: OwnerData; exportOnly?: boolean }) {
  const [range, setRange] = useState<ReportRange>(30);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamMode, setTeamMode] = useState<TeamMode>('current');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sort, setSort] = useState<Sort>('hours');
  const [ascending, setAscending] = useState(false);
  const [notice, setNotice] = useState('');
  const [sharingCsv, setSharingCsv] = useState(false);
  const report = useMemo(() => createReport(data, { range, teamId, teamMode, includeArchived }), [data, range, teamId, teamMode, includeArchived]);
  const sorted = useMemo(() => [...report.players].sort((a, b) => {
    const value = (player: PlayerReport) => sort === 'name' ? player.label : sort === 'rate' ? player.rate ?? -1 : sort === 'practice' ? player.practiceHours : sort === 'training' ? player.trainingHours : sort === 'streak' ? player.currentStreak : player.creditedHours;
    const left = value(a), right = value(b);
    const difference = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right);
    return (ascending ? difference : -difference) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  }), [report.players, sort, ascending]);
  function changeSort(next: Sort) { if (sort === next) setAscending(!ascending); else { setSort(next); setAscending(next === 'name'); } }
  function csvFile() {
    return new File([reportCsv(report)], `kaizen-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`, { type: 'text/csv' });
  }
  function downloadCsv() {
    try { downloadCsvFile(csvFile()); setNotice('CSV download requested. Open Safari downloads or Files to check the saved file.'); }
    catch { setNotice('Could not start the CSV download. Try Save CSV to Files if available.'); }
  }
  async function shareCsv() {
    setSharingCsv(true); setNotice('');
    try {
      const result = await shareCsvFile(csvFile());
      setNotice(result === 'cancelled' ? 'CSV save cancelled. You can try again.' : 'CSV handed to the selected app. Open Files to check the saved file.');
    } catch { setNotice('Could not open the CSV share sheet. Try Download CSV.'); }
    finally { setSharingCsv(false); }
  }
  async function copyRoster(sessionId: string) {
    const session = report.sessions.find(item => item.id === sessionId);
    if (!session) return;
    try { await navigator.clipboard.writeText(session.roster.filter(player => report.sessionPlayerIds[session.id].includes(player.id) && session.present[player.id]).map(player => player.first_name + (player.short_label ? ` ${player.short_label}` : '')).join('\n')); setNotice('Present roster copied.'); }
    catch { setNotice('Could not copy the roster in this browser.'); }
  }
  const expected = report.players.reduce((sum, player) => sum + player.expected, 0);
  const overallRate = expected ? report.players.reduce((sum, player) => sum + player.attended, 0) / expected : null;
  const belowAverage = report.weekdays.filter(day => day.attendanceRate !== null && overallRate !== null && day.attendanceRate < overallRate);
  const eligiblePlayers = report.players.filter(player => player.rate !== null);
  const leaders = report.leaderboard.filter(player => player.creditedHours > 0);
  if (exportOnly) return <div><h2>Report export</h2><p>Select report filters in Reports, then choose sections and print layout there. This Settings export defaults to all teams over the last 30 days.</p><ReportExport data={data} report={report} /></div>;
  return <div className="reports-screen"><h1>Reports</h1><p>Credited hours and attendance use saved player IDs and each practice’s expected list.</p>
    <section className="coach-panel report-filters"><h2>Report view</h2><label>Date range<select aria-label="Report date range" value={range} onChange={event => setRange(event.target.value === 'all' ? 'all' : Number(event.target.value) as ReportRange)}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={180}>Last 180 days</option><option value="all">All dates</option></select></label><label>Team<select aria-label="Report team" value={teamId ?? ''} onChange={event => setTeamId(event.target.value || null)}><option value="">All Kaizen</option>{data.prepared?.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>{teamId && <label>Team membership<select aria-label="Report team membership" value={teamMode} onChange={event => setTeamMode(event.target.value as TeamMode)}><option value="current">Current roster</option><option value="session">Team at session</option></select></label>}<label className="choice"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} /> Include archived sessions</label><p>Team views may overlap when a player belongs to two teams. All Kaizen counts each player and session once.</p></section>
    <p className="sync-line" role="status">{report.hasPending ? 'Includes saved changes waiting to sync on this device. Server history may be incomplete until refresh.' : `No attendance changes waiting to sync on this device${report.lastSyncAt ? ` · History last refreshed ${new Date(report.lastSyncAt).toLocaleString()}` : ' · Server history has not been refreshed'}.`}</p>
    <div className="report-actions"><button onClick={downloadCsv}>Download CSV</button>{canShareCsv() && <button disabled={sharingCsv} onClick={() => void shareCsv()}>Save CSV to Files</button>}</div>{notice && <p role="status">{notice}</p>}<ReportExport data={data} report={report} />
    <section className="report-tiles" aria-label="Report overview"><article className="coach-panel"><strong>{report.sessions.length}</strong><span>Completed sessions</span></article><article className="coach-panel"><strong>{report.practiceSessionHours}</strong><span>Practice session-hours</span></article><article className="coach-panel"><strong>{report.trainingSessionHours}</strong><span>Optional session-hours</span></article><article className="coach-panel"><strong>{report.playerHours}</strong><span>Player credited hours</span></article><article className="coach-panel"><strong>{percentage(report.averagePracticeRate)}</strong><span>Average regular-player practice attendance</span></article><article className="coach-panel"><strong>{report.guestAppearances}</strong><span>Guest appearances</span></article></section>
    <section className="coach-panel"><h2>Coach insights</h2><div className="report-insights"><p>Highest practice attendance: <strong>{report.topAttendee ? `${report.topAttendee.label} · ${percentage(report.topAttendee.rate)} of ${report.topAttendee.expected} expected` : 'No eligible practices yet'}</strong></p><p>Longest best streak: <strong>{report.longestStreak ? `${report.longestStreak.label} · ${report.longestStreak.bestStreak}` : 'No eligible practices yet'}</strong></p><p>Needs follow-up: <strong>{report.needsFollowUp ? `${report.needsFollowUp.label} · ${percentage(report.needsFollowUp.rate)} of ${report.needsFollowUp.expected} expected` : 'No missed expected practices'}</strong></p></div></section>
    <section className="coach-panel"><h2>Monthly trends</h2>{report.monthly.length < 2 ? <p>Trends appear after two months of sessions.</p> : <><MonthlyArea values={report.monthly} /><div className="report-month-details">{report.monthly.map(item => <p key={item.label}>{item.label} · {item.sessionHours} session-hours · {percentage(item.attendanceRate)} expected-practice attendance</p>)}</div></>}</section>
    <section className="coach-panel"><h2>Practice by weekday</h2><div className="report-weekdays">{report.weekdays.map(item => <div key={item.label}><strong>{item.label}</strong><span>{item.practiceSessions} sessions</span><span>{percentage(item.attendanceRate)}</span></div>)}</div>{belowAverage.length > 0 && <p>Below the overall expected-practice attendance ({percentage(overallRate)}): {belowAverage.map(day => `${day.label} (${percentage(day.attendanceRate)}, ${day.practiceSessions} sessions)`).join(', ')}.</p>}</section>
    <section className="coach-panel"><h2>Effort leaderboard</h2><p>Ranks combine practice and optional-training hours. Optional training can raise this ranking.</p><div className="report-podium">{leaders.slice(0, 3).map((player, index) => <article key={player.id}><strong>#{index + 1}</strong><span>{player.label}</span><b>{player.creditedHours} hours</b></article>)}</div><ol start={4}>{leaders.slice(3).map(player => <li key={player.id}>{player.label} · {player.creditedHours} credited hours</li>)}</ol>{leaders.length === 0 && <p>No credited attendance yet.</p>}</section>
    <section className="coach-panel"><h2>Player comparisons</h2><div className="report-comparison" aria-label="Practice attendance comparison">{eligiblePlayers.map(player => <div key={player.id}><span>{player.label}</span><div className="report-bar-track"><div style={{ width: `${(player.rate ?? 0) * 100}%` }} /></div><span>{percentage(player.rate)} ({player.attended}/{player.expected})</span></div>)}{eligiblePlayers.length === 0 && <p>No expected practices in this view.</p>}</div><div className="report-table-wrap"><table><thead><tr><th><button className="quiet" onClick={() => changeSort('name')}>Player</button></th><th><button className="quiet" onClick={() => changeSort('rate')}>Practice %</button></th><th><button className="quiet" onClick={() => changeSort('practice')}>Practice hours</button></th><th><button className="quiet" onClick={() => changeSort('training')}>Optional hours</button></th><th><button className="quiet" onClick={() => changeSort('hours')}>Credited hours</button></th><th><button className="quiet" onClick={() => changeSort('streak')}>Current streak</button></th></tr></thead><tbody>{sorted.map(player => <tr key={player.id}><td><details><summary>{player.label}{player.retired ? ' · retired' : ''}{player.guest ? ' · guest' : ''}<small>{player.teamLabels.join(', ') || 'No team membership recorded'}</small></summary>{player.history.length ? <><p>Only expected practices appear. Other teams’ practices do not affect this rate or streak.</p><div className="report-history">{player.history.map(item => <span className={item.present ? 'history-present' : 'history-absent'} key={item.sessionId} title={item.date}>{item.date}: {item.present ? 'Present' : 'Absent'}</span>)}</div></> : <p>No expected practices in this range.</p>}</details></td><td>{percentage(player.rate)}{player.expected > 0 ? ` (${player.attended}/${player.expected})` : ''}</td><td>{player.practiceHours}</td><td>{player.trainingHours}</td><td>{player.creditedHours}</td><td>{player.currentStreak} · best {player.bestStreak}</td></tr>)}</tbody></table></div></section>
    <section className="coach-panel"><h2>Recent sessions</h2>{[...report.sessions].reverse().slice(0, 10).map(session => <details key={session.id} className="report-session"><summary>{session.date} · {session.kind} · {session.creditHours} session-hours · {report.sessionPlayerIds[session.id].filter(id => session.present[id]).length} present</summary><p>{session.roster.filter(player => report.sessionPlayerIds[session.id].includes(player.id) && session.present[player.id]).map(player => player.first_name + (player.short_label ? ` ${player.short_label}` : '')).join(', ') || 'No one marked present'}</p><button className="quiet" onClick={() => void copyRoster(session.id)}>Copy present roster</button></details>)}{report.sessions.length === 0 && <p>No completed sessions in this view.</p>}</section>
  </div>;
}

function MonthlyArea({ values }: { values: ReturnType<typeof createReport>['monthly'] }) {
  const maxHours = Math.max(1, ...values.map(month => month.sessionHours));
  const point = (index: number, value: number) => `${50 + index * 600 / Math.max(1, values.length - 1)},${180 - value * 150}`;
  const hours = values.map((month, index) => point(index, month.sessionHours / maxHours)).join(' ');
  // Missing attendance is a gap, rather than an invented zero percent.
  const attendance: string[][] = [[]];
  values.forEach((month, index) => { if (month.attendanceRate === null) attendance.push([]); else attendance[attendance.length - 1].push(point(index, month.attendanceRate)); });
  return <figure className="report-trend"><figcaption>Monthly session-hours (blue) and expected-practice attendance (green). Values are listed below.</figcaption><svg role="img" aria-label="Monthly hours and attendance area chart" viewBox="0 0 710 230"><text x="0" y="22">{maxHours}h</text><text x="660" y="22">100%</text><line x1="50" x2="650" y1="180" y2="180" stroke="#a7b7c9" /><polygon points={`50,180 ${hours} 650,180`} fill="#1763bb" opacity="0.15" /><polyline points={hours} fill="none" stroke="#1763bb" strokeWidth="3" />{attendance.filter(segment => segment.length).map((segment, index) => <polyline key={index} points={segment.join(' ')} fill="none" stroke="#138352" strokeWidth="3" />)}{values.map((month, index) => <g key={month.label}><circle cx={50 + index * 600 / Math.max(1, values.length - 1)} cy={180 - month.sessionHours / maxHours * 150} r="4" fill="#1763bb" /><text x={50 + index * 600 / Math.max(1, values.length - 1)} y="211" textAnchor="middle" fontSize="12">{month.label}</text></g>)}<text x="20" y="184">0h</text><text x="660" y="184">0%</text></svg></figure>;
}
