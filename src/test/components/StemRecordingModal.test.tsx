import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {StemRecordingModal} from '../../components/common/StemRecordingModal';
import {StemCaptureEngine} from '../../audio/recording/stemCapture';
import {CaptureSession} from '../../audio/recording/captureSession';
import type {StemMidiAccess} from '../../audio/recording/stemBrowser';
import {midiRoutes} from '../../midi/routeLease';

vi.mock('../../audio/recording/captureProcessor.ts?worker&url',()=>({default:'/capture.js'}));
type MidiNavigator={requestMIDIAccess:(options:{sysex:boolean})=>Promise<StemMidiAccess>};
const midiNavigator=navigator as unknown as MidiNavigator;
const originalRequestMidi=midiNavigator.requestMIDIAccess;
const originalEnumerate=navigator.mediaDevices.enumerateDevices;

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}

function pendingCaptureCleanup(close:ReturnType<typeof deferred>){
  const disposed=new WeakSet<CaptureSession>();
  vi.spyOn(CaptureSession.prototype,'enableInput').mockResolvedValue(true);
  const start=vi.spyOn(CaptureSession.prototype,'start').mockImplementation(()=>undefined);
  vi.spyOn(CaptureSession.prototype,'stop').mockResolvedValue(undefined);
  const dispose=vi.spyOn(CaptureSession.prototype,'dispose').mockImplementation(function(this:CaptureSession){if(disposed.has(this))return Promise.resolve();disposed.add(this);return close.promise;});
  return{start,dispose};
}

describe('StemRecordingModal',()=>{
  afterEach(async()=>{cleanup();await waitFor(()=>expect(midiRoutes.current('xy')).toBeUndefined());vi.restoreAllMocks();vi.unstubAllGlobals();midiNavigator.requestMIDIAccess=originalRequestMidi;navigator.mediaDevices.enumerateDevices=originalEnumerate;});
  it('does not request audio or MIDI merely by opening or selecting tracks',async()=>{const media=vi.spyOn(navigator.mediaDevices,'getUserMedia'),midi=vi.fn(async()=>({outputs:new Map(),addEventListener:vi.fn(),removeEventListener:vi.fn()}));midiNavigator.requestMIDIAccess=midi;render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);expect(screen.getByRole('dialog',{name:'Record OP-XY tracks'})).toBeInTheDocument();await userEvent.click(screen.getByRole('checkbox',{name:'Track 2'}));expect(media).not.toHaveBeenCalled();expect(midi).not.toHaveBeenCalled();expect(screen.getByText(/untouched modal send nothing/)).toBeInTheDocument();});
  it('shows beginner warnings, bounded defaults, Stop, and discard confirmation',async()=>{const close=vi.fn();render(<StemRecordingModal isOpen onClose={close} onSlice={vi.fn()}/>);expect(screen.getByLabelText('BPM')).toHaveValue(120);expect(screen.getByLabelText('Bars (4/4)')).toHaveValue(4);expect(screen.getByLabelText('Tail seconds')).toHaveValue(1);expect(screen.getByText(/does not separate sources/i)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Stop recording'})).toBeDisabled();expect(screen.getByText(/cannot read or restore the original hardware mute state/i)).toBeInTheDocument();});
  it('renders readable unsupported guidance while retaining explicit controls',()=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'AudioWorkletNode');Object.defineProperty(globalThis,'AudioWorkletNode',{value:undefined,configurable:true});try{render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);expect(screen.getByRole('alert')).toHaveTextContent(/Chrome or Edge on HTTPS/i);expect(screen.getByRole('button',{name:'Enable audio'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Enable MIDI'})).toBeInTheDocument();}finally{if(descriptor)Object.defineProperty(globalThis,'AudioWorkletNode',descriptor);}});
  it('discards a pending MIDI permission result after close without attaching a listener',async()=>{
    let resolveAccess!:(value:StemMidiAccess)=>void;
    const request=new Promise<StemMidiAccess>(resolve=>{resolveAccess=resolve;});
    const requestMidi=vi.fn(()=>request);
    midiNavigator.requestMIDIAccess=requestMidi;
    const close=vi.fn();
    render(<StemRecordingModal isOpen onClose={close} onSlice={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));
    expect(screen.getByRole('button',{name:'Enabling MIDI...'})).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button',{name:'Close'})[0]);
    const access={outputs:new Map<string,never>(),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    resolveAccess(access);
    await waitFor(()=>expect(close).toHaveBeenCalled());
    expect(access.addEventListener).not.toHaveBeenCalled();
  });
  it('keeps one stem Stop and the route lock until real idempotent disposal finishes',async()=>{
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    const close=deferred();
    const capture=pendingCaptureCleanup(close);
    const cancel=vi.spyOn(StemCaptureEngine.prototype,'cancel');
    render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));
    await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');
    await screen.findByRole('option',{name:'OP-XY input'});
    await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');
    await userEvent.click(screen.getByText(/I understand recording will stop transport/i));
    const record=screen.getByRole('button',{name:'Record test'});
    fireEvent.click(record);fireEvent.click(record);
    await waitFor(()=>expect(capture.start).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button',{name:'Stop recording'}));
    fireEvent.click(screen.getByRole('button',{name:'Stop recording'}));
    await waitFor(()=>expect(capture.dispose).toHaveBeenCalled());
    await Promise.resolve();await Promise.resolve();
    const ownerWhileClosePending=midiRoutes.current('xy');
    const competing=midiRoutes.acquire('xy','devices');
    const devicesSend=vi.fn();if(competing)devicesSend();competing?.release();
    const recordDisabledWhileClosePending=screen.getByRole('button',{name:'Record test'}).hasAttribute('disabled');
    const cancelCalls=cancel.mock.calls.length;
    close.resolve();
    await waitFor(()=>expect(midiRoutes.current('xy')).toBeUndefined());
    expect(ownerWhileClosePending).toBe('stem-capture');
    expect(devicesSend).not.toHaveBeenCalled();
    expect(recordDisabledWhileClosePending).toBe(true);
    expect(cancelCalls).toBe(1);
  });

  it('denies a busy stem output without starting the engine or sending MIDI',async()=>{
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    const run=vi.spyOn(StemCaptureEngine.prototype,'run');
    const devicesLease=midiRoutes.acquire('xy','devices')!;
    try {
      render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
      await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));
      await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');
      await screen.findByRole('option',{name:'OP-XY input'});
      await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');
      await userEvent.click(screen.getByText(/I understand recording will stop transport/i));
      await userEvent.click(screen.getByRole('button',{name:'Record test'}));

      expect(await screen.findByText(/MIDI output is busy with Devices or automatic sampling/i)).toBeInTheDocument();
      expect(run).not.toHaveBeenCalled();
      expect(output.send).not.toHaveBeenCalled();
      expect(midiRoutes.current('xy')).toBe('devices');
    } finally {
      devicesLease.release();
    }
  });

  it('releases the stem route after run rejection',async()=>{
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    let rejectRun!:(reason:Error)=>void;
    vi.spyOn(StemCaptureEngine.prototype,'run').mockReturnValue(new Promise<void>((_resolve,reject)=>{rejectRun=reject;}));
    render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));
    await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');
    await screen.findByRole('option',{name:'OP-XY input'});
    await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');
    await userEvent.click(screen.getByText(/I understand recording will stop transport/i));
    await userEvent.click(screen.getByRole('button',{name:'Record test'}));

    await waitFor(()=>expect(midiRoutes.current('xy')).toBe('stem-capture'));
    expect(midiRoutes.acquire('xy','devices')).toBeUndefined();
    rejectRun(new Error('Synthetic stem failure.'));
    expect(await screen.findByText(/Synthetic stem failure/i)).toBeInTheDocument();
    await waitFor(()=>expect(midiRoutes.current('xy')).toBeUndefined());
  });

  it('holds the stem route through real MIDI-disconnect disposal',async()=>{
    let stateChange!:(event:Event)=>void;
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn((_name:string,listener:(event:Event)=>void)=>{stateChange=listener;}),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    const close=deferred();
    const capture=pendingCaptureCleanup(close);
    const disconnected=vi.spyOn(StemCaptureEngine.prototype,'outputDisconnected');
    render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));
    await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');
    await screen.findByRole('option',{name:'OP-XY input'});
    await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');
    await userEvent.click(screen.getByText(/I understand recording will stop transport/i));
    await userEvent.click(screen.getByRole('button',{name:'Record test'}));
    await waitFor(()=>expect(capture.start).toHaveBeenCalledOnce());

    output.state='disconnected';
    act(()=>stateChange(new Event('statechange')));
    await waitFor(()=>expect(capture.dispose).toHaveBeenCalled());
    await Promise.resolve();await Promise.resolve();
    const ownerWhileClosePending=midiRoutes.current('xy');
    const competing=midiRoutes.acquire('xy','devices');competing?.release();
    close.resolve();
    await waitFor(()=>expect(midiRoutes.current('xy')).toBeUndefined());
    expect(disconnected).toHaveBeenCalledOnce();
    expect(ownerWhileClosePending).toBe('stem-capture');
    expect(competing).toBeUndefined();
  });

  it('revalidates the stem output after asynchronous preview cleanup',async()=>{
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    const audioBuffer=new AudioContext().createBuffer(1,8,8_000);
    const run=vi.spyOn(StemCaptureEngine.prototype,'run').mockImplementation(async function(this:StemCaptureEngine,settings){if(run.mock.calls.length===1)(this as unknown as {deps:{onResult:(result:unknown)=>void}}).deps.onResult({track:1,take:{id:'preview',audioBuffer,frames:8,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'},settings,warnings:[],timingVerified:false});});
    const previewClose=deferred();
    const previewContext=new AudioContext();
    vi.mocked(previewContext.createBufferSource).mockReturnValue({buffer:null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null,playbackRate:{value:1}} as unknown as AudioBufferSourceNode);
    vi.spyOn(previewContext,'close').mockReturnValue(previewClose.promise);
    vi.stubGlobal('AudioContext',vi.fn(function MockPreviewAudioContext(){return previewContext;}) as unknown as typeof AudioContext);
    render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');await screen.findByRole('option',{name:'OP-XY input'});await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');await userEvent.click(screen.getByText(/I understand recording will stop transport/i));await userEvent.click(screen.getByRole('button',{name:'Record test'}));
    await screen.findByRole('button',{name:'Play Track 1'});await userEvent.click(screen.getByRole('button',{name:'Play Track 1'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Stop playback'})).toBeEnabled());
    const recordAgain=screen.getByRole('button',{name:'Record test'});
    expect(recordAgain).toBeEnabled();
    await userEvent.click(recordAgain);
    await waitFor(()=>expect(previewContext.close).toHaveBeenCalledOnce());
    output.state='disconnected';
    previewClose.resolve();
    expect(await screen.findByText(/Choose a connected MIDI output/i)).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(1);
    expect(midiRoutes.current('xy')).toBeUndefined();
  });

  it('stops a hidden stem recording and retains ownership through disposal',async()=>{
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    const close=deferred();const capture=pendingCaptureCleanup(close);const cancel=vi.spyOn(StemCaptureEngine.prototype,'cancel');
    render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');await screen.findByRole('option',{name:'OP-XY input'});await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');await userEvent.click(screen.getByText(/I understand recording will stop transport/i));await userEvent.click(screen.getByRole('button',{name:'Record test'}));await waitFor(()=>expect(capture.start).toHaveBeenCalledOnce());
    act(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await waitFor(()=>expect(capture.dispose).toHaveBeenCalled());await Promise.resolve();await Promise.resolve();
    const ownerWhileClosePending=midiRoutes.current('xy'),competing=midiRoutes.acquire('xy','devices');competing?.release();
    close.resolve();await waitFor(()=>expect(midiRoutes.current('xy')).toBeUndefined());
    expect(cancel).toHaveBeenCalledOnce();expect(ownerWhileClosePending).toBe('stem-capture');expect(competing).toBeUndefined();expect(screen.getByText(/page was hidden/i)).toBeInTheDocument();
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
  });
});
