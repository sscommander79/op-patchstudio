import {describe,expect,it,vi} from 'vitest';
import {AutoSampler,noteSequence,validateAutoSampleSettings,type AutoCapture,type AutoCaptureCallbacks,type AutoSampleMidiOutput,type AutoSampleResult} from '../../../audio/recording/autoSampler';
import type {SessionTake} from '../../../audio/recording/captureSession';

const buffer=()=>new AudioContext().createBuffer(1,4,8_000);
const take=(reason:'manual'|'length'='manual',values=[.25,-.25,.25,-.25]):SessionTake=>{const audioBuffer=buffer();audioBuffer.copyToChannel(Float32Array.from(values),0);return{id:crypto.randomUUID(),audioBuffer,frames:4,sampleRate:8_000,channels:1,actualPreRollFrames:0,completionReason:reason};};
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve};};

function rig(){
  const events:string[]=[],callbacks:AutoCaptureCallbacks[]=[],captures:AutoCapture[]=[];
  const midi:AutoSampleMidiOutput={isConnected:()=>true,noteOn:(note,velocity,channel)=>events.push(`on:${channel}:${note}:${velocity}`),noteOff:(note,channel)=>events.push(`off:${channel}:${note}`)};
  const createCapture=(cb:AutoCaptureCallbacks):AutoCapture=>{callbacks.push(cb);const capture={enableInput:vi.fn(async()=>true),start:vi.fn(()=>{events.push('start');}),stop:vi.fn(async()=>{events.push('stop');}),dispose:vi.fn(async()=>{events.push('dispose');})};captures.push(capture);return capture;};
  return{events,callbacks,captures,midi,createCapture};
}
const settings={startNote:48,endNote:54,step:6,velocity:100,channel:2,holdSeconds:1,tailSeconds:1,settleSeconds:.25,readinessTimeoutSeconds:2};

describe('AutoSampler',()=>{
  it('invalidates a capture whose audio permission resolves after cancellation',async()=>{
    const r=rig(),permission=deferred<boolean>();r.createCapture=cb=>{r.callbacks.push(cb);const capture:AutoCapture={enableInput:vi.fn(()=>permission.promise),start:vi.fn(),stop:vi.fn(async()=>{}),dispose:vi.fn(async()=>{})};r.captures.push(capture);return capture;};const sampler=new AutoSampler(r);const running=sampler.run({...settings,endNote:48},'audio');await vi.waitFor(()=>expect(r.captures).toHaveLength(1));await sampler.cancel();permission.resolve(true);await running;expect(r.captures[0].start).not.toHaveBeenCalled();expect(r.events).toEqual([]);
  });
  it('waits for captured frames, releases the note before sealing, and advances only after the take arrives',async()=>{
    const r=rig(),sleeps:Array<{ms:number;release:()=>void}>=[];
    const sampler=new AutoSampler({...r,sleep:ms=>new Promise<void>(resolve=>sleeps.push({ms,release:resolve}))});
    const running=sampler.run(settings,'audio');await vi.waitFor(()=>expect(r.callbacks).toHaveLength(1));
    expect(r.events).toEqual(['start']);r.callbacks[0].onStatus({state:'recording',elapsedFrames:0});expect(r.events).toEqual(['start']);
    r.callbacks[0].onStatus({state:'recording',elapsedFrames:128});await vi.waitFor(()=>expect(r.events).toContain('on:2:48:100'));
    expect(sleeps[0].ms).toBe(1000);sleeps[0].release();await vi.waitFor(()=>expect(r.events).toContain('off:2:48'));
    expect(sleeps[1].ms).toBe(1000);r.callbacks[0].onTake(take());sleeps[1].release();await vi.waitFor(()=>expect(r.events).toContain('stop'));
    await vi.waitFor(()=>expect(sleeps).toHaveLength(3));expect(sleeps[2].ms).toBe(250);sleeps[2].release();await vi.waitFor(()=>expect(r.callbacks).toHaveLength(2));
    expect(r.events.indexOf('off:2:48')).toBeLessThan(r.events.indexOf('stop'));expect(r.events.filter(x=>x==='start')).toHaveLength(2);
    sampler.cancel();await running;
  });

  it('sends note-off for its owned note when cancelled during hold and never publishes the partial take',async()=>{
    const r=rig(),hold=deferred<void>(),published:SessionTake[]=[];
    const sampler=new AutoSampler({...r,sleep:()=>hold.promise,onTake:result=>published.push(result.take)});
    const running=sampler.run({...settings,endNote:48},'audio');await vi.waitFor(()=>expect(r.callbacks).toHaveLength(1));r.callbacks[0].onStatus({state:'recording',elapsedFrames:1});await vi.waitFor(()=>expect(r.events).toContain('on:2:48:100'));
    r.callbacks[0].onTake(take());await sampler.cancel();hold.resolve();await running;
    expect(r.events).toContain('off:2:48');expect(published).toEqual([]);expect(r.captures[0].dispose).toHaveBeenCalled();
  });

  it('does not send a second note-off or publish a take when cancelled during release tail',async()=>{
    const r=rig(),hold=deferred<void>(),tail=deferred<void>(),published:AutoSampleResult[]=[];let calls=0;const sampler=new AutoSampler({...r,sleep:()=>++calls===1?hold.promise:tail.promise,onTake:value=>published.push(value)});const running=sampler.run({...settings,endNote:48},'audio');await vi.waitFor(()=>expect(r.callbacks).toHaveLength(1));r.callbacks[0].onStatus({state:'recording',elapsedFrames:1});await vi.waitFor(()=>expect(r.events).toContain('on:2:48:100'));hold.resolve();await vi.waitFor(()=>expect(r.events).toContain('off:2:48'));r.callbacks[0].onTake(take());await sampler.cancel();tail.resolve();await running;expect(r.events.filter(value=>value==='off:2:48')).toHaveLength(1);expect(published).toEqual([]);
  });

  it('rejects a missing take and an early maximum-length take without publishing either',async()=>{
    for(const kind of ['missing','length'] as const){const r=rig(),errors:string[]=[];const sampler=new AutoSampler({...r,sleep:async()=>{},onError:value=>errors.push(value)});const running=sampler.run({...settings,endNote:48,holdSeconds:0,tailSeconds:0,settleSeconds:0},'audio');await vi.waitFor(()=>expect(r.callbacks).toHaveLength(1));r.callbacks[0].onStatus({state:'recording',elapsedFrames:1});if(kind==='length')r.callbacks[0].onTake(take('length'));await running;expect(errors.join(' ')).toMatch(kind==='missing'?/did not produce/i:/ended before/i);}
  });

  it('stops on output disconnect and releases only the note it owns',async()=>{
    const r=rig(),hold=deferred<void>();let connected=true;r.midi.isConnected=()=>connected;const sampler=new AutoSampler({...r,sleep:()=>hold.promise});const running=sampler.run({...settings,endNote:48},'audio');await vi.waitFor(()=>expect(r.callbacks).toHaveLength(1));r.callbacks[0].onStatus({state:'recording',elapsedFrames:1});await vi.waitFor(()=>expect(r.events).toContain('on:2:48:100'));connected=false;sampler.outputDisconnected();hold.resolve();await running;expect(r.events.filter(x=>x.startsWith('off:'))).toEqual(['off:2:48']);
  });

  it('releases its owned note immediately when the capture processor errors',async()=>{
    const r=rig(),hold=deferred<void>(),errors:string[]=[];const sampler=new AutoSampler({...r,sleep:()=>hold.promise,onError:value=>errors.push(value)});const running=sampler.run({...settings,endNote:48},'audio');await vi.waitFor(()=>expect(r.callbacks).toHaveLength(1));r.callbacks[0].onStatus({state:'recording',elapsedFrames:1});await vi.waitFor(()=>expect(r.events).toContain('on:2:48:100'));r.callbacks[0].onError('Capture processor failed.');await vi.waitFor(()=>expect(r.events).toContain('off:2:48'));expect(errors).toEqual(['Capture processor failed.']);hold.resolve();await running;
  });

  it('marks silent and clipped takes unselected while preserving authoritative roots',async()=>{
    const r=rig(),results:Array<{rootNote:number;selected:boolean;warnings:string[]}>=[];const sampler=new AutoSampler({...r,sleep:async()=>{},onTake:value=>results.push(value)});const running=sampler.run({...settings,startNote:60,endNote:66,holdSeconds:0,tailSeconds:0,settleSeconds:0},'audio');
    for(let index=0;index<2;index+=1){await vi.waitFor(()=>expect(r.callbacks).toHaveLength(index+1));r.callbacks[index].onStatus({state:'recording',elapsedFrames:1});r.callbacks[index].onTake(take('manual',index===0?[0,0,0,0]:[1,1,-1,-1]));}
    await running;expect(results.map(({rootNote,selected,warnings})=>({rootNote,selected,warnings:warnings.join(' ')}))).toEqual([{rootNote:60,selected:false,warnings:expect.stringMatching(/silent/i)},{rootNote:66,selected:false,warnings:expect.stringMatching(/clipp/i)}]);
  });
});

describe('validateAutoSampleSettings',()=>{
  it.each([0,-1,Number.NaN])('bounds note generation before looping for step %s',step=>expect(()=>noteSequence({...settings,step})).toThrow(/step/i));
  it.each([
    [{...settings,step:0},/step/i],[{...settings,startNote:72,endNote:48},/range/i],[{...settings,endNote:127,step:1},/24 notes/i],[{...settings,velocity:100.5},/velocity/i],[{...settings,holdSeconds:18,tailSeconds:1},/20 seconds/i],
  ])('rejects invalid or unsafe settings', (value,message)=>expect(()=>validateAutoSampleSettings(value)).toThrow(message));
});
