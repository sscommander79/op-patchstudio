import {
  RECORDING_LIMITS,
  type CaptureClockSnapshot,
  type CaptureStatus,
  type SessionTake,
} from './captureSession';

export const STEM_LIMITS = {
  tracks: 8,
  outputSeconds: 16,
  captureSeconds: 20,
  pcmBytes: 64 * 1024 * 1024,
  readinessMs: 2000,
  leadMs: 150,
  guardMs: 500,
} as const;

export interface StemSettings {
  tracks: number[];
  bpm: number;
  bars: number;
  tailSeconds: number;
  settleMs: number;
  latencyMs: number;
}

export interface StemResult {
  track: number;
  take: SessionTake;
  settings: StemSettings;
  warnings: string[];
  timingVerified: false;
}

export interface StemMidi {
  isConnected: () => boolean;
  send: (bytes: number[], timestamp?: number) => void;
  clear: () => void;
}

export interface StemCapture {
  enableInput: (deviceId: string) => Promise<boolean>;
  start: () => void;
  stop: () => Promise<void>;
  dispose: () => Promise<void>;
  clockSnapshot: () => CaptureClockSnapshot;
}

export interface StemCaptureCallbacks {
  onStatus: (status: CaptureStatus) => void;
  onTake: (take: SessionTake) => void;
  onError: (message: string) => void;
}

interface RetainedUsage {
  count: number;
  bytes: number;
  tracks?: number[];
}

interface Dependencies {
  createCapture: (callbacks: StemCaptureCallbacks) => StemCapture;
  midi: StemMidi;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  allocate?: (channels: number, frames: number, rate: number) => AudioBuffer;
  onResult?: (result: StemResult) => void;
  onProgress?: (completed: number, total: number, track: number, elapsedSeconds: number) => void;
  onError?: (message: string) => void;
  retainedUsage?: () => RetainedUsage;
}

interface OwnedRun {
  id: number;
  controller: AbortController;
  capture?: StemCapture;
  hardwareTouched: boolean;
  hardwareCleaned: boolean;
  errorReported: boolean;
  retry: boolean;
}

function whole(label: string, value: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
}

export function stemDuration(settings: Pick<StemSettings, 'bpm' | 'bars' | 'tailSeconds'>) {
  return settings.bars * 4 * 60 / settings.bpm + settings.tailSeconds;
}

export function validateStemSettings(settings: StemSettings) {
  whole('BPM', settings.bpm, 40, 240);
  whole('Bars', settings.bars, 1, 16);
  if (!Number.isFinite(settings.tailSeconds) || settings.tailSeconds < 0 || settings.tailSeconds > 4) {
    throw new Error('Tail must be from 0 to 4 seconds.');
  }
  whole('Settling time', settings.settleMs, 250, 2000);
  whole('Latency adjustment', settings.latencyMs, 0, 250);
  if (
    !settings.tracks.length ||
    settings.tracks.length > STEM_LIMITS.tracks ||
    new Set(settings.tracks).size !== settings.tracks.length ||
    settings.tracks.some(track => !Number.isInteger(track) || track < 1 || track > STEM_LIMITS.tracks)
  ) {
    throw new Error('Choose one to eight unique tracks from 1 to 8.');
  }
  const duration = stemDuration(settings);
  if (duration > STEM_LIMITS.outputSeconds) {
    throw new Error('Music plus tail must be 16 seconds or less.');
  }
  const captureMs = STEM_LIMITS.readinessMs + settings.settleMs + STEM_LIMITS.leadMs + duration * 1000 + settings.latencyMs + STEM_LIMITS.guardMs;
  if (captureMs / 1000 > STEM_LIMITS.captureSeconds) {
    throw new Error('These settings do not fit within the recorder’s 20 second capture limit. Reduce bars, tail, latency, or settling time.');
  }
  return duration;
}

// This is a UI estimate only. Admission uses the actual capture format.
export function estimatedStemBytes(settings: StemSettings, sampleRate = 48_000, channels = 2) {
  return Math.ceil(stemDuration(settings) * sampleRate) * channels * 4;
}

function aborted() {
  return new DOMException('Track recording stopped.', 'AbortError');
}

function isAbort(reason: unknown) {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

function inspect(buffer: AudioBuffer) {
  let peak = 0;
  let clipped = 0;
  let total = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let frame = 0; frame < buffer.length; frame += 1) {
      const value = Math.abs(data[frame] || 0);
      peak = Math.max(peak, value);
      if (value >= 0.999) clipped += 1;
      total += 1;
    }
  }
  const warnings: string[] = [];
  if (peak < 0.001) warnings.push('This recording appears silent.');
  if (total && clipped / total >= 0.01) warnings.push('This recording appears clipped.');
  return warnings;
}

export class StemCaptureEngine {
  private readonly deps: Dependencies;
  private readonly disposedCaptures = new WeakSet<StemCapture>();
  private nextRunId = 0;
  private currentRun?: OwnedRun;

  constructor(deps: Dependencies) {
    this.deps = deps;
  }

  async run(settings: StemSettings, deviceId: string, onlyTrack?: number) {
    if (this.currentRun) {
      this.deps.onError?.('Track recording is already running.');
      return;
    }

    const duration = validateStemSettings(settings);
    const tracks = onlyTrack === undefined ? settings.tracks : [onlyTrack];
    if (tracks.some(track => !Number.isInteger(track) || track < 1 || track > STEM_LIMITS.tracks)) {
      throw new Error('Retry track must be from 1 to 8.');
    }
    this.checkTrackCount(tracks, onlyTrack !== undefined);

    const run: OwnedRun = {
      id: ++this.nextRunId,
      controller: new AbortController(),
      hardwareTouched: false,
      hardwareCleaned: false,
      errorReported: false,
      retry: onlyTrack !== undefined,
    };
    this.currentRun = run;

    try {
      for (let index = 0; index < tracks.length; index += 1) {
        this.assertOwned(run);
        const track = tracks[index];
        const result = await this.captureTrack(run, track, tracks.slice(index), settings, deviceId, duration);
        this.assertOwned(run);
        this.deps.onResult?.(result);
        this.deps.onProgress?.(index + 1, tracks.length, track, duration);
      }
    } catch (reason) {
      if (!isAbort(reason)) {
        run.controller.abort();
        this.cleanupHardware(run);
        this.reportError(run, reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (this.currentRun === run) this.currentRun = undefined;
      await this.disposeCapture(run);
    }
  }

  async cancel() {
    const run = this.currentRun;
    if (!run) return;
    this.currentRun = undefined;
    run.controller.abort();
    this.cleanupHardware(run);
    await this.disposeCapture(run);
  }

  outputDisconnected() {
    const run = this.currentRun;
    if (!run) return;
    this.reportError(run, 'MIDI output disconnected. Recording stopped. On the OP-XY, stop transport and unmute tracks 1–8 manually if needed.');
    void this.cancel();
  }

  private async captureTrack(
    run: OwnedRun,
    track: number,
    remainingTracks: number[],
    settings: StemSettings,
    deviceId: string,
    duration: number,
  ): Promise<StemResult> {
    run.hardwareTouched = false;
    run.hardwareCleaned = false;
    let take: SessionTake | undefined;
    let format: {sampleRate: number; channels: number} | undefined;
    let resolveReady!: () => void;
    let rejectFailure!: (reason: Error) => void;
    const ready = new Promise<void>(resolve => { resolveReady = resolve; });
    const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
    // A rejected failure promise is always observed through raceWithRun.
    void failure.catch(() => undefined);

    const capture = this.deps.createCapture({
      onStatus: status => {
        if (status.sampleRate && status.channels) format = {sampleRate: status.sampleRate, channels: status.channels};
        if ((status.elapsedFrames ?? 0) > 0) resolveReady();
        if (status.state === 'error') rejectFailure(new Error('Audio capture stopped unexpectedly.'));
      },
      onTake: value => {
        if (this.currentRun === run) take = value;
      },
      onError: message => rejectFailure(new Error(message)),
    });
    run.capture = capture;

    try {
      const enabled = await this.raceWithRun(run, capture.enableInput(deviceId), failure);
      this.assertOwned(run);
      if (!enabled) throw new Error('Audio input could not be enabled. Check permission and the selected device.');

      capture.start();
      await this.waitForReadiness(run, ready, failure);
      this.assertOwned(run);
      if (!this.deps.midi.isConnected()) throw new Error('The selected MIDI output disconnected.');

      const clock = capture.clockSnapshot();
      const sampleRate = format?.sampleRate ?? clock.sampleRate;
      const channels = format?.channels;
      if (!channels) throw new Error('The recorder did not report the actual input channel count.');
      if (sampleRate !== clock.sampleRate) throw new Error('The input sample rate changed before recording.');
      this.checkActualCapacity(run, remainingTracks, duration, sampleRate, channels);
      this.assertOwned(run);
      if (!this.deps.midi.isConnected()) throw new Error('The selected MIDI output disconnected.');

      run.hardwareTouched = true;
      this.deps.midi.send([0xfc]);
      for (let channel = 1; channel <= STEM_LIMITS.tracks; channel += 1) {
        this.deps.midi.send([0xb0 + channel - 1, 9, channel === track ? 0 : 127]);
      }

      await this.wait(run, settings.settleMs, failure);
      this.assertOwned(run);
      if (!this.deps.midi.isConnected()) throw new Error('The selected MIDI output disconnected.');

      const settledClock = capture.clockSnapshot();
      if (settledClock.sampleRate !== sampleRate) throw new Error('The input sample rate changed during recording.');
      const now = this.now();
      const startAt = now + STEM_LIMITS.leadMs;
      const startFrame = Math.round(
        settledClock.audioTime * sampleRate +
        (startAt - settledClock.performanceTime) * sampleRate / 1000,
      );
      const musicSeconds = settings.bars * 4 * 60 / settings.bpm;
      const musicalEndAt = startAt + musicSeconds * 1000;
      const guardedEndAt = startAt + duration * 1000 + settings.latencyMs + STEM_LIMITS.guardMs;

      this.deps.midi.send([0xfa], startAt);
      const tickMs = 60_000 / settings.bpm / 24;
      const ticks = settings.bars * 4 * 24;
      for (let tick = 0; tick < ticks; tick += 1) this.deps.midi.send([0xf8], startAt + tick * tickMs);
      this.deps.midi.send([0xfc], musicalEndAt);

      await this.waitUntil(run, guardedEndAt, failure);
      if (this.now() > guardedEndAt + STEM_LIMITS.guardMs) {
        throw new Error('Browser timing stalled during recording. The take was discarded; retry with fewer competing apps.');
      }
      await this.raceWithRun(run, capture.stop(), failure);
      this.assertOwned(run);
      this.cleanupHardware(run);

      if (!take || take.sourceStartFrame === undefined || take.sourceEndFrame === undefined) {
        throw new Error('The recorder did not return a complete frame-timed take.');
      }
      if (
        take.sampleRate !== sampleRate ||
        take.channels !== channels ||
        take.audioBuffer.sampleRate !== take.sampleRate ||
        take.audioBuffer.numberOfChannels !== take.channels ||
        take.audioBuffer.length < take.frames ||
        take.sourceEndFrame - take.sourceStartFrame !== take.frames
      ) {
        throw new Error('The recorder returned inconsistent source frame or format metadata.');
      }

      const frames = Math.round(duration * take.sampleRate);
      const latencyFrames = Math.round(settings.latencyMs * take.sampleRate / 1000);
      const absoluteStart = startFrame + latencyFrames;
      const absoluteEnd = absoluteStart + frames;
      const offset = absoluteStart - take.sourceStartFrame;
      if (offset < 0 || absoluteEnd > take.sourceEndFrame || offset + frames > take.frames) {
        throw new Error('The capture did not cover the exact requested musical interval. The take was discarded; retry.');
      }

      this.checkActualCapacity(run, remainingTracks, duration, take.sampleRate, take.channels);
      const allocate = this.deps.allocate ?? ((channelCount, length, rate) => new AudioBuffer({
        length,
        numberOfChannels: channelCount,
        sampleRate: rate,
      }));
      const buffer = allocate(take.channels, frames, take.sampleRate);
      for (let channel = 0; channel < take.channels; channel += 1) {
        buffer.copyToChannel(take.audioBuffer.getChannelData(channel).subarray(offset, offset + frames), channel);
      }

      return {
        track,
        take: {...take, audioBuffer: buffer, frames, sourceStartFrame: absoluteStart, sourceEndFrame: absoluteEnd},
        settings: {...settings, tracks: [...settings.tracks]},
        warnings: inspect(buffer),
        timingVerified: false,
      };
    } catch (reason) {
      if (!isAbort(reason)) {
        run.controller.abort();
        this.cleanupHardware(run);
      }
      if (run.capture === capture) run.capture = undefined;
      await this.disposeCaptureObject(capture, true);
      throw reason;
    } finally {
      if (run.capture === capture) run.capture = undefined;
      await this.disposeCaptureObject(capture, false);
    }
  }

  private checkTrackCount(runTracks: number[], retry: boolean) {
    const usage = this.deps.retainedUsage?.() ?? {count: 0, bytes: 0};
    const count = usage.tracks
      ? new Set([...usage.tracks, ...runTracks]).size
      : usage.count + (retry ? 0 : runTracks.length);
    if (count > STEM_LIMITS.tracks) throw new Error('The reviewed recordings and this run exceed the 8-track limit.');
  }

  private checkActualCapacity(
    run: OwnedRun,
    remainingTracks: number[],
    duration: number,
    sampleRate: number,
    channels: number,
  ) {
    if (!Number.isFinite(sampleRate) || sampleRate < 8_000 || sampleRate > 96_000 || !Number.isInteger(channels) || channels < 1 || channels > 2) {
      throw new Error('The actual audio input format is unsupported. Choose a mono or stereo 8–96 kHz input.');
    }
    const usage = this.deps.retainedUsage?.() ?? {count: 0, bytes: 0};
    const union = usage.tracks ? new Set([...usage.tracks, ...remainingTracks]) : undefined;
    const count = union?.size ?? usage.count + (run.retry ? 0 : remainingTracks.length);
    const outputBytes = Math.ceil(duration * sampleRate) * channels * 4;
    const captureBytes = Math.ceil(STEM_LIMITS.captureSeconds * sampleRate) * channels * 4;
    // A replacement's old take stays retained until the replacement succeeds.
    const peakBytes = usage.bytes + captureBytes + outputBytes * remainingTracks.length;
    if (
      count > STEM_LIMITS.tracks ||
      !Number.isSafeInteger(peakBytes) ||
      peakBytes > STEM_LIMITS.pcmBytes ||
      peakBytes > RECORDING_LIMITS.ownedBytes
    ) {
      throw new Error('The reviewed recordings and actual input format exceed the 8-track or 64 MiB recording limit.');
    }
  }

  private reportError(run: OwnedRun, message: string) {
    if (run.errorReported) return;
    run.errorReported = true;
    this.deps.onError?.(message);
  }

  private now() {
    return (this.deps.now ?? (() => performance.now()))();
  }

  private assertOwned(run: OwnedRun) {
    if (this.currentRun !== run || run.controller.signal.aborted) throw aborted();
  }

  private async wait(run: OwnedRun, ms: number, failure: Promise<never>) {
    const operation = this.deps.sleep
      ? this.deps.sleep(ms, run.controller.signal)
      : new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(done, ms);
        const cancel = () => done(aborted());
        function done(reason?: DOMException) {
          window.clearTimeout(timer);
          run.controller.signal.removeEventListener('abort', cancel);
          if (reason) reject(reason); else resolve();
        }
        run.controller.signal.addEventListener('abort', cancel, {once: true});
      });
    await this.raceWithRun(run, operation, failure);
  }

  private async waitUntil(run: OwnedRun, time: number, failure: Promise<never>) {
    while (this.now() < time) {
      await this.wait(run, Math.min(time - this.now(), 100), failure);
    }
  }

  private async waitForReadiness(run: OwnedRun, ready: Promise<void>, failure: Promise<never>) {
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('No audio frames arrived within 2 seconds. Check the selected input.')), STEM_LIMITS.readinessMs);
    });
    try {
      await this.raceWithRun(run, Promise.race([ready, timeout]), failure);
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }

  private async raceWithRun<T>(run: OwnedRun, operation: Promise<T>, failure: Promise<never>): Promise<T> {
    let cancel!: () => void;
    const canceled = new Promise<never>((_, reject) => {
      cancel = () => reject(aborted());
      if (run.controller.signal.aborted) cancel();
      else run.controller.signal.addEventListener('abort', cancel, {once: true});
    });
    try {
      const value = await Promise.race([operation, failure, canceled]);
      this.assertOwned(run);
      return value;
    } finally {
      run.controller.signal.removeEventListener('abort', cancel);
    }
  }

  private cleanupHardware(run: OwnedRun) {
    if (!run.hardwareTouched || run.hardwareCleaned) return;
    run.hardwareCleaned = true;
    try { this.deps.midi.clear(); } catch { /* disconnected */ }
    try { this.deps.midi.send([0xfc]); } catch { /* disconnected */ }
    for (let channel = 1; channel <= STEM_LIMITS.tracks; channel += 1) {
      try { this.deps.midi.send([0xb0 + channel - 1, 9, 0]); } catch { /* best effort */ }
    }
  }

  private async disposeCapture(run: OwnedRun) {
    const capture = run.capture;
    run.capture = undefined;
    if (!capture) return;
    await this.disposeCaptureObject(capture, true);
  }

  private async disposeCaptureObject(capture: StemCapture, stop: boolean) {
    if (this.disposedCaptures.has(capture)) return;
    this.disposedCaptures.add(capture);
    const stopping = stop ? capture.stop().catch(() => undefined) : Promise.resolve();
    await capture.dispose().catch(() => undefined);
    await stopping;
  }
}
