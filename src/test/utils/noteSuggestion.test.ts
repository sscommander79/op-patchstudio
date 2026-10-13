import {describe,it,expect} from 'vitest';
import {suggestOriginalNote} from '../../utils/noteSuggestion';
function sound(fn:(t:number)=>number,rate=44100,duration=1):AudioBuffer {
 const data=Float32Array.from({length:Math.round(rate*duration)},(_,i)=>fn(i/rate));
 return {sampleRate:rate,length:data.length,duration,numberOfChannels:1,getChannelData:()=>data} as unknown as AudioBuffer;
}
const tone=(hz:number)=>(t:number)=>.3*Math.sin(2*Math.PI*hz*t);
describe('original note suggestions',()=>{
 it.each([65.4064,220,440,1046.5023])('finds a stable tone at %s Hz',async hz=>{
  const result=await suggestOriginalNote(sound(tone(hz)));
  expect(result?.midiNote).toBe(Math.round(69+12*Math.log2(hz/440)));
 });
 it('handles a strong second harmonic without changing octaves',async()=>{
  expect((await suggestOriginalNote(sound(t=>tone(220)(t)+.5*Math.sin(2*Math.PI*440*t))))?.midiNote).toBe(57);
 });
 it('ignores leading silence and a noisy attack',async()=>{
  expect((await suggestOriginalNote(sound(t=>t<.3?0:t<.34?Math.sin(t*12233)*.5:tone(440)(t),48000,1.5)))?.midiNote).toBe(69);
 });
 it('rejects silence, DC and very short sounds',async()=>{
  for(const b of [sound(()=>0),sound(()=>.5),sound(tone(440),44100,.02)])expect(await suggestOriginalNote(b)).toBeNull();
 });
 it('rejects noise and a changing note',async()=>{
  let seed=17;const noise=sound(()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return seed/2147483648*.3;});
  expect(await suggestOriginalNote(noise)).toBeNull();
  expect(await suggestOriginalNote(sound(t=>tone(t<.5?220:330)(t)))).toBeNull();
 });
 it('does not turn an out-of-range high tone into an aliased low note',async()=>{
  expect(await suggestOriginalNote(sound(tone(10000),48000))).toBeNull();
 });
 it('does not mistake a simple chord for its absent common fundamental',async()=>{
  expect(await suggestOriginalNote(sound(t=>tone(440)(t)+tone(660)(t)))).toBeNull();
 });
 it('uses the sounding stereo channel and rejects conflicting stereo notes',async()=>{
  const a=sound(tone(440));const zero=new Float32Array(a.length);
  const stereo={...a,numberOfChannels:2,getChannelData:(n:number)=>n? a.getChannelData(0):zero} as AudioBuffer;
  expect((await suggestOriginalNote(stereo))?.midiNote).toBe(69);
  const b=sound(tone(330));expect(await suggestOriginalNote({...stereo,getChannelData:(n:number)=>n?a.getChannelData(0):b.getChannelData(0)})).toBeNull();
 });
 it('honours cancellation',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(suggestOriginalNote(sound(tone(440)),controller.signal)).rejects.toMatchObject({name:'AbortError'});
 });
 it.each([8000,22050,48000,96000,192000])('supports a %s Hz source rate',async rate=>{
  expect((await suggestOriginalNote(sound(tone(440),rate)))?.midiNote).toBe(69);
 });
 it('refuses a note halfway between keys and leaves sample data unchanged',async()=>{
  const b=sound(tone(440*Math.pow(2,0.5/12)));const original=b.getChannelData(0).slice();
  expect(await suggestOriginalNote(b)).toBeNull();expect(b.getChannelData(0)).toEqual(original);
 });
});
