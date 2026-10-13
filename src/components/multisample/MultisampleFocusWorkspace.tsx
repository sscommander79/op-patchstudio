import { LOOPING_EXPLANATION, recordedNoteName, sampleFields, sampleFieldError, type SampleHelpTopic } from './multisampleHelp';
import { useEffect, useRef, useState } from 'react';
import { useAppContext, type MultisampleFile } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { SmallWaveform } from '../common/SmallWaveform';
import { WaveformZoomModal } from '../common/WaveformZoomModal';
import { framesToSeconds, normalizeSecondRanges } from '../../utils/loopEditing';
import { suggestSampleMarkers, type SampleSuggestions } from '../../utils/sampleSuggestions';

interface Props {
  onHelpTopic?:(topic:SampleHelpTopic)=>void;
  selectedIndex:number;
  onSelect:(index:number)=>void;
  onBrowse:()=>void;
  onReplace:(index:number,file:File)=>void;
  onClear:(index:number)=>void;
  onRecord:(index:number)=>void;
  /**
   * Offered only while looping is off. The owner must store these loop points on the sample at `index`
   * and turn instrument-wide looping on, ideally as one undoable edit. Without it, Apply loop stores points only.
   */
  onApplyLoopAndEnableLooping?:(index:number,loop:Pick<MultisampleFile,'loopStart'|'loopEnd'>)=>void;
}

export function MultisampleFocusWorkspace({selectedIndex,onSelect,onBrowse,onReplace,onClear,onRecord,onHelpTopic,onApplyLoopAndEnableLooping}:Props){
  const {state,dispatch}=useAppContext();
  const {playWithADSR,releaseNote}=useAudioPlayer();
  const input=useRef<HTMLInputElement>(null);
  const playingNote=useRef<string|null>(null);
  const previewAbort=useRef<AbortController|null>(null);
  const sample=state.multisampleFiles[selectedIndex];
  const [draft,setDraft]=useState({inPoint:0,outPoint:0,loopStart:0,loopEnd:0,rootNote:60});
  const [changingAssignment,setChangingAssignment]=useState(false);
  const [validationError,setValidationError]=useState<string|null>(null);
  const [isPreviewing,setIsPreviewing]=useState(false);
  const [editingMarker,setEditingMarker]=useState<string|null>(null);
  const markerChanged=useRef(false);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [suggestion,setSuggestion]=useState<SampleSuggestions|null>(null);
  useEffect(()=>{setDraft({inPoint:sample?.inPoint??0,outPoint:sample?.outPoint??0,loopStart:sample?.loopStart??0,loopEnd:sample?.loopEnd??0,rootNote:sample?.rootNote??60});setValidationError(null);setSuggestion(null);},[sample]);
  useEffect(()=>{previewAbort.current?.abort();previewAbort.current=null;if(playingNote.current)releaseNote(playingNote.current,true);playingNote.current=null;setIsPreviewing(false);
    return()=>{previewAbort.current?.abort();previewAbort.current=null;if(playingNote.current)releaseNote(playingNote.current,true);playingNote.current=null;};
  },[sample?.file,sample?.audioBuffer,releaseNote]);
  useEffect(()=>setChangingAssignment(false),[sample?.file,sample?.rootNote]);
  const update=(updates:Partial<MultisampleFile>)=>dispatch({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:selectedIndex,updates}});
  const restoreDraft=()=>sample&&setDraft({inPoint:sample.inPoint,outPoint:sample.outPoint,loopStart:sample.loopStart,loopEnd:sample.loopEnd,rootNote:sample.rootNote});
  const commitDraft=(key:keyof typeof draft)=>{if(!sample?.audioBuffer)return;
    const problem=sampleFieldError(key,draft,sample.audioBuffer.duration);
    if(problem){restoreDraft();setValidationError(problem+' Previous value restored.');return;}
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
  // Looping is instrument-wide, so it is only switched on from an action that says so.
  const applyLoopAndEnableLooping=()=>{if(!sample.audioBuffer||!suggestion?.loop||!onApplyLoopAndEnableLooping)return;const proposed=suggestedBounds('loop');if(!proposed)return;stopPreview();const rate=sample.audioBuffer.sampleRate;onApplyLoopAndEnableLooping(selectedIndex,{loopStart:framesToSeconds(proposed.loop.start,rate),loopEnd:framesToSeconds(proposed.loop.end,rate)});setSuggestion(null);};
  const loopEnabled=state.multisampleSettings.loopEnabled;
  if(!sample)return <section className="studio-focus studio-multisample-editor" aria-label="Focused multisample editor"><div className="studio-empty-pad"><h3>Add samples to your instrument</h3><p>Load or record a sound, then follow the guide beneath the keyboard.</p><button type="button" className="studio-button-primary" onClick={onBrowse}>Add samples</button></div></section>;
  return <section className="studio-focus studio-multisample-editor" aria-label="Focused multisample editor">
    <div className="studio-focus-heading"><div><p className="studio-eyebrow">SELECTED SAMPLE</p><h3>{sample.name}</h3></div><label>Sample<select aria-label="Selected multisample zone" value={selectedIndex} onChange={event=>onSelect(Number(event.target.value))}>{state.multisampleFiles.map((item,index)=><option key={`${item.name}-${index}`} value={index}>{item.name} · assigned to {recordedNoteName(item.rootNote,state.midiNoteMapping)}</option>)}</select></label></div>
    <div className="studio-focus-main studio-multisample-focus-main">
    {sample.audioBuffer&&<SmallWaveform darkSurface audioBuffer={sample.audioBuffer} height={116} inPoint={Math.round(sample.inPoint*sample.audioBuffer.sampleRate)} outPoint={Math.round(sample.outPoint*sample.audioBuffer.sampleRate)} loopStart={Math.round(sample.loopStart*sample.audioBuffer.sampleRate)} loopEnd={Math.round(sample.loopEnd*sample.audioBuffer.sampleRate)} onZoomEdit={()=>setZoomOpen(true)}/>}
    <div className="studio-sample-controls">
      <fieldset className="studio-marker-group studio-key-assignment"><legend>Key assignment</legend><div className="studio-assignment-line">
        <p>Assigned to {recordedNoteName(sample.rootNote,state.midiNoteMapping)}</p>
        {changingAssignment?<><label>Assign to key <select aria-label="Assign to key" autoFocus value={sample.rootNote} onChange={event=>{
          const rootNote=Number(event.target.value);if(!Number.isInteger(rootNote)||rootNote<0||rootNote>127)return;
          if(state.multisampleFiles.some((item,index)=>index!==selectedIndex&&item.rootNote===rootNote)){setValidationError('This key is already assigned to another sample. Choose a different key.');return;}
          stopPreview();setValidationError(null);update({rootNote,note:recordedNoteName(rootNote,state.midiNoteMapping)});setChangingAssignment(false);
        }}>{Array.from({length:128},(_,note)=><option key={note} value={note}>{recordedNoteName(note,state.midiNoteMapping)}</option>)}</select></label><button type="button" className="studio-button-secondary" onClick={()=>{setChangingAssignment(false);setValidationError(null);}}>Cancel</button></>:<button type="button" className="studio-button-secondary" onClick={()=>setChangingAssignment(true)}>Change assignment</button>}
        </div><small>This assigns a key; it does not change the recording’s pitch.</small>
      </fieldset>
      {([['inPoint','outPoint'],['loopStart','loopEnd']] as SampleHelpTopic[][]).map((group,index)=><fieldset className="studio-marker-group studio-time-group" key={index}><legend>{['Playback section','Looping'][index]}{index===1&&<label className="studio-loop-toggle"><input type="checkbox" role="switch" aria-label="Looping" checked={loopEnabled} onChange={event=>{stopPreview();dispatch({type:'SET_MULTISAMPLE_LOOP_ENABLED',payload:event.target.checked});}}/><span aria-hidden="true">{loopEnabled?'On':'Off'}</span></label>}</legend>
        {index===1&&<small className="studio-loop-description">{loopEnabled?'Repeats between the points below. Applies to every sample.':'Off — each sound plays without repeating. Your loop points are kept.'}</small>}
        {(index===0||loopEnabled)&&group.map(key=>{
        const error=sampleFieldError(key,draft,sample.audioBuffer?.duration??0);
        const inactive=key.startsWith('loop')&&!loopEnabled;
        const status=inactive?'inactive':error?'error':'valid';
        const label=sampleFields[key].label+' (seconds)';
        return <div key={key} className={`studio-field-check studio-field-check--${status}`}>
          <label htmlFor={`sample-${key}`}>{key.endsWith('Start')||key==='inPoint'?'Start':'End'} <span>seconds</span></label>
          <input id={`sample-${key}`} aria-label={label} aria-describedby={error?`sample-${key}-status`:undefined} aria-invalid={status==='error'} type="number" min={0} max={sample.audioBuffer?.duration} step={.00001} value={Number.isNaN(draft[key])?'':editingMarker===key?draft[key]:Number(draft[key].toFixed(3))} onFocus={()=>{setEditingMarker(key);markerChanged.current=false;onHelpTopic?.(key);}} onChange={event=>{markerChanged.current=true;setValidationError(null);setDraft(current=>({...current,[key]:event.target.value===''?NaN:Number(event.target.value)}));}} onBlur={()=>{setEditingMarker(null);if(markerChanged.current)commitDraft(key);markerChanged.current=false;}}/>
          <small id={`sample-${key}-status`} className="studio-field-status">{error?`Needs fixing · ${error}`:null}</small>
        </div>;
      })}<details className="studio-marker-help"><summary>{index===0?'About playback points':'About looping'}</summary>{group.map(key=><p key={key}><strong>{sampleFields[key].label}.</strong> {sampleFields[key].tip}</p>)}</details></fieldset>)}
    </div>
    </div>
    {validationError&&<p className="studio-message studio-message-error" role="alert">{validationError}</p>}
    <section aria-label="Marker suggestions" className="studio-suggestion-panel"><h4>Suggest playback and loop points</h4><p>Find a starting point automatically, then listen before applying.</p><button type="button" className="studio-button-secondary" onClick={analyze} disabled={!sample.audioBuffer}>Analyze sound</button>{suggestion&&<div role="status"><p>{suggestion.trim?`Trim: ${framesToSeconds(suggestion.trim.start,sample.audioBuffer!.sampleRate).toFixed(3)}–${framesToSeconds(suggestion.trim.end,sample.audioBuffer!.sampleRate).toFixed(3)} s.`:'No safe trim suggested.'} {suggestion.loop?`Loop: ${framesToSeconds(suggestion.loop.start,sample.audioBuffer!.sampleRate).toFixed(3)}–${framesToSeconds(suggestion.loop.end,sample.audioBuffer!.sampleRate).toFixed(3)} s.`:suggestion.reason}</p>{suggestion.trim&&<><button type="button" className="studio-button-secondary" onClick={()=>void playPreview('trim')} disabled={isPreviewing}>Preview trim</button><button type="button" className="studio-button-primary" onClick={()=>applySuggestion('trim')}>Apply trim</button></>}{suggestion.loop&&<><button type="button" className="studio-button-secondary" onClick={()=>void playPreview('loop')} disabled={isPreviewing}>Preview loop</button><button type="button" className="studio-button-primary" onClick={()=>applySuggestion('loop')}>Apply loop</button>{!loopEnabled&&onApplyLoopAndEnableLooping&&<button type="button" className="studio-button-secondary" onClick={applyLoopAndEnableLooping}>Apply loop and turn looping on</button>}</>}<button type="button" className="studio-button-secondary" onClick={()=>setSuggestion(null)}>Discard suggestion</button><p>Apply changes markers only. The original audio remains intact; use project Undo to restore the previous markers.</p>{suggestion.loop&&<p>{loopEnabled?'Looping is on for this instrument, so an applied loop is heard while a note is held.':onApplyLoopAndEnableLooping?'Looping is off for this instrument. “Apply loop” only stores the loop points. “Apply loop and turn looping on” also switches looping on for the whole instrument, so every recording repeats between its own loop points.':'Looping is off for this instrument. “Apply loop” only stores the loop points; use the Looping switch beside the loop points to hear them.'} {LOOPING_EXPLANATION}</p>}</div>}</section>

    <input ref={input} type="file" hidden accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.ogg,.flac" aria-label="Choose replacement multisample" onChange={event=>{const file=event.target.files?.[0];if(file)onReplace(selectedIndex,file);event.target.value='';}}/>
    <div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={isPreviewing?stopPreview:()=>void playPreview()}>{isPreviewing?'Stop preview':'Play selected'}</button>{sample.audioBuffer&&<button type="button" className="studio-button-secondary" onClick={()=>setZoomOpen(true)}>Edit section</button>}<button type="button" className="studio-button-secondary" onClick={()=>input.current?.click()}>Replace sample</button><button type="button" className="studio-button-secondary" onClick={()=>onRecord(selectedIndex)}>Record at assigned key</button><button type="button" className="studio-button-secondary" onClick={()=>onClear(selectedIndex)}>Remove sample</button></div>
    <WaveformZoomModal isOpen={zoomOpen} onClose={()=>setZoomOpen(false)} audioBuffer={sample.audioBuffer} initialInPoint={sample.inPoint} initialOutPoint={sample.outPoint} initialLoopStart={sample.loopStart} initialLoopEnd={sample.loopEnd} initialCrossfade={sample.loopCrossfade} loopEnabled={state.multisampleSettings.loopEnabled} loopOnRelease={state.multisampleSettings.loopOnRelease} gain={state.multisampleSettings.gain} ampEnvelope={state.multisampleSettings.ampEnvelope} onSave={(inPoint,outPoint,loopStart,loopEnd,loopCrossfade)=>{update({inPoint,outPoint,loopStart:loopStart??sample.loopStart,loopEnd:loopEnd??sample.loopEnd,loopCrossfade});setZoomOpen(false);}} onSaveForAll={updates=>dispatch({type:'UPDATE_ALL_MULTI_SAMPLES',payload:updates})} saveForAllCount={state.multisampleFiles.filter(item=>item.isLoaded&&item.audioBuffer).length} saveForAllScope="loaded multisample recordings"/>
  </section>;
}
