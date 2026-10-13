import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { AppContextProvider, initialState, useAppContext, type MultisampleFile } from '../../context/AppContext';
import { RecordingModal, type RecordingTarget } from '../../components/common/RecordingModal';
import { StudioShell } from '../../components/common/StudioShell';
import type { SessionTake } from '../../audio/recording/captureSession';
import * as recordingApplication from '../../utils/recordingApplication';

const midi=vi.hoisted(()=>({supported:true,enabled:false,outputs:[{id:'virtual',name:'Synthetic MIDI output',state:'connected',connection:'open',send:vi.fn()}],enable:vi.fn(async()=>{midi.enabled=true}),addListener:vi.fn(),removeListener:vi.fn(),getOutputById:vi.fn((id:string,options?:{disconnected?:boolean})=>options?.disconnected?undefined:midi.outputs.find(output=>output.id===id))}));
vi.mock('webmidi',()=>({WebMidi:midi}));
vi.mock('../../audio/recording/captureProcessor.ts?worker&url',()=>({default:'/assets/capture-test.js'}));
let sequence=0,enableGate:Promise<void>|undefined,stopGate:Promise<void>|undefined,captureOnStart=true;
let enableError:string|undefined;
let capturedTone=false;
interface FakeDeps {onStatus:(status:{state:string;elapsedFrames?:number})=>void;onTake:(take:SessionTake)=>void|Promise<void>;onError?:(message:string)=>void}
const sessions:Array<{disposed:boolean;deps:FakeDeps}>=[];
vi.mock('../../audio/recording/captureSession',()=>({
  RECORDING_LIMITS:{takes:32,ownedBytes:256*1024*1024,flushMs:500},
  CaptureSession:class {
    status={state:'idle'}; deps:FakeDeps;disposed=false;
    constructor(deps:FakeDeps){this.deps=deps;sessions.push(this)}
    async enableInput(){await enableGate;if(enableError){this.status={state:'error'};this.deps.onStatus(this.status);this.deps.onError?.(enableError);return false;}this.status={state:'monitoring'};this.deps.onStatus(this.status);return true}
    async enumerateInputs(){return [{deviceId:'synthetic',label:'Synthetic input'}]}
    start(){if(this.status.state==='error')throw new Error('Enable input before recording');this.status={state:'recording'};this.deps.onStatus({...this.status,elapsedFrames:128});if(!captureOnStart)return;const buffer=new OriginalAudioContext().createBuffer(1,capturedTone?44100:2,capturedTone?44100:8_000);if(capturedTone){const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=.3*Math.sin(2*Math.PI*440*i/44100);}else buffer.copyToChannel(Float32Array.from([.125,-.25]),0);
      void Promise.resolve(this.deps.onTake({id:'take-'+(++sequence),audioBuffer:buffer,frames:buffer.length,sampleRate:buffer.sampleRate,channels:1,actualPreRollFrames:0,completionReason:'manual'})).catch(reason=>this.deps.onError?.(reason instanceof Error?reason.message:String(reason)));this.status={state:'monitoring'};this.deps.onStatus(this.status);}
    arm(){this.start()} async stop(){await stopGate;this.status={state:'stopped'};this.deps.onStatus(this.status)} async dispose(){this.disposed=true;this.status={state:'closed'}}
  }
}));

const OriginalAudioContext=globalThis.AudioContext;
const autoSamplingKey='op-patchstudio:auto-sampling:v1';
let autoSamplingPreferences:string|null=null;
function openDetails(summaryText:string){const details=screen.getByText(summaryText).closest('details') as HTMLDetailsElement;act(()=>{details.open=true;});return details;}
function ProjectCount(){const {state}=useAppContext();return <><output aria-label="Loaded drum count">{state.drumSamples.filter(sample=>sample.isLoaded).length}</output><output aria-label="Loaded multisample count">{state.multisampleFiles.length}</output></>}
function Harness({instrument='drum',target=instrument==='drum'?{kind:'drum' as const}:{kind:'multisample' as const,rootNote:64}}:{instrument?:'drum'|'multisample';target?:RecordingTarget}) {
  return <AppContextProvider><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument={instrument} target={target}/></AppContextProvider>;
}
function GuidedHarness(){return <AppContextProvider><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument="multisample" target={{kind:'multisample'}} guidedIntent={{source:'hardware',requestId:1}}/></AppContextProvider>}
function InjectRoot(){const {dispatch}=useAppContext();return <button onClick={()=>{const audioBuffer=new OriginalAudioContext().createBuffer(1,2,8_000),file=new File(['conflict'],'conflict.wav');dispatch({type:'LOAD_MULTISAMPLE_FILE',payload:{file,audioBuffer,rootNoteOverride:48,metadata:{format:'wav',sampleRate:8_000,bitDepth:16,channels:1,duration:audioBuffer.duration,audioBuffer,fileSize:file.size,midiNote:48,loopStart:0,loopEnd:0,hasLoopData:false}}});}}>Inject root conflict</button>}
function GuidedConflictHarness(){return <AppContextProvider><ProjectCount/><InjectRoot/><RecordingModal isOpen onClose={vi.fn()} instrument="multisample" target={{kind:'multisample'}} guidedIntent={{source:'hardware',requestId:3}}/></AppContextProvider>}
function ClosingHarness(){const [open,setOpen]=useState(true);return <AppContextProvider><ProjectCount/><RecordingModal isOpen={open} onClose={()=>setOpen(false)} instrument="drum" target={{kind:'drum'}}/></AppContextProvider>}
function ShellHelpHarness(){return <AppContextProvider><StudioShell/><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument="drum" target={{kind:'drum'}}/></AppContextProvider>}
function ReopeningHarness(){const [open,setOpen]=useState(true);return <AppContextProvider><ProjectCount/><button onClick={()=>setOpen(true)}>Open recorder</button><RecordingModal isOpen={open} onClose={()=>setOpen(false)} instrument="drum" target={{kind:'drum'}}/></AppContextProvider>}
function SeedMultisample({rootNote}:{rootNote:number}){const {dispatch}=useAppContext();useEffect(()=>{const buffer=new OriginalAudioContext().createBuffer(1,2,8_000),file=new File(['seed'],`seed-${rootNote}.wav`);dispatch({type:'LOAD_MULTISAMPLE_FILE',payload:{file,audioBuffer:buffer,rootNoteOverride:rootNote,metadata:{format:'wav',sampleRate:8_000,bitDepth:16,channels:1,duration:buffer.duration,audioBuffer:buffer,fileSize:file.size,midiNote:rootNote,loopStart:0,loopEnd:0,hasLoopData:false}}});},[dispatch,rootNote]);return null}
function SeedMultisamples({count}:{count:number}){const {dispatch}=useAppContext();useEffect(()=>{for(let rootNote=0;rootNote<count;rootNote+=1){const buffer=new OriginalAudioContext().createBuffer(1,2,8_000),file=new File(['seed'],`seed-${rootNote}.wav`);dispatch({type:'LOAD_MULTISAMPLE_FILE',payload:{file,audioBuffer:buffer,rootNoteOverride:rootNote,metadata:{format:'wav',sampleRate:8_000,bitDepth:16,channels:1,duration:buffer.duration,audioBuffer:buffer,fileSize:file.size,midiNote:rootNote,loopStart:0,loopEnd:0,hasLoopData:false}}});}},[count,dispatch]);return null}
function SeedFullDrums(){const {dispatch}=useAppContext();useEffect(()=>{for(let index=0;index<24;index+=1){const buffer=new OriginalAudioContext().createBuffer(1,2,8_000),file=new File(['seed'],`seed-${index}.wav`);dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index,updates:{file,audioBuffer:buffer,name:file.name,isLoaded:true,inPoint:0,outPoint:buffer.duration,fileSize:file.size,duration:buffer.duration}}});}},[dispatch]);return null}
function OccupiedMultisampleHarness(){return <AppContextProvider><SeedMultisample rootNote={64}/><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument="multisample" target={{kind:'multisample',rootNote:64}}/></AppContextProvider>}
function GuidedCapacityHarness(){return <AppContextProvider><SeedMultisamples count={23}/><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument="multisample" target={{kind:'multisample'}} guidedIntent={{source:'hardware',requestId:2}}/></AppContextProvider>}
function FullDrumHarness(){return <AppContextProvider><SeedFullDrums/><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument="drum" target={{kind:'drum'}}/></AppContextProvider>}
function SeedLegacyRoots(){const {dispatch}=useAppContext();useEffect(()=>{const multisampleFiles:Array<MultisampleFile>=Array.from({length:128},(_,rootNote)=>{const audioBuffer=new OriginalAudioContext().createBuffer(1,1,8_000),file=new File([String(rootNote)],`legacy-${rootNote}.wav`);return {file,audioBuffer,name:file.name,isLoaded:true,rootNote,note:String(rootNote),inPoint:0,outPoint:audioBuffer.duration,loopStart:0,loopEnd:audioBuffer.duration,fileSize:file.size,duration:audioBuffer.duration};});dispatch({type:'RESTORE_SESSION',payload:{drumSettings:initialState.drumSettings,multisampleSettings:initialState.multisampleSettings,drumSamples:initialState.drumSamples.map((sample,originalIndex)=>({...sample,originalIndex})),multisampleFiles,selectedMultisample:null,isDrumKeyboardPinned:false,isMultisampleKeyboardPinned:false,importedDrumPreset:null,importedMultisamplePreset:null,midiNoteMapping:initialState.midiNoteMapping}});},[dispatch]);return null}
function LegacyRootsHarness({instrument}:{instrument:'drum'|'multisample'}){return <AppContextProvider><SeedLegacyRoots/><ProjectCount/><RecordingModal isOpen onClose={vi.fn()} instrument={instrument} target={{kind:instrument}}/></AppContextProvider>}

describe('RecordingModal review workflow',()=>{
  beforeEach(()=>{enableError=undefined;capturedTone=false;});
  it.each(['Enable input','Start recording'])('keeps the failed setup explanation and permits recovery after %s',async(trigger)=>{
    const user=userEvent.setup();enableError='Capture channel dimensions changed';render(<Harness/>);
    await user.click(screen.getByRole('button',{name:trigger}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Capture channel dimensions changed');
    expect(screen.getByRole('button',{name:'Start recording'})).toBeDisabled();
    expect(screen.queryByRole('button',{name:'Wait for sound'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Input device')).toBeEnabled();
    expect(screen.getByLabelText('Recording starts')).toBeEnabled();
    await user.selectOptions(screen.getByLabelText('Recording starts'),'sound');
    expect(screen.getByRole('button',{name:'Wait for sound'})).toBeDisabled();
    expect(screen.queryByRole('button',{name:'Start recording'})).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Recording starts'),'manual');
    expect(screen.getByRole('button',{name:'Start recording'})).toBeDisabled();
    enableError=undefined;
    await user.click(screen.getByRole('button',{name:'Enable input'}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Start recording'})).toBeEnabled();
    await user.click(screen.getByRole('button',{name:'Start recording'}));
    expect(await screen.findByLabelText('Name for take take-1')).toHaveValue('Take 1');
  });

  beforeEach(()=>{sequence=0;enableGate=stopGate=undefined;captureOnStart=true;sessions.length=0;midi.enabled=false;midi.outputs[0].send.mockClear();autoSamplingPreferences=null;vi.mocked(localStorage.getItem).mockReset().mockImplementation(key=>key===autoSamplingKey?autoSamplingPreferences:null);vi.mocked(localStorage.setItem).mockReset().mockImplementation((key,value)=>{if(key===autoSamplingKey)autoSamplingPreferences=value;});localStorage.removeItem(autoSamplingKey);Object.defineProperty(globalThis,'AudioContext',{value:OriginalAudioContext,configurable:true});Object.defineProperty(globalThis,'AudioWorkletNode',{value:class{},configurable:true});Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
    Object.assign(navigator.mediaDevices,{getUserMedia:vi.fn(),enumerateDevices:vi.fn().mockResolvedValue([]),addEventListener:vi.fn(),removeEventListener:vi.fn()});});
  afterEach(()=>Object.defineProperty(globalThis,'AudioContext',{value:OriginalAudioContext,configurable:true}));

  it('owns deterministic initial focus for manual and guided recording',async()=>{
    const manual=render(<Harness/>);await waitFor(()=>expect(screen.getByLabelText('Recording starts')).toHaveFocus());manual.unmount();
    render(<GuidedHarness/>);await waitFor(()=>expect(document.querySelector('[data-studio-automatic-panel]')).toHaveFocus());
  });

  it('keeps distinct take IDs through rename/remove and applies the selected tray atomically',async()=>{
    const user=userEvent.setup();render(<Harness/>);expect(screen.getByRole('dialog',{name:'Record takes'})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Enable input'}));await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Start recording'}));
    const names=await screen.findAllByLabelText(/Name for take/);expect(names).toHaveLength(2);
    await user.clear(names[0]);await user.type(names[0],'Kick');const remove=screen.getAllByRole('button',{name:/Remove take/});await user.click(remove[1]);
    expect(screen.getByRole('group',{name:/Take Kick take-1/})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Add selected takes'}));
    await waitFor(()=>expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('1'));
    expect(screen.getByText(/1 take added/)).toBeInTheDocument();expect(screen.getByText(/No takes yet/)).toBeInTheDocument();
  });

  it('creates a fresh owned input session for each manual Start after Stop',async()=>{
    const user=userEvent.setup();render(<Harness/>);
    await user.click(screen.getByRole('button',{name:'Start recording'}));await screen.findByLabelText('Name for take take-1');
    await user.click(screen.getByRole('button',{name:'Stop recording'}));
    await user.click(screen.getByRole('button',{name:'Start recording'}));await screen.findByLabelText('Name for take take-2');
    expect(sessions).toHaveLength(2);
  });

  it('preserves unaccepted takes until an explicit discard and keeps Resume focused',async()=>{
    const user=userEvent.setup();render(<ClosingHarness/>);
    await user.click(screen.getByRole('button',{name:'Start recording'}));
    const name=await screen.findByLabelText('Name for take take-1');
    await user.clear(name);await user.type(name,'Keep this take');
    await user.click(screen.getByRole('button',{name:'Close'}));
    expect(screen.getByRole('alertdialog',{name:'Discard recording work'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Resume recording'})).toHaveFocus();
    expect(screen.getByLabelText('Name for take take-1')).toHaveValue('Keep this take');
    await user.click(screen.getByRole('button',{name:'Resume recording'}));
    expect(screen.getByLabelText('Name for take take-1')).toHaveValue('Keep this take');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog',{name:'Record takes'})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Stop and discard'}));
    expect(screen.queryByRole('dialog',{name:'Record takes'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('0');
  });

  it('isolates the discard decision from editing and loops focus until Resume or discard',async()=>{
    const user=userEvent.setup();render(<ClosingHarness/>);
    await user.click(screen.getByRole('button',{name:'Start recording'}));
    await screen.findByLabelText('Name for take take-1');
    await user.click(screen.getByRole('button',{name:'Close'}));
    const resume=screen.getByRole('button',{name:'Resume recording'});
    expect(resume).toHaveFocus();
    await user.tab();expect(screen.getByRole('button',{name:'Stop and discard'})).toHaveFocus();
    await user.tab();expect(resume).toHaveFocus();
    expect(screen.getByLabelText('Name for take take-1')).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name for take take-1')).toBeEnabled();
    expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('0');
  });

  it('opens and closes shell Help without disposing a recorder or its unaccepted take',async()=>{
    const user=userEvent.setup();render(<ShellHelpHarness/>);
    await user.click(screen.getByRole('button',{name:'Start recording'}));
    const name=await screen.findByLabelText('Name for take take-1');
    await user.clear(name);await user.type(name,'Unaccepted synth hit');
    await user.click(screen.getByRole('button',{name:'Recording help'}));
    expect(screen.getByRole('dialog',{name:'Help'})).toBeInTheDocument();
    expect(screen.getByLabelText('Name for take take-1')).toHaveValue('Unaccepted synth hit');
    expect(sessions[0].disposed).toBe(false);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog',{name:'Help'})).not.toBeInTheDocument();
    expect(screen.getByRole('dialog',{name:'Record takes'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Recording help'})).toHaveFocus();
    expect(screen.getByLabelText('Name for take take-1')).toHaveValue('Unaccepted synth hit');
    expect(sessions[0].disposed).toBe(false);
  });

  it('invalidates an input setup that resolves after Close',async()=>{
    let release!:()=>void;enableGate=new Promise<void>(resolve=>{release=resolve});const user=userEvent.setup();render(<ClosingHarness/>);
    await user.click(screen.getByRole('button',{name:'Enable input'}));await user.click(screen.getByRole('button',{name:'Close'}));
    expect(screen.queryByRole('dialog',{name:'Record takes'})).not.toBeInTheDocument();release();
    await waitFor(()=>expect(sessions[0].disposed).toBe(true));
  });

  it('closes an audition context whose resume finishes after Close',async()=>{
    const user=userEvent.setup();render(<ClosingHarness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    const resumed:{resolve?:()=>void}={},close=vi.fn().mockResolvedValue(undefined),source={buffer:null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};
    class PreviewContext {destination={};resume=()=>new Promise<void>(resolve=>{resumed.resolve=resolve});close=close;createBufferSource=()=>source}
    Object.defineProperty(globalThis,'AudioContext',{value:PreviewContext,configurable:true});
    await user.click(screen.getByRole('button',{name:'Listen to take take-1'}));await user.click(screen.getByRole('button',{name:'Close'}));expect(screen.getByRole('alertdialog',{name:'Discard recording work'})).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Stop and discard'}));resumed.resolve?.();
    await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(source.start).not.toHaveBeenCalled();
  });

  it('owns pending preview replacements and starts at most the latest audition',async()=>{
    const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    const attempts:Array<{resolve:()=>void;close:ReturnType<typeof vi.fn>;source:{buffer:AudioBuffer|null;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;onended:(()=>void)|null}}>=[];
    class PreviewContext {destination={};close=vi.fn().mockResolvedValue(undefined);source={buffer:null as AudioBuffer|null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null as (()=>void)|null};resolve!:()=>void;resume=()=>new Promise<void>(resolve=>{this.resolve=resolve});createBufferSource=()=>this.source;constructor(){attempts.push(this)}}
    Object.defineProperty(globalThis,'AudioContext',{value:PreviewContext,configurable:true});
    await user.click(screen.getByRole('button',{name:'Listen to take take-1'}));await waitFor(()=>expect(attempts).toHaveLength(1));
    await user.click(screen.getByRole('button',{name:'Listen to take take-1'}));await waitFor(()=>expect(attempts).toHaveLength(2));expect(attempts[0].close).toHaveBeenCalledOnce();
    attempts[0].resolve();await Promise.resolve();expect(attempts[0].source.start).not.toHaveBeenCalled();attempts[1].resolve();await waitFor(()=>expect(attempts[1].source.start).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button',{name:'Stop preview'}));expect(attempts[1].source.stop).toHaveBeenCalledOnce();expect(attempts[1].close).toHaveBeenCalledOnce();
  });

  it.each(['same take','different takes'])('gives only the latest %s audition a ticket while capture Stop is pending',async(kind)=>{
    const user=userEvent.setup();render(<ClosingHarness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Start recording'}));captureOnStart=false;await user.click(screen.getByRole('button',{name:'Start recording'}));
    let releaseStop!:()=>void;stopGate=new Promise<void>(resolve=>{releaseStop=resolve});const attempts:Array<{resolve:()=>void;close:ReturnType<typeof vi.fn>;source:{buffer:AudioBuffer|null;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;onended:(()=>void)|null}}>=[];
    class PreviewContext {destination={};close=vi.fn().mockResolvedValue(undefined);source={buffer:null as AudioBuffer|null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null as (()=>void)|null};resolve!:()=>void;resume=()=>new Promise<void>(resolve=>{this.resolve=resolve});createBufferSource=()=>this.source;constructor(){attempts.push(this)}}
    Object.defineProperty(globalThis,'AudioContext',{value:PreviewContext,configurable:true});const first=screen.getByRole('button',{name:'Listen to take take-1'}),second=kind==='same take'?first:screen.getByRole('button',{name:'Listen to take take-2'});await user.click(first);await user.click(second);expect(attempts).toHaveLength(0);releaseStop();
    await waitFor(()=>expect(attempts.length).toBeGreaterThan(0));for(const attempt of [...attempts].reverse())attempt.resolve();await waitFor(()=>expect(attempts.reduce((count,attempt)=>count+attempt.source.start.mock.calls.length,0)).toBe(1));await user.click(screen.getByRole('button',{name:'Close'}));await user.click(screen.getByRole('button',{name:'Stop and discard'}));expect(attempts.every(attempt=>attempt.close.mock.calls.length>=1)).toBe(true);
  });

  it('cancels an audition waiting before context allocation with Stop preview',async()=>{
    const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));captureOnStart=false;await user.click(screen.getByRole('button',{name:'Start recording'}));let releaseStop!:()=>void;stopGate=new Promise<void>(resolve=>{releaseStop=resolve});
    const contexts=vi.fn(),source={buffer:null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};class PreviewContext {constructor(){contexts()}destination={};resume=vi.fn().mockResolvedValue(undefined);close=vi.fn().mockResolvedValue(undefined);createBufferSource=vi.fn(()=>source)}
    Object.defineProperty(globalThis,'AudioContext',{value:PreviewContext,configurable:true});await user.click(screen.getByRole('button',{name:'Listen to take take-1'}));await user.click(screen.getByRole('button',{name:'Stop preview'}));await act(async()=>{releaseStop();await Promise.resolve();await Promise.resolve();});expect(contexts).not.toHaveBeenCalled();
  });

  it('cancels a pending preview before starting capture',async()=>{
    const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    let resolve!:()=>void;const close=vi.fn().mockResolvedValue(undefined),source={buffer:null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};
    class PreviewContext {destination={};resume=()=>new Promise<void>(done=>{resolve=done});close=close;createBufferSource=()=>source}
    Object.defineProperty(globalThis,'AudioContext',{value:PreviewContext,configurable:true});await user.click(screen.getByRole('button',{name:'Listen to take take-1'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Stop preview'})).toBeEnabled());
    await user.click(screen.getByRole('button',{name:'Start recording'}));expect(close).toHaveBeenCalledOnce();resolve();await Promise.resolve();expect(source.start).not.toHaveBeenCalled();await screen.findByLabelText('Name for take take-2');
  });

  it('does not apply after Close wins a pending capture stop',async()=>{
    let release!:()=>void;const user=userEvent.setup();render(<ClosingHarness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    stopGate=new Promise<void>(resolve=>{release=resolve});await user.click(screen.getByRole('button',{name:'Add selected takes'}));await user.click(screen.getByRole('button',{name:'Close'}));await user.click(screen.getByRole('button',{name:'Stop and discard'}));release();
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Record takes'})).not.toBeInTheDocument());expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('0');
  });

  it('resets a canceled Apply when the persistent recorder reopens',async()=>{
    let release!:()=>void;const user=userEvent.setup();render(<ReopeningHarness/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    stopGate=new Promise<void>(resolve=>{release=resolve});await user.click(screen.getByRole('button',{name:'Add selected takes'}));expect(screen.getByRole('button',{name:'Preparing takes…'})).toBeDisabled();await user.click(screen.getByRole('button',{name:'Close'}));await user.click(screen.getByRole('button',{name:'Stop and discard'}));stopGate=undefined;
    await user.click(screen.getByRole('button',{name:'Open recorder'}));await user.click(screen.getByRole('button',{name:'Start recording'}));const name=await screen.findByLabelText('Name for take take-2');expect(name).toBeEnabled();await user.clear(name);await user.type(name,'Fresh');
    await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('1'));release();await Promise.resolve();expect(screen.getByText('1 take added.')).toBeInTheDocument();expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('1');
  });

  it('shows and edits the explicit multisample target root before one guarded apply',async()=>{
    const user=userEvent.setup();render(<Harness instrument="multisample"/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    const note=await screen.findByLabelText('Root note for take take-1');expect(note).toHaveValue(64);await user.clear(note);await user.type(note,'65');
    await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));
  });

  it('keeps automatic range captures in review with exact MIDI roots until one atomic Apply',async()=>{
    const user=userEvent.setup();render(<Harness instrument="multisample"/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');openDetails('Optional timing details');for(const [label,value] of [['Start note','60'],['End note','66'],['Note step','6'],['Hold duration','0'],['Release tail','0'],['Between-note settling','0']] as const){const input=screen.getByLabelText(label);await user.clear(input);await user.type(input,value);}
    await user.click(screen.getByRole('button',{name:'Start automatic recording'}));await waitFor(()=>expect(screen.getAllByLabelText(/Root note for take/)).toHaveLength(2));expect(screen.getAllByLabelText(/Root note for take/).map(input=>(input as HTMLInputElement).value)).toEqual(['60','66']);expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('0');
    await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('2'));expect(midi.outputs[0].send.mock.calls.map(call=>call[0])).toEqual([[0x90,60,100],[0x80,60,0],[0x90,66,100],[0x80,66,0]]);
  });

  it('finishes guided capture only after a checked take is committed',async()=>{
    const settings={startNote:48,endNote:48,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};localStorage.setItem('op-patchstudio:auto-sampling:v1',JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'virtual',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));
    const disconnect=vi.fn();Object.defineProperty(globalThis,'AudioContext',{value:vi.fn(function(){const context=new OriginalAudioContext(),createBufferSource=context.createBufferSource.bind(context);context.createBufferSource=vi.fn(()=>Object.assign(createBufferSource(),{disconnect}));return context;}),configurable:true});
    const user=userEvent.setup();render(<GuidedHarness/>);const steps=screen.getByRole('navigation',{name:'Automatic multisampling steps'});expect(steps).toHaveTextContent('1. Connect');expect(steps).toHaveTextContent('2. Check');expect(screen.getByRole('heading',{name:'Connect and check'})).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.click(screen.getByRole('button',{name:'Play a test note'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Listen to test recording'})).toBeEnabled());await user.click(screen.getByRole('button',{name:'Listen to test recording'}));await user.click(screen.getByRole('button',{name:'Stop listening'}));expect(disconnect).toHaveBeenCalledOnce();await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));await user.click(screen.getByRole('button',{name:'Continue to record'}));await user.click(screen.getByRole('button',{name:'Start automatic recording'}));expect(await screen.findByLabelText(/Root note for take/)).toHaveValue(48);await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));expect(screen.getByRole('heading',{name:'1 take added to this multisample instrument'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Save to library'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Review OP-XY export'})).toBeInTheDocument();
  });

  it('keeps a guided take audition stoppable from Review',async()=>{
    const settings={startNote:48,endNote:48,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};localStorage.setItem('op-patchstudio:auto-sampling:v1',JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'virtual',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));const disconnect=vi.fn();Object.defineProperty(globalThis,'AudioContext',{value:vi.fn(function(){const context=new OriginalAudioContext(),createBufferSource=context.createBufferSource.bind(context);context.createBufferSource=vi.fn(()=>Object.assign(createBufferSource(),{disconnect}));return context;}),configurable:true});const user=userEvent.setup();render(<GuidedHarness/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.click(screen.getByRole('button',{name:'Play a test note'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Listen to test recording'})).toBeEnabled());await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));await user.click(screen.getByRole('button',{name:'Continue to record'}));await user.click(screen.getByRole('button',{name:'Start automatic recording'}));const take=await screen.findByRole('button',{name:/Listen to take/});await user.click(take);expect(screen.getByRole('button',{name:'Stop preview'})).toBeEnabled();await user.click(screen.getByRole('button',{name:'Stop preview'}));expect(disconnect).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Stop preview'})).toBeDisabled();
  });

  it('keeps guided review and its takes when the commit receipt is rejected',async()=>{
    const settings={startNote:48,endNote:48,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};localStorage.setItem('op-patchstudio:auto-sampling:v1',JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'virtual',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));const realPrepare=recordingApplication.prepareRecordingApplication;let releasePrepared!:()=>void,markPrepared!:()=>void;const prepared=new Promise<void>(resolve=>{markPrepared=resolve}),gate=new Promise<void>(resolve=>{releasePrepared=resolve});const prepareSpy=vi.spyOn(recordingApplication,'prepareRecordingApplication').mockImplementation(async options=>{const result=await realPrepare(options);markPrepared();await gate;return result;});
    try{const user=userEvent.setup();render(<GuidedConflictHarness/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.click(screen.getByRole('button',{name:'Play a test note'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Listen to test recording'})).toBeEnabled());await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));await user.click(screen.getByRole('button',{name:'Continue to record'}));await user.click(screen.getByRole('button',{name:'Start automatic recording'}));expect(await screen.findByLabelText(/Root note for take/)).toHaveValue(48);await user.click(screen.getByRole('button',{name:'Add selected takes'}));await prepared;await user.click(screen.getByRole('button',{name:'Inject root conflict'}));releasePrepared();expect(await screen.findByRole('alert')).toHaveTextContent(/became occupied/i);expect(screen.getByLabelText(/Root note for take/)).toHaveValue(48);expect(screen.queryByText(/Capture committed/)).not.toBeInTheDocument();}finally{prepareSpy.mockRestore();}
  });

  it('keeps a partial guided commit in Review with exact retained count',async()=>{
    const settings={startNote:48,endNote:54,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};localStorage.setItem('op-patchstudio:auto-sampling:v1',JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'virtual',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));const user=userEvent.setup();render(<GuidedCapacityHarness/>);await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('23'));await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.click(screen.getByRole('button',{name:'Play a test note'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Listen to test recording'})).toBeEnabled());await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));await user.click(screen.getByRole('button',{name:'Continue to record'}));await user.click(screen.getByRole('button',{name:'Start automatic recording'}));await waitFor(()=>expect(screen.getAllByLabelText(/Root note for take/)).toHaveLength(2));await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByText(/1 take added; 1 retained in review/)).toBeInTheDocument());expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('24');expect(screen.getAllByLabelText(/Root note for take/)).toHaveLength(1);expect(screen.queryByText(/Capture committed/)).not.toBeInTheDocument();
  });

  it('proposes roots from the explicit anchor using current project and retained tray reservations',async()=>{
    const user=userEvent.setup();render(<Harness instrument="multisample"/>);await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Start recording'}));
    expect(screen.getByLabelText('Root note for take take-1')).toHaveValue(64);const second=screen.getByLabelText('Root note for take take-2');expect(second).toHaveValue(65);await user.clear(second);await user.type(second,'70');await user.click(screen.getByRole('button',{name:'Remove take take-1'}));
    await user.click(screen.getByRole('button',{name:'Start recording'}));expect(await screen.findByLabelText('Root note for take take-3')).toHaveValue(64);
    await user.click(screen.getByLabelText('Select take take-2'));await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));
    await user.click(screen.getByRole('button',{name:'Start recording'}));expect(await screen.findByLabelText('Root note for take take-4')).toHaveValue(65);
  });

  it('binds occupied-note resolution to the first selected take and reserves other tray roots',async()=>{
    const user=userEvent.setup();render(<OccupiedMultisampleHarness/>);await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Start recording'}));
    await user.click(screen.getByLabelText('Select take take-1'));await user.click(screen.getByRole('radio',{name:/Choose free note/}));expect(screen.getByLabelText('Root note for take take-2')).toHaveValue(65);
    await user.click(screen.getByRole('radio',{name:'Replace'}));expect(screen.getByLabelText('Root note for take take-2')).toHaveValue(64);
    await user.click(screen.getByRole('radio',{name:'Cancel'}));expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1');
  });

  it('reports full-kit recorded takes as added and kept unassigned',async()=>{
    const user=userEvent.setup();render(<FullDrumHarness/>);await waitFor(()=>expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('24'));await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Add selected takes'}));
    await waitFor(()=>expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('26'));expect(screen.getByText('2 takes added; 2 kept unassigned.')).toBeInTheDocument();
  });

  it('accepts a drum take when every MIDI root is occupied and preserves all legacy multisamples',async()=>{
    const user=userEvent.setup();render(<LegacyRootsHarness instrument="drum"/>);await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('128'));await user.click(screen.getByRole('button',{name:'Start recording'}));expect(await screen.findAllByLabelText(/Name for take/)).toHaveLength(1);await user.click(screen.getByRole('button',{name:'Add selected takes'}));await waitFor(()=>expect(screen.getByLabelText('Loaded drum count')).toHaveTextContent('1'));expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('128');
  });

  it('keeps MIDI-root exhaustion visible for multisample capture',async()=>{
    const user=userEvent.setup();render(<LegacyRootsHarness instrument="multisample"/>);await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('128'));await user.click(screen.getByRole('button',{name:'Start recording'}));expect(await screen.findByRole('alert')).toHaveTextContent(/All MIDI root notes are already reserved/);expect(screen.queryAllByLabelText(/Name for take/)).toHaveLength(0);
  });

  it('explains the disabled Add only while Cancel is the chosen occupied-target resolution',async()=>{
    const user=userEvent.setup();render(<OccupiedMultisampleHarness/>);await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));await user.click(screen.getByRole('button',{name:'Start recording'}));expect(await screen.findByLabelText('Name for take take-1')).toBeInTheDocument();
    expect(screen.queryByText(/Cancel is chosen/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio',{name:'Replace'}));expect(screen.queryByText(/Cancel is chosen/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio',{name:'Cancel'}));
    const explanation=screen.getByText(/Cancel is chosen/);expect(explanation).toHaveAttribute('role','status');expect(explanation).toHaveTextContent(/Your takes stay in review\. To add them, choose Replace or Choose free note\./);
    expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();expect(screen.getByLabelText('Name for take take-1')).toBeInTheDocument();expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1');
    await user.click(screen.getByRole('radio',{name:/Choose free note/}));expect(screen.queryByText(/Cancel is chosen/)).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();await user.selectOptions(await screen.findByRole('combobox',{name:'Assign key for take take-1'}),'65');expect(screen.getByRole('button',{name:'Add selected takes'})).toBeEnabled();
  });

  it('explains that Stop recording unlocks the input settings without renaming the button',async()=>{
    const user=userEvent.setup();render(<Harness/>);expect(screen.queryByText(/locked while the input is on/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Enable input'}));
    expect(await screen.findByText(/locked while the input is on\. Stop recording also turns the input off/)).toBeInTheDocument();expect(screen.getByLabelText('Input device')).toBeDisabled();expect(screen.getByLabelText('Recording starts')).toBeDisabled();
    await user.click(screen.getByRole('button',{name:'Stop recording'}));
    await waitFor(()=>expect(screen.queryByText(/locked while the input is on/)).not.toBeInTheDocument());expect(screen.getByLabelText('Input device')).toBeEnabled();expect(screen.getByLabelText('Recording starts')).toBeEnabled();expect(screen.getByRole('button',{name:'Stop recording'})).toBeInTheDocument();
  });

  it('shows guided MIDI-unsupported alternatives on open without requesting any device permission',async()=>{
    const originalMidiApi=Object.getOwnPropertyDescriptor(navigator,'requestMIDIAccess');Object.defineProperty(navigator,'requestMIDIAccess',{value:undefined});midi.enable.mockClear();
    try{
      render(<GuidedHarness/>);await waitFor(()=>expect(document.querySelector('[data-studio-automatic-panel]')).toHaveFocus());
      const note=screen.getByRole('note');expect(note).toHaveTextContent(/This browser cannot send MIDI/);expect(note).toHaveTextContent(/Close this guided window, then in the editor use Record takes .* or Add sounds/);expect(note).not.toHaveTextContent(/allow MIDI/i);
      expect(midi.enable).not.toHaveBeenCalled();expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();expect(sessions).toHaveLength(0);
    }finally{if(originalMidiApi)Object.defineProperty(navigator,'requestMIDIAccess',originalMidiApi);else Reflect.deleteProperty(navigator,'requestMIDIAccess');}
  });

  it('shows the bounded file-import fallback when worklet capture is unavailable',async()=>{
    Object.defineProperty(globalThis,'AudioWorkletNode',{value:undefined,configurable:true});const rendered=render(<Harness/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Recording requires a supported browser on HTTPS; import an audio file instead.');
    await waitFor(()=>expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled());
    expect(screen.getByRole('button',{name:'Stop recording'})).toBeInTheDocument();
    expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith('devicechange',expect.any(Function));rendered.unmount();expect(navigator.mediaDevices.removeEventListener).toHaveBeenCalledWith('devicechange',expect.any(Function));
  });


it('requires a chosen original note for an unlabelled manual take',async()=>{
 const user=userEvent.setup();render(<Harness instrument="multisample" target={{kind:'multisample'}}/>);
 await user.click(screen.getByRole('button',{name:'Start recording'}));
 expect(await screen.findByText(/couldn’t identify a clear note/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();
 const chooser=screen.getByRole('combobox',{name:'Assign key for take take-1'});
 await user.selectOptions(chooser,'69');
 expect(screen.getByRole('button',{name:'Add selected takes'})).toBeEnabled();
 await user.click(screen.getByRole('button',{name:'Add selected takes'}));
 await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));
});


it('suggests a recorded tone, preserves manual changes, and adds only after confirmation',async()=>{
 capturedTone=true;const user=userEvent.setup();render(<Harness instrument="multisample" target={{kind:'multisample'}}/>);
 await user.click(screen.getByRole('button',{name:'Start recording'}));
 const confirm=await screen.findByRole('button',{name:/Yes, assign to A/});
 expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();
 await user.click(confirm);
 expect(screen.getByText(/Assigned to A/)).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Change'}));
 const chooser=screen.getByRole('combobox',{name:'Assign key for take take-1'});expect(chooser).toHaveFocus();await user.selectOptions(chooser,'72');expect(screen.queryByRole('combobox',{name:'Assign key for take take-1'})).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Add selected takes'}));
 await waitFor(()=>expect(screen.getByLabelText('Loaded multisample count')).toHaveTextContent('1'));
});

it('does not treat the next free slot as a confirmed recorded note',async()=>{
 const user=userEvent.setup();render(<Harness instrument="multisample"/>);
 await user.click(screen.getByRole('button',{name:'Start recording'}));
 await user.click(screen.getByRole('button',{name:'Start recording'}));
 const second=await screen.findByRole('combobox',{name:'Assign key for take take-2'});
 expect(second).toHaveValue('');expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();
 await user.selectOptions(second,'65');expect(screen.getByRole('button',{name:'Add selected takes'})).toBeEnabled();
});
it('keeps a confirmed free note when resolving an occupied recording target',async()=>{
 const user=userEvent.setup();render(<OccupiedMultisampleHarness/>);
 await user.click(screen.getByRole('button',{name:'Start recording'}));
 await user.click(await screen.findByRole('button',{name:'Change'}));const chooser=await screen.findByRole('combobox',{name:'Assign key for take take-1'});
 await user.selectOptions(chooser,'69');await user.click(screen.getByRole('radio',{name:/Choose free note/}));
 expect(screen.getByText(/Assigned to A/)).toBeInTheDocument();
});

it('lets a take be shortened before note confirmation and carries the section into apply',async()=>{
 capturedTone=true;const user=userEvent.setup();const spy=vi.spyOn(recordingApplication,'prepareRecordingApplication');
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({beginPath:vi.fn(),clearRect:vi.fn(),closePath:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),lineTo:vi.fn(),moveTo:vi.fn(),setLineDash:vi.fn(),stroke:vi.fn()} as unknown as CanvasRenderingContext2D);
 render(<Harness instrument="multisample"/>);await user.click(screen.getByRole('button',{name:'Start recording'}));await user.click(screen.getByRole('button',{name:'Stop recording'}));
 await user.click(screen.getByRole('button',{name:'Choose a section of take take-1'}));
 fireEvent.change(screen.getByLabelText('Playback start seconds'),{target:{value:'.2'}});fireEvent.change(screen.getByLabelText('Playback end seconds'),{target:{value:'.8'}});
 await user.click(screen.getByRole('button',{name:'Use this section'}));expect(screen.getByRole('button',{name:'Add selected takes'})).toBeDisabled();
 await user.click(await screen.findByRole('button',{name:/Yes, assign to A/}));await user.click(screen.getByRole('button',{name:'Add selected takes'}));
 await waitFor(()=>expect(spy).toHaveBeenCalled());expect(spy.mock.calls[0][0].takes[0].section).toEqual({inPoint:.2,outPoint:.8});
 expect(spy.mock.calls[0][0].takes[0].audioBuffer.length).toBe(44100);
});

});
