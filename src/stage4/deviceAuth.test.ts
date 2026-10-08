// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); history.replaceState(null, '', '/'); });
describe('invitation and recovery state', () => {
  it.each(['invite', 'recovery'])('captures a %s link before the SDK removes its fragment', async type => {
    history.replaceState(null, '', `/#access_token=synthetic-token&type=${type}`);
    const auth = await import('./deviceAuth');
    history.replaceState(null, '', '/');
    expect(auth.INITIAL_PASSWORD_SETUP).toBe(true);
    expect(auth.INITIAL_AUTH_REDIRECT_ERROR).toBe(false);
  });
  it('does not treat page navigation as a password setup link', async () => {
    history.replaceState(null, '', '/#history');
    const auth = await import('./deviceAuth');
    expect(auth.INITIAL_PASSWORD_SETUP).toBe(false);
  });
  it('detects an expired invitation instead of asking to change a fallback account’s password', async () => {
    history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired&type=invite');
    const auth = await import('./deviceAuth');
    expect(auth.INITIAL_AUTH_REDIRECT_ERROR).toBe(true);
    expect(auth.INITIAL_PASSWORD_SETUP).toBe(false);
  });
  it('binds unfinished password setup to its account without replacing the saved coach', async () => {
    const auth = await import('./deviceAuth');
    auth.rememberOwner('previous-coach'); auth.requestPasswordSetup('invited-coach');
    expect(auth.passwordSetupPending('invited-coach')).toBe(true);
    expect(auth.passwordSetupPending('previous-coach')).toBe(false);
    expect(auth.lastOwner()).toBe('previous-coach');
    auth.completePasswordSetup('invited-coach');
    expect(auth.passwordSetupPending('invited-coach')).toBe(false);
  });
});
