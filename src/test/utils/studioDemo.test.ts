import { describe, expect, it } from 'vitest';
import {
  STUDIO_SEED_RECIPE_ID,
  STUDIO_SEED_SLOTS,
  generateStudioSeedKit,
  renderStudioSeedVoice,
  studioSeedAdmissionError,
} from '../../utils/studioDemo';
import { initialState } from '../../context/AppContext';

describe('Studio Seed demo generator', () => {
  it('renders the ten documented voices at their physical slots and exact lengths', async () => {
    const kit = await generateStudioSeedKit();

    expect(kit.recipeId).toBe('studio-seed-v1');
    expect(STUDIO_SEED_RECIPE_ID).toBe('studio-seed-v1');
    expect(kit.samples.map(sample => [sample.slot, sample.name, sample.audioBuffer.length])).toEqual([
      [0, 'Seed Kick', 21168],
      [2, 'Seed Snare', 13230],
      [4, 'Seed Rim', 4410],
      [5, 'Seed Clap', 11466],
      [7, 'Seed Shaker', 6174],
      [8, 'Seed Closed Hat', 4410],
      [10, 'Seed Open Hat', 24255],
      [12, 'Seed Low Tom', 18522],
      [16, 'Seed High Tom', 11466],
      [17, 'Seed Dual Bell', 19404],
    ]);
    expect(kit.samples.reduce((frames, sample) => frames + sample.audioBuffer.length, 0)).toBe(134505);
    expect(STUDIO_SEED_SLOTS).toEqual([0, 2, 4, 5, 7, 8, 10, 12, 16, 17]);
  });

  it('produces finite, windowed, centered samples at the documented peaks', () => {
    const expectedPeaks = new Map([[0, .28], [2, .22], [4, .14], [5, .18], [7, .10], [8, .10], [10, .12], [12, .20], [16, .16], [17, .12]]);

    for (const slot of STUDIO_SEED_SLOTS) {
      const audio = renderStudioSeedVoice(slot);
      const values = audio.getChannelData(0);
      const peak = values.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0);
      const mean = values.reduce((value, sample) => value + sample, 0) / values.length;
      expect(values[0]).toBe(0);
      expect(values[values.length - 1]).toBe(0);
      expect(values.every(Number.isFinite)).toBe(true);
      expect(peak).toBeCloseTo(expectedPeaks.get(slot)!, 6);
      expect(Math.abs(mean)).toBeLessThan(1e-6);
    }
  });

  it('is byte deterministic in one engine and gives each seeded noise voice its own stream', () => {
    const first = renderStudioSeedVoice(2).getChannelData(0);
    renderStudioSeedVoice(0);
    const repeated = renderStudioSeedVoice(2).getChannelData(0);
    const clap = renderStudioSeedVoice(5).getChannelData(0);

    expect(new Uint8Array(first.buffer)).toEqual(new Uint8Array(repeated.buffer));
    expect(first.slice(0, clap.length)).not.toEqual(clap);
  });

  it('includes the documented short noise component in the rim recipe', () => {
    const rim=renderStudioSeedVoice(4).getChannelData(0);
    expect([rim[23],rim[100],rim[1000]]).toEqual([
      -0.03686307743191719,
      0.069928839802742,
      -0.01337525900453329,
    ]);
  });

  it('stores honest Float32 originals with stable recipe metadata and no slice provenance', async () => {
    const kit = await generateStudioSeedKit();

    for (const sample of kit.samples) {
      expect(sample.file.name).toBe(`${sample.name}.opfloat`);
      expect(sample.file.type).toBe('application/vnd.op-patchstudio.float32');
      expect(sample.file.lastModified).toBe(0);
      expect(sample.drumSample.originalBitDepth).toBe(32);
      expect(sample.drumSample.originalSampleRate).toBe(44100);
      expect(sample.drumSample.originalChannels).toBe(1);
      expect(sample.drumSample.isFloat).toBe(true);
      expect(sample.drumSample.sourceIdentity).toBeTruthy();
      expect(sample.drumSample.sliceProvenance).toBeUndefined();
    }
  });

  it('refuses replacement before allocation when the previous drum assets cannot be kept for Undo', () => {
    const audioBuffer={length:34_000_000,numberOfChannels:1} as AudioBuffer;
    const drumSamples=initialState.drumSamples.map(sample=>({...sample}));
    drumSamples[0]={...drumSamples[0],audioBuffer,file:new File(['x'],'large.wav'),name:'large.wav',isLoaded:true};
    const state={...initialState,drumSamples};

    expect(studioSeedAdmissionError(state,'replace')).toMatch(/cannot be retained for one Undo/i);
    expect(studioSeedAdmissionError(state,'add')).toMatch(/128 MiB decoded-project limit/i);
  });
});
