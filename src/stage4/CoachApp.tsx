import { useCallback, useEffect, useRef, useState } from 'react';
import { client } from './api';
import { changeOwner, readOwner, enqueue, setTestWriteFailure } from './db';
import { activeSession, displayPlayer, expectedPlayers, SHELL_VERSION, type OwnerData, type Player, type Session } from './types';
import { correctAttendance, finishSession, markPresent, prepare, retireOrRestore, savePlayer, saveTeam, sessionDelivery, startSession, sync, today } from './workflow';
import { derivePin } from './pin';
import { dropNextAcknowledgment, expireNextAuthCheck, setSimulatedOffline, shellCacheReady, shellFingerprint } from './shell';
import './coach.css';

type Page = 'home' | 'attendance' | 'roster' | 'history' | 'settings';
const TEST_COACH_EMAIL = {
  a: 'kaizen.stage4.test.a.20260924@gmail.com',
  b: 'kaizen.stage4.test.b.20260924@gmail.com',
} as const;
function message(error: unknown): string { return error instanceof Error ? error.message : String((error as {message?: string})?.message ?? error); }
function deliveryText(state: ReturnType<typeof sessionDelivery>) { return ({ waiting: 'Saved on this device · waiting to sync', synced: 'Synced', conflict: 'Conflict · review needed', failed: 'Upload failed · review needed' })[state]; }

export default function CoachApp() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [testCoach, setTestCoach] = useState<keyof typeof TEST_COACH_EMAIL>('a'); const [password, setPassword] = useState('');
  const [data, setData] = useState<OwnerData | null>(null);
  const [page, setPage] = useState<Page>('home'); const [view, setView] = useState<'expected' | 'other'>('expected');
  const [expectedOpen, setExpectedOpen] = useState(false); const [teamIds, setTeamIds] = useState<string[]>([]); const [allKaizen, setAllKaizen] = useState(false);
  const [date, setDate] = useState(today()); const [dateOpen, setDateOpen] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [authPaused, setAuthPaused] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null); const [firstName, setFirstName] = useState(''); const [number, setNumber] = useState(''); const [label, setLabel] = useState(''); const [guest, setGuest] = useState(false); const [playerTeams, setPlayerTeams] = useState<string[]>([]);
  const [teamName, setTeamName] = useState(''); const [pin, setPin] = useState('');
  const [restoreLabels, setRestoreLabels] = useState<Record<string, string>>({});
  const [correctionSession, setCorrectionSession] = useState<string | null>(null); const [reason, setReason] = useState('');
  const [writeFailure, setWriteFailure] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const [verifiedShell, setVerifiedShell] = useState<string | null>(null);
  const syncInFlight = useRef(false);

  useEffect(() => {
    let live = true;
    client.auth.getSession().then(({ data: auth }) => { if (live && auth.session?.user.id) setOwnerId(auth.session.user.id); });
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => { if (live) { setOwnerId(session?.user.id ?? null); if (!session) { setData(null); setPage('home'); } } });
    return () => { live = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (!ownerId) return; let live = true; readOwner(ownerId).then(value => { if (live) setData(value); }).catch(error => { if (live) setStatus(`Local data blocked: ${message(error)}`); }); return () => { live = false; }; }, [ownerId]);
  useEffect(() => {
    let live = true;
    setVerifiedShell(null);
    if (data?.prepared?.shellVersion === SHELL_VERSION && data.prepared.shellAssets === shellFingerprint()) {
      shellCacheReady().then(ready => { if (live && ready) setVerifiedShell(data.prepared!.shellAssets); }).catch(() => {});
    }
    return () => { live = false; };
  }, [ownerId, data?.prepared?.shellVersion, data?.prepared?.shellAssets]);

  const runSync = useCallback(async () => {
    if (!ownerId || syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const current = await readOwner(ownerId);
      if (!current.queue.length) return;
      const result = await sync(ownerId, current);
      if (result.data !== current) setData(await readOwner(ownerId));
      setAuthPaused(result.state === 'auth');
      if (result.state === 'conflict' || result.state === 'failed' || result.state === 'auth') setStatus(result.error ?? result.state);
      else if (result.state === 'synced') setStatus('All saved changes are synced.');
    } catch (error) { setStatus(`Sync paused: ${message(error)}`); }
    finally { syncInFlight.current = false; }
  }, [ownerId]);
  useEffect(() => { if (!data || !ownerId || !navigator.onLine || data.testOffline || authPaused || data.queue[0]?.status !== 'pending') return; const timer = setTimeout(() => void runSync(), 400); const retry = setInterval(() => void runSync(), 5000); return () => { clearTimeout(timer); clearInterval(retry); }; }, [data, ownerId, authPaused, runSync]);
  useEffect(() => { const online = () => void runSync(); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, [runSync]);

  async function act(action: (current: OwnerData) => Promise<OwnerData>, success = 'Saved on this device · waiting to sync'): Promise<boolean> {
    if (!ownerId || !data || busy) return false;
    setBusy(true); setStatus('Saving on this device…');
    try { const next = await action(await readOwner(ownerId)); setData(next); setStatus(success); return true; }
    catch (error) { setStatus(`Save or sync failed: ${message(error)}. Check the status of the queued change before retrying.`); if (ownerId) readOwner(ownerId).then(setData).catch(() => {}); return false; }
    finally { setBusy(false); }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('Signing in…');
    try {
      const result = await client.auth.signInWithPassword({ email: TEST_COACH_EMAIL[testCoach], password });
      if (result.error) setStatus(result.error.message); else { setOwnerId(result.data.user.id); setAuthPaused(false); setStatus('Signed in. Prepare this iPad while online, or resume saved work.'); }
    } catch (error) { setStatus(`Sign-in failed: ${message(error)}`); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (data?.queue.length && !logoutWarning) { setLogoutWarning(true); return; }
    if (ownerId) await changeOwner(ownerId, current => { current.prepared = null; return current; });
    await client.auth.signOut(); setOwnerId(null); setData(null); setLogoutWarning(false); setStatus('Signed out. Pending work remains on this device for the same coach.');
  }
  async function prepareDevice() {
    if (!ownerId || !data || busy) return; setBusy(true); setStatus('Saving app shell and roster…');
    try { const next = await prepare(ownerId, await readOwner(ownerId)); setData(next); setVerifiedShell(next.prepared!.shellAssets); setStatus('Ready for offline attendance on this device.'); }
    catch (error) { setStatus(`Not ready: ${message(error)}`); }
    finally { setBusy(false); }
  }
  function clearPlayerForm() { setEditingPlayer(null); setFirstName(''); setNumber(''); setLabel(''); setGuest(false); setPlayerTeams([]); }
  function editPlayer(player: Player) { setEditingPlayer(player.id); setFirstName(player.first_name); setNumber(player.jersey_number ?? ''); setLabel(player.short_label); setGuest(player.is_guest); setPlayerTeams(player.team_ids); }

  if (!ownerId) return <main className="coach-app auth"><div className="coach-panel"><h1>Kaizen Tracker</h1><p>Coach attendance · isolated test environment</p><form onSubmit={signIn}><label>Test coach<select value={testCoach} onChange={e => { setTestCoach(e.target.value as keyof typeof TEST_COACH_EMAIL); setPassword(''); setStatus(''); }}><option value="a">Coach A</option><option value="b">Coach B</option></select></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button disabled={busy}>Sign in</button></form><button className="quiet" onClick={async () => { try { await setSimulatedOffline(false); setStatus('Test network restored for sign-in.'); } catch (error) { setStatus(message(error)); } }}>Restore test network</button><p role="status">{status}</p></div></main>;
  if (!data) return <main className="coach-app"><p role="status">{status || 'Opening saved device data…'}</p><button onClick={() => void logout()}>Sign out</button></main>;

  const session = activeSession(data); const prepared = data.prepared; const pending = data.queue.length;
  const ready = !!prepared && prepared.version === 1 && prepared.shellVersion === SHELL_VERSION && prepared.shellAssets === shellFingerprint() && verifiedShell === prepared.shellAssets;
  const activePlayers = prepared?.players.filter(p => !p.retired_at) ?? [];
  const attendanceIds = session?.kind === 'Practice' ? session.expectedIds : activePlayers.map(p => p.id);
  const shown = session ? (session.kind === 'Practice' && view === 'other' ? activePlayers.filter(p => !attendanceIds.includes(p.id)) : session.roster.filter(p => attendanceIds.includes(p.id) && !p.retired_at)) : [];
  const corrected = data.sessions.find(s => s.id === correctionSession && s.state === 'completed');

  return <div className="coach-app"><header><div><strong>Kaizen Tracker</strong><small>Coach attendance · test project</small></div><span className={`readiness ${ready ? 'ready' : ''}`}>{ready ? 'Ready offline' : 'Prepare online'}</span></header>
    <nav aria-label="Coach pages">{(['home','attendance','roster','history','settings'] as Page[]).map(name => <button key={name} className={page === name ? 'selected' : ''} onClick={() => setPage(name)}>{name === 'home' ? 'Home' : name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
    <main><p className="sync-line" role="status">{authPaused ? 'Sync paused · sign in again as this coach' : !navigator.onLine || data.testOffline ? 'Offline · changes stay on this device' : pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : 'All saved changes synced'}{status && <> · {status}</>}</p>
    {authPaused && <button onClick={() => void client.auth.signOut({ scope: 'local' })}>Sign in again as this coach</button>}
    {data.queue.some(op => op.status !== 'pending') && <section className="coach-panel warning"><h2>Review required</h2>{data.queue.filter(op => op.status !== 'pending').map(op => <p key={op.id}>{op.kind} · {op.error}. Your intended change remains stored on this device.</p>)}</section>}
    {page === 'home' && <><h1>Ready for practice?</h1><div className="coach-actions"><button disabled={!ready || !!session || busy} onClick={() => { setExpectedOpen(true); setPage('home'); }}>Start Practice</button><button disabled={!ready || !!session || busy} onClick={async () => { if (await act(c => startSession(ownerId, c, 'Optional Training', [], false, dateInput.current?.value || date))) setPage('attendance'); }}>Start Optional Training</button></div>
      {!session && <><button className="quiet" onClick={() => setDateOpen(!dateOpen)}>{date === today() ? 'Change date for paper attendance' : `Paper attendance date: ${date}`}</button>{dateOpen && <label>Attendance date<input ref={dateInput} type="date" value={date} max={today()} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} /></label>}</>}
      {session && <section className="coach-panel"><h2>{session.kind} in progress</h2><p>{session.date} · {Object.values(session.present).filter(Boolean).length} present · {deliveryText(sessionDelivery(data, session.id))}</p><button onClick={() => setPage('attendance')}>Resume attendance</button></section>}
      {expectedOpen && <section className="coach-panel"><h2>Who’s expected?</h2><label className="choice"><input type="checkbox" checked={allKaizen} onChange={e => { setAllKaizen(e.target.checked); if (e.target.checked) setTeamIds([]); }} /> All Kaizen</label><div className="team-choices">{prepared?.teams.filter(t => !t.retired_at).map(team => <label className="choice" key={team.id}><input type="checkbox" disabled={allKaizen} checked={teamIds.includes(team.id)} onChange={e => setTeamIds(e.target.checked ? [...teamIds, team.id] : teamIds.filter(id => id !== team.id))} />{team.name}</label>)}</div><p>{expectedPlayers(data, teamIds, allKaizen).length} unique expected players</p><button disabled={!allKaizen && !teamIds.length} onClick={async () => { if (await act(c => startSession(ownerId, c, 'Practice', teamIds, allKaizen, dateInput.current?.value || date))) { setExpectedOpen(false); setView('expected'); setPage('attendance'); } }}>Take attendance</button><button className="quiet" onClick={() => setExpectedOpen(false)}>Cancel</button></section>}
      {!ready && <section className="coach-panel"><h2>Prepare this iPad</h2><p>Connect to the internet and save the app, roster, teams, round, settings and PIN verifier. Only then is offline attendance ready.</p><button disabled={!navigator.onLine || !!data.testOffline || busy || !!pending} onClick={() => void prepareDevice()}>Prepare while online</button></section>}
      {!!pending && <button className="quiet" disabled={!navigator.onLine || busy} onClick={() => void runSync()}>Retry synchronization</button>}
    </>}
    {page === 'attendance' && <>{session ? <><h1>{session.kind}</h1><p>{session.date} · {session.creditHours} hours per attendee · {deliveryText(sessionDelivery(data, session.id))}</p><p>The attendance date was saved when this session started.</p>
      {session.kind === 'Practice' && <div className="tabs"><button className={view === 'expected' ? 'selected' : ''} onClick={() => setView('expected')}>Expected players</button><button className={view === 'other' ? 'selected' : ''} onClick={() => setView('other')}>Other players</button></div>}
      <div className="player-grid">{shown.map(player => <button key={player.id} disabled={busy} className={`player-card ${session.present[player.id] ? 'present' : ''}`} aria-pressed={!!session.present[player.id]} onClick={() => void act(c => markPresent(ownerId, c, player.id, !session.present[player.id]))}><strong>{displayPlayer(player)}</strong><span>{session.present[player.id] ? 'Present · tap to undo' : 'Tap to mark present'}</span></button>)}</div>{shown.length === 0 && <p>No players in this view.</p>}
      <p>{Object.values(session.present).filter(Boolean).length} present overall</p><button disabled={busy} onClick={async () => { if (await act(c => finishSession(ownerId, c))) { setDate(today()); setPage('home'); } }}>Finish session on this device</button></> : <section className="coach-panel"><h2>No active session</h2><button onClick={() => setPage('home')}>Start a session</button></section>}</>}
    {page === 'roster' && <><h1>Roster and teams</h1><section className="coach-panel"><h2>Teams</h2>{prepared?.teams.filter(t => !t.retired_at).map(t => <div className="row" key={t.id}><span>{t.name}</span><button className="quiet" onClick={() => { const name = prompt('Team name', t.name); if (name) void act(c => saveTeam(ownerId, c, name, t.id)); }}>Rename</button></div>)}<form onSubmit={async e => { e.preventDefault(); if (await act(c => saveTeam(ownerId, c, teamName))) setTeamName(''); }}><input placeholder="New team name" value={teamName} onChange={e => setTeamName(e.target.value)} /><button disabled={!teamName.trim()}>Add team</button></form></section>
      <section className="coach-panel"><h2>{editingPlayer ? 'Edit player' : 'Add player'}</h2><form onSubmit={async e => { e.preventDefault(); if (await act(c => savePlayer(ownerId, c, { first_name: firstName, jersey_number: number || null, short_label: label, is_guest: guest, team_ids: playerTeams }, editingPlayer ?? undefined))) clearPlayerForm(); }}><label>First name<input value={firstName} onChange={e => setFirstName(e.target.value)} required /></label><label>Jersey number<input inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} /></label><label>Distinguishing label<input value={label} onChange={e => setLabel(e.target.value)} /></label><label className="choice"><input type="checkbox" checked={guest} onChange={e => setGuest(e.target.checked)} /> Guest</label><div className="team-choices">{prepared?.teams.filter(t => !t.retired_at).map(team => <label className="choice" key={team.id}><input type="checkbox" checked={playerTeams.includes(team.id)} onChange={e => setPlayerTeams(e.target.checked ? [...playerTeams, team.id] : playerTeams.filter(id => id !== team.id))} />{team.name}</label>)}</div><button>{editingPlayer ? 'Save player' : 'Add player'}</button>{editingPlayer && <button type="button" className="quiet" onClick={clearPlayerForm}>Cancel</button>}</form></section>
      <section className="coach-panel"><h2>Active players</h2>{activePlayers.map(p => <div className="row" key={p.id}><span>{displayPlayer(p)} <small>{p.team_ids.map(id => prepared?.teams.find(t => t.id === id)?.name).filter(Boolean).join(' + ') || 'Kaizen'}</small></span><button className="quiet" onClick={() => editPlayer(p)}>Edit</button><button className="quiet" onClick={() => void act(c => retireOrRestore(ownerId, c, p.id, false))}>Retire</button></div>)}</section>
      <section className="coach-panel"><h2>Retired players</h2>{prepared?.players.filter(p => p.retired_at).map(p => <div className="row" key={p.id}><span>{displayPlayer(p)}</span><label>Restored card label<input value={restoreLabels[p.id] ?? p.short_label} onChange={e => setRestoreLabels({ ...restoreLabels, [p.id]: e.target.value })} /></label><button className="quiet" onClick={() => void act(c => retireOrRestore(ownerId, c, p.id, true, restoreLabels[p.id] ?? p.short_label))}>Restore</button></div>)}</section></>}
    {page === 'history' && <><h1>Completed sessions</h1>{data.sessions.filter(s => s.state === 'completed').slice(0, 10).map(s => <section className="coach-panel" key={s.id}><h2>{s.kind} · {s.date}</h2><p>{Object.values(s.present).filter(Boolean).length} present · {s.creditHours} hours each · {s.kind === 'Optional Training' ? `${s.roundId === prepared?.roundId ? 'Current' : 'Earlier'} raffle round` : 'No training tickets'} · {deliveryText(sessionDelivery(data, s.id))}</p>{s.needsRoundReview && <p className="warning">Round changed while this session was offline. Its original tickets stay in the original round.</p>}<button className="quiet" onClick={() => setCorrectionSession(s.id)}>Correct attendance</button></section>)}
      {corrected && <section className="coach-panel"><h2>Correct {corrected.kind} · {corrected.date}</h2><p>Only attendance can change. The date, expected list, hours and raffle round stay as recorded.</p><label>Reason<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label><div className="player-grid">{corrected.roster.map(p => <button key={p.id} disabled={busy} className={`player-card ${corrected.present[p.id] ? 'present' : ''}`} onClick={() => void act(c => correctAttendance(ownerId, c, corrected.id, p.id, !corrected.present[p.id], reason))}>{displayPlayer(p)} · {corrected.present[p.id] ? 'Present' : 'Absent'}</button>)}</div>{prepared?.players.some(p => !corrected.roster.some(r => r.id === p.id)) && <details><summary>Other roster players</summary><div className="player-grid">{prepared.players.filter(p => !corrected.roster.some(r => r.id === p.id)).map(p => <button key={p.id} className="player-card" disabled={busy} onClick={() => void act(c => correctAttendance(ownerId, c, corrected.id, p.id, true, reason))}>{displayPlayer(p)} · Add as present</button>)}</div></details>}<button className="quiet" onClick={() => setCorrectionSession(null)}>Close</button></section>}</>}
    {page === 'settings' && <><h1>Settings</h1><section className="coach-panel"><h2>Offline readiness</h2><p>{ready ? `Prepared ${new Date(prepared!.savedAt).toLocaleString()}` : 'This device needs preparation or the app changed since preparation. Pending attendance remains stored.'}</p><button disabled={!navigator.onLine || !!pending || busy || !!data.testOffline} onClick={() => void prepareDevice()}>Refresh prepared data</button><p>Do not clear browser site data or lose this iPad while attendance is waiting to sync.</p></section><section className="coach-panel"><h2>Coach exit PIN</h2><p>{prepared?.exitCode.mode === 'custom' ? 'Custom four-digit PIN active' : 'Default code 0000 active'}. Kiosk use begins in Stage 5.</p><label>New four-digit PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} /></label><button disabled={!navigator.onLine || !!data.testOffline || busy || !!pending || !/^\d{4}$/.test(pin)} onClick={async () => { try { const verifier = await derivePin(pin); if (await act(async c => { const next = await enqueue(ownerId, 'set_exit_pin_v1', null, c.prepared!.exitCode.revision, { verifier }, () => {}); const result = await sync(ownerId, next); if (result.state !== 'synced') throw new Error(result.error ?? 'PIN change awaits sync'); const updated = await changeOwner(ownerId, d => { d.prepared!.exitCode = { mode: 'custom', revision: c.prepared!.exitCode.revision + 1, verifier }; return d; }); return updated; }, 'PIN changed and synced.')) setPin(''); } catch (error) { setStatus(message(error)); } }}>Set PIN</button><button className="quiet" disabled={!navigator.onLine || !!data.testOffline || busy || !!pending} onClick={() => void act(async c => { const next = await enqueue(ownerId, 'reset_exit_pin_v1', null, c.prepared!.exitCode.revision, {}, () => {}); const result = await sync(ownerId, next); if (result.state !== 'synced') throw new Error(result.error ?? 'PIN reset awaits sync'); return changeOwner(ownerId, d => { d.prepared!.exitCode = { mode: 'default', revision: c.prepared!.exitCode.revision + 1, verifier: null }; return d; }); }, 'PIN reset and synced.')}>Reset to 0000</button></section><details className="coach-panel"><summary>Browser test controls</summary><p>This isolated test control blocks Supabase requests from this browser. It is a simulation, not an iPad airplane-mode test.</p><button className="quiet" onClick={async () => { try { const nextOffline = !data.testOffline; await setSimulatedOffline(nextOffline); const next = await changeOwner(ownerId, d => { d.testOffline = nextOffline; return d; }); setData(next); setStatus(nextOffline ? 'Test network disconnected.' : 'Test network restored.'); if (!nextOffline) void runSync(); } catch (error) { setStatus(message(error)); } }}>{data.testOffline ? 'Restore test network' : 'Simulate gym offline'}</button><button className="quiet" onClick={async () => { try { await dropNextAcknowledgment(); setStatus('The next test operation response will be lost after the server processes it.'); } catch (error) { setStatus(message(error)); } }}>Drop next operation acknowledgment</button><button className="quiet" onClick={async () => { try { await expireNextAuthCheck(); setStatus("The next test sign-in check will return an expired-session error."); } catch (error) { setStatus(message(error)); } }}>Expire next sign-in check</button><button className="quiet" onClick={() => { setWriteFailure(!writeFailure); setTestWriteFailure(!writeFailure); setStatus(!writeFailure ? 'Test local writes now fail.' : 'Test local writes restored.'); }}>{writeFailure ? 'Restore local writes' : 'Simulate local storage failure'}</button></details><button className="quiet" onClick={() => void logout()}>Sign out</button></>}
    {logoutWarning && <section className="coach-panel warning"><h2>Pending work stays on this iPad</h2><p>{pending} saved change{pending === 1 ? '' : 's'} will be hidden until this same coach signs in again. Keep this iPad and its browser data.</p><button onClick={() => void logout()}>Sign out and keep pending work</button><button className="quiet" onClick={() => setLogoutWarning(false)}>Stay signed in</button></section>}
    </main></div>;
}
