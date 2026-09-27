import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContextProvider, appReducer, initialState, useAppContext, useProjectHistory } from '../../context/AppContext';
import type { ImportResult } from '../../utils/presetImport';

const mocks=vi.hoisted(()=>({importPresetFromFile:vi.fn()}));
vi.mock('../../utils/presetImport',async()=>{
  const actual=await vi.importActual<typeof import('../../utils/presetImport')>('../../utils/presetImport');
  return {...actual,importPresetFromFile:mocks.importPresetFromFile};
});

function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve};}
function Harness() {
  const {state,dispatch,importPresetFile}=useAppContext();
  const {canUndo}=useProjectHistory();
  return <>
    <button onClick={()=>void importPresetFile!(new File(['{}'],'drum.json'),'drum')}>drum import</button>
    <button onClick={()=>void importPresetFile!(new File(['{}'],'multi.json'),'multisample')}>multi import</button>
    <button onClick={()=>dispatch({type:'BUMP_PROJECT_GENERATION'})}>replace project</button>
    <button onClick={()=>{const audioBuffer=new AudioContext().createBuffer(1,8,8_000);dispatch({type:'LOAD_MULTISAMPLE_FILE',payload:{file:new File(['match'],'match.wav'),audioBuffer,metadata:{format:'wav',sampleRate:8_000,sourceSampleRate:8_000,bitDepth:16,channels:1,sourceChannels:1,duration:audioBuffer.duration,audioBuffer,fileSize:5,midiNote:60,loopStart:0,loopEnd:audioBuffer.duration,hasLoopData:false},rootNoteOverride:60}})}}>load match</button>
    <button onClick={()=>dispatch({type:'UNDO'})}>undo</button>
    <output data-testid="state">{JSON.stringify({generation:state.projectGeneration,drum:state.importedDrumPreset,multi:state.importedMultisamplePreset,playmode:state.drumSettings.presetSettings.playmode,multiCount:state.multisampleFiles.length,crossfade:state.multisampleFiles[0]?.loopCrossfade,canUndo,notification:state.notifications.at(-1)})}</output>
  </>;
}
const read=()=>JSON.parse(screen.getByTestId('state').textContent||'{}') as {generation:number;drum:unknown;multi:unknown;playmode:string;multiCount:number;crossfade:unknown;canUndo:boolean;notification?:{type:string;message:string}};

describe('guarded preset settings import',()=>{
  beforeEach(()=>mocks.importPresetFromFile.mockReset());

  it('lets the latest cross-mode operation win even when an older read finishes first',async()=>{
    const old=deferred<ImportResult>(),latest=deferred<ImportResult>();
    mocks.importPresetFromFile.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    render(<AppContextProvider><Harness/></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'drum import'}));
    fireEvent.click(screen.getByRole('button',{name:'multi import'}));
    await waitFor(()=>expect(mocks.importPresetFromFile).toHaveBeenCalledTimes(2));
    await act(async()=>old.resolve({success:true,data:{type:'drum',engine:{playmode:'mono'},vendor:{operation:'old'}}}));
    expect(JSON.stringify(read().drum)).not.toContain('"operation":"old"');
    await act(async()=>latest.resolve({success:true,data:{type:'multisampler',vendor:{operation:'latest'}}}));
    await waitFor(()=>expect(JSON.stringify(read().multi)).toContain('"operation":"latest"'));
  });

  it('ignores a delayed completion after the project replacement boundary',async()=>{
    const pending=deferred<ImportResult>();mocks.importPresetFromFile.mockReturnValue(pending.promise);
    render(<AppContextProvider><Harness/></AppContextProvider>);
    const before=JSON.stringify(read().drum);
    fireEvent.click(screen.getByRole('button',{name:'drum import'}));
    fireEvent.click(screen.getByRole('button',{name:'replace project'}));
    await act(async()=>pending.resolve({success:true,data:{type:'drum',vendor:{operation:'stale'}}}));
    await waitFor(()=>expect(read().generation).toBe(1));
    expect(JSON.stringify(read().drum)).toBe(before);
  });

  it('commits valid settings as one undoable edit',async()=>{
    mocks.importPresetFromFile.mockResolvedValue({success:true,data:{type:'drum',engine:{playmode:'mono'},vendor:{operation:'valid'}}});
    render(<AppContextProvider><Harness/></AppContextProvider>);
    const before=JSON.stringify(read().drum),beforeMode=read().playmode;
    fireEvent.click(screen.getByRole('button',{name:'drum import'}));
    await waitFor(()=>expect(JSON.stringify(read().drum)).toContain('"operation":"valid"'));
    expect(read().playmode).toBe('mono');
    fireEvent.click(screen.getByRole('button',{name:'undo'}));
    await waitFor(()=>expect(JSON.stringify(read().drum)).toBe(before));
    expect(read().playmode).toBe(beforeMode);
  });

  it('validates the exact live cross-mode manifest atomically before commit',()=>{
    const retained={type:'multisampler',vendor:'m'.repeat(1_048_300)};
    const before={...initialState,importedDrumPreset:null,importedMultisamplePreset:retained,notifications:[]};
    const pending=appReducer(before,{type:'BEGIN_PRESET_IMPORT',payload:{operationId:'combined'}});
    const result=appReducer(pending,{type:'COMMIT_PRESET_IMPORT',payload:{operationId:'combined',instrument:'drum',result:{success:true,data:{type:'drum',vendor:'d'.repeat(1_048_300)}}}});
    expect(result.importedDrumPreset).toBeNull();
    expect(result.importedMultisamplePreset).toBe(retained);
    expect(result.notifications.at(-1)).toMatchObject({type:'error',title:'import failed'});
  });

  it('rejects invalid derived crossfade provenance without adding an undo step',async()=>{
    mocks.importPresetFromFile.mockResolvedValue({success:true,data:{type:'multisampler',regions:[{sample:'match.wav',framecount:8,'loop.crossfade':0.5}]}});
    render(<AppContextProvider><Harness/></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'load match'}));
    await waitFor(()=>expect(read().multiCount).toBe(1));
    expect(read().canUndo).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'multi import'}));
    await waitFor(()=>expect(read().notification).toMatchObject({type:'error',message:expect.stringMatching(/crossfade/i)}));
    expect(read().multi).toBeNull();
    expect(read().crossfade).toBeUndefined();
    fireEvent.click(screen.getByRole('button',{name:'undo'}));
    await waitFor(()=>expect(read().multiCount).toBe(0));
    expect(read().canUndo).toBe(false);
  });
});
