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

describe('DrumFocusWorkspace',()=>{
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
    const editor=await screen.findByRole('dialog',{name:'sample options'});
    await waitFor(()=>expect(editor).toContainElement(document.activeElement as HTMLElement));
    expect(document.activeElement).toBe(within(editor).getByRole('button',{name:'cancel'}));

    const zoom=within(editor).getByRole('button',{name:'zoom waveform'});
    zoom.focus();
    fireEvent.click(zoom);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    fireEvent.keyDown(document,{key:'Escape'});
    await waitFor(()=>expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(document.activeElement).toBe(zoom);

    const mode=within(editor).getByRole('combobox');
    fireEvent.change(mode,{target:{value:'loop'}});
    fireEvent.click(within(editor).getByRole('button',{name:'save'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'sample options'})).not.toBeInTheDocument());
    expect(screen.getByLabelText('current pad mode')).toHaveTextContent('loop');
    await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Detailed edit'})));
    fireEvent.click(screen.getByRole('button',{name:'undo'}));
    expect(screen.getByLabelText('current pad mode')).toHaveTextContent('oneshot');

    screen.getByRole('button',{name:'Detailed edit'}).focus();
    fireEvent.click(screen.getByRole('button',{name:'Detailed edit'}));
    const reopened=await screen.findByRole('dialog',{name:'sample options'});
    fireEvent.change(within(reopened).getByRole('combobox'),{target:{value:'gate'}});
    fireEvent.click(within(reopened).getByRole('button',{name:'cancel'}));
    expect(screen.getByLabelText('current pad mode')).toHaveTextContent('oneshot');
  });
});
