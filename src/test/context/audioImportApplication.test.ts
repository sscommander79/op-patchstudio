import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appReducer, initialState, type AppState, type DrumSample, type MultisampleFile } from '../../context/AppContext';
import { createHistory, reduceHistory } from '../../utils/projectHistory';
import { finalizeAudioImport, prepareAudioImportFiles, proposeDrumDestinations, type PreparedAudioImport } from '../../utils/audioImport';
import { exportProjectArchive, importProjectArchive, validateProjectArchiveMetadata } from '../../utils/projectArchive';
import { createProjectSnapshot } from '../../utils/projectSerialization';

function audio(value=.2){const result=new AudioContext().createBuffer(1,8,8_000);result.getChannelData(0).fill(value);return result;}
function imported(id:string,name:string):PreparedAudioImport['assets'][number] {const buffer=audio();const file=new File([name],name,{type:'audio/wav'});return {id,sourceIdentity:`source-${id}`,path:name,file,audioBuffer:buffer,metadata:{format:'wav',sampleRate:8_000,bitDepth:16,channels:1,duration:buffer.duration,audioBuffer:buffer,fileSize:file.size,midiNote:-1,loopStart:0,loopEnd:buffer.duration,hasLoopData:false,isFloat:false}};}
function occupied(index:number):DrumSample {const buffer=audio(.8),file=new File(['old'],'old.wav');return {...initialState.drumSamples[index],file,audioBuffer:buffer,name:file.name,isLoaded:true,inPoint:0,outPoint:buffer.duration,originalBitDepth:16,originalSampleRate:8_000,originalChannels:1,fileSize:file.size,duration:buffer.duration,isAssigned:true,assignedKey:index};}
function state(patch:Partial<AppState>):AppState{return {...initialState,...patch};}
const PositionalAudioBuffer=globalThis.AudioBuffer as unknown as new(channels:number,length:number,sampleRate:number)=>AudioBuffer;
beforeEach(()=>{vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('File',NodeFile);vi.stubGlobal('AudioBuffer',class extends PositionalAudioBuffer {constructor(options:AudioBufferOptions){super(options.numberOfChannels??1,options.length,options.sampleRate)}})});
afterEach(()=>vi.unstubAllGlobals());

describe('reviewed audio import application',()=>{
  it('keeps decoded siblings in input order and reports one per-file decode failure',async()=>{
    const records=['a.wav','bad.wav','c.wav'].map((name,index)=>({id:`id-${index}`,path:`kit/${name}`,file:new File([name],name)}));
    const progress:number[]=[];
    const result=await prepareAudioImportFiles(records,'drum',0,'C3',undefined,value=>progress.push(value.prepared),async file=>{
      if(file.name==='bad.wav')throw new Error('decoder rejected content');
      const buffer=audio();return {format:'wav' as const,sampleRate:8_000,bitDepth:16,channels:1,duration:buffer.duration,audioBuffer:buffer,fileSize:file.size,midiNote:-1,loopStart:0,loopEnd:buffer.duration,hasLoopData:false};
    });
    expect(result.assets.map(asset=>asset.file.name)).toEqual(['a.wav','c.wav']);
    expect(result.rejected).toEqual([{id:'id-1',path:'kit/bad.wav',reason:'decoder rejected content'}]);
    expect(progress.at(-1)).toBe(2);
  });

  it('allocates durable source identity independently of a resettable intake ordinal',async()=>{
    const file=new File(['audio'],'restored-prefix.wav'),record={id:'intake-1-file-1',path:file.name,file};
    const decode=async()=>{const audioBuffer=audio();return {format:'wav' as const,sampleRate:8_000,sourceSampleRate:8_000,bitDepth:16,channels:1,sourceChannels:1,duration:audioBuffer.duration,audioBuffer,fileSize:file.size,midiNote:-1,loopStart:0,loopEnd:audioBuffer.duration,hasLoopData:false};};
    const first=await prepareAudioImportFiles([record],'drum',0,'C3',undefined,undefined,decode),freshSession=await prepareAudioImportFiles([record],'drum',0,'C3',undefined,undefined,decode);
    expect(first.assets[0].sourceIdentity).not.toBe('source:intake-1-file-1');
    expect(first.assets[0].sourceIdentity).toMatch(/^[0-9a-f-]{36}$/i);
    expect(freshSession.assets[0].sourceIdentity).not.toBe(first.assets[0].sourceIdentity);
  });

  it('proposes explainable free drum slots and leaves ambiguous, conflicting, and occupied matches unassigned',()=>{
    const drums=initialState.drumSamples.map((sample,index)=>index===0?occupied(0):sample);
    const proposals=proposeDrumDestinations([
      imported('a','kick.wav'),imported('b','closed_hat.wav'),imported('c','open-hat.wav'),
      imported('d','snare_clap.wav'),imported('e','texture.wav'),
    ],drums);
    expect(proposals.map(item=>[item.destination,item.reason])).toEqual([
      [1,'filename contains kick; first matching free pad'],[8,'filename contains closed hi-hat'],[10,'filename contains open hi-hat'],
      [null,'filename matches more than one drum type'],[null,'no confident filename match'],
    ]);
    expect(proposeDrumDestinations([imported('both','open_closed_hat.wav')],drums)[0]).toMatchObject({destination:null,reason:'filename matches more than one drum type'});
  });

  it('stops retaining decoded buffers after the staged project budget is exhausted',async()=>{
    const records=['large-a.wav','large-b.wav'].map((name,index)=>({id:`large-${index}`,path:name,file:new File([name],name)}));
    const result=await prepareAudioImportFiles(records,'drum',0,'C3',undefined,undefined,async file=>{
      const buffer=new AudioContext().createBuffer(2,16,8_000);return {format:'wav' as const,sampleRate:8_000,bitDepth:16,channels:2,duration:buffer.duration,audioBuffer:buffer,fileSize:file.size,midiNote:-1,loopStart:0,loopEnd:buffer.duration,hasLoopData:false};
    },{maxDecodedBytes:160});
    expect(result.assets.map(asset=>asset.id)).toEqual(['large-0']);
    expect(result.excess).toEqual([{id:'large-1',path:'large-b.wav',reason:'128 MiB decoded-audio project limit reached'}]);
  });

  it('commits accepted assignments and unassigned originals as one undoable action',()=>{
    const before=state({drumSamples:initialState.drumSamples.map(sample=>({...sample,isLoaded:false,file:null,audioBuffer:null,name:''}))});
    const prepared:PreparedAudioImport={instrument:'drum',expectedProjectGeneration:before.projectGeneration??0,assets:[imported('kick','kick.wav'),imported('mystery','mystery.wav')],selections:[
      {id:'kick',destination:{kind:'drum-pad',padIndex:0,decision:'choose-empty'}},{id:'mystery',destination:{kind:'drum-unassigned'}},
    ]};
    let history=createHistory(before);
    history=reduceHistory(history,{type:'COMMIT_PREPARED_IMPORTS',payload:{operationId:'import-1',prepared}},appReducer);
    expect(history.present.importCommitResult).toMatchObject({status:'committed',appliedIds:['kick','mystery'],assignedCount:1,overflowCount:1});
    expect(history.present.drumSamples[0]).toMatchObject({name:'kick.wav',sourceIdentity:'source-kick',isAssigned:true});
    expect(history.present.drumSamples.at(-1)).toMatchObject({name:'mystery.wav',sourceIdentity:'source-mystery',isAssigned:false});
    history=reduceHistory(history,{type:'UNDO'},appReducer);
    expect(history.present.drumSamples).toEqual(before.drumSamples);
  });

  it('rejects stale or unconsented occupied replacements without changing project audio',()=>{
    const old=occupied(2),before=state({drumSamples:initialState.drumSamples.map((sample,index)=>index===2?old:sample)});
    const asset=imported('new','snare.wav');
    const prepared:PreparedAudioImport={instrument:'drum',expectedProjectGeneration:before.projectGeneration??0,assets:[asset],selections:[{id:'new',destination:{kind:'drum-pad',padIndex:2,decision:'replace',expected:{file:old.file,audioBuffer:old.audioBuffer}}}]};
    const changed=state({drumSamples:before.drumSamples.map((sample,index)=>index===2?occupied(2):sample)});
    const result=appReducer(changed,{type:'COMMIT_PREPARED_IMPORTS',payload:{operationId:'stale',prepared}});
    expect(result.importCommitResult).toMatchObject({status:'rejected'});
    expect(result.drumSamples).toBe(changed.drumSamples);
    expect(()=>finalizeAudioImport({...prepared,selections:[{id:'new',destination:{kind:'drum-pad',padIndex:2,decision:'choose-empty'}}]},before)).toThrow(/occupied/i);
  });

  it('replaces the identity-bound unassigned asset after tray movement with fresh provenance as one undo',async()=>{
    const source={...occupied(0),isAssigned:false,assignedKey:undefined,sourceIdentity:'old-source'};
    const target={...occupied(0),isAssigned:false,assignedKey:undefined,sourceIdentity:'old-source',sliceProvenance:{sourceIdentity:'old-source',sourceName:'break.wav',startFrame:2,endFrame:6,sourceFrameCount:8,sourceSampleRate:8_000,sourceChannels:1}};
    const inserted={...occupied(0),file:new File(['other'],'other.wav'),isAssigned:false,assignedKey:undefined};
    const before=state({drumSamples:[...initialState.drumSamples,source,target]});
    const moved=state({drumSamples:[...initialState.drumSamples,source,inserted,target]});
    const asset=imported('replacement','replacement.wav');
    const prepared:PreparedAudioImport={instrument:'drum',expectedProjectGeneration:moved.projectGeneration??0,assets:[asset],selections:[{id:asset.id,destination:{kind:'drum-asset',decision:'replace',expected:{file:target.file,audioBuffer:target.audioBuffer}}}]};

    let history=createHistory(moved);
    history=reduceHistory(history,{type:'COMMIT_PREPARED_IMPORTS',payload:{operationId:'tray-replace',prepared}},appReducer);

    expect(history.present.importCommitResult).toMatchObject({status:'committed',appliedIds:['replacement']});
    expect(history.present.drumSamples[26]).toMatchObject({name:'replacement.wav',sourceIdentity:'source-replacement',isAssigned:false});
    expect(history.present.drumSamples[26].sliceProvenance).toBeUndefined();
    expect(history.present.drumSamples[25].file?.name).toBe('other.wav');
    const reopened=await importProjectArchive(await exportProjectArchive(createProjectSnapshot(history.present)));
    expect(reopened.drumSamples.find(sample=>sample.originalIndex===26)).toMatchObject({name:'replacement.wav',sourceIdentity:'source-replacement',sliceProvenance:undefined});
    history=reduceHistory(history,{type:'UNDO'},appReducer);
    expect(history.present.drumSamples).toEqual(moved.drumSamples);
    expect(before.drumSamples[25]).toBe(target);
  });

  it('retains multisample capacity excess and refuses occupied notes without explicit identity-bound replace',()=>{
    const existing=Array.from({length:23},(_,rootNote)=>{const asset=imported('old-'+rootNote,rootNote+'.wav');return {file:asset.file,audioBuffer:asset.audioBuffer,name:asset.file.name,isLoaded:true,rootNote,note:String(rootNote),inPoint:0,outPoint:asset.audioBuffer.duration,loopStart:0,loopEnd:asset.audioBuffer.duration,originalBitDepth:16,originalSampleRate:8_000,originalChannels:1,fileSize:asset.file.size,duration:asset.audioBuffer.duration,isFloat:false} satisfies MultisampleFile});
    const prepared:PreparedAudioImport={instrument:'multisample',expectedProjectGeneration:initialState.projectGeneration??0,assets:[imported('a','C4.wav'),imported('b','D4.wav')],selections:[
      {id:'a',destination:{kind:'multisample-root',rootNote:60,decision:'choose-free'}},{id:'b',destination:{kind:'multisample-root',rootNote:61,decision:'choose-free'}},
    ]};
    const result=appReducer(state({multisampleFiles:existing}),{type:'COMMIT_PREPARED_IMPORTS',payload:{operationId:'multi',prepared}});
    expect(result.importCommitResult).toMatchObject({status:'committed',appliedIds:['a'],retainedIds:['b']});
    expect(result.multisampleFiles).toHaveLength(24);
  });

  it('preserves current multisample loop defaults, note labels, and imported crossfade association',()=>{
    const asset=imported('loop','matched-C4.wav'),before=state({multisampleSettings:{...initialState.multisampleSettings,autoZeroCrossing:false},importedMultisamplePreset:{type:'multisampler',regions:[{sample:'matched-C4.wav',framecount:8,'loop.crossfade':2}]}});
    const result=appReducer(before,{type:'COMMIT_PREPARED_IMPORTS',payload:{operationId:'loop-import',prepared:{instrument:'multisample',expectedProjectGeneration:before.projectGeneration??0,assets:[asset],selections:[{id:'loop',destination:{kind:'multisample-root',rootNote:60,decision:'choose-free'}}]}}});
    expect(result.multisampleFiles[0]).toMatchObject({rootNote:60,note:'C3',loopStart:asset.audioBuffer.duration*.2,loopEnd:asset.audioBuffer.duration*.8,loopCrossfade:{fraction:.25,importedRaw:2,importedFramecount:8,sourceIdentity:'matched-C4.wav'}});
  });

  it('rejects a final imported crossfade that becomes invalid only after audio association without changing project, history, or review',()=>{
    const asset=imported('fractional','match.wav'),before=state({multisampleSettings:{...initialState.multisampleSettings,autoZeroCrossing:false},
      importedMultisamplePreset:{type:'multisampler',regions:[{sample:'match.wav',framecount:8,'loop.crossfade':0.5}]}});
    const prepared:PreparedAudioImport={instrument:'multisample',expectedProjectGeneration:before.projectGeneration??0,assets:[asset],
      selections:[{id:'fractional',destination:{kind:'multisample-root',rootNote:60,decision:'choose-free'}}]};
    const retainedAsset=prepared.assets[0];
    const history=reduceHistory(createHistory(before),{type:'COMMIT_PREPARED_IMPORTS',payload:{operationId:'fractional-crossfade',prepared}},appReducer);

    expect(history.present.importCommitResult).toMatchObject({operationId:'fractional-crossfade',status:'rejected',error:expect.stringMatching(/imported crossfade value/i)});
    expect(history.present.drumSamples).toBe(before.drumSamples);
    expect(history.present.multisampleFiles).toBe(before.multisampleFiles);
    expect(history.past).toHaveLength(0);
    expect(prepared.assets).toEqual([retainedAsset]);
    expect(()=>validateProjectArchiveMetadata(createProjectSnapshot(history.present))).not.toThrow();
  });

  it('rejects a late prepared operation after a whole-project replacement',()=>{
    const asset=imported('late','late.wav');
    const prepared:PreparedAudioImport={instrument:'drum',expectedProjectGeneration:3,assets:[asset],selections:[{id:'late',destination:{kind:'drum-unassigned'}}]};
    expect(()=>finalizeAudioImport(prepared,state({projectGeneration:4}))).toThrow(/project was replaced/i);
  });
});
