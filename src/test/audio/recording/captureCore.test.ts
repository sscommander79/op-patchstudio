import { describe, expect, it } from 'vitest';
import { CaptureCore, validateCaptureOptions } from '../../../audio/recording/captureCore';

function blocks(values: number[], sizes: number[]) {
  const result: Array<{ firstFrame: number; channels: Float32Array[] }> = [];
  let offset = 0;
  for (const size of sizes) {
    result.push({ firstFrame: offset, channels: [Float32Array.from(values.slice(offset, offset + size))] });
    offset += size;
  }
  return result;
}

describe('CaptureCore', () => {
  it('captures exact pre-roll and the onset once across variable block boundaries', () => {
    const signal = [0, 0.1, 0.2, 0.3, 0.9, 0.4, ...Array(800).fill(0)];
    const core = new CaptureCore({ mode: 'sound', sampleRate: 8_000, channels: 1,
      thresholdDb: -6, hysteresisDb: 6, preRollSeconds: 3 / 8_000, silenceSeconds: .1,
      rearmSeconds: .1, maxSeconds: 1 });
    core.arm();
    const takes = blocks(signal, [1, 3, 1, 127, 128, 129, 257, 160]).flatMap(block => core.process(block.channels, block.firstFrame).takes);
    expect(takes).toHaveLength(1);
    expect(takes[0]).toMatchObject({ startFrame: 1, endFrame: 806, frames: 805, preRollFrames: 3, reason: 'silence' });
    expect(Array.from(takes[0].channels[0].slice(0, 8))).toEqual(Array.from(Float32Array.from([0.1, 0.2, 0.3, 0.9, 0.4, 0, 0, 0])));
  });

  it('uses channel-wise peak detection and preserves opposite-polarity stereo', () => {
    const core = new CaptureCore({ mode: 'sound', sampleRate: 8_000, channels: 2,
      thresholdDb: -6, hysteresisDb: 6, preRollSeconds: 0, silenceSeconds: .1,
      rearmSeconds: .1, maxSeconds: 1 });
    core.arm();
    const left = Float32Array.from([.8, ...Array(800).fill(0)]);
    const right = Float32Array.from([-.8, ...Array(800).fill(0)]);
    const result = core.process([left, right], 0);
    expect(result.takes).toHaveLength(1);
    expect(Array.from(result.takes[0].channels[0].subarray(0, result.takes[0].frames))).toEqual(Array.from(left));
    expect(Array.from(result.takes[0].channels[1].subarray(0, result.takes[0].frames))).toEqual(Array.from(right));
  });

  it('prioritizes the exact length cap and does not overlap a later pre-roll', () => {
    const core = new CaptureCore({ mode: 'sound', sampleRate: 8_000, channels: 1,
      thresholdDb: -6, hysteresisDb: 6, preRollSeconds: 3 / 8_000, silenceSeconds: .1,
      rearmSeconds: .1, maxSeconds: 1 });
    core.arm();
    const firstSignal = Float32Array.from([0, 0, ...Array(8_000).fill(.8)]);
    const first = core.process([firstSignal], 0).takes[0];
    expect(first).toMatchObject({ startFrame: 0, endFrame: 8_000, frames: 8_000, reason: 'length' });
    core.acknowledgeTake();
    const secondSignal = Float32Array.from([...Array(800).fill(0), .9, ...Array(800).fill(0)]);
    const second = core.process([secondSignal], firstSignal.length).takes[0];
    expect(second).toMatchObject({ startFrame: 8_799, endFrame: 9_603, preRollFrames: 3 });
    expect(Array.from(second.channels[0].slice(0, 6))).toEqual(Array.from(Float32Array.from([0, 0, 0, .9, 0, 0])));
  });

  it('keeps quiet monitoring bounded and holds re-arm until take credit is acknowledged', () => {
    const core = new CaptureCore({ mode: 'sound', sampleRate: 8_000, channels: 1,
      thresholdDb: -30, hysteresisDb: 6, preRollSeconds: 2, silenceSeconds: .1,
      rearmSeconds: .1, maxSeconds: 20 });
    core.arm();
    for (let frame = 0; frame < 2_000_000; frame += 257) {
      const size = Math.min(257, 2_000_000 - frame);
      expect(core.process([new Float32Array(size)], frame).takes).toHaveLength(0);
    }
    expect(core.memoryBytes).toBe((16_000 + 160_000) * 4);
    expect(core.pendingTake).toBe(false);
  });

  it('manual stop omits all-zero takes but retains genuinely quiet nonzero audio', () => {
    const silent = new CaptureCore({ mode: 'manual', sampleRate: 8_000, channels: 1, maxSeconds: 1 });
    silent.startManual();
    silent.process([new Float32Array(10)], 0);
    expect(silent.stop().takes).toEqual([]);
    const quiet = new CaptureCore({ mode: 'manual', sampleRate: 8_000, channels: 1, maxSeconds: 1 });
    quiet.startManual();
    quiet.process([Float32Array.from([0, 1e-9, 0])], 0);
    expect(Array.from(quiet.stop().takes[0].channels[0].subarray(0, 3))).toEqual([0, Math.fround(1e-9), 0]);
  });

  it('does not emit an all-zero manual take at the exact maximum length', () => {
    const core = new CaptureCore({ mode: 'manual', sampleRate: 8_000, channels: 1, maxSeconds: 1 });
    core.startManual();
    expect(core.process([new Float32Array(8_000)], 0).takes).toEqual([]);
    expect(core.pendingTake).toBe(false);
    expect(core.state).toBe('monitoring');
  });

  it('does not let repeated arm or start calls replace an active or in-flight take', () => {
    const manual = new CaptureCore({ mode: 'manual', sampleRate: 8_000, channels: 1, maxSeconds: 1 });
    manual.startManual();
    expect(() => manual.startManual()).toThrow(/already/);
    manual.process([Float32Array.from([.1])], 0);
    manual.stop();
    expect(() => manual.startManual()).toThrow(/pending/);
  });

  it('rejects gaps, channel changes, invalid ranges and unbounded dimensions', () => {
    for (const rate of [8_000,44_100,48_000,96_000]) expect(validateCaptureOptions({mode:'sound',sampleRate:rate,channels:1,maxSeconds:1}).maxFrames).toBe(rate);
    expect(() => validateCaptureOptions({ mode: 'sound', sampleRate: 7_999, channels: 1 })).toThrow(/8,000/);
    expect(() => validateCaptureOptions({ mode: 'sound', sampleRate: 48_000, channels: 3 })).toThrow(/mono or stereo/);
    expect(() => validateCaptureOptions({ mode: 'sound', sampleRate: 48_000, channels: 1, preRollSeconds: 2, maxSeconds: 2 })).toThrow(/shorter/);
    const core = new CaptureCore({ mode: 'sound', sampleRate: 48_000, channels: 1 }); core.arm();
    core.process([new Float32Array(1)], 4);
    expect(() => core.process([new Float32Array(1)], 6)).toThrow(/discontinuity/);
    expect(() => core.process([new Float32Array(1), new Float32Array(1)], 5)).toThrow(/channel/);
  });

  it('bounds meter delivery to one outstanding message', () => {
    const core = new CaptureCore({ mode: 'sound', sampleRate: 8_000, channels: 1 }); core.arm();
    expect(core.process([Float32Array.from([.25])], 0).meter).toMatchObject({ peaks: [.25], frame: 0 });
    expect(core.process([Float32Array.from([.5])], 1).meter).toBeUndefined();
    core.acknowledgeMeter();
    expect(core.process([Float32Array.from([.75])], 2).meter).toMatchObject({ peaks: [.75], frame: 2 });
  });
});
