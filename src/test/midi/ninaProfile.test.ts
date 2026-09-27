import { describe, expect, it } from 'vitest';
import {
  buildNinaCc,
  NINA_PROFILE,
  validateNinaValues,
  type NinaDesiredValues,
} from '../../midi/ninaProfile';

describe('NINA profile', () => {
  it.each([
    ['patch-volume', 7], ['resonance', 28], ['cutoff', 29], ['drive', 30],
  ] as const)('encodes documented NINA %s CC', (id, controller) => {
    expect(buildNinaCc(id, 16, 127)).toEqual({
      channel: 16,
      controller,
      value: 127,
      label: NINA_PROFILE.parameters[id].label,
    });
  });

  it('rejects an unknown parameter, non-integer value, and channel outside 1 to 16', () => {
    expect(() => buildNinaCc('cutoff', 0, 64)).toThrow(/1 to 16/);
    expect(() => buildNinaCc('cutoff', 1, 128)).toThrow(/0 to 127/);
    expect(() => buildNinaCc('cutoff', 1, 64.5)).toThrow(/whole numbers/);
    expect(() => buildNinaCc('unknown' as never, 1, 64)).toThrow(/unknown parameter/i);
  });

  it('validates desired values against the static profile range', () => {
    const values: NinaDesiredValues = {
      'patch-volume': 0,
      resonance: 127,
      cutoff: 64,
      drive: 32,
    };
    expect(validateNinaValues(values)).toEqual({ ok: true, values });
    expect(validateNinaValues({ ...values, cutoff: 128 })).toEqual({
      ok: false,
      errors: { cutoff: expect.stringMatching(/0 to 127/) },
    });
  });

  it('exposes only the documented v1 controls and Cutoff safe test value', () => {
    expect(NINA_PROFILE.id).toBe('melbourne-instruments-nina');
    expect(NINA_PROFILE.version).toBe(1);
    expect(Object.keys(NINA_PROFILE.parameters)).toEqual([
      'patch-volume', 'resonance', 'cutoff', 'drive',
    ]);
    expect(NINA_PROFILE.parameters.cutoff.safeTestValue).toBe(64);
  });
});
