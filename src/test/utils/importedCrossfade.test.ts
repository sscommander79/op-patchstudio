import { describe, expect, it } from 'vitest';
import type { MultisampleFile } from '../../context/AppContext';
import { associateImportedCrossfades } from '../../utils/importedCrossfade';

function sample(name: string, relativePath = ''): MultisampleFile {
  const file = new File(['audio'], name, { type: 'audio/wav' });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return {
    file,
    audioBuffer: new (AudioBuffer as unknown as new (c: number, l: number, r: number) => AudioBuffer)(1, 100, 100),
    name,
    isLoaded: true,
    rootNote: 60,
    inPoint: 0,
    outPoint: 1,
    loopStart: 0.1,
    loopEnd: 0.9,
  };
}

describe('imported crossfade association', () => {
  it('maps an exact unique file identity and preserves raw provenance above the editor range', () => {
    const result = associateImportedCrossfades([sample('tone.wav', 'samples/tone.wav')], {
      regions: [{ sample: 'samples/tone.wav', framecount: 100, 'loop.crossfade': 90 }],
    });
    expect(result.files[0].loopCrossfade).toEqual({
      fraction: 0.9,
      importedRaw: 90,
      importedFramecount: 100,
      sourceIdentity: 'samples/tone.wav',
    });
    expect(result.notice).toContain('above 75%');
  });

  it('does not guess from array order or a basename when imported paths are unmatched', () => {
    const result = associateImportedCrossfades([sample('tone.wav')], {
      regions: [{ sample: 'folder/tone.wav', framecount: 100, 'loop.crossfade': 25 }],
    });
    expect(result.files[0].loopCrossfade).toBeUndefined();
    expect(result.notice).toContain('could not be matched');
  });

  it('does not map duplicate file identities or duplicate region identities', () => {
    const duplicateFiles = associateImportedCrossfades([sample('tone.wav'), sample('tone.wav')], {
      regions: [{ sample: 'tone.wav', framecount: 100, 'loop.crossfade': 25 }],
    });
    expect(duplicateFiles.files.every((file) => file.loopCrossfade === undefined)).toBe(true);
    expect(duplicateFiles.notice).toContain('ambiguous');

    const duplicateRegions = associateImportedCrossfades([sample('tone.wav')], {
      regions: [
        { sample: 'tone.wav', framecount: 100, 'loop.crossfade': 25 },
        { sample: 'tone.wav', framecount: 100, 'loop.crossfade': 50 },
      ],
    });
    expect(duplicateRegions.files[0].loopCrossfade).toBeUndefined();
    expect(duplicateRegions.notice).toContain('ambiguous');
  });

  it('preserves and reports crossfade values it cannot interpret', () => {
    const preset = { regions: [{ sample: 'tone.wav', framecount: 100, 'loop.crossfade': 'opaque' }] };
    const result = associateImportedCrossfades([sample('tone.wav')], preset);
    expect(result.files[0].loopCrossfade).toBeUndefined();
    expect(result.notice).toMatch(/could not be interpreted.*original JSON/i);
    expect(preset.regions[0]['loop.crossfade']).toBe('opaque');
  });

  it('keeps deliberate edits authoritative and removes stale imported provenance when identity becomes ambiguous', () => {
    const preset = { regions: [{ sample: 'tone.wav', framecount: 100, 'loop.crossfade': 90 }] };
    const edited = sample('tone.wav');
    edited.loopCrossfade = { fraction: 0.25 };
    expect(associateImportedCrossfades([edited, sample('other.wav')], preset).files[0].loopCrossfade).toEqual({ fraction: 0.25 });

    const initiallyAssociated = associateImportedCrossfades([sample('tone.wav')], preset).files[0];
    const ambiguous = associateImportedCrossfades([initiallyAssociated, sample('tone.wav')], preset);
    expect(ambiguous.files.every((file) => file.loopCrossfade === undefined)).toBe(true);
    expect(ambiguous.notice).toMatch(/ambiguous/i);
  });

  it('replaces exact matches only for an explicit new preset and clears only stale imported matches', () => {
    const firstPreset = { regions: [{ sample: 'tone.wav', framecount: 100, 'loop.crossfade': 25 }] };
    const secondPreset = { regions: [{ sample: 'tone.wav', framecount: 100, 'loop.crossfade': 90 }] };
    const associated = associateImportedCrossfades([sample('tone.wav')], firstPreset).files[0];
    const replaced = associateImportedCrossfades([associated], secondPreset, { replaceMatched: true }).files[0];
    expect(replaced.loopCrossfade).toMatchObject({ fraction: 0.9, importedRaw: 90 });

    const stale = associateImportedCrossfades([associated], { regions: [] }, { replaceMatched: true }).files[0];
    expect(stale.loopCrossfade).toBeUndefined();
    const manual = sample('tone.wav');
    manual.loopCrossfade = { fraction: 0.4 };
    expect(associateImportedCrossfades([manual], { regions: [] }, { replaceMatched: true }).files[0].loopCrossfade).toEqual({ fraction: 0.4 });
  });
});
