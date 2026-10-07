import { describe, expect, it } from 'vitest';
import { createReport, reportCsv, reportPrintHtml, type ReportOptions } from './reports';
import { emptyOwner, type Player, type Session } from './types';

const player = (id: string, name: string, teams: string[], guest = false): Player => ({ id, first_name: name, jersey_number: '7', short_label: id, is_guest: guest, retired_at: null, revision: 0, team_ids: teams });
const sam = player('sam', 'Sam', ['blue', 'red']);
const otherSam = player('other', 'Sam', ['red']);
const guest = player('guest', 'Guest', ['blue'], true);
const session = (id: string, date: string, kind: Session['kind'], expectedIds: string[], presentIds: string[], roster: Player[], creditHours = 1.5): Session => ({ id, date, kind, creditHours, roundId: 'round', expectedIds, selectedTeamIds: ['blue'], allKaizen: false, roster, present: Object.fromEntries(presentIds.map(playerId => [playerId, true])), state: 'completed', revision: 2 });
const options: ReportOptions = { range: 'all', teamId: null, teamMode: 'session', includeArchived: true, today: '2026-09-25' };

describe('Stage 6 shared report calculations', () => {
  it('uses saved practice expectations, stable player IDs, and one credit across two memberships', () => {
    const data = emptyOwner('coach');
    data.prepared = { version: 1, shellVersion: 'test', shellAssets: '', savedAt: '', players: [sam, otherSam, guest], teams: [], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } };
    data.sessions = [
      session('c', '2026-09-22', 'Practice', ['sam'], [], [sam, otherSam]),
      session('b', '2026-09-21', 'Practice', ['other'], ['other'], [sam, otherSam]),
      session('a', '2026-09-20', 'Practice', ['sam'], ['sam'], [sam, otherSam]),
      session('t', '2026-09-23', 'Optional Training', [], ['sam', 'guest'], [sam, guest], 2),
    ];
    const report = createReport(data, options);
    const samRow = report.players.find(row => row.id === 'sam')!;
    expect(samRow.expected).toBe(2);
    expect(samRow.attended).toBe(1);
    expect(samRow.rate).toBe(0.5);
    expect(samRow.bestStreak).toBe(1);
    expect(samRow.practiceHours).toBe(1.5);
    expect(samRow.trainingHours).toBe(2);
    expect(report.playerHours).toBe(7);
    expect(report.sessionHours).toBe(6.5);
    expect(report.guestAppearances).toBe(1);
    expect(report.players.filter(row => row.label.startsWith('Sam'))).toHaveLength(2);
    expect(reportCsv(report)).toContain('sam,Sam sam · #7,1.5,2,3.5,2,1,50');
  });

  it('keeps historical team credit after a transfer and excludes archives in current scope', () => {
    const data = emptyOwner('coach');
    data.prepared = { version: 1, shellVersion: 'test', shellAssets: '', savedAt: '', players: [{ ...sam, team_ids: ['red'] }], teams: [], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } };
    data.sessions = [session('old', '2026-09-20', 'Practice', ['sam'], ['sam'], [sam]), session('new', '2026-09-24', 'Practice', ['sam'], ['sam'], [{ ...sam, team_ids: ['red'] }])];
    data.sessions[0].archivedAt = '2026-09-21T00:00:00Z';
    const historical = createReport(data, { ...options, teamId: 'blue' });
    expect(historical.sessions.map(row => row.id)).toEqual(['old']);
    expect(historical.players.find(row => row.id === 'sam')?.creditedHours).toBe(1.5);
    const current = createReport(data, { ...options, teamId: 'blue', teamMode: 'current' });
    expect(current.sessions).toHaveLength(0);
    expect(createReport(data, { ...options, includeArchived: false }).sessions.map(row => row.id)).toEqual(['new']);
  });
  it('keeps custom dates, team counts and print exports aligned while escaping player text', () => {
    const data = emptyOwner('coach');
    const named = { ...sam, first_name: '<script>bad()</script>' };
    data.sessions = [session('outside', '2026-09-19', 'Practice', ['sam'], ['sam'], [named]), session('selected', '2026-09-20', 'Practice', ['sam', 'other'], ['sam', 'other'], [named, otherSam], 2)];
    data.queue = [{ id: 'q', deviceId: data.deviceId, sequence: 1, kind: 'finish_v1', sessionId: 'selected', baseRevision: 0, payload: {}, status: 'pending' }];
    const report = createReport(data, { ...options, range: 'custom', start: '2026-09-20', end: '2026-09-21', teamId: 'blue' });
    expect(report.players.map(player => player.id)).toEqual(['sam']);
    expect(report.playerHours).toBe(2);
    expect(report.sessionPlayerIds.selected).toEqual(['sam']);
    expect(reportCsv(report)).toContain('selected,2026-09-20,Practice,2,1,Saved on device');
    const printed = reportPrintHtml(report, { sections: ['players', 'sessions'], paper: 'a4', orientation: 'landscape', title: 'Team report' });
    expect(printed).toContain('&lt;script&gt;');
    expect(printed).not.toContain('<script>');
    expect(printed).toContain('100% (1/1)');
    expect(printed).toContain('size:a4 landscape');
    expect(printed).not.toContain('<h2>Overview</h2>');
    expect(printed).toContain('Saved on device');
  });

  it('uses saved regular-player eligibility after a later guest-role change', () => {
    const data = emptyOwner('coach');
    data.prepared = { version: 1, shellVersion: 'test', shellAssets: '', savedAt: '', players: [{ ...sam, is_guest: true }], teams: [], roundId: 'round', roundRevision: 0, raffleEnabled: true, exitCode: { mode: 'default', revision: 0, verifier: null } };
    data.sessions = [session('before-role-change', '2026-09-20', 'Practice', ['sam'], ['sam'], [sam])];
    const report = createReport(data, options);
    expect(report.averagePracticeRate).toBe(1);
    expect(report.topAttendee?.id).toBe('sam');
    expect(report.players[0].rate).toBe(1);
  });

});
