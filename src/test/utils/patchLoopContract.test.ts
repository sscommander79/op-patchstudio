import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppState, type MultisampleFile } from '../../context/AppContext';
import { generateDrumPatch, generateMultisamplePatch } from '../../utils/patchGeneration';

const audioMocks = vi.hoisted(() => ({ converted: null as AudioBuffer | null }));
vi.mock('../../utils/audio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/audio')>();
  return {
    ...actual,
    convertAudioFormat: vi.fn(async (source: AudioBuffer) => audioMocks.converted ?? source),
  };
});

const makeAudio = (frames: number, rate: number): AudioBuffer =>
  new (AudioBuffer as unknown as new (channels: number, length: number, sampleRate: number) => AudioBuffer)(1, frames, rate);

function multiState(loopEnabled = true, cutAtLoopEnd = false): AppState {
  const source = makeAudio(100, 100);
  const sample: MultisampleFile = {
    file: new File(['source'], 'tone.wav', { type: 'audio/wav' }),
    audioBuffer: source,
    name: 'tone.wav',
    isLoaded: true,
    rootNote: 60,
    inPoint: 0.2,
    outPoint: 0.8,
    loopStart: 0.3,
    loopEnd: 0.7,
    loopCrossfade: { fraction: 0.25 },
    originalBitDepth: 16,
    originalSampleRate: 100,
    originalChannels: 1,
    duration: 1,
    fileSize: 6,
  };
  return {
    ...initialState,
    multisampleSettings: {
      ...structuredClone(initialState.multisampleSettings),
      loopEnabled,
      cutAtLoopEnd,
      sampleRate: 200,
      bitDepth: 16,
      channels: 1,
      normalize: false,
    },
    multisampleFiles: [sample],
  };
}

async function archive(blob: Blob) {
  const data = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const zip = await JSZip.loadAsync(data);
  const patch = JSON.parse(await zip.file('patch.json')!.async('string'));
  const audioName = patch.regions[0].sample as string;
  return { patch, audio: await zip.file(audioName)!.async('uint8array') };
}

function wavLoopCount(bytes: Uint8Array): number {
  const text = new TextDecoder();
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = text.decode(bytes.subarray(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    if (id === 'smpl') return new DataView(bytes.buffer, bytes.byteOffset + offset + 8, size).getUint32(28, true);
    offset += 8 + size + (size % 2);
  }
  throw new Error('Missing smpl');
}

describe('patch loop frame contract', () => {
  beforeEach(() => { audioMocks.converted = null; });

  it('normalizes seconds against converted output and scales crossfade by final frame count', async () => {
    audioMocks.converted = makeAudio(200, 200);
    const { patch, audio } = await archive(await generateMultisamplePatch(multiState(), 'converted', 200, 16, 'mono', 0, 'wav'));
    expect(patch.regions[0]).toMatchObject({
      framecount: 200,
      'sample.start': 40,
      'sample.end': 160,
      'loop.start': 60,
      'loop.end': 140,
      'loop.crossfade': 50,
      'loop.enabled': true,
    });
    expect(wavLoopCount(audio)).toBe(1);
  });

  it('clamps all output markers and crossfade to the final cut buffer', async () => {
    audioMocks.converted = makeAudio(140, 200);
    const { patch } = await archive(await generateMultisamplePatch(multiState(true, true), 'cut', 200, 16, 'mono', 0, 'wav'));
    expect(patch.regions[0]).toMatchObject({
      framecount: 140,
      'sample.start': 40,
      'sample.end': 140,
      'loop.start': 60,
      'loop.end': 140,
      'loop.crossfade': 35,
    });
  });

  it('keeps loop metadata disabled in the audio container when patch looping is off', async () => {
    audioMocks.converted = makeAudio(200, 200);
    const { patch, audio } = await archive(await generateMultisamplePatch(multiState(false), 'no-loop', 200, 16, 'mono', 0, 'wav'));
    expect(patch.regions[0]['loop.enabled']).toBe(false);
    expect(wavLoopCount(audio)).toBe(0);
  });

  it('does not add a full-file container loop merely to store a drum root note', async () => {
    const state = multiState();
    state.drumSamples[0] = {
      file: new File(['drum'], 'kick.wav', { type: 'audio/wav' }), audioBuffer: makeAudio(10, 100), name: 'kick.wav', isLoaded: true,
      inPoint: 0, outPoint: 0.1, playmode: 'oneshot', reverse: false, transpose: 0, pan: 0, gain: 0,
      hasBeenEdited: false, isAssigned: true, assignedKey: 0, originalBitDepth: 16, originalSampleRate: 100,
      originalChannels: 1, duration: 0.1, fileSize: 4,
    };
    state.drumSettings = { ...state.drumSettings, sampleRate: 0, bitDepth: 16, channels: 1, normalize: false };
    const { audio } = await archive(await generateDrumPatch(state, 'drum', undefined, 16, 'mono', 'wav'));
    expect(wavLoopCount(audio)).toBe(0);
  });
});
