# Functional remediation — automated handoff complete

User authorized uninterrupted remediation and issue resolution. The bounded automated-remediation goal is complete; human acceptance remains pending. No new commit, push, deployment, dependency installation, or physical-device operation is authorized or performed.

## Confirmed fixes in the current working tree

- Slicing draft navigation: open slice dialogs participate in the Studio navigation guard; Back/hash/workspace navigation retains the dialog and draft.
- Project Open library: navigation goes through StudioShell so the address and content agree.
- Saved Library preset loading: successful restore also navigates through StudioShell to the destination editor. A new URL assertion reproduced the old stale Library address before the fix.
- Mobile drum table Settings: the responsive early-return branch now renders the settings dialog. Desktop and mobile Save/Cancel/Undo tests cover the dialog.
- Focused drum Transpose/Gain/Pan sliders: explicit accessible names prevent the adjacent output element from absorbing the implicit label.
- Multisample table note text: invalid parsing is contained and the draft reverts. Flat note names retain their accidental. MIDI note zero is displayed instead of incorrectly falling back to middle C.

WebKit keyboard investigation: an isolated plain HTML page confirms that macOS WebKit uses Option+Tab to include buttons in native keyboard navigation. The app focus-order test uses that shortcut and retains the same order and focus-outline assertions. No app focus workaround was introduced.

- Multisample table keyboard audition: Enter and Space now start a voice, key release/blur releases it, and key repeat does not retrigger. Regression probes count real browser AudioBufferSourceNode starts.
- Multisample replacement review: a valid requested root is retained when occupied, so the user can explicitly choose Replace current root note for the intended zone.

## Additional confirmed fixes

- Normalization uses integer tenths internally so keyboard decrement from 0 reaches -0.1 dB; Carbon exposes the correctly formatted aria-valuetext.
- Nonurgent PWA notifications wait while an aria-modal dialog is open, preventing the production notice from intercepting mobile bulk-edit buttons.
- Corrupt saved preset types are rejected before restoration or navigation.
- Envelope knobs have keyboard slider semantics and clamp at their bounds; drag listeners clean up on release, touch cancellation, replacement drag, and unmount.
- Paired envelope presets/randomization dispatch one BATCH_EDIT, so one Undo restores both envelopes.
- The amp/filter selector supports keyboard activation and switch semantics.
- Notification dismissal has a per-notification accessible name; notifications expose a polite live region.
- MIDI audition channel has an explicit accessible name.

## Current verification checkpoint — 2026-09-28

- Typecheck, lint (three existing generated-coverage warnings), **1,109 unit tests / 109 files**, production build and PWA verification pass. Current logs are saved in `evidence/opstudio-final-check.log` and `evidence/opstudio-final-unit-audit.log`.
- V8 unit coverage passes: statements 77.68%, branches 69.39%, functions 72.95%, lines 79.38%. The production function map has 2,892 entries, 781 with no unit execution. Browser executions are not merged into those numbers. This does not support an every-function claim.
- All **12 visual checks pass**, with snapshot updates explicitly disabled. Existing uncommitted baseline changes predate this goal and were preserved.
- Two four-worker production matrices recorded 598 passed / 41 skipped / 1 failure and 603 passed / 41 skipped / 1 failure. The first failed Mobile Safari keyboard audition; six unchanged focused repeats passed, and explicit visible/scroll/focus setup was added. The second passed audition but timed out in WebKit folder import; five unchanged focused repeats passed. No product cause is proven. That two-worker run exposed the trace-backed audio scheduling issue described below. The rebuilt final matrix now passes 608 cases with 42 documented skips and zero failures. Earlier failures remain documented.
- All six current isolated synthetic-device recording cases pass, including the three guided finish actions, browser worklet capture, automatic capture and stem review/export. No hardware was accessed.
- The latest focused entry checks pass **28/28** across Chromium and emulated Mobile Chrome. They verify folder/native chooser imports, inclusion/root review, patch import/Undo, actual downloaded ZIP contents, occupied imports, table waveform Save/Cancel/Undo, row drops, MIDI channel persistence with an isolated stub, and keyboard-selected target roots.
- The repaired Library restoration test passes in both profiles. It now waits for the actual restored surface before the next navigation; saved descriptions, tags, favorites, previews and mobile layout assertions remain intact.

## Additional fixes found while completing control checks

- Envelope graph dragging now releases listeners on touch cancellation, replacement drag, and unmount. A failing lifecycle test reproduced post-cancellation callbacks before the fix; the focused test now passes.
- Note naming and all three multisample settings disclosures support Space/Enter with state semantics and repeat suppression.
- Legacy drum zero-crossing changes only the dialog draft. Cancel does not commit; Save commits marker-only edits and marks them edited. Opening a legacy sample with missing markers initializes only local defaults. Saving unchanged values does not dispatch a no-op edit.
- Four verified Claude Fable 5 delta reviews found no blocking findings. A fifth named-function triage identified two meaningful storage test gaps, now closed by 25 passing browser cases across all five profiles. See function-gap-triage.md for all dispositions. The last review's initialization/no-op observations were independently reproduced and fixed after review. Low-priority knob Undo granularity and the SVG cursor appearance during an outside drag remain documented limitations.

## Evidence quality and regression protection

Opt-in instrumentation records source location, event, test and status; no values or audio. Normal builds do not import it. The aggregator accepts only passing individual tests from completed, uniquely identified runs with matching application-source and test-file fingerprints. It rejects stale/deleted tests, stale source, incomplete runs and mismatched run IDs. Failed suite attempts are retained; their passing individual cases may contribute, but the suite is never labeled green.

`source-inventory.json` and `control-inventory.md` contain actual invocation/click evidence. Execution is not by itself correctness proof; use each named test's outcome assertions. `remaining-control-dispositions.md` distinguishes dormant modules, unrendered legacy controls and pending evidence. `function-coverage.md` explicitly retains zero-unit-execution entries.

CI changes add functional regressions on ordinary push/PR events for Firefox, WebKit and mobile profiles, alongside full Chromium, storage, synthetic recording, weekly full matrix and macOS visual comparisons. Baselines are never automatically approved by CI. These edits are local and uncommitted; remote CI has not run. No test suite guarantees that future regressions cannot occur.

Human listening, screen-reader/Safari settings, real audio/MIDI routing, OP-XY import/loops/track alignment and installed/offline/update behavior remain PENDING in `human-test-checklist.md`. No release or hardware sign-off is given. The original every-function requirement remains stronger than the available automated evidence.

## Final storage verification

The 25-case real IndexedDB/browser suite passes. It verifies transaction failure atomicity, original audio precision/rate/channels, revision conflict detection and explicit restore adoption, stale flag-write rejection, and actual focus-driven UI protection after a missed cross-tab notification. The initial new UI test searched the warning as status text, but it is an alert; the snapshot showed the correct warning. The test now checks the alert, absence of unsafe Retry, preservation of the in-memory edit and persistence of the newer stored version after pagehide. No product change was needed for this gap.

Typecheck and targeted lint pass after these tests. No snapshot updates, new dependency installation or hardware access occurred.

## Audio failure found in final validation

The two-worker production run exposed an actual native AudioParam curve-overlap exception, captured in a retained trace. It is resolved by scheduling the same attack/decay samples as linear ramps. See audio-clock-regression.md for native trace, official API evidence, failing pre-fix unit/browser regressions, passing post-fix checks, and the Firefox-specific injection limitation. Full current standard checks pass (1,109 units), six synthetic recording cases pass, and Fable's narrow sixth review found no blocking findings. The final rebuilt integrated run passes: **608 passed / 42 skipped / zero failures**. The current focused audio/table evidence is 24 passed / 1 explicitly inapplicable Firefox clock-injection case, with ordinary Firefox audition passing.

## Handoff

Automated remediation is complete within the stated goal. Every reachable UI control site has passing interaction evidence, but this does not prove every state or every function. Human/device acceptance and release approval remain separate pending work. The definitive results and skip accounting are in README.md. Changes remain local and uncommitted; remote CI has not run.
