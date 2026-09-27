import JSZip from 'jszip';
import { initialState, type AppState } from '../context/AppContext';
import type { LibraryPreset } from './libraryUtils';
import { deserializeLibraryPreset } from './libraryUtils';
import { buildDeviceExportPreflight, isMappedDrumSample } from './deviceExportPreflight';
import { allocateUniqueExportNames } from './exportPlanning';
import { generateDrumPatch, generateMultisamplePatch } from './patchGeneration';
import { sanitizeName } from './audio';

export interface BatchExportProgress { completed: number; total: number; name: string }
export interface BatchExportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: BatchExportProgress) => void;
  // The production path always uses the device exporter; injection makes archive failure testable.
  renderPreset?: (preset: LibraryPreset) => Promise<Blob>;
}

function checked(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Batch export canceled', 'AbortError');
}

export function libraryPresetFolderNames(presets: readonly Pick<LibraryPreset, 'name'>[]): string[] {
  return allocateUniqueExportNames(presets.map(preset => {
    let stem = sanitizeName(preset.name).trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, 64).trim();
    if (!stem || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = 'Preset';
    return `${stem}.preset`;
  }));
}

export async function renderSavedPreset(preset: LibraryPreset): Promise<Blob> {
  const project = await deserializeLibraryPreset(preset);
  const drumSamples: AppState['drumSamples'] = [...initialState.drumSamples];
  for (const sample of project.drumSamples) {
    if (!Number.isInteger(sample.originalIndex) || sample.originalIndex < 0 || sample.originalIndex > 100000)
      throw new Error(`Invalid saved pad in ${preset.name}`);
    drumSamples[sample.originalIndex] = sample;
  }
  const state: AppState = {
    ...initialState, ...project,
    drumSamples,
    drumSettings: { ...project.drumSettings, presetName: preset.name },
    multisampleSettings: { ...project.multisampleSettings, presetName: preset.name },
  };
  const instrument = preset.type;
  const preflight = buildDeviceExportPreflight(state, instrument);
  if (preflight.errors.length) throw new Error(`${preset.name}: ${preflight.errors.join(' ')}`);
  if (instrument === 'drum') {
    const exportState = { ...state, drumSamples: state.drumSamples.map((sample, index) =>
      sample?.isLoaded && isMappedDrumSample(sample, index) ? sample : { ...sample, isLoaded: false }) };
    const settings = state.drumSettings;
    return generateDrumPatch(exportState, preset.name, settings.sampleRate || undefined,
      settings.bitDepth || undefined, settings.channels === 1 ? 'mono' : 'keep', settings.audioFormat);
  }
  const settings = state.multisampleSettings;
  return generateMultisamplePatch(state, preset.name, settings.sampleRate || undefined,
    settings.bitDepth || undefined, settings.channels === 1 ? 'mono' : 'keep',
    settings.gain || 0, settings.audioFormat);
}

/** Build one extraction-ready ZIP. Caller downloads only after this resolves. */
export async function buildLibraryBatchArchive(presets: readonly LibraryPreset[], options: BatchExportOptions = {}): Promise<Blob> {
  if (!presets.length) throw new Error('Choose at least one preset to export');
  if (new Set(presets.map(preset => preset.id)).size !== presets.length) throw new Error('Duplicate preset in export');
  const outer = new JSZip();
  const folders = libraryPresetFolderNames(presets);
  const order: string[] = ['Preset order in this archive (for reference; device track order is not changed):'];
  for (let index = 0; index < presets.length; index++) {
    checked(options.signal);
    const preset = presets[index];
    options.onProgress?.({ completed: index, total: presets.length, name: preset.name });
    const rendered = await (options.renderPreset ?? renderSavedPreset)(preset);
    checked(options.signal);
    const inner = await JSZip.loadAsync(rendered);
    const entries = Object.values(inner.files).filter(entry => !entry.dir);
    if (!entries.some(entry => entry.name === 'patch.json')) throw new Error(`${preset.name}: device preset has no patch.json`);
    for (const entry of entries) {
      if (entry.name !== 'patch.json' && (!/^[^/\\]+\.(wav|aif|aiff)$/i.test(entry.name) || entry.name.startsWith('.')))
        throw new Error(`${preset.name}: unsafe device preset entry`);
      if (entry.name.includes('/') || entry.name.includes('\\'))
        throw new Error(`${preset.name}: unsafe device preset path`);
      outer.file(`${folders[index]}/${entry.name}`, await entry.async('uint8array'));
    }
    order.push(`${index + 1}. ${folders[index]}`);
    options.onProgress?.({ completed: index + 1, total: presets.length, name: preset.name });
  }
  outer.file('collection-order.txt', order.join('\n') + '\n');
  checked(options.signal);
  const result = await outer.generateAsync({ type: 'blob' });
  checked(options.signal);
  return result;
}
