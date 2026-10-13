// @vitest-environment node
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {analyzeNoteRecording} from './automaticNoteSplit';
function operator(name='Operator-three-notes.wav'){
 const b=readFileSync(new URL('../../proof-fixtures/'+name,import.meta.url));
 let offset=12, rate=0,channels=0,data=Buffer.alloc(0);
 while(offset+8<=b.length){const size=b.readUInt32LE(offset+4),tag=b.toString('ascii',offset,offset+4);if(tag==='fmt '){channels=b.readUInt16LE(offset+10);rate=b.readUInt32LE(offset+12);expect(b.readUInt16LE(offset+22)).toBe(16);}if(tag==='data')data=b.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
 return {rate,pcm:Array.from({length:channels},(_,c)=>Float32Array.from({length:data.length/2/channels},(_,i)=>data.readInt16LE((i*channels+c)*2)/32768))};
}
function tone(notes:number[], gap=.4){const rate=44100;const pcm=new Float32Array(Math.round(notes.length*(.5+gap)*rate));notes.forEach((n,j)=>{for(let i=0;i<rate*.5;i++)pcm[Math.round(j*(.5+gap)*rate)+i]=.2*Math.sin(2*Math.PI*440*2**((n-69)/12)*i/rate);});return {pcm,rate};}
describe('one recording to mapped notes',()=>{
 it('finds Operator C2 C3 C4 without filenames, timing or a note plan',()=>{const {pcm,rate}=operator();const result=analyzeNoteRecording(pcm,rate);expect(result.map(x=>x.rootNote)).toEqual([48,60,72]);expect(result.every(x=>Math.abs(x.cents)<5)).toBe(true);expect(result[0].startFrame).toBe(0);expect(result.at(-1)?.endFrame).toBe(pcm[0].length);for(let i=1;i<result.length;i++)expect(result[i].startFrame).toBe(result[i-1].endFrame);expect(result[1].startFrame/rate).toBeCloseTo(1.98,1);});
 it('does not assume three notes or an ascending octave plan',()=>{const {pcm,rate}=tone([67,55]);expect(analyzeNoteRecording([pcm],rate).map(x=>x.rootNote)).toEqual([67,55]);});
 it('handles reversed stereo polarity without cancellation',()=>{const {pcm,rate}=tone([60]);expect(analyzeNoteRecording([pcm,pcm.map(x=>-x)],rate)[0].rootNote).toBe(60);});
 it('rejects silence',()=>expect(()=>analyzeNoteRecording([new Float32Array(44100)],44100)).toThrow(/No notes/));
 it('rejects ambiguous noise instead of mapping it',()=>{let seed=7;const pcm=Float32Array.from({length:22050},()=>{seed=(seed*1664525+1013904223)>>>0;return (seed/2**32-.5)*.4;});expect(()=>analyzeNoteRecording([pcm],44100)).toThrow(/pitch/i);});
 it('rejects duplicate roots without overwriting a note',()=>{const {pcm,rate}=tone([60,60]);expect(()=>analyzeNoteRecording([pcm],rate)).toThrow(/same note/);});
 it('rejects a connected pitch change instead of silently assigning one root',()=>{const {pcm,rate}=tone([60,72],0);expect(()=>analyzeNoteRecording([pcm],rate)).toThrow(/pitch/i);});
});

it('identifies real Serum C5 without falling to a subharmonic',()=>{const {pcm,rate}=operator('Serum-C5.wav');expect(analyzeNoteRecording(pcm,rate)[0].rootNote).toBe(84);});
