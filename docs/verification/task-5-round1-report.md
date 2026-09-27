# Task 5 round-one fix report

This round addresses every finding in `task-5-review.md` and the controller's five-browser Undo failure. Runtime and e2e source were frozen only after focused, full-unit, build, lint, whitespace, and a narrow real-browser diagnosis completed.

## Finding disposition

- **R1 — fixed:** slicing admission receives both drums and multisamples. Each logical opfloat entry includes its 24-byte header, ordinary original source Files are counted once, derived source Files are omitted, and the 2 MiB manifest allowance plus the maximum STORE ZIP structure are reserved within the 256 MiB portable-project limit. A 255-asset mixed project is committed, exported, inspected entry-by-entry, imported, and checked through the real reducer; a fresh 257-asset state rejects the prepared operation unchanged.
- **R2 — fixed:** preparation returns immutable assets rather than authority to replay them. `COMMIT_PREPARED_SLICES` rechecks the current source object/File/identity, complete current project capacity, and current empty pads; it then reduces locally and verifies every expected original/slice, assignment count, and source identity before returning the new state. Any failure returns the original musical state with a rejected operation receipt. Tests cover a pad filled during preparation, capacity growth, source replacement, and an intentionally rejected child after an earlier local child succeeded.
- **R3 — fixed:** Manual aborts Auto, advances an edit generation, clears analysis busy state, and owns the displayed draft. Analysis completion requires the same source, open state, signal, and edit generation. Apply similarly freezes the visible ranges and disables edits while preparing.
- **R4 — fixed:** markers have stable IDs independent of sorted frame position. Numeric fields buffer ordinary text and commit on Enter/blur. A real `userEvent` multi-character replacement crosses another marker while retaining the same focused DOM input and a valid ordered result; e2e uses sequential keystrokes rather than `fill()`.
- **R5 — fixed:** Apply, Cancel, `isOpen=false`, and unmount invalidate playback requests and release the owned note. Late start resolution checks request/open/busy ownership and releases itself. Tests cover active and pending starts for both Apply and mounted close.
- **R6 — fixed:** WAV/AIFF inspection requires an exact declared container endpoint and walks every chunk without an early data break. Headers, bodies, odd padding, truncated tails, and malformed trailing chunks are bounded by RIFF/FORM before decode. Compressed formats remain explicitly rejected.
- **R7 — fixed:** drag ownership uses marker ID across sorting. Two pointer moves across a neighbor leave the stationary marker unchanged; pointer cancel restores the original marker objects and selection.

## Undo diagnosis and fix

The initial browser failure was not a missing Undo dispatch or a partial slicing batch. Temporary reducer logs showed `COMMIT_PREPARED_SLICES` added the expected third history entry. Loading 16-bit slice assets then caused `AudioFormatControls` to dispatch a source-dependent `SET_DRUM_BIT_DEPTH`, adding a fourth entry. One Undo correctly removed that later setting change and therefore left all three slice assets present; the control then dispatched the same change again.

Format option availability now never rewrites user-selected conversion settings. The current configured sample-rate, bit-depth, and channel options remain enabled when newly loaded source metadata changes suggestions. The real browser case retains preset name, 22.05 kHz output, and 16-bit output across Apply and one Undo. All temporary logs/listeners were removed from source and e2e.

## Persistence and operation interfaces

`IMPORT_PROJECT`, `RESTORE_SESSION`, and drum `RESTORE_LIBRARY` now reconstruct `sourceIdentity` and a copied `sliceProvenance` object. The actual reducer paths are tested after an exported/imported archive, alongside the lower-level serializer checks.

The reusable operation sequence is:

1. `prepareSliceApplication(options)` validates the snapshot and materializes bounded immutable slice assets.
2. Dispatch `{type:'COMMIT_PREPARED_SLICES', payload:{operationId, prepared}}` exactly once.
3. Read the matching `sliceCommitResult`. Close/report success only for `committed`; keep the draft open and report the actionable reason for `rejected`.

The final commit owns current-state admission and destination planning. Prepared child actions are internal data and are not a supported dispatch interface.

## Verification evidence

- Focused review suite: 67/67, `/tmp/opstudio-task5-round1-focused-fourth.log`; atomic postcondition subset: 27/27, `/tmp/opstudio-task5-round1-focused-post-atomic.log`.
- Full unit suite: 56 files / 616 tests, `/tmp/opstudio-task5-round1-full-unit.log`.
- Production TypeScript/Vite build: pass, `/tmp/opstudio-task5-round1-build-final.log` (existing dependency Sass, bundle-size, and browsers-list warnings only).
- Targeted new-code lint and whitespace check: pass with empty output, `/tmp/opstudio-task5-round1-lint-final.log`, `/tmp/opstudio-task5-round1-diff-check-final.log`.
- Decisive temporary Undo trace: `/tmp/opstudio-task5-round1-undo-actions.log`.
- Narrow final Chromium e2e: 1/1 pass, `/tmp/opstudio-task5-round1-narrow-browser-green.log`.

The onset detector remains an explicitly limited amplitude-rise heuristic. New-source slicing supports validated PCM/IEEE-float WAV and uncompressed AIFF. The retained unassigned original remains included by the current legacy device-export helper until Task 8 adds mapped-only default export. No physical-device certification is claimed.

## Round-two admission addendum

The scoped re-review found that reserving the full manifest allowance did not separately reserve the STORE ZIP structure. Admission now adds 63,100 bytes for the maximum 513-entry layout, calculated as `22 + sum(76 + 2 * UTF8(path).length)` for the manifest, 256 logical audio paths, and 256 source paths. Exact-boundary admission succeeds, a one-byte increase rejects before allocation and again at current-state commit, and a small real archive proves that its emitted structure equals the same formula. Round-two evidence is recorded in `task-5-round2-report.md`.
