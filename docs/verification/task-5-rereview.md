# Task 5 bounded re-review — round 1

Reviewed 2026-09-04 against `task-5-round1-report.md`, the updated Task 5 report, the accepted R1–R7 findings, and the source/test diff from `/tmp/opstudio-task5-before-round1/src`. Additional scope: actual restore-path provenance loss and the controller's post-export Undo failure. Source and tests remained frozen; this reviewer did not launch a browser/server or repeat broad tests.

**Spec verdict: changes required for one narrow residual.** Whole-project sample/decoded admission, current-state commit, editing, playback cleanup, container validation, restoration provenance and actual Undo are corrected. Stored/archive admission still omits ZIP overhead when a manifest approaches its permitted size.

**Code-quality verdict: changes required for that same residual.** The new guarded reducer commit and operation receipt correctly replace blind replay of asynchronously prepared child actions. The modal now uses stable marker IDs and explicit edit/playback ownership. No additional actionable regression was identified within this bounded scope.

## Finding dispositions

| Finding | Disposition and evidence |
| --- | --- |
| R1 — whole-project admission | **Original omission fixed; ZIP-overhead edge remains as RR1 below.** `DrumTool.tsx:810` passes both workspaces; `audioSlicing.ts:269-279` counts every loaded logical opfloat header and includes ordinary source Files while omitting derived source copies. The guarded reducer repeats admission against current state. The mixed 255-reference fixture is actually exported/imported and verifies byte headers; capacity growth to 257 rejects without changing either workspace. |
| R2 — stale Apply drops slices | **Closed.** `finalizeSliceApplication` validates the current source File/buffer/identity, rechecks complete capacity, and replans empty physical pads. `AppContext.tsx:961-982` reduces into local state, checks expected assets and assignment counts, and exposes the next state only after success. Rejection preserves original musical arrays with an operation receipt; the modal closes only for its matching successful receipt. Tests complete an import during preparation, replace an existing source, and inject a rejected later child after earlier local children succeeded. All outputs are retained or the whole operation is rejected; one Undo preserves the separate late import. |
| R3 — stale Auto overwrites Manual | **Closed.** `SliceAudioModal.tsx:60-71` admits a result only for its current edit generation/source/open state; Manual at `142` aborts the old controller and advances that generation. The held-analysis component test finishes old analysis after manual marker creation and preserves the manual draft. Apply stops editing and freezes ranges before preparation. |
| R4 — numeric input remounts | **Closed.** Marker IDs key rows independently of value/order. Draft strings commit on Enter/blur (`145`, `162`). The test clears/types `700{Enter}`, crosses a neighbor, and verifies the same focused DOM input and two ordered results. |
| R5 — preview survives Apply/close | **Closed.** Apply, mounted `isOpen=false`, cancellation and unmount invalidate playback ownership and stop the owned note (`104-106`, `132-136`, `146-147`). Pending starts check current request/open/busy state and release their returned note. Component cases cover both active and delayed starts for Apply and mounted close. |
| R6 — chunks outside container | **Closed.** `audioSlicing.ts:197-236` bounds every header/body/padded endpoint by the declared RIFF/FORM end, requires it to match the File, and no longer stops after finding WAV data. New fixtures cover valid WAV/AIFF plus trailing bytes, undersized containers, missing padding and malformed trailing chunks. Existing compressed-format rejection remains. |
| R7 — crossing drag moves neighbor | **Closed.** Drag state stores marker ID; moves resolve that ID after sorting (`SliceAudioModal.tsx:128-130`). The two-move crossing test leaves the stationary marker at 500 and moves only the selected one to 700; pointer cancellation restores both original marker values. |
| Additional — actual restore loses provenance | **Closed.** `IMPORT_PROJECT` and `RESTORE_SESSION` share reconstruction at `AppContext.tsx:1366-1397`; `sourceIdentity` and copied `sliceProvenance` are retained. Drum `RESTORE_LIBRARY` delegates to that path at `1359-1364`. The archive integration fixture invokes all three actual reducer actions and checks retained original identity and derived source coordinates. |
| Additional — one Undo leaves slices | **Closed.** The inspected trace shows a source-dependent `SET_DRUM_BIT_DEPTH` after the successful slice commit, then its reapplication after Undo. `AudioFormatControls.tsx:132-139` now preserves/enables the user's configured conversion selection and removes automatic settings dispatches. The actual controls regression covers changing source metadata; all five browser profiles now pass source → slicing → export → one Undo → restore/re-backup. |

The changed runtime inventory is limited to the format control, drum caller/modal, reducer and slicing module; persistence behavior is repaired through the actual reducer reconstruction rather than an unrelated serializer rewrite. Accepted Task 4 frame/provenance and preview contracts remain intact in this scope.

## RR1 — P2: Full manifest reservation leaves no room for ZIP headers

- **Location:** `src/utils/audioSlicing.ts:280-282`; actual final archive byte gate `src/utils/projectArchive.ts:282-286`.
- **Trigger:** A project approaches the 256 MiB stored-file budget and contains permitted imported JSON that makes its manifest close to the existing 2 MiB manifest cap. The planner adds exactly that manifest allowance to asset bytes and allows equality. The actual STORE ZIP additionally contains local headers, central-directory entries, entry names and its end record. Applying an otherwise valid batch can make the subsequent portable backup exceed its file-byte limit.
- **Concrete ledger:** A metadata-only probe used real `prepareSliceApplication`, `serializeProject`, `appReducer` and the exporter's entry names/manifest fields. Four existing small decoded assets have distinct retained source Files totaling 266,333,772 bytes (about 63.5 MiB each, below the slicing source-file ceiling; such WAV sizes can be represented by valid padded ancillary chunks). A new 128-frame source and 128 one-frame outputs remain far below decoded/sample-count caps. An allowed imported JSON field places the resulting manifest at 2,097,052 bytes, which is 100 bytes below its cap.

| Quantity | Before Apply | After Apply |
| --- | ---: | ---: |
| Loaded references | 4 | 133 |
| Stored asset bytes | 266,333,884 | 266,338,304 |
| Manifest bytes | 1,983,899 | 2,097,052 |
| STORE ZIP headers/names/end record | 1,108 | 17,482 |
| Actual archive size from layout | 268,318,891 | **268,452,838** |
| Archive cap | 268,435,456 | 268,435,456 |

The planner reports `projectedArchiveBytes:268435456` and the actual reducer returns a committed receipt with 20 assigned / 108 overflow. The layout exceeds the archive cap by **17,382 bytes**. Before Apply, that same project is within the byte limit. The ledger models existing File sizes rather than allocating their large payloads; no full-size archive was generated. For the exporter's ASCII paths and STORE entries, overhead is `22 + sum(76 + 2 * UTF8(path).length)`, so this is deterministic format accounting, not a browser-memory estimate.

- **Expected fix:** Reserve ZIP structure independently of the full manifest allowance, using a safe bounded entry/name allowance or the actual planned entry layout. Preserve the separate decoded/header/source representation rules already fixed. Expose the complete projected byte total in admission.
- **Needed regression:** A metadata-only near-limit case with a manifest near its allowed cap must reject before derived allocation/commit when asset + manifest + ZIP structure exceeds the file limit. Include the exact supported boundary and one byte over it. Keep a small actual archive layout test to tie any formula/reserve to emitted ZIP structure; no 256 MiB allocation is necessary.

This is the sole remaining scoped finding. It does not reopen normal-source admission, the mixed-workspace fix, or the passing slicing workflows.

## Verification evidence

- Inspected focused logs: 67/67 in `/tmp/opstudio-task5-round1-focused-fourth.log`, and 27/27 atomic/format-control subset in `/tmp/opstudio-task5-round1-focused-post-atomic.log`.
- Inspected full unit log: 56 files / 616 passing tests in `/tmp/opstudio-task5-round1-full-unit.log`.
- Production build completes in `/tmp/opstudio-task5-round1-build-final.log`; targeted lint and whitespace logs are empty as reported.
- Inspected controller browser logs: five focused slicing cases pass in `/tmp/opstudio-task5-round1-browser.log`; full frozen matrix **85/85 passes** in `/tmp/opstudio-task5-round1-full-browser.log` (58.3 seconds). This closes the initial browser Undo failure and reaches the previously unexecuted restore/re-backup suffix.
- The additional admission probe ran only in memory and did not modify source/tests or start browser/server work. Its decisive arithmetic and actual committed receipt are recorded above and in the review tool transcript.

**Recommendation:** Make the bounded ZIP-overhead admission correction and re-review only RR1 plus its direct regression risk. All other listed findings are closed. No commit/publication or physical-device certification is implied.
