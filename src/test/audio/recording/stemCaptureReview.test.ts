import {afterEach,describe,expect,it,vi} from 'vitest';
import {StemCaptureEngine,type StemCaptureCallbacks,type StemSettings} from '../../../audio/recording/stemCapture';

const settings:StemSettings={tracks:[1],bpm:120,bars:1,tailSeconds:0,settleMs:250,latencyMs:0};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve};}
async function turns(){for(let index=0;index<12;index++)await Promise.resolve();}

describe('independent track recorder lifecycle review',()=>{
  afterEach(()=>vi.useRealTimers());
  it('late permission from a cancelled engine never clears or stops a replacement engine',async()=>{
    vi.useFakeTimers();
    const oldPermission=deferred<boolean>();
    const events:number[][]=[];
    const midi={isConnected:()=>true,send:(bytes:number[])=>events.push(bytes),clear:()=>events.push([-1])};
    const oldDispose=vi.fn(async()=>{});
    const old=new StemCaptureEngine({midi,createCapture:()=>({enableInput:()=>oldPermission.promise,start:vi.fn(),stop:async()=>{},dispose:oldDispose,clockSnapshot:()=>({audioTime:0,sampleRate:48000,performanceTime:0})})});
    const oldRun=old.run(settings,'input');await turns();
    await old.cancel();
    let replacementCallbacks!:StemCaptureCallbacks;
    const replacement=new StemCaptureEngine({midi,createCapture:callbacks=>{replacementCallbacks=callbacks;return{enableInput:async()=>true,start:()=>replacementCallbacks.onStatus({state:'recording',elapsedFrames:128,sampleRate:48000,channels:2}),stop:async()=>{},dispose:async()=>{},clockSnapshot:()=>({audioTime:0,sampleRate:48000,performanceTime:performance.now()})};}});
    const replacementRun=replacement.run(settings,'input');await turns();
    await vi.advanceTimersByTimeAsync(300);
    const before=events.map(bytes=>[...bytes]);
    expect(before.some(bytes=>bytes[0]===0xfa)).toBe(true);
    oldPermission.resolve(true);await turns();await oldRun;
    expect(events).toEqual(before);
    expect(oldDispose).toHaveBeenCalled();
    await replacement.cancel();await replacementRun;
  });
  it('opening an input then cancelling before readiness sends no hardware commands',async()=>{
    vi.useFakeTimers();
    const send=vi.fn(),clear=vi.fn();
    const engine=new StemCaptureEngine({midi:{isConnected:()=>true,send,clear},createCapture:()=>({enableInput:async()=>true,start:()=>{},stop:async()=>{},dispose:async()=>{},clockSnapshot:()=>({audioTime:0,sampleRate:48000,performanceTime:0})})});
    const run=engine.run(settings,'input');await turns();await engine.cancel();await run;
    expect(send).not.toHaveBeenCalled();expect(clear).not.toHaveBeenCalled();
  });
  it('positive input delay crops later and retains a full musical window after a capture guard',async()=>{
    vi.useFakeTimers();vi.setSystemTime(0);
    let callbacks!:StemCaptureCallbacks;
    let stoppedAt=0;
    const results:Array<{take:{frames:number;sourceStartFrame?:number;audioBuffer:AudioBuffer}}>=[];
    const errors:string[]=[];
    const engine=new StemCaptureEngine({now:()=>Date.now(),midi:{isConnected:()=>true,send:()=>{},clear:()=>{}},allocate:(channels,length,rate)=>new AudioContext().createBuffer(channels,length,rate),onResult:result=>results.push(result),onError:error=>errors.push(error),createCapture:value=>{
      callbacks=value;
      return{enableInput:async()=>true,start:()=>callbacks.onStatus({state:'recording',elapsedFrames:128,sampleRate:8000,channels:1}),clockSnapshot:()=>({audioTime:Date.now()/1000,sampleRate:8000,performanceTime:Date.now()}),stop:async()=>{
        stoppedAt=Date.now();const frames=stoppedAt*8;
        const audioBuffer=new AudioContext().createBuffer(1,frames,8000);
        audioBuffer.copyToChannel(Float32Array.from({length:frames},(_,frame)=>frame/8000),0);
        callbacks.onTake({id:'timed',audioBuffer,frames,sampleRate:8000,channels:1,actualPreRollFrames:0,completionReason:'manual',sourceStartFrame:0,sourceEndFrame:frames});
      },dispose:async()=>{}};
    }});
    const run=engine.run({...settings,latencyMs:100},'input');
    await vi.advanceTimersByTimeAsync(5000);await run;
    expect(errors).toEqual([]);expect(results).toHaveLength(1);
    expect(stoppedAt).toBeGreaterThanOrEqual(3000);
    expect(results[0].take.frames).toBe(16000);
    expect(results[0].take.sourceStartFrame).toBe(4000);
    expect(results[0].take.audioBuffer.getChannelData(0)[0]).toBeCloseTo(.5);
  });

  it('an input error after START immediately clears transport and unmutes all tracks',async()=>{
    vi.useFakeTimers();vi.setSystemTime(0);
    let callbacks!:StemCaptureCallbacks;
    const events:number[][]=[];const disposal=deferred<void>();
    const engine=new StemCaptureEngine({now:()=>Date.now(),midi:{isConnected:()=>true,send:bytes=>events.push(bytes),clear:()=>events.push([-1])},createCapture:value=>{
      callbacks=value;
      return{enableInput:async()=>true,start:()=>callbacks.onStatus({state:'recording',elapsedFrames:128,sampleRate:48000,channels:2}),stop:async()=>{},dispose:()=>disposal.promise,clockSnapshot:()=>({audioTime:Date.now()/1000,sampleRate:48000,performanceTime:Date.now()})};
    }});
    const run=engine.run(settings,'input');await vi.advanceTimersByTimeAsync(450);
    expect(events.some(bytes=>bytes[0]===0xfa)).toBe(true);
    callbacks.onError('Input was unplugged');await turns();const beforeDisposal=events.map(bytes=>[...bytes]);disposal.resolve();await run;
    expect(beforeDisposal.slice(-10)).toEqual([[-1],[0xfc],...Array.from({length:8},(_,channel)=>[0xb0+channel,9,0])]);
  });
  it('each sequential track receives its own cleanup',async()=>{
    vi.useFakeTimers();vi.setSystemTime(0);
    const events:number[][]=[];const results:number[]=[];
    const engine=new StemCaptureEngine({now:()=>Date.now(),midi:{isConnected:()=>true,send:bytes=>events.push(bytes),clear:()=>events.push([-1])},allocate:(channels,length,rate)=>new AudioContext().createBuffer(channels,length,rate),onResult:result=>results.push(result.track),createCapture:callbacks=>({
      enableInput:async()=>true,start:()=>callbacks.onStatus({state:'recording',elapsedFrames:128,sampleRate:8000,channels:1}),clockSnapshot:()=>({audioTime:Date.now()/1000,sampleRate:8000,performanceTime:Date.now()}),dispose:async()=>{},stop:async()=>{
        const frames=Date.now()*8;const audioBuffer=new AudioContext().createBuffer(1,frames,8000);
        callbacks.onTake({id:'track',audioBuffer,frames,sampleRate:8000,channels:1,actualPreRollFrames:0,completionReason:'manual',sourceStartFrame:0,sourceEndFrame:frames});
      },
    })});
    const run=engine.run({...settings,tracks:[1,2]},'input');await vi.advanceTimersByTimeAsync(10000);await run;
    expect(results).toEqual([1,2]);expect(events.filter(bytes=>bytes[0]===-1)).toHaveLength(2);
  });

});
