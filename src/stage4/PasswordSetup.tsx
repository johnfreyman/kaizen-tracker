import { useState } from 'react';
import { client } from './api';

export default function PasswordSetup({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError('Use at least eight characters.'); return; }
    if (password !== confirmation) { setError('The passwords must match.'); return; }
    setWorking(true); setError('');
    try {
      const result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword(''); setConfirmation(''); onComplete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The password could not be saved.'); }
    finally { setWorking(false); }
  }
  return <main className="coach-app auth"><section className="coach-panel"><h1>Set your password</h1><p>Choose the password you will use to sign in to Kaizen Tracker.</p><form onSubmit={submit}>
    <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
    <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}<button disabled={working}>{working ? 'Saving password…' : 'Save password'}</button>
  </form><button className="quiet" disabled={working} onClick={onCancel}>Cancel and sign out</button></section></main>;
}
