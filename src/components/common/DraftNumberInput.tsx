import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'min'|'max'> & {value:number;min:number;max:number;onValueChange:(value:number)=>void};
/** A number can be temporarily empty while it is being typed; committed values stay bounded. */
export function DraftNumberInput({value,min,max,onValueChange,onBlur,onFocus,...props}:Props){
  const [draft,setDraft]=useState(String(value));const focused=useRef(false);
  useEffect(()=>{if(!focused.current)setDraft(String(value));},[value]);
  return <input {...props} type="number" min={min} max={max} value={draft} onFocus={event=>{focused.current=true;onFocus?.(event);}} onChange={event=>{const text=event.target.value;setDraft(text);const next=Number(text);if(text.trim()&&Number.isFinite(next)&&next>=min&&next<=max)onValueChange(next);}} onBlur={event=>{focused.current=false;const parsed=Number(draft),next=draft.trim()&&Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):value;setDraft(String(next));if(next!==value)onValueChange(next);onBlur?.(event);}}/>;
}
