import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';
import { readAudioMetadata, type AudioMetadata } from './audioFormats';
import type { IntakeFileRecord } from './externalFileIntake';
import { midiNoteToString } from './audio';
import { planProjectAudioCapacity } from './audioSlicing';
import type { ExpectedAssetIdentity } from './recordingApplication';
import { applyZeroCrossingToMarkers } from './audio';
import { associateImportedCrossfades } from './importedCrossfade';
import { validateProjectArchiveMetadata } from './projectArchive';
import { preflightAudioImport } from './audioImportPreflight';
import { audioContextManager } from './audioContext';

export interface PreparedImportAsset {id:string;sourceIdentity:string;path:string;file:File;audioBuffer:AudioBuffer;metadata:AudioMetadata}
export type ImportDestination =
  | {kind:'drum-pad';padIndex:number;decision:'choose-empty'|'replace';expected?:ExpectedAssetIdentity}
  | {kind:'drum-asset';decision:'replace';expected:ExpectedAssetIdentity}
  | {kind:'drum-unassigned'}
  | {kind:'multisample-root';rootNote:number;decision:'choose-free'|'replace';expected?:ExpectedAssetIdentity};
export interface PreparedAudioImport {instrument:'drum'|'multisample';expectedProjectGeneration:number;assets:PreparedImportAsset[];selections:Array<{id:string;destination:ImportDestination}>}
export interface ImportCommit {drumSamples:DrumSample[];multisampleFiles:MultisampleFile[];appliedIds:string[];retainedIds:string[];assignedCount:number;overflowCount:number}
export interface ImportPreparationProgress {discovered:number;preparing:number;prepared:number;rejected:number;capacityExcess:number}
export interface ImportPreparationOptions {maxDecodedBytes?:number;existingDecodedBytes?:number;preflight?:typeof preflightAudioImport}
export async function prepareAudioImportFiles(records:readonly IntakeFileRecord[],instrument:'drum'|'multisample',expectedProjectGeneration:number,mapping:AppState['midiNoteMapping'],signal?:AbortSignal,onProgress?:(progress:ImportPreparationProgress)=>void,decode=readAudioMetadata,options:ImportPreparationOptions={}) {
  const assets:PreparedImportAsset[]=[],rejected:Array<{id:string;path:string;reason:string}>=[],excess:Array<{id:string;path:string;reason:string}>=[];
  const maximum=options.maxDecodedBytes??128*1024*1024;let decodedBytes=options.existingDecodedBytes??0,finished=0,budgetExhausted=decodedBytes>=maximum;
  const publish=(preparing=0)=>onProgress?.({discovered:records.length,preparing,prepared:assets.length,rejected:rejected.length,capacityExcess:excess.length});
  const check=()=>{if(signal?.aborted)throw new DOMException('Import canceled','AbortError')};check();publish();
  for(const record of records){check();if(budgetExhausted){excess.push({id:record.id,path:record.path,reason:'128 MiB decoded-audio project limit reached'});finished++;publish();continue;}publish(1);
    try{const inspect=options.preflight??(decode===readAudioMetadata?preflightAudioImport:undefined);if(inspect){const context=await audioContextManager.getAudioContext();check();await inspect(record.file,maximum-decodedBytes,context.sampleRate,signal);check();}const metadata=await decode(record.file,mapping);check();if(!metadata.audioBuffer||metadata.audioBuffer.length<1)throw new Error('decoder returned no audio frames');const cost=24+4*metadata.audioBuffer.numberOfChannels*metadata.audioBuffer.length;
      if(decodedBytes+cost>maximum){budgetExhausted=true;excess.push({id:record.id,path:record.path,reason:'128 MiB decoded-audio project limit reached'});}else{decodedBytes+=cost;assets.push({...record,sourceIdentity:crypto.randomUUID(),audioBuffer:metadata.audioBuffer,metadata});}
    }catch(error){check();const reason=error instanceof Error?error.message:'Audio decode failed';if(/decoded-audio project limit/.test(reason)){budgetExhausted=true;excess.push({id:record.id,path:record.path,reason});}else rejected.push({id:record.id,path:record.path,reason});}finally{finished++;publish();}}
  check();if(finished!==records.length)throw new Error('Audio preparation stopped before every file was classified');
  return {instrument,expectedProjectGeneration,assets,rejected,excess};
}
const categorySlots={kick:[0,1],snare:[2,3],clap:[5],closedHat:[8],openHat:[10],tom:[12,14,16,19]} as const;
type Category=keyof typeof categorySlots;
function tokens(name:string){return name.replace(/\.[^.]+$/,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)}
function categories(name:string):Category[]{const t=new Set(tokens(name));const found:Category[]=[];
  const hat=t.has('hat')||t.has('hihat')||t.has('hh');const closed=t.has('closed')||t.has('ch')||t.has('chh');const open=t.has('open')||t.has('oh')||t.has('ohh');
  if((hat&&closed)||t.has('chh'))found.push('closedHat');if((hat&&open)||t.has('ohh'))found.push('openHat');
  if(t.has('kick')||t.has('bd')||t.has('kd'))found.push('kick');if(t.has('snare')||t.has('sd'))found.push('snare');if(t.has('clap')||t.has('clp'))found.push('clap');if(t.has('tom'))found.push('tom');
  return [...new Set(found)];}
const categoryLabel:Record<Category,string>={kick:'kick',snare:'snare',clap:'clap',closedHat:'closed hi-hat',openHat:'open hi-hat',tom:'tom'};
export function proposeDrumDestinations(assets:readonly PreparedImportAsset[],drums:readonly DrumSample[],reservedPads:Iterable<number>=[]) {const reserved=new Set([...drums.slice(0,24).flatMap((sample,index)=>sample?.isLoaded?[index]:[]),...reservedPads]);
  return assets.map(asset=>{const found=categories(asset.file.name);if(found.length!==1)return {id:asset.id,destination:null,reason:found.length?'filename matches more than one drum type':'no confident filename match'};
    const category=found[0],destination=categorySlots[category].find(slot=>!reserved.has(slot))??null;if(destination===null)return {id:asset.id,destination,reason:`filename contains ${categoryLabel[category]}; matching pads are occupied`};reserved.add(destination);
    return {id:asset.id,destination,reason:`filename contains ${categoryLabel[category]}${category==='kick'?'; first matching free pad':''}`};});}
function identity(current:{file:File|null;audioBuffer:AudioBuffer|null}|undefined,expected:ExpectedAssetIdentity|undefined,label:string){if(!current||!expected||current.file!==expected.file||current.audioBuffer!==expected.audioBuffer)throw new Error(`${label} changed while imports were preparing. Review the destination again.`)}
function drumSample(asset:PreparedImportAsset,isAssigned:boolean,assignedKey?:number):DrumSample {const {file,audioBuffer,metadata}=asset;return {file,audioBuffer,name:file.name,isLoaded:true,inPoint:0,outPoint:audioBuffer.duration,
  originalBitDepth:metadata.bitDepth,originalSampleRate:metadata.sourceSampleRate,originalChannels:metadata.sourceChannels,fileSize:file.size,duration:audioBuffer.duration,isFloat:metadata.isFloat,
  playmode:'oneshot',reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned,assignedKey,sourceIdentity:asset.sourceIdentity};}
function multisample(asset:PreparedImportAsset,rootNote:number,mapping:AppState['midiNoteMapping']):MultisampleFile {const {file,audioBuffer,metadata}=asset;return {file,audioBuffer,name:file.name,isLoaded:true,rootNote,note:midiNoteToString(rootNote,mapping),inPoint:0,outPoint:audioBuffer.duration,
  loopStart:metadata.hasLoopData?metadata.loopStart:audioBuffer.duration*.2,loopEnd:metadata.hasLoopData?metadata.loopEnd:audioBuffer.duration*.8,originalBitDepth:metadata.bitDepth,
  originalSampleRate:metadata.sourceSampleRate,originalChannels:metadata.sourceChannels,fileSize:file.size,duration:audioBuffer.duration,isFloat:metadata.isFloat,sourceIdentity:asset.sourceIdentity};}
export function finalizeAudioImport(prepared:PreparedAudioImport,state:AppState):ImportCommit {if(prepared.expectedProjectGeneration!==(state.projectGeneration??0))throw new Error('The project was replaced while audio was preparing. Start this import again.');if(!prepared.assets.length)throw new Error('Prepared import is empty');const byId=new Map(prepared.assets.map(asset=>[asset.id,asset]));const ids=new Set<string>();
  for(const selection of prepared.selections){if(ids.has(selection.id)||!byId.has(selection.id))throw new Error('Import selections must reference each prepared file once');ids.add(selection.id);}
  let drums=[...state.drumSamples],multis=[...state.multisampleFiles];const appliedIds:string[]=[],retainedIds:string[]=[];let assignedCount=0,overflowCount=0;
  for(const selection of prepared.selections){const asset=byId.get(selection.id)!;const destination=selection.destination;if(prepared.instrument==='drum'){
      if(destination.kind==='multisample-root')throw new Error('Import destination does not match drum mode');const trial=[...drums];
      if(destination.kind==='drum-unassigned'){trial.push(drumSample(asset,false));}
      else if(destination.kind==='drum-asset') {const index=trial.findIndex(sample=>sample?.file===destination.expected.file&&sample?.audioBuffer===destination.expected.audioBuffer);
        identity(trial[index],destination.expected,'The unassigned replacement target');
        if(index<24||trial[index].isAssigned)throw new Error('The unassigned replacement target is no longer in the review tray.');
        trial[index]=drumSample(asset,false);}
      else {if(!Number.isInteger(destination.padIndex)||destination.padIndex<0||destination.padIndex>=24)throw new Error('Drum pad destination is invalid');const current=trial[destination.padIndex];
        if(destination.decision==='replace'){identity(current,destination.expected,'The drum replacement target');if(current.isLoaded)trial.push({...current,isAssigned:false,assignedKey:undefined});}
        else if(current?.isLoaded)throw new Error('The target pad is occupied. Choose Replace, another empty pad, or Unassigned.');
        trial[destination.padIndex]=drumSample(asset,true,destination.padIndex);}
      try{planProjectAudioCapacity([...trial,...multis],[]);validateProjectArchiveMetadata({...state,drumSamples:trial,multisampleFiles:multis});drums=trial;appliedIds.push(asset.id);if(destination.kind==='drum-pad')assignedCount++;else if(destination.kind==='drum-unassigned')overflowCount++;}catch{retainedIds.push(asset.id);}
    } else {if(destination.kind!=='multisample-root')throw new Error('Import destination does not match multisample mode');if(!Number.isInteger(destination.rootNote)||destination.rootNote<0||destination.rootNote>127)throw new Error('Root note must be a whole MIDI value from 0 to 127');const trial=[...multis];const index=trial.findIndex(file=>file.rootNote===destination.rootNote);
      if(destination.decision==='replace'){identity(trial[index],destination.expected,'The multisample replacement target');trial.splice(index,1);}else if(index>=0){retainedIds.push(asset.id);continue;}
      const capacity=destination.decision==='replace'?Math.max(1,24-multis.length):Math.max(0,24-multis.length);if(capacity<1){retainedIds.push(asset.id);continue;}let added=multisample(asset,destination.rootNote,state.midiNoteMapping);if(state.multisampleSettings.autoZeroCrossing){const adjusted=applyZeroCrossingToMarkers(asset.audioBuffer,added.inPoint,added.outPoint,added.loopStart,added.loopEnd);added={...added,inPoint:adjusted.inPoint,outPoint:adjusted.outPoint,loopStart:adjusted.loopStart??added.loopStart,loopEnd:adjusted.loopEnd??added.loopEnd};}trial.push(added);trial.sort((a,b)=>b.rootNote-a.rootNote);
      try{planProjectAudioCapacity([...drums,...trial],[]);validateProjectArchiveMetadata({...state,drumSamples:drums,multisampleFiles:trial});multis=trial;appliedIds.push(asset.id);assignedCount++;}catch{retainedIds.push(asset.id);}
    }}
  if(prepared.instrument==='multisample')multis=associateImportedCrossfades(multis,state.importedMultisamplePreset).files;
  validateProjectArchiveMetadata({...state,drumSamples:drums,multisampleFiles:multis});
  return {drumSamples:drums,multisampleFiles:multis,appliedIds,retainedIds,assignedCount,overflowCount};}
