// Safari may still be waiting for download confirmation long after the click.
// Keep each blob URL valid for this document's lifetime; the browser releases
// it when the document unloads. A timeout cannot prove a download has finished.
export function downloadCsvFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name; link.hidden = true;
  document.body.appendChild(link);
  try { link.click(); }
  catch (error) { URL.revokeObjectURL(url); throw error; }
  finally { link.remove(); }
}

export function canShareCsv(): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try { return navigator.canShare({ files: [new File([''], 'report.csv', { type: 'text/csv' })] }); }
  catch { return false; }
}

export async function shareCsvFile(file: File): Promise<'shared' | 'cancelled'> {
  if (!navigator.canShare?.({ files: [file] })) throw new Error('File sharing is unavailable.');
  try { await navigator.share({ files: [file] }); return 'shared'; }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
