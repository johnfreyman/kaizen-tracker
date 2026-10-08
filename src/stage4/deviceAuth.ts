import { DEVICE_STORAGE_PREFIX } from './runtime';

export const AUTH_STORAGE_KEY = `${DEVICE_STORAGE_PREFIX}-auth`;
// Capture the link type before Supabase consumes the authentication fragment.
const redirectParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)) : new URLSearchParams();
export const INITIAL_AUTH_REDIRECT_ERROR = redirectParams.has('error');
export const INITIAL_PASSWORD_SETUP = !INITIAL_AUTH_REDIRECT_ERROR && ['invite', 'recovery'].includes(redirectParams.get('type') ?? '');
const LAST_OWNER_KEY = `${DEVICE_STORAGE_PREFIX}-last-owner`;

export function lastOwner(): string | null { return localStorage.getItem(LAST_OWNER_KEY); }
export function rememberOwner(ownerId: string): void { localStorage.setItem(LAST_OWNER_KEY, ownerId); }
export function clearDeviceSignIn(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LAST_OWNER_KEY);
}

// Only a pending step and its account ID are persisted; never a password or token.
const passwordSetupKey = (ownerId: string) => `${DEVICE_STORAGE_PREFIX}-password-setup-${ownerId}`;
export function passwordSetupPending(ownerId: string): boolean { return localStorage.getItem(passwordSetupKey(ownerId)) === '1'; }
export function requestPasswordSetup(ownerId: string): void { localStorage.setItem(passwordSetupKey(ownerId), '1'); }
export function completePasswordSetup(ownerId: string): void { localStorage.removeItem(passwordSetupKey(ownerId)); }
