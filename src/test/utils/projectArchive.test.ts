import JSZip from 'jszip';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appReducer, initialState, type AppState, type DrumSample, type MultisampleFile } from '../../context/AppContext';
import { createProjectSnapshot } from '../../utils/projectSerialization';
import { prepareSliceApplication, SLICE_LIMITS, storedZipStructureBytes } from '../../utils/audioSlicing';
import {
  PROJECT_ARCHIVE_LIMITS,
  PROJECT_ARCHIVE_MANIFEST,
  exportProjectArchive,
  importProjectArchive,
  validateProjectArchiveMetadata,
} from '../../utils/projectArchive';
import { TASK3_LEGACY_ARCHIVE_BASE64 } from '../fixtures/task3LegacyArchive';

const bytes = async (blob:Blob) => new Uint8Array(await blob.arrayBuffer());
const PositionalAudioBuffer = globalThis.AudioBuffer as unknown as new(channels:number,length:number,sampleRate:number)=>AudioBuffer;

interface TestArchiveManifest {
  version:number;
  project:{
    drumSettings:{sampleRate:number|string};
    drumSamples:Array<{originalIndex:number;sampleId:string;sliceProvenance?:DrumSample['sliceProvenance']}>;
    multisampleFiles:Array<{inPoint:number;outPoint:number;loopCrossfade:{fraction:number;importedFramecount:number}}>;
  };
  samples:Array<{
    id:string;name:string;audioPath:string;sourcePath?:string;
    metadata:Record<string,unknown>;
    audio:{bytes:number;frames:number;channels:number};
  }>;
}

beforeEach(() => {
  vi.stubGlobal('Blob',NodeBlob);
  vi.stubGlobal('File',NodeFile);
  vi.stubGlobal('AudioBuffer',class extends PositionalAudioBuffer {
    constructor(options:AudioBufferOptions) { super(options.numberOfChannels ?? 1,options.length,options.sampleRate); }
  });
});
afterEach(() => vi.unstubAllGlobals());

function audio(channels:number[][], sampleRate=48000) {
  const buffer = new AudioContext().createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((values,index) => buffer.getChannelData(index).set(values));
  return buffer;
}

function loadedDrum(index:number, name:string, buffer:AudioBuffer, source:number[], assigned=true):DrumSample {
  return {
    file:new File([new Uint8Array(source)],name,{type:'audio/wav',lastModified:1234+index}), audioBuffer:buffer,
    name,isLoaded:true,inPoint:0,outPoint:buffer.duration,playmode:'gate',reverse:true,transpose:-3,pan:12,gain:4,
    hasBeenEdited:true,isAssigned:assigned,assignedKey:assigned?index:undefined,originalBitDepth:32,
    originalSampleRate:buffer.sampleRate,originalChannels:buffer.numberOfChannels,fileSize:source.length,duration:buffer.duration,isFloat:true,
  };
}

function loadedMulti(name:string, buffer:AudioBuffer, source:number[]):MultisampleFile {
  return {
    file:new File([new Uint8Array(source)],name,{type:'audio/aiff',lastModified:9876}),audioBuffer:buffer,name,isLoaded:true,
    rootNote:60,note:'C4',inPoint:0,outPoint:buffer.duration,loopStart:0,loopEnd:0,originalBitDepth:32,
    originalSampleRate:buffer.sampleRate,originalChannels:buffer.numberOfChannels,fileSize:source.length,duration:buffer.duration,isFloat:true,sourceIdentity:'multi-source-1',
  };
}

function projectState():AppState {
  const stereo=audio([[0.125,-0,1.25],[-0.5,0.75,-1.5]]);
  const overflow=audio([[0.25,-0.25]],44100);
  const multi=audio([[0,-0,0.33333334],[-1,1,0.5]]);
  const drumSamples=initialState.drumSamples.map(sample => ({...sample}));
  drumSamples[5]=loadedDrum(5,'clap source.wav',stereo,[1,2,3,4]);
  const overflowSample=loadedDrum(24,'overflow.wav',overflow,[9,8,7],false);
  overflowSample.originalSampleRate=48000; overflowSample.originalChannels=2; overflowSample.duration=2/48000;
  drumSamples.push(overflowSample);
  return {
    ...initialState,
    drumSettings:{...structuredClone(initialState.drumSettings),presetName:'Round trip',presetSettings:{...initialState.drumSettings.presetSettings,volume:37}},
    multisampleSettings:{...structuredClone(initialState.multisampleSettings),presetName:'Envelope test',ampEnvelope:{attack:1,decay:2,sustain:3,release:4},filterEnvelope:{attack:5,decay:6,sustain:7,release:8}},
    drumSamples,multisampleFiles:[{...loadedMulti('C4 source.aif',multi,[6,5,4,3,2,1]),loopCrossfade:{fraction:0.9,importedRaw:90,importedFramecount:100,sourceIdentity:'C4 source.aif'}}],
    importedDrumPreset:{type:'drum',unknown:{vendorFx:91}},importedMultisamplePreset:{type:'multisampler',unknown:{vendorMode:'future'}},midiNoteMapping:'C4',
  };
}

async function rewriteManifest(blob:Blob, change:(manifest:TestArchiveManifest)=>void) {
  const zip=await JSZip.loadAsync(await bytes(blob));
  const manifest=JSON.parse(await zip.file(PROJECT_ARCHIVE_MANIFEST)!.async('string')) as TestArchiveManifest;
  change(manifest);
  zip.file(PROJECT_ARCHIVE_MANIFEST,JSON.stringify(manifest));
  return new Blob([await zip.generateAsync({type:'uint8array'})],{type:'application/zip'});
}

describe('portable project archive', () => {
  it('admits a near-limit complete manifest that its exporter can reopen',async()=>{
    const state=projectState();state.importedDrumPreset={type:'drum',payload:'d'.repeat(1_040_000)};state.importedMultisamplePreset={type:'multisampler',payload:'m'.repeat(1_040_000)};
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(state))).not.toThrow();
    const restored=await importProjectArchive(await exportProjectArchive(createProjectSnapshot(state)));
    expect((restored.importedDrumPreset as {payload:string}).payload).toHaveLength(1_040_000);
  });

  it('rejects invalid imported crossfade provenance before commit while the current project remains portable',async()=>{
    const state=projectState(),buffer=audio([new Array(8).fill(0)],8_000);
    state.multisampleFiles=[{...loadedMulti('match.wav',buffer,[1,2,3]),loopCrossfade:undefined}];
    state.importedMultisamplePreset=null;
    const pending=appReducer(state,{type:'BEGIN_PRESET_IMPORT',payload:{operationId:'fractional-crossfade'}});
    const result=appReducer(pending,{type:'COMMIT_PRESET_IMPORT',payload:{operationId:'fractional-crossfade',instrument:'multisample',result:{success:true,data:{type:'multisampler',regions:[{sample:'match.wav',framecount:8,'loop.crossfade':0.5}]}}}});
    expect(result.importedMultisamplePreset).toBeNull();
    expect(result.multisampleFiles).toBe(state.multisampleFiles);
    expect(result.multisampleFiles[0].loopCrossfade).toBeUndefined();
    expect(result.notifications.at(-1)).toMatchObject({type:'error',title:'import failed',message:expect.stringMatching(/crossfade/i)});
    const restored=await importProjectArchive(await exportProjectArchive(createProjectSnapshot(result)));
    expect(restored.multisampleFiles[0].loopCrossfade).toBeUndefined();
  });

  it('admits and round trips valid integer imported crossfade provenance',async()=>{
    const state=projectState(),buffer=audio([new Array(8).fill(0)],8_000);
    state.multisampleFiles=[{...loadedMulti('match.wav',buffer,[1,2,3]),loopCrossfade:undefined}];
    state.importedMultisamplePreset=null;
    const readPcm=vi.spyOn(buffer,'getChannelData');
    const pending=appReducer(state,{type:'BEGIN_PRESET_IMPORT',payload:{operationId:'integer-crossfade'}});
    const result=appReducer(pending,{type:'COMMIT_PRESET_IMPORT',payload:{operationId:'integer-crossfade',instrument:'multisample',result:{success:true,data:{type:'multisampler',regions:[{sample:'match.wav',framecount:8,'loop.crossfade':4}]}}}});
    expect(result.notifications.at(-1)).toMatchObject({type:'success',title:'settings imported'});
    expect(result.multisampleFiles[0].loopCrossfade).toEqual({fraction:.5,importedRaw:4,importedFramecount:8,sourceIdentity:'match.wav'});
    expect(readPcm).not.toHaveBeenCalled();
    const restored=await importProjectArchive(await exportProjectArchive(createProjectSnapshot(result)));
    expect(restored.multisampleFiles[0].loopCrossfade).toEqual({fraction:.5,importedRaw:4,importedFramecount:8,sourceIdentity:'match.wav'});
  });

  it('rejects complete-manifest byte, key, and wrapped-depth overflow before export',()=>{
    const oversized=projectState();oversized.importedDrumPreset={type:'drum',payload:'d'.repeat(1_048_500)};oversized.importedMultisamplePreset={type:'multisampler',payload:'m'.repeat(1_048_500)};
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(oversized))).toThrow(/manifest.*large/i);
    const longKey=projectState();longKey.importedDrumPreset={type:'drum',[`k${'x'.repeat(1_024)}`]:1};
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(longKey))).toThrow(/key/i);
    const deep=projectState();let value:Record<string,unknown>={leaf:true};for(let index=0;index<31;index++)value={nested:value};deep.importedDrumPreset={type:'drum',vendor:value};
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(deep))).toThrow(/deep/i);
  });
  it('round trips an unknown compressed-source bit depth without inventing 32-bit PCM',async()=>{
    const state=projectState();
    const compressed={...state.drumSamples[5],file:new File([new Uint8Array([0x66,0x4c,0x61,0x43])],'source.flac',{type:'audio/flac'}),originalBitDepth:undefined,originalSampleRate:undefined,originalChannels:undefined,isFloat:undefined};
    state.drumSamples[5]=compressed;
    const archive=await exportProjectArchive(createProjectSnapshot(state));
    const manifest=JSON.parse(await (await JSZip.loadAsync(await bytes(archive))).file(PROJECT_ARCHIVE_MANIFEST)!.async('string')) as TestArchiveManifest;
    const stored = manifest.samples.find((sample)=>sample.name==='source.flac');
    expect(stored?.metadata).not.toHaveProperty('bitDepth');
    expect(stored?.metadata).not.toHaveProperty('sampleRate');
    expect(stored?.metadata).not.toHaveProperty('channels');
    const restored=await importProjectArchive(archive);
    expect(restored.drumSamples.find(sample=>sample.name==='clap source.wav')?.originalBitDepth).toBeUndefined();
    expect(restored.drumSamples.find(sample=>sample.name==='clap source.wav')?.originalSampleRate).toBeUndefined();
  });
  it.each([null,'16',0,65])('rejects a present invalid optional source bit depth (%s)',async bitDepth=>{
    const archive=await rewriteManifest(await exportProjectArchive(createProjectSnapshot(projectState())),manifest=>{manifest.samples[0].metadata.bitDepth=bitDepth});
    await expect(importProjectArchive(archive)).rejects.toThrow(/bit depth/i);
  });
  it('admits a mixed project near the shared sample limit and round trips every logical asset', async () => {
    const tiny=audio([[.25]],8000),drums=Array.from({length:229},(_,index)=>loadedDrum(index,`drum-${index}.wav`,tiny,[index%256],index<24));
    const multis=Array.from({length:24},(_,index)=>loadedMulti(`multi-${index}.aif`,tiny,[index%256]));
    const state={...initialState,drumSamples:drums,multisampleFiles:multis} as AppState;
    const source=audio([[1,.5]],8000),file=new File([new Uint8Array([1,2])],'near-limit.wav',{type:'audio/wav'});
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:{format:'wav',sampleRate:8000,bitDepth:16,channels:1,duration:source.duration,fileSize:2,isFloat:false,audioBuffer:source,midiNote:60,loopStart:0,loopEnd:source.duration,hasLoopData:false},existingIndex:null},ranges:[{start:0,end:2}],existingSamples:drums,projectAssets:[...drums,...multis],allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});
    const committed=appReducer(state,{type:'COMMIT_PREPARED_SLICES',payload:{operationId:'near-limit',prepared}});
    expect(committed.sliceCommitResult).toMatchObject({status:'committed',assignedCount:0,overflowCount:1});
    const archive=await exportProjectArchive(createProjectSnapshot(committed)),archiveData=await bytes(archive);
    const zip=await JSZip.loadAsync(archiveData);
    const manifest=JSON.parse(await zip.file(PROJECT_ARCHIVE_MANIFEST)!.async('string')) as TestArchiveManifest;
    expect(manifest.samples).toHaveLength(255);
    expect(manifest.samples.every((asset)=>asset.audio.bytes===24+asset.audio.frames*asset.audio.channels*4)).toBe(true);
    const uncompressed=(await Promise.all(Object.values(zip.files).filter(entry=>!entry.dir).map(entry=>entry.async('uint8array').then(value=>value.byteLength))))
      .reduce((sum,size)=>sum+size,0);
    expect(uncompressed).toBeLessThanOrEqual(PROJECT_ARCHIVE_LIMITS.uncompressedBytes);
    const paths=Object.values(zip.files).filter(entry=>!entry.dir).map(entry=>entry.name);
    expect(archiveData.byteLength-uncompressed).toBe(storedZipStructureBytes(paths));
    expect(storedZipStructureBytes(paths)).toBeLessThanOrEqual(SLICE_LIMITS.projectZipStructureReserveBytes);
    const restored=await importProjectArchive(archive);
    expect(restored.drumSamples).toHaveLength(231);
    expect(restored.multisampleFiles).toHaveLength(24);
    const expectReducerProvenance=(editor:AppState)=>{
      const related=editor.drumSamples.filter(sample=>sample.sourceIdentity===prepared.sourceIdentity);
      expect(related.filter(sample=>!sample.sliceProvenance)).toHaveLength(1);
      expect(related.find(sample=>sample.sliceProvenance)?.sliceProvenance).toEqual({sourceIdentity:prepared.sourceIdentity,sourceName:'near-limit.wav',startFrame:0,endFrame:2,sourceFrameCount:2,sourceSampleRate:8000,sourceChannels:1});
    };
    expectReducerProvenance(appReducer(initialState,{type:'IMPORT_PROJECT',payload:restored}));
    expectReducerProvenance(appReducer(initialState,{type:'RESTORE_SESSION',payload:restored}));
    expectReducerProvenance(appReducer(initialState,{type:'RESTORE_LIBRARY',payload:{mode:'drum',project:restored}}));
    const crowdedDrums=[...drums,loadedDrum(229,'late-229.wav',tiny,[1],false),loadedDrum(230,'late-230.wav',tiny,[2],false)];
    const crowded={...state,drumSamples:crowdedDrums} as AppState;
    const rejected=appReducer(crowded,{type:'COMMIT_PREPARED_SLICES',payload:{operationId:'over-limit',prepared}});
    expect(rejected.drumSamples).toBe(crowdedDrums);
    expect(rejected.multisampleFiles).toBe(multis);
    expect(rejected.sliceCommitResult).toMatchObject({status:'rejected',error:expect.stringMatching(/256-sample project limit/i)});
  });

  it('round trips sparse and overflow samples, exact stereo audio, settings, unknown imports and source bytes', async () => {
    const archive=await exportProjectArchive(createProjectSnapshot(projectState()));
    const restored=await importProjectArchive(archive);
    const sparse=restored.drumSamples.find(sample => sample.originalIndex===5)!;
    const overflow=restored.drumSamples.find(sample => sample.originalIndex===24)!;

    expect(restored.drumSamples.map(sample => sample.originalIndex)).toEqual([5,24]);
    expect(overflow.isAssigned).toBe(false);
    expect(overflow.audioBuffer!.sampleRate).toBe(44100);
    expect(overflow.originalSampleRate).toBe(48000);
    expect(overflow.originalChannels).toBe(2);
    expect(Array.from(sparse.audioBuffer!.getChannelData(0))).toEqual([0.125,-0,1.25]);
    expect(Array.from(sparse.audioBuffer!.getChannelData(1))).toEqual([-0.5,0.75,-1.5]);
    expect(sparse.audioBuffer!.sampleRate).toBe(48000);
    expect(sparse.file?.name).toBe('clap source.wav');
    expect(sparse.file?.type).toBe('audio/wav');
    expect(sparse.file?.lastModified).toBe(1239);
    expect(Array.from(await bytes(sparse.file!))).toEqual([1,2,3,4]);
    expect(restored.multisampleFiles[0].loopStart).toBe(0);
    expect(restored.multisampleFiles[0].loopEnd).toBe(1 / restored.multisampleFiles[0].audioBuffer!.sampleRate);
    expect(restored.multisampleFiles[0].loopCrossfade).toEqual({fraction:0.9,importedRaw:90,importedFramecount:100,sourceIdentity:'C4 source.aif'});
    expect(restored.multisampleFiles[0].sourceIdentity).toBe('multi-source-1');
    expect(restored.multisampleSettings.ampEnvelope).toEqual({attack:1,decay:2,sustain:3,release:4});
    expect(restored.multisampleSettings.filterEnvelope).toEqual({attack:5,decay:6,sustain:7,release:8});
    expect((restored.importedDrumPreset?.unknown as {vendorFx:number}).vendorFx).toBe(91);
    expect((restored.importedMultisamplePreset?.unknown as {vendorMode:string}).vendorMode).toBe('future');
  });

  it('round trips the live original-format sentinel for both instruments', async () => {
    const state=projectState();
    state.drumSettings={...state.drumSettings,sampleRate:0,bitDepth:0,channels:0};
    state.multisampleSettings={...state.multisampleSettings,sampleRate:0,bitDepth:0,channels:0};
    const restored=await importProjectArchive(await exportProjectArchive(createProjectSnapshot(state)));
    expect(restored.drumSettings).toMatchObject({sampleRate:0,bitDepth:0,channels:0});
    expect(restored.multisampleSettings).toMatchObject({sampleRate:0,bitDepth:0,channels:0});
  });

  it('round trips original-frame slice provenance without archiving a redundant derived source file', async () => {
    const state=projectState();
    const derived=state.drumSamples[5];
    derived.sourceIdentity='source-123';
    derived.sliceProvenance={sourceIdentity:'source-123',sourceName:'long-break.wav',startFrame:1200,endFrame:1203,
      sourceFrameCount:96000,sourceSampleRate:48000,sourceChannels:2};
    const archive=await exportProjectArchive(createProjectSnapshot(state));
    const zip=await JSZip.loadAsync(await bytes(archive));
    const manifest=JSON.parse(await zip.file(PROJECT_ARCHIVE_MANIFEST)!.async('string')) as TestArchiveManifest;
    const ref=manifest.project.drumSamples.find((sample)=>sample.originalIndex===5);
    const asset=manifest.samples.find((sample)=>sample.id===ref?.sampleId);
    expect(asset?.sourcePath).toBeUndefined();
    const restored=await importProjectArchive(archive);
    expect(restored.drumSamples.find(sample=>sample.originalIndex===5)?.sliceProvenance).toEqual(derived.sliceProvenance);
    expect(restored.drumSamples.find(sample=>sample.originalIndex===5)?.audioBuffer?.length).toBe(3);
  });

  it('loads an actual Task 3 v1 archive and normalizes its fractional and empty markers', async () => {
    const legacy = new Blob([Buffer.from(TASK3_LEGACY_ARCHIVE_BASE64, 'base64')], { type: 'application/zip' });
    const restored = await importProjectArchive(legacy);
    const sample = restored.multisampleFiles[0];
    expect(sample.inPoint).toBe(1 / 48_000);
    expect(sample.outPoint).toBe(10 / 48_000);
    expect(sample.loopStart).toBe(1 / 48_000);
    expect(sample.loopEnd).toBe(2 / 48_000);
  });

  it('keeps a restored deliberate crossfade authoritative over matching imported JSON', async () => {
    const state = projectState();
    state.multisampleFiles[0].loopCrossfade = { fraction: 0.25 };
    state.importedMultisamplePreset = {
      regions: [{ sample: 'C4 source.aif', framecount: 3, 'loop.crossfade': 3 }],
    };
    const restored = await importProjectArchive(await exportProjectArchive(createProjectSnapshot(state)));
    const editor = appReducer(initialState, { type: 'RESTORE_SESSION', payload: restored });
    expect(editor.multisampleFiles[0].loopCrossfade).toEqual({ fraction: 0.25 });
  });

  it.each([
    ['unsupported version',(m:TestArchiveManifest)=>{m.version=2}],
    ['invalid settings',(m:TestArchiveManifest)=>{m.project.drumSettings.sampleRate='fast'}],
    ['missing reference',(m:TestArchiveManifest)=>{m.project.drumSamples[0].sampleId='missing'}],
    ['invalid dimensions',(m:TestArchiveManifest)=>{m.project.drumSamples[0].originalIndex=513}],
    ['nonfinite crossfade',(m:TestArchiveManifest)=>{m.project.multisampleFiles[0].loopCrossfade.fraction=Number.NaN}],
    ['fractional imported frame count',(m:TestArchiveManifest)=>{m.project.multisampleFiles[0].loopCrossfade.importedFramecount=1.5}],
    ['negative sample marker',(m:TestArchiveManifest)=>{m.project.multisampleFiles[0].inPoint=-1}],
    ['sample marker beyond audio',(m:TestArchiveManifest)=>{m.project.multisampleFiles[0].outPoint=1}],
    ['slice provenance beyond its original source',(m:TestArchiveManifest)=>{m.project.drumSamples[0].sliceProvenance={sourceIdentity:'x',sourceName:'x.wav',startFrame:2,endFrame:5,sourceFrameCount:3,sourceSampleRate:48000,sourceChannels:1}}],
  ])('rejects %s before returning a project', async (_name,change) => {
    const archive=await rewriteManifest(await exportProjectArchive(createProjectSnapshot(projectState())),change);
    await expect(importProjectArchive(archive)).rejects.toThrow();
  });

  it('rejects missing, truncated, mismatched and nonfinite audio payloads', async () => {
    const base=await exportProjectArchive(createProjectSnapshot(projectState()));
    const variants:Blob[]=[];
    for(const mode of ['missing','truncated','mismatch','nonfinite'] as const) {
      const zip=await JSZip.loadAsync(await bytes(base));
      const manifest=JSON.parse(await zip.file(PROJECT_ARCHIVE_MANIFEST)!.async('string')) as TestArchiveManifest;
      const path=manifest.samples[0].audioPath;
      const payload=await zip.file(path)!.async('uint8array');
      if(mode==='missing') zip.remove(path);
      if(mode==='truncated') zip.file(path,payload.slice(0,-1));
      if(mode==='mismatch') { const view=new DataView(payload.buffer,payload.byteOffset,payload.byteLength); view.setUint32(8,3,true); zip.file(path,payload); }
      if(mode==='nonfinite') { const view=new DataView(payload.buffer,payload.byteOffset,payload.byteLength); view.setFloat32(24,Number.NaN,true); zip.file(path,payload); }
      variants.push(new Blob([await zip.generateAsync({type:'uint8array'})],{type:'application/zip'}));
    }
    for(const variant of variants) await expect(importProjectArchive(variant)).rejects.toThrow();
  });

  it('rejects traversal, duplicate raw names, undeclared entries and oversized declared payloads', async () => {
    const base=await exportProjectArchive(createProjectSnapshot(projectState()));
    const extra=await JSZip.loadAsync(await bytes(base)); extra.file('../outside.txt','bad');
    await expect(importProjectArchive(new Blob([await extra.generateAsync({type:'uint8array'})]))).rejects.toThrow(/path/i);

    const undeclared=await JSZip.loadAsync(await bytes(base)); undeclared.file('surprise.txt','bad');
    await expect(importProjectArchive(new Blob([await undeclared.generateAsync({type:'uint8array'})]))).rejects.toThrow(/unexpected/i);

    const duplicateZip=new JSZip(); duplicateZip.file('a','one'); duplicateZip.file('b','two');
    const duplicate=await duplicateZip.generateAsync({type:'uint8array'});
    for(let i=0;i<=duplicate.length-4;i++) {
      const signature=new DataView(duplicate.buffer,duplicate.byteOffset+i,4).getUint32(0,true);
      if((signature===0x04034b50 || signature===0x02014b50) && duplicate[i+(signature===0x04034b50?30:46)]===98) duplicate[i+(signature===0x04034b50?30:46)]=97;
    }
    await expect(importProjectArchive(new Blob([duplicate]))).rejects.toThrow(/duplicate/i);

    const oversized=await bytes(base);
    for(let i=0;i<oversized.length-46;i++) if(new DataView(oversized.buffer,oversized.byteOffset+i,4).getUint32(0,true)===0x02014b50) {
      const view=new DataView(oversized.buffer,oversized.byteOffset+i,46);
      view.setUint32(20,0x30000000,true); view.setUint32(24,0x30000000,true); break;
    }
    await expect(importProjectArchive(new Blob([oversized]))).rejects.toThrow(/large|size/i);
  });

  it('counts repeated audio references toward the decoded byte budget', async () => {
    const oneMiB=audio([new Array((1024*1024-24)/4).fill(0)]);
    const sample=loadedDrum(0,'shared.wav',oneMiB,[1]);
    const state={...projectState(),drumSamples:[sample],multisampleFiles:[]} as AppState;
    const base=await exportProjectArchive(createProjectSnapshot(state));
    const repeated=await rewriteManifest(base,(manifest)=>{
      const original=manifest.samples[0];
      const originalReference=manifest.project.drumSamples[0];
      manifest.samples=[];
      manifest.project.drumSamples=[];
      for(let index=0;index<129;index++) {
        const id=`repeat-${index}`;
        manifest.samples.push({...original,id});
        manifest.project.drumSamples.push({...originalReference,originalIndex:index,sampleId:id});
      }
    });
    await expect(importProjectArchive(repeated)).rejects.toThrow(/decoded audio|audio.*large/i);
  });

  it('keeps reducer state unchanged when archive validation rejects', async () => {
    const before=projectState();
    const invalid=await rewriteManifest(await exportProjectArchive(createProjectSnapshot(before)),m=>{m.version=99});
    await expect(importProjectArchive(invalid)).rejects.toThrow(/version/i);
    expect(before).toEqual(projectState());
  });
});
