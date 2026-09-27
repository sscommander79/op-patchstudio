/** Conservative, non-destructive marker suggestions for a single audio buffer. */
export interface SuggestedRange { start: number; end: number }
export interface SampleSuggestions { trim: SuggestedRange | null; loop: SuggestedRange | null; reason: string | null }

export function suggestSampleMarkers(buffer: AudioBuffer, current: SuggestedRange): SampleSuggestions {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const length = buffer.length;
  if (!channels.length || length < 2 || !Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0 || !Number.isFinite(current.start) || !Number.isFinite(current.end)) {
    return { trim: null, loop: null, reason: 'Audio is too short to analyze.' };
  }
  const low = Math.max(0, Math.min(length - 1, Math.round(current.start)));
  const high = Math.max(low + 1, Math.min(length, Math.round(current.end)));
  if (channels.some(channel => channel.length < length)) return {trim:null,loop:null,reason:'Audio channels are incomplete.'};
  let peak = 0;
  for (const channel of channels) for (let frame = low; frame < high; frame++) {if(!Number.isFinite(channel[frame]))return {trim:null,loop:null,reason:'Audio contains invalid sample values.'};peak = Math.max(peak, Math.abs(channel[frame]));}
  if (peak < 0.003) return { trim: null, loop: null, reason: 'No reliable sound was detected; markers were left unchanged.' };

  // A very low floor favors retaining quiet releases over aggressive trimming.
  const threshold = 0.0005;
  const audible = (frame: number) => channels.some(channel => Math.abs(channel[frame]) >= threshold);
  let first = low, last = high - 1;
  while (first < high && !audible(first)) first++;
  while (last > first && !audible(last)) last--;
  const padding = Math.max(1, Math.round(buffer.sampleRate * 0.02));
  const trim = last - first >= Math.round(buffer.sampleRate * 0.05)
    ? { start: Math.max(low, first - padding), end: Math.min(high, last + 1 + padding) }
    : null;

  // Search the middle of the current playable range; audition is still required.
  const searchLow=trim?.start??low,searchHigh=trim?.end??high,span=searchHigh-searchLow;
  const minLoop = Math.round(buffer.sampleRate * 0.1);
  if (span < minLoop * 2) return { trim, loop: null, reason: 'Sustain is too short for a reliable loop suggestion.' };
  const targetStart = searchLow + Math.round(span * 0.3), targetEnd = searchLow + Math.round(span * 0.7);
  const radius = Math.max(1, Math.min(Math.round(buffer.sampleRate * 0.012), Math.floor(span * 0.04)));
  const window = Math.max(4, Math.min(32, Math.floor(minLoop / 4)));
  const energy = (frame: number) => {
    let sum = 0;
    for (const channel of channels) for (let offset = -window; offset < window; offset++) sum += channel[frame + offset] ** 2;
    return Math.sqrt(sum / (channels.length * window * 2));
  };
  type LoopCandidate = { start: number; end: number; cost: number };
  let best: LoopCandidate | null = null;
  const consider=(start:number,end:number,startEnergy:number,endEnergy:number)=>{
    if(end-start<minLoop||Math.min(startEnergy,endEnergy)<peak*.08)return;
    let error=0;
    for(const channel of channels)for(let offset=-window;offset<window;offset++)error+=(channel[start+offset]-channel[end+offset])**2;
    const cost=Math.sqrt(error/(channels.length*window*2))/Math.max(startEnergy,endEnergy);
    if(!best||cost<best.cost)best={start,end,cost};
  };
  const candidateStep=Math.max(1,Math.ceil((radius*2+1)/64));
  const candidates=(center:number)=>{const found:Array<{frame:number;energy:number}>=[];for(let frame=center-radius;frame<=center+radius;frame+=candidateStep){if(frame-window<searchLow||frame+window>=searchHigh)continue;const measured=energy(frame);if(measured>=peak*.08)found.push({frame,energy:measured});}return found;};
  const starts=candidates(targetStart),ends=candidates(targetEnd);
  for (const {frame:start,energy:startEnergy} of starts) {
    for (const {frame:end,energy:endEnergy} of ends) {
      consider(start,end,startEnergy,endEnergy);
    }
  }
  // Refine one coarse pair by a few frames so the candidate grid cannot miss a periodic seam.
  const coarse=best as LoopCandidate|null;
  if(coarse&&candidateStep>1){for(let start=coarse.start-candidateStep;start<=coarse.start+candidateStep;start++){if(start-window<searchLow||start+window>=searchHigh)continue;const startEnergy=energy(start);for(let end=coarse.end-candidateStep;end<=coarse.end+candidateStep;end++){if(end-window<searchLow||end+window>=searchHigh)continue;consider(start,end,startEnergy,energy(end));}}}
  const finalBest=best as LoopCandidate|null;
  const loop = finalBest && finalBest.cost <= 0.12
    ? { start: finalBest.start, end: finalBest.end }
    : null;
  return { trim, loop, reason: loop ? null : 'No low-discontinuity sustain loop was found. Set loop markers by ear.' };
}
