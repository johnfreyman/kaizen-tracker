// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareCsv, downloadCsvFile, shareCsvFile } from './csvExport';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('CSV saving on Safari', () => {
  it('keeps a download URL available while Safari waits for confirmation', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:csv');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    const file = new File(['Player,Hours\r\nKayla,1.5'], 'test.csv', { type: 'text/csv' });
    downloadCsvFile(file);
    vi.advanceTimersByTime(120_000);
    expect(create).toHaveBeenCalledWith(file);
    expect(filename).toBe('test.csv');
    expect(revoke).not.toHaveBeenCalled();
    expect(document.querySelector('a')).toBeNull();
  });

  it('hands the actual named CSV to native file sharing', async () => {
    const file = new File(['Kayla,1.5'], 'test.csv', { type: 'text/csv' });
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: vi.fn(() => true), share });
    expect(canShareCsv()).toBe(true);
    expect(await shareCsvFile(file)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  it('treats share-sheet cancellation as cancellation without starting a download', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) });
    expect(await shareCsvFile(new File(['test'], 'test.csv'))).toBe('cancelled');
  });

  it('keeps native file saving unavailable when CSV sharing is unsupported', async () => {
    const share = vi.fn();
    vi.stubGlobal('navigator', { canShare: () => false, share });
    expect(canShareCsv()).toBe(false);
    await expect(shareCsvFile(new File(['test'], 'test.csv'))).rejects.toThrow('File sharing is unavailable');
    expect(share).not.toHaveBeenCalled();
  });
});
