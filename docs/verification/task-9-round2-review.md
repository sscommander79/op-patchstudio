# Task 9 round 2 independent re-review

Date: 2026-09-05. Reviewer: Astra. Baseline: `/tmp/opstudio-task9-before-round2`. Scope: frozen round-2 change index/package and the remaining R9-5/R9-6 cache findings, recording setup sequencing, associated tests and documentation. The first packet contained 11 paths; the controller subsequently wrapped the index with baseline/status metadata and included three reporting paths. All 14 indexed current paths matched their recorded hashes at inspection, including the deleted public lifecycle script.

**Specification compliance: CHANGES REQUIRED. Code quality: CHANGES REQUIRED for the remaining R9-5 cache-ownership paths below.** R9-6 is corrected on source inspection. Recording setup is a bounded sequencing/ownership improvement; its original failure's exact cause remains unproven. Controller full-browser and production update/offline results are pending at this checkpoint and will be appended before final acceptance.

This reviewer performed source and existing-log inspection only. No tests, browsers, source edits, configuration changes, commits, pushes, deployments or new agents were run. Only this review document was written.

## R9-5 remains open — P2: Validate actual worker ownership before pruning

**Anchors:** `scripts/pwa-cache-lifecycle.js:44–59`, `:81–86`, `:105–116`; `src/components/common/PWAUpdatePrompt.tsx:14–18`.

The ordinary serial A/B/C/D case is improved: activation records a previous activated generation, a waiting worker writes its own build ID, and pruning retains current/previous/waiting. However, the stored identities are assertions from whichever worker most recently wrote metadata, not verified ownership of the registration's current active/installing/waiting slots. The identity-response handler is not consumed by the cleanup path. `lifecycleOperation` serializes operations within each worker instance only; separate B/C workers can still read and write the same metadata concurrently.

Two concrete paths remain:

1. **An installing C cache can be deleted by a B claim.** With A current and B waiting, start installing C. Its Workbox install creates C's precache before C becomes waiting and receives the window's claim. A new second tab discovering still-waiting B, or a delayed B claim, runs lines 84–86. B writes `waiting=B`, lists C's cache as unprotected, and deletes it. Rereading unchanged metadata does not detect C because the installing worker has not yet announced itself. A stale B operation may also overwrite an already recorded C waiter. The test that manually changes metadata on the third read covers one particular interleaving, not an installing cache with unchanged metadata or two independent worker queues.
2. **Natural activation can leave the actual active build unrecorded.** With metadata `current=A, waiting=B`, let replacement C finish after all app clients close, before any window claims C. C can activate through the normal browser lifecycle. Its activate handler returns at line 108 because metadata still names B. C is now active while ownership still says A/B. A later D claim trusts the stale complete metadata and can delete active C's precache. Even before that deletion, the documented current/previous ownership is incorrect.

These are direct source/control-flow findings, not reviewer-reproduced browser failures. They can defeat offline availability despite a passing sequential A/B/C proof. The fix must establish actual registration ownership, protect an installing generation or defer pruning while installation is unresolved, reject stale claims, and let the authoritative activation event establish the activating build even when a now-stale waiter record exists. Cross-worker arbitration must not be described as guaranteed by a per-worker promise queue. Preserve the intended fail-closed migration behavior and unrelated cache ownership.

Suggested bounded regressions: A active/B claimed, C cache created but C not claimed, then B claim; C must survive. Separately, stale waiting=B followed by natural C activation without a window claim, then D claim; C must be current and retained. Include stale/interleaved B/C claims rather than only a synthetic metadata change during a single operation. The controller owns any production reproduction.

## Corrected and retained behavior

- **R9-6:** `vite.config.ts` uses `randomUUID()` in addition to the version/revision and timestamp. The exact ID is embedded in a uniquely named generated lifecycle asset and matches the Workbox cache ID. The verifier checks UUID shape and matching identities. This removes the demonstrated same-millisecond uniqueness assumption. Independent concurrent-artifact proof remains controller-owned.
- **Explicit update gate:** in-scope window filtering now compares origin/path and requires the sole client's ID to equal the requester. The app still sends only its custom activation message and reloads only with its own consent. The shared default Workbox message is not used by the app. The previously disclosed tab-opening count/activation race remains a platform boundary, separate from R9-5's metadata bugs.
- **Asset fallback:** the runtime handler obtains the generated worker's actual build ID and searches its own precache first, then retained caches. Full request URLs are matched with revision-query tolerance. The lifecycle asset is generated per build, removing the mutable stable imported-script identity problem.
- **Legacy migration:** missing ownership and the first legacy migration defer deletion. A later activation can establish current/previous. The exception to the three-while-waiting/two-after-activation bound is documented rather than concealed. This is sound intent, but does not make stale `complete=true` metadata authoritative.
- **Original R9-1 through R9-4:** round-2 changes do not reopen the previously closed misleading-test, notice rendering/interception, per-tab consent or MIDI/pad identity corrections.

## Recording startup review

`src/audio/recording/captureSession.ts:129–158` suspends an already-running context, loads the worklet, creates and connects source/node with a temporary message handler, then resumes and transfers ownership to the session. Setup attempts now own the created source and node, and cancellation during pending resume disconnects them, closes the port/context and stops the stream. Generation checks remain at asynchronous ownership boundaries. New tests cover suspension cancellation/rejection, pending-resume cleanup and graph-before-resume ordering.

The actual core and processor files are unchanged against the round-2 baseline. No active or unseen frame gap is rebased, discarded or padded. Existing observed-empty idle handling remains unchanged. This is a reasonable bounded startup sequencing correction with no newly identified P1/P2 defect in the reviewed delta. It is not proof that early graph construction caused the historical `expected 128, received 640` failure: pre-change diagnostic stress also passed 16/16. The worker report explicitly preserves that causal limitation.

## Verification inspected

- `/tmp/opstudio-task9-round2-full-unit.log`: **76 files / 751 tests passed**, 7.53 seconds.
- `/tmp/opstudio-task9-round2-typecheck-final.log`: typecheck completed without diagnostics.
- `/tmp/opstudio-task9-round2-lint-final.log`: lint completed without diagnostics; worker reports zero errors/warnings.
- `/tmp/opstudio-task9-round2-audit.log`: **0 vulnerabilities**.
- `/tmp/opstudio-task9-round2-build-final.log`: **32 unique precache URLs, 10 revised stable public assets**, matching UUID lifecycle/cache identity.
- `/tmp/opstudio-task9-round2-recording-stress-fixed.log`: **16 passed**, 10.6 seconds. The prior 16/16 diagnostic pass is preserved in the worker report and cannot be used as a before/after causal demonstration.

Controller runtime evidence and final verdict will be appended here. Local gates do not override the cache ownership findings. No hardware, real microphone fidelity, real MIDI-device, assistive-technology, human listening, remote CI or release claim is made.


## Final round-2 checkpoint and bounded next correction

The controller completed the full configured browser matrix: **123 passed / 2 deliberate skips**, 1.2 minutes. Both Chromium recording cases passed. The controller ran this suite without concurrent root builds, audio probes or other browser work. This closes the current browser acceptance failure while preserving the earlier failed runs and the limitation that the exact historical discontinuity cause was not captured. It does not prove real microphone fidelity or eliminate every scheduling risk.

**Final round-2 specification verdict: CHANGES REQUIRED. Final round-2 code-quality verdict: CHANGES REQUIRED for R9-5 only.** R9-6 and the bounded recording correction are accepted for the reviewed source and available evidence. Sol accepted both R9-5 source paths as real; no additional baseline browser reproduction is required to justify correcting those agreed branches. The final offline/update/visual controller proofs are deferred until the R9-5 correction is frozen, avoiding duplicate runs against a known incomplete lifecycle.

Round 3 is limited to R9-5 and its regression tests. The agreed constraints are: remove the mutable waiting identity from persistent metadata; verify the actual active worker identity matches recorded current ownership; require the pruning worker to be the live waiting worker with no installation in progress; recheck those live identities plus unchanged current/previous metadata immediately before each deletion; and make the actual activation event authoritative for recording self as current and the formerly current build as previous. Identity requests must fail closed for timeout, unavailable or incompatible workers and close their MessageChannel ports. Do not let an identity request queue behind the lifecycle operation that awaits its response. Preserve legacy migration data when current ownership cannot be established, and keep the existing per-tab activation consent boundary.

The deterministic regressions must assert preservation of C while it is installing and correct natural C activation with stale prior waiting metadata, followed by D pruning. An identity or ownership change aborts the cleanup attempt; it must not be retried using an earlier candidate list without a fresh ownership snapshot. No unrelated feature changes or permissive recording-gap changes are included.
