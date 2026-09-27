import { describe, expect, it } from 'vitest';
import { buildCcMessage, createCcSlots, validateCcSlots } from '../../midi/ccProfile';

describe('eight-slot external CC setups', () => {
  it('starts custom setups empty and NINA as an editable four-control template', () => {
    const custom = createCcSlots('custom-cc');
    const nina = createCcSlots('melbourne-instruments-nina');
    expect(custom).toHaveLength(8);
    expect(custom.every(slot => !slot.enabled && slot.controller === null)).toBe(true);
    expect(nina).toHaveLength(8);
    expect(nina.filter(slot => slot.enabled).map(slot => [slot.label, slot.controller])).toEqual([
      ['Patch Volume', 7], ['Resonance', 28], ['Cutoff', 29], ['Drive', 30],
    ]);
  });

  it('builds only enabled, validated messages and rejects duplicate controllers', () => {
    const slots = createCcSlots('custom-cc');
    slots[0] = { ...slots[0], enabled: true, label: 'Filter', controller: 74, value: 96 };
    expect(validateCcSlots(slots)).toEqual(slots);
    expect(buildCcMessage(slots[0], 3)).toEqual({ channel: 3, controller: 74, value: 96, label: 'Filter' });
    slots[1] = { ...slots[1], enabled: true, label: 'Second filter', controller: 74 };
    expect(() => validateCcSlots(slots)).toThrow(/duplicate/i);
    expect(() => buildCcMessage(slots[2], 3)).toThrow(/disabled/i);
  });
});
