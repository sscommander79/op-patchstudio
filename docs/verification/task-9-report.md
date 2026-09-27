# Task 9 quality, performance, offline and documentation report

Date: 2026-09-05  
Status: **ACCEPTED**; final controller evidence and Astra specification/code-quality review passed

## Scope and evidence boundary

Task 9 starts from the accepted Task 8 working tree at `b669b7c57937bb74b887774a9ca73b5d4a81afed` plus the uncommitted upgrade. It addresses quality gates, dependency advisories, startup assets, PWA cache ownership, optional network content and public documentation. No commit, push, deployment, hardware test, human listening session or assistive-technology session was performed.

The implementation worker ran source, unit, type, lint, clean-install and production-build checks. The controller owns acceptance browser execution; the explicitly authorized implementation-worker A/B/C smoke is recorded only as supporting evidence. Browser conclusions are included only for completed production runs, and service-worker readiness or a generated `sw.js` alone is not accepted as offline proof.

## Recorded baseline

The frozen post-Task 8 production entry points were:

| Artifact | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Main JavaScript | 1,064,407 | 300,865 |
| Main CSS | 872,861 | 105,963 |

The complete post-Task 8 generated inventory is retained in `task-9-post-task8-assets.json`. It contains 22 generated JS/CSS/font/HTML files and 2,689,130 raw bytes, including old duplicate generated files; it is an artifact inventory, not a claim that all 22 resources were requested during first paint. The baseline build transformed 618 modules and generated 36 precache entries totaling 2,780.77 KiB.

The installed dependency audit reported 35 advisories: 4 critical, 21 high, 8 moderate and 2 low. These were package-advisory counts across production and development tooling, not evidence that each issue was exploitable through the browser application. Post-Task 8 lint reported 341 errors and 20 warnings. Task 8 had 774 tests, including 15 tests that mocked the complete `VirtualMidiKeyboard` component under test and were removed as misleading coverage during this task.

The production offline baseline failed in Chromium: the service worker reached `activated`, but CacheStorage remained empty and an offline reload ended with `ERR_INTERNET_DISCONNECTED`. Generated icon URLs appeared twice with conflicting revision forms. The reproducible evidence is `/tmp/opstudio-offline-baseline.log` and `/tmp/opstudio-offline-baseline2.log`.

## Security and optional network content

The Patreon loader no longer passes remote HTML into React. It parses documents with `DOMParser`, extracts plain text, and accepts only HTTPS links on `patreon.com` or its subdomains. Scripts, styles, event attributes and non-Patreon or non-HTTPS links cannot become rendered markup or navigation targets. The former static posts labelled “recent” were removed. A failed live request now produces an explicit unavailable state while retaining Joseph Holland's direct Patreon link.

Response intake counts encoded bytes while streaming and cancels the reader after 1,000,000 bytes. The fallback path for environments without a readable stream validates UTF-8 byte length after reading; only the streaming path bounds allocation during intake. Tests cover malicious allowed-element attributes and URLs, plain-text rendering, malformed responses, proxy failure and an oversized streamed response.

## Test integrity and library readiness

The global `AudioBuffer` test double accepts the native options-object constructor and a positional convenience form used by existing tests, validates dimensions, provides independent channel arrays, and implements `copyFromChannel` and `copyToChannel` ranges. AudioContext doubles used with `new` are constructible functions under Vitest 4.

The first full upgraded unit run is deliberately retained at `/tmp/opstudio-task9-first-full-unit-failure.log`: 725 passed and 17 failed. Sixteen failures came from non-constructible arrow-function AudioContext doubles. One capacity test reused a Vitest-wrapped allocator whose inherited call history made the rejected allocator appear called; the admission calculation itself did not change. Focused regressions passed after using constructible native-shaped doubles and a fresh allocator. The first corrected full run passed 743/743; the latest complete full run after the later correction rounds passed 755/755.

The `LibraryPage` test context now has a stable dispatch identity and resolves controlled reads within the test update boundary. Production list reads use a latest-request generation so stale completion cannot replace newer data, and the redundant delayed mount read was removed. Component tests assert exact date order, use the accessible Load operation, drive a real audio-bearing decode failure, require dispatch of a failure notification with no restore, and confirm that an open Load decision still restores its original preset after a background refresh replaces the visible list. This closes the source-supported readiness hazards. It does not establish the cause of either the old intermittent unit failure or the historical Firefox Load timeout; that historical browser cause remains unproven.

The file that replaced `VirtualMidiKeyboard` with a mock of itself was deleted. Placeholder `expect(true)`, swallowed asynchronous checks and seven tests that reimplemented or cloned their own patch-generation result were removed or replaced by observable component/domain assertions. The round-1 suite contains 76 files and 744 tests.

## Dependency disposition

Dependencies were selected from affected advisory ranges, current package metadata and primary documentation. No `npm audit fix --force` or unrelated React/framework migration was used.

| Disposition | Packages and reason |
| --- | --- |
| Removed as unused | `carbon-components`, `react-icons`, standalone `jest`, and redundant `@types/uuid` had no current source, script or config imports. |
| Removed after code replacement | `axios` was used only by the optional Patreon loader; native bounded `fetch` replaced it. |
| Browser/runtime retained | React 19.1, React DOM 19.1, JSZip 3.10.1, Carbon React/styles, Font Awesome, UUID 11.1.1, WebMidi 3.1.16. |
| Build/test updated | Playwright 1.63.0, Vitest/coverage/UI 4.1.6, Vite 7.3.6, Vite PWA 1.3.0, Sharp 0.35.4, Sass 1.104.0, TypeScript ESLint 8.69.0, ESLint 10.10.0, `@eslint/js` 10.0.1 and React Hooks plugin 7.1.1. |

An intermediate clean install selected ESLint 9.39.5 but emitted its unsupported-version notice. Current official ESLint documentation identifies the v10 flat configuration line, while the selected TypeScript ESLint and React Hooks releases declare compatible ESLint 10 peers. ESLint was therefore advanced to 10.10.0; this was a support correction rather than an advisory claim. Its Node requirement is recorded in `package.json` as `^20.19.0 || ^22.13.0 || >=24`, and CI uses Node 22.

React Hooks 7's broad recommended preset also enables optional React Compiler diagnostics, while this application does not configure React Compiler. The flat configuration explicitly retains the established correctness gates, `rules-of-hooks` and `exhaustive-deps`, as errors. It does not disable or exclude old findings. All previously reported hook dependencies and lifecycle cleanup findings were corrected, and ESLint 10's additional core findings were fixed by retaining caught-error causes and removing unused assignments.

Final `npm ci` installed 655 packages and audited 656 with zero advisories. Final audit metadata reports 82 production, 636 development, 105 optional and 740 total dependency relationships. npm 11 displays two Sharp optional-support artifacts as extraneous in `npm ls` even after a clean install; they are not declared application dependencies and do not produce an audit advisory. Workbox currently emits a `glob@11.1.0` deprecation notice during install despite a zero-advisory graph; it arrives through `vite-plugin-pwa -> workbox-build`.

Current documentation was consulted through Context7 for ESLint flat configuration, Vite PWA registration/cache behavior, Vitest migration behavior, React Refresh and Web Audio constructor/copy and suspend/resume contracts. Package registry metadata was used where a plugin did not expose a useful Context7 result.

## Startup assets and PWA ownership

The production entry imports only the Carbon Sass components used by the application and the three Font Awesome families it references. Remote Google Fonts and the full Carbon and Font Awesome bundles were removed. Feedback, Donate, Library and Multisample surfaces are lazy chunks while their navigation remains available offline through precache.

| Artifact | Baseline raw/gzip | Frozen raw/gzip | Reduction |
| --- | ---: | ---: | ---: |
| Main JavaScript | 1,064,407 / 300,865 | 895,232 / 259,899 | 15.89% / 13.62% |
| Main CSS | 872,861 / 105,963 | 270,196 / 48,526 | 69.04% / 54.20% |

The round-4 build transforms 571 modules. The main JS chunk remains 895.23 kB and triggers Vite's 500 kB advisory, so the report claims a measured reduction rather than a startup-speed guarantee. The controller separately recorded five requested production resources and 1,360,447 transfer bytes on its uncompressed local server, excluding the document and later service-worker precache requests. That is neither a gzip total nor a startup-time comparison.

There is now one generated service worker and one generated web manifest. The unused public worker, which deleted every other cache on the origin, and the duplicate public manifest were removed. The PWA uses prompt registration and a distinct application activation message; the application does not send Workbox's unconditional `SKIP_WAITING` message. The waiting worker counts all in-scope window clients and activates only when the requesting tab is the sole open window. With another Studio tab open it remains waiting, reports the block to the requester and requires the user to close other Studio tabs and explicitly retry. Each tab reloads only after its own consent, so another tab cannot force a deferred editor to navigate.

Each build receives a timestamp plus cryptographically random UUID cache identity even when package version or CI revision is unchanged. Vite emits a uniquely named lifecycle asset containing that same worker-owned identity, and the build verifier rejects a mismatch between lifecycle and cache identity. The active worker searches its own revised precache first when an old document requests a lazy or stable asset, with revision-query matching for Workbox cache keys.

Scope-owned lifecycle metadata records only the current and actual previous activated builds; an activation always makes its own worker identity authoritative. Before a waiting worker can prune, MessageChannel replies must show that metadata's current identity matches the browser's live active-worker slot, that the requesting worker itself occupies the live waiting slot, and that no worker is installing. The same metadata and all three worker slots are reread immediately before every deletion. Missing, legacy, installing or changed identity stops deletion and returns an explicit `pruned:false` result. While an update waits, current, previous and waiting can therefore occupy three application precaches. After activation, cleanup returns to current and previous. The first upgrade from a worker without identity replies can temporarily retain additional caches until a later activation establishes complete ownership; this is a deliberate no-prune fallback, not a universal hard cache-count promise. Unrelated caches are never candidates. A window opened during the short client-count-to-activation interval is a remaining service-worker platform race and should save/recover work normally.

The sole-client decision is serialized with lifecycle ownership work, but that queue completes before `skipWaiting()` is invoked. The update message's `waitUntil` still covers the activation request itself. This avoids a service-worker lifetime cycle in which the message waited for activation while the activation event waited behind the message in the same queue. Worker object references are also captured and compared again after asynchronous identity replies, so a slot replacement invalidates the operation even if the old worker returns a valid ID.

Every precache entry, including same-name public icons and preview images, carries a content revision. `npm run build` executes `verify:pwa`, which rejects a missing build-owned lifecycle script, a cache/lifecycle identity mismatch, missing active/waiting/installing slot checks or sole-window gates, a missing precache, duplicate URLs, or a stable public asset without a revision. The round-4 build passed with 32 unique URLs and 10 stable public assets with revisions. Production installation, offline editor workflows, retained recovery and optional-network fallback passed the controller's round-1 proof; final controlled multi-build activation remains a controller-run gate after the round-4 lifecycle correction.

The first controller browser matrix on the initial Task 9 freeze passed 111 cases, failed 12 and retained 2 deliberate mobile skips. Nine Firefox cases lost drum-pad targets while delayed MIDI denial caused repeated initialization and component replacement; two Chromium-family cases had stale expectations after M4A became the ninth supported codec; one Chromium sound-trigger case lost synthetic input before Arm. A controlled delayed-denial probe confirmed six permission requests and 288 removed pad nodes. Automatic MIDI initialization is now owned once per document, explicit retry remains available, and drum pads retain node/focus/pressed-state identity across rerenders. The codec assertions now require the actual nine-format result.

The round-1 controller matrix closed those pad and codec failures but both Chromium recording cases failed: manual capture reported `Capture frame discontinuity: expected 128, received 640`, and sound-triggered capture found its synthetic input closed before Arm. Diagnostic reruns did not reproduce either failure: serial recording passed 2/2, a two-worker run passed 2/2, a five-worker Chromium project run passed both recording cases, and an eight-repeat/five-worker recording-only run passed 16/16. The trace did establish that Chromium created the AudioContext already running while the worklet module and graph were still being constructed. Round 2 now suspends that clock, constructs and connects the processor graph and message path, then resumes before exposing monitoring. Cancellation and setup rejection release the stream, context, source and node at each boundary. Processor handling of observed empty frames and unseen frame jumps during active capture is unchanged. This is a source-supported startup sequencing correction; because the original failure did not occur during the diagnostic run, it is not claimed as a captured proof of the prior discontinuity's exact cause. The final controller full matrix passed all 123 applicable cases with two deliberate mobile skips, including both Chromium recording cases; final cache-race proof remains separate.

The initial two-tab A-to-B update proof confirmed that tab B, after choosing Later, navigated and lost its 240-frame local draft when tab A chose Update now. The first attempt also showed the notice intercepting the modal's Save markers pointer. The round-1 correction gave the notice existing opaque light/dark theme tokens and placed it below owned dialogs. Its A-to-B controller proof then passed blocked activation, retained draft, old-build offline lazy Library loading, explicit retry, exact saved markers and PCM, changed same-name static content, unrelated-cache preservation and offline B startup. A parallel B/C build exposed an actual same-millisecond cache-ID collision, and a sequential waiting C left superseded B cached. Round 2 replaced the timestamp-only ID and activation-only cleanup, but review found two remaining races: stale B could prune while C was installing, and stale B metadata could veto natural C activation before later D cleanup. Round 3 added live active/waiting identity handshakes, an installing-slot veto, final slot rechecks and activation-authoritative metadata. Its first ordinary A-to-B production rerun timed out because the update message awaited `skipWaiting()` while holding the same lifecycle queue needed by activation; a diagnostic attempt was terminated rather than reported as complete. Round 4 removes that queue cycle. The implementation worker's subsequent A-to-B-to-C production smoke passed draft blocking, old lazy loading, exact saved PCM/markers, changed static content, unrelated-cache preservation, offline B startup and two-cache B/C cleanup. The controller independently repeated the ordinary flow and the held-install/natural-activation race: all passed, including `pruned:false` while C installed, natural C ownership, D waiting with active C and offline lazy C, and bounded replacement of A+B by A+C under same-millisecond but distinct UUID identities.

## CI and public documentation

The checked-in workflow runs clean install, typecheck, ESLint, unit tests, the production build, Chromium production E2E and deterministic fake-input recording on pushes and pull requests. Manual and scheduled runs add the configured Chromium, Firefox, WebKit and mobile-emulation production matrix. The recording job uses a generated WAV fixture and makes no real-microphone claim.

README and in-app links identify this as the `sscommander79` fork while retaining Joseph Holland's authorship, upstream link and MIT notices. Documentation distinguishes device ZIPs from `.opstudio` v1 backups; explains local IndexedDB, quota/eviction, decoding and permission limits; documents the prompted update flow; and links current OP-XY COM/MTP transfer guidance. `CHANGELOG.md` marks 0.16.0 as an unreleased local candidate. `BUGS.md` remains an attributed historical upstream snapshot and points to current acceptance and device-limit records.

## Local verification at freeze

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 655 packages installed, 656 audited, zero vulnerabilities |
| `npm run typecheck` | PASS after round-4 corrections |
| `npm run lint` | PASS after round-4 corrections; zero errors and zero warnings |
| `npm test` | PASS after round-3 corrections; 76 files, 755 tests, 13.26 seconds while run concurrently with type/lint |
| Focused PWA unit | PASS after round-4 corrections; 16 tests including the activation lifetime cycle and post-identity slot replacement |
| `npm run build` | PASS after round-4 corrections; 571 modules, PWA 32 unique entries / 2,156.85 KiB, UUID/worker-slot ownership and stable-asset revision verifier passed |
| `npm audit --audit-level=moderate` | PASS after round-2 corrections; zero vulnerabilities |
| `git diff --check` | PASS |

Initial freeze logs remain at `/tmp/opstudio-task9-final-*`. Round-1 logs are `/tmp/opstudio-task9-round1-typecheck.log`, `/tmp/opstudio-task9-round1-lint.log`, `/tmp/opstudio-task9-round1-full-unit.log`, `/tmp/opstudio-task9-round1-build.log` and `/tmp/opstudio-task9-round1-audit.log`. Round-2 logs are `/tmp/opstudio-task9-round2-full-unit.log`, `/tmp/opstudio-task9-round2-typecheck-final.log`, `/tmp/opstudio-task9-round2-lint-final.log`, `/tmp/opstudio-task9-round2-audit.log` and `/tmp/opstudio-task9-round2-build-final.log`; the post-correction recording stress result is `/tmp/opstudio-task9-round2-recording-stress-fixed.log`. Round-3 RED, targeted, full-unit, type, lint and build logs are `/tmp/opstudio-task9-round3-pwa-red.log`, `/tmp/opstudio-task9-round3-pwa-target.log`, `/tmp/opstudio-task9-round3-full-unit.log`, `/tmp/opstudio-task9-round3-typecheck.log`, `/tmp/opstudio-task9-round3-lint.log` and `/tmp/opstudio-task9-round3-build.log`. Round-4 RED, targeted, type, lint, build and implementation-worker production smoke are `/tmp/opstudio-task9-round4-pwa-red.log`, `/tmp/opstudio-task9-round4-pwa-target.log`, `/tmp/opstudio-task9-round4-typecheck.log`, `/tmp/opstudio-task9-round4-lint.log`, `/tmp/opstudio-task9-round4-build.log` and `/tmp/opstudio-task9-round4-update-smoke.log`; frozen runtime hashes are `/tmp/opstudio-task9-round4-runtime-sha256.txt`. An accidental duplicate `--run` CLI invocation failed before test discovery and was replaced by the clean `npm test` result; it is not application evidence.

## Final verification and limits

- Controller production browser matrix: PASS, 123/123 applicable cases with two deliberate mobile skips.
- Real production cache installation, cold offline reload and offline import/edit/undo/redo/library/recovery/backup/device-ZIP flow: PASS in the controller's retained round-1 proof.
- Controlled same-origin A-to-B-to-C update, retained open work while waiting, refreshed same-name static asset and bounded cleanup: controller independent round-4 proof PASS.
- Held-install/natural-activation cache race and superseded waiting-generation checks: PASS; the waiting artifact uses the literal successful status `BOUNDED`.
- Rendered layout/visual regression check after CSS and dependency changes: PASS with no new confirmed visual blocker; the wide Table retains intentional inner horizontal scrolling without document-level overflow.
- Retained Demo and Focus production checks: PASS in Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6.
- Independent Task 9 review: specification-compliance PASS and code-quality PASS; R9-1 through R9-7 closed.
- Human listening, real microphone fidelity, real MIDI devices, assistive technology and physical OP-XY import/playback: unperformed; use `device-validation-checklist.md` for future evidence.

The durable controller packet is `task-9-final-controller-evidence.md` with machine-readable artifacts, logs, exact local harness snapshots and checksums in `task-9-final-evidence/`.
