export const AUTH_STORAGE_KEY = 'kaizen-stage4-test-auth';
const LAST_OWNER_KEY = 'kaizen-stage4-test-last-owner';

export function lastOwner(): string | null { return localStorage.getItem(LAST_OWNER_KEY); }
export function rememberOwner(ownerId: string): void { localStorage.setItem(LAST_OWNER_KEY, ownerId); }
export function clearDeviceSignIn(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LAST_OWNER_KEY);
}
