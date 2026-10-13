import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {useReducer} from 'react';
import type {AppState} from '../../context/AppContext';
let restoredState:AppState|undefined;
import {InstrumentJourney} from './InstrumentJourney';

vi.mock('../../context/AppContext',async importOriginal=>{
 const original=await importOriginal<typeof import('../../context/AppContext')>();
 return {...original,useAppContext:()=>{const [state,dispatch]=useReducer(original.appReducer,restoredState??original.initialState);return {state,dispatch};},useProjectHistory:()=>({canUndo:false})};
});
vi.mock('../../hooks/usePatchGeneration',()=>({usePatchGeneration:()=>({generateMultisamplePatchFile:vi.fn()})}));
vi.mock('../common/SmallWaveform',()=>({SmallWaveform:()=>null}));
const OriginalAudioContext=globalThis.AudioContext;
let finishEditor:(value:unknown)=>void;
let failEditor:(reason:unknown)=>void;
const bridge=vi.fn(async(body:Record<string,unknown>):Promise<unknown>=>{
 if(body.operation==='list')return {instruments:[{id:'serum',name:'Serum'}]};
 if(body.operation==='load')return {sound:'Same preset name',presets:[]};
 if(body.operation==='editor')return new Promise((resolve,reject)=>{finishEditor=resolve;failEditor=reject;});
 if(body.operation==='record')return {takes:[{name:'Serum_C2.wav',rootNote:48,wavBase64:'AA==',frames:1000,sampleRate:44100,channels:2}]};
 throw new Error('Unexpected operation');
});
beforeEach(()=>{
 vi.stubGlobal('webkit',{messageHandlers:{instrumentStudio:{postMessage:bridge}}});
 vi.stubGlobal('AudioContext',function(){const context=new OriginalAudioContext();context.decodeAudioData=vi.fn(async()=>new AudioBuffer({numberOfChannels:2,length:1000,sampleRate:44100}));return context;});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();bridge.mockClear();restoredState=undefined;});
async function recorded(){
 render(<InstrumentJourney/>);
 await screen.findByRole('option',{name:'Serum'});
 fireEvent.change(screen.getByRole('combobox',{name:'Instrument'}),{target:{value:'serum'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'choose sound'})).toBeEnabled());
 fireEvent.change(screen.getByRole('combobox',{name:'Last note'}),{target:{value:'48'}});
 fireEvent.click(screen.getByRole('button',{name:'multisample 1 notes'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'export preset'})).toBeEnabled());
}
describe('editing the loaded instrument',()=>{
 it('blocks recording while editing, keeps old audio, and requires recapture even when the preset name stays the same',async()=>{
  await recorded();
  fireEvent.click(screen.getByRole('button',{name:'choose sound'}));
  expect(screen.getByRole('button',{name:'record again'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'export preset'})).toBeDisabled();
  await act(async()=>finishEditor({sound:'Same preset name'}));
  expect(screen.getByRole('combobox',{name:'Sound',hidden:true})).toHaveValue('-998');
  expect(screen.queryByRole('button',{name:'export preset'})).not.toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Serum_C2'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'multisample again'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'multisample again'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'export preset'})).toBeEnabled());
 });
 it('keeps the captured sound exportable when opening an unsupported editor fails',async()=>{
  await recorded();
  fireEvent.click(screen.getByRole('button',{name:'choose sound'}));
  await act(async()=>failEditor(new Error('Editor unavailable')));
  expect(screen.getByRole('status')).toHaveTextContent('Editor unavailable');
  expect(screen.getByRole('button',{name:'export preset'})).toBeEnabled();
 });
});

it('restores the saved range and permits export without loading Serum again',async()=>{
 const {initialState}=await import('../../context/AppContext');
 restoredState={...initialState,multisampleFiles:[48,51,54,57,60,63,66,69,72].map(rootNote=>({file:null,audioBuffer:new AudioBuffer({numberOfChannels:2,length:1000,sampleRate:44100}),name:`Saved_${rootNote}`,isLoaded:true,rootNote,inPoint:0,outPoint:1000/44100,loopStart:0,loopEnd:1000/44100}))};
 render(<InstrumentJourney/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'export preset'})).toBeEnabled());
 expect(screen.getByRole('combobox',{name:'First note'})).toHaveValue('48');
 expect(screen.getByRole('combobox',{name:'Last note'})).toHaveValue('72');
 expect(screen.getByRole('combobox',{name:'Spacing'})).toHaveValue('3');
 expect(bridge).not.toHaveBeenCalledWith(expect.objectContaining({operation:'load'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Spacing'}),{target:{value:'6'}});
 expect(screen.queryByRole('button',{name:'export preset'})).not.toBeInTheDocument();
});
