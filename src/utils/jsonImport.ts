// JSON import utilities for OP-XY preset files
import { deepMerge, internalToPercent } from './valueConversions';
import type { AppState } from '../context/AppContext';
import { validatePresetJson as validatePresetObject } from './presetImport';

// Types for imported JSON structures
interface ImportedEngineSettings {
  playmode?: string;
  transpose?: number;
  'velocity.sensitivity'?: number;
  volume?: number;
  width?: number;
  highpass?: number;
  'portamento.amount'?: number;
  'portamento.type'?: number;
  'tuning.root'?: number;
  [key: string]: unknown;
}

interface ImportedEnvelopeSettings {
  amp?: Partial<AppState['multisampleSettings']['ampEnvelope']>;
  filter?: Partial<AppState['multisampleSettings']['filterEnvelope']>;
  [key: string]: unknown;
}

export interface ImportedPresetJson {
  engine?: ImportedEngineSettings;
  envelope?: ImportedEnvelopeSettings;
  fx?: unknown;
  lfo?: unknown;
  octave?: number;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

const playmodes: ReadonlySet<AppState['multisampleSettings']['playmode']> = new Set([
  'poly',
  'mono',
  'legato',
]);

function isPlaymode(value: unknown): value is AppState['multisampleSettings']['playmode'] {
  return typeof value === 'string' && playmodes.has(value as AppState['multisampleSettings']['playmode']);
}

function mergeEnvelope(
  current: AppState['multisampleSettings']['ampEnvelope'],
  imported: Partial<AppState['multisampleSettings']['ampEnvelope']> | undefined,
): AppState['multisampleSettings']['ampEnvelope'] {
  const merged = { ...current };
  if (!imported) return merged;

  (['attack', 'decay', 'sustain', 'release'] as const).forEach((key) => {
    if (typeof imported[key] === 'number') merged[key] = imported[key];
  });
  return merged;
}

export function hydrateMultisampleSettings(
  current: AppState['multisampleSettings'],
  imported: ImportedPresetJson,
): AppState['multisampleSettings'] {
  const settings: AppState['multisampleSettings'] = {
    ...current,
    ampEnvelope: mergeEnvelope(current.ampEnvelope, imported.envelope?.amp),
    filterEnvelope: mergeEnvelope(current.filterEnvelope, imported.envelope?.filter),
  };
  const engine = imported.engine;

  if (typeof imported.name === 'string' && imported.name) settings.presetName = imported.name;
  if (!engine) return settings;

  if (isPlaymode(engine.playmode)) settings.playmode = engine.playmode;
  if (typeof engine.transpose === 'number') settings.transpose = engine.transpose;
  if (typeof engine['velocity.sensitivity'] === 'number') {
    settings.velocitySensitivity = internalToPercent(engine['velocity.sensitivity']);
  }
  if (typeof engine.volume === 'number') settings.volume = internalToPercent(engine.volume);
  if (typeof engine.width === 'number') settings.width = internalToPercent(engine.width);
  if (typeof engine.highpass === 'number') settings.highpass = internalToPercent(engine.highpass);
  if (typeof engine['portamento.amount'] === 'number') {
    settings.portamentoAmount = internalToPercent(engine['portamento.amount']);
  }
  if (typeof engine['portamento.type'] === 'number') {
    settings.portamentoType = engine['portamento.type'] === 0 ? 'linear' : 'exponential';
  }
  if (typeof engine['tuning.root'] === 'number') settings.tuningRoot = engine['tuning.root'];

  return settings;
}

// Import drum preset JSON and convert to UI state
export function importDrumPresetJson(
  jsonContent: string,
  currentState: AppState
): Partial<AppState> {
  try {
    const parsed:unknown = JSON.parse(jsonContent);
    const validated=validatePresetObject(parsed,'drum');
    if(!validated.success||!validated.data)throw new Error(validated.error||'Invalid drum preset');
    const importedJson=validated.data as ImportedPresetJson;

    const updates: Partial<AppState> = {
      drumSettings: { ...currentState.drumSettings }
    };

    // Import preset name if available
    if (importedJson.name) {
      updates.drumSettings!.presetName = importedJson.name;
    }

    // Import engine settings and convert to UI format (0-100%)
    if (importedJson.engine) {
      const engine = importedJson.engine;
      const presetSettings = { ...currentState.drumSettings.presetSettings };

      if (isPlaymode(engine.playmode)) {
        presetSettings.playmode = engine.playmode;
      }
      if (typeof engine.transpose === 'number') {
        presetSettings.transpose = engine.transpose;
      }
      if (typeof engine['velocity.sensitivity'] === 'number') {
        presetSettings.velocity = internalToPercent(engine['velocity.sensitivity']);
      }
      if (typeof engine.volume === 'number') {
        presetSettings.volume = internalToPercent(engine.volume);
      }
      if (typeof engine.width === 'number') {
        presetSettings.width = internalToPercent(engine.width);
      }

      updates.drumSettings!.presetSettings = presetSettings;
    }

    // Store the full imported JSON for later merging during patch generation
    updates.importedDrumPreset = importedJson;

    return updates;
  } catch (error) {
    throw new Error(`Failed to import drum preset: ${error instanceof Error ? error.message : 'Invalid JSON'}`, { cause: error });
  }
}

// Import multisample preset JSON and convert to UI state
export function importMultisamplePresetJson(
  jsonContent: string,
  currentState: AppState
): Partial<AppState> {
  try {
    const parsed:unknown = JSON.parse(jsonContent);
    const validated=validatePresetObject(parsed,'multisampler');
    if(!validated.success||!validated.data)throw new Error(validated.error||'Invalid multisample preset');
    const importedJson=validated.data as ImportedPresetJson;

    return {
      multisampleSettings: hydrateMultisampleSettings(currentState.multisampleSettings, importedJson),
      importedMultisamplePreset: importedJson,
    };
  } catch (error) {
    throw new Error(`Failed to import multisample preset: ${error instanceof Error ? error.message : 'Invalid JSON'}`, { cause: error });
  }
}

// Merge imported preset settings with base JSON during patch generation
export function mergeImportedDrumSettings(baseJson: object, importedJson?: ImportedPresetJson | null): void {
  if (!importedJson) return;
  const mutableBase = baseJson as Record<string, unknown>;

  // Merge sections that should be preserved from imported preset
  const sectionsToMerge = ['engine', 'envelope', 'fx', 'lfo'] as const;
  
  sectionsToMerge.forEach(section => {
    if (importedJson[section]) {
      if (!mutableBase[section]) mutableBase[section] = {};
      deepMerge(mutableBase[section] as Record<string, unknown>, importedJson[section] as Record<string, unknown>);
    }
  });

  if (typeof importedJson.octave === 'number') mutableBase.octave = importedJson.octave;
}

// Merge imported multisample settings with base JSON during patch generation
export function mergeImportedMultisampleSettings(baseJson: object, importedJson?: ImportedPresetJson | null): void {
  if (!importedJson) return;
  const mutableBase = baseJson as Record<string, unknown>;

  // Merge sections that should be preserved from imported preset
  const sectionsToMerge = ['engine', 'envelope', 'fx', 'lfo'] as const;
  
  sectionsToMerge.forEach(section => {
    if (importedJson[section]) {
      if (!mutableBase[section]) mutableBase[section] = {};
      deepMerge(mutableBase[section] as Record<string, unknown>, importedJson[section] as Record<string, unknown>);
    }
  });

  if (typeof importedJson.octave === 'number') mutableBase.octave = importedJson.octave;
}

// Validate JSON file before import
export function validatePresetJson(jsonContent: string): { isValid: boolean; type?: string; error?: string } {
  try {
    const json:unknown = JSON.parse(jsonContent);
    if(!json||typeof json!=='object'||Array.isArray(json))return {isValid:false,error:'Invalid JSON format'};
    const type=(json as Record<string,unknown>).type;
    if(type!=='drum'&&type!=='multisampler')return {isValid:false,error:type===undefined?'Missing preset type':`Unsupported preset type: ${String(type)}`};
    const result=validatePresetObject(json,type);
    return result.success?{isValid:true,type}:{isValid:false,error:result.error};
  } catch {
    return { isValid: false, error: 'Invalid JSON format' };
  }
}
