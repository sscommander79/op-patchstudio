import { describe, expect, it, vi } from 'vitest';
import { BrowserMidiSession, type BrowserMidiSessionState } from '../../midi/browserSession';
import { RouteLeaseRegistry } from '../../midi/routeLease';

type Listener = (event: Event) => void;

type FakePort = {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  state: MIDIPortDeviceState;
  connection: MIDIPortConnectionState;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  emitMessage(bytes: number[]): void;
  listenerCount(type: string): number;
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

const fakePort = (id: string, type: 'input' | 'output'): FakePort => {
  const listeners = new Map<string, Set<Listener>>();
  const port: FakePort = {
    id,
    name: id.toUpperCase(),
    manufacturer: 'Test Manufacturer',
    type,
    state: 'connected',
    connection: 'closed',
    open: vi.fn(async () => { port.connection = 'open'; return port as unknown as MIDIPort; }),
    close: vi.fn(async () => { port.connection = 'closed'; return port as unknown as MIDIPort; }),
    send: vi.fn(),
    addEventListener: vi.fn((eventType: string, listener: EventListenerOrEventListenerObject) => {
      const registered = listeners.get(eventType) ?? new Set<Listener>();
      registered.add(listener as Listener);
      listeners.set(eventType, registered);
    }),
    removeEventListener: vi.fn((eventType: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(eventType)?.delete(listener as Listener);
    }),
    emitMessage(bytes: number[]) {
      const event = { data: new Uint8Array(bytes), currentTarget: port, target: port } as unknown as Event;
      listeners.get('midimessage')?.forEach(listener => listener(event));
    },
    listenerCount(eventType: string) {
      return listeners.get(eventType)?.size ?? 0;
    },
  };
  return port;
};

const fakeAccess = (inputs: FakePort[], outputs: FakePort[]) => {
  const listeners = new Set<Listener>();
  return {
    inputs: new Map(inputs.map(port => [port.id, port as unknown as MIDIInput])),
    outputs: new Map(outputs.map(port => [port.id, port as unknown as MIDIOutput])),
    sysexEnabled: false,
    addEventListener: vi.fn((eventType: string, listener: EventListenerOrEventListenerObject) => {
      if (eventType === 'statechange') listeners.add(listener as Listener);
    }),
    removeEventListener: vi.fn((eventType: string, listener: EventListenerOrEventListenerObject) => {
      if (eventType === 'statechange') listeners.delete(listener as Listener);
    }),
    emitStateChange() {
      listeners.forEach(listener => listener(new Event('statechange')));
    },
    listenerCount() {
      return listeners.size;
    },
  };
};

describe('BrowserMidiSession', () => {
  it('requests non-SysEx access only after enable and targets one selected port', async () => {
    const outputA = fakePort('nina', 'output');
    const outputB = fakePort('other', 'output');
    const access = fakeAccess([], [outputA, outputB]);
    const request = vi.fn(async () => access as unknown as MIDIAccess);
    const session = new BrowserMidiSession({ requestAccess: request, routes: new RouteLeaseRegistry() });

    expect(request).not.toHaveBeenCalled();

    await session.enable();
    session.selectOutput('nina');
    const lowChannel = await session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' });
    const highChannel = await session.sendCc({ channel: 16, controller: 28, value: 127, label: 'Resonance' });

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith({ sysex: false });
    expect(lowChannel).toEqual({ ok: true, bytes: [0xB0, 29, 64] });
    expect(highChannel).toEqual({ ok: true, bytes: [0xBF, 28, 127] });
    expect(outputA.send).toHaveBeenNthCalledWith(1, [0xB0, 29, 64]);
    expect(outputA.send).toHaveBeenNthCalledWith(2, [0xBF, 28, 127]);
    expect(outputB.send).not.toHaveBeenCalled();
  });

  it('rejects missing, disconnected, leased, and invalid CC sends without output bytes', async () => {
    const output = fakePort('nina', 'output');
    const access = fakeAccess([], [output]);
    const routes = new RouteLeaseRegistry();
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes,
    });
    await session.enable();

    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a connected MIDI output.' });
    session.selectOutput('nina');

    await expect(session.sendCc({ channel: 0, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a MIDI channel from 1 to 16.' });
    await expect(session.sendCc({ channel: 17, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a MIDI channel from 1 to 16.' });
    await expect(session.sendCc({ channel: 1.5, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a MIDI channel from 1 to 16.' });
    await expect(session.sendCc({ channel: 1, controller: -1, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'MIDI CC values must be whole numbers from 0 to 127.' });
    await expect(session.sendCc({ channel: 1, controller: 29, value: 128, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'MIDI CC values must be whole numbers from 0 to 127.' });

    const lease = routes.acquire('nina', 'autosampling');
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'This MIDI output is busy with autosampling.' });
    lease?.release();

    output.state = 'disconnected';
    access.emitStateChange();
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a connected MIDI output.' });
    expect(output.send).not.toHaveBeenCalled();
  });

  it('cleans selected-input listeners and never relays received bytes', async () => {
    const inputA = fakePort('input-a', 'input');
    const inputB = fakePort('input-b', 'input');
    const output = fakePort('nina', 'output');
    const access = fakeAccess([inputA, inputB], [output]);
    const snapshots: BrowserMidiSessionState[] = [];
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    session.subscribe(snapshot => snapshots.push(snapshot));
    await session.enable();
    session.selectOutput('nina');

    session.selectInput('input-a');
    session.selectInput('input-b');
    inputA.emitMessage([0x90, 60, 100]);
    inputB.emitMessage([0xB0, 29, 64]);

    expect(inputA.listenerCount('midimessage')).toBe(0);
    expect(inputB.listenerCount('midimessage')).toBe(1);
    expect(snapshots.at(-1)?.monitor).toEqual([
      expect.objectContaining({ direction: 'incoming', portId: 'input-b', bytes: [0xB0, 29, 64] }),
    ]);
    expect(output.send).not.toHaveBeenCalled();
    expect(inputA.close).toHaveBeenCalledOnce();
  });

  it('tracks state changes, clears exact-ID stale selections, and bounds monitor history', async () => {
    const input = fakePort('input', 'input');
    const output = fakePort('nina', 'output');
    const access = fakeAccess([input], [output]);
    let latest: BrowserMidiSessionState | undefined;
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    session.subscribe(snapshot => { latest = snapshot; });
    await session.enable();
    session.selectInput('input');
    session.selectOutput('nina');

    for (let value = 0; value < 105; value += 1) input.emitMessage([0xB0, 29, value % 128]);
    expect(latest?.monitor).toHaveLength(100);
    expect(latest?.monitor[0]?.bytes).toEqual([0xB0, 29, 5]);

    access.inputs.delete('input');
    access.outputs.delete('nina');
    access.emitStateChange();

    expect(latest).toEqual(expect.objectContaining({ selectedInputId: undefined, selectedOutputId: undefined }));
    expect(input.listenerCount('midimessage')).toBe(0);
    expect(input.close).toHaveBeenCalled();
    expect(output.close).toHaveBeenCalled();
  });

  it('clears selection instead of silently adopting a replacement port object with the same ID', async () => {
    const oldInput = fakePort('input', 'input');
    const oldOutput = fakePort('nina', 'output');
    const newInput = fakePort('input', 'input');
    const newOutput = fakePort('nina', 'output');
    const access = fakeAccess([oldInput], [oldOutput]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    await session.enable();
    session.selectInput('input');
    session.selectOutput('nina');

    access.inputs.set('input', newInput as unknown as MIDIInput);
    access.outputs.set('nina', newOutput as unknown as MIDIOutput);
    access.emitStateChange();

    expect(oldInput.listenerCount('midimessage')).toBe(0);
    expect(oldInput.close).toHaveBeenCalledOnce();
    expect(oldOutput.close).toHaveBeenCalledOnce();
    expect(newInput.listenerCount('midimessage')).toBe(0);
    expect(newInput.open).not.toHaveBeenCalled();
    expect(newOutput.open).not.toHaveBeenCalled();
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a connected MIDI output.' });
    expect(newOutput.send).not.toHaveBeenCalled();

    await session.dispose();
    expect(newInput.listenerCount('midimessage')).toBe(0);
    expect(newInput.close).not.toHaveBeenCalled();
    expect(newOutput.close).not.toHaveBeenCalled();
  });

  it('clears and retires a retained disconnected output and requires explicit reselection after reconnect', async () => {
    const output = fakePort('nina', 'output');
    const access = fakeAccess([], [output]);
    let latest: BrowserMidiSessionState | undefined;
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    session.subscribe(state => { latest = state; });
    await session.enable();
    session.selectOutput('nina');

    output.state = 'disconnected';
    access.emitStateChange();
    expect(latest?.selectedOutputId).toBeUndefined();
    expect(output.close).toHaveBeenCalled();

    output.state = 'connected';
    access.emitStateChange();
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Choose a connected MIDI output.' });
    expect(output.send).not.toHaveBeenCalled();

    session.selectOutput('nina');
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 64] });
  });

  it('serializes sends and replaces an earlier queued value with the final unsent value', async () => {
    const opening = deferred();
    const output = fakePort('nina', 'output');
    output.open.mockImplementation(async () => {
      await opening.promise;
      output.connection = 'open';
      return output as unknown as MIDIPort;
    });
    const access = fakeAccess([], [output]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    await session.enable();
    session.selectOutput('nina');

    const first = session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' });
    const replaced = session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' });
    const final = session.sendCc({ channel: 1, controller: 29, value: 30, label: 'Cutoff' });
    await expect(replaced).resolves.toEqual({ ok: false, error: 'A newer MIDI value replaced this unsent value.' });

    opening.resolve();

    await expect(first).resolves.toEqual({ ok: true, bytes: [0xB0, 29, 10] });
    await expect(final).resolves.toEqual({ ok: true, bytes: [0xB0, 29, 30] });
    expect(output.send.mock.calls).toEqual([
      [[0xB0, 29, 10]],
      [[0xB0, 29, 30]],
    ]);
  });

  it('paces rapid sends and preserves the final queued value', async () => {
    let now = 0;
    const pendingPaces: Array<{ milliseconds: number; resolve: () => void }> = [];
    const pace = vi.fn((milliseconds: number) => new Promise<void>(resolve => {
      pendingPaces.push({ milliseconds, resolve });
    }));
    const output = fakePort('nina', 'output');
    const access = fakeAccess([], [output]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
      now: () => now,
      pace,
    });
    await session.enable();
    session.selectOutput('nina');

    await expect(session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 10] });
    const replaced = session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' });
    while (pendingPaces.length < 1) await Promise.resolve();
    const final = session.sendCc({ channel: 1, controller: 29, value: 30, label: 'Cutoff' });

    await expect(replaced).resolves.toEqual({ ok: false, error: 'A newer MIDI value replaced this unsent value.' });
    while (pendingPaces.length < 2) await Promise.resolve();
    expect(pendingPaces.map(item => item.milliseconds)).toEqual([25, 25]);
    expect(output.send).toHaveBeenCalledTimes(1);
    now = 25;
    pendingPaces[1]?.resolve();
    await expect(final).resolves.toEqual({ ok: true, bytes: [0xB0, 29, 30] });
    expect(output.send.mock.calls).toEqual([
      [[0xB0, 29, 10]],
      [[0xB0, 29, 30]],
    ]);
  });

  it('preserves a paced Cutoff final value when a Resonance gesture arrives before cadence', async () => {
    let now = 0;
    const pendingPaces: Array<{ milliseconds: number; resolve: () => void }> = [];
    const pace = vi.fn((milliseconds: number) => new Promise<void>(resolve => {
      pendingPaces.push({ milliseconds, resolve });
    }));
    const output = fakePort('nina', 'output');
    const access = fakeAccess([], [output]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
      now: () => now,
      pace,
    });
    await session.enable();
    session.selectOutput('nina');

    await expect(session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 10] });
    const cutoffFinal = session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' });
    while (pendingPaces.length < 1) await Promise.resolve();
    const resonanceFinal = session.sendCc({ channel: 1, controller: 28, value: 30, label: 'Resonance' });

    expect(pendingPaces.map(item => item.milliseconds)).toEqual([25]);
    expect(output.send).toHaveBeenCalledTimes(1);
    now = 25;
    pendingPaces[0]?.resolve();
    await expect(cutoffFinal).resolves.toEqual({ ok: true, bytes: [0xB0, 29, 20] });

    while (pendingPaces.length < 2) await Promise.resolve();
    expect(pendingPaces.map(item => item.milliseconds)).toEqual([25, 25]);
    expect(output.send).toHaveBeenCalledTimes(2);
    now = 50;
    pendingPaces[1]?.resolve();
    await expect(resonanceFinal).resolves.toEqual({ ok: true, bytes: [0xB0, 28, 30] });
    expect(output.send.mock.calls).toEqual([
      [[0xB0, 29, 10]],
      [[0xB0, 29, 20]],
      [[0xB0, 28, 30]],
    ]);
  });

  it('records structured successful, lease-rejected, and native-failed outgoing attempts', async () => {
    const output = fakePort('nina', 'output');
    const access = fakeAccess([], [output]);
    const routes = new RouteLeaseRegistry();
    let latest: BrowserMidiSessionState | undefined;
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes,
    });
    session.subscribe(state => { latest = state; });
    await session.enable();
    session.selectOutput('nina');

    await session.sendCc({ channel: 2, controller: 29, value: 64, label: 'Cutoff' });
    const lease = routes.acquire('nina', 'autosampling');
    await session.sendCc({ channel: 2, controller: 28, value: 32, label: 'Resonance' });
    lease?.release();
    output.send.mockImplementationOnce(() => { throw new Error('native failure'); });
    await session.sendCc({ channel: 2, controller: 30, value: 48, label: 'Drive' });

    expect(latest?.monitor).toEqual([
      expect.objectContaining({
        direction: 'outgoing', portId: 'nina', channel: 2, bytes: [0xB1, 29, 64],
        label: 'Cutoff', result: 'sent',
      }),
      expect.objectContaining({
        direction: 'outgoing', portId: 'nina', channel: 2, bytes: [0xB1, 28, 32],
        label: 'Resonance', result: 'failed', error: 'This MIDI output is busy with autosampling.',
      }),
      expect.objectContaining({
        direction: 'outgoing', portId: 'nina', channel: 2, bytes: [0xB1, 30, 48],
        label: 'Drive', result: 'failed', error: 'Unable to send MIDI CC to the selected output.',
      }),
    ]);
  });

  it('publishes selected-route lease ownership reactively and cancels queued work on takeover', async () => {
    const opening = deferred();
    const output = fakePort('nina', 'output');
    output.open.mockImplementation(async () => {
      await opening.promise;
      output.connection = 'open';
      return output as unknown as MIDIPort;
    });
    const access = fakeAccess([], [output]);
    const routes = new RouteLeaseRegistry();
    let latest: BrowserMidiSessionState | undefined;
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes,
    });
    session.subscribe(state => { latest = state; });
    await session.enable();
    session.selectOutput('nina');
    const active = session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' });
    const queued = session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' });

    const lease = routes.acquire('nina', 'stem-capture');
    expect(latest?.selectedOutputOwner).toBe('stem-capture');
    await expect(active).resolves.toEqual({ ok: false, error: 'This MIDI output is busy with stem capture.' });
    await expect(queued).resolves.toEqual({ ok: false, error: 'This MIDI output is busy with stem capture.' });
    expect(output.send).not.toHaveBeenCalled();

    lease?.release();
    expect(latest?.selectedOutputOwner).toBeUndefined();
    opening.resolve();
  });

  it('settles a throwing native send and isolates throwing observers so later sends still work', async () => {
    const output = fakePort('nina', 'output');
    output.send.mockImplementationOnce(() => { throw new Error('send failed'); });
    const access = fakeAccess([], [output]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    await session.enable();
    session.selectOutput('nina');

    await expect(session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'Unable to send MIDI CC to the selected output.' });

    let observerShouldThrow = false;
    session.subscribe(() => {
      if (observerShouldThrow) throw new Error('observer failed');
    });
    observerShouldThrow = true;

    await expect(session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 20] });
    await expect(session.sendCc({ channel: 1, controller: 29, value: 30, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 30] });
    expect(output.send.mock.calls).toEqual([
      [[0xB0, 29, 10]],
      [[0xB0, 29, 20]],
      [[0xB0, 29, 30]],
    ]);
  });

  it('snapshots validated queued data before caller-owned messages can mutate', async () => {
    const opening = deferred();
    const output = fakePort('nina', 'output');
    output.open.mockImplementation(async () => {
      await opening.promise;
      output.connection = 'open';
      return output as unknown as MIDIPort;
    });
    const access = fakeAccess([], [output]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    await session.enable();
    session.selectOutput('nina');
    const message = { channel: 1, controller: 29, value: 10, label: 'Cutoff' };

    const result = session.sendCc(message);
    message.channel = 17;
    message.controller = 200;
    message.value = 255;
    message.label = 'Mutated';
    opening.resolve();

    await expect(result).resolves.toEqual({ ok: true, bytes: [0xB0, 29, 10] });
    expect(output.send).toHaveBeenCalledWith([0xB0, 29, 10]);
  });

  it('settles active and queued sends on dispose and recloses ports after pending opens finish', async () => {
    const inputOpening = deferred();
    const outputOpening = deferred();
    const input = fakePort('input', 'input');
    const output = fakePort('nina', 'output');
    input.open.mockImplementation(async () => {
      await inputOpening.promise;
      input.connection = 'open';
      return input as unknown as MIDIPort;
    });
    output.open.mockImplementation(async () => {
      await outputOpening.promise;
      output.connection = 'open';
      return output as unknown as MIDIPort;
    });
    const access = fakeAccess([input], [output]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    await session.enable();
    session.selectInput('input');
    session.selectOutput('nina');
    const active = session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' });
    const queued = session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' });

    await session.dispose();

    await expect(active).resolves.toEqual({ ok: false, error: 'This MIDI session has been disposed.' });
    await expect(queued).resolves.toEqual({ ok: false, error: 'This MIDI session has been disposed.' });
    expect(input.listenerCount('midimessage')).toBe(0);
    expect(output.send).not.toHaveBeenCalled();

    inputOpening.resolve();
    outputOpening.resolve();
    await Promise.all([input.open.mock.results[0]?.value, output.open.mock.results[0]?.value]);
    await Promise.resolve();

    expect(input.connection).toBe('closed');
    expect(output.connection).toBe('closed');
    expect(input.close).toHaveBeenCalled();
    expect(output.close).toHaveBeenCalled();
    expect(output.send).not.toHaveBeenCalled();
  });

  it('settles a pending send and eventually closes the retired port when output selection changes', async () => {
    const opening = deferred();
    const outputA = fakePort('output-a', 'output');
    const outputB = fakePort('output-b', 'output');
    outputA.open.mockImplementation(async () => {
      await opening.promise;
      outputA.connection = 'open';
      return outputA as unknown as MIDIPort;
    });
    const access = fakeAccess([], [outputA, outputB]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    await session.enable();
    session.selectOutput('output-a');
    const retired = session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' });

    session.selectOutput('output-b');

    await expect(retired).resolves.toEqual({ ok: false, error: 'Choose a connected MIDI output.' });
    await expect(session.sendCc({ channel: 1, controller: 29, value: 20, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 20] });
    opening.resolve();
    await outputA.open.mock.results[0]?.value;
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();

    expect(outputA.connection).toBe('closed');
    expect(outputA.send).not.toHaveBeenCalled();
    expect(outputB.send).toHaveBeenCalledWith([0xB0, 29, 20]);
  });

  it('does not let retired A lifecycles close the same input and output objects after A to B to A reselection', async () => {
    const inputAOpen = deferred();
    const inputAClose = deferred();
    const outputAOpen = deferred();
    const outputAClose = deferred();
    const inputA = fakePort('input-a', 'input');
    const inputB = fakePort('input-b', 'input');
    const outputA = fakePort('output-a', 'output');
    const outputB = fakePort('output-b', 'output');
    inputA.open
      .mockImplementationOnce(async () => {
        await inputAOpen.promise;
        inputA.connection = 'open';
        return inputA as unknown as MIDIPort;
      })
      .mockImplementation(async () => {
        inputA.connection = 'open';
        return inputA as unknown as MIDIPort;
      });
    inputA.close
      .mockImplementationOnce(async () => {
        await inputAClose.promise;
        inputA.connection = 'closed';
        return inputA as unknown as MIDIPort;
      })
      .mockImplementation(async () => {
        inputA.connection = 'closed';
        return inputA as unknown as MIDIPort;
      });
    outputA.open
      .mockImplementationOnce(async () => {
        await outputAOpen.promise;
        outputA.connection = 'open';
        return outputA as unknown as MIDIPort;
      })
      .mockImplementation(async () => {
        outputA.connection = 'open';
        return outputA as unknown as MIDIPort;
      });
    outputA.close
      .mockImplementationOnce(async () => {
        await outputAClose.promise;
        outputA.connection = 'closed';
        return outputA as unknown as MIDIPort;
      })
      .mockImplementation(async () => {
        outputA.connection = 'closed';
        return outputA as unknown as MIDIPort;
      });
    const access = fakeAccess([inputA, inputB], [outputA, outputB]);
    let latest: BrowserMidiSessionState | undefined;
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    session.subscribe(snapshot => { latest = snapshot; });
    await session.enable();

    session.selectInput('input-a');
    session.selectOutput('output-a');
    session.selectInput('input-b');
    session.selectOutput('output-b');
    session.selectInput('input-a');
    session.selectOutput('output-a');

    inputAOpen.resolve();
    outputAOpen.resolve();
    inputAClose.resolve();
    outputAClose.resolve();
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();

    expect(latest).toEqual(expect.objectContaining({
      selectedInputId: 'input-a',
      selectedOutputId: 'output-a',
    }));
    expect(inputA.open).toHaveBeenCalledTimes(2);
    expect(outputA.open).toHaveBeenCalledTimes(2);
    expect(inputA.listenerCount('midimessage')).toBe(1);
    expect(inputA.connection).toBe('open');
    expect(outputA.connection).toBe('open');
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 64] });
    expect(outputA.send).toHaveBeenCalledWith([0xB0, 29, 64]);
  });

  it('releases access and port listeners and prevents sends after disposal', async () => {
    const input = fakePort('input', 'input');
    const output = fakePort('nina', 'output');
    const access = fakeAccess([input], [output]);
    const listener = vi.fn();
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    const unsubscribe = session.subscribe(listener);
    await session.enable();
    await session.enable();
    session.selectInput('input');
    session.selectOutput('nina');

    unsubscribe();
    const callsBeforeDispose = listener.mock.calls.length;
    await session.dispose();
    input.emitMessage([0x90, 60, 100]);

    expect(access.listenerCount()).toBe(0);
    expect(input.listenerCount('midimessage')).toBe(0);
    expect(input.close).toHaveBeenCalled();
    expect(output.close).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(callsBeforeDispose);
    await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }))
      .resolves.toEqual({ ok: false, error: 'This MIDI session has been disposed.' });
    expect(output.send).not.toHaveBeenCalled();
  });

  describe('caller cancellation before dispatch', () => {
    const ABORTED = { ok: false, error: 'This MIDI value was cancelled before it was sent.' };

    it('cancels a send blocked on port open and never dispatches it after open resolves', async () => {
      const opening = deferred();
      const output = fakePort('nina', 'output');
      output.open.mockImplementation(async () => {
        await opening.promise;
        output.connection = 'open';
        return output as unknown as MIDIPort;
      });
      const access = fakeAccess([], [output]);
      let latest: BrowserMidiSessionState | undefined;
      const session = new BrowserMidiSession({
        requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
        routes: new RouteLeaseRegistry(),
      });
      session.subscribe(state => { latest = state; });
      await session.enable();
      session.selectOutput('nina');
      const route = new AbortController();

      const pending = session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }, { signal: route.signal });
      route.abort();
      opening.resolve();

      await expect(pending).resolves.toEqual(ABORTED);
      await output.open.mock.results[0]?.value;
      for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
      expect(output.send).not.toHaveBeenCalled();
      expect(latest?.monitor.at(-1)).toMatchObject({ bytes: [0xB0, 29, 64], result: 'failed', error: ABORTED.error });
      await expect(session.sendCc({ channel: 1, controller: 29, value: 70, label: 'Cutoff' }))
        .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 70] });
      expect(output.send.mock.calls).toEqual([[[0xB0, 29, 70]]]);
    });

    it('cancels a send waiting for cadence and never dispatches it after the pace elapses', async () => {
      let now = 0;
      const pendingPaces: Array<() => void> = [];
      const output = fakePort('nina', 'output');
      const access = fakeAccess([], [output]);
      const session = new BrowserMidiSession({
        requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
        routes: new RouteLeaseRegistry(),
        now: () => now,
        pace: () => new Promise<void>(resolve => { pendingPaces.push(resolve); }),
      });
      await session.enable();
      session.selectOutput('nina');
      const route = new AbortController();

      await expect(session.sendCc({ channel: 1, controller: 7, value: 0, label: 'Patch Volume' }, { signal: route.signal }))
        .resolves.toEqual({ ok: true, bytes: [0xB0, 7, 0] });
      const paced = session.sendCc({ channel: 1, controller: 28, value: 0, label: 'Resonance' }, { signal: route.signal });
      while (pendingPaces.length < 1) await Promise.resolve();
      route.abort();
      now = 25;
      pendingPaces[0]?.();

      await expect(paced).resolves.toEqual(ABORTED);
      for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
      expect(output.send.mock.calls).toEqual([[[0xB0, 7, 0]]]);
    });

    it('removes an aborted queued send while an unrelated active send still dispatches', async () => {
      const opening = deferred();
      const output = fakePort('nina', 'output');
      output.open.mockImplementation(async () => {
        await opening.promise;
        output.connection = 'open';
        return output as unknown as MIDIPort;
      });
      const access = fakeAccess([], [output]);
      const session = new BrowserMidiSession({
        requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
        routes: new RouteLeaseRegistry(),
      });
      await session.enable();
      session.selectOutput('nina');
      const route = new AbortController();

      const active = session.sendCc({ channel: 1, controller: 29, value: 10, label: 'Cutoff' });
      const queued = session.sendCc({ channel: 1, controller: 28, value: 20, label: 'Resonance' }, { signal: route.signal });
      route.abort();
      await expect(queued).resolves.toEqual(ABORTED);
      opening.resolve();

      await expect(active).resolves.toEqual({ ok: true, bytes: [0xB0, 29, 10] });
      expect(output.send.mock.calls).toEqual([[[0xB0, 29, 10]]]);
    });

    it('rejects an already aborted signal without queuing or dispatching', async () => {
      const output = fakePort('nina', 'output');
      const access = fakeAccess([], [output]);
      const session = new BrowserMidiSession({
        requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
        routes: new RouteLeaseRegistry(),
      });
      await session.enable();
      session.selectOutput('nina');
      const route = new AbortController();
      route.abort();

      await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }, { signal: route.signal }))
        .resolves.toEqual(ABORTED);
      expect(output.send).not.toHaveBeenCalled();
    });

    it('cannot recall a value already handed to MIDIOutput.send when the abort arrives afterwards', async () => {
      const output = fakePort('nina', 'output');
      const access = fakeAccess([], [output]);
      const session = new BrowserMidiSession({
        requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
        routes: new RouteLeaseRegistry(),
      });
      await session.enable();
      session.selectOutput('nina');
      const route = new AbortController();
      output.send.mockImplementationOnce(() => { route.abort(); });

      await expect(session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' }, { signal: route.signal }))
        .resolves.toEqual({ ok: true, bytes: [0xB0, 29, 64] });
      expect(output.send).toHaveBeenCalledOnce();
    });
  });
});
