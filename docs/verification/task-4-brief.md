# Task 4: precise loop editing and honest audio preview

Prepared ahead of implementation. Reconcile Task2 serialization and Task3 history APIs from their reports before starting.
Workspace: /Users/stevencommander/Desktop/AI/op-patchstudio-improved. Authority: design requirement4.
Read docs/verification/audio-contract-research.md first. No commits, publication or new agents.

## Shared contract
- Canonical interval is half-open [startFrame,endFrame), 0 <= start < end <= actual buffer.length. Keep existing external seconds fields if migrating all callers is unnecessarily risky, but centralize conversions and explicit frame/seconds types/functions. Avoid arbitrary 0.1 second minimum that invalidates short samples; use one frame minimum.
- Correct WAV smpl: stored start unchanged, stored inclusive end = canonical end - 1. Correct AIFF MARK positions to boundary positions (end may equal framecount). Fix caller that currently sends length-1 before writer subtraction. Byte-level tests must inspect start0, nonzero start, final end, one-frame loop and converted/cut audio. Metadata without an enabled loop must not inadvertently enable sustained looping.
- Shared normalization should keep sample/loop boundaries valid after resampling/cut, import, zero crossing, edits and preview. Define behavior for loop bounds outside the selected sample and test it; do not silently change the original buffer.

## Editor
- Numeric input in frames and seconds, accessible labels and clamped validation; zero remains a valid value. Allow out/end at exact framecount. Keyboard accessible marker adjustments and clear selected-marker feedback.
- Pointer capture or document-level pointer movement/up handles mouse/touch dragging outside the waveform, pointer cancellation and unmount. Group one complete gesture as one undo step. Do not reset modal drafts merely because a parent passes new function/object identities.
- Play/pause/stop and visible playhead tied to actual preview clock, including trim, speed, reverse and loops; animation cleanup when closed/unmounted. Responsive layout without forced device rotation.
- Crossfade control in a normal 0..75% range. State should preserve imported raw/display meaning; serialize round(fraction*finalFramecount), not milliseconds. Browser smoothing behavior explicitly approximate until hardware measured. Use an understandable browser overlap fade algorithm with tests on discontinuity fixtures and unchanged source, within available loop bounds; do not silently bake it into export plus metadata twice.
- Clarify loop-on-release in concise interface copy using verified docs. Preview must respect enable/disable, release and stop, including very short loops.
- ADSR raw values remain export truth. Label timing approximate; do not replace undocumented30sec mapping with equally unverified6min. Give percentages/raw value as control labels. Hardware calibration is pending, not a software defect hidden as complete.

## Tests and delivery
Observe meaningful RED before changes. Verify real RIFF/AIFF bytes, numeric inputs, pointer drag beyond bounds, cancel/unmount cleanup, zero/one-frame/final-frame cases, crossfade source immutability and discontinuity reduction, preview playhead/release cleanup. Include focused import/export round trips and Task1 regression suite. Run full units/build; controller adds browser editing test. Preserve audio research confidence boundaries in user-facing help and report. Write docs/verification/task-4-report.md with interfaces consumed by slicing/recording/workspace tasks.

## Controller preflight rulings
Clamp loops inside the selected sample; disjoint bounds become the nearest valid one-frame interval. Modal Save commits one global history step; local intermediate undo is not required, and Cancel discards the draft. Preserve imported crossfade provenance/raw values even above75% with an unverified-preview notice; ordinary deliberate edits use0..75%. Add per-sample optional state and extend Task2 serialization/library plus Task3 archive validation as one bounded compatibility change. Scaling uses final exported framecount.

Imported per-region crossfade must be associated with a loaded sample by an unambiguous identity. Do not map region metadata to unrelated files merely by array order or duplicate basename. Keep unmatched raw imported JSON intact and surface a concise mapping limitation when it affects preview; test matched, unmatched and ambiguous cases. Reconcile any later Task7 relative-path import metadata through the same association contract.
