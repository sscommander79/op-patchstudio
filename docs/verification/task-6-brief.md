# Task 6: batch and sound-triggered recording

Reconcile preceding reports before execution. Authority: design requirement6. Work only op-patchstudio-improved; no commits/publication/additional agents. Preserve existing Record here access and provide shared Record takes workflow. Controller tests must use synthetic media, never a personal microphone recording.

## Capture and review
- Input selector, live level meter, clear armed/recording/stopped states and always reachable Stop. Request stream only after deliberate capture/setup interaction. Permission denied, unavailable device, disconnected device and unsupported browser errors are visible and actionable.
- Manual start/stop and sound-triggered mode. Sound trigger has threshold and hysteresis, configurable bounded pre-roll, silence stop and maximum take duration. Preserve attack audio from before trigger; detection and captured frames must share a sample clock. Long silence does not produce empty takes or endless memory growth.
- Repeated batch capture accumulates named takes in a review tray without assigning or modifying the project. Each take can be auditioned, renamed, removed and retained. Limit take count/total memory and show capacity. Auto re-arm must avoid immediately retriggering on a ringing tail; document threshold/hysteresis behavior.
- Explicit Add selected takes fills empty pads with overflow retained unassigned, or honors a specified target after visibly resolving occupancy. One history action for the batch. Cancel/close leaves project untouched and releases all streams, nodes, recorder/worklet callbacks, timers and audio contexts owned by the recorder. Stop pending getUserMedia result if modal was closed before permission resolves. Late decode/callback results cannot reopen or write into closed/replaced capture state.
- PCM capture must preserve original sample rate/channels; avoid lossy MediaRecorder as the canonical new capture path if a supported PCM worklet can deliver it. Keep browser compatibility or actionable fallback; do not silently claim unavailable recording modes work. Use bundled local worklet if needed, never remote code. Preview and stop cleanup must work in all modes.
- Keep max default20seconds for OP-XY output; present timer and limit clearly. Source metadata and filename type must match encoded source content.

## Tests
Deterministic audio frame blocks: leading silence then transient, quiet tail, burst near buffer boundary, multiple bursts, varying block sizes/channels/sample rates. Assert exact pre-roll, hysteresis, silence stop and length cap, no duplicate/dropped boundary frames, finite bounded memory, no empty silent take. Stream lifecycle tests cover denial, late permission, device change, close/unmount, repeated starts/stops and cleanup after encoding failure. UI tests cover review/select/delete/rename/apply, empty pads/overflow and one Undo. Controller adds Chromium synthetic-media end-to-end path; browser unavailable modes must clearly communicate limitation.

Follow current API docs and available audio reference tools before implementation. Write task-6-report.md with supported browsers, fallback behavior, lifecycle/state transitions, source-format contract, limits and RED/GREEN checks. Full units/build after focused tests.

## Astra assessment handoff and controller decisions
Read recording-architecture.md before implementation; it provides current primary sources, exact sample-frame state transitions, bounded message flow and ownership cleanup. Adopt its mono/stereo8–96kHz initial capture boundary, validated parameter defaults/bounds,32-take/256MiB owned-audio admission limits, and explicit unsupported-browser fallback. Actual browser-delivered PCM is the captured source rate; never claim interface ADC identity.

Use the existing lossless .opfloat source format with honest MIME/provenance and prepared AudioBuffer reducer payloads. Device export remains WAV/AIFF. Do not add an unrelated float-WAV encoder just for internal capture.

For multisample review, show/edit each selected take's root note. Propose consecutive unused MIDI notes from the explicit target (or C4), with visible assignments and0..127 bounds; do not silently replace an occupied note. Record here offers explicit replacement of its target, or a free note/cancel. Apply at most the remaining capacity within24zones; retain excess takes in the review tray with clear feedback rather than inventing an unassigned-multisample model. Existing larger legacy projects remain intact. Every applied batch remains one history action, and destination occupancy is revalidated immediately before dispatch.

## Project admission consistency
The review tray's256MiB ownership ceiling is separate from the portable project's128MiB aggregate decoded-audio/256-loaded-sample limit. Before applying takes, calculate the projected whole project against those limits as well as destination capacity; preserve unapplied takes and all existing work, with clear capacity feedback. Never treat a larger temporary recording budget as permission to produce a project that cannot be backed up. Resolve capacity before allocating duplicate encoded/project audio when practical.

## Current integration assessment
Read task-6-integration-checklist.md after the final accepted Task5 report. It specifies the archive header/source multiplicity accounting and guarded atomic commit with observable receipts required before removing applied takes from review. Reuse accepted helpers where available; do not copy an earlier moving Task5 implementation.
