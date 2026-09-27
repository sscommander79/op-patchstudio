import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { checkServedBuild, currentBuild, DEV_BUILD_ENDPOINT, isLoopbackHost, markDocumentBuild, type BuildIdentity } from '../../utils/buildIdentity';
import { DEV_BUILD_ENDPOINT as SERVER_ENDPOINT, handleDevIdentityRequest, isGuardedHost, RETIRING_WORKER_SOURCE } from '../../../scripts/dev-stale-worker-guard.ts';

const tab: BuildIdentity = { version: '0.16.0', buildId: 'tab-build-0001', mode: 'production' };
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

describe('build identity', () => {
  it('marks the document with the running version, build and mode', () => {
    const root = document.createElement('html');
    markDocumentBuild(root, tab);
    expect(root.dataset).toMatchObject({ opstudioVersion: '0.16.0', opstudioBuild: 'tab-build-0001', opstudioMode: 'production' });
    expect(currentBuild.buildId).toEqual(expect.any(String));
    expect(currentBuild.buildId.length).toBeGreaterThan(8);
  });

  it('shares the endpoint path with the development server', () => {
    expect(DEV_BUILD_ENDPOINT).toBe(SERVER_ENDPOINT);
  });

  it('only checks loopback origins', async () => {
    const fetchImpl = vi.fn();
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('op-patch.studio')).toBe(false);
    await expect(checkServedBuild({ fetchImpl, hostname: 'op-patch.studio', build: tab })).resolves.toEqual({ status: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports a different served build without treating it as current', async () => {
    const served = { version: '0.16.0', buildId: 'server-build-0002', mode: 'development' };
    const fetchImpl = vi.fn(async () => json(served));
    await expect(checkServedBuild({ fetchImpl, hostname: '127.0.0.1', build: tab })).resolves.toEqual({ status: 'different', served });
    expect(fetchImpl).toHaveBeenCalledWith(DEV_BUILD_ENDPOINT, expect.objectContaining({ cache: 'no-store' }));
  });

  it('reports a matching build as current', async () => {
    const fetchImpl = vi.fn(async () => json({ ...tab }));
    await expect(checkServedBuild({ fetchImpl, hostname: 'localhost', build: tab })).resolves.toEqual({ status: 'current' });
  });

  it.each([
    ['a missing endpoint', async () => new Response('not found', { status: 404 })],
    ['an HTML fallback page', async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })],
    ['malformed identity', async () => json({ buildId: 7 })],
    ['a network failure', async () => { throw new TypeError('offline'); }],
  ])('treats %s as unavailable rather than stale', async (_case, response) => {
    await expect(checkServedBuild({ fetchImpl: vi.fn(response) as unknown as typeof fetch, hostname: '127.0.0.1', build: tab })).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('development stale-worker guard', () => {
  const request = (url: string, host = '127.0.0.1:5191') => ({ url, headers: { host } }) as unknown as IncomingMessage;
  const response = () => {
    const headers: Record<string, string> = {};
    let body = '';
    const res = { setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; }, end: (chunk: string) => { body = chunk; } } as unknown as ServerResponse;
    return { res, headers, body: () => body };
  };

  it('serves the server build identity without caching', () => {
    const out = response(), next = vi.fn();
    handleDevIdentityRequest(request(`${SERVER_ENDPOINT}?t=1`), out.res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true });
    expect(next).not.toHaveBeenCalled();
    expect(out.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(out.body())).toEqual({ buildId: 'dev-1', version: '0.16.0', mode: 'development', retireWorkers: true });
  });

  it('answers /sw.js with a retiring worker that removes only its registration', () => {
    const out = response(), next = vi.fn();
    handleDevIdentityRequest(request('/sw.js'), out.res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true });
    expect(next).not.toHaveBeenCalled();
    expect(out.headers['content-type']).toMatch(/^text\/javascript/);
    expect(out.headers['cache-control']).toBe('no-store');
    expect(out.body()).toBe(RETIRING_WORKER_SOURCE);
    expect(RETIRING_WORKER_SOURCE).toContain('self.skipWaiting()');
    expect(RETIRING_WORKER_SOURCE).toContain('self.registration.unregister()');
    // Never destructive: caches are only read, never opened for writing, listed or deleted; no database
    // or storage access; no forced reload or navigation; navigations always go to the dev server.
    expect(RETIRING_WORKER_SOURCE).not.toMatch(/caches\.(delete|keys|open)|indexedDB|localStorage|\.navigate\(|reload/);
    expect(RETIRING_WORKER_SOURCE.match(/caches\.\w+/g)).toEqual(['caches.match']);
    expect(RETIRING_WORKER_SOURCE).toContain("event.request.mode === 'navigate'");
  });

  it.each(['127.0.0.1:5191', 'localhost:5191', '[::1]:5191', 'LOCALHOST'])('guards the loopback host %s', host => {
    expect(isGuardedHost(host)).toBe(true);
    const out = response(), next = vi.fn();
    handleDevIdentityRequest(request('/sw.js', host), out.res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true });
    expect(next).not.toHaveBeenCalled();
    expect(out.body()).toBe(RETIRING_WORKER_SOURCE);
  });

  it.each(['192.168.1.20:5191', 'studio.example:5191', 'localhost.evil.test', '127.0.0.1.nip.io', undefined])('leaves non-loopback host %s to Vite', host => {
    expect(isGuardedHost(host)).toBe(false);
    const next = vi.fn();
    handleDevIdentityRequest({ url: '/sw.js', headers: host ? { host } : {} } as unknown as IncomingMessage, response().res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true });
    handleDevIdentityRequest({ url: SERVER_ENDPOINT, headers: host ? { host } : {} } as unknown as IncomingMessage, response().res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true });
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('guards an explicitly configured non-loopback host only', () => {
    const out = response(), next = vi.fn();
    handleDevIdentityRequest(request('/sw.js', 'studio-mac.local:5191'), out.res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true, extraHosts: ['Studio-Mac.local'] });
    expect(out.body()).toBe(RETIRING_WORKER_SOURCE);
    handleDevIdentityRequest(request('/sw.js', 'other.local:5191'), response().res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true, extraHosts: ['studio-mac.local'] });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes /sw.js through when the guard is disabled, and ignores other paths', () => {
    const next = vi.fn();
    handleDevIdentityRequest(request('/sw.js'), response().res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: false });
    handleDevIdentityRequest(request('/src/main.tsx'), response().res, next, { buildId: 'dev-1', version: '0.16.0', retireWorkers: true });
    expect(next).toHaveBeenCalledTimes(2);
  });
});
