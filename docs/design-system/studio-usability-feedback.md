# Studio usability feedback and review rules

User direction recorded 2026-10-02. Applies to future work across this project; it does not approve a new design for every screen or reopen deferred visual work.

## Feedback ledger

| Observation | Effect on the user | Approved response | Evidence/status |
| --- | --- | --- | --- |
| Advanced looked like plain text rather than an interactive control. | Useful editing controls were effectively hidden. | Bordered disclosures with visible arrows; routine editing actions remain visible. | HV-006; slicer layout approved and implemented; 31 focused tests and integrated browser/standard checks pass. |
| Detection, editing and key assignment were mixed together. | Users could find individual controls but could not see the workflow. | Group controls by task: Make slices, Edit and listen, Assign to keys. | HV-006; bounded slicer change approved. |
| “Scroll inside the white panel” did not explain where or why to scroll. | Instructions required guessing about the interface. | Name the actual window/control; keep final actions visible while only the controls scroll. | HV-006; approved fixed footer. |
| Reset confirmation was separated from the trigger while Split stayed available. | A pending decision did not prevent conflicting edits; the draft reached 18 sounds. | Put confirmation beside the action and block competing mutations until the decision. Keep edits preserves the draft. | HV-006; regression tests required. |
| Automatic detection produced 17 voice fragments with no direct count selector. | The user expected an explicit way to choose the number. | Explain existing detection and manual split/reset behavior accurately. | Enhancement observation; no new count algorithm approved. |

## Apply forward during reviews and authorized changes

- Group controls around recognizable user tasks, with clear headings and a visible next action.
- Make buttons and disclosures visibly interactive. Routine actions must not depend on discovering a vague Advanced label.
- Keep settings near the action they affect. Separate uncommon precision controls from everyday editing without hiding core functions.
- Check complexity through real tasks: unnecessary searching, backtracking, repeated choices and ambiguous labels are usability findings even if the controls technically work.
- Put destructive confirmations beside the triggering action; keep the draft intact when the user declines and prevent conflicting edits while a decision is pending.
- Keep final actions accessible at short and narrow viewports. Test overflow, keyboard use, focus, disabled states and data preservation.
- Give instructions using actual visible names, one action and expected result at a time. Inspect current UI before instructing the user; do not guess hidden controls.
- Record each report with its fixture, expected/observed result, evidence, approved scope, fix and verification status. Functional success and presentation defects can coexist.

## Verification ownership

Run fully computer-based checks independently in disposable browser profiles and test fixtures. Do not use the user's unsaved draft as a disposable test case. Add behavior regressions for defects and run the relevant existing checks after integration.

Reserve human verification for listening judgments, physical hardware/OS permission decisions, accessibility experience that automation cannot establish and whether the workflow feels clear. Automated results do not certify hardware behavior, release readiness or that future regressions are impossible.

Scope remains bounded: report adjacent problems and apply these rules to future authorized work. HV-001 Table clipping and HV-004 Safari Overview remain separate open findings.

## Implementation checkpoint — 2026-10-02

The slicer now follows the three groups, visible native disclosures and fixed footer. Browser tests caught excessive drag distance during the regrouping; a labelled selected-sound drag control now sits beside destination keys and native drag/drop passes on all five configured profiles. Pending reset/reanalysis blocks competing mutations, including the M shortcut. Keep edits preserves ranges and mappings.

Integrated verification: standard gate passes 1,143 tests/111 files, type/lint/build/PWA; 20 browser checks pass. Genspark Sol 5.6 read-only review found no blocking runtime findings. Its low-priority test concerns were dispositioned with real-refresh evidence, a direct shortcut regression and stronger asynchronous, source-byte and decoded-frame assertions. The live 18-sound voice draft survived integration and Keep edits; it remains unassigned and unapplied. See ../verification/functional-audit-2026-09-27/evidence/hv006-slicer-verification-summary.json. Human usability acceptance of the new layout remains pending.


## Occupied-pad and workflow lesson — 2026-10-02 (supersedes the earlier slicer checkpoint)

The user reported that empty-pad dragging worked but occupied/source-pad replacement and removing pre-existing pad sounds did not. Numbered sounds were too far above the editing waveform; the extra selected-sound drag control created an unnecessary step. HV-007 repairs these gaps: waveform → numbered sound strip → destination keys, direct drag, visible Replace/Keep, and Unassign pad sound for existing content.

Carry these rules forward before broad changes:

- Test realistic starting states: empty, already loaded, source pad, staged replacement, stale pad and zero slices. Empty-only success does not establish a complete workflow.
- Put selectable items directly beneath their editing/preview surface and keep destinations nearby. Avoid a second control that merely repeats an existing drag action.
- Let a key click select the actual destination. Button wording and disabled states must describe the selected pad's content, not only newly created assets.
- Unassigning a staged replacement first restores the prior pad sound; unassigning an original retains it in Unassigned sounds. Replacements require a local decision. Commit everything atomically, with Cancel and Undo/Redo preserving originals.
- Detect stale approvals visibly and provide an actionable recovery; never keep changed content hidden or silently overwrite it.
- Keep confirmation focus stable across preview completion. Core Add/Split/Delete must remain discoverable even with zero sounds.
- A development reload can destroy an unsaved modal draft. The earlier compatible-refresh success did not cover provider changes/full reloads. Preserve or finish the actual draft before future integration; verify survival directly and disclose losses rather than claiming recovery.

Integrated checks: 1,154 unit tests/111 files plus type/lint/build/PWA pass; 25 slicing browser tests pass across five profiles. Scoped Opus follow-up reports no remaining material findings, with a limited self-review declaration. Automated fixtures cover occupied replacement, unassignment, preserved original audio/file bytes, Cancel and Undo/Redo. Human usability and real sliced-voice listening remain pending. The saved eleven-sound Human Test04 kit was restored; a fresh 17-sound draft replaces the lost unsaved 18-sound edits. No app-wide redesign or deferred visual repair is approved by this checkpoint. See ../verification/functional-audit-2026-09-27/evidence/hv007-slicer-verification-summary.json.
