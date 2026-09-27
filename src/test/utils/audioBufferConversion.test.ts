import {describe,expect,it,vi} from 'vitest';
import {convertAudioBufferChannels,downmixStereoToMono,resampleAudioBuffer} from '../../utils/audioBufferConversion';

function buffer(channels:number,values:number[][],sampleRate=48_000) {
  const audio=new AudioBuffer({numberOfChannels:channels,length:values[0].length,sampleRate});
  values.forEach((channel,index)=>audio.copyToChannel(Float32Array.from(channel),index));
  return audio;
}

describe('shared audio buffer conversion',()=>{
  it('uses arithmetic mean for stereo to mono',()=>{
    const mono=downmixStereoToMono(buffer(2,[[.75,.5,-.25],[.75,-.5,.25]]));
    expect(Array.from(mono.getChannelData(0))).toEqual([.75,0,0]);
  });

  it('duplicates mono PCM exactly when stereo is requested',()=>{
    const input=buffer(1,[[.25,-.5,1]]),stereo=convertAudioBufferChannels(input,2);
    expect(Array.from(stereo.getChannelData(0))).toEqual([.25,-.5,1]);
    expect(Array.from(stereo.getChannelData(1))).toEqual([.25,-.5,1]);
  });

  it('uses the shared converted frame count for resampling',async()=>{
    class TestOfflineContext {
      destination={};private readonly output:AudioBuffer;
      constructor(channels:number,length:number,rate:number){this.output=new AudioBuffer({numberOfChannels:channels,length,sampleRate:rate});}
      createBufferSource(){return {buffer:null,connect:vi.fn(),start:vi.fn()};}
      async startRendering(){return this.output;}
    }
    vi.stubGlobal('OfflineAudioContext',TestOfflineContext);
    const input=buffer(1,[Array.from({length:100},(_,index)=>index/100)]);
    const output=await resampleAudioBuffer(input,44_100);
    expect(output.sampleRate).toBe(44_100);
    expect(output.length).toBe(92);
    expect(output.numberOfChannels).toBe(1);
    vi.unstubAllGlobals();
  });

  it('returns the original buffer when no conversion is needed',async()=>{
    const input=buffer(1,[[0,.5]]);
    expect(convertAudioBufferChannels(input,1)).toBe(input);
    await expect(resampleAudioBuffer(input,48_000)).resolves.toBe(input);
  });
});
