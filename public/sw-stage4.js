const CACHE = 'kaizen-stage5-shell-11';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'EXPIRE_NEXT_AUTH') {
    event.waitUntil((async () => {
      const cache = await caches.open('kaizen-stage4-test-network');
      await cache.put('/__stage4_expire_auth__', new Response('once'));
      event.ports[0].postMessage({ ok: true });
    })());
    return;
  }
  if (event.data?.type === 'DROP_NEXT_ACK') {
    event.waitUntil((async () => {
      const cache = await caches.open('kaizen-stage4-test-network');
      await cache.put('/__stage4_drop_ack__', new Response('once'));
      event.ports[0].postMessage({ ok: true });
    })());
    return;
  }
  if (event.data?.type === 'FAIL_NEXT_RPC' && ['503', '40001'].includes(event.data.code)) {
    event.waitUntil((async () => {
      const cache = await caches.open('kaizen-stage4-test-network');
      await cache.put('/__stage4_fail_rpc__', new Response(event.data.code));
      event.ports[0].postMessage({ ok: true });
    })());
    return;
  }
  if (event.data?.type === 'SET_TEST_OFFLINE') {
    event.waitUntil((async () => {
      const cache = await caches.open('kaizen-stage4-test-network');
      if (event.data.offline) await cache.put('/__stage4_offline_marker__', new Response('offline'));
      else await cache.delete('/__stage4_offline_marker__');
      event.ports[0].postMessage({ ok: true });
    })());
    return;
  }
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
  if (new URL(event.request.url).hostname === 'viouquduxutuslafiooy.supabase.co') {
    event.respondWith((async () => {
      const cache = await caches.open('kaizen-stage4-test-network');
      if (await cache.match('/__stage4_offline_marker__')) return Response.error();
      if (new URL(event.request.url).pathname === '/auth/v1/user' && await cache.match('/__stage4_expire_auth__')) {
        await cache.delete('/__stage4_expire_auth__');
        return new Response(JSON.stringify({ code: 'bad_jwt', message: 'Test sign-in expired' }), { status: 401, headers: { 'content-type': 'application/json' } });
      }
      if (new URL(event.request.url).pathname.startsWith('/rest/v1/rpc/') && await cache.match('/__stage4_fail_rpc__')) {
        const code = await (await cache.match('/__stage4_fail_rpc__')).text();
        await cache.delete('/__stage4_fail_rpc__');
        return new Response(JSON.stringify({ code: code === '503' ? 'PGRST002' : '40001', message: code === '503' ? 'Test service unavailable' : 'Test stale revision', details: null, hint: null }), { status: code === '503' ? 503 : 409, headers: { 'content-type': 'application/json' } });
      }
      if (new URL(event.request.url).pathname.startsWith('/rest/v1/rpc/') && await cache.match('/__stage4_drop_ack__')) {
        await cache.delete('/__stage4_drop_ack__');
        const response = await fetch(event.request);
        return response.ok ? Response.error() : response;
      }
      return fetch(event.request);
    })());
    return;
  }
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(event.request); }
      catch { const cache = await caches.open(CACHE); return await cache.match('/stage4.html') || await caches.match('/stage4.html') || Response.error(); }
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
