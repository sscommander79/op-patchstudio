# Task 6 integration checklist

Prepared 2026-09-04 from `task-6-brief.md`, `recording-architecture.md`, the accepted Task 3/4 final re-review contracts, and current recording callers, reducer, history, codec, serializer and archive implementation. This is preparatory assessment, not acceptance of recording code or review of Task 5 fixes in progress. No runtime/test edits, test runs, browser/server, capture, or delegation were performed. Reconcile final accepted Task 5 APIs before implementing against them.

## Decisions already settled

- One shared recorder supports existing Record here and new Record takes. Captured/reviewed takes remain modal-owned until explicit Add selected takes.
- Canonical capture is browser-delivered mono/stereo Float32 PCM at the actual accepted 8–96 kHz capture rate; the source File is `.opfloat` with `application/vnd.op-patchstudio.float32`. Device export remains the existing WAV/AIFF path. No new float-WAV encoder or canonical MediaRecorder conversion is required.
- Adopt the architecture's bounded pre-roll, sample-clock trigger/hysteresis/stop behavior, 32-take ceiling and 256 MiB total owned-audio accounting. The default and maximum take duration are 20 seconds.
- Multisample review exposes each selected take's root note. Propose consecutive unused notes starting at the explicit target or MIDI 60/C4, show every assignment, and enforce 0–127. An occupied target needs explicit replacement/free-note/cancel resolution. Additions stop at remaining capacity within 24 zones; excess takes stay in the review tray. Preserve existing larger legacy projects.
- Project admission is separate: whole-project 256 loaded references, 128 MiB archive decoded accounting, and actual portable/archive storage limits. Existing work is never silently removed to make room.

## Existing integration contracts to replace or reuse

| Current surface | Observed behavior | Task 6 integration requirement |
| --- | --- | --- |
| `RecordingModal.tsx` props | `onSave(AudioBuffer, filename): void`, no mode/target/review receipt | Replace with explicit mode, target intent and batch Apply result. Keep review state until confirmed success. A void callback is not a success receipt. |
| `DrumTool.tsx`, `handleOpenRecording` / `handleSaveRecording` | Holds `targetIndex`; converts through OfflineAudioContext and 16-bit WAV, re-imports one file; full-kit path only warns | Preserve Record here access. Supply explicit physical target identity, prepare lossless assets directly, and use deterministic empty pads/overflow. Retire the quantize-and-redecode route for new captures. |
| `MultisampleTool.tsx`, recording state and `targetMidiNote` | `recordingModal.targetIndex` and separate `targetMidiNote` can describe different targets; current save writes 16-bit WAV and re-imports | Construct a single target-intent value when opening: mode, target root note, and expected existing sample identity if replacement is proposed. Do not derive Apply target from an unrelated upload closure. |
| `LOAD_DRUM_SAMPLE` / `ADD_UNASSIGNED_DRUM_SAMPLE` | Accept prepared File/buffer/metadata, but initialize sample settings through import-oriented logic | Do not depend on import defaults to preserve exact captured bounds. Prefer the accepted prepared-asset path with explicit full capture bounds and honest metadata. |
| Task 5 `STORE_DRUM_SAMPLE_ASSET` | Accepts a complete `DrumSample`; `targetKeyIndex=null` appends overflow; occupied destinations currently return unchanged state | Useful asset shape, but the original child action is not a transaction. Reuse its corrected/accepted guard or equivalent safe final commit; never silently lose a take on a rejected target. |
| `LOAD_MULTISAMPLE_FILE` | Refuses additions at length 24; can choose another note unless overridden; root-note override can bypass occupied-note avoidance; initializes loop/zero-crossing state and sorts descending | Validate reviewed root-note decisions before commit. Avoid treating a root override as replacement permission. Preserve intended capture bounds explicitly; do not let automatic note/marker changes contradict the tray. |
| `CLEAR_MULTISAMPLE_FILE` / `UPDATE_MULTISAMPLE_FILE` | Address current indices; root-note updates sort the array | Precompute the final array or address stable identities. Do not queue several index-based replacements against an array whose earlier child action reorders/removes entries. |
| `BATCH_EDIT` in `reduceHistory` | Reduces child actions sequentially and records one history snapshot; it does not check that each child succeeded | Prepare and validate all outputs first. Reject atomically at final state validation; grouping alone does not make partial rejection safe. |
| `BEGIN_EDIT` / `END_EDIT` / `CANCEL_EDIT` | Token-owned gestures; an open group absorbs subsequent musical edits | Do not begin groups from recording meter/control rerenders. Ensure the recording commit becomes a distinct history operation, with any legitimately active preceding gesture settled through the history contract. |
| `storedAudio.ts` | Lossless 24-byte-header planar Float32 codec; finite-value/dimension validation; immutable AudioBuffer cache | Reuse for exact captured audio and File bytes. Do not modify a buffer after encoding. A renamed take can reuse immutable audio/payload while its explicit name/File identity changes. |

## Admission must match the actual archive

Use one pure projected-project admission helper shared with the accepted Task 5 correction if available. Keep destination selection and archive inventory distinct: pad selection needs drum slots, but admission needs both complete workspaces. If the accepted helper is still pending, treat its final interface as a dependency rather than copying the flawed Task 5 drum-only accounting.

For each projected loaded reference with `C` channels and `F` frames:

- Float32 data bytes are `4 * C * F`; canonical opfloat payload bytes are `24 + 4 * C * F`.
- The current `projectArchive.ts` validator sums `sample.audio.bytes * referenceMultiplicity`, so the 128 MiB limit includes the 24-byte header **per logical decoded reference**. Do not deduplicate this limit merely because two slots share an AudioBuffer.
- The projected loaded-reference count is loaded drum assets (including unassigned overflow) plus loaded multisample assets. Empty physical placeholders do not count. Retaining a displaced drum source unassigned does count. A true multisample replacement removes one old reference and adds one new reference; append-style recording cannot pretend it is a replacement.
- The serializer stores every loaded reference. It omits `sourceFile` only for a derived drum slice with `sliceProvenance`; otherwise it includes the original File. A newly recorded ordinary `.opfloat` take therefore currently has both an encoded audio payload and its opfloat source File in the archive. Account for both representations. Do not manufacture slice provenance just to suppress a recording's source bytes.
- `exportProjectArchive` deduplicates audio blobs and source blobs by identity in **separate** maps. Identical bytes or names do not establish identity, and an audio entry and source entry are not deduplicated across those maps. An admission estimator can conservatively count both; it must not assume byte-content deduplication absent from export.
- The 256 MiB stored/archive budget includes actual included assets and manifest/ZIP overhead. Existing limits also enforce 520 entries, 128 MiB per entry, a 2 MiB manifest, and 256 MiB total uncompressed entries. Prefer a metadata-only projection with exact encoded sizes and bounded UTF-8 names; use an explicit conservative overhead reservation if exact manifest sizing is impractical. Do not admit exactly-at-limit audio and discover its headers/manifest make the backup fail afterward.
- Validate dimensions, lengths, note/name bounds and safe integer arithmetic before allocating. Charge source blobs and expected codec scratch to the recorder's separate 256 MiB ownership budget; transfer of an ArrayBuffer changes its owner, not its memory cost. Count identities once for ownership where actually shared, but use archive reference multiplicity for portable decoded admission.

The existing codec caches a Blob for an immutable AudioBuffer; preparation should reuse that payload and the captured buffer rather than allocate a second rendered AudioBuffer. If final accepted Task 5 work changes the source representation/accounting, adopt its verified shared rule and update this checklist's snapshot-specific description. Do not silently change archive schema or weaken validation for recording.

## Safest Apply boundary

Recommended contract: asynchronously prepare take assets outside the reducer, then perform one guarded, synchronous project commit with an observable operation result. Names below describe the required shape, not an API already implemented.

1. Snapshot selected take IDs, their current edit generation, desired names/root notes and explicit destination/replacement intent. Reserve capacity. Disable conflicting draft edits or invalidate preparation when they occur. Keep all review data intact.
2. Prepare and validate every selected File/AudioBuffer/metadata asset with no project dispatch. Use session and preparation generations after every await. A failure or close discards only preparation products and cannot change the project.
3. At the commit boundary, validate against the **current** project: source/target identity, explicit replacement consent, complete archive inventory, pad/note occupancy, current zone capacity and the final selected take set. Nothing asynchronous may occur between the final validation/planning and commit.
4. A ref to the last rendered state does not necessarily cover React dispatches already queued but not rendered. The safest reusable interface is a guarded reducer operation carrying an operation ID, prepared assets, target intent and expected identities/revision. The reducer validates against its actual incoming state, constructs the complete next musical state, and either commits all permitted outputs or rejects the operation. Keep encoding, UUID generation and other side effects outside reducer execution.
5. For a plain `BATCH_EDIT` implementation, require equivalent guarantees: all child effects must be prevalidated against the sequential projected state and the final state must match the plan. Do not mix a stale list of target actions with guards that silently skip individual assets. A dedicated recording operation can construct final arrays in one step while the history wrapper records exactly one snapshot.
6. Report an operation receipt from actual committed state, using its operation ID. A receipt/error can be nonmusical state observed by the caller; avoid executing external callbacks inside a reducer. It must distinguish rejection from success and contain actual applied take IDs, assigned/overflow counts, and multisample IDs left in review.
7. Only after a successful receipt remove the applied take IDs from the tray. Retain unselected and capacity-excess takes, keep any unapplied files/buffers, and display actual destinations. On rejection preserve all takes for retry and refresh the destination explanation. A no-op/failed Apply creates no musical history entry.

Replacement approval is identity-bound: if the target changed while encoding, stop and refresh the explicit replacement decision. Do not treat a once-approved index or root note as permission to replace a different sample. Drum displacement-to-unassigned must be included in admission and Undo if that preservation choice is used. Multisample has no unassigned overflow model; do not add one during this task.

## History, preservation and preview invariants

- [ ] One Add selected takes operation creates one Undo even after long asynchronous preparation. Undo restores prior File/AudioBuffer identities, slots/root notes, musical settings and any replaced asset. Redo restores the same accepted take assets/identities. Pending unrelated imports remain separately undoable.
- [ ] Rename, select, remove, audition, meter updates and capture state changes never dispatch musical actions. Capture review is not a project-history gesture.
- [ ] Preserve accepted Task 4 frame semantics: all captured regions are `[0,F)` with duration `F/rate`; no `F-1` exclusive endpoint. Capturing does not normalize, resample, trim to zero crossings, apply gain/crossfade or invent silence. Export conversion uses the bounded captured buffer later.
- [ ] Task 4 imported-crossfade association preserves deliberate existing edits during ordinary additions/restoration. Only explicit imported-preset replacement invokes its replacement policy. Recording must not clear/reapply imported settings across existing work.
- [ ] Existing source identities/provenance are immutable metadata through history, serialization and archive restore. Do not overload `sliceProvenance` with recording semantics. Add capture-specific persisted metadata only if needed and validate it narrowly; take IDs can remain modal-owned until commit.
- [ ] Both caller modes pass the same actual target intent to the recorder. Generated note proposals are visible and become explicit values before Apply. Multi-digit name/note edits keep stable control keys and focus; selected rows are keyed by take ID, never editable name/index.
- [ ] Closing while still mounted, unmounting, Cancel, source/device replacement, and Apply cleanup invalidate asynchronous preview starts as well as active notes. Scope `onEnded` to the currently owned preview. Starting capture stops audition; audition first stops/disarms capture.
- [ ] Stop remains available during setup/recording/encoding. A late permission result after Stop/close stops its returned tracks immediately. No late worklet/encoding callback can add a take or commit after its session was invalidated.
- [ ] Completed takes survive input restart and recoverable encoding failure while the tray stays open. Close/Cancel discards unapplied modal work, leaves existing project data unchanged, and disposes owned contexts/streams/nodes/listeners/ports/timers. Do not close the shared application audio context.

## Focused acceptance cases that should accompany implementation

| Boundary | Required evidence |
| --- | --- |
| Current-state commit | Hold preparation, complete another sample import, then resume. No dropped/overwritten take, stale success count or stale replacement approval; rejection retains the entire tray. |
| Whole-project admission | Mixed drum/multisample state near sample/decoded/stored limits; reject before duplicate allocation. Test opfloat headers, ordinary recorded source representation, drum overflow/displacement, and an actual accepted near-limit backup. |
| Multisample assignment | Explicit target, occupied target, note 127, duplicate user-selected notes, descending sort, 23/24-zone capacity, and legacy >24-zone state. No implicit replacement or silently changed root note; unapplied takes stay visible. |
| Source precision | Compare every Float32 channel/frame across capture → prepared File → project → session/library → archive restore. Verify metadata and MIME; export resampling assertions use actual converted frame count rather than demanding source frame count. |
| History | Real caller/reducer Apply → backup/export → one Undo, preserving settings made before Apply, then Redo/restore. A mock dispatch-call count is insufficient. |
| Lifecycle | Controlled late permission/setup/encoding/preview completion, device removal, close while mounted, unmount and StrictMode cleanup. Assert returned resources are actually disposed and no project callback occurs. |
| Capture core | Reuse the architecture's exact pre-roll, variable-block, opposite-polarity stereo, quiet/hysteresis, repeated-burst, no-gap/no-duplicate, length/silence coincidence and bounded-backpressure fixtures. |
| Real browser | Controller-owned synthetic-input capture through the built local worklet; no path to a personal microphone. Confirm the emitted production worklet URL and cleanup. Unsupported modes must show their documented limitation. |

## Task 5 dependencies and evidence boundary

R1 (whole-project accounting) and R2 (guarded current-state Apply) are prerequisites for reuse; do not copy the original implementations while their fixes are moving. R3–R7 also provide directly relevant regression lessons for review generations, stable control identity, close cleanup and marker ownership.

The controller's completed Task 5 browser matrix has 80 passes and five failures at post-export Undo, with three samples remaining when zero were expected. Earlier manual Apply, provenance backup and resampled-WAV checks completed; later restore/re-backup steps did not run. This is an unresolved runtime dependency, not evidence that history tests or the browser assertion should be weakened. Reconcile its actual root cause and verified fix before using that path as the recording acceptance baseline.

Task 3/4 accepted behavior remains the baseline; this assessment does not reopen those tasks or claim the moving Task 5 corrections pass. It introduces no new capture algorithm beyond the approved architecture and makes no claim about hardware ADC fidelity, physical devices, or browser support not yet observed.
