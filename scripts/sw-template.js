const VERSION = __VERSION__;
const CACHE = 'ingatlanfelvetel-offline-' + VERSION;
const ASSETS = __PRECACHE__;
const paths = new Set(ASSETS);
self.addEventListener('install', event => {
  // Activation is atomic: a failed download leaves the previous worker in place.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  // Retain earlier caches so already-open tabs can finish without missing chunks.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data?.type === 'OFFLINE_STATUS') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const results = await Promise.all(ASSETS.map(url => cache.match(url)));
      event.ports[0]?.postMessage({ ready: results.every(Boolean), version: VERSION });
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // One local app route. APIs and user records are never cached here.
  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('/offline-app.html')) || fetch(request);
    })());
    return;
  }
  if (paths.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(request)) || (await caches.match(request)) || fetch(request);
    })());
  }
});
