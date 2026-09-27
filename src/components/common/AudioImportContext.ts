import { createContext, useContext } from 'react';
import type { ExpectedAssetIdentity } from '../../utils/recordingApplication';

export interface AudioImportIntent {
  instrument: 'drum' | 'multisample';
  drumPads?: number[];
  drumReplacement?: ExpectedAssetIdentity;
  drumPadReplacement?: { padIndex: number; expected: ExpectedAssetIdentity };
  multisampleRoot?: number;
}

export interface AudioImportController {
  beginFiles: (files: ArrayLike<File>, intent: AudioImportIntent) => void;
  beginDrop: (transfer: DataTransfer, intent: AudioImportIntent) => void;
}

export const AudioImportContext = createContext<AudioImportController | null>(null);

export function useAudioImport() {
  return useContext(AudioImportContext);
}
