import type { ExitCode, PinVerifier } from './types';
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function hash(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return encode(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)));
}
export async function derivePin(pin: string): Promise<PinVerifier> {
  if (!/^\d{4}$/.test(pin)) throw new Error('Enter exactly four digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { alg: 'PBKDF2-SHA256', iterations: 600000, salt: encode(salt), hash: await hash(pin, salt, 600000) };
}
export async function verifyPin(pin: string, exitCode: ExitCode): Promise<boolean> {
  if (exitCode.mode === 'default') return pin === '0000';
  if (!/^\d{4}$/.test(pin)) return false;
  const verifier = exitCode.verifier;
  if (!verifier) return false;
  return (await hash(pin, decode(verifier.salt), verifier.iterations)) === verifier.hash;
}
