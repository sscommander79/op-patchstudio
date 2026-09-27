# Task 3 round 1 re-review

Spec compliance: **Issues remain.** Task quality: **Needs fixes.**

Scope: the four findings in `task-3-review.md` and direct regressions in `task-3-round1-review-package.txt`. Source remained frozen. Only this verdict artifact was written; no source/test edits, browser/server runs, commits or test-suite reruns.

## Original finding dispositions

1. **Partially resolved; still open.** Actual drum preset import/reset, bulk save, advanced save and the tools' reset/clear operations now dispatch atomic batches (`src/components/drum/DrumPresetSettings.tsx:66`, `:105`; `src/components/drum/DrumBulkEditModal.tsx:63`; `src/components/multisample/MultisampleAdvancedSettings.tsx:84`). This resolves the identified per-field/per-sample batching defect. Slider grouping introduces the important regression below.
2. **Closed for the required focus/octave/assignment path.** Multisample key-down records the started note by physical key identity and key-up releases the recorded note without checking current octave or assignments (`src/components/multisample/VirtualMidiKeyboard.tsx:175`, `:196`). The updated actual-handler test covers octave movement plus changed focus (`src/test/components/VirtualMidiKeyboardShortcuts.test.tsx:13`).
3. **Closed for the reviewed ownership paths.** The shared guard covers editable controls, select, composing/repeated events, modifiers and modal ownership (`src/utils/keyboardOwnership.ts:1`, `:24`). Drum and multisample handlers use it; waveform preview supplies its own modal owner and releases accepted previews independently of focus (`src/components/drum/DrumKeyboard.tsx:280`; `src/components/multisample/VirtualMidiKeyboard.tsx:144`; `src/components/common/WaveformZoomModal.tsx:595`). Real-handler tests exercise these paths, including preview ownership (`src/test/components/WaveformZoomModalShortcuts.test.tsx:11`).
4. **Closed for blocking project shortcuts under confirmation.** The actual confirmation component now exposes matching modal semantics (`src/components/common/ConfirmationModal.tsx:51`), and the project-shortcut test mounts that component (`src/test/components/ProjectKeyboardShortcuts.test.tsx:52`). The new description association has a minor issue below.

## Important: [P1] Controlled slider updates start phantom editing gestures

`src/components/drum/DrumPresetSettings.tsx:37`, `:42`, `:47`, `:52` start a gesture unconditionally inside Carbon `onChange`. The equivalent pattern appears in `AudioProcessingSection.tsx:146` and `MultisamplePresetSettings.tsx:245`. However, the installed Carbon Slider invokes `onChange` when its internal value changes through **controlled props**, as well as through user input: `node_modules/@carbon/react/es/components/Slider/Slider.js:774` emits the callback, while `:792` synchronizes changed props into that internal state.

Consequently, import/reset/undo can open a gesture without any pointer/key interaction to generate its release. `useProjectEditGesture` leaves `activeRef` true (`src/hooks/useProjectEditGesture.ts:9`) until an explicit end/cancel, and its unmount cleanup cancels the retained baseline (`:21`, `:26`). The history reducer folds subsequent ordinary musical edits into whichever group remains active (`src/utils/projectHistory.ts:88`).

Concrete source-established consequence: after a programmatic preset change opens a slider group, a later non-slider setting change can be absorbed into that group; unmounting the settings component then cancels the group and restores the earlier preset baseline, silently discarding that later setting change. A history undo also settles the reducer group without resetting the hook's local active flag; the next physical slider gesture can therefore fail to begin a new group and consume one history entry per change.

Start gestures from genuine interaction boundaries, or otherwise distinguish controlled synchronization callbacks from user edits. Ensure hook ownership cannot remain active after the reducer has settled/cancelled a group. Keep programmatic imports/reset/undo free of gesture side effects.

Required focused regression: use the **installed Carbon Slider**, not a native-range replacement, to import/reset or undo a preset, make a separate non-slider edit, and unmount/switch away; that edit must persist and undo independently. Then perform two slider gestures after an undo and verify each consumes exactly one step. `src/test/components/ProjectEditingHistory.test.tsx:14` currently replaces Carbon with an input whose change callback fires only on test input events, so its green result cannot detect controlled-prop callbacks.

## Minor: [P3] Confirmation description points to its heading

`src/components/common/ConfirmationModal.tsx:54` uses `aria-describedby={messageId}`, but `messageId` is attached to the heading wrapper at `:67` rather than the confirmation-message content. Move the ID to the element rendering `message` so the dialog describes the action being confirmed rather than repeating its title. This does not reopen the keyboard-blocking finding.

## Evidence and limits

- Reviewed the supplied diff in bounded chunks, filtering whitespace-only hunks when the large package exceeded tool-output limits. No fresh whole-branch review was performed.
- Two concrete outside-diff checks: installed Carbon callback behavior for the new gesture integration; `useFileUpload.ts:70` for side effects bypassed by the new batch clear path. The latter helper only dispatches the same clear action, so no lost cleanup finding is raised.
- No additional tests were run. The remaining integration defect follows from the installed component callback and hook/reducer paths; the required real-Carbon regression is specified above. Implementer-reported 518 unit passes, focused gates and build success are acknowledged but do not exercise that integration because the grouping test replaces Carbon.
- At re-review, the controller reported 60 browser passes and five failures in the added compound-import/confirmation case. The controller identified a missing exact-text reset-button locator and owns its bounded correction/rerun; those failures are not classified here as product defects. This report does not claim the pending rerun passed.
- Existing lint/test/build warning cleanup stays with Task 9. No physical Safari or hardware proof is claimed.

Task quality: **Needs fixes.** Atomic batch adoption and the three keyboard/dialog repairs address the original paths. Correct the real-slider gesture lifecycle and prove it without replacing Carbon before accepting Task 3.
