import { type RouteLeaseRegistry, type RouteOwner, midiRoutes } from './routeLease';

export type MidiPortSummary = {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
};

export type MidiMonitorEvent = {
  direction: 'incoming' | 'outgoing';
  portId: string;
  portName: string;
  bytes: number[];
  timestamp: number;
  label?: string;
  channel?: number;
  result?: 'received' | 'sent' | 'failed';
  error?: string;
};

export type SendCc = {
  channel: number;
  controller: number;
  value: number;
  label: string;
};

export type SendCcResult =
  | { ok: true; bytes: [number, number, number] }
  | { ok: false; error: string };

export type SendCcOptions = {
  // Aborting cancels the value only if it has not yet been handed to MIDIOutput.send().
  signal?: AbortSignal;
};

export type BrowserMidiSessionState = {
  enabled: boolean;
  inputs: MidiPortSummary[];
  outputs: MidiPortSummary[];
  selectedInputId: string | undefined;
  selectedOutputId: string | undefined;
  selectedOutputOwner: RouteOwner | undefined;
  monitor: MidiMonitorEvent[];
};

type RequestAccess = (options: { sysex: false }) => Promise<MIDIAccess>;
type SessionListener = (state: BrowserMidiSessionState) => void;
type Pace = (milliseconds: number) => Promise<void>;

type PortLifecycle<T extends MIDIPort> = {
  port: T;
  ready: Promise<void>;
  retired: boolean;
};

type QueuedSend = {
  bytes: [number, number, number];
  label: string;
  channel: number;
  output: PortLifecycle<MIDIOutput>;
  resolve: (result: SendCcResult) => void;
  cancelled: Promise<SendCcResult>;
  cancel: (result: SendCcResult) => void;
  cancelledWith: SendCcResult | undefined;
  releaseSignal: () => void;
  dispatched: boolean;
  settled: boolean;
  waitingForCadence: boolean;
};

const DISPOSED_ERROR: SendCcResult = { ok: false, error: 'This MIDI session has been disposed.' };
const ABORTED_ERROR: SendCcResult = { ok: false, error: 'This MIDI value was cancelled before it was sent.' };
const REPLACED_ERROR_MESSAGE = 'A newer MIDI value replaced this unsent value.';
const REPLACED_ERROR: SendCcResult = { ok: false, error: REPLACED_ERROR_MESSAGE };
const SEND_INTERVAL_MS = 25;

const ownerLabel = (owner: RouteOwner): string => owner === 'stem-capture' ? 'stem capture' : owner;
const busyResult = (owner: RouteOwner): SendCcResult => ({
  ok: false,
  error: `This MIDI output is busy with ${ownerLabel(owner)}.`,
});

const defaultRequestAccess: RequestAccess = options => {
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
    return Promise.reject(new Error('Web MIDI is unavailable in this browser.'));
  }
  return navigator.requestMIDIAccess(options);
};

const defaultPace: Pace = milliseconds => new Promise(resolve => {
  setTimeout(resolve, milliseconds);
});

const portSummary = (port: MIDIPort): MidiPortSummary => ({
  id: port.id,
  name: port.name ?? 'Unnamed MIDI port',
  manufacturer: port.manufacturer ?? 'Unknown manufacturer',
  state: port.state,
});

const openPort = async (port: MIDIPort): Promise<void> => {
  if (typeof port.open === 'function') await port.open();
};

const closePort = async (port: MIDIPort): Promise<void> => {
  if (typeof port.close === 'function') await port.close();
};

export class BrowserMidiSession {
  private readonly requestAccess: RequestAccess;
  private readonly routes: RouteLeaseRegistry;
  private readonly now: () => number;
  private readonly pace: Pace;
  private readonly listeners = new Set<SessionListener>();
  private readonly monitor: MidiMonitorEvent[] = [];
  private readonly portOwners = new Map<MIDIPort, PortLifecycle<MIDIPort>>();
  private readonly portCleanups = new Map<MIDIPort, Promise<void>>();
  private access: MIDIAccess | undefined;
  private enablePromise: Promise<void> | undefined;
  private selectedInput: PortLifecycle<MIDIInput> | undefined;
  private selectedOutput: PortLifecycle<MIDIOutput> | undefined;
  private activeSend: QueuedSend | undefined;
  private sending = false;
  private readonly queuedSends: QueuedSend[] = [];
  private lastSendAt = Number.NEGATIVE_INFINITY;
  private readonly unsubscribeRoutes: () => void;
  private disposed = false;

  private readonly onAccessStateChange = () => {
    if (!this.access || this.disposed) return;

    const inputId = this.selectedInput?.port.id;
    if (inputId) {
      const currentInput = this.access.inputs.get(inputId);
      if (!currentInput || currentInput !== this.selectedInput?.port || currentInput.state !== 'connected') {
        this.clearSelectedInput();
      }
    }

    const outputId = this.selectedOutput?.port.id;
    if (outputId) {
      const currentOutput = this.access.outputs.get(outputId);
      if (!currentOutput || currentOutput !== this.selectedOutput?.port || currentOutput.state !== 'connected') {
        this.clearSelectedOutput();
      }
    }

    this.publish();
  };

  private readonly onMidiMessage = (event: MIDIMessageEvent) => {
    if (this.disposed || !this.selectedInput) return;
    const input = this.selectedInput.port;
    if (event.currentTarget !== input) return;
    this.record({
      direction: 'incoming',
      portId: input.id,
      portName: input.name ?? 'Unnamed MIDI port',
      bytes: Array.from(event.data ?? []),
      timestamp: Date.now(),
    });
  };

  constructor(options: {
    requestAccess?: RequestAccess;
    routes?: RouteLeaseRegistry;
    now?: () => number;
    pace?: Pace;
  } = {}) {
    this.requestAccess = options.requestAccess ?? defaultRequestAccess;
    this.routes = options.routes ?? midiRoutes;
    this.now = options.now ?? Date.now;
    this.pace = options.pace ?? defaultPace;
    this.unsubscribeRoutes = this.routes.subscribe((outputId, owner) => {
      if (this.disposed || this.selectedOutput?.port.id !== outputId) return;
      if (owner) this.cancelSendsFor(this.selectedOutput, busyResult(owner));
      this.publish();
    });
  }

  async enable(): Promise<void> {
    if (this.disposed) throw new Error('This MIDI session has been disposed.');
    if (this.access) return;
    if (this.enablePromise) return this.enablePromise;

    const attempt = this.requestAccess({ sysex: false }).then(access => {
      if (this.disposed) return;
      this.access = access;
      access.addEventListener('statechange', this.onAccessStateChange);
      this.publish();
    });
    this.enablePromise = attempt;

    try {
      await attempt;
    } finally {
      if (!this.access) this.enablePromise = undefined;
    }
  }

  selectOutput(id: string | undefined): void {
    if (this.disposed) return;
    const next = id ? this.access?.outputs.get(id) : undefined;
    if (next === this.selectedOutput?.port) return;

    this.clearSelectedOutput();
    if (next) this.setSelectedOutput(next);
    this.publish();
  }

  selectInput(id: string | undefined): void {
    if (this.disposed) return;
    const next = id ? this.access?.inputs.get(id) : undefined;
    if (next === this.selectedInput?.port) return;

    this.clearSelectedInput();
    if (next) this.setSelectedInput(next);
    this.publish();
  }

  async sendCc(message: SendCc, options: SendCcOptions = {}): Promise<SendCcResult> {
    if (this.disposed) return DISPOSED_ERROR;
    if (!Number.isInteger(message.channel) || message.channel < 1 || message.channel > 16) {
      return { ok: false, error: 'Choose a MIDI channel from 1 to 16.' };
    }
    if (![message.controller, message.value].every(value => Number.isInteger(value) && value >= 0 && value <= 127)) {
      return { ok: false, error: 'MIDI CC values must be whole numbers from 0 to 127.' };
    }

    const output = this.selectedConnectedOutput();
    if (!output) return { ok: false, error: 'Choose a connected MIDI output.' };

    const bytes: [number, number, number] = [
      0xB0 | (message.channel - 1),
      message.controller,
      message.value,
    ];
    const label = message.label;
    const owner = this.routes.current(output.port.id);
    if (owner) {
      const result = busyResult(owner);
      this.recordOutgoing(output.port, bytes, message.channel, label, result);
      return result;
    }
    const { signal } = options;
    if (signal?.aborted) {
      this.recordOutgoing(output.port, bytes, message.channel, label, ABORTED_ERROR);
      return ABORTED_ERROR;
    }

    return new Promise(resolve => {
      let cancel!: (result: SendCcResult) => void;
      const cancelled = new Promise<SendCcResult>(cancelledResolve => { cancel = cancelledResolve; });
      const queued: QueuedSend = {
        bytes,
        label,
        channel: message.channel,
        output,
        resolve,
        cancelled,
        cancel,
        cancelledWith: undefined,
        releaseSignal: () => undefined,
        dispatched: false,
        settled: false,
        waitingForCadence: false,
      };
      if (signal) {
        const onAbort = () => this.abortSend(queued);
        signal.addEventListener('abort', onAbort, { once: true });
        queued.releaseSignal = () => signal.removeEventListener('abort', onAbort);
      }
      if (this.sending) {
        const active = this.activeSend;
        const activeIsSameStream = active?.waitingForCadence
          && this.sameSendStream(active, queued);
        const queuedIndex = this.queuedSends.findIndex(send => this.sameSendStream(send, queued));
        if (activeIsSameStream && active) {
          this.cancelSend(active, REPLACED_ERROR);
          if (queuedIndex >= 0) {
            this.cancelSend(this.queuedSends[queuedIndex], REPLACED_ERROR);
            this.queuedSends.splice(queuedIndex, 1);
          }
          this.queuedSends.unshift(queued);
          return;
        }
        if (queuedIndex >= 0) {
          this.cancelSend(this.queuedSends[queuedIndex], REPLACED_ERROR);
          this.queuedSends[queuedIndex] = queued;
        } else {
          this.queuedSends.push(queued);
        }
        return;
      }

      this.sending = true;
      void this.drainSends(queued);
    });
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.snapshot());
    } catch {
      // Observer failures must not alter MIDI transport or queue state.
    }
    return () => { this.listeners.delete(listener); };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeRoutes();
    this.access?.removeEventListener('statechange', this.onAccessStateChange);
    if (this.activeSend) this.cancelSend(this.activeSend, DISPOSED_ERROR);
    this.queuedSends.forEach(send => this.cancelSend(send, DISPOSED_ERROR));
    this.queuedSends.length = 0;

    const input = this.selectedInput;
    const output = this.selectedOutput;
    this.detachInputListener(input);
    this.selectedInput = undefined;
    this.selectedOutput = undefined;
    this.access = undefined;
    this.listeners.clear();

    if (input) this.retirePort(input);
    if (output) this.retirePort(output);
  }

  private selectedConnectedOutput(): PortLifecycle<MIDIOutput> | undefined {
    if (!this.access || !this.selectedOutput) return undefined;
    const current = this.access.outputs.get(this.selectedOutput.port.id);
    return current === this.selectedOutput.port && current.state === 'connected'
      ? this.selectedOutput
      : undefined;
  }

  private setSelectedOutput(output: MIDIOutput): void {
    this.selectedOutput = this.startPort(output);
  }

  private clearSelectedOutput(): void {
    const output = this.selectedOutput;
    this.selectedOutput = undefined;
    if (!output) return;
    this.cancelSendsFor(output, { ok: false, error: 'Choose a connected MIDI output.' });
    this.retirePort(output);
  }

  private setSelectedInput(input: MIDIInput): void {
    this.selectedInput = this.startPort(input);
    input.addEventListener('midimessage', this.onMidiMessage);
  }

  private clearSelectedInput(): void {
    const input = this.selectedInput;
    this.detachInputListener(input);
    this.selectedInput = undefined;
    if (input) this.retirePort(input);
  }

  private detachInputListener(input: PortLifecycle<MIDIInput> | undefined): void {
    input?.port.removeEventListener('midimessage', this.onMidiMessage);
  }

  private async drainSends(first: QueuedSend): Promise<void> {
    let current: QueuedSend | undefined = first;
    try {
      while (current) {
        this.activeSend = current;
        let result: SendCcResult;
        try {
          result = await this.performSend(current);
        } catch {
          result = { ok: false, error: 'Unable to send MIDI CC to the selected output.' };
        }
        this.settleSend(current, result);
        this.activeSend = undefined;
        current = this.queuedSends.shift();
      }
    } finally {
      if (this.activeSend) {
        this.cancelSend(
          this.activeSend,
          this.disposed ? DISPOSED_ERROR : { ok: false, error: 'Unable to send MIDI CC to the selected output.' },
        );
      }
      this.activeSend = undefined;
      this.sending = false;
    }
  }

  private async performSend(queued: QueuedSend): Promise<SendCcResult> {
    const ready = queued.output.ready.then<SendCcResult | undefined, SendCcResult | undefined>(
      () => undefined,
      () => ({ ok: false, error: 'Unable to open the selected MIDI output.' }),
    );
    const interrupted = await Promise.race([ready, queued.cancelled]);
    if (interrupted) return interrupted;

    const waitMs = Math.max(0, SEND_INTERVAL_MS - (this.now() - this.lastSendAt));
    if (waitMs > 0) {
      queued.waitingForCadence = true;
      const paced = await this.waitOrCancel(waitMs, queued.cancelled);
      queued.waitingForCadence = false;
      if (paced) return paced;
    }

    if (this.disposed) return DISPOSED_ERROR;
    const output = this.selectedConnectedOutput();
    if (!output || output !== queued.output) {
      return { ok: false, error: 'Choose a connected MIDI output.' };
    }
    const owner = this.routes.current(output.port.id);
    if (owner) return busyResult(owner);
    // A cancellation can land in the microtask gap after the waits above resolve.
    if (queued.cancelledWith) return queued.cancelledWith;

    // From here the bytes belong to the browser; later cancellation must not report them as unsent.
    queued.dispatched = true;
    try {
      output.port.send([...queued.bytes]);
      this.lastSendAt = this.now();
    } catch {
      this.lastSendAt = this.now();
      return { ok: false, error: 'Unable to send MIDI CC to the selected output.' };
    }
    return { ok: true, bytes: [...queued.bytes] as [number, number, number] };
  }

  private async waitOrCancel(milliseconds: number, cancelled: Promise<SendCcResult>): Promise<SendCcResult | undefined> {
    const elapsed = this.pace(milliseconds).then(() => undefined);
    const result = await Promise.race([elapsed, cancelled]);
    return result;
  }

  private startPort<T extends MIDIPort>(port: T): PortLifecycle<T> {
    const lifecycle: PortLifecycle<T> = { port, ready: Promise.resolve(), retired: false };
    const previousCleanup = this.portCleanups.get(port);
    this.portOwners.set(port, lifecycle);
    lifecycle.ready = previousCleanup
      ? previousCleanup.catch(() => undefined).then(async () => {
          if (!lifecycle.retired && this.portOwners.get(port) === lifecycle) await openPort(port);
        })
      : openPort(port);
    void lifecycle.ready.catch(() => undefined);
    return lifecycle;
  }

  private retirePort(lifecycle: PortLifecycle<MIDIPort>): void {
    if (lifecycle.retired) return;
    lifecycle.retired = true;
    if (this.portOwners.get(lifecycle.port) === lifecycle) this.portOwners.delete(lifecycle.port);
    const firstClose = closePort(lifecycle.port).catch(() => undefined);
    const cleanup = Promise.allSettled([lifecycle.ready, firstClose]).then(async () => {
      if (!this.portOwners.has(lifecycle.port) && lifecycle.port.connection !== 'closed') {
        await closePort(lifecycle.port).catch(() => undefined);
      }
    });
    this.portCleanups.set(lifecycle.port, cleanup);
    void cleanup.then(() => {
      if (this.portCleanups.get(lifecycle.port) === cleanup) this.portCleanups.delete(lifecycle.port);
    });
  }

  private cancelSendsFor(output: PortLifecycle<MIDIOutput>, result: SendCcResult): void {
    if (this.activeSend?.output === output) this.cancelSend(this.activeSend, result);
    for (let index = this.queuedSends.length - 1; index >= 0; index -= 1) {
      const send = this.queuedSends[index];
      if (send.output === output) {
        this.cancelSend(send, result);
        this.queuedSends.splice(index, 1);
      }
    }
  }

  private sameSendStream(left: QueuedSend, right: QueuedSend): boolean {
    return left.output === right.output
      && left.channel === right.channel
      && left.bytes[1] === right.bytes[1];
  }

  private abortSend(send: QueuedSend): void {
    const index = this.queuedSends.indexOf(send);
    if (index >= 0) this.queuedSends.splice(index, 1);
    this.cancelSend(send, ABORTED_ERROR);
  }

  private cancelSend(send: QueuedSend, result: SendCcResult): void {
    if (send.settled || send.dispatched) return;
    send.cancelledWith = result;
    send.cancel(result);
    this.settleSend(send, result);
  }

  private settleSend(send: QueuedSend, result: SendCcResult): void {
    if (send.settled) return;
    send.settled = true;
    send.releaseSignal();
    const replaced = 'error' in result && result.error === REPLACED_ERROR_MESSAGE;
    if (!replaced) {
      this.recordOutgoing(send.output.port, send.bytes, send.channel, send.label, result);
    }
    send.resolve(result);
  }

  private recordOutgoing(
    output: MIDIOutput,
    bytes: [number, number, number],
    channel: number,
    label: string,
    result: SendCcResult,
  ): void {
    this.record({
      direction: 'outgoing',
      portId: output.id,
      portName: output.name ?? 'Unnamed MIDI port',
      bytes: [...bytes],
      timestamp: Date.now(),
      label,
      channel,
      result: result.ok ? 'sent' : 'failed',
      ...(result.ok ? {} : { error: result.error }),
    });
  }

  private record(event: MidiMonitorEvent): void {
    this.monitor.push(event);
    if (this.monitor.length > 100) this.monitor.splice(0, this.monitor.length - 100);
    this.publish();
  }

  private snapshot(): BrowserMidiSessionState {
    return {
      enabled: Boolean(this.access),
      inputs: this.access ? Array.from(this.access.inputs.values(), portSummary) : [],
      outputs: this.access ? Array.from(this.access.outputs.values(), portSummary) : [],
      selectedInputId: this.selectedInput?.port.id,
      selectedOutputId: this.selectedOutput?.port.id,
      selectedOutputOwner: this.selectedOutput ? this.routes.current(this.selectedOutput.port.id) : undefined,
      monitor: this.monitor.map(event => ({ ...event, bytes: [...event.bytes] })),
    };
  }

  private publish(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch {
        // One observer cannot interrupt sends or prevent other observers from receiving state.
      }
    });
  }
}
