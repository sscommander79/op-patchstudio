# Task 6 round-one scoped re-review

**Spec verdict: changes required. Quality verdict: changes required.** R1 and R4–R6 close their original triggers. R2 is only partially fixed: audition requests waiting for capture Stop can still overlap and escape cleanup. R3 fixes the original multisample proposals but introduces an unrelated drum-capture rejection when all MIDI roots are occupied. These two P2 findings require correction. A separate reusable-session cleanup edge is recorded below with its caller limitation.

Scope: the frozen 845-line `task-6-round1-review-package.txt` against `/tmp/opstudio-task6-before-round1`, current changed runtime/callers/tests, `task-6-round1-report.md`, original review and Task 6 constraints. No runtime/test/e2e/config edits, browser/server launch, broad test rerun, delegation, commit or publication. This report is the only file written. Task 5 and unchanged recording frame/DSP code were not subjected to a new broad review.

## Original finding dispositions

| Finding | Disposition and evidence |
|---|---|
| R1, input acquired during pending setup | **Original trigger addressed.** `captureSession.ts:101–113,127–135,248–254` registers each stream/context before the next await, stops input immediately during attempt release, and prevents a released continuation adopting a graph. Added tests independently hold module loading and resume and assert cleanup before release. The new asynchronous cleanup edge C1 below is distinct and limited to reusing the same session instance concurrently. |
| R2, overlapping pending previews | **Partially addressed; remains open as RR1.** Pending contexts are now registered before resume, and ordinary replacement/Stop/Close invalidates them. Exact instance comparison fixes ended-callback ownership. However, the preview ticket is captured after earlier awaits, so requests queued on capture Stop are still accepted together. |
| R3, incorrect/duplicate multisample proposals | **Original trigger addressed; new regression RR2.** Proposals reserve real current tray roots and current project roots, use the explicit anchor, and wrap through 0–127. Tests cover editing/removing, selective Apply then capture, free/replace on the first selected row, and exhaustion. The exhaustion error is incorrectly applied to drum recordings too. |
| R4, disposal strands Stop | **Addressed.** `captureSession.ts:158–186` returns one shared Stop promise; disposal/replacement/failure force-settle the wait before closing the reply path. Tests assert identical double-Stop promises, Stop→dispose settlement, replacement and ignored old acknowledgements. The initial unresolved-promise trigger is closed. |
| R5, canceled Apply poisons reopen | **Addressed.** `RecordingModal.tsx:33–37,61–65` resets applying on Close/reopen and uses a separate Apply generation and AbortController. Only the owning operation publishes cleanup or dispatches. The persistent-modal regression reopens and successfully commits a fresh take while the old Stop is still held, then resolves the old operation without changing the new result. |
| R6, overflow reported as zero added | **Addressed.** Modal receipt and reducer notification count confirmed applied IDs and distinguish drum unassigned placement from multisample review retention. The full-kit real modal/reducer case proves 26 preserved assets and “2 takes added; 2 kept unassigned.” The mixed-hole reducer test proves 25 added/2 unassigned. |

The guarded current-state commit, immutable opfloat source path, whole-project archive accounting and capture limits are unchanged by this round. The context diff changes only the success message. No reviewed change weakens source precision, replacement identity checks, archive capacity, attribution, imports or device exports.

## Remaining Important findings

### RR1 — P2: audition ownership begins too late, after capture Stop

Location: `src/components/common/RecordingModal.tsx:58–60`.

Concrete trigger: keep a completed take in review while capturing another take. Click its Audition button twice while the first request is waiting for capture Stop to flush. Both handlers call `stopPreview()` and await the same capture Stop. After Stop resolves, each reads the **latest** `previewGenerationRef.current` at line 59 instead of retaining the request's own identity from entry. Both resume checks therefore pass and both start a source, overwriting the single preview ref. The buttons permit this while capture is active.

A read-only in-memory probe invoked the actual transpiled modal handlers with the real ref/state ordering, one shared deferred capture Stop, and controlled AudioContexts. After releasing Stop, both sources started. Closing the modal produced:

- first source: started=true, stopped=false, context closed=false;
- second source: started=true, stopped=true, context closed=true.

This is the original R2 ownership failure through an earlier await, not an imagined browser-specific behavior. The new tests wait until a preview context already exists before making the second request, so they exercise resume replacement but miss this trigger. A pending prior context's asynchronous close can similarly defer the first request before it claims its ticket.

Required correction: establish each audition's operation identity at handler entry, before **any** await, and validate it after preview cleanup and capture Stop as well as resume. A later audition, Stop preview, capture start, Apply or Close must invalidate every earlier pending audition phase. Preserve immediate registration of contexts and exact source-instance ended callbacks.

Needed regression: actual modal with an active capture and an existing review take; hold Stop, issue two auditions (same and different take), release Stop and resolve contexts in both orders. At most the latest request may start, and Close must close every created context. Include pending audition-before-context → Stop preview/Start cancellation; this is not covered by only holding resume.

### RR2 — P2: multisample note exhaustion now discards drum recordings

Location: `src/components/common/RecordingModal.tsx:49–52`.

Concrete trigger: retain a valid larger legacy multisample spanning roots 0–127, switch to Drum, and capture a nonempty take. Such a project can have 128 small loaded references and remain well within the accepted 256-reference/128 MiB project limits. Drum takes do not require a free multisample root. The shared onTake callback nevertheless calls the multisample proposal helper for drum mode, gets undefined and throws the newly added exhaustion error. CaptureSession treats this as preparation failure, releases capture, and the completed drum take never enters review.

The actual modal callback probe, with drum instrument/target and all 128 project roots occupied, rejected with “All MIDI root notes are already reserved. Remove or apply a reviewed take before recording another.” This is new in the fix diff: the old fallback supplied a bounded root value rather than rejecting a drum capture. Preserving legacy projects above 24 zones is an explicit accepted constraint, so this is not an unsupported-project case.

Required correction: scope MIDI-note allocation/exhaustion to the multisample instrument. A drum draft can carry the existing harmless valid root placeholder required by the common draft shape; its physical pad plan and whole-project budget govern admission. Keep visible exhaustion and collision prevention for genuine multisample takes.

Needed regression: the same 128-root project must accept a nonempty **drum** take into review and Apply it without altering multisamples; a **multisample** take must still report exhaustion. Use small buffers rather than large memory allocations.

## C1 — P3: same-instance setup disposal can close a replacement graph

Location: `src/audio/recording/captureSession.ts:186,239–246`.

The R1 fix adds an await at line 241 before `releaseGraph()` snapshots/detaches `this.node`, `this.context` and other shared graph fields. On the **same CaptureSession instance**, hold setup A's addModule and its context.close, call dispose, then enable replacement B before A's close resolves. B can adopt its graph because the old setup pointer was already cleared. When A's cleanup resumes, it reads B's graph fields, closes B, and the old dispose publishes closed. An actual session-method probe observed B monitoring with zero track stops before A close resolved, then B track stops=1 and state=closed afterward.

Caller qualification: the current modal normally constructs a fresh CaptureSession on Enable and awaits its disposal; the direct same-instance sequence above is not the normal modal route. Therefore this is **not promoted to a P2 user-path blocker**, and the original immediate-input-release finding R1 is considered addressed. It does contradict the newly tested reusable-session replacement guarantee and is inexpensive to harden while touching ownership code.

Recommended correction/test: snapshot and clear this cleanup operation's shared resource references before awaiting any close, and generation-guard terminal status publication after cleanup. Repeat the existing stale-setup/replacement test with the old context.close promise held, not just addModule held. A superseded cleanup must never touch the replacement resources. Alternatively make single-use session semantics explicit and reject same-instance reuse consistently; do not claim reusable replacement isolation without enforcing it.

## Verification evidence and production disposition

Supplied logs inspected:

- `/tmp/opstudio-task6-round1-unit-final.log`: **61 files / 670 tests passed**.
- `/tmp/opstudio-task6-round1-focused-final.log`: **41 changed-suite tests passed** (controller/worker evidence).
- `/tmp/opstudio-task6-round1-build-final.log`: successful production build, retaining the bundled worklet `dist/assets/captureProcessor-CJEaL2V6.js`.
- `/tmp/opstudio-task6-round1-recording-browser.log`: **10/10 passed** across Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari. The corrected test-owned complete MediaDevices facade is identity-checked before input interaction and cannot fall through to native input. Explicitly scheduled two bursts replace the previous autonomous repeating signal. Actual opstudio source/audio bytes, metadata, selective Apply, Undo/Redo and synthetic-track cleanup remain asserted.
- `/tmp/opstudio-task6-round1-production-fake-final.log`: **1/1 passed** using the production app and full bundled Chromium with both required fake-media flags and the explicit generated WAV. The earlier NotSupportedError was isolated to native getUserMedia in Playwright's headless-shell binary; no runtime fallback or unsupported-mode relaxation was introduced.

Production monitoring follows successful addModule, and the completed take demonstrates execution of the registered bundled processor. Playwright's page response event did **not** expose the worklet request; this report does not claim an observed response MIME or network URL from that event. No personal microphone, audio interface, device ADC parity or physical OP hardware listening/export validation is claimed.

The controller's broad frozen browser matrix completed **94 passes / 1 failure** in `/tmp/opstudio-task6-round1-full-browser.log`, with no recording-case failures. The failure was the existing Firefox library reload scenario waiting for its confirmation dialog. Its isolated traced rerun **passed in 2.8 seconds**, `/tmp/opstudio-task6-round1-library-firefox.log`. This is a 94/95 run plus one successful localized rerun, not a single 95/95 run. The controller will retain the intermittent gate for Task 9. That independent browser disposition does not change RR1/RR2's demonstrated source behavior.

This reviewer ran only small read-only in-memory source probes for the three stated edge cases. The unit/build/browser gates were not duplicated. The initial variable-128 RED remains a fixture arithmetic correction, not a product defect. Global lint/offline stabilization and the broader workspace redesign remain Tasks 9 and 8 respectively.

Recommendation: close original R1/R4/R5/R6, fix RR1 and RR2, and resolve or explicitly defer C1 with its current caller qualification. Attach the final controller browser disposition, then re-review the bounded correction. Task 6 acceptance remains withheld; no commit, merge or publication is implied.
