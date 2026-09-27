# Task 2 — durable project and library storage

Status: implementation complete and ready for independent review. Full unit suite and production build pass; controller is running the final combined browser matrix. No commit or push.

## Changes

- The IndexedDB boundary converts nested Blob/File assets into cached ArrayBuffer envelopes with MIME, filename and last-modified metadata before opening transactions. Public reads reconstruct Blob/File values, and legacy native Blob rows remain readable. This avoids the confirmed Playwright WebKit Blob/File write failure without changing codec/project APIs.
- Session samples and metadata commit in one IndexedDB read/write transaction. A failed or aborted replacement retains the complete prior snapshot. Successful replacement deletes obsolete references and sample rows within the same transaction. Generic writes resolve at transaction completion rather than request success.
- Session save, clear, and library-marker mutations share a failure-tolerant queue. Lightweight state is cloned when scheduled; immutable AudioBuffers and source assets remain shared. Snapshot sample IDs use UUIDs.
- New audio uses a versioned, explicitly little-endian planar Float32 payload. It preserves all finite Float32 values, including over-range values and signed zero, channel count, frame count and source rate. Dimensions, version and payload length are checked before AudioBuffer allocation. No device-rate decoding is used for this representation.
- A WeakMap caches encoded audio by immutable AudioBuffer identity. Repeated setting-only saves reuse prepared Blobs. Audio processing must create a replacement AudioBuffer rather than mutate a cached one. IndexedDB still clones each committed record; this is encoding reuse, not disk deduplication.
- Full session decode completes before one reducer restore action. Imported drum/multisample JSON, mapping, source metadata/isFloat, sparse slots, overflow, names, assignments, trims, zero loop points and advanced settings survive restoration. Missing/corrupt audio rejects restoration and leaves the source actionable.
- Library decode similarly validates all required samples before `RESTORE_LIBRARY` applies only its instrument mode. It retains the other mode and uses shared complete defaults. Sorting copies the library array.
- Autosave waits for the initial database check and the explicit recovery decision. Recovery does not expire after 12 hours or disappear because it was copied to the library. Startup never deletes damaged samples.
- Shared checking/idle/saving/saved/error state, failure text and last-save time drive an accessible save indicator with `Retry save`. Completion checks both musical revision and save attempt so an older snapshot cannot mark newer edits saved. Status updates do not trigger another autosave.
- Recovery Escape is ignored. Explicit Start new waits for durable deletion. Pending controls are disabled; failed recovery remains open with an actionable error.

## Public interfaces for subsequent backup/history work

- `src/utils/storedAudio.ts`: `encodeStoredAudio(AudioBuffer): Blob`, `decodeStoredAudio(Blob, optionalLegacyAudioContext): Promise<AudioBuffer>`, `restoreSourceFile(...)`, and `STORED_AUDIO_TYPE`.
- Binary v1 header: bytes 0–3 `OPAS`; LE u32 version at 4, channels at 8, frames at 12; LE f64 sampleRate at 16; header size 24, followed by planar LE Float32 samples. Payload cap 512 MiB; channel count 1–32. Decoder validates length exactly and rejects non-finite values.
- `src/utils/projectSerialization.ts`: `ProjectSnapshot`, `RestoredProject`, `createProjectSnapshot(state)`, `serializeProject(snapshot, optionalSessionId)` returning `{session, samples}`, `deserializeProject(session, getSample)` returning a fully decoded `RestoredProject`, and `restoreProjectSettings`.
- `serializeProject` expects a scheduling-time snapshot. Audio and File assets are immutable references; settings, imported JSON and per-sample edit metadata are cloned. Archive authoring should store each `SampleData.data` and preserved source asset as binary members, not JSON channel arrays.
- Internal IndexedDB binary envelope: `{__opPatchBinary: 1, bytes: ArrayBuffer, mime: string, name?: string, lastModified?: number}`. This representation is private to the database boundary; public read APIs return normal Blob/File objects. A WeakMap caches Blob-to-ArrayBuffer preparation, so repeated saves do not repeatedly materialize immutable audio bytes.
- `indexedDB.replaceSessionWithSamples(session, samples)` and `deleteSessionWithSamples(id)` own transaction lifetime. All audio/Blob preparation happens before entering the transaction.
- `sessionStorageIndexedDB.restoreSession()` returns a complete project or rejects; `loadSession()` and sample reads propagate failures. `clearCorruptedData()` is now diagnostic-only and no longer called at startup.
- `deserializeLibraryPreset(preset)` returns a fully decoded project; `RESTORE_LIBRARY` takes `{mode, project}`. `RESTORE_SESSION` consumes the project.

## Migration and preservation

New session schema version is 2; existing schema 0/1 rows remain readable. Legacy session JSON audio reconstructs at its stored rate. Legacy raw session audio and library WAVs use WebAudio decoding. The new binary format bypasses WebAudio decoding. Available original File bytes and source metadata are preserved. A legacy JSON sample without original bytes becomes a nonempty `.opfloat` file with the explicit binary MIME type; it is never presented as an empty AIFF/WAV.

Migration is read-on-demand, not destructive. The old snapshot remains unchanged until a complete new save commits. `savedToLibrary` remains informational and does not suppress recovery.

## Regression evidence

Observed RED before implementation:

- `/tmp/opstudio-task2-red.log`: 5 failures covering request-success/transaction-abort, lost prior sample rows, audio precision/rate/source metadata, library audio precision, and imported JSON/mapping restoration.
- `/tmp/opstudio-task2-recovery-red.log`: 4 failures covering delayed startup autosave, two-day-old recovery, observable save failure/retry, and Escape deleting recovery.
- `/tmp/opstudio-task2-revision-red.log`: an older in-flight save marked newer edits saved.
- `/tmp/opstudio-task2-bytes-red.log`: a transaction engine rejecting every nested Blob/File could not save a session. The regression now verifies exact audio plus original source filename, modification time and bytes through the byte-envelope adapter.
- Controller baseline evidence additionally covers true browser IndexedDB rollback and Float32 precision (`/tmp/opstudio-recovery-red2.log`), aged recovery (`/tmp/opstudio-recovery-workflow-red.log`), save retry (`/tmp/opstudio-autosave-retry-red.log`), and library setting/FX loss (`/tmp/opstudio-library-workflow-red.log`).

GREEN evidence:

- `/tmp/opstudio-task2-final-unit.log`: full suite, 38 files and 482 tests passed, including 14 durable storage regressions and 7 startup/recovery/status regressions. Expected pre-existing test logs/warnings remain.
- `/tmp/opstudio-task2-final-build.log`: production typecheck/build passed; existing large-bundle/Browserslist warnings remain.
- Controller Chromium smoke: all 5 storage workflows passed (`/tmp/opstudio-task2-browser-smoke.log`).
- Initial matrix passed Chrome/Firefox/mobile Chrome but identified the WebKit Blob/File write failure. Controller isolation (`/tmp/opstudio-webkit-idb-probe.log`) showed plain objects/ArrayBuffers succeed while every native Blob/File variant aborts with UnknownError. After the byte-envelope adapter, all 5 WebKit storage workflows passed (controller session 87286). The final combined 40-case browser matrix remains controller-owned.
- `/tmp/opstudio-task2-bytes-green.log`: 47 focused CRUD/storage tests passed after the adapter, before the final legacy-native-Blob regression and full-suite rerun.

New independent assertions cover delayed A/B/clear ordering, queue recovery after failure, immutable metadata capture, committed row cleanup, exact stereo payloads, malformed/truncated bounds, legacy JSON/raw dispatch, source-file reconstruction, all editable state, other-mode retention and failed restore preservation. Existing request-only IndexedDB doubles now emit transaction completion/error; the misleading session mock that recreated a fresh store for each transaction was replaced with fake-indexeddb. fake-indexeddb was added as a dev dependency after current Context7 documentation lookup.

## Limits

Playwright WebKit results are not a claim of testing physical Safari devices. Browser persistence and downloads are not OP-XY hardware proof. Legacy raw audio may still use browser/device decoding rules; new binary payloads preserve exact audio independently. Backup import should validate its complete manifest and asset references before dispatching restoration; that user-facing archive workflow is subsequent work.

## Independent review remediation — round 1 of 5

All three P2 findings in `task-2-review.md` are addressed:

1. **Settings-only recovery.** `getCurrentSession()` now returns every committed project, including named presets, imported JSON/FX, envelope edits, and projects whose final sample was removed. Recovery eligibility no longer depends on sample count. The hook avoids automatically creating a pristine startup snapshot before any musical edit; every actual edit increments its revision and is saved. Existing committed snapshots are preserved until the restore/discard decision.
2. **Failed or interrupted library loads.** The imperative `loading-preset` flag and its autosave guard are removed. During asynchronous decode the editor remains unchanged and valid, so current edits can save normally. A successful decode still dispatches the complete mode-scoped update and schedules its own save; a failed decode leaves current work committed. A stale sessionStorage value from an abandoned document has no effect.
3. **Truthful library save outcome.** The library-row transaction is the save success boundary. Failure of the optional `savedToLibrary` marker is caught and logged separately, and the already committed preset returns success. Callers therefore do not retry a completed save and create a duplicate UUID row.

The identified trailing-space line in `libraryUtils.ts` was cleaned.

Round 1 RED evidence:

- `/tmp/opstudio-task2-round1-red.log`: five new behavioral failures reproduced settings-only recovery omission (storage and full hook paths), lost autosave after failed library loading, stale loading suppression, and false failure after a committed library preset. This first run also collected two incomplete controller backup test copies under `.superpowers`; those unrelated import errors were identified explicitly and the controller moved the backup outside the checkout before full verification.
- `/tmp/opstudio-task2-pristine-red.log`: the untouched startup created a meaningless autosave snapshot before any edit.
- Controller `/tmp/opstudio-settings-recovery-red.log`: actual browser settings-only recovery was independently RED before these changes.

Round 1 GREEN evidence:

- `/tmp/opstudio-task2-round1-focused.log`: 43 focused tests passed before the additional real delayed-decode integration test.
- `/tmp/opstudio-task2-round1-unit.log`: full suite, **39 files / 489 tests passed**. This includes a real IndexedDB settings-only save → hook startup → wait beyond debounce → explicit restore test, and a real delayed invalid-audio decode whose existing edited project commits durably without another edit.
- `/tmp/opstudio-task2-round1-build.log`: production typecheck/build passed; existing bundle size and Browserslist warnings remain.

No browser server or browser/config edit was made by this implementer. Final browser rerun and independent re-review remain controller-owned. Source is frozen after this round's unit/build/report completion.

Controller round1 browser verification: **45/45 passed** across Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari profiles, including settings-only recovery. Log /tmp/opstudio-task2-round1-browser.log. Portable project test is intentionally excluded until Task3. No physical-device claim.
