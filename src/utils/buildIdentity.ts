export type BuildMode = 'development' | 'production';

export interface BuildIdentity {
  version: string;
  buildId: string;
  mode: BuildMode;
}

export const currentBuild: BuildIdentity = {
  version: __APP_VERSION__,
  buildId: __APP_BUILD_ID__,
  mode: import.meta.env.DEV ? 'development' : 'production',
};

// Served only by the development server (scripts/dev-stale-worker-guard.ts).
export const DEV_BUILD_ENDPOINT = '/__opstudio/build.json';

export const shortBuildId = (buildId: string) => buildId.slice(-8);

export function markDocumentBuild(root: HTMLElement = document.documentElement, build: BuildIdentity = currentBuild) {
  root.dataset.opstudioVersion = build.version;
  root.dataset.opstudioBuild = build.buildId;
  root.dataset.opstudioMode = build.mode;
}

export const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';

export type ServedBuildCheck =
  | { status: 'current' }
  | { status: 'different'; served: BuildIdentity }
  | { status: 'unavailable' };

const isServedBuild = (value: unknown): value is BuildIdentity => {
  const candidate = value as Partial<BuildIdentity> | null;
  return typeof candidate?.buildId === 'string' && typeof candidate.version === 'string'
    && (candidate.mode === 'development' || candidate.mode === 'production');
};

// Compares the build running in this tab with the build the local server is serving now. Only loopback
// origins are checked; production hosts have no endpoint, so any failure is reported as unavailable.
export async function checkServedBuild({
  fetchImpl = fetch,
  hostname = window.location.hostname,
  build = currentBuild,
}: { fetchImpl?: typeof fetch; hostname?: string; build?: BuildIdentity } = {}): Promise<ServedBuildCheck> {
  if (!isLoopbackHost(hostname)) return { status: 'unavailable' };
  try {
    const response = await fetchImpl(DEV_BUILD_ENDPOINT, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return { status: 'unavailable' };
    const served: unknown = await response.json();
    if (!isServedBuild(served)) return { status: 'unavailable' };
    return served.buildId === build.buildId ? { status: 'current' } : { status: 'different', served };
  } catch {
    return { status: 'unavailable' };
  }
}
