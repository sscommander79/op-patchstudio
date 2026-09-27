import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  StemCaptureEngine,
  stemDuration,
  validateStemSettings,
  type StemCaptureCallbacks,
  type StemSettings,
} from '../../../audio/recording/stemCapture';
import type {SessionTake} from '../../../audio/recording/captureSession';

const settings: StemSettings = {tracks: [1], bpm: 120, bars: 1, tailSeconds: 0, settleMs: 250, latencyMs: 0};

function buffer(frames = 24_000, channels = 2, rate = 8_000) {
  const result = new AudioBuffer({length: frames, numberOfChannels: channels, sampleRate: rate});
  for (let channel = 0; channel < channels; channel += 1) {
    result.copyToChannel(Float32Array.from({length: frames}, (_, index) => channel + index / 100_000), channel);
  }
  return result;
}

function take(audioBuffer = buffer(), sourceStartFrame = 0): SessionTake {
  return {
    id: 'take',
    audioBuffer,
    frames: audioBuffer.length,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    actualPreRollFrames: 0,
    completionReason: 'manual',
    sourceStartFrame,
    sourceEndFrame: sourceStartFrame + audioBuffer.length,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise, resolve};
}

async function turns() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function rig(overrides: {source?: SessionTake; connected?: boolean; neverReady?: boolean; captureError?: string} = {}) {
  let callbacks!: StemCaptureCallbacks;
  const messages: Array<{bytes: number[]; time?: number}> = [];
  const clear = vi.fn();
  const dispose = vi.fn().mockResolvedValue(undefined);
  const stop = vi.fn(async () => {
    if (overrides.captureError) callbacks.onError(overrides.captureError);
    else callbacks.onTake(overrides.source ?? take());
  });
  const createCapture = vi.fn((value: StemCaptureCallbacks) => {
    callbacks = value;
    return {
      enableInput: vi.fn(async () => true),
      start: vi.fn(() => {
        if (!overrides.neverReady) callbacks.onStatus({state: 'recording', elapsedFrames: 128, sampleRate: 8_000, channels: 2});
      }),
      stop,
      dispose,
      clockSnapshot: () => ({audioTime: performance.now() / 1000, sampleRate: 8_000, performanceTime: performance.now()}),
    };
  });
  const results: unknown[] = [];
  const errors: string[] = [];
  const engine = new StemCaptureEngine({
    createCapture,
    midi: {
      isConnected: () => overrides.connected !== false,
      send: (bytes, time) => messages.push({bytes, time}),
      clear,
    },
    allocate: (channels, frames, rate) => new AudioBuffer({length: frames, numberOfChannels: channels, sampleRate: rate}),
    onResult: value => results.push(value),
    onError: value => errors.push(value),
    retainedUsage: () => ({count: 0, bytes: 0, tracks: []}),
  });
  return {engine, messages, clear, dispose, stop, results, errors};
}

describe('StemCaptureEngine', () => {
  afterEach(() => vi.useRealTimers());

  it('validates bounded musical settings', () => {
    expect(stemDuration(settings)).toBe(2);
    expect(() => validateStemSettings({...settings, tracks: [1, 1]})).toThrow(/unique/i);
    expect(() => validateStemSettings({...settings, bpm: 39})).toThrow(/40/);
    expect(() => validateStemSettings({...settings, bars: 16, bpm: 40})).toThrow(/16 seconds/i);
  });

  it('starts only after real frames and crops exact source coordinates', async () => {
    vi.useFakeTimers();
    const source = take(buffer(24_000, 2, 8_000));
    const r = rig({source});
    const run = r.engine.run(settings, 'input');
    await vi.runAllTimersAsync();
    await run;

    const bytes = r.messages.map(message => message.bytes);
    expect(bytes.slice(0, 9)).toEqual([
      [0xfc], [0xb0, 9, 0], [0xb1, 9, 127], [0xb2, 9, 127], [0xb3, 9, 127],
      [0xb4, 9, 127], [0xb5, 9, 127], [0xb6, 9, 127], [0xb7, 9, 127],
    ]);
    expect(bytes.filter(value => value[0] === 0xf8)).toHaveLength(96);
    const result = r.results[0] as {take: SessionTake};
    expect(result.take.frames).toBe(16_000);
    expect(result.take.sourceStartFrame).toBe(3_200);
    expect(result.take.sourceEndFrame).toBe(19_200);
    expect(result.take.audioBuffer.getChannelData(1)[0]).toBeCloseTo(1.032, 5);
  });

  it('positive latency crops later and requires guarded source coverage', async () => {
    vi.useFakeTimers();
    const r = rig({source: take(buffer(24_000, 2, 8_000))});
    const run = r.engine.run({...settings, latencyMs: 100}, 'input');
    await vi.runAllTimersAsync();
    await run;
    const result = r.results[0] as {take: SessionTake};
    expect(result.take.sourceStartFrame).toBe(4_000);
    expect(result.take.sourceEndFrame).toBe(20_000);
    expect(result.take.audioBuffer.getChannelData(0)[0]).toBeCloseTo(0.04, 5);
  });

  it('rejects insufficient coverage without padding and keeps a failed retry result', async () => {
    vi.useFakeTimers();
    const priorBytes = 16_000 * 2 * 4;
    const results: unknown[] = [];
    let callbacks!: StemCaptureCallbacks;
    const engine = new StemCaptureEngine({
      midi: {isConnected: () => true, send: vi.fn(), clear: vi.fn()},
      retainedUsage: () => ({count: 1, bytes: priorBytes, tracks: [1]}),
      createCapture: value => {
        callbacks = value;
        return {
          enableInput: async () => true,
          start: () => callbacks.onStatus({state: 'recording', elapsedFrames: 1, sampleRate: 8_000, channels: 1}),
          stop: async () => callbacks.onTake(take(buffer(1_000, 1, 8_000))),
          dispose: async () => undefined,
          clockSnapshot: () => ({audioTime: 0, sampleRate: 8_000, performanceTime: performance.now()}),
        };
      },
      onResult: result => results.push(result),
      onError: vi.fn(),
    });
    const run = engine.run(settings, 'input', 1);
    await vi.runAllTimersAsync();
    await run;
    expect(results).toHaveLength(0);
  });

  it('times out readiness without sending or clearing MIDI', async () => {
    vi.useFakeTimers();
    const r = rig({neverReady: true});
    const run = r.engine.run(settings, 'input');
    await vi.advanceTimersByTimeAsync(2_000);
    await run;
    expect(r.errors.join(' ')).toMatch(/No audio frames/i);
    expect(r.messages).toHaveLength(0);
    expect(r.clear).not.toHaveBeenCalled();
  });

  it('cancels pending permission and cannot touch a replacement engine', async () => {
    vi.useFakeTimers();
    const permission = deferred<boolean>();
    const trace: string[] = [];
    const midi = {isConnected: () => true, send: (bytes: number[]) => trace.push(`send:${bytes[0]}`), clear: () => trace.push('clear')};
    const oldDispose = vi.fn(async () => undefined);
    const old = new StemCaptureEngine({
      midi,
      createCapture: () => ({enableInput: () => permission.promise, start: vi.fn(), stop: async () => undefined, dispose: oldDispose, clockSnapshot: () => ({audioTime: 0, sampleRate: 48_000, performanceTime: 0})}),
    });
    const oldRun = old.run(settings, 'input');
    await turns();
    await old.cancel();

    let callbacks!: StemCaptureCallbacks;
    const replacement = new StemCaptureEngine({
      midi,
      createCapture: value => {
        callbacks = value;
        return {enableInput: async () => true, start: () => callbacks.onStatus({state: 'recording', elapsedFrames: 1, sampleRate: 48_000, channels: 2}), stop: async () => undefined, dispose: async () => undefined, clockSnapshot: () => ({audioTime: 0, sampleRate: 48_000, performanceTime: performance.now()})};
      },
    });
    const replacementRun = replacement.run(settings, 'input');
    await vi.advanceTimersByTimeAsync(300);
    const before = [...trace];
    permission.resolve(true);
    await oldRun;
    expect(trace).toEqual(before);
    expect(oldDispose).toHaveBeenCalled();
    await replacement.cancel();
    await replacementRun;
  });

  it('clears queued START before STOP and unmute during synchronous cancellation cleanup', async () => {
    vi.useFakeTimers();
    const trace: string[] = [];
    let callbacks!: StemCaptureCallbacks;
    const engine = new StemCaptureEngine({
      createCapture: value => {
        callbacks = value;
        return {enableInput: async () => true, start: () => callbacks.onStatus({state: 'recording', elapsedFrames: 1, sampleRate: 8_000, channels: 2}), stop: async () => undefined, dispose: async () => undefined, clockSnapshot: () => ({audioTime: 0, sampleRate: 8_000, performanceTime: performance.now()})};
      },
      midi: {isConnected: () => true, send: bytes => trace.push(`send:${bytes.join(',')}`), clear: () => trace.push('clear')},
    });
    const run = engine.run(settings, 'input');
    await vi.advanceTimersByTimeAsync(300);
    const cancel = engine.cancel();
    expect(trace.slice(-10)).toEqual(['clear', 'send:252', ...Array.from({length: 8}, (_, index) => `send:${176 + index},9,0`)]);
    await cancel;
    await run;
  });

  it('aborts immediately on capture error and reports it once', async () => {
    vi.useFakeTimers();
    let callbacks!: StemCaptureCallbacks;
    const clear = vi.fn();
    const errors: string[] = [];
    const engine = new StemCaptureEngine({
      createCapture: value => {
        callbacks = value;
        return {enableInput: async () => true, start: () => callbacks.onStatus({state: 'recording', elapsedFrames: 1, sampleRate: 8_000, channels: 2}), stop: async () => undefined, dispose: async () => undefined, clockSnapshot: () => ({audioTime: 0, sampleRate: 8_000, performanceTime: performance.now()})};
      },
      midi: {isConnected: () => true, send: vi.fn(), clear},
      onError: message => errors.push(message),
    });
    const run = engine.run(settings, 'input');
    await vi.advanceTimersByTimeAsync(300);
    callbacks.onError('Input disconnected.');
    await run;
    expect(errors).toEqual(['Input disconnected.']);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('rejects an actual 96 kHz format over the peak budget before MIDI', async () => {
    const send = vi.fn();
    let callbacks!: StemCaptureCallbacks;
    const engine = new StemCaptureEngine({
      createCapture: value => {
        callbacks = value;
        return {enableInput: async () => true, start: () => callbacks.onStatus({state: 'recording', elapsedFrames: 1, sampleRate: 96_000, channels: 2}), stop: async () => undefined, dispose: async () => undefined, clockSnapshot: () => ({audioTime: 0, sampleRate: 96_000, performanceTime: performance.now()})};
      },
      midi: {isConnected: () => true, send, clear: vi.fn()},
      retainedUsage: () => ({count: 1, bytes: 49 * 1024 * 1024, tracks: [1]}),
      onError: vi.fn(),
    });
    await engine.run(settings, 'input', 1);
    expect(send).not.toHaveBeenCalled();
  });

  it('allows replacement at eight tracks but includes the old take in peak bytes', async () => {
    const callbacks: StemCaptureCallbacks[] = [];
    const errors: string[] = [];
    const engine = new StemCaptureEngine({
      createCapture: value => {
        callbacks.push(value);
        return {enableInput: async () => true, start: () => value.onStatus({state: 'recording', elapsedFrames: 1, sampleRate: 96_000, channels: 2}), stop: async () => undefined, dispose: async () => undefined, clockSnapshot: () => ({audioTime: 0, sampleRate: 96_000, performanceTime: performance.now()})};
      },
      midi: {isConnected: () => true, send: vi.fn(), clear: vi.fn()},
      retainedUsage: () => ({count: 8, bytes: 49 * 1024 * 1024, tracks: [1, 2, 3, 4, 5, 6, 7, 8]}),
      onError: message => errors.push(message),
    });
    await engine.run(settings, 'input', 8);
    expect(callbacks).toHaveLength(1);
    expect(errors.join(' ')).toMatch(/actual input format/i);
  });
});
