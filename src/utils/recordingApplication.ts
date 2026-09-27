import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';
import { SLICE_LIMITS, planProjectAudioCapacity } from './audioSlicing';
import { encodeStoredAudio, STORED_AUDIO_TYPE } from './storedAudio';
import { midiNoteToString } from './audio';

export interface RecordingTakeDraft {id:string;name:string;audioBuffer:AudioBuffer;rootNote:number}
export interface ExpectedAssetIdentity {audioBuffer:AudioBuffer|null;file:File|null}
export type RecordingTarget =
  | {kind:'drum';padIndex?:number;decision?:'replace'|'choose-empty';expected?:ExpectedAssetIdentity}
  | {kind:'multisample';rootNote?:number;decision?:'replace'|'choose-free';expected?:ExpectedAssetIdentity};
export interface PreparedRecordingAsset {id:string;file:File;audioBuffer:AudioBuffer;rootNote:number;sample:DrumSample}
export interface PreparedRecordingApplication {
  instrument:'drum'|'multisample';assets:PreparedRecordingAsset[];retainedIds:string[];target:RecordingTarget;
}

function filename(value:string) {
  const base=(value.trim()||'Recorded take').replace(/\.opfloat$/i,'').slice(0,120);
  return `${base}.opfloat`;
}

function sampleFor(file:File,audioBuffer:AudioBuffer):DrumSample {
  return {file,audioBuffer,name:file.name,isLoaded:true,inPoint:0,outPoint:audioBuffer.length/audioBuffer.sampleRate,
    originalBitDepth:32,originalSampleRate:audioBuffer.sampleRate,originalChannels:audioBuffer.numberOfChannels,
    fileSize:file.size,duration:audioBuffer.length/audioBuffer.sampleRate,isFloat:true,playmode:'oneshot',reverse:false,
    transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:false};
}

function assertIdentity(current:{audioBuffer:AudioBuffer|null;file:File|null}|undefined,expected:ExpectedAssetIdentity|undefined,label:string) {
  if(!expected||!current||current.audioBuffer!==expected.audioBuffer||current.file!==expected.file)throw new Error(`${label} changed while recordings were preparing. No takes were added; review the destination again.`);
}

function toMultisample(asset:PreparedRecordingAsset,mapping:AppState['midiNoteMapping']):MultisampleFile {
  const {audioBuffer,file}=asset;
  return {file,audioBuffer,name:file.name,isLoaded:true,rootNote:asset.rootNote,note:midiNoteToString(asset.rootNote,mapping),inPoint:0,outPoint:audioBuffer.duration,
    loopStart:0,loopEnd:audioBuffer.duration,originalBitDepth:32,originalSampleRate:audioBuffer.sampleRate,
    originalChannels:audioBuffer.numberOfChannels,fileSize:file.size,duration:audioBuffer.duration,isFloat:true};
}

function validateDrafts(takes:readonly RecordingTakeDraft[]) {
  if(!takes.length)throw new Error('Select at least one take to add');
  if(takes.length>32)throw new Error('A recording tray can retain at most 32 takes');
  const ids=new Set<string>(); let owned=0;
  for(const take of takes){
    if(!take.id||ids.has(take.id))throw new Error('Every selected take must have a distinct identity');ids.add(take.id);
    const pcm=take.audioBuffer.length*take.audioBuffer.numberOfChannels*4;
    if(!Number.isSafeInteger(pcm)||take.audioBuffer.length<1||take.audioBuffer.numberOfChannels<1||take.audioBuffer.numberOfChannels>2||take.audioBuffer.sampleRate<8_000||take.audioBuffer.sampleRate>96_000)throw new Error('A selected take has unsupported audio dimensions');
    if(!Number.isInteger(take.rootNote)||take.rootNote<0||take.rootNote>127)throw new Error('Root notes must be whole MIDI values from 0 to 127');
    owned+=pcm+2*(24+pcm);
  }
  if(owned>256*1024*1024)throw new Error('Preparing these takes would exceed the recorder 256 MiB owned-audio limit');
}

/** Resolves project capacity before encoding source copies where destination limits permit. */
export async function prepareRecordingApplication(options:{instrument:'drum'|'multisample';takes:readonly RecordingTakeDraft[];state:AppState;target:RecordingTarget;signal?:AbortSignal}) {
  validateDrafts(options.takes);
  if(options.target.kind!==options.instrument)throw new Error('Recording target does not match the instrument');
  let candidates=[...options.takes],retainedIds:string[]=[];
  if(options.instrument==='multisample'){
    const target=options.target as Extract<RecordingTarget,{kind:'multisample'}>;
    const occupiedByNote=new Map(options.state.multisampleFiles.map(file=>[file.rootNote,file]));
    const replace=target.decision==='replace';
    if(replace){
      const existing=options.state.multisampleFiles.find(file=>file.rootNote===target.rootNote);assertIdentity(existing,target.expected,'The multisample replacement target');
    }
    const used=new Set<number>();
    for(const take of candidates){
      if(used.has(take.rootNote))throw new Error(`Root note ${take.rootNote} is assigned to more than one selected take`);used.add(take.rootNote);
      const occupied=occupiedByNote.get(take.rootNote);
      if(occupied&&!(replace&&take===candidates[0]&&take.rootNote===target.rootNote))throw new Error(`Root note ${take.rootNote} is occupied. Choose another note or explicitly replace it.`);
    }
    const remaining=(replace?1:0)+Math.max(0,24-options.state.multisampleFiles.length);
    retainedIds=candidates.slice(remaining).map(take=>take.id);candidates=candidates.slice(0,remaining);
    if(!candidates.length)throw new Error('The multisample has no remaining zone capacity; remove a zone or explicitly replace one');
  }
  const estimates=candidates.map(take=>({audioBuffer:take.audioBuffer,fileSize:24+take.audioBuffer.length*take.audioBuffer.numberOfChannels*4,hasSourceFile:true}));
  let existing=[...options.state.drumSamples,...options.state.multisampleFiles];
  if(options.instrument==='multisample'&&options.target.kind==='multisample'&&options.target.decision==='replace'){
    const replacementRoot=options.target.rootNote;
    const replacementIndex=options.state.multisampleFiles.findIndex(file=>file.rootNote===replacementRoot);
    existing=[...options.state.drumSamples,...options.state.multisampleFiles.filter((_,index)=>index!==replacementIndex)];
  }
  planProjectAudioCapacity(existing,estimates);
  const assets:PreparedRecordingAsset[]=[];
  for(const take of candidates){
    if(options.signal?.aborted)throw new DOMException('Recording Apply canceled','AbortError');
    const payload=encodeStoredAudio(take.audioBuffer);const file=new File([payload],filename(take.name),{type:STORED_AUDIO_TYPE});
    assets.push({id:take.id,file,audioBuffer:take.audioBuffer,rootNote:take.rootNote,sample:sampleFor(file,take.audioBuffer)});
    await Promise.resolve();
  }
  return {instrument:options.instrument,assets,retainedIds,target:options.target} satisfies PreparedRecordingApplication;
}

export function finalizeRecordingApplication(prepared:PreparedRecordingApplication,state:AppState) {
  if(!prepared.assets.length)throw new Error('Prepared recording assets are empty');
  if(prepared.instrument==='drum'){
    const target=prepared.target as Extract<RecordingTarget,{kind:'drum'}>;const drums=[...state.drumSamples];
    const first=prepared.assets[0];let start=0;
    if(target.padIndex!==undefined){
      if(!Number.isInteger(target.padIndex)||target.padIndex<0||target.padIndex>=24)throw new Error('The recording pad target is invalid');
      const current=drums[target.padIndex];
      if(target.decision==='replace'){
        assertIdentity(current,target.expected,'The drum replacement target');
        if(current?.isLoaded)drums.push({...current,isAssigned:false,assignedKey:undefined});
        drums[target.padIndex]={...first.sample,isAssigned:true,assignedKey:target.padIndex};start=1;
      } else if(target.decision!=='choose-empty'){
        if(current?.isLoaded)throw new Error('The target pad is occupied. Choose Replace, choose an empty pad, or cancel.');
        if(target.expected&&(current?.audioBuffer!==target.expected.audioBuffer||current?.file!==target.expected.file))throw new Error('The target pad changed while recordings were preparing.');
        drums[target.padIndex]={...first.sample,isAssigned:true,assignedKey:target.padIndex};start=1;
      }
    }
    const assignedIds:string[]=[];if(start)assignedIds.push(first.id);
    for(const asset of prepared.assets.slice(start)){
      const empty=drums.slice(0,24).findIndex(sample=>!sample?.isLoaded);
      if(empty>=0){drums[empty]={...asset.sample,isAssigned:true,assignedKey:empty};assignedIds.push(asset.id);}
      else drums.push({...asset.sample,isAssigned:false,assignedKey:undefined});
    }
    planProjectAudioCapacity([...drums,...state.multisampleFiles],[]);
    return {drumSamples:drums,multisampleFiles:state.multisampleFiles,appliedIds:prepared.assets.map(asset=>asset.id),retainedIds:prepared.retainedIds,
      assignedCount:assignedIds.length,overflowCount:prepared.assets.length-assignedIds.length};
  }
  const target=prepared.target as Extract<RecordingTarget,{kind:'multisample'}>;let multis=[...state.multisampleFiles];
  if(target.decision==='replace'){
    const index=multis.findIndex(file=>file.rootNote===target.rootNote);assertIdentity(multis[index],target.expected,'The multisample replacement target');multis.splice(index,1);
  }
  const existingNotes=new Set(multis.map(file=>file.rootNote));const capacity=Math.max(target.decision==='replace'?1:0,24-multis.length);const applying:PreparedRecordingAsset[]=[];const retained=[...prepared.retainedIds];
  for(const asset of prepared.assets){
    if(existingNotes.has(asset.rootNote))throw new Error(`Root note ${asset.rootNote} became occupied while recordings were preparing.`);
    if(applying.length>=capacity){retained.push(asset.id);continue;} existingNotes.add(asset.rootNote);applying.push(asset);
  }
  multis=[...multis,...applying.map(asset=>toMultisample(asset,state.midiNoteMapping))].sort((a,b)=>b.rootNote-a.rootNote);
  planProjectAudioCapacity([...state.drumSamples,...multis],[]);
  return {drumSamples:state.drumSamples,multisampleFiles:multis,appliedIds:applying.map(asset=>asset.id),retainedIds:retained,
    assignedCount:applying.length,overflowCount:retained.length};
}

export function proposeUnusedRootNotes(files:readonly MultisampleFile[],count:number,start=60,reservedRoots:readonly number[]=[]) {
  const used=new Set([...files.map(file=>file.rootNote),...reservedRoots]),notes:number[]=[],anchor=Math.max(0,Math.min(127,Math.round(start)));
  for(let note=anchor;note<=127&&notes.length<count;note+=1)if(!used.has(note))notes.push(note);
  for(let note=0;note<anchor&&notes.length<count;note+=1)if(!used.has(note))notes.push(note);
  return notes;
}

export {SLICE_LIMITS as PROJECT_RECORDING_LIMITS};
