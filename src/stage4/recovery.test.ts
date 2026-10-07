import { describe, expect, it } from 'vitest';
import { affectedCount, blockedReason, describeChange } from './recovery';
import type { Operation, OwnerData } from './types';

const kayla = { id: 'p1', first_name: 'Kayla', jersey_number: '0', short_label: '', is_guest: false, retired_at: null, revision: 0, team_ids: [] };
const session = { id: 's1', kind: 'Practice' as const, date: '2026-10-01', creditHours: 1.5, roundId: 'r', expectedIds: ['p1'], selectedTeamIds: [], allKaizen: true, roster: [kayla], present: {}, state: 'completed' as const, revision: 2 };
const op = (over: Partial<Operation>): Operation => ({ id: crypto.randomUUID(), deviceId: 'd', sequence: 1, kind: 'set_present_v1', sessionId: 's1', baseRevision: 1, payload: { player_id: 'p1', present: true }, status: 'conflict', errorCode: '40001', error: '40001: serialization', ...over });
const data = (queue: Operation[]): OwnerData => ({ version: 1, ownerId: 'o', deviceId: 'd', nextSequence: 3, prepared: null, sessions: [session], queue, lastSyncAt: null });

describe('blocked change descriptions', () => {
  it('names the session, player and requested change without raw payloads or codes', () => {
    const blocked = op({});
    const text = describeChange(blocked, data([blocked]));
    expect(text).toEqual({ action: 'Attendance mark', detail: 'Practice · 2026-10-01 · Kayla · #0 · mark present' });
    expect(blockedReason(blocked)).toMatch(/another device/);
    expect(`${text.action} ${text.detail}`).not.toMatch(/40001|player_id|\{/);
  });
  it('describes corrections and counts the changes that depend on it', () => {
    const blocked = op({ kind: 'correct_v1', payload: { changes: [{ player_id: 'p1', present: false }], reason: '' } });
    const later = op({ status: 'pending', kind: 'finish_v1', payload: {} });
    const unrelated = op({ status: 'pending', sessionId: 's2', payload: { player_id: 'p9', present: true } });
    expect(describeChange(blocked, data([blocked])).detail).toContain('mark absent');
    expect(affectedCount(blocked, data([blocked, later, unrelated]))).toBe(2);
  });
});
