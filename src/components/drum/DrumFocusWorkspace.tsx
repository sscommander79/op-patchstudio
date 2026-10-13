import { useEffect, useRef, useState } from 'react';
import { useAppContext, useProjectHistory, type DrumSample } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useProjectEditGesture } from '../../hooks/useProjectEditGesture';
import { isMappedDrumSample } from '../../utils/deviceExportPreflight';
import { AUDIO_FILE_ACCEPT } from '../../utils/audioFormats';
import { DraftNumberInput } from '../common/DraftNumberInput';
import { SmallWaveform } from '../common/SmallWaveform';
import { DrumSampleSettingsModal } from './DrumSampleSettingsModal';
import { DrumFunctionButton } from './DrumDesignPrimitives';
import { WaveformZoomModal } from '../common/WaveformZoomModal';

interface DrumFocusWorkspaceProps {
  compact?: boolean;
  onAddSounds?: () => void;
  onClearAll?: () => void;
  selectedIndex: number;
  onSelect: (index: number, expectedAsset?: DrumSample) => void;
  onFileUpload: (index: number, file: File) => void;
  onClear: (index: number) => void;
  onRecord: (index: number) => void;
  onSlice: (index: number) => void;
  onPlayed?: (index: number) => void;
}

export function DrumFocusWorkspace({ compact = false, onAddSounds, onClearAll, selectedIndex, onSelect, onFileUpload, onClear, onRecord, onSlice, onPlayed }: DrumFocusWorkspaceProps) {
  const { state, dispatch } = useAppContext();
  const { play } = useAudioPlayer();
  const { canUndo } = useProjectHistory();
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [target, setTarget] = useState(0);
  const sample = state.drumSamples[selectedIndex];
  const mapped = sample ? isMappedDrumSample(sample, selectedIndex) : selectedIndex < 24;
  const unassigned = state.drumSamples.map((item,index)=>({item,index})).filter(({item,index})=>item?.isLoaded && !isMappedDrumSample(item,index));
  const occupant = state.drumSamples[target];
  const [trim,setTrim]=useState({inPoint:sample?.inPoint??0,outPoint:sample?.outPoint??0});
  // A blur clamps and commits in one tick, before the clamped value has rendered; the commit reads this ref, not the render's trim.
  const trimRef=useRef(trim);
  const setTrimValue=(patch:Partial<typeof trim>)=>{trimRef.current={...trimRef.current,...patch};setTrim(trimRef.current);};
  useEffect(()=>{const stored={inPoint:sample?.inPoint??0,outPoint:sample?.outPoint??0};trimRef.current=stored;setTrim(stored);},[sample?.audioBuffer,sample?.inPoint,sample?.outPoint]);
  const gesture=useProjectEditGesture(`focus-sample-${selectedIndex}`);
  const update=(updates:Partial<DrumSample>)=>dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:selectedIndex,updates:{...updates,hasBeenEdited:true}}});

  const audition = async (index: number) => {
    const item = state.drumSamples[index];
    if (!item?.isLoaded || !item.audioBuffer) return;
    try {
    await play(item.audioBuffer, {
      inFrame: Math.round(item.inPoint * item.audioBuffer.sampleRate),
      outFrame: Math.round(item.outPoint * item.audioBuffer.sampleRate),
      playbackRate: 2 ** (item.transpose / 12), gain: item.gain, pan: item.pan, reverse: item.reverse,
    });
    onPlayed?.(index);
    setPreviewMessage(`Playing ${item.name}`);
    } catch { setPreviewMessage('Could not play this sound. Try Listen again.'); }
  };

  const moveOrSwap = () => {
    if (!sample?.isLoaded || target === selectedIndex) return;
    if (!mapped) dispatch({type:'ASSIGN_DRUM_SAMPLE',payload:{sampleIndex:selectedIndex,targetKeyIndex:target}});
    else dispatch({type:'SWAP_DRUM_SAMPLES',payload:{fromIndex:selectedIndex,toIndex:target}});
    onSelect(target,sample);
  };

  if (compact) {
    const role = mapped ? ['KD1','KD2','SD1','SD2','RIM','CLP','TB','SH','CH','CL','OH','CAB','LT1','RC','MT','CC','HT','COW','TRI','LT2','LC','WS','HC','GUI'][selectedIndex] : 'Unassigned';
    return <section className="drum-compact-focus" aria-label="Focused sample editor">
      <input ref={input} type="file" hidden aria-label={`Choose audio for ${mapped ? `pad ${selectedIndex + 1}` : 'selected unassigned sound'}`} accept={AUDIO_FILE_ACCEPT} onChange={event=>{const file=event.target.files?.[0];if(file)onFileUpload(selectedIndex,file);event.target.value='';}} />
      <div className="drum-selected-sound">
        <div className="drum-sound-identity"><p>{role} · {mapped ? `key ${String(selectedIndex+1).padStart(2,'0')}` : 'sound'}</p><h2 title={sample?.name}>{sample?.isLoaded ? sample.name : 'No sound assigned'}</h2><p>{sample?.isLoaded ? `${sample.inPoint.toFixed(3)}–${sample.outPoint.toFixed(3)} s` : 'Empty key'}</p><small>{sample?.isLoaded ? 'Kept range above. Full recording retained.' : 'Add a sound to this key.'}</small></div>
        <div className="drum-inspector-waveform">{sample?.isLoaded && sample.audioBuffer && <SmallWaveform darkSurface audioBuffer={sample.audioBuffer} height={130} inPoint={Math.round(sample.inPoint*sample.audioBuffer.sampleRate)} outPoint={Math.round(sample.outPoint*sample.audioBuffer.sampleRate)} onZoomEdit={()=>setZoomOpen(true)}/>}</div>
        <div className="drum-selected-actions"><DrumFunctionButton icon="play" disabled={!sample?.isLoaded || !sample.audioBuffer} onClick={()=>void audition(selectedIndex)}>Listen</DrumFunctionButton><div className="drum-text-actions">{sample?.isLoaded && <button type="button" onClick={()=>setSettingsOpen(true)}>Sound settings →</button>}<button type="button" aria-expanded={organizeOpen} onClick={()=>setOrganizeOpen(!organizeOpen)}>Organize →</button></div></div>
      </div>
      <div className="drum-function-row"><DrumFunctionButton icon="add" onClick={onAddSounds}>Add sounds</DrumFunctionButton><DrumFunctionButton icon="trim" disabled={!sample?.isLoaded || !sample.audioBuffer} onClick={()=>setZoomOpen(true)}>Trim</DrumFunctionButton><DrumFunctionButton icon="undo" disabled={!canUndo} onClick={()=>dispatch({type:'UNDO'})}>Undo</DrumFunctionButton><DrumFunctionButton icon="clear" disabled={!state.drumSamples.some(item=>item?.isLoaded)} onClick={onClearAll}>Clear kit</DrumFunctionButton></div>
      {organizeOpen && <section className="drum-organize-panel" aria-label="Organize sounds"><div className="drum-text-actions"><button type="button" disabled={selectedIndex<=0||selectedIndex>=24} onClick={()=>onSelect(selectedIndex-1)}>Previous pad</button><button type="button" disabled={selectedIndex>=23} onClick={()=>onSelect(selectedIndex+1)}>Next pad →</button></div>{sample?.isLoaded && <><div className="drum-function-row"><DrumFunctionButton icon="file" onClick={()=>input.current?.click()}>Replace</DrumFunctionButton><DrumFunctionButton icon="clear" onClick={()=>onClear(selectedIndex)}>Remove</DrumFunctionButton><DrumFunctionButton icon="trim" onClick={()=>onSlice(selectedIndex)}>Slice this sample</DrumFunctionButton><DrumFunctionButton icon="record" onClick={()=>onRecord(Math.min(selectedIndex,23))}>Record here</DrumFunctionButton></div><div className="studio-assignment"><label>Move or swap with pad<select value={target} onChange={event=>setTarget(Number(event.target.value))}>{Array.from({length:24},(_,index)=><option key={index} value={index}>Pad {index+1}</option>)}</select></label><p>{occupant?.isLoaded ? `Pad ${target+1} contains ${occupant.name}. ${mapped?'The sounds will swap.':'The previous sound stays unassigned.'}` : `Pad ${target+1} is empty. The selected sound will move there.`}</p><button type="button" disabled={target===selectedIndex} onClick={moveOrSwap}>Move or swap</button></div></>}
        <section className="studio-tray" aria-label="Unassigned sounds"><h3>Unassigned sounds · {unassigned.length}</h3>{unassigned.length===0 ? <p>Overflow and displaced sounds stay here until you assign them.</p> : <ul>{unassigned.map(({item,index})=><li key={index}><button type="button" onClick={()=>onSelect(index)} aria-current={index===selectedIndex}>{item.name}</button><button type="button" aria-label={`Play ${item.name}`} onClick={()=>void audition(index)}>Play</button></li>)}</ul>}</section></section>}
      {previewMessage && <p role="status" className="drum-preview-status">{previewMessage}</p>}
      <DrumSampleSettingsModal isOpen={settingsOpen} onClose={()=>setSettingsOpen(false)} sampleIndex={selectedIndex}/>
      <WaveformZoomModal isOpen={zoomOpen} onClose={()=>setZoomOpen(false)} audioBuffer={sample?.audioBuffer??null} initialInPoint={sample?.inPoint??0} initialOutPoint={sample?.outPoint??0} reverse={sample?.reverse??false} playbackRate={2**((sample?.transpose??0)/12)} gain={sample?.gain??0} onSave={(inPoint,outPoint)=>{update({inPoint,outPoint});setZoomOpen(false);}} onSaveForAll={updates=>dispatch({type:'UPDATE_ALL_DRUM_SAMPLES',payload:updates})} saveForAllCount={state.drumSamples.filter(item=>item?.isLoaded&&item.audioBuffer).length} saveForAllScope="loaded drum samples"/>
    </section>;
  }

  return <section className="studio-focus" aria-label="Focused sample editor">
    <div className="studio-focus-heading">
      <div><p className="studio-eyebrow">SELECTED SOUND</p><h3>Pad {mapped ? selectedIndex + 1 : 'unassigned'} · {sample?.isLoaded ? sample.name : 'Empty'}</h3></div>
      <div className="studio-pad-navigation">
        {sample?.isLoaded && <button type="button" className="studio-button-secondary" onClick={() => void audition(selectedIndex)}>Play selected</button>}
        <button type="button" className="studio-button-secondary" disabled={selectedIndex<=0||selectedIndex>=24} onClick={()=>onSelect(selectedIndex-1)}>Previous pad</button>
        <button type="button" className="studio-button-secondary" disabled={selectedIndex>=23} onClick={()=>onSelect(selectedIndex+1)}>Next pad →</button>
      </div>
    </div>
    <input ref={input} type="file" hidden aria-label={`Choose audio for ${mapped ? `pad ${selectedIndex + 1}` : 'selected unassigned sound'}`} accept={AUDIO_FILE_ACCEPT} onChange={event=>{const file=event.target.files?.[0];if(file)onFileUpload(selectedIndex,file);event.target.value='';}} />
    {!sample?.isLoaded ? <div className="studio-empty-pad">
      <p>This selected pad is empty. Add a sample or record a sound into it.</p>
      <div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={()=>input.current?.click()}>Add sample</button><button type="button" className="studio-button-secondary" onClick={()=>onRecord(Math.min(selectedIndex,23))}>Record here</button></div>
    </div> : <>
      <div className="studio-focus-main">
      {sample.audioBuffer && <SmallWaveform audioBuffer={sample.audioBuffer} height={116} inPoint={Math.round(sample.inPoint*sample.audioBuffer.sampleRate)} outPoint={Math.round(sample.outPoint*sample.audioBuffer.sampleRate)} onZoomEdit={()=>setZoomOpen(true)} />}
      <div className="studio-sample-controls">
        <label>Play mode<select value={sample.playmode} onChange={event=>update({playmode:event.target.value as DrumSample['playmode']})}><option value="oneshot">One shot – play the whole sample</option><option value="group">Mute group – choke when another sample plays</option><option value="loop">Loop – loop at sample end</option><option value="gate">Hold to play (Gate) – play while held</option></select></label>
        <button type="button" className="studio-button-secondary" title={`Playback direction: ${sample.reverse?'reverse':'forward'}. Select to play ${sample.reverse?'forward':'in reverse'}.`} aria-pressed={sample.reverse} onClick={()=>update({reverse:!sample.reverse})}>{sample.reverse?'Reverse':'Forward'}</button>
        <label>Playback start (seconds)<DraftNumberInput min={0} max={Math.min(sample.audioBuffer?.duration??0,trim.outPoint)} step="0.00001" value={trim.inPoint} onValueChange={value=>setTrimValue({inPoint:value})} onBlur={()=>{const inPoint=Math.max(0,Math.min(trimRef.current.inPoint,trimRef.current.outPoint));setTrimValue({inPoint});update({inPoint});}}/></label>
        <label>Playback end (seconds)<DraftNumberInput min={trim.inPoint} max={sample.audioBuffer?.duration??0} step="0.00001" value={trim.outPoint} onValueChange={value=>setTrimValue({outPoint:value})} onBlur={()=>{const outPoint=Math.min(sample.audioBuffer?.duration??trimRef.current.outPoint,Math.max(trimRef.current.outPoint,trimRef.current.inPoint));setTrimValue({outPoint});update({outPoint});}}/></label>
        <label>Transpose <output>{sample.transpose} semitones</output><input {...gesture.sliderProps} type="range" aria-label="Transpose" min={-48} max={48} step={1} value={sample.transpose} onChange={event=>update({transpose:Number(event.target.value)})} onPointerUp={gesture.end} onKeyUp={gesture.end} onBlur={gesture.end}/></label>
        <label>Gain <output>{sample.gain} dB</output><input {...gesture.sliderProps} type="range" aria-label="Gain" min={-30} max={20} step={1} value={sample.gain} onChange={event=>update({gain:Number(event.target.value)})} onPointerUp={gesture.end} onKeyUp={gesture.end} onBlur={gesture.end}/></label>
        <label>Pan <output>{sample.pan}</output><input {...gesture.sliderProps} type="range" aria-label="Pan" min={-100} max={100} step={1} value={sample.pan} onChange={event=>update({pan:Number(event.target.value)})} onPointerUp={gesture.end} onKeyUp={gesture.end} onBlur={gesture.end}/></label>
      </div>
      </div>
      <div className="studio-action-row">
        <button id="drum-detailed-edit-trigger" type="button" className="studio-button-secondary" onClick={()=>setSettingsOpen(true)}>Detailed edit</button>
        {sample.audioBuffer&&<button type="button" className="studio-button-secondary" onClick={()=>setZoomOpen(true)}>Zoom and edit waveform</button>}
        <button type="button" className="studio-button-secondary" onClick={()=>onSlice(selectedIndex)}>Slice this sample</button>
        <button type="button" className="studio-button-secondary" onClick={()=>input.current?.click()}>Replace</button>
        <button type="button" className="studio-button-secondary" onClick={()=>onClear(selectedIndex)}>Clear</button>
      </div>
      <div className="studio-assignment">
        <label>Move or swap with pad
          <select value={target} onChange={event=>setTarget(Number(event.target.value))}>{Array.from({length:24},(_,index)=><option key={index} value={index}>Pad {index+1}</option>)}</select>
        </label>
        <p>{occupant?.isLoaded ? `Pad ${target+1} contains ${occupant.name}. The sounds will swap.` : `Pad ${target+1} is empty. The selected sound will move there.`}</p>
        <button type="button" className="studio-button-secondary" disabled={target===selectedIndex} onClick={moveOrSwap}>Move or swap</button>
      </div>
    </>}
    <section className="studio-tray" aria-label="Unassigned sounds">
      <div className="studio-tray-heading"><h4>Unassigned sounds</h4><span>{unassigned.length}</span></div>
      {unassigned.length===0 ? <p>Imported sources and overflow sounds appear here until you assign them.</p> : <ul>{unassigned.map(({item,index})=><li key={`${index}-${item.name}`}><button type="button" onClick={()=>onSelect(index)} aria-current={index===selectedIndex}>{item.name}</button><button type="button" aria-label={`Play ${item.name}`} onClick={()=>void audition(index)}>Play</button></li>)}</ul>}
    </section>
    <DrumSampleSettingsModal isOpen={settingsOpen} onClose={()=>setSettingsOpen(false)} sampleIndex={selectedIndex} />
    <WaveformZoomModal isOpen={zoomOpen} onClose={()=>setZoomOpen(false)} audioBuffer={sample?.audioBuffer??null} initialInPoint={sample?.inPoint??0} initialOutPoint={sample?.outPoint??0} reverse={sample?.reverse??false} playbackRate={2**((sample?.transpose??0)/12)} gain={sample?.gain??0} onSave={(inPoint,outPoint)=>{update({inPoint,outPoint});setZoomOpen(false);}} onSaveForAll={updates=>dispatch({type:'UPDATE_ALL_DRUM_SAMPLES',payload:updates})} saveForAllCount={state.drumSamples.filter(item=>item?.isLoaded&&item.audioBuffer).length} saveForAllScope="loaded drum samples" />
  </section>;
}
