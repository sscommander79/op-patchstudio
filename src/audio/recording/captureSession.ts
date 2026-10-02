import type { CaptureOptions, CompletionReason } from './captureCore';

export const RECORDING_LIMITS={takes:32,ownedBytes:256*1024*1024,flushMs:500} as const;

export interface SessionTake {
  id:string; audioBuffer:AudioBuffer; frames:number; sampleRate:number; channels:number;
  actualPreRollFrames:number; completionReason:CompletionReason; sourceStartFrame?:number; sourceEndFrame?:number;
}

export interface CaptureClockSnapshot {audioTime:number;sampleRate:number;performanceTime:number}

export interface CaptureStatus {
  state:'idle'|'requesting-permission'|'monitoring'|'armed'|'recording'|'waiting-for-quiet'|'capacity-full'|'stopped'|'error'|'closed';
  sampleRate?:number; channels?:number; settingsReported?:boolean; elapsedFrames?:number; peaks?:number[];
}

interface CaptureSessionDependencies {
  mediaDevices:MediaDevices;
  createContext:(sampleRate?:number)=>AudioContext;
  createWorkletNode:(context:AudioContext,options:AudioWorkletNodeOptions)=>AudioWorkletNode;
  workletUrl:string;
  capture?:Omit<CaptureOptions,'sampleRate'|'channels'>;
  onStatus?:(status:CaptureStatus)=>void;
  onTake?:(take:SessionTake)=>void|Promise<void>;
  onError?:(message:string)=>void;
  getRetainedUsage?:()=>{count:number;bytes:number};
  setTimer?:(callback:()=>void,ms:number)=>number;
  clearTimer?:(timer:number)=>void;
}

interface ProcessorTakeMessage {
  type:'take';
  take:{frames:number;startFrame:number;endFrame:number;preRollFrames:number;reason:CompletionReason;sampleRate:number;channels:Float32Array[]};
}
type ProcessorMessage=ProcessorTakeMessage|{type:'stopped'}|{type:'error';message?:string}|{type:'format';channels:number;sampleRate:number}|{type:'meter';state:CaptureStatus['state'];recordedFrames:number;peaks:number[]};

interface SetupAttempt {
  generation:number;
  stream?:MediaStream;
  context?:AudioContext;
  source?:MediaStreamAudioSourceNode;
  node?:AudioWorkletNode;
  released:boolean;
}

export function captureErrorMessage(reason:unknown) {
  const name=reason instanceof DOMException?reason.name:(reason as {name?:string})?.name;
  if(name==='NotAllowedError')return 'Microphone permission was denied. Allow input access in the browser, then retry.';
  if(name==='NotFoundError')return 'No audio input was found. Connect an input or choose another device, then retry.';
  if(name==='NotReadableError')return 'The selected input is in use or unavailable. Close other audio apps or reconnect it.';
  if(name==='OverconstrainedError')return 'The selected device cannot provide a supported input. Choose a mono or stereo input.';
  return reason instanceof Error?reason.message:'Recording could not start. Check the input and retry.';
}

function stopTracks(stream:MediaStream|undefined) {stream?.getTracks().forEach(track=>track.stop());}

function errorIdentity(reason:unknown) {
  const error=reason as {name?:string;message?:string};
  const name=error?.name&&error.name!=='Error'?`${error.name}: `:'';
  return `${name}${error?.message||String(reason)}`;
}

export class CaptureSession {
  status:CaptureStatus={state:'idle'};
  private generation=0;
  private stream?:MediaStream;
  private track?:MediaStreamTrack;
  private context?:AudioContext;
  private source?:MediaStreamAudioSourceNode;
  private node?:AudioWorkletNode;
  private setupAttempt?:SetupAttempt;
  private stopOperation?:Promise<void>;
  private stopResolver?:()=>void;
  private forceStopResolver?:()=>void;
  private stopTimer?:number;
  private processorStopped=false;
  private pendingMaterializations=0;
  private flushTimedOut=false;
  private terminalError=false;
  private disposed=false;
  private readonly processorError=()=>{void this.fail('The capture processor stopped. Re-enable the input to continue.');};
  private readonly trackEnded=()=>{void this.fail('The selected input disconnected. Reconnect it, then re-enable input.');};
  private readonly contextState=()=>{if(this.context && this.context.state!=='running')void this.fail('Audio capture was interrupted. Re-enable the input to continue.');};

  private readonly deps:CaptureSessionDependencies;
  constructor(deps:CaptureSessionDependencies) {this.deps=deps;}

  async enumerateInputs() {
    if(!this.deps.mediaDevices?.enumerateDevices)return [];
    const generation=this.generation;
    const devices=await this.deps.mediaDevices.enumerateDevices();
    if(generation!==this.generation||this.disposed)return [];
    let ordinal=0;
    return devices.filter(device=>device.kind==='audioinput').map(device=>({deviceId:device.deviceId,label:device.label||`Input ${++ordinal}`}));
  }

  async enableInput(deviceId:string) {
    if(this.disposed)this.disposed=false;
    this.terminalError=false;
    const generation=++this.generation;
    const replacedStop=this.stopOperation;this.forceStopResolver?.();if(this.stopOperation===replacedStop)this.stopOperation=undefined;
    await this.releaseGraph(false);
    if(generation!==this.generation)return false;
    this.setStatus({state:'requesting-permission'});
    const attempt:SetupAttempt={generation,released:false};
    this.setupAttempt=attempt;
    let stream:MediaStream;
    try {
      stream=await this.deps.mediaDevices.getUserMedia({audio:{...(deviceId?{deviceId:{exact:deviceId}}:{}),echoCancellation:false,autoGainControl:false,noiseSuppression:false}});
    } catch(reason) {
      if(this.setupAttempt===attempt)this.setupAttempt=undefined;
      if(generation!==this.generation)return false;
      return this.reject(`Requesting audio input failed (${errorIdentity(reason)}). ${captureErrorMessage(reason)}`);
    }
    attempt.stream=stream;
    if(attempt.released){stopTracks(stream);attempt.stream=undefined;return false;}
    if(generation!==this.generation||this.disposed){await this.releaseSetupAttempt(attempt);return false;}
    const tracks=stream.getAudioTracks();
    if(tracks.length!==1){await this.releaseSetupAttempt(attempt);return this.reject('Choose a stream with exactly one audio input track.');}
    const track=tracks[0],settings=track.getSettings();
    const reportedRate=settings.sampleRate;
    const reportedChannels=settings.channelCount;
    if(reportedRate!==undefined&&(reportedRate<8_000||reportedRate>96_000)){await this.releaseSetupAttempt(attempt);return this.reject('The selected input sample rate is outside the supported 8–96 kHz range.');}
    if(reportedChannels!==undefined&&(reportedChannels<1||reportedChannels>2)){await this.releaseSetupAttempt(attempt);return this.reject('Choose a mono or stereo input. Multichannel capture is not yet supported.');}
    const retained=this.deps.getRetainedUsage?.()??{count:0,bytes:0};
    // The processor discovers the delivered layout, which may differ from track settings.
    const reservation=this.reservationBytes(reportedRate??48_000,2);
    if(retained.count>=RECORDING_LIMITS.takes||retained.bytes+reservation>RECORDING_LIMITS.ownedBytes){await this.releaseSetupAttempt(attempt);return this.reject('Recording capacity is full. Remove or add reviewed takes before enabling input.');}
    let context:AudioContext|undefined;
    let stage='creating the audio capture context';
    try {
      context=this.deps.createContext(reportedRate);
      attempt.context=context;
      if(context.sampleRate<8_000||context.sampleRate>96_000)throw new Error('The browser capture rate is outside the supported 8–96 kHz range.');
      if(reportedRate!==undefined&&context.sampleRate!==reportedRate)throw new Error(`The browser could not preserve the reported ${reportedRate} Hz input rate.`);
      if(retained.bytes+this.reservationBytes(context.sampleRate,2)>RECORDING_LIMITS.ownedBytes)throw new Error('Recording capacity is full. Remove or add reviewed takes before enabling input.');
      if(context.state==='running'){
        stage='suspending the audio capture context for graph setup';
        await context.suspend();
      }
      if(generation!==this.generation||this.disposed){await this.releaseSetupAttempt(attempt);return false;}
      stage='loading the local capture processor';
      await context.audioWorklet.addModule(this.deps.workletUrl);
      if(generation!==this.generation||this.disposed){await this.releaseSetupAttempt(attempt);return false;}
      stage='connecting the audio capture graph';
      const source=context.createMediaStreamSource(stream);
      const node=this.deps.createWorkletNode(context,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCountMode:'max',channelInterpretation:'discrete',
        processorOptions:{...(this.deps.capture??{mode:'manual'}),channels:reportedChannels}});
      attempt.source=source;attempt.node=node;
      const pendingMessages:ProcessorMessage[]=[];
      node.port.onmessage=event=>{pendingMessages.push(event.data);};
      source.connect(node); node.connect(context.destination);
      stage='resuming the connected audio capture graph';
      await context.resume();
      if(generation!==this.generation||this.disposed){await this.releaseSetupAttempt(attempt);return false;}
      if(this.setupAttempt===attempt)this.setupAttempt=undefined;
      attempt.stream=undefined;attempt.context=undefined;attempt.source=undefined;attempt.node=undefined;attempt.released=true;
      this.stream=stream;this.track=track;this.context=context;this.source=source;this.node=node;
      track.addEventListener('ended',this.trackEnded); node.addEventListener('processorerror',this.processorError); context.addEventListener('statechange',this.contextState);
      node.port.onmessage=event=>{void this.handleMessage(event.data,generation);};
      this.setStatus({state:'monitoring',sampleRate:context.sampleRate,channels:reportedChannels,settingsReported:reportedRate!==undefined});
      for(const message of pendingMessages){
        await this.handleMessage(message,generation);
        if(generation!==this.generation||this.disposed)return false;
      }
      return true;
    } catch(reason) {
      await this.releaseSetupAttempt(attempt);
      if(generation!==this.generation)return false;
      return this.reject(`${stage[0].toUpperCase()}${stage.slice(1)} failed (${errorIdentity(reason)}). ${captureErrorMessage(reason)}`);
    }
  }

  arm(){if(!this.node)throw new Error('Enable input before arming');this.node.port.postMessage({type:'arm'});this.setStatus({...this.status,state:'armed'});}
  start(){if(!this.node)throw new Error('Enable input before recording');this.node.port.postMessage({type:'start'});this.setStatus({...this.status,state:'recording'});}
  clockSnapshot():CaptureClockSnapshot {if(!this.context)throw new Error('Enable input before reading the capture clock');return{audioTime:this.context.currentTime,sampleRate:this.context.sampleRate,performanceTime:performance.now()};}

  stop():Promise<void> {
    if(this.stopOperation)return this.stopOperation;
    if(!this.node){
      const generation=++this.generation;
      this.forceStopResolver?.();
      const operation=(async()=>{await this.releaseGraph(false);if(generation===this.generation&&!this.disposed)this.setStatus({state:this.terminalError?'error':'stopped'});})();
      this.stopOperation=operation;
      void operation.finally(()=>{if(this.stopOperation===operation)this.stopOperation=undefined;});
      return operation;
    }
    const node=this.node;
    const generation=this.generation;
    const operation=(async()=>{
      await new Promise<void>(resolve=>{
      let finished=false; const done=(force=false)=>{if(finished||!force&&(!this.processorStopped||this.pendingMaterializations>0)&&!this.flushTimedOut)return;finished=true;this.stopResolver=undefined;this.forceStopResolver=undefined;resolve();};
      this.processorStopped=false;this.flushTimedOut=false;this.terminalError=false;this.stopResolver=done; node.port.postMessage({type:'stop'});
      this.forceStopResolver=()=>done(true);
      const set=this.deps.setTimer??window.setTimeout; this.stopTimer=set(()=>{if(generation!==this.generation||this.disposed)return;this.flushTimedOut=true;this.deps.onError?.('Recording stopped before the unfinished take could be sealed. The incomplete take was discarded.');done();},RECORDING_LIMITS.flushMs);
      });
      if(generation!==this.generation||this.disposed)return;
      ++this.generation;await this.releaseGraph(false);
      if(!this.disposed)this.setStatus({state:this.flushTimedOut||this.terminalError?'error':'stopped'});
    })();
    this.stopOperation=operation;
    void operation.finally(()=>{if(this.stopOperation===operation)this.stopOperation=undefined;});
    return operation;
  }

  async dispose() {if(this.disposed)return;this.disposed=true;const generation=++this.generation;this.forceStopResolver?.();await this.releaseGraph(true);if(generation===this.generation&&this.disposed)this.setStatus({state:'closed'});}

  private async handleMessage(data:ProcessorMessage,generation:number) {
    if(generation!==this.generation||this.disposed)return;
    if(data?.type==='stopped'){this.processorStopped=true;if(this.status.state==='capacity-full'){++this.generation;await this.releaseGraph(false);}this.stopResolver?.();return;}
    if(data?.type==='error'){await this.fail(data.message||'Capture processor failed');return;}
    if(data?.type==='format'){
      if(data.channels<1||data.channels>2||data.sampleRate!==this.context?.sampleRate){await this.fail('The input changed to an unsupported capture format.');return;}
      this.setStatus({...this.status,sampleRate:data.sampleRate,channels:data.channels});return;
    }
    if(data?.type==='meter'){
      this.setStatus({...this.status,state:data.state,elapsedFrames:data.recordedFrames,peaks:data.peaks});this.node?.port.postMessage({type:'ack-meter'});return;
    }
    if(data?.type==='take'){
      const take=data.take,channels=take?.channels;
      if(!Array.isArray(channels)||!Number.isInteger(take.frames)||take.frames<1||take.frames>channels[0]?.length||take.endFrame-take.startFrame!==take.frames||channels.length<1||channels.length>2) {
        await this.fail('The capture processor returned invalid take dimensions.');return;
      }
      const retained=this.deps.getRetainedUsage?.()??{count:0,bytes:0};
      const transferredBytes=channels.reduce((sum:number,channel:Float32Array)=>sum+channel.byteLength,0);
      const pcmBytes=take.frames*channels.length*4,storedBytes=24+pcmBytes;
      const ringBytes=Math.round((this.deps.capture?.preRollSeconds??.25)*take.sampleRate)*channels.length*4;
      const peakOwnedBytes=retained.bytes+ringBytes+transferredBytes+pcmBytes+2*storedBytes+transferredBytes;
      if(retained.count>=RECORDING_LIMITS.takes||!Number.isSafeInteger(peakOwnedBytes)||peakOwnedBytes>RECORDING_LIMITS.ownedBytes){
        await this.fail('Recording capacity is full. Remove or add reviewed takes before recording more.');return;
      }
      this.pendingMaterializations+=1;
      try {
        const audioBuffer=this.context!.createBuffer(channels.length,take.frames,take.sampleRate);
        channels.forEach((channel:Float32Array,index:number)=>audioBuffer.copyToChannel(channel.subarray(0,take.frames),index));
        const result:SessionTake={id:crypto.randomUUID(),audioBuffer,frames:take.frames,sampleRate:take.sampleRate,channels:channels.length,
          actualPreRollFrames:take.preRollFrames,completionReason:take.reason,sourceStartFrame:take.startFrame,sourceEndFrame:take.endFrame};
        await this.deps.onTake?.(result);
        if(generation===this.generation&&!this.disposed){
          const observed=this.deps.getRetainedUsage?.()??{count:retained.count+1,bytes:retained.bytes+pcmBytes+storedBytes};
          const after={count:Math.max(observed.count,retained.count+1),bytes:Math.max(observed.bytes,retained.bytes+pcmBytes+storedBytes)};
          if(after.count>=RECORDING_LIMITS.takes||after.bytes+this.reservationBytes(take.sampleRate,channels.length)>RECORDING_LIMITS.ownedBytes){
            this.setStatus({...this.status,state:'capacity-full'});this.node?.port.postMessage({type:'stop'});
          } else this.node?.port.postMessage({type:'ack-take'});
        }
      } catch(reason) {
        await this.fail(`Recorded take preparation failed: ${captureErrorMessage(reason)}`);
      } finally {
        this.pendingMaterializations=Math.max(0,this.pendingMaterializations-1);this.stopResolver?.();
      }
    }
  }

  private reject(message:string){this.setStatus({state:'error'});this.deps.onError?.(message);return false;}
  private async fail(message:string){this.terminalError=true;this.deps.onError?.(message);++this.generation;this.processorStopped=true;this.setStatus({state:'error'});this.forceStopResolver?.();await this.releaseGraph(true);}
  private setStatus(status:CaptureStatus){this.status=status;this.deps.onStatus?.(status);}
  private reservationBytes(rate:number,channels:number){const maxFrames=Math.floor((this.deps.capture?.maxSeconds??20)*rate),ringFrames=Math.round((this.deps.capture?.preRollSeconds??.25)*rate);
    const maxPcm=maxFrames*channels*4,ring=ringFrames*channels*4;return ring+5*maxPcm+48;}
  private async releaseGraph(closePort:boolean) {
    const clear=this.deps.clearTimer??window.clearTimeout;if(this.stopTimer){clear(this.stopTimer);this.stopTimer=undefined;}
    const attempt=this.setupAttempt,node=this.node,source=this.source,track=this.track,context=this.context,stream=this.stream;
    this.node=this.source=this.track=this.context=this.stream=undefined;
    const setupClosing=attempt?this.releaseSetupAttempt(attempt):undefined;
    if(track)track.removeEventListener('ended',this.trackEnded);if(node)node.removeEventListener('processorerror',this.processorError);if(context)context.removeEventListener('statechange',this.contextState);
    if(node){node.port.onmessage=null;if(closePort){try{node.port.postMessage({type:'close'});}catch{ /* already closed */ }}node.port.close();node.disconnect();}
    source?.disconnect();stopTracks(stream);const contextClosing=context?context.close().catch(()=>undefined):undefined;
    if(setupClosing&&contextClosing)await Promise.all([setupClosing,contextClosing]);else if(setupClosing)await setupClosing;else if(contextClosing)await contextClosing;
  }
  private async releaseSetupAttempt(attempt:SetupAttempt) {
    if(attempt.released)return;
    attempt.released=true;
    if(this.setupAttempt===attempt)this.setupAttempt=undefined;
    const stream=attempt.stream,context=attempt.context,source=attempt.source,node=attempt.node;
    attempt.stream=undefined;attempt.context=undefined;attempt.source=undefined;attempt.node=undefined;
    if(node){node.port.onmessage=null;try{node.port.postMessage({type:'close'});}catch{ /* already closed */ }node.port.close();node.disconnect();}
    source?.disconnect();
    stopTracks(stream);
    if(context)await context.close().catch(()=>undefined);
  }
}
