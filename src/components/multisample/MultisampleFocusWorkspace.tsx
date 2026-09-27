import { useEffect, useRef, useState } from 'react';
import { useAppContext, type MultisampleFile } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { SmallWaveform } from '../common/SmallWaveform';
import { WaveformZoomModal } from '../common/WaveformZoomModal';
import { framesToSeconds, normalizeSecondRanges } from '../../utils/loopEditing';
import { suggestSampleMarkers, type SampleSuggestions } from '../../utils/sampleSuggestions';

interface Props {
  selectedIndex:number;
  onSelect:(index:number)=>void;
  onBrowse:()=>void;
  onReplace:(index:number,file:File)=>void;
  onClear:(index:number)=>void;
  onRecord:(index:number)=>void;
}

export function MultisampleFocusWorkspace({selectedIndex,onSelect,onBrowse,onReplace,onClear,onRecord}:Props){
  const {state,dispatch}=useAppContext();
  const {playWithADSR,releaseNote}=useAudioPlayer();
  const input=useRef<HTMLInputElement>(null);
  const playingNote=useRef<string|null>(null);
  const previewAbort=useRef<AbortController|null>(null);
  const sample=state.multisampleFiles[selectedIndex];
  const [draft,setDraft]=useState({inPoint:0,outPoint:0,loopStart:0,loopEnd:0,rootNote:60});
  const [validationError,setValidationError]=useState<string|null>(null);
  const [isPreviewing,setIsPreviewing]=useState(false);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [suggestion,setSuggestion]=useState<SampleSuggestions|null>(null);
  useEffect(()=>{setDraft({inPoint:sample?.inPoint??0,outPoint:sample?.outPoint??0,loopStart:sample?.loopStart??0,loopEnd:sample?.loopEnd??0,rootNote:sample?.rootNote??60});setValidationError(null);setSuggestion(null);},[sample]);
  useEffect(()=>{previewAbort.current?.abort();previewAbort.current=null;if(playingNote.current)releaseNote(playingNote.current,true);playingNote.current=null;setIsPreviewing(false);
    return()=>{previewAbort.current?.abort();previewAbort.current=null;if(playingNote.current)releaseNote(playingNote.current,true);playingNote.current=null;};
  },[sample?.file,sample?.audioBuffer,releaseNote]);
  const update=(updates:Partial<MultisampleFile>)=>dispatch({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:selectedIndex,updates}});
  const restoreDraft=()=>sample&&setDraft({inPoint:sample.inPoint,outPoint:sample.outPoint,loopStart:sample.loopStart,loopEnd:sample.loopEnd,rootNote:sample.rootNote});
  const commitDraft=(key:keyof typeof draft)=>{if(!sample?.audioBuffer)return;
    if(key==='rootNote'){if(!Number.isInteger(draft.rootNote)||draft.rootNote<0||draft.rootNote>127){restoreDraft();setValidationError('Root note must be a whole MIDI value from 0 to 127.');return;}setValidationError(null);update({rootNote:draft.rootNote});return;}
    const markerValues=[draft.inPoint,draft.outPoint,draft.loopStart,draft.loopEnd];
    if(markerValues.some(value=>!Number.isFinite(value)||value<0||value>sample.audioBuffer!.duration)){restoreDraft();setValidationError('Sample and loop points must be within the selected audio.');return;}
    const normalized=normalizeSecondRanges(sample.audioBuffer.length,sample.audioBuffer.sampleRate,{start:draft.inPoint,end:draft.outPoint},{start:draft.loopStart,end:draft.loopEnd});
    const updates={inPoint:framesToSeconds(normalized.sample.start,sample.audioBuffer.sampleRate),outPoint:framesToSeconds(normalized.sample.end,sample.audioBuffer.sampleRate),loopStart:framesToSeconds(normalized.loop.start,sample.audioBuffer.sampleRate),loopEnd:framesToSeconds(normalized.loop.end,sample.audioBuffer.sampleRate)};
    setDraft(current=>({...current,...updates}));setValidationError(null);update(updates);
  };
  const stopPreview=()=>{previewAbort.current?.abort();previewAbort.current=null;if(playingNote.current)releaseNote(playingNote.current,true);playingNote.current=null;setIsPreviewing(false);};
  const suggestedBounds=(kind:'trim'|'loop')=>{if(!sample?.audioBuffer||!suggestion)return null;const rate=sample.audioBuffer.sampleRate,frames=sample.audioBuffer.length;return normalizeSecondRanges(frames,rate,{start:kind==='trim'&&suggestion.trim?framesToSeconds(suggestion.trim.start,rate):sample.inPoint,end:kind==='trim'&&suggestion.trim?framesToSeconds(suggestion.trim.end,rate):sample.outPoint},{start:kind==='loop'&&suggestion.loop?framesToSeconds(suggestion.loop.start,rate):sample.loopStart,end:kind==='loop'&&suggestion.loop?framesToSeconds(suggestion.loop.end,rate):sample.loopEnd});};
  const playPreview=async(kind?:'trim'|'loop')=>{if(!sample.audioBuffer)return;stopPreview();const noteId=`multisample-focus-${crypto.randomUUID()}`,controller=new AbortController();previewAbort.current=controller;playingNote.current=noteId;setIsPreviewing(true);
    const proposed=kind?suggestedBounds(kind):null,previewLoop=kind==='loop'&&Boolean(suggestion?.loop);
    const result=await playWithADSR(sample.audioBuffer,noteId,{playbackRate:1,gain:state.multisampleSettings.gain,pan:0,adsr:state.multisampleSettings.ampEnvelope,playMode:state.multisampleSettings.playmode,velocity:127,
      loopEnabled:previewLoop||state.multisampleSettings.loopEnabled,loopOnRelease:state.multisampleSettings.loopOnRelease,loopStart:proposed?framesToSeconds(proposed.loop.start,sample.audioBuffer.sampleRate):sample.loopStart,loopEnd:proposed?framesToSeconds(proposed.loop.end,sample.audioBuffer.sampleRate):sample.loopEnd,inFrame:proposed?.sample.start??Math.round(sample.inPoint*sample.audioBuffer.sampleRate),outFrame:proposed?.sample.end??Math.round(sample.outPoint*sample.audioBuffer.sampleRate),
      signal:controller.signal,onEnded:()=>{if(playingNote.current===noteId){previewAbort.current=null;playingNote.current=null;setIsPreviewing(false);}}});
    if(result===null&&!controller.signal.aborted&&playingNote.current===noteId){previewAbort.current=null;playingNote.current=null;setIsPreviewing(false);}
  };
  const analyze=()=>{if(!sample.audioBuffer)return;stopPreview();setSuggestion(suggestSampleMarkers(sample.audioBuffer,{start:Math.round(sample.inPoint*sample.audioBuffer.sampleRate),end:Math.round(sample.outPoint*sample.audioBuffer.sampleRate)}));};
  const applySuggestion=(kind:'trim'|'loop')=>{if(!sample.audioBuffer||!suggestion)return;const proposed=suggestedBounds(kind);if(!proposed)return;stopPreview();const rate=sample.audioBuffer.sampleRate;update(kind==='trim'?{inPoint:framesToSeconds(proposed.sample.start,rate),outPoint:framesToSeconds(proposed.sample.end,rate),loopStart:framesToSeconds(proposed.loop.start,rate),loopEnd:framesToSeconds(proposed.loop.end,rate)}:{loopStart:framesToSeconds(proposed.loop.start,rate),loopEnd:framesToSeconds(proposed.loop.end,rate)});setSuggestion(null);};
  if(!sample)return <section className="studio-focus" aria-label="Focused multisample editor"><div className="studio-empty-pad"><h3>Add multisample zones</h3><p>Load one or more sounds, then set root notes, sample bounds, loop points, envelopes, and engine settings.</p><button type="button" className="studio-button-primary" onClick={onBrowse}>Add samples</button></div></section>;
  return <section className="studio-focus" aria-label="Focused multisample editor">
    <div className="studio-focus-heading"><div><p className="studio-eyebrow">SELECTED ZONE</p><h3>{sample.name}</h3></div><label>Zone<select aria-label="Selected multisample zone" value={selectedIndex} onChange={event=>onSelect(Number(event.target.value))}>{state.multisampleFiles.map((item,index)=><option key={`${item.name}-${index}`} value={index}>{item.name} · root {item.rootNote}</option>)}</select></label></div>
    <div className="studio-focus-main">
    {sample.audioBuffer&&<SmallWaveform audioBuffer={sample.audioBuffer} height={116} inPoint={Math.round(sample.inPoint*sample.audioBuffer.sampleRate)} outPoint={Math.round(sample.outPoint*sample.audioBuffer.sampleRate)} loopStart={Math.round(sample.loopStart*sample.audioBuffer.sampleRate)} loopEnd={Math.round(sample.loopEnd*sample.audioBuffer.sampleRate)} onZoomEdit={()=>setZoomOpen(true)}/>}
    <div className="studio-sample-controls">
      {(['rootNote','inPoint','outPoint','loopStart','loopEnd'] as const).map(key=><label key={key}>{key==='rootNote'?'Root note':key.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())}{key!=='rootNote'&&' (seconds)'}<input type="number" min={0} max={key==='rootNote'?127:sample.audioBuffer?.duration} step={key==='rootNote'?1:.00001} value={draft[key]} onChange={event=>setDraft(current=>({...current,[key]:Number(event.target.value)}))} onBlur={()=>commitDraft(key)}/></label>)}
    </div>
    </div>
    {validationError&&<p className="studio-message studio-message-error" role="alert">{validationError}</p>}
    <section aria-label="Marker suggestions" className="studio-suggestion-panel"><h4>Trim and sustain suggestions</h4><p>Analyze the selected sound without changing its audio. Trim uses one padded cut for every channel; a loop is suggested only when the middle sustain has a low-discontinuity seam. Quiet releases may still need manual review. Listen before applying.</p><button type="button" className="studio-button-secondary" onClick={analyze} disabled={!sample.audioBuffer}>Analyze sound</button>{suggestion&&<div role="status"><p>{suggestion.trim?`Trim: ${framesToSeconds(suggestion.trim.start,sample.audioBuffer!.sampleRate).toFixed(3)}–${framesToSeconds(suggestion.trim.end,sample.audioBuffer!.sampleRate).toFixed(3)} s.`:'No safe trim suggested.'} {suggestion.loop?`Loop: ${framesToSeconds(suggestion.loop.start,sample.audioBuffer!.sampleRate).toFixed(3)}–${framesToSeconds(suggestion.loop.end,sample.audioBuffer!.sampleRate).toFixed(3)} s.`:suggestion.reason}</p>{suggestion.trim&&<><button type="button" className="studio-button-secondary" onClick={()=>void playPreview('trim')} disabled={isPreviewing}>Preview trim</button><button type="button" className="studio-button-primary" onClick={()=>applySuggestion('trim')}>Apply trim</button></>}{suggestion.loop&&<><button type="button" className="studio-button-secondary" onClick={()=>void playPreview('loop')} disabled={isPreviewing}>Preview loop</button><button type="button" className="studio-button-primary" onClick={()=>applySuggestion('loop')}>Apply loop</button></>}<button type="button" className="studio-button-secondary" onClick={()=>setSuggestion(null)}>Discard suggestion</button><p>Apply changes markers only. The original audio remains intact; use project Undo to restore the previous markers. Enable loop playback in instrument settings after applying a loop.</p></div>}</section>
    <p>Amplitude and filter envelopes, loop behavior, tuning root, zone engine, gain, and portamento remain in the instrument settings below.</p>
    <input ref={input} type="file" hidden accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.ogg,.flac" aria-label="Choose replacement multisample" onChange={event=>{const file=event.target.files?.[0];if(file)onReplace(selectedIndex,file);event.target.value='';}}/>
    <div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={isPreviewing?stopPreview:()=>void playPreview()}>{isPreviewing?'Stop preview':'Play selected'}</button><button type="button" className="studio-button-secondary" onClick={()=>input.current?.click()}>Replace zone</button><button type="button" className="studio-button-secondary" onClick={()=>onRecord(selectedIndex)}>Record at root</button><button type="button" className="studio-button-secondary" onClick={()=>onClear(selectedIndex)}>Clear zone</button></div>
    <WaveformZoomModal isOpen={zoomOpen} onClose={()=>setZoomOpen(false)} audioBuffer={sample.audioBuffer} initialInPoint={sample.inPoint} initialOutPoint={sample.outPoint} initialLoopStart={sample.loopStart} initialLoopEnd={sample.loopEnd} initialCrossfade={sample.loopCrossfade} loopEnabled={state.multisampleSettings.loopEnabled} loopOnRelease={state.multisampleSettings.loopOnRelease} gain={state.multisampleSettings.gain} ampEnvelope={state.multisampleSettings.ampEnvelope} onSave={(inPoint,outPoint,loopStart,loopEnd,loopCrossfade)=>{update({inPoint,outPoint,loopStart:loopStart??sample.loopStart,loopEnd:loopEnd??sample.loopEnd,loopCrossfade});setZoomOpen(false);}} onSaveForAll={updates=>dispatch({type:'UPDATE_ALL_MULTI_SAMPLES',payload:updates})}/>
  </section>;
}
