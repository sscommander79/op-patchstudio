import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { AppState, DrumSample, MultisampleFile } from '../../context/AppContext';
import { appReducer, initialState } from '../../context/AppContext';
import {
  type ImportedPresetJson,
  importDrumPresetJson,
  importMultisamplePresetJson,
  mergeImportedDrumSettings,
  mergeImportedMultisampleSettings,
} from '../../utils/jsonImport';
import { generateDrumPatch, generateMultisamplePatch } from '../../utils/patchGeneration';

const audioMocks = vi.hoisted(() => ({
  convertAudioFormat: vi.fn(),
}));

interface ExportRegion {
  sample: string;
  framecount: number;
  lokey?: number;
  hikey?: number;
  gain?: number;
  'sample.start'?: number;
  'sample.end'?: number;
  'loop.start'?: number;
  'loop.end'?: number;
}

interface PatchManifest {
  regions: ExportRegion[];
  engine?: Record<string, unknown>;
  envelope?: {
    amp?: Record<string, unknown>;
    filter?: Record<string, unknown>;
  };
  fx?: unknown;
  octave?: number;
}

vi.mock('../../utils/audio', async () => {
  const actual = await vi.importActual<typeof import('../../utils/audio')>('../../utils/audio');
  return {
    ...actual,
    convertAudioFormat: audioMocks.convertAudioFormat,
  };
});

function makeBuffer(length: number, sampleRate = 44_100, amplitude = 0.25): AudioBuffer {
  const buffer = new AudioContext().createBuffer(1, length, sampleRate);
  buffer.getChannelData(0).fill(amplitude);
  return buffer;
}

function makeDrumSample(
  filename: string,
  assignedKey: number | undefined,
  options: Partial<DrumSample> = {},
): DrumSample {
  const audioBuffer = options.audioBuffer ?? makeBuffer(16);
  return {
    file: new File([filename], filename, { type: 'audio/wav' }),
    audioBuffer,
    name: filename,
    isLoaded: true,
    inPoint: 0,
    outPoint: audioBuffer.duration,
    playmode: 'oneshot',
    reverse: false,
    transpose: 0,
    pan: 0,
    gain: 0,
    hasBeenEdited: false,
    isAssigned: assignedKey !== undefined,
    assignedKey,
    originalBitDepth: 16,
    originalSampleRate: audioBuffer.sampleRate,
    originalChannels: audioBuffer.numberOfChannels,
    fileSize: 32,
    duration: audioBuffer.duration,
    ...options,
  };
}

function makeMultisample(filename: string, rootNote: number, options: Partial<MultisampleFile> = {}): MultisampleFile {
  const audioBuffer = options.audioBuffer ?? makeBuffer(9);
  return {
    file: new File([filename], filename, { type: 'audio/wav' }),
    audioBuffer,
    name: filename,
    isLoaded: true,
    rootNote,
    inPoint: 0,
    outPoint: audioBuffer.duration,
    loopStart: 2 / audioBuffer.sampleRate,
    loopEnd: 8 / audioBuffer.sampleRate,
    originalBitDepth: 16,
    originalSampleRate: audioBuffer.sampleRate,
    originalChannels: audioBuffer.numberOfChannels,
    fileSize: 18,
    duration: audioBuffer.duration,
    ...options,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    drumSettings: {
      ...initialState.drumSettings,
      normalize: false,
      renameFiles: false,
    },
    multisampleSettings: {
      ...initialState.multisampleSettings,
      normalize: false,
      renameFiles: false,
      cutAtLoopEnd: false,
    },
    drumSamples: [],
    multisampleFiles: [],
    importedDrumPreset: null,
    importedMultisamplePreset: null,
    ...overrides,
  };
}

async function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

async function loadArchive(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blobBytes(blob));
}

async function readPatch(zip: JSZip): Promise<PatchManifest> {
  const entry = zip.file('patch.json');
  expect(entry).not.toBeNull();
  return JSON.parse(await entry!.async('string')) as PatchManifest;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function findChunk(bytes: Uint8Array, id: string, littleEndian: boolean): { dataOffset: number; size: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, littleEndian);
    if (ascii(bytes, offset, 4) === id) return { dataOffset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  throw new Error(`Missing ${id} chunk`);
}

async function archiveAudioBytes(zip: JSZip, filename: string): Promise<Uint8Array> {
  const entry = zip.file(filename);
  expect(entry).not.toBeNull();
  return entry!.async('uint8array');
}

describe('real patch export integrity', () => {
  beforeEach(() => {
    audioMocks.convertAudioFormat.mockReset();
    audioMocks.convertAudioFormat.mockImplementation(async (buffer: AudioBuffer) => buffer);
  });

  it('maps sparse drum assignments 0 and 5 to MIDI notes 53 and 58', async () => {
    const state = makeState({
      drumSamples: [makeDrumSample('kick.wav', 0), makeDrumSample('clap.wav', 5)],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Sparse Kit'));
    const patch = await readPatch(zip);

    expect(patch.regions.map((region) => region.lokey)).toEqual([53, 58]);
    expect(patch.regions.map((region) => region.hikey)).toEqual([53, 58]);
  });

  it('keeps duplicate source names as distinct ZIP members and valid region references', async () => {
    const state = makeState({
      drumSamples: [
        makeDrumSample('hit.wav', 0, { audioBuffer: makeBuffer(8, 44_100, 0.1) }),
        makeDrumSample('hit.wav', 1, { audioBuffer: makeBuffer(8, 44_100, 0.7) }),
      ],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Duplicate Kit'));
    const patch = await readPatch(zip);
    const references = patch.regions.map((region) => region.sample);

    expect(references).toEqual(['hit.wav', 'hit-2.wav']);
    expect(new Set(references).size).toBe(2);
    for (const reference of references) expect(zip.file(reference)).not.toBeNull();

    const first = await archiveAudioBytes(zip, references[0]);
    const second = await archiveAudioBytes(zip, references[1]);
    expect(Array.from(first)).not.toEqual(Array.from(second));
  });

  it('allocates case-insensitive unique names after sanitizing and converting extensions', async () => {
    const state = makeState({
      drumSamples: [
        makeDrumSample('tone?.wav', 0),
        makeDrumSample('tone*.wav', 1),
        makeDrumSample('sample.aif', 2),
        makeDrumSample('SAMPLE.wav', 3),
      ],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Collision Kit', undefined, undefined, undefined, 'wav'));
    const patch = await readPatch(zip);
    const references = patch.regions.map((region) => region.sample);
    const lowerReferences = references.map((name: string) => name.toLocaleLowerCase('en-US'));
    const audioEntries = Object.keys(zip.files).filter((name) => name !== 'patch.json');

    expect(new Set(lowerReferences).size).toBe(4);
    expect(references).toEqual(['tone.wav', 'tone-2.wav', 'sample.wav', 'SAMPLE-2.wav']);
    expect(new Set(audioEntries.map((name) => name.toLocaleLowerCase('en-US'))).size).toBe(4);
    expect(new Set(audioEntries)).toEqual(new Set(references));
  });

  it('retains loaded unassigned audio under its planned unique name without adding a region', async () => {
    const state = makeState({
      drumSamples: [makeDrumSample('hit.wav', 0), makeDrumSample('hit.wav', undefined)],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Unassigned Kit'));
    const patch = await readPatch(zip);

    expect(Object.keys(zip.files).sort()).toEqual(['hit-2.wav', 'hit.wav', 'patch.json']);
    expect(patch.regions.map((region) => region.sample)).toEqual(['hit.wav']);
  });

  it('rejects the whole drum export with sample context when conversion fails', async () => {
    audioMocks.convertAudioFormat.mockRejectedValueOnce(new Error('offline render failed'));
    const state = makeState({
      drumSettings: { ...initialState.drumSettings, normalize: true, renameFiles: false },
      drumSamples: [makeDrumSample('snare.wav', 0)],
    });

    await expect(generateDrumPatch(state, 'Broken Kit')).rejects.toThrow(
      'Failed to convert sample snare.wav to audio file: offline render failed',
    );
  });

  it('uses converted output frames and clamps drum markers to the exported buffer', async () => {
    audioMocks.convertAudioFormat.mockResolvedValueOnce(makeBuffer(7, 22_050));
    const source = makeBuffer(20, 44_100);
    const state = makeState({
      drumSamples: [makeDrumSample('short.wav', 0, {
        audioBuffer: source,
        inPoint: 8 / 22_050,
        outPoint: source.duration,
      })],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Resampled Kit', 22_050));
    const patch = await readPatch(zip);
    const region = patch.regions[0];
    const wav = await archiveAudioBytes(zip, region.sample);
    const fmt = findChunk(wav, 'fmt ', true);
    const data = findChunk(wav, 'data', true);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const channels = view.getUint16(fmt.dataOffset + 2, true);
    const bitDepth = view.getUint16(fmt.dataOffset + 14, true);
    const wavFrames = data.size / (channels * (bitDepth / 8));

    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(wavFrames).toBe(7);
    expect(region).toMatchObject({ framecount: 7, 'sample.start': 6, 'sample.end': 7 });
  });

  it('converts when decoded buffer rate differs from the requested rate despite stale source metadata', async () => {
    audioMocks.convertAudioFormat.mockResolvedValueOnce(makeBuffer(5, 44_100));
    const decoded = makeBuffer(8, 48_000);
    const state = makeState({
      drumSamples: [makeDrumSample('rate.wav', 0, {
        audioBuffer: decoded,
        originalSampleRate: 44_100,
      })],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Rate Kit', 44_100));
    const patch = await readPatch(zip);
    const wav = await archiveAudioBytes(zip, patch.regions[0].sample);
    const fmt = findChunk(wav, 'fmt ', true);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(view.getUint32(fmt.dataOffset + 4, true)).toBe(44_100);
    expect(patch.regions[0].framecount).toBe(5);
  });

  it('adds the target extension and a nonempty fallback to extensionless sanitized names', async () => {
    const state = makeState({
      drumSamples: [makeDrumSample('808?', 0), makeDrumSample('??', 1)],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Nameless Kit'));
    const patch = await readPatch(zip);

    expect(patch.regions.map((region) => region.sample)).toEqual(['808.wav', 'sample.wav']);
    expect(Object.keys(zip.files).sort()).toEqual(['808.wav', 'patch.json', 'sample.wav']);
  });

  it('preserves drum gain as patch metadata without baking it into the exported PCM', async () => {
    audioMocks.convertAudioFormat.mockImplementation(async (buffer: AudioBuffer, options: { gain?: number }) => {
      const converted = makeBuffer(buffer.length, buffer.sampleRate, 0);
      const factor = Math.pow(10, (options.gain ?? 0) / 20);
      converted.getChannelData(0).set(buffer.getChannelData(0).map((value) => value * factor));
      return converted;
    });
    const state = makeState({
      drumSamples: [makeDrumSample('gain.wav', 0, { audioBuffer: makeBuffer(8, 44_100, 0.25), gain: 6 })],
    });

    const zip = await loadArchive(await generateDrumPatch(state, 'Gain Kit'));
    const patch = await readPatch(zip);
    const wav = await archiveAudioBytes(zip, patch.regions[0].sample);
    const data = findChunk(wav, 'data', true);
    const pcm = new DataView(wav.buffer, wav.byteOffset, wav.byteLength).getInt16(data.dataOffset, true) / 0x7fff;

    expect(patch.regions[0].gain).toBe(6);
    expect(pcm).toBeCloseTo(0.25, 3);
  });

  it('preserves multisample gain as patch metadata without baking it into the exported PCM', async () => {
    audioMocks.convertAudioFormat.mockImplementation(async (buffer: AudioBuffer, options: { gain?: number }) => {
      const converted = makeBuffer(buffer.length, buffer.sampleRate, 0);
      const factor = Math.pow(10, (options.gain ?? 0) / 20);
      converted.getChannelData(0).set(buffer.getChannelData(0).map((value) => value * factor));
      return converted;
    });
    const state = makeState({
      multisampleFiles: [makeMultisample('multi-gain.wav', 60, { audioBuffer: makeBuffer(8, 44_100, 0.25) })],
    });

    const zip = await loadArchive(await generateMultisamplePatch(state, 'Gain Multi', undefined, undefined, undefined, 6));
    const patch = await readPatch(zip);
    const wav = await archiveAudioBytes(zip, patch.regions[0].sample);
    const data = findChunk(wav, 'data', true);
    const pcm = new DataView(wav.buffer, wav.byteOffset, wav.byteLength).getInt16(data.dataOffset, true) / 0x7fff;

    expect(patch.regions[0].gain).toBe(6);
    expect(pcm).toBeCloseTo(0.25, 3);
  });

  it('preserves imported drum FX settings stored on the AppState contract', async () => {
    const importedDrumPreset = {
      type: 'drum',
      fx: { active: true, type: 'spring', params: [1, 2, 3, 4, 5, 6, 7, 8] },
    };
    const state = makeState({ importedDrumPreset });

    const zip = await loadArchive(await generateDrumPatch(state, 'Imported Kit'));
    const patch = await readPatch(zip);

    expect(patch.fx).toEqual(importedDrumPreset.fx);
  });

  it('imports drum preset JSON into the AppState importedDrumPreset key', () => {
    const imported = importDrumPresetJson(
      JSON.stringify({ type: 'drum', fx: { active: true } }),
      makeState(),
    );

    expect(imported.importedDrumPreset).toEqual({ type: 'drum', fx: { active: true } });
    expect('importedDrumPresetJson' in imported).toBe(false);
  });

  describe.each([
    ['drum', generateDrumPatch] as const,
    ['multisample', generateMultisamplePatch] as const,
  ])('imported %s octave', (presetType, generatePatch) => {
    it.each([3, -2, 0])('preserves scalar octave %i in patch.json', async (octave) => {
      const state = presetType === 'drum'
        ? makeState({ importedDrumPreset: { type: 'drum', octave } })
        : makeState({ importedMultisamplePreset: { type: 'multisampler', octave } });

      const zip = await loadArchive(await generatePatch(state, 'Octave'));
      const patch = await readPatch(zip);

      expect(patch.octave).toBe(octave);
    });
  });

  it('assigns imported zero octave over an existing nonzero scalar in both merge modes', () => {
    const drum = { octave: 7 };
    const multisample = { octave: -4 };

    mergeImportedDrumSettings(drum, { octave: 0 });
    mergeImportedMultisampleSettings(multisample, { octave: 0 });

    expect(drum.octave).toBe(0);
    expect(multisample.octave).toBe(0);
  });

  it('hydrates supported multisample fields before an immediate import to export round trip', async () => {
    const importedPreset = {
      type: 'multisampler',
      engine: {
        playmode: 'mono',
        transpose: 12,
        'velocity.sensitivity': 16_384,
        volume: 12_345,
        width: 13_107,
        highpass: 3_277,
        'portamento.amount': 6_553,
        'portamento.type': 32_767,
        'tuning.root': 4,
        'vendor.mode': 456,
      },
      envelope: {
        amp: { attack: 123, decay: 456, sustain: 789, release: 1_000 },
        filter: { attack: 11, decay: 22, sustain: 33, release: 44 },
      },
      fx: { active: true, type: 'custom-fx', params: [1, 2, 3] },
    };
    const currentState = makeState();
    const updates = importMultisamplePresetJson(JSON.stringify(importedPreset), currentState);
    const importedState = { ...currentState, ...updates } as AppState;

    const zip = await loadArchive(await generateMultisamplePatch(importedState, 'Imported Multi'));
    const patch = await readPatch(zip);

    expect(patch.engine).toMatchObject(importedPreset.engine);
    expect(patch.envelope).toMatchObject(importedPreset.envelope);
    expect(patch.fx).toEqual(importedPreset.fx);
  });

  it('lets later multisample edits override supported imports while retaining unknown imported fields', async () => {
    const importedPreset = {
      type: 'multisampler',
      engine: { playmode: 'mono', transpose: 12, volume: 12_345, 'vendor.mode': 456 },
      envelope: {
        amp: { attack: 123, decay: 456, sustain: 789, release: 1_000, 'vendor.curve': 88 },
      },
      fx: { active: true, type: 'custom-fx', params: [1, 2, 3] },
    };
    const currentState = makeState();
    const updates = importMultisamplePresetJson(JSON.stringify(importedPreset), currentState);
    const importedState = { ...currentState, ...updates } as AppState;
    const transposeEdited = appReducer(importedState, { type: 'SET_MULTISAMPLE_TRANSPOSE', payload: -7 });
    const volumeEdited = appReducer(transposeEdited, { type: 'SET_MULTISAMPLE_VOLUME', payload: 50 });
    const editedState = appReducer(volumeEdited, {
      type: 'SET_MULTISAMPLE_AMP_ENVELOPE',
      payload: { ...importedState.multisampleSettings.ampEnvelope, attack: 999 },
    });

    const zip = await loadArchive(await generateMultisamplePatch(editedState, 'Edited Multi'));
    const patch = await readPatch(zip);

    expect(patch.engine).toMatchObject({
      playmode: 'mono',
      transpose: -7,
      volume: 16_384,
      'vendor.mode': 456,
    });
    expect(patch.envelope?.amp).toEqual({
      attack: 999,
      decay: 456,
      sustain: 789,
      release: 1_000,
      'vendor.curve': 88,
    });
    expect(patch.fx).toEqual(importedPreset.fx);
  });

  it('atomically stores and hydrates a multisample preset through the live reducer action', () => {
    const importedPreset: ImportedPresetJson = {
      type: 'multisampler',
      engine: { playmode: 'mono', transpose: 12, 'vendor.mode': 456 },
      envelope: { amp: { attack: 123, decay: 456, sustain: 789, release: 1_000 } },
    };

    const importedState = appReducer(makeState(), {
      type: 'IMPORT_MULTISAMPLE_PRESET',
      payload: importedPreset,
    });

    expect(importedState.importedMultisamplePreset).toEqual(importedPreset);
    expect(importedState.multisampleSettings).toMatchObject({
      playmode: 'mono',
      transpose: 12,
      ampEnvelope: { attack: 123, decay: 456, sustain: 789, release: 1_000 },
    });
  });

  it('exports editable multisample playmode over a conflicting imported mode', async () => {
    const state = makeState({
      multisampleSettings: { ...initialState.multisampleSettings, playmode: 'legato' },
      importedMultisamplePreset: { type: 'multisampler', engine: { playmode: 'mono' } },
    });

    const zip = await loadArchive(await generateMultisamplePatch(state, 'State Mode'));
    const patch = await readPatch(zip);

    expect(patch.engine?.playmode).toBe('legato');
  });

  it('writes an AIFF whose COMM frame count and multisample markers match the exported audio', async () => {
    const state = makeState({
      multisampleFiles: [makeMultisample('piano.wav', 60)],
    });

    const zip = await loadArchive(await generateMultisamplePatch(state, 'Piano', undefined, 16, undefined, 0, 'aiff'));
    const patch = await readPatch(zip);
    const aiff = await archiveAudioBytes(zip, patch.regions[0].sample);
    const comm = findChunk(aiff, 'COMM', false);
    const frames = new DataView(aiff.buffer, aiff.byteOffset, aiff.byteLength).getUint32(comm.dataOffset + 2, false);

    expect(ascii(aiff, 0, 4)).toBe('FORM');
    expect(ascii(aiff, 8, 4)).toBe('AIFF');
    expect(frames).toBe(9);
    expect(patch.regions[0]).toMatchObject({
      framecount: 9,
      'sample.start': 0,
      'sample.end': 9,
      'loop.start': 2,
      'loop.end': 8,
    });
  });
});
