import {describe,expect,it} from 'vitest';
import {suggestSampleMarkers} from '../../utils/sampleSuggestions';

function buffer(channels: number[][], sampleRate = 1000): AudioBuffer {
  return { length: channels[0].length, sampleRate, numberOfChannels: channels.length, getChannelData: (index: number) => Float32Array.from(channels[index]) } as AudioBuffer;
}

describe('sample marker suggestions', () => {
  it('trims only silence shared by every channel and retains padding', () => {
    const left = Array(1000).fill(0), right = Array(1000).fill(0);
    for (let frame = 200; frame < 800; frame++) left[frame] = 0.5;
    for (let frame = 150; frame < 850; frame++) right[frame] = 0.4;
    expect(suggestSampleMarkers(buffer([left, right]), {start: 0, end: 1000}).trim).toEqual({start: 130, end: 870});
  });

  it('rejects silent audio without proposing a destructive trim or loop', () => {
    const result = suggestSampleMarkers(buffer([Array(1000).fill(0)]), {start: 0, end: 1000});
    expect(result).toMatchObject({trim: null, loop: null});
    expect(result.reason).toMatch(/no reliable sound/i);
  });

  it('suggests a periodic sustain seam inside the current range', () => {
    const periodic = Array.from({length: 2000}, (_, frame) => Math.sin(2 * Math.PI * frame / 40) * 0.5);
    const result = suggestSampleMarkers(buffer([periodic]), {start: 200, end: 1800});
    expect(result.loop).not.toBeNull();
    expect(result.loop!.start).toBeGreaterThan(400);
    expect(result.loop!.end).toBeLessThan(1600);
  });

  it('does not invent a loop when the sustain is too short', () => {
    const result = suggestSampleMarkers(buffer([Array(150).fill(0.4)]), {start: 0, end: 150});
    expect(result.loop).toBeNull();
  });

  it('rejects quiet uncorrelated noise and keeps trimmed search inside existing markers', () => {
    let seed=0x12345678;
    const noise = Array.from({length: 2000}, () => {seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/0xffffffff*.02-.01;});
    const result = suggestSampleMarkers(buffer([noise]), {start: 200, end: 1800});
    expect(result.loop).toBeNull();
    expect(result.trim?.start).toBeGreaterThanOrEqual(200);
    expect(result.trim?.end).toBeLessThanOrEqual(1800);
  });

  it('retains a quiet release after a loud body', () => {
    const sound=Array(1000).fill(0);
    for(let frame=100;frame<500;frame++)sound[frame]=.7;
    for(let frame=500;frame<800;frame++)sound[frame]=.003;
    expect(suggestSampleMarkers(buffer([sound]),{start:0,end:1000}).trim?.end).toBeGreaterThanOrEqual(800);
  });
});
