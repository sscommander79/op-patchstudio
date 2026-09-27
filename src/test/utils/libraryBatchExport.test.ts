import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { buildLibraryBatchArchive, libraryPresetFolderNames, renderSavedPreset } from '../../utils/libraryBatchExport';
import type { LibraryPreset } from '../../utils/libraryUtils';
import { defaultDrumSettings, defaultMultisampleSettings } from '../../utils/defaultSettings';
import { encodeStoredAudio } from '../../utils/storedAudio';
import { percentToInternal } from '../../utils/valueConversions';

const preset = (id:string,name:string):LibraryPreset => ({id,name,type:'drum',data:{drumSettings:{},multisampleSettings:{},drumSamples:[],multisampleFiles:[]},createdAt:1,updatedAt:1,isFavorite:false});
const rendered = async (name:string):Promise<Blob> => {
  const zip=new JSZip();zip.file('patch.json',JSON.stringify({name,regions:[{sample:'pad..take.wav'}]}));
  zip.file('pad..take.wav',new Uint8Array([1,2,3]));
  return zip.generateAsync({type:'blob'});
};

describe('library batch export',()=>{
  it('allocates safe, case-insensitive unique preset folders',()=>{
    expect(libraryPresetFolderNames([preset('1','Stage/Keys'),preset('2','stagekeys'),preset('3','CON.txt'),preset('4','../')]))
      .toEqual(['StageKeys.preset','stagekeys-2.preset','Preset.preset','Preset-2.preset']);
  });

  it('packages complete device presets in selection order into one extraction-ready archive',async()=>{
    const inputs=[preset('a','Stage drums'),preset('b','Stage keys')];
    const progress: string[]=[];
    const render=vi.fn(async (item:LibraryPreset)=>rendered(item.name));
    const blob=await buildLibraryBatchArchive(inputs,{renderPreset:render,onProgress:({completed})=>progress.push(String(completed))});
    const zip=await JSZip.loadAsync(blob);
    expect(render.mock.calls.map(([item])=>item.id)).toEqual(['a','b']);
    expect(await zip.file('Stage drums.preset/patch.json')?.async('string')).toContain('Stage drums');
    expect(await zip.file('Stage keys.preset/pad..take.wav')?.async('uint8array')).toEqual(new Uint8Array([1,2,3]));
    expect(await zip.file('collection-order.txt')?.async('string')).toContain('1. Stage drums.preset\n2. Stage keys.preset');
    expect(progress).toEqual(['0','1','1','2']);
  });

  it('rejects one failed preset or cancellation instead of returning a partial archive',async()=>{
    const inputs=[preset('a','A'),preset('b','B')];
    await expect(buildLibraryBatchArchive(inputs,{renderPreset:async item=>item.id==='a'?rendered('A'):Promise.reject(new Error('bad audio'))})).rejects.toThrow('bad audio');
    const controller=new AbortController();
    await expect(buildLibraryBatchArchive(inputs,{signal:controller.signal,renderPreset:async item=>{if(item.id==='a')controller.abort();return rendered(item.name);}})).rejects.toMatchObject({name:'AbortError'});
  });

  it('rejects unexpected paths or missing patch.json from a rendered preset',async()=>{
    const zip=new JSZip();zip.file('bad/entry.wav','audio');zip.file('patch.json','{}');
    await expect(buildLibraryBatchArchive([preset('a','A')],{renderPreset:async()=>zip.generateAsync({type:'blob'})})).rejects.toThrow(/unsafe/);
    await expect(buildLibraryBatchArchive([preset('a','A')],{renderPreset:async()=>new Blob()})).rejects.toThrow();
  });

  it('renders saved sparse pad assignment and settings from the preset rather than the open project',async()=>{
    const audio=new AudioBuffer({numberOfChannels:1,length:441,sampleRate:44100});
    audio.getChannelData(0)[0]=0.5;
    const saved:LibraryPreset={id:'sparse',name:'Saved kit',type:'drum',createdAt:1,updatedAt:1,isFavorite:false,
      data:{drumSettings:{...defaultDrumSettings,renameFiles:true,presetSettings:{...defaultDrumSettings.presetSettings,volume:33}},
        multisampleSettings:defaultMultisampleSettings,multisampleFiles:[],midiNoteMapping:'C4',
        drumSamples:[{originalIndex:5,name:'snare.wav',audioBlob:encodeStoredAudio(audio),file:new File(['source'],'snare.wav',{type:'audio/wav'}),
          isAssigned:true,assignedKey:9,inPoint:0,outPoint:audio.duration,playmode:'oneshot',reverse:false,transpose:2,pan:0,gain:0,
          originalSampleRate:44100,originalBitDepth:16,originalChannels:1}]}};
    const zip=await JSZip.loadAsync(await renderSavedPreset(saved));
    const patch=JSON.parse((await zip.file('patch.json')!.async('string')));
    expect(patch.regions).toHaveLength(1);
    expect(patch.regions[0]).toMatchObject({lokey:62,hikey:62,transpose:2});
    expect(patch.engine.volume).toBe(percentToInternal(33));
    expect(zip.file(patch.regions[0].sample)).not.toBeNull();
  });
});
