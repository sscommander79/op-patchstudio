# Task 7 round 1 independent re-review

Date: 2026-09-04. Reviewer: Astra. Branch: `codex/studio-upgrade`. Baseline: `/tmp/opstudio-task7-before-round1`. Source, tests, and browser definitions were frozen throughout this review.

**Spec verdict: changes required. Quality verdict: changes required.** Seven original findings are closed; R5 and R8 remain partially open with the concrete cases below. No Task 8/9 expansion or additional broad audit is requested.

## Reviewed evidence

Read the complete 1,115-line `task-7-round1-review-package.txt` covering 24 changed source/test/browser files, the round 1 report, and the original nine findings. Inspected the actual settings callers, global import operation, reducer, serializer, archive validators, AIFF parsing, crossfade association, shared provider, and targeted regressions.

Inspected retained logs confirming **739/739 unit tests in 66 files** and production build completion: `/tmp/opstudio-task7-round1-full-unit.log`, `/tmp/opstudio-task7-round1-build.log`. The worker reports **120/120 focused tests**, scoped lint/type checks, and diff checks. The controller reports the localized import browser gate at **23 passed / 2 explicit desktop-only mobile skips** from 25 configured cases in `/tmp/opstudio-task7-round1-browser.log`. That run now includes actual compressed-source backup/reopen and both malformed-settings chooser routes. The full 120-case configured browser matrix was still running at report preparation; its acceptance result remains controller-owned and pending.

Independent bounded probes compiled actual source modules in memory. They verified the original AIFF failure before decoder/allocator invocation, preservation of a file captured before a later directory-reader failure, and zero PCM reads during metadata-only admission. A separate actual preset/crossfade/ZIP probe reproduced the remaining R5 failure. No browser/server, broad suite rerun, implementation/test/config edit, commit, or publication was performed. This report is the only written artifact.

## Remaining Important findings

### R5 remains open — P1: Metadata admission omits the archive's sample-reference validation

Location: `src/utils/projectArchive.ts:265-277`; downstream `validateMultiReference` at `src/utils/projectArchive.ts:199-213`; actual guarded commit at `src/context/AppContext.tsx:1401-1420`.

The new admission path constructs the complete manifest and correctly checks its bytes, keys, depth, and project settings without reading PCM. However, it stops after `encodeManifest` and `validateSettings`. Export/import additionally validate each sample reference, including the crossfade provenance that a settings import can change. Consequently this is not yet equivalent to the archive's metadata contract.

Exact bounded trigger: with one loaded multisample named `match.wav` (mono, 8 frames at 8,000 Hz), import:

```json
{"type":"multisampler","regions":[{"sample":"match.wav","framecount":8,"loop.crossfade":0.5}]}
```

The common preset validator accepts this object. Explicit settings association produces `loopCrossfade: {fraction: 0.0625, importedRaw: 0.5, importedFramecount: 8, sourceIdentity: "match.wav"}`. The guarded reducer builds precisely this candidate and calls the metadata validator. The independent probe observed:

```text
rawPresetAccepted: true
metadataAdmission: accepted
archiveExport: Invalid imported crossfade value
```

Thus a settings import can still be reported successful while making the project impossible to back up. The archive requires integer imported crossfade values, but that check is absent from the precommit metadata path. This fixture requires only an eight-frame buffer and the actual ZIP exporter; no large allocation or browser was used.

Complete the shared metadata-only admission with the same sample/reference/provenance validations that export/import apply, retaining zero PCM reads in the reducer. For incompatible derived provenance, either reject atomically with the musical state/history unchanged or retain the safe uninterpreted raw setting without creating invalid provenance, according to the existing imported-value policy. Do not silently round or destroy the preserved raw JSON. Add an actual guarded settings-commit regression that proves the chosen behavior and that the resulting/current project still exports and reopens. Also retain the accepted near-limit bytes/key/wrapped-depth regressions already added.

### R8 remains open — P2: An occupied explicit destination is silently replaced by a filename proposal while the reason says unassigned

Location: `src/components/common/AudioImportProvider.tsx:32-36`.

The original duplicate reservation case is fixed: explicit free pad 0 is reserved before a subsequent kick suggestion chooses pad 1. But `suggestedAssets` includes every asset lacking an accepted explicit pad, including assets whose explicit request was occupied or already reserved. Those assets then receive ordinary filename proposals even though the row's reason explicitly says they were kept unassigned.

Exact trigger: pad 0 is occupied and pad 1 is free; drop `kick.wav` directly onto pad 0. `requestedPads` contains 0, `explicitPads` contains no entry, and filename planning returns pad 1. The row therefore has destination `pad:1` and reason `chosen drop pad is occupied or already reserved; kept unassigned`. Apply assigns the new file to pad 1 despite the stated disposition. This also contradicts the round report's claim that rejected explicit destinations stay unassigned until the user chooses a destination.

Evidence: actual proposal helper plus the provider's exact selection expressions reproduced `occupiedExplicitPad: 0`, `reviewDestination: 1`, and the unassigned reason. No occupied file is overwritten; the defect is the mismatch between explicit destination handling, visible explanation, and resulting assignment.

Exclude rejected explicit requests from automatic filename assignment and keep their destination unassigned until edited. Add an occupied explicit key/row provider regression that checks both displayed reason and selected destination, then Apply/Undo behavior. Keep the original free-explicit reservation and rejected-file ordinal tests.

## R1–R9 disposition

| Original finding | Round 1 assessment |
| --- | --- |
| R1 desktop row multiple chooser | **Closed.** The actual input calls `onFilesUpload` once; DrumTool sends the complete File array and pad sequence in one provider operation. Component evidence covers the parent callback and controller browser evidence covers the actual desktop input, two review rows, Apply, and Undo. |
| R2 caller prefilters | **Closed.** Production drum intake occurs before legacy checks; multisample Browse forwards every File. The real browser case includes signature-valid `.weird`, empty WAV, and unsupported text with visible reasons. Provider availability is guaranteed by the application root. |
| R3 enumeration partial failure | **Closed.** Both walkers catch enumeration failure separately, walk/sort already captured children, report the directory error, and preserve abort propagation. Tests cover legacy and modern variants. The original legacy source probe now returns `good.wav` plus `later batch denied`. |
| R4 coerced play mode | **Closed.** Validation requires a string before enum membership. Unit and actual browser chooser cases cover the array rejection in both modes. Optional-engine minimal presets and safe raw unknown values remain supported. |
| R5 archive admission | **Partially closed; Important case above remains.** Full manifest byte/key/wrapped-depth bounds now share `encodeManifest` with export and an accepted near-limit round trip is tested. Metadata-only admission was independently observed making zero `getChannelData` calls. It still skips sample-reference validation affected by settings hydration. |
| R6 stale patch-settings reads | **Closed.** Both actual components use one AppContext `importPresetFile` namespace. BEGIN records ownership/generation in reducer order; COMMIT requires the matching latest operation/generation and constructs the candidate from live state. Replacement/reset/library/session actions invalidate pending ownership. Cross-mode ordering, delayed replacement, current combined bounds, and one Undo have regressions. R5 is the remaining candidate-validation defect, not a stale-read ownership failure. |
| R7 known AIFF allocation | **Closed for the reported Important trigger.** COMM dimensions, raw sample-rate validity, decoded logical budget, recognized chunk extents, SSND offsets, and uncompressed PCM containment are checked before decode/fallback. The original 54-byte billion-frame probe now fails `AIFF decoded dimensions exceed the project budget` with **0 decoder calls / 0 allocation calls**. Real AIFF browser coverage remains in the localized passing gate. The compressed-decoder allocation caveat remains explicit. |
| R8 reservation interaction | **Partially closed; Important case above remains.** Free explicit targets are reserved before suggestions; original texture/kick collision and an intervening rejected file have provider regressions. Rejected explicit requests incorrectly fall back into suggestions. |
| R9 durable source-family identity | **Closed.** Preparation now assigns a UUID independently of the resettable intake ordinal. Regression repeats the same old intake ID and requires distinct persistent identities. Serialization and Task 5 family reuse are unchanged, retaining legacy IDs and intentional source-plus-slice sharing. |

## Acceptance limits

The localized browser gate now supplies the previously missing real compressed-source backup/reopen evidence: original MP3 bytes are compared with the fixture, unknown source fields remain distinct from actual decoded 48 kHz metadata, and backup reopen is followed by another verified download. Existing unit/source evidence continues to support library/session preservation; no claim of every codec through every persistence surface is added.

No new source/license, hardware, microphone, Finder/Splice, or affiliation claim is made. Full matrix results and the two remaining corrections require controller reconciliation before Task 7 acceptance. The scoped fixes preserve the existing architecture; Task 10 remains the later full cross-feature audit.
