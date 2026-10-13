import {useEffect,useMemo,useRef,useState} from 'react';
import {useAppContext,useProjectHistory} from '../../context/AppContext';
import {usePatchGeneration} from '../../hooks/usePatchGeneration';
import {prepareRecordingApplication} from '../../utils/recordingApplication';
import {buildDeviceExportPreflight} from '../../utils/deviceExportPreflight';
import {analyzeNoteRecording} from '../../utils/automaticNoteSplit';
import {planInstrumentNotes,savedInstrumentPlan,instrumentNoteName as noteName} from '../../utils/instrumentPlan';
import {SmallWaveform} from '../common/SmallWaveform';
import {DrumFunctionButton,DrumIcon} from '../drum/DrumDesignPrimitives';
import '../drum/DrumDesign.css';
import './InstrumentJourney.css';
type Instrument={id:string;name:string};
type Preset={number:number;name:string};
type Take={name:string;rootNote:number;wavBase64:string;frames:number;sampleRate:number;channels:number};
type Reply={instruments?:Instrument[];name?:string;sound?:string;presets?:Preset[];takes?:Take[]};
type Bridge={postMessage:(body:Record<string,unknown>)=>Promise<Reply>};
function instrumentStudioBridge():Bridge|undefined{return (window as unknown as {webkit?:{messageHandlers?:{instrumentStudio?:Bridge}}}).webkit?.messageHandlers?.instrumentStudio;}
export function InstrumentJourney(){
 const {state,dispatch}=useAppContext(),stateRef=useRef(state);stateRef.current=state;const {canUndo}=useProjectHistory();
 const {generateMultisamplePatchFile}=usePatchGeneration();
 const [instruments,setInstruments]=useState<Instrument[]>([]),[instrument,setInstrument]=useState(''),[presets,setPresets]=useState<Preset[]>([]),[preset,setPreset]=useState(-999),[sound,setSound]=useState('Initial sound');
 const [first,setFirst]=useState(48),[last,setLast]=useState(72),[spacing,setSpacing]=useState(3),[hold,setHold]=useState(1),[release,setRelease]=useState(1),[velocity,setVelocity]=useState(100);
 const [busy,setBusy]=useState(''),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('Choose an instrument to begin.'),[progress,setProgress]=useState(0),[selected,setSelected]=useState(60),[operation,setOperation]=useState('');
 const [playing,setPlaying]=useState(false),[soundRevision,setSoundRevision]=useState(0),[edited,setEdited]=useState(false);
 const locked=useRef(false),player=useRef<AudioBufferSourceNode|null>(null),audioContext=useRef<AudioContext|null>(null);
 const restoredFiles=useRef(state.multisampleFiles);
 const [restoredPlan,setRestoredPlan]=useState('');
 const metadata=useRef(new WeakMap<AudioBuffer,{signature:string;detected:string}>());
 const native=instrumentStudioBridge();
 const name=instruments.find(item=>item.id===instrument)?.name??'Your instrument';
 const plan=useMemo(()=>{try{return {notes:planInstrumentNotes(first,last,spacing),error:''};}catch(error){return {notes:[],error:error instanceof Error?error.message:String(error)};}},[first,last,spacing]);
 const durationError=(!Number.isFinite(hold)||!Number.isFinite(release)||hold<.25||hold>5||release<.25||release>8||!Number.isInteger(velocity)||velocity<1||velocity>127||plan.notes.length*(hold+release)>180)?'Use 0.25–5 seconds held, 0.25–8 seconds release, velocity 1–127, and at most 180 seconds total.':'';
 const signature=JSON.stringify({instrument,preset,soundRevision,first,last,spacing,hold,release,velocity});
 const files=state.multisampleFiles;
 const ready=files.length>0&&files.length===plan.notes.length&&(
  files.every(file=>file.audioBuffer&&metadata.current.get(file.audioBuffer)?.signature===signature)||
  (!instrument&&files===restoredFiles.current&&files.every(file=>file.audioBuffer)&&restoredPlan===JSON.stringify({first,last,spacing}))
 );
 useEffect(()=>{
  if(instrument||busy||!files.length||files.some(file=>!file.audioBuffer))return;
  const restored=savedInstrumentPlan(files.map(file=>file.rootNote));
  if(restored){restoredFiles.current=files;setFirst(restored.first);setLast(restored.last);setSpacing(restored.spacing);setRestoredPlan(JSON.stringify(restored));setMessage('Saved recordings ready. Listen or export.');}
 },[files,instrument,busy]);
 const selectedFile=files.find(file=>file.rootNote===selected)??files[0];
 const stop=()=>{player.current?.stop();player.current=null;setPlaying(false);};
 useEffect(()=>{
  let active=true;
  void instrumentStudioBridge()?.postMessage({operation:'list'}).then(reply=>{if(active)setInstruments(reply.instruments??[]);}).catch(error=>{if(active)setMessage(String(error));});
  const onProgress=(event:Event)=>setProgress((event as CustomEvent<{done:number}>).detail.done);
  const onExport=(event:Event)=>setMessage((event as CustomEvent<{message:string}>).detail.message);
  window.addEventListener('instrument-studio-progress',onProgress);window.addEventListener('instrument-studio-export-status',onExport);
  return()=>{active=false;window.removeEventListener('instrument-studio-progress',onProgress);window.removeEventListener('instrument-studio-export-status',onExport);player.current?.stop();void audioContext.current?.close();};
 },[]);
 useEffect(()=>{const result=state.recordingCommitResult;if(!operation||result?.operationId!==operation)return;
  setMessage(result.status==='committed'?`${result.assignedCount} notes ready. Listen or export.`:result.error??'Nothing was replaced.');
 },[state.recordingCommitResult,operation]);
 const changeInstrument=async(id:string)=>{
  if(locked.current||!id)return;locked.current=true;setBusy('Loading instrument');setLoaded(false);stop();setInstrument(id);setPresets([]);setPreset(-999);setEdited(false);setSoundRevision(value=>value+1);setMessage('Loading your instrument…');
  try{const reply=await native!.postMessage({operation:'load',id});setPresets(reply.presets??[]);setSound(reply.sound??'Initial sound');setLoaded(true);setMessage('Choose your range, then multisample.');}catch(error){setMessage(`Could not load this instrument. ${String(error)}`);}finally{locked.current=false;setBusy('');}
 };
 const changePreset=async(number:number)=>{if(locked.current)return;locked.current=true;setBusy('Loading sound');stop();try{const reply=await native!.postMessage({operation:'preset',number});setPreset(number);setEdited(false);setSoundRevision(value=>value+1);setSound(reply.sound??'Initial sound');setMessage('Sound selected. Ready to multisample.');}catch(error){setMessage(String(error));}finally{locked.current=false;setBusy('');}};
 const editSound=async()=>{
  if(locked.current||!loaded)return;locked.current=true;setBusy('Editing sound');stop();setMessage('Choose your sound in the instrument editor.');
  try{const reply=await native!.postMessage({operation:'editor'});setSound(reply.sound??'Custom sound');setEdited(true);setSoundRevision(value=>value+1);setMessage('Sound ready. Multisample to record it.');}
  catch(error){setMessage(String(error));}finally{locked.current=false;setBusy('');}
 };
 const listen=async(buffer:AudioBuffer)=>{stop();const context=audioContext.current??new AudioContext({sampleRate:44100});audioContext.current=context;await context.resume();const voice=context.createBufferSource();voice.buffer=buffer;voice.connect(context.destination);voice.onended=()=>{if(player.current===voice){player.current=null;setPlaying(false);}voice.disconnect();};player.current=voice;setPlaying(true);voice.start();};
 const capture=async(check=false)=>{
  if(locked.current||!loaded||plan.error||durationError)return;locked.current=true;setBusy(check?'Checking sound':'Multisampling');setProgress(0);stop();setMessage(check?'Recording one note to hear…':'Recording your selected notes…');
  const before=stateRef.current;let context:AudioContext|undefined;
  try{
   const notes=check?[plan.notes[Math.floor(plan.notes.length/2)]]:plan.notes;
   const reply=await native!.postMessage({operation:check?'check':'record',notes,hold,release,velocity});
   if(reply.takes?.length!==notes.length||reply.takes.some((take,i)=>take.rootNote!==notes[i]))throw new Error('The host returned an incomplete recording. Previous sounds were kept.');
   context=new AudioContext({sampleRate:44100});
   const takes=await Promise.all(reply.takes.map(async take=>{
    const bytes=Uint8Array.from(atob(take.wavBase64),c=>c.charCodeAt(0));const buffer=await context!.decodeAudioData(bytes.buffer);
    if(buffer.length!==take.frames||buffer.sampleRate!==44100||buffer.numberOfChannels!==2)throw new Error('Recording dimensions do not match. Previous sounds were kept.');
    let detected='Pitch check unclear';try{const found=analyzeNoteRecording([buffer.getChannelData(0),buffer.getChannelData(1)],buffer.sampleRate);if(found.length===1)detected=`Detected ${noteName(found[0].rootNote)}${found[0].rootNote!==take.rootNote?' · differs from played note':''}`;}catch{/* Played MIDI remains the known mapping; an ambiguous pitch is shown explicitly. */}
    metadata.current.set(buffer,{signature,detected});
    return {id:crypto.randomUUID(),name:take.name.replace(/\.wav$/i,''),rootNote:take.rootNote,audioBuffer:buffer};
   }));
   if(check){await listen(takes[0].audioBuffer);setMessage(`Playing ${noteName(notes[0])}. If it sounds right, multisample.`);return;}
   const prepared=await prepareRecordingApplication({instrument:'multisample',takes,state:{...before,multisampleFiles:[]},target:{kind:'multisample'}});
   const id=crypto.randomUUID();setOperation(id);setSelected(notes[0]);
   dispatch({type:'COMMIT_INSTRUMENT_CAPTURE',payload:{operationId:id,prepared,expectedFiles:before.multisampleFiles,name:before.multisampleSettings.presetName.trim()||`${name} multisample`}});
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{await context?.close();locked.current=false;setBusy('');}
 };
 const exportPreset=async()=>{if(locked.current||!ready)return;const preflight=buildDeviceExportPreflight(state,'multisample',false);if(preflight.errors.length){setMessage(preflight.errors.join(' '));return;}locked.current=true;setBusy('Exporting');try{const result=await generateMultisamplePatchFile(state.multisampleSettings.presetName);setMessage(result.ok?'Saving your preset…':result.error);}finally{locked.current=false;setBusy('');}};
 const options=Array.from({length:128},(_,note)=><option key={note} value={note}>{noteName(note)}</option>);
 const isBlack=(note:number)=>[1,3,6,8,10].includes(note%12);
 const keyboardStart=isBlack(first)?first-1:first;
 const whiteColumn=(note:number)=>Array.from({length:note-keyboardStart+1},(_,i)=>keyboardStart+i).filter(n=>!isBlack(n)).length;
 const visibleNotes=Array.from({length:Math.max(1,last-first+1)},(_,i)=>first+i);
 return <div className="instrument-journey-shell"><section tabIndex={-1} data-workspace-modal={busy?"true":undefined} className="drum-design instrument-journey" data-step="2" aria-label="Software instrument multisampler">
  <header className="drum-design-context"><span>OP–PATCHSTUDIO / SOFTWARE INSTRUMENT</span><span>{state.sessionSaveStatus==='saved'?'SAVED':state.sessionSaveStatus==='saving'?'SAVING…':'MULTISAMPLE'}</span></header>
  <div className="drum-design-heading"><h1>your multisample</h1></div>
  <div className="ij-source"><label>Instrument<select aria-label="Instrument" value={instrument} disabled={!!busy||!native} onChange={event=>void changeInstrument(event.target.value)}><option value="">Choose instrument…</option>{instruments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="ij-current-sound"><small>Sound</small><strong>{loaded?sound:'—'}</strong></div><DrumFunctionButton icon="settings" disabled={!!busy||!loaded} onClick={()=>void editSound()}>choose sound</DrumFunctionButton></div>
  <div className="ij-range"><label>First note<select aria-label="First note" value={first} disabled={!!busy} onChange={event=>setFirst(Number(event.target.value))}>{options}</select></label><span className="ij-range-arrow">→</span><label>Last note<select aria-label="Last note" value={last} disabled={!!busy} onChange={event=>setLast(Number(event.target.value))}>{options}</select></label><label>Spacing<select aria-label="Spacing" value={spacing} disabled={!!busy} onChange={event=>setSpacing(Number(event.target.value))}><option value={1}>Every note · 1 semitone</option><option value={3}>Every 3 semitones</option><option value={6}>Every 6 semitones</option><option value={12}>Every octave · 12 semitones</option></select></label><strong>{plan.notes.length} samples</strong></div>
  <div className="ij-keyboard" aria-label="Notes to sample">{visibleNotes.map(note=>{const planned=plan.notes.includes(note),recorded=ready&&files.some(f=>f.rootNote===note);return <button key={note} type="button" className={isBlack(note)?'ij-black':''} style={{gridColumn:whiteColumn(note),gridRow:isBlack(note)?1:2}} data-planned={planned} data-recorded={recorded} aria-label={`${noteName(note)}${recorded?', recorded':planned?', will record':', not sampled'}`} aria-pressed={selectedFile?.rootNote===note} disabled={!!busy||!files.some(f=>f.rootNote===note)} onClick={()=>{setSelected(note);const buffer=files.find(f=>f.rootNote===note)?.audioBuffer;if(buffer)void listen(buffer);}}><span className="ij-key-cap"><i>{planned?(recorded?'✓':'•'):''}</i><strong>{noteName(note)}</strong></span></button>;})}</div>
  <p className="ij-keyboard-caption">{busy==='Multisampling'?`${progress} / ${plan.notes.length} recorded`:ready?'Tap a recorded note to listen':'● Notes to sample'}{!plan.error&&plan.notes.length>1&&(last-first)%spacing!==0?' · Last note included':''}</p>
  <div className="drum-selected-sound"><div className="drum-sound-identity"><p>{selectedFile?`${noteName(selectedFile.rootNote)} · recorded note`:sound}</p><h2>{selectedFile?selectedFile.name.replace(/\.opfloat$/,''):name}</h2><small>{selectedFile?.audioBuffer?(metadata.current.get(selectedFile.audioBuffer)?.detected??`Mapped ${noteName(selectedFile.rootNote)}`):'Choose a sound, then multisample.'}</small></div><div className="drum-inspector-waveform">{selectedFile?.audioBuffer?<SmallWaveform darkSurface audioBuffer={selectedFile.audioBuffer} outPoint={selectedFile.audioBuffer.duration} height={112}/>:<div className="ij-empty-wave" aria-label="Waveform appears after recording">—</div>}</div><div className="drum-selected-actions"><DrumFunctionButton icon="play" disabled={!!busy||(!selectedFile&&!loaded)} onClick={()=>{if(playing)stop();else if(selectedFile?.audioBuffer)void listen(selectedFile.audioBuffer);else void capture(true);}}>{playing?'stop':selectedFile?'listen':'check sound'}</DrumFunctionButton></div></div>
  <div className="ij-actions"><DrumFunctionButton icon={ready?'save':'record'} disabled={!!busy||(!ready&&!loaded)||!!plan.error||!!durationError} onClick={()=>void (ready?exportPreset():capture())}>{busy==='Multisampling'?`recording ${progress}/${plan.notes.length}`:busy==='Exporting'?'exporting…':ready?'export preset':files.length?'multisample again':`multisample ${plan.notes.length} notes`}</DrumFunctionButton><div className="drum-text-actions">{ready&&loaded&&<button disabled={!!busy} onClick={()=>void capture()}>record again</button>}<button disabled={!!busy||!canUndo} onClick={()=>{stop();dispatch({type:'UNDO'});setMessage('Previous recordings restored.');}}>undo</button></div></div>
  <p role="status" className="ij-status">{plan.error||durationError||(!native?'Open the desktop app to load installed Audio Unit instruments.':message)}</p>
  {!ready&&files.length>0&&!busy&&<p className="ij-hint">Settings changed. Multisample again to update the recordings. Your previous take is kept until the new one succeeds.</p>}
  <details className="drum-design-advanced"><summary><DrumIcon name="settings"/> Advanced settings <span>+</span></summary><div className="drum-advanced-content ij-advanced"><label>Sound<select aria-label="Sound" value={edited?-998:preset} disabled={!!busy||!loaded||!presets.length} onChange={event=>void changePreset(Number(event.target.value))}>{edited&&<option value={-998}>{sound}</option>}<option value={-999}>Initial sound</option>{presets.map(item=><option key={item.number} value={item.number}>{item.name}</option>)}</select></label><label>Note held (seconds)<input aria-label="Note held seconds" type="number" min="0.25" max="5" step="0.25" value={hold} disabled={!!busy} onChange={event=>setHold(Number(event.target.value))}/></label><label>Release tail (seconds)<input aria-label="Release tail seconds" type="number" min="0.25" max="8" step="0.25" value={release} disabled={!!busy} onChange={event=>setRelease(Number(event.target.value))}/></label><label>Velocity<input aria-label="Velocity" type="number" min="1" max="127" value={velocity} disabled={!!busy} onChange={event=>setVelocity(Number(event.target.value))}/></label><label>Preset name<input aria-label="Preset name" value={state.multisampleSettings.presetName} disabled={!!busy} onChange={event=>dispatch({type:'SET_MULTISAMPLE_PRESET_NAME',payload:event.target.value})}/></label><p>Up to 24 samples. Increase release time if a sound ends too soon. Recorded MIDI notes determine the mapping; detected pitch is a check.</p></div></details>

 </section></div>;
}
