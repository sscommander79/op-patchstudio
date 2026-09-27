# Task 6 verification report: browser PCM recording and review takes

## Delivered behavior

- Drum and multisample workspaces share one **Record takes** dialog, while contextual **Record here** still carries the selected pad or root-note identity. Opening the dialog does not request input permission.
- Manual and sound-triggered capture use browser-delivered mono/stereo Float32 PCM at the accepted 8–96 kHz context rate. The product requests echo cancellation, automatic gain control and noise suppression off, shows whether the browser actually reported an input rate, and does not claim interface ADC fidelity.
- Sound capture uses an exact integer sample clock, peak detection across all channels, −30 dBFS default threshold, 6 dB hysteresis, 250 ms pre-roll, 500 ms silence stop, 250 ms quiet re-arm and a 20-second hard cap. The documented bounds are enforced before allocation. Manual all-zero captures and automatic silence do not create empty takes; quiet nonzero manual audio is retained.
- A local Vite-bundled `AudioWorklet` runs the pure frame core. Its graph is input track → source → worklet → silent output → destination, so captured input is never monitored through the output. Completed takes transfer their full preallocated buffer ownership once; the main thread materializes the valid prefix and grants at most one next-take credit. Meter messages also use one outstanding acknowledgement.
- The review tray keeps up to 32 named takes and exposes stable ID-based Select, Name, Audition, Remove and multisample Root note controls. No project action occurs until **Add selected takes**. Unselected and zone-capacity excess takes remain in review after the reducer confirms the applied IDs.
- Recording Apply writes an ordinary lossless `.opfloat` File (`application/vnd.op-patchstudio.float32`) while retaining the same exact AudioBuffer. Portable-project admission counts the audio payload, ordinary source copy, logical 24-byte headers, full manifest allowance and 63,100-byte STORE ZIP reserve across both instruments.
- `COMMIT_PREPARED_RECORDINGS` rechecks the current reducer state and returns an operation-ID receipt. Drum takes fill physical pads 0–23, then remain loaded and unassigned; replacement preserves the displaced sample as unassigned. Multisample roots are visible/editable from 0–127, occupied roots require replace/free/cancel, replacement approval is identity-bound, additions stop at 24 zones, and a size-neutral replacement preserves legacy projects already above 24 zones. One accepted batch is one Undo/Redo operation.

## Capture ownership and lifecycle

The pure core reserves fixed pre-roll and maximum-take arrays and never builds a growing chunk list. It processes the actual block length, validates monotonically contiguous `firstFrame`, uses half-open ranges, appends an onset once after pre-roll, gives length priority when length and silence coincide, and continues through the remainder of a variable block without duplicate or dropped frames. A transferred take remains immutable while processing waits for explicit replacement-buffer credit.

The owned session checks the 32-take and 256 MiB recorder limits before input graph allocation, before exact AudioBuffer materialization, and before acknowledging another take. Its conservative peak includes retained buffers and Files, the independent ring, current and next full transfers, exact materialization and stored-audio staging. An accepted 32nd take stops capture instead of granting a 33rd credit, even when React has not rendered the new row yet.

Stop remains available during pending permission and active capture. Graceful Stop admits the owned final `take → stopped` sequence, awaits asynchronous materialization, and has a 500 ms bounded flush error. Hard close invalidates every asynchronous generation. Late permission tracks are stopped; processor errors, ended tracks, missing active input and encoding failures release the graph. Close/Cancel, unmount, input recreation and preview replacement close all owned tracks, nodes, ports, listeners, timers and AudioContexts. A missing input has a 500 ms setup grace, then becomes visible failure; an active input gap fails immediately without invented silence.

## Public integration surfaces

- `CaptureCore` and `validateCaptureOptions` provide the pure worklet-independent frame contract.
- `CaptureSession` owns permission, readback, graph construction, bounded messaging, take materialization and cleanup.
- `prepareRecordingApplication` produces immutable prepared assets; `finalizeRecordingApplication` performs the synchronous current-state destination and admission check used by `COMMIT_PREPARED_RECORDINGS`.
- `recordingCommitResult` reports committed/rejected status, operation ID, applied/retained IDs, assigned count and overflow count.
- `RecordingModal` now accepts `instrument` and one `RecordingTarget` instead of the former quantize/redecode save callback.
- `PLAYWRIGHT_PRODUCTION=1` switches the standard browser configuration to `vite preview` on port 5187. The separate `playwright.recording-device.config.ts` requires `PLAYWRIGHT_FAKE_AUDIO_FILE`, generates deterministic PCM at that explicit path, grants microphone permission only to the local test origin, and always launches Chromium with both fake-device and fake-audio-file flags.

## Changed Task 6 files

- Runtime: `src/audio/recording/captureCore.ts`, `captureProcessor.ts`, `captureSession.ts`; `src/components/common/RecordingModal.tsx`; drum and multisample caller wiring; `src/utils/recordingApplication.ts`; shared capacity planning in `src/utils/audioSlicing.ts`; guarded receipt integration in `src/context/AppContext.tsx`.
- Unit tests: `src/test/audio/recording/captureCore.test.ts`, `captureProcessor.test.ts`, `captureSession.test.ts`; `src/test/components/RecordingModal.test.tsx`; `src/test/context/recordingApplication.test.ts`.
- Browser harness: `tests/e2e/recording.spec.ts`, `recording-fake-device.spec.ts`, `recordingFakeDeviceSetup.ts`, `playwright.config.ts`, and `playwright.recording-device.config.ts`.

## Verification evidence

- Adding the required 128-frame split initially left the final quiet frame outside the fixture and correctly failed the exact take assertion (`/tmp/opstudio-task6-variable-128-red.log`); the corrected independently summed block sequence passes all nine core tests (`/tmp/opstudio-task6-variable-128-green.log`). Earlier feature RED outputs were visible during implementation but were not retained as files.
- Pure frame tests cover exact pre-roll arrays, short history, 8/44.1/48/96 kHz validation, stereo opposite polarity, 1/127/128/129/257-frame variable blocks, quiet-tail hysteresis, boundary bursts, no overlap, no empty manual take at the hard cap, length priority, re-entry rejection, full-buffer handoff and meter/take backpressure.
- Worklet tests execute the actual registered processor: silent output, bounded missing-input grace, immediate active-gap error, and full owned-buffer `take` before `stopped` without completion slicing.
- Session tests cover denial, late permission after Stop/Close, constraint/readback honesty, processor and device errors, owned final-take ordering, flush timeout, preparation rejection, disposal, count/byte admission and stale 31→32 credit prevention.
- Reducer/application tests use real prepared assets and history for holes, overflow, displacement, stale identity rejection, multisample limits, legacy replacement, near-256-reference replacement, exact Float32 file bytes, portable archive source metadata and archive recovery.
- Modal tests cover stable ID rename/remove/select/apply, repeated manual Stop→Start with a fresh session, pending setup after Close, preview-resume after Close, Apply losing to Close, multisample root editing, devicechange listener ownership and unsupported fallback.
- The final full unit suite passes 61 files / 657 tests in `/tmp/opstudio-task6-unit-final.log`. The production TypeScript/Vite build passes in `/tmp/opstudio-task6-build-final.log` and emits `dist/assets/captureProcessor-CJEaL2V6.js` as a local JavaScript asset. New recording runtime, test and browser-harness lint passes with empty output in `/tmp/opstudio-task6-lint-final.log`; full-tree whitespace validation passes with empty output in `/tmp/opstudio-task6-diff-check-final.log`.
- `tests/e2e/recording.spec.ts` contributes two tests across each of Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari: ten synthetic-stream cases discovered in `/tmp/opstudio-task6-e2e-list-final.log`. They require exactly two sound-triggered takes, retain an unselected second take, inspect actual `.opstudio` OPAS frames/source/metadata, prove one Undo/Redo preserves prior settings, repeat manual Start/Stop, Cancel without project changes, and verify every synthetic track ended. `recording-fake-device.spec.ts` adds one separate opt-in Chromium real-`getUserMedia` case discovered in `/tmp/opstudio-task6-fake-device-list-final.log`. No browser or server was launched during implementation; the controller runs these frozen gates.

## Limits and remaining runtime gates

Browser engine support, the production asset response URL/MIME and the fake-device input path remain pending controller execution after source freeze. The five-profile tests use a test-only MediaStream destination and never fall through to a personal microphone; the separate Chromium case always uses Chromium's fake device and explicit generated WAV. No physical microphone, audio interface, OP-XY/OP-1 hardware or desktop Splice integration was used or certified.

The peak detector is intentionally simple. Sustained material above the low threshold runs until the hard length cap, and bursts received while a completed take awaits main-thread credit are not promised captures. Recorder accounting bounds owned audio reservations and copies but cannot promise immediate browser garbage collection or total process RSS. Offline/PWA coverage remains Task 9.

## References

- W3C Web Audio API: <https://www.w3.org/TR/webaudio/>
- MDN AudioWorklet: <https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet>
- MDN `AudioWorkletProcessor.process`: <https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process>
- MDN `MediaDevices.getUserMedia`: <https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>

Current Web Audio documentation was also fetched through Context7 (`/websites/webaudio_github_io_web-audio-api`) before implementation. The configured Max/MSP MCP service was unavailable, so no claim is based on it.
