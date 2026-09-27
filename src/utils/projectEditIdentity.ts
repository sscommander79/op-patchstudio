import type {AppState} from '../context/AppContext';

export type ProjectEditIdentity=Pick<AppState,
  'projectGeneration'|'drumSettings'|'multisampleSettings'|'drumSamples'|'multisampleFiles'|
  'importedDrumPreset'|'importedMultisamplePreset'|'midiNoteMapping'>;

/** Captures immutable musical-state references without copying PCM data. */
export function captureProjectEditIdentity(state:AppState):ProjectEditIdentity {
  return {
    projectGeneration:state.projectGeneration,
    drumSettings:state.drumSettings,
    multisampleSettings:state.multisampleSettings,
    drumSamples:state.drumSamples,
    multisampleFiles:state.multisampleFiles,
    importedDrumPreset:state.importedDrumPreset,
    importedMultisamplePreset:state.importedMultisamplePreset,
    midiNoteMapping:state.midiNoteMapping,
  };
}

export function projectEditIdentityMatches(snapshot:ProjectEditIdentity,state:AppState):boolean {
  return snapshot.projectGeneration===state.projectGeneration &&
    snapshot.drumSettings===state.drumSettings && snapshot.multisampleSettings===state.multisampleSettings &&
    snapshot.drumSamples===state.drumSamples && snapshot.multisampleFiles===state.multisampleFiles &&
    snapshot.importedDrumPreset===state.importedDrumPreset && snapshot.importedMultisamplePreset===state.importedMultisamplePreset &&
    snapshot.midiNoteMapping===state.midiNoteMapping;
}
