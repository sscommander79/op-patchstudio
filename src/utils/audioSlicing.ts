import type { DrumSample } from '../context/AppContext';
import type { AppAction } from '../context/AppContext';
import type { AudioMetadata } from './audioFormats';
import { normalizeFrameRange, type FrameRange } from './loopEditing';
import { encodeStoredAudio, STORED_AUDIO_TYPE } from './storedAudio';

/** STORE ZIP: EOCD plus local/central headers and each UTF-8 path twice. */
export function storedZipStructureBytes(paths:readonly string[]):number {
  const encoder=new TextEncoder();
  return 22+paths.reduce((sum,path)=>sum+76+2*encoder.encode(path).byteLength,0);
}

const MAX_PROJECT_ARCHIVE_PATHS=[
  'manifest.json',
  ...Array.from({length:256},(_,index)=>`assets/audio-${String(index).padStart(4,'0')}.opfloat`),
  ...Array.from({length:256},(_,index)=>`assets/source-${String(index).padStart(4,'0')}.bin`),
];

export const SLICE_LIMITS = {
  sourceFileBytes: 64 * 1024 * 1024,
  decodedSourceBytes: 64 * 1024 * 1024,
  derivedDecodedBytes: 64 * 1024 * 1024,
  projectDecodedBytes: 128 * 1024 * 1024,
  projectStoredBytes: 256 * 1024 * 1024,
  projectManifestReserveBytes: 2 * 1024 * 1024,
  projectZipStructureReserveBytes: storedZipStructureBytes(MAX_PROJECT_ARCHIVE_PATHS),
  projectSamples: 256,
  sliceCount: 128,
} as const;
const STORED_AUDIO_HEADER_BYTES = 24;

export interface SliceAnalysis {
  onsets: number[];
  ranges: FrameRange[];
  reason?: 'no-onsets';
}

export interface SliceAnalysisOptions {
  sensitivity: number;
  minimumSpacingFrames: number;
}

interface AsyncAnalysisOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  yieldEveryFrames?: number;
  yieldControl?: () => Promise<void>;
}

function abortError(): DOMException {
  return new DOMException('Slice analysis canceled', 'AbortError');
}

function assertAudioDimensions(audio: AudioBuffer) {
  const decodedBytes = audio.length * audio.numberOfChannels * 4;
  if (!Number.isSafeInteger(decodedBytes) || audio.length < 1 || audio.numberOfChannels < 1) {
    throw new Error('Slice source has invalid audio dimensions');
  }
  if (decodedBytes > SLICE_LIMITS.decodedSourceBytes) {
    throw new Error('Decoded source exceeds the 64 MiB slicing limit');
  }
  return decodedBytes;
}

function amplitudeAt(channels: readonly Float32Array[], frame: number): number {
  let peak = 0;
  for (let channel = 0; channel < channels.length; channel += 1) {
    peak = Math.max(peak, Math.abs(channels[channel][frame] ?? 0));
  }
  return peak;
}

function highFrequencyAt(channels: readonly Float32Array[], frame: number): number {
  let peak = 0;
  for (let channel = 0; channel < channels.length; channel += 1) {
    peak = Math.max(peak, Math.abs((channels[channel][frame] ?? 0) - (frame > 0 ? channels[channel][frame - 1] ?? 0 : 0)));
  }
  return peak;
}

function leadingEdge(
  metricAt: (frame: number) => number,
  peakFrame: number,
  lookback: number,
  threshold: number,
  epsilon: number,
  quietFrames: number,
  refinementFrames: number,
): number {
  const earliest = Math.max(0, peakFrame - lookback);
  let attackFrame = peakFrame;
  let quietRun = 0;
  let foundActivity = false;
  for (let frame = earliest; frame <= peakFrame; frame += 1) {
    if (metricAt(frame) <= threshold) {
      quietRun += 1;
    } else {
      if (!foundActivity || quietRun >= quietFrames) attackFrame = frame;
      foundActivity = true;
      quietRun = 0;
    }
  }

  // Refine only immediately before the strong edge, using nearby background
  // rather than the file-wide peak. Requiring local quiet avoids walking an
  // onset backward through a continuously active ringing tail.
  const refinementStart = Math.max(earliest, attackFrame - refinementFrames);
  const floorStart = Math.max(0, refinementStart - refinementFrames);
  let floorEnergy = 0;
  for (let frame = floorStart; frame < refinementStart; frame += 1) {
    const value = metricAt(frame);
    floorEnergy += value * value;
  }
  const floorFrames = refinementStart - floorStart;
  const localThreshold = Math.max(epsilon, floorFrames ? Math.sqrt(floorEnergy / floorFrames) * 3 : epsilon);
  let refinedFrame = attackFrame;
  quietRun = 0;
  for (let frame = refinementStart; frame <= attackFrame; frame += 1) {
    if (metricAt(frame) <= localThreshold) {
      quietRun += 1;
    } else {
      if (quietRun >= quietFrames) refinedFrame = frame;
      quietRun = 0;
    }
  }
  return refinedFrame;
}

/**
 * Tested transient heuristic: channel-wise peak energy plus first-difference
 * novelty, adaptive noise floors, local peak selection, independent short
 * quiet-period rearming and minimum spacing.
 * It deliberately does not claim instrument or beat understanding.
 */
export async function analyzeSlices(
  audio: AudioBuffer,
  options: SliceAnalysisOptions,
  asyncOptions: AsyncAnalysisOptions = {},
): Promise<SliceAnalysis> {
  assertAudioDimensions(audio);
  if (asyncOptions.signal?.aborted) throw abortError();
  const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
  const signal = asyncOptions.signal;
  const yieldEvery = Math.max(256, Math.floor(asyncOptions.yieldEveryFrames ?? 32768));
  const yieldControl = asyncOptions.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  const checkpoint = async (frame: number, phase: number) => {
    if (signal?.aborted) throw abortError();
    asyncOptions.onProgress?.(Math.min(.99, phase + (frame / audio.length) * .45));
    await yieldControl();
    if (signal?.aborted) throw abortError();
  };

  const sampleCount = Math.min(audio.length, 8192);
  const distribution: number[] = [];
  const highFrequencyDistribution: number[] = [];
  let peak = 0, highFrequencyPeak = 0;
  for (let frame = 0; frame < audio.length; frame += 1) {
    const amplitude = amplitudeAt(channels, frame);
    const highFrequency = highFrequencyAt(channels, frame);
    peak = Math.max(peak, amplitude);
    highFrequencyPeak = Math.max(highFrequencyPeak, highFrequency);
    if (frame % Math.max(1, Math.floor(audio.length / sampleCount)) === 0 && distribution.length < sampleCount) {
      distribution.push(amplitude);
      highFrequencyDistribution.push(highFrequency);
    }
    if (frame > 0 && frame % yieldEvery === 0) await checkpoint(frame, 0);
  }
  distribution.sort((a, b) => a - b);
  highFrequencyDistribution.sort((a, b) => a - b);
  const noiseFloor = distribution[Math.floor(distribution.length * .5)] ?? 0;
  const highFrequencyFloor = highFrequencyDistribution[Math.floor(highFrequencyDistribution.length * .5)] ?? 0;
  if (audio.length === 1) {
    asyncOptions.onProgress?.(1);
    return peak >= 1e-5 ? { onsets: [0], ranges: [{ start: 0, end: 1 }] } : { onsets: [], ranges: [], reason: 'no-onsets' };
  }
  if (peak < 1e-5 || peak <= Math.max(1e-5, noiseFloor * 1.5)) {
    asyncOptions.onProgress?.(1);
    return { onsets: [], ranges: [], reason: 'no-onsets' };
  }

  const sensitivity = Math.max(0, Math.min(1, Number.isFinite(options.sensitivity) ? options.sensitivity : .5));
  const threshold = noiseFloor + (peak - noiseFloor) * (.62 - sensitivity * .52);
  const highFrequencyThreshold = highFrequencyFloor + (highFrequencyPeak - highFrequencyFloor) * (.62 - sensitivity * .52);
  const spacing = Math.max(1, Math.round(options.minimumSpacingFrames || 1));
  const accepted: Array<{ frame: number; peakFrame: number; strength: number }> = [];
  const activityThreshold = Math.max(1e-5, noiseFloor * 3, peak * .001);
  const quietThreshold = Math.max(activityThreshold, threshold * .1);
  const highFrequencyActivityThreshold = Math.max(1e-5, highFrequencyFloor * 3, highFrequencyPeak * .001);
  const highFrequencyQuietThreshold = Math.max(highFrequencyActivityThreshold, highFrequencyThreshold * .1);
  const rearmFrames = Math.max(1, Math.min(spacing, Math.round(audio.sampleRate * .005)));
  const attackLookback = Math.max(1, Math.min(spacing, Math.round(audio.sampleRate * .05)));
  const leadingQuietFrames = Math.max(1, Math.round(audio.sampleRate * .0005));
  const refinementFrames = Math.max(1, Math.min(attackLookback, Math.round(audio.sampleRate * .01)));
  let lastActiveFrame = -1;
  let baseline = noiseFloor, highFrequencyBaseline = highFrequencyFloor;
  let armed = true, highFrequencyArmed = true;
  let quietFrames = rearmFrames, highFrequencyQuietFrames = rearmFrames;
  for (let frame = 0; frame < audio.length; frame += 1) {
    const amplitude = amplitudeAt(channels, frame);
    const previous = frame > 0 ? amplitudeAt(channels, frame - 1) : 0;
    const next = frame + 1 < audio.length ? amplitudeAt(channels, frame + 1) : 0;
    const highFrequency = highFrequencyAt(channels, frame);
    const previousHighFrequency = frame > 0 ? highFrequencyAt(channels, frame - 1) : 0;
    const nextHighFrequency = frame + 1 < audio.length ? highFrequencyAt(channels, frame + 1) : 0;
    if (amplitude > activityThreshold) lastActiveFrame = frame;
    const amplitudeQuietBefore = quietFrames;
    const highFrequencyQuietBefore = highFrequencyQuietFrames;
    if (amplitude <= quietThreshold) quietFrames += 1;
    else quietFrames = 0;
    if (quietFrames >= rearmFrames) armed = true;
    if (highFrequency <= highFrequencyQuietThreshold) highFrequencyQuietFrames += 1;
    else highFrequencyQuietFrames = 0;
    if (highFrequencyQuietFrames >= rearmFrames) highFrequencyArmed = true;
    const rise = amplitude - Math.max(baseline, previous * .35);
    const highFrequencyRise = highFrequency - Math.max(highFrequencyBaseline, previousHighFrequency * .35);
    const amplitudePeak = amplitude >= threshold && rise >= threshold * .45 && amplitude >= previous && amplitude >= next;
    const transientPeak = amplitude > activityThreshold && highFrequency >= highFrequencyThreshold && highFrequencyRise >= highFrequencyThreshold * .45
      && highFrequency >= previousHighFrequency && highFrequency >= nextHighFrequency;
    if (amplitudePeak || transientPeak) {
      const prior = accepted[accepted.length - 1];
      const withinPriorSpacing = !!prior && frame - prior.peakFrame < spacing;
      const amplitudeAvailable = amplitudePeak && (armed || !prior || withinPriorSpacing);
      const transientAvailable = transientPeak && (highFrequencyArmed || !prior || withinPriorSpacing);
      if (amplitudeAvailable || transientAvailable) {
        const useTransient = transientAvailable && (!amplitudeAvailable || highFrequency / highFrequencyThreshold > amplitude / threshold);
        const strength = Math.max(amplitude / threshold, highFrequency / highFrequencyThreshold);
        // Backtracking can only move earlier, so a weaker peak already inside
        // frame spacing cannot become an admissible or replacement candidate.
        if (!prior || frame - prior.frame >= spacing || strength > prior.strength) {
          const attackFrame = useTransient
            ? leadingEdge(candidateFrame => highFrequencyAt(channels, candidateFrame), frame, attackLookback, highFrequencyQuietThreshold, 1e-7, leadingQuietFrames, refinementFrames)
            : leadingEdge(candidateFrame => amplitudeAt(channels, candidateFrame), frame, attackLookback, quietThreshold, 1e-7, leadingQuietFrames, refinementFrames);
          const quietBefore = useTransient ? highFrequencyQuietBefore : amplitudeQuietBefore;
          const sameContinuousAttack = !!prior && attackFrame - prior.frame < spacing && quietBefore < leadingQuietFrames;
          const candidate = { frame: sameContinuousAttack ? Math.min(prior.frame, attackFrame) : attackFrame, peakFrame: frame, strength };
          if (!prior || candidate.frame - prior.frame >= spacing) accepted.push(candidate);
          else if (candidate.strength > prior.strength) accepted[accepted.length - 1] = candidate;
        }
        if (amplitudePeak) { armed = false; quietFrames = 0; }
        if (transientPeak) { highFrequencyArmed = false; highFrequencyQuietFrames = 0; }
      }
      if (accepted.length > SLICE_LIMITS.sliceCount) {
        throw new Error(`Analysis found more than ${SLICE_LIMITS.sliceCount} onsets; increase minimum spacing or reduce sensitivity`);
      }
    }
    baseline = baseline * .995 + amplitude * .005;
    highFrequencyBaseline = highFrequencyBaseline * .995 + highFrequency * .005;
    if (frame > 0 && frame % yieldEvery === 0) await checkpoint(frame, .5);
  }
  if (!accepted.length) {
    asyncOptions.onProgress?.(1);
    return { onsets: [], ranges: [], reason: 'no-onsets' };
  }

  const contentEnd = Math.max(accepted[accepted.length - 1].frame + 1, lastActiveFrame + 1);
  const onsets = accepted.map(candidate => candidate.frame).filter(frame => frame < contentEnd);
  const ranges = onsets.map((start, index) => ({ start, end: index + 1 < onsets.length ? onsets[index + 1] : contentEnd }))
    .filter(range => range.end > range.start);
  asyncOptions.onProgress?.(1);
  return ranges.length ? { onsets: ranges.map(range => range.start), ranges } : { onsets: [], ranges: [], reason: 'no-onsets' };
}

export function normalizeSliceMarkers(frameCount: number, markers: readonly number[]): number[] {
  if (!Number.isInteger(frameCount) || frameCount < 1) throw new RangeError('Frame count must be a positive integer');
  return [...new Set(markers.map(value => Math.max(0, Math.min(frameCount - 1, Math.round(Number.isFinite(value) ? value : 0)))))]
    .sort((a, b) => a - b);
}

export function buildSliceRanges(frameCount: number, markers: readonly number[], requestedEnd = frameCount): FrameRange[] {
  const endFrame = Math.max(1, Math.min(frameCount, Math.round(requestedEnd)));
  const starts = normalizeSliceMarkers(frameCount, markers).filter(start => start < endFrame);
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? endFrame })).filter(range => range.end > range.start);
}

function createAudioBuffer(channels: number, frames: number, sampleRate: number): AudioBuffer {
  return new AudioBuffer({ numberOfChannels: channels, length: frames, sampleRate });
}

export function materializeSlice(source: AudioBuffer, requested: FrameRange, allocator = createAudioBuffer): AudioBuffer {
  assertAudioDimensions(source);
  const range = normalizeFrameRange(source.length, requested);
  const output = allocator(source.numberOfChannels, range.end - range.start, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const view = source.getChannelData(channel).subarray(range.start, range.end);
    if (typeof output.copyToChannel === 'function') output.copyToChannel(view, channel);
    else output.getChannelData(channel).set(view);
  }
  return output;
}

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
}

export interface SliceSourceDimensions { channels: number; frames: number; sampleRate: number; decodedBytes: number }

export function inspectSliceSource(arrayBuffer: ArrayBuffer, name: string): SliceSourceDimensions {
  if (arrayBuffer.byteLength < 12 || arrayBuffer.byteLength > SLICE_LIMITS.sourceFileBytes) throw new Error('Slice source file must be a nonempty WAV or AIFF no larger than 64 MiB');
  const bytes = new Uint8Array(arrayBuffer), view = new DataView(arrayBuffer);
  let channels = 0, frames = 0, sampleRate = 0;
  if (fourCC(bytes, 0) === 'RIFF' && fourCC(bytes, 8) === 'WAVE') {
    const riffBytes=view.getUint32(4,true)+8;
    if(riffBytes<12 || riffBytes!==bytes.length)throw new Error(`${name} has a RIFF size that does not match the file`);
    let blockAlign = 0, dataBytes = 0, audioFormat = 0, bitDepth=0;
    let offset=12;
    for (; offset + 8 <= riffBytes;) {
      const id = fourCC(bytes, offset), size = view.getUint32(offset + 4, true), body = offset + 8;
      if (!Number.isSafeInteger(body + size) || body + size > riffBytes) throw new Error(`${name} has a WAV chunk outside its declared RIFF body`);
      if (id === 'fmt ' && size >= 16 && body + 16 <= bytes.length) {
        audioFormat = view.getUint16(body, true); channels = view.getUint16(body + 2, true); sampleRate = view.getUint32(body + 4, true); blockAlign = view.getUint16(body + 12, true); bitDepth=view.getUint16(body+14,true);
      } else if (id === 'data') dataBytes = size;
      const next = body + size + (size % 2);
      if (next <= offset || next>riffBytes) throw new Error('Invalid WAV chunk dimensions or padding');
      offset = next;
    }
    if(offset!==riffBytes)throw new Error(`${name} has a truncated WAV chunk header`);
    if (audioFormat !== 1 && audioFormat !== 3) throw new Error(`${name} uses compressed WAV audio; the slicing source chooser accepts PCM or IEEE-float WAV`);
    const supportedDepth=audioFormat===1?[8,16,24,32].includes(bitDepth):[32,64].includes(bitDepth);
    if(!supportedDepth || blockAlign!==channels*Math.ceil(bitDepth/8))throw new Error(`${name} has invalid PCM block alignment or sample width`);
    if (blockAlign > 0 && dataBytes % blockAlign === 0) frames = dataBytes / blockAlign;
  } else if (fourCC(bytes, 0) === 'FORM' && fourCC(bytes, 8) === 'AIFF') {
    const formBytes=view.getUint32(4,false)+8;
    if(formBytes<12 || formBytes!==bytes.length)throw new Error(`${name} has a FORM size that does not match the file`);
    let bitDepth = 0, soundBytes = 0;
    let offset=12;
    for (; offset + 8 <= formBytes;) {
      const id = fourCC(bytes, offset), size = view.getUint32(offset + 4, false), body = offset + 8;
      if (!Number.isSafeInteger(body + size) || body + size > formBytes) throw new Error(`${name} has an AIFF chunk outside its declared FORM body`);
      if (id === 'COMM' && size >= 18 && body + 18 <= bytes.length) {
        channels = view.getUint16(body, false); frames = view.getUint32(body + 2, false); bitDepth = view.getUint16(body + 6, false);
        // 80-bit extended parsing is already validated by the full AIFF reader; use a finite coarse decode here.
        const exponent = view.getUint16(body + 8, false) & 0x7fff;
        const high = view.getUint32(body + 10, false), low = view.getUint32(body + 14, false);
        sampleRate = exponent === 0 ? 0 : Math.round((high * 2 ** 32 + low) * 2 ** (exponent - 16383 - 63));
      } else if (id === 'SSND' && size >= 8) {
        const audioOffset=view.getUint32(body,false);
        if(audioOffset>size-8)throw new Error(`${name} has an invalid AIFF sound offset`);
        soundBytes = size - 8 - audioOffset;
      }
      const next = body + size + (size % 2); if (next <= offset || next>formBytes) throw new Error('Invalid AIFF chunk dimensions or padding'); offset = next;
    }
    if(offset!==formBytes)throw new Error(`${name} has a truncated AIFF chunk header`);
    const requiredBytes = frames * channels * Math.ceil(bitDepth / 8);
    if (!Number.isSafeInteger(requiredBytes) || requiredBytes > soundBytes) throw new Error(`${name} has truncated AIFF sample data`);
  } else if (fourCC(bytes, 0) === 'FORM' && fourCC(bytes, 8) === 'AIFC') {
    throw new Error(`${name} uses compressed AIFF-C audio; the slicing source chooser accepts uncompressed AIFF`);
  } else throw new Error(`${name} is not a supported WAV or AIFF slicing source`);
  const decodedBytes = channels * frames * 4;
  if (!Number.isInteger(channels) || channels < 1 || channels > 32 || !Number.isInteger(frames) || frames < 1 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 768000 || !Number.isSafeInteger(decodedBytes)) {
    throw new Error(`${name} has invalid or unsupported audio dimensions`);
  }
  if (decodedBytes > SLICE_LIMITS.decodedSourceBytes) throw new Error('Decoded source exceeds the 64 MiB slicing limit');
  return { channels, frames, sampleRate, decodedBytes };
}

export type ProjectAudioAsset = Pick<DrumSample, 'audioBuffer' | 'file' | 'isLoaded' | 'sliceProvenance'> | {
  audioBuffer?: AudioBuffer | null; file?: File | null; isLoaded?: boolean; sliceProvenance?: DrumSample['sliceProvenance'];
};

export interface ProjectAudioAddition {audioBuffer:AudioBuffer;fileSize:number;hasSourceFile:boolean}

/** Shared portable-project admission using logical opfloat multiplicity and ordinary source copies. */
export function planProjectAudioCapacity(existingSamples:readonly ProjectAudioAsset[],additions:readonly ProjectAudioAddition[]) {
  const loaded=existingSamples.filter(sample=>sample.isLoaded&&sample.audioBuffer);
  if(loaded.length+additions.length>SLICE_LIMITS.projectSamples)throw new Error('Applying this audio would exceed the 256-sample project limit');
  const logicalBytes=(audio:AudioBuffer)=>{
    const pcm=audio.length*audio.numberOfChannels*4;
    if(!Number.isSafeInteger(pcm)||audio.length<1||audio.numberOfChannels<1)return NaN;
    return STORED_AUDIO_HEADER_BYTES+pcm;
  };
  let decodedBytes=0,storedBytes=0;
  for(const sample of loaded){const logical=logicalBytes(sample.audioBuffer!);if(!Number.isSafeInteger(logical))throw new Error('Project audio has invalid dimensions');
    decodedBytes+=logical;storedBytes+=logical+(sample.sliceProvenance?0:sample.file?.size??0);}
  for(const addition of additions){const logical=logicalBytes(addition.audioBuffer);if(!Number.isSafeInteger(logical)||!Number.isSafeInteger(addition.fileSize)||addition.fileSize<0)throw new Error('Recorded audio has invalid dimensions');
    decodedBytes+=logical;storedBytes+=logical+(addition.hasSourceFile?addition.fileSize:0);}
  if(!Number.isSafeInteger(decodedBytes)||decodedBytes>SLICE_LIMITS.projectDecodedBytes)throw new Error('Applying this audio would exceed the 128 MiB decoded-project limit');
  const projectedArchiveBytes=storedBytes+SLICE_LIMITS.projectManifestReserveBytes+SLICE_LIMITS.projectZipStructureReserveBytes;
  if(!Number.isSafeInteger(projectedArchiveBytes)||projectedArchiveBytes>SLICE_LIMITS.projectStoredBytes)throw new Error('Applying this audio would exceed the portable project size limit, including manifest and ZIP reserves');
  return {sampleCount:loaded.length+additions.length,decodedBytes,storedBytes,projectedArchiveBytes};
}

export function planSliceApplication({ source, ranges, existingSamples, retainExternalSource, sourceFileBytes }: {
  source: AudioBuffer; ranges: readonly FrameRange[]; existingSamples: readonly ProjectAudioAsset[];
  retainExternalSource: boolean; sourceFileBytes: number;
}) {
  const sourceDecodedBytes = assertAudioDimensions(source);
  if (!ranges.length) throw new Error('Add at least one nonempty slice before applying');
  if (ranges.length > SLICE_LIMITS.sliceCount) throw new Error(`A source can create at most ${SLICE_LIMITS.sliceCount} slices`);
  let derivedDecodedBytes = 0;
  for (const requested of ranges) {
    const range = normalizeFrameRange(source.length, requested);
    if (range.start !== requested.start || range.end !== requested.end) throw new Error('Slice boundaries must be canonical half-open source frames');
    derivedDecodedBytes += (range.end - range.start) * source.numberOfChannels * 4;
  }
  if (derivedDecodedBytes > SLICE_LIMITS.derivedDecodedBytes) throw new Error('Materialized slices exceed the 64 MiB derived-audio limit');
  const loaded = existingSamples.filter(sample => sample.isLoaded && sample.audioBuffer);
  const storedAudioBytes = (sample:ProjectAudioAsset) => STORED_AUDIO_HEADER_BYTES + sample.audioBuffer!.length * sample.audioBuffer!.numberOfChannels * 4;
  const existingDecodedBytes = loaded.reduce((sum, sample) => sum + storedAudioBytes(sample), 0);
  const existingStoredBytes = loaded.reduce((sum, sample) => sum + storedAudioBytes(sample) + (sample.sliceProvenance ? 0 : sample.file?.size ?? 0), 0);
  const retainedDecodedBytes = retainExternalSource ? sourceDecodedBytes + STORED_AUDIO_HEADER_BYTES : 0;
  const derivedStoredAudioBytes = derivedDecodedBytes + ranges.length * STORED_AUDIO_HEADER_BYTES;
  const projectedDecodedBytes = existingDecodedBytes + retainedDecodedBytes + derivedStoredAudioBytes;
  const projectedStoredBytes = existingStoredBytes + retainedDecodedBytes + derivedStoredAudioBytes + (retainExternalSource ? sourceFileBytes : 0);
  const additionalSamples = ranges.length + (retainExternalSource ? 1 : 0);
  if (loaded.length + additionalSamples > SLICE_LIMITS.projectSamples) throw new Error('Applying these slices would exceed the 256-sample project limit');
  if (projectedDecodedBytes > SLICE_LIMITS.projectDecodedBytes) throw new Error('Applying these slices would exceed the 128 MiB decoded-project limit');
  const projectedArchiveBytes = projectedStoredBytes + SLICE_LIMITS.projectManifestReserveBytes + SLICE_LIMITS.projectZipStructureReserveBytes;
  if (projectedArchiveBytes > SLICE_LIMITS.projectStoredBytes) throw new Error('Applying these slices would exceed the portable project size limit, including its manifest reserve');
  return { additionalSamples, sourceDecodedBytes, derivedDecodedBytes, projectedDecodedBytes, projectedStoredBytes, projectedArchiveBytes };
}

export interface SliceSource {
  audioBuffer: AudioBuffer;
  file: File;
  metadata: AudioMetadata;
  existingIndex: number | null;
}

export interface SliceReplacementApproval {
  targetKeyIndex: number;
  sample: DrumSample;
}

interface SliceDestinationSnapshot {
  targetKeyIndex:number;
  sample:DrumSample|null;
  file:File|null;
  audioBuffer:AudioBuffer|null;
  state:string;
  replacementApproved:boolean;
}

function sampleState(sample:DrumSample):string {
  return JSON.stringify({name:sample.name,isLoaded:sample.isLoaded,inPoint:sample.inPoint,outPoint:sample.outPoint,originalBitDepth:sample.originalBitDepth,originalSampleRate:sample.originalSampleRate,originalChannels:sample.originalChannels,fileSize:sample.fileSize,duration:sample.duration,isFloat:sample.isFloat,playmode:sample.playmode,reverse:sample.reverse,transpose:sample.transpose,pan:sample.pan,gain:sample.gain,hasBeenEdited:sample.hasBeenEdited,isAssigned:sample.isAssigned,assignedKey:sample.assignedKey,sourceIdentity:sample.sourceIdentity,sliceProvenance:sample.sliceProvenance});
}

interface PrepareOptions {
  source: SliceSource;
  ranges: readonly FrameRange[];
  existingSamples: readonly DrumSample[];
  /** Omit to retain legacy commit-time empty-pad auto-fill. Null is explicitly unassigned. */
  mapping?: readonly (number | null)[];
  replacementApprovals?: readonly SliceReplacementApproval[];
  /** Loaded pads explicitly moved to Unassigned sounds in this same atomic operation. */
  unassignmentApprovals?: readonly SliceReplacementApproval[];
  projectAssets?: readonly ProjectAudioAsset[];
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  allocator?: (channels: number, frames: number, sampleRate: number) => AudioBuffer;
  yieldControl?: () => Promise<void>;
}

function uniqueSliceName(sourceName: string, ordinal: number, names: Set<string>): string {
  const base = sourceName.replace(/\.[^.]*$/, '') || 'slice';
  const stem = `${base} slice ${String(ordinal).padStart(2, '0')}`;
  let name = `${stem}.opfloat`, duplicate = 2;
  while (names.has(name.toLocaleLowerCase('en-US'))) name = `${stem}-${duplicate++}.opfloat`;
  names.add(name.toLocaleLowerCase('en-US'));
  return name;
}

function baseSample(file: File, audioBuffer: AudioBuffer, metadata: AudioMetadata): DrumSample {
  return {
    file, audioBuffer, name: file.name, isLoaded: true, inPoint: 0, outPoint: audioBuffer.duration,
    originalBitDepth: metadata.bitDepth, originalSampleRate: metadata.sourceSampleRate, originalChannels: metadata.sourceChannels,
    fileSize: file.size, duration: audioBuffer.duration, isFloat: metadata.isFloat,
    playmode: 'oneshot', reverse: false, transpose: 0, pan: 0, gain: 0, hasBeenEdited: false,
    isAssigned: false, assignedKey: undefined,
  };
}

/** Prepare every immutable asset before returning the single history BATCH. */
export async function prepareSliceApplication(options: PrepareOptions) {
  const { source, ranges, existingSamples } = options;
  if(options.mapping!==undefined) {
    if(options.mapping.length!==ranges.length)throw new Error('Slice mapping must contain one destination for every sound');
    const used=new Set<number>();
    for(const target of options.mapping) {
      if(target===null)continue;
      if(!Number.isInteger(target)||target<0||target>=24)throw new Error('Slice destinations must be whole pad numbers from 0 to 23');
      if(used.has(target))throw new Error('Only one sound can be assigned to each pad');
      used.add(target);
    }
  }
  planSliceApplication({
    source: source.audioBuffer, ranges, existingSamples: options.projectAssets ?? existingSamples,
    retainExternalSource: source.existingIndex === null, sourceFileBytes: source.file.size,
  });
  const canonicalRanges = ranges.map(range => normalizeFrameRange(source.audioBuffer.length, range));
  if (options.signal?.aborted) throw abortError();
  const sourceIdentity = source.existingIndex === null
    ? crypto.randomUUID()
    : existingSamples[source.existingIndex]?.sourceIdentity ?? crypto.randomUUID();
  const actions: AppAction[] = [];
  if (source.existingIndex === null) {
    actions.push({ type: 'STORE_DRUM_SAMPLE_ASSET', payload: { sample: { ...baseSample(source.file, source.audioBuffer, source.metadata), sourceIdentity }, targetKeyIndex: null } });
  } else if (!existingSamples[source.existingIndex]?.sourceIdentity) {
    actions.push({ type: 'UPDATE_DRUM_SAMPLE', payload: { index: source.existingIndex, updates: { sourceIdentity } } });
  }
  const emptyKeys = existingSamples.slice(0, 24).flatMap((sample, index) => sample?.isLoaded ? [] : [index]);
  const explicitMapping=options.mapping===undefined?undefined:Object.freeze([...options.mapping]);
  const approvalByKey=new Map<number,DrumSample>();
  for(const approval of options.replacementApprovals??[]) {
    if(!Number.isInteger(approval.targetKeyIndex)||approval.targetKeyIndex<0||approval.targetKeyIndex>=24||approvalByKey.has(approval.targetKeyIndex))throw new Error('Slice replacement approvals are invalid');
    approvalByKey.set(approval.targetKeyIndex,approval.sample);
  }
  const destinationSnapshots=explicitMapping===undefined?undefined:Object.freeze(explicitMapping.flatMap(targetKeyIndex=>{
    if(targetKeyIndex===null)return [];
    const current=existingSamples[targetKeyIndex];
    if(current?.isLoaded&&approvalByKey.get(targetKeyIndex)!==current)throw new Error(`Pad ${targetKeyIndex+1} is occupied and its replacement was not approved`);
    return [Object.freeze({targetKeyIndex,sample:current?.isLoaded?current:null,file:current?.file??null,audioBuffer:current?.audioBuffer??null,state:current?.isLoaded?sampleState(current):'',replacementApproved:Boolean(current?.isLoaded)} satisfies SliceDestinationSnapshot)];
  }));
  const unassignmentKeys=new Set<number>();
  const unassignmentSnapshots=Object.freeze((options.unassignmentApprovals??[]).map(({targetKeyIndex,sample})=>{
    if(!Number.isInteger(targetKeyIndex)||targetKeyIndex<0||targetKeyIndex>=24||unassignmentKeys.has(targetKeyIndex)||explicitMapping?.includes(targetKeyIndex))throw new Error('Slice unassignments are invalid');
    const current=existingSamples[targetKeyIndex];
    if(!current?.isLoaded||current!==sample)throw new Error(`Pad ${targetKeyIndex+1} changed before unassignment was prepared`);
    unassignmentKeys.add(targetKeyIndex);
    return Object.freeze({targetKeyIndex,sample:current,file:current.file,audioBuffer:current.audioBuffer,state:sampleState(current),replacementApproved:true} satisfies SliceDestinationSnapshot);
  }));
  const names = new Set(existingSamples.filter(sample => sample?.isLoaded).map(sample => sample.name.toLocaleLowerCase('en-US')));
  const targetKeys: number[] = [];
  const parentProvenance = source.existingIndex === null ? undefined : existingSamples[source.existingIndex]?.sliceProvenance;
  const yieldControl = options.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  for (let index = 0; index < canonicalRanges.length; index += 1) {
    if (options.signal?.aborted) throw abortError();
    const range = canonicalRanges[index];
    const audioBuffer = materializeSlice(source.audioBuffer, range, options.allocator);
    const name = uniqueSliceName(source.file.name, index + 1, names);
    const payload = encodeStoredAudio(audioBuffer);
    const file = new File([payload], name, { type: STORED_AUDIO_TYPE, lastModified: source.file.lastModified });
    const sliceProvenance = parentProvenance ? {
      ...parentProvenance,
      sourceIdentity,
      startFrame: parentProvenance.startFrame + Math.floor(range.start * (parentProvenance.endFrame - parentProvenance.startFrame) / source.audioBuffer.length),
      endFrame: parentProvenance.startFrame + Math.ceil(range.end * (parentProvenance.endFrame - parentProvenance.startFrame) / source.audioBuffer.length),
    } : {
      sourceIdentity, sourceName: source.file.name, startFrame: range.start, endFrame: range.end,
      sourceFrameCount: source.audioBuffer.length, sourceSampleRate: source.audioBuffer.sampleRate,
      sourceChannels: source.audioBuffer.numberOfChannels,
    };
    const slice = {
      ...baseSample(file, audioBuffer, source.metadata),
      name,
      fileSize: payload.size,
      isFloat: true,
      sourceIdentity,
      sliceProvenance,
    };
    const targetKeyIndex = explicitMapping?.[index] ?? (explicitMapping===undefined?emptyKeys[index]??null:null);
    if (targetKeyIndex !== null) targetKeys.push(targetKeyIndex);
    actions.push({ type: 'STORE_DRUM_SAMPLE_ASSET', payload: { sample: slice, targetKeyIndex } });
    options.onProgress?.((index + 1) / canonicalRanges.length);
    if (index + 1 < canonicalRanges.length) await yieldControl();
  }
  return {
    actions, source, ranges:canonicalRanges, sourceIdentity, targetKeys, assignedCount: targetKeys.length,
    overflowCount: canonicalRanges.length - targetKeys.length,
    mapping:explicitMapping,
    destinationSnapshots,
    unassignmentSnapshots,
  };
}

export type PreparedSliceApplication = Awaited<ReturnType<typeof prepareSliceApplication>>;

/** Re-check current source, full-project capacity and destinations immediately before one reducer commit. */
export function finalizeSliceApplication(
  prepared:PreparedSliceApplication,
  currentDrumSamples:readonly DrumSample[],
  currentProjectAssets:readonly ProjectAudioAsset[],
) {
  const {source,ranges,sourceIdentity}=prepared;
  if(source.existingIndex!==null) {
    const current=currentDrumSamples[source.existingIndex];
    if(!current?.isLoaded || current.audioBuffer!==source.audioBuffer || current.file!==source.file) {
      throw new Error('The slice source changed while Apply was preparing. No slices were added; reopen the slicer and retry.');
    }
    if(current.sourceIdentity!==undefined && current.sourceIdentity!==sourceIdentity) {
      throw new Error('The slice source identity changed while Apply was preparing. No slices were added; retry.');
    }
  }
  planSliceApplication({source:source.audioBuffer,ranges,existingSamples:currentProjectAssets,
    retainExternalSource:source.existingIndex===null,sourceFileBytes:source.file.size});
  const preparedStores=prepared.actions.filter((action):action is Extract<AppAction,{type:'STORE_DRUM_SAMPLE_ASSET'}> =>
    action.type==='STORE_DRUM_SAMPLE_ASSET' && Boolean(action.payload.sample.sliceProvenance));
  if(preparedStores.length!==ranges.length) throw new Error('Prepared slice assets are incomplete; retry Apply.');
  const emptyKeys=currentDrumSamples.slice(0,24).flatMap((sample,index)=>sample?.isLoaded?[]:[index]);
  const actions:AppAction[]=[];
  if(source.existingIndex===null) {
    const original=prepared.actions.find((action):action is Extract<AppAction,{type:'STORE_DRUM_SAMPLE_ASSET'}> =>
      action.type==='STORE_DRUM_SAMPLE_ASSET' && !action.payload.sample.sliceProvenance);
    if(!original) throw new Error('Prepared source asset is incomplete; retry Apply.');
    actions.push({...original,payload:{...original.payload,targetKeyIndex:null}});
  } else if(!currentDrumSamples[source.existingIndex]?.sourceIdentity) {
    actions.push({type:'UPDATE_DRUM_SAMPLE',payload:{index:source.existingIndex,updates:{sourceIdentity}}});
  }
  // Move loaded pad assets, never delete them. Bind each decision to its exact current state.
  const movedKeys=new Set<number>();
  for(const snapshot of prepared.unassignmentSnapshots??[]) {
    const target=snapshot.targetKeyIndex,current=currentDrumSamples[target];
    if(!Number.isInteger(target)||target<0||target>=24||movedKeys.has(target)||prepared.mapping?.includes(target)||!snapshot.sample||!current?.isLoaded||current.file!==snapshot.file||current.audioBuffer!==snapshot.audioBuffer||sampleState(current)!==snapshot.state)throw new Error(`Pad ${target+1} changed while Apply was preparing. No sounds were moved; retry.`);
    movedKeys.add(target);
    const retained=target===source.existingIndex?{...current,sourceIdentity}:current;
    actions.push({type:'STORE_DRUM_SAMPLE_ASSET',payload:{sample:retained,targetKeyIndex:null}});
    actions.push({type:'CLEAR_DRUM_SAMPLE',payload:target});
  }
  if(prepared.mapping!==undefined) {
    if(prepared.mapping.length!==preparedStores.length||!prepared.destinationSnapshots)throw new Error('Prepared slice mapping is incomplete; retry Apply.');
    const targets=prepared.mapping.filter((target):target is number=>target!==null);
    if(targets.some(target=>!Number.isInteger(target)||target<0||target>=24)||new Set(targets).size!==targets.length)throw new Error('Prepared slice mapping is invalid; retry Apply.');
    const snapshots=new Map(prepared.destinationSnapshots.map(snapshot=>[snapshot.targetKeyIndex,snapshot]));
    for(const target of prepared.mapping) {
      if(target===null)continue;
      const snapshot=snapshots.get(target),current=currentDrumSamples[target];
      if(!snapshot)throw new Error('Prepared slice destination is incomplete; retry Apply.');
      if(snapshot.sample===null) {
        if(current?.isLoaded)throw new Error(`Pad ${target+1} changed while Apply was preparing. No slices were added; review the mapping and retry.`);
      } else if(!current?.isLoaded||current.file!==snapshot.file||current.audioBuffer!==snapshot.audioBuffer||sampleState(current)!==snapshot.state) {
        throw new Error(`Pad ${target+1} changed while Apply was preparing. No slices were added; review the replacement and retry.`);
      }
    }
    preparedStores.forEach((action,index)=>{
      const target=prepared.mapping![index];
      if(target!==null) {
        const snapshot=snapshots.get(target)!;
        if(snapshot.sample) {
          const retained=target===source.existingIndex?{...snapshot.sample,sourceIdentity}:snapshot.sample;
          actions.push({type:'STORE_DRUM_SAMPLE_ASSET',payload:{sample:retained,targetKeyIndex:null}});
          actions.push({type:'CLEAR_DRUM_SAMPLE',payload:target});
        }
      }
      actions.push({...action,payload:{...action.payload,targetKeyIndex:target}});
    });
  } else preparedStores.forEach((action,index)=>actions.push({...action,payload:{...action.payload,targetKeyIndex:emptyKeys[index]??null}}));
  const assignedCount=prepared.mapping===undefined?Math.min(emptyKeys.length,preparedStores.length):prepared.mapping.filter(target=>target!==null).length;
  return {actions,assignedCount,overflowCount:preparedStores.length-assignedCount,sourceIdentity};
}
