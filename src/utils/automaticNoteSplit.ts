/** Isolated proof: silence-separated, monophonic notes. No timing/filename assumptions. */
export interface DetectedNoteSlice {startFrame:number;endFrame:number;rootNote:number;frequency:number;cents:number;confidence:number}
function pitch(samples:Float32Array, rate:number, start:number):{midi:number;confidence:number}|null {
 // Keep the source rate: coarse integer lags and aliased harmonics can hide
 // a high note's first period and incorrectly select its octave below.
 const stride=1,sr=rate,n=Math.round(sr*.12);
 const x=new Float64Array(n);let mean=0;
 for(let i=0;i<n;i++){x[i]=samples[start+i*stride]??0;mean+=x[i];}mean/=n;
 for(let i=0;i<n;i++)x[i]-=mean;
 const maxLag=Math.min(Math.floor(sr/50),Math.floor(n/2)),minLag=Math.max(2,Math.floor(sr/2000));
 const difference=new Float64Array(maxLag+1);let cumulative=0;
 for(let lag=1;lag<=maxLag;lag++){let sum=0;for(let i=0;i<n-maxLag;i++){const d=x[i]-x[i+lag];sum+=d*d;}cumulative+=sum;difference[lag]=cumulative?sum*lag/cumulative:1;}
 for(let lag=minLag;lag<maxLag;lag++){
  if(difference[lag]>.12)continue;
  while(lag+1<maxLag&&difference[lag+1]<difference[lag])lag++;
  const a=difference[lag-1],b=difference[lag],c=difference[lag+1];
  const offset=(a+c-2*b)?(a-c)/(2*(a+c-2*b)):0;
  const frequency=sr/(lag+Math.max(-.5,Math.min(.5,offset)));
  return {midi:69+12*Math.log2(frequency/440),confidence:1-b};
 }
 return null;
}
export function analyzeNoteRecording(channels:readonly Float32Array[],rate:number):DetectedNoteSlice[]{
 const length=channels[0]?.length??0;
 if(!length||channels.length>2||!Number.isFinite(rate)||rate<8000||rate>96000||channels.some(c=>c.length!==length)||length/rate>60)throw new Error('Use a mono or stereo recording up to 60 seconds, at 8–96 kHz.');
 // Use the most energetic channel for pitch; peak envelope includes both channels.
 let source=channels[0],energy=-1;
 for(const channel of channels){let sum=0;for(const value of channel){if(!Number.isFinite(value))throw new Error('Invalid audio samples.');sum+=value*value;}if(sum>energy){energy=sum;source=channel;}}
 const hop=Math.max(1,Math.round(rate*.005)),envelope:number[]=[];
 let peak=0;
 for(let i=0;i<length;i+=hop){let p=0;for(const channel of channels)for(let j=i;j<Math.min(length,i+hop);j++)p=Math.max(p,Math.abs(channel[j]));envelope.push(p);peak=Math.max(peak,p);}
 if(peak<.0001)throw new Error('No notes found. Choose a recording with audible notes.');
 const high=Math.max(.0001,peak*.003),low=Math.max(.00003,peak*.001),gap=Math.ceil(.15*rate/hop);
 const regions:{start:number;end:number}[]=[];let start=-1,last=-1;
 for(let i=0;i<=envelope.length;i++){
  const level=envelope[i]??0;
  if(start<0&&level>=high){start=i;last=i;}
  if(start>=0){if(level>=low)last=i;if(i-last>=gap||i===envelope.length){if((last-start+1)*hop/rate<.18)throw new Error('A sound is too short to check its pitch. Use notes held for at least 0.3 seconds.');regions.push({start:start*hop,end:Math.min(length,(last+1)*hop)});start=-1;}}
 }
 if(!regions.length)throw new Error('No notes found.');
 if(regions.length>24)throw new Error('This proof supports up to 24 notes.');
 const roots=new Set<number>();
 return regions.map((region,index)=>{
  const available=region.end-region.start-Math.ceil(rate*.12);
  const readings=[.1,.4,.7].map(f=>pitch(source,rate,region.start+Math.floor(available*f)));
  if(readings.some(p=>!p||p.confidence<.88))throw new Error(`Could not confirm pitch for sound ${index+1}. Use isolated notes with a clear pitch and a pause between them.`);
  const values=readings.map(p=>p!.midi),midi=[...values].sort((a,b)=>a-b)[1],rootNote=Math.round(midi);
  if(rootNote<0||rootNote>127||Math.max(...values)-Math.min(...values)>.3||Math.abs(midi-rootNote)>.35)throw new Error(`Pitch changes or is out of tune in sound ${index+1}. Check the recording before mapping it.`);
  if(roots.has(rootNote))throw new Error('Two sounds have the same note. Nothing was added; use one recording per note.');roots.add(rootNote);
  // Adjacent slices partition the original PCM, retaining all attacks, tails and silence.
  const boundary=(r:{start:number})=>Math.max(0,r.start-Math.round(rate*.02));
  return {startFrame:index===0?0:boundary(region),endFrame:index+1<regions.length?boundary(regions[index+1]):length,rootNote,frequency:440*2**((midi-69)/12),cents:(midi-rootNote)*100,confidence:Math.min(...readings.map(p=>p!.confidence))};
 });
}
