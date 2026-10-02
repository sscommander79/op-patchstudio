# Studio restoration: verification report (2026-09-26/27)

**Result:** candidate implementation, independently reviewed and browser-checked. The standard `npm run check` gate passes after the user-authorized bounded cleanup (see below). **Not design-approved and not release-ready.** Nothing was committed, pushed or deployed. No hardware was used.

**Branch:** `codex/studio-upgrade` (HEAD `b669b7c`). The status count was 223 at task start and is 230 at finalization, including this task's untracked additions.

**Engine / review rung:** Claude Opus 5.5 was the sole editor. Genspark Sol 5.6 ran an independent read-only source review mid-task, and its findings are dispositioned below. The final independent review reconciled two separately scoped SPEC and STANDARDS passes (rung 2); see below.

## Baseline and task delta

- **Baseline (evidence only, not restore authorization):** `/tmp/opstudio-restoration-baseline-20260926.nQNfV7/`
  - `MANIFEST.md`: path, git status and SHA-256 recorded before each file's first edit.
  - `files/`: pre-edit copies.
  - `git-status-porcelain.txt`, `git-diff-head.sha256`.
  - `dist-before-build/`, `test-results-before/`, `playwright-report-before/`: gitignored outputs that builds and test runs overwrite.
- **Modified by this task (21):**
  - CI and config: `.github/workflows/quality.yml`, `package.json` (scripts only; no dependency or lockfile change), `vite.config.ts`
  - App: `src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`, `src/styles/studio.css`
  - Components: `src/components/common/{Footer,ProjectToolbar,StudioShell}.tsx`, `src/components/drum/{DrumKeyboard,DrumKeyboardContainer,DrumTool,StudioDemoLoader}.tsx`
  - Unit tests: `src/test/components/{DrumKeyboard,Footer,ProjectToolbar,StudioShell}.test.tsx`
  - E2E: `tests/e2e/{export-workflow.spec,studio-shell.spec,workspace-actions}.ts`
- **Added by this task:**
  - Guard and identity: `scripts/dev-stale-worker-guard.ts`, `src/utils/buildIdentity.ts`, `src/components/common/BuildIdentityNotice.tsx`
  - Unit tests: `src/test/utils/buildIdentity.test.ts`, `src/test/components/BuildIdentityNotice.test.tsx`
  - Contract and configs: `tests/e2e/studio-design-contract.spec.ts`, `playwright.visual.config.ts`, `playwright.dev-origin.config.ts`
  - Visual suite: `tests/visual/studio-visual.spec.ts` plus 12 baselines in `tests/visual/studio-visual.spec.ts-snapshots/`
  - Dev-origin suite: `tests/dev-origin/stale-worker.spec.ts` and `tests/dev-origin/fixtures/legacy-shell/{index.html,sw.js,assets/legacy-app-7f3a.js,assets/legacy-late-7f3a.js}`
  - Docs: `docs/design-system/studio-launch-contract.md`, this report
- **Baseline copies found unchanged** (copied but not edited): `README.md`, `playwright.config.ts`, `src/components/drum/DrumFocusWorkspace.tsx`, `src/utils/version.ts`, `tests/e2e/{drum-pad-access,guided-multisample-flow,stem-recording}.spec.ts`, `.planning/*`. `.planning/*` is updated separately after this report.

## Changed behaviour

- **Unified launch** (`#/studio/overview`):
  - One horizontal header plus a Tools row, and "What are you working on?" as the h1.
  - One row of three diagrammed modules: a note range with 24 zones, a capture waveform, and a 24-slot pad map. The diagrams draw real loaded counts.
  - A dark External gear strip that opens Devices.
  - Secondary Open library and Back up or transfer shortcuts, and a local-save footer.
- **Direct calls to action:**
  - **Open kit** goes straight to the drum editor.
  - **Open capture** opens the multisample editor with guided Record takes.
  - **Open sampler** opens manual Record takes.
  - **Setup guide** links are optional and subordinate; they open the retained guided setup (`#/studio/create`).
  - Inside the drum editor there is also a **Kit setup guide** disclosure.
- **Routes:** all existing routes and nav names are kept. Create is now clearly the guided setup chooser.
- **Drum workbench:**
  - Edge-to-edge editor with a one-row project toolbar (the backup note moved into the Project menu) and a compact Studio Seed strip.
  - Stacked banks on the left and the editor on the right at desktop; it collapses to one column at ≤980px.
  - EMPTY labels are hidden visually but kept as each pad's accessible description.
  - Readable tray count, with no check icon at zero.
  - Compact empty selected-pad panel.
- **Semantic colour:**
  - Ordinary primary actions, Export, view toggles, library/help current items and mobile bank tabs are now graphite.
  - Cyan is reserved for loaded or connected state (pad LEDs, loaded zones and dots).
  - Orange is used for selection and capture; red for destructive accents and errors.
  - The import accent is now neutral. Focus rings are graphite; on pads they are white.
- **Styles:** obsolete olive/lime tokens, the dark-green sidebar shell, overview-grid and old diagram rules were removed. Drum surface and header styles moved from inline styles to CSS, dropping the related `!important` overrides.
- **Build identity:**
  - `html[data-opstudio-*]` attributes and a footer build marker.
  - A loopback-only notice when the tab's build differs from the dev server's build. It never reloads or clears anything.
  - A dev-only stale-worker guard.
  - `npm run dev:studio` serves the canonical origin, `http://127.0.0.1:5191`.

## Preview mismatch diagnosis (127.0.0.1:5191 showed an obsolete sidebar shell and v0.0.0)

**Mechanism, reproduced deterministically** in `tests/dev-origin/stale-worker.spec.ts` with an immutable legacy fixture:

1. A production build (vite-plugin-pwa, registered at `/sw.js`) that once ran on `127.0.0.1:5191` leaves its worker installed on that origin. `docs/verification/drum-slicing-genspark/2026-09-20-keyboard-mapping.md` records that 5191 served a production runtime build.
2. The Vite dev server's PWA registration is a no-op (`node_modules/vite-plugin-pwa/dist/client/dev/register.js`), so it never replaces that worker.
3. The unguarded dev server answers `/sw.js` with `200 text/html` (its SPA fallback, verified with curl). Every browser update check therefore fails, and the worker persists.
4. Navigations are answered from the old precache, so reloads keep showing the old sidebar shell.
5. That old shell reads its version from `/manifest.json`. The dev server now returns HTML for that path, so the shell shows **v0.0.0**. The fixture reproduces this exactly.
6. `localhost:5191` is a different origin with no such registration, which is why it showed the current shell.

**Not directly observed:** the coordinator's actual browser. A read-only search of the Chrome Default and Profile 1 service-worker databases, and of the Playwright CLI profile, found no registration for either 5191 origin, so the affected browser or profile was not identified. Nothing was cleared or unregistered there.

**Fix:**

- The dev-only guard answers `/sw.js` on loopback hosts with a retiring worker. It calls `skipWaiting`, unregisters its own registration, answers only same-origin `/assets/*` from existing caches (`ignoreSearch`, `ignoreVary`), never answers navigations, and never clears caches, IndexedDB or localStorage or reloads a tab.
- **In-flight blank load:** a stale tab loading at the moment of takeover came up blank. Cause: Vite preview serves assets with `Vary: Origin` (verified with curl). Module requests carry an `Origin` header, so a cache lookup made with the module Request missed and fell through to the dev server's HTML.
- `ignoreVary` fixes this. Negative control: with `ignoreVary` removed, the late module import fails with "Failed to fetch dynamically imported module". Restored byte-identical afterwards.

**Recovery proof, no page code involved** (legacy fixture, deterministic):

1. Real project data is saved first: the Studio Seed kit saved to the Library through the app, plus a localStorage probe.
2. The legacy worker takes control of the tab.
3. **Without the guard:** two reloads plus an explicit update job leave the legacy shell and its registration in place.
4. **With the guard:** the browser Update job (`ServiceWorker.updateRegistration` over DevTools, the same network fetch of `/sw.js` the browser runs after navigation) retires the worker within 15 seconds.
5. The open tab is not reloaded (a window marker is kept), and a late precached module still loads.
6. The next load is the current dev build (build id matches `/__opstudio/build.json`), with no controller. The Library still lists Studio Seed, the localStorage probe remains, and the legacy precache still exists.

**Remaining boundary:**

- Chromium schedules its own navigation-triggered update check, observed after 1–5 reloads while diagnosing. The test drives that same Update job directly rather than relying on the browser's timing.
- A stale tab keeps its old page until its next load.
- Workers at paths other than `/sw.js`, non-loopback hosts (unless opted in with `OPSTUDIO_DEV_SW_GUARD_HOSTS`), and non-Chromium browsers are not covered.
- Old shells lack the build-identity notice; recovery does not depend on it.

## Acceptance matrix

| Criterion | Evidence | Status |
| --- | --- | --- |
| Unified compact launch: horizontal header, 3 module row, meaningful diagrams, dark gear strip to Devices, secondary Library and Transfer | Contract "desktop: one horizontal header…" (proportions, order, luminance, fits 1440×1000); StudioShell unit tests; launch baselines | Met |
| Open kit opens the drum editor directly; setup guidance optional and accessible | Contract "task calls to action…"; unit "opens the drum editor directly…"; Kit setup guide assertions | Met |
| Existing routes, Overview/Create access and all capabilities kept | studio-shell E2E (reload/Back, guided flows, Transfer); full E2E suite | Met |
| Drum: stacked banks left, editor right at desktop; collapses without overflow | Contract drum tests at 1440, 1024, 900 and 390; drum-pad-access E2E; drum baselines | Met |
| Compact toolbar and demo strip; EMPTY quieted visually but kept accessible | Contract (toolbar ≤64px, strip ≤64px, no visible EMPTY, description EMPTY); DrumKeyboard unit tests | Met |
| Tray count contrast, neutral zero state, compact empty pad panel (review A/B) | Contract (count ≥4.5:1, icon ≥3:1, no check at zero, save state ≥4.5:1, empty panel ≤150px) | Met |
| Semantic colour: neutral actions, cyan loaded, orange selected, red destructive | Contract "semantic colour…" (computed against tokens) | Met |
| Key graphic unchanged (deferred) | Pad shape CSS not changed; baselines | Met |
| Keyboard and focus navigation | Contract Tab order with focus outlines and Enter; existing route-focus E2E | Met |
| Build and origin markers | Contract "build identity…"; build identity unit tests | Met |
| Trustworthy dev preview and stale-asset simulation | Dev-origin suite (legacy fixture, reproduction plus recovery plus data retained); guard host allowlist unit tests | Met, within the boundary above |
| Visual screenshots with reviewed baselines plus independent semantics | 12 reviewed baselines, 20px budget; contract fails 8/10 against the pre-task UI (negative control) | Met locally; CI macOS rendering not yet observed |
| Gates integrated in CI | `quality.yml`: dev-origin step in `quality-and-chromium`; new `macos-visual` job; contract inside the production E2E | Configured, not run remotely (no push) |
| `npm run check` passes | After the user-authorized removal of 16 verified-empty `@types` folders: exit 0 (typecheck, lint, 99 files/1,064 tests, build and PWA verify) | Met |
| Workflow guards (project, import, edit, export, MIDI cancellation) | Full Chromium E2E dev and production: 54 passed, 2 pre-existing failures; storage, recording, stem suites; Devices/MIDI unit tests | Met, except 2 pre-existing failures |

## Commands and results (final runs)

| Command | Result |
| --- | --- |
| `npm run check` (before cleanup) | **exit 1**: `tsc -b` reports 32 × TS2688 (16 empty `node_modules/@types/* 2` folders × 2 projects) and 0 other TypeScript errors. Stops before lint, test and build |
| `npm run check` (after the authorized cleanup; full output in `/tmp/opstudio-approved-standard-check.log`) | **exit 0**. Typecheck: 0 TypeScript errors. Lint: 0 errors, 3 pre-existing warnings in `coverage/`. Vitest: 99 files, 1,064 tests passed. `vite build` plus `verify:pwa`: "Verified 42 unique precache URLs…" |
| Supplemental typecheck: `/tmp/opstudio-typecheck-filtered/run.sh` (same tsconfigs; outside-repo `typeRoots` symlinking only the 16 real `@types` packages) | exit 0. **This is supplemental evidence, not `npm run check`** |
| `npx eslint .` | exit 0 (0 errors; 3 pre-existing warnings in `coverage/`) |
| `npx vitest --run` | exit 0: 99 files, 1,064 tests passed |
| `npx vite build && npm run verify:pwa` | exit 0: "Verified 42 unique precache URLs…" |
| `npx playwright test --project=chromium` (dev) | 54 passed, 3 skipped (device-config specs), **2 failed (pre-existing)** |
| `npm run test:e2e:production -- --project=chromium` | 54 passed, 3 skipped, **2 failed (pre-existing)** |
| `npm run test:e2e:storage-integration -- --project=chromium` | 2 passed |
| `npm run test:e2e:recording` | 3 passed (synthetic fake audio and MIDI) |
| `PLAYWRIGHT_FAKE_AUDIO_FILE=/tmp/opstudio-ci-stem-audio.wav PLAYWRIGHT_STEM_FAKE_DEVICE=1 npx playwright test --config=playwright.stem-recording.config.ts` | 1 passed |
| `npm run test:e2e:studio-contract` | 26 passed |
| `npm run test:e2e:dev-origin` | 1 passed (also 3/3 consecutive passes earlier, no retries); negative control fails as expected |
| `npm run test:visual` | 12 passed, then re-run: 12 passed (reproducible under the 20px budget) |
| Devices/MIDI: `devices-workspace.spec.ts` (E2E, both modes); `vitest browserSession + DevicesWorkspace` | Passed; 56/56 unit tests |

**Pre-existing failures** (not caused by this task, not fixed; out of scope):

- `tests/e2e/audio-import.spec.ts:11` (assertion at `:21`)
- `tests/e2e/slicing.spec.ts:61` (assertion at `:116`)

In both, imported or sliced sounds land in the unassigned tray instead of pads (for example, "Drum pad instrument, 0 of 24 loaded" with 9 unassigned). They fail identically on a scratch copy (`/tmp/opstudio-baseline-replay`) with every task-edited file restored from the baseline and task additions removed.

**Real vs mocked:** all MIDI, audio input and OP-XY behaviour in these tests is synthetic or mocked (fake devices, mocked MIDI access, a generated WAV). No physical MIDI, audio or OP-XY transfer was exercised. Screenshots do not prove hardware behaviour.

## Screenshots (deterministic, reviewed)

Directory: `tests/visual/studio-visual.spec.ts-snapshots/`

| View | Light | Dark |
| --- | --- | --- |
| Launch, desktop 1440 | `launch-desktop-light-chromium-darwin.png` | `launch-desktop-dark-chromium-darwin.png` |
| Launch, narrow 390 | `launch-narrow-light-chromium-darwin.png` | `launch-narrow-dark-chromium-darwin.png` |
| Empty drum, desktop | `drum-empty-desktop-light-chromium-darwin.png` | `drum-empty-desktop-dark-chromium-darwin.png` |
| Empty drum, narrow | `drum-empty-narrow-light-chromium-darwin.png` | `drum-empty-narrow-dark-chromium-darwin.png` |
| Studio Seed drum, desktop | `drum-desktop-light-chromium-darwin.png` | `drum-desktop-dark-chromium-darwin.png` |
| Studio Seed drum, narrow | `drum-narrow-light-chromium-darwin.png` | `drum-narrow-dark-chromium-darwin.png` |

**Test data and pinning:** the drum views use the deterministic Studio Seed kit. The footer build text is pinned to "v0.0.0 · build pinned" for comparison only; the real marker is asserted in the contract.

**Baseline history, all reviewed:**

- The first recording was invalid: a mask selector matched `<html>` and every image came out magenta. It was discarded.
- The load toast was then waited out.
- Tolerance was tightened after unmasked text recolours passed.
- The capture method changed from masking to pinning, and all 12 were re-recorded deliberately.
- The six narrow images were re-recorded after the location line was restored (+32px each; desktop unchanged).

## Final independent review and coordinator browser check

- **Final review:** Genspark Sol 5.6 through OpenCode in plan mode (read-only; rung 2 as reconciled) exited 0. Two separately scoped passes, SPEC and STANDARDS, were reconciled. The reviewer found no material restoration defects and accepted the source and screenshots. **The reviewer did not execute tests.**
- **Real-browser check by the coordinator:**
  - They started `127.0.0.1:5191` and observed the old sidebar shell in a real browser.
  - One manual reload recovered the unified launcher, build `c3f85451`. `localhost:5191` showed the same build.
  - They checked desktop 1440×1000 and narrow 390×844 in the browser and inspected the final screenshot baselines.
  - Open kit reached `#/studio/drum` directly.
  - Confirmed on the drum workbench: readable zero-loaded count with no completion check, compact empty editor, stacked banks.
  - No browser project data was cleared. Temporary tabs were closed and the coordinator's server was stopped.

## Independent review findings: disposition

| Finding | Disposition |
| --- | --- |
| G1 HIGH: dev-origin test not in CI | Fixed: a "Dev-origin stale service worker recovery" step in `quality-and-chromium` |
| G2 HIGH: visual checks macOS-only and skipped in CI | Fixed: `macos-visual` job (`macos-15`, `npm ci`, Playwright Chromium, `npm run test:visual`, diff artifact on failure); `updateSnapshots: 'none'` in CI. First remote run not observed; runner font rendering may need a reviewed runner baseline. Required-check recommendation documented, not configured |
| G3 MEDIUM: fixture built from current source | Fixed: immutable legacy shell and worker fixture (Workbox-like precache, navigation fallback, cache-first assets, `Vary: Origin`). Deterministic DevTools-driven update. Failure mechanism identified (`Vary` cache miss on takeover) with a negative control. No reload-until-pass loop |
| G4 MEDIUM: guard on every host | Fixed: loopback allowlist plus `OPSTUDIO_DEV_SW_GUARD_HOSTS` opt-in; positive and negative Host unit tests |
| G5 LOW: real project record | Fixed: the Studio Seed library entry is saved before and read after recovery |
| Visual A: dark-on-dark count, check at zero | Fixed; contrast asserted. "Unsaved changes" was 4.08:1 and is now graphite (≥4.5:1 asserted). Disabled controls unchanged |
| Visual B: tall empty pad panel | Fixed: content-sized, ≤150px asserted; loaded editor unchanged |
| Visual C: narrow footer truncation | Fixed: footers wrap; the contract asserts no clipped status text; baselines reviewed |
| Visual D: orange diagonal, cyan arrows | Not followed, deliberately (misleading annotations or false connection state) |
| Environment: TS2688 | Reported, not hidden. Resolved after the user authorized the bounded 16-directory cleanup (see below) |

## Environment boundary: `npm run check` (resolved with user authorization)

- **Root cause:** `node_modules` contains at least 1,231 duplicate-named entries (`* 2`, `* 3` and so on, counted to depth 2). Their origin was not determined. Sixteen of them are verified-empty `node_modules/@types/<name> 2` directories, dated 2026-09-26 09:58.
- TypeScript treats every `@types` folder as an implicit type library, so `tsc -b` fails with TS2688 before any code is checked.
- The source tree also has duplicate-style files, for example `src/components/common/AutoSamplingPanel 2.tsx`. `dist/index 2.html` and similar build-output duplicates were removed when `vite build` emptied `dist/`; a copy survives in the baseline's `dist-before-build/`.
- **Config change considered and rejected:** listing `types` explicitly in the tsconfigs would give the same set today, but it would silently stop including any future `@types` package. That narrows typing, so it was not applied.
- **Authorized cleanup (2026-09-27):** the user explicitly approved removing only these 16 directories and rerunning the standard check:
  - `aria-query 2`, `babel__core 2`, `babel__generator 2`, `babel__template 2`, `babel__traverse 2`, `chai 2`, `deep-eql 2`, `esrecurse 2`
  - `estree 2`, `json-schema 2`, `node 2`, `react 2`, `react-dom 2`, `resolve 2`, `trusted-types 2`, `webmidi 2`
- **How it was done:**
  - Branch `codex/studio-upgrade` and status count 230 were verified first.
  - Each directory was re-checked immediately before removal: a real directory, not a symlink, and empty.
  - Each was removed with a single literal-path `rmdir` (no recursive removal).
  - All 16 were removed. Afterwards `node_modules/@types` holds only the 16 real packages, with no duplicate-named entries.
  - Nothing else was removed or installed. The other duplicate-named entries elsewhere in `node_modules` and in `src/` were left untouched.
  - The rerun's build step emptied and rebuilt `dist/` as usual.
- **Result:** the standard `npm run check` passes (exit 0). Full log: `/tmp/opstudio-approved-standard-check.log`.

## Remaining limitations

- Design is not approved. The key graphic, semantic colour density and editor-nav choices remain deferred by the user.
- CI jobs are configured but have not run remotely; the macOS runner may need a human-reviewed runner baseline.
- The two pre-existing E2E failures (import and slice routing to the unassigned tray) are outstanding.
- Dev-origin recovery is verified in Chromium only, for `/sw.js` on loopback. Real browsers schedule their own update check, so a stale tab updates after a later load.
- No hardware verification of any kind, and no testing with actual assistive technology (accessible names, descriptions and focus were checked by automated tests only).
- These checks reduce regressions; they do not guarantee there will be none.

## Processes and scratch data

- No task server is running. My port-5193 dev server (pid 28345) was stopped, and the coordinator's 5191 server was stopped after the browser check.
- A listener on `127.0.0.1:5188` (pid 26919) was not started by this task and was left untouched.
- Outside-repo scratch directories:
  - `/tmp/opstudio-baseline-replay`: baseline replay copy; its `node_modules` is a symlink.
  - `/tmp/opstudio-typecheck-filtered`: supplemental typecheck.
  - `/tmp/opstudio-shots`: ad-hoc screenshots and debug scripts.
  - `/tmp/opstudio-*.log`: command logs.

## Follow-up: Overview drum illustration (2026-09-26/27)

User confirmed the Overview card should use the approved reference’s 3 × 4 illustration, while retaining the actual editor’s 24 slots. After Claude reached its session limit, the user authorized Codex editing with Genspark reviewing.

- Changed only the launch pad illustration to 12 rectangular paired-slot tiles. Each tile summarizes two consecutive slots; accessible text and footer keep the actual 24-slot loaded count, including slot 23. The actual drum editor is unchanged.
- Reviewed desktop/narrow light/dark screenshots and diffs: only the intended illustration changes. Deliberately updated only four launch baselines; eight drum baselines remain unchanged.
- Typecheck passed; focused StudioShell tests: 13 passed; layout/navigation contract: 26 passed; visual suite: 12 passed. Genspark Sol 5.6 read-only review found no material findings (did not execute tests).
- Local preview remains running at http://127.0.0.1:5191/#/studio/overview. No commit, push, deploy, dependency install or hardware operation.
- Earlier full-check evidence and existing limitations remain as recorded above; this correction did not rerun the full unit or workflow suites.

## Follow-up: lighter drum-card illustration (2026-09-26/27)

User felt the 3 × 4 card still lacked the visual quality of its neighbors. Refined only the overview pad drawing: transparent empty tiles, finer outlines, wider gutters, smaller vertically centered rectangles and monospaced slot-pair labels. Loaded pairs retain honest cyan outlines/fill/LEDs. No false selection highlight: actual drum selection is local to the editor.

Reviewed all four desktop/narrow light/dark launch renders before intentionally updating those four baselines. Unit tests: 13 passed; contract checks: 26 passed; full visual suite: 12 passed. Genspark read-only final review found no material findings; it did not run tests. Actual editor and its eight visual baselines remain unchanged. The preview on 5191 remains live; no commit/push/deploy.

## Follow-up: replace numbered map with workflow artwork (2026-09-26/27)

The user found the paired-slot numbers confusing and the card bland. Removed both numbers and live-state coupling from the artwork. It now illustrates selecting/shaping a drum sound: 3 × 4 soft neutral pads, one orange outline and a small example waveform. Accessible name explicitly identifies an illustration. This supersedes the previous two illustration refinements. Real 24-slot capacity and loaded counts remain in the footer, including the last slot and excluding unassigned sounds; the actual editor is unchanged.

All four light/dark desktop/narrow launch renders were inspected before deliberately updating those baselines. Typecheck passed; focused unit tests: 13 passed; layout/navigation contract: 26 passed. Genspark read-only final review found no material correctness or accessibility issues. No tests were executed by the reviewer. Preview remains running on5191.

Final visual validation: 12/12 passed twice (39.0s, 41.9s); eight unchanged drum baselines continue to match. Logs: `/tmp/opstudio-pad-art-visual.log` and `/tmp/opstudio-pad-art-visual-repeat.log`.

## Follow-up: playful percussion and capture marker (2026-09-26/27)

User accepted the colorful percussion direction and requested an improved review marker. Overview now has a static 3 × 4 grid with alternating blue/orange/gray/black/yellow tiles and twelve original flat percussion pictograms. The capture waveform spans more of its panel; dotted marker intersects tail bar 12 with REVIEW above/right. Artwork is illustrative; real 24-slot footer counts and editor remain unchanged. Codex implemented; Genspark read-only review found no material findings. Typecheck, 13 focused unit tests and 26 contract checks passed. Only four reviewed launch baselines updated; eight drum baselines untouched. Preview on 5191 remains live.

The original pictograms are bass drum, snare, hi-hat, cymbal, tom, cowbell, tambourine, shaker, claves, conga, triangle and woodblock. No TE assets were copied. Decorative palette is explicitly scoped outside live-state colors. Black tiles retain an outline in dark mode. Rendered light/dark desktop/narrow artwork was reviewed before baseline updates. No commit/push/deploy/install or hardware operation.

Visual validation: 12/12 passed twice (37.8s and40.3s); all eight existing drum-editor baselines matched. Logs: `/tmp/opstudio-percussion-visual.log` and `/tmp/opstudio-percussion-visual-repeat.log`.

## Follow-up: pad proportions (2026-09-26/27)

User approved changing only pad size and spacing first. The decorative 3 × 4 grid is centered at 224 × 84 within a 280 × 112 viewBox, with 50 × 22 tiles and 8/9-unit gutters (80% width, 75% height). Colors and original icons are unchanged. Added footprint and centering regression assertions; 26 contract tests passed. Genspark read-only review found no material findings. All four desktop/narrow light/dark launch renders were inspected before updating only those baselines. The actual editor and eight drum baselines are untouched. Preview on port 5191 remains running.

Final visual validation: 12/12 passed twice (38.1s and 37.6s), including all eight unchanged drum-editor baselines. Logs: `/tmp/opstudio-pad-scale-visual.log` and `/tmp/opstudio-pad-scale-visual-repeat.log`.

## Follow-up: four aligned launch cards (2026-09-27)

User requested six percussion pads aligned with the heading, a Record OP-XY tracks launch card, and removal of the redundant Tools row. Implemented four equal desktop cards, two columns at medium widths, and one column on phones. Six pictograms sit in two rows of three. The new card opens the existing guarded lazy recorder; audio/MIDI activation still requires explicit user action. Actual drum editor retains 24 slots. This supersedes earlier centered twelve-pad follow-ups.

Typecheck and targeted lint passed; 23 focused unit tests and 27 layout/navigation checks passed. Recorder entry: 2 passed. Full Chromium: 55 passed, 3 skipped, same two baseline-reproduced audio-import/slicing failures. Genspark Sol 5.6 reviewed read-only, found the initial helper/docs/medium-layout findings resolved and no remaining material issues; it did not run tests. All 12 reviewed visual baselines passed twice after the intentional header/layout refresh. Logs: /tmp/opstudio-four-cards-visual.log and /tmp/opstudio-four-cards-visual-repeat.log. All twelve images changed because removing Tools changes the shared header; drum-editor content was not edited. Live in-app browser confirmed the aligned two-column layout. Preview remains running on port 5191. Branch codex/studio-upgrade; 231 status entries; no commit/push/deploy/install/hardware actions.


## Progress checkpoint validation (2026-09-27)

User authorized saving accumulated work with a commit and push to codex/studio-upgrade. npm run check passed: typecheck, lint (0 errors; 3 pre-existing generated-coverage warnings), 99 files / 1065 unit tests, build and PWA verification. Log: /tmp/opstudio-progress-save-check.log. Fixed artwork Fast Refresh lint by moving the name constant to its sole consumer; no visual change. Existing two browser workflow failures remain as documented. Duplicate source/report artifacts are preserved locally but excluded from this checkpoint. This is a progress save, not release or hardware verification.

## Follow-up: remove redundant Create navigation (2026-09-27)

User approved removing Create from the header while retaining Setup guide links and the direct create route. Updated navigation assertions and guided workflow tests to use the card links. Typecheck, targeted lint, 13 focused unit tests and 27 layout/navigation checks passed. Genspark read-only review found no material defects; existing direct-route coverage resolves its minor coverage suggestion. All twelve pixel differences were verified to be confined to header navigation. All 12 visual checks passed twice (38.1s, 37.6s); the guided workflow passed with simulated audio/MIDI devices (1 test). No physical hardware verification. This follow-up remains uncommitted after pushed checkpoint dc1e1f3.
