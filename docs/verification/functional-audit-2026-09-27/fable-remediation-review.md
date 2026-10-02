# Fable remediation review

Verified returned model: `claude-fable-5`. Read-only review; the reviewer ran no tests. Its commit-readiness wording is advisory and does not authorize a commit, push, deployment, or release.

Write and plan tools are disabled in this session, so the full report follows here directly.

# Independent review — Studio upgrade fixes + control-audit infrastructure

**Reviewer basis:** Claude Fable 5, fresh session with no implementing-session history — cold-review ladder **rung 3** (rung 1 if the implementation was Codex-authored). Strictly read-only: no tests executed, no git commands available, so I reviewed current file state and could not diff uncommitted lines against HEAD. Genspark configuration was not read. Two separately scoped passes (SPEC, then STANDARDS) were run over the same material.

## TL;DR

All four functional fixes are correctly implemented and adequately regression-tested; I found **no blocking defect** in them. The control-audit harness makes **no false coverage claims** in its shipped documentation and has a genuinely strong stale-evidence defense (SHA-256 source-hash gating), but it has **two medium-severity evidence-integrity gaps**: evidence from *failed* tests counts as coverage, and the never-purged shared `/tmp` evidence directories let deleted tests keep supplying evidence indefinitely.

## SPEC pass — the fixes are correct

1. **StudioShell open-workspace event** (`src/components/common/StudioShell.tsx:170-177`) validates the detail against the three tab values and routes through `guard()` → `navigate()`. Grep confirms `SET_TAB` is now dispatched *only* from StudioShell and all route writes go through `navigate()` — the audit's "preset-import tab switching" variant is structurally resolved too, and the guard cannot be bypassed from inside the app.
2. **Slicing navigation guard** (`StudioShell.tsx:132-136, 146-169`): both the click guard and `syncFromHistory` match `[data-recording-modal="true"], [data-workspace-modal]`; `SliceAudioModal`'s root carries `data-workspace-modal="slice"` with `tabIndex={-1}` (`SliceAudioModal.tsx:119`) so the focus restore works. The blocked-Back `pushState` replaces the truncated forward entry, so history length stays constant — consistent with the prior audit's finding that stack growth doesn't reproduce.
3. **ProjectToolbar Open library** (`ProjectToolbar.tsx:129`) now dispatches the shell event; URL synchronizes and survives reload.
4. **LibraryPage load navigation** (`LibraryPage.tsx:187-188`) fires the event after `RESTORE_LIBRARY`; both direct-load and confirm-overwrite paths share `actuallyLoadPreset`.
5. **Mobile DrumSampleTable settings modal**: the mobile card branch now renders both modals (`DrumSampleTable.tsx:513-529`), matching the desktop branch.

## STANDARDS pass — concrete findings

### Product code (all Low; none blocks commit)

- **P1 — dead, misleading branch (confirmed by reading, no repro needed).** `DrumSampleTable.tsx:219-236`: the portrait branch is functionally identical to the else branch because `triggerRotateOverlay` is now an immediate pass-through (`src/App.tsx:30`), yet its comments still describe a rotate-and-wait overlay. **Smallest fix:** collapse `openSettingsModal` to `selectSample(index); setSettingsModalOpen(true);` and drop the now-unused `react-device-detect` import.
- **P2 — duplicated modal JSX** between mobile (513-529) and desktop (822-841) branches is a sync hazard. **Smallest fix:** render the modals once, after the branch-specific markup.
- **P3 — edge-case recurrence of the stale-route defect.** `LibraryPage.tsx:187-188`: a stored preset whose `type` is corrupt/legacy is restored as multisample by the reducer ternary (`AppContext.tsx:1464-1466`) and switches the tab, but the shell listener ignores the unrecognized event detail → URL stays `#/studio/library`. **Repro:** edit a stored preset's `type` in IndexedDB, click load. **Smallest fix:** normalize once — `const mode = preset.type === 'drum' ? 'drum' : 'multisample'` — and use it for both dispatches.
- **P4 — invisible notice.** The blocked-navigation warning renders in the content area (`StudioShell.tsx:236`) *behind* the full-screen modal; only the `role="alert"` announcement reaches users. **Smallest fix:** surface it in the modal layer, or accept focus-return as the sole visible feedback.
- **P5 (info).** The heading-focus effect (`StudioShell.tsx:186-204`) silently gives up after ~30 frames if a lazy chunk is slow. Gap, not a defect.

### Control-audit infrastructure

The design is behavior-preserving and opt-in: normal dev/build configs never load it; the handler wrapper caches per function identity (memo-safe), preserves `this`/args/return, and passes non-functions through; injected `data-audit-*` attributes are inert. The source-hash gating (`vite.control-audit.config.ts:14,32` matched at `build-control-audit.mjs:18`) correctly discards evidence when the source file has changed. The docs (`control-inventory.md` header, audit README) explicitly refuse "executed = correct" and "every function tested" inferences — the `functions` inventory carries no execution evidence by design, and nothing I read claims otherwise. Remaining gaps:

- **A1 (Medium) — failed tests count as coverage.** `scripts/build-control-audit.mjs:18` accepts evidence regardless of `r.status`, and the markdown table (line 20) never shows status. A test that clicked a control and then failed its assertions still marks the site exercised. **Smallest fix:** skip or visibly annotate records whose status isn't `passed`/`pass`.
- **A2 (Medium) — immortal evidence.** Both collectors default to fixed, never-purged dirs (`control-audit-test.ts:26`, `controlAuditSetup.ts:12`); file names are stable hashes, so JSON from **deleted or renamed tests keeps counting** while the source file is unchanged. **Smallest fix:** make the builder refuse or warn on stale run dirs; operationally, always start from an empty `OPSTUDIO_CONTROL_AUDIT_DIR`.
- **A3 (Low):** the `DOM click` fallback (`control-audit-test.ts:14-21`) records hits for clicks that may have had no effect, and the report doesn't weight it below handler-execution evidence.
- **A4 (Low):** `controlAuditSetup.ts:16` fabricates `status:'executed'` when vitest hasn't set a result state — combined with A1 this can launder indeterminate outcomes.
- **A5 (Info, safe direction):** spread-passed handlers and handler-less intrinsic controls can never earn evidence (permanent UNEXERCISED — false gaps, not false coverage), and the transform returns `map:null` (`vite.control-audit.config.ts:43`), shifting audit-run stack-trace line numbers by one.

## Test adequacy (static; I did not run the suites)

- **settings-control-audit.spec.ts — adequate.** Lines 55-62 assert the Open-library fix end-to-end including reload; lines 64-76 assert blocked recorder-Back with constant `history.length`, three times. Gaps: drum-origin only (same code path from multisample), notice never asserted, sliders lack a redo check.
- **slicing.spec.ts — adequate with one weak spot.** The regression (178-186) asserts the dialog survives Back with the URL restored — the fixed defect. But despite its name, it never asserts the *edit* (the pad assignment) survived, nor that Back works normally after an explicit cancel. Smallest improvement: assert the assigned-pad button after `goBack()`, then cancel and expect Back to navigate. The main round-trip test (61-175) is strong — provenance, resample frame math, undo, and restore all asserted.
- **table-control-audit.spec.ts — good.** 1440 px and 390 px cover both render branches of the modal fix; across the five Playwright projects the mobile-UA branch is also hit, so if a real rotate overlay were ever reinstated, the mobile-project runs would catch it. Save/cancel/undo semantics are asserted, not just handler execution.
- **keyboard-platform.spec.ts — valid platform probe, not app coverage.** It uses `setContent`, never loads the app, and cleanly isolates the prior WebKit failure to headless WebKit's `Alt+Tab` policy. It must not be counted toward app control coverage (it records no audit hits).
- **studio-design-contract.spec.ts — strong structural contract.** The keyboard test's WebKit-conditional keys (line 133) resolve the WebKit failure honestly by testing under the platform's own policy — but plain-Tab Safari behavior is now documented rather than tested, so the README's human-Safari requirement stands.
- The **LibraryPage load-navigation fix** isn't in the five named specs but is covered by `export-workflow.spec.ts:171-175` (confirmed load → breadcrumb "Multisample editor" + URL assertion).

## Explicit limits

No suite, typecheck, or app run; no `git diff` available, so uncommitted lines weren't separable from pre-existing code; historical pass/fail counts are taken from the audit README unverified. Not reviewed: `DrumSampleSettingsModal` internals, `MainTabs`, `useOwnedDialog` focus trapping (the guard's keyboard-escape completeness rests on it), `StudioShell.test.tsx` changes, visual configs, export/waveform internals. Handler hits prove invocation only; I drew no function-coverage conclusions from them.

**Bottom line:** the functional fixes are sound and committable as-is. A1 and A2 should land before the control-audit report is next cited as sign-off evidence; P1/P3 and the slicing-spec strengthening are cheap follow-ups.

## Coordinator disposition

- A1/A2/A4: fixed with passed-status admission, unique run manifests, current source and test-file hashes, and four passing integrity regression tests. Old ad hoc run directories are rejected.
- A3: DOM click remains explicitly distinguished from handler invocation; neither proves correctness.
- A5: spread handlers and optional callbacks remain explicit measurement limits; no source-map accuracy claim is made for instrumented stacks.
- P1: obsolete rotation branch removed.
- P2: modal duplication remains; responsive regression tests cover both branches. No broad rendering refactor was introduced during this functional pass.
- P3: unknown saved preset types are rejected before state replacement or navigation, with a unit regression.
- P4: retained modal and returned focus remain the visible feedback. The announcement is still behind the modal visually; this is a documented low-priority usability limitation, not a hidden loss-of-work condition.
- P5: slow lazy-chunk heading focus remains an unverified edge case.
- Slicing regression now checks the retained assignment and normal Back behavior after explicit Cancel.

A bounded Fable follow-up was requested for the evidence-integrity fixes and additional defects found by the expanded tests.


## Bounded follow-up review

All deltas verified against source. Findings:

## Verdict: no blocking findings. Every claimed remediation is real and correctly implemented, with one unverified medium-risk residual in the audit pipeline and two low notes.

**Confirmed implemented:**
- **A1/A2/A4:** `run-control-audit.mjs` creates a `mkdtemp` fresh dir + UUID run manifest and marks completion; both collectors hard-fail without a run ID and record `runId`/`testFile`/`testSourceHash`; the builder (`build-control-audit.mjs:18-31`) requires a complete manifest, throws on run-ID mismatch, admits only `passed`/`pass`, and re-hashes both the test file and the application source. `controlAuditEvidence.test.ts` exercises the real builder binary against synthetic evidence for all four admission rules — genuine end-to-end verification, not a mock of the logic.
- **P1:** the rotate branch is gone; `openSettingsModal` is now two lines (`DrumSampleTable.tsx:217-220`) and the `react-device-detect`/`triggerRotateOverlay` imports were removed.
- **P3:** type validated before restoration in **load, preview, and download** paths (`LibraryPage.tsx:74,184,220`); the unit regression asserts no `RESTORE_LIBRARY` and no `opstudio-open-workspace` on a corrupt type.
- **Slicing spec:** line 186 asserts the pad-2 assignment survives Back via `[data-slice-pad="2"]` — which I confirmed exists with matching `Sound N` aria-labels (`SliceKeyboardMapping.tsx:32`) — and lines 187-189 assert Cancel restores normal Back (lands on `#/studio/overview`, consistent with the helper's history).
- **Other fixes:** the normalize tenths adapter's −60…0 integer range exactly matches the documented −6.0…0.0 dB domain (`AppContext.tsx:115,136`), and `audio-settings-audit.spec.ts:22` asserts the previously-stalling −0.1 dB step at the 0 dB bound. `DrumFocusWorkspace` sliders have explicit `aria-label`s asserted by name in `focus-control-audit`. `MultisampleSampleTable` accepts MIDI 0 (`>= 0` guard), flats via `noteStringToMidiValue` (Db/Eb/Gb table, lowercase letters), reverts invalid input, and Enter/Space audition is spied at the `AudioBufferSourceNode.start` level. `AudioImportProvider.tsx:44` retains a still-valid occupied replacement target by reference identity and falls back to unassigned with an explanatory reason when the pad changed. The CSS deferral (`studio.css:39`) hides only `.studio-pwa-notice` (not the urgent build notice) while an `aria-modal` dialog is open, asserted in `table-control-audit.spec.ts:54-56`.

**Residual items (none blocking):**

1. **R1 (Medium, unverifiable read-only) — vitest status timing.** `controlAuditSetup.ts:20` records `context.task.result?.state` from `afterEach`. Depending on the Vitest version, a passing test's state may still be `'run'` (not `'pass'`) while `afterEach` executes — in which case the builder would silently admit **zero** unit evidence (fail-closed, but defeats the unit half of the audit). The verification test can't catch this because it fabricates records rather than reading a real vitest-produced one. **Check:** run one real `run-control-audit.mjs unit` and inspect a record's `status` / the builder's `testsRecorded`. **Smallest fix if it bites:** record from `context.onTestFinished` instead of `afterEach`, or derive status from `result.errors`.
2. **R2 (Low, a11y) — tenths leak into `aria-valuenow`.** The normalize slider now announces `-1` (tenths) to screen readers while displaying "−0.1 dB"; Carbon's `formatLabel` doesn't set `aria-valuetext`. Cosmetic-level regression introduced by the otherwise-correct fix.
3. **R3 (Info):** the PWA-notice deferral is only truly exercised under `PLAYWRIGHT_PRODUCTION=1` (the dev-mode `not.toBeVisible()` passes vacuously), and `body:has(...)` needs Firefox ≥121 — older browsers degrade to today's behavior.
4. **R4 (Info):** `focus-control-audit.spec.ts:16` fills the out-point with `Number(original)/2` and expects that exact string back — brittle if the field reformats decimals on blur.

**Limits:** read-only static review; no suite executed, so R1 remains unconfirmed and I can't attest the new specs pass across the five profiles. I reviewed only the named deltas plus the source they directly touch; no repository-wide scan, no history/diff access, no Genspark configuration read, and no inference of exhaustive function or control coverage from these focused tests.

### Follow-up verification

R1: actual fresh Vitest records contain `pass`; 1,070 passing unit records were admitted. R2: installed Carbon Slider already sets `aria-valuetext` from `formatLabel`. Added a real-browser assertion for `-0.1 dB`; all four Chromium/mobile cases pass. No production accessibility change was needed. R3: production five-browser table tests pass with the notice visible before opening the modal. R4 remains a low test-maintenance observation, not a product defect. Full production matrix passed 419 tests, with 31 explicit skips.


## Additional control review

## Verdict: no blocking findings. All four deltas are correctly implemented and their tests genuinely discriminate the fixed behaviors.

**What I verified:**

- **Atomic paired edits.** `ADSREnvelope.tsx:116-119` routes preset and random changes through `changeEnvelopes`, which prefers the new `onEnvelopesChange`; both the dropdown (`:130,134`) and the dice button (`:709`) use it. `MultisamplePresetSettings.tsx:221-227` wires it to a single `BATCH_EDIT` of both envelope actions, and `projectHistory.ts:85` folds a `BATCH_EDIT` into one history entry — so one Undo is structurally guaranteed, not incidental. The e2e regression (`envelope-control-audit.spec.ts:9`) is a true discriminator: if randomization were still two history entries, one Undo would restore only the filter envelope and the amp-knob `readValues` comparison would fail. The unit test (`ADSREnvelope.test.tsx:10-13`) additionally proves the paired callback fires exactly once per preset/random action, with the single-envelope callbacks never called and random values range-checked.
- **Knob keyboard + drag cleanup.** `FourKnobControl.tsx:96-108` adds a proper `role="slider"` with `aria-valuemin/max/now/valuetext`, arrow/Page/Home/End handling with clamping, and `preventDefault` only for handled keys (Tab passes through). Cleanup is sound: `dragCleanup` ref invoked on unmount (`:24`) and on a new pointerdown (`:28`), `touchcancel` registered (`:57,70`), and the unmount path calls `cleanupDrag` directly so there's no setState-after-unmount. The unit tests cover keyboard clamping via a stateful harness, drag isolation, post-release silence, post-unmount silence, and touch-cancel listener removal — all real behavioral assertions.
- **Accessible dismissal.** `NotificationSystem.tsx:109` gives each dismiss button a per-notification `aria-label` and `:130` hides the icon; the unit test dismisses by accessible name and verifies only the named notification is removed, plus timer cleanup on unmount via `vi.getTimerCount()`.

**Non-blocking observations (with evidence, not defects in the stated deltas):**

1. **Dead code retains the old two-call path.** `MultisampleAdvancedSettings.tsx:453-457` renders `ADSREnvelope` without `onEnvelopesChange`, but nothing imports that component (only its own file and an identically named local interface in `MultisamplePresetSettings.tsx` match repo-wide) — it's unreachable, so the fallback is inert. Deleting it, or wiring it identically, would prevent the two-undo pattern from resurfacing if the component is ever revived.
2. **Announcement gap adjacent to the dismissal fix.** The notification container (`NotificationSystem.tsx:49`) has no `role="status"`/`aria-live`, so new notifications are still not announced to screen readers; only dismissal became accessible. The amp/filter toggle in `ADSREnvelope.tsx:498-509` likewise remains a click-only `div` with no role or keyboard access — pre-existing, outside this delta.
3. **Per-keypress history entries.** Each knob arrow press dispatches one envelope action with no gesture batching (unlike the Carbon sliders, which use `useProjectEditGesture`), so holding an arrow key accrues one undo step per repeat. The e2e test presses once so it passes; this is a UX-polish gap, not a correctness defect.

**Limits:** read-only static review of the 7 named files plus the `BATCH_EDIT` handling in `projectHistory.ts` (the one permitted definition) and two targeted usage greps; no tests executed, so the reported desktop/mobile pass results are taken on trust. I did not verify that the envelopes section is expanded by default when `envelope-control-audit.spec.ts:6` locates the knobs (the passing run implies it), and I make no claim of exhaustive coverage of these components' other interactions (SVG handle dragging, envelope math).

### Disposition

The adjacent amp/filter selector now has switch semantics and keyboard operation, covered by ADSREnvelope.test.tsx. Notifications now expose a polite live region; actual screen-reader verification remains pending. Per-repeat knob Undo entries and the unimported legacy component are recorded as residual limits; no dormant code was removed.


## Final incremental review — Claude Fable 5

Verified modelUsage: claude-fable-5

## Verdict: no blocking findings. All four deltas are correct, and each has a focused test that genuinely exercises the changed behavior.

**Verified:**

- **ADSREnvelope drag cleanup** (`ADSREnvelope.tsx:106-107, 310, 427-436, 443`): same proven pattern as FourKnobControl — cleanup ref invoked on unmount and on re-entry into `handlePointerDown`, `touchcancel` registered, and the unmount path calls `cleanupDrag` directly so no setState-after-unmount. The test (`ADSREnvelope.test.tsx:16-21`) stubs SVG geometry, confirms a live drag fires changes, then confirms silence after `touchCancel` and after unmount.
- **ToggleSwitch** (`ToggleSwitch.tsx:36-47`): `role="switch"`, `aria-checked`, Space/Enter with `event.repeat` guard, and disabled state removes it from tab order (`tabIndex={-1}`) and both input paths. Tests cover activation, repeat suppression, and disabled inertness. The inline amp/filter toggle in `ADSREnvelope.tsx:505-515` received the equivalent treatment (`aria-label="Edit filter envelope"`, `aria-checked`), and its test additionally proves switching envelopes edits only the newly active one — resolving the click-only-div gap I flagged previously.
- **Disclosure headers** (`MultisamplePresetSettings.tsx:308-318, 457-467, 668-678`): consistent `role="button"` + `tabIndex={0}` + `aria-expanded` + Space/Enter with repeat guard; I checked the header contents — only an `h4` and a decorative chevron, no nested interactive elements, so toggling can't swallow other controls' clicks. The test toggles all three headers by keyboard and asserts no store dispatch occurs (headers are pure UI state). It also documents envelopes defaulting to expanded, which retroactively justifies the envelope e2e locating knobs without expanding.
- **Draft-only zero crossing + edited marker** (`DrumSampleSettingsModal.tsx:424-431, 110-126`): the button now mutates only local draft markers, guards against a degenerate snapped range (`:429`), Cancel discards, and Save computes `hasBeenEdited` from actual value/marker deltas rather than unconditionally. `DrumSettingsLegacyControls.test.tsx` verifies exactly the contract: snap changes the draft with **zero** dispatches, Cancel closes with zero dispatches, and Save dispatches once with `hasBeenEdited: true` and snapped bounds strictly inside the original `[0.002, 0.09]` window.

**Non-blocking notes (pre-existing, not regressions from these deltas):**

1. `DrumSampleSettingsModal.tsx:65-76` still dispatches a marker-initialization `UPDATE_DRUM_SAMPLE` merely on opening the modal for a sample without stored markers — a store write (and potential undo entry) from a read-only action. The new tests avoid this path by providing markers.
2. `handleSave` (`:118-129`) dispatches even when nothing changed; `hasBeenEdited` is correctly preserved, but a no-op undo entry may be created depending on history dedup.
3. `onMouseLeave={handleMouseUp}` in ADSREnvelope clears `isDragging` (cursor state) mid-drag while global listeners correctly keep tracking — cosmetic only.

**Limits:** read-only static review of the four components and their four test files plus two targeted usage greps; no tests executed; no claim about SVG drag geometry correctness or coverage beyond the stated deltas; all WIP untouched.

Disposition after review: the legacy marker initialization and unchanged Save dispatch were independently reproduced in two failing tests and fixed. Defaults now remain local until Save; Cancel never initializes committed markers; unchanged Save does not dispatch. The focused four-test suite passed. The SVG cursor cosmetic issue and per-keypress Undo granularity remain low-priority limits.

## Named-function review

A fifth verified Claude Fable 5 read-only review is recorded in [function-gap-triage.md](function-gap-triage.md), including all dispositions and the completed 25-case storage verification. Dormant-code deletion was not adopted.

## Audio clock scheduling review — Claude Fable 5

Verified modelUsage: claude-fable-5.

Write access is disabled in this session (spawned read-only with only Read/Glob/Grep), so I'm delivering the review as text rather than via the plan file.

## Review verdict: no blocking findings

**Rung used:** fresh session, same model family, given only the review packet (cold-review ladder rung 3). Static analysis only — no commands were run and no pre-fix revision diff was available, so "release path unchanged" and the pre-fix unit failure were verified by reasoning through the described pre-fix code path rather than executing it.

### What I verified as correct

1. **Scheduling semantics are preserved** (`src/hooks/useAudioPlayer.ts:446-454`). `scheduleEnvelopeSegment` reproduces `setValueCurveAtTime`'s piecewise-linear interpolation exactly: same 51 sample points, same time grid `start + duration·i/(N−1)`, anchored by an initial `setValueAtTime`, and `Float32Array.from` matches the native curve API's Float32 rounding — which is why the `Math.fround` test assertions hold. The pre-existing endpoint quirk (the exponential curve never reaches its target, so attack ends at `peak·(1−e^−1.5)` and the `setValueAtTime(sustain, decayEnd)` at line 497 snaps decay to exact sustain) is intentionally preserved and asserted at `useAudioPlayer.test.ts:485-487`.
2. **The fix is sound for the reported failure.** Ramp events don't reserve a time interval, so a render-quantum advance between attack and decay scheduling can no longer produce the clamp-overlap `NotSupportedError`; past-start ramps degrade gracefully instead of throwing before `source.start`.
3. **Release compatibility is preserved and actually improved.** The release path still uses `setValueCurveAtTime` with its try/catch fallback, unchanged as claimed. Additionally, `cancelScheduledValues(safeReleaseTime)` can now remove pending ramp events, whereas it could never remove an already-started attack/decay *curve* — so releasing mid-attack previously risked a curve-overlap throw and a hard cut to gain 0 on Chrome. That failure mode is gone.
4. **The unit repro is faithful** (`useAudioPlayer.test.ts:267-290`). Tracing the pre-fix path against the mock: attack ≈ 7 ms < the 20 ms clock advance, so the decay curve start falls inside the clamped attack window → mock throws → `playWithADSR`'s catch returns null and `source.start` is never called. Post-fix no curves are scheduled for attack/decay. The assertions (note id returned, exactly one `start`) are the right observables.
5. **The e2e forced-clock case has genuine regression power** (`tests/e2e/multisample-table-audit.spec.ts:41-48`). This hinged on the table audition scheduling non-zero attack *and* decay, so I confirmed out-of-scope defaults: the audition passes `state.multisampleSettings.ampEnvelope`, whose defaults are attack 500 / decay 6000 (`src/utils/defaultSettings.ts:52`). Pre-fix, the 25 ms busy-wait injected into the first `setValueAtTime(0, …)` reproduces the clamp overlap in real Chromium and `__tableAudioStarts` would stay 0.

### Non-blocking findings

- **Low — release-during-segment micro-snap** (`useAudioPlayer.ts:519`): cancelling a mid-flight linear ramp removes the whole ramp event, snapping gain back to the previous ramp point (bounded by 1/50 of the segment amplitude) before the release curve applies. Inaudible in practice and strictly better than the pre-fix throw-and-hard-cut; noting for completeness.
- **Low — helper fragility** (`useAudioPlayer.ts:449`): `scheduleEnvelopeSegment` assumes ≥2 points; an empty or singleton array would pass `undefined` to `setValueAtTime` or compute 0/0. No live path — all callers pass 51-point curves — but worth a guard if the helper is ever reused.
- **Low — test brittleness** (`useAudioPlayer.test.ts:503`): the velocity assertion compares exact float equality using a different operation order than production (`(peak * 16384) / 32767` in the test vs `(16384/32767) * peak` in the hook) — 1-ulp fragile. It passes today and would fail loudly rather than silently, so acceptable. The `calls[49]`/`calls[99]` indices hardcode the 51-point curve resolution, same loud-failure property.
- **Info — e2e caveat**: if the harness's AudioContext were ever suspended, the busy-wait wouldn't advance the audio clock and the forced-clock case silently degrades to a duplicate of the non-forced run (still passes, but loses its guard value). The suite's other real `start()`-count assertions suggest the context does run, so this is a watch item, not a defect.
- **Info — performance**: ~102 automation events per note versus 2 curve events; negligible for the audio thread.

### SPEC vs STANDARDS summary

SPEC: the change does exactly what the packet describes — attack/decay curves replaced with equivalent per-point linear ramps, release untouched, no unrelated scope in the reviewed files. STANDARDS: semantics-preserving, better cross-browser behavior, well-commented rationale at the helper (`useAudioPlayer.ts:442-445`), and both a unit repro and a real-browser e2e guard. No blocking findings.

Disposition: no blocking findings. Existing curve endpoints and release path retained. The local helper has only fixed 51-point callers; no generic API expansion. Release-point granularity, event-count cost and physical listening remain stated limits. The browser regression now additionally records and asserts an actual positive audio-clock advance, so a suspended context cannot silently satisfy the injected-delay case. The exact-value assertion passes in current tests; no unrelated curve-shape changes were made.
