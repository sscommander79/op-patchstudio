export const sampleFields = {
  rootNote: { label: 'Root note', tip: 'The key that plays this recording at its original pitch. Match the note that was recorded.' },
  inPoint: { label: 'Playback start', tip: 'Where playback begins in the recording. Keep the beginning of the note; remove unwanted silence.' },
  outPoint: { label: 'Playback end', tip: 'Where the playable section ends. Leave enough room for a natural ending.' },
  loopStart: { label: 'Loop start', tip: 'Where the repeating section begins. Try a steady part after the initial attack.' },
  loopEnd: { label: 'Loop end', tip: 'Where playback jumps back to loop start when looping is enabled. Listen for a click or sudden change.' },
} as const;
export type SampleHelpTopic = keyof typeof sampleFields;
// The listening check that goes with each field; shown beside the field's tip while it has focus.
export const sampleFieldListening: Record<SampleHelpTopic, string> = {
  rootNote: 'Play the root key and compare it with the original recording. They should be the same pitch. A note name in a filename is only a clue.',
  inPoint: 'Play the note. If the beginning sounds cut off, move playback start earlier.',
  outPoint: 'Hold a key, then release it. If the ending stops abruptly, check playback end and the release setting. A short release may be intentional.',
  loopStart: 'Hold a key. A click at each repeat means the two loop points do not join smoothly: try a steadier section, or soften the join with crossfade in Zoom and edit.',
  loopEnd: 'Hold a key. A repeated dip, swell or change in tone means the loop includes a fade or a changing sound: try a more even section or a longer loop.',
};
export const LOOPING_EXPLANATION = 'Looping repeats a steady part of a recording while a note is held. It does not create new recordings or add missing notes.';
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Note name for a MIDI value in the project's octave naming (C3 = 60 or C4 = 60). */
export function recordedNoteName(value: number, mapping: 'C3' | 'C4' = 'C3'): string {
  if (!Number.isInteger(value) || value < 0 || value > 127) return '';
  return `${NOTE_NAMES[value % 12]}${Math.floor(value / 12) - (mapping === 'C3' ? 2 : 1)}`;
}
export type SampleDraft = Record<SampleHelpTopic, number>;
export function sampleFieldError(key: SampleHelpTopic, draft: SampleDraft, duration: number): string | null {
  if (key === 'rootNote') return Number.isInteger(draft.rootNote) && draft.rootNote >= 0 && draft.rootNote <= 127 ? null : 'Enter a whole MIDI value from 0 to 127.';
  if (!Number.isFinite(draft[key]) || draft[key] < 0 || draft[key] > duration) return `Keep this point within the selected audio (0–${duration.toFixed(3)} seconds).`;
  if (key === 'inPoint' || key === 'outPoint') return draft.inPoint < draft.outPoint ? null : 'Playback end must come after playback start.';
  if (draft.loopStart >= draft.loopEnd) return 'Loop end must come after loop start.';
  if (draft.loopStart < draft.inPoint || draft.loopEnd > draft.outPoint) return 'Keep the loop inside the playback section.';
  return null;
}
