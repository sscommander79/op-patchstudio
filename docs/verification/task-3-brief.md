# Task 3: reversible editing and portable projects

Prepared before Task 2 completion; read task-2-report.md for final shared serialization interfaces before implementation.
Workspace: /Users/stevencommander/Desktop/AI/op-patchstudio-improved
Authority: design spec requirements 3 and 9. No commits, pushes, additional agents or broad workspace redesign.

## Behavior
- Undo and redo encompass musical project changes: audio load/replace/delete, assignment, imported presets/library projects, trim/loop/gain/settings and future slice/record actions. UI selection, tab switching, notifications, playback and autosave status do not consume history or revert on undo.
- Retain AudioBuffer/File references without copying sample bytes per edit. Introduce an explicit immutable editable-project snapshot selector, bounded history (document limit), and scoped grouping for a continuous gesture. Do not use time-only grouping that merges unrelated deliberate edits. New edits invalidate redo; no-op actions do not consume entries. Restoring old metadata must not resurrect stale save-success status.
- Bound retained history by both entry count and estimated unique audio bytes beyond the current project. Count shared buffers once; drop oldest entries when the documented budget is exceeded and report limited history honestly. A count-only limit can retain many full replaced kits and is not a meaningful audio memory bound.
- Public context retains state/dispatch compatibility. Expose canUndo/canRedo and begin/end transaction or a batch edit action usable by later creative tasks. Tests must prove imported/compound edits undo as one action.
- Add accessible Undo/Redo controls and keyboard shortcuts (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z; Ctrl+Y where appropriate). Guard editable inputs, select, contenteditable, open dialog ownership, IME composition and repeats. Existing musical shortcuts must not consume modified keys, including Z/X keyboard bank switching. Key release must still release an active note if focus changes while held.
- Add a portable project backup file containing versioned JSON manifest, complete editable settings for both instruments, imported JSON, all assigned/unassigned samples, source provenance and lossless audio. Reuse Task 2's binary audio codec. ZIP with a distinct .opstudio extension is appropriate; use JSZip already present.
- Project import validates schema/version, bounded dimensions/count/total bytes, referenced entries and actual audio length before allocation and before touching current state. Never execute or fetch archive content. Reject corrupt/unsupported projects with actionable errors and preserve current work. Reject ambiguous duplicate paths, unexpected missing entries and nonfinite audio. Avoid path traversal and decompression bombs; enforce practical size limits before/while extracting supported inputs.
- Import commits one atomic reducer operation only after all validation succeeds; one undo returns to prior project. Export is a snapshot of the state at click time, with contextual failure and deterministic naming. Include a schema fixture and migration strategy. Do not promise perpetual compatibility; explicitly support version1 and known legacy cases only.
- Provide visible Download project / Open project controls in a small reusable toolbar (Task8 will integrate). Backup and device export must be clearly distinguished to users.

## Tests
1. Real context/reducer state: load two samples with a hole and overflow, change trim/gain, undo/redo, then new edit clears redo; selection/status changes leave musical history intact.
2. Repeated points in an explicit drag group undo in one step; two distinct gestures require two; history cap evicts old snapshots without mutating audio.
3. Actual ZIP round trip with precise two-channel 48k Float32 values, zero loop endpoints, both envelopes, imported unknown settings, overflow and sparse assignments. Expected values asserted independently.
4. Truncated/missing/mismatched audio, invalid versions/settings/references/dimensions, duplicate archive names and oversized declared payload reject with unchanged project.
5. Real keyboard handlers: Cmd/Ctrl+Z triggers undo once, never bank switch/play; typing and selects work normally; held notes release after focus moves.
6. Controller adds browser backup/download/import/undo workflow after APIs settle. Coordinate any test hooks using actual DOM flows, not a production test backdoor.

## Deliverable
Write task-3-report.md with RED/GREEN commands and outputs, archive schema and limits, history grouping API, source ownership expectations, known browser constraints. Run focused tests, full unit suite and build. No broad UI polish yet; that is Task8.

## Preceding interfaces and subsequent handoff
Task2 report is now available. Its public Blob codec APIs remain unchanged; private IndexedDB ArrayBuffer envelopes are not the archive format. Keep archive validation modular for Task4 optional per-sample crossfade provenance: {fraction, importedRaw?, importedFramecount?}; do not invent audio behavior in Task3. Task4 will extend serialization/archive validation in one bounded follow-up. Controller browser RED /tmp/opstudio-project-backup-red.log covers Download project/Open project/Undo/Redo controls and sparse pad identity; root owns that file.

## Accepted archive profile and provenance contract
Use a deliberately STORE-only ZIP profile for version1. Reject compression methods other than0, ambiguous duplicate/unsafe paths, encryption and inconsistent raw directory/local headers before JSZip processing. Own exports use STORE; repacked compressed backups are unsupported in this version. Limits:256MiB archive and total stored payload,2MiB manifest,256 loaded samples,512 drum positions,128MiB per audio payload; also bound aggregate decoded audio across references, or identity-cache immutable decoded assets consistently. These limits were accepted in preflight; document them in report/UI errors.

SampleData.metadata.sampleRate/channels represent original source provenance; they can legitimately differ from the current AudioBuffer after decoding/conversion. Preserve both independently. Validate actual dimensions from the codec header and source metadata as bounded provenance; never reject a valid backup just because originalSampleRate48000 accompanies a current44100Hz buffer. Include that roundtrip case.
