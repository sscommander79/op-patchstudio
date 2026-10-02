# CI follow-through — 2026-10-02

Completed code/CI remediation requested by user while away: resolve post-push CI failures, obtain Claude and/or Genspark review, implement verified in-scope repairs and push verified changes. Integration owner: Codex. Branch: codex/studio-upgrade. No merge or deployment. Local duplicates, user kit and deferred HV001/HV004 preserved.

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
- F2 existing device-rate decoding / keep-original export inconsistency: confirmed source behavior; architectural import fidelity change is outside this CI repair. Original source bytes remain preserved and decoded dimensions remain truthful. Tracked in [followup-import-rate-fidelity.md](followup-import-rate-fidelity.md); do not silently change frame coordinate semantics across existing projects.
- F3 CI timeout/evidence loss: matrix separation and evidence uploads implemented; remote verification pending.
- F4 Firefox import/playback failure: root cause still under investigation; require fresh remote traces.
- F5 null slicer playback: regression and bounded production repair implemented.
- F6 release envelope interpolation: reviewer states no defect in changed scheduling; small existing release-step concern is unproven and outside this repair.
- F7 stereo capacity reservation is intentional; pending-message ordering harm unproven, not changed.
- F8 subsequent CI gates were skipped on initial run; final remote gates remain required. Initial macOS visual gate was independently confirmed passed.

Official CI guidance retrieved through find-docs/Context7 (Playwright 1.63): https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/test-sharding-js.md and https://github.com/microsoft/playwright/blob/v1.63.0/docs/src/ci-intro.md. It supports independent matrix jobs and preserving reports; no documented PulseAudio prerequisite was found, so no speculative audio-server setup was added.

Local standard gate PASS: 1,173 unit tests across111files, typecheck/lint/build/PWA (`standard-check-final.log`). Initial new test used an unsupported Testing Library role option; typecheck caught it, corrected before this passing run. Post-build slicer suites at 44.1 kHz PASS25 across five profiles (`final-slicing-44100.log`).

Status at that intermediate checkpoint: remote verification was pending. The completed result below supersedes it; physical hardware acceptance remains pending.

## Follow-up review disposition

Claude follow-up (`claude-followup.txt`) found no blocking defect in the targeted repairs and supplied additional improvements. A1: independent decode now determines the drum Cancel frame count. A2: native48k slicing retains the original exact48000 assertion. A3:44.1k export fidelity added to the separate F2 record. B1/B2: explicit Playwright global timeout plus matrix max-failure cap preserve summaries; step deadlines leave time for always-uploaded evidence. B3: no branch-protection settings were altered. C1/C2: RED tests reproduced warning erasure and phantom-note release; repaired by clearing only the playback alert and releasing only successful late-start ids. All40 slicer tests pass. D: current standard/portability evidence is recorded above; initial visual success can be verified at https://github.com/sscommander79/op-patchstudio/actions/runs/37067181483/job/111037841931 .

## Firefox environment experiment

All jobs except Firefox passed on9d6c59d (run37070991176); Firefox's repeated import/playback failures remain unresolved. Source inspection shows both decode and audition await realtime AudioContext.resume. A primary maintainer report and its own CI setup describe Firefox never starting its AudioContext on headless Linux without an audio backend: https://github.com/tsuemura/playwright-audio-mocking#notes--caveats . Playwright Context7 docs did not document this prerequisite; freedesktop's module documentation lookup returned an error. These sources support a hypothesis, not proof of this runner's cause.

Next CI experiment provisions PulseAudio in Linux jobs that run Firefox, prints the available sinks, and keeps real browser decoding/playback and existing assertions. The experiment changes no product decode architecture, no browser autoplay policy and no local dependencies. Require actual remote Firefox pass and prior failure traces before closing F4.

Latest local state: `final-standard.log` PASS: 1,174 tests / 111 files plus typecheck/lint/build/PWA; `final-portability-44100.log` PASS78/2existing skips across five profiles.

## Verified final code result

Code commit **9f64f79266df569eeea7f627e9cbc48fd795d5e8** passed GitHub Quality run [37072170233](https://github.com/sscommander79/op-patchstudio/actions/runs/37072170233). All six push-triggered jobs succeeded, zero failing jobs. The separate scheduled/manual full-matrix job was not applicable to this push; it is not represented as executed. `verified-code-ci.json` records the exact commit and job URLs.

| Gate | Result |
| --- | --- |
| Unit/typecheck/lint/build/PWA, local and remote | PASS: 1,174 tests / 111 files; existing warnings only |
| Chromium production | PASS: 160, 5 documented skips |
| Chromium storage/recovery | PASS: 5 |
| Development-origin recovery | PASS: 1 |
| Synthetic recording/guided capture | PASS: 5 |
| Synthetic stem export | PASS: 1 |
| Firefox regression profile | PASS: 79, 1 existing clock-injection skip |
| WebKit regression profile | PASS: 80 |
| Mobile Chrome regression profile | PASS: 73, 7 desktop-only skips |
| Mobile Safari regression profile | PASS: 73, 7 desktop-only skips |
| macOS visual snapshots | PASS: 12, no snapshot updates |
| Targeted local portability run at 44.1 kHz | PASS: 78, 2 existing desktop-only skips across five profiles |
| Final Claude static review | No remaining material findings in the limited repaired scope |

F4 is closed as a CI environment defect. The run before audio provisioning had 27 Firefox failures / 52 passes / 1 skip; its retained representative trace shows the slicer stuck at “Decoding source...0%”. After provisioning a PulseAudio `auto_null` sink at 44100 Hz, all 79 applicable Firefox checks passed. No app decoder, autoplay preference or playback assertion was weakened. `evidence/firefox-before-after.json` and the representative trace preserve the comparison. The complete 27 downloaded traces remain locally in ignored `test-results/ci-followthrough-firefox-before`.

Claude reviewed three times via the requested CLI route; final report `claude-final-review.txt` is pinned to 9f64f79. It is static review, not reviewer-run tests or physical-device certification. The integration owner independently ran the tests and checked GitHub. Remote Chromium production took 3.8 minutes, within the new 15-minute Playwright limit.

The original source-fidelity/Keep original issue remains explicitly tracked in `followup-import-rate-fidelity.md` as separate pre-existing work. HV001/HV004 remain deferred. HumanTest04 listening/application/export and actual MIDI/OP-XY/assistive acceptance remain for the user. No merge, deployment, release approval, or exhaustive interaction-coverage claim.

Commits pushed: 9d6c59d (portable assertions, separated browser jobs, slicer failure state) and 9f64f79 (review follow-ups and Firefox audio provisioning). A final documentation/evidence commit preserves this report without changing the verified code. Git history and the linked Actions runs are authoritative for its publication state.
