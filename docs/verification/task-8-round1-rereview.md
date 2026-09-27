# Task 8 round 1 independent rereview

Reviewer: Astra, 2026-09-05. Scope: correction package `task-8-round1-review-package.txt` against `/tmp/opstudio-task8-before-round1/src` and `tests`, the eight findings in `task-8-review.md`, and regressions introduced by that delta. Source/tests/configuration remained frozen. This reviewer ran no browser, server, test suite, or runtime mutation; only this review document was written.

**Spec compliance: CHANGES REQUIRED** — the corrected runtime addresses R1–R8, but the required browser verification still contains the blocking test defect R9 below.

**Source correctness: CHANGES REQUIRED** — R9 is a test-source defect. No remaining runtime P1/P2 defect was found in the reviewed correction delta.

**R1–R8 runtime closure: PASS.** The sole remaining finding is the browser-test adapter mismatch below.

## Remaining finding

### R9 — P2 — Use the actual Focus region name in the retained loop test

**Confirmed test-source bug; not a product behavior failure.** `tests/e2e/loop-editor.spec.ts:52`.

After importing `drum.wav`, the changed assertion searches for region `Focused drum sample editor`. The actual region remains `Focused sample editor` at `src/components/drum/DrumFocusWorkspace.tsx:55`. No runtime region has the new test name, so this assertion times out before the subsequent retained keyboard/loop checks can execute. The adapter correction therefore leaves the required browser gate incomplete even when the new Focus behavior works.

Use the existing accessible region name, or consistently reconcile an intentionally changed name, preserving the filename check and every later keyboard/loop assertion. Rerun the affected test across its configured browser profiles and incorporate the controller's complete matrix result. Do not count this timeout as evidence that drum playback or loop editing is broken, and do not bypass the assertion to produce a green result.

## R1–R8 disposition

| Finding | Disposition and reviewed evidence |
| --- | --- |
| R1: unsafe unassigned replacement | **Closed in source.** `DrumTool` passes the expected individual File/AudioBuffer to `AudioImportProvider`. A `drum-asset` destination resolves that identity at guarded live commit, refuses a replaced/missing/assigned destination, constructs a fresh sample with fresh source identity and no inherited slice provenance, and applies shared current capacity plus complete candidate archive validation. The new focused regression follows a moved tray target, preserves its neighbor, verifies backup/reopen provenance, and checks one Undo. Shared preparation cancellation/project-generation checks remain intact. |
| R2: invalid numeric edits | **Closed.** Root values require integer 0–127. Markers require finite, in-buffer values and commit one normalized sample/loop range. Invalid drafts restore the valid values and expose an alert without dispatch. The one-frame case is tested. Controller reports production rejection of root 128 followed by a successful backup. |
| R3: incorrect multisample Focus preview | **Closed.** Focus now supplies envelope, play mode, gain, trim, loop and loop-on-release to `playWithADSR`, with an owned AbortController. Stop, identity change and unmount force-stop the owned voice. The audio player checks cancellation after each asynchronous acquisition/resume boundary and before source-node creation. Focus argument/Stop/unmount tests and a deferred-acquisition no-source-start test cover the original failure and stale-start risk. Controller's Chromium production proof confirms an actual 0.02–0.06 second loop, Stop, and Table-switch cleanup. |
| R4: automatic selection identity | **Closed.** Empty/import/fallback selection establishes an individual asset ref, and root sorting reconciles both local and presentation selection to that same asset. The added regression starts empty, imports two zones, changes order without prior explicit selection, and follows the moved sound. Controller's Chromium production proof also passes root-sort selection. |
| R5: silent arrow selection | **Closed.** Both pad layouts handle directional selection without calling playback, move focus to physical destinations, and cross compact-bank boundaries. Added desktop and mobile tests assert the target, actual focus and zero play calls. Controller's Chromium production proof passes arrow selection. |
| R6: extra demo frame | **Closed.** `convertedFrameCount` preserves source length when rates match and otherwise calculates from integer dimensions. The converter and size helper share it. The 6,174-frame regression remains exact. Controller production proof passes all ten physical regions, exact frame lengths and quantized source values in Chromium, Firefox and WebKit. |
| R7: dark notifications | **Closed with rendered evidence.** Notification surface/border/shadow tokens now inherit the resolved palette at root and Carbon layer. Controller's actual computed title/body contrast is 13.90/8.28 in dark mode and 14.80/6.11 in light mode. This closes the reported notification pair, not general WCAG or assistive-technology acceptance. |
| R8: preflight/writer disagreement | **Closed in source and covered by focused output checks.** Writer and preflight both call `planAudioConversion` for whether conversion occurs, original/decoded automatic-rate fallback, effective channels, depth, cut extent with the retained five-frame padding, and output frames. The planner's cut condition agrees with `cutAudioAtLoopEnd`. Known 48 kHz decoded/44.1 kHz source downmix, no-conversion rate retention, restored channels=2 mono, explicit rate and unknown metadata cases are covered; a generated WAV header/PCM-extent test agrees with preflight. No upmix requirement or silent change to accepted automatic-rate semantics was introduced. |

## Verification evidence and limits

The reviewer read the worker's fresh logs confirming 8 focused files / **153 passed** and 73 full-suite files / **774 passed**. Production build, scoped lint and changed-file whitespace checks are reported passing in `task-8-round1-report.md`; no new test/build run was performed by this reviewer.

The reviewer read `demo-audio/verification.json`: Chromium 139.0.7258.5, Firefox 140.0.2 and WebKit 26.0 each verify ten voices, 134,505 quantized samples, repeated same-engine bytes and exact source backup/reopen. Each archive is 1,087,530 bytes. Observed maximum Float32 difference from Chromium is zero; the supported comparison tolerance remains 1e-6 rather than a new cross-engine byte-identity promise.

The reviewer also read `task-8-focus-browser-proof.json`: all three engines pass silent arrow selection, automatic asset identity through root sorting, rejection of root 128 with an actual backup retaining valid root 48, actual 0.02–0.06 second loop configuration, and Stop/Table-switch cleanup. This extends the initial Chromium evidence in the disposition table to Firefox and WebKit.

The controller owns the full 125-case browser matrix; its final result is not claimed here while it is still running. R9 must be corrected and verified before this rereview can give an unconditional Task 8 pass. Prior attribution/license preservation remains unchanged by this correction delta.

No human listening, screen-reader/assistive-technology conformance or physical device transfer/import/playback was established. Task 9's previously assigned bundling/dependencies/lint/offline/CI and remote Patreon HTML work are outside this correction review; earlier accepted DSP/archive limitations are not reopened.
