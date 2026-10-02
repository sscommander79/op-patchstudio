# OP-XY slicing keyboard mapping verification

Genspark gpt-5.6-sol implemented the approved bounded design and followup corrections. Codex assessed risks, reviewed code and UI, ran all checks, and extended the E2E test to exercise real dragTo plus an exact button locator.

## Behavior
- 24 labeled destination keys, matching existing DrumKeyboard index/upper/lower layout, with correct upper-row spacing and horizontal scrolling.
- Numbered slices drag onto keys; optional labeled destination selector and Assign selected sound; assigned slice keys audition exact ranges. One-click numbered audition remains.
- Manual mapping starts empty. Auto-fill reserves chosen keys and skips occupied keys; explicit nulls stay unassigned through commit.
- Stable range IDs keep mapping across boundary edits and splits. Delete/reset/reanalysis remove invalid assignments. Occupied or staged-sound replacement requires confirmation. Old occupied assets retain their edits/provenance in Unassigned. Source's own pad is protected.
- Atomic prepare/commit validates destination snapshots, full-project capacity, every stored original/retained/new asset, new slice count, and exact destination. Changed target causes rejection, not silent remapping.

## Fresh checks
- 57 focused component/reducer/utility tests passed. Includes duplicate/invalid mapping, nonsequential destinations, explicit unassigned slices, drag payload validation, move/replace/undo, previously sliced replacement, stale target rejection, malformed retained source rejection, preview cancellation, and previous boundary behavior.
- Production build, PWA build verification, and scoped ESLint passed.
- Chromium production E2E passed: real drag sound1 to key8 (CH), selector sound2 to key2 (SD1), exact independent boundary edits, apply, export lokeys [55,61], archive assigned keys [8,2], undo and restore.
- Live browser: actual local loop, 24 keys; assigning to last key GUI works; preview keeps keyboard focus. At 390x844, dialog scrollWidth/clientWidth both390; keyboard scrollWidth716/clientWidth310. Normal viewport restored; temporary staged assignment removed, no kit applied.
- Runtime refreshed from 286 current files, zero support fallbacks. Verified dist copied to local 5188 preview without deleting old assets. 5191 serves same runtime build; open cached tabs need Update now. Independent ready preview at5192 does not share saved projects with5191.

## Limits
No physical OP-XY transfer test; mapping verified against existing project keyboard/export contract and exported patch. Existing loaded keys are displayed as Loaded (full name in title); staged slice keys audition. The original source pad cannot be replaced while slicing that same source. No commit, push, public deployment, audio upload, or audio detector change.

Logs: /tmp/opstudio-mapping-verified-tests.log, /tmp/opstudio-mapping-verified-build.log, /tmp/opstudio-mapping-verified-lint.log, /tmp/opstudio-mapping-verified-e2e.log. Genspark logs are local in /tmp/opstudio-genspark-stage2; private configurations must not be published.


## Superseding change — 2026-10-02

The historical source-pad prohibition above is superseded by HV-007. The source pad may now be replaced with exact current-state approval and its original retained in Unassigned sounds. Existing pad sounds may also be explicitly unassigned without deletion. Atomic commit, stale-source checks and Undo/Redo are covered by current evidence in ../functional-audit-2026-09-27/evidence/hv007-slicer-verification-summary.json. This dated note preserves the older review as historical evidence.
