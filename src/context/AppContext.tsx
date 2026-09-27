import { createContext, useContext, useReducer, useCallback } from 'react';
import { createHistory, reduceHistory } from '../utils/projectHistory';
import type { ReactNode } from 'react';
import type { AudioMetadata } from '../utils/audioFormats';
import { midiNoteToString, parseFilename } from '../utils/audio';
import type { Notification } from '../components/common/NotificationSystem';
import { cookieUtils, COOKIE_KEYS } from '../utils/cookies';
import type { FilenameSeparator } from '../utils/constants';
import { loadDrumDefaultSettings, loadMultisampleDefaultSettings, loadDrumImportedPreset, loadMultisampleImportedPreset } from '../utils/defaultSettings';
import { applyZeroCrossingToMarkers } from '../utils/audio';
import { hydrateMultisampleSettings } from '../utils/jsonImport';
import type { ImportedPresetJson } from '../utils/jsonImport';
import type { RestoredProject } from '../utils/projectSerialization';
import { associateImportedCrossfades } from '../utils/importedCrossfade';
import { framesToSeconds, normalizeSecondRanges } from '../utils/loopEditing';
import { finalizeSliceApplication, type PreparedSliceApplication } from '../utils/audioSlicing';
import { finalizeRecordingApplication, type PreparedRecordingApplication } from '../utils/recordingApplication';
import { finalizeAudioImport, type PreparedAudioImport } from '../utils/audioImport';
import { extractDrumSettings, importPresetFromFile, type ImportResult } from '../utils/presetImport';
import { validateProjectArchiveMetadata } from '../utils/projectArchive';
import { finalizeStudioSeedOperation, type PreparedStudioSeedOperation } from '../utils/studioDemo';

// Define enhanced types for the application state
export interface DrumSample {
  file: File | null;
  audioBuffer: AudioBuffer | null;
  name: string;
  isLoaded: boolean;
  inPoint: number;
  outPoint: number;
  // WAV metadata from header parsing
  originalBitDepth?: number;
  originalSampleRate?: number;
  originalChannels?: number;
  fileSize?: number;
  duration?: number;
  isFloat?: boolean; // Whether sample is 32-bit float format
  // Sample settings
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  transpose: number; // -48 to +48 semitones
  pan: number; // -100 to +100
  gain: number; // -30 to +20 dB
  
  // Editing status
  hasBeenEdited: boolean;
  
  // Assignment status - for unassigned samples beyond the 24 drum keys
  isAssigned: boolean; // true if assigned to a drum key (0-23), false if unassigned
  assignedKey?: number; // the drum key index this sample is assigned to (0-23)
  /** Stable identity of an unedited source retained in the project. */
  sourceIdentity?: string;
  /** Original source coordinates; these are not relative to the derived slice buffer. */
  sliceProvenance?: {
    sourceIdentity: string;
    sourceName: string;
    startFrame: number;
    endFrame: number;
    sourceFrameCount: number;
    sourceSampleRate: number;
    sourceChannels: number;
  };
}

export interface MultisampleFile {
  file: File | null;
  audioBuffer: AudioBuffer | null;
  name: string;
  isLoaded: boolean;
  rootNote: number;
  note?: string; // Detected or assigned note (e.g., "C4", "F#3")
  inPoint: number;
  outPoint: number;
  loopStart: number;
  loopEnd: number;
  loopCrossfade?: LoopCrossfadeProvenance;
  // WAV metadata from header parsing
  originalBitDepth?: number;
  originalSampleRate?: number;
  originalChannels?: number;
  fileSize?: number;
  duration?: number;
  isFloat?: boolean; // Whether sample is 32-bit float format
  /** Stable identity of the original imported source. */
  sourceIdentity?: string;
}

export interface LoopCrossfadeProvenance {
  /** Display meaning as a fraction of the region's frame count. */
  fraction: number;
  /** Exact imported values are retained for provenance and portable round trips. */
  importedRaw?: number;
  importedFramecount?: number;
  sourceIdentity?: string;
}

export interface AppState {
  /** Increments only when the complete project is replaced. */
  projectGeneration?: number;
  // Current tab
  currentTab: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate';
  sliceCommitResult?: {operationId:string;status:'committed'|'rejected';error?:string;assignedCount?:number;overflowCount?:number};
  recordingCommitResult?: {operationId:string;status:'committed'|'rejected';error?:string;appliedIds?:string[];retainedIds?:string[];assignedCount?:number;overflowCount?:number};
  importCommitResult?: {operationId:string;status:'committed'|'rejected';error?:string;appliedIds?:string[];retainedIds?:string[];assignedCount?:number;overflowCount?:number};
  studioSeedCommitResult?: {operationId:string;status:'committed'|'rejected';error?:string;assignedCount?:number;unassignedCount?:number;selectedIndex?:number|null};
  pendingPresetImport?: {operationId:string;expectedProjectGeneration:number};
  
  // Drum tool settings
  drumSettings: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    presetName: string;
    normalize: boolean;
    normalizeLevel: number; // -6.0 to 0.0 dB
    autoZeroCrossing: boolean; // Enable automatic zero-crossing detection
    renameFiles: boolean; // Whether to rename files with preset name
    filenameSeparator: FilenameSeparator; // Separator for filename parts
    audioFormat: 'wav' | 'aiff'; // Audio export format
    presetSettings: {
      playmode: 'poly' | 'mono' | 'legato';
      transpose: number; // -36 to +36
      velocity: number; // 0-100%
      volume: number; // 0-100%
      width: number; // 0-100%
    };
  };
  
  // Multisample tool settings
  multisampleSettings: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    presetName: string;
    normalize: boolean;
    normalizeLevel: number; // -6.0 to 0.0 dB
    autoZeroCrossing: boolean; // Enable automatic zero-crossing detection
    cutAtLoopEnd: boolean;
    gain: number; // -30 to +20 dB
    loopEnabled: boolean;
    loopOnRelease: boolean;
    renameFiles: boolean; // Whether to rename files with preset name
    filenameSeparator: FilenameSeparator; // Separator for filename parts
    audioFormat: 'wav' | 'aiff'; // Audio export format
    // Advanced settings
    playmode: 'poly' | 'mono' | 'legato';
    transpose: number; // -36 to +36
    velocitySensitivity: number; // 0-100%
    volume: number; // 0-100%
    width: number; // 0-100%
    highpass: number; // 0-100%
    portamentoType: 'linear' | 'exponential';
    portamentoAmount: number; // 0-100%
    tuningRoot: number; // 0-11 (C to B)
    ampEnvelope: {
      attack: number; // 0-32767
      decay: number; // 0-32767
      sustain: number; // 0-32767
      release: number; // 0-32767
    };
    filterEnvelope: {
      attack: number; // 0-32767
      decay: number; // 0-32767
      sustain: number; // 0-32767
      release: number; // 0-32767
    };
  };
  
  // Drum samples (24 samples for full OP-XY compatibility)
  drumSamples: DrumSample[];
  
  // Multisample files
  multisampleFiles: MultisampleFile[];
  selectedMultisample: number | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  isDrumKeyboardPinned: boolean;
  isMultisampleKeyboardPinned: boolean;
  
  // Notifications
  notifications: Notification[];
  
  // Imported preset settings (for patch generation)
  importedDrumPreset: ImportedPresetJson | null;
  importedMultisamplePreset: ImportedPresetJson | null;
  
  // Session management
  sessionSaveStatus?: 'checking' | 'idle' | 'saving' | 'saved' | 'error';
  sessionSaveError?: string | null;
  sessionLastSavedAt?: number | null;
  sessionRecoveryResolved?: boolean;
  isSessionRestorationModalOpen: boolean;
  sessionInfo: { timestamp: number; drumSamplesCount: number; multisampleFilesCount: number } | null;
  
  // MIDI note mapping convention
  midiNoteMapping: 'C3' | 'C4';
}

// Define enhanced action types
export type AppAction = 
  | {type:'UNDO' | 'REDO'}
  | {type:'BUMP_PROJECT_GENERATION'}
  | {type:'BEGIN_EDIT' | 'END_EDIT' | 'CANCEL_EDIT'; payload:string}
  | {type:'BATCH_EDIT'; payload:AppAction[]}
  | {type:'IMPORT_PROJECT'; payload:RestoredProject}
  | { type: 'SET_TAB'; payload: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate' }
  | { type: 'SET_DRUM_SAMPLE_RATE'; payload: number }
  | { type: 'SET_DRUM_BIT_DEPTH'; payload: number }
  | { type: 'SET_DRUM_CHANNELS'; payload: number }
  | { type: 'SET_DRUM_PRESET_NAME'; payload: string }
  | { type: 'SET_DRUM_NORMALIZE'; payload: boolean }
  | { type: 'SET_DRUM_NORMALIZE_LEVEL'; payload: number }
  | { type: 'SET_DRUM_AUTO_ZERO_CROSSING'; payload: boolean }
  | { type: 'SET_DRUM_RENAME_FILES'; payload: boolean }
  | { type: 'SET_DRUM_FILENAME_SEPARATOR'; payload: FilenameSeparator }
  | { type: 'SET_DRUM_AUDIO_FORMAT'; payload: 'wav' | 'aiff' }
  | { type: 'SET_DRUM_PRESET_PLAYMODE'; payload: 'poly' | 'mono' | 'legato' }
  | { type: 'SET_DRUM_PRESET_TRANSPOSE'; payload: number }
  | { type: 'SET_DRUM_PRESET_VELOCITY'; payload: number }
  | { type: 'SET_DRUM_PRESET_VOLUME'; payload: number }
  | { type: 'SET_DRUM_PRESET_WIDTH'; payload: number }
  | { type: 'SET_MULTISAMPLE_SAMPLE_RATE'; payload: number }
  | { type: 'SET_MULTISAMPLE_BIT_DEPTH'; payload: number }
  | { type: 'SET_MULTISAMPLE_CHANNELS'; payload: number }
  | { type: 'SET_MULTISAMPLE_PRESET_NAME'; payload: string }
  | { type: 'SET_MULTISAMPLE_NORMALIZE'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL'; payload: number }
  | { type: 'SET_MULTISAMPLE_AUTO_ZERO_CROSSING'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_RENAME_FILES'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_FILENAME_SEPARATOR'; payload: FilenameSeparator }
  | { type: 'SET_MULTISAMPLE_AUDIO_FORMAT'; payload: 'wav' | 'aiff' }
  | { type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_GAIN'; payload: number }
  | { type: 'SET_MULTISAMPLE_LOOP_ENABLED'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_PLAYMODE'; payload: 'poly' | 'mono' | 'legato' }
  | { type: 'SET_MULTISAMPLE_TRANSPOSE'; payload: number }
  | { type: 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY'; payload: number }
  | { type: 'SET_MULTISAMPLE_VOLUME'; payload: number }
  | { type: 'SET_MULTISAMPLE_WIDTH'; payload: number }
  | { type: 'SET_MULTISAMPLE_HIGHPASS'; payload: number }
  | { type: 'SET_MULTISAMPLE_PORTAMENTO_TYPE'; payload: 'linear' | 'exponential' }
  | { type: 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT'; payload: number }
  | { type: 'SET_MULTISAMPLE_TUNING_ROOT'; payload: number }
  | { type: 'SET_MULTISAMPLE_AMP_ENVELOPE'; payload: { attack: number; decay: number; sustain: number; release: number } }
  | { type: 'SET_MULTISAMPLE_FILTER_ENVELOPE'; payload: { attack: number; decay: number; sustain: number; release: number } }
  | { type: 'APPLY_ZERO_CROSSING_TO_DRUM_SAMPLE'; payload: number }
  | { type: 'APPLY_ZERO_CROSSING_TO_MULTISAMPLE_FILE'; payload: number }
  | { type: 'APPLY_ZERO_CROSSING_TO_ALL_DRUM_SAMPLES' }
  | { type: 'APPLY_ZERO_CROSSING_TO_ALL_MULTISAMPLE_FILES' }
  | { type: 'LOAD_DRUM_SAMPLE'; payload: { index: number; file: File; audioBuffer: AudioBuffer; metadata: AudioMetadata } }
  | { type: 'CLEAR_DRUM_SAMPLE'; payload: number }
  | { type: 'UPDATE_DRUM_SAMPLE'; payload: { index: number; updates: Partial<DrumSample> } }
  | { type: 'REORDER_DRUM_SAMPLES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SWAP_DRUM_SAMPLES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'ADD_UNASSIGNED_DRUM_SAMPLE'; payload: { file: File; audioBuffer: AudioBuffer; metadata: AudioMetadata } }
  | { type: 'STORE_DRUM_SAMPLE_ASSET'; payload: { sample: DrumSample; targetKeyIndex: number | null } }
  | { type: 'COMMIT_PREPARED_SLICES'; payload: {operationId:string;prepared:PreparedSliceApplication} }
  | { type: 'COMMIT_PREPARED_RECORDINGS'; payload: {operationId:string;prepared:PreparedRecordingApplication} }
  | { type: 'COMMIT_PREPARED_IMPORTS'; payload: {operationId:string;prepared:PreparedAudioImport} }
  | { type:'COMMIT_STUDIO_SEED'; payload:PreparedStudioSeedOperation }
  | { type: 'ASSIGN_DRUM_SAMPLE'; payload: { sampleIndex: number; targetKeyIndex: number } }
  | { type: 'UNASSIGN_DRUM_SAMPLE'; payload: number }
  | { type: 'IMPORT_OP1_DRUM_PRESET'; payload: { samples: Array<{ keyIndex: number; file: File; audioBuffer: AudioBuffer; metadata: AudioMetadata; name: string }>; presetName: string } }
  | { type: 'LOAD_MULTISAMPLE_FILE'; payload: { file: File; audioBuffer: AudioBuffer | null; metadata: AudioMetadata; rootNoteOverride?: number; } }
  | { type: 'CLEAR_MULTISAMPLE_FILE'; payload: number }
  | { type: 'UPDATE_MULTISAMPLE_FILE'; payload: { index: number; updates: Partial<MultisampleFile> } }
  | { type: 'REORDER_MULTISAMPLE_FILES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SET_SELECTED_MULTISAMPLE'; payload: number | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_IMPORTED_DRUM_PRESET'; payload: ImportedPresetJson | null }
  | { type: 'SET_IMPORTED_MULTISAMPLE_PRESET'; payload: ImportedPresetJson | null }
  | { type: 'IMPORT_MULTISAMPLE_PRESET'; payload: ImportedPresetJson }
  | { type: 'BEGIN_PRESET_IMPORT'; payload: {operationId:string} }
  | { type: 'COMMIT_PRESET_IMPORT'; payload: {operationId:string;instrument:'drum'|'multisample';result:ImportResult} }
  | { type: 'TOGGLE_DRUM_KEYBOARD_PIN' }
  | { type: 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN' }
  | { type: 'RESTORE_SESSION'; payload: Omit<RestoredProject, 'importedDrumPreset' | 'importedMultisamplePreset' | 'midiNoteMapping'> & Partial<Pick<RestoredProject, 'importedDrumPreset' | 'importedMultisamplePreset' | 'midiNoteMapping'>> }
  | { type: 'RESTORE_LIBRARY'; payload: { mode: 'drum' | 'multisample'; project: RestoredProject } }
  | { type: 'SET_SESSION_SAVE_STATUS'; payload: { status: NonNullable<AppState['sessionSaveStatus']>; error?: string | null; lastSavedAt?: number | null } }
  | { type: 'SET_SESSION_RESTORATION_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_SESSION_INFO'; payload: { timestamp: number; drumSamplesCount: number; multisampleFilesCount: number } | null }
  | { type: 'SET_SESSION_RECOVERY_RESOLVED'; payload: boolean }
  | { type: 'SET_MIDI_NOTE_MAPPING'; payload: 'C3' | 'C4' }
  | { type: 'UPDATE_ALL_MULTI_SAMPLES'; payload: Partial<MultisampleFile> }
  | { type: 'UPDATE_ALL_DRUM_SAMPLES'; payload: Partial<DrumSample> }
  | { type: 'CLEAR_ALL_DRUM_SAMPLES' };

// Initial state for drum samples
const initialDrumSample: DrumSample = {
  file: null,
  audioBuffer: null,
  name: '',
  isLoaded: false,
  inPoint: 0,
  outPoint: 0,
  playmode: 'oneshot',
  reverse: false,
      transpose: 0,
  pan: 0,
  gain: 0,
  hasBeenEdited: false,
  isAssigned: false, // Default to unassigned - will be set appropriately based on context
  assignedKey: undefined
};

// Helper function to create a drum sample with proper assignment state
const createDrumSample = (index: number, isAssigned: boolean = false): DrumSample => ({
  ...initialDrumSample,
  isAssigned,
  assignedKey: isAssigned ? index : undefined
});

const initialMultisampleFile: MultisampleFile = {
  file: null,
  audioBuffer: null,
  name: '',
  isLoaded: false,
  rootNote: 60, // Middle C
  inPoint: 0,
  outPoint: 0,
  loopStart: 0,
  loopEnd: 0,
  // Metadata fields with default values
  originalBitDepth: 16,
  originalSampleRate: 44100,
  originalChannels: 2,
  fileSize: 0,
  duration: 0,
  isFloat: false
};

// Function to get initial tab from cookie
const getInitialTab = (): 'drum' | 'multisample' | 'feedback' | 'library' | 'donate' => {
  try {
    const savedTab = cookieUtils.getCookie(COOKIE_KEYS.LAST_TAB);
    if (savedTab === 'multisample') return 'multisample';
    if (savedTab === 'feedback') return 'feedback';
    if (savedTab === 'library') return 'library';
    if (savedTab === 'donate') return 'donate';
    return 'drum';
  } catch (error) {
    console.warn('Failed to load saved tab from cookie, defaulting to drum tab:', error);
    return 'drum';
  }
};

// Function to get initial pin state from cookie
const getInitialPinState = (key: string): boolean => {
  try {
    const savedPinState = cookieUtils.getCookie(key);
    return savedPinState === 'true';
  } catch (error) {
    console.warn(`Failed to load pin state from cookie for key: ${key}`, error);
    return false;
  }
}

// Function to get initial MIDI note mapping from cookie
const getInitialMidiMapping = (): 'C3' | 'C4' => {
  try {
    const savedMapping = cookieUtils.getCookie(COOKIE_KEYS.MIDI_NOTE_MAPPING);
    return savedMapping === 'C4' ? 'C4' : 'C3';
  } catch (error) {
    console.warn('Failed to load MIDI note mapping from cookie, defaulting to C3', error);
    return 'C3';
  }
}

const initialState: AppState = {
  projectGeneration: 0,
  currentTab: getInitialTab(),
  drumSettings: loadDrumDefaultSettings(),
  multisampleSettings: loadMultisampleDefaultSettings(),
  drumSamples: Array.from({ length: 24 }, (_, index) => createDrumSample(index, true)), // First 24 slots are assigned to their respective keys
  multisampleFiles: [], // Dynamic array, 1-24 samples max
  selectedMultisample: null,
  isLoading: false,
  error: null,
  isDrumKeyboardPinned: getInitialPinState(COOKIE_KEYS.DRUM_KEYBOARD_PINNED),
  isMultisampleKeyboardPinned: getInitialPinState(COOKIE_KEYS.MULTISAMPLE_KEYBOARD_PINNED),
  notifications: [],
  importedDrumPreset: loadDrumImportedPreset(),
  importedMultisamplePreset: loadMultisampleImportedPreset(),
  isSessionRestorationModalOpen: false,
  sessionInfo: null,
  sessionSaveStatus: 'checking',
  sessionSaveError: null,
  sessionLastSavedAt: null,
  sessionRecoveryResolved: false,
  midiNoteMapping: getInitialMidiMapping()
};

// Enhanced reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'BUMP_PROJECT_GENERATION':
      return {...state,projectGeneration:(state.projectGeneration??0)+1,pendingPresetImport:undefined};
    case 'SET_TAB':
      // Save tab to cookie for persistence
      try {
        cookieUtils.setCookie(COOKIE_KEYS.LAST_TAB, action.payload, 30);
      } catch (error) {
        console.warn('Failed to save tab to cookie:', error);
      }
      return { ...state, currentTab: action.payload };
      
    case 'SET_DRUM_SAMPLE_RATE':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, sampleRate: action.payload }
      };
      
    case 'SET_DRUM_BIT_DEPTH':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, bitDepth: action.payload }
      };
      
    case 'SET_DRUM_CHANNELS':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, channels: action.payload }
      };
      
    case 'SET_DRUM_PRESET_NAME':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, presetName: action.payload }
      };
      
    case 'SET_DRUM_NORMALIZE':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, normalize: action.payload }
      };
      
    case 'SET_DRUM_NORMALIZE_LEVEL':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, normalizeLevel: action.payload }
      };
      
    case 'SET_DRUM_AUTO_ZERO_CROSSING':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, autoZeroCrossing: action.payload }
      };
      
    case 'SET_DRUM_RENAME_FILES':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, renameFiles: action.payload }
      };
      
    case 'SET_DRUM_FILENAME_SEPARATOR':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, filenameSeparator: action.payload }
      };
      
    case 'SET_DRUM_AUDIO_FORMAT':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, audioFormat: action.payload }
      };
      
    case 'SET_DRUM_PRESET_PLAYMODE':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, playmode: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_TRANSPOSE':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, transpose: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_VELOCITY':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, velocity: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_VOLUME':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, volume: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_WIDTH':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, width: action.payload }
        }
      };
      
    case 'SET_MULTISAMPLE_SAMPLE_RATE':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, sampleRate: action.payload }
      };
      
    case 'SET_MULTISAMPLE_BIT_DEPTH':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, bitDepth: action.payload }
      };
      
    case 'SET_MULTISAMPLE_CHANNELS':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, channels: action.payload }
      };
      
    case 'SET_MULTISAMPLE_PRESET_NAME':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, presetName: action.payload }
      };
      
    case 'SET_MULTISAMPLE_NORMALIZE':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, normalize: action.payload }
      };
      
    case 'SET_MULTISAMPLE_NORMALIZE_LEVEL':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, normalizeLevel: action.payload }
      };
      
    case 'SET_MULTISAMPLE_AUTO_ZERO_CROSSING':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, autoZeroCrossing: action.payload }
      };
      
    case 'SET_MULTISAMPLE_RENAME_FILES':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, renameFiles: action.payload }
      };
      
    case 'SET_MULTISAMPLE_FILENAME_SEPARATOR':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, filenameSeparator: action.payload }
      };
      
    case 'SET_MULTISAMPLE_AUDIO_FORMAT':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, audioFormat: action.payload }
      };
      
    case 'SET_MULTISAMPLE_CUT_AT_LOOP_END':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, cutAtLoopEnd: action.payload }
      };
      
    case 'SET_MULTISAMPLE_GAIN':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, gain: action.payload }
      };
      
    case 'SET_MULTISAMPLE_LOOP_ENABLED':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, loopEnabled: action.payload }
      };
      
    case 'SET_MULTISAMPLE_LOOP_ON_RELEASE':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, loopOnRelease: action.payload }
      };
      
    case 'SET_MULTISAMPLE_PLAYMODE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          playmode: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_TRANSPOSE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          transpose: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          velocitySensitivity: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_VOLUME':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          volume: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_WIDTH':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          width: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_HIGHPASS':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          highpass: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_PORTAMENTO_TYPE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          portamentoType: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          portamentoAmount: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_TUNING_ROOT':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          tuningRoot: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_AMP_ENVELOPE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          ampEnvelope: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_FILTER_ENVELOPE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          filterEnvelope: action.payload
        }
      };
      
    case 'APPLY_ZERO_CROSSING_TO_DRUM_SAMPLE': {
      const sampleIndex = action.payload;
      const updatedDrumSamples = [...state.drumSamples];
      const sampleToApply = updatedDrumSamples[sampleIndex];

      if (!sampleToApply?.isLoaded) {
        console.error('Cannot apply zero-crossing to unloaded sample');
        return state;
      }

      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = sampleToApply.audioBuffer!.duration;
      
      // Apply zero-crossing detection if enabled
      let finalInPoint = initialInPoint;
      let finalOutPoint = initialOutPoint;
      
      if (state.drumSettings.autoZeroCrossing) {
        const result = applyZeroCrossingToMarkers(
          sampleToApply.audioBuffer!,
          initialInPoint,
          initialOutPoint
        );
        finalInPoint = result.inPoint;
        finalOutPoint = result.outPoint;
        

      }
      
      updatedDrumSamples[sampleIndex] = {
        ...sampleToApply,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        hasBeenEdited: true
      };
      
      return { ...state, drumSamples: updatedDrumSamples };
    }

    case 'APPLY_ZERO_CROSSING_TO_MULTISAMPLE_FILE': {
      const fileIndex = action.payload;
      const updatedMultisampleFiles = [...state.multisampleFiles];
      const fileToApply = updatedMultisampleFiles[fileIndex];

      if (!fileToApply?.isLoaded) {
        console.error('Cannot apply zero-crossing to unloaded multisample file');
        return state;
      }

      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = fileToApply.audioBuffer!.duration;
      const initialLoopStart = fileToApply.loopStart;
      const initialLoopEnd = fileToApply.loopEnd;
      
      // Apply zero-crossing detection if enabled
      let finalInPoint = initialInPoint;
      let finalOutPoint = initialOutPoint;
      let finalLoopStart = initialLoopStart;
      let finalLoopEnd = initialLoopEnd;
      
      if (state.multisampleSettings.autoZeroCrossing && fileToApply.audioBuffer) {
        const result = applyZeroCrossingToMarkers(
          fileToApply.audioBuffer,
          initialInPoint,
          initialOutPoint,
          initialLoopStart,
          initialLoopEnd
        );
        finalInPoint = result.inPoint;
        finalOutPoint = result.outPoint;
        finalLoopStart = result.loopStart ?? initialLoopStart;
        finalLoopEnd = result.loopEnd ?? initialLoopEnd;
        

      }
      
             updatedMultisampleFiles[fileIndex] = {
         ...fileToApply,
         inPoint: finalInPoint,
         outPoint: finalOutPoint,
         loopStart: finalLoopStart,
         loopEnd: finalLoopEnd
       };
      
      return { ...state, multisampleFiles: updatedMultisampleFiles };
    }

    case 'APPLY_ZERO_CROSSING_TO_ALL_DRUM_SAMPLES': {
      const updatedDrumSamples = state.drumSamples.map((sample) => {
        if (!sample.isLoaded || !sample.audioBuffer) return sample;
        const initialInPoint = 0;
        const initialOutPoint = sample.audioBuffer.duration;
        const result = applyZeroCrossingToMarkers(
          sample.audioBuffer,
          initialInPoint,
          initialOutPoint
        );
        return {
          ...sample,
          inPoint: result.inPoint,
          outPoint: result.outPoint,
          hasBeenEdited: true
        };
      });
      return { ...state, drumSamples: updatedDrumSamples };
    }
    case 'APPLY_ZERO_CROSSING_TO_ALL_MULTISAMPLE_FILES': {
      const updatedMultisampleFiles = state.multisampleFiles.map((file) => {
        if (!file.isLoaded || !file.audioBuffer) return file;
        const initialInPoint = 0;
        const initialOutPoint = file.audioBuffer.duration;
        const initialLoopStart = file.loopStart;
        const initialLoopEnd = file.loopEnd;
        const result = applyZeroCrossingToMarkers(
          file.audioBuffer,
          initialInPoint,
          initialOutPoint,
          initialLoopStart,
          initialLoopEnd
        );
        return {
          ...file,
          inPoint: result.inPoint,
          outPoint: result.outPoint,
          loopStart: result.loopStart ?? initialLoopStart,
          loopEnd: result.loopEnd ?? initialLoopEnd
        };
      });
      return { ...state, multisampleFiles: updatedMultisampleFiles };
    }
      
    case 'LOAD_DRUM_SAMPLE': {
      // Validate that audioBuffer exists and has required properties
      if (!action.payload.audioBuffer || typeof action.payload.audioBuffer.duration !== 'number') {
        console.error('Invalid audioBuffer provided to LOAD_DRUM_SAMPLE:', action.payload.audioBuffer);
        return state; // Return current state without changes
      }
      
      // Validate that metadata exists and has required properties
      if (!action.payload.metadata || typeof action.payload.metadata.duration !== 'number') {
        console.error('Invalid metadata provided to LOAD_DRUM_SAMPLE:', action.payload.metadata);
        return state; // Return current state without changes
      }
      
      // Validate index is within bounds (0-23 for 24 slots)
      if (action.payload.index < 0 || action.payload.index >= 24) {
        console.error('Invalid drum sample index:', action.payload.index);
        return state; // Return current state without changes
      }
      
      const newDrumSamples = [...state.drumSamples];
      
      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = action.payload.audioBuffer.duration;
      
      // Use initial marker positions (no automatic zero-crossing)
      const finalInPoint = initialInPoint;
      const finalOutPoint = initialOutPoint;
      
      newDrumSamples[action.payload.index] = {
        ...initialDrumSample,
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer,
        name: action.payload.file.name,
        isLoaded: true,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.file.size,
        duration: action.payload.audioBuffer.duration,
        isFloat: action.payload.metadata.isFloat,
        hasBeenEdited: false,
        isAssigned: true, // Assigned to the specific drum key (0-23)
        assignedKey: action.payload.index
      };
      
      return { ...state, drumSamples: newDrumSamples };
    }
      
    case 'CLEAR_DRUM_SAMPLE': {
      const clearedDrumSamples = [...state.drumSamples];
      // Reset to initial state but maintain proper assignment for the first 24 slots
      const isInFirst24Slots = action.payload < 24;
      clearedDrumSamples[action.payload] = createDrumSample(action.payload, isInFirst24Slots);
      return { ...state, drumSamples: clearedDrumSamples };
    }
      
    case 'UPDATE_DRUM_SAMPLE': {
      const updatedDrumSamples = [...state.drumSamples];
      updatedDrumSamples[action.payload.index] = {
        ...updatedDrumSamples[action.payload.index],
        ...action.payload.updates
      };
      return { ...state, drumSamples: updatedDrumSamples };
    }
    
    case 'REORDER_DRUM_SAMPLES': {
      const reorderedSamples = [...state.drumSamples];
      const [movedSample] = reorderedSamples.splice(action.payload.fromIndex, 1);
      reorderedSamples.splice(action.payload.toIndex, 0, movedSample);
      return { ...state, drumSamples: reorderedSamples };
    }
    
    case 'SWAP_DRUM_SAMPLES': {
      const { fromIndex, toIndex } = action.payload;
      const swappedSamples = [...state.drumSamples];
      
      // Swap the samples
      [swappedSamples[fromIndex], swappedSamples[toIndex]] = [swappedSamples[toIndex], swappedSamples[fromIndex]];
      
      // Update the assignedKey properties to reflect the new positions
      if (swappedSamples[fromIndex]?.isAssigned) {
        swappedSamples[fromIndex] = {
          ...swappedSamples[fromIndex],
          assignedKey: fromIndex
        };
      }
      if (swappedSamples[toIndex]?.isAssigned) {
        swappedSamples[toIndex] = {
          ...swappedSamples[toIndex],
          assignedKey: toIndex
        };
      }
      
      return { ...state, drumSamples: swappedSamples };
    }
    
    case 'ADD_UNASSIGNED_DRUM_SAMPLE': {
      // Validate that audioBuffer exists and has required properties
      if (!action.payload.audioBuffer || typeof action.payload.audioBuffer.duration !== 'number') {
        console.error('Invalid audioBuffer provided to ADD_UNASSIGNED_DRUM_SAMPLE:', action.payload.audioBuffer);
        return state;
      }
      
      // Validate that metadata exists and has required properties
      if (!action.payload.metadata || typeof action.payload.metadata.duration !== 'number') {
        console.error('Invalid metadata provided to ADD_UNASSIGNED_DRUM_SAMPLE:', action.payload.metadata);
        return state;
      }
      
      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = action.payload.audioBuffer.duration;
      
      // Use initial marker positions (no automatic zero-crossing)
      const finalInPoint = initialInPoint;
      const finalOutPoint = initialOutPoint;
      
      const newUnassignedSample: DrumSample = {
        ...createDrumSample(state.drumSamples.length, false), // Create as unassigned sample
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer,
        name: action.payload.file.name,
        isLoaded: true,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.file.size,
        duration: action.payload.audioBuffer.duration,
        isFloat: action.payload.metadata.isFloat,
        hasBeenEdited: false
      };
      
      return { ...state, drumSamples: [...state.drumSamples, newUnassignedSample] };
    }

    case 'STORE_DRUM_SAMPLE_ASSET': {
      const { sample, targetKeyIndex } = action.payload;
      if (!sample.isLoaded || !sample.audioBuffer || !sample.file || sample.audioBuffer.length < 1) return state;
      if (targetKeyIndex === null) {
        return { ...state, drumSamples: [...state.drumSamples, { ...sample, isAssigned: false, assignedKey: undefined }] };
      }
      if (!Number.isInteger(targetKeyIndex) || targetKeyIndex < 0 || targetKeyIndex >= 24 || state.drumSamples[targetKeyIndex]?.isLoaded) return state;
      const drumSamples = [...state.drumSamples];
      drumSamples[targetKeyIndex] = { ...sample, isAssigned: true, assignedKey: targetKeyIndex };
      return { ...state, drumSamples };
    }

    case 'COMMIT_PREPARED_SLICES': {
      try {
        const committed=finalizeSliceApplication(action.payload.prepared,state.drumSamples,[...state.drumSamples,...state.multisampleFiles]);
        const next=committed.actions.reduce(appReducer,state);
        const expectedStores=committed.actions.filter((candidate):candidate is Extract<AppAction,{type:'STORE_DRUM_SAMPLE_ASSET'}>=>candidate.type==='STORE_DRUM_SAMPLE_ASSET');
        const appliedStores=expectedStores.map(candidate=>{
          const {sample,targetKeyIndex}=candidate.payload;
          if(targetKeyIndex===null)return next.drumSamples.find(item=>item.audioBuffer===sample.audioBuffer&&item.file===sample.file&&!item.isAssigned);
          const applied=next.drumSamples[targetKeyIndex];
          return applied?.audioBuffer===sample.audioBuffer&&applied.file===sample.file&&applied.isAssigned&&applied.assignedKey===targetKeyIndex?applied:undefined;
        });
        if(appliedStores.some(sample=>!sample))throw new Error('The complete slice operation could not be committed. No slices were added; retry.');
        const expectedSlices=action.payload.prepared.actions.filter((candidate):candidate is Extract<AppAction,{type:'STORE_DRUM_SAMPLE_ASSET'}>=>candidate.type==='STORE_DRUM_SAMPLE_ASSET'&&Boolean(candidate.payload.sample.sliceProvenance));
        const appliedSlices=expectedSlices.map((candidate,index)=>{
          const sample=next.drumSamples.find(item=>item.audioBuffer===candidate.payload.sample.audioBuffer&&item.file===candidate.payload.sample.file);
          const target=action.payload.prepared.mapping?.[index];
          if(target!==undefined&&target!==null&&next.drumSamples[target]!==sample)return undefined;
          if(target===null&&sample?.isAssigned)return undefined;
          return sample;
        });
        const actualAssigned=appliedSlices.filter((sample):sample is DrumSample=>Boolean(sample?.isAssigned)).length;
        if(appliedSlices.some(sample=>!sample)||appliedSlices.length!==action.payload.prepared.ranges.length||actualAssigned!==committed.assignedCount) {
          throw new Error('The complete slice operation could not be committed. No slices were added; retry.');
        }
        if(action.payload.prepared.source.existingIndex!==null&&next.drumSamples[action.payload.prepared.source.existingIndex]?.sourceIdentity!==committed.sourceIdentity) {
          throw new Error('The slice source identity could not be committed. No slices were added; retry.');
        }
        validateProjectArchiveMetadata(next);
        return {...next,sliceCommitResult:{operationId:action.payload.operationId,status:'committed',assignedCount:committed.assignedCount,overflowCount:committed.overflowCount},notifications:[...next.notifications,{id:crypto.randomUUID(),type:'success',title:'slices applied',
          message:`${committed.assignedCount} assigned to keys${committed.overflowCount?`; ${committed.overflowCount} kept unassigned`:''}`}]};
      } catch(reason) {
        const message=reason instanceof Error?reason.message:'The project changed while slicing. No slices were added; retry.';
        return {...state,sliceCommitResult:{operationId:action.payload.operationId,status:'rejected',error:message},notifications:[...state.notifications,{id:crypto.randomUUID(),type:'error',title:'slices not applied',message}]};
      }
    }

    case 'COMMIT_PREPARED_RECORDINGS': {
      try {
        const committed=finalizeRecordingApplication(action.payload.prepared,state);
        if(!committed.appliedIds.length)throw new Error('No recording takes could be added; the review tray is unchanged.');
        const candidate={...state,drumSamples:committed.drumSamples,multisampleFiles:committed.multisampleFiles};
        validateProjectArchiveMetadata(candidate);
        return {...candidate,
          recordingCommitResult:{operationId:action.payload.operationId,status:'committed',appliedIds:committed.appliedIds,
            retainedIds:committed.retainedIds,assignedCount:committed.assignedCount,overflowCount:committed.overflowCount},
          notifications:[...state.notifications,{id:crypto.randomUUID(),type:'success',title:'recorded takes added',
            message:`${committed.appliedIds.length} take${committed.appliedIds.length===1?'':'s'} added${action.payload.prepared.instrument==='drum'&&committed.overflowCount?`; ${committed.overflowCount} kept unassigned`:''}${committed.retainedIds.length?`; ${committed.retainedIds.length} retained in review`:''}`} ]};
      } catch(reason) {
        const message=reason instanceof Error?reason.message:'The project changed while recordings were preparing. No takes were added.';
        return {...state,recordingCommitResult:{operationId:action.payload.operationId,status:'rejected',error:message},
          notifications:[...state.notifications,{id:crypto.randomUUID(),type:'error',title:'recorded takes not added',message}]};
      }
    }

    case 'COMMIT_PREPARED_IMPORTS': {
      try {
        const committed=finalizeAudioImport(action.payload.prepared,state);
        if(!committed.appliedIds.length)throw new Error('No reviewed files could be added; the import review is unchanged.');
        return {...state,drumSamples:committed.drumSamples,multisampleFiles:committed.multisampleFiles,
          importCommitResult:{operationId:action.payload.operationId,status:'committed',appliedIds:committed.appliedIds,retainedIds:committed.retainedIds,assignedCount:committed.assignedCount,overflowCount:committed.overflowCount},
          notifications:[...state.notifications,{id:crypto.randomUUID(),type:'success',title:'audio imported',message:`${committed.appliedIds.length} file${committed.appliedIds.length===1?'':'s'} added${committed.retainedIds.length?`; ${committed.retainedIds.length} retained in review`:''}`} ]};
      } catch(reason) {
        const message=reason instanceof Error?reason.message:'The project changed while importing. No files were added.';
        return {...state,importCommitResult:{operationId:action.payload.operationId,status:'rejected',error:message},notifications:[...state.notifications,{id:crypto.randomUUID(),type:'error',title:'audio not imported',message}]};
      }
    }

    case 'COMMIT_STUDIO_SEED': {
      try {
        const committed=finalizeStudioSeedOperation(state,action.payload);
        return {...state,projectGeneration:(state.projectGeneration??0)+1,drumSamples:committed.drumSamples,drumSettings:committed.drumSettings,
          importedDrumPreset:committed.importedDrumPreset,studioSeedCommitResult:{operationId:action.payload.operationId,status:'committed',
            assignedCount:committed.assignedCount,unassignedCount:committed.unassignedCount,selectedIndex:committed.selectedIndex},
          notifications:[...state.notifications,{id:crypto.randomUUID(),type:'success',title:'Studio Seed loaded',message:`${committed.assignedCount} sounds assigned${committed.unassignedCount?`; ${committed.unassignedCount} kept unassigned`:''}`} ]};
      } catch(reason) {
        const message=reason instanceof Error?reason.message:'Studio Seed could not be applied. Your project was kept.';
        return {...state,studioSeedCommitResult:{operationId:action.payload.operationId,status:'rejected',error:message},
          notifications:[...state.notifications,{id:crypto.randomUUID(),type:'error',title:'Studio Seed not loaded',message}]};
      }
    }
    
    case 'ASSIGN_DRUM_SAMPLE': {
      const { sampleIndex, targetKeyIndex } = action.payload;
      
      // Validate indices
      if (sampleIndex < 0 || sampleIndex >= state.drumSamples.length) {
        console.error('Invalid sample index:', sampleIndex);
        return state;
      }
      
      if (targetKeyIndex < 0 || targetKeyIndex >= 24) {
        console.error('Invalid target key index:', targetKeyIndex);
        return state;
      }
      
      const updatedDrumSamples = [...state.drumSamples];
      const sampleToAssign = updatedDrumSamples[sampleIndex];
      
      if (!sampleToAssign?.isLoaded) {
        console.error('Cannot assign unloaded sample');
        return state;
      }
      
      const targetSample=updatedDrumSamples[targetKeyIndex];
      updatedDrumSamples[targetKeyIndex] = {
        ...sampleToAssign,
        isAssigned: true,
        assignedKey: targetKeyIndex
      };
      if(targetSample?.isLoaded)updatedDrumSamples[sampleIndex]={...targetSample,isAssigned:false,assignedKey:undefined};
      else if(sampleIndex>=24)updatedDrumSamples.splice(sampleIndex,1);
      else updatedDrumSamples[sampleIndex]=createDrumSample(sampleIndex,true);
      
      return { ...state, drumSamples: updatedDrumSamples };
    }
    
    case 'UNASSIGN_DRUM_SAMPLE': {
      const sampleIndex = action.payload;
      
      if (sampleIndex < 0 || sampleIndex >= state.drumSamples.length) {
        console.error('Invalid sample index:', sampleIndex);
        return state;
      }
      
      const updatedDrumSamples = [...state.drumSamples];
      updatedDrumSamples[sampleIndex] = {
        ...updatedDrumSamples[sampleIndex],
        isAssigned: false,
        assignedKey: undefined
      };
      
      return { ...state, drumSamples: updatedDrumSamples };
    }
    
    case 'CLEAR_ALL_DRUM_SAMPLES': {
      // Reset drum samples array to just the first 24 slots with proper assignment
      const resetDrumSamples = Array.from({ length: 24 }, (_, index) => createDrumSample(index, true));
      return { ...state, drumSamples: resetDrumSamples };
    }
    
    case 'IMPORT_OP1_DRUM_PRESET': {
      // Start with existing drum samples
      const newDrumSamples = [...state.drumSamples];
      
      // Find the first available empty slot in the 0-23 range
      const findFirstEmptySlot = (samples: DrumSample[]): number | null => {
        for (let i = 0; i < 24; i++) {
          const sample = samples[i];
          // Only consider slot empty if no sample exists or sample is not loaded
          // Preserve unassigned samples (they should not be overwritten)
          if (!sample || !sample.isLoaded) {
            return i;
          }
        }
        return null; // No empty slots found
      };

      // Load samples from OP-1 preset
      for (const sample of action.payload.samples) {
        // Calculate initial marker positions
        const initialInPoint = 0;
        const initialOutPoint = sample.audioBuffer.duration;
        
        // Use initial marker positions (no automatic zero-crossing)
        const finalInPoint = initialInPoint;
        const finalOutPoint = initialOutPoint;
        
        // Try to find an empty slot in the 0-23 range
        const emptySlotIndex = findFirstEmptySlot(newDrumSamples);
        
        if (emptySlotIndex !== null) {
          // Found an empty slot, assign the sample there
          newDrumSamples[emptySlotIndex] = {
            ...createDrumSample(emptySlotIndex, true),
            file: sample.file,
            audioBuffer: sample.audioBuffer,
            name: sample.name,
            isLoaded: true,
            inPoint: finalInPoint,
            outPoint: finalOutPoint,
            originalBitDepth: sample.metadata.bitDepth,
            originalSampleRate: sample.metadata.sampleRate,
            originalChannels: sample.metadata.channels,
            fileSize: sample.file.size,
            duration: sample.audioBuffer.duration,
            isFloat: sample.metadata.isFloat,
            hasBeenEdited: false
          };
        } else {
          // No empty slots in 0-23, add as unassigned sample
          const unassignedSample = {
            ...createDrumSample(newDrumSamples.length, false),
            file: sample.file,
            audioBuffer: sample.audioBuffer,
            name: sample.name,
            isLoaded: true,
            inPoint: finalInPoint,
            outPoint: finalOutPoint,
            originalBitDepth: sample.metadata.bitDepth,
            originalSampleRate: sample.metadata.sampleRate,
            originalChannels: sample.metadata.channels,
            fileSize: sample.file.size,
            duration: sample.audioBuffer.duration,
            hasBeenEdited: false
          };
          newDrumSamples.push(unassignedSample);
        }
      }
      
      // Update preset name
      const updatedDrumSettings = {
        ...state.drumSettings,
        presetName: action.payload.presetName
      };
      
      return { 
        ...state, 
        drumSamples: newDrumSamples,
        drumSettings: updatedDrumSettings
      };
    }
      
    case 'LOAD_MULTISAMPLE_FILE': {
      // Validate that metadata exists and has required properties
      if (!action.payload.metadata || typeof action.payload.metadata.duration !== 'number') {
        console.error('Invalid metadata provided to LOAD_MULTISAMPLE_FILE:', action.payload.metadata);
        return state; // Return current state without changes
      }
      
      // Check max limit of 24 samples
      if (state.multisampleFiles.length >= 24) {
        return state;
      }
      
      // Auto-detect MIDI note from metadata or filename
      let detectedMidiNote = 60; // Default to middle C
      let detectedNote = 'C4'; // Default note name
      
      if (action.payload.rootNoteOverride !== undefined) {
        // Prioritize the override from user interaction (e.g., clicking a specific key)
        detectedMidiNote = action.payload.rootNoteOverride;
        detectedNote = midiNoteToString(detectedMidiNote, state.midiNoteMapping);
      } else if (action.payload.metadata.midiNote >= 0) {
        // Use MIDI note from metadata
        detectedMidiNote = action.payload.metadata.midiNote;
        detectedNote = midiNoteToString(action.payload.metadata.midiNote, state.midiNoteMapping);
      } else {
        // Try to extract from filename - look for note pattern at the end
        try {
          const [, midiFromParse] = parseFilename(action.payload.file.name, state.midiNoteMapping);
          if (midiFromParse >= 0 && midiFromParse <= 127) {
            detectedMidiNote = midiFromParse;
            detectedNote = midiNoteToString(midiFromParse, state.midiNoteMapping);
          }
        } catch {
          // Use default if can't detect - derive note string from detectedMidiNote
          detectedNote = midiNoteToString(detectedMidiNote, state.midiNoteMapping);
        }
      }

      // Check if this MIDI note is already assigned to another sample
      // If so, find the nearest available MIDI note to prevent multiple samples on the same key
      const existingNotes = new Set(state.multisampleFiles.map(f => f.rootNote));
      if (existingNotes.has(detectedMidiNote) && action.payload.rootNoteOverride === undefined) {
        // Find nearest available MIDI note (try going up first, then down)
        let foundAvailableNote = false;

        // Try going up from detected note
        for (let offset = 1; offset <= 64; offset++) {
          const candidateNote = detectedMidiNote + offset;
          if (candidateNote <= 127 && !existingNotes.has(candidateNote)) {
            detectedMidiNote = candidateNote;
            detectedNote = midiNoteToString(candidateNote, state.midiNoteMapping);
            foundAvailableNote = true;
            break;
          }
        }

        // If still not found, try going down from detected note
        if (!foundAvailableNote) {
          for (let offset = 1; offset <= 64; offset++) {
            const candidateNote = detectedMidiNote - offset;
            if (candidateNote >= 0 && !existingNotes.has(candidateNote)) {
              detectedMidiNote = candidateNote;
              detectedNote = midiNoteToString(candidateNote, state.midiNoteMapping);
              break;
            }
          }
        }

        // If we couldn't find an available note (all 128 MIDI notes are taken, which is unlikely),
        // we'll keep the detected note and let it replace the existing sample
      }
      
      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = action.payload.metadata.duration;
      const initialLoopStart = action.payload.metadata.hasLoopData ? action.payload.metadata.loopStart : action.payload.metadata.duration * 0.2;
      const initialLoopEnd = action.payload.metadata.hasLoopData ? action.payload.metadata.loopEnd : action.payload.metadata.duration * 0.8;
      
      // Apply zero-crossing detection if enabled and audioBuffer is available
      let finalInPoint = initialInPoint;
      let finalOutPoint = initialOutPoint;
      let finalLoopStart = initialLoopStart;
      let finalLoopEnd = initialLoopEnd;
      
      if (state.multisampleSettings.autoZeroCrossing && action.payload.audioBuffer) {
        const result = applyZeroCrossingToMarkers(
          action.payload.audioBuffer,
          initialInPoint,
          initialOutPoint,
          initialLoopStart,
          initialLoopEnd
        );
        finalInPoint = result.inPoint;
        finalOutPoint = result.outPoint;
        finalLoopStart = result.loopStart ?? initialLoopStart;
        finalLoopEnd = result.loopEnd ?? initialLoopEnd;
        

      }
      
      const newMultisampleFile: MultisampleFile = {
        ...initialMultisampleFile,
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer, // Can be null for AIF files that can't be decoded
        name: action.payload.file.name,
        isLoaded: action.payload.audioBuffer !== null, // Only mark as loaded if we have an audioBuffer
        rootNote: detectedMidiNote, // Set the actual MIDI note number
        note: detectedNote,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        // Use adjusted loop points
        loopStart: finalLoopStart,
        loopEnd: finalLoopEnd,
        // Store metadata
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.metadata.fileSize,
        duration: action.payload.metadata.duration, // Use calculated duration from metadata
        isFloat: action.payload.metadata.isFloat
      };

      if (action.payload.audioBuffer) {
        const normalized = normalizeSecondRanges(
          action.payload.audioBuffer.length,
          action.payload.audioBuffer.sampleRate,
          { start: finalInPoint, end: finalOutPoint },
          { start: finalLoopStart, end: finalLoopEnd },
        );
        newMultisampleFile.inPoint = framesToSeconds(normalized.sample.start, action.payload.audioBuffer.sampleRate);
        newMultisampleFile.outPoint = framesToSeconds(normalized.sample.end, action.payload.audioBuffer.sampleRate);
        newMultisampleFile.loopStart = framesToSeconds(normalized.loop.start, action.payload.audioBuffer.sampleRate);
        newMultisampleFile.loopEnd = framesToSeconds(normalized.loop.end, action.payload.audioBuffer.sampleRate);
      }
      
      const updatedFiles = associateImportedCrossfades(
        [...state.multisampleFiles, newMultisampleFile],
        state.importedMultisamplePreset,
      ).files;
      
      // Sort by rootNote descending to make zone calculation easier
      updatedFiles.sort((a, b) => b.rootNote - a.rootNote);
      
      return { 
        ...state, 
        multisampleFiles: updatedFiles
      };
    }
      
    case 'CLEAR_MULTISAMPLE_FILE': {
      const filteredMultisampleFiles = state.multisampleFiles.filter((_, index) => index !== action.payload);
      return { ...state, multisampleFiles: filteredMultisampleFiles };
    }
      
    case 'UPDATE_MULTISAMPLE_FILE': {
      const updatedMultisampleFiles = [...state.multisampleFiles];
      updatedMultisampleFiles[action.payload.index] = {
        ...updatedMultisampleFiles[action.payload.index],
        ...action.payload.updates
      };
      
      // If rootNote was updated, sort the array to maintain proper order
      if ('rootNote' in action.payload.updates) {
        updatedMultisampleFiles.sort((a, b) => b.rootNote - a.rootNote);
      }
      
      return { ...state, multisampleFiles: updatedMultisampleFiles };
    }
      
    case 'REORDER_MULTISAMPLE_FILES': {
      const reorderedFiles = [...state.multisampleFiles];
      const [movedFile] = reorderedFiles.splice(action.payload.fromIndex, 1);
      reorderedFiles.splice(action.payload.toIndex, 0, movedFile);
      return { ...state, multisampleFiles: reorderedFiles };
    }
      
    case 'SET_SELECTED_MULTISAMPLE':
      return { ...state, selectedMultisample: action.payload };
      
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload] 
      };
      
    case 'REMOVE_NOTIFICATION':
      return { 
        ...state, 
        notifications: state.notifications.filter(n => n.id !== action.payload) 
      };
      
    case 'SET_IMPORTED_DRUM_PRESET':
      return { ...state, importedDrumPreset: action.payload };
      
    case 'SET_IMPORTED_MULTISAMPLE_PRESET':
      return {
        ...state,
        importedMultisamplePreset: action.payload,
        multisampleFiles: associateImportedCrossfades(state.multisampleFiles, action.payload).files,
      };

    case 'IMPORT_MULTISAMPLE_PRESET':
      return {
        ...state,
        importedMultisamplePreset: action.payload,
        multisampleSettings: hydrateMultisampleSettings(state.multisampleSettings, action.payload),
        multisampleFiles: associateImportedCrossfades(state.multisampleFiles, action.payload, { replaceMatched: true }).files,
      };

    case 'BEGIN_PRESET_IMPORT':
      return {...state,pendingPresetImport:{operationId:action.payload.operationId,expectedProjectGeneration:state.projectGeneration??0}};

    case 'COMMIT_PRESET_IMPORT': {
      const pending=state.pendingPresetImport;
      if(!pending || pending.operationId!==action.payload.operationId) return state;
      if(pending.expectedProjectGeneration!==(state.projectGeneration??0)) return {...state,pendingPresetImport:undefined};
      const failure=(message:string):AppState=>({...state,pendingPresetImport:undefined,notifications:[...state.notifications,{id:`preset-import-${action.payload.operationId}`,type:'error',title:'import failed',message}]});
      if(!action.payload.result.success || !action.payload.result.data) return failure(action.payload.result.error||'failed to import preset');
      const preset=action.payload.result.data;
      let candidate:AppState;
      if(action.payload.instrument==='drum') {
        if(preset.type!=='drum') return failure('The selected file is not a drum preset');
        const imported=extractDrumSettings(preset);
        candidate={...state,pendingPresetImport:undefined,importedDrumPreset:preset,drumSettings:{...state.drumSettings,presetSettings:imported.presetSettings}};
      } else {
        if(preset.type!=='multisampler') return failure('The selected file is not a multisample preset');
        candidate={...state,pendingPresetImport:undefined,importedMultisamplePreset:preset,
          multisampleSettings:hydrateMultisampleSettings(state.multisampleSettings,preset),
          multisampleFiles:associateImportedCrossfades(state.multisampleFiles,preset,{replaceMatched:true}).files};
      }
      try {validateProjectArchiveMetadata(candidate);}
      catch(error){return failure(error instanceof Error?error.message:'Preset settings cannot be stored in this project');}
      return {...candidate,notifications:[...candidate.notifications,{id:`preset-import-${action.payload.operationId}`,type:'success',title:'settings imported',message:`successfully imported ${action.payload.instrument} preset settings`}]};
    }
      
    case 'TOGGLE_DRUM_KEYBOARD_PIN':
      return { ...state, isDrumKeyboardPinned: !state.isDrumKeyboardPinned };
      
    case 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN':
      return { ...state, isMultisampleKeyboardPinned: !state.isMultisampleKeyboardPinned };
      
    case 'SET_SESSION_SAVE_STATUS':
      return {...state, sessionSaveStatus:action.payload.status,
        sessionSaveError: action.payload.error === undefined ? state.sessionSaveError : action.payload.error,
        sessionLastSavedAt: action.payload.lastSavedAt === undefined ? state.sessionLastSavedAt : action.payload.lastSavedAt};
    case 'SET_SESSION_RECOVERY_RESOLVED':
      return {...state,sessionRecoveryResolved:action.payload};
    case 'RESTORE_LIBRARY': {
      const {mode,project} = action.payload;
      const restored = appReducer(state,{type:'RESTORE_SESSION',payload:project});
      return mode === 'drum'
        ? {...state,pendingPresetImport:undefined,projectGeneration:restored.projectGeneration,currentTab:'drum',drumSettings:restored.drumSettings,drumSamples:restored.drumSamples,importedDrumPreset:restored.importedDrumPreset}
        : {...state,pendingPresetImport:undefined,projectGeneration:restored.projectGeneration,currentTab:'multisample',multisampleSettings:restored.multisampleSettings,multisampleFiles:restored.multisampleFiles,selectedMultisample:restored.selectedMultisample,importedMultisamplePreset:restored.importedMultisamplePreset};
    }
    case 'IMPORT_PROJECT':
    case 'RESTORE_SESSION': {
      // Create a properly sized drum samples array that can accommodate all samples
      // Find the highest originalIndex to determine the array size
      const maxIndex = Math.max(...action.payload.drumSamples.map(s => s.originalIndex), 23); // At least 24 slots
      const restoredDrumSamples = Array.from({ length: maxIndex + 1 }, (_, index) => {
        // If there's a restored sample at this index, use it; otherwise create proper initial state
        const restoredSample = action.payload.drumSamples.find(s => s.originalIndex === index);
        if (restoredSample) {
          return {
            file: restoredSample.file,
            audioBuffer: restoredSample.audioBuffer,
            name: restoredSample.name,
            isLoaded: restoredSample.isLoaded,
            isAssigned: restoredSample.isAssigned,
            assignedKey: restoredSample.assignedKey,
            inPoint: restoredSample.inPoint,
            outPoint: restoredSample.outPoint,
            playmode: restoredSample.playmode,
            reverse: restoredSample.reverse,
            transpose: restoredSample.transpose,
            pan: restoredSample.pan,
            gain: restoredSample.gain,
            hasBeenEdited: restoredSample.hasBeenEdited,
            originalBitDepth: restoredSample.originalBitDepth,
            originalSampleRate: restoredSample.originalSampleRate,
            originalChannels: restoredSample.originalChannels,
            fileSize: restoredSample.fileSize,
            duration: restoredSample.duration,
            isFloat: restoredSample.isFloat,
            sourceIdentity: restoredSample.sourceIdentity,
            sliceProvenance: restoredSample.sliceProvenance ? {...restoredSample.sliceProvenance} : undefined,
          };
        }
        // For empty slots, create proper initial state with correct assignment
        // Slots 0-23 should be assigned to their respective keys by default
        const isInFirst24Slots = index < 24;
        return createDrumSample(index, isInFirst24Slots);
      });
      


      const newState = {
        ...state,
        projectGeneration: (state.projectGeneration ?? 0) + 1,
        pendingPresetImport: undefined,
        importedDrumPreset: action.payload.importedDrumPreset ?? null,
        importedMultisamplePreset: action.payload.importedMultisamplePreset ?? null,
        midiNoteMapping: action.payload.midiNoteMapping ?? state.midiNoteMapping,
        drumSettings: action.payload.drumSettings,
        multisampleSettings: action.payload.multisampleSettings,
        drumSamples: restoredDrumSamples,
        multisampleFiles: associateImportedCrossfades(
          action.payload.multisampleFiles,
          action.payload.importedMultisamplePreset ?? null,
        ).files,
        selectedMultisample: action.payload.selectedMultisample,
        isDrumKeyboardPinned: action.payload.isDrumKeyboardPinned,
        isMultisampleKeyboardPinned: action.payload.isMultisampleKeyboardPinned,
        isSessionRestorationModalOpen: false,
        sessionInfo: null
      };


      
      return newState;
    }
      
    case 'SET_SESSION_RESTORATION_MODAL_OPEN':
      return { ...state, isSessionRestorationModalOpen: action.payload };
      
    case 'SET_SESSION_INFO':
      return { ...state, sessionInfo: action.payload };
      
    case 'SET_MIDI_NOTE_MAPPING': {
      // Save to cookie for persistence
      try {
        cookieUtils.setCookie(COOKIE_KEYS.MIDI_NOTE_MAPPING, action.payload, 30);
      } catch (error) {
        console.error('Failed to save MIDI note mapping to cookie:', error);
      }
      
      // Update note strings for all existing multisample files to reflect the new mapping
      const updatedMultisampleFiles = state.multisampleFiles.map(file => ({
        ...file,
        note: midiNoteToString(file.rootNote, action.payload)
      }));
      
      return { 
        ...state, 
        midiNoteMapping: action.payload,
        multisampleFiles: updatedMultisampleFiles
      };
    }

    case 'UPDATE_ALL_MULTI_SAMPLES': {
      return {
        ...state,
        multisampleFiles: state.multisampleFiles.map(file => {
          // Only update loaded files with valid audio data
          if (file.isLoaded && file.audioBuffer) {
            const merged = { ...file, ...action.payload };
            const normalized = normalizeSecondRanges(
              file.audioBuffer.length,
              file.audioBuffer.sampleRate,
              { start: merged.inPoint, end: merged.outPoint },
              { start: merged.loopStart, end: merged.loopEnd },
            );
            return {
              ...merged,
              inPoint: framesToSeconds(normalized.sample.start, file.audioBuffer.sampleRate),
              outPoint: framesToSeconds(normalized.sample.end, file.audioBuffer.sampleRate),
              loopStart: framesToSeconds(normalized.loop.start, file.audioBuffer.sampleRate),
              loopEnd: framesToSeconds(normalized.loop.end, file.audioBuffer.sampleRate),
              ...(action.payload.loopCrossfade ? {
                loopCrossfade: { fraction: Math.max(0, Math.min(0.75, Number.isFinite(action.payload.loopCrossfade.fraction) ? action.payload.loopCrossfade.fraction : 0)) },
              } : {}),
            };
          }
          return file;
        })
      };
    }

    case 'UPDATE_ALL_DRUM_SAMPLES': {
      return {
        ...state,
        drumSamples: state.drumSamples.map(sample => {
          // Only update loaded samples with valid audio data
          if (sample.isLoaded && sample.audioBuffer) {
            const merged = { ...sample, ...action.payload };
            const normalized = normalizeSecondRanges(
              sample.audioBuffer.length,
              sample.audioBuffer.sampleRate,
              { start: merged.inPoint, end: merged.outPoint },
            );
            return {
              ...merged,
              inPoint: framesToSeconds(normalized.sample.start, sample.audioBuffer.sampleRate),
              outPoint: framesToSeconds(normalized.sample.end, sample.audioBuffer.sampleRate),
            };
          }
          return sample;
        }),
      };
    }

    default: {
      return state;
    }
  }
}

// Export for testing
export { appReducer, initialState };

// Create context
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  canUndo:boolean; canRedo:boolean; historyLimited:boolean;
  beginEdit: (token:string)=>void; endEdit:(token:string)=>void; cancelEdit:(token:string)=>void;
  importPresetFile:(file:File,instrument:'drum'|'multisample')=>Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);

// Provider component
export function AppContextProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer((h:ReturnType<typeof createHistory>,a:AppAction)=>reduceHistory(h,a,appReducer), initialState, createHistory);
  const state=history.present;
  const beginEdit=useCallback((token:string)=>dispatch({type:'BEGIN_EDIT',payload:token}),[]);
  const endEdit=useCallback((token:string)=>dispatch({type:'END_EDIT',payload:token}),[]);
  const cancelEdit=useCallback((token:string)=>dispatch({type:'CANCEL_EDIT',payload:token}),[]);
  const importPresetFile=useCallback(async(file:File,instrument:'drum'|'multisample')=>{
    const operationId=crypto.randomUUID();
    dispatch({type:'BEGIN_PRESET_IMPORT',payload:{operationId}});
    const result=await importPresetFromFile(file,instrument==='drum'?'drum':'multisampler');
    dispatch({type:'COMMIT_PRESET_IMPORT',payload:{operationId,instrument,result}});
  },[]);

  return (
    <AppContext.Provider value={{ state, dispatch,canUndo:history.past.length>0,canRedo:history.future.length>0,historyLimited:history.limited,beginEdit,endEdit,cancelEdit,importPresetFile }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
export function useAppContext():{state:AppState;dispatch:React.Dispatch<AppAction>;importPresetFile?:AppContextValue['importPresetFile']} {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return {state:context.state,dispatch:context.dispatch,importPresetFile:context.importPresetFile};
}

export function useProjectHistory() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useProjectHistory must be used within AppContextProvider');
  const {canUndo,canRedo,historyLimited,beginEdit,endEdit,cancelEdit}=context;
  return {canUndo,canRedo,historyLimited,beginEdit,endEdit,cancelEdit};
}
