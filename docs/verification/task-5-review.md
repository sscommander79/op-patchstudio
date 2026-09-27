# Task 5 independent review

Reviewed 2026-09-04 against design requirement 5, the complete Task 5 brief including admission/retention/resampling rulings, the implementation report, the 1,399-line review package, and actual current implementations/callers. The approved Task 4 source baseline is `/tmp/opstudio-before-task5/src`. The changed-file inventory matches the review package. This review did not edit runtime source or tests, launch a browser/server, or repeat broad test runs.

**Spec verdict: changes required.** The shared editor, onset detection, lossless materialization, original retention, provenance, and single-batch history largely meet the requirement. Whole-project capacity and several real editing/lifecycle paths remain incorrect.

**Code-quality verdict: changes required.** Pure slicing operations and optional provenance serialization are well separated, and actual frame/byte tests are useful. The principal gaps are state ownership across asynchronous work and marker identity across React reconciliation and sorting. Current component tests cover one-shot changes and stable preparation inputs, leaving these integration failures untested.

No P0 findings. One P1 and six P2 findings follow. The controller-owned browser matrix subsequently completed with 80 passes and five failures; its additional Undo failure is pending disposition below. These are software findings, not hardware claims.

## Strengths

- Both source routes use the same editor. Existing originals stay in their current position; external originals are retained once unassigned.
- Applied buffers contain the requested `[start,end)` frames; derived opfloat assets do not replicate the full original source. Unique names, original source coordinates, re-slicing composition, and serializer/archive fields are implemented together.
- The detector uses channel-wise amplitude, bounded candidate storage, periodic cancellation/yield checks, silence handling, and documented heuristic limits. The ringing/noise-burst regression is more meaningful than module-missing scaffold RED evidence.
- The existing history reducer receives one batch. Normal-path tests cover empty physical pads, overflow, Undo, source immutability, actual WAV data frames, and archive/library persistence.
- Task 4 runtime files for zoom-editor clock/source ownership and inline waveform launching are unchanged by Task 5.

## Actionable findings

### R1 — P1: Whole-project admission omits multisample work

- **Location:** `src/components/drum/DrumTool.tsx:813`; `src/utils/audioSlicing.ts:262-271`.
- **Trigger:** A valid project has 250 loaded multisample assets and one drum source; slice that source into six outputs. The modal passes only `state.drumSamples`, so the planner admits seven drum assets while the actual project reaches 257 assets. The same omission affects decoded and stored byte limits when substantial multisample audio is present.
- **Impact:** Apply succeeds and adds work that the existing portable-project validator refuses to back up. `projectSerialization.ts:43-49` includes multisample work; `projectArchive.ts:227-239` enforces combined references and decoded bytes. This violates the explicit amended whole-project admission contract.
- **Expected fix:** Supply and validate the complete project asset inventory, while keeping physical drum destination selection separate. Align accounting with the actual archive representation: archive decoded accounting includes each opfloat header, whereas current slicing accounting counts only Float32 data. An exactly 128 MiB source-plus-derived operation can otherwise cross the archive limit by its headers even with no multisamples.
- **Needed test:** Start with mixed drum/multisample state just below each total limit, attempt an operation that crosses it, and prove rejection before derived allocation or project mutation. Include a permitted operation near the limit and an actual archive round trip, rather than only testing the planner with a drum-only array.

### R2 — P2: Apply uses stale destinations after asynchronous preparation and drops slices

- **Location:** `src/components/drum/SliceAudioModal.tsx:128`; `src/utils/audioSlicing.ts:314-330` and `357-362`; actual destination reducer `src/context/AppContext.tsx:946-955`.
- **Trigger:** Begin a normal sample upload, open the slicer while that decode is pending, and Apply multiple slices. If the upload fills a planned empty pad during preparation's yield, the resumed Apply dispatches actions planned against the old array. Existing UI upload and slicing paths are independently available; no current-state revalidation occurs after the await.
- **Reproduced:** An in-memory probe called the real `prepareSliceApplication`, dispatched real `LOAD_DRUM_SAMPLE` into pad 0 during its yield, then reduced the prepared actions with the actual `appReducer`. Result: `reportedAssigned: 2`, `actualDerived: 1`; loaded names were `late.wav`, `source slice 02.opfloat`, `source.wav`. The occupied-pad guard silently discards the first slice instead of retaining it as overflow. The success message still claims two assignments. Current capacity can also differ from the snapshot.
- **Expected fix:** Revalidate the complete current project and source identity at the final commit boundary, then either re-plan destinations/overflow atomically or reject the whole prepared operation with an actionable retry. Preserve every derived asset and report actual destinations. Do not replay a partially accepted batch.
- **Needed test:** Gate preparation between slices, complete an outstanding import or change the source/project, then resume. Assert either a wholly rejected operation or all slices retained with accurate counts, no overwrite, and a single coherent Undo.

### R3 — P2: Finishing Auto analysis overwrites manual edits

- **Location:** `src/components/drum/SliceAudioModal.tsx:49-59` and `139`.
- **Trigger:** While initial or requested Auto analysis is busy, click Manual and add or move a marker. The mode button remains enabled and does not abort/invalidate the analysis. Its result checks source identity only, then replaces markers and the endpoint despite Manual owning the draft.
- **Reproduced:** With the actual analyzer and a 3,000,000-frame source, Manual plus Add marker produced `[0,1500000]` while analysis ran. Completion replaced them with `[100,500]` without another user action.
- **Expected fix:** Abort/invalidate automatic analysis when manual editing takes ownership, or disable the transition until analysis finishes. Make result admission dependent on the current editing generation as well as source identity. Apply the same policy to editing during any busy operation so the displayed draft matches the operation being prepared.
- **Needed test:** Hold/yield analysis, switch to Manual, create a distinctive draft, complete the old analysis, and verify that the draft and mode remain authoritative.

### R4 — P2: Numeric marker editing remounts its focused input on every change

- **Location:** `src/components/drum/SliceAudioModal.tsx:144`.
- **Trigger:** Type a multi-digit frame value into a stopped marker field. The row key includes its changing frame value (`index-frame`), so React replaces the input after the first changed digit.
- **Reproduced:** Real React and `userEvent` controls, using the production component and analyzer: typing `123` produced `1`; the original input was disconnected and focus moved to `BODY`. Existing tests use a single `fireEvent.change(...value:'45')`, which bypasses normal typing and does not catch the defect.
- **Expected fix:** Give markers stable identity independent of frame position, retain input focus during editing, and normalize/commit numeric input without destroying intermediate user input.
- **Needed test:** Use actual multi-character typing and clearing/replacing a value. Assert the final frame, retained focus, and one ordered nonempty result, including typing a value that moves across another marker.

### R5 — P2: Applying slices leaves the modal's preview audio running

- **Location:** `src/components/drum/SliceAudioModal.tsx:92`, `116-120`, and `128-130`; mounting caller `src/components/drum/DrumTool.tsx:813-814`.
- **Trigger:** Play the source or audition a sufficiently long slice and click Apply before it ends. Apply calls `onClose()` without `stop()`. The caller keeps `SliceAudioModal` mounted with `isOpen=false`, so the unmount cleanup never runs. The source-loading effect cleanup only aborts its controller.
- **Reproduced:** Real component Play source → Apply → rerender closed produced zero calls releasing its owned note. Cancel does release it. A late async playback start is likewise not invalidated by this closing path.
- **Expected fix:** Stop and invalidate owned playback when applying/closing, including any pending start, and make closed-state cleanup reliable independently of unmount. Preserve the request-aware natural-completion handling already present.
- **Needed test:** Apply while source playback and slice audition are active, then assert the note is released and no clock remains. Also close while playback startup is pending and resolve it afterward; no orphan source should survive.

### R6 — P2: Source validation accepts audio chunks outside the declared container

- **Location:** `src/utils/audioSlicing.ts:195-206` and `214-231`.
- **Trigger:** Supply RIFF/WAVE bytes whose declared RIFF body ends before the `fmt ` or `data` chunks, with those chunks present in trailing file bytes. Both container parsers calculate the declared endpoint but scan and bound chunks against `bytes.length`. WAV also stops after finding format/data, leaving later malformed chunks unvalidated.
- **Reproduced:** A 46-byte WAV with RIFF size `4` (container ends at byte 12), followed by `fmt ` and one PCM sample outside that container, was admitted as `{channels:1,frames:1,sampleRate:48000,decodedBytes:4}` by the actual `inspectSliceSource`.
- **Expected fix:** Bound chunk headers, bodies, and padding by the declared RIFF/FORM endpoint and validate the permitted container layout before decode. Retain explicit compressed-format rejection; do not infer ADPCM decoded frames from PCM block alignment. The defect is the new admission claim, not a request to rewrite unrelated import behavior.
- **Needed test:** WAV and AIFF chunks crossing their declared container, truncated/padded tails, and malformed trailing chunks must be rejected before the decode function is called; valid PCM/float WAV and supported AIFF continue to pass.

### R7 — P2: Dragging across another marker starts moving that other marker

- **Location:** `src/components/drum/SliceAudioModal.tsx:112-114`.
- **Trigger:** Start with markers `[0,500]`, drag marker 0 past the second marker to frame 600, then continue to 700. `updateMarker` sorts after every move but `dragRef.index` remains 0. The first move yields `[500,600]`; the next edits the marker now at index 0, yielding `[600,700]`. The stationary marker at 500 is moved unintentionally.
- **Expected fix:** Track the dragged marker by stable identity across sorting, or clamp a marker between its neighbors while dragging. Keep selection aligned with the intended marker, and retain pointer-cancel rollback.
- **Needed test:** A multi-marker pointer drag across a neighbor with at least two move events must move only the intended marker (or clamp it) and leave the other marker unchanged. Current pointer tests contain only one marker.

## Evidence and boundaries

- **Controller browser result added after initial handoff:** `/tmp/opstudio-task5-browser.log` records 80 passing cases and five failures, one in each browser profile, in `tests/e2e/slicing.spec.ts:131`. After export, one Undo should restore zero loaded samples but leaves three. The earlier scenario steps through manual Apply, provenance backup, and resampled WAV assertions passed; restore/re-backup steps after Undo were not reached. Export settings were configured before Apply. Root cause and fix verification remain pending with the implementer; this report does not assume the test is incorrect or count unexecuted later steps as passing.
- Inspected retained final logs: `/tmp/opstudio-task5-focused-final.log` reports 6 files / 72 passing tests; `/tmp/opstudio-task5-full-unit-final.log` reports 55 files / 603 passing tests; `/tmp/opstudio-task5-build-final.log` ends with successful production/PWA output. These broad runs were not repeated by this reviewer.
- Additional probes ran production TypeScript bundled in memory, with React/jsdom controls and actual slicing functions/reducer. Only audio playback/context boundaries were stubbed for the UI probes; the stale-apply probe used the actual reducer. No temporary test, runtime, or e2e files were written. Probe output is preserved in this review's tool transcript; the decisive values are quoted above.
- The onset algorithm remains an explicitly limited heuristic. Source fixtures and software playback/export checks do not certify physical OP-XY behavior.
- The documented legacy device export includes retained unassigned originals. The controller explicitly accepted that Task 1 behavior until Task 8 introduces mapped-only default export and opt-in unassigned inclusion; it is not reported as a Task 5 defect.
- Correctly configured export resampling can change slice frame count. This review does not require original-frame counts after conversion and does not reject original-coordinate provenance merely because it exceeds the derived buffer's length.
- The original in-project source receives source identity metadata as part of the batch while retaining its buffer, File, slot, and musical settings; that is consistent with the clarified retention contract.

**Ready to advance past Task 5: no.** Resolve the seven scoped findings, verify their concrete regressions, and reconcile the controller's actual browser results before acceptance. No commit, push, publication, or hardware approval is implied.
