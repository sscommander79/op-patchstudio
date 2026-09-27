# Task 9 final evidence bundle

Date: 2026-09-05  
Scope: local controller evidence for the frozen Task 9 candidate

This directory preserves the final JSON results, corresponding logs and the exact local harness/configuration snapshots used for the controller's final checks. `SHA256SUMS` records the copied files. The temporary originals were:

- Results: `/tmp/opstudio-task9-offline-proof.json`, `/tmp/opstudio-task9-update-proof.json`, `/tmp/opstudio-task9-cache-race-proof.json`, `/tmp/opstudio-task9-waiting-cache-proof.json` and `/tmp/opstudio-task9-final-visual.json`.
- Final logs: `/tmp/opstudio-task9-final-offline-proof.log`, `/tmp/opstudio-task9-final-update-proof.log`, `/tmp/opstudio-task9-final-cache-race-proof.log`, `/tmp/opstudio-task9-final-waiting-cache-proof.log` and `/tmp/opstudio-task9-final-visual{,2,3}.log`.
- Task 9 harnesses: `/tmp/opstudio-task9-offline-proof.mjs`, `/tmp/opstudio-task9-update-proof.mjs`, `/tmp/opstudio-task9-cache-race-proof.mjs`, `/tmp/opstudio-task9-waiting-cache-proof.mjs`, `/tmp/opstudio-task9-final-visual.mjs`, `/tmp/opstudio-task9-round1-midi-proof.mjs` and `/tmp/opstudio-task9-static-server.mjs`.
- Test-only build configurations: `/tmp/opstudio-task9-build-{a,b,c,d}.config.mjs`.
- Retained feature harnesses: `docs/verification/harnesses/task-8-demo-proof.mjs` and `docs/verification/harnesses/task-8-focus-proof.mjs`, with final logs `/tmp/opstudio-task9-retained-{demo,focus}.log`.

The A/B/C/D Vite configurations are proof fixtures. They inject `__offlineProofBuild` and `__lazyProofBuild` labels and emit a same-name `task9-proof-static.svg` whose bytes differ by build. Those labels and that asset are test markers, not application features or shipping configuration. The static server selects among prebuilt `/tmp/opstudio-task9-build-{a,b,c,d}` directories and has a test-only hold for C installation. Reproduction therefore requires those local builds, the repository dependencies and matching Playwright browsers; the snapshots are evidence, not a standalone orchestration system.

`final-visual-attempt-1.log` and `final-visual-attempt-2.log` retain two harness locator mistakes: the first scoped **zoom and edit** to the wrong dialog and the second scoped **Cancel** to the wrong dialog. Neither established a product defect. The corrected exact harness produced `final-visual.json` and `final-visual-pass.log`, both reporting PASS.

The offline proof intentionally retains five failed offline requests. Three are optional Patreon proxy attempts that drove the explicit unavailable fallback. Two are `http://127.0.0.1:5188/manifest.json` requests returning `ERR_INTERNET_DISCONNECTED`; the application cold start and tested offline workflows still passed. The result is not described as zero failed network requests.

