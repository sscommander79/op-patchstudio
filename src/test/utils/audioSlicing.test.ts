import { describe, expect, it, vi } from 'vitest';
import {
  SLICE_LIMITS,
  analyzeSlices,
  buildSliceRanges,
  inspectSliceSource,
  materializeSlice,
  normalizeSliceMarkers,
  planSliceApplication,
  storedZipStructureBytes,
} from '../../utils/audioSlicing';

function buffer(channels: number[][], sampleRate = 1000): AudioBuffer {
  const audio = new AudioContext().createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((values, channel) => audio.getChannelData(channel).set(values));
  return audio;
}

function impulses(length: number, values: Array<[number, number]>) {
  const result = new Array<number>(length).fill(0);
  for (const [frame, value] of values) result[frame] = value;
  return result;
}

function realisticKickHatLoop(sampleRate: number, stereo: boolean) {
  const channels = Array.from({ length: stereo ? 2 : 1 }, () => new Array<number>(sampleRate * 2).fill(0));
  let randomState = 817;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 0x100000000 * 2 - 1;
  };
  for (const startSeconds of [.1, .9]) {
    const start = Math.round(startSeconds * sampleRate);
    for (let frame = 0; frame < sampleRate * .5; frame += 1) {
      const value = .8 * Math.sin(2 * Math.PI * 65 * frame / sampleRate) * Math.exp(-frame / (sampleRate * .1));
      channels[0][start + frame] += value;
      if (stereo) channels[1][start + frame] -= value * .82;
    }
  }
  for (const startSeconds of [.35, .65, 1.15, 1.45]) {
    const start = Math.round(startSeconds * sampleRate);
    for (let frame = 0; frame < sampleRate * .07; frame += 1) {
      const value = .3 * random() * Math.exp(-frame / (sampleRate * .012));
      channels[0][start + frame] += value;
      if (stereo) channels[1][start + frame] += value * .7;
    }
  }
  return buffer(channels, sampleRate);
}

function oneFrameAiff() {
  const bytes=new Uint8Array(56),view=new DataView(bytes.buffer),text=new TextEncoder();
  bytes.set(text.encode('FORM'),0);view.setUint32(4,48,false);bytes.set(text.encode('AIFF'),8);
  bytes.set(text.encode('COMM'),12);view.setUint32(16,18,false);view.setUint16(20,1,false);view.setUint32(22,1,false);view.setUint16(26,16,false);
  view.setUint16(28,0x400e,false);view.setUint32(30,0xbb800000,false);view.setUint32(34,0,false);
  bytes.set(text.encode('SSND'),38);view.setUint32(42,10,false);view.setUint32(46,0,false);view.setUint32(50,0,false);
  return bytes;
}

describe('automatic audio slicing', () => {
  it('finds hand-authored transient boundaries and excludes leading and trailing silence', async () => {
    const source = buffer([impulses(64, [[8, 1], [24, .8], [40, .9]])]);
    const result = await analyzeSlices(source, { sensitivity: .5, minimumSpacingFrames: 4 });
    expect(result.onsets).toEqual([8, 24, 40]);
    expect(result.ranges).toEqual([{ start: 8, end: 24 }, { start: 24, end: 40 }, { start: 40, end: 41 }]);
  });

  it('uses channel energy without opposite-polarity cancellation', async () => {
    const left = impulses(48, [[7, 1], [30, .7]]);
    const right = left.map(value => -value);
    const result = await analyzeSlices(buffer([left, right]), { sensitivity: .5, minimumSpacingFrames: 4 });
    expect(result.onsets).toEqual([7, 30]);
  });

  it('reports silence and stationary low noise as no onsets', async () => {
    const silence = await analyzeSlices(buffer([new Array(32).fill(0)]), { sensitivity: 1, minimumSpacingFrames: 1 });
    const noise = await analyzeSlices(buffer([Array.from({ length: 96 }, (_, i) => (i % 2 ? .004 : -.004))]), { sensitivity: 1, minimumSpacingFrames: 1 });
    expect(silence).toMatchObject({ onsets: [], ranges: [], reason: 'no-onsets' });
    expect(noise).toMatchObject({ onsets: [], ranges: [], reason: 'no-onsets' });
  });

  it('makes sensitivity meaningful and enforces minimum spacing between adjacent attacks', async () => {
    const source = buffer([impulses(64, [[8, 1], [24, .14], [40, .8], [42, .9]])]);
    const conservative = await analyzeSlices(source, { sensitivity: .2, minimumSpacingFrames: 4 });
    const sensitive = await analyzeSlices(source, { sensitivity: 1, minimumSpacingFrames: 4 });
    expect(conservative.onsets).toEqual([8, 42]);
    expect(sensitive.onsets).toEqual([8, 24, 42]);
  });

  it('treats each damped tonal or noise-like drum burst as one attack instead of retriggering on its ringing tail', async () => {
    const values=new Array<number>(1000).fill(0);
    for(let frame=0;frame<220;frame+=1) values[100+frame]=Math.cos(2*Math.PI*frame/20)*Math.exp(-frame/65);
    for(let frame=0;frame<220;frame+=1) {
      const noise=((frame*37)%23)/22*.6+.4;
      values[600+frame]=(frame%2?-1:1)*noise*.85*Math.exp(-frame/60);
    }
    const result=await analyzeSlices(buffer([values]),{sensitivity:.5,minimumSpacingFrames:20});
    expect(result.onsets).toEqual([100,600]);
    expect(result.ranges).toEqual([{start:100,end:600},{start:600,end:820}]);
  });

  it('refines a loud detection peak to a low-level precursor after local quiet', async () => {
    const sampleRate = 48000;
    const values = new Array<number>(sampleRate).fill(0);
    for (let frame = 0; frame < values.length; frame += 1) values[frame] = frame % 2 ? -.001 : .001;
    const precursor = 12000;
    for (let frame = 0; frame < 240; frame += 1) {
      const level = .02 + .06 * frame / 239;
      values[precursor + frame] = frame % 2 ? -level : level;
    }
    values[precursor + 240] = .8;
    values[precursor + 241] = -.45;
    values[precursor + 242] = .2;

    const result = await analyzeSlices(buffer([values], sampleRate), {
      sensitivity: .5,
      minimumSpacingFrames: Math.round(sampleRate * .08),
    });
    expect(result.onsets).toEqual([precursor]);
    expect(result.ranges[0].start).toBe(precursor);
  });

  it('keeps the earliest refined edge as stronger peaks slide through one continuous attack', async () => {
    const sampleRate = 48000;
    const values = new Array<number>(sampleRate).fill(0);
    for (let frame = 0; frame < values.length; frame += 1) values[frame] = frame % 2 ? -.001 : .001;
    const precursor = 17000;
    for (let frame = 0; frame < 1200; frame += 1) {
      const envelope = .02 + frame / 1200 * .08;
      values[precursor + frame] = (frame % 2 ? -1 : 1) * envelope;
    }
    for (const [offset, level] of [[600, .7], [780, .74], [960, .78]] as const) {
      values[precursor + offset] = level;
      values[precursor + offset + 1] = -level * .8;
    }

    const result = await analyzeSlices(buffer([values], sampleRate), {
      sensitivity: .5,
      minimumSpacingFrames: Math.round(sampleRate * .08),
    });
    expect(result.onsets).toHaveLength(1);
    expect(result.onsets[0]).toBe(precursor);
  });

  it.each<[number, boolean]>([[44100, false], [48000, true]])('finds quieter hats over kick tails at %i Hz (stereo: %s)', async (sampleRate, stereo) => {
    const source = realisticKickHatLoop(sampleRate, stereo);
    const result = await analyzeSlices(source, { sensitivity: .5, minimumSpacingFrames: Math.round(sampleRate * .08) });
    const expected = [.1, .35, .65, .9, 1.15, 1.45].map(seconds => Math.round(seconds * sampleRate));
    expect(result.onsets).toHaveLength(expected.length);
    result.onsets.forEach((onset, index) => {
      const tolerance = index === 0 || index === 3 ? Math.round(sampleRate * .0005) : 1;
      expect(Math.abs(onset - expected[index])).toBeLessThanOrEqual(tolerance);
    });

    const firstHat = result.onsets[1];
    const previous = materializeSlice(source, result.ranges[0]);
    const next = materializeSlice(source, result.ranges[1]);
    expect(result.ranges[0].end).toBe(firstHat);
    expect(result.ranges[1].start).toBe(firstHat);
    expect(result.ranges[0].end).toBeLessThanOrEqual(expected[1]);
    expect(result.ranges[1].end).toBeGreaterThan(expected[1]);
    expect([...previous.getChannelData(0)]).toEqual([...source.getChannelData(0).subarray(result.ranges[0].start, firstHat)]);
    expect([...next.getChannelData(0).subarray(0, 32)]).toEqual([...source.getChannelData(0).subarray(firstHat, firstHat + 32)]);
  });

  it('handles one-frame and short inputs without empty ranges', async () => {
    const one = await analyzeSlices(buffer([[.75]]), { sensitivity: .5, minimumSpacingFrames: 1 });
    const short = await analyzeSlices(buffer([[0, .8, 0]]), { sensitivity: .5, minimumSpacingFrames: 1 });
    expect(one.ranges).toEqual([{ start: 0, end: 1 }]);
    expect(short.ranges).toEqual([{ start: 1, end: 2 }]);
    for (const range of [...one.ranges, ...short.ranges]) expect(range.end).toBeGreaterThan(range.start);
  });

  it('yields during long analysis, reports progress, and honors cancellation', async () => {
    const source = buffer([impulses(20000, [[100, 1], [19000, 1]])], 48000);
    const progress: number[] = [];
    const controller = new AbortController();
    const yieldControl = vi.fn(async () => { if (progress.length >= 2) controller.abort(); });
    await expect(analyzeSlices(source, { sensitivity: .5, minimumSpacingFrames: 10 }, {
      signal: controller.signal, onProgress: value => progress.push(value), yieldEveryFrames: 1000, yieldControl,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(yieldControl).toHaveBeenCalled();
    expect(progress[0]).toBeGreaterThan(0);
  });

  it('bounds adversarial dense-onset output instead of retaining or silently dropping candidates', async () => {
    const dense = Array.from({ length: 900 }, (_, frame) => frame % 3 === 0 ? 1 : 0);
    await expect(analyzeSlices(buffer([dense]), { sensitivity: 1, minimumSpacingFrames: 1 })).rejects.toThrow(/more than 128 onsets/i);
  });
});

describe('manual markers and lossless slice assets', () => {
  it('normalizes stopped edits into stable unique starts and half-open nonempty ranges', () => {
    expect(normalizeSliceMarkers(10, [7, 0, 7, 12, -1, 4.4])).toEqual([0, 4, 7, 9]);
    expect(buildSliceRanges(10, [7, 0, 7, 12, -1, 4.4])).toEqual([
      { start: 0, end: 4 }, { start: 4, end: 7 }, { start: 7, end: 9 }, { start: 9, end: 10 },
    ]);
  });

  it('materializes exactly [start,end) while leaving every source channel bitwise unchanged', () => {
    const source = buffer([[.1, .2, .3, .4, .5], [-.1, -.2, -.3, -.4, -.5]], 48000);
    const before = Array.from({ length: 2 }, (_, channel) => new Float32Array(source.getChannelData(channel)));
    const sliced = materializeSlice(source, { start: 1, end: 4 }, (channels, frames, sampleRate) => new AudioContext().createBuffer(channels, frames, sampleRate));
    expect(sliced.length).toBe(3);
    expect([...sliced.getChannelData(0)]).toEqual([...before[0].slice(1, 4)]);
    expect([...sliced.getChannelData(1)]).toEqual([...before[1].slice(1, 4)]);
    expect(source.getChannelData(0)).toEqual(before[0]);
    expect(source.getChannelData(1)).toEqual(before[1]);
  });
});

describe('slice resource preflight', () => {
  it('reads WAV dimensions before decode and rejects malformed or over-budget sources', () => {
    const wav = new ArrayBuffer(4044);
    const bytes = new Uint8Array(wav); bytes.set(new TextEncoder().encode('RIFF'), 0); bytes.set(new TextEncoder().encode('WAVEfmt '), 8);
    const view = new DataView(wav); view.setUint32(4,wav.byteLength-8,true);view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
    view.setUint32(24, 48000, true); view.setUint32(28, 192000, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
    bytes.set(new TextEncoder().encode('data'), 36); view.setUint32(40, 4000, true);
    expect(inspectSliceSource(wav, 'source.wav')).toEqual({ channels: 2, frames: 1000, sampleRate: 48000, decodedBytes: 8000 });
    const oversizedDataBytes=SLICE_LIMITS.decodedSourceBytes/4+1;
    const oversized = new ArrayBuffer(44 + oversizedDataBytes + (oversizedDataBytes%2));
    const bigBytes = new Uint8Array(oversized); bigBytes.set(new TextEncoder().encode('RIFF'), 0); bigBytes.set(new TextEncoder().encode('WAVEfmt '), 8);
    const bigView = new DataView(oversized);bigView.setUint32(4,oversized.byteLength-8,true); bigView.setUint32(16, 16, true); bigView.setUint16(20, 1, true); bigView.setUint16(22, 1, true);
    bigView.setUint32(24, 48000, true); bigView.setUint32(28, 48000, true); bigView.setUint16(32, 1, true); bigView.setUint16(34, 8, true);
    bigBytes.set(new TextEncoder().encode('data'), 36); bigView.setUint32(40, oversizedDataBytes, true);
    expect(() => inspectSliceSource(oversized, 'source.wav')).toThrow(/decoded source exceeds/i);
  });

  it('rejects dishonest PCM dimensions and compressed sources before browser decode', () => {
    const wav = new ArrayBuffer(4044);
    const bytes=new Uint8Array(wav),view=new DataView(wav);
    bytes.set(new TextEncoder().encode('RIFF'),0);view.setUint32(4,wav.byteLength-8,true);bytes.set(new TextEncoder().encode('WAVEfmt '),8);
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,48_000,true);
    view.setUint32(28,48_000,true);view.setUint16(32,1,true);view.setUint16(34,16,true);
    bytes.set(new TextEncoder().encode('data'),36);view.setUint32(40,4000,true);
    expect(()=>inspectSliceSource(wav,'dishonest.wav')).toThrow(/block alignment/i);

    view.setUint16(20,6,true);view.setUint16(32,4,true);
    expect(()=>inspectSliceSource(wav,'compressed.wav')).toThrow(/compressed WAV/i);
    const aifc=new Uint8Array(12);aifc.set(new TextEncoder().encode('FORM'),0);aifc.set(new TextEncoder().encode('AIFC'),8);
    expect(()=>inspectSliceSource(aifc.buffer,'compressed.aif')).toThrow(/compressed AIFF-C/i);
  });

  it('rejects WAV and AIFF chunks, padding, or trailing bytes outside the declared container', () => {
    const validWav=new Uint8Array(46),wavView=new DataView(validWav.buffer),text=new TextEncoder();
    validWav.set(text.encode('RIFF'),0);wavView.setUint32(4,38,true);validWav.set(text.encode('WAVEfmt '),8);
    wavView.setUint32(16,16,true);wavView.setUint16(20,1,true);wavView.setUint16(22,1,true);wavView.setUint32(24,48000,true);
    wavView.setUint32(28,96000,true);wavView.setUint16(32,2,true);wavView.setUint16(34,16,true);validWav.set(text.encode('data'),36);wavView.setUint32(40,2,true);
    expect(inspectSliceSource(validWav.buffer,'valid.wav')).toMatchObject({frames:1,channels:1,sampleRate:48000});
    const wavTrailing=new Uint8Array(48);wavTrailing.set(validWav);
    expect(()=>inspectSliceSource(wavTrailing.buffer,'trailing.wav')).toThrow(/RIFF size/i);
    const wavOutside=new Uint8Array(validWav);new DataView(wavOutside.buffer).setUint32(4,4,true);
    expect(()=>inspectSliceSource(wavOutside.buffer,'outside.wav')).toThrow(/RIFF size/i);
    const wavBadPad=new Uint8Array(45);wavBadPad.set(validWav.subarray(0,45));new DataView(wavBadPad.buffer).setUint32(4,37,true);new DataView(wavBadPad.buffer).setUint32(40,1,true);
    expect(()=>inspectSliceSource(wavBadPad.buffer,'padding.wav')).toThrow(/padding|dimensions/i);
    const wavMalformedTail=new Uint8Array(54);wavMalformedTail.set(validWav);wavMalformedTail.set(text.encode('JUNK'),46);
    new DataView(wavMalformedTail.buffer).setUint32(4,46,true);new DataView(wavMalformedTail.buffer).setUint32(50,4,true);
    expect(()=>inspectSliceSource(wavMalformedTail.buffer,'malformed-tail.wav')).toThrow(/chunk outside.*RIFF/i);

    const validAiff=oneFrameAiff();
    expect(inspectSliceSource(validAiff.buffer,'valid.aiff')).toMatchObject({frames:1,channels:1,sampleRate:48000});
    const aiffTrailing=new Uint8Array(58);aiffTrailing.set(validAiff);
    expect(()=>inspectSliceSource(aiffTrailing.buffer,'trailing.aiff')).toThrow(/FORM size/i);
    const aiffOutside=new Uint8Array(validAiff);new DataView(aiffOutside.buffer).setUint32(4,4,false);
    expect(()=>inspectSliceSource(aiffOutside.buffer,'outside.aiff')).toThrow(/FORM size/i);
    const aiffBadPad=new Uint8Array(55);aiffBadPad.set(validAiff.subarray(0,55));new DataView(aiffBadPad.buffer).setUint32(4,47,false);new DataView(aiffBadPad.buffer).setUint32(42,9,false);
    expect(()=>inspectSliceSource(aiffBadPad.buffer,'padding.aiff')).toThrow(/padding|dimensions/i);
    const aiffMalformedTail=new Uint8Array(64);aiffMalformedTail.set(validAiff);aiffMalformedTail.set(text.encode('JUNK'),56);
    new DataView(aiffMalformedTail.buffer).setUint32(4,56,false);new DataView(aiffMalformedTail.buffer).setUint32(60,4,false);
    expect(()=>inspectSliceSource(aiffMalformedTail.buffer,'malformed-tail.aiff')).toThrow(/chunk outside.*FORM/i);
  });

  it('accounts for existing project audio, sample count, source retention, and derived buffers before allocation', () => {
    const audio = buffer([new Array(10).fill(0)], 1000);
    const existing = [{ audioBuffer: audio, file: new File(['1234'], 'existing.wav'), isLoaded: true }];
    expect(planSliceApplication({ source: audio, ranges: [{ start: 0, end: 5 }, { start: 5, end: 10 }], existingSamples: existing, retainExternalSource: true, sourceFileBytes: 4 })).toMatchObject({ additionalSamples: 3, derivedDecodedBytes: 40 });
    expect(() => planSliceApplication({ source: audio, ranges: Array.from({ length: SLICE_LIMITS.sliceCount + 1 }, () => ({ start: 0, end: 1 })), existingSamples: existing, retainExternalSource: false, sourceFileBytes: 0 })).toThrow(/128 slices/i);
  });

  it('counts each logical opfloat header at the project decoded limit', () => {
    const source=buffer([[1]],8000);
    const nearLimitFrames=(SLICE_LIMITS.projectDecodedBytes-24-28)/4;
    const nearLimit={audioBuffer:{length:nearLimitFrames,numberOfChannels:1} as AudioBuffer,file:null,isLoaded:true};
    expect(planSliceApplication({source,ranges:[{start:0,end:1}],existingSamples:[nearLimit],retainExternalSource:false,sourceFileBytes:0}).projectedDecodedBytes).toBe(SLICE_LIMITS.projectDecodedBytes);
    const crossing={...nearLimit,audioBuffer:{length:nearLimitFrames+1,numberOfChannels:1} as AudioBuffer};
    expect(()=>planSliceApplication({source,ranges:[{start:0,end:1}],existingSamples:[crossing],retainExternalSource:false,sourceFileBytes:0})).toThrow(/128 MiB decoded-project/i);
  });

  it('reserves the archive manifest and maximum STORE ZIP layout at the supported boundary', () => {
    const source=buffer([[1]],8000);
    const existingAudioBytes=4*(24+4),derivedAudioBytes=24+4;
    const exactFileBytes=SLICE_LIMITS.projectStoredBytes-SLICE_LIMITS.projectManifestReserveBytes-SLICE_LIMITS.projectZipStructureReserveBytes-existingAudioBytes-derivedAudioBytes;
    const baseFileBytes=Math.floor(exactFileBytes/4),fileBytes=[baseFileBytes,baseFileBytes,baseFileBytes,exactFileBytes-baseFileBytes*3];
    expect(Math.max(...fileBytes)).toBeLessThanOrEqual(SLICE_LIMITS.sourceFileBytes);
    const existing=fileBytes.map(size=>({audioBuffer:source,file:{size} as File,isLoaded:true}));
    const exact=planSliceApplication({source,ranges:[{start:0,end:1}],existingSamples:existing,retainExternalSource:false,sourceFileBytes:0});
    expect(exact.projectedArchiveBytes).toBe(SLICE_LIMITS.projectStoredBytes);
    expect(()=>planSliceApplication({source,ranges:[{start:0,end:1}],existingSamples:existing.map((asset,index)=>index?asset:{...asset,file:{size:fileBytes[0]+1} as File}),retainExternalSource:false,sourceFileBytes:0})).toThrow(/portable project size limit/i);
    expect(SLICE_LIMITS.projectZipStructureReserveBytes).toBe(storedZipStructureBytes([
      'manifest.json',
      ...Array.from({length:256},(_,index)=>`assets/audio-${String(index).padStart(4,'0')}.opfloat`),
      ...Array.from({length:256},(_,index)=>`assets/source-${String(index).padStart(4,'0')}.bin`),
    ]));
  });
});
