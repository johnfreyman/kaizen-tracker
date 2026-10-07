import { useCallback, useEffect, useState } from 'react';
import { refreshRaffle, runRaffle, saveRafflePreferences, type RaffleChoice } from './raffle';
import { readOwner } from './db';
import type { OwnerData, RaffleSnapshot } from './types';

type Props = { data: OwnerData; ownerId: string; onData: (next: OwnerData) => void; mode: 'settings' | 'draw' };
export default function RaffleScreen({ data, ownerId, onData, mode }: Props) {
  const [snapshot, setSnapshot] = useState<RaffleSnapshot | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [prize, setPrize] = useState(data.rafflePreferences?.roundId === data.prepared?.roundId ? data.rafflePreferences?.prize ?? '' : '');
  const [excludeLastN, setExcludeLastN] = useState(data.rafflePreferences?.roundId === data.prepared?.roundId ? data.rafflePreferences?.excludeLastN ?? 0 : 0);
  const [winner, setWinner] = useState('');
  const online = navigator.onLine && !data.testOffline;
  const blocked = !online || !!data.queue.length || !!data.pendingPin || !!data.pendingRaffle;
  const active = data.sessions.some(session => session.state === 'active');
  const load = useCallback(async (count: number) => {
    setWorking(true); setSnapshot(null); setError('');
    try { setSnapshot(await refreshRaffle(ownerId, count)); onData(await readOwner(ownerId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setWorking(false); }
  }, [ownerId, onData]);
  useEffect(() => { if (online && !data.queue.length) void load(mode === 'draw' ? excludeLastN : 0); }, [load, mode, online, data.queue.length]);
  async function changePreferences(nextPrize: string, nextCount: number) {
    setPrize(nextPrize); setExcludeLastN(nextCount);
    try { onData(await saveRafflePreferences(ownerId, snapshot?.round_id ?? data.prepared?.roundId ?? '', nextPrize, nextCount)); if (mode === 'draw') await load(nextCount); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  async function act(choice?: RaffleChoice) {
    if (!snapshot) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const result = await runRaffle(ownerId, snapshot, choice);
      onData(result.data); setSnapshot(result.snapshot); setConfirmEnable(false);
      if (choice?.kind === 'void_draw_v1' || choice?.kind === 'set_raffle_v1' || result.result.voided_at) setWinner('');
      if (choice?.kind === 'draw_v1' || (!choice && result.result.display_name)) setWinner(String(result.result.display_name));
      setNotice(choice?.kind === 'set_raffle_v1' ? choice.mode === 'fresh' ? 'New round opened. Earlier tickets and draw history remain saved.' : choice.mode === 'off' ? 'Raffle turned off. Tickets keep accruing.' : 'Raffle turned on with existing tickets.' : choice?.kind === 'void_draw_v1' ? 'Last draw marked void. Attendance and tickets remain.' : 'Raffle request confirmed.');
    } catch (cause) {
      const saved = await readOwner(ownerId);
      onData(saved);
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(saved.pendingRaffle && !detail.startsWith('Sign in') && !detail.startsWith('Connect')
        ? 'This request is saved on your device, but its result is not confirmed. Use Retry saved raffle request to check the result.'
        : detail);
    }
    finally { setWorking(false); }
  }
  const counts = new Map<string, { label: string; tickets: number }>();
  for (const ticket of snapshot?.tickets ?? []) { const row = counts.get(ticket.player_id) ?? { label: ticket.display_name, tickets: 0 }; row.tickets++; counts.set(ticket.player_id, row); }
  const currentDraws = snapshot?.draws.filter(draw => draw.round_id === snapshot.round_id) ?? [];
  const lastDraw = currentDraws.find(draw => !draw.voided_at);
  return <section className="raffle-screen"><h2>{mode === 'settings' ? 'Raffle settings' : 'Raffle'}</h2>
    <p>Optional training earns one ticket per present player, even while the raffle is off. A draw leaves tickets and credited hours unchanged.</p>
    {!online && <p className="warning">Reconnect to see the authoritative ticket pool and change the raffle.</p>}
    {!!data.queue.length && <p className="warning">Synchronize and review saved attendance before drawing or starting fresh.</p>}
    {error && <p className="kiosk-alert" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data.pendingRaffle && <div className="coach-panel warning"><h3>Raffle request awaiting confirmation</h3><p>The request was saved on this device. Retry sends its original identity, so a lost response cannot create a second draw or round.</p><button disabled={working || !online || !snapshot} onClick={() => void act()}>Retry saved raffle request</button></div>}
    {snapshot && <><p>Round {snapshot.generation} · {snapshot.pool_count} eligible ticket{snapshot.pool_count === 1 ? '' : 's'}{mode === 'draw' && excludeLastN > 0 ? ` after excluding recent winners` : ''} · {snapshot.raffle_enabled ? 'On' : 'Off'}</p><button className="quiet" disabled={working || !online} onClick={() => void load(mode === 'draw' ? excludeLastN : 0)}>Refresh ticket pool</button></>}
    {mode === 'settings' && snapshot && <div className="coach-panel"><h3>Raffle visibility</h3>{snapshot.raffle_enabled ? <><p>Turning off hides draw tools. Earned tickets stay in this round.</p><button disabled={working || blocked} onClick={() => void act({ kind: 'set_raffle_v1', mode: 'off' })}>Turn raffle off</button><p>Start fresh opens a new round with zero tickets. It never changes attendance, hours, or previous results.</p><button className="quiet" disabled={working || blocked || active} onClick={() => setConfirmEnable(true)}>Start fresh round</button></> : <button disabled={working || blocked} onClick={() => setConfirmEnable(true)}>Turn raffle on</button>}
      {confirmEnable && <div className="raffle-confirm"><h3>Use existing raffle tickets?</h3><p>Your players have earned {snapshot.pool_count} ticket{snapshot.pool_count === 1 ? '' : 's'} from optional trainings.</p><button disabled={working || blocked} onClick={() => void act({ kind: 'set_raffle_v1', mode: 'keep' })}>Keep {snapshot.pool_count} tickets</button><button className="quiet" disabled={working || blocked || active} onClick={() => void act({ kind: 'set_raffle_v1', mode: 'fresh' })}>Start fresh</button><button className="quiet" onClick={() => setConfirmEnable(false)}>Cancel</button><p>Start fresh begins a new round. Attendance, credited hours and previous raffle results stay unchanged.</p></div>}</div>}
    {mode === 'draw' && snapshot && <><div className="coach-panel"><h3>Eligible tickets</h3>{[...counts.entries()].map(([id, row]) => <p key={id}>{row.label} · {row.tickets} ticket{row.tickets === 1 ? '' : 's'}</p>)}{counts.size === 0 && <p>No eligible tickets in this view.</p>}<label>Prize<input maxLength={120} value={prize} onChange={event => setPrize(event.target.value)} onBlur={() => { void saveRafflePreferences(ownerId, snapshot.round_id, prize, excludeLastN).then(onData).catch(cause => setError(cause instanceof Error ? cause.message : String(cause))); }} /></label><label>Exclude recent winners<select disabled={working || !!data.pendingRaffle} value={excludeLastN} onChange={event => void changePreferences(prize, Number(event.target.value))}>{Array.from({ length: 21 }, (_, number) => <option key={number} value={number}>{number === 0 ? 'No exclusions' : `Last ${number} winner${number === 1 ? '' : 's'}`}</option>)}</select></label><button disabled={working || blocked || active || !snapshot.raffle_enabled || snapshot.pool_count === 0} onClick={() => void act({ kind: 'draw_v1', prize, excludeLastN })}>Draw winner</button>{active && <p>Finish the active session before drawing.</p>}</div>{winner && <div className="coach-panel raffle-winner" role="status"><h3>Winner</h3><strong>{winner}</strong><p>The draw is recorded. Tickets remain in the pool.</p></div>}</>}
    {snapshot && <div className="coach-panel"><h3>Draw history</h3>{snapshot.draws.length === 0 && <p>No draws recorded yet.</p>}{snapshot.draws.map(draw => <div className="row" key={draw.id}><span>{new Date(draw.drawn_at).toLocaleString()} · {draw.display_name} · {draw.prize || 'No prize listed'} · round {draw.round_id === snapshot.round_id ? snapshot.generation : 'earlier'}{draw.voided_at ? ' · voided' : ''}<small>{draw.pool_count} tickets in that draw</small></span>{mode === 'draw' && lastDraw?.id === draw.id && <button className="quiet" disabled={working || blocked} onClick={() => { if (window.confirm('Mark the last draw void? The history and tickets remain.')) void act({ kind: 'void_draw_v1', drawId: draw.id }); }}>Undo last draw</button>}</div>)}</div>}
  </section>;
}
