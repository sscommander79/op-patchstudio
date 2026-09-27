# Task 9 round 1 independent re-review

Date: 2026-09-05. Reviewer: Astra. Baseline: `/tmp/opstudio-task9-before-round1`; frozen package: `task-9-round1-review-change-index.json` and `task-9-round1-review-package.diff`. All 27 indexed current paths matched their recorded hashes at inspection. Some package entries have an absent baseline rather than representing newly authored source; the existing license and TypeScript configuration were not treated as newly introduced features.

**Specification compliance: CHANGES REQUIRED at this checkpoint. Code quality: CHANGES REQUIRED for R9-5 (superseded waiting caches) and confirmed R9-6 (colliding build IDs).** R9-1, R9-2 and R9-4 are corrected on source inspection; R9-3's per-tab consent and conservative A/B activation now pass the controller proof; the extended cache lifecycle remains blocked by the findings below. New R9-5 concerns superseded waiting caches, not the already fixed immediate draft reload. The round-1 full browser gate finished 121 passed / 2 recording failures / 2 skips; remaining recording/offline/C/visual evidence is controller-owned.

No source, tests, configuration, scripts or public assets were changed by this reviewer. No test or browser run was started. Only this review document was written.

## Finding requiring correction

### R9-5 — P2: Retire superseded waiting-build caches while preserving the active build

**Anchors:** `public/pwa-cache-lifecycle.js:17–23`; `vite.config.ts:9–10`, `:21–24`.

Every build has a distinct precache name, but cleanup occurs only on an `activate` event. When A is active and two tabs keep an update deferred, B can install and wait, then a subsequent C worker can replace B as the waiting worker. B's service worker becomes redundant, but its CacheStorage entries persist: neither B nor C has activated, so the pruning handler has not run. D and later updates repeat this pattern. The sole-window gate correctly prevents unsafe activation but consequently prevents the only cache-retirement operation too.

This leaves application cache generations unbounded for a normal long-lived multi-tab session and contradicts the agreed bounded-retention policy. It can consume increasing origin storage while the user intentionally preserves working drafts. Merely keeping the newest two caches during installation would be an unsafe correction because it could delete still-active A.

Track which application cache belongs to the active worker, protect the required active/previous generation and the newest installing/waiting generation, and retire superseded never-activated build caches under that ownership policy. Preserve unrelated caches and do not evict a live deferred build. Add a deterministic lifecycle regression for A active, B waiting, C/D replacing the waiter without any activation, then the ordinary sole-tab activation/retirement sequence. The current lifecycle tests dispatch `activate` and cannot detect this missing path.

**Evidence:** direct source control-flow and build-prefix inspection. The controller has been asked to capture C installation while A remains active; no new browser execution was performed by this reviewer. The final bound may distinguish one waiting cache from the two retained activation/reload caches, but it must be finite and stated accurately.

## Original findings and bounded notes

| Item | Source disposition | Remaining evidence |
| --- | --- | --- |
| R9-1 misleading tests | Corrected. Seven generator simulations/cloned-base comparisons were removed; retained tests inspect hook input and real integrity suites remain. Library date sorting asserts exact fixture order; a constructible throwing context and legacy audio-bearing preset exercise actual Load failure with an error notification action and no RESTORE_LIBRARY. Controlled refresh replaces rows while the original Load confirmation and its drum restore remain owned. | Worker full unit log inspected; no additional reviewer run. |
| R9-2 notice transparency/interception | Corrected in source. Existing opaque `--studio-panel`/`--studio-recess` tokens replace undefined variables. Notice z-index is 9000, below waveform/recording dialogs at 9999 and shared backdrops at 10000. | Controller light/dark and normal pointer Save markers proof pending. |
| R9-3 external forced reload | Materially corrected. Stable registration default; per-tab reload consent; distinct `OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT` message; blocked reply clears consent and exposes explicit retry. App never calls the returned Workbox updater or sends default SKIP_WAITING. Worker rejects activation when more than one window is present. Separate R9-5 bounded-waiter retention remains. | Controller two-tab blocked-update/draft retention, close-other/retry activation, static revision, old lazy route and repeated-build checks pending. |
| R9-4 MIDI churn and pad replacement | Corrected. Both instrument auto-init effects check support/error and use `{automatic:true}`; the hook owns one automatic attempt per document across instances, with explicit initialization still available. OPXY keys are rendered as keyed ordinary elements rather than newly created component types. Tests assert exact pad-node/focus identity and pressed/released state plus denied-attempt and explicit-retry ownership. | Full browser matrix and bounded delayed-denial production probe pending. |
| Canvas callback churn | Corrected. Color snapshot is memoized on actual theme revision. Existing theme-change redraw mechanism remains. | Controller theme visual regression pending; no claimed measured frame-rate improvement. |
| Patreon URL and AudioBuffer wording | Corrected in report: apex/subdomains HTTPS policy and options-object constructor versus positional test convenience are now distinguished. | None from this note. |
| Donation attribution | Corrected. Copy names Joseph Holland as beneficiary and button says “buy Joseph a coffee”; real excerpt/link protections remain unchanged. | None from this note. |
| New browser codec support | The two stale Chromium-specific eight-file assertions now expect the observed nine-file result, including actual M4A. Existing archive/metadata/Undo assertions remain. | Full configured current-engine matrix pending; remote CI/platform codec behavior remains unexecuted. |
| Isolated recording failure | No speculative recording edit. Initial failure and isolated passing repeat are both retained; cause remains unconfirmed. | Full matrix and deterministic production fake-input gate are controller-owned. |

## Activation and cache boundary observations

The generated worker still contains Workbox's unconditional default SKIP_WAITING listener, but application code does not invoke that path; its custom message uses the gated lifecycle. This follows the selected design rather than falsely claiming that adding a second listener neutralizes Workbox's default listener.

Revision-bearing cache entries are looked up with `ignoreSearch:true`, addressing the original `__WB_REVISION__` key mismatch. The build's time suffix was intended to change prefixes when package version or CI SHA does not change, but the controller later demonstrated an actual same-millisecond collision (R9-6 below). Activation keeps the last two application precaches; unrelated cache names without the application's prefix are left untouched. These changes protect the tested single-step activation/reload case but do not close R9-5's repeated waiting installations.

The current worker uses `clients.matchAll({type:'window', includeUncontrolled:true})` and checks only count, not the requesting client's identity. With `includeUncontrolled`, this is a same-origin window count, not an explicit application-document/scope filter. The report should describe that conservative count accurately; if other documents are supported on the same origin, define and test the app-document filter. Requiring the one counted client's ID to equal `event.source.id` would also make the stated “requesting tab is sole” condition explicit. These are ownership-hardening/documentation notes at this checkpoint, separate from the confirmed retention finding. A tab opening during the count-to-activation interval remains the disclosed platform race; no atomic cross-tab guarantee is claimed.

The Library unit failure test verifies dispatch of a notification, not rendered notification visibility, because its context dispatch is mocked. The report should use that precise evidence wording. This does not reopen R9-1: the failure path and absence of restore are now meaningful assertions.

## Verification inspected

- `/tmp/opstudio-task9-round1-full-unit.log`: **76 passing files, 744 tests, 7.01 seconds**.
- `/tmp/opstudio-task9-round1-build.log`: build completed; verifier reports **32 unique precache URLs and 10 revised stable public assets**.
- `/tmp/opstudio-task9-round1-lint.log`: ESLint completed without diagnostics; worker reports zero errors/warnings.
- `/tmp/opstudio-task9-round1-audit.log`: **0 vulnerabilities**.
- Typecheck success is recorded by the worker in `task-9-report.md`; source/testing/runtime fingerprints remain frozen.

The controller's pending production results will be appended with their exact outcomes. Passing local tests/build do not establish full browser/offline/update acceptance, and no hardware, assistive-technology, human listening, remote CI, commit, push or deployment claim is made.

## Additional confirmed build-identity finding and runtime checkpoint

### R9-6 — P2: Use collision-resistant build identity rather than a millisecond timestamp

**Anchor:** `vite.config.ts:9–10`.

The controller built the B and C proof artifacts concurrently. Both evaluated `Date.now()` in the same millisecond and received the identical prefix `op-patchstudio-v0.16.0-mtoh83df` (A was `op-patchstudio-v0.16.0-mtoh83dc`). Distinct builds consequently shared one precache and invalidated the claimed build-generation isolation. `/tmp/opstudio-task9-round1-update-build-collision.json` retains the actual A/B success and subsequent C retirement failure. The initial waiting-C cache probe also saw only two names because this collision masked the separate superseded-waiter issue.

This is an actual generated-artifact identity collision, not a browser-harness assertion typo or evidence that C was a separately retained generation. Replace the timestamp uniqueness assumption with a collision-resistant identifier such as a build-generated random UUID or a complete artifact-content digest. Verify that concurrently generated distinct builds have distinct cache identities and repeat the generation-retirement proof with those artifacts. Do not make the probe pass merely by scheduling production builds farther apart.

The first round-1 full matrix completed **121 passed / 2 failed / 2 deliberate skips** in 1.3 minutes (`/tmp/opstudio-task9-round1-full-browser.log`). All prior pad-detachment and codec-count failures closed. Both Chromium recording cases failed: manual capture reported `Capture frame discontinuity: expected 128, received 640`, and the sound-trigger case lost its synthetic input before arming. Concurrent A/B/C builds and offline work were running during this matrix, so CPU contention is a possible confounder, not an established cause. A serial diagnostic is controller-owned; these cases are not accepted on the basis of the previous isolated pass.

The current processor already invalidates the timeline only after an observed empty callback in idle monitoring; active and unseen gaps remain rejected. Source inspection shows that capture-session setup resumes the context before creating/connecting the graph, then reports monitoring before explicit processor-format/first-frame readiness. A diagnostic must distinguish graph-start ordering, requested/core state at the first gap, valid versus empty input callbacks and actual currentFrame progression. Do not widen allowed gaps or silently rebase active/unseen frame discontinuities to obtain a passing test.

The controller reports the offline manual-take/Cancel flow passed with actual addModule instrumentation. An earlier expectation that a page-level response event would expose the worklet request was corrected in the harness; that missing page event is not evidence that the processor failed to load. The full updated offline evidence remains to be reconciled.

The A/B section of the production update proof passed: waiting preserved the draft; two tabs blocked activation; the deferred tab stayed on A with its sentinel/draft visible; its old lazy Library loaded offline; after closing the other tab and explicitly retrying, B retained the saved draft/audio and refreshed the same-name static asset; unrelated cache data survived and B cold-started offline. These results close the immediate two-tab reload/normal activation behavior of R9-3, while R9-5 and R9-6 prevent final acceptance of the extended cache-lifecycle contract.

## Final round-1 verdict and reconciled controller evidence

**Specification compliance: CHANGES REQUIRED. Code quality: CHANGES REQUIRED.** Original R9-1 through R9-4 are closed for their reviewed defects. Confirmed P2 R9-5 and R9-6 remain open, and the two actual Chromium recording failures remain an unresolved acceptance gate requiring bounded diagnosis. No permissive active/unseen-gap change is approved or recommended.

Retained evidence is now under `docs/verification/task-9-round1-evidence/`:

- `superseded-waiting-cache.json`: after C was rebuilt separately to avoid the timestamp collision, A active plus superseded waiting B plus newest waiting C left **three application precaches** without activation. This confirms R9-5 independently of R9-6; subsequent waiting releases would repeat the source-proven accumulation path.
- `update-proof-build-collision.json`: A/B consent, retained draft/sentinel, offline old lazy Library, explicit sole-tab retry, exact saved data, refreshed static asset, unrelated-cache preservation and B offline cold start pass; the C retirement failure remains the actual shared-build-ID collision described in R9-6.
- `midi-proof.json`: delayed denial now produces **one request and zero removed pads**; the controller's pointer/focus/arrow checks preserve the same pad node. Together with the closed full-matrix pad failures, this closes R9-4's actual lifecycle/interaction defect.
- `offline-proof.json`: **PASS** for cold offline new-document start; import, trim, name, Undo/Redo and autosave; reload recovery with exact source/PCM/trim; library save/load; actual sparse device ZIP; real worklet manual take with Cancel stream cleanup; and donation/feedback fallback. The device WAV has 44,100 Hz / 16-bit output, 8,820 frames and start frame 882. Actual native addModule resolution and its cached source URL were instrumented, without replacing processor loading. The earlier page-response-event assumption was a harness issue, not a failed processor load.
- `visual-geometry.json`: controller-inspected 1440px and 320px light/dark screenshots have no horizontal document overflow. Notice backgrounds are opaque light RGB(250,249,244) and dark RGB(34,37,33), with z-index 9000; normal-pointer modal Save markers also succeeds in the A/B proof. This closes R9-2. Broader retained Carbon/landscape/demo/Focus visual coverage still belongs to the final controller freeze.

The **121 passed / 2 failed / 2 skipped** full-matrix result is retained as failed, rather than rewritten using narrower passes. The pending recording diagnosis must distinguish startup graph readiness, actual callback gaps and scheduling contention, preserve the original failure artifacts, and retain exact integrity rejection. A second bounded Sol correction pass for R9-5/R9-6 and recording diagnosis is now underway from `/tmp/opstudio-task9-before-round2`; the reviewer made no runtime/test/config changes.
