import { describe, expect, it, vi } from 'vitest';
import { getAppVersion } from '../../utils/version';

describe('getAppVersion', () => {
  it('returns the build version without requesting a removed manifest', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await getAppVersion()).toBe(__APP_VERSION__);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
