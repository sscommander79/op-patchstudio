import {convertedFrameCount} from './exportPlanning';

export async function resampleAudioBuffer(audioBuffer:AudioBuffer,targetSampleRate:number):Promise<AudioBuffer> {
  if(targetSampleRate===audioBuffer.sampleRate)return audioBuffer;
  const context=new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    convertedFrameCount(audioBuffer.length,audioBuffer.sampleRate,targetSampleRate),
    targetSampleRate,
  );
  const source=context.createBufferSource();
  source.buffer=audioBuffer;
  source.connect(context.destination);
  source.start();
  return context.startRendering();
}

/** Downmix stereo PCM using the amplitude-preserving arithmetic mean. */
export function downmixStereoToMono(audioBuffer:AudioBuffer):AudioBuffer {
  if(audioBuffer.numberOfChannels!==2)throw new Error('Stereo downmix requires exactly two input channels');
  const mono=new AudioBuffer({numberOfChannels:1,length:audioBuffer.length,sampleRate:audioBuffer.sampleRate});
  const left=audioBuffer.getChannelData(0),right=audioBuffer.getChannelData(1),output=mono.getChannelData(0);
  for(let frame=0;frame<audioBuffer.length;frame++)output[frame]=0.5*left[frame]+0.5*right[frame];
  return mono;
}

export function convertAudioBufferChannels(audioBuffer:AudioBuffer,targetChannels:number):AudioBuffer {
  if(targetChannels!==1&&targetChannels!==2)throw new Error('Channel conversion supports only mono or stereo output');
  if(audioBuffer.numberOfChannels===targetChannels)return audioBuffer;
  if(audioBuffer.numberOfChannels===2&&targetChannels===1)return downmixStereoToMono(audioBuffer);
  if(audioBuffer.numberOfChannels!==1||targetChannels!==2)throw new Error('Channel conversion requires mono or stereo input');
  const stereo=new AudioBuffer({numberOfChannels:2,length:audioBuffer.length,sampleRate:audioBuffer.sampleRate});
  const input=audioBuffer.getChannelData(0);
  stereo.copyToChannel(input,0);stereo.copyToChannel(input,1);
  return stereo;
}
