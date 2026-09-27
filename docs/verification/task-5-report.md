# Task 5 verification report: automatic slicing and live manual chop

## Delivered behavior

- The drum workspace now has a visible **slice audio** source chooser and each loaded drum row has **slice this sample**. Both open `SliceAudioModal`, including mobile layouts.
- Auto mode analyzes immutable `AudioBuffer` channel data, shows waveform markers and a slice count, lets the user adjust sensitivity and minimum spacing, and auditions every `[start,end)` region before Apply. Silence reports a no-onsets state.
- Manual mode uses `audioContextManager.getCurrentTime()` and `previewFrameAtTime()` for **Mark slice** and the dialog-owned `M` shortcut. While stopped, markers can be added by splitting the widest region, moved by captured pointer or arrow keys, entered numerically, and deleted. Canonical normalization prevents duplicates, reversal, and zero-length output.
- Apply preflights the complete operation, materializes each slice into its own exact Float32 `AudioBuffer`, stores its internal File with the lossless Task 2 `application/vnd.op-patchstudio.float32` codec, and dispatches one `COMMIT_PREPARED_SLICES` operation. The reducer revalidates the current source, all drum and multisample assets, limits, and current destinations, then checks every child result before exposing the new state. Empty physical pads are filled in ascending order; excess slices remain loaded and unassigned. A rejected receipt keeps the modal open with its error. Cancel dispatches nothing.
- Existing in-project sources keep their original slot, object identity, settings, File, and buffer. A newly selected external source is retained once as an unassigned original. Derived assets do not repeat the original File.
- The dialog reports available-pad and overflow counts and flags every output region longer than 20 seconds before Apply. The legacy device-export helper currently includes retained unassigned source audio as an unreferenced archive member; Task 8 will provide the mapped-only default and explicit include-unassigned choice.

## Detector and resource contract

The detector is a deliberately limited amplitude-rise heuristic rather than an instrument classifier. It takes the maximum absolute value across channels, so opposite-polarity stereo does not cancel. It samples at most 8,192 amplitudes for a median noise floor, then uses:

- `threshold = noiseFloor + (peak - noiseFloor) * (0.62 - sensitivity * 0.52)`
- a local maximum and rise of at least `threshold * 0.45`
- a slowly moving baseline (`0.995` previous + `0.005` current)
- rearm after at least 5 ms of quiet (bounded by the selected minimum spacing), which keeps a ringing tail from repeatedly triggering
- bounded attack-start refinement over at most 50 ms (also bounded by minimum spacing), so a noise-like burst is cut at its leading edge rather than its first later peak
- caller-selected minimum spacing; a stronger adjacent candidate replaces the weaker one
- activity tracking to remove leading and trailing silence

Analysis caches channel arrays, retains at most 129 accepted candidate records before an actionable over-limit error, yields to the browser every 32,768 frames by default, checks cancellation at each yield, and reports progress across both scans. Waveform drawing samples at most 64 points per display pixel so the preview does not add another full synchronous scan. Sustained, heavily compressed, reverberant, or dense material may require different sensitivity/spacing or manual markers.

Admission is bounded before derived allocation:

- source File: 64 MiB
- decoded source: 64 MiB (`frames * channels * 4`), including the projected browser-rate decode
- all derived decoded slices: 64 MiB
- whole portable project decoded audio: 128 MiB
- whole projected stored/archive payload: 256 MiB, with the archive's full 2 MiB manifest allowance and a 63,100-byte maximum STORE ZIP structure allowance reserved
- loaded project samples: 256
- accepted slices: 128

The project calculation includes every logical drum and multisample opfloat entry's 24-byte header. Original source bytes are counted once; derived source Files are omitted because their exact opfloat audio is already the archive payload. It also reserves the exact maximum STORE ZIP structure for the 513 possible paths (one manifest, 256 logical audio entries, and 256 source entries): `22 + sum(76 + 2 * UTF8(path).length) = 63,100` bytes. This accounts independently for the end record plus every local header, central-directory header, and repeated path. The new-source chooser accepts validated uncompressed PCM or IEEE-float WAV and uncompressed AIFF. It requires the declared RIFF/FORM endpoint to match the File and validates every chunk header, body, padding byte, PCM sample width/block alignment, dimensions, and AIFF sound offset before browser decode. Compressed WAV and AIFF-C are rejected with a specific message; existing project samples already decoded by the application remain sliceable.

## Frames, identity, and persistence

`SliceProvenance` stores `sourceIdentity`, source name, `startFrame`, `endFrame`, `sourceFrameCount`, `sourceSampleRate`, and `sourceChannels`. These frame fields explicitly describe the current decoded source coordinate space used by the editor. The slice's existing `originalSampleRate`, `originalChannels`, bit depth, and source metadata continue to describe the imported file and may legitimately differ from the decoded buffer. Archive validation checks provenance against its declared source coordinate bounds and never clamps it to the shorter derived buffer.

For a slice `[a,b)`, `materializeSlice()` allocates exactly `b-a` frames and copies each source channel's `subarray(a,b)`. Original-rate export therefore writes `b-a` frames. Configured resampling operates on this bounded derived buffer; the browser test asserts the converted frame count `ceil((b-a) * targetRate / decodedRate)` and equivalent duration within one target frame.

Portable project serialization writes each derived slice's exact opfloat audio and omits a repeated `sourcePath`; the retained original has its source bytes once. Source identity and provenance survive session/library-shaped serialization and `.opstudio` export/import under the existing v1-compatible optional field rules.

When an existing derived slice is sliced again, the new interval is composed back into the retained original source's frame coordinate space. This keeps one `sourceIdentity`, original source name, and original frame bounds instead of relabeling derived-buffer frames as original frames.

Future admission work can reuse the Task 5 contract: `prepareSliceApplication()` creates immutable assets, while only `COMMIT_PREPARED_SLICES` may publish them. `finalizeSliceApplication()` rechecks current whole-project capacity/source identity and replans empty pads at the atomic reducer boundary. Callers must use the operation ID receipt and must not replay prepared child actions. Task 8 can distinguish mapped outputs from retained originals/overflow through `isAssigned`, `assignedKey`, `sourceIdentity`, and `sliceProvenance`, while keeping full project backup inclusive.

## RED/GREEN evidence

- Initial core RED was a missing `audioSlicing` module and the application RED was a missing `prepareSliceApplication`; those earliest terminal outputs were not persisted. The retained component RED is `/tmp/opstudio-task5-modal-red.log` and wiring RED is `/tmp/opstudio-task5-wiring-red.log`.
- Frame-zero keyboard and pointer control RED: `/tmp/opstudio-task5-pointer-red.log`.
- Stopped add-marker and dishonest PCM admission RED: `/tmp/opstudio-task5-admission-add-red.log`.
- A realistic damped tonal/noise burst fixture first retriggered six cuts instead of two, `/tmp/opstudio-task5-ringing-red.log`; the bounded quiet-rearm and attack-refinement result passed all 13 detector/resource tests, `/tmp/opstudio-task5-ringing-green.log`.
- Detector/admission plus modal controls before the ringing-tail refinement: 20/20 passed, `/tmp/opstudio-task5-admission-add-green.log`.
- Atomic apply/Undo and real ZIP/WAV slice frame bytes: 3/3 passed, `/tmp/opstudio-task5-export-frames-green.log`.
- Archive/application provenance focused gate: 20/20 passed, `/tmp/opstudio-task5-provenance-green.log`.
- Re-slicing provenance was RED when it mixed an original identity with derived-buffer coordinates, `/tmp/opstudio-task5-reslice-provenance-red.log`; original-coordinate composition passed 4/4 application tests, `/tmp/opstudio-task5-reslice-provenance-green.log`.
- Drum workspace wiring: 12/12 passed, `/tmp/opstudio-task5-wiring-green.log`.
- Final focused Task 5 gate: 6 files, 72 tests passed, `/tmp/opstudio-task5-focused-final.log`.
- Full unit suite: 55 files, 603 tests passed, `/tmp/opstudio-task5-full-unit-final.log`.
- Production TypeScript/Vite build passed with existing Sass, bundle-size, and browsers-list warnings, `/tmp/opstudio-task5-build-final.log`.
- `tests/e2e/slicing.spec.ts` is discovered once in each of the five configured browser profiles, `/tmp/opstudio-task5-e2e-list.log`. Browser execution is reserved for the controller after the source/e2e freeze.
- Round-one review fixes pass 67 focused tests, including current-state atomic admission, malformed declared-container tails, stable marker typing/drag identity, stale analysis, owned preview shutdown, actual archive headers, and reducer restoration provenance, `/tmp/opstudio-task5-round1-focused-fourth.log` and `/tmp/opstudio-task5-round1-focused-post-atomic.log`.
- The full unit suite after round one passes 56 files / 616 tests, `/tmp/opstudio-task5-round1-full-unit.log`; the production build passes in `/tmp/opstudio-task5-round1-build-final.log`; new/modified Task 5 files pass targeted lint and the tree passes whitespace validation in `/tmp/opstudio-task5-round1-lint-final.log` and `/tmp/opstudio-task5-round1-diff-check-final.log`.
- The controller's first browser matrix exposed a one-Undo failure. Temporary history tracing proved Apply was one entry, followed by an automatic `SET_DRUM_BIT_DEPTH` from source-dependent format controls; the trace is `/tmp/opstudio-task5-round1-undo-actions.log`. Removing automatic format rewrites and keeping the configured current option enabled makes the unchanged Chromium source→manual mark→Apply→export→one Undo→restore flow pass in `/tmp/opstudio-task5-round1-narrow-browser-green.log`. Temporary diagnostics were removed before handoff.
- Round two closes the sole re-review residual by reserving STORE ZIP headers, names, and end record independently of the full manifest allowance. Exact-limit admission, one-byte-over preallocation/current-commit rejection, and a small emitted-ZIP layout tie pass 43/43 focused tests in `/tmp/opstudio-task5-round2-focused-first.log`.
- The round-two full unit suite passes 56 files / 617 tests in `/tmp/opstudio-task5-round2-full-unit.log`; the production build passes in `/tmp/opstudio-task5-round2-build.log`; scoped new-code lint and whitespace validation pass with empty output in `/tmp/opstudio-task5-round2-lint.log` and `/tmp/opstudio-task5-round2-diff-check.log`.
- No browser or e2e source changed in round two. The controller's frozen round-one browser matrix remains 85/85 passing in `/tmp/opstudio-task5-round1-full-browser.log`.

## References and verification boundary

- W3C Web Audio API 1.1: <https://www.w3.org/TR/webaudio-1.1/>. The implementation uses the audio context clock for playback-relative boundaries and standard `AudioBuffer` channel/frame semantics.
- W3C Web Audio API recommendation: <https://www.w3.org/TR/webaudio/>. It defines `AudioBuffer`, `getChannelData`, `copyToChannel`, and context-relative scheduling behavior.
- ISMIR 2012 onset-detector evaluation: <https://ismir2012.ismir.net/event/papers/049_ISMIR_2012.pdf>. It supports treating onset detection as an evaluated signal heuristic with material-dependent tradeoffs rather than universal semantic detection.
- Current Web Audio API documentation was also fetched through Context7 (`/webaudio/web-audio-api`) before implementation. The configured Max/MSP reference service was unavailable, so no Max/MSP claims were used.

No physical OP-XY/OP-1 device was available. Current evidence covers deterministic DSP fixtures, application state/history, real lossless and WAV bytes, and portable ZIP round trips. The controller-owned browser matrix remains the final runtime gate; this is not hardware certification.
