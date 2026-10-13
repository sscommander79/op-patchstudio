import {useState} from 'react';
import {WaveformZoomModal} from './WaveformZoomModal';
import {normalizeSection,type SampleSection} from '../../utils/sampleSection';
interface Props {audioBuffer:AudioBuffer;section?:SampleSection;onChange:(section:SampleSection)=>void;disabled?:boolean;beforeOpen?:()=>void;label:string}
export function SampleSectionPicker({audioBuffer,section,onChange,disabled=false,beforeOpen,label}:Props) {
 const [open,setOpen]=useState(false);
 const bounds=normalizeSection(audioBuffer,section);
 return <div style={{flexBasis:'100%',padding:'8px 0'}}>
  <button type="button" className="studio-button-secondary" aria-label={`Choose a section of ${label}`} disabled={disabled} onClick={()=>{beforeOpen?.();setOpen(true);}}>Choose a section</button>
  <span style={{marginLeft:8}}>{section?`${bounds.inPoint.toFixed(2)}–${bounds.outPoint.toFixed(2)} s selected`:'Using the full recording'}</span>
  {open&&<WaveformZoomModal isOpen sectionOnly audioBuffer={audioBuffer} initialInPoint={bounds.inPoint} initialOutPoint={bounds.outPoint} onClose={()=>setOpen(false)} onSave={(inPoint,outPoint)=>onChange({inPoint,outPoint})}/>}
 </div>;
}
