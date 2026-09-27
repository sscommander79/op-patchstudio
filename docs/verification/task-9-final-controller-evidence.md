# Task 9 final controller evidence

Date: 2026-09-05  
Status: **ACCEPTED** for the reviewed local Task 9 candidate

Task 9 satisfies the quality, performance/offline, documentation and CI acceptance contract. Astra's final review records specification-compliance and code-quality PASS with R9-1 through R9-7 closed. This is local software evidence. It is not a release, deployment, remote-CI, physical-device, real-input, human-listening or assistive-technology claim.

## Final gate summary

| Gate | Result |
| --- | --- |
| Full unit suite | PASS: 755/755 tests across 76 files. This is the retained round-3 full run; no 757-test full rerun is claimed. |
| Round-4 affected PWA tests | PASS: 16/16 across 2 files, including activation-lifetime and post-identity slot-replacement regressions. |
| Typecheck / lint / production build | PASS. ESLint 10 reports zero errors/warnings; build verifies 32 unique precache URLs and revisions for 10 stable public assets. |
| Full application browser matrix | PASS: 123 applicable cases; 2 deliberate mobile skips. Both Chromium recording paths pass. |
| Production offline workflow | PASS in Chromium 153.0.8010.12. |
| Production A/B/C update workflow | PASS in Chromium 153.0.8010.12. |
| Held-install/natural-activation race | PASS in Chromium 153.0.8010.12. |
| Superseded waiting generation | Bounded assertion passed; the JSON status is literally `BOUNDED`. |
| Final visual/geometry capture | PASS with controller inspection and no new confirmed visual blocker. |
| Retained Demo and Focus workflows | PASS in Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6. |
| Independent final review | Specification PASS and code-quality PASS; R9-1 through R9-7 closed. |

The durable files, exact harness snapshots, test-only A/B/C/D configurations, logs and hashes are in [`task-9-final-evidence`](task-9-final-evidence/README.md). Final screenshots are in [`images`](images/), and the independent review is [`task-9-round4-review.md`](task-9-round4-review.md).

## Offline and update behavior

The offline proof passed a cold new-document start; local audio import, trim, rename, Undo/Redo and autosave; reload recovery with exact source PCM and trim; Library save/load; a sparse device ZIP with 8,820 frames and sample bounds 882–8,820; an actual native worklet take followed by Cancel cleanup; and Donate/Feedback fallback with return to the unchanged instrument.

The result retains five failed requests by design. The three optional Patreon proxy requests failed offline and produced the explicit unavailable state. Two `manifest.json` requests failed with `ERR_INTERNET_DISCONNECTED`. Those two failures remain visible in `offline-proof.json`; the cached application and tested editing/export workflows still passed. The observed worklet module URL is recorded even though page-level response events were empty.

The A/B/C proof passed all of the following:

- Waiting preserved the first tab's draft, and the second open Studio tab blocked activation.
- The deferred A tab retained its document and draft and loaded A's lazy Library chunk while offline.
- After the other tab closed, explicit **Update now** completed and preserved exact saved audio and markers.
- B served changed bytes for the same-name static asset, retained an unrelated origin cache and cold-started offline.
- C activation retired the older generation, leaving the bounded B/C application precaches plus separate lifecycle metadata and the unrelated cache.

The adversarial race proof held C in the installing slot while stale B claimed cleanup. B replied `pruned:false` and did not delete C. With page scripts paused and both pages closed before any C waiting claim, C activated naturally and made its own identity authoritative. D waiting then preserved active C and C's lazy Library offline.

The separate waiting proof observed A+B become A+C while A remained active. A and C shared the same millisecond suffix but had distinct UUIDs, directly exercising the former cache-identity collision. Its literal result status is `BOUNDED`, which denotes a successful bounded-generation assertion rather than a generic PASS label.

## Interaction and visual regression

The retained full browser matrix passed 123 applicable cases with two deliberate mobile skips. The round-1 MIDI correction proof records one initialization request and zero removed pad nodes; the earlier causal artifact remains in `task-9-initial-evidence` and records six delayed-denial requests with 288 removed pad nodes before the fix.

The final visual artifact covers light/dark Focus, Table, Detailed edit, nested waveform, slicing, recording, export and advanced dialogs; dark import review, Library and Library confirmation; 320px light/dark Focus; 844×390 landscape; and a mounted canvas redrawn after System theme change. Desktop document width was 1440/1440, mobile 320/320 and landscape 844/844. The Table keeps its wide controls in an intentional horizontally scrollable inner region; no document-level horizontal overflow was observed.

The dark Library image captures the transient **Loading workspace** state. The separate dark Library confirmation image shows a loaded underlying row and the real confirmation after waiting for and invoking Load. The production offline proof independently covers full Library save/load behavior. The first two visual logs preserve harness-only dialog-locator mistakes; the corrected run passed, and the controller inspected the requested captures. Light recording/export/advanced, dark advanced and dark 320px views were also readable.

## Retained Demo and Focus checks

The Demo proof passed in all three engines with 10 voices, 1,087,530 archive bytes, repeated same-engine byte identity, exact source-backup reopen, 134,505 quantized samples checked per engine and a maximum Float32 difference of zero from Chromium. This is deterministic digital-output evidence, not human listening or hardware fidelity.

The Focus proof passed silent arrow selection, automatic `high-C5.wav` selection, selected-asset identity after root sorting, retention of prior root 48 after invalid input 128, loop bounds 0.02–0.06 seconds, Stop cleanup and view-switch cleanup in all three engines. The stored `stopped:false` describes the loop while it was playing before the separately successful cleanup assertion.

## Evidence limits

The historical recording discontinuity did not recur during diagnostic capture, so its exact cause is not claimed. The corrected graph startup invariant, 16/16 stress pass, final full browser pass and retained strict active/unseen-gap rejection are the bounded evidence. The earlier explicit-update timeout produced no worker-state snapshot; its queue-cycle diagnosis is supported by source/lifecycle analysis, an exact RED regression and the final production pass.

Local browser data remains subject to browser quota and eviction. Unknown legacy ownership deliberately causes cache pruning to fail closed, and a short client-count-to-activation platform race remains documented. Human listening, real microphone fidelity, real MIDI hardware, physical OP-XY import/playback, assistive technology and remote CI execution remain unperformed. No commit, push, release or deployment was performed.

