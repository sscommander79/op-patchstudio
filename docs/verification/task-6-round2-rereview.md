# Task 6 round-two scoped re-review

**Spec verdict: pass for the reviewed correction scope; overall Task 6 acceptance blocked by the browser failure below. Quality verdict: pass for this bounded correction scope.** RR1, RR2 and C1 are addressed. No new Important finding was identified in this bounded fix diff. Earlier findings closed in round one remain closed within the directly affected paths.

Reviewed the full 276-line `task-6-round2-review-package.txt` against `/tmp/opstudio-task6-before-round2`, `task-6-round2-report.md`, the prior finding definitions, current changed handlers/cleanup and the added regressions. Only `CaptureSession`, `RecordingModal` and their two unit-test files changed. No capture core, worklet, source codec, reducer/application planner, archive, browser harness or configuration changes are included. The reviewer changed only this report and ran no browser/server, capture, additional test suite, delegation, commit or publication.

## Finding closure

| Finding | Disposition | Source and regression evidence |
|---|---|---|
| RR1 — queued auditions share a late preview ticket | **Addressed.** | `src/components/common/RecordingModal.tsx:29–32,61–63` separates resource release from operation invalidation. Audition claims its ticket at entry, before preview cleanup or capture Stop, then checks it after each await and after resume. Pending preview state makes Stop preview reachable before a context exists. Context registration and exact-instance ended callbacks remain intact. Added same-take/different-take tests hold active capture Stop, queue two auditions and assert only one source starts and every created context closes. A separate test cancels before context allocation and proves no context is created. |
| RR2 — multisample root exhaustion rejects drum capture | **Addressed.** | `RecordingModal.tsx:50–55` performs note allocation/exhaustion only for the multisample instrument. Drum drafts retain a valid common-shape root placeholder while their physical destination and project-capacity rules govern admission. A real provider/modal regression restores 128 small legacy zones, admits and applies one drum take, and retains all 128 multisamples. The paired multisample case still reports exhaustion and admits no review take. |
| C1 — held old setup cleanup closes a replacement graph | **Addressed.** | `src/audio/recording/captureSession.ts:186,239–247` snapshots and clears shared graph references before any asynchronous close; cleanup subsequently touches only those captured resources. Dispose publishes closed only for its owning generation. The new regression holds both old module loading and old context.close, adopts replacement B on the same session, then releases old cleanup and verifies B remains monitoring with its track/context untouched. This closes the qualified reusable-session edge recorded in the prior review. |

The changes preserve immediate acquired-input cleanup, idempotent Stop settlement, Apply cancellation/reopen reset, exact source-instance preview ownership and correct applied/overflow messages. They do not change the accepted frame-clock capture, pre-roll/quiet/re-arm behavior, immutable Float32 sources, source/archive representation accounting, 32-take/256 MiB recorder limits, guarded reducer receipts, identity-bound replacement, whole-project limits or one-operation Undo. Existing import/export and attribution code is outside the diff and unchanged.

## Verification and evidence limits

Supplied logs inspected:

- `/tmp/opstudio-task6-round2-focused-final.log`: **47/47** across the session, modal and recording application/reducer suites.
- `/tmp/opstudio-task6-round2-unit-final.log`: **61 files / 676 tests passed**. No final unhandled test failure is reported.
- `/tmp/opstudio-task6-round2-build-final.log`: production build passed, retaining bundled worklet `dist/assets/captureProcessor-CJEaL2V6.js`.
- TypeScript, four-file scoped lint and whitespace checks are reported clean in `/tmp/opstudio-task6-round2-tsc.log`, `/tmp/opstudio-task6-round2-lint-final.log`, and `/tmp/opstudio-task6-round2-diff-check-final.log`.

The meaningful RED log `/tmp/opstudio-task6-round2-red.log` covers the two queued-audition variants, rejected drum capture and stale replacement cleanup. It also contains a mock unhandled-catch diagnostic from the expected overlapping-context failure; that diagnostic must not be represented as a separate production defect. Final green results are the completion evidence. The earlier variable-128 RED remains a disclosed fixture arithmetic correction, not a capture-core bug.

The controller's round-two recording gate completed **9/10 passes** in `/tmp/opstudio-task6-round2-recording-browser.log`. The Chromium manual-recording scenario failed its elapsed-time check with a visible product error: **“Capture frame discontinuity: expected 128, received 640.”** Its snapshot is `test-results/recording-manual-Start-and-7fce0-ithout-changing-the-project-chromium/error-context.md`. This is an actual runtime acceptance blocker pending diagnosis; it must not be dismissed as a harness failure or resolved by weakening the continuity guard without establishing what happened. The capture processor/core are unchanged in this four-file round, and this scoped review does not assign a speculative source root cause.

The controller's separate round-two production fake-device gate **passed 1/1 in 3.6 seconds**, `/tmp/opstudio-task6-round2-production-fake.log`. This supports the production path under that gate's conditions; it does not close the independently observed manual-capture clock discontinuity.

The round-one baseline was recording **10/10** across five profiles and production explicit fake-device **1/1**; those prior successes do not override the new failure. The broader round-one suite was **94/95**, followed by a successful isolated Firefox library rerun; it was not a single 95/95 run. That unrelated intermittent library gate remains tracked for Task 9, and no broad 95-case repeat is required solely for this four-file correction.

Production processor execution is demonstrated by successful monitoring followed by a completed take after addModule. The prior page response event did not expose the worklet request; no observed MIME/network-response claim is made. Native fake-device coverage uses the explicit generated WAV and both required fake-media flags in full bundled Chromium. No personal microphone, physical audio interface/ADC identity, hardware listening or OP-device playback/export certification is claimed.

**Recommendation:** close RR1/RR2/C1, but withhold overall Task 6 acceptance until the newly observed capture discontinuity is diagnosed and its correction/required verification is complete. No further source correction to the three reviewed findings is requested; no commit or publication is implied.
