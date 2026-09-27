// Immutable legacy fixture worker modelled on the Workbox generateSW output of the old build
// (registerType 'prompt'): precache with revision parameters, navigations answered from the cached
// index.html, hashed /assets answered cache-first. No skipWaiting on install and no clients.claim.
// Like Workbox's precache route, lookups use the URL string rather than the incoming Request, so the
// stored responses' `Vary: Origin` never blocks a match.
const PRECACHE = 'op-patchstudio-legacy-fixture-precache-v1';
const PRECACHE_URLS = [
  '/index.html?__WB_REVISION__=legacy-1',
  '/assets/legacy-app-7f3a.js?__WB_REVISION__=legacy-1',
  '/assets/legacy-late-7f3a.js?__WB_REVISION__=legacy-1',
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS)));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match('/index.html', { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(url.pathname, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
  }
});
