# Task 1 report: reliable export

## Scope and baseline

- Worktree: `/Users/stevencommander/Desktop/AI/op-patchstudio-improved`
- Branch/baseline: `codex/studio-upgrade` at `b669b7c`
- Baseline supplied by controller: 435 Vitest tests passing.
- Scope observed: export utilities and export tests only. No UI, storage, context, controller-owned Playwright files, commit, push, merge, or publication changes.

## Files changed

- `src/utils/patchGeneration.ts`
  - Plans every loaded audio filename once before region construction or ZIP insertion.
  - Maps drum regions from the assigned slot (`53 + assignedKey`) instead of a dense counter.
  - Awaits conversion and audio export before ZIP creation; any sample failure rejects the complete generation call with sample context.
  - Derives region frame counts and marker bounds from the actual buffer passed to the audio exporter.
  - Keeps drum and multisample gain in patch metadata and does not render the same gain into PCM.
  - Preserves loaded unassigned drum audio without creating regions for it.
  - Reads imported presets from the declared `AppState` keys.
- `src/utils/exportPlanning.ts` (new)
  - Deterministic, input-order, case-insensitive collision allocation using `-2`, `-3`, and so on before the extension.
  - Archive preflight that rejects a patch plan when a region references absent audio.
- `src/utils/jsonImport.ts`
  - Returns `importedDrumPreset` and `importedMultisamplePreset`, matching `AppState` and reducer names.
- `src/test/utils/exportIntegrity.test.ts` (new)
  - Uses real JSZip generation/loading and production WAV/AIFF exporters.
  - Uses a narrow conversion double only for injected conversion failure, output-length, sample-rate, and gain-baking boundaries.
- `src/test/utils/patchGeneration.test.ts`
  - Updates the legacy JSZip double expectation from unresolved `Promise` entries to awaited `Blob` entries.

## RED evidence

Initial focused run against baseline production code:

`npx vitest --run src/test/utils/exportIntegrity.test.ts`

- Result: 1 passed, 9 failed.
- Sparse drum pads 0 and 5 produced MIDI `[53, 54]`, expected `[53, 58]`.
- Two `hit.wav` inputs produced two `hit.wav` references and one overwritten ZIP member.
- Sanitization/extension collisions yielded only two case-insensitive names for four samples.
- A colliding unassigned `hit.wav` was overwritten instead of retained.
- Injected conversion failure logged and resolved a ZIP instead of rejecting.
- A 7-frame converted WAV was described as 10 frames, with markers `7..10` instead of clamped `6..7`.
- +6 dB was rendered into PCM (about `0.499`) while the region also retained gain `6`; expected unbaked PCM about `0.25`.
- `importedDrumPreset.fx.active` was lost.
- JSON import returned the undeclared `importedDrumPresetJson` key.

Review-edge RED run:

`npx vitest --run src/test/utils/exportIntegrity.test.ts`

- Result: 10 passed, 2 failed.
- A decoded 48 kHz buffer with stale 44.1 kHz source metadata bypassed requested 44.1 kHz conversion and exported a 48 kHz WAV.
- Accepted extensionless names exported as `808` and an empty member instead of `808.wav` and `sample.wav`.

## GREEN evidence

- Focused real-archive suite: `npx vitest --run src/test/utils/exportIntegrity.test.ts` — 13/13 passed.
- Affected export suites: `npx vitest --run src/test/utils/patchGeneration.test.ts src/test/utils/drumStartPoints.test.ts src/test/utils/exportIntegrity.test.ts` — 19/19 passed at the first compatibility gate; the expanded integrity suite subsequently passed 13/13 and the final full run covered all 22 export tests.
- TypeScript: `npx tsc -b --pretty false` — exit 0 after the review-edge fixes.
- Earlier full unit run: `npm test` — 35/35 files, 445/445 tests passed before the final three focused cases were added. A fresh expanded full-suite result is recorded below before handoff.
- Earlier production build: `npm run build` — exit 0; existing Sass deprecation, bundle-size, dynamic-import, and stale Browserslist warnings remained.

## Contract decisions

- MIDI mapping is a direct slot contract: pad 0 is note 53 and pad 5 is note 58. Sorting changes region order only; it does not compress holes.
- Filename allocation occurs after sanitization and target-extension selection. Comparisons are case-insensitive because exported archives may be copied to case-insensitive filesystems. Extensionless or fully stripped accepted names receive the target extension and a `sample` fallback.
- Every loaded drum sample participates in allocation and ZIP writing, including unassigned samples. Only assigned samples receive regions.
- Region frame counts use `AudioBuffer.length` from the exact buffer given to the WAV/AIFF exporter. Sample and loop markers are recalculated in seconds at that buffer's actual sample rate and clamped to a nonempty range within its length.
- Requested sample-rate conversion compares the target with `audioBuffer.sampleRate`, not potentially stale file metadata.
- Existing patch JSON already carries drum and multisample gain, and legacy tests explicitly characterize drum region gain. To avoid applying gain twice, gain remains metadata and is omitted from conversion options and conversion triggers. Preview gain behavior was not changed.
- No OP-XY hardware-only contract was invented. WAV/AIFF container signatures, encoded frame counts, ZIP membership, references, and metadata consistency are verified locally.

## Review and remaining concerns

- Scoped review found no new explicit `any` in the new integrity tests or export planner; exporter section types were narrowed to `Record<string, unknown>`.
- Scoped ESLint still reports existing explicit-`any`/unused-catch findings in legacy `jsonImport.ts` and `patchGeneration.test.ts`. The Task 1 edits do not add new instances; broad lint cleanup is outside this export-only task.
- Existing full-suite console output includes intentional error-path logs, React `act(...)` warnings, and skipped legacy Blob inspections. The new integrity suite performs real Blob/ZIP/header inspection and does not rely on those skips.
- The underlying WAV/AIFF writers' established sampler-marker offset convention was preserved. Hardware acceptance remains unverified until tested on an OP-XY.
- Controller-owned real-browser export tests passed 10/10 across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari (`/tmp/opstudio-export-green2.log`). They cover browser import/download with sparse pad mapping and duplicate filenames against actual ZIP output.

## Final fresh verification

- `npm test` — exit 0; 35/35 files and 448/448 tests passed, including 13 real-archive integrity tests.
- `npm run build` — exit 0; TypeScript and the production Vite/PWA build completed. Only the existing dependency deprecation, bundle-size, dynamic-import, and stale Browserslist warnings were emitted.
- Controller browser evidence — 10/10 passed across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari (`/tmp/opstudio-export-green2.log`).
- `git diff --check` — exit 0.
- Final status inspection showed only Task 1 files plus controller-owned `.gitignore`, `vite.config.ts`, `playwright.config.ts`, `tests/`, and shared `docs/` work. No controller-owned source was edited by this task.

## Review fix round 1

### Findings addressed

- Scalar `octave` values are assigned as scalars after object-section merging. Positive, negative, and zero values now survive both drum and multisample generation; zero no longer disappears behind a truthiness check.
- Multisample import is one reducer action that stores the complete source preset and hydrates all editable engine and amp/filter envelope fields. The live import handler dispatches that action. Later UI edits update editable state without replacing the source preset with a reduced synthetic object.
- Multisample `playmode` is now included in the state overlay, so editable state is authoritative when it conflicts with imported data.
- Untouched imported percentage-backed engine values retain their exact raw integer representation. The exporter recognizes the rounded UI value produced by import hydration and leaves the imported integer intact; a later meaningful UI percentage change is encoded and overrides it.
- State overlays merge supported envelope values into imported amp/filter objects. Unknown engine, FX, and nested envelope fields remain in the exported patch after supported edits.
- `deepMerge` now visits own enumerable keys only and skips `__proto__`, `constructor`, and `prototype` at every depth. Ordinary unknown fields are still retained.

### Files changed in this round

- `src/utils/valueConversions.ts`
  - Hardened recursive object merging against prototype mutation keys.
- `src/utils/jsonImport.ts`
  - Added typed multisample hydration, atomic-import support, and scalar octave handling.
- `src/context/AppContext.tsx`
  - Added the atomic `IMPORT_MULTISAMPLE_PRESET` reducer action.
- `src/components/multisample/MultisamplePresetSettings.tsx`
  - Switched the live file import to the atomic action and stopped replacing complete imports during later setting/envelope edits.
- `src/utils/patchGeneration.ts`
  - Added playmode authority, exact imported percentage preservation, and unknown nested envelope preservation.
- `src/test/utils/exportIntegrity.test.ts`
  - Added real ZIP import/export coverage for octave values, immediate hydration/export, later edits, exact raw percentage values, playmode authority, atomic reducer import, and unknown-field preservation.
- `src/test/components/MultisamplePresetSettings.test.tsx`
  - Added the live hidden-file-input action regression with a minimal import-function double.
- `src/test/utils/valueConversions.test.ts`
  - Added prototype-pollution coverage for all three blocked keys at multiple depths while checking a normal custom field is retained.

### RED evidence

- Corrected export regression run before implementation: `npx vitest --run src/test/utils/exportIntegrity.test.ts` — 9 failed, 15 passed. Failures covered scalar octave corruption/zero assignment, missing import hydration, import-then-edit envelope loss, the absent atomic reducer action, and missing playmode authority.
- Initial combined run before implementation: `npx vitest --run src/test/utils/exportIntegrity.test.ts src/test/components/MultisamplePresetSettings.test.tsx src/test/utils/valueConversions.test.ts` — 9 failed, 34 passed. In addition to the then-current export failures, the live component dispatched `SET_IMPORTED_MULTISAMPLE_PRESET` and a parsed `__proto__` key polluted fresh objects.
- Unknown nested envelope preservation: `npx vitest --run src/test/utils/exportIntegrity.test.ts -t "later multisample edits"` — 1 failed, 23 skipped; `vendor.curve` disappeared after the supported attack edit.
- Exact raw percentage preservation: `npx vitest --run src/test/utils/exportIntegrity.test.ts -t "immediate import to export"` — 1 failed, 23 skipped; imported `engine.volume: 12345` exported as the rounded/re-encoded `12451`.
- Controller browser RED before implementation: `/tmp/opstudio-import-settings-red3.log` — the actual upload/import/download flow exported `octave: {}`, transpose `0` instead of `12`, and default amp-envelope values instead of `123/456/789/1000`.

### GREEN evidence

- Focused review suite: `npx vitest --run src/test/utils/exportIntegrity.test.ts src/test/components/MultisamplePresetSettings.test.tsx src/test/utils/valueConversions.test.ts` — 3/3 files and 44/44 tests passed.
- Affected compatibility suites: `npx vitest --run src/test/utils/exportIntegrity.test.ts src/test/components/MultisamplePresetSettings.test.tsx src/test/context/AppContext.test.ts src/test/utils/valueConversions.test.ts src/test/utils/patchGeneration.test.ts src/test/utils/drumStartPoints.test.ts src/test/hooks/usePatchGeneration.test.ts` — 7/7 files and 78/78 tests passed. Console output was limited to the hook suite's intentional error-path logging.
- TypeScript: `npx tsc -b --pretty false` — exit 0.
- Diff hygiene: `git diff --check` — exit 0.
- Controller-selected Task 1 browser flows: 15/15 passed across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari (`/tmp/opstudio-task1-round1-browser.log`). The run selected sparse/empty-kit export, duplicate-name export, and imported multisample settings; unrelated Task 2 recovery regressions were outside this result.

### Decisions and concerns

- Import hydration converts only supported editable fields. The complete parsed preset remains the source for unknown fields; export applies supported state over that source.
- Exact raw percentage preservation uses equality with the UI value produced by `internalToPercent`. A changed displayed percentage is treated as an edit and encoded with `percentToInternal`.
- Portamento hydration mirrors the active exporter's existing encoding so imported values round trip; no new hardware contract was asserted.
- Dangerous merge keys are not treated as preservable custom hardware settings. They remain inert in the stored parsed object and are never copied into generated base objects by `deepMerge`.
- No inactive legacy advanced-settings component, storage implementation, or controller-owned Playwright/configuration file was changed in this round.
