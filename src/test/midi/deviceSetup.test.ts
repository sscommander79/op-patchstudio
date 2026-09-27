import { describe, expect, it, vi } from 'vitest';
import {
  DEVICE_SETUP_STORAGE_KEY,
  DeviceSetupStore,
  parseDeviceSetup,
  serializeDeviceSetup,
  type CustomDeviceSetup,
  type DeviceSetup,
} from '../../midi/deviceSetup';
import { createCcSlots } from '../../midi/ccProfile';

const validNinaSetup: DeviceSetup = {
  schemaVersion: 1,
  profileId: 'melbourne-instruments-nina',
  profileVersion: 1,
  id: 'studio-nina',
  name: 'Studio NINA',
  outputHint: { id: 'old-id', name: 'NINA MIDI' },
  channel: 2,
  desired: {
    'patch-volume': 100,
    resonance: 32,
    cutoff: 64,
    drive: 12,
  },
  createdAt: '2026-09-21T18:30:00.000Z',
  updatedAt: '2026-09-21T18:45:00.000Z',
};

type SetupStorage = Pick<Storage, 'getItem' | 'setItem'>;

const memoryStorageWith = (setups?: readonly DeviceSetup[]) => {
  const values = new Map<string, string>();
  if (setups) values.set(DEVICE_SETUP_STORAGE_KEY, JSON.stringify(setups));

  const storage: SetupStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };

  return { storage, values };
};

describe('device setup parsing', () => {
  it('round-trips a v2 generic eight-slot setup while preserving v1 NINA imports', () => {
    const slots = createCcSlots('custom-cc');
    slots[0] = { ...slots[0], enabled: true, label: 'Brightness', controller: 74, value: 81 };
    const generic: CustomDeviceSetup = {
      schemaVersion: 2,
      profileId: 'custom-cc',
      id: 'custom-one',
      name: 'Stage synth',
      deviceName: 'Any CC synth',
      channel: 3,
      slots,
      createdAt: '2026-09-21T18:30:00.000Z',
      updatedAt: '2026-09-21T18:45:00.000Z',
    };
    expect(parseDeviceSetup(serializeDeviceSetup(generic))).toEqual(generic);
    expect(parseDeviceSetup(JSON.stringify(validNinaSetup))).toEqual(validNinaSetup);
    expect(() => parseDeviceSetup(JSON.stringify({ ...generic, slots: slots.slice(0, 7) }))).toThrow(/eight/i);
  });
  it('accepts only the exact v1 NINA computer-side setup shape', () => {
    const setup = parseDeviceSetup(JSON.stringify(validNinaSetup));

    expect(setup).toEqual(validNinaSetup);
    expect(setup.outputHint).toEqual({ id: 'old-id', name: 'NINA MIDI' });
    if (setup.schemaVersion !== 1) throw new Error('Expected a legacy NINA setup.');
    expect(setup.desired.cutoff).toBe(64);
  });

  it('round trips through a stable canonical export', () => {
    const reordered = {
      updatedAt: validNinaSetup.updatedAt,
      desired: validNinaSetup.desired,
      channel: validNinaSetup.channel,
      outputHint: validNinaSetup.outputHint,
      name: validNinaSetup.name,
      id: validNinaSetup.id,
      profileVersion: validNinaSetup.profileVersion,
      profileId: validNinaSetup.profileId,
      schemaVersion: validNinaSetup.schemaVersion,
      createdAt: validNinaSetup.createdAt,
    } satisfies DeviceSetup;

    const first = serializeDeviceSetup(reordered);
    const second = serializeDeviceSetup(parseDeviceSetup(first));

    expect(second).toBe(first);
    expect(parseDeviceSetup(second)).toEqual(validNinaSetup);
  });

  it.each([
    ['malformed JSON', '{'],
    ['non-object JSON', '[]'],
    ['forward schema version', JSON.stringify({ ...validNinaSetup, schemaVersion: 2 })],
    ['wrong profile', JSON.stringify({ ...validNinaSetup, profileId: 'another-device' })],
    ['wrong profile version', JSON.stringify({ ...validNinaSetup, profileVersion: 2 })],
    ['missing field', JSON.stringify((({ updatedAt: _omitted, ...setup }) => setup)(validNinaSetup))],
    ['unknown top-level field', JSON.stringify({ ...validNinaSetup, extra: 'not allowed' })],
    ['invalid channel', JSON.stringify({ ...validNinaSetup, channel: 17 })],
    ['fractional channel', JSON.stringify({ ...validNinaSetup, channel: 1.5 })],
    ['blank setup name', JSON.stringify({ ...validNinaSetup, name: '   ' })],
    ['overlong setup name', JSON.stringify({ ...validNinaSetup, name: 'n'.repeat(101) })],
    ['invalid timestamp', JSON.stringify({ ...validNinaSetup, updatedAt: 'September 21, 2026' })],
    ['impossible timestamp', JSON.stringify({ ...validNinaSetup, updatedAt: '2026-02-30T10:00:00Z' })],
    ['missing desired key', JSON.stringify({
      ...validNinaSetup,
      desired: { 'patch-volume': 100, resonance: 32, cutoff: 64 },
    })],
    ['unknown desired key', JSON.stringify({
      ...validNinaSetup,
      desired: { ...validNinaSetup.desired, brightness: 64 },
    })],
    ['out-of-range desired value', JSON.stringify({
      ...validNinaSetup,
      desired: { ...validNinaSetup.desired, cutoff: 128 },
    })],
    ['fractional desired value', JSON.stringify({
      ...validNinaSetup,
      desired: { ...validNinaSetup.desired, drive: 12.5 },
    })],
    ['unknown output hint field', JSON.stringify({
      ...validNinaSetup,
      outputHint: { ...validNinaSetup.outputHint, state: 'connected' },
    })],
    ['wrong output hint field type', JSON.stringify({
      ...validNinaSetup,
      outputHint: { name: 42 },
    })],
  ])('rejects %s', (_label, json) => {
    expect(() => parseDeviceSetup(json)).toThrow();
  });

  it('validates runtime values before serialization', () => {
    const invalid = {
      ...validNinaSetup,
      desired: { ...validNinaSetup.desired, cutoff: -1 },
    } as DeviceSetup;

    expect(() => serializeDeviceSetup(invalid)).toThrow(/cutoff/i);
  });
});

describe('device setup storage', () => {
  it('uses only the dedicated setup key and persists validated setups', () => {
    const { storage, values } = memoryStorageWith();
    const store = new DeviceSetupStore(storage);

    expect(store.load()).toEqual([]);
    store.save([validNinaSetup]);
    expect(store.load()).toEqual([validNinaSetup]);

    expect(storage.getItem).toHaveBeenCalledWith('op-patchstudio.devices.setups.v1');
    expect(storage.setItem).toHaveBeenCalledWith(
      'op-patchstudio.devices.setups.v1',
      expect.any(String),
    );
    expect([...values.keys()]).toEqual(['op-patchstudio.devices.setups.v1']);
  });

  it('rejects an invalid save before making any storage call', () => {
    const { storage } = memoryStorageWith([validNinaSetup]);
    const store = new DeviceSetupStore(storage);
    const invalid = { ...validNinaSetup, channel: 0 } as DeviceSetup;

    expect(() => store.save([validNinaSetup, invalid])).toThrow(/channel/i);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.load()).toEqual([validNinaSetup]);
  });

  it('rejects a sparse setup array before replacing valid storage', () => {
    const { storage, values } = memoryStorageWith([validNinaSetup]);
    const store = new DeviceSetupStore(storage);
    const storedBeforeSave = values.get(DEVICE_SETUP_STORAGE_KEY);

    expect(() => store.save(new Array(1) as DeviceSetup[])).toThrow(/setup/i);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values.get(DEVICE_SETUP_STORAGE_KEY)).toBe(storedBeforeSave);
    expect(store.load()).toEqual([validNinaSetup]);
  });

  it('rejects a failed import before replacing active or stored setups', () => {
    const { storage } = memoryStorageWith([validNinaSetup]);
    const store = new DeviceSetupStore(storage);
    let activeSetup: ReturnType<typeof parseDeviceSetup> = validNinaSetup;
    const imported = {
      ...validNinaSetup,
      id: 'imported',
      desired: { ...validNinaSetup.desired, cutoff: 128 },
    };

    const importSetup = (json: string) => {
      const parsed = parseDeviceSetup(json);
      activeSetup = parsed;
      store.save([parsed]);
    };

    expect(() => importSetup(JSON.stringify(imported))).toThrow(/cutoff/i);
    expect(activeSetup).toBe(validNinaSetup);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.load()).toEqual([validNinaSetup]);
  });

  it('rejects invalid stored array data without attempting a replacement write', () => {
    const { storage, values } = memoryStorageWith();
    values.set(DEVICE_SETUP_STORAGE_KEY, JSON.stringify([
      validNinaSetup,
      { ...validNinaSetup, desired: { ...validNinaSetup.desired, unexpected: 1 } },
    ]));

    expect(() => new DeviceSetupStore(storage).load()).toThrow(/desired/i);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('propagates storage access exceptions', () => {
    const readError = new Error('read denied');
    const writeError = new Error('write denied');
    const readFailure: SetupStorage = {
      getItem: vi.fn(() => { throw readError; }),
      setItem: vi.fn(),
    };
    const writeFailure: SetupStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw writeError; }),
    };

    expect(() => new DeviceSetupStore(readFailure).load()).toThrow(readError);
    expect(() => new DeviceSetupStore(writeFailure).save([validNinaSetup])).toThrow(writeError);
  });
});
