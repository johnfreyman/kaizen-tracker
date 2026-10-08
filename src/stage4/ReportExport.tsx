import { useEffect, useState } from 'react';
import { createReport, defaultPrintOptions, reportPrintHtml, type PrintOptions, type PrintSection, type Report } from './reports';
import type { OwnerData } from './types';

const sectionLabels: Array<[PrintSection, string]> = [['cover', 'Overview'], ['players', 'Player table'], ['attendance', 'Attendance comparison'], ['sessions', 'Session log'], ['notes', 'Coach notes page']];
export default function ReportExport({ data, report }: { data: OwnerData; report: Report }) {
  const [settings, setSettings] = useState<PrintOptions>(defaultPrintOptions);
  const [includeArchived, setIncludeArchived] = useState(report.options.includeArchived);
  const [custom, setCustom] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setIncludeArchived(report.options.includeArchived); }, [report.options.includeArchived]);
  function print() {
    if (custom && (!start || !end || start > end)) { setError('Choose a start and end date in order.'); return; }
    const selected = createReport(data, { ...report.options, includeArchived, ...(custom ? { range: 'custom' as const, start, end } : {}) });
    const page = window.open('', '_blank');
    if (!page) { setError('Allow this report tab in your browser, then try again.'); return; }
    setError(''); page.document.write(reportPrintHtml(selected, settings)); page.document.close(); page.focus(); page.print();
  }
  return <details className="coach-panel report-export"><summary>Print / Save PDF</summary><p>Use the current report’s team, membership, archive and date filters, or choose dates below. Save as PDF using your browser’s print or share controls. On iPad, use Share → Save to Files; the available controls depend on your iPadOS version.</p>
    <label>Report title<input value={settings.title} maxLength={120} onChange={event => setSettings({ ...settings, title: event.target.value })} /></label>
    <fieldset><legend>Sections</legend>{sectionLabels.map(([key, label]) => <label className="choice" key={key}><input type="checkbox" checked={settings.sections.includes(key)} onChange={event => setSettings({ ...settings, sections: event.target.checked ? [...settings.sections, key] : settings.sections.filter(item => item !== key) })} />{label}</label>)}</fieldset>
    <div className="report-export-layout"><label>Paper<select value={settings.paper} onChange={event => setSettings({ ...settings, paper: event.target.value as PrintOptions['paper'] })}><option value="letter">Letter</option><option value="a4">A4</option><option value="legal">Legal</option></select></label><label>Layout<select value={settings.orientation} onChange={event => setSettings({ ...settings, orientation: event.target.value as PrintOptions['orientation'] })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>
    <label className="choice"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />Include archived sessions in this export</label>
    <label className="choice"><input type="checkbox" checked={custom} onChange={event => setCustom(event.target.checked)} />Use custom dates for this export</label>{custom && <div className="report-export-layout"><label>From<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label>Through<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label></div>}
    {error && <p role="alert">{error}</p>}<button disabled={!settings.sections.length} onClick={print}>Open print report</button>
  </details>;
}
