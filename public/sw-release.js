const CACHE = 'kaizen-release-stage6-shell-19';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'PREPARE_SHELL') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      for (const url of event.data.urls) {
        const response = await fetch(new Request(new URL(url, self.location.origin), { cache: 'reload' }));
        if (!response.ok) throw new Error(`Could not cache ${url}: ${response.status}`);
        await cache.put(url, response);
      }
      event.ports[0].postMessage({ ok: true, version: CACHE });
    } catch (error) { event.ports[0].postMessage({ ok: false, error: String(error) }); }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(event.request); }
      catch { const cache = await caches.open(CACHE); return await cache.match('/release.html') || await caches.match('/release.html') || Response.error(); }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreVary: true }) || await caches.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    return fetch(event.request);
  })());
});
