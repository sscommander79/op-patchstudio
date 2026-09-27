import { expect, test } from '@playwright/test';

type DevicesMidiEvidence = {
  requests: number;
  outputs: Record<string, number[][]>;
};

declare global {
  interface Window {
    __devicesMidiEvidence: () => DevicesMidiEvidence;
    __devicesDisconnectOutput: (id: string) => void;
    __devicesReleaseRouteLease?: () => void;
  }
}

test('Devices keeps setup actions silent, honors route locks, and rejects a stale selected output', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    class FakeMidiOutput extends EventTarget {
      readonly id: string;
      readonly name: string;
      readonly manufacturer = 'OP–PatchStudio test';
      readonly type = 'output';
      state: MIDIPortDeviceState = 'connected';
      connection: MIDIPortConnectionState = 'closed';
      onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => unknown) | null = null;
      readonly messages: number[][] = [];

      constructor(id: string, name: string) {
        super();
        this.id = id;
        this.name = name;
      }

      send(data: Uint8Array | number[]) {
        this.messages.push(Array.from(data));
      }

      clear() {}

      async open() {
        this.connection = 'open';
        return this as unknown as MIDIPort;
      }

      async close() {
        this.connection = 'closed';
        return this as unknown as MIDIPort;
      }
    }

    const primary = new FakeMidiOutput('nina-primary', 'NINA Test A');
    const secondary = new FakeMidiOutput('nina-secondary', 'NINA Test B');
    const ports = [primary, secondary];
    const access = Object.assign(new EventTarget(), {
      inputs: new Map<string, MIDIInput>(),
      outputs: new Map<string, MIDIOutput>(ports.map(output => [output.id, output as unknown as MIDIOutput])),
      sysexEnabled: false,
      onstatechange: null,
    });
    let requests = 0;

    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: async () => {
        requests += 1;
        return access;
      },
    });
    Object.defineProperty(window, '__devicesMidiEvidence', {
      value: () => ({
        requests,
        outputs: Object.fromEntries(ports.map(output => [output.id, output.messages.map(bytes => [...bytes])])),
      }),
    });
    Object.defineProperty(window, '__devicesDisconnectOutput', {
      value: (id: string) => {
        const output = ports.find(candidate => candidate.id === id);
        if (!output) throw new Error(`Unknown fake MIDI output: ${id}`);
        output.state = 'disconnected';
        access.outputs.delete(id);
        access.dispatchEvent(new Event('statechange'));
      },
    });
  });

  const evidence = () => page.evaluate(() => window.__devicesMidiEvidence());

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await evidence()).toEqual({
    requests: 0,
    outputs: { 'nina-primary': [], 'nina-secondary': [] },
  });

  await page.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable MIDI', exact: true })).toBeVisible();

  await page.getByLabel('Setup name').fill('Browser-silent setup');
  await page.getByRole('button', { name: 'Save setup', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose channel 1–16');
  await page.getByLabel('Import setup file').setInputFiles({
    name: 'imported-nina.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      profileId: 'melbourne-instruments-nina',
      profileVersion: 1,
      id: 'browser-import',
      name: 'Imported browser setup',
      channel: 16,
      desired: { 'patch-volume': 0, resonance: 0, cutoff: 64, drive: 0 },
      createdAt: '2026-09-21T12:00:00.000Z',
      updatedAt: '2026-09-21T12:00:00.000Z',
    })),
  });
  await expect(page.getByRole('option', { name: 'Imported browser setup' })).toBeAttached();
  expect(await evidence()).toEqual({
    requests: 0,
    outputs: { 'nina-primary': [], 'nina-secondary': [] },
  });

  await page.getByRole('button', { name: 'Enable MIDI', exact: true }).click();
  await expect(page.getByRole('button', { name: 'MIDI enabled', exact: true })).toBeDisabled();
  expect(await evidence()).toEqual({
    requests: 1,
    outputs: { 'nina-primary': [], 'nina-secondary': [] },
  });

  await page.getByLabel('MIDI output').selectOption('nina-primary');
  await page.getByLabel('MIDI channel').selectOption('16');
  await page.getByLabel('Cutoff desired value', { exact: true }).fill('73');
  await page.getByLabel('Setup name').fill('Selected route setup');
  await page.getByRole('button', { name: 'Save setup', exact: true }).click();
  await page.getByLabel('Cutoff desired value', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Load setup', exact: true }).click();
  await expect(page.getByLabel('Cutoff desired value', { exact: true })).toHaveValue('73');

  await page.getByLabel('Setup name').fill('Renamed selected route');
  await page.getByRole('button', { name: 'Rename setup', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Renamed selected route' })).toBeAttached();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export setup', exact: true }).click();
  const exportedSetup = await exported;
  expect(exportedSetup.suggestedFilename()).toBe('renamed-selected-route.json');

  await page.getByLabel('Import setup file').setInputFiles({
    name: 'selected-route-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      profileId: 'melbourne-instruments-nina',
      profileVersion: 1,
      id: 'selected-route-import',
      name: 'Selected route import',
      channel: 16,
      desired: { 'patch-volume': 91, resonance: 42, cutoff: 64, drive: 17 },
      createdAt: '2026-09-21T12:05:00.000Z',
      updatedAt: '2026-09-21T12:05:00.000Z',
    })),
  });
  await expect(page.getByRole('option', { name: 'Selected route import' })).toBeAttached();
  await page.getByRole('button', { name: 'Load setup', exact: true }).click();
  await expect(page.getByLabel('Cutoff desired value', { exact: true })).toHaveValue('64');
  await expect(page.getByLabel('MIDI channel')).toHaveValue('16');
  await page.getByRole('button', { name: 'Delete setup', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Selected route import' })).toHaveCount(0);
  await expect(page.getByLabel('MIDI output')).toHaveValue('nina-primary');
  await expect(page.getByRole('button', { name: 'Send Cutoff', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm MIDI route' }).click();
  await expect(page.getByRole('button', { name: 'Send Cutoff', exact: true })).toBeEnabled();
  expect(await evidence()).toEqual({
    requests: 1,
    outputs: { 'nina-primary': [], 'nina-secondary': [] },
  });

  if (process.env.PLAYWRIGHT_PRODUCTION !== '1') {
    const acquired = await page.evaluate(async () => {
      const modulePath = '/src/midi/routeLease.ts';
      const { midiRoutes } = await import(modulePath) as {
        midiRoutes: {
          acquire: (
            outputId: string,
            owner: 'autosampling',
          ) => { release: () => void } | undefined;
        };
      };
      const lease = midiRoutes.acquire('nina-primary', 'autosampling');
      if (!lease) return false;
      window.__devicesReleaseRouteLease = () => lease.release();
      return true;
    });
    expect(acquired).toBe(true);
    await expect(page.getByRole('button', { name: 'Send Cutoff', exact: true })).toBeDisabled();
    await expect(page.getByText(/Autosampling owns NINA Test A/)).toBeVisible();
    expect(await evidence()).toEqual({
      requests: 1,
      outputs: { 'nina-primary': [], 'nina-secondary': [] },
    });

    await page.evaluate(() => {
      window.__devicesReleaseRouteLease?.();
      delete window.__devicesReleaseRouteLease;
    });
    await expect(page.getByRole('button', { name: 'Send Cutoff', exact: true })).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Send Cutoff', exact: true }).click();
  await expect.poll(evidence).toEqual({
    requests: 1,
    outputs: { 'nina-primary': [[191, 29, 64]], 'nina-secondary': [] },
  });
  await expect(page.getByRole('list', { name: 'MIDI events' })).toContainText(
    'Outgoing · NINA Test A · Channel 16 · BF 1D 40 · Cutoff · sent',
  );

  await page.evaluate(() => window.__devicesDisconnectOutput('nina-primary'));
  await expect(page.getByLabel('MIDI output')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Send Cutoff', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('selected MIDI output is no longer available');
  expect(await evidence()).toEqual({
    requests: 1,
    outputs: { 'nina-primary': [[191, 29, 64]], 'nina-secondary': [] },
  });
});
