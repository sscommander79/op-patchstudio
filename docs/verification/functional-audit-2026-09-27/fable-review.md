# Claude Fable 5 review

Model verified from CLI result: `claude-fable-5`. Read-only source review; no tests run by Fable. Coordinator reproduction results are separate.

Review complete. Write access is disabled in this session, so the report is delivered here directly rather than to a plan file.

# OP-PatchStudio Studio-upgrade review — checkpoint dc1e1f3 + uncommitted Create-nav removal

**Review rung: 4 (self-review, declared).** The task confined me to Read/Glob/Grep with delegation forbidden, so no independent reviewer was available; I ran two separately scoped passes (SPEC: routes/contract/tests coherence; STANDARDS: races, guards, persistence, data loss) and am declaring the limitation per the ladder.

**Verdict:** No high-severity product defect found in the inspected scope. The two "known" E2E failures are **test drift, not product defects** — but they silently disable real E2E coverage nothing else replaces. One genuine product inconsistency (unguarded slice-session loss) and two stale-state/route defects were found. This is not a full-system pass claim.

## Findings, prioritized

### 1. Both baseline E2E failures are test drift, and they mask live coverage — MEDIUM, high confidence
- **Where:** `tests/e2e/audio-import.spec.ts:21` (`expectDrumLoaded(page, 9)`) and `tests/e2e/slicing.spec.ts:116` (`expectDrumLoaded(page, 3)`).
- **Drift-vs-defect, from source:**
  - Import: `src/utils/audioImport.ts:44-47` only auto-routes files whose names match exactly one drum category (kick/snare/clap/hat/tom); anything else gets a null destination, which `src/components/common/AudioImportProvider.tsx:45` turns into `'unassigned'`. The failing test's nine fixtures (`original.wav`, `sample.mp3`, …) match no category, so 0 pads load and 9 sounds land in the review tray — by design (organize mode, present at baseline b669b7c). The sibling test at `audio-import.spec.ts:35` passes because the row chooser supplies explicit pad intent (`pad:0`/`pad:1`).
  - Slicing: `src/utils/audioSlicing.ts:494` stores an external slice source with `targetKeyIndex: null`, `finalizeSliceApplication` re-forces that at `:584`, and `:508` explicitly rejects replacing the source pad "because the original source is retained". Explicit slice→pad mappings **are** honored (`:603-613`), so the test's two assigned slices load correctly and the true count is 2, not 3 — the stale expectation counts the source as pad-loaded.
- **Consequence:** everything after each first failing assertion never executes. E2E currently does **not** verify: compressed-format metadata truthfulness through project download → Undo → restore (`audio-import.spec.ts:23-32`), slice provenance round-trip, the 22.05 kHz export framecount math, or slice Undo (`slicing.spec.ts:119-172`) — exactly the workflow guarantees the restoration report's acceptance matrix cites.
- **Smallest fix:** update only the two count assertions to the organize-mode contract (import: assert 0 loaded / 9 unassigned or use category-named fixtures then assign; slicing: expect 2 loaded and assert the source is in the tray). No product code change.

### 2. An edited slice session can be destroyed silently — MEDIUM, high confidence on mechanism
- **Where:** the shell guards at `src/components/common/StudioShell.tsx:133` and `:152` check only `[data-recording-modal="true"]`; `SliceAudioModal` never sets that marker and is mounted inside `DrumTool` (`src/components/drum/DrumTool.tsx:549`).
- **Trigger A (unmount):** in the drum editor, open Slice audio, place marks and pad assignments, press browser **Back**. The popstate guard passes, the view changes, `DrumTool` unmounts, and the session (`sliceRequest` state) is gone. The modal backdrop blocks header clicks, so only history navigation reaches this hole.
- **Trigger B (Escape):** `SliceAudioModal.tsx:115-116` wires Escape/close straight to `cancel()` with no discard confirmation even when `edited` is true. Re-analyze/reset do confirm (`:135`); plain close does not. Cancel-without-confirm is encoded in `slicing.spec.ts:72`, so that half may be intended — the Back/unmount half is not.
- **Consequence:** silent loss of in-progress slice boundaries and assignments (not committed audio). `RecordingModal` and `StemRecordingModal` are protected against exactly this class (`data-recording-modal` + `DiscardConfirmation`); slicing was left out.
- **Smallest fix:** put the guard marker (or a parallel `data-workspace-modal`) on the slice dialog and include it in the shell guard query; optionally confirm discard when `edited`.

### 3. Route/hash desync from bare `SET_TAB` dispatches — LOW-MEDIUM, high confidence
- **Where:** `src/components/common/ProjectToolbar.tsx:129` ("Open library" in the Project menu dispatches `SET_TAB` without touching the hash); same class at `src/context/AppContext.tsx:1465-1466` (pending preset-import apply sets `currentTab` directly).
- **Trigger:** in the drum editor (`#/studio/drum`), Project menu → Open library.
- **Consequence:** content and nav show Library while the URL stays `#/studio/drum`; reload returns to the drum editor, Back does nothing for this transition, and the shell's `routeRef` goes stale. Stale state, not data loss.
- **Smallest fix:** route it through the shell (a window event like the existing `opstudio-open-help`, or update the hash alongside the dispatch).

### 4. Blocked-Back guard pollutes history — LOW, high confidence
`StudioShell.tsx:154` pushes a new entry on every popstate blocked by an open recorder, so each blocked Back press grows the stack and the user needs extra Back presses after closing the recorder. No data risk; fix is optional (`history.forward()` when the delta is one Back).

### 5. Boot tab from cookie, route applied one effect later — LOW, medium confidence
`AppContext.tsx:339-351, 377` seeds `currentTab` from the `LAST_TAB` cookie; `StudioShell.tsx:146-148` applies the route only in a mount effect. A deep link like `#/studio/multisample` with a `library` cookie renders (and starts lazy-loading) the wrong panel for one commit. Cosmetic today; seed the tab from the hash when it names a workspace route.

## Verified sound (inspected, no findings)

- **MIDI transport** (`src/midi/browserSession.ts`): dispatch-point cancellation boundary correct (`cancelSend` refuses after `dispatched`, :493-498), no double-settle, replacement scoped to same output/channel/controller, dispose drains the queue, `enable()` is retryable after rejection.
- **Devices revocation** (`src/components/devices/useDevicesWorkspace.ts:133-145, 355-384`): the route-revision check precedes each Apply message with no `await` between check and `sendCc`, so a revoke can't land in the gap; in-flight sends hold the pre-revoke abort signal; lease and output changes both advance the revision.
- **Session persistence** (`useSessionManagement.ts` + `sessionStorageIndexedDB.ts`): autosave is disabled while the restoration modal is open, and cross-tab overwrites are blocked by optimistic revision tokens at the storage layer — the "changed in another tab" warning is backed by a real write barrier, not just UI copy.
- **Import/slice commits**: project-generation and file/buffer identity checks before commit; the reducer re-verifies every slice landed where intended and rolls back wholesale on mismatch (`AppContext.tsx:986-1020`).
- **Library** (`LibraryPage.tsx:90, 309`): bulk delete/collection ops restricted to `visibleSelection` (hidden-selection safety present) and confirmed.
- **Recorder permission timing:** `RecordingModal` only enumerates devices on open (no prompt); `getUserMedia` sits behind explicit enable — the launch card's "no permission until enabled" claim holds.
- **Create-nav removal:** unit (`StudioShell.test.tsx:29-43`), contract (`studio-design-contract.spec.ts:136-198`, incl. direct `#/studio/create` coverage at :198), and `studio-shell.spec.ts` reload/Back tests are mutually consistent with contract doc §1; no orphaned route or lost keyboard path.

## Coverage gaps

- The drifted specs disable all downstream round-trip E2E coverage (finding 1) — the largest gap.
- Nothing exercises shell navigation (Back/hash) against an open slice or import dialog; guard tests cover only the recording modal.
- The ProjectToolbar "Open library" transition has no route assertion, which is why finding 3 is invisible to a green suite.

## Inspected scope and limitations

Inspected: StudioShell + its tests, MainTabs, ProjectToolbar (partial), AudioImportProvider, `audioImport.ts`, `audioSlicing.ts` prepare/finalize, AppContext commit/restore/tab-init paths, SliceAudioModal and StemRecordingModal guard/close/permission paths, RecordingModal permission timing, useOwnedDialog, useSessionManagement + storage concurrency surface, browserSession (full), useDevicesWorkspace lifecycle, LibraryPage delete/selection safety, both failing E2E specs plus `workspace-actions.ts`, and the four modified test files. Not deeply audited: MultisampleTool editing internals, patchGeneration/export pipeline, WaveformEditor, DrumFocusWorkspace drag/drop (the handoff's two "unconfirmed" UX items remain unconfirmed), binary visual baselines, CI workflow. No tests executed, no hardware or browser used; duplicate `AutoSamplingPanel 2.tsx` and `playwright-report 2/` ignored as instructed.
