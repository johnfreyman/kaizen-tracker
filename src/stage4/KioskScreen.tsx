import { useEffect, useRef, useState } from 'react';
import { kioskMatches } from './kiosk';
import { displayPlayer, type OwnerData } from './types';

type Phase = { kind: 'pad' } | { kind: 'matches'; number: string } | { kind: 'none'; number: string } | { kind: 'confirmed'; name: string; undone: boolean };
type Props = {
  data: OwnerData;
  authPaused: boolean;
  onMark: (playerId: string, present: boolean) => Promise<void>;
  onExit: (pin: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSignIn: (coach: 'a' | 'b', password: string) => Promise<void>;
};

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export default function KioskScreen({ data, authPaused, onMark, onExit, onRefresh, onSignIn }: Props) {
  const [entry, setEntry] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'pad' });
  const [exitOpen, setExitOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [refreshMessage, setRefreshMessage] = useState('');
  const [coach, setCoach] = useState<'a' | 'b'>('a');
  const [password, setPassword] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const autoChecked = useRef(false);
  const bound = data.sessions.find(session => session.id === data.kioskSessionId);
  const finished = !bound || bound.state !== 'active' || data.kioskClosedSessionId === data.kioskSessionId;
  const canRefresh = navigator.onLine && !data.testOffline;
  const deliveryStatus = working ? 'Saving or checking…' : data.queue.some(operation => operation.status !== 'pending') ? 'Saved on this device · upload needs coach review' : !canRefresh ? data.queue.length ? 'Offline · saved changes waiting to sync' : 'Offline · no unsent changes' : data.queue.length ? 'Saved on this device · waiting to sync' : 'All saved changes synced';

  useEffect(() => {
    if (phase.kind !== 'confirmed') return;
    const timer = setTimeout(() => { setEntry(''); setPhase({ kind: 'pad' }); }, 2500);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (autoChecked.current || !canRefresh) return;
    autoChecked.current = true;
    void onRefresh().catch(() => { /* kiosk stays usable with its prepared offline snapshot */ });
  }, [canRefresh, onRefresh]);

  function enterNumber(value: string) {
    setEntry(value.replace(/\D/g, '').slice(0, 4));
    setPhase({ kind: 'pad' });
    setError('');
  }

  async function findPlayer(event: React.FormEvent) {
    event.preventDefault();
    if (working || finished) return;
    if (/^\d{4}$/.test(entry)) {
      setWorking(true); setError('');
      try { await onExit(entry); }
      catch (cause) {
        setEntry(''); setPhase({ kind: 'pad' });
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally { setWorking(false); }
      return;
    }
    if (!/^\d{1,3}$/.test(entry)) { setError('Enter a jersey number or four-digit coach PIN.'); return; }
    const matches = kioskMatches(data, entry);
    setPhase(matches.length ? { kind: 'matches', number: entry } : { kind: 'none', number: entry });
    setError('');
  }

  async function mark(playerId: string, present: boolean, name: string) {
    if (working || finished) return;
    setWorking(true); setError('');
    try {
      await onMark(playerId, present);
      setEntry('');
      setPhase({ kind: 'confirmed', name, undone: !present });
    } catch (cause) {
      setError(`Check-in was not saved on this device. Ask your coach. ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setWorking(false); }
  }

  async function exit(event: React.FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true); setError('');
    try { await onExit(pin); }
    catch (cause) { setPin(''); setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setWorking(false); }
  }

  async function refresh() {
    if (working) return;
    setWorking(true); setError(''); setRefreshMessage('Checking the session and exit code…');
    try { await onRefresh(); setRefreshMessage('Session and exit code refreshed.'); setShowSignIn(false); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setRefreshMessage(message);
      if (message.includes('Sign in')) setShowSignIn(true);
    } finally { setWorking(false); }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true); setError('');
    try {
      await onSignIn(coach, password);
      setPassword('');
      setShowSignIn(false);
      setRefreshMessage('Signed in as the same coach. Refresh the exit code after a reset.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setWorking(false); }
  }

  const matches = phase.kind === 'matches' ? kioskMatches(data, phase.number) : [];

  return <div className="coach-app kiosk-app">
    <header className="kiosk-header"><div><small>{bound ? `${bound.kind} · ${bound.date}` : 'Coach attendance'}</small><h1>{finished ? 'Session finished — ask your coach' : 'Player check-in'}</h1></div></header>
    <main className="kiosk-main">
      <p className="sync-line" role="status">{deliveryStatus}{authPaused ? ' · Upload paused until the coach signs in' : ''}</p>
      {error && <p className="kiosk-alert" role="alert">{error}</p>}
      {finished ? <section className="coach-panel kiosk-centered"><h2>This session is no longer checking anyone in.</h2><p>Ask your coach for help. The coach can enter the exit PIN below.</p></section> : phase.kind === 'confirmed' ? <section className="coach-panel kiosk-centered" role="status"><h2>{phase.undone ? 'Check-in undone' : 'You’re checked in'}</h2><p>{phase.name}</p><p>Saved on this device. Returning to the number pad…</p></section> : <>
        <form className="kiosk-lookup" onSubmit={findPlayer}>
          <label htmlFor="kiosk-number">Jersey number (1–3 digits) or coach exit PIN (4 digits)</label>
          <input id="kiosk-number" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" value={entry} onChange={event => enterNumber(event.target.value)} disabled={working} />
          <div className="kiosk-pad" aria-label="Number pad">{digits.map(digit => <button type="button" key={digit} disabled={working} onClick={() => enterNumber(entry + digit)} aria-label={`Digit ${digit}`}>{digit}</button>)}<button type="button" className="quiet" disabled={working || !entry} onClick={() => enterNumber(entry.slice(0, -1))}>Backspace</button><button type="button" className="quiet" disabled={working || !entry} onClick={() => enterNumber('')}>Clear</button></div>
          <button className="kiosk-primary" disabled={working || !entry}>{entry.length === 4 ? 'Exit kiosk' : 'Find player'}</button>
        </form>
        {phase.kind === 'none' && <section className="coach-panel kiosk-centered" role="status">No player found for #{phase.number} — try again or ask your coach.</section>}
        {phase.kind === 'matches' && <section className="kiosk-results"><h2>{matches.length === 1 ? 'Tap your card to check in' : `${matches.length} players wear #${phase.number}. Tap your card.`}</h2>{matches.map(player => {
          const present = !!bound?.present[player.id];
          const teamNames = player.team_ids.map(id => data.prepared?.teams.find(team => team.id === id)?.name).filter(Boolean).join(' + ') || 'Kaizen';
          return <button key={player.id} type="button" className={`kiosk-match ${present ? 'present' : ''}`} disabled={working} onClick={() => void mark(player.id, !present, displayPlayer(player))}><strong>{displayPlayer(player)}</strong><span>{teamNames}</span><span>{present ? 'Checked in · Undo check-in' : 'Tap to check in'}</span></button>;
        })}</section>}
      </>}
      <section className="kiosk-coach"><button type="button" className="quiet" disabled={working} onClick={() => { setExitOpen(!exitOpen); setError(''); }} aria-expanded={exitOpen}>Coach exit</button>
        {exitOpen && <div className="coach-panel"><h2>Coach exit</h2><form onSubmit={exit}><label htmlFor="kiosk-pin">Four-digit exit PIN</label><input id="kiosk-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} disabled={working} /><button disabled={working || pin.length !== 4}>Exit kiosk</button></form><p>Forgot the code? Reconnect this iPad. A signed-in coach can reset it in Settings on another prepared device; then refresh this kiosk’s exit code below. Offline, this kiosk stays bound to its session until the code can be verified.</p><button type="button" className="quiet" disabled={working || !canRefresh} onClick={() => void refresh()}>Refresh session and exit code</button>{refreshMessage && <p role="status">{refreshMessage}</p>}
          {(authPaused || showSignIn) && <form className="kiosk-reauth" onSubmit={signIn}><h2>Coach sign-in for recovery</h2><label>Test coach<select value={coach} onChange={event => { setCoach(event.target.value as 'a' | 'b'); setPassword(''); }}><option value="a">Coach A</option><option value="b">Coach B</option></select></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button disabled={working || !canRefresh}>Sign in as this coach</button></form>}
        </div>}
      </section>
    </main>
  </div>;
}
