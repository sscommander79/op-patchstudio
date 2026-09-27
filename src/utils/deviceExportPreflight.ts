import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';
import { normalizeSecondRanges } from './loopEditing';
import { planAudioConversion } from './exportPlanning';

export interface DeviceExportPreflight {
  name:string;mappedCount:number;unassignedCount:number;includedCount:number;omittedCount:number;
  estimatedBytes:number;sizeBasis:string;formatSummary:string;errors:string[];warnings:string[];
}

const rateLabel=(rate:number)=>rate>0?`${Number((rate/1000).toFixed(3))} kHz`:'decoded rate per sample';
const channelLabel=(channels:number)=>channels===1?'mono':channels===2?'stereo':'decoded channels per sample';

function effectiveFormat(sample:(DrumSample|MultisampleFile)&{audioBuffer:AudioBuffer;file:File},state:AppState,instrument:'drum'|'multisample') {
  const settings=instrument==='drum'?state.drumSettings:state.multisampleSettings;
  const targetRate=settings.sampleRate||0,targetDepth=settings.bitDepth||0,targetChannels=settings.channels||0;
  const cutAtLoopEnd=instrument==='multisample'&&state.multisampleSettings.cutAtLoopEnd;
  const ranges=normalizeSecondRanges(sample.audioBuffer.length,sample.audioBuffer.sampleRate,{start:sample.inPoint,end:sample.outPoint},'loopStart' in sample?{start:sample.loopStart,end:sample.loopEnd}:undefined);
  const plan=planAudioConversion({sourceBuffer:sample.audioBuffer,originalSampleRate:sample.originalSampleRate,originalBitDepth:sample.originalBitDepth,targetSampleRate:targetRate,targetBitDepth:targetDepth,targetChannels:targetChannels===1?'mono':'keep',normalize:settings.normalize,cutAtLoopEnd,loopEndFrame:ranges.loop.end});
  return {rate:plan.sampleRate,channels:plan.channels,frames:plan.outputFrames,depth:plan.bitDepth,needsConversion:plan.needsConversion};
}

function describeValues(values:number[],fallback:string,label:(value:number)=>string) {
  const unique=[...new Set(values)];
  if(!unique.length)return fallback;
  if(unique.length===1)return label(unique[0]);
  return `${unique.map(label).join(' / ')} per sample`;
}

function validSample(sample:DrumSample|MultisampleFile):sample is (DrumSample|MultisampleFile)&{audioBuffer:AudioBuffer;file:File} {
  return Boolean(sample.file&&sample.audioBuffer&&sample.audioBuffer.length>0&&sample.audioBuffer.numberOfChannels>0&&Number.isFinite(sample.audioBuffer.sampleRate));
}

export function isMappedDrumSample(sample: DrumSample, index: number): boolean {
  return (sample.isAssigned && typeof sample.assignedKey === 'number' && sample.assignedKey >= 0 && sample.assignedKey < 24)
    || (index < 24 && sample.isAssigned !== false);
}

export function buildDeviceExportPreflight(state:AppState,instrument:'drum'|'multisample',includeUnassigned=false):DeviceExportPreflight {
  const settings=instrument==='drum'?state.drumSettings:state.multisampleSettings;
  const name=settings.presetName.trim(),errors:string[]=[],warnings:string[]=[];
  const indexed=instrument==='drum'?state.drumSamples.map((sample,index)=>({sample,index})).filter(item=>item.sample?.isLoaded):state.multisampleFiles.map((sample,index)=>({sample,index})).filter(item=>item.sample?.isLoaded);
  const loaded=indexed.map(item=>item.sample);
  const mapped=instrument==='drum'?indexed.filter(({sample,index})=>isMappedDrumSample(sample as DrumSample,index)).map(item=>item.sample):loaded;
  const unassigned=instrument==='drum'?loaded.filter(sample=>!mapped.includes(sample)):[];
  const included=instrument==='drum'&&includeUnassigned?[...mapped,...unassigned]:mapped;
  if(!name)errors.push('Enter an instrument name before exporting.');
  if(mapped.length===0)errors.push(instrument==='drum'?'Assign at least one sample to a playable pad before exporting.':'Add at least one mapped sample zone before exporting.');
  for(const sample of loaded)if(!validSample(sample))errors.push(`${sample.name||'Unnamed sample'} has missing or invalid audio data.`);
  for(const sample of included){
    if(!validSample(sample))continue;
    const ranges=normalizeSecondRanges(sample.audioBuffer.length,sample.audioBuffer.sampleRate,{start:sample.inPoint,end:sample.outPoint},'loopStart' in sample?{start:sample.loopStart,end:sample.loopEnd}:undefined);
    const playableSeconds=(ranges.sample.end-ranges.sample.start)/sample.audioBuffer.sampleRate;
    if(playableSeconds>20)warnings.push(`${sample.name||sample.file.name} has ${playableSeconds.toFixed(1)} playable seconds. OP-XY documentation lists a limit of 20 seconds; trim or slice it before transfer.`);
  }
  if(unassigned.length&&!includeUnassigned)warnings.push(`${unassigned.length} retained unassigned ${unassigned.length===1?'sample is':'samples are'} omitted from this device preset. Project backups still retain all audio.`);
  const targetRate=settings.sampleRate||0,targetDepth=settings.bitDepth||0,targetChannels=settings.channels||0;
  const unknownDepth=included.filter(sample=>validSample(sample)&&sample.originalBitDepth===undefined).length;
  if(!targetDepth&&unknownDepth)warnings.push(`${unknownDepth} included ${unknownDepth===1?'sample has':'samples have'} unknown source bit depth and will use the 16-bit export fallback.`);
  const fallbackRate=included.filter(sample=>validSample(sample)&&!targetRate&&effectiveFormat(sample,state,instrument).needsConversion&&sample.originalSampleRate===undefined).length;
  if(fallbackRate)warnings.push(`${fallbackRate} included ${fallbackRate===1?'sample has':'samples have'} unknown source sample rate and will use the decoded-rate export fallback.`);
  const formats=included.filter(validSample).map(sample=>effectiveFormat(sample,state,instrument));
  const estimatedBytes=included.reduce((total,sample)=>{
    if(!validSample(sample))return total;
    const format=effectiveFormat(sample,state,instrument);
    const bytesPerSample=Math.ceil(format.depth/8);
    return total+44+format.frames*format.channels*bytesPerSample;
  },0);
  const sizeBasis=instrument==='multisample'&&state.multisampleSettings.cutAtLoopEnd
    ? 'Estimated from audio cut at each loop end. Playable duration uses the selected trim range.'
    : 'Estimated from each complete exported audio file. Playable duration uses the selected trim range.';
  return {name,mappedCount:mapped.length,unassignedCount:unassigned.length,includedCount:included.length,omittedCount:includeUnassigned?0:unassigned.length,
    estimatedBytes,sizeBasis,formatSummary:`${settings.audioFormat.toUpperCase()} · ${describeValues(formats.map(format=>format.rate),rateLabel(targetRate),rateLabel)} · ${targetDepth?`${targetDepth}-bit`:'source depth where known; 16-bit fallback'} · ${describeValues(formats.map(format=>format.channels),channelLabel(targetChannels),channelLabel)}`,errors,warnings};
}
