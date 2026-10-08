import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { client } from './api';
import { changeOwner, readOwner, setTestWriteFailure } from './db';
import { AUTH_STORAGE_KEY, INITIAL_AUTH_REDIRECT_ERROR, INITIAL_PASSWORD_SETUP, clearDeviceSignIn, completePasswordSetup, lastOwner, passwordSetupPending, rememberOwner, requestPasswordSetup } from './deviceAuth';
import { activeSession, displayPlayer, expectedPlayers, SHELL_VERSION, type OwnerData, type Player, type Session } from './types';
import { correctAttendance, discardBlocked, finishSession, markPresent, prepare, refreshKeepingQueue, resendBlocked, retireOrRestore, reviewBlocked, savePlayer, saveTeam, sessionDelivery, startSession, sync, today } from './workflow';
import { derivePin } from './pin';
import { affectedCount, blockedReason, describeChange } from './recovery';
import KioskScreen from './KioskScreen';
import ReportsScreen from './ReportsScreen';
import RaffleScreen from './RaffleScreen';
import AttendancePlayers from './AttendancePlayers';
import PasswordSetup from './PasswordSetup';
import SwitchCoach from './SwitchCoach';
import { Toaster } from 'sonner';
import { IS_RELEASE } from './runtime';
import { enterKiosk, exitKiosk, refreshKioskState } from './kiosk';
import { changePin, discardPendingPin } from './settings';
import { dropNextAcknowledgment, expireNextAuthCheck, failNextRpc, setSimulatedOffline, shellCacheReady, shellFingerprint } from './shell';
import './coach.css';

type Page = 'home' | 'attendance' | 'roster' | 'history' | 'reports' | 'raffle' | 'settings' | 'admin';
const PAGES: Page[] = ['home', 'attendance', 'roster', 'history', 'reports', 'raffle', 'settings', 'admin'];
// Audit A8: keep the page in the URL hash so reload and Back work.
function pageFromHash(): Page { const name = location.hash.replace(/^#\/?/, ''); return (PAGES as string[]).includes(name) ? name as Page : 'home'; }
const SuperAdminDashboard = lazy(() => import('../app/components/SuperAdminDashboard'));
const TEST_COACH_EMAIL = {
  a: 'kaizen.stage4.test.a.20260924@gmail.com',
  b: 'kaizen.stage4.test.b.20260924@gmail.com',
} as const;
function message(error: unknown): string { return error instanceof Error ? error.message : String((error as {message?: string})?.message ?? error); }
function deliveryText(state: ReturnType<typeof sessionDelivery>) { return ({ waiting: 'Saved on this device · waiting to sync', synced: 'Synced', conflict: 'Conflict · review needed', failed: 'Upload failed · review needed' })[state]; }

export default function CoachApp() {
  const [ownerId, setOwnerId] = useState<string | null>(() => lastOwner());
  const [testCoach, setTestCoach] = useState<keyof typeof TEST_COACH_EMAIL>('a'); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [data, setData] = useState<OwnerData | null>(null);
  const [page, setPageState] = useState<Page>(pageFromHash);
  const setPage = useCallback((next: Page) => { setPageState(next); const hash = next === 'home' ? '' : `#${next}`; if (location.hash !== hash) history.pushState(null, '', hash || location.pathname + location.search); }, []);
  useEffect(() => { const sync = () => setPageState(pageFromHash()); window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync); return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); }; }, []); const [view, setView] = useState<'expected' | 'other'>('expected');
  const [expectedOpen, setExpectedOpen] = useState(false); const [teamIds, setTeamIds] = useState<string[]>([]); const [allKaizen, setAllKaizen] = useState(false);
  const [date, setDate] = useState(today()); const [dateOpen, setDateOpen] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [authPaused, setAuthPaused] = useState(() => !!lastOwner());
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null); const [firstName, setFirstName] = useState(''); const [number, setNumber] = useState(''); const [label, setLabel] = useState(''); const [guest, setGuest] = useState(false); const [playerTeams, setPlayerTeams] = useState<string[]>([]);
  const [teamName, setTeamName] = useState(''); const [pin, setPin] = useState('');
  const [restoreLabels, setRestoreLabels] = useState<Record<string, string>>({});
  const [correctionSession, setCorrectionSession] = useState<string | null>(null); const [reason, setReason] = useState('');
  const [historyKind, setHistoryKind] = useState<'all' | Session['kind']>('all'); const [historyFrom, setHistoryFrom] = useState(''); const [historyTo, setHistoryTo] = useState(''); const [historyShown, setHistoryShown] = useState(20);
  const [writeFailure, setWriteFailure] = useState(false);
  const [dropFeedback, setDropFeedback] = useState('');
  const [dropWorking, setDropWorking] = useState(false);
  useEffect(() => { setDropFeedback(''); }, [page, ownerId]);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const [adminOwner, setAdminOwner] = useState<string | null>(null);
  const [passwordSetup, setPasswordSetup] = useState(false);
  const [coachEmail, setCoachEmail] = useState<string | undefined>();
  const [pendingCoach, setPendingCoach] = useState<{ id: string; email?: string; needsPassword: boolean } | null>(null);
  const [authLinkError, setAuthLinkError] = useState(INITIAL_AUTH_REDIRECT_ERROR);
  const redirectPasswordSetup = useRef(INITIAL_PASSWORD_SETUP);
  const [verifiedShell, setVerifiedShell] = useState<string | null>(null);
  const [shellChecked, setShellChecked] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState('');
  const autoPrepareKey = useRef<string | null>(null);
  const lastHistoryRefresh = useRef(0);
  const correctionScrolled = useRef<string | null>(null);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const syncInFlight = useRef(false);
  const explicitLogout = useRef(false);
  const receiveRaffleData = useCallback((next: OwnerData) => {
    setData(current => current?.ownerId === next.ownerId && lastOwner() === next.ownerId ? next : current);
  }, []);

  const acceptSignedInUser = useCallback((user: { id: string; email?: string }, recovery = false) => {
    const needsPassword = recovery || redirectPasswordSetup.current || passwordSetupPending(user.id);
    redirectPasswordSetup.current = false;
    if (needsPassword) requestPasswordSetup(user.id);
    if (lastOwner() && lastOwner() !== user.id) {
      setPendingCoach({ id: user.id, email: user.email, needsPassword });
      setAuthPaused(true); setStatus('');
      return;
    }
    rememberOwner(user.id); setOwnerId(user.id); setCoachEmail(user.email);
    setPendingCoach(null); setPasswordSetup(needsPassword); setAuthPaused(false);
  }, []);

  useEffect(() => {
    let live = true;
    let authEventVersion = 0;
    const initialVersion = authEventVersion;
    client.auth.getSession().then(({ data: auth, error }) => {
      if (!live || explicitLogout.current || authEventVersion !== initialVersion) return;
      if (error && redirectPasswordSetup.current) { setAuthLinkError(true); return; }
      if (auth.session?.user) acceptSignedInUser(auth.session.user);
      else if (lastOwner()) { setOwnerId(lastOwner()); setAuthPaused(true); }
    }).catch(() => { if (live && lastOwner() && !explicitLogout.current && authEventVersion === initialVersion) { setOwnerId(lastOwner()); setAuthPaused(true); } });
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (!live || explicitLogout.current) return;
      authEventVersion += 1;
      if (session?.user) acceptSignedInUser(session.user, event === 'PASSWORD_RECOVERY');
      else if (lastOwner()) { setPendingCoach(null); setOwnerId(lastOwner()); setAuthPaused(true); }
    });
    return () => { live = false; subscription.subscription.unsubscribe(); };
  }, [acceptSignedInUser]);
  useEffect(() => { if (!ownerId) return; let live = true; readOwner(ownerId).then(value => { if (live) setData(value); }).catch(error => { if (live) setStatus(`Local data blocked: ${message(error)}`); }); return () => { live = false; }; }, [ownerId]);
  useEffect(() => {
    let live = true;
    let request = 0;
    const checkAdmin = () => {
      const currentRequest = ++request;
      setAdminOwner(null);
      if (IS_RELEASE && ownerId && !authPaused && navigator.onLine && !data?.testOffline) {
        client.from('super_admins').select('user_id').eq('user_id', ownerId).maybeSingle()
          .then(({ data: membership, error }) => { if (live && currentRequest === request && navigator.onLine && !error && membership?.user_id === ownerId) setAdminOwner(ownerId); });
      }
    };
    checkAdmin();
    window.addEventListener('online', checkAdmin);
    window.addEventListener('offline', checkAdmin);
    return () => { live = false; window.removeEventListener('online', checkAdmin); window.removeEventListener('offline', checkAdmin); };
  }, [ownerId, authPaused, data?.testOffline]);
  useEffect(() => { if (page === 'admin' && adminOwner !== ownerId) setPage('home'); }, [page, adminOwner, ownerId]);
  useEffect(() => {
    let live = true;
    setVerifiedShell(null);
    setShellChecked(false);
    if (data?.prepared?.shellVersion === SHELL_VERSION && data.prepared.shellAssets === shellFingerprint()) {
      shellCacheReady().then(ready => { if (live && ready) setVerifiedShell(data.prepared!.shellAssets); }).catch(() => {}).finally(() => { if (live) setShellChecked(true); });
    } else setShellChecked(true);
    return () => { live = false; };
  }, [ownerId, data?.prepared?.shellVersion, data?.prepared?.shellAssets]);

  // Audit A3: download other devices' sessions, not only upload our own.
  // Take the shared guard before reading storage so refresh, upload and setup
  // cannot start concurrently. Preserve queued edits during the download.
  const refreshHistory = useCallback(async (force = false) => {
    if (!ownerId || authPaused || pendingCoach || passwordSetup || syncInFlight.current || !navigator.onLine) return false;
    if (!force && Date.now() - lastHistoryRefresh.current < 60_000) return false;
    syncInFlight.current = true; setRefreshingHistory(true);
    try {
      const current = await readOwner(ownerId);
      if (!current.prepared || current.testOffline || current.kioskSessionId || current.pendingRaffle || current.queue.some(op => op.status !== 'pending')) return false;
      const next = await refreshKeepingQueue(ownerId, { shell: false });
      setData(next); lastHistoryRefresh.current = Date.now();
      return true;
    } catch { return false; }
    finally { syncInFlight.current = false; setRefreshingHistory(false); }
  }, [ownerId, authPaused, pendingCoach, passwordSetup]);

  const runSync = useCallback(async () => {
    if (!ownerId || authPaused || pendingCoach || passwordSetup || syncInFlight.current) return;
    syncInFlight.current = true;
    let refreshAfterSync = false;
    try {
      const current = await readOwner(ownerId);
      if (!current.queue.length) refreshAfterSync = true;
      else {
        const result = await sync(ownerId, current);
        setData(await readOwner(ownerId));
        setAuthPaused(result.state === 'auth');
        if (result.state === 'conflict' || result.state === 'failed' || result.state === 'auth') setStatus(result.error ?? result.state);
        else if (result.state === 'synced') { setStatus(''); lastHistoryRefresh.current = 0; refreshAfterSync = true; }
      }
    } catch (error) { setStatus(`Sync paused: ${message(error)}`); }
    finally { syncInFlight.current = false; }
    // The upload guard must be released before asking for the server snapshot.
    if (refreshAfterSync) await refreshHistory();
  }, [ownerId, authPaused, pendingCoach, passwordSetup, refreshHistory]);
  const markInKiosk = useCallback(async (playerId: string, present: boolean) => {
    if (!ownerId) throw new Error('Sign in as the same coach.');
    const current = await readOwner(ownerId);
    if (!current.kioskSessionId || current.kioskClosedSessionId === current.kioskSessionId || activeSession(current)?.id !== current.kioskSessionId) throw new Error('This session is no longer open for check-in.');
    setData(await markPresent(ownerId, current, playerId, present));
  }, [ownerId]);
  const exitCurrentKiosk = useCallback(async (code: string) => {
    if (!ownerId) throw new Error('Sign in as the same coach.');
    const next = await exitKiosk(ownerId, await readOwner(ownerId), code);
    setData(next);
    setPage(activeSession(next) ? 'attendance' : 'home');
  }, [ownerId]);
  const refreshCurrentKiosk = useCallback(async () => {
    if (!ownerId) throw new Error('Sign in as the same coach.');
    setData(await refreshKioskState(ownerId, await readOwner(ownerId)));
  }, [ownerId]);
  useEffect(() => { if (!data || !ownerId || !navigator.onLine || data.testOffline || authPaused || data.queue[0]?.status !== 'pending') return; const timer = setTimeout(() => void runSync(), 400); const retry = setInterval(() => void runSync(), 5000); return () => { clearTimeout(timer); clearInterval(retry); }; }, [data, ownerId, authPaused, runSync]);
  useEffect(() => { const online = () => void runSync(); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, [runSync]);

  useEffect(() => {
    if (!ownerId || authPaused) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshHistory(); };
    refresh();
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [ownerId, authPaused, refreshHistory, !!data?.prepared]);

  // Audit A4/A5: set up the device automatically after sign-in, after an app
  // update, and when the connection returns. Pending work is never cleared;
  // refreshKeepingQueue keeps it and still saves the new app shell.
  const needsPrepare = !!data && shellChecked && !(data.prepared && data.prepared.version === 1 && data.prepared.shellVersion === SHELL_VERSION && data.prepared.shellAssets === shellFingerprint() && verifiedShell === data.prepared.shellAssets);
  const blockedQueue = !!data?.queue.some(op => op.status !== 'pending');
  useEffect(() => {
    if (!ownerId || !data || !needsPrepare || authPaused || busy || preparing || blockedQueue || pendingCoach || passwordSetup || syncInFlight.current || data.kioskSessionId || data.pendingRaffle || data.testOffline || !navigator.onLine) return;
    const key = `${ownerId}|${SHELL_VERSION}|${shellFingerprint()}|${data.prepared ? 'refresh' : 'first'}`;
    if (autoPrepareKey.current === key) return;
    autoPrepareKey.current = key;
    void prepareDevice(true);
  });
  useEffect(() => { const online = () => { autoPrepareKey.current = null; }; window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, []);

  async function act(action: (current: OwnerData) => Promise<OwnerData>, success = 'Saved on this device · waiting to sync'): Promise<boolean> {
    if (!ownerId || !data || busy) return false;
    setBusy(true); setStatus('Saving on this device…');
    try { const next = await action(await readOwner(ownerId)); setData(next); setStatus(success); return true; }
    catch (error) { setStatus(`Save or sync failed: ${message(error)}. Check the status of the queued change before retrying.`); if (ownerId) readOwner(ownerId).then(setData).catch(() => {}); return false; }
    finally { setBusy(false); }
  }

  async function authenticate(identity: string, secret: string): Promise<void> {
    const address = IS_RELEASE ? identity.trim() : TEST_COACH_EMAIL[identity as keyof typeof TEST_COACH_EMAIL];
    if (!address) throw new Error('Enter your coach email.');
    const result = await client.auth.signInWithPassword({ email: address, password: secret });
    if (result.error) throw result.error;
    explicitLogout.current = false;
    acceptSignedInUser(result.data.user);
    setStatus(lastOwner() === result.data.user.id ? 'Signed in.' : '');
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('Signing in…');
    try { await authenticate(IS_RELEASE ? email : testCoach, password); setPassword(''); }
    catch (error) { setStatus(`Sign-in failed: ${message(error)}`); }
    finally { setBusy(false); }
  }
  async function switchCoach(setPassword: boolean) {
    if (!pendingCoach || busy) return;
    if (syncInFlight.current) { setStatus('Wait for the current save to finish, then switch.'); return; }
    setBusy(true); setStatus('');
    try {
      const identity = await client.auth.getUser();
      if (identity.error || identity.data.user?.id !== pendingCoach.id) throw new Error('This sign-in has changed. Open your invitation again or sign in as the intended coach.');
      if (setPassword) requestPasswordSetup(pendingCoach.id);
      rememberOwner(pendingCoach.id);
      setOwnerId(pendingCoach.id); setCoachEmail(identity.data.user.email); setData(null); setAdminOwner(null);
      setPasswordSetup(passwordSetupPending(pendingCoach.id)); setAuthPaused(false); setPendingCoach(null);
      setPage('home'); setExpectedOpen(false); setTeamIds([]); setAllKaizen(false); setDate(today()); setDateOpen(false); setView('expected');
      clearPlayerForm(); setTeamName(''); setPin(''); setRestoreLabels({}); setCorrectionSession(null); setReason(''); setLogoutWarning(false);
      setHistoryKind('all'); setHistoryFrom(''); setHistoryTo(''); setHistoryShown(20);
      setPrepareError(''); autoPrepareKey.current = null; lastHistoryRefresh.current = 0; correctionScrolled.current = null;
      setVerifiedShell(null); setShellChecked(false);
    } catch (error) { setStatus(message(error)); }
    finally { setBusy(false); }
  }
  async function keepPreviousCoach() {
    if (busy) return;
    setBusy(true); setStatus(''); explicitLogout.current = true;
    try {
      const result = await client.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setPendingCoach(null); setPasswordSetup(false); setAuthPaused(true);
      setStatus('Previous coach’s work is still saved. Sign in as that coach to upload.');
    } catch (error) { explicitLogout.current = false; setStatus(message(error)); }
    finally { setBusy(false); }
  }
  async function logout() {
    if ((data?.queue.length || data?.pendingRaffle) && !logoutWarning) { setLogoutWarning(true); return; }
    try { if (ownerId) await changeOwner(ownerId, current => { current.prepared = null; delete current.pendingPin; delete current.kioskSessionId; delete current.kioskClosedSessionId; return current; }); }
    catch (error) { setStatus(`Sign-out could not clear local preparation: ${message(error)}`); return; }
    explicitLogout.current = true;
    let signOutStatus = 'Signed out. Pending work remains here for the same coach.';
    try { if (navigator.onLine && !data?.testOffline) { const result = await client.auth.signOut({ scope: 'local' }); if (result.error) throw result.error; } }
    catch (error) { signOutStatus = `Server sign-out could not finish: ${message(error)}. Signed out on this device.`; }
    clearDeviceSignIn(); setOwnerId(null); setData(null); setAuthPaused(false); setLogoutWarning(false);
    setPendingCoach(null); setPasswordSetup(false); setCoachEmail(undefined); redirectPasswordSetup.current = false;
    setStatus(signOutStatus);
  }
  async function prepareDevice(automatic = false) {
    if (!ownerId || !data || busy) return;
    if (syncInFlight.current) { if (!automatic) setStatus('Wait for the current upload, then refresh.'); return; }
    syncInFlight.current = true; setBusy(true); setPreparing(true); setPrepareError('');
    if (!automatic) setStatus('Saving the app and your team data on this device…');
    try {
      const current = await readOwner(ownerId);
      const next = current.queue.length ? await refreshKeepingQueue(ownerId) : await prepare(ownerId, current);
      setData(next); lastHistoryRefresh.current = Date.now();
      if (next.prepared!.shellVersion === SHELL_VERSION && next.prepared!.shellAssets === shellFingerprint()) setVerifiedShell(next.prepared!.shellAssets);
      setStatus(automatic ? '' : current.queue.length ? 'Team data refreshed. Your unsent changes are still saved on this device.' : 'Offline copy refreshed.');
    }
    catch (error) { setPrepareError(message(error)); if (!automatic) setStatus(`Not ready: ${message(error)}`); }
    finally { syncInFlight.current = false; setBusy(false); setPreparing(false); }
  }
  async function dropDrawReplyForTest() {
    setDropWorking(true); setDropFeedback('Setting up the lost-response test…');
    try {
      await dropNextAcknowledgment();
      setStatus('The next test operation response will be lost after the server processes it.');
      setDropFeedback('Confirmed: the next saved operation’s server reply will be dropped once. Open Raffle to run the test.');
    } catch (error) {
      const failure = `Test control could not be set: ${message(error)}`;
      setStatus(failure); setDropFeedback(failure);
    } finally { setDropWorking(false); }
  }
  async function expireStoredSessionForTest() {
    if (!ownerId) return;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) throw new Error('Sign in before testing token expiry.');
      await setSimulatedOffline(true);
      const stored = JSON.parse(raw) as { expires_at?: number; expires_in?: number };
      stored.expires_at = 1; stored.expires_in = 0;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored));
      setData(await changeOwner(ownerId, data => { data.testOffline = true; return data; }));
      setStatus('Stored test token expired and network blocked. Reload to check offline recovery.');
    } catch (error) { setStatus(message(error)); }
  }
  function clearPlayerForm() { setEditingPlayer(null); setFirstName(''); setNumber(''); setLabel(''); setGuest(false); setPlayerTeams([]); }
  function editPlayer(player: Player) { setEditingPlayer(player.id); setFirstName(player.first_name); setNumber(player.jersey_number ?? ''); setLabel(player.short_label); setGuest(player.is_guest); setPlayerTeams(player.team_ids); }

  if (authLinkError) return <main className="coach-app auth"><section className="coach-panel"><h1>Sign-in link could not be opened</h1><p>The link may have expired or already been used. Ask your administrator for a new invitation or password-reset link.</p><button onClick={() => { setAuthLinkError(false); setPage('home'); }}>Return to the app</button></section></main>;
  if (pendingCoach) return <SwitchCoach email={pendingCoach.email} needsPassword={pendingCoach.needsPassword} busy={busy} error={status} onContinue={setPassword => void switchCoach(setPassword)} onCancel={() => void keepPreviousCoach()} />;
  if (passwordSetup && ownerId && !authPaused) return <PasswordSetup ownerId={ownerId} email={coachEmail} onComplete={() => { completePasswordSetup(ownerId); setPasswordSetup(false); setStatus('Password saved.'); }} onCancel={() => { setPasswordSetup(false); setPage('settings'); void logout(); }} />;

  if (!ownerId) return <main className="coach-app auth"><div className="coach-panel"><h1>Kaizen Tracker</h1><p>{IS_RELEASE ? 'Coach attendance' : 'Coach attendance · isolated test environment'}</p><form onSubmit={signIn}>{IS_RELEASE ? <label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label> : <label>Test coach<select value={testCoach} onChange={e => { setTestCoach(e.target.value as keyof typeof TEST_COACH_EMAIL); setPassword(''); setStatus(''); }}><option value="a">Coach A</option><option value="b">Coach B</option></select></label>}<label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button disabled={busy}>Sign in</button></form>{!IS_RELEASE && <button className="quiet" onClick={async () => { try { await setSimulatedOffline(false); setStatus('Test network restored for sign-in.'); } catch (error) { setStatus(message(error)); } }}>Restore test network</button>}<p role="status">{status}</p></div></main>;
  if (!data || data.ownerId !== ownerId) return <main className="coach-app"><p role="status">{status || 'Opening saved device data…'}</p></main>;

  if (data.kioskSessionId) return <KioskScreen data={data} authPaused={authPaused} onMark={markInKiosk} onExit={exitCurrentKiosk} onRefresh={refreshCurrentKiosk} onSignIn={authenticate} />;

  if (page === 'admin' && adminOwner === ownerId && !authPaused) return <><Suspense fallback={<main className="coach-app"><p role="status">Opening admin dashboard…</p></main>}><SuperAdminDashboard onCoachAttendance={() => setPage('home')} onLogout={() => { setPage('settings'); void logout(); }} /></Suspense><Toaster richColors /></>;

  const session = activeSession(data); const prepared = data.prepared; const pending = data.queue.length;
  const ready = !!prepared && prepared.version === 1 && prepared.shellVersion === SHELL_VERSION && prepared.shellAssets === shellFingerprint() && verifiedShell === prepared.shellAssets;
  const activePlayers = prepared?.players.filter(p => !p.retired_at) ?? [];
  const attendanceIds = session?.kind === 'Practice' ? session.expectedIds : activePlayers.map(p => p.id);
  const shown = session ? (session.kind === 'Practice' && view === 'other' ? activePlayers.filter(p => !attendanceIds.includes(p.id)) : session.roster.filter(p => attendanceIds.includes(p.id) && !p.retired_at)) : [];
  const corrected = data.sessions.find(s => s.id === correctionSession && s.state === 'completed');
  const completedHistory = data.sessions.filter(s => s.state === 'completed' && (historyKind === 'all' || s.kind === historyKind) && (!historyFrom || s.date >= historyFrom) && (!historyTo || s.date <= historyTo)).sort((a, b) => b.date.localeCompare(a.date));

  return <div className="coach-app"><header><div><strong>Kaizen Tracker</strong><small>{IS_RELEASE ? 'Coach attendance' : 'Coach attendance · test project'}</small></div><span className={`readiness ${ready ? 'ready' : ''}`}>{ready ? 'Ready offline' : preparing ? 'Getting ready…' : 'Not ready offline'}</span></header>
    <nav aria-label="Coach pages">{(['home','attendance','roster','history','reports',...(prepared?.raffleEnabled ? ['raffle' as const] : []),'settings',...(adminOwner === ownerId ? ['admin' as const] : [])] as Page[]).map(name => <button key={name} className={page === name ? 'selected' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => setPage(name)}>{name === 'home' ? 'Home' : name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
    <main><p className="sync-line" role="status">{authPaused ? 'Sync paused · sign in again as this coach' : !navigator.onLine || data.testOffline ? (pending ? `Offline · ${pending} change${pending === 1 ? '' : 's'} saved on this device, waiting to sync` : 'Offline · no unsent changes') : pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to upload` : 'All changes uploaded'}{status && <> · {status}</>}</p>
    {data.pendingRaffle && <p className="warning">A saved raffle request needs confirmation. Use Retry saved raffle request in Raffle or Settings before changing attendance or the roster.</p>}
    {authPaused && <section className="coach-panel warning"><h2>Upload paused</h2><p>Offline attendance remains available. Sign in as this same coach when connected to upload.</p><form onSubmit={signIn}>{IS_RELEASE ? <label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label> : <label>Test coach<select value={testCoach} onChange={e => { setTestCoach(e.target.value as keyof typeof TEST_COACH_EMAIL); setPassword(''); }}><option value="a">Coach A</option><option value="b">Coach B</option></select></label>}<label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button disabled={busy || !navigator.onLine || !!data.testOffline}>Sign in and resume upload</button></form></section>}
    {data.queue.some(op => op.status !== 'pending') && <section className="coach-panel warning"><h2>A change needs your decision</h2>{data.queue.filter(op => op.status !== 'pending').map(op => { const change = describeChange(op, data); const affected = affectedCount(op, data); const canKeep = !!op.serverReview && ['40001', '55000'].includes(op.errorCode ?? ''); return <div key={op.id}><p><strong>{change.action}</strong> · {change.detail}</p><p>{blockedReason(op)} Your change is still saved on this device.</p><p>Saved version: {op.serverReview?.summary ?? 'Not loaded yet.'}</p>{!op.serverReview && <button disabled={busy || !navigator.onLine || !!data.testOffline} onClick={() => void act(() => reviewBlocked(ownerId, op.id), 'Saved version loaded.')}>Load saved version</button>}{op === data.queue[0] && <>{canKeep && <button disabled={busy} onClick={() => void act(() => resendBlocked(ownerId, op.id), 'Your change will be uploaded again.')}>Keep my change</button>}<button disabled={busy || !navigator.onLine || !!data.testOffline} onClick={() => { if (window.confirm(affected > 1 ? `Use the saved version and remove ${affected} changes from this device (this one and ${affected - 1} that depend on it)? This cannot be undone.` : 'Use the saved version and remove your change from this device? This cannot be undone.')) void act(() => discardBlocked(ownerId, op.id), 'Saved version kept. Your change was removed from this device.'); }}>Use saved version{affected > 1 ? ` (removes ${affected} changes)` : ''}</button></>}<details><summary>Technical details</summary><p>{op.kind} · {op.error}</p><p>{JSON.stringify(op.payload)}</p></details></div>; })}</section>}
    {page === 'home' && <><h1>Ready for practice?</h1><div className="coach-actions"><button disabled={!ready || !!session || busy || !!data.pendingRaffle} onClick={() => { setExpectedOpen(true); setPage('home'); }}>Start Practice</button><button disabled={!ready || !!session || busy || !!data.pendingRaffle} onClick={async () => { if (await act(c => startSession(ownerId, c, 'Optional Training', [], false, dateInput.current?.value || date))) setPage('attendance'); }}>Start Optional Training</button></div>
      {!session && <><button className="quiet" onClick={() => setDateOpen(!dateOpen)}>{date === today() ? 'Change date for paper attendance' : `Paper attendance date: ${date}`}</button>{dateOpen && <label>Attendance date<input ref={dateInput} type="date" value={date} max={today()} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} /></label>}</>}
      {session && <section className="coach-panel"><h2>{session.kind} in progress</h2><p>{session.date} · {Object.values(session.present).filter(Boolean).length} present · {deliveryText(sessionDelivery(data, session.id))}</p><button onClick={() => setPage('attendance')}>Resume attendance</button></section>}
      {expectedOpen && <section className="coach-panel"><h2>Who’s expected?</h2><label className="choice"><input type="checkbox" checked={allKaizen} onChange={e => { setAllKaizen(e.target.checked); if (e.target.checked) setTeamIds([]); }} /> All Kaizen</label><div className="team-choices">{prepared?.teams.filter(t => !t.retired_at).map(team => <label className="choice" key={team.id}><input type="checkbox" disabled={allKaizen} checked={teamIds.includes(team.id)} onChange={e => setTeamIds(e.target.checked ? [...teamIds, team.id] : teamIds.filter(id => id !== team.id))} />{team.name}</label>)}</div><p>{expectedPlayers(data, teamIds, allKaizen).length} unique expected players</p><button disabled={!allKaizen && !teamIds.length} onClick={async () => { if (await act(c => startSession(ownerId, c, 'Practice', teamIds, allKaizen, dateInput.current?.value || date))) { setExpectedOpen(false); setView('expected'); setPage('attendance'); } }}>Take attendance</button><button className="quiet" onClick={() => setExpectedOpen(false)}>Cancel</button></section>}
      {!ready && <section className="coach-panel" aria-live="polite">{preparing || (!prepareError && navigator.onLine && !data.testOffline && !authPaused && !data.queue.some(op => op.status !== 'pending')) ? <><h2>Getting this device ready…</h2><p>Saving your roster and the app on this device, so attendance also works without internet.</p></> : !navigator.onLine || data.testOffline ? <><h2>Connect to the internet once</h2><p>This device needs one online visit to save your roster. After that, attendance works offline.</p></> : <><h2>Setup did not finish</h2><p>{prepareError || (authPaused ? 'Sign in again to finish setup.' : 'Resolve the review item above, then try again.')}</p><button disabled={busy || authPaused} onClick={() => void prepareDevice()}>Try again</button></>}</section>}
      {!!pending && <button className="quiet" disabled={!navigator.onLine || busy} onClick={() => void runSync()}>Retry synchronization</button>}
    </>}
    {page === 'attendance' && <>{session ? <><h1>{session.kind}</h1><p>{session.date} · {session.creditHours} hours per attendee · {deliveryText(sessionDelivery(data, session.id))}</p><p>The attendance date was saved when this session started.</p>
      {session.kind === 'Practice' && <div className="tabs"><button className={view === 'expected' ? 'selected' : ''} onClick={() => setView('expected')}>Expected players</button><button className={view === 'other' ? 'selected' : ''} onClick={() => setView('other')}>Other players</button></div>}
      <AttendancePlayers key={session.id} players={shown} currentPlayers={activePlayers} teams={prepared?.teams ?? []} present={session.present} busy={busy} onMark={(playerId, present) => void act(c => markPresent(ownerId, c, playerId, present))} />
      <button disabled={busy || !!data.pendingPin || !!data.pendingRaffle} onClick={() => void act(c => enterKiosk(ownerId, c), 'Shared-device check-in ready.')}>Enter Kiosk Mode</button> <button disabled={busy} onClick={async () => { if (await act(c => finishSession(ownerId, c))) { setDate(today()); setPage('home'); } }}>Finish session on this device</button></> : <section className="coach-panel"><h2>No active session</h2><button onClick={() => setPage('home')}>Start a session</button></section>}</>}
    {page === 'roster' && !prepared && <><h1>Roster and teams</h1><section className="coach-panel" role="status"><p>{preparing ? 'Loading your roster…' : 'Your roster is not on this device yet. Connect to the internet to load it.'}</p></section></>}
    {page === 'roster' && prepared && <><h1>Roster and teams</h1><details className="coach-panel collapsible-panel"><summary><h2>Teams</h2><small>{prepared?.teams.filter(t => !t.retired_at).length ?? 0}</small></summary>{prepared?.teams.filter(t => !t.retired_at).map(t => <div className="row" key={t.id}><span>{t.name}</span><button className="quiet" onClick={() => { const name = prompt('Team name', t.name); if (name) void act(c => saveTeam(ownerId, c, name, t.id)); }}>Rename</button></div>)}<form onSubmit={async e => { e.preventDefault(); if (await act(c => saveTeam(ownerId, c, teamName))) setTeamName(''); }}><label>New team name<input value={teamName} onChange={e => setTeamName(e.target.value)} /></label><button disabled={!teamName.trim()}>Add team</button></form></details>
      <section className="coach-panel"><h2>{editingPlayer ? 'Edit player' : 'Add player'}</h2><form onSubmit={async e => { e.preventDefault(); if (await act(c => savePlayer(ownerId, c, { first_name: firstName, jersey_number: number || null, short_label: label, is_guest: guest, team_ids: playerTeams }, editingPlayer ?? undefined))) clearPlayerForm(); }}><label>First name<input value={firstName} onChange={e => setFirstName(e.target.value)} required /></label><label>Jersey number<input inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} /></label><label>Distinguishing label<input value={label} onChange={e => setLabel(e.target.value)} /></label><label className="choice"><input type="checkbox" checked={guest} onChange={e => setGuest(e.target.checked)} /> Guest</label><div className="team-choices">{prepared?.teams.filter(t => !t.retired_at).map(team => <label className="choice" key={team.id}><input type="checkbox" checked={playerTeams.includes(team.id)} onChange={e => setPlayerTeams(e.target.checked ? [...playerTeams, team.id] : playerTeams.filter(id => id !== team.id))} />{team.name}</label>)}</div><button>{editingPlayer ? 'Save player' : 'Add player'}</button>{editingPlayer && <button type="button" className="quiet" onClick={clearPlayerForm}>Cancel</button>}</form></section>
      <section className="coach-panel"><h2>Active players</h2>{activePlayers.map(p => <div className="row" key={p.id}><span>{displayPlayer(p)} <small>{p.team_ids.map(id => prepared?.teams.find(t => t.id === id)?.name).filter(Boolean).join(' + ') || 'Kaizen'}</small></span><button className="quiet" onClick={() => editPlayer(p)}>Edit</button><button className="quiet" onClick={() => void act(c => retireOrRestore(ownerId, c, p.id, false))}>Retire</button></div>)}</section>
      <details className="coach-panel collapsible-panel"><summary><h2>Retired players</h2><small>{prepared?.players.filter(p => p.retired_at).length ?? 0}</small></summary>{prepared?.players.filter(p => p.retired_at).map(p => <div className="row" key={p.id}><span>{displayPlayer(p)}</span><label>Restored card label<input value={restoreLabels[p.id] ?? p.short_label} onChange={e => setRestoreLabels({ ...restoreLabels, [p.id]: e.target.value })} /></label><button className="quiet" onClick={() => void act(c => retireOrRestore(ownerId, c, p.id, true, restoreLabels[p.id] ?? p.short_label))}>Restore</button></div>)}</details></>}
    {page === 'history' && <><h1>Completed sessions</h1><section className="coach-panel history-filters" aria-label="Find sessions"><label>Type<select value={historyKind} onChange={e => { setHistoryKind(e.target.value as typeof historyKind); setHistoryShown(20); }}><option value="all">All sessions</option><option value="Practice">Practice</option><option value="Optional Training">Optional Training</option></select></label><label>From<input type="date" value={historyFrom} max={historyTo || today()} onChange={e => { setHistoryFrom(e.target.value); setHistoryShown(20); }} /></label><label>To<input type="date" value={historyTo} min={historyFrom || undefined} max={today()} onChange={e => { setHistoryTo(e.target.value); setHistoryShown(20); }} /></label><p role="status">{completedHistory.length} session{completedHistory.length === 1 ? '' : 's'} found{completedHistory.length > historyShown ? ` · showing ${historyShown}` : ''}</p></section>{completedHistory.slice(0, historyShown).map(s => <section className="coach-panel" key={s.id}><h2>{s.kind} · {s.date}</h2><p>{Object.values(s.present).filter(Boolean).length} present · {s.creditHours} hours each · {s.kind === 'Optional Training' ? `${s.roundId === prepared?.roundId ? 'Current' : 'Earlier'} raffle round` : 'No training tickets'} · {deliveryText(sessionDelivery(data, s.id))}</p>{s.needsRoundReview && <p className="warning">Round changed while this session was offline. Its original tickets stay in the original round.</p>}<button className="quiet" onClick={() => setCorrectionSession(s.id)}>Correct attendance</button></section>)}{completedHistory.length > historyShown && <button className="quiet" onClick={() => setHistoryShown(historyShown + 20)}>Show 20 more</button>}
      {corrected && <section className="coach-panel" ref={node => { if (node && correctionScrolled.current !== corrected.id) { correctionScrolled.current = corrected.id; node.scrollIntoView?.({ block: 'start' }); } }}><h2>Correct {corrected.kind} · {corrected.date}</h2><p>Only attendance can change. The date, expected list, hours and raffle round stay as recorded.</p><label>Reason<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label><div className="player-grid">{corrected.roster.map(p => <button key={p.id} disabled={busy} className={`player-card ${corrected.present[p.id] ? 'present' : ''}`} onClick={() => void act(c => correctAttendance(ownerId, c, corrected.id, p.id, !corrected.present[p.id], reason))}>{displayPlayer(p)} · {corrected.present[p.id] ? 'Present' : 'Absent'}</button>)}</div>{prepared?.players.some(p => !corrected.roster.some(r => r.id === p.id)) && <details><summary>Other roster players</summary><div className="player-grid">{prepared.players.filter(p => !corrected.roster.some(r => r.id === p.id)).map(p => <button key={p.id} className="player-card" disabled={busy} onClick={() => void act(c => correctAttendance(ownerId, c, corrected.id, p.id, true, reason))}>{displayPlayer(p)} · Add as present</button>)}</div></details>}<button className="quiet" onClick={() => setCorrectionSession(null)}>Close</button></section>}</>}
    {page === 'reports' && (prepared ? <ReportsScreen data={data} onCorrect={id => { setCorrectionSession(id); setHistoryKind('all'); setHistoryFrom(''); setHistoryTo(''); setPage('history'); }} online={navigator.onLine && !data.testOffline && !authPaused} refreshing={refreshingHistory} onRefresh={async () => { if (!(await refreshHistory(true))) setStatus(data.queue.some(op => op.status !== 'pending') ? 'Resolve the review item first, then refresh history.' : 'History could not be refreshed now. Try again when online.'); }} /> : <><h1>Reports</h1><section className="coach-panel" role="status"><p>{preparing ? 'Loading your history…' : 'Your history is not on this device yet. Connect to the internet to load it.'}</p></section></>)}
    {page === 'raffle' && <RaffleScreen data={data} ownerId={ownerId} onData={receiveRaffleData} mode="draw" />}
    {page === 'settings' && <><h1>Settings</h1><section className="coach-panel"><h2>Offline copy</h2><p>{ready ? `Saved on this device ${new Date(prepared!.savedAt).toLocaleString()}` : preparing ? 'Saving now…' : 'Not saved on this device yet. Unsent attendance stays stored.'}</p><button className="quiet" disabled={!navigator.onLine || busy || !!data.testOffline} onClick={() => void prepareDevice()}>Refresh offline copy</button><p>Do not clear browser site data or lose this iPad while attendance is waiting to sync.</p></section><section className="coach-panel"><h2>Coach exit PIN</h2><p>{!prepared ? 'PIN setting not loaded yet' : prepared.exitCode.mode === 'custom' ? 'Custom four-digit PIN active' : 'Default code 0000 active'}. This code exits shared-device check-in.</p>{data.pendingPin ? <><p>A PIN request is waiting for its result. Retry sends the exact same request.</p><button disabled={busy || !navigator.onLine || !!data.testOffline} onClick={() => void act(c => changePin(ownerId, c), 'PIN result confirmed.')}>Retry PIN request</button><button disabled={busy || !navigator.onLine || !!data.testOffline} onClick={() => { if (window.confirm('Discard this PIN request after checking the current server setting?')) void act(() => discardPendingPin(ownerId), 'Current server PIN setting loaded.'); }}>Review server and discard request</button></> : <><label>New four-digit PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} /></label><button disabled={!navigator.onLine || !!data.testOffline || busy || !/^\d{4}$/.test(pin)} onClick={async () => { try { const verifier = await derivePin(pin); if (await act(c => changePin(ownerId, c, verifier), 'PIN changed and synced.')) setPin(''); } catch (error) { setStatus(message(error)); } }}>Set PIN</button><button className="quiet" disabled={!navigator.onLine || !!data.testOffline || busy} onClick={() => void act(c => changePin(ownerId, c), 'PIN reset and synced.')}>Reset to 0000</button></>}</section>{!IS_RELEASE && <details className="coach-panel"><summary>Browser test controls</summary><p>This isolated test control blocks Supabase requests from this browser. It is a simulation, not an iPad airplane-mode test.</p><button className="quiet" onClick={async () => { try { const nextOffline = !data.testOffline; await setSimulatedOffline(nextOffline); const next = await changeOwner(ownerId, d => { d.testOffline = nextOffline; return d; }); setData(next); setStatus(nextOffline ? 'Test network disconnected.' : 'Test network restored.'); if (!nextOffline) void runSync(); } catch (error) { setStatus(message(error)); } }}>{data.testOffline ? 'Restore test network' : 'Simulate gym offline'}</button><div className="test-control-action"><button className="quiet" disabled={dropWorking} onClick={() => void dropDrawReplyForTest()}>{dropWorking ? 'Setting up lost-response test…' : 'Drop next operation acknowledgment'}</button>{dropFeedback && <p className="test-control-feedback" role="status">{dropFeedback}</p>}</div><button className="quiet" onClick={async () => { try { await failNextRpc('503'); setStatus('The next test operation will receive a temporary 503.'); } catch (error) { setStatus(message(error)); } }}>Force next operation 503</button><button className="quiet" onClick={async () => { try { await failNextRpc('40001'); setStatus('The next test operation will receive a revision conflict.'); } catch (error) { setStatus(message(error)); } }}>Force next operation conflict</button><button className="quiet" onClick={() => void expireStoredSessionForTest()}>Expire stored token and go offline</button><button className="quiet" onClick={async () => { try { await expireNextAuthCheck(); setStatus("The next test sign-in check will return an expired-session error."); } catch (error) { setStatus(message(error)); } }}>Expire next sign-in check</button><button className="quiet" onClick={() => { setWriteFailure(!writeFailure); setTestWriteFailure(!writeFailure); setStatus(!writeFailure ? 'Test local writes now fail.' : 'Test local writes restored.'); }}>{writeFailure ? 'Restore local writes' : 'Simulate local storage failure'}</button></details>}<ReportsScreen data={data} exportOnly /><RaffleScreen data={data} ownerId={ownerId} onData={receiveRaffleData} mode="settings" /><button className="quiet" onClick={() => void logout()}>Sign out</button></>}
    {logoutWarning && <section className="coach-panel warning"><h2>Pending work stays on this iPad</h2><p>{pending + (data.pendingRaffle ? 1 : 0)} saved attendance or raffle request(s) will be hidden until this same coach signs in again. Keep this iPad and its browser data.</p><button onClick={() => void logout()}>Sign out and keep pending work</button><button className="quiet" onClick={() => setLogoutWarning(false)}>Stay signed in</button></section>}
    </main></div>;
}
