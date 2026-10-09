export default function SwitchCoach({ email, needsPassword, busy, error, onContinue, onCancel }: {
  email?: string; needsPassword: boolean; busy: boolean; error: string;
  onContinue: (setPassword: boolean) => void; onCancel: () => void;
}) {
  return <main className="coach-app auth"><section className="coach-panel onboarding-panel">
    <h1>Use this coach account?</h1>
    <p>{email ? `You are signing in as ${email}.` : 'You are signing in as a different coach.'} Another coach has saved work on this browser.</p>
    <p>Switching keeps that coach’s attendance and unsent changes saved separately. They can sign in again to resume their work.</p>
    {needsPassword && <p>Next, create the password you will use to sign in.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="onboarding-actions"><button aria-label={needsPassword ? 'Continue to password setup' : 'Switch to this coach'} disabled={busy} onClick={() => onContinue(needsPassword)}>{busy ? 'Checking sign-in…' : needsPassword ? 'Continue' : 'Switch coach'}</button>
    <button className="quiet" disabled={busy} onClick={onCancel}>Keep previous coach</button></div>
    {!needsPassword && <button className="onboarding-inline-action" disabled={busy} onClick={() => onContinue(true)}>Set a password and switch</button>}
  </section></main>;
}
