import {
  NINA_PROFILE,
  validateNinaValues,
  type NinaDesiredValues,
  type NinaParameterId,
} from './ninaProfile';
import { CUSTOM_CC_PROFILE_ID, validateCcSlots, type CcProfileId, type CcSlot } from './ccProfile';

export const DEVICE_SETUP_STORAGE_KEY = 'op-patchstudio.devices.setups.v1';

export type DeviceSetup = {
  schemaVersion: 1;
  profileId: typeof NINA_PROFILE.id;
  profileVersion: 1;
  id: string;
  name: string;
  outputHint?: { id?: string; name?: string; manufacturer?: string };
  channel: number;
  desired: NinaDesiredValues;
  createdAt: string;
  updatedAt: string;
};

export type CustomDeviceSetup = {
  schemaVersion: 2;
  profileId: CcProfileId;
  id: string;
  name: string;
  deviceName: string;
  outputHint?: DeviceSetup['outputHint'];
  channel: number;
  slots: CcSlot[];
  createdAt: string;
  updatedAt: string;
};

export type StoredDeviceSetup = DeviceSetup | CustomDeviceSetup;

type JsonRecord = Record<string, unknown>;
type SetupStorage = Pick<Storage, 'getItem' | 'setItem'>;

const SETUP_KEYS = [
  'schemaVersion',
  'profileId',
  'profileVersion',
  'id',
  'name',
  'outputHint',
  'channel',
  'desired',
  'createdAt',
  'updatedAt',
] as const;
const V2_SETUP_KEYS = [
  'schemaVersion', 'profileId', 'id', 'name', 'deviceName', 'outputHint',
  'channel', 'slots', 'createdAt', 'updatedAt',
] as const;
const REQUIRED_SETUP_KEYS = SETUP_KEYS.filter((key) => key !== 'outputHint');
const REQUIRED_V2_SETUP_KEYS = V2_SETUP_KEYS.filter((key) => key !== 'outputHint');
const OUTPUT_HINT_KEYS = ['id', 'name', 'manufacturer'] as const;
const DESIRED_KEYS = Object.keys(NINA_PROFILE.parameters) as NinaParameterId[];
const MAX_SETUP_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 100;
const MAX_OUTPUT_ID_LENGTH = 256;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const owns = (value: JsonRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const assertExactKeys = (
  value: JsonRecord,
  required: readonly string[],
  allowed: readonly string[],
  label: string,
): void => {
  const keys = Object.keys(value);
  const missing = required.filter((key) => !owns(value, key));
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (missing.length > 0 || unknown.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(', ')}` : '',
      unknown.length > 0 ? `unknown ${unknown.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`${label} has an invalid shape${details ? `: ${details}` : ''}.`);
  }
};

const readBoundedText = (
  value: unknown,
  label: string,
  maximumLength: number,
): string => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumLength) {
    throw new Error(`${label} must be a nonblank string of at most ${maximumLength} characters.`);
  }
  return value;
};

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const readIsoTimestamp = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`${label} must be an ISO timestamp.`);

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) throw new Error(`${label} must be an ISO timestamp.`);

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);

  if (
    month < 1 || month > 12
    || day < 1 || day > monthLengths[month - 1]
    || hour > 23 || minute > 59 || second > 59
    || offsetHour > 23 || offsetMinute > 59
  ) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }

  return value;
};

const readOutputHint = (value: unknown): DeviceSetup['outputHint'] => {
  if (!isRecord(value)) throw new Error('outputHint must be an object.');
  assertExactKeys(value, [], OUTPUT_HINT_KEYS, 'outputHint');

  const outputHint: NonNullable<DeviceSetup['outputHint']> = {};
  if (owns(value, 'id')) outputHint.id = readBoundedText(value.id, 'outputHint.id', MAX_OUTPUT_ID_LENGTH);
  if (owns(value, 'name')) outputHint.name = readBoundedText(value.name, 'outputHint.name', MAX_NAME_LENGTH);
  if (owns(value, 'manufacturer')) {
    outputHint.manufacturer = readBoundedText(value.manufacturer, 'outputHint.manufacturer', MAX_NAME_LENGTH);
  }
  return outputHint;
};

const readDesiredValues = (value: unknown): NinaDesiredValues => {
  if (!isRecord(value)) throw new Error('desired must be an object.');
  assertExactKeys(value, DESIRED_KEYS, DESIRED_KEYS, 'desired');

  for (const parameter of DESIRED_KEYS) {
    if (typeof value[parameter] !== 'number') {
      throw new Error(`desired.${parameter} must be a number.`);
    }
  }

  const desired: NinaDesiredValues = {
    'patch-volume': value['patch-volume'] as number,
    resonance: value.resonance as number,
    cutoff: value.cutoff as number,
    drive: value.drive as number,
  };
  const result = validateNinaValues(desired);
  if (!result.ok) {
    const details = Object.entries(result.errors)
      .map(([parameter, error]) => `${parameter}: ${error}`)
      .join('; ');
    throw new Error(`Invalid desired values: ${details}`);
  }
  return result.values;
};

const validateLegacyDeviceSetup = (value: unknown): DeviceSetup => {
  if (!isRecord(value)) throw new Error('Device setup must be an object.');
  assertExactKeys(value, REQUIRED_SETUP_KEYS, SETUP_KEYS, 'Device setup');

  if (value.schemaVersion !== 1) throw new Error('Unsupported device setup schemaVersion.');
  if (value.profileId !== NINA_PROFILE.id) throw new Error('Unsupported device setup profileId.');
  if (value.profileVersion !== NINA_PROFILE.version) throw new Error('Unsupported device setup profileVersion.');
  if (!Number.isInteger(value.channel) || (value.channel as number) < 1 || (value.channel as number) > 16) {
    throw new Error('Device setup channel must be a whole number from 1 to 16.');
  }

  const setup: DeviceSetup = {
    schemaVersion: 1,
    profileId: NINA_PROFILE.id,
    profileVersion: NINA_PROFILE.version,
    id: readBoundedText(value.id, 'Device setup id', MAX_SETUP_ID_LENGTH),
    name: readBoundedText(value.name, 'Device setup name', MAX_NAME_LENGTH),
    channel: value.channel as number,
    desired: readDesiredValues(value.desired),
    createdAt: readIsoTimestamp(value.createdAt, 'Device setup createdAt'),
    updatedAt: readIsoTimestamp(value.updatedAt, 'Device setup updatedAt'),
  };
  if (owns(value, 'outputHint')) setup.outputHint = readOutputHint(value.outputHint);
  return setup;
};

const validateV2DeviceSetup = (value: JsonRecord): CustomDeviceSetup => {
  assertExactKeys(value, REQUIRED_V2_SETUP_KEYS, V2_SETUP_KEYS, 'Device setup');
  if (value.schemaVersion !== 2) throw new Error('Unsupported device setup schemaVersion.');
  if (value.profileId !== CUSTOM_CC_PROFILE_ID && value.profileId !== NINA_PROFILE.id) {
    throw new Error('Unsupported device setup profileId.');
  }
  if (!Number.isInteger(value.channel) || (value.channel as number) < 1 || (value.channel as number) > 16) {
    throw new Error('Device setup channel must be a whole number from 1 to 16.');
  }
  const setup: CustomDeviceSetup = {
    schemaVersion: 2,
    profileId: value.profileId,
    id: readBoundedText(value.id, 'Device setup id', MAX_SETUP_ID_LENGTH),
    name: readBoundedText(value.name, 'Device setup name', MAX_NAME_LENGTH),
    deviceName: readBoundedText(value.deviceName, 'Device name', MAX_NAME_LENGTH),
    channel: value.channel as number,
    slots: validateCcSlots(value.slots),
    createdAt: readIsoTimestamp(value.createdAt, 'Device setup createdAt'),
    updatedAt: readIsoTimestamp(value.updatedAt, 'Device setup updatedAt'),
  };
  if (owns(value, 'outputHint')) setup.outputHint = readOutputHint(value.outputHint);
  return setup;
};

const validateDeviceSetup = (value: unknown): StoredDeviceSetup => {
  if (!isRecord(value)) throw new Error('Device setup must be an object.');
  return value.schemaVersion === 2 ? validateV2DeviceSetup(value) : validateLegacyDeviceSetup(value);
};

export const parseDeviceSetup = (json: string): StoredDeviceSetup => {
  if (typeof json !== 'string') throw new Error('Device setup import must be JSON text.');
  return validateDeviceSetup(JSON.parse(json) as unknown);
};

export const serializeDeviceSetup = (setup: StoredDeviceSetup): string =>
  JSON.stringify(validateDeviceSetup(setup));

export class DeviceSetupStore {
  private readonly storage: SetupStorage;

  constructor(storage: SetupStorage = globalThis.localStorage) {
    this.storage = storage;
  }

  load(): StoredDeviceSetup[] {
    const stored = this.storage.getItem(DEVICE_SETUP_STORAGE_KEY);
    if (stored === null) return [];

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Stored device setups must be an array.');
    return parsed.map((setup) => validateDeviceSetup(setup));
  }

  save(setups: readonly StoredDeviceSetup[]): void {
    if (!Array.isArray(setups)) throw new Error('Device setups must be an array.');
    const validated: StoredDeviceSetup[] = [];
    for (let index = 0; index < setups.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(setups, index)) {
        throw new Error(`Device setup at index ${index} is missing.`);
      }
      validated.push(validateDeviceSetup(setups[index]));
    }
    this.storage.setItem(DEVICE_SETUP_STORAGE_KEY, JSON.stringify(validated));
  }
}
