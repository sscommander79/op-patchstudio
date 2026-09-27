import { describe, expect, it } from 'vitest';
import { RouteLeaseRegistry } from '../../midi/routeLease';

describe('RouteLeaseRegistry', () => {
  it('allows one owner and makes release idempotent', () => {
    const routes = new RouteLeaseRegistry();
    const lease = routes.acquire('nina-usb', 'devices');

    expect(lease?.owner).toBe('devices');
    expect(routes.acquire('nina-usb', 'autosampling')).toBeUndefined();

    lease?.release();
    lease?.release();

    expect(routes.acquire('nina-usb', 'autosampling')?.owner).toBe('autosampling');
  });

  it('does not release a newer owner through a stale lease', () => {
    const routes = new RouteLeaseRegistry();
    const first = routes.acquire('nina-usb', 'devices')!;

    first.release();
    const second = routes.acquire('nina-usb', 'stem-capture')!;
    first.release();

    expect(routes.current('nina-usb')).toBe('stem-capture');

    second.release();
  });

  it('notifies subscribers when route ownership changes and stops after unsubscribe', () => {
    const routes = new RouteLeaseRegistry();
    const changes: Array<{ outputId: string; owner: string | undefined }> = [];
    const unsubscribe = routes.subscribe((outputId, owner) => changes.push({ outputId, owner }));

    const lease = routes.acquire('nina-usb', 'autosampling');
    lease?.release();
    unsubscribe();
    routes.acquire('nina-usb', 'stem-capture');

    expect(changes).toEqual([
      { outputId: 'nina-usb', owner: 'autosampling' },
      { outputId: 'nina-usb', owner: undefined },
    ]);
  });
});
