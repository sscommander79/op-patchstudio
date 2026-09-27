import { AUDIO_CONSTANTS } from './constants';

export interface SampleReference {
  sample: string;
}

export interface AudioConversionPlan {
  needsConversion: boolean;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  sourceFrames: number;
  outputFrames: number;
}

export function convertedFrameCount(sourceFrames: number, sourceSampleRate: number, targetSampleRate: number): number {
  return sourceSampleRate === targetSampleRate
    ? sourceFrames
    : Math.ceil(sourceFrames * targetSampleRate / sourceSampleRate);
}

export function planAudioConversion(options: {
  sourceBuffer: AudioBuffer;
  originalSampleRate?: number;
  originalBitDepth?: number;
  targetSampleRate?: number;
  targetBitDepth?: number;
  targetChannels?: string;
  normalize: boolean;
  cutAtLoopEnd?: boolean;
  loopEndFrame?: number;
}): AudioConversionPlan {
  const {
    sourceBuffer,
    originalSampleRate,
    originalBitDepth,
    targetSampleRate,
    targetBitDepth,
    targetChannels,
    normalize,
    cutAtLoopEnd = false,
    loopEndFrame,
  } = options;
  const needsConversion =
    Boolean(targetSampleRate && sourceBuffer.sampleRate !== targetSampleRate) ||
    Boolean(targetBitDepth && targetBitDepth !== originalBitDepth) ||
    (targetChannels === 'mono' && sourceBuffer.numberOfChannels > 1) ||
    normalize ||
    cutAtLoopEnd;
  const sampleRate = targetSampleRate || (needsConversion ? originalSampleRate || sourceBuffer.sampleRate : sourceBuffer.sampleRate);
  const channels = targetChannels === 'mono' ? 1 : sourceBuffer.numberOfChannels;
  const bitDepth = targetBitDepth || originalBitDepth || 16;
  const sourceFrames = cutAtLoopEnd && loopEndFrame && loopEndFrame > 0 && loopEndFrame < sourceBuffer.length && loopEndFrame + AUDIO_CONSTANTS.LOOP_END_PADDING < sourceBuffer.length
    ? loopEndFrame + AUDIO_CONSTANTS.LOOP_END_PADDING
    : sourceBuffer.length;
  return {
    needsConversion,
    sampleRate,
    bitDepth,
    channels,
    sourceFrames,
    outputFrames: convertedFrameCount(sourceFrames, sourceBuffer.sampleRate, sampleRate),
  };
}

function splitExtension(filename: string): { stem: string; extension: string } {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return { stem: filename, extension: '' };
  return { stem: filename.slice(0, dot), extension: filename.slice(dot) };
}

/**
 * Resolve every archive filename in input order. Collisions are compared without
 * case so an archive remains safe when copied to a case-insensitive filesystem.
 */
export function allocateUniqueExportNames(desiredNames: readonly string[]): string[] {
  const used = new Set<string>();

  return desiredNames.map((desiredName) => {
    const { stem, extension } = splitExtension(desiredName);
    let candidate = desiredName;
    let suffix = 2;

    while (used.has(candidate.toLowerCase())) {
      candidate = `${stem}-${suffix}${extension}`;
      suffix += 1;
    }

    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Ensure patch.json cannot name audio that is absent from the archive. */
export function validateArchiveReferences(
  regions: readonly SampleReference[],
  archiveNames: readonly string[],
): void {
  const available = new Set(archiveNames);
  const missing = regions.map((region) => region.sample).filter((name) => !available.has(name));

  if (missing.length > 0) {
    throw new Error(`Export plan references missing audio: ${[...new Set(missing)].join(', ')}`);
  }
}
