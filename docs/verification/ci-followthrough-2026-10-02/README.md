# CI follow-through — 2026-10-02

Active goal requested by user while away: resolve post-push CI failures, obtain Claude and/or Genspark review, implement verified in-scope repairs and push verified changes. Integration owner: Codex. Branch: codex/studio-upgrade. No merge or deployment. Local duplicates, user kit and deferred HV001/HV004 preserved.

## Initial evidence

Commit 3061b96 successfully reached origin. Its GitHub Quality run 37067181483 failed: four Chromium assertions assumed a 48 kHz device; Linux decoded at 44.1 kHz. The browser-regressions job timed out at 25 minutes after repeated Firefox import/playback failures; its failure summary and upload step were lost. macOS visual job passed.

All four Chromium failures reproduced locally with a real 44.1 kHz AudioContext (`rate-44100-red.log`). No browser decoder was mocked. After repair all four passed (`rate-44100-green.log`). Three affected suites then passed 78 cases across five browser profiles, with two existing desktop-only skips (`portable-audio-all-profiles.log`).

## Changes

- Test context fixture can reproduce 44.1/48 kHz output devices while retaining real decoder, audio nodes and timing.
- Audio import checks the native decoded rate rather than the Mac rate. Slicer independently decodes fixture bytes and verifies real frames, duration and exported provenance. The exact 48-to-44.1 kHz loop export contract explicitly selects its input context rate; the ordinary drum editor Cancel test follows device frames.
- CI runs browser profiles in independent jobs, with a shorter test-step deadline leaving time to upload failure evidence. Existing assertions and browser coverage retained.
- Claude found a real slicer failure state: null playback result entered playing state and disabled editing. A RED regression reproduced it; the fix keeps stopped, reports failure and allows retry. All 39 slicer unit tests passed after repair.

## Claude read-only review

`claude-review.txt`: CLI requested claude-opus-5-5, plan mode, strict MCP configuration, no browser or edits. Exit 0. Report says static review of 3061b96, not runtime execution or independent provider attestation.

Finding disposition so far:
- F1 test sample-rate assumptions: repaired and reproduced at 44.1 kHz.
- F2 existing device-rate decoding / keep-original export inconsistency: confirmed source behavior; architectural import fidelity change is outside this CI repair. Original source bytes remain preserved and decoded dimensions remain truthful. Track separately; do not silently change frame coordinate semantics across existing projects.
- F3 CI timeout/evidence loss: matrix separation and evidence uploads implemented; remote verification pending.
- F4 Firefox import/playback failure: root cause still under investigation; require fresh remote traces.
- F5 null slicer playback: regression and bounded production repair implemented.
- F6 release envelope interpolation: reviewer states no defect in changed scheduling; small existing release-step concern is unproven and outside this repair.
- F7 stereo capacity reservation is intentional; pending-message ordering harm unproven, not changed.
- F8 subsequent CI gates were skipped on initial run; final remote gates remain required. Initial macOS visual gate was independently confirmed passed.

Official CI guidance retrieved through find-docs/Context7 (Playwright 1.63): https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-sharding-js.md and https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/ci-intro.md. It supports independent matrix jobs and preserving reports; no documented PulseAudio prerequisite was found, so no speculative audio-server setup was added.

Local standard gate PASS: 1,173 unit tests across111files, typecheck/lint/build/PWA (`standard-check-final.log`). Initial new test used an unsupported Testing Library role option; typecheck caught it, corrected before this passing run. Post-build slicer suites at44.1kHz PASS25 across five profiles (`final-slicing-44100.log`).

Status: work ongoing. Fresh remote run pending. No completion or hardware-acceptance claim.
