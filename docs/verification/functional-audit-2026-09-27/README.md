# Functional audit and remediation

## Final automated handoff — 2026-09-28

**The bounded automated-remediation goal is complete. Human/hardware acceptance remains pending. This is not exhaustive every-function or release sign-off.** Existing user work is preserved on `codex/studio-upgrade`, HEAD `dc1e1f3515e2f2054f83b7507e1e71951f5ee80e`; changes remain uncommitted.

Fixed slicing-draft navigation loss, stale Library routing, mobile drum settings, root-note editing/replacement, keyboard audition and settings access, normalization stepping, modal notification interference, paired-envelope Undo, drag cleanup and draft-only marker edits. Final validation also exposed and fixed a native audio-envelope scheduling race that could silently prevent audition. See [remediation-progress.md](remediation-progress.md) and [audio-clock-regression.md](audio-clock-regression.md).

| Validation | Final evidence |
|---|---|
| Standard checks | Typecheck, lint, **1,109 unit tests / 109 files**, production build and PWA checks pass; three pre-existing generated-coverage lint warnings |
| Production browser matrix | **608 passed, 42 skipped, zero failures** across Chromium, Firefox, WebKit and two mobile profiles; `evidence/opstudio-production-verified.log` |
| Real IndexedDB/storage | **25 passed** across five profiles, including stale-tab write rejection and focus warning |
| Synthetic recording | **6 passed**, including guided capture finishes, native worklet capture and WAV/ZIP outputs; no physical device access |
| Visual contract | **12 passed** with baseline updates disabled; no visual changes followed that check |
| Control interaction map | **554/554 reachable UI source sites exercised**; 556/583 total including two dormant unit-tested sites; 27 explicit dormant/unrendered/orphan exceptions |
| Function execution | Unit function coverage **72.95%**; 781 of 2,892 production V8 entries have no unit execution. Browser execution is separate; no every-function guarantee |
| Independent review | Six verified Claude Fable 5 read-only review passes; latest audio review has no blocking findings. Limits and low-priority observations retained |

The 42 matrix skips are explicit: 25 synthetic-device cases require separate fixture configuration (the six-case synthetic suite passes); 16 desktop-only cases are inapplicable to mobile profiles, which have dedicated mobile checks; one extra clock-injection case is inapplicable to Firefox's task-stable exposed clock. Ordinary Firefox keyboard audition still passes. Skips are not counted as passes.

Earlier failing runs are retained. The native audio failure has trace-backed diagnosis plus unit/browser before-and-after regressions. The isolated earlier WebKit folder timeout did not recur in five unchanged repeats or either subsequent integrated run; its original cause is unproven.

**Next:** work through [human-test-checklist.md](human-test-checklist.md) with the user and actual equipment. All rows remain PENDING. Local CI adds regression checks but has not run remotely; no new commit, push, deployment or installation was performed. Regression coverage reduces risk and cannot guarantee zero future defects.

---

## Initial audit (historical)

# Functional audit — 2026-09-27

**Verdict: FAIL for functional sign-off; exhaustive coverage is INCOMPLETE. Do not treat this as clearance for the human acceptance test or release.**

Target: checkpoint `dc1e1f3` plus the local removal of Create navigation. Claude Fable 5 performed a read-only source review; the coordinator ran disposable-browser and simulated-device tests. Production-source hashes match the audit starting state. Only tests and audit documentation changed during this audit. No commit, push, install, deployment, real device access, or user-project mutation.

## Confirmed findings

1. **Medium — unfinished slice-session loss on browser Back.** `src/components/common/StudioShell.tsx:133,152` only guards recording dialogs. An edited Slice audio dialog disappears after browser Back; its temporary assignments are lost. New regression: `tests/e2e/slicing.spec.ts`, “edited slicing session survives browser Back until explicitly discarded.” It fails at the dialog-preservation assertion in all five browser profiles. Guard navigation while an edited slice session owns the workspace, with an explicit discard path. No production fix applied.
2. **Medium — Project menu Open library leaves a stale route.** `src/components/common/ProjectToolbar.tsx:129` dispatches a tab change without navigation. Library becomes visible but URL remains `#/studio/drum`; reload returns to the wrong workspace. New regression in `settings-control-audit.spec.ts` fails at the URL assertion in all five browser profiles. Route this through the shell. Fable also identified the same mechanism during preset-import tab switching; that variant remains source-only evidence.
3. **Unresolved browser/accessibility failure — WebKit Tab navigation.** The existing launch keyboard-order test fails at the first Setup guide focus assertion, both in the five-profile run and a focused rerun. Chromium/Firefox pass. Browser keyboard-navigation defaults versus product behavior have not been isolated; do not claim a confirmed product cause or silently skip it. Human Safari keyboard testing remains required after investigation.

## Findings disposition

- Fable correctly identified two stale E2E expectations: unknown-name imports belong in the unassigned tray (0 loaded pads, 9 unassigned sounds); external slicing retains its original source unassigned (2 mapped slices, not 3 loaded pads). The tests now assert the tray and correct counts after import and restore, and no longer stop before backup/export/Undo assertions. Corrected suites: **38 passed, 2 deliberate mobile-only skips** across five profiles.
- Fable's claim that repeated blocked Back grows history was **not reproduced**. A new three-Back regression passes in Chromium with unchanged `history.length`. The push replaces the forward entry in this sequence. Do not list stack growth as a confirmed defect.
- Cookie/route first-render panel mismatch is a low-confidence runtime concern supported by source ordering only; not independently reproduced.
- Initial new settings-test failures were test-design mistakes: an envelope-preset action selector is not a persisted setting, and advanced sliders are collapsed initially. The revised tests explicitly expand Advanced and exercise persisted selects by ID. All four drum/multisample select/slider tests pass; action selectors are not implicitly counted as covered by these tests.

## Fresh evidence

| Area | Result | Limits |
|---|---|---|
| Typecheck and lint | PASS | 3 pre-existing generated-coverage warnings in broad lint |
| Unit suite | 99 files / 1,065 tests PASS | Mocks and branch gaps remain |
| Build and PWA artifact verification | PASS | Not a deployed/offline hardware test |
| Initial production five-profile matrix | 258 passed, 31 skipped, 11 failed | 10 failures were stale import/slicing expectations; 1 WebKit focus failure |
| Corrected import/slicing round trips | 38 passed, 2 skipped | Five profiles; compressed codec metadata, original bytes, provenance, export frame counts and Undo now reached |
| Storage integration | 10 passed | Five profiles, real browser IndexedDB with injected failure and PCM round-trip |
| Simulated recording | 3 passed | Explicit fake audio/MIDI; no hardware proof |
| Simulated OP-XY stem recording | 1 passed | Worklet review/WAV/ZIP flow with generated audio |
| Stale dev-worker recovery | 1 passed | Isolated origin; no personal project cleared |
| Persisted preset selects/sliders | 20 passed in final matrix | Four tests across five profiles; current persisted settings and keyboard/undo/redo, not all app controls |
| Repeated recorder Back | 5 passed in final matrix | Three Back attempts per profile; no history-length growth |
| New defect regressions | 2 failed | Intentional assertions of required behavior, retained as failing tests |
| WebKit keyboard rerun | 1 failed | Reproducible; root cause unresolved |
| Final integrated matrix | 292 passed, 31 skipped, 12 failed | 10 confirmations of the two product defects, 1 WebKit keyboard failure, 1 autosave test race; see disposition below |

Profiles: Chromium, Firefox, WebKit, emulated Mobile Chrome and emulated Mobile Safari. Emulation is not physical phone verification. Ordinary matrix skips requiring configured fake devices are addressed by the separate recording suites; desktop-only skips are not passes.

## Autosave test race resolved

The final matrix exposed one additional Firefox timeout clicking Retry save. The retained error snapshot shows **Saved locally** with the new name: the one-shot injected failure had cleared, so a queued autosave removed Retry before the click. A focused unchanged-test rerun passed, consistent with the race. The test now holds the simulated outage until the user-facing Retry click, preserving the real persisted-state assertion. The corrected test passed **10/10 runs** (two per browser profile). This is a test correction, not a production storage fix. The full matrix has not been rerun after this final test-only correction; its original failure remains in the evidence.

## Exhaustiveness and remaining work

The AST inventory covers **136 production TypeScript files, 582 interactive source sites, and 3,040 function/callback source sites**. Repeated pads/rows can create many runtime controls from one site. Native media, Canvas interactions, CSS pseudo-controls, and input-state combinations need separate workflow evidence.

Fresh V8 coverage: **77.69% statements, 69.48% branches, 73.21% functions, 79.74% lines** over the configured suite. Restricting the exported function map to production `src/` yields 2,711 instrumented functions, of which **725 had zero unit executions**. Instrumentation and static AST counts differ; they are not interchangeable. Browser executions are not included in this V8 unit report.

**It would be false to say every function was tested or every button was pushed.** `control-inventory.md` records every detected site as NOT YET MAPPED until its user interaction and outcome are directly traced. `source-inventory.json` includes possible test references for 211 sites, but textual matches are not proof of interaction. `function-coverage.md` records execution counts, not correctness assertions. Existing tests demonstrate broad working flows; they do not satisfy the requested exhaustive sign-off.

Before human acceptance: fix the two confirmed product defects; isolate the WebKit keyboard failure; map the remaining control sites to explicit behavior assertions; add missing coverage for disabled/error/cancel/reload paths; rerun the integrated suite. Fable did not deeply review waveform-editing internals, export implementation, or all multisample editing internals; passing existing tests does not erase that review limitation.

## Artifacts

- `fable-review.md`: full Fable report, including source references and declared limits.
- `source-inventory.json` / `control-inventory.md`: exhaustive static control-site inventory and candidate test mapping.
- `function-coverage.json` / `function-coverage.md`: fresh production function execution inventory.
- `evidence/`: command logs, including failures.
- `human-test-checklist.md`: deferred physical and human validation; no row completed by automation.
