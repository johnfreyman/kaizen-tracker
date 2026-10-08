// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReportExport from './ReportExport';
import { createReport, type ReportOptions } from './reports';
import { emptyOwner, type Session } from './types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('report export archive scope', () => {
  it('follows later report-filter changes and still allows an export-specific override', () => {
    const data = emptyOwner('coach');
    data.sessions = [{ id: 'archived', date: '2026-09-25', kind: 'Practice', creditHours: 1.5, roundId: 'round', expectedIds: [], selectedTeamIds: [], allKaizen: true, roster: [], present: {}, state: 'completed', revision: 0, archivedAt: '2026-09-26T00:00:00Z' } satisfies Session];
    const options: ReportOptions = { range: 'all', teamId: null, teamMode: 'current', includeArchived: false, today: '2026-09-26' };
    const report = createReport(data, options);
    const next = createReport(data, { ...options, includeArchived: true });
    const write = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn() }, focus: vi.fn(), print: vi.fn() } as unknown as Window);
    const view = render(<ReportExport data={data} report={report} />);
    const archive = screen.getByRole('checkbox', { name: 'Include archived sessions in this export', hidden: true }) as HTMLInputElement;
    expect(archive.checked).toBe(false);
    view.rerender(<ReportExport data={data} report={next} />);
    expect(archive.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Open print report', hidden: true }));
    expect(write.mock.calls[0][0]).toContain('Including archived sessions');
    expect(write.mock.calls[0][0]).toContain('1 completed sessions');
    fireEvent.click(archive);
    fireEvent.click(screen.getByRole('button', { name: 'Open print report', hidden: true }));
    expect(write.mock.calls[1][0]).toContain('Excluding archived sessions');
    expect(write.mock.calls[1][0]).toContain('0 completed sessions');
  });
});
