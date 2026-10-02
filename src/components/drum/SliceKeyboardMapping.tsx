import type { DragEvent } from 'react';
import type { DrumSample } from '../../context/AppContext';

export const SLICE_DRAG_TYPE='application/x-op-patchstudio-slice-id';

export const SLICE_PAD_GROUPS=[
  {name:'Lower octave',upper:[{label:'KD2',index:1},{label:'SD2',index:3},{label:'CLP',index:5},{label:'CH',index:8},{label:'OH',index:10}],lower:[{label:'KD1',index:0},{label:'SD1',index:2},{label:'RIM',index:4},{label:'TB',index:6},{label:'SH',index:7},{label:'CL',index:9},{label:'CAB',index:11}]},
  {name:'Upper octave',upper:[{label:'RC',index:13},{label:'CC',index:15},{label:'COW',index:17},{label:'LC',index:20},{label:'HC',index:22}],lower:[{label:'LT1',index:12},{label:'MT',index:14},{label:'HT',index:16},{label:'TRI',index:18},{label:'LT2',index:19},{label:'WS',index:21},{label:'GUI',index:23}]},
] as const;

interface Props {
  existingSamples:readonly DrumSample[];
  ranges:readonly {id:string}[];
  mapping:Readonly<Record<string,number>>;
  disabled:boolean;
  onAssign:(rangeId:string,keyIndex:number)=>void;
  onPreview:(rangeId:string)=>void;
  selectedKey?:number;
  onSelect?:(keyIndex:number)=>void;
}

export function SliceKeyboardMapping({existingSamples,ranges,mapping,disabled,onAssign,onPreview,selectedKey,onSelect}:Props) {
  const rangeNumber=new Map(ranges.map((range,index)=>[range.id,index+1]));
  const assignedByKey=new Map(Object.entries(mapping).map(([id,key])=>[key,id]));
  const drop=(event:DragEvent<HTMLButtonElement>,keyIndex:number)=>{
    event.preventDefault();
    if(disabled||!event.dataTransfer.types.includes(SLICE_DRAG_TYPE))return;
    const id=event.dataTransfer.getData(SLICE_DRAG_TYPE);
    if(rangeNumber.has(id))onAssign(id,keyIndex);
  };
  const renderKey=({label,index,column,row}:{label:string;index:number;column:number;row:number})=>{
    const rangeId=assignedByKey.get(index),soundNumber=rangeId?rangeNumber.get(rangeId):undefined,existing=existingSamples[index]?.isLoaded?existingSamples[index]:null;
    const detail=soundNumber?`Sound ${soundNumber}`:existing?.name||'Empty';
    return <button key={index} type="button" disabled={disabled} aria-label={`Pad ${index+1}, ${label}, ${detail}`} title={detail} data-slice-pad={index}
      onDragOver={event=>{if(event.dataTransfer.types.includes(SLICE_DRAG_TYPE))event.preventDefault();}} onDrop={event=>drop(event,index)}
      aria-pressed={selectedKey===index}
      onClick={()=>{onSelect?.(index);if(rangeId)onPreview(rangeId);}}
      style={{gridColumn:`${column} / span 2`,gridRow:row,width:'48px',minWidth:'48px',minHeight:'64px',padding:'.25rem',border:'1px solid var(--color-border-medium)',outline:selectedKey===index?'2px solid var(--color-text-primary)':undefined,outlineOffset:'-2px',borderRadius:'4px',background:soundNumber?'var(--color-interactive-focus)':existing?'var(--color-bg-tertiary)':'var(--color-bg-secondary)',color:soundNumber?'var(--studio-accent-text)':'var(--color-text-primary)',cursor:'pointer',display:'grid',alignContent:'center',gap:'.1rem'}}>
      <strong>{label}</strong><span>{index+1}</span><small style={{fontSize:'11px',lineHeight:1.05,display:'grid'}}>{soundNumber?<><span>Sound</span><span>{soundNumber}</span></>:existing?'Loaded':'Empty'}</small>
    </button>;
  };
  return <section aria-label="OP-XY slice destinations" style={{marginTop:'1rem'}}>
    <strong>OP-XY destinations</strong>
    <small style={{display:'block'}}>Scroll horizontally to see all destination keys.</small>
    <div role="region" aria-label="OP-XY destination scroll area" tabIndex={0} style={{overflowX:'auto',padding:'.5rem 0'}}>
      <div style={{display:'flex',gap:'1rem',width:'max-content',minWidth:'100%'}}>
        {SLICE_PAD_GROUPS.map(group=><div key={group.name} role="group" aria-label={`${group.name} destinations`} style={{minWidth:'350px',flex:'1 0 350px'}}>
          <small>{group.name}</small>
          <div style={{display:'grid',gridTemplateColumns:'repeat(14, 24px)',gridTemplateRows:'repeat(2, auto)',rowGap:'.25rem',marginTop:'.25rem'}}>
            {group.upper.map((key,index)=>renderKey({...key,column:[2,4,6,10,12][index],row:1}))}
            {group.lower.map((key,index)=>renderKey({...key,column:index*2+1,row:2}))}
          </div>
        </div>)}
      </div>
    </div>
  </section>;
}
