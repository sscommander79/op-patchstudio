import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { AppContextProvider, useAppContext, useProjectHistory, type AppAction } from '../../context/AppContext';
import { prepareSliceApplication, SLICE_LIMITS } from '../../utils/audioSlicing';
import { generateDrumPatch } from '../../utils/patchGeneration';

function sourceAudio(frames = 30) {
  const audio = new AudioContext().createBuffer(2, frames, 10000);
  for (let frame = 0; frame < frames; frame += 1) {
    audio.getChannelData(0)[frame] = frame / 100;
    audio.getChannelData(1)[frame] = -frame / 100;
  }
  return audio;
}

const metadata = (audioBuffer: AudioBuffer) => ({
  format: 'wav' as const, sampleRate: 48000, bitDepth: 24, channels: 2,
  duration: audioBuffer.duration, fileSize: 4, isFloat: false, audioBuffer,
  midiNote: 60, loopStart: 0, loopEnd: audioBuffer.duration, hasLoopData: false,
});

async function blobBytes(blob:Blob):Promise<Uint8Array> {
  return new Uint8Array(await new Promise<ArrayBuffer>((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.readAsArrayBuffer(blob);
  }));
}

function wavDataFrames(bytes:Uint8Array) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let channels=0,bits=0;
  for(let offset=12;offset+8<=bytes.length;) {
    const id=new TextDecoder().decode(bytes.subarray(offset,offset+4)),size=view.getUint32(offset+4,true);
    if(id==='fmt '){channels=view.getUint16(offset+10,true);bits=view.getUint16(offset+22,true);}
    if(id==='data')return size/(channels*(bits/8));
    offset+=8+size+(size%2);
  }
  throw new Error('WAV data chunk missing');
}

describe('atomic slice application through project history', () => {
  it('applies explicit non-sequential destinations and leaves null slices unassigned',async()=>{const {result}=renderHook(()=>({...useAppContext(),...useProjectHistory()}),{wrapper:AppContextProvider});const source=sourceAudio(12),file=new File(['source'],'mapped.wav',{type:'audio/wav'});const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:0,end:4},{start:4,end:8},{start:8,end:12}],mapping:[8,2,null],existingSamples:result.current.state.drumSamples,allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'mapped',prepared}}));expect(result.current.state.drumSamples[8].sliceProvenance?.startFrame).toBe(0);expect(result.current.state.drumSamples[2].sliceProvenance?.startFrame).toBe(4);expect(result.current.state.drumSamples.slice(24).filter(sample=>sample.sliceProvenance).map(sample=>sample.sliceProvenance?.startFrame)).toEqual([8]);expect(result.current.state.sliceCommitResult).toMatchObject({status:'committed',assignedCount:2,overflowCount:1});act(()=>result.current.dispatch({type:'UNDO'}));expect(result.current.state.drumSamples.filter(sample=>sample.isLoaded)).toHaveLength(0);});

  it('rejects duplicate, invalid, and incomplete explicit mappings',async()=>{const source=sourceAudio(12),file=new File(['source'],'invalid-map.wav',{type:'audio/wav'}),base={source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:0,end:4},{start:4,end:12}],existingSamples:[] as never[],allocator:(channels:number,frames:number,sampleRate:number)=>new AudioContext().createBuffer(channels,frames,sampleRate)};await expect(prepareSliceApplication({...base,mapping:[2,2]})).rejects.toThrow(/one sound.*each pad/i);await expect(prepareSliceApplication({...base,mapping:[24,null]})).rejects.toThrow(/0 to 23/i);await expect(prepareSliceApplication({...base,mapping:[2]})).rejects.toThrow(/one destination/i);});

  it('preserves an approved occupied destination in Unassigned sounds and undoes once',async()=>{const {result}=renderHook(()=>({...useAppContext(),...useProjectHistory()}),{wrapper:AppContextProvider});const occupied=sourceAudio(3),occupiedFile=new File(['old'],'old.wav',{type:'audio/wav'});act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:8,file:occupiedFile,audioBuffer:occupied,metadata:metadata(occupied)}}));act(()=>result.current.dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:8,updates:{gain:9,reverse:true}}}));const snapshot=result.current.state.drumSamples[8],source=sourceAudio(12),file=new File(['source'],'replacement-source.wav',{type:'audio/wav'});const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:0,end:12}],mapping:[8],replacementApprovals:[{targetKeyIndex:8,sample:snapshot}],existingSamples:result.current.state.drumSamples,allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'replace',prepared}}));expect(result.current.state.drumSamples[8].sliceProvenance?.startFrame).toBe(0);expect(result.current.state.drumSamples.slice(24)).toContainEqual(expect.objectContaining({file:occupiedFile,audioBuffer:occupied,gain:9,reverse:true,isAssigned:false}));act(()=>result.current.dispatch({type:'UNDO'}));expect(result.current.state.drumSamples[8]).toEqual(snapshot);expect(result.current.state.drumSamples[8].file).toBe(occupiedFile);expect(result.current.state.drumSamples[8].audioBuffer).toBe(occupied);expect(result.current.state.drumSamples).toHaveLength(24);});

  it('retains a displaced derived slice unchanged across successive slicing commits',async()=>{const {result}=renderHook(()=>({...useAppContext(),...useProjectHistory()}),{wrapper:AppContextProvider});const source=sourceAudio(12),file=new File(['source'],'source.wav',{type:'audio/wav'});const first=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:1,end:9}],mapping:[8],existingSamples:result.current.state.drumSamples,allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'first',prepared:first}}));const displaced=result.current.state.drumSamples[8];act(()=>result.current.dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:8,updates:{gain:7,reverse:true}}}));const edited=result.current.state.drumSamples[8];const second=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:2,end:6}],mapping:[8],replacementApprovals:[{targetKeyIndex:8,sample:edited}],existingSamples:result.current.state.drumSamples,allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'second',prepared:second}}));expect(result.current.state.sliceCommitResult).toMatchObject({status:'committed',assignedCount:1});expect(result.current.state.drumSamples.filter(sample=>sample.file===displaced.file&&sample.audioBuffer===displaced.audioBuffer)).toHaveLength(1);expect(result.current.state.drumSamples.slice(24)).toContainEqual(expect.objectContaining({file:displaced.file,audioBuffer:displaced.audioBuffer,sliceProvenance:displaced.sliceProvenance,gain:7,reverse:true,isAssigned:false}));act(()=>result.current.dispatch({type:'UNDO'}));expect(result.current.state.drumSamples[8]).toEqual(edited);expect(result.current.state.drumSamples.filter(sample=>sample.file===displaced.file&&sample.audioBuffer===displaced.audioBuffer)).toHaveLength(1);});

  it('rejects stale explicit empty and occupied targets atomically',async()=>{const make=async(occupied:boolean)=>{const {result}=renderHook(()=>useAppContext(),{wrapper:AppContextProvider});const oldAudio=sourceAudio(2),oldFile=new File(['old'],'old.wav',{type:'audio/wav'});if(occupied)act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:8,file:oldFile,audioBuffer:oldAudio,metadata:metadata(oldAudio)}}));const snapshot=result.current.state.drumSamples[8],source=sourceAudio(12),file=new File(['source'],'stale-map.wav',{type:'audio/wav'});const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:0,end:12}],mapping:[8],replacementApprovals:occupied?[{targetKeyIndex:8,sample:snapshot}]:[],existingSamples:result.current.state.drumSamples,allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});if(occupied)act(()=>result.current.dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:8,updates:{gain:11,hasBeenEdited:true}}}));else {const changed=sourceAudio(4),changedFile=new File(['changed'],'changed.wav',{type:'audio/wav'});act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:8,file:changedFile,audioBuffer:changed,metadata:metadata(changed)}}));}const before=result.current.state.drumSamples;act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:`stale-${occupied}`,prepared}}));expect(result.current.state.drumSamples).toBe(before);expect(result.current.state.sliceCommitResult).toMatchObject({status:'rejected',error:expect.stringMatching(/changed while Apply/i)});};await make(false);await make(true);});

  it('disallows replacing the retained source pad',async()=>{const source=sourceAudio(12),file=new File(['source'],'own-source.wav',{type:'audio/wav'}),existing={file,audioBuffer:source,name:file.name,isLoaded:true,inPoint:0,outPoint:source.duration,playmode:'oneshot' as const,reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:true,assignedKey:0,originalBitDepth:24,originalSampleRate:48000,originalChannels:2,fileSize:file.size,duration:source.duration,isFloat:false};await expect(prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:0},ranges:[{start:0,end:12}],mapping:[0],replacementApprovals:[{targetKeyIndex:0,sample:existing}],existingSamples:[existing],allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)})).rejects.toThrow(/source pad cannot be replaced/i);});

  it('keeps an existing source in place, fills only ascending empty pads, retains overflow, and undoes once', async () => {
    const { result } = renderHook(() => ({ ...useAppContext(), ...useProjectHistory() }), { wrapper: AppContextProvider });
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    const source = sourceAudio();
    const sourceFile = new File([new Uint8Array([1, 2, 3, 4])], 'break.wav', { type: 'audio/wav' });
    send({ type: 'LOAD_DRUM_SAMPLE', payload: { index: 0, file: sourceFile, audioBuffer: source, metadata: metadata(source) } });
    send({ type: 'UPDATE_DRUM_SAMPLE', payload: { index: 0, updates: { gain: 7, pan: -12 } } });
    const occupied = sourceAudio(2);
    const occupiedFile = new File(['keep'], 'keep.wav', { type: 'audio/wav' });
    for (let index = 2; index < 24; index += 1) send({ type: 'LOAD_DRUM_SAMPLE', payload: { index, file: occupiedFile, audioBuffer: occupied, metadata: metadata(occupied) } });
    const beforeSourceBuffer = result.current.state.drumSamples[0].audioBuffer;
    const beforeSourceFile = result.current.state.drumSamples[0].file;
    const beforeOccupied = result.current.state.drumSamples[2].audioBuffer;

    const prepared = await prepareSliceApplication({
      source: { audioBuffer: source, file: sourceFile, metadata: metadata(source), existingIndex: 0 },
      ranges: [{ start: 3, end: 9 }, { start: 9, end: 15 }, { start: 15, end: 30 }],
      existingSamples: result.current.state.drumSamples,
      allocator: (channels, frames, sampleRate) => new AudioContext().createBuffer(channels, frames, sampleRate),
    });
    expect(prepared).toMatchObject({ assignedCount: 1, overflowCount: 2, targetKeys: [1] });
    send({ type: 'COMMIT_PREPARED_SLICES', payload: {operationId:'existing-apply',prepared} });

    const state = result.current.state;
    expect(state.sliceCommitResult).toMatchObject({operationId:'existing-apply',status:'committed',assignedCount:1,overflowCount:2});
    expect(state.drumSamples[0]).toMatchObject({ gain: 7, pan: -12, sourceIdentity: prepared.sourceIdentity });
    expect(state.drumSamples[0].audioBuffer).toBe(beforeSourceBuffer);
    expect(state.drumSamples[0].file).toBe(beforeSourceFile);
    expect(state.drumSamples[1]).toMatchObject({sourceIdentity:prepared.sourceIdentity,sliceProvenance:{ sourceIdentity: prepared.sourceIdentity, startFrame: 3, endFrame: 9, sourceFrameCount: 30, sourceSampleRate: 10000, sourceChannels: 2 }});
    expect(state.drumSamples[1].audioBuffer?.length).toBe(6);
    expect(state.drumSamples[2].audioBuffer).toBe(beforeOccupied);
    expect(state.drumSamples.slice(24).map(sample => sample.sliceProvenance?.startFrame)).toEqual([9, 15]);

    send({ type: 'UNDO' });
    expect(result.current.state.drumSamples).toHaveLength(24);
    expect(result.current.state.drumSamples[0].sourceIdentity).toBeUndefined();
    expect(result.current.state.drumSamples[0]).toMatchObject({ gain: 7, pan: -12 });
    expect(result.current.state.drumSamples[0].audioBuffer).toBe(beforeSourceBuffer);
    send({ type: 'REDO' });
    expect(result.current.state.drumSamples[1].sliceProvenance?.startFrame).toBe(3);
  });

  it('retains a new external source exactly once as unassigned and gives slices stable unique lossless names', async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper: AppContextProvider });
    const source = sourceAudio(12);
    const file = new File([new Uint8Array([9, 8, 7, 6])], 'break.wav', { type: 'audio/wav' });
    const prepared = await prepareSliceApplication({
      source: { audioBuffer: source, file, metadata: metadata(source), existingIndex: null },
      ranges: [{ start: 0, end: 4 }, { start: 4, end: 12 }],
      existingSamples: result.current.state.drumSamples,
      allocator: (channels, frames, sampleRate) => new AudioContext().createBuffer(channels, frames, sampleRate),
    });
    act(() => result.current.dispatch({ type: 'COMMIT_PREPARED_SLICES', payload: {operationId:'external-apply',prepared} }));
    const loaded = result.current.state.drumSamples.filter(sample => sample.isLoaded);
    const originals = loaded.filter(sample => sample.sourceIdentity === prepared.sourceIdentity && !sample.sliceProvenance);
    const slices = loaded.filter(sample => sample.sliceProvenance?.sourceIdentity === prepared.sourceIdentity);
    expect(originals).toHaveLength(1);
    expect(originals[0]).toMatchObject({ isAssigned: false, file });
    expect(slices.map(sample => sample.file?.name)).toEqual(['break slice 01.opfloat', 'break slice 02.opfloat']);
    expect(new Set(slices.map(sample => sample.file?.name)).size).toBe(2);
  });

  it('keeps original-source frame coordinates when an existing derived slice is sliced again', async () => {
    const source=sourceAudio(30),file=new File(['derived'],'break slice 01.opfloat',{type:'application/vnd.op-patchstudio.float32'});
    const sourceIdentity='original-break-source';
    const existing={
      file,audioBuffer:source,name:file.name,isLoaded:true,inPoint:0,outPoint:source.duration,
      originalBitDepth:24,originalSampleRate:48000,originalChannels:2,fileSize:file.size,duration:source.duration,isFloat:true,
      playmode:'oneshot' as const,reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:true,assignedKey:0,
      sourceIdentity,sliceProvenance:{sourceIdentity,sourceName:'original-break.wav',startFrame:1000,endFrame:1030,sourceFrameCount:5000,sourceSampleRate:10000,sourceChannels:2},
    };
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:0},
      ranges:[{start:3,end:9}],existingSamples:[existing],
      allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});
    const derived=prepared.actions.find(action=>action.type==='STORE_DRUM_SAMPLE_ASSET');
    expect(derived?.type).toBe('STORE_DRUM_SAMPLE_ASSET');
    if(derived?.type!=='STORE_DRUM_SAMPLE_ASSET')throw new Error('Derived slice action missing');
    expect(derived.payload.sample.sliceProvenance).toEqual({sourceIdentity,sourceName:'original-break.wav',startFrame:1003,endFrame:1009,sourceFrameCount:5000,sourceSampleRate:10000,sourceChannels:2});
  });

  it('writes each assigned derived WAV with its exact half-open slice frame count', async () => {
    const {result}=renderHook(()=>useAppContext(),{wrapper:AppContextProvider});
    const source=sourceAudio(12),file=new File([new Uint8Array([1,2,3,4])],'break.wav',{type:'audio/wav'});
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},
      ranges:[{start:1,end:5},{start:5,end:12}],existingSamples:result.current.state.drumSamples,
      allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});
    act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'export-apply',prepared}}));
    const zip=await JSZip.loadAsync(await blobBytes(await generateDrumPatch(result.current.state,'slice export')));
    const patch=JSON.parse(await zip.file('patch.json')!.async('string')) as {regions:Array<{sample:string;framecount:number}>};
    expect(patch.regions.map(region=>region.framecount)).toEqual([4,7]);
    for(const region of patch.regions) {
      const bytes=await zip.file(region.sample)!.async('uint8array');
      expect(wavDataFrames(bytes)).toBe(region.framecount);
    }
  });

  it('replans against a late pad fill and commits every slice with one coherent Undo', async () => {
    const {result}=renderHook(()=>useAppContext(),{wrapper:AppContextProvider});
    const source=sourceAudio(12),file=new File(['source'],'late-source.wav',{type:'audio/wav'}),lateAudio=sourceAudio(2),lateFile=new File(['late'],'late.wav',{type:'audio/wav'});
    let filled=false;
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:0,end:4},{start:4,end:12}],existingSamples:result.current.state.drumSamples,
      allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate),yieldControl:async()=>{if(!filled){filled=true;act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:0,file:lateFile,audioBuffer:lateAudio,metadata:metadata(lateAudio)}}));}}});
    act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'late-fill',prepared}}));
    const loaded=result.current.state.drumSamples.filter(sample=>sample.isLoaded);
    expect(loaded.map(sample=>sample.name)).toEqual(['late.wav','late-source slice 01.opfloat','late-source slice 02.opfloat','late-source.wav']);
    expect(result.current.state.sliceCommitResult).toMatchObject({status:'committed',assignedCount:2,overflowCount:0});
    act(()=>result.current.dispatch({type:'UNDO'}));
    expect(result.current.state.drumSamples.filter(sample=>sample.isLoaded).map(sample=>sample.name)).toEqual(['late.wav']);
  });

  it('rejects an existing source replaced after preparation without adding musical history', async () => {
    const {result}=renderHook(()=>({...useAppContext(),...useProjectHistory()}),{wrapper:AppContextProvider});
    const source=sourceAudio(12),sourceFile=new File(['source'],'source.wav',{type:'audio/wav'});
    act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:0,file:sourceFile,audioBuffer:source,metadata:metadata(source)}}));
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file:sourceFile,metadata:metadata(source),existingIndex:0},
      ranges:[{start:0,end:4},{start:4,end:12}],existingSamples:result.current.state.drumSamples,
      allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});
    const replacement=sourceAudio(6),replacementFile=new File(['replacement'],'replacement.wav',{type:'audio/wav'});
    act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:0,file:replacementFile,audioBuffer:replacement,metadata:metadata(replacement)}}));
    const before=result.current.state.drumSamples;
    act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'stale-source',prepared}}));
    expect(result.current.state.drumSamples).toBe(before);
    expect(result.current.state.sliceCommitResult).toMatchObject({operationId:'stale-source',status:'rejected',error:expect.stringMatching(/source changed/i)});
    act(()=>result.current.dispatch({type:'UNDO'}));
    expect(result.current.state.drumSamples[0].file).toBe(sourceFile);
    expect(result.current.state.drumSamples.filter(sample=>sample.isLoaded)).toHaveLength(1);
  });

  it('discards the entire local reduction when any prepared child asset is rejected', async () => {
    const {result}=renderHook(()=>useAppContext(),{wrapper:AppContextProvider});
    const source=sourceAudio(12),file=new File(['source'],'invalid-child.wav',{type:'audio/wav'});
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},
      ranges:[{start:0,end:4},{start:4,end:12}],existingSamples:result.current.state.drumSamples,
      allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});
    const derived=prepared.actions.filter((action):action is Extract<AppAction,{type:'STORE_DRUM_SAMPLE_ASSET'}>=>action.type==='STORE_DRUM_SAMPLE_ASSET'&&Boolean(action.payload.sample.sliceProvenance));
    derived[1].payload.sample.file=null;
    const before=result.current.state.drumSamples;
    act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'invalid-child',prepared}}));
    expect(result.current.state.drumSamples).toBe(before);
    expect(result.current.state.drumSamples.filter(sample=>sample.isLoaded)).toHaveLength(0);
    expect(result.current.state.sliceCommitResult).toMatchObject({operationId:'invalid-child',status:'rejected',error:expect.stringMatching(/complete slice operation/i)});
  });

  it('rejects the whole commit when the prepared retained source asset is malformed', async () => {
    const {result}=renderHook(()=>useAppContext(),{wrapper:AppContextProvider});
    const source=sourceAudio(12),file=new File(['source'],'invalid-source-store.wav',{type:'audio/wav'});
    const prepared=await prepareSliceApplication({source:{audioBuffer:source,file,metadata:metadata(source),existingIndex:null},ranges:[{start:0,end:12}],existingSamples:result.current.state.drumSamples,
      allocator:(channels,frames,sampleRate)=>new AudioContext().createBuffer(channels,frames,sampleRate)});
    const retainedOriginal=prepared.actions.find((action):action is Extract<AppAction,{type:'STORE_DRUM_SAMPLE_ASSET'}>=>action.type==='STORE_DRUM_SAMPLE_ASSET'&&!action.payload.sample.sliceProvenance)!;
    retainedOriginal.payload.sample.file=null;
    const before=result.current.state.drumSamples;
    act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'invalid-source-store',prepared}}));
    expect(result.current.state.drumSamples).toBe(before);
    expect(result.current.state.drumSamples.filter(sample=>sample.isLoaded)).toHaveLength(0);
    expect(result.current.state.sliceCommitResult).toMatchObject({operationId:'invalid-source-store',status:'rejected',error:expect.stringMatching(/complete slice operation/i)});
  });

  it('rejects a one-byte current archive-overhead increase before allocation or atomic commit', async () => {
    const {result}=renderHook(()=>useAppContext(),{wrapper:AppContextProvider});
    const source=sourceAudio(1),logicalAudioBytes=24+source.length*source.numberOfChannels*4;
    const exactFiles=SLICE_LIMITS.projectStoredBytes-SLICE_LIMITS.projectManifestReserveBytes-SLICE_LIMITS.projectZipStructureReserveBytes-5*logicalAudioBytes;
    const base=Math.floor(exactFiles/4),sizes=[base,base,base,exactFiles-base*3];
    const files=sizes.map((_,index)=>({name:`boundary-${index}.wav`,type:'audio/wav',lastModified:0,get size(){return sizes[index];}} as File));
    files.forEach((file,index)=>act(()=>result.current.dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index,file,audioBuffer:source,metadata:metadata(source)}})));
    const allocator=vi.fn((channels:number,frames:number,sampleRate:number)=>new AudioContext().createBuffer(channels,frames,sampleRate));
    const sourceDescriptor={audioBuffer:source,file:files[0],metadata:metadata(source),existingIndex:0};
    const prepared=await prepareSliceApplication({source:sourceDescriptor,ranges:[{start:0,end:1}],existingSamples:result.current.state.drumSamples,
      projectAssets:[...result.current.state.drumSamples,...result.current.state.multisampleFiles],allocator});
    expect(allocator).toHaveBeenCalledTimes(1);
    sizes[1]+=1;
    const before=result.current.state.drumSamples;
    const rejectedAllocator=vi.fn((channels:number,frames:number,sampleRate:number)=>new AudioContext().createBuffer(channels,frames,sampleRate));
    await expect(prepareSliceApplication({source:sourceDescriptor,ranges:[{start:0,end:1}],existingSamples:before,
      projectAssets:[...before,...result.current.state.multisampleFiles],allocator:rejectedAllocator})).rejects.toThrow(/portable project size limit/i);
    expect(rejectedAllocator).not.toHaveBeenCalled();
    act(()=>result.current.dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId:'zip-overhead-byte',prepared}}));
    expect(result.current.state.drumSamples).toBe(before);
    expect(result.current.state.sliceCommitResult).toMatchObject({operationId:'zip-overhead-byte',status:'rejected',error:expect.stringMatching(/portable project size limit/i)});
  });
});
