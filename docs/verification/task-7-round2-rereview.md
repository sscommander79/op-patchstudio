# Task 7 round 2 independent re-review

Date: 2026-09-04. Reviewer: Astra. Branch: `codex/studio-upgrade`. Baseline: `/tmp/opstudio-task7-before-round2/src`.

**Spec verdict: pass for the scoped residual R5/R8 fixes. Quality verdict: pass for the scoped residual R5/R8 fixes. No remaining Important findings were identified in this re-review.** Together with round 1's seven closed findings, all nine original Task 7 findings are now dispositioned as closed. Final cross-feature review remains Task 10.

## Scope and evidence

Read the complete round 2 package covering five changed source/test files and approximately 202 diff lines, the implementation report, and the prior residual findings. Inspected the extracted archive metadata validator, its admission/export/import callers, the provider's explicit-request filtering, and the added reducer/provider/archive regressions. No E2E/configuration changes occurred in this round.

Read the retained verification outputs:

- Focused residual coverage: **41/41 tests in three files**, `/tmp/opstudio-task7-round2-focused.log`.
- Full unit suite: **743/743 tests in 66 files**, `/tmp/opstudio-task7-round2-full-unit.log`.
- Production build completed, including PWA generation, `/tmp/opstudio-task7-round2-build.log`.
- Post-fix localized import browser gate: **23 passed / 2 explicit desktop-only mobile skips** in 19.7 seconds, `/tmp/opstudio-task7-round2-browser.log`.
- Prior round's full configured browser matrix: **118 passed / 2 explicit desktop-only mobile skips** in 1.9 minutes, `/tmp/opstudio-task7-round1-full-browser.log`. This is the completed round 1 result, not a new round 2 full-matrix run.

The implementer also reports successful standalone TypeScript, scoped lint, and diff checks. Inherited global lint cleanup remains Task 9. The documented interactive RED output was not reconstructed or independently rerun.

No duplicate broad tests or browser runs were performed by this reviewer. A bounded read-only probe used actual preset/crossfade/archive modules, an eight-frame AudioBuffer fixture, real File/Blob values, and actual ZIP export/import. No implementation/test/browser/configuration changes, server, commit, or publication occurred; this report is the only written artifact.

## Residual finding closures

### R5 — closed: shared metadata validation rejects invalid derived provenance before commit

`validateManifestMetadata` now contains the common settings, raw JSON, sample descriptors, paths, references, provenance, and logical decoded-byte validations. `validateProjectArchiveMetadata` calls this shared core after the complete manifest's JSON/byte checks; export/import use the same core and additionally check real ZIP members and payloads. The new admission path does not encode or read PCM.

The original fixture remains an exact regression: one `match.wav` multisample, eight frames at 8 kHz, and `{"type":"multisampler","regions":[{"sample":"match.wav","framecount":8,"loop.crossfade":0.5}]}`. The independent source probe now returns **`Invalid imported crossfade value` at metadata admission with zero PCM reads**. The actual guarded-commit regression proves the raw/current project and sample array stay unchanged, an error is reported, no import Undo step is added, and the retained project still exports/reopens.

A positive integer case is also covered. With raw crossfade `4`, independent admission succeeds with **zero PCM reads**, and actual ZIP export/import returns `{fraction:0.5, importedRaw:4, importedFramecount:8, sourceIdentity:"match.wav"}` plus unchanged original File bytes. This checks preservation as well as rejection. Existing full-manifest bytes/key/wrapped-depth and accepted-near-limit regressions remain in the passing focused suite.

### R8 — closed: rejected explicit requests remain unassigned through review and Apply

The filename proposal input now excludes every asset present in `requestedPads`, rather than only successfully reserved explicit pads. A free explicit request still reserves its pad. An occupied, duplicate, or invalid explicit request has no fallback proposal, so its selected destination and explanatory reason both remain unassigned until the user edits the decision.

The provider regression starts with occupied pad 0, imports `kick.wav` explicitly toward that pad, checks the unassigned selection and matching reason, applies the new unassigned asset while preserving the existing sample, and verifies one Undo removes only the import. The earlier free-explicit texture/kick reservation and rejected-file ordinal regressions remain passing. Source inspection confirms automatic filename suggestions still apply to files with no explicit destination request.

## Acceptance boundaries

The localized post-fix browser run re-exercises the unchanged real-codec import, original compressed bytes through backup/reopen, desktop chooser batching, visible mixed-file classification, malformed settings choosers, and nested-drop failure feedback. Repeating the full matrix was unnecessary for this bounded re-review; the controller retains the completed prior full matrix and the fresh localized run as distinct evidence.

This verdict adds no hardware, microphone, Finder/Splice, affiliation, deployment, or every-codec/every-storage-surface claim. Task 8 workspace work and Task 9 engineering debts were not audited or expanded. Task 7's reviewed fixes are ready for controller acceptance.
