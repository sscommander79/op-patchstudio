/** Conservative, offline monophonic note suggestions. Audio is never modified or uploaded.
 * YIN cumulative-mean difference/first trough (de Cheveigne & Kawahara, 2002),
 * followed by fundamental-energy and multi-window/stereo agreement checks.
 * These gates reduce errors; they cannot prove a sound is a single instrument/note.
 */
export interface NoteEstimate {midiNote:number;cents:number}
const FRAME = 2048;
const WINDOWS = 7;
const MIN_HZ = 32;
const MAX_HZ = 2100;
function check(signal?:AbortSignal) {
  if(signal?.aborted)throw new DOMException('Note analysis canceled','AbortError');
}
function filter(stride:number) {
  if(stride===1)return Float64Array.of(1);
  const radius=8*stride,cutoff=.45/stride;
  const taps=Float64Array.from({length:radius*2+1},(_,i)=>{
    const x=i-radius;
    const sinc=x===0?2*cutoff:Math.sin(2*Math.PI*cutoff*x)/(Math.PI*x);
    return sinc*(.42+.5*Math.cos(Math.PI*x/radius)+.08*Math.cos(2*Math.PI*x/radius));
  });
  const sum=taps.reduce((a,b)=>a+b,0);return taps.map(t=>t/sum);
}
function windowNote(samples:Float64Array,rate:number):number|null {
  const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
  let energy=0;for(let i=0;i<samples.length;i++){samples[i]-=mean;energy+=samples[i]*samples[i];}
  if(!Number.isFinite(energy)||energy/samples.length<1e-6)return null;
  const maxLag=Math.min(Math.ceil(rate/MIN_HZ),FRAME/2-1),minLag=Math.max(2,Math.floor(rate/MAX_HZ));
  const difference=new Float64Array(maxLag+1);let sum=0;
  for(let lag=1;lag<=maxLag;lag++){
    let d=0;for(let i=0;i<FRAME/2;i++){const delta=samples[i]-samples[i+lag];d+=delta*delta;}
    sum+=d;difference[lag]=sum>0?d*lag/sum:1;
  }
  for(let lag=minLag;lag<maxLag;lag++){
    if(difference[lag]>.06)continue;
    while(lag+1<maxLag&&difference[lag+1]<difference[lag])lag++;
    const left=difference[lag-1],center=difference[lag],right=difference[lag+1];
    const denominator=left-2*center+right;
    const period=lag+(denominator ? .5*(left-right)/denominator:0);
    const hz=rate/period;if(hz<MIN_HZ||hz>MAX_HZ)return null;
    // A chord can repeat at a common subharmonic. Refuse absent/very weak fundamentals.
    let re=0,im=0;for(let i=0;i<samples.length;i++){
      const angle=2*Math.PI*hz*i/rate;re+=samples[i]*Math.cos(angle);im+=samples[i]*Math.sin(angle);
    }
    if(2*(re*re+im*im)/(samples.length*energy)<.08)return null;
    return 69+12*Math.log2(hz/440);
  }
  return null;
}
export async function suggestOriginalNote(buffer:Pick<AudioBuffer,'length'|'sampleRate'|'numberOfChannels'|'getChannelData'>,signal?:AbortSignal):Promise<NoteEstimate|null> {
  check(signal);
  if(!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<4000||buffer.length<buffer.sampleRate*.18)return null;
  const stride=Math.max(1,Math.ceil(buffer.sampleRate/12000)),rate=buffer.sampleRate/stride,taps=filter(stride);
  const channelResults:number[]=[];
  for(let channel=0;channel<Math.min(2,buffer.numberOfChannels);channel++){
    check(signal);const data=buffer.getChannelData(channel);
    const hop=Math.max(16,Math.floor(data.length/2048));let first=-1,last=-1;
    for(let start=0;start+16<data.length;start+=hop){
      let power=0;for(let j=0;j<16;j++)power+=data[start+j]*data[start+j];
      if(power/16>1e-6){if(first<0)first=start;last=Math.min(data.length,start+hop);}
    }
    if(first<0)continue;
    const frameLength=FRAME*stride;if(last-first<frameLength)return null;
    const start=first+Math.min(Math.floor(rate*.035)*stride,Math.max(0,last-first-frameLength));
    const end=last-frameLength;const candidates:number[]=[];
    for(let w=0;w<WINDOWS;w++){
      // Yield between bounded windows so import cancel and recording controls stay responsive.
      await new Promise<void>(resolve=>setTimeout(resolve,0));check(signal);
      const offset=Math.round(start+(end-start)*w/(WINDOWS-1)),samples=new Float64Array(FRAME),radius=(taps.length-1)/2;
      for(let i=0;i<FRAME;i++){
        const center=offset+i*stride;let value=0;
        for(let t=0;t<taps.length;t++)value+=(data[center+t-radius]??0)*taps[t];
        samples[i]=value;
      }
      const note=windowNote(samples,rate);if(note!==null)candidates.push(note);
    }
    if(candidates.length<4)return null;
    candidates.sort((a,b)=>a-b);const median=candidates[Math.floor(candidates.length/2)];
    if(candidates.filter(n=>Math.abs(n-median)<.3).length/candidates.length<.85)return null;
    if(Math.abs(median-Math.round(median))>.35)return null;
    channelResults.push(median);
  }
  if(!channelResults.length||Math.max(...channelResults)-Math.min(...channelResults)>.3)return null;
  const note=channelResults.reduce((a,b)=>a+b,0)/channelResults.length,midiNote=Math.round(note);
  return {midiNote,cents:Math.round((note-midiNote)*100)};
}
