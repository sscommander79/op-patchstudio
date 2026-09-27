# Task 6 independent spec and quality review

**Spec verdict: changes required. Quality verdict: changes required.** The capture core and guarded project commit substantially implement the approved design, but recorder ownership and cancellation still have reproducible gaps. Five functional findings and one feedback defect are below. No P0 finding was identified.

Scope: frozen Task 6 source/tests and `task-6-review-package.txt`, compared with `/tmp/opstudio-before-task6/src`; `task-6-brief.md`, `recording-architecture.md`, `task-6-integration-checklist.md`, implementation report and controller rulings. The accepted Task 5 round-two implementation is the baseline; stale pending-Task-5 statements in the earlier integration assessment do not reopen Task 5. No runtime/test/configuration/e2e edits, browser/server launch, broad suite rerun, media capture, or delegation occurred. Only this report was written. The code-review skill template informed the assessment.

## What is sound in the implementation

- One pure frame core drives the actual bundled worklet. Its half-open capture ranges, per-channel absolute peak detector, bounded pre-roll ring, onset inclusion, quiet-tail counter, length priority, previous-end clamp and explicit next-take credit have concrete tests. The manual all-zero case omits a take while quiet nonzero frames survive. Full preallocated arrays transfer once; valid-prefix materialization happens outside the processor.
- Silent worklet output avoids live input monitoring. Permission is deliberate, reported rates are checked against actual capture context rate, mono/stereo restrictions are visible, unsupported browsers receive an import fallback, and ordinary completed-graph disposal releases the owned resources. The limitations around browser-delivered PCM and unavailable ADC/hardware fidelity are correctly stated.
- Both instrument callers now pass an explicit recording target, avoiding the prior quantize/redecode path. Prepared ordinary opfloat assets retain exact Float32 buffers and honest metadata. Their source copies are included in the new combined-project capacity helper, with logical headers and the accepted manifest/ZIP reserve.
- `COMMIT_PREPARED_RECORDINGS` plans against current reducer state and returns applied/retained IDs. Drum holes and overflow are preserved, drum replacement displaces the prior sound to unassigned, multisample replacement checks identity, additions respect 24 zones, and legacy larger projects are not truncated. Unit tests exercise actual reducer/history, source bytes, archive restoration and size-neutral replacement at 256 references.
- Stable take IDs protect rename/remove controls. Ordinary completed-take Apply removes only receipt-confirmed IDs from the review tray. Close itself has no project-removal dispatch. The controller's initial browser count failures must not be reported as evidence that Close erased a committed project.

## Findings

### R1 — P1: Close cannot release acquired input while worklet setup is pending

Location: `src/audio/recording/captureSession.ts:104–114`, ownership cleanup at `193–199`.

Trigger: getUserMedia succeeds, then `audioWorklet.addModule()` or `context.resume()` remains pending. Press Stop or Close. The stream and context are still local variables; `this.stream` and `this.context` are assigned only after those awaits. Consequently `releaseGraph()` sees no acquired resources. The generation guard eventually releases them when setup resolves, but a stalled module fetch/resume leaves already-granted microphone input live after the user closed recording.

Read-only probe of the actual transpiled session held addModule, awaited `dispose()`, and observed **track stops 0 / context closes 0**. Releasing addModule later changed both counts to 1. This differs from the passing late-permission test, where there was no acquired stream to release yet.

Required change: register each acquired resource immediately under an attempt-owned cleanup object before the next await. Stop/Close must synchronously detach/stop its acquired input and close its owned context without depending on setup completion. A stale continuation must dispose only its own attempt and never adopt or close a newer session's graph.

Needed test: hold addModule and resume separately after permission succeeds; Close and Stop must stop the acquired track and request context close before either held promise resolves. Then resolve/reject the promise and confirm no graph adoption, callback or resource leak, including after a new session begins.

### R2 — P2: pending audition starts can overlap and escape cleanup

Location: `src/components/common/RecordingModal.tsx:28`, `49–54`.

Trigger: audition take A while its context resume is pending, then audition B; resolve B, then A. `stopPreview()` can stop only `previewRef.current`, which is not assigned until resume completes. Both continuations share the unchanged modal generation, so both create/start sources and each overwrites the single ref. Starting recording or pressing Stop preview while an audition resume is pending has the same missing operation invalidation.

A read-only probe executed the actual transpiled modal handlers with controlled AudioContexts. Both A and B started. After Close, A was stopped/closed, while **B remained started with stop=false and close=false**. This is an owned-resource leak and audible overlap, not just a misleading disabled button. Existing tests cover resume after modal Close, not preview replacement while the modal stays open.

Required change: give preview operations their own generation and register pending contexts immediately. Every preview stop/replacement, capture start, Apply and Close invalidates pending preview starts. Associate ended callbacks with the specific source/context instance, not only take ID, so two attempts for the same take cannot stop one another.

Needed test: two deferred resumes resolved in either order, repeated audition of one take, pending audition → Stop preview, and pending audition → Start/Arm. At most one preview starts; after cancellation every created preview context closes and no preview begins during capture.

### R3 — P2: automatic multisample root proposals ignore retained tray roots

Location: `src/components/common/RecordingModal.tsx:44–48`, free-note action at `83`.

Trigger: record roots 60 and 61, remove the first take, then record another. The proposal uses project roots plus `existing.length`, not the notes of current review takes. It therefore proposes 61 again. Renaming is safe, but removing/editing/selectively applying takes breaks the implicit count-to-note mapping. An explicit initial target also affects only the first take: after an explicit 64, the next proposal starts at 60 and commonly yields 61 rather than the next unused note from the target.

The read-only modal handler probe retained only a take at 61, delivered a new captured take, and observed **[61, 61]**. Apply correctly rejects the duplicate, but the application's own proposal has made a normal repeated-capture workflow fail. The free-note radio likewise considers only project notes and can collide with another tray row.

Required change: reserve the actual current tray roots together with current project roots when proposing a new note, except the one identity-bound replacement deliberately being resolved. Continue from the explicit target/C4 policy; preserve user-edited notes and use a current state source, not a capture-session creation snapshot. Handle note exhaustion visibly. Apply's existing duplicate/current-occupancy rejection must remain.

Needed test: remove first/middle take then capture, edit a root then capture, selectively Apply then capture again, explicit target 64 with multiple takes, free-note resolution with another tray note already reserved, and MIDI 127 exhaustion/wrap behavior under the documented policy.

### R4 — P2: disposal strands an in-progress Stop promise

Location: `src/audio/recording/captureSession.ts:129–140`, `193–199`.

Trigger: call `stop()` while an active processor response is pending, then Close/dispose. `stop()` waits on its resolver; `dispose()` clears the only flush timer and removes/closes the message port, but never settles that resolver. Neither stopped acknowledgement nor timeout can finish the operation afterward. The modal can be awaiting this promise from Stop, Audition or Apply. Repeated Stop also replaces a single resolver without sharing one in-flight operation.

An actual-session probe called enable → Stop with processor reply held → dispose. After disposal: **stop promise unsettled, flush timer cleared, port handler removed, state closed**. This cannot finish by its designed timeout; it is not merely waiting for browser cleanup.

Required change: keep a single idempotent Stop operation, settle/cancel it during immediate disposal, and ensure stale Stop continuations cannot publish stopped/error into a newer or closed session. Resource cleanup must not destroy every path by which an awaited lifecycle operation completes.

Needed test: Stop → dispose before acknowledgement, Apply's Stop → Close, double Stop before acknowledgement, and setup replacement during Stop. All returned lifecycle promises settle; no late timer/error overwrites the newer session, and no incomplete take is admitted by cancellation.

### R5 — P2: closing during Apply leaves the next recorder session stuck

Location: `src/components/common/RecordingModal.tsx:30–34`, `55–59`; persistent mounting in `src/components/drum/DrumTool.tsx:757` and `src/components/multisample/MultisampleTool.tsx:772`.

Trigger: Add selected takes sets `applying=true`, then Close wins the awaited preview cleanup or Stop boundary. Those generation-mismatch branches return without clearing applying. Close clears the operation ID but not applying; the opening effect resets takes/status/messages/resolution but also omits applying. Both real callers retain this component while toggling isOpen, so a later reopen inherits `applying=true`. Newly captured rows then have their review controls disabled and Add stays “Preparing takes…”. R4 can strand the prior continuation permanently, but fixing R4 alone does not reset this modal state. The later preparation-result branch does clear applying on a generation mismatch; it does not cover these earlier returns.

Required change: reset/cancel Apply state as part of closing and beginning a new modal session. Scope completion/finally cleanup to its owning operation so an old cancellation cannot clear a newer Apply. Keep generation checks preventing any canceled dispatch.

Needed test: real still-mounted caller closes during each awaited Apply stage, reopens, captures a new take, edits/selects it and successfully Applies. Assert the canceled batch never changes the project and the new session starts with normal controls. Current `does not apply after Close wins a pending capture stop` only checks closure/project count and never reopens.

### R6 — P3: drum overflow is reported as zero takes added

Location: `src/components/common/RecordingModal.tsx:35–38`, `src/context/AppContext.tsx:991–994`.

Trigger: all 24 drum pads are full, then Add selected takes. The reducer correctly appends the captures as unassigned and returns `overflowCount`, but both success messages use only `assignedCount` and multisample `retainedIds`. They say “0 takes added”, and the applied rows disappear from review. The sounds are preserved; the feedback falsely implies no addition and fails to explain where they went.

Required change: report total applied takes and actual placement: e.g. “2 takes added; 2 kept unassigned.” Distinguish drum project overflow from multisample takes retained in review.

Needed test: full drum kit and mixed holes/overflow through the actual modal/reducer receipt, checking both preserved project assets and accurate success text.

## Evidence and boundaries

The supplied full-unit log was inspected: **61 files / 657 tests passed** in `/tmp/opstudio-task6-unit-final.log`. The supplied production build log completes successfully; the report identifies the emitted local worklet `dist/assets/captureProcessor-CJEaL2V6.js`. Scoped lint and whitespace evidence are `/tmp/opstudio-task6-lint-final.log` and `/tmp/opstudio-task6-diff-check-final.log`. These existing checks were not rerun by the reviewer.

The variable-128 RED was a fixture arithmetic error, as accurately disclosed by the implementation report; it is not a demonstrated prior product defect. Relevant core, actual processor, session, modal and real reducer/archive tests were read. Test existence or mocked integration is not substituted for successful browser evidence.

The controller's first frozen synthetic recording matrix completed **3 passes / 7 failures** in `/tmp/opstudio-task6-browser.log`. Controller/Sol diagnosis identifies repeating fixture bursts producing a third take during Stop, a singular/plural sample-count assertion, and WebKit method replacement failing to override its native mock-device facade. Those are harness dispositions, not evidence that the six findings above are test artifacts. A corrected matrix with a verified complete synthetic facade remains an acceptance gate.

The controller's separate production/native fake-device Chromium gate subsequently **failed**, in `/tmp/opstudio-task6-production-fake-browser.log`: Enable input displayed “Not supported” before monitoring. The exact failing stage is not established. Lack of a visible worklet request in the retained trace does not prove whether failure was getUserMedia, context construction, module loading, or trace visibility. Diagnose this as an additional acceptance blocker before making supported-browser or production-worklet claims. A successful build is not a substitute for this gate, and no speculative runtime finding is assigned to a source line without its root cause.

The read-only probes transpiled current source in memory, injected controlled session dependencies or a lightweight hook/JSX harness, and invoked actual implementation methods/handlers. They allocated only small synthetic values, used no browser, real input, source edits or on-disk test files. Probe observations are stated beside the affected findings; they establish the ownership/proposal failures, not browser-wide compatibility or listening quality.

Whole-project accounting correctly includes both instruments, ordinary recording source representations, per-reference opfloat headers and the accepted 63,100-byte ZIP reserve. Source review found no new reason to reject that formula. Early controller fixes for full-buffer transfer, final-take/Stop ordering, stale 31→32 credit, legacy replacement and targeted-reference subtraction are present with focused regressions; the remaining asynchronous ownership cases above are separate triggers.

Keep hardware ADC fidelity, physical microphone/audio interface behavior, physical OP-XY/OP-1 export playback and listening calibration explicitly unverified. Task 7/8 assessment documents remain plans. Task 8 owns its broader workspace/focus/accessibility redesign and mapped-only export preflight; this review does not enlarge Task 6 into those tasks.

Recommendation: fix R1–R5, address the small R6 message correction, then perform a bounded re-review of the changed ownership/root-proposal/receipt paths with the named regression cases and controller browser evidence. Task 6 is not yet ready for acceptance; no commit or publication is implied.
