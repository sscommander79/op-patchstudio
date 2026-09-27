# Task 3 review

Spec compliance: **Issues found.** Code quality: **Needs fixes.**

Reviewed the frozen Task 3 source/test package against the accepted Task 2 snapshot and `task-3-brief.md`, including the localized original-format `0` sentinel correction. No source edits, commits, browser servers, subagents or full-suite reruns.

## Strengths

- Musical snapshots preserve immutable AudioBuffer/File identities, exclude selection and other UI state, and bound unique retained assets across past/future/gesture state (`src/utils/projectHistory.ts:5`, `:9`, `:34`, `:44`). Undo restores musical state while invalidating stale save-success status (`:56`).
- Portable import performs raw STORE-profile checks, declared/reference byte accounting and finite audio/header/marker validation before dispatch; the toolbar applies one `IMPORT_PROJECT` action (`src/utils/projectArchive.ts:118`, `:194`, `:261`; `src/components/common/ProjectToolbar.tsx:33`). The binary codec and original source provenance remain separate (`src/utils/projectArchive.ts:247`, `:287`).
- Real-context history and real-ZIP tests independently assert sparse/overflow sample identity, exact stereo Float32 data, zero loop endpoints, both envelopes and differing current/source sample rates (`src/test/context/projectHistory.test.tsx:6`; `src/test/utils/projectArchive.test.ts:81`). The added original-format sentinel regression covers both instruments (`src/test/utils/projectArchive.test.ts:106`).

## Important findings

### 1. [P1] Wire grouping into actual compound edits and continuous gestures

`src/utils/projectHistory.ts:85` handles `BATCH_EDIT`, but every ordinary musical dispatch independently appends history at `:90`. No production caller uses `BATCH_EDIT` or `beginEdit`/`BEGIN_EDIT`. The direct API test at `src/test/context/projectHistory.test.tsx:26` therefore does not prove the required user-facing behavior.

Concrete callers remain ungrouped: drum preset import dispatches the imported JSON plus five settings separately (`src/components/drum/DrumPresetSettings.tsx:94`); preset reset dispatches five settings (`:57`); bulk sample save dispatches once per loaded sample (`src/components/drum/DrumBulkEditModal.tsx:30`). With several changed fields/samples, one Undo restores only the last field/sample and leaves the operation partially applied. The transpose slider dispatches each change (`src/components/drum/DrumPresetSettings.tsx:31`, `:231`), so one drag consumes multiple undo steps.

Use an atomic batch for each completed import/reset/bulk operation and explicit gesture boundaries for continuous editing. Add tests through the actual affected handlers: one import/reset/bulk save or drag must undo completely in one step, and two deliberate gestures must remain separate. This is an explicit Task 3 requirement, not broad UI polish.

### 2. [P1] Release the note captured at physical key-down

`src/components/multisample/VirtualMidiKeyboard.tsx:194` now allows key-up after focus moves, but `:205` recomputes the released note using the **current** octave and `:208` checks the current assignment list. Hold A at the initial octave: `onKeyClick(72)` fires. Press X while A remains held, then release A: the handler calls `onKeyRelease(84)` if 84 is assigned, or calls no release otherwise. The original note 72 is never released. Assignment changes while held can similarly suppress release.

Track the started note by physical key identity, then release that recorded note regardless of focus, octave or current assignments. Add the hold-A/change-octave/release-A case to `src/test/components/VirtualMidiKeyboardShortcuts.test.tsx:13`; its existing test covers focus movement only.

### 3. [P2] Apply the required ownership guards to musical shortcuts

The changes at `src/components/drum/DrumKeyboard.tsx:279` and `src/components/multisample/VirtualMidiKeyboard.tsx:151` guard Ctrl/Meta/Alt only. The remaining typing checks omit `SELECT`, and neither handler guards IME composition, modal ownership or `event.repeat` (`DrumKeyboard.tsx:281`; `VirtualMidiKeyboard.tsx:141`). The multisample X/Z branches change octave on every repeated key-down (`:165`), and the drum handler retriggers sample playback on repeats (`DrumKeyboard.tsx:303`). A mapped letter while a select or dialog button has focus can still play a sample or change octave.

Apply a consistent key-down ownership guard to both musical handlers, while keeping captured-note key-up cleanup independent of those guards. Cover selects, open dialogs, composing events and repeated note/bank keys using the actual handlers. The project-undo guard tests do not exercise these musical handlers (`src/test/components/ProjectKeyboardShortcuts.test.tsx:35`).

The same issue includes modal preview: `src/components/common/WaveformZoomModal.tsx:591` installs a document-level P handler while open and immediately prevents default/starts preview, without editable-target, modifier, composition or repeat checks. Typing P or pressing Ctrl/Cmd+P while this modal is open is consumed as preview input. Guard this handler using the modal's own ownership rules; preserve release of a preview that actually started. The focused `SmallWaveform.tsx` check found no additional document key handler, so no separate finding is raised there.

### 4. [P2] Make the project shortcut dialog guard recognize real confirmation dialogs

`src/components/common/ProjectKeyboardShortcuts.tsx:10` recognizes only `dialog[open]` or `[role="dialog"][aria-modal="true"]`. The app's actual `ConfirmationModal` renders plain divs without either signature (`src/components/common/ConfirmationModal.tsx:29`, `:32`, `:48`); drum preset reset uses this component (`src/components/drum/DrumPresetSettings.tsx:441`). With its confirmation/cancel button focused, Ctrl/Cmd+Z passes both guards and undoes the project underneath the pending reset confirmation.

Give actual modal surfaces the proper accessible dialog semantics or register modal ownership explicitly, and test project shortcuts with the real confirmation component. The synthetic correctly annotated dialog in `src/test/components/ProjectKeyboardShortcuts.test.tsx:17` misses this integration failure.

## Scope and verification

- Read the scoped diff in chunks because the initial tool output was truncated. Keyboard hunks cut off their handlers, so the complete relevant handler sections were read to evaluate held-note and guard behavior. No git diff/history commands were run.
- Named outside-diff checks: production grouping callers (preset import/reset/slider, advanced-settings save and bulk edit); actual confirmation-modal markup and WaveformZoomModal/SmallWaveform key handlers for shortcut ownership; sample type shape for snapshot separation; Task 2 deserialization for duplicate drum-index handling. Duplicate indices are rejected by `src/utils/projectSerialization.ts:74`; no silent sample-loss finding is raised. Future Task 4 source-edit gesture implementation remains outside this review; finding 1 concerns existing controls and compound operations.
- No focused tests were run: the four findings follow directly from the handler/reducer paths, and another run of the existing cases would not exercise them. Required regression cases are identified above.
- Existing unit/build evidence is attributed to the implementer/controller: 510 full-suite tests before the localized sentinel fix; archive/history/build focused gates after it. Controller reports stable browser coverage of all 60 scenarios through the stable 55, four portable profiles and a Firefox portable rerun after adding an upload-readiness wait. The Firefox timing failure is not treated as archive data loss. Browser logs: `/tmp/opstudio-task3-browser-stable.log`, `/tmp/opstudio-task3-portable-green.log`, `/tmp/opstudio-task3-portable-firefox.log`.
- Browser automation is not physical Safari or instrument/hardware proof. No such proof is claimed. Existing lint/test/build warning cleanup remains scoped to Task 9 as instructed.

Task quality: **Needs fixes.** The archive/history foundations are useful and scoped, but actual editing and keyboard integration miss binding Task 3 behavior. Address findings 1–4 before acceptance.
