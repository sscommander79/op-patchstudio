import { indexedDB } from './indexedDB';
import type { AppState, DrumSample, MultisampleFile } from '../context/AppContext';
import { sessionStorageIndexedDB } from './sessionStorageIndexedDB';
import { decodeStoredAudio, restoreSourceFile } from './storedAudio';
import { createProjectSnapshot, restoreProjectSettings } from './projectSerialization';
import type { RestoredProject } from './projectSerialization';
import { framesToSeconds, normalizeSecondRanges } from './loopEditing';
import {serializeAudioBounds,serializeLibraryAudioAsset} from './audioAssetSerialization';

// --- AudioBuffer <-> Blob utilities ---
// You must have a utility to convert AudioBuffer to WAV ArrayBuffer
import { audioBufferToWav } from './wavExport';

export async function audioBufferToWavBlob(audioBuffer: AudioBuffer): Promise<Blob> {
  return await audioBufferToWav(audioBuffer);
}

export async function blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
  return decodeStoredAudio(blob, audioContext);
}

// --- Strip AudioBuffer and replace with Blob for storage (preserving drum sample indexes) ---
interface StoredSampleMetadata {
  duration?: number;
  bitDepth?: number;
  sampleRate?: number;
  channels?: number;
  fileSize?: number;
  midiNote?: number;
  hasLoopData?: boolean;
  loopStart?: number;
  loopEnd?: number;
  format?: string;
  dataLength?: number;
}

export type StoredDrumSample = Partial<Omit<DrumSample, 'audioBuffer'>> & {
  audioBlob: Blob;
  originalIndex: number;
  name: string;
  metadata?: StoredSampleMetadata;
};

export type StoredMultisampleFile = Partial<Omit<MultisampleFile, 'audioBuffer'>> & {
  audioBlob: Blob;
  name: string;
  metadata?: StoredSampleMetadata;
};

export interface LibraryPresetData {
  drumSettings?: Partial<AppState['drumSettings']>;
  multisampleSettings?: Partial<AppState['multisampleSettings']>;
  drumSamples: StoredDrumSample[];
  multisampleFiles: StoredMultisampleFile[];
  importedDrumPreset?: AppState['importedDrumPreset'];
  importedMultisamplePreset?: AppState['importedMultisamplePreset'];
  midiNoteMapping?: AppState['midiNoteMapping'];
  selectedMultisample?: number | null;
}

async function prepareDrumSamplesForStorage(drumSamples: AppState['drumSamples']): Promise<StoredDrumSample[]> {
  if (!Array.isArray(drumSamples)) {
    return [];
  }
  
  const preparedSamples: StoredDrumSample[] = [];
  for (let index = 0; index < drumSamples.length; index++) {
    const sample = drumSamples[index];
    
    if (sample && sample.isLoaded && sample.audioBuffer) {
      const {audioBlob,audioBuffer,source:rest}=serializeLibraryAudioAsset(sample);
      const bounds=serializeAudioBounds(audioBuffer,{start:sample.inPoint,end:sample.outPoint});
      preparedSamples.push({
        ...rest,
        inPoint: bounds.sample.start,
        outPoint: bounds.sample.end,
        audioBlob,
        originalIndex: index, // Preserve the original index
        metadata: {
          duration: sample.duration,
          bitDepth: sample.originalBitDepth,
          sampleRate: sample.originalSampleRate,
          channels: sample.originalChannels,
          fileSize: sample.fileSize
        }
      });
    }
  }
  
  return preparedSamples;
}

// --- Strip AudioBuffer and replace with Blob for multisample files ---
async function prepareMultisampleFilesForStorage(multisampleFiles: AppState['multisampleFiles']): Promise<StoredMultisampleFile[]> {
  if (!Array.isArray(multisampleFiles)) {
    return [];
  }
  
  const preparedFiles: StoredMultisampleFile[] = [];
  for (const file of multisampleFiles) {
    if (file && file.isLoaded && file.audioBuffer) {
      const {audioBlob,audioBuffer,source:rest}=serializeLibraryAudioAsset(file);
      const bounds=serializeAudioBounds(audioBuffer,{start:file.inPoint,end:file.outPoint},{start:file.loopStart,end:file.loopEnd});
      preparedFiles.push({
        ...rest,
        inPoint: bounds.sample.start,
        outPoint: bounds.sample.end,
        loopStart: bounds.loop!.start,
        loopEnd: bounds.loop!.end,
        audioBlob,
        metadata: {
          // Basic WAV properties
          duration: file.duration,
          bitDepth: file.originalBitDepth,
          sampleRate: file.originalSampleRate,
          channels: file.originalChannels,
          fileSize: file.fileSize,
          // MIDI note information
          midiNote: file.rootNote,
          // Loop information
          hasLoopData: true, // We always have loop data since we set defaults
          loopStart: bounds.loop!.start,
          loopEnd: bounds.loop!.end,
          // Format information
          format: 'PCM',
          dataLength: file.fileSize || 0
        }
      });
    }
  }
  return preparedFiles;
}

// Enhanced PresetData interface for library
export interface LibraryPreset {
  id: string;
  name: string;
  type: 'drum' | 'multisample';
  data: LibraryPresetData;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  tags?: string[];
  description?: string;
  sampleCount?: number; // Number of samples in the preset
}

export async function savePresetToLibrary(
  state: AppState,
  presetName: string,
  type: 'drum' | 'multisample'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!presetName.trim()) {
      return {
        success: false,
        error: 'please enter a preset name before saving'
      };
    }

    state = {...state, ...createProjectSnapshot(state)};
    // Serialize only the selected instrument. Legacy combined payloads remain readable.
    const drumSamples = type === 'drum' ? await prepareDrumSamplesForStorage(state.drumSamples) : [];
    const multisampleFiles = type === 'multisample' ? await prepareMultisampleFilesForStorage(state.multisampleFiles) : [];
    const presetData: LibraryPresetData = type === 'drum'
      ? {drumSettings:state.drumSettings,drumSamples,multisampleFiles:[],importedDrumPreset:state.importedDrumPreset,midiNoteMapping:state.midiNoteMapping}
      : {multisampleSettings:state.multisampleSettings,multisampleFiles,drumSamples:[],importedMultisamplePreset:state.importedMultisamplePreset,
        midiNoteMapping:state.midiNoteMapping,selectedMultisample:state.selectedMultisample};
    
    const preset: LibraryPreset = {
      id: crypto.randomUUID(),
      name: presetName,
      type,
      data: presetData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false,
      sampleCount: type === 'drum' 
        ? drumSamples.length // Now this counts actual loaded samples
        : multisampleFiles.filter(f => f && f.isLoaded).length
    };

    await indexedDB.savePreset(preset);

    // The preset transaction is already committed. This optional marker must not
    // turn a successful save into a reported failure and encourage duplicate retries.
    try { await sessionStorageIndexedDB.markSessionAsSavedToLibrary(); }
    catch (error) { console.warn('Preset saved; optional session marker could not be updated:', error); }

    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to save preset:', error);
    return {
      success: false,
      error: 'failed to save preset to library'
    };
  }
}

export async function resetAllSettings(
  _state: AppState,
  type: 'drum' | 'multisample'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (type === 'drum') {
      // Reset drum settings to defaults
      // This would need to be implemented based on your default values
      // For now, we'll just return success
      return { success: true };
    } else {
      // Reset multisample settings to defaults
      // This would need to be implemented based on your default values
      // For now, we'll just return success
      return { success: true };
    }
  } catch (error) {
    console.error('Failed to reset settings:', error);
    return {
      success: false,
      error: 'failed to reset settings'
    };
  }
}
/** Decode every required sample before returning a single atomic editor update. */
export function restoreLibrarySamples(samples: StoredDrumSample[], mode: 'drum', legacyContext?: AudioContext): Promise<Array<DrumSample & {originalIndex:number}>>;
export function restoreLibrarySamples(samples: StoredMultisampleFile[], mode: 'multisample', legacyContext?: AudioContext): Promise<MultisampleFile[]>;
export async function restoreLibrarySamples(
  samples: Array<StoredDrumSample | StoredMultisampleFile>,
  mode: 'drum' | 'multisample',
  legacyContext?: AudioContext,
): Promise<Array<(DrumSample & {originalIndex:number}) | MultisampleFile>> {
  if (!Array.isArray(samples)) throw new Error('Invalid library samples');
  const restored = await Promise.all(samples.map(async (candidate) => {
    const sample = mode === 'drum' ? candidate as StoredDrumSample : candidate as StoredMultisampleFile;
    if (!sample?.audioBlob) throw new Error('Library sample audio is missing');
    if (mode === 'drum') {
      const index = (sample as StoredDrumSample).originalIndex;
      if (!Number.isInteger(index) || index < 0 || index > 100000) throw new Error('Invalid library sample index');
    }
    const audioBuffer = await decodeStoredAudio(sample.audioBlob, legacyContext);
    const {audioBlob, ...rest} = sample;
    const file = restoreSourceFile(sample.file, sample.file?.name ?? sample.name, audioBlob, audioBuffer, sample.file?.lastModified);
    const bounds = normalizeSecondRanges(audioBuffer.length, audioBuffer.sampleRate,
      { start: sample.inPoint, end: sample.outPoint },
      mode === 'multisample' ? { start: (sample as StoredMultisampleFile).loopStart, end: (sample as StoredMultisampleFile).loopEnd } : undefined);
    return {...rest, file, audioBuffer, isLoaded:true,
      inPoint:framesToSeconds(bounds.sample.start,audioBuffer.sampleRate),outPoint:framesToSeconds(bounds.sample.end,audioBuffer.sampleRate),
      ...(mode === 'multisample' ? {loopStart:framesToSeconds(bounds.loop.start,audioBuffer.sampleRate),loopEnd:framesToSeconds(bounds.loop.end,audioBuffer.sampleRate)} : {}),
      originalBitDepth: sample.originalBitDepth ?? sample.metadata?.bitDepth,
      originalSampleRate: sample.originalSampleRate ?? sample.metadata?.sampleRate,
      originalChannels: sample.originalChannels ?? sample.metadata?.channels,
      fileSize: sample.fileSize ?? sample.metadata?.fileSize ?? file.size, duration:sample.duration ?? audioBuffer.duration,
      ...(mode === 'drum' ? {isAssigned:(sample as StoredDrumSample).isAssigned ?? (sample as StoredDrumSample).originalIndex < 24,
        assignedKey:(sample as StoredDrumSample).isAssigned === false ? undefined : (sample as StoredDrumSample).assignedKey ?? ((sample as StoredDrumSample).originalIndex < 24 ? (sample as StoredDrumSample).originalIndex : undefined)} : {}),
    };
  }));
  return restored as Array<(DrumSample & {originalIndex:number}) | MultisampleFile>;
}

export async function deserializeLibraryPreset(preset: LibraryPreset): Promise<RestoredProject> {
  if (!preset.data || !['drum','multisample'].includes(preset.type)) throw new Error('Invalid library preset');
  const data = preset.data;
  return {...restoreProjectSettings({...data,
    drumSettings:data.drumSettings as AppState['drumSettings'],
    multisampleSettings:data.multisampleSettings as AppState['multisampleSettings'],
    drumSamples:[],multisampleFiles:[]}),
    drumSamples: preset.type === 'drum' ? await restoreLibrarySamples(data.drumSamples ?? [],'drum') : [],
    multisampleFiles: preset.type === 'multisample' ? await restoreLibrarySamples(data.multisampleFiles ?? [],'multisample') : [],
  };
}
