# Task 8 controller browser acceptance

Preparation only. Reconcile actual Sol controls before execution. All browser runs require an explicit source/tests/e2e/config freeze. Use isolated browser contexts and local original fixtures; no physical microphone or device assumptions. Early-upgrade images in images/before-* are comparison evidence, not pristine upstream screenshots.

## Functional walkthroughs

1. Empty after recovery decision → Load demo kit → actual pad play → select a different sample → shape sound → Undo/Redo → editable name → device preflight → actual ZIP download. Inspect ten mapped WAVs, patch references, frame dimensions/quantization and no empty slot assets. Guide must reflect actual actions, not loading alone.
2. Existing audio/settings in both modes → demo Add / Cancel / explicit Replace. Inspect preserved multisamples/current settings as applicable, one Undo/Redo and original bytes. Near-limit old+new history retention is primarily a small-buffer metadata test; never allocate a huge browser fixture solely for the cap.
3. Focus/Table round trip retains selection; MIDI/typing auditions do not move editor target. Empty pad selects without chooser, explicit Add/Record works. Unassigned sound can be selected, auditioned, assigned by keyboard/touch, moved/swapped with exact occupied-target feedback, cleared and undone. Selection follows the individual sound, not its shared slice sourceIdentity.
4. Real multi-file import review/errors → Apply → focused editor; slice source → cancel/apply → retained original tray → mapped-only export excludes it by default and explicit opt-in includes it. Full .opstudio still contains everything.
5. Recorder and loop editor accessible from focused and detailed routes. Retain exact frame, cancellation, held-note cleanup and Apply/Undo tests. Refactor old table locators to intentionally enter Table rather than bypassing product controls.
6. Both instruments: export conversion failure keeps preflight open with an error and no success/download claim; invalid/blank name focuses reachable name control; unassigned-only is not ready. Verify format fallback wording and 20-second trim/slice guidance. Download initiation is not device validation.
7. Actual revision-aware autosave and Retry, library save/load, portable backup/open. Recovery dialog precedes demo replacement; Escape preserves undecided recovery. Exactly one persistence owner.

## Visual and interaction matrix

- Desktop 1440×1000 light and dark: loaded Focus, Table, selected editor, preflight; readable hierarchy and reachable project controls without a 24-row scroll before naming/export.
- Phone 390×844 and narrow 320×740 portrait: empty and loaded, both banks, editor, import and export. Verify document scrollWidth does not exceed viewport; table overflow is a labeled local region. Measure actual interactive hit boxes and overlap, not min-height declarations alone.
- Landscape 844×390: toolbar does not cover editor/focused controls; no forced rotation overlay. Safe-area/content clearance and dialog Close remain usable.
- System theme with light/dark emulation changes resolved colors, Carbon portals and already-mounted canvases. Inspect recovery/library/import/recording/slicing/zoom/help/preflight and retained advanced settings; no light-only island.
- Keyboard-only: tab sequence, focus-visible ring, Enter/Space single audition, arrows select without sound, explicit assignment, editable/select shortcut guards, modal focus cycle/Escape/return and nested dialog return. Pointer cancellation/blur/bank/dialog opening release held sound.
- Reduced-motion preference: no required animation; control state remains clear. 200% zoom/reflow check with usable name/import/edit/export controls.
- Contrast: measure rendered text/control/focus states including canvas and opacity against actual backgrounds. The proposed palette analysis is not rendered acceptance. 44px targets are a project requirement; do not call this WCAG AA conformance or infer a screen-reader pass from an accessibility tree.

## Evidence and limits

Retain representative screenshots and a concise measured geometry/contrast report with browser/viewport/theme and actual observed problems. Re-run affected flows after fixes; run the full existing matrix once after meaningful final UI changes. Record any first-run failure distinctly from retries.

Demo generator acceptance includes exact same-engine repeated bytes, cross-engine numerical tolerance, finite/endpoint/DC/peak/duration checks, original-source backup and real device-format conversion. Provide rendered audio for audition. Tool inventory currently exposes no audio-listening analysis service: do not label numerical plots or byte checks as a subjective listening pass. Human listening, assistive-technology testing and physical OP-device import remain explicit boundaries unless actually performed.
