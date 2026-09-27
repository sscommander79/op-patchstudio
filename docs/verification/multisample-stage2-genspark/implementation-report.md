# Stage 2 Guided Automatic Multisampling Implementation

Implemented the bounded Connect/check -> Capture range -> Review -> Finish journey without changing the capture engine, DSP, storage schema, or export implementation.

## Included

- Explicit ephemeral hardware/software guided intent from `StudioShell` through `MultisampleTool` into `RecordingModal`.
- Existing editor Record takes entry remains the standalone manual/sound-triggered recorder with the existing automatic panel.
- Guided step state, back/next controls, busy guards, retained review takes, and hidden-control focus filtering.
- One retained sound-check buffer, parent-owned audition/stop lifecycle, explicit heard-the-intended-instrument confirmation, and cleanup/invalidation guards.
- Guided checks required for custom and named profiles. Audio input, MIDI output, channel, velocity, check note, hold, tail, settling, and readiness timeout invalidate evidence. Range end and step do not.
- Existing warned-take retry eligibility retained across invalidation and gated on a renewed confirmed check, with current-settings labeling.
- Existing review tray and commit receipt remain authoritative. Finish appears only after committed IDs; retained or rejected work stays in Review.
- Finish actions close the recorder and invoke existing toolbar save/export behavior. No automatic save, export, download, or device transfer occurs.
- Focused component and shell-browser regression coverage was added or adapted.

## Verification

No commands were run. Root must run typecheck, lint, unit tests, build, and browser verification.

## Deferred

- Low-level MIDI note-off reporting remains deferred because the contract prohibits changes to `AutoSampler` and audio engine files. The existing disconnect/stuck-note advisory remains visible.

## Root Correction Pass

1. Duplicate standalone Start note: already corrected before this pass; standalone renders one Start note control.
2. Check cancellation: added an explicit guided Stop sound check control while permission, capture, or cleanup is active; legacy keeps the existing Stop automatic capture label.
3. Check memory: the in-flight check is conservatively bounded before capture, and the eventual actual check-buffer bytes are included in the shared recorder usage callback without double-counting. Invalidating or closing releases the accounted bytes.
4. Check races: added a monotonic evidence generation and delayed evidence publication until `AutoSampler.run()` returns after owned capture cleanup. Port changes and cancellation invalidate pending publication.
5. Review audition: added a visible guided Review Stop preview action.
6. Compatibility: retained legacy input/manual controls and playback gating; the standalone custom capture behavior remains unchanged.
7. Audio selection: explicit guided input changes increment the selection version, while saved-profile restoration continues through the non-explicit callback.
8. Phase truthfulness: guided runs enter Review only after producing a take, or when prior retained takes exist; empty failures and empty cancellation remain in Capture.

Added focused coverage for zero-duration guided checks, unchanged-output port invalidation during delayed cleanup, pre-MIDI check budget rejection, guided Review preview stop, and rejected commit retention. Root still owns execution of all checks.
