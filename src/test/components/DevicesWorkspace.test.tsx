import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicesWorkspace } from '../../components/devices/DevicesWorkspace';
import { StudioShell } from '../../components/common/StudioShell';
import { AppContextProvider, useAppContext } from '../../context/AppContext';
import {
  BrowserMidiSession,
  type BrowserMidiSessionState,
  type MidiMonitorEvent,
  type SendCc,
  type SendCcResult,
} from '../../midi/browserSession';
import { DeviceSetupStore, type DeviceSetup } from '../../midi/deviceSetup';
import { NINA_PROFILE } from '../../midi/ninaProfile';
import { RouteLeaseRegistry } from '../../midi/routeLease';

const connectedOutput = {
  id: 'nina-out',
  name: 'NINA USB',
  manufacturer: 'Melbourne Instruments',
  state: 'connected' as const,
};
const connectedInput = {
  id: 'nina-in',
  name: 'NINA USB Input',
  manufacturer: 'Melbourne Instruments',
  state: 'connected' as const,
};

const savedSetup = (overrides: Partial<DeviceSetup> = {}): DeviceSetup => ({
  schemaVersion: 1,
  profileId: NINA_PROFILE.id,
  profileVersion: 1,
  id: 'studio-nina',
  name: 'Studio NINA',
  outputHint: {
    id: connectedOutput.id,
    name: connectedOutput.name,
    manufacturer: connectedOutput.manufacturer,
  },
  channel: 3,
  desired: { 'patch-volume': 100, resonance: 40, cutoff: 70, drive: 20 },
  createdAt: '2026-09-21T12:00:00.000Z',
  updatedAt: '2026-09-21T12:00:00.000Z',
  ...overrides,
});

type Listener = (state: BrowserMidiSessionState) => void;

// Every workspace send is scoped to the confirmed route so revocation can cancel it before dispatch.
const routeSignal = { signal: expect.any(AbortSignal) };

function fakeSession(options: {
  enabled?: boolean;
  monitor?: MidiMonitorEvent[];
  sendResult?: SendCcResult;
  output?: typeof connectedOutput;
} = {}) {
  const sessionOutput = options.output ?? connectedOutput;
  let state: BrowserMidiSessionState = {
    enabled: options.enabled ?? false,
    inputs: options.enabled ? [connectedInput] : [],
    outputs: options.enabled ? [sessionOutput] : [],
    selectedInputId: undefined,
    selectedOutputId: undefined,
    selectedOutputOwner: undefined,
    monitor: options.monitor ?? [],
  };
  const listeners = new Set<Listener>();
  const publish = () => listeners.forEach(listener => listener({
    ...state,
    inputs: [...state.inputs],
    outputs: [...state.outputs],
    monitor: state.monitor.map(event => ({ ...event, bytes: [...event.bytes] })),
  }));
  const session = {
    enable: vi.fn(async () => {
      state = { ...state, enabled: true, inputs: [connectedInput], outputs: [sessionOutput] };
      publish();
    }),
    selectOutput: vi.fn((id: string | undefined) => {
      state = { ...state, selectedOutputId: state.outputs.some(port => port.id === id) ? id : undefined };
      publish();
    }),
    selectInput: vi.fn((id: string | undefined) => {
      state = { ...state, selectedInputId: state.inputs.some(port => port.id === id) ? id : undefined };
      publish();
    }),
    sendCc: vi.fn(async (message: SendCc): Promise<SendCcResult> => {
      const result = options.sendResult ?? {
        ok: true as const,
        bytes: [0xB0 | ((message.channel - 1) & 0x0F), message.controller, message.value] as [number, number, number],
      };
      if (result.ok) {
        state = {
          ...state,
          monitor: [...state.monitor, {
            direction: 'outgoing' as const,
            portId: sessionOutput.id,
            portName: sessionOutput.name,
            bytes: [...result.bytes],
            timestamp: Date.now(),
            label: message.label,
            channel: message.channel,
            result: 'sent' as const,
          }].slice(-100),
        };
        publish();
      }
      return result;
    }),
    subscribe: vi.fn((listener: Listener) => {
      listeners.add(listener);
      listener(state);
      return () => { listeners.delete(listener); };
    }),
    dispose: vi.fn(async () => undefined),
    disconnectOutput() {
      state = { ...state, outputs: [], selectedOutputId: undefined };
      publish();
    },
    disconnectOutputRetained() {
      state = {
        ...state,
        outputs: state.outputs.map(port => port.id === state.selectedOutputId
          ? { ...port, state: 'disconnected' as const }
          : port),
      };
      publish();
    },
  };
  return session;
}

function memoryStore(seed: DeviceSetup[] = []) {
  let setups = seed.map(setup => ({ ...setup, desired: { ...setup.desired } }));
  return {
    load: vi.fn(() => setups.map(setup => ({ ...setup, desired: { ...setup.desired } }))),
    save: vi.fn((next: readonly DeviceSetup[]) => {
      setups = next.map(setup => ({ ...setup, desired: { ...setup.desired } }));
    }),
    snapshot: () => setups,
  };
}

async function enableAndSelectOutput(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
  await user.selectOptions(screen.getByLabelText('MIDI output'), connectedOutput.id);
}

async function chooseChannelAndConfirm(
  user: ReturnType<typeof userEvent.setup>,
  channel: string,
) {
  await user.selectOptions(screen.getByLabelText('MIDI channel'), channel);
  await user.click(screen.getByRole('button', { name: 'Confirm MIDI route' }));
}

function CurrentEditorTab() {
  const { state } = useAppContext();
  return <output aria-label="Current editor tab">{state.currentTab}</output>;
}

type PortListener = (event: Event) => void;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function realOutput(
  id = connectedOutput.id,
  name = connectedOutput.name,
  openGate?: Promise<void>,
) {
  const listeners = new Map<string, Set<PortListener>>();
  const port = {
    id,
    name,
    manufacturer: connectedOutput.manufacturer,
    type: 'output' as const,
    state: 'connected' as MIDIPortDeviceState,
    connection: 'closed' as MIDIPortConnectionState,
    send: vi.fn(),
    open: vi.fn(async () => {
      await openGate;
      port.connection = 'open';
      return port as unknown as MIDIPort;
    }),
    close: vi.fn(async () => {
      port.connection = 'closed';
      return port as unknown as MIDIPort;
    }),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const registered = listeners.get(type) ?? new Set<PortListener>();
      registered.add(listener as PortListener);
      listeners.set(type, registered);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener as PortListener);
    }),
  };
  return port;
}

function realAccess(output: ReturnType<typeof realOutput> | Array<ReturnType<typeof realOutput>>) {
  const outputs = Array.isArray(output) ? output : [output];
  const listeners = new Set<PortListener>();
  return {
    inputs: new Map<string, MIDIInput>(),
    outputs: new Map(outputs.map(port => [port.id, port as unknown as MIDIOutput])),
    sysexEnabled: false,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'statechange') listeners.add(listener as PortListener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'statechange') listeners.delete(listener as PortListener);
    }),
    emitStateChange() {
      listeners.forEach(listener => listener(new Event('statechange')));
    },
  };
}

function storageDouble() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
}

describe('DevicesWorkspace', () => {
  beforeEach(() => {
    vi.mocked(URL.createObjectURL).mockClear();
    vi.mocked(URL.revokeObjectURL).mockClear();
  });

  it('maps a custom synth with eight editable slots and sends only enabled CCs on the chosen route', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const store = memoryStore();
    render(<DevicesWorkspace session={session} store={store} supported />);

    await user.selectOptions(screen.getByLabelText('Device profile'), 'custom-cc');
    expect(screen.getAllByRole('checkbox', { name: /Enable CC slot/ })).toHaveLength(8);
    await user.clear(screen.getByLabelText('Synth name'));
    await user.type(screen.getByLabelText('Synth name'), 'Stage synth');
    await user.type(screen.getByLabelText('CC slot 1 label'), 'Brightness');
    await user.type(screen.getByLabelText('CC slot 1 number'), '74');
    await user.click(screen.getByRole('checkbox', { name: 'Enable CC slot 1' }));
    expect(session.sendCc).not.toHaveBeenCalled();

    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '3');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    expect(screen.getByText('Brightness — Channel 3 · CC 74 · Value 64')).toBeInTheDocument();
    expect(session.sendCc).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));
    expect(session.sendCc).toHaveBeenCalledWith({ channel: 3, controller: 74, value: 64, label: 'Brightness' }, routeSignal);
  });

  it('does not send a custom CC while the enabled mapping contains duplicate controllers', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.selectOptions(screen.getByLabelText('Device profile'), 'custom-cc');
    await user.type(screen.getByLabelText('CC slot 1 label'), 'Filter A');
    await user.type(screen.getByLabelText('CC slot 1 number'), '74');
    await user.click(screen.getByRole('checkbox', { name: 'Enable CC slot 1' }));
    await user.type(screen.getByLabelText('CC slot 2 label'), 'Filter B');
    await user.type(screen.getByLabelText('CC slot 2 number'), '74');
    await user.click(screen.getByRole('checkbox', { name: 'Enable CC slot 2' }));
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '1');
    await user.click(screen.getByRole('button', { name: 'Send Filter A' }));
    expect(session.sendCc).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/duplicate/i);
  });

  it('does not request MIDI or send while entering, saving, importing, or loading a setup', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const store = memoryStore([savedSetup()]);
    render(<DevicesWorkspace session={session} store={store} supported />);

    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
    await user.click(screen.getByRole('button', { name: 'Load setup' }));
    await user.selectOptions(screen.getByLabelText('Saved setups'), '');
    await user.clear(screen.getByLabelText('Setup name'));
    await user.type(screen.getByLabelText('Setup name'), 'Desk NINA');
    await user.click(screen.getByRole('button', { name: 'Save setup' }));
    await user.upload(
      screen.getByLabelText('Import setup file'),
      new File([JSON.stringify(savedSetup({ id: 'imported', name: 'Imported NINA' }))], 'nina.json', { type: 'application/json' }),
    );

    expect(session.enable).not.toHaveBeenCalled();
    expect(session.sendCc).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalled();
  });

  it('requires route reconfirmation after loading a saved setup before any CC can be sent', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore([savedSetup()])} supported />);
    await enableAndSelectOutput(user);
    await user.selectOptions(screen.getByLabelText('MIDI channel'), '2');
    await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
    await user.click(screen.getByRole('button', { name: 'Load setup' }));
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Confirm MIDI route' }));
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeEnabled();
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('does not treat choosing an output and channel as route confirmation', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await user.selectOptions(screen.getByLabelText('MIDI channel'), '2');

    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    expect(screen.getByText('Choose or review output and channel before sending')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    expect(screen.queryByRole('button', { name: 'Confirm Apply' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm MIDI route' }));
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeEnabled();
    expect(screen.getByText('Route ready for deliberate sends')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('MIDI channel'), '3');
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('keeps slider gestures silent until the route is explicitly confirmed', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await user.selectOptions(screen.getByLabelText('MIDI channel'), '2');

    fireEvent.change(screen.getByLabelText('Cutoff desired value slider'), { target: { value: '75' } });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText('Cutoff desired value')).toHaveValue(75);
    expect(session.sendCc).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm MIDI route' }));
    fireEvent.change(screen.getByLabelText('Cutoff desired value slider'), { target: { value: '76' } });
    await waitFor(() => expect(session.sendCc).toHaveBeenCalledWith({
      channel: 2, controller: 29, value: 76, label: 'Cutoff',
    }, routeSignal));
  });

  it('does not claim a capture lease exists when no capture owns the route', async () => {
    const user = userEvent.setup();
    render(<DevicesWorkspace session={fakeSession()} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    expect(screen.queryByText(/owns its MIDI route/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lease is active/)).not.toBeInTheDocument();
  });

  it('requires an explicit channel and encodes explicit channel 1 and 16 choices', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);

    const send = screen.getByRole('button', { name: 'Send Cutoff' });
    expect(send).toBeDisabled();
    expect(session.sendCc).not.toHaveBeenCalled();

    await enableAndSelectOutput(user);
    expect(screen.getByLabelText('MIDI channel')).toHaveValue('');
    expect(send).toBeDisabled();

    await chooseChannelAndConfirm(user, '1');
    const cutoff = screen.getByLabelText('Cutoff desired value');
    await user.clear(cutoff);
    await user.type(cutoff, '64');
    await user.click(send);
    await chooseChannelAndConfirm(user, '16');
    await user.click(send);

    expect(session.sendCc).toHaveBeenNthCalledWith(1, { channel: 1, controller: 29, value: 64, label: 'Cutoff' }, routeSignal);
    expect(session.sendCc).toHaveBeenNthCalledWith(2, { channel: 16, controller: 29, value: 64, label: 'Cutoff' }, routeSignal);
  });

  it('sends slider user gestures but keeps setup loading and number-field edits silent', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore([savedSetup()])} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '2');

    fireEvent.change(screen.getByLabelText('Cutoff desired value slider'), { target: { value: '75' } });
    await waitFor(() => expect(session.sendCc).toHaveBeenCalledWith({
      channel: 2, controller: 29, value: 75, label: 'Cutoff',
    }, routeSignal));
    session.sendCc.mockClear();

    fireEvent.change(screen.getByLabelText('Cutoff desired value'), { target: { value: '76' } });
    await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
    await user.click(screen.getByRole('button', { name: 'Load setup' }));
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('resets the channel to unresolved when the user chooses a new output', async () => {
    const user = userEvent.setup();
    const first = connectedOutput;
    const second = { ...connectedOutput, id: 'nina-second', name: 'NINA USB 2' };
    const outputA = realOutput(first.id, first.name);
    const outputB = realOutput(second.id, second.name);
    const access = realAccess([outputA, outputB]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), first.id);
    await chooseChannelAndConfirm(user, '3');
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeEnabled();

    await user.selectOptions(screen.getByLabelText('MIDI output'), second.id);
    expect(screen.getByLabelText('MIDI channel')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
  });

  it('shows an unsupported-browser state without requesting MIDI', async () => {
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported={false} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Web MIDI is unavailable in this browser');
    expect(screen.getByRole('button', { name: 'Enable MIDI' })).toBeDisabled();
    expect(session.enable).not.toHaveBeenCalled();
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('clears a stale output selection and disables sends when the port disappears', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '1');
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeEnabled();

    act(() => session.disconnectOutput());

    expect(screen.getByLabelText('MIDI output')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('selected MIDI output is no longer available');
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('renders exact incoming and outgoing monitor content without relaying incoming bytes', () => {
    const monitor: MidiMonitorEvent[] = [
      {
        direction: 'outgoing',
        portId: connectedOutput.id,
        portName: connectedOutput.name,
        bytes: [0xB1, 29, 64],
        timestamp: 1,
        label: 'Cutoff',
        channel: 2,
        result: 'sent',
      },
      {
        direction: 'incoming',
        portId: connectedInput.id,
        portName: connectedInput.name,
        bytes: [0xB1, 28, 91],
        timestamp: 2,
      },
      {
        direction: 'outgoing',
        portId: connectedOutput.id,
        portName: connectedOutput.name,
        bytes: [0xB1, 30, 48],
        timestamp: 3,
        label: 'Drive',
        channel: 2,
        result: 'failed',
        error: 'Unable to send MIDI CC to the selected output.',
      },
    ];
    const session = fakeSession({ enabled: true, monitor });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);

    expect(screen.getByText('1970-01-01T00:00:00.001Z · Outgoing · NINA USB · Channel 2 · B1 1D 40 · Cutoff · sent')).toBeInTheDocument();
    expect(screen.getByText('1970-01-01T00:00:00.002Z · Incoming · NINA USB Input · B1 1C 5B · received')).toBeInTheDocument();
    expect(screen.getByText('1970-01-01T00:00:00.003Z · Outgoing · NINA USB · Channel 2 · B1 1E 30 · Drive · failed: Unable to send MIDI CC to the selected output.')).toBeInTheDocument();
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('preserves current values and saved setups after an invalid import', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore([savedSetup()])} supported />);
    const cutoff = screen.getByLabelText('Cutoff desired value');
    await user.clear(cutoff);
    await user.type(cutoff, '77');

    await user.upload(
      screen.getByLabelText('Import setup file'),
      new File(['{"profileId":"wrong"}'], 'broken.json', { type: 'application/json' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not import setup');
    expect(screen.getByLabelText('Cutoff desired value')).toHaveValue(77);
    expect(screen.getByRole('option', { name: 'Studio NINA' })).toBeInTheDocument();
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('merges a delayed valid import against a setup saved after reading began', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const store = memoryStore([savedSetup()]);
    const fileRead = deferred<string>();
    const imported = new File(['deferred'], 'delayed.json', { type: 'application/json' });
    Object.defineProperty(imported, 'text', { value: vi.fn(() => fileRead.promise) });
    render(<DevicesWorkspace session={session} store={store} supported />);

    await user.upload(screen.getByLabelText('Import setup file'), imported);
    await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
    await user.click(screen.getByRole('button', { name: 'Load setup' }));
    await user.selectOptions(screen.getByLabelText('Saved setups'), '');
    await user.clear(screen.getByLabelText('Setup name'));
    await user.type(screen.getByLabelText('Setup name'), 'Saved during import');
    await user.click(screen.getByRole('button', { name: 'Save setup' }));
    fileRead.resolve(JSON.stringify(savedSetup({ id: 'delayed-import', name: 'Delayed import' })));

    expect(await screen.findByRole('option', { name: 'Delayed import' })).toBeInTheDocument();
    expect(store.snapshot().map(setup => setup.name)).toEqual([
      'Studio NINA',
      'Saved during import',
      'Delayed import',
    ]);
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('retains both imports when concurrent file reads complete out of order', async () => {
    const user = userEvent.setup();
    const store = memoryStore([savedSetup()]);
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    const first = new File(['first'], 'first.json', { type: 'application/json' });
    const second = new File(['second'], 'second.json', { type: 'application/json' });
    Object.defineProperty(first, 'text', { value: vi.fn(() => firstRead.promise) });
    Object.defineProperty(second, 'text', { value: vi.fn(() => secondRead.promise) });
    render(<DevicesWorkspace session={fakeSession()} store={store} supported />);

    await user.upload(screen.getByLabelText('Import setup file'), first);
    await user.upload(screen.getByLabelText('Import setup file'), second);
    secondRead.resolve(JSON.stringify(savedSetup({ id: 'second', name: 'Second import' })));
    expect(await screen.findByRole('option', { name: 'Second import' })).toBeInTheDocument();
    firstRead.resolve(JSON.stringify(savedSetup({ id: 'first', name: 'First import' })));

    expect(await screen.findByRole('option', { name: 'First import' })).toBeInTheDocument();
    expect(store.snapshot().map(setup => setup.name)).toEqual(['Studio NINA', 'Second import', 'First import']);
  });

  it('omits blank optional output metadata when saving through the real setup store', async () => {
    const user = userEvent.setup();
    const output = { ...connectedOutput, id: 'metadata-empty', name: '', manufacturer: '' };
    const session = fakeSession({ output });
    const store = new DeviceSetupStore(storageDouble());
    render(<DevicesWorkspace session={session} store={store} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), output.id);
    await user.selectOptions(screen.getByLabelText('MIDI channel'), '1');
    await user.type(screen.getByLabelText('Setup name'), 'Metadata-safe setup');
    await user.click(screen.getByRole('button', { name: 'Save setup' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Setup saved locally');
    expect(store.load()).toEqual([
      expect.objectContaining({
        name: 'Metadata-safe setup',
        outputHint: { id: output.id },
      }),
    ]);
    expect(session.sendCc).not.toHaveBeenCalled();
  });

  it('reactively disables a leased route with its owner and re-enables it after release', async () => {
    const user = userEvent.setup();
    const output = realOutput();
    const access = realAccess(output);
    const routes = new RouteLeaseRegistry();
    const lease = routes.acquire(output.id, 'autosampling');
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes,
    });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), output.id);
    await user.selectOptions(screen.getByLabelText('MIDI channel'), '1');

    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm MIDI route' })).toBeDisabled();
    expect(screen.getByText(/Autosampling owns NINA USB/)).toBeInTheDocument();
    expect(output.send).not.toHaveBeenCalled();
    lease?.release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm MIDI route' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Confirm MIDI route' }));
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeEnabled();
    expect(output.send).not.toHaveBeenCalled();
  });

  it('invalidates Apply and hardware readiness when the selected output remains but disconnects', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '1');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    await user.click(screen.getByRole('checkbox', { name: /checked this synth’s MIDI input settings/ }));
    await user.click(screen.getByRole('button', { name: 'Send test' }));
    expect(await screen.findByRole('button', { name: 'Confirmed' })).toBeInTheDocument();

    act(() => session.disconnectOutputRetained());

    expect(screen.getByLabelText('MIDI output')).toHaveValue(connectedOutput.id);
    expect(screen.getByRole('button', { name: 'Send Cutoff' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send test' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Confirm Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmed' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('selected MIDI output is disconnected');
  });

  it('previews the exact four Apply messages and sends them sequentially only after confirmation', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    let releaseFirst!: (result: SendCcResult) => void;
    const first = new Promise<SendCcResult>(resolve => { releaseFirst = resolve; });
    session.sendCc.mockImplementationOnce(() => first);
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '2');

    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    expect(session.sendCc).not.toHaveBeenCalled();
    expect(screen.getByText('Patch Volume — Channel 2 · CC 7 · Value 0')).toBeInTheDocument();
    expect(screen.getByText('Resonance — Channel 2 · CC 28 · Value 0')).toBeInTheDocument();
    expect(screen.getByText('Cutoff — Channel 2 · CC 29 · Value 64')).toBeInTheDocument();
    expect(screen.getByText('Drive — Channel 2 · CC 30 · Value 0')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));
    expect(session.sendCc).toHaveBeenCalledTimes(1);
    releaseFirst({ ok: true, bytes: [0xB1, 7, 0] });
    await waitFor(() => expect(session.sendCc).toHaveBeenCalledTimes(4));
    expect(session.sendCc.mock.calls.map(([message]) => message)).toEqual([
      { channel: 2, controller: 7, value: 0, label: 'Patch Volume' },
      { channel: 2, controller: 28, value: 0, label: 'Resonance' },
      { channel: 2, controller: 29, value: 64, label: 'Cutoff' },
      { channel: 2, controller: 30, value: 0, label: 'Drive' },
    ]);
  });

  it('stops a pending multi-message Apply when the channel changes mid-send', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const first = deferred<SendCcResult>();
    session.sendCc.mockImplementationOnce(() => first.promise);
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '2');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));
    expect(session.sendCc).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText('MIDI channel'), '5');
    await act(async () => { first.resolve({ ok: true, bytes: [0xB1, 7, 0] }); });

    expect(await screen.findByRole('alert')).toHaveTextContent('Apply stopped');
    expect(session.sendCc).toHaveBeenCalledTimes(1);
    expect(session.sendCc.mock.calls.every(([message]) => message.channel === 2)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Confirm Apply' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('MIDI channel')).toHaveValue('5');
  });

  it('stops a pending multi-message Apply when a loaded setup changes the channel mid-send', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const first = deferred<SendCcResult>();
    session.sendCc.mockImplementationOnce(() => first.promise);
    render(<DevicesWorkspace session={session} store={memoryStore([savedSetup()])} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '2');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));
    expect(session.sendCc).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
    await user.click(screen.getByRole('button', { name: 'Load setup' }));
    await act(async () => { first.resolve({ ok: true, bytes: [0xB1, 7, 0] }); });

    expect(await screen.findByRole('alert')).toHaveTextContent('Apply stopped');
    expect(session.sendCc).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('MIDI channel')).toHaveValue('3');
  });

  it('invalidates a frozen Apply when an injected real session changes output externally', async () => {
    const user = userEvent.setup();
    const outputA = realOutput('nina-a', 'NINA A');
    const outputB = realOutput('nina-b', 'NINA B');
    const access = realAccess([outputA, outputB]);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), outputA.id);
    await chooseChannelAndConfirm(user, '1');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    expect(screen.getByText('Destination: NINA A')).toBeInTheDocument();

    act(() => session.selectOutput(outputB.id));

    expect(screen.queryByRole('button', { name: 'Confirm Apply' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('selected MIDI output changed');
    expect(outputA.send).not.toHaveBeenCalled();
    expect(outputB.send).not.toHaveBeenCalled();
  });

  it('selects a safe hardware-test control and value with Cutoff 64 as the default', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await enableAndSelectOutput(user);
    await chooseChannelAndConfirm(user, '1');

    const sendTest = screen.getByRole('button', { name: 'Send test' });
    expect(screen.getByText('Output: NINA USB · Channel: 1 · CC: 29 · Value: 64')).toBeInTheDocument();
    expect(sendTest).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Confirmed' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Hardware test control'), 'cc-2');
    await user.clear(screen.getByLabelText('Hardware test value'));
    await user.type(screen.getByLabelText('Hardware test value'), '91');
    expect(screen.getByText('Output: NINA USB · Channel: 1 · CC: 28 · Value: 91')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /checked this synth’s MIDI input settings/ }));
    await user.click(sendTest);

    expect(session.sendCc).toHaveBeenCalledWith({ channel: 1, controller: 28, value: 91, label: 'Resonance hardware test' }, routeSignal);
    expect(await screen.findByRole('button', { name: 'Confirmed' })).toBeInTheDocument();
    expect(screen.getByText('The app cannot verify panel movement automatically.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmed' }));
    expect(screen.getByText('Local observation: Confirmed')).toBeInTheDocument();
  });

  it('cancels an undispatched real-session hardware test when the channel changes before the port opens', async () => {
    const user = userEvent.setup();
    const opened = deferred<void>();
    const output = realOutput(connectedOutput.id, connectedOutput.name, opened.promise);
    const access = realAccess(output);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), output.id);
    await chooseChannelAndConfirm(user, '1');
    await user.click(screen.getByRole('checkbox', { name: /checked this synth’s MIDI input settings/ }));
    await user.click(screen.getByRole('button', { name: 'Send test' }));
    await user.selectOptions(screen.getByLabelText('MIDI channel'), '2');
    await act(async () => {
      opened.resolve();
      await output.open.mock.results[0]?.value;
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('cancelled before it was sent');
    expect(output.send).not.toHaveBeenCalled();
    expect(screen.getByLabelText('MIDI channel')).toHaveValue('2');
    expect(screen.queryByRole('button', { name: 'Confirmed' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Local observation:/)).not.toBeInTheDocument();
  });

  it.each([
    ['channel change', async (user: ReturnType<typeof userEvent.setup>) => {
      await user.selectOptions(screen.getByLabelText('MIDI channel'), '5');
      expect(screen.getByLabelText('MIDI channel')).toHaveValue('5');
    }],
    ['profile change', async (user: ReturnType<typeof userEvent.setup>) => {
      await user.selectOptions(screen.getByLabelText('Device profile'), 'custom-cc');
      expect(screen.getByLabelText('Device profile')).toHaveValue('custom-cc');
    }],
    ['setup load', async (user: ReturnType<typeof userEvent.setup>) => {
      await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
      await user.click(screen.getByRole('button', { name: 'Load setup' }));
      expect(screen.getByLabelText('MIDI channel')).toHaveValue('3');
    }],
  ])('cancels the undispatched first real-session Apply CC on %s while the port is opening', async (_name, revoke) => {
    const user = userEvent.setup();
    const opened = deferred<void>();
    const output = realOutput(connectedOutput.id, connectedOutput.name, opened.promise);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => realAccess(output) as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    render(<DevicesWorkspace session={session} store={memoryStore([savedSetup()])} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), output.id);
    await chooseChannelAndConfirm(user, '2');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));

    await revoke(user);
    await act(async () => {
      opened.resolve();
      await output.open.mock.results[0]?.value;
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Apply stopped');
    expect(output.send).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirm Apply' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm MIDI route' })).toBeEnabled();
  });

  it('cancels a real-session Apply CC waiting on send cadence when the channel changes', async () => {
    const user = userEvent.setup();
    const pendingPaces: Array<() => void> = [];
    const output = realOutput(connectedOutput.id, connectedOutput.name);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => realAccess(output) as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
      now: () => 0,
      pace: () => new Promise<void>(resolve => { pendingPaces.push(resolve); }),
    });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), output.id);
    await chooseChannelAndConfirm(user, '2');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));
    await waitFor(() => expect(pendingPaces).toHaveLength(1));
    expect(output.send.mock.calls).toEqual([[[0xB1, 7, 0]]]);

    await user.selectOptions(screen.getByLabelText('MIDI channel'), '5');
    await act(async () => { pendingPaces[0]?.(); });

    expect(await screen.findByRole('alert')).toHaveTextContent('Apply stopped');
    expect(output.send.mock.calls).toEqual([[[0xB1, 7, 0]]]);
    expect(pendingPaces).toHaveLength(1);
    expect(screen.getByLabelText('MIDI channel')).toHaveValue('5');
  });

  it('invalidates a prepared Apply and hardware receipt when a same-ID port object is replaced', async () => {
    const user = userEvent.setup();
    const output = realOutput('same-id', 'NINA Original');
    const replacement = realOutput('same-id', 'OTHER Replacement');
    const access = realAccess(output);
    const session = new BrowserMidiSession({
      requestAccess: vi.fn(async () => access as unknown as MIDIAccess),
      routes: new RouteLeaseRegistry(),
    });
    render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    await user.click(screen.getByRole('button', { name: 'Enable MIDI' }));
    await user.selectOptions(screen.getByLabelText('MIDI output'), output.id);
    await chooseChannelAndConfirm(user, '1');
    await user.click(screen.getByRole('button', { name: 'Preview Apply' }));
    await user.click(screen.getByRole('checkbox', { name: /checked this synth’s MIDI input settings/ }));
    await user.click(screen.getByRole('button', { name: 'Send test' }));
    expect(await screen.findByRole('button', { name: 'Confirmed' })).toBeInTheDocument();

    access.outputs.set(output.id, replacement as unknown as MIDIOutput);
    act(() => access.emitStateChange());

    expect(screen.getByLabelText('MIDI output')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Confirm Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmed' })).not.toBeInTheDocument();
    expect(replacement.send).not.toHaveBeenCalled();
  });

  it('keeps save, rename, delete, profile, and port changes byte-silent', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const store = memoryStore([savedSetup()]);
    render(<DevicesWorkspace session={session} store={store} supported />);
    await enableAndSelectOutput(user);
    await user.selectOptions(screen.getByLabelText('MIDI input (optional)'), connectedInput.id);
    await user.selectOptions(screen.getByLabelText('Device profile'), NINA_PROFILE.id);
    await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
    await user.click(screen.getByRole('button', { name: 'Load setup' }));
    const name = screen.getByLabelText('Setup name');
    await user.clear(name);
    await user.type(name, 'Renamed NINA');
    await user.click(screen.getByRole('button', { name: 'Rename setup' }));
    await user.click(screen.getByRole('button', { name: 'Delete setup' }));

    expect(session.selectOutput).toHaveBeenCalledWith(connectedOutput.id);
    expect(session.selectInput).toHaveBeenCalledWith(connectedInput.id);
    expect(session.sendCc).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenCalled();
  });

  it('creates a download only after explicit Export and never sends', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      render(<DevicesWorkspace session={session} store={memoryStore([savedSetup()])} supported />);
      await user.selectOptions(screen.getByLabelText('Saved setups'), 'studio-nina');
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Export setup' }));
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
      expect(session.sendCc).not.toHaveBeenCalled();
    } finally {
      click.mockRestore();
    }
  });

  it('unsubscribes and disposes the MIDI session after unmount', async () => {
    const session = fakeSession();
    const view = render(<DevicesWorkspace session={session} store={memoryStore()} supported />);
    const unsubscribe = session.subscribe.mock.results[0]?.value as ReturnType<typeof vi.fn> | undefined;
    view.unmount();

    await waitFor(() => expect(session.dispose).toHaveBeenCalledOnce());
    expect(unsubscribe).toBeDefined();
  });

  it('mounts from StudioShell outside MainTabs without changing the editor tab or requesting MIDI', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    render(
      <AppContextProvider>
        <CurrentEditorTab />
        <StudioShell devicesWorkspaceProps={{ session, store: memoryStore(), supported: true }} />
      </AppContextProvider>,
    );

    expect(screen.getByLabelText('Current editor tab')).toHaveTextContent('drum');
    await user.click(screen.getByRole('button', { name: 'Devices' }));
    expect(await screen.findByRole('heading', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'drum tool content' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current editor tab')).toHaveTextContent('drum');
    expect(session.enable).not.toHaveBeenCalled();
    expect(session.sendCc).not.toHaveBeenCalled();
  });
});
