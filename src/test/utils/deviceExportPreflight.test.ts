import { describe, expect, it, vi } from 'vitest';
import { initialState, type DrumSample } from '../../context/AppContext';
import { buildDeviceExportPreflight } from '../../utils/deviceExportPreflight';
import { generateDrumPatch } from '../../utils/patchGeneration';
import { audioContextManager } from '../../utils/audioContext';
import JSZip from 'jszip';

function audio(frames:number, sampleRate=44100) {
  return new AudioBuffer({numberOfChannels:1,length:frames,sampleRate});
}

function loaded(name:string, frames:number, assignedKey:number|undefined):DrumSample {
  const audioBuffer=audio(frames);
  return {
    ...initialState.drumSamples[0], name, file:new File(['x'],`${name}.wav`,{type:'audio/wav'}), audioBuffer,
    isLoaded:true,isAssigned:assignedKey!==undefined,assignedKey,inPoint:0,outPoint:audioBuffer.duration,
    originalBitDepth:16,originalSampleRate:44100,originalChannels:1,fileSize:1,duration:audioBuffer.duration,
  };
}

describe('device export preflight', () => {
  it('defaults a drum export to mapped audio and reports retained exclusions', () => {
    const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'My Kit',sampleRate:44100,bitDepth:16,channels:1},
      drumSamples:[loaded('kick',4410,0),...initialState.drumSamples.slice(1,24),loaded('source',22050,undefined)]};

    const plan=buildDeviceExportPreflight(state,'drum',false);

    expect(plan.mappedCount).toBe(1);
    expect(plan.unassignedCount).toBe(1);
    expect(plan.includedCount).toBe(1);
    expect(plan.omittedCount).toBe(1);
    expect(plan.errors).toEqual([]);
    expect(plan.formatSummary).toBe('WAV · 44.1 kHz · 16-bit · mono');
  });

  it('includes retained audio only after explicit opt in and warns with trim or slice guidance', () => {
    const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Long Kit'},
      drumSamples:[loaded('kick',4410,0),...initialState.drumSamples.slice(1,24),loaded('long-source',44100*21,undefined)]};

    const mapped=buildDeviceExportPreflight(state,'drum',false);
    const all=buildDeviceExportPreflight(state,'drum',true);

    expect(mapped.warnings.join(' ')).not.toMatch(/long-source/);
    expect(all.includedCount).toBe(2);
    expect(all.warnings.join(' ')).toMatch(/long-source.*20 seconds.*trim or slice/i);
  });

  it('uses the normalized playable range for the 20 second limit and legacy physical mapping semantics', () => {
    const legacy=loaded('legacy',44100*21,undefined);
    legacy.isAssigned=true;
    legacy.outPoint=10;
    const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Legacy'},drumSamples:[legacy,...initialState.drumSamples.slice(1)]};

    const plan=buildDeviceExportPreflight(state,'drum',false);

    expect(plan.mappedCount).toBe(1);
    expect(plan.warnings.join(' ')).not.toMatch(/20 seconds/);
    expect(plan.estimatedBytes).toBeGreaterThan(44100*20*2);
    expect(plan.sizeBasis).toMatch(/complete exported audio file.*selected trim range/i);
  });

  it('blocks blank names, unassigned-only drum projects and invalid source dimensions', () => {
    const invalid=loaded('broken',4410,undefined);
    invalid.audioBuffer=null as unknown as AudioBuffer;
    const state={...initialState,drumSamples:[...initialState.drumSamples,invalid]};

    const plan=buildDeviceExportPreflight(state,'drum',false);

    expect(plan.errors).toContain('Enter an instrument name before exporting.');
    expect(plan.errors).toContain('Assign at least one sample to a playable pad before exporting.');
    expect(plan.errors.join(' ')).toMatch(/broken.*audio data/i);
  });

  it('names any explicit target rate and reports preserve-mode decoded fallbacks truthfully',()=>{
    const compressed=loaded('compressed',4800,0);
    compressed.audioBuffer=new AudioBuffer({numberOfChannels:2,length:4800,sampleRate:48000});
    compressed.originalSampleRate=undefined;
    compressed.originalChannels=undefined;
    compressed.originalBitDepth=undefined;
    const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Fallback',sampleRate:48000,bitDepth:0,channels:0},drumSamples:[compressed,...initialState.drumSamples.slice(1)]};
    const plan=buildDeviceExportPreflight(state,'drum');
    expect(plan.formatSummary).toBe('WAV · 48 kHz · source depth where known; 16-bit fallback · stereo');
    expect(plan.warnings.join(' ')).toMatch(/unknown source bit depth.*16-bit export fallback/i);
    expect(plan.estimatedBytes).toBe(44+4800*2*2);

    const preserve=buildDeviceExportPreflight({...state,drumSettings:{...state.drumSettings,sampleRate:0}},'drum');
    expect(preserve.formatSummary).toBe('WAV · 48 kHz · source depth where known; 16-bit fallback · stereo');
  });

  it('matches preserve-rate conversion fallback and keep-channel writer semantics',()=>{
    const converted=loaded('stereo-source',48_000,0);
    converted.audioBuffer=new AudioBuffer({numberOfChannels:2,length:48_000,sampleRate:48_000});
    converted.originalSampleRate=44_100;converted.originalChannels=2;
    const drumState={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Fallback',sampleRate:0,bitDepth:16,channels:1},drumSamples:[converted,...initialState.drumSamples.slice(1)]};
    const drum=buildDeviceExportPreflight(drumState,'drum');
    expect(drum.formatSummary).toBe('WAV · 44.1 kHz · 16-bit · mono');
    expect(drum.estimatedBytes).toBe(44+44_100*2);

    const mono={...converted,audioBuffer:new AudioBuffer({numberOfChannels:1,length:48_000,sampleRate:48_000}),originalChannels:1};
    const keep=buildDeviceExportPreflight({...drumState,drumSettings:{...drumState.drumSettings,channels:2},drumSamples:[mono,...initialState.drumSamples.slice(1)]},'drum');
    expect(keep.formatSummary).toBe('WAV · 48 kHz · 16-bit · mono');
    expect(keep.estimatedBytes).toBe(44+48_000*2);
  });

  it('matches the actual preserve-rate mono export bytes used by preflight',async()=>{
    const converted=loaded('stereo-source',48_000,0);
    converted.audioBuffer=new AudioBuffer({numberOfChannels:2,length:48_000,sampleRate:48_000});converted.originalSampleRate=44_100;converted.originalChannels=2;
    const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Fallback',sampleRate:0,bitDepth:16,channels:1},drumSamples:[converted,...initialState.drumSamples.slice(1)]};
    const plan=buildDeviceExportPreflight(state,'drum');
    vi.spyOn(audioContextManager,'createOfflineContext').mockImplementationOnce((channels,length,sampleRate)=>({
      destination:{},
      createBufferSource:()=>({buffer:null,connect:vi.fn(),start:vi.fn()}),
      createGain:()=>({gain:{value:1},connect:vi.fn()}),
      createChannelSplitter:()=>({connect:vi.fn()}),
      createChannelMerger:()=>({connect:vi.fn()}),
      startRendering:async()=>new AudioBuffer({numberOfChannels:channels,length,sampleRate}),
    }) as unknown as OfflineAudioContext);
    const zip=await JSZip.loadAsync(await generateDrumPatch(state,'Fallback',undefined,16,'mono','wav'));
    const patch=JSON.parse(await zip.file('patch.json')!.async('string')) as {regions:Array<{sample:string}>};
    const bytes=await zip.file(patch.regions[0].sample)!.async('uint8array'),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let dataOffset=12;
    while (String.fromCharCode(...bytes.slice(dataOffset,dataOffset+4))!=='data') dataOffset+=8+view.getUint32(dataOffset+4,true);
    expect(view.getUint16(22,true)).toBe(1);expect(view.getUint32(24,true)).toBe(44_100);
    expect(view.getUint32(dataOffset+4,true)).toBe(plan.estimatedBytes-44);
  });
});
