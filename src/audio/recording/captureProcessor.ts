import { CaptureCore, type CaptureOptions } from './captureCore';

declare const AudioWorkletProcessor: { new(options?:unknown): {port:MessagePort} };
declare const currentFrame: number;
declare const sampleRate: number;
declare function registerProcessor(name:string, ctor:unknown):void;

type ProcessorConfig = Omit<CaptureOptions, 'sampleRate' | 'channels'> & {channels?:number};

class OpPatchCaptureProcessor extends AudioWorkletProcessor {
  private core:CaptureCore|null=null;
  private requested:'monitoring'|'armed'|'recording'='monitoring';
  private readonly config:ProcessorConfig;
  private missingFrames=0;
  private failed=false;
  private formatSent=false;

  constructor(options?:{processorOptions?:ProcessorConfig}) {
    super();
    this.config=options?.processorOptions ?? {mode:'manual'};
    if(this.config.channels===1||this.config.channels===2)this.core=new CaptureCore({...this.config,sampleRate,channels:this.config.channels});
    this.port.onmessage=(event:MessageEvent<{type:string}>)=>{
      try {
        if(event.data.type==='arm'){this.requested='armed';this.core?.arm();}
        else if(event.data.type==='start'){this.requested='recording';this.core?.startManual();}
        else if(event.data.type==='ack-take')this.core?.acknowledgeTake();
        else if(event.data.type==='ack-meter')this.core?.acknowledgeMeter();
        else if(event.data.type==='stop'){
          const result=this.core?.stop(); if(result) this.publish(result.takes);
          this.port.postMessage({type:'stopped'}); this.requested='monitoring';
        } else if(event.data.type==='close'){this.core?.close();this.port.close();}
      } catch(error){this.port.postMessage({type:'error',message:error instanceof Error?error.message:'Capture processor failed'});}
    };
  }

  process(inputs:Float32Array[][],outputs:Float32Array[][]) {
    for(const output of outputs)for(const channel of output)channel.fill(0);
    const input=inputs[0];
    if(!input?.length || !input[0]?.length){
      this.missingFrames+=outputs[0]?.[0]?.length??128;
      const active=this.requested!=='monitoring'||!!this.core&&this.core.state!=='monitoring'&&this.core.state!=='stopped';
      if(!active&&this.core?.state==='monitoring')this.core.invalidateMonitoringTimeline();
      if(!this.failed&&(active||this.missingFrames>Math.round(sampleRate*.5))){this.failed=true;this.core?.close();this.port.postMessage({type:'error',message:active?'Audio input was interrupted during capture.':'The selected input produced no audio frames.'});}
      return true;
    }
    this.missingFrames=0;
    try {
      if(!this.core){
        // Some browsers omit channelCount settings. This one-time startup
        // allocation discovers the delivered format; per-take completion never allocates.
        this.core=new CaptureCore({...this.config,sampleRate,channels:input.length});
        if(this.requested==='armed')this.core.arm(); else if(this.requested==='recording')this.core.startManual();
      }
      if(!this.formatSent){this.formatSent=true;this.port.postMessage({type:'format',sampleRate,channels:input.length,memoryBytes:this.core.memoryBytes});}
      const result=this.core.process(input,currentFrame);
      if(result.meter)this.port.postMessage({type:'meter',...result.meter,state:result.state});
      this.publish(result.takes);
    } catch(error){this.failed=true;this.core?.close();this.port.postMessage({type:'error',message:error instanceof Error?error.message:'Capture processor failed'});}
    return true;
  }

  private publish(takes:ReturnType<CaptureCore['process']>['takes']) {
    for(const take of takes){
      const transfer=take.channels.map(channel=>channel.buffer);
      this.port.postMessage({type:'take',take:{...take,sampleRate,channelCount:take.channels.length}},transfer);
    }
  }
}

registerProcessor('op-patchstudio-capture',OpPatchCaptureProcessor);
