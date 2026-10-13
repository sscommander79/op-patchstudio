import {sectionForAnalysis,type SampleSection} from '../../utils/sampleSection';
import {useEffect,useState,useMemo} from 'react';
import {suggestOriginalNote,type NoteEstimate} from '../../utils/noteSuggestion';
interface Props {
  audioBuffer:AudioBuffer;noteLabel:(note:number)=>string;
  onConfirm:(note:number)=>void;onChangeRequested?:()=>void;
  disabled?:boolean;confirmedNote?:number;section?:SampleSection;
  suggestedNote?:number;pickerLabel?:string;pickerId?:string;
}
export function NoteSuggestion({audioBuffer,noteLabel,onConfirm,onChangeRequested,disabled=false,confirmedNote,section,suggestedNote,pickerLabel='Assign to key',pickerId}:Props) {
  const [choosing,setChoosing]=useState(false);
  const input=useMemo(()=>section?sectionForAnalysis(audioBuffer,section):audioBuffer,[audioBuffer,section]);
  const [analysis,setAnalysis]=useState<{buffer:typeof input;result:NoteEstimate|null}|null>(null);
  useEffect(()=>{
    if(disabled)return;
    const controller=new AbortController();
    void suggestOriginalNote(input,controller.signal).then(result=>{
      if(!controller.signal.aborted)setAnalysis({buffer:input,result});
    }).catch(()=>{if(!controller.signal.aborted)setAnalysis({buffer:input,result:null});});
    return()=>controller.abort();
  },[input,disabled]);
  const ready=analysis?.buffer===input,result=ready?analysis.result:null;
  const suggestion=result?.midiNote??(Number.isInteger(suggestedNote)&&suggestedNote!>=0&&suggestedNote!<=127?suggestedNote:undefined);
  const assigned=confirmedNote!==undefined&&!choosing;
  const manual=choosing||(ready&&suggestion===undefined&&!assigned);
  const choose=()=>{setChoosing(true);onChangeRequested?.();};
  const assign=(note:number)=>{onConfirm(note);setChoosing(false);};
  return <div className="studio-note-suggestion" style={{flexBasis:'100%',padding:'12px 0'}}>
    {assigned?<><p role="status" style={{margin:'0 0 8px'}}>Assigned to {noteLabel(confirmedNote)}</p><button type="button" className="studio-button-secondary" disabled={disabled} onClick={choose}>Change</button></>
    :manual?<><p>{suggestion===undefined?'We couldn’t identify a clear note. Which key should play this recording?':'Which key should play this recording at its original pitch?'}</p>
      <label>Assign to key <select autoFocus={choosing} id={pickerId} aria-label={pickerLabel} disabled={disabled} value="" onChange={event=>assign(Number(event.target.value))} style={{minHeight:44,maxWidth:'100%'}}>
        <option value="" disabled>Choose a key</option>{Array.from({length:128},(_,note)=><option key={note} value={note}>{noteLabel(note)}</option>)}
      </select></label></>
    :!ready?<p role="status">Listening for the note played…</p>
    :<><p role="status" style={{margin:'0 0 12px'}}>{result?`This recording sounds like ${noteLabel(suggestion!)}. Assign it to the ${noteLabel(suggestion!)} key?`:`Your file or chosen destination suggests ${noteLabel(suggestion!)}. Assign it to the ${noteLabel(suggestion!)} key?`}</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}><button type="button" className="studio-button-primary" disabled={disabled} onClick={()=>assign(suggestion!)}>Yes, assign to {noteLabel(suggestion!)}</button><button type="button" className="studio-button-secondary" disabled={disabled} onClick={choose}>No, choose another key</button></div></>}
    <p style={{margin:'12px 0 0',fontSize:'.85rem'}}>The recording plays at its original pitch on {assigned?`the ${noteLabel(confirmedNote)} key`:'the key you assign'}. Other keys play it higher or lower. Assigning a key doesn’t retune the recording.</p>
    {manual&&<p style={{margin:'8px 0 0',fontSize:'.85rem'}}>For an instrument that plays in tune, choose the note you hear in the recording.</p>}
  </div>;
}
