import { useEffect, useRef, useState } from 'react';
import { useAppContext, type DrumSample } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useProjectEditGesture } from '../../hooks/useProjectEditGesture';
import { isMappedDrumSample } from '../../utils/deviceExportPreflight';
import { AUDIO_FILE_ACCEPT } from '../../utils/audioFormats';
import { SmallWaveform } from '../common/SmallWaveform';
import { DrumSampleSettingsModal } from './DrumSampleSettingsModal';
import { WaveformZoomModal } from '../common/WaveformZoomModal';

interface DrumFocusWorkspaceProps {
  selectedIndex: number;
  onSelect: (index: number, expectedAsset?: DrumSample) => void;
  onFileUpload: (index: number, file: File) => void;
  onClear: (index: number) => void;
  onRecord: (index: number) => void;
  onSlice: (index: number) => void;
  onPlayed?: (index: number) => void;
}

export function DrumFocusWorkspace({ selectedIndex, onSelect, onFileUpload, onClear, onRecord, onSlice, onPlayed }: DrumFocusWorkspaceProps) {
  const { state, dispatch } = useAppContext();
  const { play } = useAudioPlayer();
  const input = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [target, setTarget] = useState(0);
  const sample = state.drumSamples[selectedIndex];
  const mapped = sample ? isMappedDrumSample(sample, selectedIndex) : selectedIndex < 24;
  const unassigned = state.drumSamples.map((item,index)=>({item,index})).filter(({item,index})=>item?.isLoaded && !isMappedDrumSample(item,index));
  const occupant = state.drumSamples[target];
  const [trim,setTrim]=useState({inPoint:sample?.inPoint??0,outPoint:sample?.outPoint??0});
  useEffect(()=>setTrim({inPoint:sample?.inPoint??0,outPoint:sample?.outPoint??0}),[sample?.audioBuffer,sample?.inPoint,sample?.outPoint]);
  const gesture=useProjectEditGesture(`focus-sample-${selectedIndex}`);
  const update=(updates:Partial<DrumSample>)=>dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:selectedIndex,updates:{...updates,hasBeenEdited:true}}});

  const audition = async (index: number) => {
    const item = state.drumSamples[index];
    if (!item?.isLoaded || !item.audioBuffer) return;
    await play(item.audioBuffer, {
      inFrame: Math.round(item.inPoint * item.audioBuffer.sampleRate),
      outFrame: Math.round(item.outPoint * item.audioBuffer.sampleRate),
      playbackRate: 2 ** (item.transpose / 12), gain: item.gain, pan: item.pan, reverse: item.reverse,
    });
    onPlayed?.(index);
  };

  const moveOrSwap = () => {
    if (!sample?.isLoaded || target === selectedIndex) return;
    if (!mapped) dispatch({type:'ASSIGN_DRUM_SAMPLE',payload:{sampleIndex:selectedIndex,targetKeyIndex:target}});
    else dispatch({type:'SWAP_DRUM_SAMPLES',payload:{fromIndex:selectedIndex,toIndex:target}});
    onSelect(target,sample);
  };

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
        <label>Mode<select value={sample.playmode} onChange={event=>update({playmode:event.target.value as DrumSample['playmode']})}><option value="oneshot">One shot</option><option value="group">Mute group</option><option value="loop">Loop</option><option value="gate">Gate</option></select></label>
        <button type="button" className="studio-button-secondary" aria-pressed={sample.reverse} onClick={()=>update({reverse:!sample.reverse})}>{sample.reverse?'Reverse':'Forward'}</button>
        <label>In point (seconds)<input type="number" min={0} max={sample.audioBuffer?.duration} step="0.00001" value={trim.inPoint} onChange={event=>setTrim(current=>({...current,inPoint:Number(event.target.value)}))} onBlur={()=>update({inPoint:Math.max(0,Math.min(trim.inPoint,trim.outPoint))})}/></label>
        <label>Out point (seconds)<input type="number" min={0} max={sample.audioBuffer?.duration} step="0.00001" value={trim.outPoint} onChange={event=>setTrim(current=>({...current,outPoint:Number(event.target.value)}))} onBlur={()=>update({outPoint:Math.min(sample.audioBuffer?.duration??trim.outPoint,Math.max(trim.outPoint,trim.inPoint))})}/></label>
        <label>Transpose <output>{sample.transpose} st</output><input {...gesture.sliderProps} type="range" min={-48} max={48} step={1} value={sample.transpose} onChange={event=>update({transpose:Number(event.target.value)})} onPointerUp={gesture.end} onKeyUp={gesture.end} onBlur={gesture.end}/></label>
        <label>Gain <output>{sample.gain} dB</output><input {...gesture.sliderProps} type="range" min={-30} max={20} step={1} value={sample.gain} onChange={event=>update({gain:Number(event.target.value)})} onPointerUp={gesture.end} onKeyUp={gesture.end} onBlur={gesture.end}/></label>
        <label>Pan <output>{sample.pan}</output><input {...gesture.sliderProps} type="range" min={-100} max={100} step={1} value={sample.pan} onChange={event=>update({pan:Number(event.target.value)})} onPointerUp={gesture.end} onKeyUp={gesture.end} onBlur={gesture.end}/></label>
      </div>
      </div>
      <div className="studio-action-row">
        <button id="drum-detailed-edit-trigger" type="button" className="studio-button-secondary" onClick={()=>setSettingsOpen(true)}>Detailed edit</button>
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
      {unassigned.length===0 ? <p>Imported sources and overflow sounds appear here until you assign them.</p> : <ul>{unassigned.map(({item,index})=><li key={`${index}-${item.name}`}><button type="button" onClick={()=>onSelect(index)} aria-current={index===selectedIndex}>{item.name}</button><button type="button" onClick={()=>void audition(index)}>Play</button></li>)}</ul>}
    </section>
    <DrumSampleSettingsModal isOpen={settingsOpen} onClose={()=>setSettingsOpen(false)} sampleIndex={selectedIndex} />
    <WaveformZoomModal isOpen={zoomOpen} onClose={()=>setZoomOpen(false)} audioBuffer={sample?.audioBuffer??null} initialInPoint={sample?.inPoint??0} initialOutPoint={sample?.outPoint??0} reverse={sample?.reverse??false} playbackRate={2**((sample?.transpose??0)/12)} gain={sample?.gain??0} onSave={(inPoint,outPoint)=>{update({inPoint,outPoint});setZoomOpen(false);}} onSaveForAll={updates=>dispatch({type:'UPDATE_ALL_DRUM_SAMPLES',payload:updates})} />
  </section>;
}
