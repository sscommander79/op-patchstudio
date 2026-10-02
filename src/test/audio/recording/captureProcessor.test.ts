import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Posted {message:Record<string,unknown>;transfer?:Transferable[]}
class FakePort {
  onmessage:((event:MessageEvent<{type:string}>)=>void)|null=null;
  posted:Posted[]=[];
  postMessage(message:Record<string,unknown>,transfer?:Transferable[]){this.posted.push({message,transfer})}
  close=vi.fn();
}
type ProcessorInstance={port:FakePort;process:(inputs:Float32Array[][],outputs:Float32Array[][])=>boolean};
type ProcessorConstructor=new(options?:{processorOptions?:Record<string,unknown>})=>ProcessorInstance;
let Registered:ProcessorConstructor;

function setCurrentFrame(frame:number){Object.defineProperty(globalThis,'currentFrame',{value:frame,writable:true,configurable:true});}
function processAt(processor:ProcessorInstance,frame:number,input:Float32Array[]){setCurrentFrame(frame);processor.process([input],[[new Float32Array(128)]]);}
function errors(processor:ProcessorInstance){return processor.port.posted.filter(item=>item.message.type==='error').map(item=>item.message.message);}

async function loadProcessor(){
  vi.resetModules();
  class Base {port=new FakePort()}
  Object.defineProperty(globalThis,'AudioWorkletProcessor',{value:Base,configurable:true});
  Object.defineProperty(globalThis,'sampleRate',{value:48_000,configurable:true});
  Object.defineProperty(globalThis,'currentFrame',{value:0,writable:true,configurable:true});
  Object.defineProperty(globalThis,'registerProcessor',{value:(_name:string,ctor:ProcessorConstructor)=>{Registered=ctor},configurable:true});
  await import('../../../audio/recording/captureProcessor');
}

describe('bundled capture processor',()=>{
  beforeEach(loadProcessor);

  it.each([
    {reported:1,delivered:2},
    {reported:2,delivered:1},
  ])('records the delivered $delivered channels when the device reports $reported',({reported,delivered})=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:reported,maxSeconds:1}});
    const input=delivered===1?[new Float32Array(128).fill(.25)]:[new Float32Array(128).fill(.25),new Float32Array(128).fill(-.5)];
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);
    processAt(processor,0,input);
    processor.port.onmessage?.({data:{type:'stop'}} as MessageEvent<{type:string}>);
    expect(errors(processor)).toEqual([]);
    expect(processor.port.posted.find(item=>item.message.type==='format')?.message).toMatchObject({channels:delivered,sampleRate:48_000});
    const take=processor.port.posted.find(item=>item.message.type==='take')?.message.take as {frames:number;channels:Float32Array[]}|undefined;
    expect(take?.frames).toBe(128);
    expect(take?.channels).toHaveLength(delivered);
    expect(Array.from(take!.channels[0].subarray(0,128))).toEqual(Array(128).fill(.25));
    if(delivered===2)expect(Array.from(take!.channels[1].subarray(0,128))).toEqual(Array(128).fill(-.5));
  });

  it.each([{initial:1,later:2},{initial:2,later:1}])('rejects a channel change from $initial to $later after the initial format is established',({initial,later})=>{
    const processor=new Registered({processorOptions:{mode:'manual',maxSeconds:1}}),input=new Float32Array(128);
    processAt(processor,0,Array(initial).fill(input));
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);
    processAt(processor,128,Array(later).fill(input));
    expect(errors(processor)).toEqual(['Capture channel dimensions changed']);
    expect(processor.port.posted.filter(item=>item.message.type==='take')).toHaveLength(0);
  });

  it('preserves Arm before the first stereo block and seals both channels',()=>{
    const processor=new Registered({processorOptions:{mode:'sound',channels:1,maxSeconds:1,preRollSeconds:0,silenceSeconds:.1,thresholdDb:-20}});
    const left=new Float32Array(4_801),right=new Float32Array(4_801);left[0]=.75;right[0]=-.25;
    processor.port.onmessage?.({data:{type:'arm'}} as MessageEvent<{type:string}>);
    processAt(processor,0,[left,right]);
    expect(errors(processor)).toEqual([]);
    const take=processor.port.posted.find(item=>item.message.type==='take')?.message.take as {frames:number;channels:Float32Array[]}|undefined;
    expect(take?.frames).toBe(4_801);
    expect(Array.from(take!.channels[0].subarray(0,4_801))).toEqual([.75,...Array(4_800).fill(0)]);
    expect(Array.from(take!.channels[1].subarray(0,4_801))).toEqual([-.25,...Array(4_800).fill(0)]);
  });

  it('rejects an unsupported delivered channel layout before advertising a usable format',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),input=new Float32Array(128);
    processAt(processor,0,[input,input,input]);
    processAt(processor,128,[input,input,input]);
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);
    processAt(processor,256,[input]);
    expect(errors(processor)).toEqual([expect.stringMatching(/mono or stereo/i)]);
    expect(processor.port.posted.filter(item=>item.message.type==='format'||item.message.type==='take')).toHaveLength(0);
  });

  it('zeros its output and reports one visible error after the bounded setup grace',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),output=new Float32Array(128).fill(.75);
    for(let block=0;block<189;block+=1)processor.process([[]],[[output]]);
    expect(Array.from(output)).toEqual(Array(128).fill(0));
    const errors=processor.port.posted.filter(item=>item.message.type==='error');expect(errors).toHaveLength(1);expect(errors[0].message.message).toMatch(/no audio frames/i);
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);
    processAt(processor,189*128,[new Float32Array(128).fill(.5)]);
    expect(processor.port.posted.filter(item=>item.message.type==='error')).toHaveLength(1);
    expect(processor.port.posted.filter(item=>item.message.type==='format'||item.message.type==='take')).toHaveLength(0);
  });

  it('aborts an active take on its first missing input quantum',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}});
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);
    processor.process([[]],[[new Float32Array(128)]]);
    expect(processor.port.posted.find(item=>item.message.type==='error')?.message.message).toMatch(/interrupted/i);
  });

  it('starts at the first recovered frame after an observed idle monitoring gap',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),valid=new Float32Array(128).fill(.25);
    processAt(processor,0,[valid]);
    for(const frame of [128,256,384,512])processAt(processor,frame,[]);
    setCurrentFrame(640);processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);processAt(processor,640,[valid]);
    processor.port.onmessage?.({data:{type:'stop'}} as MessageEvent<{type:string}>);
    const take=processor.port.posted.find(item=>item.message.type==='take')?.message.take as {startFrame:number;frames:number}|undefined;
    expect(errors(processor)).toEqual([]);expect(take).toMatchObject({startFrame:640,frames:128});
  });

  it('resumes pure monitoring after an observed gap and remains idle',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),quiet=new Float32Array(128).fill(.01);
    processAt(processor,0,[quiet]);processAt(processor,128,[]);processAt(processor,640,[quiet]);processAt(processor,768,[quiet]);
    expect(errors(processor)).toEqual([]);expect(processor.port.posted.filter(item=>item.message.type==='take')).toHaveLength(0);
  });

  it('still rejects an observed gap while armed',()=>{
    const processor=new Registered({processorOptions:{mode:'sound',maxSeconds:1}});
    processor.port.onmessage?.({data:{type:'arm'}} as MessageEvent<{type:string}>);processAt(processor,0,[]);
    expect(errors(processor)).toEqual(['Audio input was interrupted during capture.']);
  });

  it('still rejects an observed gap while waiting for quiet',()=>{
    const processor=new Registered({processorOptions:{mode:'sound',channels:1,maxSeconds:1,preRollSeconds:0,silenceSeconds:.1,thresholdDb:-20}}),trigger=new Float32Array(4_801);trigger[0]=.5;
    processor.port.onmessage?.({data:{type:'arm'}} as MessageEvent<{type:string}>);processAt(processor,0,[trigger]);processAt(processor,4_801,[]);
    expect(processor.port.posted.some(item=>item.message.type==='take')).toBe(true);expect(errors(processor)).toEqual(['Audio input was interrupted during capture.']);
  });

  it('still rejects an unseen frame jump with no observed empty callback',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),valid=new Float32Array(128);
    processAt(processor,0,[valid]);processAt(processor,640,[valid]);
    expect(errors(processor)).toEqual(['Capture frame discontinuity: expected 128, received 640']);
  });

  it('anchors Start before the first delivered input to that first frame',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),valid=new Float32Array(128).fill(.25);
    setCurrentFrame(640);processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);processAt(processor,640,[valid]);processor.port.onmessage?.({data:{type:'stop'}} as MessageEvent<{type:string}>);
    const take=processor.port.posted.find(item=>item.message.type==='take')?.message.take as {startFrame:number}|undefined;
    expect(errors(processor)).toEqual([]);expect(take?.startFrame).toBe(640);
  });

  it('rejects an empty callback after Start before the format is known',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',maxSeconds:1}});
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);processAt(processor,0,[]);
    expect(errors(processor)).toEqual(['Audio input was interrupted during capture.']);
  });

  it('stops cleanly during an observed idle monitoring gap',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),valid=new Float32Array(128);
    processAt(processor,0,[valid]);processAt(processor,128,[]);setCurrentFrame(256);processor.port.onmessage?.({data:{type:'stop'}} as MessageEvent<{type:string}>);
    expect(errors(processor)).toEqual([]);expect(processor.port.posted.filter(item=>item.message.type==='take')).toHaveLength(0);expect(processor.port.posted.at(-1)?.message.type).toBe('stopped');
  });

  it('hands off the full owned buffer before stopped without slicing in the audio callback',()=>{
    const processor=new Registered({processorOptions:{mode:'manual',channels:1,maxSeconds:1}}),input=Float32Array.from({length:128},(_,index)=>index?Math.fround(index/256):0);
    processor.port.onmessage?.({data:{type:'start'}} as MessageEvent<{type:string}>);processor.process([[input]],[[new Float32Array(128)]]);processor.port.onmessage?.({data:{type:'stop'}} as MessageEvent<{type:string}>);
    const takeIndex=processor.port.posted.findIndex(item=>item.message.type==='take'),stoppedIndex=processor.port.posted.findIndex(item=>item.message.type==='stopped');
    expect(takeIndex).toBeGreaterThanOrEqual(0);expect(stoppedIndex).toBeGreaterThan(takeIndex);
    const take=processor.port.posted[takeIndex].message.take as {frames:number;channels:Float32Array[]};expect(take.frames).toBe(128);expect(take.channels[0].length).toBe(48_000);
    expect(processor.port.posted[takeIndex].transfer).toEqual([take.channels[0].buffer]);
  });
});
