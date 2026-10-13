import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {AppContextProvider} from '../../context/AppContext';
import {AutoSamplingPanel,type GuidedSamplingStep} from '../../components/common/AutoSamplingPanel';
import {RecordingModal,type GuidedRecordingIntent} from '../../components/common/RecordingModal';
import {StemRecordingModal} from '../../components/common/StemRecordingModal';
import {StemCaptureEngine} from '../../audio/recording/stemCapture';
import type {AutoCapture,AutoCaptureCallbacks} from '../../audio/recording/autoSampler';
import type {SessionTake} from '../../audio/recording/captureSession';
import type {StemMidiAccess} from '../../audio/recording/stemBrowser';
import {midiRoutes} from '../../midi/routeLease';

const midi=vi.hoisted(()=>({supported:true,enabled:false,outputs:[{id:'virtual',name:'Synthetic MIDI output',state:'connected',connection:'open',send:vi.fn()}],enable:vi.fn(async()=>{midi.enabled=true}),addListener:vi.fn(),removeListener:vi.fn(),getOutputById:vi.fn((id:string,options?:{disconnected?:boolean})=>options?.disconnected?undefined:midi.outputs.find(output=>output.id===id))}));
vi.mock('webmidi',()=>({WebMidi:midi}));
vi.mock('../../audio/recording/captureProcessor.ts?worker&url',()=>({default:'/assets/capture-test.js'}));
let sequence=0;
interface FakeDeps {onStatus:(status:{state:string;elapsedFrames?:number})=>void;onTake:(take:SessionTake)=>void|Promise<void>;onError?:(message:string)=>void}
vi.mock('../../audio/recording/captureSession',()=>({
  RECORDING_LIMITS:{takes:32,ownedBytes:256*1024*1024,flushMs:500},
  CaptureSession:class {
    status={state:'idle'};deps:FakeDeps;
    constructor(deps:FakeDeps){this.deps=deps}
    async enableInput(){this.status={state:'monitoring'};this.deps.onStatus(this.status);return true}
    async enumerateInputs(){return [{deviceId:'synthetic',label:'Synthetic input'}]}
    start(){this.status={state:'recording'};this.deps.onStatus({...this.status,elapsedFrames:128});const buffer=new AudioContext().createBuffer(1,2,8_000);buffer.copyToChannel(Float32Array.from([.125,-.25]),0);
      void Promise.resolve(this.deps.onTake({id:'take-'+(++sequence),audioBuffer:buffer,frames:2,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'})).catch(reason=>this.deps.onError?.(reason instanceof Error?reason.message:String(reason)));this.status={state:'monitoring'};this.deps.onStatus(this.status);}
    arm(){this.start()} async stop(){this.status={state:'stopped'};this.deps.onStatus(this.status)} async dispose(){this.status={state:'closed'}}
  }
}));

const autoSamplingKey='op-patchstudio:auto-sampling:v1';
const quickSettings={startNote:48,endNote:72,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};
const storedRoutes=(outputId:string)=>JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId,settings:quickSettings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings:quickSettings},ableton:{audioDeviceId:'',outputId:'',settings:quickSettings}}});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
function audibleCapture(cb:AutoCaptureCallbacks):AutoCapture{return{enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from([.2,-.2,.2,-.2]),0);cb.onTake({id:'ux-check',audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:vi.fn(async()=>{})};}
function openDetails(summaryText:string){const details=screen.getByText(summaryText).closest('details') as HTMLDetailsElement;act(()=>{details.open=true;});return details;}

describe('automatic recording check and plan',()=>{
  beforeEach(()=>{midi.enabled=false;midi.enable.mockClear();midi.outputs[0].send.mockClear();vi.mocked(localStorage.getItem).mockReset();vi.mocked(localStorage.setItem).mockClear();localStorage.clear();});
  afterEach(async()=>{cleanup();await waitFor(()=>expect(midiRoutes.current('virtual')).toBeUndefined());});

  function Guided({audition}:{audition:(buffer:AudioBuffer)=>void}){const [step,setStep]=useState<GuidedSamplingStep>('connect');return <AutoSamplingPanel guidedStep={step} onGuidedStepChange={setStep} audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={audibleCapture} onTake={vi.fn()} onRunningChange={vi.fn()} onAuditionCheck={audition}/>;}

  it('sends MIDI for Play a test note and only plays back the recording for Listen to test recording',async()=>{
    vi.mocked(localStorage.getItem).mockReturnValue(storedRoutes(''));const audition=vi.fn(),user=userEvent.setup();render(<Guided audition={audition}/>);
    await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');
    expect(screen.queryByRole('button',{name:'Listen to test recording'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Play a test note'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Listen to test recording'})).toBeEnabled());
    expect(midi.outputs[0].send.mock.calls.map(call=>call[0])).toEqual([[0x90,48,100],[0x80,48,0]]);expect(audition).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:'Listen to test recording'}));
    expect(audition).toHaveBeenCalledOnce();expect(midi.outputs[0].send).toHaveBeenCalledTimes(2);
  });

  it('keeps the plan and the confirmed check when optional details are opened, and still invalidates on a timing change',async()=>{
    vi.mocked(localStorage.getItem).mockReturnValue(storedRoutes(''));const user=userEvent.setup();render(<Guided audition={vi.fn()}/>);
    await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Play a test note'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Listen to test recording'})).toBeEnabled());await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));
    expect(openDetails('Optional MIDI details').open).toBe(true);
    expect(screen.getByRole('button',{name:'Continue to record'})).toBeEnabled();expect(screen.getByRole('checkbox',{name:/intended instrument/i})).toBeChecked();
    await user.click(screen.getByRole('button',{name:'Continue to record'}));openDetails('Optional timing details');
    expect(screen.getByLabelText('Start note')).toHaveValue(48);expect(screen.getByLabelText('End note')).toHaveValue(72);expect(screen.getByLabelText('Note step')).toHaveValue(6);
    expect(screen.getByRole('button',{name:'Start automatic recording'})).toBeEnabled();
    await user.clear(screen.getByLabelText('Release tail'));await user.type(screen.getByLabelText('Release tail'),'1');
    expect(screen.getByRole('button',{name:'Start automatic recording'})).toBeDisabled();expect(screen.getByRole('alert')).toHaveTextContent(/no longer valid/i);
  });

  it('retains finished notes after a hard failure and records only a requested missing note',async()=>{
    vi.mocked(localStorage.getItem).mockReturnValue(storedRoutes(''));const user=userEvent.setup(),onTake=vi.fn();let attempt=0;
    const createCapture=(cb:AutoCaptureCallbacks)=>{attempt+=1;const capture=audibleCapture(cb);return attempt===2?{...capture,enableInput:async()=>false}:capture;};
    render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={onTake} onRunningChange={vi.fn()}/>);
    await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');
    await user.click(screen.getByRole('button',{name:'Start automatic recording'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Record missing MIDI note 54'})).toBeEnabled());
    expect(onTake).toHaveBeenCalledTimes(1);expect(onTake.mock.calls[0][0].rootNote).toBe(48);
    expect(screen.queryByRole('button',{name:'Record missing MIDI note 48'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Record missing MIDI note 54'}));
    await waitFor(()=>expect(onTake).toHaveBeenCalledTimes(2));
    expect(onTake.mock.calls[1][0].rootNote).toBe(54);expect(onTake.mock.calls[1][1]).toBe(false);
    expect(screen.getByRole('button',{name:'Record missing MIDI note 60'})).toBeEnabled();
    expect(screen.queryByRole('button',{name:'Record missing MIDI note 54'})).not.toBeInTheDocument();
    expect(midi.outputs[0].send.mock.calls.map(call=>call[0])).toEqual([[0x90,48,100],[0x80,48,0],[0x90,54,100],[0x80,54,0]]);
  });

  it('describes the range with note names and reports the note limit before recording',async()=>{
    const user=userEvent.setup(),{container}=render(<AutoSamplingPanel noteLabel={note=>`N${note}`} audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={vi.fn()} onTake={vi.fn()} onRunningChange={vi.fn()}/>);
    const range=container.querySelector('[data-studio-range-summary]');
    expect(range).toHaveTextContent('Records 5 notes from N48 (MIDI 48) to N72 (MIDI 72), every 6 semitones');expect(range).not.toHaveTextContent(/limited to/);
    await user.clear(screen.getByLabelText('Note step'));await user.type(screen.getByLabelText('Note step'),'1');
    expect(range).toHaveTextContent(/limited to 24 notes/);expect(midi.outputs[0].send).not.toHaveBeenCalled();
  });
});

describe('recording dialog presentation',()=>{
  beforeEach(()=>{sequence=0;midi.enabled=false;midi.enable.mockClear();midi.outputs[0].send.mockClear();vi.mocked(localStorage.getItem).mockReset().mockImplementation(()=>null);vi.mocked(localStorage.setItem).mockClear();
    Object.defineProperty(globalThis,'AudioWorkletNode',{value:class{},configurable:true});Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
    Object.assign(navigator.mediaDevices,{getUserMedia:vi.fn(),enumerateDevices:vi.fn().mockResolvedValue([]),addEventListener:vi.fn(),removeEventListener:vi.fn()});});
  afterEach(()=>cleanup());

  function Manual({instrument='drum'}:{instrument?:'drum'|'multisample'}){return <AppContextProvider><RecordingModal isOpen onClose={vi.fn()} instrument={instrument} target={instrument==='drum'?{kind:'drum'}:{kind:'multisample',rootNote:64}}/></AppContextProvider>;}
  function GuidedModal({source}:{source:GuidedRecordingIntent['source']}){return <AppContextProvider><RecordingModal isOpen onClose={vi.fn()} instrument="multisample" target={{kind:'multisample'}} guidedIntent={{source,requestId:1}}/></AppContextProvider>;}

  it('offers one start action that follows how recording starts',async()=>{
    const user=userEvent.setup();render(<Manual/>);
    expect(screen.getByRole('button',{name:'Start recording'})).toBeEnabled();expect(screen.queryByRole('button',{name:'Wait for sound'})).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Recording starts'),'sound');
    expect(screen.queryByRole('button',{name:'Start recording'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Wait for sound'}));
    expect(await screen.findByLabelText('Name for take take-1')).toHaveValue('Take 1');
  });

  it('reports the input state in the status row and keeps technical settings in a closed disclosure',async()=>{
    const user=userEvent.setup(),{container}=render(<Manual/>);const status=container.ownerDocument.querySelector('[data-studio-recording-status]') as HTMLElement;
    expect(status).toHaveAttribute('data-capture-state','idle');expect((screen.getByLabelText('Maximum take length').closest('details') as HTMLDetailsElement).open).toBe(false);
    await user.click(screen.getByRole('button',{name:'Enable input'}));
    await waitFor(()=>expect(status).toHaveAttribute('data-capture-state','monitoring'));expect(status).toHaveTextContent(/on and ready/);
    await user.click(screen.getByRole('button',{name:'Stop recording'}));
    await waitFor(()=>expect(status).toHaveAttribute('data-capture-state','stopped'));
  });

  it('shows the note name beside a reviewed take and follows root-note edits',async()=>{
    const user=userEvent.setup();render(<Manual instrument="multisample"/>);await user.click(screen.getByRole('button',{name:'Start recording'}));
    const root=await screen.findByLabelText('Root note for take take-1');
    expect(root).toHaveValue(64);expect(screen.getByText(/^Assigned to E-?\d$/)).toBeInTheDocument();
    await user.clear(root);await user.type(root,'65');expect(screen.getByText(/^Assigned to F-?\d$/)).toBeInTheDocument();
  });

  it('moves the guided steps from Connect to Check once a MIDI route is chosen and names where the sound is picked',async()=>{
    vi.mocked(localStorage.getItem).mockImplementation(key=>key===autoSamplingKey?storedRoutes('virtual'):null);const user=userEvent.setup(),hardware=render(<GuidedModal source="hardware"/>);
    const steps=screen.getByRole('navigation',{name:'Automatic multisampling steps'});
    expect(within(steps).getByText('1. Connect')).toHaveAttribute('aria-current','step');expect(within(steps).getByText('2. Check')).not.toHaveAttribute('aria-current');
    expect(document.querySelector('[data-studio-pick-sound]')).toHaveTextContent(/on your synth/i);
    await user.click(screen.getByRole('button',{name:'Enable MIDI'}));
    await waitFor(()=>expect(within(steps).getByText('2. Check')).toHaveAttribute('aria-current','step'));expect(within(steps).getByText('1. Connect')).toHaveAttribute('data-complete','true');
    hardware.unmount();render(<GuidedModal source="software"/>);
    const dialog=screen.getByRole('dialog',{name:'Record takes'});
    expect(document.querySelector('[data-studio-pick-sound]')).toHaveTextContent(/in your music software/i);expect(dialog).not.toHaveTextContent(/\bDAW\b|\bhost\b/i);
  });
});

describe('track recorder Stop and Close',()=>{
  type MidiNavigator={requestMIDIAccess:(options:{sysex:boolean})=>Promise<StemMidiAccess>};
  const midiNavigator=navigator as unknown as MidiNavigator,originalRequestMidi=midiNavigator.requestMIDIAccess,originalEnumerate=navigator.mediaDevices.enumerateDevices;
  afterEach(async()=>{cleanup();await waitFor(()=>expect(midiRoutes.current('xy')).toBeUndefined());midiNavigator.requestMIDIAccess=originalRequestMidi;navigator.mediaDevices.enumerateDevices=originalEnumerate;});

  it('keeps Close unavailable while recording and leaves the dialog open after Stop',async()=>{
    const output={id:'xy',name:'OP-XY',state:'connected',send:vi.fn(),clear:vi.fn()};
    const access={outputs:new Map([['xy',output]]),addEventListener:vi.fn(),removeEventListener:vi.fn()};
    midiNavigator.requestMIDIAccess=vi.fn(async()=>access);
    navigator.mediaDevices.enumerateDevices=vi.fn().mockResolvedValue([{deviceId:'input',kind:'audioinput',label:'OP-XY input',groupId:'',toJSON:()=>({})}]);
    const finished=deferred();
    const run=vi.spyOn(StemCaptureEngine.prototype,'run').mockReturnValue(finished.promise);
    const cancel=vi.spyOn(StemCaptureEngine.prototype,'cancel').mockImplementation(async()=>{finished.resolve();});
    const onClose=vi.fn();
    try {
      render(<StemRecordingModal isOpen onClose={onClose} onSlice={vi.fn()}/>);
      const closeButtons=()=>screen.getAllByRole('button',{name:'Close'});
      expect(screen.getByRole('button',{name:'Stop recording'})).toBeDisabled();
      for(const close of closeButtons())expect(close).toBeEnabled();
      await userEvent.click(screen.getByRole('button',{name:'Enable MIDI'}));
      await userEvent.selectOptions(screen.getByLabelText('MIDI output'),'xy');
      await screen.findByRole('option',{name:'OP-XY input'});
      await userEvent.selectOptions(screen.getByLabelText('Audio input'),'input');
      await userEvent.click(screen.getByText(/I understand recording will stop transport/i));
      await userEvent.click(screen.getByRole('button',{name:'Record test'}));

      await waitFor(()=>expect(screen.getByRole('button',{name:'Stop recording'})).toBeEnabled());
      for(const close of closeButtons())expect(close).toBeDisabled();
      expect(screen.queryByRole('button',{name:'Stop'})).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button',{name:'Stop recording'}));
      await waitFor(()=>{for(const close of closeButtons())expect(close).toBeEnabled();});
      expect(cancel).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog',{name:'Record OP-XY tracks'})).toBeInTheDocument();
      await userEvent.click(closeButtons()[0]);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      run.mockRestore();cancel.mockRestore();
    }
  });

  it('asks for the mute and transport acknowledgement beside Record and sends nothing without it',async()=>{
    const requestMidi=vi.fn();midiNavigator.requestMIDIAccess=requestMidi;
    const run=vi.spyOn(StemCaptureEngine.prototype,'run');
    try {
      render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
      const recordSection=screen.getByRole('button',{name:'Record test'}).closest('section') as HTMLElement;
      expect(within(recordSection).getByRole('checkbox',{name:/cannot read or restore the original hardware mute state/i})).not.toBeChecked();
      expect(within(recordSection).getByText(/does not separate sources/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button',{name:'Record test'}));
      expect(await screen.findByText(/Acknowledge the transport and mute recovery notice/i)).toBeInTheDocument();
      expect(run).not.toHaveBeenCalled();expect(requestMidi).not.toHaveBeenCalled();
    } finally {
      run.mockRestore();
    }
  });

  it('draws one pass per ticked track in the sequence diagram',async()=>{
    render(<StemRecordingModal isOpen onClose={vi.fn()} onSlice={vi.fn()}/>);
    const passes=()=>screen.getByRole('dialog',{name:'Record OP-XY tracks'}).querySelectorAll('svg rect').length;
    expect(passes()).toBe(1);
    await userEvent.click(screen.getByRole('checkbox',{name:'Track 2'}));
    expect(passes()).toBe(2);expect(screen.getByText(/2 passes, one after another/)).toBeInTheDocument();
  });
});
