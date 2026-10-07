import { displayPlayer, type OwnerData, type Player, type Session } from './types';

export type ReportRange = 7 | 30 | 90 | 180 | 'all' | 'custom';
export type TeamMode = 'current' | 'session';
export type ReportOptions = { range: ReportRange; teamId: string | null; teamMode: TeamMode; includeArchived: boolean; today?: string; start?: string; end?: string };
export type PlayerReport = {
  id: string; label: string; guest: boolean; retired: boolean;
  teamLabels: string[]; practiceHours: number; trainingHours: number; creditedHours: number;
  expected: number; attended: number; rate: number | null;
  currentStreak: number; bestStreak: number;
  history: { sessionId: string; date: string; present: boolean }[];
};
export type Trend = { label: string; sessionHours: number; attendanceRate: number | null; practiceSessions: number };
export type Report = {
  options: ReportOptions; sessions: Session[]; players: PlayerReport[];
  teamLabel: string; sessionPlayerIds: Record<string, string[]>;
  sessionStates: Record<string, 'synced' | 'waiting'>;
  sessionHours: number; playerHours: number; practiceSessionHours: number; trainingSessionHours: number;
  guestAppearances: number; averagePracticeRate: number | null;
  monthly: Trend[]; weekdays: Trend[];
  topAttendee?: PlayerReport; needsFollowUp?: PlayerReport; longestStreak?: PlayerReport;
  leaderboard: PlayerReport[]; hasPending: boolean; serverRefreshedAt: string | null;
};

function cutoff(days: number, today: string): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}
function weekday(date: string): number { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
function selectedPlayers(session: Session, data: OwnerData, teamId: string | null, mode: TeamMode): Set<string> {
  if (!teamId) return new Set(session.roster.map(player => player.id));
  if (mode === 'session') return new Set(session.roster.filter(player => player.team_ids.includes(teamId)).map(player => player.id));
  const currentIds = new Set((data.prepared?.players ?? []).filter(player => player.team_ids.includes(teamId)).map(player => player.id));
  return new Set(session.roster.filter(player => currentIds.has(player.id)).map(player => player.id));
}

export function createReport(data: OwnerData, options: ReportOptions): Report {
  const now = new Date();
  const today = options.today ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const earliest = options.range === 'custom' ? options.start ?? '' : options.range === 'all' ? '' : cutoff(options.range, today);
  const latest = options.range === 'custom' && options.end ? (options.end < today ? options.end : today) : today;
  const sessions = data.sessions.filter(session => session.state === 'completed' && session.date >= earliest && session.date <= latest && (options.includeArchived || !session.archivedAt) && (!options.teamId || selectedPlayers(session, data, options.teamId, options.teamMode).size > 0)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const identities = new Map<string, Player>();
  for (const player of data.prepared?.players ?? []) identities.set(player.id, player);
  for (const session of sessions) for (const player of session.roster) if (!identities.has(player.id)) identities.set(player.id, player);
  const rows = new Map<string, PlayerReport>();
  const historicalIds = new Set(sessions.flatMap(session => [...selectedPlayers(session, data, options.teamId, options.teamMode)]));
  for (const player of identities.values()) {
    if (options.teamId && options.teamMode === 'session' && !historicalIds.has(player.id)) continue;
    if (options.teamId && options.teamMode === 'current' && !player.team_ids.includes(options.teamId)) continue;
    rows.set(player.id, { id: player.id, label: displayPlayer(player), guest: player.is_guest, retired: !!player.retired_at, teamLabels: [], practiceHours: 0, trainingHours: 0, creditedHours: 0, expected: 0, attended: 0, rate: null, currentStreak: 0, bestStreak: 0, history: [] });
  }
  let sessionHours = 0, playerHours = 0, practiceSessionHours = 0, trainingSessionHours = 0, guestAppearances = 0;
  const month = new Map<string, { hours: number; expected: number; attended: number; practices: number }>();
  const days = Array.from({ length: 7 }, () => ({ hours: 0, expected: 0, attended: 0, practices: 0 }));
  for (const session of sessions) {
    sessionHours += session.creditHours;
    if (session.kind === 'Practice') practiceSessionHours += session.creditHours;
    else trainingSessionHours += session.creditHours;
    const key = session.date.slice(0, 7);
    const monthly = month.get(key) ?? { hours: 0, expected: 0, attended: 0, practices: 0 };
    monthly.hours += session.creditHours;
    const daily = days[weekday(session.date)];
    daily.hours += session.creditHours;
    if (session.kind === 'Practice') { monthly.practices++; daily.practices++; }
    const selected = selectedPlayers(session, data, options.teamId, options.teamMode);
    for (const player of session.roster) {
      if (!selected.has(player.id)) continue;
      let row = rows.get(player.id);
      if (!row) {
        row = { id: player.id, label: displayPlayer(player), guest: player.is_guest, retired: !!player.retired_at, teamLabels: [], practiceHours: 0, trainingHours: 0, creditedHours: 0, expected: 0, attended: 0, rate: null, currentStreak: 0, bestStreak: 0, history: [] };
        rows.set(player.id, row);
      }
      const present = !!session.present[player.id];
      if (present) {
        row.creditedHours += session.creditHours;
        if (session.kind === 'Practice') row.practiceHours += session.creditHours;
        else row.trainingHours += session.creditHours;
        playerHours += session.creditHours;
        if (player.is_guest) guestAppearances++;
      }
      if (session.kind !== 'Practice' || player.is_guest || !session.expectedIds.includes(player.id)) continue;
      row.expected++;
      if (present) { row.attended++; row.currentStreak++; row.bestStreak = Math.max(row.bestStreak, row.currentStreak); monthly.attended++; daily.attended++; }
      else row.currentStreak = 0;
      row.history.push({ sessionId: session.id, date: session.date, present });
      monthly.expected++; daily.expected++;
    }
    month.set(key, monthly);
  }
  const players = [...rows.values()].map(row => {
    const memberships = options.teamMode === 'current' ? identities.get(row.id)?.team_ids ?? [] : [...new Set(sessions.flatMap(session => session.roster.find(player => player.id === row.id)?.team_ids ?? []))];
    const teamLabels = memberships.map(id => data.prepared?.teams.find(team => team.id === id)?.name ?? 'Unknown saved team');
    return { ...row, teamLabels, rate: row.expected ? row.attended / row.expected : null };
  }).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const regular = players.filter(player => player.expected > 0);
  const avg = regular.length ? regular.reduce((sum, player) => sum + (player.rate ?? 0), 0) / regular.length : null;
  const topAttendee = [...regular].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.expected - a.expected || a.label.localeCompare(b.label))[0];
  const needsFollowUp = [...regular].filter(player => (player.rate ?? 0) < 1).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.expected - a.expected || a.label.localeCompare(b.label))[0];
  const longestStreak = [...regular].filter(player => player.bestStreak > 0).sort((a, b) => b.bestStreak - a.bestStreak || a.label.localeCompare(b.label))[0];
  const leaderboard = [...players].sort((a, b) => b.creditedHours - a.creditedHours || a.label.localeCompare(b.label)).slice(0, 10);
  const trend = (label: string, item: { hours: number; expected: number; attended: number; practices: number }): Trend => ({ label, sessionHours: item.hours, attendanceRate: item.expected ? item.attended / item.expected : null, practiceSessions: item.practices });
  const sessionStates: Report['sessionStates'] = Object.fromEntries(sessions.map(session => [session.id, data.queue.some(operation => operation.sessionId === session.id) ? 'waiting' : 'synced']));
  const sessionPlayerIds = Object.fromEntries(sessions.map(session => [session.id, [...selectedPlayers(session, data, options.teamId, options.teamMode)]]));
  const teamLabel = options.teamId ? data.prepared?.teams.find(team => team.id === options.teamId)?.name ?? 'Saved team' : 'All Kaizen';
  return { teamLabel, sessionPlayerIds, options, sessions, players, sessionStates, sessionHours, playerHours, practiceSessionHours, trainingSessionHours, guestAppearances, averagePracticeRate: avg, monthly: [...month.entries()].map(([key, item]) => trend(key, item)), weekdays: days.map((item, index) => trend(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index], item)), topAttendee, needsFollowUp, longestStreak, leaderboard, hasPending: data.queue.length > 0, serverRefreshedAt: data.lastServerRefreshAt ?? null };
}

function csvCell(value: string | number): string { const raw = String(value); const text = typeof value === 'string' && /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw; return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function reportCsv(report: Report): string {
  const rows: Array<Array<string | number>> = [
    ['Player ID', 'Player', 'Practice hours', 'Optional hours', 'Credited hours', 'Expected practices', 'Attended practices', 'Practice attendance %', 'Current streak', 'Best streak', 'Guest', 'Retired', 'Teams'],
    ...report.players.map(player => [player.id, player.label, player.practiceHours, player.trainingHours, player.creditedHours, player.expected, player.attended, player.rate === null ? '' : Math.round(player.rate * 100), player.currentStreak, player.bestStreak, player.guest ? 'Yes' : 'No', player.retired ? 'Yes' : 'No', player.teamLabels.join('; ')]),
    [], ['Session ID', 'Date', 'Type', 'Session hours', 'Present players', 'Sync state'],
    ...report.sessions.map(session => [session.id, session.date, session.kind, session.creditHours, report.sessionPlayerIds[session.id].filter(id => session.present[id]).length, report.sessionStates[session.id] === 'waiting' ? 'Saved on device' : 'Synced']),
    [], ['Report scope', report.teamLabel, report.options.teamMode === 'current' ? 'Current roster' : 'Team at session', reportRangeLabel(report.options), report.options.includeArchived ? 'Including archived sessions' : 'Excluding archived sessions'],
    ['History last downloaded from server', report.serverRefreshedAt ?? 'Not yet downloaded on this device'], ['Includes saved attendance waiting to sync', report.hasPending ? 'Yes' : 'No'],
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function html(value: string | number): string { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }
export type PrintSection = 'cover' | 'players' | 'attendance' | 'sessions' | 'notes';
export type PrintOptions = { sections: PrintSection[]; paper: 'letter' | 'a4' | 'legal'; orientation: 'portrait' | 'landscape'; title: string };
export const defaultPrintOptions: PrintOptions = { sections: ['cover', 'players', 'attendance', 'sessions'], paper: 'letter', orientation: 'portrait', title: 'Kaizen Tracker report' };
export function reportRangeLabel(options: ReportOptions): string { return options.range === 'all' ? 'All dates' : options.range === 'custom' ? `${options.start || 'Beginning'} to ${options.end || 'Today'}` : `Last ${options.range} days`; }
export function reportPrintHtml(report: Report, settings: PrintOptions = defaultPrintOptions): string {
  const rows = report.players.map(player => `<tr><td>${html(player.label)}${player.guest ? ' · guest' : ''}${player.retired ? ' · retired' : ''}</td><td>${player.practiceHours}</td><td>${player.trainingHours}</td><td>${player.creditedHours}</td><td>${player.rate === null ? '—' : `${Math.round(player.rate * 100)}% (${player.attended}/${player.expected})`}</td><td>${player.currentStreak}</td><td>${player.bestStreak}</td></tr>`).join('');
  const sessions = report.sessions.map(session => `<tr><td>${html(session.date)}</td><td>${html(session.kind)}</td><td>${session.creditHours}</td><td>${report.sessionPlayerIds[session.id].filter(id => session.present[id]).length}</td><td>${report.sessionStates[session.id] === 'waiting' ? 'Saved on device' : 'Synced'}</td></tr>`).join('');
  const regular = report.players.filter(player => player.rate !== null);
  const distribution = regular.map(player => `<div class="distribution"><span>${html(player.label)}</span><div class="track"><div style="width:${(player.rate ?? 0) * 100}%"></div></div><span>${Math.round((player.rate ?? 0) * 100)}% (${player.attended}/${player.expected})</span></div>`).join('');
  const parts: Record<PrintSection, string> = {
    cover: `<section><h2>Overview</h2><p>${report.sessions.length} completed sessions · ${report.practiceSessionHours} practice session-hours · ${report.trainingSessionHours} optional session-hours · ${report.playerHours} player credited hours</p><p>Average regular-player expected-practice attendance: ${report.averagePracticeRate === null ? '—' : `${Math.round(report.averagePracticeRate * 100)}%`}</p><p>${report.guestAppearances} guest appearances</p></section>`,
    players: `<section><h2>Players</h2><table><thead><tr><th>Player</th><th>Practice hours</th><th>Optional hours</th><th>Credited hours</th><th>Practice attendance</th><th>Current streak</th><th>Best streak</th></tr></thead><tbody>${rows}</tbody></table></section>`,
    attendance: `<section><h2>Practice attendance comparison</h2><p>Each player’s attended practices / saved regular-player expectations. Other practices do not count.</p>${distribution || '<p>No expected practices in this view.</p>'}</section>`,
    sessions: `<section><h2>Sessions</h2><p>Present counts use the selected team view; session-hours represent the whole session.</p><table><thead><tr><th>Date</th><th>Type</th><th>Session hours</th><th>Present</th><th>Sync state</th></tr></thead><tbody>${sessions}</tbody></table></section>`,
    notes: '<section><h2>Coach notes</h2><div class="notes"></div></section>',
  };
  const paper = ['letter', 'a4', 'legal'].includes(settings.paper) ? settings.paper : 'letter';
  const orientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${html(settings.title)}</title><style>@page{size:${paper} ${orientation};margin:15mm}body{font:14px system-ui,sans-serif;color:#172638;padding:24px}h1,h2{color:#173e6b}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border-bottom:1px solid #ccd7e3;padding:8px;text-align:left}thead{background:#e8eef8}.note{color:#705018}.distribution{display:grid;grid-template-columns:180px 1fr 110px;gap:12px;margin:12px 0}.track{height:14px;background:#e8eef8}.track div{background:#1763bb;height:100%}.notes{height:180mm;background:repeating-linear-gradient(white 0,white 27px,#ccd7e3 28px)}@media print{body{padding:0}section+section{break-before:page}thead{display:table-header-group}.distribution,tr{break-inside:avoid}}</style></head><body><h1>${html(settings.title)}</h1><p>${html(report.teamLabel)} · ${html(reportRangeLabel(report.options))} · ${report.options.teamId ? html(report.options.teamMode === 'current' ? 'Current roster' : 'Team at session') + ' · ' : ''}${report.options.includeArchived ? 'Including archived sessions' : 'Excluding archived sessions'}</p><p class="note">${report.hasPending ? 'Includes saved work waiting to sync on this device.' : 'No attendance changes waiting to sync on this device.'} ${report.serverRefreshedAt ? 'History last downloaded from server ' + html(new Date(report.serverRefreshedAt).toLocaleString()) + '.' : 'Server history has not been refreshed.'}</p>${settings.sections.map(section => parts[section] ?? '').join('')}</body></html>`;
}
