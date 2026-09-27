import { describe, expect, it } from 'vitest';
import {
  crossfadeLoopChannels,
  framesToSeconds,
  normalizeSampleAndLoop,
  previewFrameAtTime,
  secondsToFrames,
} from '../../utils/loopEditing';

describe('half-open loop editing contract', () => {
  it('keeps exact zero and final-frame boundaries through frame/second conversion', () => {
    expect(secondsToFrames(0, 48_000, 96_000)).toBe(0);
    expect(secondsToFrames(2, 48_000, 96_000)).toBe(96_000);
    expect(framesToSeconds(96_000, 48_000)).toBe(2);
  });

  it('clamps a loop to the selected sample and gives disjoint loops the nearest one-frame interval', () => {
    expect(normalizeSampleAndLoop(100, { start: 20, end: 80 }, { start: 0, end: 10 })).toEqual({
      sample: { start: 20, end: 80 },
      loop: { start: 20, end: 21 },
    });
    expect(normalizeSampleAndLoop(100, { start: 20, end: 80 }, { start: 90, end: 100 })).toEqual({
      sample: { start: 20, end: 80 },
      loop: { start: 79, end: 80 },
    });
    expect(normalizeSampleAndLoop(1, { start: 0, end: 1 }, { start: 0, end: 1 })).toEqual({
      sample: { start: 0, end: 1 },
      loop: { start: 0, end: 1 },
    });
    expect(() => normalizeSampleAndLoop(0, { start: 0, end: 0 }, { start: 0, end: 0 })).toThrow('positive integer');
  });

  it('crossfades a copied loop boundary without changing source channel data', () => {
    const source = new Float32Array([-0.8, 0.6, -0.2, 0.9, -0.4, 0.2, 0.7, 1]);
    const before = new Float32Array(source);
    const [preview] = crossfadeLoopChannels([source], { start: 0, end: 8 }, 4);

    expect(source).toEqual(before);
    expect(preview).not.toBe(source);
    expect(Math.abs(preview[0] - preview[7])).toBeLessThan(Math.abs(source[0] - source[7]));
    expect(preview[0]).toBeCloseTo(source[7], 6);
    expect(preview[3]).toBeCloseTo(source[3], 6);
  });

  it('derives forward and reverse playheads from the audio clock, speed, and loop boundaries', () => {
    const base = {
      startedAt: 10,
      startFrame: 20,
      sample: { start: 10, end: 90 },
      loop: { start: 30, end: 50 },
      loopEnabled: true,
      sampleRate: 100,
      playbackRate: 2,
    } as const;
    expect(previewFrameAtTime({ ...base, reverse: false }, 10.2)).toBe(40);
    expect(previewFrameAtTime({ ...base, reverse: false }, 10.3)).toBe(40);
    expect(previewFrameAtTime({ ...base, reverse: true, startFrame: 70 }, 10.2)).toBe(30);
    expect(previewFrameAtTime({ ...base, reverse: true, startFrame: 50 }, 10.3)).toBe(50);
  });
});
