import type {CaptureStatus,SessionTake} from './captureSession';

export const AUTO_SAMPLE_LIMITS={notes:24,captureSeconds:20} as const;

export interface AutoSampleSettings {
  startNote:number;endNote:number;step:number;velocity:number;channel:number;
  holdSeconds:number;tailSeconds:number;settleSeconds:number;readinessTimeoutSeconds:number;
}
export interface AutoCaptureCallbacks {onStatus:(status:CaptureStatus)=>void;onTake:(take:SessionTake)=>void;onError:(message:string)=>void}
export interface AutoCapture {enableInput:(deviceId:string)=>Promise<boolean>;start:()=>void;stop:()=>Promise<void>;dispose:()=>Promise<void>}
export interface AutoSampleMidiOutput {isConnected:()=>boolean;noteOn:(note:number,velocity:number,channel:number)=>void;noteOff:(note:number,channel:number)=>void}
export interface AutoSampleResult {take:SessionTake;rootNote:number;selected:boolean;warnings:string[]}
interface Dependencies {
  createCapture:(callbacks:AutoCaptureCallbacks)=>AutoCapture;
  midi:AutoSampleMidiOutput;
  sleep?:(ms:number)=>Promise<void>;
  onTake?:(result:AutoSampleResult)=>void;
  onProgress?:(completed:number,total:number,note:number)=>void;
  onError?:(message:string)=>void;
}

function integer(name:string,value:number,min:number,max:number){if(!Number.isFinite(value)||!Number.isInteger(value)||value<min||value>max)throw new Error(`${name} must be a whole number from ${min} to ${max}.`);}
function seconds(name:string,value:number,min=0){if(!Number.isFinite(value)||value<min)throw new Error(`${name} must be at least ${min} seconds.`);}
export function noteSequence(settings:Pick<AutoSampleSettings,'startNote'|'endNote'|'step'>){
  integer('Start note',settings.startNote,0,127);integer('End note',settings.endNote,0,127);integer('Step',settings.step,1,127);if(settings.startNote>settings.endNote)throw new Error('The note range must run from a lower note to a higher note.');
  const notes:number[]=[];for(let note=settings.startNote;note<=settings.endNote&&notes.length<=AUTO_SAMPLE_LIMITS.notes;note+=settings.step)notes.push(note);return notes;
}
export function validateAutoSampleSettings(settings:AutoSampleSettings){
  integer('Start note',settings.startNote,0,127);integer('End note',settings.endNote,0,127);integer('Step',settings.step,1,127);integer('Velocity',settings.velocity,1,127);integer('Channel',settings.channel,1,16);
  if(settings.startNote>settings.endNote)throw new Error('The note range must run from a lower note to a higher note.');
  seconds('Hold time',settings.holdSeconds);seconds('Release tail',settings.tailSeconds);seconds('Settling time',settings.settleSeconds);seconds('Readiness timeout',settings.readinessTimeoutSeconds,.1);
  const notes=noteSequence(settings);if(notes.length>AUTO_SAMPLE_LIMITS.notes)throw new Error(`Automatic capture is limited to ${AUTO_SAMPLE_LIMITS.notes} notes.`);
  if(settings.readinessTimeoutSeconds+settings.holdSeconds+settings.tailSeconds>AUTO_SAMPLE_LIMITS.captureSeconds)throw new Error('Readiness, hold and release tail must fit within the 20 seconds allowed for one capture.');
  return notes;
}

function inspectTake(take:SessionTake){let peak=0,clipped=0,total=0;for(let channel=0;channel<take.audioBuffer.numberOfChannels;channel+=1){const data=take.audioBuffer.getChannelData(channel);for(let frame=0;frame<take.frames;frame+=1){const value=Math.abs(data[frame]||0);peak=Math.max(peak,value);if(value>=.999)clipped+=1;total+=1;}}
  const warnings:string[]=[];if(peak<.001)warnings.push('Capture appears silent.');if(total>0&&clipped/total>=.01)warnings.push('Capture appears clipped.');return warnings;
}
function abortError(){return new DOMException('Automatic capture stopped.','AbortError');}

export class AutoSampler {
  private generation=0;
  private active?:{capture:AutoCapture;note?:number;channel:number};
  private runState?:{generation:number;abort:AbortController};
  private readonly deps:Dependencies;
  constructor(deps:Dependencies){this.deps=deps;}

  async run(settings:AutoSampleSettings,deviceId:string,onlyNote?:number){
    if(this.runState){this.deps.onError?.('Automatic capture is already running.');return;}
    const notes=onlyNote===undefined?validateAutoSampleSettings(settings):[onlyNote];if(onlyNote!==undefined){validateAutoSampleSettings({...settings,startNote:onlyNote,endNote:onlyNote});}
    const generation=++this.generation,runState={generation,abort:new AbortController()};this.runState=runState;
    try {
      for(let index=0;index<notes.length;index+=1){if(generation!==this.generation)throw abortError();const note=notes[index];const result=await this.captureNote(generation,note,settings,deviceId);if(generation!==this.generation)throw abortError();this.deps.onTake?.(result);this.deps.onProgress?.(index+1,notes.length,note);if(index<notes.length-1)await this.wait(settings.settleSeconds*1000,generation);}
    } catch(reason) {if(!(reason instanceof DOMException&&reason.name==='AbortError'))this.deps.onError?.(reason instanceof Error?reason.message:String(reason));}finally{if(this.runState===runState)this.runState=undefined;}
  }

  async cancel(){++this.generation;this.runState?.abort.abort();await this.cleanupActive();}
  outputDisconnected(){void this.cancel();}

  private async captureNote(generation:number,note:number,settings:AutoSampleSettings,deviceId:string):Promise<AutoSampleResult>{
    let candidate:SessionTake|undefined,captureError:string|undefined,readyResolve:(()=>void)|undefined;
    const ready=new Promise<void>(resolve=>{readyResolve=resolve});
    const capture=this.deps.createCapture({onStatus:status=>{if(generation===this.generation&&(status.elapsedFrames??0)>0)readyResolve?.();},onTake:take=>{if(generation===this.generation)candidate=take;},onError:message=>{if(generation!==this.generation)return;captureError=message;this.deps.onError?.(message);void this.cancel();}});
    this.active={capture,channel:settings.channel};
    try {
      if(!await capture.enableInput(deviceId))throw new Error('Audio input could not be enabled. Check permission and the selected device, then retry.');
      this.assertCurrent(generation);capture.start();
      await this.withTimeout(ready,settings.readinessTimeoutSeconds*1000,'No captured audio frames arrived before the readiness timeout.',generation);
      if(!this.deps.midi.isConnected())throw new Error('The selected MIDI output disconnected. Reconnect it, then retry.');
      this.deps.midi.noteOn(note,settings.velocity,settings.channel);this.active.note=note;
      await this.wait(settings.holdSeconds*1000,generation);
      this.releaseOwnedNote();
      await this.wait(settings.tailSeconds*1000,generation);
      await capture.stop();this.assertCurrent(generation);
      if(captureError)throw new Error(captureError);
      if(!candidate)throw new Error(`MIDI note ${note} did not produce a complete take.`);
      if(candidate.completionReason==='length')throw new Error(`MIDI note ${note} capture ended before its intended release tail.`);
      const warnings=inspectTake(candidate);return{take:candidate,rootNote:note,selected:warnings.length===0,warnings};
    } finally {this.releaseOwnedNote();await capture.dispose().catch(()=>undefined);if(this.active?.capture===capture)this.active=undefined;}
  }

  private assertCurrent(generation:number){if(generation!==this.generation)throw abortError();}
  private abortPromise(generation:number){const signal=this.runState?.generation===generation?this.runState.abort.signal:undefined;return new Promise<never>((_,reject)=>{if(!signal||signal.aborted){reject(abortError());return;}signal.addEventListener('abort',()=>reject(abortError()),{once:true});});}
  private async wait(ms:number,generation:number){if(ms>0)await Promise.race([(this.deps.sleep??(value=>new Promise(resolve=>window.setTimeout(resolve,value))))(ms),this.abortPromise(generation)]);this.assertCurrent(generation);}
  private async withTimeout(operation:Promise<void>,ms:number,message:string,generation:number){let timer:number|undefined;try{await Promise.race([operation,this.abortPromise(generation),new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(new Error(message)),ms);})]);this.assertCurrent(generation);}finally{if(timer!==undefined)window.clearTimeout(timer);}}
  private releaseOwnedNote(){const owned=this.active;if(owned?.note===undefined)return;const note=owned.note;owned.note=undefined;try{this.deps.midi.noteOff(note,owned.channel);}catch{/* disconnected output */}}
  private async cleanupActive(){const owned=this.active;this.releaseOwnedNote();await owned?.capture.dispose().catch(()=>undefined);if(this.active===owned)this.active=undefined;}
}
