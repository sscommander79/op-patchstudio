export type CaptureMode = 'manual' | 'sound';
export type CaptureState = 'monitoring' | 'armed' | 'recording' | 'waiting-for-quiet' | 'stopped' | 'closed' | 'error';
export type CompletionReason = 'silence' | 'length' | 'manual';

export interface CaptureOptions {
  mode: CaptureMode;
  sampleRate: number;
  channels: number;
  thresholdDb?: number;
  hysteresisDb?: number;
  preRollSeconds?: number;
  silenceSeconds?: number;
  rearmSeconds?: number;
  maxSeconds?: number;
}

export interface ValidatedCaptureOptions {
  mode: CaptureMode;
  sampleRate: number;
  channels: number;
  thresholdDb: number;
  hysteresisDb: number;
  high: number;
  low: number;
  preRollFrames: number;
  silenceFrames: number;
  rearmFrames: number;
  maxFrames: number;
}

export interface CompletedTakeFrames {
  startFrame: number;
  endFrame: number;
  frames: number;
  preRollFrames: number;
  reason: CompletionReason;
  channels: Float32Array[];
}

export interface CaptureProcessResult {
  takes: CompletedTakeFrames[];
  meter?: { frame: number; peaks: number[]; recordedFrames:number };
  state: CaptureState;
}

function bounded(value: number | undefined, fallback: number, min: number, max: number, label: string) {
  const actual = value ?? fallback;
  if (!Number.isFinite(actual) || actual < min || actual > max) throw new RangeError(`${label} must be between ${min} and ${max}`);
  return actual;
}

export function validateCaptureOptions(options: CaptureOptions): ValidatedCaptureOptions {
  if (!Number.isFinite(options.sampleRate) || options.sampleRate < 8_000 || options.sampleRate > 96_000) {
    throw new RangeError('Capture sample rate must be between 8,000 and 96,000 Hz');
  }
  if (!Number.isInteger(options.channels) || options.channels < 1 || options.channels > 2) {
    throw new RangeError('Recording supports a mono or stereo input');
  }
  const thresholdDb = bounded(options.thresholdDb, -30, -72, -6, 'Trigger threshold');
  const hysteresisDb = bounded(options.hysteresisDb, 6, 3, 24, 'Trigger hysteresis');
  const preRollSeconds = bounded(options.preRollSeconds, .25, 0, 2, 'Pre-roll');
  const silenceSeconds = bounded(options.silenceSeconds, .5, .1, 5, 'Silence stop');
  const rearmSeconds = bounded(options.rearmSeconds, .25, .1, 2, 'Re-arm quiet time');
  const maxSeconds = bounded(options.maxSeconds, 20, 1, 20, 'Maximum take');
  if (preRollSeconds >= maxSeconds) throw new RangeError('Pre-roll must be shorter than the maximum take');
  const roundedPositive = (seconds: number) => Math.max(1, Math.round(seconds * options.sampleRate));
  const maxFrames = Math.max(1, Math.floor(maxSeconds * options.sampleRate));
  const bytes = options.channels * (Math.round(preRollSeconds * options.sampleRate) + maxFrames) * 4;
  if (!Number.isSafeInteger(bytes)) throw new RangeError('Capture dimensions are too large');
  return {
    mode: options.mode,
    sampleRate: options.sampleRate,
    channels: options.channels,
    thresholdDb,
    hysteresisDb,
    high: 10 ** (thresholdDb / 20),
    low: 10 ** ((thresholdDb - hysteresisDb) / 20),
    preRollFrames: Math.round(preRollSeconds * options.sampleRate),
    silenceFrames: roundedPositive(silenceSeconds),
    rearmFrames: roundedPositive(rearmSeconds),
    maxFrames,
  };
}

/** Pure, allocation-bounded sample-clock capture state machine used by the worklet and unit fixtures. */
export class CaptureCore {
  readonly options: ValidatedCaptureOptions;
  readonly memoryBytes: number;
  state: CaptureState = 'monitoring';
  pendingTake = false;

  private readonly ring: Float32Array[];
  private active: Float32Array[];
  private ringWrite = 0;
  private ringLength = 0;
  private expectedFrame: number | null = null;
  private activeStart = 0;
  private activeLength = 0;
  private activePreRoll = 0;
  private activeNonzero = false;
  private quietFrames = 0;
  private rearmQuietFrames = 0;
  private lastTakeEnd = 0;
  private meterOutstanding = false;

  constructor(options: CaptureOptions) {
    this.options = validateCaptureOptions(options);
    this.ring = Array.from({ length: this.options.channels }, () => new Float32Array(this.options.preRollFrames));
    this.active = Array.from({ length: this.options.channels }, () => new Float32Array(this.options.maxFrames));
    this.memoryBytes = this.options.channels * (this.options.preRollFrames + this.options.maxFrames) * 4;
  }

  arm() {
    if (this.options.mode !== 'sound') throw new Error('Sound trigger is unavailable in manual mode');
    if (this.pendingTake) throw new Error('A completed take is pending acknowledgement');
    if (this.state === 'recording') throw new Error('A take is already recording');
    if (this.state === 'closed' || this.state === 'error') throw new Error('Capture is not available');
    this.state = 'armed';
  }

  startManual() {
    if (this.options.mode !== 'manual') throw new Error('Manual start is unavailable in sound-triggered mode');
    if (this.pendingTake) throw new Error('A completed take is pending acknowledgement');
    if (this.state === 'recording') throw new Error('A take is already recording');
    if (this.state === 'closed' || this.state === 'error') throw new Error('Capture is not available');
    this.beginTake(this.expectedFrame ?? 0, false);
  }

  acknowledgeTake(replacement?: Float32Array[]) {
    if (!this.pendingTake) return;
    const supplied = replacement ?? Array.from({ length: this.options.channels }, () => new Float32Array(this.options.maxFrames));
    if (supplied.length !== this.options.channels || supplied.some(channel => channel.length !== this.options.maxFrames)) {
      throw new Error('Replacement take buffer has invalid dimensions');
    }
    this.active = supplied;
    this.pendingTake = false;
    if (this.state === 'waiting-for-quiet' && this.rearmQuietFrames >= this.options.rearmFrames) this.state = 'armed';
  }

  acknowledgeMeter() { this.meterOutstanding = false; }

  invalidateMonitoringTimeline() {
    if (this.state !== 'monitoring') throw new Error('Only idle monitoring can discard an input timeline');
    this.expectedFrame = null;
    this.ringWrite = 0;
    this.ringLength = 0;
  }

  process(channels: readonly Float32Array[], firstFrame: number): CaptureProcessResult {
    if (this.state === 'closed' || this.state === 'stopped' || this.state === 'error') return { takes: [], state: this.state };
    if (channels.length !== this.options.channels || channels.some(channel => channel.length !== channels[0]?.length)) {
      throw new Error('Capture channel dimensions changed');
    }
    if (!Number.isSafeInteger(firstFrame) || firstFrame < 0) throw new Error('Invalid capture frame');
    if (this.expectedFrame !== null && firstFrame !== this.expectedFrame) throw new Error(`Capture frame discontinuity: expected ${this.expectedFrame}, received ${firstFrame}`);
    const length = channels[0]?.length ?? 0;
    if (length === 0) return { takes: [], state: this.state };
    if (this.expectedFrame === null) {
      this.expectedFrame = firstFrame;
      if (this.state === 'recording' && this.activeLength === 0) this.activeStart = firstFrame;
    }
    const peaks = channels.map(() => 0);
    const takes: CompletedTakeFrames[] = [];
    for (let offset = 0; offset < length; offset += 1) {
      const frame = firstFrame + offset;
      let peak = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        const value = channels[channel][offset];
        if (!Number.isFinite(value)) throw new Error('Capture contains a non-finite sample');
        const absolute = Math.abs(value);
        peaks[channel] = Math.max(peaks[channel], absolute);
        peak = Math.max(peak, absolute);
      }
      if (this.state === 'armed') {
        if (peak >= this.options.high && !this.pendingTake) {
          this.beginTake(frame, true);
          this.append(channels, offset);
          const completed = this.maybeComplete(peak);
          if (completed) takes.push(completed);
        } else this.pushRing(channels, offset);
      } else if (this.state === 'recording') {
        this.append(channels, offset);
        const completed = this.maybeComplete(peak);
        if (completed) takes.push(completed);
      } else if (this.state === 'waiting-for-quiet') {
        this.pushRing(channels, offset);
        if (peak < this.options.low) this.rearmQuietFrames += 1;
        else this.rearmQuietFrames = 0;
        if (!this.pendingTake && this.rearmQuietFrames >= this.options.rearmFrames) this.state = 'armed';
      }
    }
    this.expectedFrame = firstFrame + length;
    const meter = this.meterOutstanding ? undefined : { frame: firstFrame, peaks, recordedFrames:this.state==='recording'?this.activeLength:0 };
    if (meter) this.meterOutstanding = true;
    return { takes, meter, state: this.state };
  }

  stop(): CaptureProcessResult {
    const takes: CompletedTakeFrames[] = [];
    if (this.state === 'recording' && this.activeLength > 0 && this.activeNonzero) {
      const completed = this.complete('manual');
      if (completed) takes.push(completed);
    }
    this.state = 'stopped';
    return { takes, state: this.state };
  }

  close() {
    this.state = 'closed';
    this.pendingTake = false;
    this.activeLength = this.ringLength = 0;
  }

  private beginTake(onsetFrame: number, includePreRoll: boolean) {
    if (this.active.length !== this.options.channels) throw new Error('No take buffer credit is available');
    this.activeLength = 0;
    this.activeNonzero = false;
    this.quietFrames = 0;
    let available = includePreRoll ? Math.min(this.ringLength, this.options.preRollFrames, onsetFrame - this.lastTakeEnd) : 0;
    available = Math.max(0, available);
    const start = onsetFrame - available;
    this.activeStart = start;
    this.activePreRoll = available;
    for (let index = 0; index < available; index += 1) {
      const ringIndex = (this.ringWrite - available + index + Math.max(1, this.options.preRollFrames)) % Math.max(1, this.options.preRollFrames);
      for (let channel = 0; channel < this.options.channels; channel += 1) {
        const value = this.ring[channel][ringIndex];
        this.active[channel][this.activeLength] = value;
        if (value !== 0) this.activeNonzero = true;
      }
      this.activeLength += 1;
    }
    this.state = 'recording';
  }

  private append(channels: readonly Float32Array[], offset: number) {
    if (this.activeLength >= this.options.maxFrames) return;
    for (let channel = 0; channel < channels.length; channel += 1) {
      const value = channels[channel][offset];
      this.active[channel][this.activeLength] = value;
      if (value !== 0) this.activeNonzero = true;
    }
    this.activeLength += 1;
  }

  private maybeComplete(peak: number) {
    if (peak < this.options.low) this.quietFrames += 1;
    else this.quietFrames = 0;
    if (this.activeLength >= this.options.maxFrames) return this.complete('length');
    if (this.options.mode === 'sound' && this.quietFrames >= this.options.silenceFrames) return this.complete('silence');
    return undefined;
  }

  private complete(reason: CompletionReason): CompletedTakeFrames | undefined {
    if (!this.activeNonzero && this.options.mode === 'manual') {
      this.lastTakeEnd = this.activeStart + this.activeLength;
      this.activeLength = 0;
      this.state = 'monitoring';
      return undefined;
    }
    const frames = this.activeLength;
    const result = {
      startFrame: this.activeStart,
      endFrame: this.activeStart + frames,
      frames,
      preRollFrames: this.activePreRoll,
      reason,
      // Ownership of these preallocated arrays is handed off whole. The receiver
      // materializes only [0, frames) and returns credit with a fresh buffer set.
      channels: this.active,
    };
    this.lastTakeEnd = result.endFrame;
    this.pendingTake = true;
    this.active = [];
    this.rearmQuietFrames = 0;
    this.activeLength = 0;
    this.state = this.options.mode === 'sound' ? 'waiting-for-quiet' : 'monitoring';
    return result;
  }

  private pushRing(channels: readonly Float32Array[], offset: number) {
    if (this.options.preRollFrames === 0) return;
    for (let channel = 0; channel < channels.length; channel += 1) this.ring[channel][this.ringWrite] = channels[channel][offset];
    this.ringWrite = (this.ringWrite + 1) % this.options.preRollFrames;
    this.ringLength = Math.min(this.options.preRollFrames, this.ringLength + 1);
  }
}
