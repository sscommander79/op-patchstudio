# Repeatable functional verification

Run from the repository root. These checks create disposable browser profiles and generated test audio. They do not validate physical devices. Do not reuse the user's live browser storage.

## Standard gates

- `npm run check` — typecheck, lint, unit tests, production build and PWA artifact verification.
- `PLAYWRIGHT_PRODUCTION=1 npx playwright test --workers=3` — the production application across five configured desktop/mobile browser profiles. Build first. Port 5187 must be free.
- `npx playwright test --config=playwright.visual.config.ts --update-snapshots=none` — approved visual baselines. Port 5196 must be free. Never refresh baseline images automatically to clear a failure.

## Fingerprinted interaction evidence

Run each command separately; browser and recording runs share port 5187.

```
node scripts/run-control-audit.mjs unit
node scripts/run-control-audit.mjs browser --project=chromium --project='Mobile Chrome' --workers=2
node scripts/run-control-audit.mjs recording
```

Each invocation prints a new evidence directory and creates a unique run manifest. The recording command supplies its own generated fake-audio fixture; it does not select physical audio or MIDI hardware. Its isolated production build lives under `/tmp`.

After runs finish, pass their printed directory paths to the inventory builder:

```
node scripts/build-control-audit.mjs docs/verification/functional-audit-2026-09-27 UNIT_RUN_DIRECTORY BROWSER_RUN_DIRECTORY RECORDING_RUN_DIRECTORY
```

Only passing test records from completed matching run identities contribute. Source-file and test-file SHA-256 fingerprints must still match. Modified/deleted test evidence, stale source evidence, failed/skipped/indeterminate tests, incomplete runs and mismatched run identities cannot silently supply current evidence. Do not manually rewrite manifests or hashes to admit old data.

`DOM click` means an input event; named handler events mean invocation. Neither alone proves an outcome. Read the named tests' assertions. Unit execution, browser simulation, visual regression and physical/human acceptance are different evidence classes. Unexercised sites remain gaps; dormant files not imported by the application are separately identified. This instrumentation does not record input values, project audio, credentials, or an assertion that every function is correct.
