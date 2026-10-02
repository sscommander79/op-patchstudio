# Visual mismatch reconciliation — 2026-10-02

User instruction: “please fix those open mismatches”. This follow-up authorizes reconciliation of the 12 reported saved-image mismatches; it does not constitute broad design or release approval.

## Review and disposition

Agent reviewed all 12 before/current/diff comparisons, plus enlarged header and loaded-editor details. The previous images are preserved in `previous-baselines/`; the earlier comparison index now links to those immutable copies. Review sheets and image dimensions/hashes are beside this report.

- Four desktop launch/empty-drum images: the existing OP-1 Field / OP-XY appearance selector accounts for the visible header change. Page dimensions are unchanged.
- Six narrow images: the appearance selector occupies its own usable row, with Theme and Help below. Full-page height increases by 62 pixels. Navigation, task cards, pads, editor controls and footer remain within the page. Shifted text has rasterization differences; these images are not claimed pixel-identical after alignment.
- Two loaded desktop drum images: the existing column-width container rule in `src/styles/studio.css` stacks the waveform above the controls when two columns would not fit (575px threshold). This makes the waveform and fields usable within the editor column; full-page height increases by 132 pixels. The selector is also present.

Disposition: retain these existing intended changes and refresh the 12 stale references. No application source, screenshot tolerance, test assertions, or viewport sizes changed. This is an agent-reviewed reconciliation under the user's repair instruction, not a claim of separate human aesthetic acceptance. Deferred HV001/HV004 remain deferred.

## Verification

- Semantic/layout/navigation/pad gate: 27 passed (`semantic.log`).
- Snapshot recording: 12 passed (`record.log`).
- Independent visual run 1, updates disabled: 12 passed (`verify-1.log`).
- Independent visual run 2, updates disabled: 12 passed (`verify-2.log`).
- All 12 new references are byte-identical to the reviewed pre-reconciliation actual images (`review-measurements.json`).
- `git diff --check`: passed.

No commit, push, deployment, installation, or interaction with the user's live kit.
