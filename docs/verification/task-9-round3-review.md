# Task 9 round 3 independent re-review

Date: 2026-09-05. Reviewer: Astra. Baseline: `/tmp/opstudio-task9-before-round3`. Scope: exactly three frozen files in `task-9-round3-review-change-index.json` and `task-9-round3-review-package.diff`: cache lifecycle, generated-build verifier and lifecycle unit tests. All three current hashes matched the packet at inspection.

**Current specification assessment: CHANGES REQUIRED for explicit-update activation (R9-7 below). Code-quality assessment: CHANGES REQUIRED for the lifecycle queue cycle. The two original remaining R9-5 defects pass source and adversarial production review; whole Task 9 is not accepted.** R9-1 through R9-4 and R9-6 remain closed under the prior reviews. No application/audio change warrants repeating the entire browser matrix for this three-file cache correction.

This reviewer read source and existing logs and wrote this document only. No source, test, configuration, build, browser, commit, push, deployment or new-agent operation was performed.

## R9-5 correction assessment

`OPSTUDIO_CLAIM_WAITING` no longer writes a persistent waiting identity. The pruning worker obtains identities from the registration's actual active and waiting worker objects through MessageChannel replies. It requires current activation metadata to match the active worker, itself to occupy the waiting slot, and no installing worker to exist. A worker in the installing slot causes an early no-prune return. Before each deletion, cleanup resamples metadata and worker slots and aborts if either differs from the original snapshot. The candidate set excludes the recorded current/previous builds and the verified waiting build.

This corrects the reviewed installing-C path: a claim sent to B while C installs cannot classify C as an unowned cache and delete it. A stale B claim after C occupies the waiting slot fails the waiting-identity comparison. Waiting claims no longer compete to overwrite shared metadata, so the previous per-worker serialization limitation does not corrupt the active/waiting record.

The `activate` event now records its own build as current and the previously recorded current as previous without consulting stale waiting metadata. This corrects the reviewed natural-C path: C activation cannot be vetoed by a stored B waiter, and later D cleanup verifies C against the actual active slot. Legacy metadata without established ownership defers deletion; a later activation establishes the protected previous generation. Application cache naming and unrelated-cache preservation remain unchanged.

Identity requests time out after 500 ms, reject unavailable/malformed replies, and close both local channel endpoints through their common completion path. Identity responses are handled outside the lifecycle queue, avoiding a queue waiting on its own queued reply. A false/unknown identity conservatively retains caches. The generated-build verifier adds checks for the installing veto, actual-active/metadata match and final slot comparison; its string checks supplement, rather than replace, the behavior tests and controller production proof.

## Nonblocking limitation

`workerSlots()` captures active/waiting worker objects before awaiting their identity replies and checks `registration.installing` again afterward. It does not also compare those captured object references with the registration's active/waiting references after the replies. Repeated snapshots before deletions address the reviewed normal update paths, but the current tests do not simulate a slot transition within an identity exchange. No concrete normal-path P1/P2 deletion trigger was established for this narrower interval during this review, and it is not presented as a demonstrated runtime failure. The existing client-count-to-activation window remains a separate disclosed platform race; neither review nor documentation should claim atomic lifecycle transactions.

The channel fake's close method is a no-op, so the lifecycle tests do not independently prove port closure or timeout behavior. Those paths were checked directly in source. This is an evidence boundary, not a claim of failed production behavior.

## Verification inspected

- `/tmp/opstudio-task9-round3-pwa-red.log`: the two new regressions failed against the prior lifecycle. The installing test actually deleted C; natural C activation actually retained stale A/P/B metadata. Five existing tests passed. This is meaningful failure evidence for both agreed defects.
- `/tmp/opstudio-task9-round3-pwa-target.log`: **14 tests passed across 2 files** after correction.
- `/tmp/opstudio-task9-round3-full-unit.log`: **755 tests / 76 files passed**, 13.26 seconds.
- `/tmp/opstudio-task9-round3-typecheck.log` and `/tmp/opstudio-task9-round3-lint.log`: completed without diagnostics.
- `/tmp/opstudio-task9-round3-build.log`: **32 unique precache entries, 10 revised stable public assets**, UUID identity verifier passed.
- Retained round-2 full browser result: **123 passed / 2 deliberate skips**, including both Chromium recording cases, with no concurrent controller build/audio/browser work. Round 3 changes only the lifecycle, its verifier and unit tests, so no full application-matrix rerun is required absent new contrary evidence.

The controller reports four A/B/C/D production artifacts with distinct UUID identities and is running held-installing-C, natural-C activation, deferred/explicit update and offline checks. Their final outcomes will be appended before final acceptance. Human listening, physical OP-XY, real microphone fidelity, real MIDI devices, assistive technology, remote CI and release actions remain unperformed.


## Controller adversarial production proof

Inspected `/tmp/opstudio-task9-cache-race-proof.json` from Chromium **153.0.8010.12**, overall **PASS**:

- During held C installation, the old B claim replied `OPSTUDIO_WAITING_CLAIMED` with `pruned:false`; C's installing cache survived.
- The controller paused page scripts until C installed, then closed both pages before any C waiting claim. Natural activation recorded C as current.
- With D waiting, the actual active C cache survived and C's lazy Library loaded offline.

This independently confirms the two source corrections in real production workers rather than only the unit model. **R9-5 is closed for its reviewed defects.** The asynchronous object-reference observation remains nonblocking and unproven; it is not a basis for speculative additional churn. Final whole-Task-9 acceptance still awaits the controller's complete A/B/C update/offline/visual reconciliation.


## R9-7 — P2: Release the lifecycle queue before awaiting explicit activation

**Anchors:** `scripts/pwa-cache-lifecycle.js:137–144`, `:150–160`.

The ordinary production A/B update proof failed after the other tab closed and the requester selected Update now. The document did not finish loading within 30 seconds (`/tmp/opstudio-task9-round3-update-proof.log`). Earlier portions still passed: deferred draft remained visible, multiple tabs blocked activation, and the old lazy Library loaded offline. The adversarial natural-activation proof therefore does not establish the explicit-update path.

The activation message is serialized and awaits `self.skipWaiting()`. The subsequent activate event registers a lifetime promise for an operation queued behind that same serialized message. This creates a cycle when skipWaiting immediately starts activation: its resolution waits for activation work that is queued behind its own unresolved operation. The [Service Workers skipWaiting algorithm](https://w3c.github.io/ServiceWorker/#service-worker-global-scope-skipwaiting) invokes Try Activate before resolving the returned promise, and the [activation algorithm](https://w3c.github.io/ServiceWorker/#activation-algorithm) waits for activate-event lifetime work. These are current normative algorithm references; production state diagnostics will further distinguish this cycle from a separate navigation/harness problem.

Finish the serialized client/ownership decision before invoking and awaiting skipWaiting outside that queue. Retain the explicit sole-requester gate and message event lifetime/error handling. A regression must make the skipWaiting promise depend on the actual queued activation completion rather than returning an immediately resolved mock; the ordinary production explicit-update proof must pass after correction. Natural activation bypasses the activation-message queue, explaining why its separate proof can pass.

**Specification and code-quality acceptance remain withheld.** This source-supported cycle is separate from the now-corrected cache ownership subcases and from the nonblocking asynchronous slot-reference observation. No runtime change was made by this reviewer.


The controller's diagnostic retry did not produce a worker-state snapshot: querying the registration hung while navigation was pending, and the process was terminated. Preserve the original 30-second load timeout as actual runtime evidence and the source/standards cycle as the causal analysis; do not claim a captured stalled-worker state. Round 4 is limited to R9-7's queue-lifetime correction and its regression, with an optional small worker-object recheck for the already noted identity interval. No additional failing-baseline browser run is required before correcting this demonstrated source cycle.
