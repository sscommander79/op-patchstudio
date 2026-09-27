# Task 6 controller browser gates

Planning only; no capture or browser result is implied. Sol owns targeted e2e implementation; root runs browser/server gates only after source and tests are frozen.

## Agreed accessible surfaces
Shared dialog `Record takes`; `Enable input`, `Arm sound trigger`, `Start recording`, always present `Stop recording`, `Stop preview`, `Add selected takes`, and `Close`. Inputs: `Input device`, `Trigger threshold`, `Trigger hysteresis`, `Pre-roll`, `Silence stop`, `Maximum take length`. Stable take rows support Audition, Rename, Select and Remove, with Root note for multisamples. Record here retains its explicit target; both tools expose Record takes. Confirm actual final names before running tests.

## Synthetic input only
All five existing profiles use a test-only getUserMedia implementation backed by AudioBufferSourceNode to MediaStreamAudioDestinationNode. It must never fall through to the real mediaDevices implementation. The downstream capture graph and bundled AudioWorklet remain real. Numbered generated bursts and quiet gaps exercise repeated sound-trigger capture; manual capture and user Stop exercise separate transitions. Readiness and take completion use observable UI conditions, not a fixed wait presented as evidence.

A separate Chromium gate uses both fake-device and fake-audio-file launch flags plus microphone permission scoped only to the test origin. The input WAV is generated locally from deterministic synthetic samples. Do not use physical microphones or compare browser capture samples directly with the fixture as a claim of device-level bit accuracy.

## Workflow evidence
Verify no permission request just from opening, explicit setup, visible meter/state, manual capture/Stop, repeated triggered takes, edit/select/delete/audition/Stop preview, and Cancel/Close without project changes. Add a selected batch into holes and a full drum kit with overflow; verify actual backup source metadata and one Undo/Redo. Unselected takes remain in the tray after Add; a rejected current-state commit leaves all takes reviewable. Multisample proposals/root-note correction and explicit occupied-target resolution must preserve unrelated samples and excess takes.

Lifecycle checks should observe tracks ended/stopped, contexts closed, and owned nodes/listeners disposed when closing the still-mounted modal, changing input, or resolving late setup. Synthetic setup can expose resource status only in the test harness; do not add production debug globals. Exact pre-roll/frame-boundary/no-overlap arithmetic remains covered by independent pure-core fixtures, not inferred from UI duration.

## Production worklet gate
After a production build, run the app with a separate coordinated preview server. Exercise synthetic capture through the emitted local worklet; inspect actual successful module fetch, content type and nonempty completed take. Verify the URL resolves with the app deployment base. A passing dev-server test does not establish production bundling. Stop the preview server afterward. Production offline caching is Task9; avoid conflating that known pending issue with successful online worklet loading.

## Acceptance boundary
Run focused recording profiles first, then the existing full browser suite when shared context/history/format code changed. Report unsupported engine/capability paths explicitly. Freeze includes e2e files; no assertion edits during an active acceptance run. Existing accepted Task5 baseline is617 unit tests and85 browser cases; counts will grow with actual new tests. No physical OP-XY, interface fidelity or real desktop Splice validation is claimed.
