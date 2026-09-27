const BUILD_ID = '__OPSTUDIO_PWA_BUILD_ID__';
self.__OPSTUDIO_BUILD_ID__ = BUILD_ID;
const APP_CACHE_PREFIX = 'op-patchstudio-';
const METADATA_CACHE = 'op-patchstudio-lifecycle-metadata-v1';
const METADATA_URL = new URL('__opstudio_cache_lifecycle__', self.registration.scope).href;
let lifecycleOperation = Promise.resolve();

function serialized(operation) {
  lifecycleOperation = lifecycleOperation.then(operation, operation);
  return lifecycleOperation;
}

async function readMetadata() {
  const response = await (await caches.open(METADATA_CACHE)).match(METADATA_URL);
  if (!response) return {};
  try {
    const value = await response.json();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

async function writeMetadata(value) {
  await (await caches.open(METADATA_CACHE)).put(METADATA_URL, new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  }));
}

function isAppPrecache(name) {
  return name.startsWith(APP_CACHE_PREFIX) && name.includes('-precache-');
}

function belongsToBuild(name, buildId) {
  return typeof buildId === 'string' && buildId.length > 0 &&
    name.startsWith(`${APP_CACHE_PREFIX}${buildId}-precache-`);
}

// Workbox invokes this tiny delegate for /assets routes. Keep the asynchronous
// retained-build lookup in this build-owned script so generateSW does not need
// to bundle a large callback, while preserving own-precache-first fallback.
self.__OPSTUDIO_FETCH_ASSET__ = async function fetchAssetFromRetainedPrecaches(request) {
  const appPrecaches = (await caches.keys()).filter(isAppPrecache);
  const ownPrefix = `op-patchstudio-${BUILD_ID}-precache-`;
  const lookupOrder = [
    ...appPrecaches.filter((name) => name.startsWith(ownPrefix)),
    ...appPrecaches.filter((name) => !name.startsWith(ownPrefix)).reverse(),
  ];
  for (const name of lookupOrder) {
    const response = await (await caches.open(name)).match(request, { ignoreSearch: true });
    if (response) return response;
  }
  return fetch(request);
};

function sameOwnership(left, right) {
  return left.current === right.current && left.previous === right.previous &&
    left.complete === right.complete;
}

function identifyWorker(worker) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (buildId) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(typeof buildId === 'string' && buildId.length > 0 ? buildId : null);
    };
    const timer = setTimeout(() => finish(null), 500);
    channel.port1.onmessage = (event) => {
      finish(event.data?.type === 'OPSTUDIO_WORKER_IDENTITY' ? event.data.buildId : null);
    };
    channel.port1.start?.();
    try {
      worker.postMessage({ type: 'OPSTUDIO_IDENTIFY_WORKER' }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

async function workerSlots() {
  if (self.registration.installing) return null;
  const activeWorker = self.registration.active;
  const waitingWorker = self.registration.waiting;
  const [active, waiting] = await Promise.all([
    identifyWorker(activeWorker),
    identifyWorker(waitingWorker),
  ]);
  if (self.registration.installing || self.registration.active !== activeWorker ||
      self.registration.waiting !== waitingWorker || !active || waitingWorker && !waiting) return null;
  return { active, waiting };
}

function sameSlots(left, right) {
  return !!left && !!right && left.active === right.active && left.waiting === right.waiting;
}

async function pruneSupersededCaches(expectedWaiting) {
  const ownership = await readMetadata();
  if (typeof ownership.current !== 'string' || ownership.current.length === 0 || ownership.complete !== true) return false;
  const slots = await workerSlots();
  if (!slots || slots.active !== ownership.current) return false;
  if (expectedWaiting ? slots.waiting !== expectedWaiting : slots.active !== BUILD_ID || slots.waiting) return false;

  const protectedBuilds = [ownership.current, ownership.previous, expectedWaiting]
    .filter((value) => typeof value === 'string' && value.length > 0);
  const candidates = (await caches.keys()).filter((name) =>
    isAppPrecache(name) && !protectedBuilds.some((buildId) => belongsToBuild(name, buildId)));

  for (const name of candidates) {
    // A newer worker may have become waiting since this operation began. Its
    // identity must be visible before any cache owned by another build is removed.
    const latest = await readMetadata();
    const latestSlots = await workerSlots();
    if (!sameOwnership(ownership, latest) || !sameSlots(slots, latestSlots)) return false;
    await caches.delete(name);
  }
  return true;
}

function scopedWindow(client) {
  if (client?.type !== 'window' || typeof client.url !== 'string') return false;
  try {
    const scope = new URL(self.registration.scope);
    const candidate = new URL(client.url);
    return candidate.origin === scope.origin && candidate.pathname.startsWith(scope.pathname);
  } catch {
    return false;
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'OPSTUDIO_IDENTIFY_WORKER') {
    const response = { type: 'OPSTUDIO_WORKER_IDENTITY', buildId: BUILD_ID };
    if (event.ports?.[0]) event.ports[0].postMessage(response);
    else event.source?.postMessage(response);
    return;
  }

  if (event.data?.type === 'OPSTUDIO_CLAIM_WAITING') {
    event.waitUntil(serialized(async () => {
      if (!scopedWindow(event.source)) return;
      const pruned = await pruneSupersededCaches(BUILD_ID);
      event.source?.postMessage({ type: 'OPSTUDIO_WAITING_CLAIMED', buildId: BUILD_ID, pruned });
    }));
    return;
  }

  if (event.data?.type !== 'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT') return;
  const decision = serialized(async () => {
    const openWindows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(scopedWindow);
    const requester = event.source;
    if (scopedWindow(requester) && openWindows.length === 1 && openWindows[0].id === requester.id) {
      return true;
    }
    requester?.postMessage({ type: 'OPSTUDIO_UPDATE_BLOCKED_OPEN_TABS' });
    return false;
  });
  event.waitUntil(decision.then((approved) => approved ? self.skipWaiting() : undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(serialized(async () => {
    const metadata = await readMetadata();
    const appPrecaches = (await caches.keys()).filter(isAppPrecache);
    const ownershipComplete = typeof metadata.current === 'string' ||
      appPrecaches.every((name) => belongsToBuild(name, BUILD_ID));
    const previous = metadata.current && metadata.current !== BUILD_ID
      ? metadata.current
      : metadata.previous;
    await writeMetadata({ current: BUILD_ID, previous, complete: ownershipComplete });
    if (ownershipComplete) await pruneSupersededCaches();
  }));
});
