import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// Kept in sync with src/utils/buildIdentity.ts (asserted by src/test/utils/buildIdentity.test.ts).
export const DEV_BUILD_ENDPOINT = '/__opstudio/build.json'

// The production build registers its generated worker at /sw.js. A production preview that once ran
// on a loopback origin leaves that worker installed. When the dev server later runs on the same origin,
// the worker keeps answering navigations from its precache, so the tab shows the old build. The dev
// server answers /sw.js with nothing, so the browser's update check fails and the old worker stays.
export const RETIRED_WORKER_PATHS = ['/sw.js']

// Development-only replacement worker. It removes only its own registration: Cache Storage,
// IndexedDB and localStorage are left untouched, and open tabs are not reloaded, so unsaved
// work in a stale tab is never discarded. The next load of the page reaches the dev server.
// A tab that was mid-load from the old precache when this worker took over still requests its
// hashed /assets files; those are read from the existing caches so that tab does not load blank.
// Navigations are never answered here, so every new page load goes to the dev server.
export const RETIRING_WORKER_SOURCE = `// OP-PatchStudio development server: retire a production service worker left on this origin.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode === 'navigate' || url.origin !== self.location.origin || !url.pathname.startsWith('/assets/')) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true, ignoreVary: true }).then((cached) => cached || fetch(event.request)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'OPSTUDIO_DEV_STALE_WORKER_RETIRED' });
  })());
});
`

export interface DevIdentityOptions {
  buildId: string
  version: string
  retireWorkers: boolean
  // Extra non-loopback hostnames to guard, e.g. a LAN name used for phone testing. Loopback is always allowed.
  extraHosts?: string[]
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

// Host header without its port; IPv6 literals keep their brackets.
export function requestHostname(host: string | undefined) {
  if (!host) return ''
  const value = host.trim().toLowerCase()
  if (value.startsWith('[')) return value.slice(0, value.indexOf(']') + 1)
  return value.split(':')[0]
}

// The guard only acts on the local development origins the studio uses, never on an arbitrary Host.
export const isGuardedHost = (host: string | undefined, extraHosts: string[] = []) => {
  const hostname = requestHostname(host)
  return LOOPBACK_HOSTS.has(hostname) || extraHosts.map(name => name.toLowerCase()).includes(hostname)
}

export function handleDevIdentityRequest(request: IncomingMessage, response: ServerResponse, next: () => void, options: DevIdentityOptions) {
  const path = (request.url ?? '').split('?')[0]
  if (!isGuardedHost(request.headers?.host, options.extraHosts)) {
    next()
    return
  }
  if (path === DEV_BUILD_ENDPOINT) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify({ buildId: options.buildId, version: options.version, mode: 'development', retireWorkers: options.retireWorkers }))
    return
  }
  if (options.retireWorkers && RETIRED_WORKER_PATHS.includes(path)) {
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.end(RETIRING_WORKER_SOURCE)
    return
  }
  next()
}

// apply: 'serve' keeps this out of production builds and `vite preview`, so offline support is unchanged.
export function devStaleWorkerGuard(options: DevIdentityOptions): Plugin {
  return {
    name: 'op-patchstudio-dev-stale-worker-guard',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => handleDevIdentityRequest(request, response, next, options))
    },
  }
}
