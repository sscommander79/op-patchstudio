// Import utilities for preset validation and conversion

export interface DrumPresetJson {
  type: 'drum';
  engine?: {
    bendrange?: number;
    'velocity.sensitivity'?: number;
    volume?: number;
    width?: number;
    playmode?: 'poly' | 'mono' | 'legato';
    transpose?: number;
    // Other engine properties that might exist
    [key: string]: unknown;
  };
  // Other patch properties
  [key: string]: unknown;
}

export interface MultisamplePresetJson {
  type: 'multisampler';
  engine?: {
    bendrange?: number;
    'velocity.sensitivity'?: number;
    volume?: number;
    width?: number;
    // Other engine properties that might exist
    [key: string]: unknown;
  };
  // Other patch properties
  [key: string]: unknown;
}

export type PresetJson = DrumPresetJson | MultisamplePresetJson;

export interface ImportResult {
  success: boolean;
  data?: PresetJson;
  error?: string;
}

export const PRESET_IMPORT_LIMITS={bytes:2*1024*1024,depth:32,values:10_000,stringBytes:1024*1024} as const;
const forbiddenKeys=new Set(['__proto__','prototype','constructor']);
const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
function fail(error:string):ImportResult{return {success:false,error}}
function number(value:unknown,min:number,max:number,label:string,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`Invalid ${label}`)}
function boundedJson(value:unknown,depth=0,counter={values:0}):void {
  if(depth>PRESET_IMPORT_LIMITS.depth)throw new Error('Preset is too deeply nested');if(++counter.values>PRESET_IMPORT_LIMITS.values)throw new Error('Preset contains too many values');
  if(value===null||typeof value==='boolean')return;if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Preset contains a non-finite number');return;}
  if(typeof value==='string'){if(new TextEncoder().encode(value).length>PRESET_IMPORT_LIMITS.stringBytes)throw new Error('Preset contains an oversized string');return;}
  if(Array.isArray(value)){for(const item of value)boundedJson(item,depth+1,counter);return;}if(!plain(value))throw new Error('Preset contains an unsupported value');
  for(const [key,item] of Object.entries(value)){if(forbiddenKeys.has(key))throw new Error(`Preset contains forbidden key "${key}"`);boundedJson(item,depth+1,counter);}
}
function validateKnown(data:Record<string,unknown>):void {
  const engine=data.engine;if(engine===undefined)return validateKnownWithoutEngine(data);if(!plain(engine))throw new Error('Invalid "engine" field');
  if(engine.playmode!==undefined&&(typeof engine.playmode!=='string'||!['poly','mono','legato'].includes(engine.playmode)))throw new Error('Invalid engine.playmode');
  const internal=['bendrange','velocity.sensitivity','volume','width','highpass','portamento.amount'] as const;for(const key of internal)if(engine[key]!==undefined)number(engine[key],0,32767,`engine.${key}`);
  if(engine.transpose!==undefined)number(engine.transpose,-48,48,'engine.transpose');if(engine['portamento.type']!==undefined)number(engine['portamento.type'],0,32767,'engine.portamento.type');if(engine['tuning.root']!==undefined)number(engine['tuning.root'],0,11,'engine.tuning.root',true);
  if(data.name!==undefined&&(typeof data.name!=='string'||data.name.length>256))throw new Error('Invalid preset name');if(data.octave!==undefined)number(data.octave,-8,8,'octave',true);
  if(data.envelope!==undefined){if(!plain(data.envelope))throw new Error('Invalid envelope');for(const section of ['amp','filter'] as const){const envelope=data.envelope[section];if(envelope===undefined)continue;if(!plain(envelope))throw new Error(`Invalid envelope.${section}`);for(const key of ['attack','decay','sustain','release'] as const)if(envelope[key]!==undefined)number(envelope[key],0,32767,`envelope.${section}.${key}`,true);}}
  for(const key of ['fx','lfo'] as const)if(data[key]!==undefined&&!plain(data[key]))throw new Error(`Invalid ${key}`);
}
function validateKnownWithoutEngine(data:Record<string,unknown>):void {
  if(data.name!==undefined&&(typeof data.name!=='string'||data.name.length>256))throw new Error('Invalid preset name');if(data.octave!==undefined)number(data.octave,-8,8,'octave',true);
  if(data.envelope!==undefined){if(!plain(data.envelope))throw new Error('Invalid envelope');for(const section of ['amp','filter'] as const){const envelope=data.envelope[section];if(envelope===undefined)continue;if(!plain(envelope))throw new Error(`Invalid envelope.${section}`);for(const key of ['attack','decay','sustain','release'] as const)if(envelope[key]!==undefined)number(envelope[key],0,32767,`envelope.${section}.${key}`,true);}}
  for(const key of ['fx','lfo'] as const)if(data[key]!==undefined&&!plain(data[key]))throw new Error(`Invalid ${key}`);
}
function immutable<T>(value:T):T {if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value as Record<string,unknown>))immutable(item);}return value;}

export function validatePresetJson(jsonData: unknown, expectedType: 'drum' | 'multisampler'): ImportResult {
  try {
    // Check if it's a valid object
    if (!plain(jsonData)) return fail('Invalid JSON format');
    boundedJson(jsonData);

    // Check type field
    if (!jsonData.type) {
      return {
        success: false,
        error: 'Missing "type" field in JSON'
      };
    }

    // Validate type matches expected
    if (jsonData.type !== expectedType) {
      let message = '';

      if (expectedType === 'drum' && jsonData.type === 'multisampler') {
        message = 'This is a multisample preset, but you\'re trying to import it into the drum tool. Please switch to the multisample tab to import this preset.';
      } else if (expectedType === 'multisampler' && jsonData.type === 'drum') {
        message = 'This is a drum preset, but you\'re trying to import it into the multisample tool. Please switch to the drum tab to import this preset.';
      } else {
        // Fallback for unknown types
        const actualType = jsonData.type === 'drum' ? 'drum' :
                          jsonData.type === 'multisampler' ? 'multisampler' :
                          jsonData.type;
        const expectedTypeName = expectedType === 'drum' ? 'drum' : 'multisampler';
        message = `This preset file has type "${actualType}" but we expected a "${expectedTypeName}" preset. Please make sure you're using the correct preset file.`;
      }

      return {
        success: false,
        error: message
      };
    }

    validateKnown(jsonData);
    const preserved=immutable(structuredClone(jsonData)) as PresetJson;

    return {
      success: true,
      data: preserved
    };

  } catch (error) {
    return {
      success: false,
      error: `JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function importPresetFromFile(file: File, expectedType: 'drum' | 'multisampler', retainedPreset?:unknown): Promise<ImportResult> {
  try {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      return {
        success: false,
        error: 'File must be a JSON file (.json)'
      };
    }

    if(file.size>PRESET_IMPORT_LIMITS.bytes)return fail('Preset JSON exceeds the 2 MiB limit');
    const text = typeof file.text==='function'?await file.text():new TextDecoder().decode(await file.arrayBuffer());
    const combinedBytes=new TextEncoder().encode(text).length+(retainedPreset===undefined?0:new TextEncoder().encode(JSON.stringify(retainedPreset)).length);
    if(combinedBytes>PRESET_IMPORT_LIMITS.bytes)return fail('Combined imported preset settings exceed the 2 MiB manifest limit');

    // Parse JSON
    let jsonData: unknown;
    try {
      jsonData = JSON.parse(text);
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Parse error'}`
      };
    }

    // Validate the preset
    return validatePresetJson(jsonData, expectedType);

  } catch (error) {
    return {
      success: false,
      error: `File reading error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper function to convert internal values to UI percentages
export function internalToPercent(internal: number): number {
  return Math.round((internal / 32767) * 100);
}

// Extract settings from imported preset for UI
export function extractDrumSettings(preset: DrumPresetJson) {
  const engine = preset.engine ?? {};

  return {
    presetSettings: {
      playmode: engine.playmode || 'poly',
      transpose: engine.transpose || 0,
              velocity: engine['velocity.sensitivity'] ? internalToPercent(engine['velocity.sensitivity']) : 20,
              volume: engine.volume ? internalToPercent(engine.volume) : 69,
      width: engine.width ? internalToPercent(engine.width) : 0
    }
  };
}

// Note: Multisample presets don't have exposed UI settings like drums
// The engine settings are used during patch generation but not exposed in UI
// The imported preset is stored in context for use during patch generation
