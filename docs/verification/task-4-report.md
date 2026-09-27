# Task 4 verification report: precise loop editing and honest audio preview

**Date:** 2026-09-04  
**Branch:** `codex/studio-upgrade`  
**Starting unit baseline:** 520 passing tests after Task 3  
**Status:** implementation, two review rounds, focused browser acceptance, and automated unit/build verification complete; final broad browser and physical-device verification are reported separately below

## Result

Task 4 now uses one half-open frame contract, `[startFrame, endFrame)`, throughout loop editing, preview, import normalization, durable storage, and patch generation. A valid selection is at least one frame and may end at the buffer's exact `framecount`. Loop bounds are clamped inside the selected sample. A completely disjoint loop becomes the nearest valid one-frame loop.

The editor exposes accessible frame and second inputs, keeps zero as a valid value, supports exact final-frame ends, provides keyboard marker adjustment and selected-marker feedback, and tracks pointer movement outside the canvas. Pointer cancellation restores the drag baseline and all document listeners are removed on close or unmount. Modal edits remain drafts: **save markers** emits one project action, **save for all** emits one project action, and **cancel** emits no project edit. A parent rerender with new callback identities does not reset the draft.

Preview play, pause, release, and stop use the `AudioContext.currentTime` clock for the visible playhead. Preview respects the sample range, playback rate, reverse direction, one-frame loops, loop enablement, and the two release modes. “Loop until release” disables looping when released; “loop forever” continues the already-looping section through release. A release flag cannot enable a loop by itself. Reverse playback and crossfade preview operate on copied channel data, leaving the source `AudioBuffer` unchanged. Pending starts, animation frames, active sources, keyboard ownership, and pointer listeners are cancelled on stop/close/unmount.

WAV `smpl` output stores the canonical start unchanged and converts only the half-open end to inclusive `end - 1`. Root-note-only metadata writes `numSampleLoops = 0`. AIFF MARK output stores boundary positions unchanged, including an end at `framecount`. WAV and AIFF import convert their container-specific endpoints back to the shared half-open representation. Patch generation normalizes markers against the actual converted/cut buffer and writes `loop.crossfade = round(fraction * finalFramecount)`.

## Public interfaces added or extended

`src/utils/loopEditing.ts` provides:

- `FrameRange { start, end }`
- `framesToSeconds(frame, sampleRate)`
- `secondsToFrames(seconds, sampleRate, frameCount)`
- `normalizeFrameRange(frameCount, range)`
- `normalizeSampleAndLoop(frameCount, sampleRange, loopRange)`
- `normalizeSecondRanges(frameCount, sampleRate, sample, loop?)`
- `crossfadeLoopChannels(channels, loop, requestedFrames)`
- `previewFrameAtTime(clock, currentTime)`

`MultisampleFile` now has an optional `loopCrossfade` value:

```ts
interface LoopCrossfadeProvenance {
  fraction: number;
  importedRaw?: number;
  importedFramecount?: number;
  sourceIdentity?: string;
}
```

`src/utils/importedCrossfade.ts` provides `sampleFileIdentity`, `associateImportedCrossfades`, and `importedCrossfadeNotice`. Association requires an exact, unique file identity. It never guesses by array order or duplicate basename. Unmatched, ambiguous, or uninterpretable raw region JSON remains untouched in `importedMultisamplePreset`; the editor displays a concise preview limitation. Values above the ordinary 75% range retain their raw provenance until a deliberate edit replaces it with a normal `{ fraction }` value. Applying a value to all samples strips source-specific provenance and clamps the shared value to the normal range.

`WaveformZoomModal` adds optional `initialCrossfade`, `crossfadeNotice`, `playbackRate`, `gain`, and `reverse` inputs. Its save callback can return `loopCrossfade`. `useAudioPlayer.playWithADSR` adds an optional `onEnded` callback and frame-accurate `inFrame`/`outFrame` handling for forward and reverse preview. A selected range is copied into a bounded voice buffer, so releasing a loop cannot expose audio outside that range. Its optional `startTime` remains relative to that bounded voice, allowing Pause to resume without shortening the loop. `audioContextManager.getCurrentTime()` exposes the preview clock without creating another context.

Task 2 session, library, and portable archive flows preserve `loopCrossfade`. Serialization and restoration normalize second values against each decoded buffer. Archive import retains its structure, finite-number, ZIP, audio-dimension, size, and reference checks. Because Task 3 already emitted archive version 1 with fractional or empty marker ranges, finite legacy marker values within the old one-frame bounds are accepted and canonically normalized after audio validation. Negative and farther-out marker values still reject. Existing v1 archives without the optional crossfade field remain compatible.

## RED evidence

The first missing-module failures in `/tmp/opstudio-task4-loop-red.log` and `/tmp/opstudio-task4-crossfade-import-red.log` only established that the planned APIs did not exist. They are scaffolding RED, not proof of an inherited defect.

Meaningful pre-fix failures were:

- `/tmp/opstudio-task4-container-red.log`: **7/7 failed**. A WAV loop beginning at zero underflowed to `4294967295`; nonzero starts shifted one frame early; root-note-only metadata wrote one enabled loop; AIFF ends were one frame short.
- `/tmp/opstudio-task4-import-roundtrip-red.log`: **2 failed, 7 passed**. WAV inclusive ends were not restored to a half-open boundary, and a valid AIFF end at `framecount` was reduced by one.
- `/tmp/opstudio-task4-patch-contract-red.log`: **4/4 failed**. Crossfade stayed zero after conversion/cut, disabled multisample looping still wrote a container loop, and drum root metadata created a full-file loop.
- `/tmp/opstudio-task4-preview-red.log`: **3 failed, 19 passed**. The release-continuation flag enabled looping without loop enablement, preview imposed a 0.1-second minimum, and reverse playback did not create a reversed copy.
- `/tmp/opstudio-task4-provenance-red.log`: **4 failed, 24 passed**. Session/archive round trips dropped crossfade provenance and archive validation had no crossfade shape to validate.
- The initial modal editing run had **5/5 failing tests**: numeric markers, outside drag/cancel cleanup, immutable clocked preview, and draft Save/Cancel behavior were absent. The suite was then expanded to cover imported values and rerender stability.

## GREEN verification

All commands were run from `/Users/stevencommander/Desktop/AI/op-patchstudio-improved` on the final source snapshot before browser handoff.

| Check | Result | Log |
| --- | --- | --- |
| Task 4 focus set | 10 files, **100/100 passed** | `/tmp/opstudio-task4-focused-green.log` |
| Full unit suite | 52 files, **557/557 passed** | `/tmp/opstudio-task4-full-unit.log` |
| TypeScript + production build | **passed**, 600 modules transformed | `/tmp/opstudio-task4-build.log` |
| Task 4 new/rewritten-source ESLint set | **passed with no output** | `/tmp/opstudio-task4-eslint-clean.log` |
| Whitespace/error marker check | **passed with no output** | `git diff --check` |

The focused set covers exact RIFF and AIFF bytes at start zero, nonzero starts, final-frame ends, and one-frame loops; real container round trips; no-loop root metadata; converted/cut patch frame normalization; immutable asymmetric crossfade data; imported crossfade matching/ambiguity; storage/library/archive compatibility and rejection; preview release/reverse/one-frame behavior; numeric frame and second inputs; pointer-outside and pointer-cancel behavior; unmount cleanup; actual-clock playhead state; one-save history semantics; Cancel; Save for all; and rerender stability.

Expected diagnostic output remains in the full run for tests that deliberately inject IndexedDB, decode, optional session-marker, network, and mocked audio-node failures. No test failed.

## Independent review remediation: round 1

The independent review in `docs/verification/task-4-review.md` identified R1–R11. The complete source was copied to `/tmp/opstudio-task4-before-round1/src` before remediation. All eleven findings were addressed in one bounded fix round:

- **R1:** exact import association now fills only an unset crossfade. Existing edited/restored `{ fraction }` values remain authoritative, while a stale automatically associated value is removed if a duplicate later makes that identity ambiguous. Original imported JSON remains separate and untouched.
- **R2:** archive version 1 now follows the bounded compatibility path described above. The regression fixture was generated by running the approved Task 3 serializer and importer from `/tmp/opstudio-before-task4/src`, rather than hand-authoring a current manifest. The resulting 2,190-byte archive has SHA-256 `2a8848a7d74ec1c932bc91b8a44f1fc14df829c3c408a79c3db5eec2055b94ec` and is embedded in `src/test/fixtures/task3LegacyArchive.ts`. Generation and acceptance evidence is in `/tmp/opstudio-task4-task3-fixture.log`.
- **R3/R4:** preview completion is owned by both its request generation and returned note ID. Force stop clears ownership before stopping the source, so a late `onended` cannot undo Pause or reset a replacement voice. P-key listeners use current callback refs and retain physical ownership across playback rerenders until keyup or modal teardown.
- **R5/R6:** both mobile table branches now mount the same editor contract as desktop. Backdrop dismissal begins only on an independent backdrop pointerdown; a click synthesized after a canvas drag no longer cancels the modal.
- **R7/R8:** the ADSR peak is scaled once by velocity and the existing dB gain convention. Frame-bounded playback copies only the selected samples, in forward or reverse order, so disabling the loop during release cannot play beyond the selected source bounds. The original `AudioBuffer` remains unchanged.
- **R9/R10:** each active voice owns an immutable clock snapshot matching the source configuration. Marker or crossfade draft changes do not retarget the displayed clock until a new voice starts. Loop smoothing is applied only when looping is enabled; switching Loop Off retains the saved setting without altering one-shot preview samples.
- **R11:** both Save-for-all reducers normalize seconds to half-open frame ranges against every recipient's actual buffer length and sample rate. Multisample loop ranges normalize per recipient and shared crossfade values discard source provenance. The single reducer action remains one Undo/Redo step.

The first review-focused RED run recorded **14 failed and 70 passed** in `/tmp/opstudio-task4-round1-red.log`. Twelve failures directly exposed the reviewed defects. Two were test-infrastructure faults discovered in that run: the new context test omitted its `initialState` import, and the disabled-loop copy test initially encountered the test environment's positional-only `AudioBuffer` mock before reaching its sample assertion. Both harness faults were corrected without weakening the assertions. Mobile absence already had real-browser RED evidence in `/tmp/opstudio-task4-browser.log`.

Final round-1 automated evidence on the frozen source/e2e snapshot:

| Check | Result | Log |
| --- | --- | --- |
| R1–R11 review focus set | 6 files, **84/84 passed** | `/tmp/opstudio-task4-round1-focused-green.log` |
| Full unit suite | 52 files, **569/569 passed** | `/tmp/opstudio-task4-round1-full-unit.log` |
| TypeScript + production build | **passed**, 600 modules transformed | `/tmp/opstudio-task4-round1-build.log` |
| New/rewritten round-1 lint set | **passed with no output** | `/tmp/opstudio-task4-round1-eslint-clean.log` |
| Whitespace/error marker check | **passed with no output** | `git diff --check` |

Round-1 runtime files changed: `WaveformZoomModal.tsx`, `DrumSampleTable.tsx`, `MultisampleSampleTable.tsx`, `AppContext.tsx`, `useAudioPlayer.ts`, `importedCrossfade.ts`, and `projectArchive.ts`. Regression changes are in `WaveformZoomModalEditing.test.tsx`, `projectHistory.test.tsx`, `useAudioPlayer.test.ts`, `durableStorage.test.ts`, `importedCrossfade.test.ts`, `projectArchive.test.ts`, the Task 3 fixture, and `tests/e2e/loop-editor.spec.ts`.

## Independent review remediation: round 2

The bounded re-review in `docs/verification/task-4-rereview.md` closed nine original findings and narrowed two integration cases, RR1 and RR2. The complete source was copied to `/tmp/opstudio-task4-before-round2/src` before changes.

- **RR1:** `associateImportedCrossfades` now accepts an explicit `{ replaceMatched: true }` policy used only by `IMPORT_MULTISAMPLE_PRESET`. A deliberate new preset replaces any prior manual or automatic value for a newly unique exact match as part of the one import history action. In that explicit mode, unmatched or ambiguous prior automatic provenance is removed, while an unmatched human-authored `{ fraction }` remains. ADD, session restore, and library restore continue using the preserving policy fixed in round 1.
- **RR2:** paused playback validates the old playhead against the current draft selection before source creation. An invalid forward resume restarts at the current sample start; an invalid reverse resume restarts at the current sample end. The same resolved boundary supplies both the bounded source offset and immutable voice clock, and the visible playhead is reset to it when the voice starts.

The round-2 RED run recorded **5 failed and 26 passed** in `/tmp/opstudio-task4-round2-red.log`: sequential explicit preset replacement failed in the helper and real history reducer, while forward new-start, forward new-end, and reverse new-end paused resumes passed invalid offsets to the source. Final evidence:

| Check | Result | Log |
| --- | --- | --- |
| Complete review focus set | 6 files, **89/89 passed** | `/tmp/opstudio-task4-round2-focused-green.log` |
| Full unit suite | 52 files, **574/574 passed** | `/tmp/opstudio-task4-round2-full-unit.log` |
| TypeScript + production build | **passed**, 600 modules transformed | `/tmp/opstudio-task4-round2-build.log` |
| Round-2 rewritten/new lint set | **passed with no output** | `/tmp/opstudio-task4-round2-eslint.log` |
| Whitespace/error marker check | **passed with no output** | `git diff --check` |

Round-2 runtime changes are limited to `WaveformZoomModal.tsx`, `AppContext.tsx`, and `importedCrossfade.ts`; their regressions are in `WaveformZoomModalEditing.test.tsx`, `projectHistory.test.tsx`, and `importedCrossfade.test.ts`. The browser acceptance script additionally exercises real Web Audio Play, Pause, delayed source completion, resume, and held-P key release. Its drum setup now uses the actual empty-pad file chooser, and the Carbon cut toggle uses its visible pointer target before asserting `aria-checked` state.

## Browser acceptance

The initial controller matrix recorded **66 passed and 9 failed** in `/tmp/opstudio-task4-browser.log`. Chromium's main editor/export scenario passed. The reviewed product defects explain the missing Mobile Chrome/Mobile Safari editor in both editor scenarios and WebKit's modal dismissal after outside drag. The Firefox cut-toggle failure came from the forced checkbox harness interaction, and the remaining portrait failures also exposed unstable synthetic touch/upload readiness in addition to the missing mobile modal.

The first remediation rerun recorded **5 passed and 10 failed** in `/tmp/opstudio-task4-round1-browser.log`. All five portrait-and-landscape responsive cases passed, closing the real mobile modal failure. All five editor/export cases timed out because the browser correctly reported that the Carbon toggle's visual layer intercepted a click aimed behind it; all five newly added drum cases selected a hidden input without first establishing the pad target and therefore did not upload. These are acceptance-script interaction failures, not evidence that the closed frame/mobile fixes regressed. Round 2 uses the visible Carbon pointer target and the same actual drum-pad file chooser already exercised by the project's recovery-integrity browser suite.

`tests/e2e/loop-editor.spec.ts` is frozen for post-remediation controller execution with the full browser matrix. It uses both real drum and multisample tables and their **zoom and edit** modal. It checks zero and exact final-frame numeric values, verifies one atomic Save through Undo/Redo, verifies Cancel in each instrument, drags a marker outside the waveform, and opens the editor through the detected real touch capability in both portrait and landscape without a rotation gate. Upload waits for the applicable mobile/desktop table before selecting a file. The cut switch now receives an ordinary accessible click and must report checked before export.

The export portion uploads a real 4,800-frame 48 kHz WAV, chooses 44.1 kHz and **cut at loop end**, downloads the real preset archive, and inspects both `patch.json` and WAV bytes. The expected final buffer is 2,210 frames, with sample `[0,2210)`, loop `[441,2205)`, crossfade `553`, and WAV `smpl` loop start/end `441/2204`.

The controller's stable round-2 focused run passed **15/15** cases across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari in 25.5 seconds; evidence is `/tmp/opstudio-task4-round2-browser-stable.log`. This includes real Web Audio clock progress, Pause stability after the stopped source's late completion, resume progress, held-P progress across rerenders and keyup stop, the converted/cut byte contract, portrait/landscape touch access, and drum-table Cancel behavior. A preceding 15/15 run was deliberately excluded because its source/e2e snapshot overlapped a two-assertion e2e refinement; the stable rerun is the acceptance evidence.

The controller's final broad browser matrix is still running and is not claimed here until its result is recorded. Physical OP-XY readback remains pending.

## Downstream contracts

### Task 5 slicing

Use `FrameRange` and `normalizeSampleAndLoop` for exact source bounds. Materialize a new bounded `Float32Array`/`AudioBuffer` for a destructive slice and retain the original once for reset. Do not mutate the source buffer or reinterpret the half-open end. Re-normalize loop bounds against the newly materialized frame count.

### Task 6 recording

Recorded buffers must contain at least one frame before calling normalization. Initialize the sample range to `[0, buffer.length)` and loops through the same helper. Original provenance such as source sample rate/channels may differ from the current decoded buffer; frame bounds always use the actual `AudioBuffer` dimensions.

### Task 8 workspace UI

Preserve the modal's frame/second labels, dialog name, release explanation, raw-crossfade notice, selected-marker feedback, and save callback shape. Layout changes may restyle the responsive editor, but marker edits must remain drafts and one modal Save/Save for all must remain one project action.

## Confidence limits

The browser crossfade is an approximate smoothing pass on a copied buffer. It fades the loop head from the matching tail and reduces the tested wrap discontinuity, but it changes those preview head samples and is not guaranteed to improve every waveform. It is never baked into exported samples; the OP-XY receives the separate metadata value, avoiding double application. Its audible curve and the hardware DSP remain unverified.

ADSR raw integers remain the export truth. The browser's 30-second quadratic timing is explicitly labeled approximate and uncalibrated; no six-minute or device-parity claim is made.

Half-open JSON handling, RIFF inclusive-end conversion, AIFF boundary positions, and Web Audio preview behavior are backed by the sources in `audio-contract-research.md`. Teenage Engineering does not publish the full patch JSON or DSP contracts, so physical-device tests in that research note remain required before describing the result as hardware-certified.

## Controller final acceptance
Independent round2 scoped spec/quality PASS: task-4-round2-rereview.md. Stable focused loop browser run15/15 passed (/tmp/opstudio-task4-round2-browser-stable.log); subsequent full matrix80/80 passed in1.1m (/tmp/opstudio-task4-final-browser.log), acrossChromium,Firefox,WebKit,MobileChrome,MobileSafari profiles. The earlier round2 run overlapping a late e2e assertion edit is excluded. All runtime/e2e files were frozen during accepted runs. Physical-device checks remain unperformed.
