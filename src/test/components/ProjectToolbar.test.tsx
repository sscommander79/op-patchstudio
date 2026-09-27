import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectToolbar } from '../../components/common/ProjectToolbar';
import { AppContextProvider, initialState, useAppContext } from '../../context/AppContext';
import * as projectArchive from '../../utils/projectArchive';
import {createProjectSnapshot,type RestoredProject} from '../../utils/projectSerialization';

const {generateDrumPatchFile,generateMultisamplePatchFile}=vi.hoisted(()=>({
  generateDrumPatchFile:vi.fn().mockResolvedValue({ok:true,filename:'Kit.preset.zip'}),
  generateMultisamplePatchFile:vi.fn().mockResolvedValue({ok:true,filename:'Keys.preset.zip'}),
}));
vi.mock('../../hooks/usePatchGeneration',()=>({usePatchGeneration:()=>({generateDrumPatchFile,generateMultisamplePatchFile})}));

function Harness() {
  const {state,dispatch}=useAppContext();
  const seed=()=>{
    const audioBuffer=new AudioBuffer({numberOfChannels:1,length:4410,sampleRate:44100});
    const sample={...state.drumSamples[0],file:new File(['x'],'kick.wav'),audioBuffer,name:'kick',isLoaded:true,isAssigned:true,assignedKey:0,outPoint:.1};
    const retained={...sample,file:new File(['y'],'source.wav'),name:'source',isAssigned:false,assignedKey:undefined};
    dispatch({type:'BATCH_EDIT',payload:[{type:'STORE_DRUM_SAMPLE_ASSET',payload:{sample,targetKeyIndex:0}},{type:'STORE_DRUM_SAMPLE_ASSET',payload:{sample:retained,targetKeyIndex:null}}]});
  };
  return <><ProjectToolbar onRetrySave={vi.fn()} /><output aria-label="project name">{state.drumSettings.presetName}</output><button onClick={()=>dispatch({type:'SET_DRUM_PRESET_NAME',payload:'Keep me'})}>edit</button><button onClick={seed}>seed samples</button></>;
}

function restored(name:string):RestoredProject {
  const snapshot=createProjectSnapshot(initialState);
  return {...snapshot,drumSettings:{...snapshot.drumSettings,presetName:name},drumSamples:[]};
}

describe('ProjectToolbar', () => {
  afterEach(()=>vi.restoreAllMocks());
  it('offers clearly labelled backup and history controls', () => {
    render(<AppContextProvider><Harness /></AppContextProvider>);
    expect(screen.getByRole('button',{name:'Download project'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Open project'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Undo'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Redo'})).toBeDisabled();
    fireEvent.click(screen.getByText('Project'));
    expect(screen.getByText(/project backup.*device patch/i)).toBeVisible();
  });

  it('owns the editable instrument name and opens mapped-only device preflight', async () => {
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.change(screen.getByRole('textbox',{name:'Instrument name'}),{target:{value:'Keep me'}});
    fireEvent.click(screen.getByRole('button',{name:'seed samples'}));
    fireEvent.click(screen.getByRole('button',{name:'Export OP-XY'}));

    const dialog=screen.getByRole('dialog',{name:'Export OP-XY preset'});
    expect(dialog).toHaveTextContent('1 mapped sample');
    expect(dialog).toHaveTextContent('1 retained unassigned sample');
    expect(screen.getByRole('checkbox',{name:/include 1 unassigned sample/i})).not.toBeChecked();
    expect(within(dialog).getByRole('region',{name:'Final instrument checks'})).toHaveTextContent(/file audio is estimated/i);
    fireEvent.click(screen.getByRole('checkbox',{name:/I auditioned the mapped notes or pads/i}));
    fireEvent.click(screen.getByRole('checkbox',{name:/I checked available device storage/i}));
    expect(within(dialog).getByRole('status',{name:'Final check status'})).toHaveTextContent(/checks marked complete/i);
    fireEvent.click(screen.getByText('File naming and format'));
    fireEvent.click(screen.getByRole('checkbox',{name:'Rename files with instrument name'}));
    fireEvent.change(screen.getByLabelText('Filename separator'),{target:{value:'-'}});
    fireEvent.change(screen.getByLabelText('Audio format'),{target:{value:'aiff'}});
    expect(within(dialog).getByRole('status',{name:'Final check status'})).toHaveTextContent(/checks are still open/i);
    fireEvent.click(screen.getByRole('button',{name:'Download preset'}));
    await waitFor(()=>expect(generateDrumPatchFile).toHaveBeenCalledWith('Keep me',{includeUnassigned:false}));
    expect(dialog).toHaveTextContent(/browser created.*not.*device transfer/i);
    expect(within(dialog).getByRole('region',{name:'Transfer to OP-XY'})).toHaveTextContent(/COM.*M4/i);
    expect(within(dialog).getByRole('region',{name:'Transfer to OP-XY'})).toHaveTextContent(/extract the downloaded ZIP.*patch.json/i);
    expect(within(dialog).getByRole('link',{name:/current OP-XY transfer guide/i})).toHaveAttribute('href','https://teenage.engineering/guides/op-xy/how-to');
  });

  it('keeps preflight open with the real generation error', async () => {
    generateDrumPatchFile.mockResolvedValueOnce({ok:false,error:'conversion exploded'});
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.change(screen.getByRole('textbox',{name:'Instrument name'}),{target:{value:'Keep me'}});
    fireEvent.click(screen.getByRole('button',{name:'seed samples'}));
    fireEvent.click(screen.getByRole('button',{name:'Export OP-XY'}));
    fireEvent.click(screen.getByRole('button',{name:'Download preset'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('conversion exploded');
    expect(screen.getByRole('dialog',{name:'Export OP-XY preset'})).toBeVisible();
  });

  it('downloads the click-time snapshot with a deterministic extension', async () => {
    const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'edit'}));
    fireEvent.click(screen.getByRole('button',{name:'Download project'}));
    await waitFor(()=>expect(click).toHaveBeenCalledOnce());
    expect(URL.createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows an actionable invalid-archive error without touching current work', async () => {
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'edit'}));
    const input=screen.getByLabelText('Project backup file');
    fireEvent.change(input,{target:{files:[new File(['not a zip'],'broken.opstudio',{type:'application/zip'})]}});
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not open project/i);
    expect(screen.getByLabelText('project name')).toHaveTextContent('Keep me');
  });

  it('keeps an intervening edit when a valid slow project finishes opening',async()=>{
    let finish:(project:RestoredProject)=>void=()=>{};
    vi.spyOn(projectArchive,'importProjectArchive').mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.change(screen.getByLabelText('Project backup file'),{target:{files:[new File(['valid'],'slow.opstudio')]}});
    fireEvent.click(screen.getByRole('button',{name:'edit'}));
    await act(async()=>finish(restored('Opened too late')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/project changed while this backup was opening.*try again/i);
    expect(screen.getByLabelText('project name')).toHaveTextContent('Keep me');
  });

  it('opens a valid project when musical state stayed unchanged',async()=>{
    vi.spyOn(projectArchive,'importProjectArchive').mockResolvedValueOnce(restored('Opened cleanly'));
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.change(screen.getByLabelText('Project backup file'),{target:{files:[new File(['valid'],'clean.opstudio')]}});
    expect(await screen.findByText('Opened project backup clean.opstudio')).toBeVisible();
    expect(screen.getByLabelText('project name')).toHaveTextContent('Opened cleanly');
  });

  it('opens a valid project after StrictMode replays mount effects',async()=>{
    vi.spyOn(projectArchive,'importProjectArchive').mockResolvedValueOnce(restored('Strict open'));
    render(<StrictMode><AppContextProvider><Harness /></AppContextProvider></StrictMode>);
    fireEvent.change(screen.getByLabelText('Project backup file'),{target:{files:[new File(['valid'],'strict.opstudio')]}});
    expect(await screen.findByText('Opened project backup strict.opstudio')).toBeVisible();
    expect(screen.getByLabelText('project name')).toHaveTextContent('Strict open');
  });

  it('keeps intervening edits when a slow archive fails',async()=>{
    let fail:(error:Error)=>void=()=>{};
    vi.spyOn(projectArchive,'importProjectArchive').mockReturnValueOnce(new Promise((_resolve,reject)=>{fail=reject;}));
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.change(screen.getByLabelText('Project backup file'),{target:{files:[new File(['bad'],'slow-broken.opstudio')]}});
    fireEvent.click(screen.getByRole('button',{name:'edit'}));
    await act(async()=>fail(new Error('archive decode failed')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/archive decode failed.*current project was kept/i);
    expect(screen.getByLabelText('project name')).toHaveTextContent('Keep me');
  });

  it('lets only the newest overlapping open request commit',async()=>{
    let finishFirst:(project:RestoredProject)=>void=()=>{},finishSecond:(project:RestoredProject)=>void=()=>{};
    vi.spyOn(projectArchive,'importProjectArchive')
      .mockReturnValueOnce(new Promise(resolve=>{finishFirst=resolve;}))
      .mockReturnValueOnce(new Promise(resolve=>{finishSecond=resolve;}));
    render(<AppContextProvider><Harness /></AppContextProvider>);
    const input=screen.getByLabelText('Project backup file');
    fireEvent.change(input,{target:{files:[new File(['one'],'first.opstudio')]}});
    fireEvent.change(input,{target:{files:[new File(['two'],'second.opstudio')]}});
    await act(async()=>finishSecond(restored('Second request')));
    expect(await screen.findByText('Opened project backup second.opstudio')).toBeVisible();
    await act(async()=>finishFirst(restored('First request')));
    expect(screen.getByLabelText('project name')).toHaveTextContent('Second request');
    expect(screen.queryByText('Opened project backup first.opstudio')).not.toBeInTheDocument();
  });
});
