import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppContextProvider, initialState, useAppContext, useProjectHistory, type AppAction } from '../../context/AppContext';

const wrapper = AppContextProvider;
describe('project history through the real context', () => {
  it('undoes musical edits while retaining UI and status, ignores no-ops and clears redo on new edits', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    send({type:'SET_DRUM_PRESET_NAME',payload:'Kit A'});
    send({type:'SET_DRUM_PRESET_NAME',payload:'Kit A'});
    send({type:'SET_TAB',payload:'multisample'});
    send({type:'SET_SELECTED_MULTISAMPLE',payload:4});
    send({type:'SET_SESSION_SAVE_STATUS',payload:{status:'saved'}});
    send({type:'UNDO'});
    expect(result.current.state.drumSettings.presetName).toBe('');
    expect(result.current.state.currentTab).toBe('multisample');
    expect(result.current.state.selectedMultisample).toBe(4);
    expect(result.current.state.sessionSaveStatus).not.toBe('saved');
    expect(result.current.canUndo).toBe(false);
    send({type:'REDO'});
    expect(result.current.state.drumSettings.presetName).toBe('Kit A');
    send({type:'UNDO'}); send({type:'SET_DRUM_PRESET_NAME',payload:'Kit B'});
    expect(result.current.canRedo).toBe(false);
  });
  it('groups explicit gestures and compound imports independently', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    send({type:'BEGIN_EDIT',payload:'drag-1'});
    send({type:'SET_MULTISAMPLE_GAIN',payload:1}); send({type:'SET_MULTISAMPLE_GAIN',payload:4});
    send({type:'END_EDIT',payload:'drag-1'});
    send({type:'BEGIN_EDIT',payload:'drag-2'}); send({type:'SET_MULTISAMPLE_GAIN',payload:7}); send({type:'END_EDIT',payload:'drag-2'});
    send({type:'UNDO'}); expect(result.current.state.multisampleSettings.gain).toBe(4);
    send({type:'UNDO'}); expect(result.current.state.multisampleSettings.gain).toBe(0);
    send({type:'BATCH_EDIT',payload:[{type:'SET_DRUM_PRESET_NAME',payload:'imported'},{type:'SET_IMPORTED_DRUM_PRESET',payload:{unknown:{fx:3}}}]});
    send({type:'UNDO'}); expect(result.current.state.importedDrumPreset).toBeNull();
    expect(result.current.state.drumSettings.presetName).toBe('');
  });
  it('retains sparse and overflow samples by asset identity through trim, gain and replacement', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const audio = new AudioContext().createBuffer(2,3,48000); audio.getChannelData(0)[0]=0.125;
    const file = new File(['source'], 'kick.wav');
    const metadata = {format:'wav' as const,sampleRate:48000,bitDepth:32,channels:2,duration:3/48000,fileSize:6,isFloat:true,audioBuffer:audio,midiNote:60,loopStart:0,loopEnd:0,hasLoopData:false};
    const send = (action:AppAction) => act(() => result.current.dispatch(action));
    send({type:'LOAD_DRUM_SAMPLE',payload:{index:5,audioBuffer:audio,file,metadata}});
    send({type:'ADD_UNASSIGNED_DRUM_SAMPLE',payload:{audioBuffer:audio,file,metadata}});
    send({type:'UPDATE_DRUM_SAMPLE',payload:{index:5,updates:{gain:8,inPoint:1/48000}}});
    send({type:'UNDO'});
    expect(result.current.state.drumSamples[5].gain).toBe(0);
    expect(result.current.state.drumSamples[5].audioBuffer).toBe(audio);
    expect(result.current.state.drumSamples[0].isLoaded).toBe(false);
    expect(result.current.state.drumSamples[24].isAssigned).toBe(false);
    send({type:'REDO'}); expect(result.current.state.drumSamples[5].gain).toBe(8);
    expect(audio.getChannelData(0)[0]).toBe(0.125);
  });
  it('limits history to 100 entries', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    act(() => { for(let i=1;i<=105;i++) result.current.dispatch({type:'SET_DRUM_PRESET_NAME',payload:String(i)}); });
    act(() => {for(let i=0;i<101;i++) result.current.dispatch({type:'UNDO'});});
    expect(result.current.state.drumSettings.presetName).toBe('5');
    expect(result.current.historyLimited).toBe(true);
  });

  it('separates overlapping gesture tokens into distinct undo steps', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    send({type:'BEGIN_EDIT',payload:'first-drag'});
    send({type:'SET_MULTISAMPLE_GAIN',payload:2});
    send({type:'BEGIN_EDIT',payload:'second-drag'});
    send({type:'SET_MULTISAMPLE_GAIN',payload:6});
    send({type:'END_EDIT',payload:'second-drag'});

    send({type:'UNDO'});
    expect(result.current.state.multisampleSettings.gain).toBe(2);
    send({type:'UNDO'});
    expect(result.current.state.multisampleSettings.gain).toBe(0);
  });

  it('does not resurrect redo assets evicted while a gesture is active', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    const audioLabels=new WeakMap<object,string>();
    const fakeAudio = (label:string) => ({
      label,
      duration: 1,
      length: 20 * 1024 * 1024,
      numberOfChannels: 1,
      sampleRate: 48000,
      getChannelData: () => new Float32Array(0),
    }) as unknown as AudioBuffer;
    const makeAudio=(label:string) => { const value=fakeAudio(label); audioLabels.set(value,label); return value; };
    const load = (audioBuffer:AudioBuffer) => send({
      type:'LOAD_DRUM_SAMPLE',
      payload:{index:0,audioBuffer,file:new File(['x'], `${audioLabels.get(audioBuffer) ?? 'sample'}.wav`),metadata:{format:'wav',sampleRate:48000,bitDepth:32,channels:1,duration:1,fileSize:1,isFloat:true,audioBuffer,midiNote:60,loopStart:0,loopEnd:0,hasLoopData:false}},
    });

    load(makeAudio('a'));
    load(makeAudio('b'));
    send({type:'UNDO'});
    expect(result.current.canRedo).toBe(true);

    send({type:'BEGIN_EDIT',payload:'replace'});
    load(makeAudio('c'));
    send({type:'CANCEL_EDIT',payload:'replace'});

    expect(result.current.state.drumSamples[0].file?.name).toBe('a.wav');
    expect(result.current.historyLimited).toBe(true);
    expect(result.current.canRedo).toBe(false);
    send({type:'REDO'});
    expect(result.current.state.drumSamples[0].file?.name).toBe('a.wav');
  });

  it('normalizes Save for all per buffer and undoes the whole operation once', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    const makeSample = (name:string, frames:number, sampleRate:number) => {
      const audioBuffer = new AudioContext().createBuffer(1,frames,sampleRate);
      return {file:new File(['x'],name),audioBuffer,name,isLoaded:true,rootNote:60,note:'C4',
        inPoint:0,outPoint:audioBuffer.duration,loopStart:0,loopEnd:audioBuffer.duration};
    };
    const restored = {...initialState,drumSamples:[],multisampleFiles:[makeSample('long.wav',100,100),makeSample('short.wav',10,40)]};
    send({type:'RESTORE_SESSION',payload:restored});
    send({type:'UPDATE_ALL_MULTI_SAMPLES',payload:{inPoint:0.1,outPoint:0.8,loopStart:0.2,loopEnd:0.7,
      loopCrossfade:{fraction:0.5,importedRaw:50,importedFramecount:100,sourceIdentity:'long.wav'}}});
    expect(result.current.state.multisampleFiles[0]).toMatchObject({inPoint:0.1,outPoint:0.8,loopStart:0.2,loopEnd:0.7,loopCrossfade:{fraction:0.5}});
    expect(result.current.state.multisampleFiles[1]).toMatchObject({inPoint:0.1,outPoint:0.25,loopStart:0.2,loopEnd:0.25,loopCrossfade:{fraction:0.5}});
    expect(result.current.state.multisampleFiles[1].loopCrossfade).toEqual({fraction:0.5});
    send({type:'UNDO'});
    expect(result.current.state.multisampleFiles[0]).toMatchObject({inPoint:0,outPoint:1,loopStart:0,loopEnd:1});
    expect(result.current.state.multisampleFiles[1]).toMatchObject({inPoint:0,outPoint:0.25,loopStart:0,loopEnd:0.25});
    send({type:'REDO'});
    expect(result.current.state.multisampleFiles[1]).toMatchObject({inPoint:0.1,outPoint:0.25,loopStart:0.2,loopEnd:0.25});
  });

  it('applies each explicit preset crossfade atomically while ordinary edits stay authoritative', () => {
    const {result} = renderHook(() => ({...useAppContext(),...useProjectHistory()}), {wrapper});
    const send = (action: AppAction) => act(() => result.current.dispatch(action));
    const audioBuffer = new AudioContext().createBuffer(1,100,100);
    const tone = {file:new File(['x'],'tone.wav'),audioBuffer,name:'tone.wav',isLoaded:true,rootNote:60,note:'C4',
      inPoint:0,outPoint:1,loopStart:0.1,loopEnd:0.9};
    send({type:'RESTORE_SESSION',payload:{...initialState,drumSamples:[],multisampleFiles:[tone]}});
    const first = {regions:[{sample:'tone.wav',framecount:100,'loop.crossfade':25}]};
    const second = {regions:[{sample:'tone.wav',framecount:100,'loop.crossfade':90}]};
    send({type:'IMPORT_MULTISAMPLE_PRESET',payload:first});
    expect(result.current.state.multisampleFiles[0].loopCrossfade).toMatchObject({fraction:0.25,importedRaw:25});
    send({type:'IMPORT_MULTISAMPLE_PRESET',payload:second});
    expect(result.current.state.multisampleFiles[0].loopCrossfade).toMatchObject({fraction:0.9,importedRaw:90});
    send({type:'UNDO'});
    expect(result.current.state.multisampleFiles[0].loopCrossfade).toMatchObject({fraction:0.25,importedRaw:25});
    send({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:0,updates:{loopCrossfade:{fraction:0.4}}}});
    send({type:'IMPORT_MULTISAMPLE_PRESET',payload:second});
    expect(result.current.state.multisampleFiles[0].loopCrossfade).toMatchObject({fraction:0.9,importedRaw:90});
    send({type:'UNDO'});
    expect(result.current.state.multisampleFiles[0].loopCrossfade).toEqual({fraction:0.4});
  });
});
