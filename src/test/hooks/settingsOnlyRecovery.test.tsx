import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {AppContextProvider,initialState,useAppContext} from '../../context/AppContext';
import {useSessionManagement} from '../../hooks/useSessionManagement';
import {indexedDB as db} from '../../utils/indexedDB';
import {sessionStorageIndexedDB as sessions} from '../../utils/sessionStorageIndexedDB';
beforeEach(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());await db.init();sessions.resetForTesting();});
afterEach(()=>{vi.unstubAllGlobals();});
it('settings-only save → reload waits for decision, then restores names, effects and envelopes',async()=>{
  const saved={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Before samples'},importedDrumPreset:{fx:{drive:37}},
    multisampleSettings:{...initialState.multisampleSettings,ampEnvelope:{attack:17,decay:29,sustain:41,release:53}}};
  await sessions.saveSession(saved);
  const {result}=renderHook(()=>({...useSessionManagement(),...useAppContext()}),{wrapper:AppContextProvider});
  await waitFor(()=>expect(result.current.state.isSessionRestorationModalOpen).toBe(true));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
  const beforeRestore=await sessions.loadSession();
  expect(beforeRestore?.drumSettings.presetName).toBe('Before samples');
  await act(async()=>{await result.current.loadSession();});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,200));});
  expect(result.current.state.drumSettings.presetName).toBe('Before samples');
  expect(result.current.state.importedDrumPreset).toEqual({fx:{drive:37}});
  expect(result.current.state.multisampleSettings.ampEnvelope).toEqual({attack:17,decay:29,sustain:41,release:53});
  expect(result.current.state.isSessionRestorationModalOpen).toBe(false);
  expect((await sessions.loadSession())?.revisionToken).toBe(beforeRestore?.revisionToken);
});
it('a real delayed decode failure leaves current edits committed without another edit',async()=>{
  const {deserializeLibraryPreset}=await import('../../utils/libraryUtils');
  const {STORED_AUDIO_TYPE}=await import('../../utils/storedAudio');
  const {result}=renderHook(()=>({...useSessionManagement(),...useAppContext()}),{wrapper:AppContextProvider});
  await waitFor(()=>expect(result.current.state.sessionSaveStatus).toBe('idle'));
  let release!: (value:ArrayBuffer)=>void;
  const broken=new Blob([new Uint8Array(24)],{type:STORED_AUDIO_TYPE});
  vi.spyOn(broken,'arrayBuffer').mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
  // Simulates an outstanding library audio read, including a legacy flag left by navigation.
  vi.mocked(window.sessionStorage.getItem).mockImplementation(key=>key==='loading-preset'?'true':null);
  const incoming=deserializeLibraryPreset({id:'broken',name:'broken',type:'drum',createdAt:1,updatedAt:1,isFavorite:false,data:{
    drumSettings:initialState.drumSettings,multisampleSettings:initialState.multisampleSettings,multisampleFiles:[],
    drumSamples:[{audioBlob:broken,originalIndex:5,name:'broken'}],
  }});
  const rejected=expect(incoming).rejects.toThrow('Invalid stored audio header');
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'preserve during slow decode'});});
  await waitFor(async()=>expect((await sessions.loadSession())?.drumSettings.presetName).toBe('preserve during slow decode'),{timeout:3000});
  await act(async()=>{
    release(new ArrayBuffer(24)); await rejected;
    vi.mocked(window.sessionStorage.getItem).mockReturnValue(null);
    result.current.dispatch({type:'ADD_NOTIFICATION',payload:{id:'load-failure',type:'error',title:'load failed',message:'failed to load preset'}});
  });
  expect(result.current.state.drumSettings.presetName).toBe('preserve during slow decode');
  expect((await sessions.loadSession())?.drumSettings.presetName).toBe('preserve during slow decode');
  expect(result.current.state.sessionSaveStatus).toBe('saved');
});
