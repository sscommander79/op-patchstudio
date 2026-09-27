import { readFile } from 'node:fs/promises'

const worker = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8')
const lifecyclePath = worker.match(/["'](assets\/pwa-cache-lifecycle-[^"']+\.js)["']/)?.[1]
if (!lifecyclePath) {
  throw new Error('Generated service worker does not import its build-owned cache lifecycle')
}
const lifecycle = await readFile(new URL(`../dist/${lifecyclePath}`, import.meta.url), 'utf8')
const buildId = lifecycle.match(/const BUILD_ID = '([^']+)'/)?.[1]
if (!buildId || !/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(buildId)) {
  throw new Error('Generated lifecycle does not contain a collision-resistant build identity')
}
if (!worker.includes(`op-patchstudio-${buildId}`)) {
  throw new Error('Worker cache identity and lifecycle ownership identity differ')
}
if (worker.includes('${pwaBuildId}')) {
  throw new Error('Generated worker contains an unresolved build-configuration closure')
}
if (!lifecycle.includes('OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT') ||
    !lifecycle.includes('OPSTUDIO_UPDATE_BLOCKED_OPEN_TABS') ||
    !lifecycle.includes('OPSTUDIO_CLAIM_WAITING')) {
  throw new Error('Generated lifecycle does not enforce waiting-worker ownership and the explicit sole-window update gate')
}
if (!lifecycle.includes('__OPSTUDIO_FETCH_ASSET__') ||
    !lifecycle.includes('own-precache-first fallback')) {
  throw new Error('Generated lifecycle does not retain the build-owned asset fallback delegate')
}
if (!lifecycle.includes('sameOwnership(ownership, latest)')) {
  throw new Error('Generated lifecycle does not recheck worker-owned cache metadata before deletion')
}
if (!lifecycle.includes('self.registration.installing') ||
    !lifecycle.includes('slots.active !== ownership.current') ||
    !lifecycle.includes('sameSlots(slots, latestSlots)') ||
    !lifecycle.includes('self.registration.active !== activeWorker') ||
    !lifecycle.includes('self.registration.waiting !== waitingWorker')) {
  throw new Error('Generated lifecycle does not validate active, waiting and installing worker slots before deletion')
}
const matches = [...worker.matchAll(/\{url:"([^"]+)",revision:(null|"[^"]+")\}/g)]

if (matches.length === 0) {
  throw new Error('No Workbox precache entries were found in dist/sw.js')
}

const entries = matches.map(([, url, revision]) => ({ url, revision }))
const duplicateUrls = entries
  .map(({ url }) => url)
  .filter((url, index, urls) => urls.indexOf(url) !== index)

if (duplicateUrls.length > 0) {
  throw new Error(`Duplicate precache URLs: ${[...new Set(duplicateUrls)].join(', ')}`)
}

const stablePublicAssets = entries.filter(({ url }) =>
  /^(?:assets\/(?:icon-|preview-image)|favicon)/.test(url),
)
const missingRevisions = stablePublicAssets.filter(({ revision }) => revision === 'null')

if (stablePublicAssets.length === 0) {
  throw new Error('Expected stable-named public icons or preview images in the precache')
}
if (missingRevisions.length > 0) {
  throw new Error(`Stable public assets lack content revisions: ${missingRevisions.map(({ url }) => url).join(', ')}`)
}

console.log(`Verified ${entries.length} unique precache URLs; ${stablePublicAssets.length} stable public assets have content revisions; lifecycle ${buildId} owns its cache identity.`)
