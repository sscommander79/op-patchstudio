import {encodeStoredAudio} from './storedAudio';
import {framesToSeconds,normalizeSecondRanges} from './loopEditing';

export interface AudioSecondRange {start:number;end:number}

export function serializeAudioBounds(audioBuffer:AudioBuffer,sample:AudioSecondRange,loop?:AudioSecondRange){
  const bounds=normalizeSecondRanges(audioBuffer.length,audioBuffer.sampleRate,sample,loop);
  return {sample:{start:framesToSeconds(bounds.sample.start,audioBuffer.sampleRate),end:framesToSeconds(bounds.sample.end,audioBuffer.sampleRate)},
    loop:loop?{start:framesToSeconds(bounds.loop.start,audioBuffer.sampleRate),end:framesToSeconds(bounds.loop.end,audioBuffer.sampleRate)}:undefined};
}

export function serializeLibraryAudioAsset<T extends {audioBuffer?:AudioBuffer|null}>(sample:T):{
  source:Omit<T,'audioBuffer'>;audioBuffer:AudioBuffer;audioBlob:Blob
}{
  if(!sample.audioBuffer)throw new Error('Loaded sample audio is missing');
  const {audioBuffer,...source}=sample;
  return {source:source as Omit<T,'audioBuffer'>,audioBuffer,audioBlob:encodeStoredAudio(audioBuffer)};
}
