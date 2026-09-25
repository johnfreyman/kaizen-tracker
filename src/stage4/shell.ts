import { SHELL_VERSION } from './types';
export function shellAssetUrls(): string[] {
  const urls = new Set<string>(['/stage4.html']);
  document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"][href]').forEach(element => {
    const address = 'src' in element ? element.src : element.href;
    if (new URL(address).origin === location.origin) urls.add(address);
  });
  return [...urls].sort();
}
export function shellFingerprint(): string { return shellAssetUrls().join('|'); }
export async function shellCacheReady(): Promise<boolean> {
  if (!('caches' in window)) return false;
  const cache = await caches.open(`kaizen-${SHELL_VERSION}`);
  for (const url of shellAssetUrls()) if (!(await cache.match(url, { ignoreVary: true }))) return false;
  return true;
}
export async function prepareShell(): Promise<string> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('This browser cannot cache the app shell.');
  const registration = await navigator.serviceWorker.register(`/sw-stage4.js?v=${SHELL_VERSION}`);
  await navigator.serviceWorker.ready;
  const worker = await new Promise<ServiceWorker>((resolve, reject) => {
    const deadline = Date.now() + 15000;
    const check = () => {
      const active = registration.active;
      if (active?.state === 'activated' && new URL(active.scriptURL).searchParams.get('v') === SHELL_VERSION) resolve(active);
      else if (Date.now() >= deadline) reject(new Error('The updated offline app shell did not activate. Reload and retry preparation.'));
      else setTimeout(check, 100);
    };
    check();
  });
  const response = await fetch(`/stage4-assets.json?version=${SHELL_VERSION}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('The complete app asset list is unavailable.');
  const urls = await response.json() as string[];
  if (!Array.isArray(urls) || !urls.includes('/stage4.html') || !urls.some(url => url.endsWith('.js'))) throw new Error('The app asset list is incomplete.');
  urls.push('/stage4-assets.json', '/sw-stage4.js');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('App shell caching timed out.')), 15000);
    channel.port1.onmessage = event => { clearTimeout(timeout); event.data?.ok ? resolve() : reject(new Error(event.data?.error ?? 'App shell caching failed.')); };
    worker.postMessage({ type: 'PREPARE_SHELL', urls }, [channel.port2]);
  });
  const cache = await caches.open(`kaizen-${SHELL_VERSION}`);
  for (const url of urls) if (!(await cache.match(url))) throw new Error(`App asset ${url} was not saved locally.`);
  return shellFingerprint();
}

export async function setSimulatedOffline(offline: boolean): Promise<void> {
  const worker = navigator.serviceWorker.controller;
  if (!worker) throw new Error('Reload once after preparation before testing offline mode.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Offline test control timed out.')), 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); event.data?.ok ? resolve() : reject(new Error('Offline test control failed.')); };
    worker.postMessage({ type: 'SET_TEST_OFFLINE', offline }, [channel.port2]);
  });
}

export async function dropNextAcknowledgment(): Promise<void> {
  const worker = navigator.serviceWorker.controller;
  if (!worker) throw new Error('Reload once after preparation before testing acknowledgment loss.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Acknowledgment test timed out.')), 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); event.data?.ok ? resolve() : reject(new Error('Acknowledgment test failed.')); };
    worker.postMessage({ type: 'DROP_NEXT_ACK' }, [channel.port2]);
  });
}

export async function failNextRpc(code: '503' | '40001'): Promise<void> {
  const worker = navigator.serviceWorker.controller;
  if (!worker) throw new Error('Reload once after preparation before testing server responses.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Server response test timed out.')), 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); event.data?.ok ? resolve() : reject(new Error('Server response test failed.')); };
    worker.postMessage({ type: 'FAIL_NEXT_RPC', code }, [channel.port2]);
  });
}

export async function expireNextAuthCheck(): Promise<void> {
  const worker = navigator.serviceWorker.controller;
  if (!worker) throw new Error('Reload once after preparation before testing sign-in expiry.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Sign-in test timed out.')), 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); event.data?.ok ? resolve() : reject(new Error('Sign-in test failed.')); };
    worker.postMessage({ type: 'EXPIRE_NEXT_AUTH' }, [channel.port2]);
  });
}
