import { describe, expect, it } from 'vitest';

describe('global AudioBuffer test fixture', () => {
  it('uses Float32 storage and copies channel data without aliasing the source', () => {
    const buffer = new AudioBuffer({ numberOfChannels: 2, length: 4, sampleRate: 48_000 });
    const source = Float32Array.from([0.1, -0.25, 0.75]);

    buffer.copyToChannel(source, 1, 1);
    source[0] = 1;

    expect(Array.from(buffer.getChannelData(1))).toEqual([0, Math.fround(0.1), -0.25, 0.75]);
    const destination = Float32Array.from([9, 9, 9]);
    buffer.copyFromChannel(destination, 1, 2);
    expect(Array.from(destination)).toEqual([-0.25, 0.75, 9]);
  });

  it('rejects invalid channel indexes with the browser exception type', () => {
    const buffer = new AudioBuffer({ numberOfChannels: 1, length: 4, sampleRate: 48_000 });

    expect(() => buffer.getChannelData(1)).toThrowError(
      expect.objectContaining({ name: 'IndexSizeError' }),
    );
    expect(() => buffer.copyToChannel(new Float32Array(1), 2)).toThrowError(
      expect.objectContaining({ name: 'IndexSizeError' }),
    );
  });

  it('rejects impossible constructor dimensions', () => {
    expect(() => new AudioBuffer({ numberOfChannels: 0, length: 4, sampleRate: 48_000 }))
      .toThrowError(expect.objectContaining({ name: 'NotSupportedError' }));
    expect(() => new AudioBuffer({ numberOfChannels: 1, length: 0, sampleRate: 48_000 }))
      .toThrowError(expect.objectContaining({ name: 'NotSupportedError' }));
  });
});
