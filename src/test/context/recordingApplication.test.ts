import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appReducer, initialState, type AppState, type DrumSample, type MultisampleFile } from '../../context/AppContext';
import { createHistory, reduceHistory } from '../../utils/projectHistory';
import { STORED_AUDIO_TYPE } from '../../utils/storedAudio';
import { prepareRecordingApplication, proposeUnusedRootNotes } from '../../utils/recordingApplication';
import { exportProjectArchive, importProjectArchive } from '../../utils/projectArchive';

function audio(values:number[],sampleRate=8_000) {const result=new AudioContext().createBuffer(1,values.length,sampleRate);result.copyToChannel(Float32Array.from(values),0);return result;}
function drum(buffer:AudioBuffer,name:string,key:number):DrumSample {const file=new File(['old'],name);return {file,audioBuffer:buffer,name,isLoaded:true,inPoint:0,outPoint:buffer.duration,
  originalBitDepth:32,originalSampleRate:buffer.sampleRate,originalChannels:1,fileSize:file.size,duration:buffer.duration,isFloat:true,
  playmode:'oneshot',reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:true,assignedKey:key};}
function multi(buffer:AudioBuffer,name:string,rootNote:number):MultisampleFile {const file=new File(['old'],name);return {file,audioBuffer:buffer,name,isLoaded:true,rootNote,
  inPoint:0,outPoint:buffer.duration,loopStart:0,loopEnd:buffer.duration,originalBitDepth:32,originalSampleRate:buffer.sampleRate,originalChannels:1,fileSize:file.size,duration:buffer.duration,isFloat:true};}
function state(patch:Partial<AppState>):AppState{return {...initialState,...patch};}

const PositionalAudioBuffer=globalThis.AudioBuffer as unknown as new(channels:number,length:number,sampleRate:number)=>AudioBuffer;
beforeEach(()=>{vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('File',NodeFile);vi.stubGlobal('AudioBuffer',class extends PositionalAudioBuffer {
  constructor(options:AudioBufferOptions){super(options.numberOfChannels??1,options.length,options.sampleRate)}
})});
afterEach(()=>vi.unstubAllGlobals());

describe('guarded recording application',()=>{
  it('atomically fills drum holes, keeps overflow unassigned, and one Undo removes the whole batch',async()=>{
    const occupied=drum(audio([.2]),'old.opfloat',1);
    const drums=initialState.drumSamples.map((sample,index)=>index===1?occupied:{...sample,isLoaded:false,audioBuffer:null,file:null,name:''});
    const before=state({drumSamples:drums});
    const prepared=await prepareRecordingApplication({instrument:'drum',takes:[
      {id:'take-a',name:'Kick',audioBuffer:audio([.1,.2]),rootNote:60},
      ...Array.from({length:24},(_,index)=>({id:`take-${index}`,name:`Take ${index}`,audioBuffer:audio([index/100]),rootNote:61+index})),
    ],state:before,target:{kind:'drum'}});
    let history=createHistory(before);
    history=reduceHistory(history,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'record-1',prepared}},appReducer);
    expect(history.present.recordingCommitResult).toMatchObject({operationId:'record-1',status:'committed',appliedIds:expect.arrayContaining(['take-a']),assignedCount:23,overflowCount:2});
    expect(history.present.notifications.at(-1)?.message).toBe('25 takes added; 2 kept unassigned');
    expect(history.present.drumSamples.slice(0,24).filter(sample=>sample.isLoaded)).toHaveLength(24);
    expect(history.present.drumSamples.slice(24).filter(sample=>sample.isLoaded)).toHaveLength(2);
    history=reduceHistory(history,{type:'UNDO'},appReducer);
    expect(history.present.drumSamples).toEqual(before.drumSamples);
  });

  it('reserves edited review roots and wraps the explicit target anchor without duplicates',()=>{
    const files=[multi(audio([.1]),'occupied-64.opfloat',64),multi(audio([.1]),'occupied-127.opfloat',127)];
    expect(proposeUnusedRootNotes(files,4,64,[65,70])).toEqual([66,67,68,69]);
    expect(proposeUnusedRootNotes(files,3,127,[0,1])).toEqual([2,3,4]);
    const everyRoot=Array.from({length:128},(_,rootNote)=>multi(audio([.1]),`${rootNote}.opfloat`,rootNote));
    expect(proposeUnusedRootNotes(everyRoot,1,60)).toEqual([]);
  });

  it('binds drum replacement consent to the current target identity and preserves the displaced sample unassigned',async()=>{
    const old=drum(audio([.2]),'old.opfloat',3),before=state({drumSamples:initialState.drumSamples.map((sample,index)=>index===3?old:sample)});
    const prepared=await prepareRecordingApplication({instrument:'drum',takes:[{id:'new',name:'Snare',audioBuffer:audio([.7]),rootNote:60}],state:before,
      target:{kind:'drum',padIndex:3,decision:'replace',expected:{audioBuffer:old.audioBuffer,file:old.file}}});
    const committed=appReducer(before,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'replace',prepared}});
    expect(committed.drumSamples[3].name).toBe('Snare.opfloat');
    expect(committed.drumSamples.at(-1)).toMatchObject({name:'old.opfloat',isAssigned:false,assignedKey:undefined});
    const changed=state({drumSamples:before.drumSamples.map((sample,index)=>index===3?drum(audio([.9]),'other.opfloat',3):sample)});
    const rejected=appReducer(changed,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'stale',prepared}});
    expect(rejected.recordingCommitResult).toMatchObject({status:'rejected'});
    expect(rejected.drumSamples).toBe(changed.drumSamples);
  });

  it('applies only remaining multisample capacity, keeps excess IDs, and never silently replaces an occupied note',async()=>{
    const files=Array.from({length:23},(_,index)=>multi(audio([.1]),`m${index}.opfloat`,index));
    const before=state({multisampleFiles:files});
    const prepared=await prepareRecordingApplication({instrument:'multisample',takes:[
      {id:'a',name:'A',audioBuffer:audio([.25]),rootNote:60},{id:'b',name:'B',audioBuffer:audio([.5]),rootNote:61}],state:before,target:{kind:'multisample'}});
    const committed=appReducer(before,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'multi',prepared}});
    expect(committed.recordingCommitResult).toMatchObject({status:'committed',appliedIds:['a'],retainedIds:['b'],assignedCount:1});
    expect(committed.multisampleFiles).toHaveLength(24);
    await expect(prepareRecordingApplication({instrument:'multisample',takes:[{id:'x',name:'X',audioBuffer:audio([.2]),rootNote:22}],state:before,target:{kind:'multisample'}})).rejects.toThrow(/occupied/);
  });

  it('preserves every Float32 frame and honest opfloat source metadata',async()=>{
    const source=audio([Math.fround(.123456789),Math.fround(-.987654321)]);
    const prepared=await prepareRecordingApplication({instrument:'drum',takes:[{id:'precise',name:'Precise take',audioBuffer:source,rootNote:60}],
      state:state({drumSamples:initialState.drumSamples.map(sample=>({...sample,isLoaded:false}))}),target:{kind:'drum'}});
    const asset=prepared.assets[0];
    expect(asset.file.type).toBe(STORED_AUDIO_TYPE);expect(asset.file.name).toBe('Precise take.opfloat');
    expect(asset.sample.originalSampleRate).toBe(8_000);expect(asset.sample.originalBitDepth).toBe(32);expect(asset.sample.outPoint).toBe(2/8_000);
    const raw=await asset.file.arrayBuffer();
    const bytes=new DataView(raw);
    expect([bytes.getFloat32(24,true),bytes.getFloat32(28,true)]).toEqual(Array.from(source.getChannelData(0)));
    const committed=appReducer(state({drumSamples:initialState.drumSamples.map(sample=>({...sample,isLoaded:false}))}),{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'precision',prepared}});
    const restored=await importProjectArchive(await exportProjectArchive(committed));
    expect(restored.drumSamples).toHaveLength(1);const recovered=restored.drumSamples[0];if(!recovered.file||!recovered.audioBuffer)throw new Error('Recorded archive did not restore its owned assets');
    expect(recovered.file.type).toBe(STORED_AUDIO_TYPE);expect(recovered.file.size).toBe(32);
    expect(Array.from(recovered.audioBuffer.getChannelData(0))).toEqual(Array.from(source.getChannelData(0)));
  });

  it('admits a size-neutral identity-bound multisample replacement at the 256-reference limit',async()=>{
    const drums=Array.from({length:233},(_,index)=>{const item=drum(audio([.1]),'d'+index+'.opfloat',Math.min(index,23));return index<24?item:{...item,isAssigned:false,assignedKey:undefined};});
    const files=Array.from({length:23},(_,index)=>multi(audio([.1]),'m'+index+'.opfloat',index));
    const old=files[22],before=state({drumSamples:drums,multisampleFiles:files});
    const prepared=await prepareRecordingApplication({instrument:'multisample',takes:[{id:'replacement',name:'Replacement',audioBuffer:audio([.2]),rootNote:22}],state:before,
      target:{kind:'multisample',rootNote:22,decision:'replace',expected:{audioBuffer:old.audioBuffer,file:old.file}}});
    const result=appReducer(before,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'limit-replace',prepared}});
    expect(result.recordingCommitResult).toMatchObject({status:'committed',appliedIds:['replacement']});
    expect(result.drumSamples.length+result.multisampleFiles.length).toBe(256);
    expect(result.multisampleFiles.find(file=>file.rootNote===22)?.name).toBe('Replacement.opfloat');
  });

  it('removes only the targeted multisample reference from projected replacement usage',async()=>{
    const shared=audio([.1]),old=multi(shared,'shared.opfloat',60),alsoReferenced=drum(shared,'shared.opfloat',0);
    alsoReferenced.file=old.file;
    const filler=Array.from({length:254},(_,index)=>{const item=drum(audio([.1]),'d'+index+'.opfloat',Math.min(index,23));return {...item,isAssigned:index<23,assignedKey:index<23?index:undefined};});
    const before=state({drumSamples:[alsoReferenced,...filler],multisampleFiles:[old]});
    await expect(prepareRecordingApplication({instrument:'multisample',takes:[{id:'replacement',name:'Replacement',audioBuffer:audio([.2]),rootNote:60}],state:before,
      target:{kind:'multisample',rootNote:60,decision:'replace',expected:{audioBuffer:old.audioBuffer,file:old.file}}})).resolves.toMatchObject({assets:[{id:'replacement'}]});
  });

  it('allows one size-neutral replacement without trimming a legacy multisample over 24 zones',async()=>{
    const files=Array.from({length:25},(_,index)=>multi(audio([.1]),'legacy-'+index+'.opfloat',index)),old=files[24],before=state({multisampleFiles:files});
    const prepared=await prepareRecordingApplication({instrument:'multisample',takes:[{id:'legacy-replacement',name:'Legacy replacement',audioBuffer:audio([.4]),rootNote:24}],state:before,
      target:{kind:'multisample',rootNote:24,decision:'replace',expected:{audioBuffer:old.audioBuffer,file:old.file}}});
    const result=appReducer(before,{type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId:'legacy-replace',prepared}});
    expect(result.recordingCommitResult).toMatchObject({status:'committed',appliedIds:['legacy-replacement']});expect(result.multisampleFiles).toHaveLength(25);expect(result.multisampleFiles.find(file=>file.rootNote===24)?.name).toBe('Legacy replacement.opfloat');
  });
});
