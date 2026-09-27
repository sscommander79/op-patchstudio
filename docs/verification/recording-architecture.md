# Task 6 recording architecture assessment

Date: 2026-09-04. Status: planning handoff, not implementation or browser acceptance. Scope: this document only. No source edits, physical microphone capture, browser server, commit, push, or additional agent. Task 3 implementation was active while this assessment was written; re-read its final report and interfaces before implementing Task 6.

## Recommendation and current integration

Replace the internals of `src/components/common/RecordingModal.tsx` with a dedicated PCM capture session, a pure frame-processing state machine executed inside a locally bundled AudioWorklet, and a modal-owned take review tray. Keep both existing caller entry points. Only explicit Add selected takes changes the project; dispatch one prepared `BATCH_EDIT` after all selected assets and destinations have validated.

Preceding evidence reconciled: Task 1 exports preserve sparse drum identities and unassigned sounds; Task 2 introduces immutable AudioBuffers, lossless `storedAudio.ts`, and complete serialization; the Task 2 re-review closes its reported findings but does not substitute for controller browser acceptance. The developing Task 3 exposes `BATCH_EDIT` and counts unique retained AudioBuffer/File assets. This proposal uses those contracts instead of introducing another project store/history layer. `workspace-design.md` requires the same recorder for Record takes and Record here. Task 7 import planning likewise requires empty-slot placement and explicit replacement.

Observed current gaps:

- `RecordingModal.tsx` requests permission on opening, uses Opus/WebM MediaRecorder, stops from `Date.now()`/100 ms timers, and keeps one decoded buffer. Decode creates an unclosed context; audition creates another context/source that cleanup cannot stop. Pending permission/decode callbacks have no session-generation guard, and the opening effect has no unmount cleanup return.
- `DrumTool.tsx` converts a recording through an unnecessary OfflineAudioContext, quantizes to 16-bit WAV, then calls the file upload path. A full kit produces only a console warning. `MultisampleTool.tsx` similarly encodes and re-decodes; its target MIDI-note state is separate from the recorder's target index.
- Current upload helpers catch errors internally and dispatch per file. They are unsuitable as an atomic multi-take Apply implementation.
- `wavExport.ts` does not support float WAV and currently writes questionable loop offsets. Do not use it as the lossless canonical capture serializer or expand Task 6 into unrelated container repairs. Task 4 owns marker/audio-contract follow-up.

## Capture graph and source-rate meaning

Use one owned graph: selected audio track → MediaStreamAudioSourceNode → recording AudioWorkletNode → silent output → context destination. The processor writes zeros to its output, never live input, so monitoring cannot feed the microphone. Use one input, one silent output, `channelCountMode: 'max'` and `channelInterpretation: 'discrete'`; inspect the actual input channel arrays rather than assuming the default stereo count. The worklet must remain processing while its session is active. A disconnected destination and processor lifetime behavior need the real-browser check; do not rely on an unpulled graph remaining active. [Web Audio specification](https://www.w3.org/TR/webaudio/#AudioWorklet), [AudioWorklet constructor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode/AudioWorkletNode).

Use a self-contained local worklet artifact produced by the existing build, with its URL resolved relative to the application's deployed base. Include the processor's pure core in that artifact; no remote imports, blob-script generation, or CDN code. A single source core shared between unit tests and the built worklet is preferable to two algorithm copies. Verify the production-build asset URL, MIME and module loading, not just Vite development loading.

After the deliberate Enable input/Start/Arm gesture, request the chosen device, with supported echo cancellation, automatic gain control and noise suppression constraints requested off. Read back actual settings; these requests do not prove unprocessed hardware audio. Avoid forcing mono or the project export sample rate. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), [getSettings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings).

When the track reports a sample rate, create the capture AudioContext at that rate. Read back `context.sampleRate`, then use the worklet's rate as authoritative for captured frames. MediaStream input is resampled when track and context rates differ; default contexts follow the output device. Therefore “original” means the browser-delivered PCM stream, not a guarantee about an interface ADC. If preserving a reported track rate fails, show an actionable unsupported-format error instead of silently falling back to another rate. If settings omit rate, allow capture at the actual context rate with explicit “input rate not reported” information. Preserve every delivered channel or reject unsupported channel counts visibly; never silently downmix. [Web Audio source-node and context sample-rate rules](https://www.w3.org/TR/webaudio/#MediaStreamAudioSourceNode).

Proposed initial capture envelope: mono/stereo, 8–96 kHz, with exact reported rate requested when available. This covers the current exporter channel contract. More than two delivered channels must stop setup with guidance to select a mono/stereo input; selecting channels from an interface is a later feature, not an implicit mix. This is a product support boundary, not a claim that Web Audio cannot handle more channels.

## Pure sample-clock state machine

Proposed files: `src/audio/recording/captureCore.ts`, `captureProcessor.ts`, `captureSession.ts`, `recordedTake.ts`. Names may follow repository conventions; the separation is the contract.

The core accepts `process(channels, firstFrame)` where channels are equal-length Float32 arrays, and `firstFrame` is the worklet's absolute sample frame for the block. All thresholds, offsets, elapsed time and stops operate on integer frame counts. Read the supplied block length on every call. An empty input is not a block of captured silence: handle it as missing input, with a bounded setup allowance before the first valid frame and an interruption/error once active. Never fill capture gaps with invented frames. [AudioWorklet process contract](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process).

Parameters are validated and converted once per arm/start, never mid-take. Suggested defaults and bounds, which are product choices:

| Parameter | Default | Bound/meaning |
|---|---:|---|
| Start threshold | −30 dBFS | −72 to −6 dBFS; linear high = 10^(dB/20) |
| Hysteresis | 6 dB | 3–24 dB; low = 10^((threshold − hysteresis)/20) |
| Pre-roll | 250 ms | 0–2000 ms, strictly shorter than maximum take |
| Silence stop | 500 ms | 100–5000 ms |
| Re-arm quiet time | 250 ms | 100–2000 ms; new quiet period after completion |
| Maximum take | 20 s | 1–20 s; includes pre-roll and captured quiet tail |
| Take count | 32 | Counts retained, queued, and active reserved take |
| Recorder audio budget | 256 MiB | All owned PCM, source blobs, reservations and temporary encoding copies |

Use `round(seconds * rate)` for pre-roll and hold intervals and `floor(seconds * rate)` for the maximum. Require at least one frame for positive hold/maximum intervals. Reject NaN, Infinity, invalid dimensions and invalid ranges before allocation.

Detector proposal: for frame f, `peak(f) = max(abs(channel[c][f]))`; onset is `peak >= high`. In a recording, a frame with `peak >= low` resets the consecutive-quiet count; a frame below low increments it. This deliberately simple peak detector catches a one-frame attack and cannot cancel opposite-polarity stereo. Hysteresis prevents near-threshold chatter. Sustained low-level noise can prevent automatic stopping, which the level meter, threshold control and hard length cap make understandable. Zero crossings shorter than the silence hold do not stop a tone. An RMS detector would require a specified window and delay compensation; it is not necessary for this first implementation.

| State | Event/condition | Next state and action |
|---|---|---|
| `monitoring` | Manual Start, valid buffer credit | `recording`; first frame is the next processed frame; manual mode has no automatic pre-roll or silence stop |
| `monitoring` | Arm, valid buffer credit | `armed`; begin rolling pre-roll, no take allocated beyond reserved capacity |
| `armed` | Below start threshold | Stay armed; replace ring frames, no take or growing chunk list |
| `armed` | Frame f reaches high | `recording`; snapshot preceding ring frames then append f exactly once |
| `recording` | Quiet counter reaches S | Complete after that frame; retain the full S-frame quiet tail; `waiting-for-quiet` if auto mode remains enabled |
| `recording` | Stored length reaches M | Complete at exact exclusive start+M; `waiting-for-quiet` in automatic mode even if signal remains loud |
| `waiting-for-quiet` | Below low for R consecutive new frames AND fresh take credit available | `armed`; the next frame may trigger |
| `waiting-for-quiet` | At/above low | Reset re-arm counter; ringing tail cannot immediately start another take |
| Any live state | User Stop | Disable auto re-arm immediately; finish active take once, otherwise no take; then release input and enter `stopped` |
| Any live state | Capacity reached | Finish already reserved active take if any; enter `capacity-full`, release input; show Remove takes/Add selected takes |
| Any state | Cancel/close/replacement | `closed`; discard unaccepted work and release owned resources |
| Any live state | Input/processor/format discontinuity | `error`; stop/release; retain only already complete review takes |

If a take finalizes and a second event is encountered later in the same input block, continue processing that remainder according to the new state. Do not drop or double-consume the remainder. If silence and length limits coincide, emit one completion with a documented reason priority (length first). Manual all-zero captures produce “No audio captured” and no take; do not reject genuinely quiet nonzero manual captures using the sound-trigger threshold.

Use half-open frame ranges everywhere. Immediately before onset f, the ring contains `[max(sessionStart, f−P), f)`. Copy that range, then append f once. If less than P history exists, preserve only available frames, with no zero padding. After a prior completed take, clamp a new pre-roll start to at least `previousTakeEnd` so consecutive takes never reuse prior-take frames. Record actual pre-roll frames in take metadata. Maintain a monotonically expected next frame and reject discontinuities during capture. Meter messages carry frame-derived time and per-channel peak; UI redraw/timer scheduling is presentation only.

No sample trimming, normalization, resampling, crossfade, gain, or zero-crossing adjustment is part of capture. Subsequent editing/export is separate.

## Bounded data flow

Allocate the ring and a maximum-size planar take buffer before arming, outside the process callback. Copy into fixed arrays inside processing. On completion transfer ownership of the take arrays once, with `{sessionId, takeId, startFrame, endFrame, frames, sampleRate, channels, preRollFrames, reason}`. Validate the message dimensions and frame span before creating the exact-length AudioBuffer. Transfer does not mean free memory: transferred arrays remain charged until their receiver releases them.

Allow at most one completed take awaiting acceptance/materialization. The main session must acknowledge it and reserve/provide the next take buffer before the processor may re-arm. Quiet detection and the fixed ring can continue meanwhile. Display “Preparing next take” when processing capacity delays re-arming; bursts during that state are not promised captures. This explicit backpressure avoids an unbounded MessagePort queue. Meter updates likewise need one outstanding message/ack, coalescing to the latest level; a timer-rate limit alone does not bound a stalled main-thread queue.

The admission check includes retained AudioBuffers, already encoded File/Blob bytes, ring bytes, the maximum active take reservation, one in-flight transfer, and maximum temporary materialization/encoding copies. Count identities once. At 96 kHz stereo, a 20-second Float32 take is 15,360,000 bytes; both a take buffer and lossless source asset roughly double that. The count limit alone is insufficient. Keep headroom for one exact-length AudioBuffer and codec scratch; release staging arrays before reserving another take. The 256 MiB limit is an accountable owned-audio budget, not a promise about total browser process RSS or instant garbage collection. Do not silently evict retained review takes to admit new ones.

## Session ownership and cleanup

`captureSession.ts` owns stream/tracks, context, source/worklet/output nodes, ports/listeners, capture reservations, and pending operations. A monotonically changing generation token guards every async boundary: getUserMedia, enumerateDevices, resume, addModule, take materialization/encoding, preview and Apply preparation. Each stale success disposes its own returned resources; it never assigns them into the current session or emits a UI/project callback.

Opening the modal performs capability checks and optional enumeration only. A visible Enable input action explains that it enables the meter and microphone. Missing labels may display Input 1/Input 2 until deliberate permission. Starting/arming may perform this setup directly. Prevent overlapping setup attempts. [getUserMedia constraints and permission behavior](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

`getUserMedia` has no general abort operation and may remain pending while the user ignores permission. Stop/Close must invalidate that attempt immediately; if its promise resolves later, stop every returned track without constructing a new graph. Track stop does not itself produce the normal `ended` event, so explicit disposal cannot depend on that event firing. [Track stop](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop).

Provide two lifecycle operations: Stop gracefully seals at a processor boundary, then tears down; dispose is immediate and cannot rely on a responsive processor. Stop gets a bounded flush timeout; if it expires, release everything and report the unfinished take as failed rather than claiming a complete recording. Cancel/close always uses immediate disposal. Automatic inter-take stops may retain the graph only while auto mode is visibly armed/waiting; a manual Stop releases it. Awaiting encoding can leave the review tray open without leaving microphone capture active.

On cleanup: invalidate generation first; disarm; remove track/device/context listeners; clear port handlers and close ports; disconnect all owned nodes; stop all stream tracks; stop/disconnect preview sources; cancel animation, flush timers and any pending UI timers; close all owned audio contexts; release ring/staging references. Make cleanup idempotent and invoke it on close, unmount, setup failure and input replacement. Closing one owned context must never close `audioContextManager` or another tool's preview context.

Map NotAllowedError to permission/help/retry, NotFoundError to select/connect input, NotReadableError to device-in-use/connectivity guidance, OverconstrainedError to choose a supported input, and unsupported secure-context/worklet conditions to explicit capability guidance. `devicechange` refreshes the list without silently switching a live input. A selected-device change requires stopping the current session first; `ended` or active format change aborts the incomplete take while preserving earlier takes. On context suspension/interruption while capturing, show stopped/interrupted and require deliberate resume/setup; do not count wall time as captured silence. Processor errors make the node unusable and require a fresh session. [Processor error](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode/processorerror_event).

Audition owns a separate preview source/context or an explicitly disposable scoped player. Offer Stop preview. Starting a take stops preview; auditioning stops/disarms capture first so playback cannot create another take. Source `ended` handlers use a preview generation token; deleting the playing take, choosing another take, closing or unmounting stops it immediately.

## Review, source assets and Apply contract

Suggested take shape: `{id, name, selected, audioBuffer, frames, sampleRate, channels, actualPreRollFrames, completionReason, sourceFile?, error?}`. Distinct IDs preserve duplicate names. Rename/select/delete stay inside modal state and never consume project history. Completed takes remain reviewable through an input restart or recoverable encoding failure. Close/Cancel discards modal takes; if retention across closing is desired later, it needs an explicit save-draft design. Within the open tray, unselected takes remain after Add selected takes.

Preferred minimal lossless source: reuse `encodeStoredAudio`, create `<name>.opfloat` with `STORED_AUDIO_TYPE`, and provide the original captured AudioBuffer directly to prepared reducer actions. Task 2 already preserves this source type through storage/backup. Source metadata is actual capture rate/channels, Float32, frame-derived duration and encoded byte size. Do not pass `.opfloat` through the current browser file decoder or label its metadata `wav`. The `AudioMetadata.format` type currently excludes the internal format: widen the prepared-asset metadata contract narrowly or add an explicit internal-format variant, with exhaustive-use checks. This is a small required integration choice, not permission to claim OP-XY accepts `.opfloat`; device export still creates WAV/AIFF.

Alternative if ordinary WAV source downloads are required: add a separately verified IEEE Float32 WAV encoder, preserve the exact AudioBuffer, and use `.wav`/`audio/wav`/32-bit float consistently. The existing WAV helper cannot do this today. Do not silently use 16-bit WAV while claiming an unquantized captured source. Choose one canonical source contract before implementation; the recommended first contract is the existing lossless internal format.

Replace the single `onSave(buffer, filename)` callback with an async batch interface returning `{appliedIds, assignedCount, unassignedCount}` or a structured error. Parent callers supply instrument mode and target identity, and preserve the review state until success. All source encoding and metadata validation happens before dispatch; one failure applies nothing. Cancel/close while preparing invalidates the operation and prevents dispatch.

Drum placement plan: selected takes in review order fill currently empty slots among 0–23. Remaining takes become `ADD_UNASSIGNED_DRUM_SAMPLE` actions. For Record here, first selected take targets that specific slot; subsequent takes fill other empty slots, then unassigned. If occupied, show the existing name and explicit Replace/Choose empty pad/Cancel. Prefer preserving the replaced sound in unassigned via a prepared compound action. Revalidate target identity/occupancy after async preparation; a changed project invalidates a displayed replacement decision. Read the latest state and dispatch synchronously together, with no await between final placement and dispatch. If concurrent update ordering cannot be excluded, use one guarded reducer Apply action carrying expected destination identities.

Drum `BATCH_EDIT` contains prepared `LOAD_DRUM_SAMPLE`, overflow actions, and any explicit name/update actions; it creates one Undo. Retain unselected modal takes and report where overflow went. No silent full-kit failure. Applied IDs are removed only after successful dispatch/receipt. No-op selection is disabled and consumes no history.

Multisample preserves the existing Record here/root MIDI note entry. Its current model is a sorted file list without drum-style `isAssigned`/24-slot overflow, so do not impose the drum algorithm blindly. Explicit target MIDI note belongs in the caller contract, not a stale closure variable. Define replacement versus adding another zone at the same root note, and retain excess takes in the review tray if the existing model cannot honestly represent unassigned multisamples. This unresolved caller policy must be decided before claiming full multisample batch assignment acceptance.

## Verification handoff

Implementer RED tests first, then focused GREEN, full units and production build. This assessment ran no tests and claims no capture/browser support passes.

1. Pure core fixtures: leading silence plus one-frame impulse; every possible onset position around block/ring boundaries; stereo opposite polarity; only right channel active; quiet tail interrupted just before its limit; sustained ringing after length stop; repeated bursts; variable blocks including 1/127/128/129/257 frames; 8/44.1/48/96 kHz. Independently calculate exact frame ranges and compare every returned channel sample, not merely duration. Short-history pre-roll, zero pre-roll, overlapping-pre-roll clamp, silence/length coincidence and manual Stop each need explicit assertions.
2. Memory/admission: millions of quiet frames produce zero takes and stable ring capacity. A stalled take receiver and meter receiver cannot increase queued messages beyond credits. At count/byte limits, capture stops visibly without losing earlier takes. Include detached transfer arrays, invalid dimensions, channel changes and encoding failure.
3. Session tests with synthetic tracks and controlled promises: denial, not-found, unreadable, ignored permission, permission resolving after Stop/close/new session, module-load failure, resume failure, stopped track/device change, context interruption, processor error, repeated starts, StrictMode mount/unmount, closed modal during encoding and late preview ended. Assert no project callback and all resources/listeners released. These should verify observable ownership, not only that a cleanup method was called.
4. Real reducer/UI: name/select/delete/audition/Stop preview; source metadata/bytes agree; cancel unchanged; batch holes/full-kit/overflow; occupied target decision invalidated by intervening edit; failed preparation leaves state/tray intact; one Undo removes the complete applied batch and restores replaced assets. Unselected takes survive Apply.
5. Controller Chromium end-to-end: launch with `--use-fake-device-for-media-stream` plus `--use-file-for-fake-audio-capture=<absolute generated fixture.wav>` and grant only the test origin microphone permission. The fixture contains numbered bursts separated by quiet intervals. Both flags are required together for this route; Chromium documents that the fake WAV can be adapted to its internal audio buses. Assert controls, worklet loading, nonempty take, bounded duration, review, cancel/apply, overflow and Undo. Do not assert bit-exact fixture-to-browser equivalence across browser capture conversion. [Chromium media switches](https://chromium.googlesource.com/chromium/src/+/main/media/base/media_switches.cc).
6. Additional browser lifecycle tests may replace getUserMedia only in test initialization with an AudioBufferSourceNode → MediaStreamAudioDestinationNode synthetic stream, exercising the real downstream worklet and cleanup. Never leave a path that falls through to a personal input. Exact processing arithmetic remains a pure-core/worklet fixture responsibility. [Synthetic stream destination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination).
7. Browser matrix: desktop Chromium is the first synthetic capture gate; Firefox and WebKit need their own observed worklet/capture/cleanup checks before support claims. Mobile Safari/Chrome require separate gesture/interruption evidence. Where worklet or secure capture is unavailable, retain a clearly disabled recorder with “Recording requires a supported browser on HTTPS; import an audio file instead.” Do not silently present sound-trigger/pre-roll controls as functional. No MediaRecorder fallback is proposed; actionable file import is the bounded compatibility fallback permitted by the brief.

## Evidence limits and remaining choices

Current primary documentation was fetched using Context7 (`library` then `docs`, `/webaudio/web-audio-api`) and official W3C, Mozilla, Chrome/Chromium sources linked beside relevant claims. Context7 exposed draft render-size options; do not depend on those options. The implementation only needs block-size inspection. MaxMSPMCP was absent from the callable tool set, as also reported by the controller; no local audio-reference answer is claimed.

Before Sol implementation, resolve the following in its bounded plan: final Task 3 history API; deployed local-worklet build layout; internal `.opfloat` prepared-asset metadata versus newly verified float WAV source; multisample target/overflow policy; and whether the proposed threshold/hold/capacity defaults need product adjustment. The recommended defaults can be adopted as documented implementation decisions without asking the user to approve routine details. Real interface fidelity, browser constraints processing and OP-XY hardware audio quality remain unverified; this assessment does not require physical microphone or hardware testing.
