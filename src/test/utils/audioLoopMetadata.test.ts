import { describe, expect, it } from 'vitest';
import { audioBufferToAiff } from '../../utils/aiffExport';
import { audioBufferToWav } from '../../utils/wavExport';
import { readWavMetadataFromArrayBuffer } from '../../utils/audio';
import { readAudioMetadataFromArrayBuffer } from '../../utils/audioFormats';

function chunk(bytes: Uint8Array, id: string, littleEndian: boolean): { offset: number; size: number } {
  const text = new TextDecoder();
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = text.decode(bytes.subarray(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, littleEndian);
    if (name === id) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  throw new Error(`Missing ${id} chunk`);
}

function buffer(length: number): AudioBuffer {
  return new (AudioBuffer as unknown as new (channels: number, frames: number, rate: number) => AudioBuffer)(1, length, 48_000);
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  const data = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(data);
}

const exactBuffer = (value: Uint8Array): ArrayBuffer =>
  value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;

describe('loop metadata uses half-open frame boundaries', () => {
  it.each([
    { start: 0, end: 10, storedStart: 0, storedEnd: 9 },
    { start: 3, end: 10, storedStart: 3, storedEnd: 9 },
    { start: 5, end: 6, storedStart: 5, storedEnd: 5 },
  ])('writes WAV smpl start unchanged and inclusive end for $start..$end', async ({ start, end, storedStart, storedEnd }) => {
    const output = await bytes(await audioBufferToWav(buffer(10), 16, { loopStart: start, loopEnd: end }));
    const smpl = chunk(output, 'smpl', true);
    const view = new DataView(output.buffer, output.byteOffset + smpl.offset, smpl.size);
    expect(view.getUint32(28, true)).toBe(1);
    expect(view.getUint32(44, true)).toBe(storedStart);
    expect(view.getUint32(48, true)).toBe(storedEnd);
  });

  it('does not enable a WAV loop when only a root note is supplied', async () => {
    const output = await bytes(await audioBufferToWav(buffer(10), 16, { rootNote: 64 }));
    const smpl = chunk(output, 'smpl', true);
    const view = new DataView(output.buffer, output.byteOffset + smpl.offset, smpl.size);
    expect(view.getUint32(12, true)).toBe(64);
    expect(view.getUint32(28, true)).toBe(0);
  });

  it.each([
    { start: 0, end: 10 },
    { start: 3, end: 10 },
    { start: 5, end: 6 },
  ])('writes AIFF MARK positions as exact boundaries for $start..$end', async ({ start, end }) => {
    const output = await bytes(await audioBufferToAiff(buffer(10), { bitDepth: 16, loopStart: start, loopEnd: end }));
    const mark = chunk(output, 'MARK', false);
    const view = new DataView(output.buffer, output.byteOffset + mark.offset, mark.size);
    expect(view.getUint16(0, false)).toBe(2);
    expect(view.getUint32(4, false)).toBe(start);
    // Marker 1 occupies 12 bytes: id + position + Pascal "start" including padding.
    expect(view.getUint32(16, false)).toBe(end);
  });

  it('round trips WAV inclusive smpl ends back to half-open seconds', async () => {
    const output = await bytes(await audioBufferToWav(buffer(10), 16, { rootNote: 64, loopStart: 0, loopEnd: 10 }));
    const metadata = await readWavMetadataFromArrayBuffer(exactBuffer(output), 'tone.wav', output.length);
    expect(metadata.hasLoopData).toBe(true);
    expect(metadata.loopStart).toBe(0);
    expect(metadata.loopEnd).toBe(10 / 48_000);
  });

  it('round trips AIFF boundary markers and leaves root-only WAV metadata loop-disabled', async () => {
    const aiff = await bytes(await audioBufferToAiff(buffer(10), { bitDepth: 16, rootNote: 64, loopStart: 0, loopEnd: 10 }));
    const aiffMetadata = await readAudioMetadataFromArrayBuffer(exactBuffer(aiff), 'tone.aif', aiff.length);
    expect(aiffMetadata.hasLoopData).toBe(true);
    expect(aiffMetadata.loopEnd).toBe(10 / 48_000);

    const wav = await bytes(await audioBufferToWav(buffer(10), 16, { rootNote: 64 }));
    const wavMetadata = await readWavMetadataFromArrayBuffer(exactBuffer(wav), 'tone.wav', wav.length);
    expect(wavMetadata.hasLoopData).toBe(false);
  });
});
