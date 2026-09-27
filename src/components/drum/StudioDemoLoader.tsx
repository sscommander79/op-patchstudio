import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { generateStudioSeedKit, STUDIO_SEED_SLOTS, studioSeedAdmissionError, type PreparedStudioSeedOperation } from '../../utils/studioDemo';
import { AccessibleDialog } from '../common/AccessibleDialog';

export function StudioDemoLoader({onSelected}:{onSelected:(index:number)=>void}) {
  const {state,dispatch}=useAppContext();
  const [proposal,setProposal]=useState(false);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState<string|null>(null);
  const [operationId,setOperationId]=useState<string|null>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const abort=useRef<AbortController|null>(null);
  const generation=useRef(0);
  const loaded=state.drumSamples.some(sample=>sample?.isLoaded);
  const occupiedDestinations=STUDIO_SEED_SLOTS.filter(index=>state.drumSamples[index]?.isLoaded);
  const addAdmission=studioSeedAdmissionError(state,'add');
  const replaceAdmission=studioSeedAdmissionError(state,'replace');

  useEffect(()=>{
    const result=state.studioSeedCommitResult;
    if(!operationId||result?.operationId!==operationId)return;
    setBusy(false);
    if(result.status==='rejected')setError(result.error??'Studio Seed could not be applied.');
    else {
      setProposal(false);setError(null);
      if(result.selectedIndex!==null&&result.selectedIndex!==undefined)onSelected(result.selectedIndex);
    }
    setOperationId(null);
  },[state.studioSeedCommitResult,operationId,onSelected]);
  useEffect(()=>()=>{generation.current++;abort.current?.abort();},[]);

  const load=async(mode:'add'|'replace')=>{
    const admission=studioSeedAdmissionError(state,mode);
    if(admission){setError(admission);return;}
    const owned=++generation.current;const controller=new AbortController();abort.current=controller;setBusy(true);setProgress(0);setError(null);
    const id=crypto.randomUUID();setOperationId(id);
    try {
      const kit=await generateStudioSeedKit({signal:controller.signal,onProgress:completed=>setProgress(completed)});
      if(controller.signal.aborted||owned!==generation.current)return;
      const payload:PreparedStudioSeedOperation={operationId:id,expectedProjectGeneration:state.projectGeneration??0,mode,kit};
      dispatch({type:'COMMIT_STUDIO_SEED',payload});
    } catch(cause) {
      setBusy(false);setOperationId(null);
      if(!(cause instanceof DOMException&&cause.name==='AbortError'))setError(cause instanceof Error?cause.message:'Studio Seed could not be prepared.');
    }
  };
  const close=()=>{generation.current++;abort.current?.abort();abort.current=null;setOperationId(null);setBusy(false);setProposal(false);setError(null);};
  const start=()=>loaded?setProposal(true):void load('replace');

  if(!state.sessionRecoveryResolved)return null;
  return <section className="studio-demo" data-loaded={loaded} aria-label="Studio Seed demo kit">
    <div className="studio-demo-copy"><p className="studio-eyebrow">STARTER KIT</p><strong>Studio Seed</strong><p>Ten deterministic synthesized drum voices. Loading makes no sound until you play a pad.</p></div>
    <button ref={trigger} type="button" className="studio-button-secondary" disabled={busy||(!loaded&&Boolean(replaceAdmission))} onClick={start}>{busy?`Building ${progress}/10…`:loaded?'Add demo kit':replaceAdmission?'Demo kit unavailable':'Load demo kit'}</button>
    {!proposal&&(error||(!loaded&&replaceAdmission))&&<div role="alert">{error??replaceAdmission}</div>}
    {proposal&&<AccessibleDialog labelledBy="studio-seed-title" onClose={close} returnFocus={trigger.current}>
      <div className="studio-dialog-heading"><div><p className="studio-eyebrow">STUDIO SEED</p><h2 id="studio-seed-title">Add the demo kit</h2></div><button type="button" className="studio-icon-button" onClick={close} aria-label="Close demo kit">×</button></div>
      <p>Add keeps your current instrument settings and places voices into preferred empty pads, then other empty pads, then the unassigned tray.</p>
      <p>Replace clears the drum instrument, applies Studio Seed’s WAV 44.1 kHz 16-bit mono export settings, and keeps multisample work. One Undo restores the prior drum state when it fits the protected history limit.</p>
      <p>{occupiedDestinations.length} of 10 preferred pads are occupied: {occupiedDestinations.length?occupiedDestinations.map(index=>`Pad ${index+1}`).join(', '):'none'}.</p>
      {error&&<div role="alert" className="studio-message studio-message-error">{error}</div>}
      {replaceAdmission&&<div className="studio-message studio-message-warning">{replaceAdmission}</div>}
      {addAdmission&&addAdmission!==replaceAdmission&&<div className="studio-message studio-message-warning">Add is unavailable: {addAdmission}</div>}
      <div className="studio-dialog-actions"><button type="button" className="studio-button-secondary" disabled={busy} onClick={close}>Cancel</button><button type="button" className="studio-button-secondary" disabled={busy||Boolean(replaceAdmission)} onClick={()=>void load('replace')}>Replace drum kit</button><button type="button" className="studio-button-primary" disabled={busy||Boolean(addAdmission)} onClick={()=>void load('add')}>{busy?`Building ${progress}/10…`:'Add to project'}</button></div>
    </AccessibleDialog>}
  </section>;
}

// Optional kit setup guidance stays inside the drum editor instead of gating entry to it.
export function KitSetupGuide() {
  return <details className="studio-guide studio-kit-setup" aria-label="Kit setup guide">
    <summary><span>Kit setup guide</span><span>Optional</span></summary>
    <div className="studio-guide-body"><ol><li>Choose a pad, then move to the next pad as you build the kit.</li><li>Select a browser audio input in Record takes.</li><li>Review your take before adding it to the kit.</li></ol>
      <div className="studio-action-row"><button type="button" className="studio-button-secondary" onClick={()=>window.dispatchEvent(new CustomEvent('opstudio-open-help',{detail:'capture'}))}>Setup help</button></div></div>
  </details>;
}

export function FirstPresetGuide() {
  const {state}=useAppContext();
  const [dismissed,setDismissed]=useState(()=>{try{return localStorage.getItem('opstudio-first-preset-guide')==='dismissed';}catch{return false;}});
  const [played,setPlayed]=useState(false);
  const [exported,setExported]=useState(false);
  const edited=state.drumSamples.some(sample=>sample?.hasBeenEdited);
  useEffect(()=>{
    const play=()=>setPlayed(true),exportedEvent=()=>setExported(true);
    window.addEventListener('opstudio-sample-played',play);window.addEventListener('opstudio-export-created',exportedEvent);
    return()=>{window.removeEventListener('opstudio-sample-played',play);window.removeEventListener('opstudio-export-created',exportedEvent);};
  },[]);
  if(dismissed||state.studioSeedCommitResult?.status!=='committed')return null;
  return <details className="studio-guide" aria-label="First preset guide">
    <summary><span>Your first preset · 3-step guide</span><span>{[played,edited,exported].filter(Boolean).length}/3 complete</span></summary>
    <div className="studio-guide-body"><ol><li data-done={played}>Play a pad</li><li data-done={edited}>Shape a sound</li><li data-done={exported}>Review and export</li></ol><div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={()=>window.dispatchEvent(new CustomEvent('opstudio-open-export'))}>Open export</button><button type="button" className="studio-button-secondary" onClick={()=>{try{localStorage.setItem('opstudio-first-preset-guide','dismissed');}catch{/* Dismiss for this session. */}setDismissed(true);}}>Dismiss guide</button></div></div>
  </details>;
}
