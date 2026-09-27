# Task 7 fix round 1 implementation report

Date: 2026-09-04  
Implementer: Sol  
Branch: `codex/studio-upgrade`  
Review baseline: `/tmp/opstudio-task7-before-round1`  
Status: source, unit tests, and E2E definitions complete; controller browser execution and Astra re-review remain external acceptance gates.

## Outcome

All nine findings in `task-7-review.md` are addressed. The repair keeps the original Task 7 model: browser-owned bytes are captured synchronously, preparation is bounded and cancelable, every actual chooser/drop route reaches the shared review, and accepted work commits once against current project state.

## Finding dispositions

| Finding | Disposition and regression evidence |
| --- | --- |
| R1 desktop row batch cancellation | `DrumSampleTable` now sends its complete multiple selection through `onFilesUpload`; `DrumTool` begins one shared operation with the physical pad sequence. The component regression proves one call contains valid, empty, and unsupported selections. The browser definition selects two real WAVs through the actual desktop row chooser, reviews both, applies once, and undoes once. |
| R2 caller prefilters | The drum shared-provider path runs before legacy fallback checks. Multisample Browse sends every selected `File` without extension/MIME filtering. Empty and unsupported entries therefore receive shared per-item reasons, while a signature-valid `.weird` file is decoded. The legacy direct-upload checks remain only for rendering without `AudioImportProvider`; the production app always supplies the provider. |
| R3 late directory enumeration failure | Legacy and modern walkers retain and sort children captured before a later reader/iterator error, process each child with local failure isolation, report the directory-level error, and still rethrow cancellation. Tests cover a successful first legacy batch followed by failure and a successful modern yield followed by failure. |
| R4 coerced play mode | Known `engine.playmode` is accepted only when it is a string in the supported enum. Arrays, null-like wrong shapes, and other malformed known fields are rejected while optional `engine` and safe unknown raw JSON remain supported. The browser definition exercises malformed settings through both actual choosers. |
| R5 unreadable accepted manifest | `validateProjectArchiveMetadata` calls `serializeProject(..., {metadataOnly:true})`, derives audio dimensions from the live buffers, constructs the same `archiveProject` shape, and runs the same `encodeManifest` byte/JSON bounds plus `validateSettings` path as export. It does not encode or copy PCM. Export also uses `encodeManifest`, so it refuses a manifest its importer could not admit. Tests cover an actual accepted near-limit export/reopen and rejected complete-manifest bytes, a 1,025-character key, and wrapped depth. |
| R6 stale settings reads | One AppContext `importPresetFile` operation namespace owns both modes. `BEGIN_PRESET_IMPORT` synchronously records the latest operation and current project generation. `COMMIT_PRESET_IMPORT` checks both, constructs the candidate from live current state, validates the exact complete metadata-only manifest synchronously, and then commits one history edit or an error notification with unchanged musical state. Tests cover cross-mode latest-wins, project replacement, exact live combined bounds, and one Undo. Both actual settings components use this API. |
| R7 AIFF preallocation | AIFF parsing validates recognized chunk extents, COMM dimensions, source rate, channels, bit depth, decoded logical bytes, SSND offset, and known uncompressed PCM containment before browser decode or manual `createBuffer`. The malicious real-fixture regression advertises one billion frames and proves neither decoder nor allocator is called. Valid AIFF and AIFC/manual fallback coverage remains green. |
| R8 duplicate initial destinations | Explicit intent reserves valid empty pads first. Filename proposals then use the same reservation set. Occupied, duplicate, or invalid explicit requests remain unassigned until the user explicitly chooses a destination. Intake records retain `sourceOrdinal`, so a rejected entry cannot shift later files onto the wrong physical pad. Provider tests cover the original texture/kick collision and an intervening rejected file. |
| R9 resettable provenance identity | Each prepared original gets `crypto.randomUUID()` as its persistent source-family identity; operation and intake ordinals remain receipt/traversal identifiers only. Tests reuse the old `intake-1-file-1` record twice and require distinct UUIDs. Existing archive/library regressions continue to prove old serialized source identities are preserved and derived slices intentionally retain their original family. |

## Current-state settings commit architecture

The async portion only reads and validates one preset file. The reducer owns the decision point. A successful completion must match the globally latest settings operation and its project generation. The reducer hydrates known editable fields into a candidate made from the current state, preserves the accepted immutable raw object for unknown fields and numeric precision, validates the exact metadata-only project manifest, and returns the candidate in one action. The other mode's current preset, current samples, and current project settings can never come from the render that opened the file dialog.

`metadataOnly` changes only stored-audio payload construction: sample references, source-file identity/path planning, metadata, settings, raw preset JSON, decoded dimensions, and all manifest validation remain identical to archive export. This keeps admission synchronous in the reducer and avoids encoding audio merely to import settings.

## Retained actual caller map

| Surface | Shared intake path |
| --- | --- |
| Drum general chooser and folder chooser | One `beginFiles(files, {instrument:'drum'})` call, including every selected file. |
| Desktop drum row multiple chooser | One `beginFiles` call with the complete selection and pad sequence. |
| Drum table row, keyboard key, and MIDI-style key chooser | One-file `beginFiles` with explicit pad intent; no production prefilter. |
| Drum table, keyboard key, lower/upper keyboard zones, and general external drop | Document capture-phase `beginDrop`; `data-audio-import` carries explicit destination intent and stops legacy handlers. |
| Multisample Browse and folder chooser | One `beginFiles` call containing every selected file. |
| Multisample table row and note chooser | One-file `beginFiles`, optionally with current root-note intent. |
| Multisample table/key external drop | Document capture-phase `beginDrop`; no legacy extension filter runs in production. |
| Drum and multisample `patch.json` choosers | Shared globally ordered `importPresetFile`, guarded at reducer commit. |
| OP-1 drum preset | Existing dedicated OP-1 parser and its project-generation guard are preserved. |
| Slice source chooser | Existing bounded WAV/AIFF slicing planner remains separate; no dummy slicing ranges were introduced. |

## Files changed from the round baseline

- `src/components/common/AudioImportProvider.tsx`
- `src/components/drum/DrumPresetSettings.tsx`
- `src/components/drum/DrumSampleTable.tsx`
- `src/components/drum/DrumTool.tsx`
- `src/components/multisample/MultisamplePresetSettings.tsx`
- `src/components/multisample/MultisampleSampleTable.tsx`
- `src/context/AppContext.tsx`
- `src/utils/aifParser.ts`
- `src/utils/audioFormats.ts`
- `src/utils/audioImport.ts`
- `src/utils/externalFileIntake.ts`
- `src/utils/presetImport.ts`
- `src/utils/projectArchive.ts`
- `src/utils/projectSerialization.ts`
- `src/test/components/AudioImportProvider.test.tsx`
- `src/test/components/DrumTool.test.tsx`
- `src/test/components/MultisamplePresetSettings.test.tsx`
- `src/test/context/audioImportApplication.test.ts`
- `src/test/context/presetImportApplication.test.tsx` (new)
- `src/test/utils/audioFormats.test.ts`
- `src/test/utils/externalFileIntake.test.ts`
- `src/test/utils/presetImport.test.ts`
- `src/test/utils/projectArchive.test.ts`
- `tests/e2e/audio-import.spec.ts`
- `docs/verification/task-7-round1-report.md` (this report)

## RED and GREEN evidence

The pre-fix actual-path failures are recorded with exact triggers in `docs/verification/task-7-review.md`. During implementation, newly added regressions initially observed: captured directory children missing after a late enumeration error; array play mode accepted; explicit texture/kick proposals colliding; a resettable intake ID reused as source identity; and the billion-frame AIFF reaching decode/allocation. The first R6 provider tests were added while moving ownership into AppContext, so the review's demonstrated stale-source trace is the retained RED evidence rather than a reconstructed failing log.

Final commands and results:

- `npm test -- src/test/components/AudioImportProvider.test.tsx src/test/components/DrumTool.test.tsx src/test/components/MultisamplePresetSettings.test.tsx src/test/context/audioImportApplication.test.ts src/test/context/presetImportApplication.test.tsx src/test/utils/audioFormats.test.ts src/test/utils/externalFileIntake.test.ts src/test/utils/presetImport.test.ts src/test/utils/projectArchive.test.ts` — **120/120 passed**. Log: `/tmp/opstudio-task7-round1-focused.log`.
- `npm test` — **739/739 passed in 66 files**. Log: `/tmp/opstudio-task7-round1-full-unit.log`.
- `npm run build` — TypeScript build and Vite production build passed; 609 modules transformed. Log: `/tmp/opstudio-task7-round1-build.log`.
- `npx tsc --noEmit --pretty false` — passed. Log: `/tmp/opstudio-task7-round1-tsc.log`.
- `npx eslint src/components/common/AudioImportProvider.tsx src/utils/audioImport.ts src/utils/externalFileIntake.ts src/utils/projectArchive.ts src/utils/projectSerialization.ts src/utils/presetImport.ts src/test/context/presetImportApplication.test.tsx tests/e2e/audio-import.spec.ts` — passed with no output. Log: `/tmp/opstudio-task7-round1-scoped-lint.log`.
- `npx playwright test --list` — parsed **120 configured cases in 6 files**. Log: `/tmp/opstudio-task7-round1-e2e-list.log`.
- `git diff --check` — passed. Log: `/tmp/opstudio-task7-round1-diff-check.log`.

The scoped lint command covers every new round module/test and the shared core modified in the round. Older large components and `AppContext.tsx` still report inherited explicit-`any`, hook, unused-variable, and fast-refresh findings already assigned to Task 9; this round adds no blanket suppression and no new reported category in those legacy lines.

## Browser acceptance added, not executed by this worker

`audio-import.spec.ts` now downloads an actual `.opstudio` from the real-codec import, compares archived `sample-44100.mp3` source bytes to the fixture, distinguishes unknown source fields from decoded 48 kHz frames, undoes the import, reopens the backup, and verifies the source bytes and unknown fields again. It also adds the actual desktop multi-row batch, a mixed valid-unknown-extension/empty/unsupported chooser, and malformed known `patch.json` values through both mode choosers. The desktop-specific test skips the two mobile profiles; the other additions run in all configured profiles.

No browser or server was launched by this worker. Controller browser execution and Astra's scoped re-review are still required before Task 7 acceptance.

## Attribution and limits

The synchronous DataTransfer capture and repeated directory-reader approach remains credited in source to eimerreis's MIT-licensed PR #113; no upstream patch was merged. Browser codec support remains capability-dependent: bundled Chromium's observed M4A rejection is surfaced as a per-file reason, and decoded frame counts for lossy formats remain browser-specific. The compressed-source readers intentionally keep source bit depth/rate/channels unknown when no dedicated container parser verifies them. Finder/Splice integration, microphone hardware, OP hardware, and library persistence of every compressed codec were not claimed; portable backup/reopen now supplies the requested bounded source-preservation acceptance path.
