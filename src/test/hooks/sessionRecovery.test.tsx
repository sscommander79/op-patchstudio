import {act, fireEvent, render, renderHook, screen} from '@testing-library/react';
import {beforeEach, afterEach, expect, it, vi} from 'vitest';
import {AppContextProvider, useAppContext} from '../../context/AppContext';
import {useSessionManagement} from '../../hooks/useSessionManagement';
import {SessionRestorationModal} from '../../components/common/SessionRestorationModal';
import {sessionStorageIndexedDB as storage} from '../../utils/sessionStorageIndexedDB';
import type {SessionData} from '../../utils/indexedDB';
const external = vi.hoisted(() => ({listener:null as null | (()=>void)}));
vi.mock('../../utils/sessionStorageIndexedDB', () => ({sessionStorageIndexedDB:{getCurrentSession:vi.fn(),hasPreviousSession:vi.fn(),clearCorruptedData:vi.fn(),saveSession:vi.fn(),clearCurrentSession:vi.fn(),restoreSession:vi.fn(),loadSession:vi.fn(),hasExternalRevisionChange:vi.fn(),subscribeExternalChange:vi.fn((listener:()=>void)=>{external.listener=listener;return ()=>{};})}}));
const oldSession = {timestamp:Date.now()-2*24*3600000,drumSamples:[{sampleId:'old'}],multisampleFiles:[]} as unknown as SessionData;
const setup = () => renderHook(() => ({...useSessionManagement(), ...useAppContext()}), {wrapper:AppContextProvider});
beforeEach(() => {vi.useFakeTimers(); vi.clearAllMocks(); vi.mocked(storage.getCurrentSession).mockResolvedValue(null); vi.mocked(storage.hasPreviousSession).mockResolvedValue(false); vi.mocked(storage.hasExternalRevisionChange).mockResolvedValue(false); vi.mocked(storage.saveSession).mockResolvedValue('current-session');});
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks();});
it('never autosaves while startup read or recovery decision is unresolved', async () => {
  let resolve!: (value:SessionData|null)=>void;
  vi.mocked(storage.getCurrentSession).mockImplementation(() => new Promise(r => {resolve=r;}));
  vi.mocked(storage.hasPreviousSession).mockResolvedValue(true);
  const {result} = setup();
  await act(async () => {await vi.advanceTimersByTimeAsync(2500);});
  expect(storage.saveSession).not.toHaveBeenCalled();
  await act(async () => {resolve(oldSession);});
  expect(result.current.state.isSessionRestorationModalOpen).toBe(true);
  await act(async () => {await vi.advanceTimersByTimeAsync(2500);});
  expect(storage.saveSession).not.toHaveBeenCalled();
});
it('keeps older-than-12-hour recovery available', async () => {
  vi.mocked(storage.getCurrentSession).mockResolvedValue(oldSession);
  vi.mocked(storage.hasPreviousSession).mockResolvedValue(true);
  const {result} = setup();
  await act(async () => {});
  expect(result.current.state.isSessionRestorationModalOpen).toBe(true);
});
it('exposes persistent save error then retry restores saved status without another autosave loop', async () => {
  vi.mocked(storage.saveSession).mockRejectedValueOnce(new Error('quota full'));
  const {result} = setup();
  await act(async () => {});
  await act(async () => {result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'precious'});});
  await act(async () => {await vi.advanceTimersByTimeAsync(1100);});
  expect(result.current.state.sessionSaveStatus).toBe('error');
  expect(result.current.state.sessionSaveError).toContain('quota full');
  await act(async () => {await vi.advanceTimersByTimeAsync(5000);});
  expect(storage.saveSession).toHaveBeenCalledTimes(1);
  await act(async () => {await result.current.saveSession();});
  expect(result.current.state.sessionSaveStatus).toBe('saved');
  await act(async () => {await vi.advanceTimersByTimeAsync(5000);});
  expect(storage.saveSession).toHaveBeenCalledTimes(2);
});
it('Escape preserves saved work and leaves the restoration decision open', () => {
  const discard = vi.fn(async () => {});
  render(<SessionRestorationModal isOpen onLoadSession={()=>{}} onStartNew={discard} sessionInfo={{timestamp:1,drumSamplesCount:1,multisampleFilesCount:0}}/>);
  fireEvent.keyDown(document,{key:'Escape'});
  expect(discard).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
it('an older save completion cannot mark newer edits saved', async () => {
  let finish!: (value:string)=>void;
  const savedNames:string[]=[];
  vi.mocked(storage.saveSession).mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
  vi.mocked(storage.saveSession).mockImplementationOnce(async state=>{savedNames.push(state.drumSettings.presetName);return 'current-session';});
  const {result}=setup();
  await act(async()=>{});
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'first'});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  expect(result.current.state.sessionSaveStatus).toBe('saving');
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'newer edit'});});
  await act(async()=>{finish('current-session');});
  expect(storage.saveSession).toHaveBeenCalledTimes(2);
  expect(savedNames).toEqual(['newer edit']);
  expect(result.current.state.sessionSaveStatus).toBe('saved');
});
it('a failed restore leaves the editor and saved recovery decision intact',async()=>{
  vi.mocked(storage.getCurrentSession).mockResolvedValue(oldSession);
  vi.mocked(storage.restoreSession).mockRejectedValue(new Error('missing audio'));
  const {result}=setup();
  await act(async()=>{});
  const before=result.current.state.drumSamples;
  await act(async()=>{await result.current.loadSession();});
  expect(result.current.state.drumSamples).toBe(before);
  expect(result.current.state.isSessionRestorationModalOpen).toBe(true);
  expect(result.current.recoveryError).toContain('missing audio');
  expect(storage.clearCurrentSession).not.toHaveBeenCalled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
  expect(storage.saveSession).not.toHaveBeenCalled();
});
it('a failed startup read keeps autosave blocked and retry can expose the preserved recovery',async()=>{
  vi.mocked(storage.getCurrentSession).mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce(oldSession);
  const {result}=setup();
  await act(async()=>{});
  expect(result.current.state.sessionSaveError).toContain('database unavailable');
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
  expect(storage.saveSession).not.toHaveBeenCalled();
  await act(async()=>{await result.current.saveSession();});
  expect(result.current.state.isSessionRestorationModalOpen).toBe(true);
  expect(result.current.state.sessionSaveError).toBeNull();
  expect(storage.clearCurrentSession).not.toHaveBeenCalled();
});
it('saves intact current edits while a delayed library load fails, despite a legacy loading flag',async()=>{
  const {result}=setup();
  await act(async()=>{});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  let committedName='';
  vi.mocked(storage.saveSession).mockImplementation(async state=>{committedName=state.drumSettings.presetName;return 'current-session';});
  vi.mocked(window.sessionStorage.getItem).mockImplementation(key=>key==='loading-preset'?'true':null);
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'unsaved before failed load'});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  // This notification arrives after a decode has outlasted the autosave timer.
  vi.mocked(window.sessionStorage.getItem).mockReturnValue(null);
  await act(async()=>{result.current.dispatch({type:'ADD_NOTIFICATION',payload:{id:'failure',type:'error',title:'load failed',message:'failed to load preset'}});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
  expect(committedName).toBe('unsaved before failed load');
  expect(result.current.state.sessionSaveStatus).toBe('saved');
});
it('an abandoned library loading flag cannot suppress future saves after startup',async()=>{
  vi.mocked(window.sessionStorage.getItem).mockImplementation(key=>key==='loading-preset'?'true':null);
  const {result}=setup();
  await act(async()=>{});
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'new document edit'});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  expect(result.current.state.sessionSaveStatus).toBe('saved');
});
it('does not create a recovery snapshot for a pristine startup with no edits',async()=>{
  setup();
  await act(async()=>{});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  expect(storage.saveSession).not.toHaveBeenCalled();
});
it('guards dirty navigation and pagehide starts a best-effort save before the debounce',async()=>{
  const {result}=setup();
  await act(async()=>{});
  const pristine=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(pristine);
  expect(pristine.defaultPrevented).toBe(false);
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'leave safely'});});
  const dirty=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  await act(async()=>{window.dispatchEvent(new Event('pagehide'));});
  expect(storage.saveSession).toHaveBeenCalledTimes(1);
});
it('keeps navigation guarded after another tab invalidates an otherwise saved recovery',async()=>{
  const {result}=setup();
  await act(async()=>{});
  await act(async()=>{result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:'locally saved'});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(110);});
  expect(result.current.state.sessionSaveStatus).toBe('saved');
  const clean=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  act(()=>external.listener?.());
  expect(result.current.state.sessionSaveStatus).toBe('error');
  const invalidated=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(invalidated);
  expect(invalidated.defaultPrevented).toBe(true);
});
it('detects an overwritten recovery on focus when live cross-tab messaging was unavailable',async()=>{
  const {result}=setup();
  await act(async()=>{});
  vi.mocked(storage.hasExternalRevisionChange).mockResolvedValue(true);
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(result.current.state.sessionSaveStatus).toBe('error');
  expect(result.current.state.sessionSaveError).toContain('another tab');
  const navigation=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(navigation);
  expect(navigation.defaultPrevented).toBe(true);
});

it('retains keyboard ownership while recovery buttons are pending', () => {
  render(<SessionRestorationModal isOpen pending onLoadSession={vi.fn()} onStartNew={vi.fn(async()=>{})} />);
  const event=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.getByRole('dialog')).toHaveFocus();
});

it('requires an explicit recovery choice and wraps focus between available actions', () => {
  const restore=vi.fn(),discard=vi.fn(async()=>{});
  render(<SessionRestorationModal isOpen onLoadSession={restore} onStartNew={discard} />);
  const buttons=screen.getByRole('dialog').querySelectorAll('button');
  buttons[0].focus();fireEvent.keyDown(buttons[0],{key:'Tab',shiftKey:true});expect(buttons[1]).toHaveFocus();
  fireEvent.keyDown(buttons[1],{key:'Tab'});expect(buttons[0]).toHaveFocus();
  fireEvent.keyDown(buttons[0],{key:'Escape'});
  expect(restore).not.toHaveBeenCalled();expect(discard).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeVisible();
});
