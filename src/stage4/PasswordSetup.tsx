import { useState } from 'react';
import { client } from './api';

type SetupProblem = { message: string; recovery: boolean };
function verificationProblem(error: { status?: number; code?: string; name?: string } | null): SetupProblem {
  if (!error || error.status === 401 || error.name === 'AuthSessionMissingError' || ['session_not_found', 'refresh_token_not_found', 'bad_jwt', 'user_not_found'].includes(error.code ?? '')) {
    return { message: 'Your sign-in session is no longer available. Use a new setup link to continue.', recovery: true };
  }
  if (error.status === 403) return { message: 'This account cannot sign in. Contact your administrator.', recovery: false };
  return { message: 'We could not verify your sign-in. Check your connection and try again.', recovery: false };
}

export default function PasswordSetup({ ownerId, email, onComplete, onCancel }: { ownerId: string; email?: string; onComplete: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<SetupProblem | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (working || sendingLink || linkSent) return;
    if (password.length < 8) { setProblem({ message: 'Use at least eight characters.', recovery: false }); return; }
    if (password !== confirmation) { setProblem({ message: 'The passwords must match.', recovery: false }); return; }
    setWorking(true); setProblem(null);
    try {
      const identity = await client.auth.getUser();
      if (identity.error || !identity.data.user) { setProblem(verificationProblem(identity.error)); return; }
      if (identity.data.user.id !== ownerId) {
        setProblem({ message: 'You are signed in with a different account. Sign out and use the setup link for the email shown above.', recovery: false });
        return;
      }
      const result = await client.auth.updateUser({ password });
      if (result.error) {
        if (result.error.status === 401 || result.error.code === 'session_not_found') setProblem(verificationProblem(result.error));
        else if (result.error.name === 'AuthRetryableFetchError' || (result.error.status ?? 0) >= 500) setProblem({ message: 'We could not confirm your password. Check your connection and try again.', recovery: false });
        else setProblem({ message: result.error.message, recovery: false });
        return;
      }
      setPassword(''); setConfirmation(''); onComplete();
    } catch { setProblem({ message: 'We could not confirm your password. Check your connection and try again.', recovery: false }); }
    finally { setWorking(false); }
  }
  async function sendSetupLink() {
    if (!email || working || sendingLink) return;
    setSendingLink(true);
    try {
      const result = await client.auth.resetPasswordForEmail(email, { redirectTo: 'https://teamtracker.leftbraincreative.xyz/' });
      if (result.error) throw result.error;
      setLinkSent(true); setProblem(null); setPassword(''); setConfirmation('');
    } catch { setProblem({ message: 'The setup link could not be sent. Please try again in a moment.', recovery: true }); }
    finally { setSendingLink(false); }
  }
  return <main className="coach-app auth"><section className="coach-panel onboarding-panel">
    <div className="onboarding-intro"><h1>Set your password</h1>{email && <p className="onboarding-account">{email}</p>}<p>Choose the password you will use to sign in to Kaizen Tracker.</p></div>
    <form onSubmit={submit}>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      {problem && <div className="onboarding-notice" role="alert"><p>{problem.message}</p>{problem.recovery && email && <button type="button" className="onboarding-inline-action" disabled={sendingLink} onClick={() => void sendSetupLink()}>{sendingLink ? 'Sending link…' : 'Send a new setup link'}</button>}</div>}
      {linkSent && <p className="onboarding-notice" role="status">Check your email for a new setup link. Open it to finish creating your password.</p>}
      <div className="onboarding-actions"><button type="submit" disabled={working || sendingLink || linkSent}>{working ? 'Saving…' : 'Save password'}</button><button type="button" className="quiet" disabled={working || sendingLink} onClick={onCancel}>Sign out</button></div>
    </form>
  </section></main>;
}
