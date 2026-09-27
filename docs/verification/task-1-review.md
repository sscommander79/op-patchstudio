# Task 1 independent review

Reviewed 2026-09-04 in `/Users/stevencommander/Desktop/AI/op-patchstudio-improved`, against baseline `b669b7c57937bb74b887774a9ca73b5d4a81afed`. Scope: Task 1 brief, design requirement 1, the export/import utilities and affected tests; callers inspected read-only. No source changes or commits.

## Verdict

**Specification: changes required.** Sparse drum mapping, unique archive allocation, conversion failure propagation, converted frame counts, and single-application gain are implemented and covered by meaningful archive checks. Imported settings preservation remains incomplete in the reproducible cases below.

**Code quality: changes required for the imported-settings path; otherwise no actionable defect found in the scoped export rewrite.** Planning each output name once and awaiting all audio before constructing the archive are clear improvements. The findings are inherited defects exposed by the requirement, not regressions falsely attributed to the rewrite.

## Findings

### P2 — Preserve scalar octave values when merging imported presets

Locations: `src/utils/jsonImport.ts:122-125` and `src/utils/jsonImport.ts:137-140`; invoked by `src/utils/patchGeneration.ts:304` and `src/utils/patchGeneration.ts:359`.

Both merge helpers include `octave` in an object-only merge loop. The base presets contain `octave: 0`; importing `octave: 3` replaces the falsy base value with `{}`, then calls `deepMerge({}, 3)`, which copies no keys. Both exported manifests therefore contain `"octave": {}` instead of `3`. Imported zero values are also skipped by the truthiness check. This changes a numeric preset field into an object and violates imported-settings preservation.

Reproduction, verified against the actual modules and JSZip: create a valid export state with `importedDrumPreset: { octave: 3 }`, call `generateDrumPatch`, load the returned ZIP and parse `patch.json`; `patch.octave` is `{}`. Repeat with `importedMultisamplePreset` and `generateMultisamplePatch`: same result. The same outcome occurs with audio loaded because the merge happens before audio planning. No hardware interpretation is needed to demonstrate the type corruption.

Fix: handle scalar fields by assignment with an explicit presence/type check; merge only object sections. Add round-trip checks for positive, negative, and zero octave values for both preset types.

### P2 — Apply imported multisample settings to editable state before export overlays it

Locations: `src/utils/patchGeneration.ts:359-360` and `src/utils/patchGeneration.ts:185-200`; supporting import gap at `src/utils/jsonImport.ts:94-107`, and the live UI path `src/components/multisample/MultisamplePresetSettings.tsx:188-193`.

Multisample import stores the raw preset but leaves editable engine/envelope settings unchanged. Export merges the imported preset and immediately calls `applyMultisampleSettings`, overwriting its transpose, velocity, volume, width, highpass, portamento, tuning root, and envelope values with those unchanged settings. The live file-import handler also only dispatches `SET_IMPORTED_MULTISAMPLE_PRESET`, so this is reachable through ordinary import/export, not only through a utility caller.

Reproduction, verified with real generated ZIP manifests: use current multisample settings `transpose: 0` and amp envelope `{attack:0, decay:0, sustain:0, release:0}`; import `{engine:{transpose:12}, envelope:{amp:{attack:123, decay:456, sustain:789, release:12}}}` and immediately export. The manifest contains `engine.transpose: 0` and the all-zero amp envelope. Expected: the imported `12` and envelope values survive until the user edits them. A direct `importMultisamplePresetJson` probe likewise returned unchanged editable settings alongside the stored raw preset.

Fix: hydrate supported editable settings from the imported preset on the actual import path, preserving raw values for uninterpreted fields. Preserve the intended precedence: subsequent user edits must override imports. Add an import → export round trip and an import → edit → export case. Correcting the unused utility alone will not repair the live UI path.

### P2 — Export multisample playmode from the selected editable settings

Location: `src/utils/patchGeneration.ts:185-195`; concrete caller: `src/components/library/LibraryPage.tsx:557-569`.

`applyMultisampleSettings` copies other engine settings but omits `settings.playmode`. With `multisampleSettings.playmode: 'legato'` and no imported preset, `generateMultisamplePatch` writes the base `engine.playmode: 'poly'`. A real ZIP probe confirmed this exact output. A saved preset exported from Library is a concrete entry point: the caller replaces `multisampleSettings` with saved values while inheriting the current session's imported preset. Its saved mono/legato mode therefore becomes the base mode or another session's imported mode. The main settings editor masks the omission during immediate editing because it writes playmode into both editable state and a synthetic imported preset.

Fix: apply the selected multisample playmode alongside the other editable engine fields. Verify both an export without imported metadata and a saved-settings export with conflicting imported playmode. This should follow the import hydration fix above so a just-imported mode first becomes the editable mode.

The separate legacy `MultisampleAdvancedSettings.tsx` component has no active imports/callers; its similar handling is not an additional finding.

## Verification and accepted behavior

Independently ran:

- `npx vitest --run src/test/utils/exportIntegrity.test.ts src/test/utils/patchGeneration.test.ts src/test/utils/drumStartPoints.test.ts`: **3 files, 22 tests passed**.
- `git diff --check`: exit 0.
- Read-only Vite module probes plus actual `generateDrumPatch`/`generateMultisamplePatch` ZIP generation and JSZip loading: confirmed scalar corruption, multisample setting loss, and the playmode omission. The probes used no audio to isolate manifest merging; the scalar merge also failed directly for both helpers.

Reviewed implementer evidence: full suite **448/448**, production build success, and controller browser exports **10/10** across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari (`/tmp/opstudio-export-green2.log`). Those broader checks were reported by their owners, not rerun by this reviewer.

Confirmed from source and focused tests:

- Assigned drum slot `n` exports note `53 + n`; sparse slots remain sparse.
- All loaded drum samples, including unassigned audio, share deterministic case-insensitive name allocation after sanitization and target-extension selection. Archive insertion and region references use those same names.
- Conversion/export promises are awaited; rejection prevents a completed ZIP from reaching the download caller.
- Region frame counts and clamped sample markers use the exported AudioBuffer's length/rate.
- Gain remains in patch metadata and is omitted from audio conversion, avoiding the former double application.
- Imported drum `fx.active` survives, as its dedicated archive test verifies.

## Explicit follow-up outside this scoped review

The inherited WAV sampler-marker start underflow, AIFF endpoint convention, and inconsistent drum/multisample container endpoint inputs are documented in `docs/verification/audio-contract-research.md` and assigned by the controller to Task 4. No newly introduced writer-offset regression was identified here. They still prevent describing all container marker boundaries as verified correct; Task 4 must close them with byte-level endpoint fixtures. OP-XY hardware acceptance remains unverified.

The scoped tests exercise actual ZIP/WAV/AIFF creation but use a conversion double for injected conversion/frame/gain cases. They do not independently establish real resampling or device compatibility. The imported-setting failures above are absent from the current passing suite and should be added before accepting this requirement.
