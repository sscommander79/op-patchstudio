import {useCallback,useEffect,useRef,useState} from 'react';
import type {LibraryPreset,StoredDrumSample,StoredMultisampleFile} from '../../utils/libraryUtils';
import type {PresetSummary} from '../../utils/indexedDB';
import {decodeStoredAudio} from '../../utils/storedAudio';
import {normalizeSecondRanges} from '../../utils/loopEditing';

type PreviewSample=StoredDrumSample|StoredMultisampleFile;
interface Voice {context:AudioContext;source?:AudioBufferSourceNode;gain?:GainNode}

function firstSample(preset:LibraryPreset):PreviewSample|undefined {
  if(preset.type==='drum'){
    const samples=preset.data.drumSamples??[];
    return samples.find(sample=>sample?.audioBlob instanceof Blob&&sample.isAssigned!==false&&sample.originalIndex<24)
      ??samples.find(sample=>sample?.audioBlob instanceof Blob);
  }
  return (preset.data.multisampleFiles??[]).find(sample=>sample?.audioBlob instanceof Blob);
}

export function hasLibraryPreview(preset:LibraryPreset|PresetSummary):boolean {
  return 'hasPreview' in preset ? preset.hasPreview : Boolean(firstSample(preset));
}

/** An owned, single-sample voice. This never touches the editor's playback graph or project state. */
export function useLibraryPreview(active:boolean){
  const [previewingId,setPreviewingId]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const voiceRef=useRef<Voice|null>(null),generationRef=useRef(0),mountedRef=useRef(true);
  const stop=useCallback((announce=true)=>{
    generationRef.current++;
    const voice=voiceRef.current;voiceRef.current=null;
    if(voice){
      if(voice.source){voice.source.onended=null;try{voice.source.stop();}catch{/* already ended */}voice.source.disconnect();}
      voice.gain?.disconnect();
      void voice.context.close().catch(()=>{});
    }
    if(mountedRef.current){setPreviewingId(null);setMessage(announce?'Preview stopped.':'');}
  },[]);
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;stop(false);};},[stop]);
  useEffect(()=>{if(!active)stop(false);},[active,stop]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)stop(false);};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[stop]);
  const preview=useCallback(async(preset:LibraryPreset)=>{
    stop(false);
    const sample=firstSample(preset);
    if(!sample){setMessage(`No saved audio is available in ${preset.name}.`);return;}
    const AudioContextClass=window.AudioContext??window.webkitAudioContext;
    if(!AudioContextClass){setMessage('Web Audio is unavailable in this browser.');return;}
    const token=generationRef.current;
    let voice:Voice;
    try{voice={context:new AudioContextClass()};}catch{setMessage('Could not open audio preview.');return;}
    voiceRef.current=voice;
    setPreviewingId(preset.id);setMessage(`Preparing the first sample of ${preset.name}…`);
    try{
      if(voice.context.state!=='running')await voice.context.resume();
      if(generationRef.current!==token||voiceRef.current!==voice)return;
      const buffer=await decodeStoredAudio(sample.audioBlob,voice.context);
      if(generationRef.current!==token||voiceRef.current!==voice)return;
      const {sample:bounds}=normalizeSecondRanges(buffer.length,buffer.sampleRate,{start:sample.inPoint,end:sample.outPoint});
      const duration=Math.min(3,(bounds.end-bounds.start)/buffer.sampleRate);
      const source=voice.context.createBufferSource(),gain=voice.context.createGain();
      voice.source=source;voice.gain=gain;source.buffer=buffer;gain.gain.value=.35;
      source.connect(gain);gain.connect(voice.context.destination);
      source.onended=()=>{if(voiceRef.current===voice){stop(false);if(mountedRef.current)setMessage(`Preview finished: ${preset.name}.`);}};
      source.start(0,bounds.start/buffer.sampleRate,duration);
      setMessage(`Playing the first raw saved sample of ${preset.name} for up to 3 seconds at a reduced level. This does not render the full instrument.`);
    }catch{
      if(voiceRef.current===voice){stop(false);if(mountedRef.current)setMessage(`Could not preview the saved audio in ${preset.name}.`);}
    }
  },[stop]);
  return {previewingId,message,preview,stop};
}
