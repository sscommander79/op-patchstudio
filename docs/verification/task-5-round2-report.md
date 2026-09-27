# Task 5 round-two ZIP admission report

This round addresses only RR1 from `task-5-rereview.md`. No UI, browser, e2e, detector, playback, provenance, or reducer behavior outside archive admission changed.

## Admission formula

Portable projects use STORE ZIP entries. For a set of emitted paths, structural bytes are:

`22 + sum(76 + 2 * UTF8(path).length)`

The 22 bytes are the end-of-central-directory record. Each entry contributes a 30-byte local header and 46-byte central-directory header, and its UTF-8 path appears once in each header. The maximum project has 513 paths: `manifest.json`, 256 `assets/audio-NNNN.opfloat` paths, and 256 `assets/source-NNNN.bin` paths. Their independent ZIP structure reserve is exactly 63,100 bytes.

`projectedArchiveBytes` now equals stored logical/source bytes + 2,097,152 manifest bytes + 63,100 ZIP structure bytes. The complete total must stay at or below 268,435,456 bytes. This reserve is conservative when source payloads are omitted or deduplicated, but it is bounded by the existing 256-sample project limit and the exporter's fixed path scheme.

## Regression coverage

- The planner admits the exact supported byte boundary and rejects one byte over it.
- A metadata-only near-limit operation allocates at the exact boundary, then a one-byte current source-file growth rejects before a new allocation and rejects a previously prepared operation at the atomic current-state commit without changing drum state.
- A small real mixed project archive proves `archive byte length - uncompressed payload bytes` equals the same path-based structure formula and remains below the maximum reserve.

The scoped round-two diff against `/tmp/opstudio-task5-before-round2/src` contains only:

- `src/utils/audioSlicing.ts`
- `src/test/utils/audioSlicing.test.ts`
- `src/test/context/audioSlicingApplication.test.ts`
- `src/test/utils/projectArchive.test.ts`

## Verification evidence

- Focused admission/archive/reducer tests: 3 files / 43 tests passed, `/tmp/opstudio-task5-round2-focused-first.log`.
- Full unit suite: 56 files / 617 tests passed, `/tmp/opstudio-task5-round2-full-unit.log`.
- Production TypeScript/Vite build: passed, `/tmp/opstudio-task5-round2-build.log` (existing dependency Sass, bundle-size, and browsers-list warnings only).
- Scoped lint and repository whitespace validation: passed with empty output, `/tmp/opstudio-task5-round2-lint.log` and `/tmp/opstudio-task5-round2-diff-check.log`.
- No e2e source changed and no browser rerun was requested for this helper-only round. The controller's frozen round-one matrix remains 85/85 passing, `/tmp/opstudio-task5-round1-full-browser.log`.
