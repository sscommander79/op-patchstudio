export interface FrameRange {
  start: number;
  end: number;
}

export interface NormalizedSampleAndLoop {
  sample: FrameRange;
  loop: FrameRange;
}

const finite = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(value, maximum));

export function framesToSeconds(frame: number, sampleRate: number): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
  return frame / sampleRate;
}

export function secondsToFrames(seconds: number | undefined, sampleRate: number, frameCount: number): number {
  const safeFrameCount = Math.max(0, Math.floor(finite(frameCount, 0)));
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
  return clamp(Math.round(finite(seconds, 0) * sampleRate), 0, safeFrameCount);
}

export function normalizeFrameRange(frameCount: number, range: Partial<FrameRange> | undefined): FrameRange {
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new RangeError('Frame count must be a positive integer');
  }
  const safeFrameCount = frameCount;
  const start = clamp(Math.round(finite(range?.start, 0)), 0, safeFrameCount - 1);
  const end = clamp(Math.round(finite(range?.end, safeFrameCount)), start + 1, safeFrameCount);
  return { start, end };
}

export function normalizeSampleAndLoop(
  frameCount: number,
  sampleRange: Partial<FrameRange> | undefined,
  loopRange: Partial<FrameRange> | undefined,
): NormalizedSampleAndLoop {
  const sample = normalizeFrameRange(frameCount, sampleRange);
  const requestedStart = Math.round(finite(loopRange?.start, sample.start));
  const requestedEnd = Math.round(finite(loopRange?.end, sample.end));

  if (requestedEnd <= sample.start) {
    return { sample, loop: { start: sample.start, end: sample.start + 1 } };
  }
  if (requestedStart >= sample.end) {
    return { sample, loop: { start: sample.end - 1, end: sample.end } };
  }

  const loopStart = clamp(requestedStart, sample.start, sample.end - 1);
  const loopEnd = clamp(requestedEnd, loopStart + 1, sample.end);
  return { sample, loop: { start: loopStart, end: loopEnd } };
}

export function normalizeSecondRanges(
  frameCount: number,
  sampleRate: number,
  sample: { start?: number; end?: number },
  loop?: { start?: number; end?: number },
): NormalizedSampleAndLoop {
  return normalizeSampleAndLoop(
    frameCount,
    {
      start: secondsToFrames(sample.start, sampleRate, frameCount),
      end: secondsToFrames(sample.end ?? framesToSeconds(frameCount, sampleRate), sampleRate, frameCount),
    },
    loop
      ? {
          start: secondsToFrames(loop.start, sampleRate, frameCount),
          end: secondsToFrames(loop.end ?? framesToSeconds(frameCount, sampleRate), sampleRate, frameCount),
        }
      : undefined,
  );
}

/**
 * Make a browser-preview copy whose loop head fades from the matching tail.
 * This is an approximate overlap fade; export audio remains untouched and the
 * OP-XY receives only its loop.crossfade metadata.
 */
export function crossfadeLoopChannels(
  channels: readonly Float32Array[],
  loop: FrameRange,
  requestedFrames: number,
): Float32Array[] {
  const output = channels.map((channel) => new Float32Array(channel));
  if (channels.length === 0) return output;
  const frameCount = channels[0].length;
  if (frameCount === 0) return output;
  const normalized = normalizeFrameRange(frameCount, loop);
  const loopLength = normalized.end - normalized.start;
  const fadeFrames = clamp(Math.round(finite(requestedFrames, 0)), 0, Math.floor(loopLength / 2));
  if (fadeFrames === 0) return output;

  for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
    const source = channels[channelIndex];
    const destination = output[channelIndex];
    for (let index = 0; index < fadeFrames; index += 1) {
      const headIndex = normalized.start + index;
      const tailIndex = normalized.end - fadeFrames + index;
      const headWeight = fadeFrames === 1 ? 0.5 : index / (fadeFrames - 1);
      const tailValue = index === 0 ? source[normalized.end - 1] : source[tailIndex];
      destination[headIndex] = tailValue * (1 - headWeight) + source[headIndex] * headWeight;
    }
  }
  return output;
}

export interface PreviewClock {
  startedAt: number;
  startFrame: number;
  sample: FrameRange;
  loop: FrameRange;
  loopEnabled: boolean;
  sampleRate: number;
  playbackRate: number;
  reverse: boolean;
}

export function previewFrameAtTime(clock: PreviewClock, currentTime: number): number {
  const elapsedFrames = Math.max(0, currentTime - clock.startedAt) * clock.sampleRate * Math.abs(clock.playbackRate || 1);
  const direction = clock.reverse ? -1 : 1;
  const raw = clock.startFrame + direction * elapsedFrames;
  if (!clock.loopEnabled) return clamp(Math.round(raw), clock.sample.start, clock.sample.end);

  const loopLength = clock.loop.end - clock.loop.start;
  if (loopLength <= 0) return clamp(Math.round(raw), clock.sample.start, clock.sample.end);
  if (!clock.reverse) {
    if (raw < clock.loop.start) return clamp(Math.round(raw), clock.sample.start, clock.sample.end);
    return Math.round(clock.loop.start + ((raw - clock.loop.start) % loopLength));
  }
  if (raw > clock.loop.end) return clamp(Math.round(raw), clock.sample.start, clock.sample.end);
  const travelled = clock.loop.end - raw;
  if (travelled <= loopLength) return Math.round(raw);
  return Math.round(clock.loop.end - (travelled % loopLength));
}
