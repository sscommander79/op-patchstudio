import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';

// Reproduces the preview mismatch: an old OP-PatchStudio production worker installed at /sw.js on a loopback
// origin keeps serving its cached shell after the dev server takes over the same origin. The legacy shell and
// worker are an immutable fixture (tests/dev-origin/fixtures/legacy-shell) that predates the build-identity
// guard, so recovery here cannot depend on any code in the current page.
//
// Determinism: Chromium schedules the navigation-triggered service worker update check itself, with its own
// delay. The test starts that same Update job directly through the DevTools protocol
// (ServiceWorker.updateRegistration), which fetches /sw.js from the network exactly as the browser's own check
// does, and then waits for its observable result. No reload-until-pass loop is used.

const port = 5197;
const origin = `http://127.0.0.1:${port}`;
const fixtureRoot = path.resolve('tests/dev-origin/fixtures/legacy-shell');
const vite = path.resolve('node_modules/.bin/vite');
let devServer: ChildProcess | null = null;
let legacyServer: Server | null = null;

const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

// Static host for the legacy production build: files, the old manifest, and SPA fallback to index.html.
async function startLegacyServer() {
  legacyServer = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', origin).pathname;
    if (pathname === '/manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ name: 'OP-PatchStudio [unofficial]', version: '0.15.6' }));
      return;
    }
    const file = pathname === '/' ? '/index.html' : pathname;
    try {
      const body = await readFile(path.join(fixtureRoot, path.normalize(file)));
      // Vite preview sends `Vary: Origin` on assets; module requests carry an Origin header, so a cache lookup
      // with the module Request only matches when Vary is ignored.
      response.writeHead(200, { 'content-type': contentTypes[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache', vary: 'Origin', 'access-control-allow-origin': origin });
      response.end(body);
    } catch {
      response.writeHead(200, { 'content-type': contentTypes['.html'] });
      response.end(await readFile(path.join(fixtureRoot, 'index.html')));
    }
  });
  await new Promise<void>(resolve => legacyServer!.listen(port, '127.0.0.1', () => resolve()));
}

async function stopLegacyServer() {
  const server = legacyServer;
  legacyServer = null;
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}

async function startDevServer(env: Record<string, string>) {
  devServer = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env: { ...process.env, ...env }, stdio: 'ignore' });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${origin}/__opstudio/build.json`)).ok) return; } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('dev server did not start');
}

async function stopDevServer() {
  const child = devServer;
  devServer = null;
  if (!child || child.exitCode !== null) return;
  await new Promise<void>(resolve => { child.once('exit', () => resolve()); child.kill('SIGTERM'); });
}

const registrations = (page: Page) => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(registration => registration.active?.scriptURL ?? null));

async function expectLegacyShell(page: Page, version: string) {
  await expect(page.locator('html')).toHaveAttribute('data-legacy-shell', 'sidebar-era');
  await expect(page.locator('.studio-shell-sidebar')).toHaveCount(1);
  await expect(page.locator('#legacy-version')).toHaveText(version);
}

// Runs the browser's service worker Update job for the root scope and reports whether it failed.
async function runBrowserUpdateCheck(cdp: CDPSession) {
  try {
    await cdp.send('ServiceWorker.updateRegistration', { scopeURL: `${origin}/` });
    return 'started';
  } catch (error) {
    return `rejected: ${(error as Error).message}`;
  }
}

test.afterAll(async () => {
  await stopDevServer();
  await stopLegacyServer();
});

test('the dev server retires a legacy OP-PatchStudio worker without reloading tabs or clearing project data', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('ServiceWorker.enable');

  // 0. Real project data: save the Studio Seed kit to the library through the current app.
  await startDevServer({});
  await page.goto(`${origin}/#/studio/drum`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load demo kit', exact: true }).click({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
  await page.locator('details.studio-project-menu summary').click();
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved Studio Seed to the library.')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('opstudio-dev-origin-probe', 'kept'));
  expect(await registrations(page)).toEqual([]);
  await stopDevServer();

  // 1. The legacy production shell installs its worker; after a reload the worker controls the tab.
  await startLegacyServer();
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectLegacyShell(page, 'v0.15.6');
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${origin}/sw.js`);
  await stopLegacyServer();

  // 2. Reproduction without the guard: the dev server answers /sw.js with its HTML fallback, so the
  //    browser's update check fails and every reload keeps the cached legacy shell (showing v0.0.0 because
  //    /manifest.json is now the dev server's HTML).
  await startDevServer({ OPSTUDIO_DEV_SW_GUARD: '0' });
  const unguarded = await fetch(`${origin}/sw.js`);
  expect(unguarded.headers.get('content-type')).toContain('text/html');
  for (let reload = 0; reload < 2; reload += 1) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectLegacyShell(page, 'v0.0.0');
  }
  await runBrowserUpdateCheck(cdp);
  await page.waitForTimeout(1_000);
  expect(await registrations(page)).toEqual([`${origin}/sw.js`]);
  await stopDevServer();

  // 3. With the guard: the same update check installs the retiring worker, which activates and unregisters.
  await startDevServer({});
  const guarded = await fetch(`${origin}/sw.js`);
  expect(guarded.headers.get('content-type')).toContain('text/javascript');
  await page.evaluate(() => { (window as Window & { legacyTabMarker?: string }).legacyTabMarker = 'same-tab'; });
  expect(await runBrowserUpdateCheck(cdp)).toBe('started');
  await expect.poll(() => registrations(page), { timeout: 15_000 }).toEqual([]);

  // The open legacy tab was not reloaded. It is now controlled by the retiring worker, which still serves
  // the tab's precached chunks, so a late module import loads instead of receiving the dev server's HTML
  // (the cause of the blank loads seen while diagnosing: a Vary-sensitive cache miss fell through to Vite).
  expect(await page.evaluate(() => (window as Window & { legacyTabMarker?: string }).legacyTabMarker)).toBe('same-tab');
  await expectLegacyShell(page, 'v0.0.0');
  const lateChunk = await page.evaluate(async () => {
    try {
      const module = await import('/assets/legacy-late-7f3a.js') as { legacyLateChunk: string };
      return module.legacyLateChunk;
    } catch (error) {
      return `import failed: ${(error as Error).message}`;
    }
  });
  expect(lateChunk).toBe('legacy-late-chunk');

  // 4. The next load reaches the dev server: current build, no worker, and all project data intact.
  // (A hash-only goto would stay in the same document, so set the route and reload explicitly.)
  await page.evaluate(() => { window.location.hash = '#/studio/library'; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-opstudio-mode', 'development', { timeout: 30_000 });
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(false);
  const served = await (await fetch(`${origin}/__opstudio/build.json`)).json() as { buildId: string };
  await expect(page.locator('html')).toHaveAttribute('data-opstudio-build', served.buildId);
  await expect(page.getByRole('main').getByText('Studio Seed', { exact: true }).first()).toBeVisible();
  const storage = await page.evaluate(async () => ({
    local: localStorage.getItem('opstudio-dev-origin-probe'),
    legacyPrecache: (await caches.keys()).includes('op-patchstudio-legacy-fixture-precache-v1'),
  }));
  expect(storage).toEqual({ local: 'kept', legacyPrecache: true });
  await stopDevServer();
});
