# Task 3 — reversible editing and portable projects

Status: review round 2 implementation complete; unit, production-build and focused browser gates pass. Independent reassessment is pending. No commit or push.

## Changes

- `src/utils/projectHistory.ts` selects only musical project state: both instrument settings, samples, imported presets and MIDI-note mapping. UI tab/selection, notifications, playback and session-save state stay live across undo and redo.
- History retains immutable `AudioBuffer` and `File` references while cloning editable metadata. It keeps at most 100 snapshots and 128 MiB of unique assets beyond the current project. Current, past, future and active-gesture baseline references all participate in the byte bound; evicted redo assets cannot return through gesture cancellation.
- `useProjectHistory()` exposes `canUndo`, `canRedo`, `historyLimited`, `beginEdit(token)`, `endEdit(token)` and `cancelEdit(token)`. `BATCH_EDIT` applies compound changes as one undo entry. Reusing an active token is idempotent; beginning a different token settles the prior gesture and starts a distinct one. A mismatched end/cancel is ignored.
- `RESTORE_SESSION` starts a fresh history after startup recovery. `IMPORT_PROJECT`, library restoration, sample loading/replacement/deletion/assignment, preset import and setting/sample edits are musical actions. New edits clear redo and no-op/UI actions do not add history.
- Global shortcuts support Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y. A shared ownership guard covers repeats, IME composition, modifiers, editable controls and open modal dialogs for project, drum, multisample and waveform-preview shortcuts. Multisample key-down records the started note by physical key identity, so key-up releases that note after focus, octave or assignment changes.
- Production compound operations use `BATCH_EDIT`: drum preset import/reset, both tools' audio/full reset paths, multisample clear-all, multisample advanced save and drum bulk edit. Existing direct-edit Carbon sliders use `useProjectEditGesture`; pointer-down or an adjusting arrow key captures a baseline, release/key-up/blur ends it, and unmount cancels an unfinished gesture. Controlled prop synchronization changes values without opening a gesture.
- `src/utils/projectArchive.ts` writes a v1 `.opstudio` ZIP containing `manifest.json`, lossless Task 2 `.opfloat` audio members and available original source bytes. The manifest keeps current codec dimensions separate from original sample provenance, so a decoded/resampled buffer can retain its original sample rate, channel count, duration and source file metadata.
- Project import completes ZIP, schema, reference, settings, source, audio-header, finite-sample and marker validation before returning a restored project. The toolbar dispatches one `IMPORT_PROJECT` action only after that completes. Errors are contextual and leave current work unchanged.
- `ProjectToolbar` provides the exact `Download project`, `Open project`, `Undo` and `Redo` controls with a short explanation separating editable project backup from instrument device-patch export. Download names are sanitized deterministically from the click-time instrument preset name.

## Archive v1 contract and limits

- Format marker: `op-patchstudio-project`; schema version: `1`; manifest member: `manifest.json`.
- ZIP v1 is STORE-only. Import rejects DEFLATE and all other methods, encrypted entries, data descriptors, ZIP64, multi-disk archives, dishonest central/local sizes or CRC fields, invalid UTF-8 paths, absolute/traversal/backslash paths and exact or case-folded duplicate names before JSZip loads the archive.
- Archive and total declared uncompressed size: 256 MiB. Manifest: 2 MiB. Individual entry: 128 MiB. Samples: 256. Drum slot index: 0–511. ZIP entries: 520.
- Editable format settings accept only the live choices: sample rate `0/11025/22050/44100`, bit depth `0/8/12/16/24` and channels `0/1/2`. Zero is the app's explicit “original” sentinel, not an absent value.
- Aggregate decoded-audio allocation: 128 MiB. Every project reference contributes its audio member's declared/validated byte size, including repeated sample IDs or distinct sample records that share one archive member. Extraction itself is cached by path.
- Every non-directory member must be declared. Every declared asset and sample ID must be present and referenced. Audio uses Task 2's exact `OPAS` v1 header and planar little-endian Float32 data; dimensions and all samples are checked before `AudioBuffer` allocation.
- The human-readable schema fixture is `docs/verification/fixtures/project-v1-manifest.json`. This first archive release has no pre-v1 portable-project files. Import supports v1 only; a future migration must add an explicit version branch and fixture rather than silently accepting unknown shapes. Task 2 IndexedDB byte envelopes are never written into the archive.

## RED evidence

- Inherited history RED, `/tmp/opstudio-task3-history-red.log`: 4/4 real-context cases failed before undo/history integration.
- Inherited history GREEN, `/tmp/opstudio-task3-history-green.log`: the first 4 history cases passed. This was treated as a partial handoff, not completion.
- Resume history RED, `/tmp/opstudio-task3-history-resume-red.log`: the active gesture failed to mark history limited because its saved redo references were omitted from the 128 MiB accounting. That allowed cancellation to resurrect unaccounted assets.
- Archive RED, `/tmp/opstudio-task3-archive-red.log`: the archive module did not exist. Subsequent progress runs exposed unsupported test-environment Blob handling, undefined optional JSON fields and positional `AudioBuffer` construction before the final real-ZIP cases passed.
- Keyboard RED, `/tmp/opstudio-task3-keyboard-red.log`: the project shortcut component did not exist; the real multisample keyboard test also exposed its pre-existing key-up focus guard.
- Toolbar RED, `/tmp/opstudio-task3-toolbar-red.log`: the reusable toolbar did not exist.
- Controller RED supplied before implementation: `/tmp/opstudio-project-backup-red.log` timed out waiting for `Download project`; `/tmp/opstudio-keyboard-undo-red.log` showed Ctrl+Z did not remove the latest loaded sample.
- Live original-format RED, `/tmp/opstudio-task3-original-sentinel-red.log`: a real archive with both instruments set to the app's `0 = original` format choice failed with `Invalid drum sample rate`.
- Review round 1 keyboard RED, `/tmp/opstudio-task3-round1-keyboard-red.log`: held A released note 84 after an octave change instead of its captured note 72; select/dialog/repeat/IME ownership was incomplete; the real confirmation modal exposed no dialog role.
- Review round 2 Carbon RED, `/tmp/opstudio-task3-round2-carbon-red.log`: the installed Carbon Slider reproduced both remaining lifecycle failures. Programmatic import followed by a separate playmode edit and settings unmount restored the imported playmode and discarded the later edit; undo during an active slider left the expected baseline unrestored. The same run showed that the confirmation dialog described its heading instead of its message.

## GREEN evidence

- History resume: `npm test -- src/test/context/projectHistory.test.tsx` — 6/6 passed (`/tmp/opstudio-task3-history-resume-green.log`).
- Archive: `npm test -- src/test/utils/projectArchive.test.ts` — 10/10 passed after the original-format regression (`/tmp/opstudio-task3-original-sentinel-green.log`; earlier nine-case gate `/tmp/opstudio-task3-archive-final-green.log`). It uses actual ZIPs and independently asserted Float32 values, source bytes/provenance, sparse/overflow identity, both envelopes, zero loop endpoints, unknown imported settings, 44.1 kHz current audio with 48 kHz source provenance and zero-format sentinels for both modes. Invalid version/settings/references/dimensions, missing/truncated/malformed/nonfinite audio, traversal, duplicate/extra entries, dishonest size declarations and repeated-reference allocation amplification reject.
- Keyboard: `npm test -- src/test/components/ProjectKeyboardShortcuts.test.tsx src/test/components/VirtualMidiKeyboardShortcuts.test.tsx` — 3/3 passed (`/tmp/opstudio-task3-keyboard-green.log`).
- Toolbar: `npm test -- src/test/components/ProjectToolbar.test.tsx` — 3/3 passed (`/tmp/opstudio-task3-toolbar-green.log`).
- Combined Task 3 focus: 5 files and 21/21 tests passed (`/tmp/opstudio-task3-focused.log`).
- Final full unit suite: `npm test` — 44 files and 511/511 tests passed (`/tmp/opstudio-task3-final-unit.log`). Existing intentional error-path logs and React `act(...)` warnings remain.
- Final production build: `npm run build` — exit 0 (`/tmp/opstudio-task3-build-after-sentinel.log`). Existing Sass deprecation, stale Browserslist, dynamic-import and bundle-size warnings remain.
- `git diff --check` — exit 0 after removing two inherited end-of-file whitespace findings touched by the keyboard fix.

### Independent review round 1

- Finding 1, production grouping: resolved with atomic batches in preset import/reset, bulk save, advanced save, audio reset, full reset and clear-all handlers. Drum and multisample preset sliders plus normalization/gain sliders use explicit begin/end gestures. `ProjectEditingHistory.test.tsx` drives the real drum preset and bulk handlers: import, reset and two-sample bulk edits each undo completely; repeated slider changes collapse into one step and two releases remain two steps.
- Finding 2, physical note release: resolved with a physical-key-to-started-note map. The regression holds A at note 72, changes octave with X, moves focus and releases A; only note 72 is released.
- Finding 3, musical ownership: resolved with `keyboardOwnership.ts` shared by project undo, drum keyboard, multisample keyboard and WaveformZoomModal P. Real handlers now ignore select/editable targets, dialogs, composition, repeats and modified presses. Key-up cleanup checks recorded ownership instead of re-running key-down guards.
- Finding 4, confirmation ownership: resolved by giving `ConfirmationModal` `role="dialog"`, `aria-modal`, labelled heading and described message semantics. The real modal integration test confirms Ctrl+Z cannot undo underneath its focused OK button.
- Focused round 1: 7 files and 30/30 tests passed (`/tmp/opstudio-task3-round1-focused.log`). Waveform preview passed 1/1 (`/tmp/opstudio-task3-round1-waveform-green.log`); production tool handler compatibility passed 24/24 (`/tmp/opstudio-task3-round1-tool-tests.log`).
- Full round 1 unit suite: `npm test` — 46 files and 518/518 tests passed (`/tmp/opstudio-task3-round1-full-unit-green.log`). Existing intentional error-path logs and React `act(...)` warnings remain.
- Round 1 production build: `npm run build` — exit 0 (`/tmp/opstudio-task3-round1-build-green.log`). The same existing build warnings remain. `git diff --check` exits 0.
- `tests/e2e/export-workflow.spec.ts` now drives an actual drum preset import, checks all imported fields, verifies Ctrl+Z is blocked while the real reset confirmation is open, then proves one toolbar Undo restores every imported field.
- The controller's broad round 1 run passed all 60 existing scenarios. Its five new-scenario failures all stopped at an exact accessible-name locator for `reset settings`; the captured DOM showed Carbon's icon prefix in the name and the preceding imported-value assertions had passed (`/tmp/opstudio-task3-round1-browser.log`). After scoping the locator to `/reset settings$/`, the new scenario passed 5/5 across Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari in 5.7 seconds (`/tmp/opstudio-task3-round1-browser-focused.log`). All 65 scenarios are therefore covered across those two runs; there was no single 65/65 invocation.

### Independent re-review round 2

- The remaining Carbon lifecycle finding is resolved by starting groups from genuine interaction boundaries: pointer-down capture or an adjusting arrow-key capture. `onChange` now only applies the current value, so Carbon's controlled-prop callback cannot create a phantom group during import, reset or undo. `begin` always reasserts the token with the reducer, which repairs hook ownership after undo has settled a still-active gesture; same-token reducer handling keeps repeated key events idempotent.
- `ProjectCarbonSliderHistory.test.tsx` uses the installed Carbon Slider without replacing it. It proves that import synchronization cannot absorb and cancel a later playmode edit on unmount, and that two multi-change keyboard slider gestures after undo each consume exactly one history step. The dialog regression now asserts that its accessible description is the action message.
- Focused round 2: 6 files and 33/33 tests passed (`/tmp/opstudio-task3-round2-focused-green.log`). The real-Carbon and dialog subset passed 8/8 (`/tmp/opstudio-task3-round2-carbon-green-attempt.log`).
- The first full round 2 run passed 519/520; an unrelated existing `LibraryPage` selection test raced before its checkboxes rendered. Its isolated rerun passed 1/1 (`/tmp/opstudio-task3-round2-library-rerun.log`), and the complete rerun passed 47 files and 520/520 tests (`/tmp/opstudio-task3-round2-full-unit-rerun-green.log`). Existing intentional error-path logs and React `act(...)` warnings remain.
- Round 2 production build: `npm run build` — exit 0 (`/tmp/opstudio-task3-round2-build-green.log`). Existing Sass, stale Browserslist, dynamic-import and bundle-size warnings remain.
- The existing grouped preset-import Undo and real-confirmation shortcut browser scenario passed 5/5 across Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari after the Carbon fix (`/tmp/opstudio-task3-round2-browser-focused.log`). This was a focused regression run, not a repeat of the broader 65-scenario split coverage.
- The pre-round source snapshot is `/tmp/opstudio-task3-before-round2/src`.

## Browser acceptance before independent review round 1

- Stable controller matrix: 55/60 passed across Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari (`/tmp/opstudio-task3-browser-stable.log`). The same five portable-backup cases exposed the valid `0 = original` sentinel rejection; the result is regression evidence, not a passing full matrix.
- After the localized sentinel fix, portable backup passed in Chromium, WebKit, Mobile Chrome and Mobile Safari (4/5). Firefox successfully opened the archive but the test had taken its snapshot before the first asynchronous audio load completed.
- The portable test now waits for visible `1 sample loaded` state before download. The Firefox-only rerun passed 1/1 in 3.0 seconds (`/tmp/opstudio-task3-portable-firefox.log`). Thus all 60 controller scenarios passed against the final behavior across the stable and localized reruns; there was no single 60/60 invocation.
- Browser coverage exercised project download/open/undo/redo with sparse pad identity and actual device-export ZIP output, keyboard undo/redo without bank switching, malformed `.opstudio` preservation with a scoped toolbar error, durable settings recovery and the existing export/storage matrix. The review round 1 split run additionally exercises grouped preset-import Undo and real-confirmation shortcut ownership in all five profiles.

## Ownership and known limits

- Task 2 owns `storedAudio.ts` and `projectSerialization.ts`; their public Blob APIs and private IndexedDB envelope remain unchanged. Task 3 owns history, archive validation, shortcut routing and the small reusable toolbar.
- Task 4 may add optional per-sample crossfade provenance (`fraction`, `importedRaw`, `importedFramecount`) through an explicit v1-compatible manifest-validator extension. Task 3 adds no audio behavior.
- Audio buffers are treated as immutable assets. Processing code must replace a buffer rather than mutate it, because history and Task 2's codec cache intentionally share identities.
- Archive loading is in-memory and therefore bounded but not streaming. File download/open behavior depends on browser File/Blob/download support. Browser automation is not physical Safari or OP-XY hardware proof, and no hardware behavior is claimed.
