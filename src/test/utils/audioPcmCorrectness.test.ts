import { describe, expect, it } from 'vitest';
import { calculatePatchSize, downmixStereoToMono,readWavMetadataFromArrayBuffer } from '../../utils/audio';
import { audioBufferToWav } from '../../utils/wavExport';
import {preflightAudioImport} from '../../utils/audioImportPreflight';

function stereo(left: number[], right: number[]): AudioBuffer {
  const value = new AudioBuffer({ numberOfChannels: 2, length: left.length, sampleRate: 48_000 });
  value.copyToChannel(Float32Array.from(left), 0);
  value.copyToChannel(Float32Array.from(right), 1);
  return value;
}

function findChunk(bytes: Uint8Array, wanted: string): { dataOffset: number; size: number } {
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = decoder.decode(bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === wanted) return { dataOffset: offset + 8, size };
    offset += 8 + size + (size & 1);
  }
  throw new Error(`Missing ${wanted} chunk`);
}

describe('PCM conversion correctness', () => {
  it('downmixes stereo by arithmetic mean without doubling equal channels', () => {
    const result = downmixStereoToMono(stereo([0.75, 0.5, -0.25], [0.75, -0.5, 0.25]));

    expect(Array.from(result.getChannelData(0))).toEqual([0.75, 0, 0]);
    expect(result.length).toBe(3);
    expect(result.sampleRate).toBe(48_000);
  });

  it('writes 12-bit quantization in a valid 16-bit PCM container for 102 frames', async () => {
    const source = new AudioBuffer({ numberOfChannels: 1, length: 102, sampleRate: 48_000 });
    const samples = source.getChannelData(0);
    for (let frame = 0; frame < samples.length; frame++) {
      samples[frame] = (frame - 51) / 50;
    }

    const blob = await audioBufferToWav(source, 12);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const fmt = findChunk(bytes, 'fmt ');
    const data = findChunk(bytes, 'data');

    expect(view.getUint16(fmt.dataOffset, true)).toBe(1);
    expect(view.getUint16(fmt.dataOffset + 14, true)).toBe(16);
    expect(view.getUint16(fmt.dataOffset + 12, true)).toBe(2);
    expect(view.getUint32(fmt.dataOffset + 8, true)).toBe(96_000);
    expect(data.size).toBe(102 * 2);
    expect(bytes.length).toBe(44 + 102 * 2);

    const decoded = Array.from({ length: 102 }, (_, frame) =>
      view.getInt16(data.dataOffset + frame * 2, true));
    expect(decoded.every(sample => (sample & 0x0f) === 0)).toBe(true);
    expect(decoded[0]).toBe(-32752);
    expect(decoded[51]).toBe(0);
    expect(decoded[101]).toBe(32752);
  });

  it('estimates 12-bit WAV exports using their 16-bit container width', async () => {
    const source = new AudioBuffer({ numberOfChannels: 2, length: 102, sampleRate: 48_000 });

    await expect(calculatePatchSize([source], { bitDepth: 12 })).resolves.toBe(44 + 102 * 2 * 2);
  });

  it.each([8,24])('pads odd-sized %s-bit WAV data and preflights its own export',async bitDepth=>{
    const source=new AudioBuffer({numberOfChannels:1,length:1,sampleRate:48_000});
    const blob=await audioBufferToWav(source,bitDepth),bytes=new Uint8Array(await blob.arrayBuffer()),data=findChunk(bytes,'data');
    expect(data.size).toBe(bitDepth/8);
    expect(bytes.length%2).toBe(0);
    expect(bytes.at(-1)).toBe(0);
    await expect(preflightAudioImport(new File([bytes],`odd-${bitDepth}.wav`),28,48_000)).resolves.toEqual({kind:'pcm',estimatedDecodedBytes:28});
  });

  it('accepts a legacy final odd WAV data chunk without its pad byte',async()=>{
    const source=new AudioBuffer({numberOfChannels:1,length:1,sampleRate:48_000});
    const exported=new Uint8Array(await (await audioBufferToWav(source,8)).arrayBuffer());
    const unpadded=exported.slice(0,-1);
    await expect(preflightAudioImport(new File([unpadded],'legacy.wav'),28,48_000)).resolves.toEqual({kind:'pcm',estimatedDecodedBytes:28});
  });

  it('parses fmt and data chunks after an odd-sized padded WAV chunk',async()=>{
    const bytes=new Uint8Array(56),view=new DataView(bytes.buffer),text=new TextEncoder();
    bytes.set(text.encode('RIFF'),0);view.setUint32(4,48,true);bytes.set(text.encode('WAVE'),8);
    bytes.set(text.encode('JUNK'),12);view.setUint32(16,1,true);bytes[20]=1;
    bytes.set(text.encode('fmt '),22);view.setUint32(26,16,true);view.setUint16(30,1,true);view.setUint16(32,1,true);view.setUint32(34,48_000,true);view.setUint32(38,48_000,true);view.setUint16(42,1,true);view.setUint16(44,8,true);
    bytes.set(text.encode('data'),46);view.setUint32(50,1,true);bytes[54]=128;
    const metadata=await readWavMetadataFromArrayBuffer(bytes.buffer,'padded.wav',bytes.length);
    expect(metadata).toMatchObject({format:'PCM',sampleRate:48_000,channels:1,bitDepth:8,dataLength:1});
  });
});
