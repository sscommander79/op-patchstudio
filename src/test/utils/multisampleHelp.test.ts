import { describe, expect, it } from 'vitest';
import { sampleFieldError, type SampleDraft } from '../../components/multisample/multisampleHelp';
const valid: SampleDraft = { rootNote: 60, inPoint: 0, outPoint: 6, loopStart: 2, loopEnd: 4 };
describe('multisample field guidance', () => {
  it('accepts valid points without claiming musical correctness', () => {
    for (const key of Object.keys(valid) as (keyof SampleDraft)[]) expect(sampleFieldError(key, valid, 6)).toBeNull();
  });
  it('rejects blank, fractional and out-of-range root values', () => {
    for (const rootNote of [NaN, 60.5, -1, 128]) expect(sampleFieldError('rootNote', { ...valid, rootNote }, 6)).toMatch(/whole MIDI/);
  });
  it('explains reversed playback and loop points and loops outside playback', () => {
    expect(sampleFieldError('outPoint', { ...valid, outPoint: 0 }, 6)).toMatch(/after playback start/);
    expect(sampleFieldError('loopEnd', { ...valid, loopEnd: 1 }, 6)).toMatch(/after loop start/);
    expect(sampleFieldError('loopStart', { ...valid, inPoint: 3 }, 6)).toMatch(/inside the playback/);
    expect(sampleFieldError('outPoint', { ...valid, outPoint: NaN }, 6)).toMatch(/within the selected audio/);
  });
});
