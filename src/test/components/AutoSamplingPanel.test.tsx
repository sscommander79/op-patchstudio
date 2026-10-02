import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {StrictMode,useState} from 'react';
import {AutoSamplingPanel} from '../../components/common/AutoSamplingPanel';
import type {AutoCapture,AutoCaptureCallbacks,AutoSampleResult} from '../../audio/recording/autoSampler';
import {midiRoutes} from '../../midi/routeLease';

const midi=vi.hoisted(()=>({supported:true,enabled:false,outputs:[{id:'virtual',name:'Synthetic MIDI output',state:'connected',connection:'open',send:vi.fn()}],enable:vi.fn(async()=>{midi.enabled=true}),addListener:vi.fn(),removeListener:vi.fn(),getOutputById:vi.fn((id:string,options?:{disconnected?:boolean})=>options?.disconnected?undefined:midi.outputs.find(output=>output.id===id))}));
vi.mock('webmidi',()=>({WebMidi:midi}));

function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}

describe('AutoSamplingPanel',()=>{
  beforeEach(()=>{midi.enabled=false;midi.enable.mockClear();midi.outputs[0].send.mockClear();vi.mocked(localStorage.getItem).mockReset();vi.mocked(localStorage.setItem).mockClear();localStorage.clear();});
  afterEach(async()=>{cleanup();await waitFor(()=>expect(midiRoutes.current('virtual')).toBeUndefined());});

  it('requests MIDI only on explicit Enable and captures the selected note range with exact roots',async()=>{
    const results:AutoSampleResult[]=[],callbacks:AutoCaptureCallbacks[]=[];let sequence=0;
    const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>{callbacks.push(cb);return{enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:128}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from([.2,-.2,.2,-.2]),0);cb.onTake({id:`auto-${++sequence}`,audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:vi.fn(async()=>{})};};
    const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={value=>results.push(value)} onRunningChange={vi.fn()}/>);
    expect(midi.enable).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Enable MIDI'}));expect(midi.enable).toHaveBeenCalledOnce();
    await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');for(const [label,value] of [['Start note','60'],['End note','66'],['Note step','6'],['Hold duration','0'],['Release tail','0'],['Between-note settling','0']] as const){const input=screen.getByLabelText(label);await user.clear(input);await user.type(input,value);}
    await user.click(screen.getByRole('button',{name:'Start automatic capture'}));await waitFor(()=>expect(results.map(result=>result.rootNote)).toEqual([60,66]));
    expect(callbacks).toHaveLength(2);expect(midi.outputs[0].send.mock.calls.map(call=>call[0])).toEqual([[0x90,60,100],[0x80,60,0],[0x90,66,100],[0x80,66,0]]);
  });

  it('blocks occupied roots before sending MIDI',async()=>{
    const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[48]} createCapture={vi.fn()} onTake={vi.fn()} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Start automatic capture'}));expect(await screen.findByRole('alert')).toHaveTextContent(/root 48.*already occupied/i);expect(midi.outputs[0].send).not.toHaveBeenCalled();
  });

  it('denies a busy autosampling output without creating a capture or sending MIDI',async()=>{
    const devicesLease=midiRoutes.acquire('virtual','devices')!;
    const createCapture=vi.fn();
    const user=userEvent.setup();
    try {
      render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);
      await user.click(screen.getByRole('button',{name:'Enable MIDI'}));
      await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');
      await user.click(screen.getByRole('button',{name:'Check sound on one note'}));

      expect(await screen.findByRole('alert')).toHaveTextContent(/MIDI output is busy with Devices or track capture/i);
      expect(createCapture).not.toHaveBeenCalled();
      expect(midi.outputs[0].send).not.toHaveBeenCalled();
      expect(midiRoutes.current('virtual')).toBe('devices');
    } finally {
      devicesLease.release();
    }
  });

  it('holds autosampling output ownership until cancel cleanup completes',async()=>{
    const close=deferred();
    let disposed=false;
    const dispose=vi.fn(()=>{if(disposed)return Promise.resolve();disposed=true;return close.promise;});
    const createCapture=():AutoCapture=>({
      enableInput:vi.fn(async()=>true),
      start:vi.fn(),
      stop:vi.fn(async()=>{}),
      dispose,
    });
    const user=userEvent.setup();
    render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);
    await user.click(screen.getByRole('button',{name:'Enable MIDI'}));
    await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');
    await user.click(screen.getByRole('button',{name:'Check sound on one note'}));

    await waitFor(()=>expect(midiRoutes.current('virtual')).toBe('autosampling'));
    expect(midiRoutes.acquire('virtual','devices')).toBeUndefined();
    await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));
    await waitFor(()=>expect(dispose).toHaveBeenCalled());
    await Promise.resolve();
    const ownerWhileClosePending=midiRoutes.current('virtual');
    const competing=midiRoutes.acquire('virtual','devices');
    const devicesSend=vi.fn();
    if(competing)devicesSend();
    competing?.release();
    close.resolve();
    await waitFor(()=>expect(midiRoutes.current('virtual')).toBeUndefined());
    expect(ownerWhileClosePending).toBe('autosampling');
    expect(devicesSend).not.toHaveBeenCalled();
    const devicesLease=midiRoutes.acquire('virtual','devices');
    expect(devicesLease?.owner).toBe('devices');
    devicesLease?.release();
  });

  it('holds autosampling output ownership through unmount disposal',async()=>{
    const close=deferred();
    let disposed=false;
    const createCapture=():AutoCapture=>({enableInput:vi.fn(async()=>true),start:vi.fn(),stop:vi.fn(async()=>{}),dispose:vi.fn(()=>{if(disposed)return Promise.resolve();disposed=true;return close.promise;})});
    const user=userEvent.setup();
    const view=render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);
    await user.click(screen.getByRole('button',{name:'Enable MIDI'}));
    await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');
    await user.click(screen.getByRole('button',{name:'Check sound on one note'}));
    await waitFor(()=>expect(midiRoutes.current('virtual')).toBe('autosampling'));

    view.unmount();
    await Promise.resolve();await Promise.resolve();
    const ownerWhileClosePending=midiRoutes.current('virtual');
    const competing=midiRoutes.acquire('virtual','devices');
    competing?.release();
    close.resolve();
    await waitFor(()=>expect(midiRoutes.current('virtual')).toBeUndefined());
    expect(ownerWhileClosePending).toBe('autosampling');
    expect(competing).toBeUndefined();
  });

  it('keeps the warned take until a clean retry succeeds',async()=>{
    const calls:Array<{result:AutoSampleResult;replace:boolean}>=[];let attempt=0;const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>({enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from(++attempt===1?[0,0,0,0]:[.2,-.2,.2,-.2]),0);cb.onTake({id:`retry-${attempt}`,audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:vi.fn(async()=>{})});const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={(result,replace)=>calls.push({result,replace})} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');for(const label of ['Hold duration','Release tail']){const input=screen.getByLabelText(label);await user.clear(input);await user.type(input,'0');}await user.selectOptions(screen.getByLabelText('Routing profile'),'custom');await user.clear(screen.getByLabelText('End note'));await user.type(screen.getByLabelText('End note'),'48');await user.click(screen.getByRole('button',{name:'Start automatic capture'}));await waitFor(()=>expect(calls).toHaveLength(1));expect(calls[0]).toMatchObject({replace:false,result:{rootNote:48,selected:false}});await user.click(screen.getByRole('button',{name:'Retry MIDI note 48'}));await waitFor(()=>expect(calls).toHaveLength(2));expect(calls[1]).toMatchObject({replace:true,result:{rootNote:48,selected:true}});
  });

  it('does not let a cancelled permission request clear a restarted run',async()=>{
    let releaseFirst!:(value:boolean)=>void,created=0;const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>{created+=1;if(created===1)return{enableInput:()=>new Promise(resolve=>{releaseFirst=resolve}),start:vi.fn(),stop:vi.fn(async()=>{}),dispose:vi.fn(async()=>{})};return{enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:vi.fn(async()=>{}),dispose:vi.fn(async()=>{})};};const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(created).toBe(1));await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(midi.outputs[0].send).toHaveBeenCalledWith([0x90,48,100]));releaseFirst(true);await Promise.resolve();expect(screen.getByRole('button',{name:'Stop automatic capture'})).toBeEnabled();await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));
  });

  it('serializes repeated Stop requests before allowing a replacement run',async()=>{
    let releasePermission!:(value:boolean)=>void,releaseDispose!:()=>void,created=0;const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>{created+=1;if(created===1)return{enableInput:()=>new Promise(resolve=>{releasePermission=resolve}),start:vi.fn(),stop:vi.fn(async()=>{}),dispose:()=>new Promise(resolve=>{releaseDispose=resolve})};return{enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:vi.fn(async()=>{}),dispose:vi.fn(async()=>{})};};const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(created).toBe(1));await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));expect(screen.getByRole('button',{name:'Check sound on one note'})).toBeDisabled();releaseDispose();await waitFor(()=>expect(screen.getByRole('button',{name:'Check sound on one note'})).toBeEnabled());await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(midi.outputs[0].send).toHaveBeenCalledWith([0x90,48,100]));releasePermission(true);await Promise.resolve();expect(screen.getByRole('button',{name:'Stop automatic capture'})).toBeEnabled();await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));
  });

  it('cancels the owned note when the page becomes hidden',async()=>{
    const close=deferred();let disposed=false;const dispose=vi.fn(()=>{if(disposed)return Promise.resolve();disposed=true;return close.promise;});const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>({enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:vi.fn(async()=>{}),dispose});const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(midi.outputs[0].send).toHaveBeenCalledWith([0x90,48,100]));act(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await waitFor(()=>expect(midi.outputs[0].send).toHaveBeenCalledWith([0x80,48,0]));await waitFor(()=>expect(dispose).toHaveBeenCalled());await Promise.resolve();const ownerWhileClosePending=midiRoutes.current('virtual'),competing=midiRoutes.acquire('virtual','devices');competing?.release();close.resolve();await waitFor(()=>expect(midiRoutes.current('virtual')).toBeUndefined());expect(ownerWhileClosePending).toBe('autosampling');expect(competing).toBeUndefined();expect(screen.getByRole('alert')).toHaveTextContent(/page was hidden/i);Object.defineProperty(document,'hidden',{configurable:true,value:false});
  });

  it('restores independent audio, MIDI, and timing settings for named profiles',async()=>{
    function Harness(){const [audio,setAudio]=useState('input-a'),[version,setVersion]=useState(0);return <><label>Profile audio input<select aria-label="Profile audio input" value={audio} onChange={event=>{setAudio(event.target.value);setVersion(value=>value+1);}}><option value="">Default</option><option value="input-a">Input A</option><option value="input-b">Input B</option></select></label><AutoSamplingPanel audioDeviceId={audio} audioDevices={[{deviceId:'input-a',label:'Input A'},{deviceId:'input-b',label:'Input B'}]} audioSelectionVersion={version} onAudioDeviceChange={setAudio} disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={vi.fn()} onTake={vi.fn()} onRunningChange={vi.fn()}/></>};const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('Routing profile'),'nina-digitakt');await user.selectOptions(screen.getByLabelText('Profile audio input'),'input-b');await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.clear(screen.getByLabelText('Start note'));await user.type(screen.getByLabelText('Start note'),'50');await user.selectOptions(screen.getByLabelText('Routing profile'),'ableton');await user.selectOptions(screen.getByLabelText('Profile audio input'),'input-a');await user.clear(screen.getByLabelText('Start note'));await user.type(screen.getByLabelText('Start note'),'70');await user.selectOptions(screen.getByLabelText('Routing profile'),'nina-digitakt');expect(screen.getByLabelText('Profile audio input')).toHaveValue('input-b');expect(screen.getByLabelText('MIDI output')).toHaveValue('virtual');expect(screen.getByLabelText('Start note')).toHaveValue(50);await waitFor(()=>{const writes=vi.mocked(localStorage.setItem).mock.calls.filter(([key])=>key==='op-patchstudio:auto-sampling:v1');const stored=JSON.parse(String(writes.at(-1)?.[1]));expect(stored.routes['nina-digitakt']).toMatchObject({audioDeviceId:'input-b',outputId:'virtual',settings:{startNote:50}});});
  });

  it('remains mounted after StrictMode effect replay and enables MIDI from the explicit action',async()=>{
    const user=userEvent.setup();render(<StrictMode><AutoSamplingPanel audioDeviceId="" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={vi.fn()} onTake={vi.fn()} onRunningChange={vi.fn()}/></StrictMode>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));expect(midi.enable).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'MIDI enabled'})).toBeDisabled();
  });

  it('lists connected outputs when MIDI was enabled before the panel mounted',async()=>{
    midi.enabled=true;render(<AutoSamplingPanel audioDeviceId="" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={vi.fn()} onTake={vi.fn()} onRunningChange={vi.fn()}/>);expect(await screen.findByRole('option',{name:'Synthetic MIDI output'})).toBeInTheDocument();expect(midi.enable).not.toHaveBeenCalled();
  });

  it('blocks capture when a saved audio device is missing until the input is explicitly selected',async()=>{
    const stored={profile:'nina-digitakt',routes:{custom:{audioDeviceId:'',outputId:'',settings:{}},'nina-digitakt':{audioDeviceId:'missing-input',outputId:'',settings:{}},ableton:{audioDeviceId:'',outputId:'',settings:{}}}};vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(stored));const createCapture=vi.fn(),user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="" audioDevices={[{deviceId:'input-a',label:'Input A'}]} onAudioDeviceChange={vi.fn()} disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);expect(await screen.findByRole('alert')).toHaveTextContent(/saved audio input is unavailable/i);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));expect(screen.getByRole('alert')).toHaveTextContent(/choose an audio input/i);expect(createCapture).not.toHaveBeenCalled();
  });

  it('falls back to the Custom profile for prototype property names in stored preferences',()=>{
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({profile:'constructor',routes:{custom:{audioDeviceId:'',outputId:'',settings:{}}}}));render(<AutoSamplingPanel audioDeviceId="" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={vi.fn()} onTake={vi.fn()} onRunningChange={vi.fn()}/>);expect(screen.getByLabelText('Routing profile')).toHaveValue('custom');expect(screen.getByLabelText('Start note')).toHaveValue(48);
  });

  it('preserves an unresolved saved input while switching profiles',async()=>{
    const stored={profile:'nina-digitakt',routes:{custom:{audioDeviceId:'',outputId:'',settings:{}},'nina-digitakt':{audioDeviceId:'missing-input',outputId:'virtual',settings:{}},ableton:{audioDeviceId:'',outputId:'',settings:{}}}};vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(stored));const createCapture=vi.fn(),user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="" audioDevices={[{deviceId:'input-a',label:'Input A'}]} onAudioDeviceChange={vi.fn()} disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);expect(await screen.findByRole('alert')).toHaveTextContent(/saved audio input is unavailable/i);await user.selectOptions(screen.getByLabelText('Routing profile'),'ableton');await user.selectOptions(screen.getByLabelText('Routing profile'),'nina-digitakt');expect(screen.getByRole('alert')).toHaveTextContent(/saved audio input is unavailable/i);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.click(screen.getByRole('button',{name:'Check sound on one note'}));expect(screen.getByRole('alert')).toHaveTextContent(/choose an audio input/i);expect(createCapture).not.toHaveBeenCalled();
  });

  it('requires a real, noncommitting sound check for a named route and invalidates it when the route changes',async()=>{
    const applied=vi.fn(),createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>({enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from([.2,-.2,.2,-.2]),0);cb.onTake({id:'route-check',audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:vi.fn(async()=>{})});const user=userEvent.setup();render(<AutoSamplingPanel audioDeviceId="input-a" audioDevices={[{deviceId:'input-a',label:'Input A'}]} disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={applied} onRunningChange={vi.fn()}/>);await user.selectOptions(screen.getByLabelText('Routing profile'),'nina-digitakt');await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');for(const label of ['Hold duration','Release tail','Between-note settling']){await user.clear(screen.getByLabelText(label));await user.type(screen.getByLabelText(label),'0');}await user.click(screen.getByRole('button',{name:'Start automatic capture'}));expect(screen.getByRole('alert')).toHaveTextContent(/check sound/i);await user.click(screen.getByRole('button',{name:'Test one note'}));await waitFor(()=>expect(applied).toHaveBeenCalledOnce());await waitFor(()=>expect(screen.getByRole('button',{name:'Check sound on one note'})).toBeEnabled());applied.mockClear();await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(screen.getByText(/sound check passed on midi note/i)).toBeInTheDocument());expect(applied).not.toHaveBeenCalled();await user.clear(screen.getByLabelText('MIDI channel'));await user.type(screen.getByLabelText('MIDI channel'),'2');await user.click(screen.getByRole('button',{name:'Start automatic capture'}));expect(screen.getByRole('alert')).toHaveTextContent(/check sound/i);expect(applied).not.toHaveBeenCalled();
  });

  it('guides custom routing through audition confirmation and invalidates timing but not range selection',async()=>{
    const results:AutoSampleResult[]=[],steps:string[]=[],audition=vi.fn();let sequence=0;
    const settings={startNote:48,endNote:72,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));
    const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>({enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from([.2,-.2,.2,-.2]),0);cb.onTake({id:`guided-${++sequence}`,audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:vi.fn(async()=>{})});
    function Harness(){const [step,setStep]=useState<'connect'|'capture'|'review'|'finish'>('connect');return <AutoSamplingPanel guidedStep={step} onGuidedStepChange={next=>{steps.push(next);setStep(next)}} audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={value=>results.push(value)} onRunningChange={vi.fn()} onAuditionCheck={audition}/>}
    const user=userEvent.setup();render(<Harness/>);
    expect(screen.getByRole('button',{name:'Continue to capture range'})).toBeDisabled();await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Audition check note'})).toBeEnabled());expect(results).toHaveLength(0);await user.click(screen.getByRole('button',{name:'Audition check note'}));expect(audition).toHaveBeenCalledOnce();await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));await user.click(screen.getByRole('button',{name:'Continue to capture range'}));await user.clear(screen.getByLabelText('End note'));await user.type(screen.getByLabelText('End note'),'78');expect(screen.getByRole('button',{name:'Start automatic capture'})).toBeEnabled();await user.clear(screen.getByLabelText('Start note'));await user.type(screen.getByLabelText('Start note'),'49');expect(screen.getByRole('button',{name:'Start automatic capture'})).toBeDisabled();expect(steps).toEqual(['capture']);
  });

  it('does not restore check evidence after an unchanged-output ports change during cleanup',async()=>{
    const settings={startNote:48,endNote:72,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:.25,readinessTimeoutSeconds:2};vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));
    let releaseDispose!:()=>void,portsChanged!:()=>void;const bytes=vi.fn();midi.addListener.mockImplementation((event:string,listener:()=>void)=>{if(event==='portschanged')portsChanged=listener});
    const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>({enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from([.2,-.2,.2,-.2]),0);cb.onTake({id:'pending-check',audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:()=>new Promise(resolve=>{releaseDispose=resolve})});
    const user=userEvent.setup();render(<AutoSamplingPanel guidedStep="connect" audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()} onCheckBytesChange={bytes}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(releaseDispose).toBeTypeOf('function'));act(()=>portsChanged());releaseDispose();await waitFor(()=>expect(screen.getByRole('button',{name:'Stop sound check'})).toBeDisabled());expect(screen.queryByRole('button',{name:'Audition check note'})).not.toBeInTheDocument();expect(bytes).toHaveBeenLastCalledWith(0);expect(screen.getByRole('button',{name:'Continue to capture range'})).toBeDisabled();
  });

  it('does not publish a completed check after Stop wins delayed cleanup',async()=>{
    const settings={startNote:48,endNote:72,step:6,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:.25,readinessTimeoutSeconds:2};vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));
    let releaseDispose!:()=>void;const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>({enableInput:vi.fn(async()=>true),start:()=>cb.onStatus({state:'recording',elapsedFrames:1}),stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from([.2,-.2,.2,-.2]),0);cb.onTake({id:'cancelled-check',audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:()=>new Promise(resolve=>{releaseDispose=resolve})});const user=userEvent.setup();render(<AutoSamplingPanel guidedStep="connect" audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={0} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(releaseDispose).toBeTypeOf('function'));await user.click(screen.getByRole('button',{name:'Stop sound check'}));releaseDispose();await waitFor(()=>expect(screen.getByRole('button',{name:'Stop sound check'})).toBeDisabled());expect(screen.queryByRole('button',{name:'Audition check note'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Continue to capture range'})).toBeDisabled();
  });

  it('accounts an in-flight check reservation before creating capture',async()=>{
    const createCapture=vi.fn(),user=userEvent.setup();render(<AutoSamplingPanel guidedStep="connect" audioDeviceId="synthetic" disabled={false} retainedCount={0} retainedBytes={256*1024*1024-1} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));expect(screen.getByRole('alert')).toHaveTextContent(/room for a sound check/i);expect(createCapture).not.toHaveBeenCalled();expect(midi.outputs[0].send).not.toHaveBeenCalled();
  });
  it('guided review offers capture-more and a safe path back to connection checking',async()=>{
    const createCapture=vi.fn(),steps:string[]=[],user=userEvent.setup();
    function Harness(){const [step,setStep]=useState<'connect'|'capture'|'review'|'finish'>('review');return <AutoSamplingPanel guidedStep={step} onGuidedStepChange={next=>{steps.push(next);setStep(next)}} audioDeviceId="synthetic" disabled={false} retainedCount={1} retainedBytes={16} existingRoots={[]} createCapture={createCapture} onTake={vi.fn()} onRunningChange={vi.fn()}/>;}
    render(<Harness/>);expect(screen.getByText('No warned MIDI notes are waiting for retry.')).toBeVisible();expect(screen.getByRole('button',{name:'Stop automatic capture'})).toBeDisabled();
    await user.click(screen.getByRole('button',{name:'Capture more notes'}));expect(screen.getByRole('button',{name:'Start automatic capture'})).toBeDisabled();
    await user.click(screen.getByRole('button',{name:'Back to Connect and check'}));expect(screen.getByRole('heading',{name:'Connect and check'})).toBeVisible();expect(steps).toEqual(['capture','connect']);expect(createCapture).not.toHaveBeenCalled();expect(midi.outputs[0].send).not.toHaveBeenCalled();
  });
  it('guided warned-take retry and cancellation preserve the take and require a renewed check',async()=>{
    let captureNumber=0;const results:Array<{result:AutoSampleResult;replace:boolean}>=[];
    const settings={startNote:48,endNote:48,step:1,velocity:100,channel:1,holdSeconds:0,tailSeconds:0,settleSeconds:0,readinessTimeoutSeconds:2};
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({profile:'custom',routes:{custom:{audioDeviceId:'',outputId:'',settings},'nina-digitakt':{audioDeviceId:'',outputId:'',settings},ableton:{audioDeviceId:'',outputId:'',settings}}}));
    const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>{const number=++captureNumber;return{enableInput:vi.fn(async()=>true),start:()=>{if(number!==3)cb.onStatus({state:'recording',elapsedFrames:1});},stop:async()=>{const audioBuffer=new AudioContext().createBuffer(1,4,8_000);audioBuffer.copyToChannel(Float32Array.from(number===2?[0,0,0,0]:[.2,-.2,.2,-.2]),0);cb.onTake({id:`guided-retry-${number}`,audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:'manual'});},dispose:vi.fn(async()=>{})};};
    function Harness(){const [step,setStep]=useState<'connect'|'capture'|'review'|'finish'>('connect');return <AutoSamplingPanel guidedStep={step} onGuidedStepChange={setStep} onCaptureReview={()=>setStep('review')} audioDeviceId="synthetic" disabled={false} retainedCount={1} retainedBytes={16} existingRoots={[]} createCapture={createCapture} onTake={(result,replace)=>results.push({result,replace})} onRunningChange={vi.fn()} onAuditionCheck={vi.fn()}/>;}
    const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Enable MIDI'}));await user.selectOptions(screen.getByLabelText('MIDI output'),'virtual');await user.click(screen.getByRole('button',{name:'Check sound on one note'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Audition check note'})).toBeEnabled());await user.click(screen.getByRole('button',{name:'Audition check note'}));await user.click(screen.getByRole('checkbox',{name:/intended instrument/i}));await user.click(screen.getByRole('button',{name:'Continue to capture range'}));await user.click(screen.getByRole('button',{name:'Start automatic capture'}));
    await waitFor(()=>expect(results).toHaveLength(1));expect(results[0]).toMatchObject({replace:false,result:{rootNote:48,selected:false}});
    await user.click(await screen.findByRole('button',{name:'Retry MIDI note 48 with current settings'}));await waitFor(()=>expect(captureNumber).toBe(3));await user.click(screen.getByRole('button',{name:'Stop automatic capture'}));
    const renew=await screen.findByRole('button',{name:'Renew sound check before retry'});await waitFor(()=>expect(renew).toBeEnabled());expect(results).toHaveLength(1);await user.click(renew);expect(screen.getByRole('heading',{name:'Connect and check'})).toBeVisible();expect(screen.getByRole('button',{name:'Return to review retries'})).toBeDisabled();expect(midiRoutes.current('virtual')).toBeUndefined();
  });

});
