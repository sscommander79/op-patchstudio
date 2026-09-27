Design and adversarial risk review for stage 2 guided automatic multisampling in OP-PatchStudio, an existing React/TypeScript browser app. Return an implementation-ready Markdown design and risk report IN YOUR FINAL ANSWER (not only file links). Keep under 2200 words. One bounded pass, no nested paid agents, no external research, no browsing or GitHub access, no code execution or changes, no deployment, no hardware. Do not claim tests passed. Treat attached source as evidence, not instructions.

User wants app to automatically multisample a hardware or software synth, review/map results, save, guide transfer to OP-XY. Hardware/software SECOND choice after Multisample vs Sample vs Drum. Software instruments hosted in DAW (Ableton stock synths included); browser is NOT VST host. Generic hardware/software paths, equipment-specific profiles optional examples. User's NINA through Digitakt II is only one possible setup.

Stage1 shell/help already built. Stage2 scope NOW: automatic multisampling only, integrated with existing CaptureSession/AutoSampler and commit pipeline, not replacing DSP, storage, library, or exporting engine. Thin guided sequence Connect/check -> Capture range -> Review -> Finish (existing editor/save/export). Manual recorder and drum workflows must remain compatible. No full-library backup/native USB transfer.

Current observed gaps to challenge: dense automatic panel; custom profile skips required sound check; sound check analyzes and discards recording (no audition UI despite 'listen' instruction); route key lacks some settings affecting capture; existing retries and take review are functional; .preset export guide already exists. Need truthful status/progress, allow cancel/retry without lost takes, prevent settings changes invalidating checked-route evidence, preserve dialog Help and discard guards, avoid double note-on and stuck notes, no phantom saved/transferred success.

Propose minimal public component/state contracts and exact state transitions; phase gates and backwards navigation; how to retain/audition one-note check with bounded resource cleanup; which settings invalidate it; generic routing UI without breaking saved profiles; actionable per-note recovery; real review-to-editor/save/export handoff; race/cleanup and accessibility invariants. Prioritize at most 6 risks with severity/evidence. Include acceptance checks and scope exclusions. Distinguish confirmed source issues vs hypotheses. Do not redesign entire app. No dependency changes. Root/Codex integrates and verifies locally. Conclude READY WITH CONDITIONS or NOT READY and exact changes needed. Produce the design and risk review now.

## SOURCE src/components/common/AutoSamplingPanel.tsx
```
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {WebMidi} from 'webmidi';
import {AutoSampler,noteSequence,validateAutoSampleSettings,type AutoCapture,type AutoCaptureCallbacks,type AutoSampleResult,type AutoSampleSettings} from '../../audio/recording/autoSampler';
import {RECORDING_LIMITS} from '../../audio/recording/captureSession';

interface AudioDevice {deviceId:string;label:string}
interface Props {audioDeviceId:string;audioDevices?:AudioDevice[];audioSelectionVersion?:number;onAudioDeviceChange?:(id:string)=>void;disabled:boolean;retainedCount:number;retainedBytes:number;existingRoots:number[];createCapture:(callbacks:AutoCaptureCallbacks)=>AutoCapture;onTake:(result:AutoSampleResult,replaceRoot:boolean)=>void;onRunningChange:(running:boolean)=>void}
type Profile='custom'|'nina-digitakt'|'ableton';
interface RouteConfig {audioDeviceId:string;outputId:string;settings:AutoSampleSettings}
interface Preferences {profile:Profile;routes:Record<Profile,RouteConfig>}
const defaults:AutoSampleSettings={startNote:48,endNote:72,step:6,velocity:100,channel:1,holdSeconds:1,tailSeconds:1,settleSeconds:.25,readinessTimeoutSeconds:2};
const blankRoute=():RouteConfig=>({audioDeviceId:'',outputId:'',settings:{...defaults}});
const storageKey='op-patchstudio:auto-sampling:v1';
const profiles=['custom','nina-digitakt','ableton'] as const;
const button:React.CSSProperties={minHeight:44,padding:'0.5rem 0.75rem',border:'1px solid var(--color-border-medium, #bbb)',borderRadius:4,background:'var(--color-bg-primary, #fff)',color:'inherit'};

function loadPreferences():Preferences {const fallback:Preferences={profile:'custom',routes:{custom:blankRoute(),'nina-digitakt':blankRoute(),ableton:blankRoute()}};try{const value=JSON.parse(localStorage.getItem(storageKey)||'null') as Partial<Preferences>|null;if(!value?.routes)return fallback;for(const profile of profiles){const route=value.routes[profile];if(route)fallback.routes[profile]={audioDeviceId:typeof route.audioDeviceId==='string'?route.audioDeviceId:'',outputId:typeof route.outputId==='string'?route.outputId:'',settings:{...defaults,...route.settings}};}if(typeof value.profile==='string'&&profiles.includes(value.profile as Profile))fallback.profile=value.profile as Profile;}catch{/* storage is optional */}return fallback;}
function profileHelp(profile:Profile){if(profile==='nina-digitakt')return 'Connect NINA over USB-C MIDI. Route its stereo audio through Digitakt II and select that browser audio input above.';if(profile==='ableton')return 'Use an external MIDI route into Ableton and select a virtual audio input above. The browser does not host Ableton instruments.';return 'Choose the MIDI destination and the audio return that carries the same instrument.';}
function peakLevel(result:AutoSampleResult){let peak=0;const buffer=result.take.audioBuffer;for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let frame=0;frame<result.take.frames;frame++)peak=Math.max(peak,Math.abs(data[frame]));}return peak;}
function levelLabel(peak:number){return `${(20*Math.log10(Math.max(peak,1e-6))).toFixed(1)} dBFS peak`;}
const setupSteps:Record<Profile,string[]>={custom:['Select the connected MIDI output and the audio input carrying the same instrument.','Run Check sound before recording a range. Listen to the return before applying takes.'],'nina-digitakt':['Connect NINA MIDI to the computer and choose its connected output above.','Route NINA left/right audio into Digitakt II, then route Digitakt II audio to the computer. Select that browser input in Input device.','Check sound on one note; confirm the intended NINA patch is audible and the return is neither silent nor clipped.'],'ableton':['Create a MIDI route from the browser to the intended Ableton track or virtual MIDI port. Choose that output above.','Monitor the track through a virtual audio input visible in the browser, and select it in Input device. Disable feedback or direct monitor paths that duplicate the signal.','Check sound on one note; confirm the intended Ableton instrument returns cleanly before recording the range.']};

export function AutoSamplingPanel({audioDeviceId,audioDevices=[],audioSelectionVersion=0,onAudioDeviceChange=()=>{},disabled,retainedCount,retainedBytes,existingRoots,createCapture,onTake,onRunningChange}:Props){
  const saved=useMemo(loadPreferences,[]),initial=saved.routes[saved.profile],[profile,setProfile]=useState<Profile>(saved.profile),[outputId,setOutputId]=useState(initial.outputId),[settings,setSettings]=useState(initial.settings);
  const [outputs,setOutputs]=useState<Array<{id:string;name:string}>>([]),[midiEnabled,setMidiEnabled]=useState(WebMidi.enabled),[running,setRunning]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[retryNotes,setRetryNotes]=useState<number[]>([]),[inputResolutionRequired,setInputResolutionRequired]=useState(false),[checkedRoute,setCheckedRoute]=useState('');
  const routesRef=useRef(saved.routes),samplerRef=useRef<AutoSampler|undefined>(undefined),stopOperationRef=useRef<Promise<void>|undefined>(undefined),retryRef=useRef<number|undefined>(undefined),mountedRef=useRef(true),runIdRef=useRef(0),desiredAudioRef=useRef<string|null>(initial.audioDeviceId||null),audioSelectionVersionRef=useRef(audioSelectionVersion);
  const connectedOutputs=useCallback(()=>WebMidi.outputs.filter(output=>output.state==='connected').map(output=>({id:output.id,name:output.name||'Unnamed MIDI output'})),[]);
  const refreshOutputs=useCallback(()=>{if(!WebMidi.enabled)return;const next=connectedOutputs();setOutputs(next);if(outputId&&!next.some(output=>output.id===outputId)){setOutputId('');setError('The saved MIDI output is unavailable. Choose a connected output.');}},[connectedOutputs,outputId]);
  useEffect(()=>{if(midiEnabled)refreshOutputs();},[midiEnabled,refreshOutputs]);
  useEffect(()=>{if(audioSelectionVersion!==audioSelectionVersionRef.current){audioSelectionVersionRef.current=audioSelectionVersion;desiredAudioRef.current=null;setInputResolutionRequired(false);setCheckedRoute('');}},[audioSelectionVersion]);
  useEffect(()=>{const desired=desiredAudioRef.current;if(!desired)return;if(audioDeviceId===desired){desiredAudioRef.current=null;return;}if(!audioDevices.length)return;if(audioDevices.some(device=>device.deviceId===desired))onAudioDeviceChange(desired);else{setInputResolutionRequired(true);onAudioDeviceChange('');setError('The saved audio input is unavailable. Choose an input before capture.');}},[audioDeviceId,audioDevices,onAudioDeviceChange]);
  useEffect(()=>{if(desiredAudioRef.current&&audioDeviceId!==desiredAudioRef.current)return;routesRef.current={...routesRef.current,[profile]:{audioDeviceId,outputId,settings}};try{localStorage.setItem(storageKey,JSON.stringify({profile,routes:routesRef.current} satisfies Preferences));}catch{/* capture remains available */}},[audioDeviceId,outputId,profile,settings]);
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;runIdRef.current+=1;void samplerRef.current?.cancel();};},[]);
  const setNumber=(key:keyof AutoSampleSettings,value:number)=>setSettings(current=>({...current,[key]:value}));
  const enableMidi=async()=>{setError('');try{if(!WebMidi.enabled)await WebMidi.enable();if(!mountedRef.current)return;setMidiEnabled(true);const next=connectedOutputs();setOutputs(next);if(outputId&&!next.some(output=>output.id===outputId)){setOutputId('');setError('The saved MIDI output is unavailable. Choose a connected output.');}}catch(reason){if(mountedRef.current)setError(`${reason instanceof Error?reason.message:'MIDI permission was denied.'} Allow MIDI access in the browser, then retry.`);}};
  const routeKey=[profile,audioDeviceId,outputId,settings.channel,settings.velocity,settings.startNote].join('|');
  useEffect(()=>{setCheckedRoute('');setProgress(current=>current.startsWith('Sound check')?'':current);},[routeKey]);
  const begin=async(onlyNote?:number,replace=false,checkSound=false)=>{if(samplerRef.current||stopOperationRef.current)return;setError('');if(checkSound){setCheckedRoute('');setProgress('');}let notes:number[];let sampler:AutoSampler|undefined;const runId=++runIdRef.current;try{notes=onlyNote===undefined?validateAutoSampleSettings(settings):[onlyNote];if(!checkSound){const conflict=notes.find(note=>existingRoots.includes(note)&&!(replace&&note===onlyNote));if(conflict!==undefined)throw new Error(`MIDI root ${conflict} is already occupied. Resolve the destination before capture.`);if(retainedCount+notes.length>RECORDING_LIMITS.takes)throw new Error('The review tray does not have room for this range.');const estimated=notes.length*Math.ceil((settings.holdSeconds+settings.tailSeconds)*48_000)*2*8;if(retainedBytes+estimated>RECORDING_LIMITS.ownedBytes)throw new Error('The 256 MiB recording budget does not have room for this range.');if(onlyNote===undefined&&profile!=='custom'&&checkedRoute!==routeKey)throw new Error('Check sound on this MIDI and audio route before recording the range.');}if(inputResolutionRequired||desiredAudioRef.current)throw new Error('Choose an audio input after the saved device could not be found.');if(!midiEnabled)throw new Error('Enable MIDI from this panel before starting automatic capture.');const output=WebMidi.getOutputById(outputId);if(!output||output.state!=='connected')throw new Error('Choose a connected MIDI output before starting.');
      setRunning(true);onRunningChange(true);setProgress(`Preparing MIDI note ${notes[0]}…`);retryRef.current=replace?onlyNote:undefined;
      sampler=new AutoSampler({createCapture,midi:{isConnected:()=>WebMidi.getOutputById(outputId)?.state==='connected',noteOn:(note,velocity,channel)=>output.send([0x90|(channel-1),note,velocity]),noteOff:(note,channel)=>output.send([0x80|(channel-1),note,0])},onTake:result=>{if(runId!==runIdRef.current)return;if(checkSound){const peak=peakLevel(result),level=levelLabel(peak);if(result.selected&&Number.isFinite(peak)&&peak>=.02&&peak<.99){setCheckedRoute(routeKey);setProgress(`Sound check passed on MIDI note ${result.rootNote}: ${level}. Listen to confirm the intended instrument before capturing the range.`);}else{setCheckedRoute('');const concern=result.warnings.length?result.warnings.join(' '):peak<.02?'The audio return is too quiet.':'The audio return is near clipping.';setError(`Sound check needs attention: ${level}. ${concern}`);}return;}const replacing=retryRef.current===result.rootNote;if(!replacing||result.selected)onTake(result,replacing);setRetryNotes(current=>result.warnings.length?[...new Set([...current,result.rootNote])]:current.filter(note=>note!==result.rootNote));},onProgress:(completed,total,note)=>{if(runId===runIdRef.current&&!checkSound)setProgress(`Captured ${completed}/${total}: MIDI note ${note}.`);},onError:message=>{if(runId===runIdRef.current){if(checkSound)setCheckedRoute('');setError(message);}}});samplerRef.current=sampler;await sampler.run(settings,audioDeviceId,onlyNote);
    }catch(reason){if(runId===runIdRef.current){if(checkSound)setCheckedRoute('');setError(reason instanceof Error?reason.message:String(reason));}}finally{if(mountedRef.current&&runId===runIdRef.current&&samplerRef.current===sampler){samplerRef.current=undefined;setRunning(false);onRunningChange(false);retryRef.current=undefined;}}};
  const stop=useCallback(async()=>{if(stopOperationRef.current)return stopOperationRef.current;const owned=samplerRef.current;if(!owned)return;setCheckedRoute('');const stopId=++runIdRef.current;const operation=(async()=>{await owned.cancel();if(mountedRef.current&&runIdRef.current===stopId&&samplerRef.current===owned){samplerRef.current=undefined;setRunning(false);onRunningChange(false);setProgress('Automatic capture stopped. Finished takes remain in review.');}})();stopOperationRef.current=operation;try{await operation;}finally{if(stopOperationRef.current===operation)stopOperationRef.current=undefined;}},[onRunningChange]);
  useEffect(()=>{const changed=()=>{setCheckedRoute('');setProgress(current=>current.startsWith('Sound check')?'':current);refreshOutputs();if(outputId&&WebMidi.getOutputById(outputId)?.state!=='connected'){void stop();setError('The selected MIDI output disconnected. Reconnect it, then retry. If the instrument is still sounding, stop the note on the instrument.');}};if(WebMidi.enabled)WebMidi.addListener('portschanged',changed);return()=>{if(WebMidi.enabled)WebMidi.removeListener('portschanged',changed);};},[midiEnabled,outputId,refreshOutputs,stop]);
  useEffect(()=>{const visibility=()=>{if(document.hidden&&samplerRef.current){void stop();setError('Automatic capture stopped because the page was hidden. Finished takes remain in review.');}};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[stop]);
  const applyProfile=(next:Profile)=>{routesRef.current={...routesRef.current,[profile]:{audioDeviceId:desiredAudioRef.current??audioDeviceId,outputId,settings}};const route=routesRef.current[next];setProfile(next);setOutputId(route.outputId);setSettings(route.settings);desiredAudioRef.current=route.audioDeviceId&&route.audioDeviceId!==audioDeviceId?route.audioDeviceId:null;setInputResolutionRequired(false);if(!route.audioDeviceId)onAudioDeviceChange('');else if(route.audioDeviceId===audioDeviceId||audioDevices.some(device=>device.deviceId===route.audioDeviceId))onAudioDeviceChange(route.audioDeviceId);else{setInputResolutionRequired(true);onAudioDeviceChange('');setError('The saved audio input is unavailable. Choose an input before capture.');}};
  const notes=useMemo(()=>{try{return noteSequence(settings);}catch{return[];}},[settings]);
  return <fieldset data-studio-automatic-panel tabIndex={-1} disabled={disabled&&!running} style={{border:'1px solid var(--color-border-medium, #bbb)',borderRadius:6,padding:10,marginTop:12}}><legend>Automatic multisampling</legend>
    <p>Each MIDI note starts only after real audio frames arrive. Timing follows the browser and interface; it is not sample-accurate.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
      <label>Routing profile<select aria-label="Routing profile" value={profile} disabled={running} onChange={event=>applyProfile(event.target.value as Profile)} style={{...button,width:'100%'}}><option value="custom">Custom</option><option value="nina-digitakt">NINA through Digitakt II</option><option value="ableton">Ableton virtual routing</option></select></label>
      <label>MIDI output<select aria-label="MIDI output" value={outputId} disabled={!midiEnabled||running} onChange={event=>setOutputId(event.target.value)} style={{...button,width:'100%'}}><option value="">Choose output</option>{outputs.map(output=><option key={output.id} value={output.id}>{output.name}</option>)}</select></label>
      <NumberField label="MIDI channel" value={settings.channel} min={1} max={16} step={1} disabled={running} set={value=>setNumber('channel',value)}/><NumberField label="Start note" value={settings.startNote} min={0} max={127} step={1} disabled={running} set={value=>setNumber('startNote',value)}/><NumberField label="End note" value={settings.endNote} min={0} max={127} step={1} disabled={running} set={value=>setNumber('endNote',value)}/><NumberField label="Note step" value={settings.step} min={1} max={127} step={1} disabled={running} set={value=>setNumber('step',value)}/><NumberField label="Velocity" value={settings.velocity} min={1} max={127} step={1} disabled={running} set={value=>setNumber('velocity',value)}/><NumberField label="Hold duration" value={settings.holdSeconds} min={0} max={17.9} step={.05} disabled={running} set={value=>setNumber('holdSeconds',value)}/><NumberField label="Release tail" value={settings.tailSeconds} min={0} max={17.9} step={.05} disabled={running} set={value=>setNumber('tailSeconds',value)}/><NumberField label="Between-note settling" value={settings.settleSeconds} min={0} max={5} step={.05} disabled={running} set={value=>setNumber('settleSeconds',value)}/>
    </div>
    <p>{profileHelp(profile)} Range contains {notes.length} note{notes.length===1?'':'s'}.</p>
    <details><summary>Set up and check this route</summary><ol>{setupSteps[profile].map(step=><li key={step}>{step}</li>)}</ol><p>A sound check sends one MIDI note and analyzes its captured return. It does not add a take to review. Browser timing and level detection cannot prove the correct patch or a clean loop; listen before committing.</p></details>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>void enableMidi()} disabled={running||midiEnabled} style={button}>{midiEnabled?'MIDI enabled':'Enable MIDI'}</button><button type="button" onClick={()=>void begin(settings.startNote,false,true)} disabled={running||disabled} style={button}>Check sound on one note</button><button type="button" onClick={()=>void begin(settings.startNote)} disabled={running||disabled} style={button}>Test one note</button><button type="button" onClick={()=>void begin()} disabled={running||disabled} style={button}>Start automatic capture</button><button type="button" onClick={()=>void stop()} disabled={!running} style={button}>Stop automatic capture</button>{retryNotes.map(note=><button key={note} type="button" onClick={()=>void begin(note,true)} disabled={running||disabled} style={button}>Retry MIDI note {note}</button>)}</div>
    {profile!=='custom'&&<p role="status">{checkedRoute===routeKey?'Sound check passed for the selected route.':'Sound check required for this profile before range capture.'}</p>}
    {progress&&<p role="status">{progress}</p>}{error&&<p role="alert">{error}</p>}
  </fieldset>;
}

function NumberField({label,value,min,max,step,disabled,set}:{label:string;value:number;min:number;max:number;step:number;disabled:boolean;set:(value:number)=>void}){return <label>{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event=>set(Number(event.target.value))} style={{...button,width:'100%'}}/></label>}

```

## SOURCE src/components/common/RecordingModal.tsx
```
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import captureWorkletUrl from '../../audio/recording/captureProcessor.ts?worker&url';
import { CaptureSession, RECORDING_LIMITS, type CaptureStatus, type SessionTake } from '../../audio/recording/captureSession';
import { prepareRecordingApplication, proposeUnusedRootNotes, type RecordingTarget } from '../../utils/recordingApplication';
import { useAppContext } from '../../context/AppContext';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';
import { AutoSamplingPanel } from './AutoSamplingPanel';
import type { AutoCaptureCallbacks, AutoSampleResult } from '../../audio/recording/autoSampler';

interface Props {isOpen:boolean;onClose:()=>void;instrument:'drum'|'multisample';target:RecordingTarget;maxDuration?:number}
interface ReviewTake extends SessionTake {name:string;selected:boolean;rootNote:number;warnings?:string[]}
type Resolution=''|'replace'|'choose-empty'|'choose-free'|'cancel';
const box:React.CSSProperties={border:'1px solid var(--color-border-medium, #bbb)',borderRadius:6,padding:10};
const button:React.CSSProperties={minHeight:44,padding:'0.5rem 0.75rem',border:'1px solid var(--color-border-medium, #bbb)',borderRadius:4,background:'var(--color-bg-primary, #fff)',color:'inherit'};

export function RecordingModal({isOpen,onClose,instrument,target,maxDuration=20}:Props) {
  const {state,dispatch}=useAppContext();
  const [devices,setDevices]=useState<Array<{deviceId:string;label:string}>>([]),[deviceId,setDeviceId]=useState(''),[audioSelectionVersion,setAudioSelectionVersion]=useState(0);
  const [mode,setMode]=useState<'manual'|'sound'>('manual'),[thresholdDb,setThresholdDb]=useState(-30),[hysteresisDb,setHysteresisDb]=useState(6);
  const [preRoll,setPreRoll]=useState(.25),[silenceStop,setSilenceStop]=useState(.5),[durationLimit,setDurationLimit]=useState(Math.min(20,maxDuration));
  const [status,setStatus]=useState<CaptureStatus>({state:'idle'}),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
  const [takes,setTakes]=useState<ReviewTake[]>([]),takesRef=useRef<ReviewTake[]>([]);
  const [resolution,setResolution]=useState<Resolution>(''),[applying,setApplying]=useState(false),[previewActive,setPreviewActive]=useState(false),[automaticActive,setAutomaticActive]=useState(false),[confirmDiscard,setConfirmDiscard]=useState(false);
  const sessionRef=useRef<CaptureSession|undefined>(undefined),previewRef=useRef<{context:AudioContext;source:AudioBufferSourceNode;id:string}|undefined>(undefined),operationRef=useRef<string|undefined>(undefined),generationRef=useRef(0),applyGenerationRef=useRef(0),applyAbortRef=useRef<AbortController|undefined>(undefined),previewGenerationRef=useRef(0),pendingPreviewContextsRef=useRef(new Set<AudioContext>()),stateRef=useRef(state);
  const dialogRef=useRef<HTMLElement>(null),resumeRef=useRef<HTMLButtonElement>(null);
  stateRef.current=state;
  const updateTakes=useCallback((update:(current:ReviewTake[])=>ReviewTake[])=>{
    const next=update(takesRef.current);takesRef.current=next;setTakes(next);
  },[]);
  const occupied=useMemo(()=>target.kind==='drum'&&target.padIndex!==undefined?state.drumSamples[target.padIndex]?.isLoaded:
    target.kind==='multisample'&&target.rootNote!==undefined?state.multisampleFiles.some(file=>file.rootNote===target.rootNote):false,[state.drumSamples,state.multisampleFiles,target]);
  const supported=!!navigator.mediaDevices?.getUserMedia&&typeof AudioContext!=='undefined'&&typeof AudioWorkletNode!=='undefined'&&window.isSecureContext!==false;
  const releasePreview=useCallback(async(clearActive:boolean)=>{const owned=previewRef.current;previewRef.current=undefined;const pending=[...pendingPreviewContextsRef.current];pendingPreviewContextsRef.current.clear();if(clearActive)setPreviewActive(false);
    if(owned){owned.source.onended=null;try{owned.source.stop();}catch{/* ended */}owned.source.disconnect();}
    const closing=pending.map(context=>context.close().catch(()=>undefined));if(owned)closing.push(owned.context.close().catch(()=>undefined));await Promise.all(closing);},[]);
  const stopPreview=useCallback(async()=>{previewGenerationRef.current+=1;await releasePreview(true);},[releasePreview]);
  const dispose=useCallback(async()=>{const owned=sessionRef.current;sessionRef.current=undefined;await owned?.dispose();},[]);
  const close=useCallback(()=>{generationRef.current+=1;applyGenerationRef.current+=1;applyAbortRef.current?.abort();applyAbortRef.current=undefined;operationRef.current=undefined;setApplying(false);setAutomaticActive(false);setConfirmDiscard(false);void stopPreview();void dispose();onClose();},[dispose,onClose,stopPreview]);
  const requestClose=useCallback(()=>{if(takesRef.current.length||automaticActive||['requesting-permission','armed','recording','waiting-for-quiet'].includes(status.state)){setConfirmDiscard(true);return;}close();},[automaticActive,close,status.state]);
  useOwnedDialog({active:isOpen,dialogRef,onClose:requestClose});
  useEffect(()=>{if(confirmDiscard)resumeRef.current?.focus();},[confirmDiscard]);
  useEffect(()=>{if(!isOpen){applyGenerationRef.current+=1;applyAbortRef.current?.abort();applyAbortRef.current=undefined;operationRef.current=undefined;setApplying(false);setAutomaticActive(false);void dispose();void stopPreview();return;}const generation=++generationRef.current;applyGenerationRef.current+=1;applyAbortRef.current?.abort();applyAbortRef.current=undefined;operationRef.current=undefined;takesRef.current=[];setTakes([]);setStatus({state:'idle'});setError('');setFeedback('');setResolution('');setApplying(false);setAutomaticActive(false);setConfirmDiscard(false);
    const refresh=()=>{void navigator.mediaDevices?.enumerateDevices?.().then(items=>{if(generation===generationRef.current)setDevices(items.filter(item=>item.kind==='audioinput').map((item,index)=>({deviceId:item.deviceId,label:item.label||'Input '+(index+1)})));}).catch(()=>{if(generation===generationRef.current)setDevices([]);});};
    refresh();navigator.mediaDevices?.addEventListener?.('devicechange',refresh);
    return()=>{generationRef.current+=1;applyGenerationRef.current+=1;applyAbortRef.current?.abort();applyAbortRef.current=undefined;operationRef.current=undefined;navigator.mediaDevices?.removeEventListener?.('devicechange',refresh);void dispose();void stopPreview();};},[dispose,isOpen,stopPreview]);
  useEffect(()=>{const receipt=state.recordingCommitResult;if(!operationRef.current||receipt?.operationId!==operationRef.current)return;operationRef.current=undefined;setApplying(false);
    if(receipt.status==='rejected'){setError(receipt.error||'The project changed. No takes were added.');return;}
    const appliedIds=new Set(receipt.appliedIds||[]);updateTakes(current=>current.filter(take=>!appliedIds.has(take.id)));
    const appliedCount=receipt.appliedIds?.length||0,overflow=receipt.overflowCount||0,retained=receipt.retainedIds?.length||0;
    setFeedback(`${appliedCount} take${appliedCount===1?'':'s'} added${instrument==='drum'&&overflow?`; ${overflow} kept unassigned`:''}${retained?`; ${retained} retained in review`:''}.`);
  },[instrument,state.recordingCommitResult,updateTakes]);
  const usage=useCallback(()=>({count:takesRef.current.length,bytes:takesRef.current.reduce((sum,take)=>{const pcm=take.frames*take.channels*4;return sum+pcm+24+pcm;},0)}),[]);
  const makeSession=(generation:number)=>new CaptureSession({mediaDevices:navigator.mediaDevices,workletUrl:captureWorkletUrl,
    createContext:rate=>new AudioContext(rate?{sampleRate:rate}:undefined),createWorkletNode:(context,options)=>new AudioWorkletNode(context,'op-patchstudio-capture',options),
    capture:{mode,thresholdDb,hysteresisDb,preRollSeconds:preRoll,silenceSeconds:silenceStop,rearmSeconds:.25,maxSeconds:durationLimit},getRetainedUsage:usage,
    onStatus:value=>{if(generation===generationRef.current)setStatus(value);},onError:value=>{if(generation===generationRef.current)setError(value);},onTake:async take=>{if(generation!==generationRef.current)throw new DOMException('Recording closed','AbortError');const existing=takesRef.current;if(existing.length>=32)throw new Error('The review tray is full.');
      let rootNote=60;
      if(instrument==='multisample'){
        const explicitRoot=target.kind==='multisample'&&target.rootNote!==undefined&&existing.length===0?target.rootNote:undefined,start=target.kind==='multisample'?(target.rootNote??60):60;
        const proposed=explicitRoot??proposeUnusedRootNotes(stateRef.current.multisampleFiles,1,start,existing.map(item=>item.rootNote))[0];
        if(proposed===undefined)throw new Error('All MIDI root notes are already reserved. Remove or apply a reviewed take before recording another.');rootNote=proposed;
      }
      if(generation===generationRef.current)updateTakes(current=>[...current,{...take,name:'Take '+(current.length+1),selected:true,rootNote,warnings:[]}]);}});
  const makeAutomaticCapture=useCallback((callbacks:AutoCaptureCallbacks)=>{const generation=generationRef.current;return new CaptureSession({mediaDevices:navigator.mediaDevices,workletUrl:captureWorkletUrl,
    createContext:rate=>new AudioContext(rate?{sampleRate:rate}:undefined),createWorkletNode:(context,options)=>new AudioWorkletNode(context,'op-patchstudio-capture',options),
    capture:{mode:'manual',preRollSeconds:0,maxSeconds:20},getRetainedUsage:usage,onStatus:value=>{callbacks.onStatus(value);if(generation===generationRef.current)setStatus(value);},onError:value=>{callbacks.onError(value);if(generation===generationRef.current)setError(value);},onTake:callbacks.onTake});},[usage]);
  const retainAutomaticTake=useCallback((result:AutoSampleResult,replaceRoot:boolean)=>{if(generationRef.current<1)return;updateTakes(current=>{const review:ReviewTake={...result.take,name:`MIDI ${result.rootNote}`,rootNote:result.rootNote,selected:result.selected,warnings:result.warnings};if(replaceRoot){const existing=current.findIndex(take=>take.rootNote===result.rootNote);if(existing>=0){const next=[...current];next[existing]=review;return next;}}return[...current,review];});},[updateTakes]);
  const enable=async()=>{if(!supported){setError('Recording requires a supported browser on HTTPS; import an audio file instead.');return;}const generation=generationRef.current;setError('');await stopPreview();if(generation!==generationRef.current)return;await dispose();if(generation!==generationRef.current)return;
    const session=makeSession(generation);sessionRef.current=session;const enabled=await session.enableInput(deviceId);if(generation!==generationRef.current){await session.dispose();if(sessionRef.current===session)sessionRef.current=undefined;return;}if(enabled){const found=await session.enumerateInputs();if(generation===generationRef.current&&found.length)setDevices(found);}};
  const start=async(kind:'start'|'arm')=>{const generation=generationRef.current;await stopPreview();if(generation!==generationRef.current)return;if(!sessionRef.current)await enable();if(generation!==generationRef.current)return;try{if(kind==='arm')sessionRef.current?.arm();else sessionRef.current?.start();}catch(reason){setError(reason instanceof Error?reason.message:'Recording could not start.');}};
  const stop=async()=>{const owned=sessionRef.current;if(!owned)return;await owned.stop();if(sessionRef.current===owned)sessionRef.current=undefined;};
  const audition=async(take:ReviewTake)=>{const generation=generationRef.current,previewGeneration=++previewGenerationRef.current;setPreviewActive(true);await releasePreview(false);if(generation!==generationRef.current||previewGeneration!==previewGenerationRef.current)return;if(sessionRef.current&&['armed','recording','waiting-for-quiet'].includes(sessionRef.current.status.state))await stop();if(generation!==generationRef.current||previewGeneration!==previewGenerationRef.current)return;
    const context=new AudioContext();pendingPreviewContextsRef.current.add(context);
    try{await context.resume();pendingPreviewContextsRef.current.delete(context);if(generation!==generationRef.current||previewGeneration!==previewGenerationRef.current){await context.close().catch(()=>undefined);return;}const source=context.createBufferSource();source.buffer=take.audioBuffer;source.connect(context.destination);const owned={context,source,id:take.id};previewRef.current=owned;source.onended=()=>{if(previewRef.current!==owned)return;previewRef.current=undefined;source.onended=null;source.disconnect();setPreviewActive(false);void context.close().catch(()=>undefined);};source.start();}catch(reason){pendingPreviewContextsRef.current.delete(context);await context.close().catch(()=>undefined);if(generation===generationRef.current&&previewGeneration===previewGenerationRef.current)setError(reason instanceof Error?reason.message:'Preview could not start.');setPreviewActive(!!previewRef.current||pendingPreviewContextsRef.current.size>0);}};
  const apply=async()=>{if(automaticActive)return;if(occupied&&!resolution){setError('Choose how to resolve the occupied recording target.');return;}if(resolution==='cancel')return;const generation=generationRef.current,applyGeneration=++applyGenerationRef.current;applyAbortRef.current?.abort();const controller=new AbortController();applyAbortRef.current=controller;setApplying(true);await stopPreview();if(generation!==generationRef.current||applyGeneration!==applyGenerationRef.current)return;await stop();if(generation!==generationRef.current||applyGeneration!==applyGenerationRef.current)return;const selected=takesRef.current.filter(take=>take.selected);if(!selected.length){if(applyGeneration===applyGenerationRef.current){applyAbortRef.current=undefined;setApplying(false);}return;}
    const effective:RecordingTarget=target.kind==='drum'?(resolution==='choose-empty'?{kind:'drum',decision:'choose-empty'}:{...target,decision:resolution==='replace'?'replace':target.decision}):{...target,decision:resolution==='replace'?'replace':resolution==='choose-free'?'choose-free':target.decision};
    setError('');try{const prepared=await prepareRecordingApplication({instrument,takes:selected.map((take,index)=>({id:take.id,name:take.name,audioBuffer:take.audioBuffer,rootNote:effective.kind==='multisample'&&effective.decision==='replace'&&index===0&&effective.rootNote!==undefined?effective.rootNote:take.rootNote})),state:stateRef.current,target:effective,signal:controller.signal});
      if(generation!==generationRef.current||applyGeneration!==applyGenerationRef.current)return;applyAbortRef.current=undefined;const operationId=crypto.randomUUID();operationRef.current=operationId;dispatch({type:'COMMIT_PREPARED_RECORDINGS',payload:{operationId,prepared}});
    }catch(reason){if(generation===generationRef.current&&applyGeneration===applyGenerationRef.current){applyAbortRef.current=undefined;setApplying(false);setError(reason instanceof Error?reason.message:'Takes could not be prepared.');}}};
  if(!isOpen)return null;
  const active=['requesting-permission','armed','recording','waiting-for-quiet'].includes(status.state),configured=!!sessionRef.current,used=usage();
  return <div onMouseDown={event=>{if(event.target===event.currentTarget)requestClose();}} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:16}}>
    <section ref={dialogRef} data-recording-modal="true" role="dialog" aria-modal="true" aria-labelledby="record-takes-title" tabIndex={-1} style={{background:'var(--color-bg-primary, #fff)',color:'var(--color-text-primary, #222)',width:'min(760px, 100%)',maxHeight:'94vh',overflow:'auto',padding:20,borderRadius:8}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}><h2 id="record-takes-title">Record takes</h2><div style={{display:'flex',gap:8}}><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('opstudio-open-help',{detail:'capture'}))} style={button}>Recording help</button><button data-initial-focus="true" aria-label="Close" onClick={requestClose} style={button}>Close</button></div></div>
      {confirmDiscard&&<div role="alertdialog" aria-label="Discard recording work" style={{...box,marginBottom:12,borderColor:'var(--studio-warning)'}}><strong>Discard recording work?</strong><p>Recording will stop and any takes still in review will be lost. Added takes stay in the project.</p><div style={{display:'flex',gap:8}}><button ref={resumeRef} type="button" onClick={()=>setConfirmDiscard(false)} style={button}>Resume recording</button><button type="button" onClick={close} style={button}>Stop and discard</button></div></div>}
      <p>Browser-delivered mono/stereo PCM. Input processing is requested off; actual settings appear after permission. Maximum take: {durationLimit} seconds.</p>
      {!supported&&<p role="alert">Recording requires a supported browser on HTTPS; import an audio file instead.</p>}
      <div style={{...box,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
        <label>Input device<select aria-label="Input device" value={deviceId} disabled={configured||automaticActive} onChange={e=>{setDeviceId(e.target.value);setAudioSelectionVersion(value=>value+1);}} style={{...button,width:'100%'}}><option value="">Default input</option>{devices.map(device=><option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label>
        <label>Capture mode<select aria-label="Capture mode" value={mode} disabled={configured||automaticActive} onChange={e=>setMode(e.target.value as 'manual'|'sound')} style={{...button,width:'100%'}}><option value="manual">Manual</option><option value="sound">Sound triggered</option></select></label>
        <Numeric label="Maximum take length" value={durationLimit} min={1} max={20} step={1} disabled={configured||automaticActive} set={setDurationLimit}/>
        {mode==='sound'&&<><Numeric label="Trigger threshold" value={thresholdDb} min={-72} max={-6} step={1} disabled={configured||automaticActive} set={setThresholdDb}/><Numeric label="Trigger hysteresis" value={hysteresisDb} min={3} max={24} step={1} disabled={configured||automaticActive} set={setHysteresisDb}/><Numeric label="Pre-roll" value={preRoll} min={0} max={2} step={.05} disabled={configured||automaticActive} set={setPreRoll}/><Numeric label="Silence stop" value={silenceStop} min={.1} max={5} step={.1} disabled={configured||automaticActive} set={setSilenceStop}/></>}
      </div>
      <p aria-live="polite"><strong>State:</strong> {status.state}. {status.sampleRate?status.sampleRate+' Hz, '+(status.channels||'unknown')+' channels. '+(status.settingsReported?'Input rate reported by the browser. ':'Input rate was not reported; capture context rate shown. '):''}Level {Math.round(Math.max(0,...(status.peaks||[0]))*100)}%. Take time {((status.elapsedFrames||0)/(status.sampleRate||1)).toFixed(2)} s.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>void enable()} disabled={!supported||active||automaticActive} style={button}>Enable input</button><button onClick={()=>void start('start')} disabled={automaticActive||mode!=='manual'||status.state==='recording'} style={button}>Start recording</button><button onClick={()=>void start('arm')} disabled={automaticActive||mode!=='sound'||active} style={button}>Arm sound trigger</button><button onClick={()=>void stop()} disabled={!sessionRef.current||automaticActive} style={button}>Stop recording</button><button onClick={()=>void stopPreview()} disabled={!previewActive||automaticActive} style={button}>Stop preview</button></div>
      {instrument==='multisample'&&<AutoSamplingPanel audioDeviceId={deviceId} audioDevices={devices} audioSelectionVersion={audioSelectionVersion} onAudioDeviceChange={setDeviceId} disabled={!supported||active||configured||previewActive||applying} retainedCount={used.count} retainedBytes={used.bytes} existingRoots={[...state.multisampleFiles.map(file=>file.rootNote),...takes.map(take=>take.rootNote)]} createCapture={makeAutomaticCapture} onTake={retainAutomaticTake} onRunningChange={setAutomaticActive}/>} 
      {error&&<p role="alert">{error}</p>}{feedback&&<p role="status">{feedback}</p>}
      <h3>Review tray</h3><p>{takes.length}/{RECORDING_LIMITS.takes} takes · {Math.min(100,Math.round(used.bytes/RECORDING_LIMITS.ownedBytes*100))}% of 256 MiB</p>
      {!takes.length?<p>No takes yet. The project changes only after Add selected takes.</p>:takes.map(take=><div key={take.id} role="group" aria-label={'Take '+take.name+' '+take.id} style={{...box,marginBottom:8,display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <label><input aria-label={'Select take '+take.id} type="checkbox" disabled={applying||automaticActive} checked={take.selected} onChange={e=>updateTakes(current=>current.map(item=>item.id===take.id?{...item,selected:e.target.checked}:item))}/> Select</label>
        <label>Name<input aria-label={'Name for take '+take.id} disabled={applying||automaticActive} value={take.name} onChange={e=>updateTakes(current=>current.map(item=>item.id===take.id?{...item,name:e.target.value}:item))} style={button}/></label>
        {instrument==='multisample'&&<Numeric label={'Root note for take '+take.id} value={take.rootNote} min={0} max={127} step={1} disabled={applying||automaticActive} set={value=>updateTakes(current=>current.map(item=>item.id===take.id?{...item,rootNote:value}:item))}/>} 
        <button aria-label={'Audition take '+take.id} disabled={applying||automaticActive} onClick={()=>void audition(take)} style={button}>Audition</button><button aria-label={'Remove take '+take.id} disabled={applying||automaticActive} onClick={()=>{void stopPreview();updateTakes(current=>current.filter(item=>item.id!==take.id));}} style={button}>Remove</button>{take.warnings?.map(warning=><span key={warning} role="alert">{warning} Retry this MIDI note before selecting it.</span>)}
      </div>)}
      {occupied&&<fieldset disabled={automaticActive||applying}><legend>Occupied target</legend><p>Replacement approval is bound to the current target sample.</p><label><input type="radio" name="resolution" onChange={()=>{setResolution('replace');if(target.kind==='multisample'&&target.rootNote!==undefined)updateTakes(current=>{const first=current.find(item=>item.selected);return first?current.map(take=>take.id===first.id?{...take,rootNote:target.rootNote!}:take):current;});}}/> Replace</label>{' '}<label><input type="radio" name="resolution" onChange={()=>{setResolution(target.kind==='drum'?'choose-empty':'choose-free');if(target.kind==='multisample'){updateTakes(current=>{const first=current.find(item=>item.selected);if(!first)return current;const reserved=current.filter(item=>item.id!==first.id).map(item=>item.rootNote),note=proposeUnusedRootNotes(stateRef.current.multisampleFiles,1,target.rootNote??60,reserved)[0];if(note===undefined){setError('All MIDI root notes are already reserved. Remove a reviewed take or choose Replace.');return current;}return current.map(take=>take.id===first.id?{...take,rootNote:note}:take);});}}}/> Choose {target.kind==='drum'?'empty pad':'free note'}</label>{' '}<label><input type="radio" name="resolution" onChange={()=>setResolution('cancel')}/> Cancel</label></fieldset>}
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}><button onClick={requestClose} style={button}>Cancel</button><button onClick={()=>void apply()} disabled={automaticActive||applying||!takes.some(take=>take.selected)||resolution==='cancel'} style={button}>{applying?'Preparing takes…':'Add selected takes'}</button></div>
    </section></div>;
}

function Numeric({label,value,min,max,step,set,disabled=false}:{label:string;value:number;min:number;max:number;step:number;set:(value:number)=>void;disabled?:boolean}) {
  return <label>{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event=>set(Number(event.target.value))} style={{...button,width:'100%',boxSizing:'border-box'}}/></label>;
}
export type {RecordingTarget};

```

## SOURCE src/components/common/StudioShell.tsx
```
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';
import { MainTabs } from './MainTabs';
import { ProjectToolbar } from './ProjectToolbar';

type View = 'start' | 'source' | 'setup' | 'manage' | 'workspace';
type Task = 'multisample' | 'sample' | 'drum';
type Source = 'hardware' | 'software';
type Topic = 'overview' | 'hardware' | 'software' | 'capture' | 'library' | 'backup';
type Tab = 'drum' | 'multisample' | 'library';

const topics: { id: Topic; title: string; body: string }[] = [
  { id: 'overview', title: 'Choose a task', body: 'Start with a synth or drum kit. Each setup opens an existing editor where you can import audio, record takes, shape sounds, and export an OP-XY preset.' },
  { id: 'hardware', title: 'Hardware synth connections', body: 'Connect synth audio to an input the browser can use. For automatic multisampling, also connect a MIDI output to the synth. Select the matching input, enable MIDI, check one note, then capture a range. Manual and sound-triggered recording are also available.' },
  { id: 'software', title: 'Software synth connections', body: 'Keep the instrument in your DAW. Route DAW audio to a browser input through a virtual audio route or an audio interface. For automatic multisampling, also route browser MIDI to the DAW through a virtual MIDI port. The browser does not host the plugin. Check one note before recording a range.' },
  { id: 'capture', title: 'Recording and review', body: 'Enable an audio input before manual capture. Sound-triggered mode starts after the threshold is crossed. Automatic multisampling sends MIDI notes through the selected output. Captured takes stay in review until you add them to the project. Closing with pending work asks before discarding.' },
  { id: 'library', title: 'Library', body: 'Use Project → Save to library in an editor, then browse or search saved instruments in Library. The library is stored in this browser.' },
  { id: 'backup', title: 'Back up or transfer', body: 'Project → Download project saves one editable project archive. Project → Open project restores it. Export OP-XY creates a separate device preset ZIP. Extract that ZIP without changing its contents, copy the intact .preset folder to the OP-XY presets folder in MTP mode, eject, then load and listen on the device. The export dialog has the detailed transfer guide. Full-library backup and restore is not available yet.' },
];

function Help({ topic, setTopic, close }: { topic: Topic; setTopic: (topic: Topic) => void; close: () => void }) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  useOwnedDialog({ active: true, dialogRef, onClose: close });
  useEffect(() => { setQuery(''); }, [topic]);
  const matches = topics.filter(item => query.trim() ? `${item.title} ${item.body}`.toLowerCase().includes(query.trim().toLowerCase()) : item.id === topic);
  return <div className="studio-help-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <aside ref={dialogRef} className="studio-help-panel" role="dialog" aria-modal="true" aria-label="Help" tabIndex={-1}>
      <div className="studio-help-heading"><div><p className="studio-eyebrow">Help</p><h2>Studio guide</h2></div><button type="button" data-initial-focus="true" className="studio-button-secondary" onClick={close}>Close Help</button></div>
      <label className="studio-help-search">Search help<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <nav className="studio-help-topics" aria-label="Help topics">{topics.map(item => <button type="button" key={item.id} aria-current={item.id === topic ? 'page' : undefined} onClick={() => setTopic(item.id)}>{item.title}</button>)}</nav>
      <div className="studio-help-results">{matches.length ? matches.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.body}</p></article>) : <p>No guide matches this search.</p>}</div>
    </aside>
  </div>;
}

export function StudioShell({ onRetrySave }: { onRetrySave?: () => void | Promise<void> }) {
  const { state, dispatch } = useAppContext();
  const [view, setView] = useState<View>('start');
  const [task, setTask] = useState<Task>('multisample');
  const [source, setSource] = useState<Source>('hardware');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [notice, setNotice] = useState('');
  const pendingRecording = useRef<{ tab: Tab; focus: 'manual' | 'automatic' } | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const guard = useCallback((action: () => void) => {
    const recorder = document.querySelector<HTMLElement>('[data-recording-modal="true"]');
    if (recorder) { setNotice('Finish or close Record takes before changing workspaces. Your review takes remain here.'); recorder.focus(); return false; }
    setNotice(''); action(); return true;
  }, []);
  const openHelp = useCallback((next: Topic) => setTopic(next), []);
  useEffect(() => {
    const listener = (event: Event) => openHelp((event as CustomEvent<Topic>).detail || 'capture');
    window.addEventListener('opstudio-open-help', listener);
    return () => window.removeEventListener('opstudio-open-help', listener);
  }, [openHelp]);
  useEffect(() => {
    const ready = (event: Event) => {
      const instrument = (event as CustomEvent<Tab>).detail;
      if (pendingRecording.current?.tab !== instrument) return;
      const focus = pendingRecording.current.focus;
      pendingRecording.current = null;
      document.querySelector<HTMLButtonElement>('[data-studio-open-recording="' + instrument + '"]')?.click();
      requestAnimationFrame(() => {
        const control = document.querySelector<HTMLElement>(focus === 'automatic' ? '[data-studio-automatic-panel]' : '[data-recording-modal="true"] [aria-label="Capture mode"]');
        control?.scrollIntoView({ block: 'center' });
        control?.focus({ preventScroll: true });
      });
    };
    window.addEventListener('opstudio-workspace-ready', ready);
    return () => window.removeEventListener('opstudio-workspace-ready', ready);
  }, []);
  useEffect(() => {
    if (view === 'workspace') return;
    if (document.querySelector('[data-recording-modal="true"]')) return;
    const frame = requestAnimationFrame(() => {
      const heading = contentRef.current?.querySelector<HTMLElement>('h1');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, state.currentTab]);
  const workspace = (tab: Tab, record = false) => guard(() => { pendingRecording.current = record ? { tab, focus: task === 'multisample' && tab === 'multisample' ? 'automatic' : 'manual' } : null; dispatch({ type: 'SET_TAB', payload: tab }); setView('workspace'); });
  const chooseTask = (chosen: Task) => guard(() => { setTask(chosen); setView(chosen === 'drum' ? 'setup' : 'source'); });
  const context: Topic = view === 'manage' ? 'backup' : view === 'source' || view === 'setup' ? task === 'drum' ? 'capture' : source : view === 'workspace' ? state.currentTab === 'library' ? 'library' : 'capture' : 'overview';
  const title = view === 'workspace' ? state.currentTab === 'multisample' ? 'Multisample editor' : state.currentTab === 'drum' ? 'Drum kit editor' : state.currentTab === 'library' ? 'Library' : state.currentTab === 'feedback' ? 'Feedback' : 'Support' : view === 'source' ? 'Choose source' : view === 'setup' ? 'Set up' : view === 'manage' ? 'Back up or transfer' : 'Start';
  return <div className="studio-shell">
    <aside className="studio-shell-sidebar" aria-label="Studio navigation">
      <div className="studio-shell-brand"><strong>OP–PatchStudio</strong><small>Unofficial preset studio</small></div>
      <nav className="studio-shell-nav" aria-label="Workspace"><span>WORKSPACE</span>
        <button type="button" aria-current={view === 'start' ? 'page' : undefined} onClick={() => guard(() => setView('start'))}>Start</button>
        <button type="button" aria-current={view === 'source' || view === 'setup' ? 'page' : undefined} onClick={() => guard(() => setView('start'))}>Create</button>
        <button type="button" aria-current={view === 'workspace' && state.currentTab === 'library' ? 'page' : undefined} onClick={() => workspace('library')}>Library</button>
        <button type="button" aria-current={view === 'manage' ? 'page' : undefined} onClick={() => guard(() => setView('manage'))}>Back up or transfer</button>
      </nav>
      <nav className="studio-shell-nav" aria-label="Tools"><span>TOOLS</span>
        <button type="button" aria-current={view === 'workspace' && state.currentTab === 'multisample' ? 'page' : undefined} onClick={() => workspace('multisample')}>Multisample editor</button>
        <button type="button" aria-current={view === 'workspace' && state.currentTab === 'drum' ? 'page' : undefined} onClick={() => workspace('drum')}>Drum kit editor</button>
        <button type="button" onClick={() => openHelp(context)}>Help</button>
      </nav>
      <p className="studio-shell-side-note">Your project saves locally in this browser. Download a project archive to keep an editable copy.</p>
    </aside>
    <div className="studio-shell-main"><div className="studio-shell-topbar"><span>Studio / <strong>{title}</strong></span><button type="button" className="studio-button-secondary" onClick={() => openHelp(context)}>Help</button></div>
      <main className="studio-shell-content" ref={contentRef}>
        {notice && <p role="alert" className="studio-message studio-message-warning">{notice}</p>}
        {view === 'start' && <><p className="studio-eyebrow">Create a sound</p><h1>What would you like to make?</h1><p className="studio-shell-lead">Choose a path, then continue in an editor. Import audio, record takes, shape the sound, and export a preset.</p>
          <div className="studio-start-grid">
            <button type="button" className="studio-start-card" onClick={() => chooseTask('multisample')}><span className="studio-card-glyph">♬</span><strong>Multisample a synth</strong><small>Capture a series of notes and map them to a playable instrument.</small><span>Get started →</span></button>
            <button type="button" className="studio-start-card" onClick={() => chooseTask('sample')}><span className="studio-card-glyph">◉</span><strong>Sample a synth</strong><small>Choose hardware or software, then record a sound and map it across notes.</small><span>Get started →</span></button>
            <button type="button" className="studio-start-card" onClick={() => chooseTask('drum')}><span className="studio-card-glyph">▦</span><strong>Build a drum kit</strong><small>Add or record sounds, arrange pads, and export a kit.</small><span>Get started →</span></button>
          </div><h2 className="studio-section-title">Your sounds</h2><div className="studio-start-secondary"><button type="button" onClick={() => workspace('library')}>Open library <span>Browse saved instruments →</span></button><button type="button" onClick={() => guard(() => setView('manage'))}>Back up or transfer <span>Keep an editable project copy →</span></button></div>
        </>}
        {view === 'source' && <><button type="button" className="studio-back-link" onClick={() => guard(() => setView('start'))}>← Back to Start</button><p className="studio-eyebrow">{task === 'sample' ? 'Sample a synth' : 'Multisample a synth'}</p><h1>Where is your synth?</h1><p className="studio-shell-lead">Choose the setup that matches where your sound comes from.</p>
          <div className="studio-source-grid"><button type="button" className="studio-start-card" aria-pressed={source === 'hardware'} onClick={() => setSource('hardware')}><strong>Hardware synth</strong><small>Connect audio to your computer; add MIDI output for automatic note capture.</small></button><button type="button" className="studio-start-card" aria-pressed={source === 'software'} onClick={() => setSource('software')}><strong>Software synth</strong><small>Run it in your DAW. Route audio to a browser input; add virtual MIDI for automatic note capture.</small></button></div>
          <div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={() => guard(() => setView('setup'))}>Continue to setup</button><button type="button" className="studio-button-secondary" onClick={() => openHelp(source)}>Connection help</button></div>
        </>}
        {view === 'setup' && <><button type="button" className="studio-back-link" onClick={() => guard(() => setView(task === 'drum' ? 'start' : 'source'))}>← Back</button><p className="studio-eyebrow">{task === 'drum' ? 'Build a drum kit' : task === 'sample' ? 'Sample a synth' : 'Multisample a synth'}</p><h1>{task === 'drum' ? 'Build your kit' : source === 'software' ? 'Route your software synth' : 'Connect your hardware synth'}</h1>
          <p className="studio-shell-lead">{task === 'drum' ? 'Add audio or record sounds into pads. The drum editor includes slicing, pad mapping, sound shaping, and export.' : task === 'sample' ? source === 'software' ? 'Keep the instrument in your DAW. Bring its audio to a browser input using a virtual audio route or audio interface. MIDI is optional for recording a single sound.' : 'Connect synth audio to a browser input. MIDI is optional for recording a single sound.' : source === 'software' ? 'Keep the instrument in your DAW. Virtual MIDI sends notes to it; a virtual audio route or interface brings its sound into the browser.' : 'Connect synth audio to a browser input and browser MIDI output to the synth.'}</p>
          <div className="studio-setup-panel"><h2>Before recording</h2><ol>{task === 'drum' ? <><li>Choose a pad or use the next empty pad.</li><li>Select a browser audio input in Record takes.</li><li>Review your take before adding it to the kit.</li></> : task === 'sample' ? <><li>Route your synth audio to a browser input.</li><li>Choose that input in Record takes and use Manual or Sound triggered capture.</li><li>Listen to the take, then add it to the instrument. MIDI is optional.</li></> : <><li>Make MIDI and audio routes point to the same instrument.</li><li>Choose the matching input and output in Record takes.</li><li>Check one note, listen, then capture a range.</li></>}</ol><div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={() => workspace(task === 'drum' ? 'drum' : 'multisample', true)}>Open editor and Record takes</button><button type="button" className="studio-button-secondary" onClick={() => workspace(task === 'drum' ? 'drum' : 'multisample')}>Open editor to import audio</button><button type="button" className="studio-button-secondary" onClick={() => openHelp(context)}>Setup help</button></div></div>
        </>}
        {view === 'manage' && <><p className="studio-eyebrow">Keep your work</p><h1>Back up or transfer</h1><p className="studio-shell-lead">An editable project, a saved library entry, and an OP-XY device preset are separate things.</p><div className="studio-manage-grid">
          <article><h2>Editable project archive</h2><p>In an editor, Project → Download project saves the current project with audio and settings. Project → Open project restores one archive.</p><button type="button" className="studio-button-primary" onClick={() => workspace(state.currentTab === 'multisample' ? 'multisample' : 'drum')}>Open project controls</button></article>
          <article><h2>Saved library</h2><p>Project → Save to library stores the current instrument in this browser. Full-library backup and restore is not available yet.</p><button type="button" className="studio-button-secondary" onClick={() => workspace('library')}>Open library</button></article>
          <article><h2>OP-XY preset ZIP</h2><p>Export OP-XY prepares a device preset ZIP. Extract it, copy the intact .preset folder to the OP-XY presets folder in MTP mode, eject, then load and listen on the device. The export dialog provides detailed transfer steps.</p><button type="button" className="studio-button-secondary" onClick={() => workspace(state.currentTab === 'multisample' ? 'multisample' : 'drum')}>Open export controls</button></article>
        </div></>}
        {view === 'workspace' && <>{(state.currentTab === 'drum' || state.currentTab === 'multisample') && <ProjectToolbar onRetrySave={onRetrySave} />}<MainTabs /></>}
      </main>
    </div>
    {topic && <Help topic={topic} setTopic={setTopic} close={() => setTopic(null)} />}
  </div>;
}

```

## SOURCE src/components/common/ProjectToolbar.tsx
```
import { useEffect, useRef, useState } from 'react';
import { useAppContext, useProjectHistory } from '../../context/AppContext';
import { saveDrumSettingsAsDefault, saveMultisampleSettingsAsDefault } from '../../utils/defaultSettings';
import { savePresetToLibrary } from '../../utils/libraryUtils';
import { createProjectSnapshot } from '../../utils/projectSerialization';
import { exportProjectArchive, importProjectArchive, projectArchiveFilename } from '../../utils/projectArchive';
import { ExportPreflight } from './ExportPreflight';

interface ProjectToolbarProps { onRetrySave?: () => void | Promise<void> }

export function ProjectToolbar({ onRetrySave }: ProjectToolbarProps) {
  const { state, dispatch } = useAppContext();
  const { canUndo, canRedo, historyLimited } = useProjectHistory();
  const backupInput = useRef<HTMLInputElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const projectMenu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState<'download' | 'open' | 'library' | null>(null);
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const instrument = state.currentTab === 'multisample' ? 'multisample' : 'drum';
  const settings = instrument === 'drum' ? state.drumSettings : state.multisampleSettings;

  useEffect(() => {
    const open = () => setShowPreflight(true);
    window.addEventListener('opstudio-open-export', open);
    return () => window.removeEventListener('opstudio-open-export', open);
  }, []);

  const downloadProject = async () => {
    const snapshot = createProjectSnapshot(state);
    const filename = projectArchiveFilename(state);
    setBusy('download'); setMessage(null);
    try {
      const archive = await exportProjectArchive(snapshot);
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage({ kind: 'status', text: `Downloaded project backup ${filename}` });
    } catch (error) {
      setMessage({ kind: 'error', text: `Could not download project: ${error instanceof Error ? error.message : 'unknown error'}` });
    } finally { setBusy(null); }
  };

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    setBusy('open'); setMessage(null);
    try {
      const project = await importProjectArchive(file);
      dispatch({ type: 'IMPORT_PROJECT', payload: project });
      setMessage({ kind: 'status', text: `Opened project backup ${file.name}` });
    } catch (error) {
      setMessage({ kind: 'error', text: `Could not open project: ${error instanceof Error ? error.message : 'unknown error'}. Your current project was kept.` });
    } finally {
      setBusy(null);
      if (backupInput.current) backupInput.current.value = '';
    }
  };

  const saveLibrary = async () => {
    setBusy('library'); setMessage(null);
    const result = await savePresetToLibrary(state, settings.presetName, instrument);
    setBusy(null);
    setMessage(result.success
      ? { kind: 'status', text: `Saved ${settings.presetName} to the library.` }
      : { kind: 'error', text: result.error ?? 'Could not save to the library.' });
  };

  const saveDefault = () => {
    const result = instrument === 'drum'
      ? saveDrumSettingsAsDefault(state.drumSettings, state.importedDrumPreset)
      : saveMultisampleSettingsAsDefault(state.multisampleSettings, state.importedMultisamplePreset);
    setMessage(result.success
      ? { kind: 'status', text: `Saved current ${instrument} settings as the default.` }
      : { kind: 'error', text: result.error ?? `Could not save ${instrument} defaults.` });
  };

  const saveStatus = state.sessionSaveStatus === 'checking' ? 'Checking saved work…'
    : state.sessionSaveStatus === 'saving' ? 'Saving…'
      : state.sessionSaveStatus === 'saved' ? 'Saved locally'
        : state.sessionSaveStatus === 'error' ? 'Save failed · Retry'
          : 'Unsaved changes';

  return <section aria-label="Instrument project controls" className="studio-toolbar">
    <div className="studio-toolbar-main">
      <label className="studio-name-field" htmlFor="instrument-name">
        <span>Instrument name</span>
        <input id="instrument-name" value={settings.presetName} onChange={event => dispatch(instrument === 'drum'
          ? { type: 'SET_DRUM_PRESET_NAME', payload: event.target.value }
          : { type: 'SET_MULTISAMPLE_PRESET_NAME', payload: event.target.value })} />
      </label>
      <div className="studio-save-state" role="status" title={state.sessionSaveError ?? undefined}>{saveStatus}</div>
      {state.sessionSaveStatus === 'error' && <button type="button" className="studio-button-secondary" onClick={() => void onRetrySave?.()}>Retry save</button>}
      <div className="studio-toolbar-actions">
        <button type="button" className="studio-button-secondary" disabled={!canUndo || busy !== null} onClick={() => dispatch({ type: 'UNDO' })} title="Undo (Ctrl/Cmd+Z)">Undo</button>
        <button type="button" className="studio-button-secondary" disabled={!canRedo || busy !== null} onClick={() => dispatch({ type: 'REDO' })} title="Redo (Shift+Ctrl/Cmd+Z)">Redo</button>
        <details ref={projectMenu} className="studio-project-menu">
          <summary>Project</summary>
          <div className="studio-project-menu-popover" onClick={event => { if (event.target instanceof HTMLButtonElement && projectMenu.current) projectMenu.current.open = false; }}>
            <button type="button" disabled={busy !== null} onClick={() => void saveLibrary()}>Save to library</button>
            <button type="button" disabled={busy !== null} onClick={() => void downloadProject()}>Download project</button>
            <button type="button" disabled={busy !== null} onClick={() => backupInput.current?.click()}>Open project</button>
            <button type="button" onClick={saveDefault}>Save settings as default</button>
            <button type="button" onClick={() => { if (!document.querySelector('[data-recording-modal="true"]')) dispatch({ type: 'SET_TAB', payload: 'library' }); }}>Open library</button>
          </div>
        </details>
        <input ref={backupInput} aria-label="Project backup file" hidden type="file" accept=".opstudio,application/vnd.op-patchstudio.project+zip,application/zip" onChange={event => void openProject(event.target.files?.[0])} />
        <button ref={exportButton} type="button" className="studio-button-primary" onClick={() => setShowPreflight(true)}>Export OP-XY</button>
      </div>
    </div>
    <small>Project backup keeps editable audio and settings; device patch export is separate.</small>
    {historyLimited && <div role="status">Earlier undo steps were discarded to keep memory use bounded.</div>}
    {message && <div role={message.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{message.text}</div>}
    {showPreflight && <ExportPreflight instrument={instrument} onClose={() => setShowPreflight(false)} returnFocus={exportButton.current} />}
  </section>;
}

```

## SOURCE src/audio/recording/autoSampler.ts
```
import type {CaptureStatus,SessionTake} from './captureSession';

export const AUTO_SAMPLE_LIMITS={notes:24,captureSeconds:20} as const;

export interface AutoSampleSettings {
  startNote:number;endNote:number;step:number;velocity:number;channel:number;
  holdSeconds:number;tailSeconds:number;settleSeconds:number;readinessTimeoutSeconds:number;
}
export interface AutoCaptureCallbacks {onStatus:(status:CaptureStatus)=>void;onTake:(take:SessionTake)=>void;onError:(message:string)=>void}
export interface AutoCapture {enableInput:(deviceId:string)=>Promise<boolean>;start:()=>void;stop:()=>Promise<void>;dispose:()=>Promise<void>}
export interface AutoSampleMidiOutput {isConnected:()=>boolean;noteOn:(note:number,velocity:number,channel:number)=>void;noteOff:(note:number,channel:number)=>void}
export interface AutoSampleResult {take:SessionTake;rootNote:number;selected:boolean;warnings:string[]}
interface Dependencies {
  createCapture:(callbacks:AutoCaptureCallbacks)=>AutoCapture;
  midi:AutoSampleMidiOutput;
  sleep?:(ms:number)=>Promise<void>;
  onTake?:(result:AutoSampleResult)=>void;
  onProgress?:(completed:number,total:number,note:number)=>void;
  onError?:(message:string)=>void;
}

function integer(name:string,value:number,min:number,max:number){if(!Number.isFinite(value)||!Number.isInteger(value)||value<min||value>max)throw new Error(`${name} must be a whole number from ${min} to ${max}.`);}
function seconds(name:string,value:number,min=0){if(!Number.isFinite(value)||value<min)throw new Error(`${name} must be at least ${min} seconds.`);}
export function noteSequence(settings:Pick<AutoSampleSettings,'startNote'|'endNote'|'step'>){
  integer('Start note',settings.startNote,0,127);integer('End note',settings.endNote,0,127);integer('Step',settings.step,1,127);if(settings.startNote>settings.endNote)throw new Error('The note range must run from a lower note to a higher note.');
  const notes:number[]=[];for(let note=settings.startNote;note<=settings.endNote&&notes.length<=AUTO_SAMPLE_LIMITS.notes;note+=settings.step)notes.push(note);return notes;
}
export function validateAutoSampleSettings(settings:AutoSampleSettings){
  integer('Start note',settings.startNote,0,127);integer('End note',settings.endNote,0,127);integer('Step',settings.step,1,127);integer('Velocity',settings.velocity,1,127);integer('Channel',settings.channel,1,16);
  if(settings.startNote>settings.endNote)throw new Error('The note range must run from a lower note to a higher note.');
  seconds('Hold time',settings.holdSeconds);seconds('Release tail',settings.tailSeconds);seconds('Settling time',settings.settleSeconds);seconds('Readiness timeout',settings.readinessTimeoutSeconds,.1);
  const notes=noteSequence(settings);if(notes.length>AUTO_SAMPLE_LIMITS.notes)throw new Error(`Automatic capture is limited to ${AUTO_SAMPLE_LIMITS.notes} notes.`);
  if(settings.readinessTimeoutSeconds+settings.holdSeconds+settings.tailSeconds>AUTO_SAMPLE_LIMITS.captureSeconds)throw new Error('Readiness, hold and release tail must fit within the 20 seconds allowed for one capture.');
  return notes;
}

function inspectTake(take:SessionTake){let peak=0,clipped=0,total=0;for(let channel=0;channel<take.audioBuffer.numberOfChannels;channel+=1){const data=take.audioBuffer.getChannelData(channel);for(let frame=0;frame<take.frames;frame+=1){const value=Math.abs(data[frame]||0);peak=Math.max(peak,value);if(value>=.999)clipped+=1;total+=1;}}
  const warnings:string[]=[];if(peak<.001)warnings.push('Capture appears silent.');if(total>0&&clipped/total>=.01)warnings.push('Capture appears clipped.');return warnings;
}
function abortError(){return new DOMException('Automatic capture stopped.','AbortError');}

export class AutoSampler {
  private generation=0;
  private active?:{capture:AutoCapture;note?:number;channel:number};
  private runState?:{generation:number;abort:AbortController};
  private readonly deps:Dependencies;
  constructor(deps:Dependencies){this.deps=deps;}

  async run(settings:AutoSampleSettings,deviceId:string,onlyNote?:number){
    if(this.runState){this.deps.onError?.('Automatic capture is already running.');return;}
    const notes=onlyNote===undefined?validateAutoSampleSettings(settings):[onlyNote];if(onlyNote!==undefined){validateAutoSampleSettings({...settings,startNote:onlyNote,endNote:onlyNote});}
    const generation=++this.generation,runState={generation,abort:new AbortController()};this.runState=runState;
    try {
      for(let index=0;index<notes.length;index+=1){if(generation!==this.generation)throw abortError();const note=notes[index];const result=await this.captureNote(generation,note,settings,deviceId);if(generation!==this.generation)throw abortError();this.deps.onTake?.(result);this.deps.onProgress?.(index+1,notes.length,note);if(index<notes.length-1)await this.wait(settings.settleSeconds*1000,generation);}
    } catch(reason) {if(!(reason instanceof DOMException&&reason.name==='AbortError'))this.deps.onError?.(reason instanceof Error?reason.message:String(reason));}finally{if(this.runState===runState)this.runState=undefined;}
  }

  async cancel(){++this.generation;this.runState?.abort.abort();await this.cleanupActive();}
  outputDisconnected(){void this.cancel();}

  private async captureNote(generation:number,note:number,settings:AutoSampleSettings,deviceId:string):Promise<AutoSampleResult>{
    let candidate:SessionTake|undefined,captureError:string|undefined,readyResolve:(()=>void)|undefined;
    const ready=new Promise<void>(resolve=>{readyResolve=resolve});
    const capture=this.deps.createCapture({onStatus:status=>{if(generation===this.generation&&(status.elapsedFrames??0)>0)readyResolve?.();},onTake:take=>{if(generation===this.generation)candidate=take;},onError:message=>{if(generation!==this.generation)return;captureError=message;this.deps.onError?.(message);void this.cancel();}});
    this.active={capture,channel:settings.channel};
    try {
      if(!await capture.enableInput(deviceId))throw new Error('Audio input could not be enabled. Check permission and the selected device, then retry.');
      this.assertCurrent(generation);capture.start();
      await this.withTimeout(ready,settings.readinessTimeoutSeconds*1000,'No captured audio frames arrived before the readiness timeout.',generation);
      if(!this.deps.midi.isConnected())throw new Error('The selected MIDI output disconnected. Reconnect it, then retry.');
      this.deps.midi.noteOn(note,settings.velocity,settings.channel);this.active.note=note;
      await this.wait(settings.holdSeconds*1000,generation);
      this.releaseOwnedNote();
      await this.wait(settings.tailSeconds*1000,generation);
      await capture.stop();this.assertCurrent(generation);
      if(captureError)throw new Error(captureError);
      if(!candidate)throw new Error(`MIDI note ${note} did not produce a complete take.`);
      if(candidate.completionReason==='length')throw new Error(`MIDI note ${note} capture ended before its intended release tail.`);
      const warnings=inspectTake(candidate);return{take:candidate,rootNote:note,selected:warnings.length===0,warnings};
    } finally {this.releaseOwnedNote();await capture.dispose().catch(()=>undefined);if(this.active?.capture===capture)this.active=undefined;}
  }

  private assertCurrent(generation:number){if(generation!==this.generation)throw abortError();}
  private abortPromise(generation:number){const signal=this.runState?.generation===generation?this.runState.abort.signal:undefined;return new Promise<never>((_,reject)=>{if(!signal||signal.aborted){reject(abortError());return;}signal.addEventListener('abort',()=>reject(abortError()),{once:true});});}
  private async wait(ms:number,generation:number){if(ms>0)await Promise.race([(this.deps.sleep??(value=>new Promise(resolve=>window.setTimeout(resolve,value))))(ms),this.abortPromise(generation)]);this.assertCurrent(generation);}
  private async withTimeout(operation:Promise<void>,ms:number,message:string,generation:number){let timer:number|undefined;try{await Promise.race([operation,this.abortPromise(generation),new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(new Error(message)),ms);})]);this.assertCurrent(generation);}finally{if(timer!==undefined)window.clearTimeout(timer);}}
  private releaseOwnedNote(){const owned=this.active;if(owned?.note===undefined)return;const note=owned.note;owned.note=undefined;try{this.deps.midi.noteOff(note,owned.channel);}catch{/* disconnected output */}}
  private async cleanupActive(){const owned=this.active;this.releaseOwnedNote();await owned?.capture.dispose().catch(()=>undefined);if(this.active===owned)this.active=undefined;}
}

```

## SOURCE src/hooks/useOwnedDialog.ts
```
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const dialogStack:symbol[]=[];

function controls(dialog:HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(control=>!control.hidden&&control.getAttribute('aria-hidden')!=='true');
}

/** Gives a custom modal one topmost Escape owner, a focus loop, and trigger restoration. */
export function useOwnedDialog({active,dialogRef,onClose,returnFocus}:{active:boolean;dialogRef:RefObject<HTMLElement|null>;onClose:()=>void;returnFocus?:HTMLElement|null}) {
  const id=useRef(Symbol('owned-dialog'));
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const returnRef=useRef(returnFocus);returnRef.current=returnFocus;
  useEffect(()=>{
    if(!active)return;
    const token=id.current,previous=returnRef.current??(document.activeElement instanceof HTMLElement?document.activeElement:null);
    const previousId=previous?.id;
    dialogStack.push(token);
    const dialog=dialogRef.current;
    queueMicrotask(()=>{
      if(dialogStack.at(-1)!==token)return;
      const target=dialog?.querySelector<HTMLElement>('[data-initial-focus="true"]')??(dialog?controls(dialog)[0]:null)??dialog;
      target?.focus();
    });
    const key=(event:KeyboardEvent)=>{
      if(dialogStack.at(-1)!==token||!dialogRef.current)return;
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();closeRef.current();return;
      }
      if(event.key!=='Tab')return;
      const items=controls(dialogRef.current);
      if(!items.length){event.preventDefault();dialogRef.current.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      else if(!dialogRef.current.contains(document.activeElement)){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key,true);
    return()=>{
      document.removeEventListener('keydown',key,true);
      const index=dialogStack.lastIndexOf(token),wasTop=index===dialogStack.length-1;if(index>=0)dialogStack.splice(index,1);
      if(wasTop)queueMicrotask(()=>{
        const target=previous?.isConnected?previous:(previousId?document.getElementById(previousId):null);
        target?.focus();
      });
    };
  },[active,dialogRef]);
}

```