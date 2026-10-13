import type { AppAction } from '../context/AppContext';
import { defaultDrumSettings, defaultMultisampleSettings } from './defaultSettings';

/** 0 selects "original" in the format controls: export follows each source file. */
const MATCH_ORIGINAL = 0;

/**
 * One undoable batch that returns the drum instrument to factory values.
 * Saved custom defaults are ignored on purpose; only the drum instrument is touched.
 */
export function drumInstrumentResetActions(): AppAction[] {
  const d = defaultDrumSettings;
  return [
    { type:'BUMP_PROJECT_GENERATION' },
    { type:'CLEAR_ALL_DRUM_SAMPLES' },
    { type:'SET_IMPORTED_DRUM_PRESET', payload:null },
    { type:'SET_DRUM_PRESET_NAME', payload:d.presetName },
    { type:'SET_DRUM_SAMPLE_RATE', payload:MATCH_ORIGINAL },
    { type:'SET_DRUM_BIT_DEPTH', payload:MATCH_ORIGINAL },
    { type:'SET_DRUM_CHANNELS', payload:MATCH_ORIGINAL },
    { type:'SET_DRUM_NORMALIZE', payload:d.normalize },
    { type:'SET_DRUM_NORMALIZE_LEVEL', payload:d.normalizeLevel },
    { type:'SET_DRUM_AUTO_ZERO_CROSSING', payload:d.autoZeroCrossing },
    { type:'SET_DRUM_RENAME_FILES', payload:d.renameFiles },
    { type:'SET_DRUM_FILENAME_SEPARATOR', payload:d.filenameSeparator },
    { type:'SET_DRUM_AUDIO_FORMAT', payload:d.audioFormat },
    { type:'SET_DRUM_PRESET_PLAYMODE', payload:d.presetSettings.playmode },
    { type:'SET_DRUM_PRESET_TRANSPOSE', payload:d.presetSettings.transpose },
    { type:'SET_DRUM_PRESET_VELOCITY', payload:d.presetSettings.velocity },
    { type:'SET_DRUM_PRESET_VOLUME', payload:d.presetSettings.volume },
    { type:'SET_DRUM_PRESET_WIDTH', payload:d.presetSettings.width },
  ];
}

/**
 * One undoable batch that returns the multisample instrument to factory values.
 * Files are cleared from the end so every index is still valid when its action runs.
 */
export function multisampleInstrumentResetActions(fileCount: number): AppAction[] {
  const d = defaultMultisampleSettings;
  return [
    { type:'BUMP_PROJECT_GENERATION' },
    ...Array.from({ length:fileCount }, (_, index): AppAction => ({
      type:'CLEAR_MULTISAMPLE_FILE',
      payload:fileCount-index-1,
    })),
    { type:'SET_IMPORTED_MULTISAMPLE_PRESET', payload:null },
    { type:'SET_MULTISAMPLE_PRESET_NAME', payload:d.presetName },
    { type:'SET_MULTISAMPLE_SAMPLE_RATE', payload:MATCH_ORIGINAL },
    { type:'SET_MULTISAMPLE_BIT_DEPTH', payload:MATCH_ORIGINAL },
    { type:'SET_MULTISAMPLE_CHANNELS', payload:MATCH_ORIGINAL },
    { type:'SET_MULTISAMPLE_NORMALIZE', payload:d.normalize },
    { type:'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload:d.normalizeLevel },
    { type:'SET_MULTISAMPLE_AUTO_ZERO_CROSSING', payload:d.autoZeroCrossing },
    { type:'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload:d.cutAtLoopEnd },
    { type:'SET_MULTISAMPLE_GAIN', payload:d.gain },
    { type:'SET_MULTISAMPLE_LOOP_ENABLED', payload:d.loopEnabled },
    { type:'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload:d.loopOnRelease },
    { type:'SET_MULTISAMPLE_RENAME_FILES', payload:d.renameFiles },
    { type:'SET_MULTISAMPLE_FILENAME_SEPARATOR', payload:d.filenameSeparator },
    { type:'SET_MULTISAMPLE_AUDIO_FORMAT', payload:d.audioFormat },
    { type:'SET_MULTISAMPLE_PLAYMODE', payload:d.playmode },
    { type:'SET_MULTISAMPLE_TRANSPOSE', payload:d.transpose },
    { type:'SET_MULTISAMPLE_VELOCITY_SENSITIVITY', payload:d.velocitySensitivity },
    { type:'SET_MULTISAMPLE_VOLUME', payload:d.volume },
    { type:'SET_MULTISAMPLE_WIDTH', payload:d.width },
    { type:'SET_MULTISAMPLE_HIGHPASS', payload:d.highpass },
    { type:'SET_MULTISAMPLE_PORTAMENTO_TYPE', payload:d.portamentoType },
    { type:'SET_MULTISAMPLE_PORTAMENTO_AMOUNT', payload:d.portamentoAmount },
    { type:'SET_MULTISAMPLE_TUNING_ROOT', payload:d.tuningRoot },
    { type:'SET_MULTISAMPLE_AMP_ENVELOPE', payload:{ ...d.ampEnvelope } },
    { type:'SET_MULTISAMPLE_FILTER_ENVELOPE', payload:{ ...d.filterEnvelope } },
  ];
}
