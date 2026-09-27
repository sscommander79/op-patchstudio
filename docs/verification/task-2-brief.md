# Task 2: durable project and library storage

Workspace: /Users/stevencommander/Desktop/AI/op-patchstudio-improved
Spec: docs/superpowers/specs/2026-09-04-studio-upgrade-design.md, requirements 2 and 9.
No commits, pushes, agents, or unrelated export/UI redesign edits. Use real behavior regressions, observe RED before implementing. Baseline tests may contain incorrect request-only IndexedDB doubles; replace affected mocks with transaction-aware behavior, never weaken correct production semantics to satisfy mocks.

## Own these files
src/utils/indexedDB.ts, src/utils/sessionStorageIndexedDB.ts, src/utils/libraryUtils.ts, src/hooks/useSessionManagement.ts, src/components/library/LibraryPage.tsx, src/context/AppContext.tsx (restore/save-status fields/actions only), new src/utils/storedAudio.ts / project serialization utility as needed, related focused tests. You may add fake-indexeddb as a dev dependency if needed, but fetch current docs via ctx7 before using a new library. Controller owns tests/e2e and configs.

## Problems to solve
1. saveSession currently deletes every prior sample before preparing new data, uses separate transactions for each write, and has no operation queue. Failed or overlapping saves can destroy recoverability.
2. IndexedDB writes resolve on request success rather than transaction completion. Transaction abort must reject even after request succeeds.
3. Autosave starts before the async restore check completes; a slow database can overwrite recoverable work with the empty initial state. Restoration ignores data older than 12 hours. Errors are console-only. Clear/preset-load can race with queued saves.
4. Library audio is encoded to 16-bit but stores original bit depth metadata. Sample settings, assignments/unassigned overflow, imported JSON and advanced multisample settings do not all restore; zero loop points are replaced by fallbacks. Partial failed library load still reports success and changes current work.

## Design and interfaces
- Add a production `replaceSessionWithSamples(session: SessionData, samples: SampleData[]): Promise<void>` operation on database manager. It writes all supplied samples and session metadata in ONE readwrite transaction, deletes only replaced session sample references (or safely clears a exclusively-owned current-session sample store within that same transaction), resolves only on oncomplete, rejects on abort/error. Prepare Blob/ArrayBuffer data before starting the transaction; never await unrelated promises within it.
- Serialize session save/clear/mark mutations through one queue whose failures do not poison subsequent operations. Clone lightweight settings/reference metadata at scheduling time. A clear must wait for prior saves and make their writes obsolete before resolving. Generate collision-resistant snapshot IDs (not timestamp alone).
- Use a lossless explicit binary Float32 audio payload with header/version/dimensions or another proven lossless representation. Introduce encode/decode functions shared by session and library. Preserve every finite Float32 sample exactly, original sampleRate/channels/length and source metadata; avoid decimal JSON channel arrays and avoid decoding through a device-rate AudioContext for the new representation. Validate dimensions/payload before allocation and reject malformed/truncated input. Legacy raw audio and JSON session payloads and existing library WAV blobs must remain readable. Preserve source File when available; reconstructed files must be nonempty and honestly typed.
- Restore complete editable state in ONE reducer action after every required sample decodes successfully. Session includes importedDrumPreset/importedMultisamplePreset/midiNoteMapping and existing settings. Library load restores only its intended instrument mode, retaining the other mode, with all advanced settings, zero-valued loop endpoints and unassigned samples intact. Use shared defaultSettings rather than incomplete local defaults. Do not clear current session or current editor before a load is validated.
- Add `sessionSaveStatus` (checking/idle/saving/saved/error) and error/last-saved metadata to shared state or a narrowly-owned hook context. Autosave waits for startup check resolution AND any restoration decision. Surface a visible accessible save failure with retry; minimally integrate in App or a small status component if necessary (coordinate controller; no broad redesign). Maintain errors until retry/success. Save status notifications must not retrigger the musical-state autosave dependency.
- Remove arbitrary 12-hour expiration of recovery. Preserve a recoverable session until user restores/discards it. Failed restore must preserve source and stay actionable; do not silently filter away lost samples and announce success.
- Recovery dialog Escape currently invokes Start new and deletes saved work. Ignore Escape until an explicit restore/start-new choice; only explicit Start new discards. Include SessionRestorationModal.tsx in scope for this bounded correction and pending/error button state.
- Copy the library array before sorting.

## Required independent expected tests
A. Commit old session with a sample, force new transaction failure after a write request, then read old session and exact sample bytes: they remain complete. Successful replacement removes obsolete sample rows and references only new rows.
B. Schedule save A, save B with controlled delays then clear; final state is cleared. Queue survives failure and subsequent C saves successfully; slow A cannot overwrite newer B.
C. New-format audio round-trip of two channels and precision-sensitive values e.g. Math.fround(0.12345678), 1.25, -0.00000013; exact Float32 equality, sample rate 48000, full length. Reject truncation and impossible dimensions. Read legacy fixtures.
D. Save and restore drum slot 5 with slot 0 empty, an unassigned sample beyond 24, isFloat/source metadata, imported fx. Restore multisample zero loopStart, both envelopes, transpose, portamento, format/rename options. Assert actual restored user-facing state.
E. Delay startup read beyond autosave debounce; no save until decision. Older-than-12h session prompts restore. Save failure changes observable status; retry can recover.
F. A broken library sample leaves existing project intact and reports failure. Successful library reload yields same instrument settings/audio, does not overwrite other mode.

## Validation and report
Focused regressions then full unit suite and build. Controller will add real browser persistence checks. Write docs/verification/task-2-report.md with RED/GREEN evidence, current public interfaces for project backup/history work, migration behavior and remaining concerns. No assumptions of hardware proof.

## Controller browser evidence already present
- tests/e2e/recovery-integrity.spec.ts covers true IndexedDB write failure and exact Float32 library round trip. Both fail as intended on baseline; log /tmp/opstudio-recovery-red2.log.
- tests/e2e/export-workflow.spec.ts additionally has real chooser→autosave→age timestamp two days→reload→restore→export test, baseline fails missing restore prompt (/tmp/opstudio-recovery-workflow-red.log).
- Same file has fault-injected actual autosave with a visible Retry save button required, then verifies committed preset name after retry (/tmp/opstudio-autosave-retry-red.log). Give the retry control an accessible name containing Retry save (or Save retry) so its purpose is explicit.
- Controller owns these files and runs browsers. Request updates if an intentionally replaced storage API requires adaptations; avoid a fake compatibility shim just for tests.
