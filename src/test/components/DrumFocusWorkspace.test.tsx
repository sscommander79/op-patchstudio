import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrumFocusWorkspace } from '../../components/drum/DrumFocusWorkspace';
import { AppContextProvider, useAppContext } from '../../context/AppContext';

function Harness({onSelect=vi.fn()}:{onSelect?:(index:number)=>void}) {
  const {state,dispatch}=useAppContext();
  const [selected,setSelected]=useState(0);
  const sample=(name:string,isAssigned:boolean)=>{const audioBuffer=new AudioBuffer({numberOfChannels:1,length:100,sampleRate:44100});return {...state.drumSamples[0],name,isLoaded:true,file:new File(['x'],`${name}.wav`),audioBuffer,outPoint:audioBuffer.duration,isAssigned,assignedKey:isAssigned?0:undefined};};
  return <><button onClick={()=>dispatch({type:'STORE_DRUM_SAMPLE_ASSET',payload:{targetKeyIndex:null,sample:sample('tray sound',false)}})}>seed tray</button>
    <button onClick={()=>dispatch({type:'STORE_DRUM_SAMPLE_ASSET',payload:{targetKeyIndex:0,sample:sample('kick',true)}})}>seed pad</button>
    <button onClick={()=>dispatch({type:'UNDO'})}>undo</button>
    <output aria-label="current pad mode">{state.drumSamples[0].playmode}</output>
    <DrumFocusWorkspace selectedIndex={selected} onSelect={index=>{setSelected(index);onSelect(index);}} onFileUpload={vi.fn()} onClear={vi.fn()} onRecord={vi.fn()} onSlice={vi.fn()} />
  </>;
}

/** A one-second pad whose stored trim is read straight from the real context, with an editor that can be remounted. */
function TrimHarness() {
  const {state,dispatch}=useAppContext();
  const [mounted,setMounted]=useState(true);
  const stored=state.drumSamples[0];
  const seed=()=>{const audioBuffer=new AudioBuffer({numberOfChannels:1,length:44100,sampleRate:44100});dispatch({type:'STORE_DRUM_SAMPLE_ASSET',payload:{targetKeyIndex:0,sample:{...state.drumSamples[0],name:'kick',isLoaded:true,file:new File(['x'],'kick.wav'),audioBuffer,inPoint:0,outPoint:audioBuffer.duration,isAssigned:true,assignedKey:0}}});};
  return <><button onClick={seed}>seed long pad</button>
    <button onClick={()=>dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:0,updates:{inPoint:.25,outPoint:.5}}})}>trim inside</button>
    <button onClick={()=>setMounted(value=>!value)}>toggle editor</button>
    <output aria-label="stored trim">{JSON.stringify({inPoint:stored.inPoint,outPoint:stored.outPoint,duration:stored.audioBuffer?.duration})}</output>
    {mounted&&<DrumFocusWorkspace selectedIndex={0} onSelect={vi.fn()} onFileUpload={vi.fn()} onClear={vi.fn()} onRecord={vi.fn()} onSlice={vi.fn()} />}
  </>;
}
const storedTrim=()=>JSON.parse(screen.getByLabelText('stored trim').textContent??'{}') as {inPoint:number;outPoint:number;duration:number};
const typeAndLeave=(label:string,text:string)=>{const field=screen.getByLabelText(label);fireEvent.focus(field);fireEvent.change(field,{target:{value:text}});fireEvent.blur(field);};

describe('DrumFocusWorkspace',()=>{
  it('keeps displayed and stored endpoints equal when a zero-length range rejects crossing edits',()=>{
    render(<AppContextProvider><TrimHarness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'seed long pad'}));
    typeAndLeave('Playback start (seconds)','0.5');
    typeAndLeave('Playback end (seconds)','0.5');
    expect(storedTrim()).toMatchObject({inPoint:.5,outPoint:.5});
    typeAndLeave('Playback end (seconds)','0.2');
    expect(screen.getByLabelText('Playback end (seconds)')).toHaveValue(.5);
    typeAndLeave('Playback start (seconds)','0.8');
    expect(screen.getByLabelText('Playback start (seconds)')).toHaveValue(.5);
    typeAndLeave('Playback end (seconds)','-1');
    expect(screen.getByLabelText('Playback end (seconds)')).toHaveValue(.5);
    typeAndLeave('Playback start (seconds)','99');
    expect(screen.getByLabelText('Playback start (seconds)')).toHaveValue(.5);
    expect(storedTrim()).toMatchObject({inPoint:.5,outPoint:.5});
  });
  it('stores the clamped trim, not the previous one, when an out-of-range value is typed and left',()=>{
    render(<AppContextProvider><TrimHarness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'seed long pad'}));
    fireEvent.click(screen.getByRole('button',{name:'trim inside'}));
    // Guard the starting trim, so the assertions below cannot pass on an untouched full-length sample.
    const {duration}=storedTrim();
    expect(duration).toBeGreaterThan(.5);
    expect(storedTrim()).toMatchObject({inPoint:.25,outPoint:.5});

    typeAndLeave('Playback end (seconds)','99');
    expect(storedTrim().outPoint).toBe(duration);
    expect(storedTrim().inPoint).toBe(.25);

    typeAndLeave('Playback start (seconds)','-1');
    expect(storedTrim()).toMatchObject({inPoint:0,outPoint:duration});

    // A remounted editor has no local draft left: it can only show what the project stored.
    fireEvent.click(screen.getByRole('button',{name:'toggle editor'}));
    expect(screen.queryByLabelText('Playback end (seconds)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'toggle editor'}));
    expect(screen.getByLabelText('Playback end (seconds)')).toHaveValue(duration);
    expect(screen.getByLabelText('Playback start (seconds)')).toHaveValue(0);
    expect(storedTrim()).toMatchObject({inPoint:0,outPoint:duration});
  });


  it('moves through pads in the focused editor without leaving it',()=>{
    render(<AppContextProvider><Harness /></AppContextProvider>);
    expect(screen.getByRole('button',{name:'Previous pad'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Next pad →'}));
    expect(screen.getByRole('heading',{name:/pad 2/i})).toBeVisible();
    expect(screen.getByRole('button',{name:'Add sample'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Previous pad'}));
    expect(screen.getByRole('heading',{name:/pad 1/i})).toBeVisible();
    for(let index=0;index<23;index++)fireEvent.click(screen.getByRole('button',{name:'Next pad →'}));
    expect(screen.getByRole('heading',{name:/pad 24/i})).toBeVisible();
    expect(screen.getByRole('button',{name:'Next pad →'})).toBeDisabled();
  });

  it('shows intentional Add and Record actions for an empty selected pad',()=>{
    render(<AppContextProvider><Harness /></AppContextProvider>);
    expect(screen.getByRole('heading',{name:/pad 1/i})).toBeVisible();
    expect(screen.getByRole('button',{name:'Add sample'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Record here'})).toBeEnabled();
    // The pad is already selected, so the copy must not ask the user to select it.
    expect(screen.getByText('This selected pad is empty. Add a sample or record a sound into it.')).toBeVisible();
    expect(screen.queryByText(/select it first/i)).not.toBeInTheDocument();
  });

  it('keeps unassigned audio visible and gives exact occupied-target feedback',()=>{
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'seed tray'}));
    expect(screen.getByRole('region',{name:'Unassigned sounds'})).toHaveTextContent('tray sound');
    fireEvent.click(screen.getByRole('button',{name:'tray sound'}));
    expect(screen.getByText(/pad 1 is empty/i)).toBeVisible();
  });

  it('owns Detailed edit focus, Escape, nested focus restoration, and one-step Undo',async()=>{
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'seed pad'}));
    const detailed=screen.getByRole('button',{name:'Detailed edit'});
    detailed.focus();
    fireEvent.click(detailed);
    const editor=await screen.findByRole('dialog',{name:'Sample options'});
    await waitFor(()=>expect(editor).toContainElement(document.activeElement as HTMLElement));
    expect(document.activeElement).toBe(within(editor).getByRole('button',{name:'Cancel'}));

    const zoom=within(editor).getByRole('button',{name:'Zoom waveform'});
    zoom.focus();
    fireEvent.click(zoom);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    fireEvent.keyDown(document,{key:'Escape'});
    await waitFor(()=>expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(document.activeElement).toBe(zoom);

    const mode=within(editor).getByRole('combobox');
    fireEvent.change(mode,{target:{value:'loop'}});
    fireEvent.click(within(editor).getByRole('button',{name:'Save'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Sample options'})).not.toBeInTheDocument());
    expect(screen.getByLabelText('current pad mode')).toHaveTextContent('loop');
    await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Detailed edit'})));
    fireEvent.click(screen.getByRole('button',{name:'undo'}));
    expect(screen.getByLabelText('current pad mode')).toHaveTextContent('oneshot');

    screen.getByRole('button',{name:'Detailed edit'}).focus();
    fireEvent.click(screen.getByRole('button',{name:'Detailed edit'}));
    const reopened=await screen.findByRole('dialog',{name:'Sample options'});
    fireEvent.change(within(reopened).getByRole('combobox'),{target:{value:'gate'}});
    fireEvent.click(within(reopened).getByRole('button',{name:'Cancel'}));
    expect(screen.getByLabelText('current pad mode')).toHaveTextContent('oneshot');
  });
});
