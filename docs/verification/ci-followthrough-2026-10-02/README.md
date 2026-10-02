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

## Final audit: retry policy and first-failure evidence

The documentation-only commit a2f19fd triggered [run 37073098654](https://github.com/sscommander79/op-patchstudio/actions/runs/37073098654). GitHub reported all six jobs green, but the log audit caught **one flaky Mobile Safari folder-import check**: the first attempt exhausted the 30-second test budget; the retry passed in 2.4 seconds. Its final snapshot contains both decoded filenames ready for review. Only the successful retry had a trace, so the first attempt's stalled operation cannot be established. Do not describe this isolated timeout as a proven product fix. `evidence/mobile-safari-single-timeout.md` preserves the initial failure.

Follow-through: 60 local Mobile Safari folder-import repetitions passed without retries, followed by all 14 file-entry checks under CI settings. No timeout was increased, assertion weakened, test skipped, or product code changed. The Playwright configuration now fails CI on flaky tests and retains first-failure plus retry traces. A temporary controlled probe (fail attempt 0, pass on retry) demonstrated the previous exit 0 versus new exit 1, and the new configuration retained both traces. The probe was removed before commit. See `folder-stress.log`, `folder-policy.log`, `policy-probe-results.json`, and the three `policy-*.log` files. These probe failures are intentional verification of the gate, not application failures.

Configuration syntax was checked against installed Playwright 1.63.0 types and the official trace/retry documentation via Context7. The first-failure capture is deliberate despite its tracing overhead: subsequent strict CI must pass within the unchanged deadlines. A new narrow Claude review covers this configuration diff. Final remote verification of the stricter configuration is pending at this checkpoint; Actions on the branch and the final user report will record its result. The single prior timeout remains of unknown cause even if a later run is clean.

Claude's narrow follow-up identified missing persisted exit codes and the standalone storage configuration. Both are addressed: fresh probes record exit 0 with the old policy and exit 1 with each updated base/storage policy, with first-failure and retry traces present. The temporary probe directory was automatically removed. The scheduled/manual full-matrix job now also uploads failure evidence with `always()`. This does not assert that the scheduled-only job ran on a push. Final static disposition: see `claude-ci-policy-final.txt`.

Local strict-policy validation: all 14 Mobile Safari file-entry tests and 5 Chromium storage-integration tests passed with no retries; the standard gate again passed 1,174 tests / 111 files plus typecheck, lint, build and PWA validation. The two changed Playwright configurations pass their targeted lint check.

## Strict-policy code verified and pushed

Commit **17fc6880e215272dec251dd308adc5ff6fa61a56** passed [Quality run 37074972204](https://github.com/sscommander79/op-patchstudio/actions/runs/37074972204): all six push-triggered jobs succeeded, and an audit of all six complete job logs found **zero flaky tests**. Results match the table above: Chromium 160/5 skips; Firefox79/1 skip; WebKit80; Mobile Chrome73/7 skips; Mobile Safari73/7 skips; visual12; storage5; dev-origin recovery1; synthetic capture5; synthetic stem1. Standard gates passed with 1,174 unit tests. The scheduled/manual-only job was skipped by design and is not claimed as executed. Exact commit, jobs, steps and log summaries are preserved in `strict-code-ci.json`.

Claude's final configuration review closed both findings; its remaining packaging requirement is satisfied by the committed probe logs. Original production repairs remain as reviewed on9f64f79; the subsequent changes tighten verification only. This clean strict run does not establish the cause of the historical one-off Mobile Safari timeout. Its evidence and limitation remain recorded above. No test was deleted or softened to obtain green.

This report checkpoint follows the verified code without changing application, test or workflow behavior. Git history and Actions provide its publication state. User-owned duplicates and prior browser output remain untouched. Next work is the user-led HumanTest04 / physical-device acceptance, plus explicitly deferred HV001/HV004 and the separately tracked import-rate fidelity issue.

## Directory-selection driver race follow-through

The next documentation-only run [37076016925](https://github.com/sscommander79/op-patchstudio/actions/runs/37076016925) correctly failed its strict Firefox job on a first-attempt timeout in the same multisample Browse folder test; the retry passed and all other jobs passed. Unlike the first occurrence, the retained initial trace identifies `fileChooser.setFiles(folder)` as the 29,287ms stall. The following UI assertion only had 4ms left, while the final snapshot already showed both files decoded and ready. `directory-race-diagnosis.json`, the before log, initial trace and context preserve this evidence.

Claude independently traced the installed Playwright1.63 implementation. Its directory-upload path starts listener evaluation without awaiting registration before sending the file-selection command. Firefox/WebKit can finish directory enumeration before that listener is installed. This matches the observed driver stall; the precise native-event/protocol ordering was not logged. The initial evaluator-warmup idea was rejected because Playwright already initializes that evaluator while emitting the chooser event. No warmup-only workaround was committed.

The bounded test helper now awaits registration of independent native `input` and `change` listeners, recording file names and `webkitRelativePath` before React clears the input. It gives `setFiles` five seconds and rethrows all non-timeout errors. A timeout is accepted only after both actual browser events exactly match both requested files and their directory paths. It annotates and attaches evidence whenever that fallback is used; it never retries the upload, synthesizes input events, alters the input or mocks the app. The existing import-review, Cancel and empty-instrument assertions remain required. This is a documented test-driver workaround, not a change to the app or an upstream Playwright fix.

New regression checks fault-inject the driver's final acknowledgement while retaining actual browser directory events. They verify acceptance of a completed selection and rejection of wrong files, missing events and non-timeout errors. Initial verification: all30focused checks passed across five browser profiles, confirming directory paths are populated in each. Stress and final remote results follow through the branch's Actions run. `claude-directory-helper-review.txt` contains the scoped final review.

Primary implementation reference, also checked in installed1.63.0: [Playwright directory input handling](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/dom.ts). Context7 returned the matching upstream implementation and the official1.63file-upload guide; no upstream fix is asserted.

Claude found no masked import defect or material lifetime issue in the helper. Its one material coverage finding is addressed: `directory-upload-helper.spec.ts` is now explicitly included in every browser-regressions matrix job, as well as Chromium production and the scheduled full suite. The new fault-injection cases therefore execute on Firefox and WebKit on every push.

The 400-case four-worker stress run ended **399passed / 1failed**, not an all-pass. Its sole failure was WebKit `newPage` setup before any test body or app navigation; the first trace contains no folder action. Evidence is retained as `directory-stress-4workers.log` and `evidence/webkit-local-startup-timeout.*`. Chromium100, Firefox100 and Mobile Safari100 completed; WebKit99completed plus the startup failure. A single-worker WebKit rerun follows to avoid conflating that local browser-startup failure with directory import behavior. No fixture timeout was increased. The final test also explicitly requires the app to report two decoded files ready, strengthening the original filename-only review check.

Single-worker WebKit rerun: **100passed, zero failures, zero retries** in2.7minutes with the strengthened decoded-file assertion. The four-worker run recorded five actual driver-timeout fallbacks, each accepted only after both exact native event snapshots and the app assertions passed. The serial WebKit rerun recorded zero fallbacks. Separate fault-injection checks also exercise that branch. `directory-stress-results.json` preserves counts by profile, including the earlier startup failure rather than erasing it.

Final affected-suite verification after all helper, typing and decoded-status assertions: **90passed across all five browser profiles**, zero retries, exit0 (`directory-final-all.log`). Targeted lint passed. The supported-type guard confirms the chooser element is an HTML input before reading its directory/file fields. No production changes were made by the directory-race repair.

Final standard gate after the directory repair: **1,174unit tests /111files passed**, typecheck/lint/build/PWA passed, exit0 (`directory-standard-check.log`). The final strict remote verdict belongs to the code checkpoint containing this repair; inspect its Actions result. No later runtime result is implied by this pre-push document.
