# Task 7 verification report: resilient audio and preset import

## Delivered behavior

- Every runtime drum and multisample chooser/drop surface now enters one pipeline: synchronous external-transfer capture, bounded ordered resolution, signature/decode validation, visible review, and one guarded Apply. Internal sample moves carry a private drag type and remain separate from external imports.
- File and directory intake preserves top-level order and sorted child order, reads all legacy directory batches, handles legacy entries and modern file-system handles, and reports inaccessible, empty, unsupported, path-only, over-limit, and undecodable items without discarding valid siblings. The FileList fallback remains available when item access fails, including when string items are interleaved. Files with identical names, sizes, and timestamps remain distinct objects with distinct intake IDs.
- WAV, AIFF/AIFC, MP3, FLAC, M4A, Ogg Opus, and Ogg Vorbis are selected from actual signatures. WAV/AIFF source fields come from their container parsers; compressed formats keep source bit depth, source rate, source channel count, and float status unknown unless verified. Browser-decoded rate/channels and frame count remain separate. Original `File` bytes are retained for persistence and export planning.
- Review shows progress, per-item reasons, browser source-versus-decoded metadata, deterministic filename suggestions, editable destinations, and explicit Apply/Cancel controls. Recognized kick, snare, clap, open/closed hat, and tom tokens reserve free matching pads. Conflicts, unknown names, occupied suggestions, and conflicting open/closed hat tokens remain unassigned. Nothing implicitly replaces an occupied pad or multisample root.
- Replacement consent captures the exact current File/AudioBuffer identity when the user selects Replace. Commit rechecks that identity, current project generation, aggregate admission, 24-zone multisample policy, and 256-reference project policy against live reducer state. Applied rows leave review only after one matching commit receipt; retained rows can be applied again under a new receipt. One successful batch creates one Undo step.
- Imported multisamples preserve current note-name mapping, embedded loop metadata, accepted 20/80 default loops, automatic zero-crossing policy, and imported crossfade association. Existing projects larger than 24 zones remain loadable; new excess remains visible in review.
- Whole-project replacement increments an explicit generation. Restore, project open, library replacement, and full reset cancel intake from resolution through review. Starting another intake, Cancel, and provider unmount abort owned work and prevent late decode completion from changing the project. OP-1 preset preparation uses the same replacement-generation guard while retaining its dedicated import route.
- Both actual patch settings callers use the same bounded validator. It requires a plain expected-type object, validates known engine/envelope fields, finite numbers, ranges, and enums, rejects recursive prototype-mutating keys, and bounds incoming plus retained JSON. Safe unknown settings and untouched numeric precision remain in a cloned, deeply frozen raw document for later merge/export.
- Unknown source metadata round-trips without becoming fabricated 16- or 32-bit PCM. Optional source depth/rate/channels reject present null, string, nonfinite, or out-of-range values. Existing v1 archives remain accepted. The visible Original output choice still describes its 16-bit fallback policy without changing source metadata or automatically rewriting output settings.

## Shared APIs and integration points

- `captureExternalTransfer`, `captureFileList`, and `resolveCapturedTransfer` in `src/utils/externalFileIntake.ts` define synchronous ownership and bounded traversal. `EXTERNAL_INTAKE_LIMITS` is 256 files, 1,024 encountered entries, depth 16, and 256 MiB of source File bytes.
- `prepareAudioImportFiles` in `src/utils/audioImport.ts` decodes sequentially, classifies every record, and stops scheduling retained decoded assets after `sum(24 + 4 * channels * frames)` reaches the 128 MiB project ceiling. It includes existing drum and multisample decoded assets in that budget.
- `proposeDrumDestinations` supplies deterministic suggestions and reasons. `finalizeAudioImport` performs the synchronous live-state validation and returns applied/retained IDs plus assigned/overflow counts.
- `AudioImportContext`, `useAudioImport`, and `AudioImportProvider` expose `beginFiles` and `beginDrop` once at the application root. The provider owns operation generations, abort control, review state, explicit replacement identity, and receipt consumption.
- `COMMIT_PREPARED_IMPORTS` and `importCommitResult` in `AppContext` provide the Task 6-style atomic reducer boundary. `projectGeneration` and `BUMP_PROJECT_GENERATION` mark complete-project replacement without changing ordinary edit/Undo semantics.
- `AUDIO_FILE_ACCEPT` is the shared chooser candidate list. `AudioMetadata.sourceSampleRate` and `sourceChannels`, plus optional `bitDepth`, distinguish verified source facts from decoded `AudioBuffer` dimensions.
- `validatePresetJson` and `importPresetFromFile` in `presetImport.ts` are the common settings boundary used by both `DrumPresetSettings` and `MultisamplePresetSettings`; `jsonImport.ts` routes hydration and its public validator through the same boundary.

## Actual caller disposition

| Runtime surface | Retained behavior and shared intake route |
| --- | --- |
| `DrumKeyboard` keys | Capture-phase `data-audio-import="drum"`; all external files survive into review with the clicked physical pad as intent. |
| `DrumKeyboardContainer` upper/lower rows | Each actual row is marked for shared capture; physical pad sequences remain destination intent and occupied pads require a later explicit Replace choice. |
| `DrumSampleTable` mobile and desktop rows | Both rendered branches use shared capture. Internal reorder/assignment sets `application/x-op-patchstudio-sample`, so it cannot also start an import. Row choosers call the provider through `DrumTool`. |
| `DrumTool` general chooser | Ordinary multiple chooser uses `choose drum audio files`; all files open one review and unassigned results remain loaded. |
| `DrumTool` folder chooser | `choose drum sample folder` sets `webkitdirectory` where supported; the ordinary multiple chooser remains the fallback. |
| `MultisampleSampleTable` empty/table/row drops | Mobile and desktop drop targets use shared capture; private recursive traversal and snapshot 24-zone truncation no longer control the actual event. |
| `MultisampleSampleTable` general and row choosers | Multiple general chooser and individual replacement chooser route through provider callbacks owned by `MultisampleTool`. |
| `VirtualMidiKeyboard` keys | Each key exposes `data-audio-import="multisample"` plus the root note; all external files reach review and an occupied root starts unassigned. |
| `MultisampleTool` chooser/folder chooser | `choose multisample audio files` and `choose multisample folder` route one operation through review. MIDI filename/root detection remains available. |
| `FileDropZone` | The generic component now consumes the shared accept list and declares its instrument, but remains unused by the current application. It is not counted as the runtime integration. |
| OP-1 drum preset | The existing `choose OP-1 preset` route remains distinct and reachable, with operation and whole-project generation guards around its asynchronous preparation. |
| Drum/multisample patch settings | Both actual `patch.json` choosers pass the other mode's retained raw settings into the combined 2 MiB validation boundary before dispatch. |
| Slice source and recording | Their Task 5/6 review pipelines remain specialized and are not rerouted through filename placement. Imported source metadata passed into slicing now preserves unknown source fields. |

## Changed Task 7 files

Runtime and integration:

- `src/App.tsx`
- `src/components/common/AudioFormatControls.tsx`
- `src/components/common/AudioImportContext.ts`
- `src/components/common/AudioImportProvider.tsx`
- `src/components/common/FileDetailsBadges.tsx`
- `src/components/common/FileDropZone.tsx`
- `src/components/drum/DrumKeyboard.tsx`
- `src/components/drum/DrumKeyboardContainer.tsx`
- `src/components/drum/DrumPresetSettings.tsx`
- `src/components/drum/DrumSampleTable.tsx`
- `src/components/drum/DrumTool.tsx`
- `src/components/multisample/MultisamplePresetSettings.tsx`
- `src/components/multisample/MultisampleSampleTable.tsx`
- `src/components/multisample/MultisampleTool.tsx`
- `src/components/multisample/VirtualMidiKeyboard.tsx`
- `src/context/AppContext.tsx`
- `src/utils/audioFormats.ts`
- `src/utils/audioImport.ts`
- `src/utils/audioSlicing.ts`
- `src/utils/externalFileIntake.ts`
- `src/utils/indexedDB.ts`
- `src/utils/jsonImport.ts`
- `src/utils/libraryUtils.ts`
- `src/utils/presetImport.ts`
- `src/utils/projectArchive.ts`
- `src/utils/projectSerialization.ts`

Unit tests:

- `src/test/components/AudioFormatControls.test.tsx`
- `src/test/components/AudioImportProvider.test.tsx`
- `src/test/components/FileDetailsBadges.test.tsx`
- `src/test/context/audioImportApplication.test.ts`
- `src/test/utils/audioFormats.test.ts`
- `src/test/utils/externalFileIntake.test.ts`
- `src/test/utils/presetImport.test.ts`
- `src/test/utils/projectArchive.test.ts`

Browser definitions and fixtures:

- `tests/e2e/audio-import.spec.ts`
- `tests/e2e/import-helpers.ts`
- `tests/e2e/export-workflow.spec.ts`
- `tests/e2e/loop-editor.spec.ts`
- `tests/fixtures/task7-audio/manifest.json`
- `tests/fixtures/task7-audio/original.wav`
- `tests/fixtures/task7-audio/original-44100.wav`
- `tests/fixtures/task7-audio/sample.aiff`
- `tests/fixtures/task7-audio/sample.flac`
- `tests/fixtures/task7-audio/sample.m4a`
- `tests/fixtures/task7-audio/sample.mp3`
- `tests/fixtures/task7-audio/sample-44100.mp3`
- `tests/fixtures/task7-audio/sample.ogg`
- `tests/fixtures/task7-audio/sample-vorbis.ogg`

Task 7 did not change package manifests, Vite configuration, or Playwright configuration.

## RED and GREEN evidence

Meaningful RED runs were observed before implementation and review fixes:

- The first intake/application run failed on missing shared modules and 12 behavioral assertions.
- The signature/source-generation migration run failed seven assertions, including an archive round trip that received invented `32` for unknown source depth.
- Preparation initially had no callable API. The review regression batch then failed six cases covering failed nested siblings, fallback preservation, modern global entry limits, conflicting open/closed hat names, and staged decoded-budget enforcement.
- Provider lifecycle regressions initially failed project replacement and receipt behavior. Later focused RED runs covered identity-bound replacement, partial Apply, unmount cancellation, AIFF no-frame rejection, visible unknown depth, 44.1 kHz source persistence, and explicit Original-output fallback copy.
- The initial full unit run passed 721/722; the only failure showed that the established minimal preset contract permits an omitted `engine`. The validator now keeps `engine` optional while strictly validating it when present.
- A final FileList regression failed 1/10 because a preceding string DataTransferItem shifted raw item indices. Capture now assigns ordinals within the file-item channel and passes 10/10.

Earlier RED output was observed interactively and was not reconstructed solely to create cosmetic logs. The initial full-suite output remains at `/tmp/opstudio-task7-full-unit.log` where available.

Final verification:

- Task 7 focused tests: `npx vitest run` over the eight intake/application/provider/codec/UI/preset/archive files — **8 files, 97/97 tests passed** in `/tmp/opstudio-task7-focused-green.log`.
- Complete unit suite: `npm test` — **65 files, 726/726 tests passed** in `/tmp/opstudio-task7-full-unit-green.log`.
- Production build: `npm run build` — TypeScript project build, Vite production bundle, and PWA generation passed in `/tmp/opstudio-task7-build-green.log`. The existing bundle-size and stale Browserslist-data warnings remain non-failing.
- Standalone type check: `npx tsc --noEmit` passed with empty output in `/tmp/opstudio-task7-tsc-green.log`.
- Scoped lint over Task 7-owned core, validation, UI review tests, and browser definitions passed with empty output in `/tmp/opstudio-task7-scoped-lint.log`. A broader first pass surfaced 83 inherited full-tree issues/warnings in older caller and prior-task test files; introduced errors in new/changed Task 7 core were fixed rather than disabled. Remaining inherited cleanup belongs to Task 9.
- `git diff --check` passes with empty output in `/tmp/opstudio-task7-diff-check.log`.
- `npx playwright test --list` discovers **105 tests in 6 files**, including the two new Task 7 scenarios across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari, in `/tmp/opstudio-task7-playwright-list.log`.

## Fixture provenance, runtime limits, and pending controller gates

The nine added, uncommitted codec fixtures are original deterministic signals generated for this task and total 93,367 bytes (about 91.2 KiB). `tests/fixtures/task7-audio/manifest.json` records the signal formula, FFmpeg encoder version, exact byte sizes, and SHA-256 hashes. They contain no external or proprietary audio. The 44.1 kHz WAV and MP3 fixtures specifically test that verified source rate is not replaced by a 48 kHz decode-context rate.

The implementation processes decode jobs sequentially. It can reject source count/bytes and already-known project capacity before decode, but a compressed format's exact decoded allocation is unknowable until the browser decoder returns. The buffer is measured immediately, is retained only if the 128 MiB decoded budget permits it, and later records are classified as capacity excess without being decoded. Project Apply reuses accepted `planProjectAudioCapacity` accounting: both modes, 256 logical references, original source representations, full 2 MiB manifest allowance, 256 MiB archive ceiling, and the 63,100-byte STORE ZIP reserve.

Codec availability is a browser capability. The pre-integration decoder probe supplied by the controller found WAV, FLAC, MP3, Ogg Opus, and Ogg Vorbis in all three desktop engines; AIFF required the existing manual fallback in Chromium/Firefox; and M4A rejected in bundled Chromium while decoding in Firefox/WebKit. Lossy decoded frame counts differed by engine, so tests assert source truth and each returned buffer rather than a universal lossy duration.

No browser or application server was launched during Task 7 implementation. The controller still owns the frozen browser acceptance run for real chooser/drop integration, the downloaded-project references, partial-failure feedback, Apply/Undo, and all configured profiles. Synthetic DataTransfer coverage proves handling mechanics only. Finder, Splice, OP-1/OP-XY hardware, and other desktop applications were not used or certified.

## Attribution and documentation

The synchronous DataTransfer item capture and repeated legacy directory-reader batch pattern were adapted from eimerreis's MIT-licensed [OP PatchStudio PR #113](https://github.com/joseph-holland/op-patchstudio/pull/113); the attribution is retained in `externalFileIntake.ts`. The implementation was independently expanded for structured partial failure, stable order/identity, modern-handle bounds, cancellation, FileList fallback, review, and guarded commit.

Current MDN documentation was fetched through Context7 (`/mdn/content`) before implementation for DataTransfer item/entry capture lifetime and `decodeAudioData` full-file/resampling behavior. No DSP or Max/MSP implementation was required; the configured Max/MSP MCP service was unavailable and no claim depends on it.
