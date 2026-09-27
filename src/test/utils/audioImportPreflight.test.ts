import { describe, expect, it, vi } from 'vitest';
import { preflightAudioImport } from '../../utils/audioImportPreflight';
import { prepareAudioImportFiles } from '../../utils/audioImport';

function wav(frames: number, channels = 1, rate = 48_000): File {
  const bytes = new Uint8Array(44 + frames * channels * 2), view = new DataView(bytes.buffer), text = new TextEncoder();
  bytes.set(text.encode('RIFF'), 0); view.setUint32(4, bytes.length - 8, true); bytes.set(text.encode('WAVEfmt '), 8);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  bytes.set(text.encode('data'), 36); view.setUint32(40, frames * channels * 2, true);
  return new File([bytes], 'sample.wav', { type: 'audio/wav' });
}

function aiff(frames:number,options:{channels?:number;bits?:number;soundBytes?:number;soundOffset?:number}={}) {
  const channels=options.channels??1,bits=options.bits??16,soundOffset=options.soundOffset??0;
  const soundBytes=options.soundBytes??frames*channels*Math.ceil(bits/8);
  const commSize=18,ssndSize=8+soundOffset+soundBytes,total=12+(8+commSize)+(8+ssndSize+(ssndSize&1));
  const bytes=new Uint8Array(total),view=new DataView(bytes.buffer),text=new TextEncoder();
  bytes.set(text.encode('FORM'),0);view.setUint32(4,total-8,false);bytes.set(text.encode('AIFF'),8);
  bytes.set(text.encode('COMM'),12);view.setUint32(16,commSize,false);view.setUint16(20,channels,false);view.setUint32(22,frames,false);view.setUint16(26,bits,false);
  bytes.set(Uint8Array.from([0x40,0x0e,0xac,0x44,0,0,0,0,0,0]),28);
  const ssnd=38;bytes.set(text.encode('SSND'),ssnd);view.setUint32(ssnd+4,ssndSize,false);view.setUint32(ssnd+8,soundOffset,false);view.setUint32(ssnd+12,0,false);
  return new File([bytes],'sample.aiff',{type:'audio/aiff'});
}

describe('audio import allocation preflight', () => {
  it('accepts a valid PCM boundary using only sliced container reads', async () => {
    const file = wav(100);
    const fullRead = vi.spyOn(file, 'arrayBuffer');
    await expect(preflightAudioImport(file, 24 + 4 * 100, 48_000)).resolves.toEqual({ kind: 'pcm', estimatedDecodedBytes: 424 });
    expect(fullRead).not.toHaveBeenCalled();
  });

  it('rejects an oversized known PCM declaration before decode is invoked', async () => {
    const file = wav(1024), decode = vi.fn();
    const result = await prepareAudioImportFiles([{ id: 'large', path: file.name, file }], 'drum', 0, 'C3', undefined, undefined, decode, {
      maxDecodedBytes: 100,
      preflight: preflightAudioImport,
    });
    expect(decode).not.toHaveBeenCalled();
    expect(result.excess).toEqual([{ id: 'large', path: 'sample.wav', reason: '128 MiB decoded-audio project limit reached' }]);
  });

  it('rejects malformed chunk extents and honors cancellation between slice reads', async () => {
    const malformed = wav(2), bytes = new Uint8Array(await malformed.arrayBuffer());
    new DataView(bytes.buffer).setUint32(40, 1000, true);
    await expect(preflightAudioImport(new File([bytes], 'bad.wav'), 10_000, 48_000)).rejects.toThrow(/truncated/i);

    const controller = new AbortController(), file = wav(2);
    const original = file.slice.bind(file);
    vi.spyOn(file, 'slice').mockImplementation((...args) => { controller.abort(); return original(...args); });
    await expect(preflightAudioImport(file, 10_000, 48_000, controller.signal)).rejects.toThrow(/canceled/i);
  });

  it('allows bounded compressed signatures without claiming a decoded size', async () => {
    const file = new File([new TextEncoder().encode('ID3 compressed')], 'sample.mp3');
    await expect(preflightAudioImport(file, 1, 48_000)).resolves.toEqual({ kind: 'compressed' });
  });

  it('classifies compressed WAV formats without treating block alignment as PCM frames',async()=>{
    const bytes=new Uint8Array(await wav(100).arrayBuffer());
    new DataView(bytes.buffer).setUint16(20,17,true);
    await expect(preflightAudioImport(new File([bytes],'adpcm.wav'),1,48_000)).resolves.toEqual({kind:'compressed'});
  });

  it('bounds hostile chunk tables before making unbounded slice reads',async()=>{
    const count=1025,bytes=new Uint8Array(12+count*8),view=new DataView(bytes.buffer),text=new TextEncoder();
    bytes.set(text.encode('RIFF'),0);view.setUint32(4,bytes.length-8,true);bytes.set(text.encode('WAVE'),8);
    for(let index=0;index<count;index++)bytes.set(text.encode('JUNK'),12+index*8);
    const file=new File([bytes],'chunks.wav'),slices=vi.spyOn(file,'slice');
    await expect(preflightAudioImport(file,1_000_000,48_000)).rejects.toThrow(/too many chunks/i);
    expect(slices.mock.calls.length).toBeLessThanOrEqual(1025);
  });

  it('validates AIFF dimensions, rate sign, and SSND extent',async()=>{
    await expect(preflightAudioImport(aiff(2),32,44_100)).resolves.toEqual({kind:'pcm',estimatedDecodedBytes:32});
    const noChannels=new Uint8Array(await aiff(2).arrayBuffer());new DataView(noChannels.buffer).setUint16(20,0,false);
    await expect(preflightAudioImport(new File([noChannels],'channels.aiff'),100,44_100)).rejects.toThrow(/dimensions/i);
    const negativeRate=new Uint8Array(await aiff(2).arrayBuffer());new DataView(negativeRate.buffer).setUint16(28,0xc00e,false);
    await expect(preflightAudioImport(new File([negativeRate],'rate.aiff'),100,44_100)).rejects.toThrow(/dimensions/i);
    await expect(preflightAudioImport(aiff(2,{soundBytes:2}),100,44_100)).rejects.toThrow(/SSND data extent/i);
    const invalidOffset=new Uint8Array(await aiff(1,{soundBytes:2}).arrayBuffer());new DataView(invalidOffset.buffer).setUint32(46,100,false);
    await expect(preflightAudioImport(new File([invalidOffset],'offset.aiff'),100,44_100)).rejects.toThrow(/audio offset/i);
  });
});
