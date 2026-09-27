# Automatic multisampling review

Reviewer: controller (Astra). Implementation: one Sol worker. Scope is the new sequencer, routing panel, recorder integration and their tests; previously accepted upgrade work is not re-audited.

Initial frozen-source review found:

1. **P1 — Invalid note step can freeze rendering.** The range-preview helper loops without validating its increment; clearing a number input yields zero. Validate before iteration and bound the preview, including stored preferences.
2. **P1 — Stop/restart can lose ownership of the new run.** The old asynchronous run can clear a newer sampler reference and running state. Cancellation must interrupt pending timing operations; callbacks and cleanup must belong to their originating run.
3. **P1 — Connected MIDI output rejected.** In installed WebMidi 3.1.16, `getOutputById(id, {disconnected:true})` searches only disconnected outputs. Use the connected lookup and physical device state. The original unit mock did not reproduce this distinction; native synthetic MIDI integration must exercise the real wrapper.
4. **P2 — Hidden page cancellation missing.** Stop the owned capture and note when the page becomes hidden.
5. **P2 — Routing profiles incomplete.** Save independent input/output/settings for the named routes; unresolved devices require selection, without requesting permission during restoration.
6. **P2 — Review destinations editable during capture.** Lock review and occupied-target controls while the run owns capture.

Earlier integration review also identified MIDI echo into the app keyboard. Opening the recorder now stops app notes and disables the virtual keyboard's active input path; focused regression coverage is required.

These findings were returned to the same worker. Correction review confirms bounded range construction, cancellation signals and run ownership, the connected-output lookup, page hiding cleanup, independent route preferences and review-control locks. Follow-up checks also corrected StrictMode lifecycle replay, serialized repeated Stop, already-enabled MIDI discovery on reopening, and unresolved saved audio routes before enumeration or across reopening. Regression tests accompany these paths.

Source review disposition: all listed findings addressed. Final build/browser results and screenshots are recorded separately in `auto-sampling.md`; source review alone does not establish those checks passed. No physical NINA, Digitakt II, Ableton or OP-XY behavior has been verified.
