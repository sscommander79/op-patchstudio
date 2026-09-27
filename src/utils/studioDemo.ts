import type { AppState, DrumSample } from '../context/AppContext';
import { encodeStoredAudio, STORED_AUDIO_TYPE } from './storedAudio';
import { planProjectAudioCapacity } from './audioSlicing';
import { HISTORY_ASSET_BYTES, retainedAssetBytes, selectEditableProject } from './projectHistory';
import { validateProjectArchiveMetadata } from './projectArchive';

export const STUDIO_SEED_RECIPE_ID = 'studio-seed-v1';
export const STUDIO_SEED_SLOTS = [0, 2, 4, 5, 7, 8, 10, 12, 16, 17] as const;
const SAMPLE_RATE = 44100;
const STORED_AUDIO_HEADER_BYTES = 24;

type StudioSeedSlot = typeof STUDIO_SEED_SLOTS[number];
interface VoiceRecipe { slot:StudioSeedSlot; name:string; frames:number; peak:number }

const VOICES:readonly VoiceRecipe[] = [
  {slot:0,name:'Seed Kick',frames:21168,peak:.28},
  {slot:2,name:'Seed Snare',frames:13230,peak:.22},
  {slot:4,name:'Seed Rim',frames:4410,peak:.14},
  {slot:5,name:'Seed Clap',frames:11466,peak:.18},
  {slot:7,name:'Seed Shaker',frames:6174,peak:.10},
  {slot:8,name:'Seed Closed Hat',frames:4410,peak:.10},
  {slot:10,name:'Seed Open Hat',frames:24255,peak:.12},
  {slot:12,name:'Seed Low Tom',frames:18522,peak:.20},
  {slot:16,name:'Seed High Tom',frames:11466,peak:.16},
  {slot:17,name:'Seed Dual Bell',frames:19404,peak:.12},
] as const;

const envelope = (time:number,tau:number) => time < 0 ? 0 : Math.exp(-time/tau);
const tone = (time:number,frequency:number,tau:number) => Math.sin(2*Math.PI*frequency*time)*envelope(time,tau);
const sweep = (time:number,start:number,delta:number,pitchTau:number,ampTau:number) =>
  Math.sin(2*Math.PI*(start*time+delta*pitchTau*(1-Math.exp(-time/pitchTau))))*envelope(time,ampTau);

function noise(slot:number,frames:number):Float64Array {
  const output=new Float64Array(frames);let state=(0x53540001+slot)>>>0;let previous=0;
  for(let index=0;index<frames;index+=1){
    state=(state^(state<<13))>>>0;state=(state^(state>>>17))>>>0;state=(state^(state<<5))>>>0;
    const white=2*state/4294967296-1;output[index]=(white-previous)/2;previous=white;
  }
  return output;
}

function rawVoice(recipe:VoiceRecipe):Float64Array {
  const values=new Float64Array(recipe.frames);
  const high=recipe.slot===17 ? null : noise(recipe.slot,recipe.frames);
  for(let index=0;index<recipe.frames;index+=1){
    const time=index/SAMPLE_RATE,h=high?.[index]??0;
    switch(recipe.slot){
      case 0: values[index]=sweep(time,52,115,.022,.105)+.08*h*envelope(time,.010);break;
      case 2: values[index]=.35*tone(time,185,.060)+.18*tone(time,310,.035)+.65*h*envelope(time,.055);break;
      case 4: values[index]=tone(time,920,.014)+.45*tone(time,1510,.009)+.08*h*envelope(time,.004);break;
      case 5: values[index]=h*(envelope(time,.008)+.8*envelope(time-.013,.008)+.65*envelope(time-.026,.008)+.6*envelope(time-.039,.038));break;
      case 7: values[index]=h*Math.sin(Math.PI*time/.14)**2;break;
      case 8: values[index]=(.8*h+.12*tone(time,6310,.018)+.08*tone(time,9170,.013))*envelope(time,.020);break;
      case 10: values[index]=(.8*h+.12*tone(time,6310,.160)+.08*tone(time,9170,.120))*envelope(time,.120);break;
      case 12: values[index]=sweep(time,108,32,.025,.090)+.22*tone(time,173,.045)+.04*h*envelope(time,.008);break;
      case 16: values[index]=sweep(time,185,48,.018,.055)+.22*tone(time,297,.028)+.04*h*envelope(time,.006);break;
      case 17: values[index]=tone(time,557,.100)+.7*tone(time,845,.080)+.18*tone(time,1690,.035);break;
    }
  }
  return values;
}

function createMonoBuffer(frames:number):AudioBuffer {
  return new AudioBuffer({numberOfChannels:1,length:frames,sampleRate:SAMPLE_RATE});
}

export function renderStudioSeedVoice(slot:StudioSeedSlot):AudioBuffer {
  const recipe=VOICES.find(item=>item.slot===slot);
  if(!recipe)throw new Error(`Unknown Studio Seed slot ${slot}`);
  const raw=rawVoice(recipe),windowed=new Float64Array(recipe.frames);
  let weightedSum=0,windowSum=0;
  for(let index=0;index<recipe.frames;index+=1){
    const attack=Math.sin((Math.PI/2)*Math.min(1,index/(.0005*SAMPLE_RATE)))**2;
    const release=Math.sin((Math.PI/2)*Math.min(1,(recipe.frames-1-index)/(.008*SAMPLE_RATE)))**2;
    const weight=attack*release;windowed[index]=weight;weightedSum+=weight*raw[index];windowSum+=weight;
  }
  if(!Number.isFinite(weightedSum)||!Number.isFinite(windowSum)||windowSum<=0)throw new Error(`Studio Seed ${recipe.name} could not be centered`);
  const mean=weightedSum/windowSum,centered=new Float64Array(recipe.frames);let maximum=0;
  for(let index=0;index<recipe.frames;index+=1){centered[index]=windowed[index]*(raw[index]-mean);maximum=Math.max(maximum,Math.abs(centered[index]));}
  if(!Number.isFinite(maximum)||maximum<=0)throw new Error(`Studio Seed ${recipe.name} has no usable signal`);
  const output=createMonoBuffer(recipe.frames),channel=output.getChannelData(0),scale=recipe.peak/maximum;
  for(let index=0;index<recipe.frames;index+=1){const value=centered[index]*scale;if(!Number.isFinite(value))throw new Error(`Studio Seed ${recipe.name} produced invalid audio`);channel[index]=value;}
  channel[0]=0;channel[channel.length-1]=0;
  return output;
}

export interface StudioSeedSample {slot:StudioSeedSlot;name:string;audioBuffer:AudioBuffer;file:File;drumSample:DrumSample}
export interface StudioSeedKit {recipeId:typeof STUDIO_SEED_RECIPE_ID;samples:StudioSeedSample[]}

export async function generateStudioSeedKit(options:{signal?:AbortSignal;onProgress?:(completed:number,total:number)=>void}={}):Promise<StudioSeedKit> {
  const samples:StudioSeedSample[]=[];
  for(const recipe of VOICES){
    if(options.signal?.aborted)throw new DOMException('Studio Seed generation canceled','AbortError');
    const audioBuffer=renderStudioSeedVoice(recipe.slot),payload=encodeStoredAudio(audioBuffer);
    const file=new File([payload],`${recipe.name}.opfloat`,{type:STORED_AUDIO_TYPE,lastModified:0});
    const sourceIdentity=crypto.randomUUID();
    samples.push({slot:recipe.slot,name:recipe.name,audioBuffer,file,drumSample:{file,audioBuffer,name:recipe.name,isLoaded:true,inPoint:0,outPoint:audioBuffer.duration,
      playmode:'oneshot',reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:true,assignedKey:recipe.slot,
      originalBitDepth:32,originalSampleRate:SAMPLE_RATE,originalChannels:1,fileSize:file.size,duration:audioBuffer.duration,isFloat:true,sourceIdentity}});
    options.onProgress?.(samples.length,VOICES.length);
    await Promise.resolve();
  }
  return {recipeId:STUDIO_SEED_RECIPE_ID,samples};
}

export function studioSeedRecipes() {return VOICES.map(recipe=>({...recipe}));}

export interface PreparedStudioSeedOperation {operationId:string;expectedProjectGeneration:number;mode:'add'|'replace';kit:StudioSeedKit}

/** Cheap admission check before allocating any demo PCM or encoded source copies. */
export function studioSeedAdmissionError(state:AppState,mode:'add'|'replace'):string|null {
  try {
    const retainedSamples=mode==='replace'?state.multisampleFiles:[...state.drumSamples,...state.multisampleFiles];
    planProjectAudioCapacity(retainedSamples,VOICES.map(recipe=>({
      audioBuffer:{length:recipe.frames,numberOfChannels:1} as AudioBuffer,
      fileSize:STORED_AUDIO_HEADER_BYTES+recipe.frames*4,
      hasSourceFile:true,
    })));
    if(mode==='replace'){
      const replacement=selectEditableProject({...state,drumSamples:Array.from({length:24},(_,index)=>emptyPad(index))});
      if(retainedAssetBytes(replacement,[selectEditableProject(state)])>HISTORY_ASSET_BYTES) {
        return 'Replace is unavailable because the current drum assets cannot be retained for one Undo. Download a project backup or use Add.';
      }
    }
    return null;
  } catch(cause) {
    return cause instanceof Error?cause.message:'Studio Seed does not fit in this project.';
  }
}

function emptyPad(index:number):DrumSample {
  return {file:null,audioBuffer:null,name:'',isLoaded:false,inPoint:0,outPoint:0,playmode:'oneshot',reverse:false,transpose:0,pan:0,gain:0,
    hasBeenEdited:false,isAssigned:true,assignedKey:index};
}

function availablePad(samples:readonly DrumSample[],preferred:number):number|null {
  if(!samples[preferred]?.isLoaded)return preferred;
  for(let index=0;index<24;index+=1)if(!samples[index]?.isLoaded)return index;
  return null;
}

export function finalizeStudioSeedOperation(state:AppState,operation:PreparedStudioSeedOperation) {
  if(operation.expectedProjectGeneration!==(state.projectGeneration??0))throw new Error('The project changed while Studio Seed was preparing. Load it again.');
  if(operation.kit.recipeId!==STUDIO_SEED_RECIPE_ID||operation.kit.samples.length!==VOICES.length)throw new Error('Studio Seed preparation is incomplete. Load it again.');
  const seen=new Set<number>();
  for(const sample of operation.kit.samples){
    if(seen.has(sample.slot)||!STUDIO_SEED_SLOTS.includes(sample.slot))throw new Error('Studio Seed preparation has invalid destinations.');
    seen.add(sample.slot);
    if(sample.audioBuffer.length!==VOICES.find(voice=>voice.slot===sample.slot)?.frames||sample.file.type!==STORED_AUDIO_TYPE)throw new Error(`Studio Seed ${sample.name} has invalid source data.`);
  }
  const drumSamples=operation.mode==='replace'?Array.from({length:24},(_,index)=>emptyPad(index)):state.drumSamples.map(sample=>({...sample}));
  while(drumSamples.length<24)drumSamples.push(emptyPad(drumSamples.length));
  let assignedCount=0,unassignedCount=0,selectedIndex:number|null=null;
  for(const prepared of operation.kit.samples){
    const destination=availablePad(drumSamples,prepared.slot);
    const sample={...prepared.drumSample,isAssigned:destination!==null,assignedKey:destination??undefined};
    if(destination===null){drumSamples.push(sample);unassignedCount+=1;if(selectedIndex===null)selectedIndex=drumSamples.length-1;}
    else {drumSamples[destination]=sample;assignedCount+=1;if(selectedIndex===null)selectedIndex=destination;}
  }
  const drumSettings=operation.mode==='replace'?{...state.drumSettings,presetName:'Studio Seed',sampleRate:44100,bitDepth:16,channels:1,normalize:false,
    renameFiles:false,filenameSeparator:' ' as const,audioFormat:'wav' as const,presetSettings:{playmode:'poly' as const,transpose:0,velocity:20,volume:69,width:0}}:state.drumSettings;
  const candidate={...state,drumSamples,drumSettings,importedDrumPreset:operation.mode==='replace'?null:state.importedDrumPreset};
  planProjectAudioCapacity([...candidate.drumSamples,...candidate.multisampleFiles],[]);
  validateProjectArchiveMetadata(candidate);
  if(operation.mode==='replace'&&retainedAssetBytes(selectEditableProject(candidate),[selectEditableProject(state)])>HISTORY_ASSET_BYTES) {
    throw new Error('Studio Seed replacement is unavailable because the current drum assets cannot be retained for Undo. Download a project backup or use Add.');
  }
  return {drumSamples,drumSettings,importedDrumPreset:candidate.importedDrumPreset,assignedCount,unassignedCount,selectedIndex};
}
