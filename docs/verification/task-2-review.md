# Task 2 independent review

Spec compliance verdict: **CHANGES REQUIRED**.
Code quality / concurrency / lifecycle verdict: **CHANGES REQUIRED**.

Reviewed the uncommitted Task 2 working tree against `task-2-brief.md`, `task-2-report.md`, the scoped review package, and requirements 2/9 of the design spec. Task 1's import action is outside this review. No production source, existing tests, browser configuration, or commits were changed. The WebKit binary-envelope workaround is accepted as intentional; it retains the public Blob/File interfaces and has direct regression coverage.

## Prioritized findings

### P2 — Keep settings-only projects eligible for recovery

Location: `src/utils/sessionStorageIndexedDB.ts:35-37`; downstream overwrite at `src/hooks/useSessionManagement.ts:25-30,54-60`.

`saveSession` now commits the full editable project and the UI reports it saved even when no audio is loaded, but `getCurrentSession` returns null whenever both sample-reference arrays are empty. A user can name a preset, import FX/settings JSON, or adjust envelopes before loading audio, wait for Saved on this device, and reload. Startup treats the existing committed project as absent, opens no recovery decision, and autosaves the initial settings over it. The same issue applies after deliberately removing the last sample while retaining the instrument settings.

Independent regression: commit a sample-free state named `Before samples` with imported drum `{fx:{drive:37}}`. A direct `loadSession()` confirms the imported data is durable, but `getCurrentSession()` returns null. Expected: the persisted work remains recoverable. The new regression fails exactly on that null result.

Fix: determine recoverability from persisted project/edit state, not sample count alone. If pristine startup snapshots should be ignored, distinguish those explicitly from actual saved edits. Test the full settings-only save → reload → decision → restore path and ensure startup does not overwrite it before a decision.

### P2 — Resume autosave after an interrupted or failed library load

Location: `src/hooks/useSessionManagement.ts:40,54-60`; cooperating lifecycle at `src/components/library/LibraryPage.tsx:180-182,195-208`.

The one-shot autosave timer calls `saveSession`, which returns immediately when the imperative `loading-preset` flag is set. A slow library decode can span that timer. If decoding fails, the editor correctly remains intact, but the library handler only emits a notification and removes the storage flag. Neither action changes an autosave dependency, so the unsaved current edits receive no new save attempt. Status remains idle without a save error or Retry save control; reloading then loses those edits. A reload during the pending library operation also leaves the sessionStorage flag set across reload, with no startup cleanup, so the same guard can suppress future saves indefinitely.

Independent regression: finish an initial save; make an unsaved name edit; set the same loading flag; advance 1.1 seconds and confirm no save; remove the flag and dispatch the exact load-failure notification shape; advance another five seconds. The expected save never occurs. The sessionStorage getter in this probe is explicitly made stateful for the flag because the shared unit setup's getItem/setItem doubles do not store values.

Fix: coordinate load activity with a reactive, lifetime-bounded state, or allow current intact work to save during the decode and schedule the complete restored state afterward. Any suppression must resume on both success and failure, and must not survive an abandoned document. Add a delayed failing-library-load regression that proves the current edited project ultimately commits.

### P2 — Do not report a committed library preset as a failed save

Location: `src/utils/libraryUtils.ts:144-156`; new rejection propagation at `src/utils/sessionStorageIndexedDB.ts:46-53`.

The library row commits first. The method then awaits a separate session-marker update inside the same catch block, even though `savedToLibrary` is explicitly informational and no longer controls recovery. If that later metadata write fails, the API returns `success:false` and the UI reports that the preset could not be saved, while the preset is already durably present. Retrying adds another UUID row. This is newly observable because the rewritten marker method propagates errors; the former implementation swallowed them.

Independent regression: commit a current session, inject failure only into the subsequent `db.saveSession` marker write, and call `savePresetToLibrary`. Reading the real fake-indexeddb preset store confirms `committed library preset` exists, but the API returns `{success:false,error:'failed to save preset to library'}`. The expected truthful success result fails.

Fix: remove the obsolete marker from the user-visible library save's success boundary, or handle its failure separately after acknowledging the completed preset transaction. If it must remain required, use a genuinely atomic operation across both stores. Test failure after the library commit and verify the reported outcome and retry behavior match durable state.

## Independent verification

- Existing focused tests: `npx vitest --run src/test/utils/durableStorage.test.ts src/test/hooks/sessionRecovery.test.tsx src/test/utils/indexedDB.test.ts src/test/utils/sessionStorageIndexedDB.test.ts` — **4 files, 56 tests passed**. Log: `/tmp/opstudio-task2-review-baseline.log`.
- Additional review regressions ran alongside copied existing focused fixtures: **3 failed, 21 passed**, with the three failures matching the findings above. Log: `/tmp/opstudio-task2-independent-review.log`.
- Exact probe files are retained outside the checkout: `/tmp/opstudio-task-2-independent-storage.test.ts` and `/tmp/opstudio-task-2-independent-hook.test.tsx`. To repeat, copy them back to `docs/verification/task-2-independent-storage.test.ts` and `docs/verification/task-2-independent-hook.test.tsx`, respectively, and run Vitest against those two paths. They import the production source through `../../src/`. The temporary checkout copies were removed after testing.
- `git diff --check` reports one trailing-space line at `src/utils/libraryUtils.ts:184`. This is a small cleanup item, not an additional important finding.
- Full suite **482 tests** and production build success are implementer-reported evidence, not rerun in this review. Browser verification remains controller-owned; no browser server or browser run was started. No physical Safari or OP-XY hardware claim is made.

## Accepted implementation behavior

The transaction-level rollback tests preserve prior metadata and exact sample bytes after a request succeeds and the transaction aborts. Successful replacement removes obsolete referenced rows. The single failure-tolerant session mutation queue orders delayed saves and clear, captures lightweight metadata when scheduled, and permits subsequent saves after failure.

The new binary audio format preserves tested finite Float32 values, signed zero, over-range samples, both channels, frame count and source rate; it validates payload dimensions/length before AudioBuffer allocation. Source assets and metadata survive, and legacy JSON/raw decoding remains available. Blob/File envelopes preserve source filename, modification time and bytes, while legacy native Blob rows remain readable.

Normal startup waits for database checking and an explicit recovery decision, two-day-old recovery remains available, failed restoration keeps the editor and source intact, and Escape does not discard. Session and library restoration decode required audio before a single reducer update. Sparse drum slots, unassigned overflow, zero loop endpoints, envelopes and advanced settings restore in the covered workflows; library restoration retains the other mode. Save error/retry and stale-save-completion checks pass.

The findings concern gaps in otherwise useful transaction, recovery and observability improvements. They should be resolved before Task 2 is accepted or used as the persistence foundation for history and portable backups.
