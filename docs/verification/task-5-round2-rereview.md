# Task 5 bounded re-review — round 2

Reviewed 2026-09-04. Scope: only RR1, the omitted ZIP-structure admission allowance, and direct regression risk from its correction. Compared source and tests against `/tmp/opstudio-task5-before-round2/src`, read the round-two report, checked the actual archive path/generation code and inspected the supplied verification logs. No runtime/test edits, browser/server work, delegation or repeated test suite was performed.

**Spec verdict: pass for RR1.** The remaining archive admission defect is resolved.

**Code-quality verdict: pass for the scoped changes.** The added pure layout calculation matches the current exporter and is conservatively bounded by the existing project reference limit. No residual actionable P0–P3 finding was identified.

## RR1 disposition

`audioSlicing.ts` now reserves ZIP structure independently of the complete 2 MiB manifest allowance. The calculation is `22 + sum(76 + 2 * UTF8(path).length)`: the end record, each 30-byte local header and 46-byte central entry, and the path appearing in both.

The maximum path set correctly matches `exportProjectArchive`:

- One `manifest.json` path, 13 ASCII bytes.
- Up to 256 `assets/audio-NNNN.opfloat` paths, 25 bytes each.
- Up to 256 `assets/source-NNNN.bin` paths, 22 bytes each.

That gives at most 513 entries and **63,100 structural bytes**. The exporter uses these fixed ASCII names, `createFolders:false`, STORE compression and no archive comment; it does not introduce folder entries or source-file names into ZIP paths. Sample IDs appear in the manifest and do not change path lengths. Existing deduplication and omission of derived source payloads can reduce the emitted set but cannot increase it. The 513-entry bound also remains within the archive's 520-entry limit.

The planner's complete total is now stored assets + 2,097,152 manifest bytes + 63,100 structure bytes. Both preallocation preparation and current-state finalization use that planner, so the previously admitted boundary case now rejects before publishing new project work. The corrected logical opfloat headers, mixed-workspace inventory and source representation accounting remain unchanged.

## Regression evidence

- The metadata-only admission fixture admits equality at the supported conservative limit and rejects a one-byte increase, using four source-size values individually below the 64 MiB source ceiling.
- The reducer/preparation fixture first prepares an admissible slice, then increases a current source-size value by one byte. Re-preparation rejects without invoking its allocator; committing the previously prepared operation rechecks current accounting and returns rejection with the original drum array unchanged.
- The small actual mixed-project archive checks that its generated ZIP byte length minus all uncompressed entry payload bytes equals `storedZipStructureBytes(actualPaths)`, and that the result is within the maximum structural reserve. This ties the formula to the installed exporter instead of relying only on a duplicated arithmetic assertion.
- The source inventory contains one runtime helper file and three relevant test files. There are no UI, e2e, history, restore, playback or detector changes in this round.

Inspected logs record **43/43 focused tests**, **617/617 full unit tests**, a successful production/PWA build, and empty targeted lint/whitespace logs: `/tmp/opstudio-task5-round2-focused-first.log`, `/tmp/opstudio-task5-round2-full-unit.log`, `/tmp/opstudio-task5-round2-build.log`, `/tmp/opstudio-task5-round2-lint.log`, and `/tmp/opstudio-task5-round2-diff-check.log`.

The prior frozen full browser matrix remains **85/85 passed** in `/tmp/opstudio-task5-round1-full-browser.log`. It was not rerun for this admission-only correction, and this report does not mislabel that earlier browser run as a round-two run. The round-two actual archive and reducer tests cover the changed boundary directly.

**Recommendation:** Close RR1 and accept Task 5's reviewed software scope. All other findings were closed in round one and remain closed within this correction's direct-regression scope. Hardware verification and the explicitly deferred Task 8 export policy remain separate; no commit or publication is implied.
