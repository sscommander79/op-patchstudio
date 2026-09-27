import { describe, expect, it, vi } from 'vitest';
import { CaptureSession, captureErrorMessage } from '../../../audio/recording/captureSession';

function deferred<T>() { let resolve!: (value:T)=>void; let reject!: (reason?:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no}); return {promise,resolve,reject}; }

type FakeTrack=MediaStreamTrack&{listeners:Map<string,EventListener>};
function fakeTrack(settings: MediaTrackSettings = {sampleRate:48_000,channelCount:1}):FakeTrack {
  const listeners=new Map<string,EventListener>();
  return {kind:'audio',stop:vi.fn(),getSettings:()=>settings,addEventListener:(name:string,fn:EventListener)=>listeners.set(name,fn),
    removeEventListener:(name:string)=>listeners.delete(name),listeners} as unknown as FakeTrack;
}

function graph(track:MediaStreamTrack) {
  const port={postMessage:vi.fn(),close:vi.fn(),onmessage:null as ((event:MessageEvent)=>void)|null};
  const node={port,connect:vi.fn(),disconnect:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()};
  const source={connect:vi.fn(),disconnect:vi.fn()};
  const context={sampleRate:48_000,state:'running',audioWorklet:{addModule:vi.fn().mockResolvedValue(undefined)},destination:{},
    createMediaStreamSource:vi.fn(()=>source),createBuffer:(channels:number,frames:number,rate:number)=>new AudioContext().createBuffer(channels,frames,rate),
    close:vi.fn().mockResolvedValue(undefined),suspend:vi.fn().mockResolvedValue(undefined),resume:vi.fn().mockResolvedValue(undefined),
    addEventListener:vi.fn(),removeEventListener:vi.fn()};
  const stream={getAudioTracks:()=>[track],getTracks:()=>[track]} as unknown as MediaStream;
  return {port,node,source,context,stream};
}

describe('CaptureSession lifecycle', () => {
  it('reports permission denial without allocating a capture context',async()=>{
    const onError=vi.fn(),createContext=vi.fn(),session=new CaptureSession({mediaDevices:{getUserMedia:async()=>{throw new DOMException('denied','NotAllowedError')},enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext,createWorkletNode:vi.fn(),workletUrl:'/capture.js',onError});
    await expect(session.enableInput('')).resolves.toBe(false);expect(onError).toHaveBeenCalledWith(expect.stringMatching(/permission/i));expect(createContext).not.toHaveBeenCalled();expect(session.status.state).toBe('error');
  });

  it('stops every late permission track after immediate close and never constructs a graph', async () => {
    const permission=deferred<MediaStream>(), track=fakeTrack(), made=vi.fn();
    const session=new CaptureSession({mediaDevices:{getUserMedia:()=>permission.promise,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:made,createWorkletNode:vi.fn(),workletUrl:'/assets/capture.js'});
    const enabling=session.enableInput('input-1');
    await Promise.resolve();
    await session.dispose();
    permission.resolve({getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream);
    await expect(enabling).resolves.toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(made).not.toHaveBeenCalled();
  });

  it('releases acquired input and context while worklet setup is still pending',async()=>{
    const track=fakeTrack(),g=graph(track),module=deferred<void>();g.context.audioWorklet.addModule=vi.fn(()=>module.promise);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    const enabling=session.enableInput('');await vi.waitFor(()=>expect(g.context.audioWorklet.addModule).toHaveBeenCalled());const closing=session.dispose();
    expect(track.stop).toHaveBeenCalledOnce();expect(g.context.close).toHaveBeenCalledOnce();module.resolve();await expect(enabling).resolves.toBe(false);await closing;expect(g.source.connect).not.toHaveBeenCalled();
  });

  it('releases input and context when close interrupts the initial suspension',async()=>{
    const track=fakeTrack(),g=graph(track),suspend=deferred<void>();g.context.suspend=vi.fn(()=>suspend.promise);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    const enabling=session.enableInput('');await vi.waitFor(()=>expect(g.context.suspend).toHaveBeenCalled());const closing=session.dispose();
    expect(track.stop).toHaveBeenCalledOnce();expect(g.context.close).toHaveBeenCalledOnce();suspend.resolve();
    await expect(enabling).resolves.toBe(false);await closing;expect(g.context.audioWorklet.addModule).not.toHaveBeenCalled();
  });

  it('reports a suspension rejection and releases every setup resource',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn();g.context.suspend=vi.fn().mockRejectedValue(new DOMException('suspend refused','NotAllowedError'));
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',onError});
    await expect(session.enableInput('')).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Suspending the audio capture context for graph setup failed \(NotAllowedError: suspend refused\)/));
    expect(track.stop).toHaveBeenCalledOnce();expect(g.context.close).toHaveBeenCalledOnce();expect(g.context.audioWorklet.addModule).not.toHaveBeenCalled();
  });

  it('releases acquired input and context while context resume is still pending',async()=>{
    const track=fakeTrack(),g=graph(track),resume=deferred<void>();g.context.suspend=vi.fn(async()=>{g.context.state='suspended'});g.context.resume=vi.fn(()=>resume.promise);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    const enabling=session.enableInput('');await vi.waitFor(()=>expect(g.context.resume).toHaveBeenCalled());const stopping=session.stop();
    expect(track.stop).toHaveBeenCalledOnce();expect(g.context.close).toHaveBeenCalledOnce();expect(g.source.disconnect).toHaveBeenCalledOnce();expect(g.node.disconnect).toHaveBeenCalledOnce();resume.resolve();await expect(enabling).resolves.toBe(false);await stopping;
  });

  it('freezes a running context until the complete capture graph is connected',async()=>{
    const track=fakeTrack(),g=graph(track),order:string[]=[];
    g.context.suspend=vi.fn(async()=>{order.push('suspend');g.context.state='suspended'});
    g.context.audioWorklet.addModule=vi.fn(async()=>{order.push('add-module')});
    g.context.createMediaStreamSource=vi.fn(()=>{order.push('create-source');return g.source});
    g.source.connect=vi.fn(()=>{order.push('connect-source')});
    g.node.connect=vi.fn(()=>{order.push('connect-node')});
    g.context.resume=vi.fn(async()=>{order.push('resume');g.context.state='running'});
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>{order.push('create-worklet');return g.node as unknown as AudioWorkletNode},workletUrl:'/capture.js'});
    await expect(session.enableInput('')).resolves.toBe(true);
    expect(order).toEqual(['suspend','add-module','create-source','create-worklet','connect-source','connect-node','resume']);
    expect(session.status.state).toBe('monitoring');
    await session.dispose();
  });

  it('requests processing constraints off and reports actual browser-delivered settings', async () => {
    const track=fakeTrack({sampleRate:48_000,channelCount:2,echoCancellation:false,autoGainControl:false,noiseSuppression:false});
    const g=graph(track), getUserMedia=vi.fn().mockResolvedValue(g.stream), onStatus=vi.fn();
    const session=new CaptureSession({mediaDevices:{getUserMedia,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,
      workletUrl:'/base/assets/capture.js',onStatus});
    await expect(session.enableInput('input-2')).resolves.toBe(true);
    expect(getUserMedia).toHaveBeenCalledWith({audio:{deviceId:{exact:'input-2'},echoCancellation:false,autoGainControl:false,noiseSuppression:false}});
    expect(g.context.audioWorklet.addModule).toHaveBeenCalledWith('/base/assets/capture.js');
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({state:'monitoring',sampleRate:48_000,channels:2,settingsReported:true}));
    await session.dispose();
    expect(g.source.disconnect).toHaveBeenCalledOnce(); expect(g.node.disconnect).toHaveBeenCalledOnce();
    expect(g.port.close).toHaveBeenCalledOnce(); expect(track.stop).toHaveBeenCalledOnce(); expect(g.context.close).toHaveBeenCalledOnce();
  });

  it('exposes one capture clock snapshot and preserves processor source frame bounds',async()=>{
    const track=fakeTrack(),g=graph(track),onTake=vi.fn();Object.assign(g.context,{currentTime:1.25});
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',onTake});
    await session.enableInput('');expect(session.clockSnapshot()).toMatchObject({audioTime:1.25,sampleRate:48_000,performanceTime:expect.any(Number)});
    g.port.onmessage?.({data:{type:'take',take:{frames:2,startFrame:120,endFrame:122,preRollFrames:0,reason:'manual',sampleRate:48_000,channels:[Float32Array.from([.1,.2])]}}} as MessageEvent);await vi.waitFor(()=>expect(onTake).toHaveBeenCalled());expect(onTake.mock.calls[0][0]).toMatchObject({sourceStartFrame:120,sourceEndFrame:122});await session.dispose();
  });

  it('maps actionable media errors without hiding the browser error class', () => {
    for (const [name,text] of [['NotAllowedError','permission'],['NotFoundError','connect'],['NotReadableError','in use'],['OverconstrainedError','supported input']]) {
      const error=new DOMException('detail',name); expect(captureErrorMessage(error)).toMatch(new RegExp(text,'i'));
    }
  });

  it('reports the exact setup stage and DOMException identity',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn();g.context.audioWorklet.addModule=vi.fn().mockRejectedValue(new DOMException('module refused','NotSupportedError'));
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',onError});
    await expect(session.enableInput('')).resolves.toBe(false);expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Loading the local capture processor failed \(NotSupportedError: module refused\)/));expect(track.stop).toHaveBeenCalledOnce();expect(g.context.close).toHaveBeenCalledOnce();
  });

  it('makes Stop available during permission and invalidates the pending generation', async () => {
    const permission=deferred<MediaStream>(), track=fakeTrack();
    const session=new CaptureSession({mediaDevices:{getUserMedia:()=>permission.promise,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:vi.fn(),createWorkletNode:vi.fn(),workletUrl:'/capture.js'});
    const setup=session.enableInput('');
    await Promise.resolve();
    await session.stop();
    permission.resolve({getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream);
    await setup;
    expect(track.stop).toHaveBeenCalledOnce(); expect(session.status.state).toBe('stopped');
  });

  it('tears down a live graph on processor error and ignores a late take callback', async () => {
    const track=fakeTrack(), g=graph(track), onError=vi.fn(), onTake=vi.fn();
    let processorError:EventListener|undefined;
    g.node.addEventListener=vi.fn((name:string,fn:EventListener)=>{if(name==='processorerror')processorError=fn});
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,
      workletUrl:'/capture.js',onError,onTake});
    await session.enableInput('');
    processorError?.(new Event('processorerror'));
    await Promise.resolve(); await Promise.resolve();
    g.port.onmessage?.({data:{type:'take',take:{frames:1,startFrame:0,endFrame:1,preRollFrames:0,reason:'manual',sampleRate:48_000,channels:[new Float32Array([.5])]}}} as MessageEvent);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/processor/i));
    expect(onTake).not.toHaveBeenCalled(); expect(track.stop).toHaveBeenCalledOnce();
  });

  it('aborts and releases the graph when the selected device ends',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn(),session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',onError});
    await session.enableInput('');track.listeners.get('ended')?.(new Event('ended'));await vi.waitFor(()=>expect(session.status.state).toBe('error'));
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/disconnected/i));expect(track.stop).toHaveBeenCalledOnce();expect(g.context.close).toHaveBeenCalledOnce();expect(session.status.state).toBe('error');
  });

  it('accepts the owned final take before stopped and waits for async materialization',async()=>{
    const track=fakeTrack(),g=graph(track),materialized=deferred<void>(),onTake=vi.fn(()=>materialized.promise);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,
      workletUrl:'/capture.js',onTake});
    await session.enableInput('');session.start();const stopping=session.stop();
    g.port.onmessage?.({data:{type:'take',take:{frames:1,startFrame:0,endFrame:1,preRollFrames:0,reason:'manual',sampleRate:48_000,channels:[Float32Array.from([.5])]}}} as MessageEvent);
    g.port.onmessage?.({data:{type:'stopped'}} as MessageEvent);
    await Promise.resolve();expect(onTake).toHaveBeenCalledOnce();expect(track.stop).not.toHaveBeenCalled();
    materialized.resolve();await stopping;expect(track.stop).toHaveBeenCalledOnce();
  });

  it('reports a bounded flush timeout instead of claiming an unfinished take succeeded',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn();let timeout:undefined|(()=>void);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,
      workletUrl:'/capture.js',onError,setTimer:callback=>{timeout=callback;return 1},clearTimer:vi.fn()});
    await session.enableInput('');session.start();const stopping=session.stop();timeout?.();await stopping;
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/unfinished take/i));expect(session.status.state).toBe('error');
  });

  it('settles one shared in-flight Stop when dispose removes the processor reply path',async()=>{
    const track=fakeTrack(),g=graph(track),session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    await session.enableInput('');session.start();let firstSettled=false,secondSettled=false;const firstOperation=session.stop(),secondOperation=session.stop();expect(secondOperation).toBe(firstOperation);const first=firstOperation.then(()=>{firstSettled=true}),second=secondOperation.then(()=>{secondSettled=true});await session.dispose();await Promise.resolve();
    expect(firstSettled).toBe(true);expect(secondSettled).toBe(true);expect(g.port.postMessage.mock.calls.filter(([message])=>message.type==='stop')).toHaveLength(1);expect(session.status.state).toBe('closed');
    g.port.onmessage?.({data:{type:'stopped'}} as MessageEvent);await Promise.all([first,second]);expect(session.status.state).toBe('closed');
  });

  it('settles Stop during setup replacement and ignores the old processor acknowledgement',async()=>{
    const firstTrack=fakeTrack(),secondTrack=fakeTrack(),first=graph(firstTrack),second=graph(secondTrack);let mediaCall=0,contextCall=0;
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>++mediaCall===1?first.stream:second.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>++contextCall===1?first.context as unknown as AudioContext:second.context as unknown as AudioContext,
      createWorkletNode:()=>contextCall===1?first.node as unknown as AudioWorkletNode:second.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    await session.enableInput('');const oldHandler=first.port.onmessage;session.start();const stopping=session.stop(),replacement=session.enableInput('');await expect(stopping).resolves.toBeUndefined();await expect(replacement).resolves.toBe(true);
    expect(firstTrack.stop).toHaveBeenCalledOnce();expect(session.status.state).toBe('monitoring');oldHandler?.({data:{type:'stopped'}} as MessageEvent);await Promise.resolve();expect(session.status.state).toBe('monitoring');expect(secondTrack.stop).not.toHaveBeenCalled();await session.dispose();
  });

  it('never lets a released setup continuation adopt or close a newer graph',async()=>{
    const firstTrack=fakeTrack(),secondTrack=fakeTrack(),first=graph(firstTrack),second=graph(secondTrack),module=deferred<void>();first.context.audioWorklet.addModule=vi.fn(()=>module.promise);let mediaCall=0,contextCall=0;
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>++mediaCall===1?first.stream:second.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>++contextCall===1?first.context as unknown as AudioContext:second.context as unknown as AudioContext,
      createWorkletNode:()=>contextCall===1?first.node as unknown as AudioWorkletNode:second.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    const stale=session.enableInput('');await vi.waitFor(()=>expect(first.context.audioWorklet.addModule).toHaveBeenCalled());const replacement=session.enableInput('');await expect(replacement).resolves.toBe(true);module.resolve();await expect(stale).resolves.toBe(false);
    expect(firstTrack.stop).toHaveBeenCalledOnce();expect(first.context.close).toHaveBeenCalledOnce();expect(secondTrack.stop).not.toHaveBeenCalled();expect(second.context.close).not.toHaveBeenCalled();expect(session.status.state).toBe('monitoring');await session.dispose();
  });

  it('does not let a held stale setup cleanup close a replacement graph on the same session',async()=>{
    const firstTrack=fakeTrack(),secondTrack=fakeTrack(),first=graph(firstTrack),second=graph(secondTrack),module=deferred<void>(),oldClose=deferred<void>();first.context.audioWorklet.addModule=vi.fn(()=>module.promise);first.context.close=vi.fn(()=>oldClose.promise);let mediaCall=0,contextCall=0;
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>++mediaCall===1?first.stream:second.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>++contextCall===1?first.context as unknown as AudioContext:second.context as unknown as AudioContext,
      createWorkletNode:()=>contextCall===1?first.node as unknown as AudioWorkletNode:second.node as unknown as AudioWorkletNode,workletUrl:'/capture.js'});
    const stale=session.enableInput('');await vi.waitFor(()=>expect(first.context.audioWorklet.addModule).toHaveBeenCalled());const disposing=session.dispose();await vi.waitFor(()=>expect(first.context.close).toHaveBeenCalledOnce());const replacement=session.enableInput('');await expect(replacement).resolves.toBe(true);expect(session.status.state).toBe('monitoring');
    module.resolve();await expect(stale).resolves.toBe(false);oldClose.resolve();await disposing;expect(secondTrack.stop).not.toHaveBeenCalled();expect(second.context.close).not.toHaveBeenCalled();expect(session.status.state).toBe('monitoring');await session.dispose();
  });

  it('turns materialization failure into actionable cleanup and never acknowledges the take',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn();
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,
      workletUrl:'/capture.js',onError,onTake:async()=>{throw new Error('encoding broke')}});
    await session.enableInput('');
    g.port.onmessage?.({data:{type:'take',take:{frames:1,startFrame:0,endFrame:1,preRollFrames:0,reason:'manual',sampleRate:48_000,channels:[Float32Array.from([.5])]}}} as MessageEvent);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/encoding broke/i));expect(track.stop).toHaveBeenCalledOnce();
    expect(g.port.postMessage).not.toHaveBeenCalledWith({type:'ack-take'});
  });

  it('keeps the error state when final-take materialization rejects during Stop',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn();
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,
      workletUrl:'/capture.js',onError,onTake:async()=>{throw new Error('final encoding broke')}});
    await session.enableInput('');session.start();const stopping=session.stop();
    g.port.onmessage?.({data:{type:'take',take:{frames:1,startFrame:0,endFrame:1,preRollFrames:0,reason:'manual',sampleRate:48_000,channels:[Float32Array.from([.5])]}}} as MessageEvent);
    g.port.onmessage?.({data:{type:'stopped'}} as MessageEvent);await stopping;
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/final encoding broke/i));expect(session.status.state).toBe('error');expect(track.stop).toHaveBeenCalledOnce();
  });

  it('rejects recorder ownership capacity before allocating the exact AudioBuffer',async()=>{
    const track=fakeTrack(),g=graph(track),onError=vi.fn(),createContext=vi.fn(()=>g.context as unknown as AudioContext);g.context.createBuffer=vi.fn(g.context.createBuffer);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',onError,
      getRetainedUsage:()=>({count:32,bytes:1})});
    await expect(session.enableInput('')).resolves.toBe(false);
    g.port.onmessage?.({data:{type:'take',take:{frames:1,startFrame:0,endFrame:1,preRollFrames:0,reason:'manual',sampleRate:48_000,channels:[new Float32Array(960_000)]}}} as MessageEvent);
    await Promise.resolve();await Promise.resolve();
    expect(createContext).not.toHaveBeenCalled();expect(g.context.createBuffer).not.toHaveBeenCalled();expect(onError).toHaveBeenCalledWith(expect.stringMatching(/capacity is full/i));
  });

  it('admits the one-before-count reservation when its full peak memory fits',async()=>{
    const track=fakeTrack(),g=graph(track);
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',capture:{mode:'manual',maxSeconds:1},
      getRetainedUsage:()=>({count:31,bytes:0})});
    await expect(session.enableInput('')).resolves.toBe(true);await session.dispose();
  });

  it('withholds next-take credit when an accepted take moves a stale 31-count view to 32',async()=>{
    const track=fakeTrack(),g=graph(track),onTake=vi.fn();
    const session=new CaptureSession({mediaDevices:{getUserMedia:async()=>g.stream,enumerateDevices:async()=>[]} as unknown as MediaDevices,
      createContext:()=>g.context as unknown as AudioContext,createWorkletNode:()=>g.node as unknown as AudioWorkletNode,workletUrl:'/capture.js',capture:{mode:'sound',maxSeconds:1},onTake,
      getRetainedUsage:()=>({count:31,bytes:0})});
    await session.enableInput('');
    g.port.onmessage?.({data:{type:'take',take:{frames:1,startFrame:0,endFrame:1,preRollFrames:0,reason:'silence',sampleRate:48_000,channels:[new Float32Array(48_000)]}}} as MessageEvent);
    await Promise.resolve();await Promise.resolve();
    expect(onTake).toHaveBeenCalledOnce();expect(g.port.postMessage).toHaveBeenCalledWith({type:'stop'});expect(g.port.postMessage).not.toHaveBeenCalledWith({type:'ack-take'});
    g.port.onmessage?.({data:{type:'stopped'}} as MessageEvent);await Promise.resolve();expect(track.stop).toHaveBeenCalledOnce();
  });
});
