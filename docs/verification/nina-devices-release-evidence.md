# NINA Devices release evidence

Date: 2026-09-21. This record is deliberately evidence-bounded. It does not
claim physical NINA receipt or acceptance that was not performed.

## Verdict

**SOFTWARE RELEASE GATES PASS — HARDWARE ACCEPTANCE PENDING.**

The Devices-specific implementation has passed its final independent Astra
review, repository quality gate, production service-worker recording checks,
and current browser checks. It must not be labelled `NINA PROFILE ACCEPTED`
until the user completes every physical checkbox in
`nina-devices-hardware-acceptance.md`.

## Integrity and scope

| Check | Result | Evidence |
| --- | --- | --- |
| Hardening manifest | Changed as expected, not a baseline match | Recheck found 51 entries; `StudioShell.tsx` and `AutoSamplingPanel.tsx` differ from the earlier hardening SHA manifest because this approved Devices work intentionally integrates the new workspace and capture lease. No missing manifest file. |
| Whitespace | Pre-existing finding | `git diff --check` reports `src/components/library/LibraryTable.tsx:144: trailing whitespace`; it was not modified for Devices. |
| Prohibited protocol | PASS | Astra read-only review found the native access request is explicit and literal `{ sysex: false }`; no SysEx, OP-XY writable settings, broadcast, or automatic output retargeting was added. |
| Persistence isolation | PASS | Strict `op-patchstudio.devices.setups.v1` data path; Devices has no AppContext/project/library/audio serialization dependency. |

## Automated evidence

| Gate | Result | Exact evidence |
| --- | --- | --- |
| Full current unit/component suite | PASS | `npm test`: 94 files, 997 tests, exit 0 (2026-09-21). |
| Devices/capture focused suite | PASS | 8 files, 117 tests: session, lease, Devices UI, autosampling, stems, and stem engine. |
| Strict bounded TypeScript | PASS | Six Devices MIDI/UI production modules checked with strict ES2022/DOM/bundler settings. |
| Scoped Devices lint | PASS | Final R3 fix report records scoped lint passing. |
| Chromium Devices workflow (development server) | PASS | `npx playwright test tests/e2e/devices-workspace.spec.ts --project=chromium`: 1 passed. It proves deliberate bytes, no setup lifecycle bytes, route locking in development, and stale-output refusal. |
| Typecheck, lint, and unit/component tests | PASS | After removing only 15 verified-empty duplicate-suffixed ambient type folders, `npm run typecheck && npm run lint && npm test` passed: 94 files, 997 tests. One unused test parameter was corrected; cleanup-only lint fixes preserved behavior. |
| Full Playwright suite | PASS | Deterministic CI-mode `CI=1 npx --yes -p node@22 npm run test:e2e` completed its 200-test matrix with `test-results/.last-run.json` reporting `status: passed` and no failed tests. The Devices workflow passed in Chromium and Firefox; intentional hardware-only scenarios remained skipped. An earlier unconstrained parallel run had one Firefox import-preparation timeout; the exact test then passed once alone and five concurrent repetitions before this deterministic clean run. |
| Storage integration | PASS | `npm run test:e2e:storage-integration`: 10 passed. |
| PWA/Workbox compatibility | PASS | Isolated Node 22 executes the repository checks with Workbox 7.3.0 resolved only on the Vite PWA dependency edge. The retained-asset lookup remains own-precache first, then retained app precaches (newest first), query-tolerant, then network. Astra independently exercised the emitted worker/delegate and all fallback cases. |
| Production recording suite | PASS | `npx --yes -p node@22 npm run test:e2e:recording`: 3 passed. It includes the production service-worker controlled synthetic MIDI capture and offline recovery path. |
| Full `npm run check` | PASS | Under the isolated Node 22 runtime: typecheck, lint, 94 files / 997 tests, Vite production build, generated `dist/sw.js`, and `npm run verify:pwa` all passed. The verifier reports 32 unique precache URLs and 10 content-revisioned stable public assets. |

## Independent review disposition

| Finding set | Reviewer | Result | Disposition |
| --- | --- | --- | --- |
| Initial release audit R1–R8 | GPT-6 Astra | 6 P2, 2 P3 | Fixed: explicit channel, fail-closed port identity, paced slider/coalescing, configurable human test, full attempt monitor, production guard, reactive lease status, exact Echo Filter guidance. |
| Follow-up R3 | GPT-6 Astra | P2 | Fixed: coalescing now keys on output lifecycle, channel, and controller, so an independent parameter cannot discard a final gesture. |
| Final R3 re-review | GPT-6 Astra | PASS | Runtime probe: Cutoff 10 -> Cutoff 20 -> Resonance 30 transmits at 0/25/50 ms; same-stream coalescing, cancellation, and lifecycle silence remain intact. |
| Final PWA compatibility review | GPT-6 Astra | PASS | Independently executed the generated worker: own-cache priority, retained-cache fallback, `ignoreSearch`, unrelated-cache exclusion, network miss, and no runtime cache creation passed; no NINA safety regression found. |
| Protocol audit | Genspark Claw, protocol-only | Supports design | No source was shared. Its cited manufacturer/W3C research supports NINA CC 7/28/29/30, class-compliant USB MIDI, the exact Echo Filter distinction, selected-port handling, explicit `{ sysex: false }`, and the physical acceptance approach. It is not a source-code audit. |

Detailed reviewer records live in `.superpowers/sdd/2026-09-21-nina-devices-workspace/`:
`task-8-astra-review.md`, `task-8-fix-report.md`, `task-8-astra-rereview.md`,
`task-8-r3-fix-report.md`, `task-8-r3-astra-rereview.md`, and
`task-8-recording-gate-astra.md`, `task-8-pwa-astra.md`, and
`task-8-pwa-final-astra.md`.

## Physical acceptance boundary

The packet is intentionally unchecked. To promote this record to **NINA
PROFILE ACCEPTED**, a human must perform and record every required device test,
including the exact setting:

`SYSTEM -> GLOBAL SETTINGS -> MIDI Echo Filter = Echo Filter` (not `Filter All`).

Use the explicit selected NINA output and layer channel, then confirm the
visible motorized-knob response, local receipt identity, no change on a second
device, and reconnect behavior. Automated fake MIDI cannot establish any of
those physical facts.
