import { DEVICE_STORAGE_PREFIX } from './runtime';

export const AUTH_STORAGE_KEY = `${DEVICE_STORAGE_PREFIX}-auth`;
// Capture the link type before Supabase consumes the authentication fragment.
export const INITIAL_PASSWORD_SETUP = typeof window !== 'undefined' && ['invite', 'recovery'].includes(new URLSearchParams(window.location.hash.slice(1)).get('type') ?? '');
const LAST_OWNER_KEY = `${DEVICE_STORAGE_PREFIX}-last-owner`;

export function lastOwner(): string | null { return localStorage.getItem(LAST_OWNER_KEY); }
export function rememberOwner(ownerId: string): void { localStorage.setItem(LAST_OWNER_KEY, ownerId); }
export function clearDeviceSignIn(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LAST_OWNER_KEY);
}
