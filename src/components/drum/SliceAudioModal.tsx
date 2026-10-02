import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, DrumSample } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { readAudioMetadataFromArrayBuffer } from '../../utils/audioFormats';
import { audioContextManager } from '../../utils/audioContext';
import { SLICE_LIMITS, analyzeSlices, inspectSliceSource, planSliceApplication, prepareSliceApplication, type PreparedSliceApplication, type ProjectAudioAsset, type SliceSource } from '../../utils/audioSlicing';
import { previewFrameAtTime, type FrameRange } from '../../utils/loopEditing';
import { shouldIgnoreKeyboardKeyDown } from '../../utils/keyboardOwnership';
import { useStudioCanvasColors } from '../../hooks/useStudioCanvasTheme';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';
import { SliceKeyboardMapping, SLICE_DRAG_TYPE, SLICE_PAD_GROUPS } from './SliceKeyboardMapping';

const PLAYBACK_FAILURE = 'Could not play this sound. Check audio output and try again.';

export type SliceSourceRequest = { kind:'existing'; source:SliceSource } | { kind:'file'; file:File };

interface Props {
  isOpen:boolean; onClose:()=>void; request:SliceSourceRequest|null; existingSamples:readonly DrumSample[];
  projectAssets:readonly ProjectAudioAsset[]; midiNoteMapping:'C3'|'C4'; commitResult:AppState['sliceCommitResult'];
  onApply:(operationId:string,prepared:PreparedSliceApplication)=>void; analyzeAudio?:typeof analyzeSlices; prepareApplication?:typeof prepareSliceApplication;
}

interface SoundRange extends FrameRange {id:string}
type ConfirmAction='analyze'|'reset';

const colors={bg:'var(--color-bg-primary)',alt:'var(--color-bg-secondary)',border:'var(--color-border-medium)',text:'var(--color-text-primary)',action:'var(--color-interactive-focus)'};
const buttonStyle={minHeight:'44px',padding:'.55rem .85rem',border:`1px solid ${colors.border}`,borderRadius:'4px',font:'inherit',cursor:'pointer'} as const;
const inputStyle={boxSizing:'border-box',width:'9rem',maxWidth:'100%',minHeight:'40px'} as const;

export function SliceAudioModal({isOpen,onClose,request,existingSamples,projectAssets,midiNoteMapping,commitResult,onApply,analyzeAudio=analyzeSlices,prepareApplication=prepareSliceApplication}:Props) {
  const modalRef=useRef<HTMLDivElement>(null),overviewRef=useRef<HTMLCanvasElement>(null),selectedCanvasRef=useRef<HTMLCanvasElement>(null);
  const canvasColors=useStudioCanvasColors(),abortRef=useRef<AbortController|null>(null),generationRef=useRef(0),editGenerationRef=useRef(0),rangeSequenceRef=useRef(0);
  const noteRef=useRef<string|null>(null),playRequestRef=useRef(0),clockRef=useRef<{startedAt:number;startFrame:number;sample:FrameRange;loop:FrameRange;loopEnabled:boolean;sampleRate:number;playbackRate:number;reverse:boolean}|null>(null);
  const sourceRef=useRef<SliceSource|null>(null),rangesRef=useRef<SoundRange[]>([]),transportRef=useRef<'stopped'|'playing'>('stopped'),busyRef=useRef(false),openRef=useRef(isOpen),pendingCommitRef=useRef<string|null>(null);
  const dragRef=useRef<{edge:'start'|'end';pointerId:number;before:SoundRange;zoom:FrameRange}|null>(null);
  const {playWithADSR,releaseNote}=useAudioPlayer();
  const [source,setSourceState]=useState<SliceSource|null>(null),[ranges,setRangesState]=useState<SoundRange[]>([]),[selectedId,setSelectedIdState]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,{text:string;initialText:string;frame:number}>>({}),[advanced,setAdvanced]=useState(false),[sensitivity,setSensitivity]=useState(.5),[spacingMs,setSpacingMs]=useState(20);
  const [transport,setTransportState]=useState<'stopped'|'playing'>('stopped'),[busy,setBusy]=useState(''),[progress,setProgress]=useState(0),[error,setError]=useState('');
  const [edited,setEdited]=useState(false),[confirmAction,setConfirmAction]=useState<ConfirmAction|null>(null),[overflowAccepted,setOverflowAccepted]=useState(false);
  const [mapping,setMapping]=useState<Record<string,number>>({}),[destination,setDestination]=useState(0),[replacement,setReplacement]=useState<{rangeId:string;keyIndex:number;stagedRangeId?:string}|null>(null);
  const [replacementApprovals,setReplacementApprovals]=useState<Record<number,DrumSample>>({});
  const [unassignments,setUnassignments]=useState<Record<number,DrumSample>>({});
  const focusReplacement=useCallback((node:HTMLDivElement|null)=>{if(node){node.scrollIntoView?.({block:'nearest'});node.querySelector<HTMLButtonElement>('button:last-child')?.focus();}},[]);
  useEffect(()=>{const stale=Object.keys(unassignments).filter(key=>unassignments[Number(key)]!==existingSamples[Number(key)]);if(!stale.length)return;setUnassignments(current=>Object.fromEntries(Object.entries(current).filter(([key])=>!stale.includes(key))));setError(`Pad ${stale.map(key=>Number(key)+1).join(', ')} changed. Its unassignment was cancelled; select it again to review the current sound.`);},[existingSamples,unassignments]);

  const decisionPending=confirmAction!==null||replacement!==null,mutationsDisabled=Boolean(busy)||decisionPending;
  openRef.current=isOpen;
  const setSource=useCallback((value:SliceSource|null)=>{sourceRef.current=value;setSourceState(value);},[]);
  const setBusyValue=useCallback((value:string)=>{busyRef.current=Boolean(value);setBusy(value);},[]);
  const setRanges=useCallback((value:SoundRange[]|((current:SoundRange[])=>SoundRange[]))=>setRangesState(current=>{const next=typeof value==='function'?value(current):value;rangesRef.current=next;return next;}),[]);
  const setTransport=useCallback((value:'stopped'|'playing')=>{transportRef.current=value;setTransportState(value);},[]);
  const stop=useCallback(()=>{playRequestRef.current+=1;const note=noteRef.current;noteRef.current=null;if(note)releaseNote(note,true);clockRef.current=null;setTransport('stopped');},[releaseNote,setTransport]);
  const selectSound=useCallback((id:string)=>{if(id!==selectedId)stop();setSelectedIdState(id);setDrafts({});},[selectedId,stop]);
  const acceptRanges=useCallback((values:readonly FrameRange[])=>{const next=values.filter(value=>value.end>value.start).slice(0,SLICE_LIMITS.sliceCount).map(value=>({id:`sound-${++rangeSequenceRef.current}`,start:value.start,end:value.end}));setRanges(next);setSelectedIdState(next[0]?.id??null);setDrafts({});setEdited(false);setMapping({});setReplacement(null);setReplacementApprovals({});setUnassignments({});setConfirmAction(null);setOverflowAccepted(false);},[setRanges]);

  const runAnalysis=useCallback(async(loaded:SliceSource,controller:AbortController)=>{const editGeneration=++editGenerationRef.current;setBusyValue('Finding sounds...');setError('');setProgress(0);try{
    const result=await analyzeAudio(loaded.audioBuffer,{sensitivity,minimumSpacingFrames:Math.max(1,Math.round(spacingMs*loaded.audioBuffer.sampleRate/1000))},{signal:controller.signal,onProgress:setProgress});
    if(controller.signal.aborted||sourceRef.current!==loaded||editGeneration!==editGenerationRef.current||!openRef.current)return;
    acceptRanges(result.ranges);if(result.reason==='no-onsets')setError('No sounds found. Adjust Detection settings or use Add sound to begin manually.');
  }catch(reason){if((reason as Error).name!=='AbortError'&&!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Slice analysis failed');}
  finally{if(!controller.signal.aborted&&editGeneration===editGenerationRef.current&&openRef.current)setBusyValue('');}},[acceptRanges,analyzeAudio,sensitivity,setBusyValue,spacingMs]);

  useEffect(()=>{if(!isOpen||!request)return;
    // A retained source snapshot already owns this draft. Effect refreshes must not reanalyze it.
    const retained=sourceRef.current;
    if(retained&&!busyRef.current&&(request.kind==='existing'?retained===request.source:retained.file===request.file))return;
    const generation=++generationRef.current;abortRef.current?.abort();const controller=new AbortController();abortRef.current=controller;
    stop();pendingCommitRef.current=null;setSource(null);acceptRanges([]);setError('');setAdvanced(false);setBusyValue(request.kind==='file'?'Reading source...':'');setProgress(0);
    const load=async()=>{try{let loaded:SliceSource;if(request.kind==='existing')loaded=request.source;else{
      if(!request.file.size||request.file.size>SLICE_LIMITS.sourceFileBytes)throw new Error('Slice source must be a nonempty WAV or AIFF no larger than 64 MiB');
      const bytes=await request.file.arrayBuffer();if(controller.signal.aborted||generation!==generationRef.current)return;const dimensions=inspectSliceSource(bytes,request.file.name),contextRate=audioContextManager.getSampleRate();
      if(Math.ceil(dimensions.frames*contextRate/dimensions.sampleRate)*dimensions.channels*4>SLICE_LIMITS.decodedSourceBytes)throw new Error('Decoded source exceeds the 64 MiB slicing limit at the browser audio rate');
      setBusyValue('Decoding source...');const metadata=await readAudioMetadataFromArrayBuffer(bytes,request.file.name,request.file.size,midiNoteMapping);if(controller.signal.aborted||generation!==generationRef.current)return;
      loaded={audioBuffer:metadata.audioBuffer,file:request.file,metadata,existingIndex:null};}
      planSliceApplication({source:loaded.audioBuffer,ranges:[{start:0,end:loaded.audioBuffer.length}],existingSamples:projectAssets,retainExternalSource:loaded.existingIndex===null,sourceFileBytes:loaded.file.size});
      if(controller.signal.aborted||generation!==generationRef.current)return;setSource(loaded);await runAnalysis(loaded,controller);
    }catch(reason){if(!controller.signal.aborted&&generation===generationRef.current){setBusyValue('');setError(reason instanceof Error?reason.message:'Could not load slicing source');}}};void load();return()=>controller.abort();
  // A request identifies the source snapshot. Live project edits do not restart decode/analysis.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isOpen,request,midiNoteMapping]);
  useEffect(()=>{if(!isOpen){abortRef.current?.abort();editGenerationRef.current+=1;busyRef.current=false;stop();setSource(null);}},[isOpen,setSource,stop]);
  useEffect(()=>()=>{abortRef.current?.abort();editGenerationRef.current+=1;stop();},[stop]);
  useEffect(()=>{if(!commitResult||commitResult.operationId!==pendingCommitRef.current)return;pendingCommitRef.current=null;if(commitResult.status==='committed'){stop();onClose();return;}setBusyValue('');setError(commitResult.error??'The project changed while slicing. No sounds were added; retry.');},[commitResult,onClose,setBusyValue,stop]);

  const selectedIndex=Math.max(0,ranges.findIndex(range=>range.id===selectedId)),selected=ranges[selectedIndex];
  const assignedCount=Object.keys(mapping).length,overflowCount=Math.max(0,ranges.length-assignedCount);
  const destinationRangeId=Object.entries(mapping).find(([,key])=>key===destination)?.[0];
  const visibleSamples=existingSamples.map((sample,index)=>unassignments[index]===sample?{...sample,isLoaded:false}:sample);
  const longCount=source?ranges.filter(range=>(range.end-range.start)/source.audioBuffer.sampleRate>20).length:0;
  const selectedZoom=useCallback((range:SoundRange):FrameRange=>{if(!source)return range;const context=Math.max(1,Math.round(Math.max(range.end-range.start,source.audioBuffer.sampleRate*.05)*.12));return {start:Math.max(0,range.start-context),end:Math.min(source.audioBuffer.length,range.end+context)};},[source]);
  const drawWave=useCallback((canvas:HTMLCanvasElement|null,windowRange:FrameRange,highlight?:SoundRange)=>{if(!canvas||!source)return;const context=canvas.getContext('2d');if(!context)return;const rect=canvas.getBoundingClientRect(),width=Math.max(1,Math.round(rect.width||640)),height=Math.round(rect.height||100);canvas.width=width;canvas.height=height;
    context.fillStyle=canvasColors.outside;context.fillRect(0,0,width,height);const channels=Array.from({length:source.audioBuffer.numberOfChannels},(_,channel)=>source.audioBuffer.getChannelData(channel)),span=Math.max(1,windowRange.end-windowRange.start),step=Math.max(1,Math.ceil(span/width)),stride=Math.max(1,Math.ceil(step/48));context.fillStyle=canvasColors.waveform;
    for(let pixel=0;pixel<width;pixel+=1){let peak=0;const from=windowRange.start+Math.floor(pixel*span/width);for(let offset=0;offset<step;offset+=stride){const frame=from+offset;if(frame>=windowRange.end)break;for(const channel of channels)peak=Math.max(peak,Math.abs(channel[frame]));}context.fillRect(pixel,(1-peak)*height/2,1,Math.max(1,peak*height));}
    if(highlight){const x1=(highlight.start-windowRange.start)/span*width,x2=(highlight.end-windowRange.start)/span*width;context.fillStyle=canvasColors.accent;context.globalAlpha=.16;context.fillRect(x1,0,Math.max(1,x2-x1),height);context.globalAlpha=1;context.strokeStyle=canvasColors.accent;context.lineWidth=3;for(const x of [x1,x2]){context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();}}
  },[canvasColors,source]);
  const draw=useCallback(()=>{if(!source)return;drawWave(overviewRef.current,{start:0,end:source.audioBuffer.length},selected);if(selected)drawWave(selectedCanvasRef.current,dragRef.current?.zoom??selectedZoom(selected),selected);},[drawWave,selected,selectedZoom,source]);
  useEffect(()=>{if(!isOpen)return;draw();window.addEventListener('resize',draw);return()=>window.removeEventListener('resize',draw);},[draw,isOpen]);

  const updateRange=useCallback((id:string,edge:'start'|'end',frame:number)=>{if(!source||transportRef.current!=='stopped'||busyRef.current||decisionPending)return;setRanges(current=>current.map(range=>{if(range.id!==id)return range;const value=Math.round(Number.isFinite(frame)?frame:edge==='start'?range.start:range.end);return edge==='start'?{...range,start:Math.max(0,Math.min(range.end-1,value))}:{...range,end:Math.max(range.start+1,Math.min(source.audioBuffer.length,value))};}));setEdited(true);setOverflowAccepted(false);},[decisionPending,setRanges,source]);
  const frameFromSelectedPointer=useCallback((clientX:number,zoom:FrameRange)=>{const canvas=selectedCanvasRef.current;if(!canvas)return zoom.start;const rect=canvas.getBoundingClientRect();return Math.round(zoom.start+Math.max(0,Math.min(1,(clientX-rect.left)/(rect.width||1)))*(zoom.end-zoom.start));},[]);
  const onSelectedPointerDown=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!selected||transport!=='stopped'||busyRef.current||decisionPending)return;const zoom=selectedZoom(selected),frame=frameFromSelectedPointer(event.clientX,zoom),edge=Math.abs(frame-selected.start)<=Math.abs(frame-selected.end)?'start':'end';dragRef.current={edge,pointerId:event.pointerId,before:{...selected},zoom};event.currentTarget.setPointerCapture?.(event.pointerId);updateRange(selected.id,edge,frame);event.preventDefault();};
  useEffect(()=>{if(!isOpen)return;const move=(event:PointerEvent)=>{const drag=dragRef.current;if(drag?.pointerId===event.pointerId&&selectedId){updateRange(selectedId,drag.edge,frameFromSelectedPointer(event.clientX,drag.zoom));event.preventDefault();}};const end=(event:PointerEvent)=>{if(dragRef.current?.pointerId===event.pointerId)dragRef.current=null;};const cancel=(event:PointerEvent)=>{const drag=dragRef.current;if(drag?.pointerId===event.pointerId&&!decisionPending){setRanges(current=>current.map(range=>range.id===drag.before.id?drag.before:range));dragRef.current=null;}};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',cancel);return()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',cancel);};},[decisionPending,frameFromSelectedPointer,isOpen,selectedId,setRanges,updateRange]);

  const playRange=useCallback(async(range:FrameRange,clock=false)=>{if(!source||busyRef.current||!openRef.current)return;stop();setError(current=>current===PLAYBACK_FAILURE?'':current);const requestId=++playRequestRef.current,requested=`slice-preview-${Date.now()}-${requestId}`;let owned=requested;
    const result=await playWithADSR(source.audioBuffer,requested,{inFrame:range.start,outFrame:range.end,adsr:{attack:0,decay:0,sustain:32767,release:0},onEnded:()=>{if(requestId!==playRequestRef.current||noteRef.current!==owned)return;noteRef.current=null;clockRef.current=null;setTransport('stopped');}});
    owned=typeof result==='string'?result:requested;if(requestId!==playRequestRef.current||!openRef.current||busyRef.current){if(typeof result==='string')releaseNote(result,true);return;}if(result===null){stop();setError(PLAYBACK_FAILURE);return;}noteRef.current=owned;if(clock)clockRef.current={startedAt:audioContextManager.getCurrentTime()??0,startFrame:range.start,sample:{...range},loop:{...range},loopEnabled:false,sampleRate:source.audioBuffer.sampleRate,playbackRate:1,reverse:false};setTransport('playing');
  },[playWithADSR,releaseNote,setTransport,source,stop]);
  const auditionSound=useCallback((range:SoundRange)=>{setSelectedIdState(range.id);setDrafts({});void playRange(range);},[playRange]);
  const splitAt=useCallback((frame:number,whilePlaying=false)=>{if(!source||busyRef.current||decisionPending||(!whilePlaying&&transportRef.current!=='stopped')||rangesRef.current.length>=SLICE_LIMITS.sliceCount)return;const containing=rangesRef.current.find(range=>frame>range.start&&frame<range.end);if(!containing)return;const added:SoundRange={id:`sound-${++rangeSequenceRef.current}`,start:frame,end:containing.end};setRanges(current=>current.flatMap(range=>range.id===containing.id?[{...range,end:frame},added]:[range]));setSelectedIdState(added.id);setEdited(true);setOverflowAccepted(false);},[decisionPending,setRanges,source]);
  const mark=useCallback(()=>{const clock=clockRef.current;if(!source||transportRef.current!=='playing'||busyRef.current||!clock)return;const now=audioContextManager.getCurrentTime();if(now===null)return;splitAt(Math.min(source.audioBuffer.length-1,previewFrameAtTime(clock,now)),true);},[source,splitAt]);
  useEffect(()=>{if(!isOpen)return;const key=(event:KeyboardEvent)=>{if(event.key.toLowerCase()!=='m'||!modalRef.current?.contains(document.activeElement)||shouldIgnoreKeyboardKeyDown(event,{modalOwner:modalRef.current}))return;event.preventDefault();mark();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[isOpen,mark]);

  const hasChanges=edited||assignedCount>0||Object.keys(unassignments).length>0;
  const analyze=()=>{if(!source||busyRef.current||decisionPending)return;if(hasChanges){setConfirmAction('analyze');return;}stop();abortRef.current?.abort();const controller=new AbortController();abortRef.current=controller;void runAnalysis(source,controller);};
  const reset=()=>{if(!source||busyRef.current||decisionPending)return;if(hasChanges){setConfirmAction('reset');return;}stop();acceptRanges([{start:0,end:source.audioBuffer.length}]);};
  const confirmReplacement=()=>{if(!source||!confirmAction)return;const action=confirmAction;setConfirmAction(null);stop();if(action==='reset'){acceptRanges([{start:0,end:source.audioBuffer.length}]);return;}abortRef.current?.abort();const controller=new AbortController();abortRef.current=controller;void runAnalysis(source,controller);};
  const commitDraft=(edge:'start'|'end',unit:'seconds'|'frames')=>{if(!selected||!source||mutationsDisabled)return;const key=`${selected.id}-${edge}-${unit}`,draft=drafts[key];if(draft===undefined)return;const parsed=Number(draft.text),frame=unit==='seconds'?Math.round(parsed*source.audioBuffer.sampleRate):parsed;if(draft.text!==draft.initialText&&draft.text.trim()&&Number.isFinite(frame)&&frame!==draft.frame)updateRange(selected.id,edge,frame);setDrafts(current=>{const next={...current};delete next[key];return next;});};
  const rangeInput=(edge:'start'|'end',unit:'seconds'|'frames')=>{if(!selected||!source)return null;const key=`${selected.id}-${edge}-${unit}`,frame=selected[edge],value=unit==='seconds'?(frame/source.audioBuffer.sampleRate).toFixed(3):String(frame),edgeName=edge[0].toUpperCase()+edge.slice(1),label=`Sound ${selectedIndex+1} ${edgeName}${unit==='frames'?' frame':''}`;return <label style={{display:'grid',gap:'.25rem'}}>{edgeName} {unit==='seconds'?'(seconds)':'frame'}<input aria-label={label} type="number" step={unit==='seconds'?.001:1} min="0" max={unit==='seconds'?source.audioBuffer.duration:source.audioBuffer.length} value={drafts[key]?.text??value} disabled={mutationsDisabled||transport==='playing'} onFocus={()=>setDrafts(current=>({...current,[key]:{text:value,initialText:value,frame}}))} onChange={event=>setDrafts(current=>({...current,[key]:{text:event.target.value,initialText:current[key]?.initialText??value,frame:current[key]?.frame??frame}}))} onBlur={()=>commitDraft(edge,unit)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commitDraft(edge,unit);}}} style={inputStyle}/></label>;};
  const startManualEditing=()=>{if(!source)return;abortRef.current?.abort();editGenerationRef.current+=1;setBusyValue('');stop();if(!rangesRef.current.length)acceptRanges([{start:0,end:source.audioBuffer.length}]);setError('');};
  const addSound=()=>{if(!source||busyRef.current||decisionPending||transportRef.current!=='stopped'||ranges.length>=SLICE_LIMITS.sliceCount)return;const gaps=[{start:0,end:ranges[0]?.start??source.audioBuffer.length},...ranges.map((range,index)=>({start:range.end,end:ranges[index+1]?.start??source.audioBuffer.length}))].filter(range=>range.end>range.start);const widest=gaps.sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(widest){const added={id:`sound-${++rangeSequenceRef.current}`,...widest};setRanges(current=>[...current,added].sort((a,b)=>a.start-b.start));setSelectedIdState(added.id);}else if(selected)splitAt(selected.start+Math.floor((selected.end-selected.start)/2));setEdited(true);setOverflowAccepted(false);};
  const removeSelected=()=>{if(!selected||busyRef.current||decisionPending||transportRef.current!=='stopped')return;const remaining=ranges.filter(range=>range.id!==selected.id);const removedTarget=mapping[selected.id];setRanges(remaining);setMapping(current=>{const next={...current};delete next[selected.id];return next;});if(removedTarget!==undefined)setReplacementApprovals(current=>{const next={...current};delete next[removedTarget];return next;});setReplacement(current=>current?.rangeId===selected.id?null:current);setSelectedIdState(remaining[Math.min(selectedIndex,remaining.length-1)]?.id??null);setEdited(true);setOverflowAccepted(false);};
  const stageAssignment=useCallback((rangeId:string,keyIndex:number,approved=false)=>{if(busyRef.current||(decisionPending&&!(approved&&replacement?.rangeId===rangeId&&replacement.keyIndex===keyIndex&&!confirmAction))||!rangesRef.current.some(range=>range.id===rangeId)||!Number.isInteger(keyIndex)||keyIndex<0||keyIndex>=24)return;setDestination(keyIndex);setError('');const oldTarget=mapping[rangeId],staged=Object.entries(mapping).find(([id,key])=>id!==rangeId&&key===keyIndex);const occupied=existingSamples[keyIndex]?.isLoaded?existingSamples[keyIndex]:null;if(!approved&&(staged||occupied&&replacementApprovals[keyIndex]!==occupied&&unassignments[keyIndex]!==occupied)){setReplacement({rangeId,keyIndex,stagedRangeId:staged?.[0]});return;}setMapping(current=>{const next={...current};for(const [id,key] of Object.entries(next))if(id!==rangeId&&key===keyIndex)delete next[id];next[rangeId]=keyIndex;return next;});setReplacementApprovals(current=>{const next={...current};if(oldTarget!==undefined&&oldTarget!==keyIndex)delete next[oldTarget];if(occupied)next[keyIndex]=occupied;return next;});if(staged)setSelectedIdState(rangeId);setReplacement(null);setOverflowAccepted(false);setError('');},[decisionPending,existingSamples,mapping,replacementApprovals,unassignments,replacement,confirmAction]);
  const unassignPad=()=>{if(mutationsDisabled)return;const occupied=existingSamples[destination]?.isLoaded?existingSamples[destination]:null;if(!destinationRangeId&&(!occupied||unassignments[destination]))return;
    setMapping(current=>Object.fromEntries(Object.entries(current).filter(([,key])=>key!==destination)));
    setReplacementApprovals(current=>{const next={...current};delete next[destination];return next;});
    if(occupied&&!destinationRangeId)setUnassignments(current=>({...current,[destination]:occupied}));
    setReplacement(null);setOverflowAccepted(false);setError('');
  };
  const autoFill=()=>{if(mutationsDisabled)return;const reserved=new Set(Object.values(mapping));const empty=existingSamples.slice(0,24).flatMap((sample,index)=>(!sample?.isLoaded||unassignments[index]===sample)&&!reserved.has(index)?[index]:[]);setMapping(current=>{const next={...current};let cursor=0;for(const range of ranges)if(next[range.id]===undefined&&cursor<empty.length)next[range.id]=empty[cursor++];return next;});setReplacement(null);setOverflowAccepted(false);};
  const apply=async()=>{if(!source||!ranges.length||busyRef.current||decisionPending||overflowCount>0&&!overflowAccepted)return;abortRef.current?.abort();editGenerationRef.current+=1;stop();const controller=new AbortController();abortRef.current=controller;setBusyValue('Preparing sounds...');setProgress(0);setError('');const draftRanges=ranges.map(({start,end})=>({start,end})),explicitMapping=ranges.map(range=>mapping[range.id]??null),approvals=Object.values(mapping).flatMap(key=>{const sample=replacementApprovals[key];return sample&&existingSamples[key]===sample?[{targetKeyIndex:key,sample}]:[];}),unassignmentApprovals=Object.entries(unassignments).filter(([key])=>!Object.values(mapping).includes(Number(key))).map(([key,sample])=>({targetKeyIndex:Number(key),sample}));for(const key of Object.values(mapping)){if(unassignments[key]&&existingSamples[key]===unassignments[key]&&!approvals.some(approval=>approval.targetKeyIndex===key))approvals.push({targetKeyIndex:key,sample:unassignments[key]});}try{const prepared=await prepareApplication({source,ranges:draftRanges,mapping:explicitMapping,replacementApprovals:approvals,unassignmentApprovals,existingSamples,projectAssets,signal:controller.signal,onProgress:setProgress});if(controller.signal.aborted||!openRef.current)return;const operationId=crypto.randomUUID();pendingCommitRef.current=operationId;setBusyValue('Adding sounds...');onApply(operationId,prepared);}catch(reason){if((reason as Error).name!=='AbortError')setError(reason instanceof Error?reason.message:'Could not add sounds');}finally{if(!controller.signal.aborted&&openRef.current&&!pendingCommitRef.current)setBusyValue('');}};
  const cancel=()=>{abortRef.current?.abort();editGenerationRef.current+=1;pendingCommitRef.current=null;stop();onClose();};
  useOwnedDialog({active:isOpen,dialogRef:modalRef,onClose:cancel});
  if(!isOpen)return null;

  return <div ref={modalRef} data-workspace-modal="slice" role="dialog" aria-modal="true" aria-label="slice audio" tabIndex={-1} className="studio-slicer-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)cancel();}}>
    <div className="studio-slicer-shell">
      <header className="studio-slicer-header">
        <h3>Turn a loop into drum sounds</h3>
        <p>Make slices, edit and listen, then assign keys. Scroll through the controls below.</p>
      </header>
      <main className="studio-slicer-body" aria-label="Slicing controls" tabIndex={0}>
        {busy&&<div role="status"><p>{busy} {Math.round(progress*100)}%</p><progress value={progress} max={1}/></div>}
        {error&&<p role="alert">{error}</p>}
        {source&&<>
          <section className="studio-slicer-group" aria-labelledby="slice-make-heading">
            <h4 id="slice-make-heading"><span aria-hidden="true">1</span> Make slices</h4>
            <p className="studio-slicer-source"><strong>{source.file.name}</strong> · {source.audioBuffer.duration.toFixed(2)} seconds · {ranges.length} sounds</p>
            <canvas ref={overviewRef} aria-label="Loop overview" className="studio-slicer-overview"/>
            <div className="studio-slicer-actions">
              <button type="button" onClick={()=>void playRange({start:0,end:source.audioBuffer.length},true)} disabled={mutationsDisabled||transport==='playing'} style={buttonStyle}>Play source</button>
              <button type="button" onClick={stop} disabled={Boolean(busy)||transport==='stopped'} style={buttonStyle}>Stop source</button>
              <button type="button" onClick={mark} disabled={mutationsDisabled||transport!=='playing'||!clockRef.current} style={buttonStyle}>Mark split (M)</button>
            </div>
            <details open={advanced} onToggle={event=>setAdvanced(event.currentTarget.open)} className="studio-slicer-disclosure">
              <summary>Detection settings</summary>
              <div className="studio-slicer-fields">
                <label>Detection sensitivity <input aria-label="Detection sensitivity" type="range" min="0" max="100" value={sensitivity*100} disabled={mutationsDisabled} onChange={event=>setSensitivity(Number(event.target.value)/100)}/></label>
                <label>Minimum spacing (ms) <input aria-label="Minimum spacing milliseconds" type="number" min="1" max="5000" value={spacingMs} disabled={mutationsDisabled} onChange={event=>setSpacingMs(Math.max(1,Number(event.target.value)||1))} style={inputStyle}/></label>
              </div>
            </details>
            <div className="studio-slicer-actions">
              {busy==='Finding sounds...'&&<button type="button" onClick={startManualEditing} style={buttonStyle}>Start manual editing</button>}
              <button type="button" onClick={analyze} disabled={mutationsDisabled} style={buttonStyle}>Detect sounds again</button>
              <button type="button" onClick={reset} disabled={mutationsDisabled} style={buttonStyle}>Reset to full source</button>
            </div>
            {confirmAction&&<div role="alert" className="studio-slicer-confirmation">
              <p>{confirmAction==='analyze'?'Detecting again':'Resetting'} will replace your boundary edits and assignments. Choose before continuing.</p>
              <div className="studio-slicer-actions"><button type="button" onClick={confirmReplacement} style={buttonStyle}>Replace edits</button><button type="button" onClick={()=>setConfirmAction(null)} style={buttonStyle}>Keep edits</button></div>
            </div>}
          </section>
          <section className="studio-slicer-group" aria-labelledby="slice-edit-heading">
            <h4 id="slice-edit-heading"><span aria-hidden="true">2</span> Edit and listen</h4>
            <p>Click a numbered sound to hear it, or drag it directly onto a key below. Replacing a loaded pad keeps its old sound in Unassigned sounds.</p>

            <div className="studio-slicer-actions">
              <button type="button" onClick={addSound} disabled={mutationsDisabled||transport==='playing'||ranges.length>=SLICE_LIMITS.sliceCount} style={buttonStyle}>Add sound</button>
              <button type="button" onClick={()=>selected&&splitAt(selected.start+Math.floor((selected.end-selected.start)/2))} disabled={!selected||mutationsDisabled||transport==='playing'||selected.end-selected.start<2||ranges.length>=SLICE_LIMITS.sliceCount} style={buttonStyle}>Split sound</button>
              <button type="button" onClick={removeSelected} disabled={!selected||mutationsDisabled||transport==='playing'} style={buttonStyle}>Delete sound</button>
            </div>
            {selected&&<section aria-label={`Sound ${selectedIndex+1} editor`}>
              <div className="studio-slicer-fields">{rangeInput('start','seconds')}{rangeInput('end','seconds')}
                <button type="button" onClick={()=>void playRange(selected)} disabled={mutationsDisabled||transport==='playing'} style={buttonStyle}>Play sound</button>
                <button type="button" onClick={stop} disabled={Boolean(busy)||transport==='stopped'} style={buttonStyle}>Stop</button>
              </div>
              <details className="studio-slicer-disclosure"><summary>Detailed timing</summary><div className="studio-slicer-fields">{rangeInput('start','frames')}{rangeInput('end','frames')}</div></details>

              <div className="studio-slicer-selection"><strong aria-live="polite">Sound {ranges.length?selectedIndex+1:0} of {ranges.length}</strong><div className="studio-slicer-actions">
                <button type="button" aria-label="Previous sound" disabled={mutationsDisabled||!selected||selectedIndex===0} onClick={()=>selectSound(ranges[selectedIndex-1].id)} style={buttonStyle}>Previous</button>
                <button type="button" aria-label="Next sound" disabled={mutationsDisabled||!selected||selectedIndex===ranges.length-1} onClick={()=>selectSound(ranges[selectedIndex+1].id)} style={buttonStyle}>Next</button>
              </div></div>
              <canvas ref={selectedCanvasRef} aria-label={`Sound ${selectedIndex+1} waveform`} aria-disabled={mutationsDisabled||transport==='playing'} onPointerDown={onSelectedPointerDown} className="studio-slicer-waveform"/>
              <div className="studio-slicer-sounds" role="region" aria-label="Sound selection">{ranges.map((range,index)=><button key={range.id} type="button" disabled={mutationsDisabled} draggable={!mutationsDisabled} onDragStart={event=>{if(mutationsDisabled){event.preventDefault();return;}event.dataTransfer.setData(SLICE_DRAG_TYPE,range.id);event.dataTransfer.effectAllowed='move';}} aria-label={`Select sound ${index+1}`} title={`Select and play sound ${index+1}${mapping[range.id]!==undefined?`, assigned to pad ${mapping[range.id]+1}`:', unassigned'}`} aria-pressed={range.id===selectedId} onClick={()=>auditionSound(range)} style={{...buttonStyle,minWidth:'44px',padding:'.45rem',background:range.id===selectedId?colors.action:colors.alt,color:range.id===selectedId?'var(--studio-accent-text)':colors.text}}>{index+1}{mapping[range.id]!==undefined?<small style={{display:'block'}}>Pad {mapping[range.id]+1}</small>:null}</button>)}</div>

            </section>}
            {!selected&&<p role="status">Sound 0 of 0. Use Add sound to create a slice.</p>}
          </section>
          <section className="studio-slicer-group" aria-labelledby="slice-assign-heading">
            <h4 id="slice-assign-heading"><span aria-hidden="true">3</span> Assign to keys</h4>

            <SliceKeyboardMapping existingSamples={visibleSamples} ranges={ranges} mapping={mapping} disabled={mutationsDisabled} onAssign={stageAssignment} selectedKey={destination} onSelect={setDestination} onPreview={id=>{const range=rangesRef.current.find(item=>item.id===id);if(range)auditionSound(range);}}/>
            <div className="studio-slicer-fields"><label>Destination <select aria-label="Destination pad" value={destination} onChange={event=>setDestination(Number(event.target.value))} disabled={mutationsDisabled} style={{minHeight:'44px',maxWidth:'100%',minWidth:0}}>{SLICE_PAD_GROUPS.flatMap(group=>[...group.lower,...group.upper]).sort((a,b)=>a.index-b.index).map(key=><option key={key.index} value={key.index}>{key.label} (Pad {key.index+1}){visibleSamples[key.index]?.isLoaded?` - ${visibleSamples[key.index].name}`:' - Empty'}</option>)}</select></label>
              <button type="button" disabled={!selected||mutationsDisabled} onClick={()=>selectedId&&stageAssignment(selectedId,destination)} style={buttonStyle}>Assign selected sound</button>
              <button type="button" disabled={mutationsDisabled||(!destinationRangeId&&!visibleSamples[destination]?.isLoaded)} onClick={unassignPad} style={buttonStyle}>Unassign pad sound</button>
              <button type="button" disabled={mutationsDisabled} onClick={autoFill} style={buttonStyle}>Auto-fill empty keys</button>
            </div>
            {replacement&&<div role="alert" className="studio-slicer-confirmation" ref={focusReplacement}><p>{replacement.stagedRangeId?`Sound ${ranges.findIndex(range=>range.id===replacement.stagedRangeId)+1} is already assigned to Pad ${replacement.keyIndex+1}. Replace it and move that sound to Unassigned?`:`Pad ${replacement.keyIndex+1} contains ${existingSamples[replacement.keyIndex]?.name}. Replace it and preserve the existing sound in Unassigned sounds?`}</p><div className="studio-slicer-actions"><button type="button" disabled={Boolean(busy)||confirmAction!==null} onClick={()=>stageAssignment(replacement.rangeId,replacement.keyIndex,true)} style={buttonStyle}>Replace</button><button type="button" disabled={Boolean(busy)||confirmAction!==null} onClick={()=>setReplacement(null)} style={buttonStyle}>Keep</button></div></div>}
            <p role="status">{assignedCount} {assignedCount===1?'sound is':'sounds are'} assigned. {overflowCount} {overflowCount===1?'remains':'remain'} in Unassigned sounds. The original loop is preserved. {Object.keys(unassignments).length>0?`${Object.keys(unassignments).length} existing pad sound(s) will be moved to Unassigned sounds when you add sounds to the kit.`:null}</p>
            {overflowCount>0&&<label className="studio-slicer-overflow"><input type="checkbox" checked={overflowAccepted} disabled={mutationsDisabled} onChange={event=>setOverflowAccepted(event.target.checked)}/>I understand that {overflowCount} {overflowCount===1?'sound':'sounds'} will remain unassigned.</label>}
            {longCount>0&&<p role="alert">{longCount} output {longCount===1?'region is':'regions are'} longer than 20 seconds. Device export preflight will require handling before download.</p>}
            <p>Overlapping or mixed instruments cannot be separated into individual sounds.</p>
          </section>
        </>}
      </main>
      <footer className="studio-slicer-footer"><button type="button" onClick={cancel} style={buttonStyle}>Cancel</button><button type="button" onClick={()=>void apply()} disabled={!source||!ranges.length||mutationsDisabled||(overflowCount>0&&!overflowAccepted)} style={{...buttonStyle,background:colors.action,color:'var(--studio-accent-text)'}}>Add sounds to kit</button></footer>
    </div>
  </div>;
}
