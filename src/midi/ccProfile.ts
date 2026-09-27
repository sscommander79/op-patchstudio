import { NINA_PROFILE, type NinaDesiredValues } from './ninaProfile';

export const CUSTOM_CC_PROFILE_ID = 'custom-cc' as const;
export type CcProfileId = typeof CUSTOM_CC_PROFILE_ID | typeof NINA_PROFILE.id;

export type CcSlot = {
  id: string;
  enabled: boolean;
  label: string;
  controller: number | null;
  value: number;
};

const midiByte = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 127;

export const createCcSlots = (profile: CcProfileId): CcSlot[] => {
  const slots: CcSlot[] = Array.from({ length: 8 }, (_, index) => ({
    id: `cc-${index + 1}`,
    enabled: false,
    label: '',
    controller: null,
    value: 64,
  }));
  if (profile === NINA_PROFILE.id) {
    const controls = Object.values(NINA_PROFILE.parameters);
    controls.forEach((control, index) => {
      slots[index] = {
        ...slots[index],
        enabled: true,
        label: control.label,
        controller: control.controller,
        value: control.label === 'Cutoff' ? 64 : 0,
      };
    });
  }
  return slots;
};

export const slotsFromLegacyNina = (desired: NinaDesiredValues): CcSlot[] => {
  const slots = createCcSlots(NINA_PROFILE.id);
  slots[0].value = desired['patch-volume'];
  slots[1].value = desired.resonance;
  slots[2].value = desired.cutoff;
  slots[3].value = desired.drive;
  return slots;
};

export const validateCcSlots = (value: unknown): CcSlot[] => {
  if (!Array.isArray(value) || value.length !== 8) throw new Error('A CC setup must have exactly eight slots.');
  const activeControllers = new Set<number>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`CC slot ${index + 1} must be an object.`);
    const slot = raw as Record<string, unknown>;
    const keys = Object.keys(slot);
    if (keys.length !== 5 || ['id', 'enabled', 'label', 'controller', 'value'].some(key => !Object.prototype.hasOwnProperty.call(slot, key))) {
      throw new Error(`CC slot ${index + 1} has an invalid shape.`);
    }
    if (slot.id !== `cc-${index + 1}`) throw new Error(`CC slot ${index + 1} has an invalid id.`);
    if (typeof slot.enabled !== 'boolean') throw new Error(`CC slot ${index + 1} enabled must be boolean.`);
    if (typeof slot.label !== 'string' || slot.label.length > 40) throw new Error(`CC slot ${index + 1} label is invalid.`);
    if (!midiByte(slot.value)) throw new Error(`CC slot ${index + 1} value must be 0–127.`);
    if (slot.controller !== null && !midiByte(slot.controller)) throw new Error(`CC slot ${index + 1} controller must be 0–127.`);
    if (slot.enabled) {
      if (!slot.label.trim()) throw new Error(`CC slot ${index + 1} needs a label.`);
      if (slot.controller === null) throw new Error(`CC slot ${index + 1} needs a CC number.`);
      if (activeControllers.has(slot.controller as number)) throw new Error(`Duplicate enabled CC controller ${slot.controller}.`);
      activeControllers.add(slot.controller as number);
    }
    return {
      id: slot.id as string,
      enabled: slot.enabled as boolean,
      label: slot.label as string,
      controller: slot.controller as number | null,
      value: slot.value as number,
    };
  });
};

export const buildCcMessage = (slot: CcSlot, channel: number) => {
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) throw new Error('MIDI channel must be 1–16.');
  if (!slot.enabled || slot.controller === null) throw new Error('Cannot send a disabled CC slot.');
  if (!slot.label.trim() || !midiByte(slot.controller) || !midiByte(slot.value)) throw new Error('CC slot is invalid.');
  return { channel, controller: slot.controller, value: slot.value, label: slot.label.trim() };
};
