/** The documented, computer-side MIDI controls exposed by Melbourne Instruments NINA. */
export const NINA_PROFILE = {
  id: 'melbourne-instruments-nina',
  version: 1,
  label: 'Melbourne Instruments NINA',
  parameters: {
    'patch-volume': { label: 'Patch Volume', controller: 7, min: 0, max: 127 },
    resonance: { label: 'Resonance', controller: 28, min: 0, max: 127 },
    cutoff: { label: 'Cutoff', controller: 29, min: 0, max: 127, safeTestValue: 64 },
    drive: { label: 'Drive', controller: 30, min: 0, max: 127 },
  },
  metadata: {
    sourceReferences: ['NINA MIDI implementation documentation'],
    verificationState: 'documented mapping; hardware receipt not asserted',
  },
} as const;

export type NinaParameterId = keyof typeof NINA_PROFILE.parameters;
export type NinaDesiredValues = { [Parameter in NinaParameterId]: number };

export type NinaValuesValidation =
  | { readonly ok: true; readonly values: NinaDesiredValues }
  | { readonly ok: false; readonly errors: Partial<Record<NinaParameterId, string>> };

const isParameterId = (parameter: string): parameter is NinaParameterId =>
  Object.prototype.hasOwnProperty.call(NINA_PROFILE.parameters, parameter);

const isMidiByte = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 127;

export const validateNinaValues = (values: NinaDesiredValues): NinaValuesValidation => {
  const errors: Partial<Record<NinaParameterId, string>> = {};

  for (const parameter of Object.keys(NINA_PROFILE.parameters) as NinaParameterId[]) {
    const value = values[parameter];
    const metadata = NINA_PROFILE.parameters[parameter];
    if (!Number.isInteger(value) || value < metadata.min || value > metadata.max) {
      errors[parameter] = `${metadata.label} must be a whole number from ${metadata.min} to ${metadata.max}.`;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values };
};

export const buildNinaCc = (
  parameter: NinaParameterId,
  channel: number,
  value: number,
): { channel: number; controller: number; value: number; label: string } => {
  if (!isParameterId(parameter)) throw new Error(`Unknown parameter for NINA: ${parameter}.`);
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
    throw new Error('MIDI channel must be a whole number from 1 to 16.');
  }

  const metadata = NINA_PROFILE.parameters[parameter];
  if (!isMidiByte(value) || value < metadata.min || value > metadata.max) {
    throw new Error(`MIDI value must be an integer; allowed whole numbers are from ${metadata.min} to ${metadata.max}.`);
  }

  return { channel, controller: metadata.controller, value, label: metadata.label };
};
