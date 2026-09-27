# Task 6 fix round 3 report

## Result

The observed idle-monitoring input-gap seam is corrected without relaxing the capture clock. An empty input callback may now invalidate only an idle monitoring timeline and its pre-roll pointers. The next delivered input uses the existing first-frame anchor. Empty callbacks after Arm or Start, during recording, or while waiting for quiet remain fatal. A nonempty frame jump with no observed empty callback still raises the exact discontinuity error.

The round changes only `CaptureCore`, the bundled capture processor, and the processor regression suite. Recording UI, session ownership, E2E fixtures, Playwright configuration, and unrelated library behavior are unchanged.

## Historical browser evidence and limit

The round-two Chromium manual test displayed `Capture frame discontinuity: expected 128, received 640`. Temporary event-only instrumentation was then run against the same localized Chromium case five times serially. All five attempts passed; all 120 captured startup callbacks contained 128 input frames and no missing-input callback was observed. Log: `/tmp/opstudio-task6-round2-clock-diagnostic.log`.

A controlled test of the actual bundled processor reproduced the exact error through this sequence: one valid monitoring block at frame 0, empty monitoring callbacks at frames 128, 256, 384 and 512, Start at frame 640 with 512 missing frames accumulated, then a valid block at frame 640. Log: `/tmp/opstudio-task6-round2-clock-controlled.log`.

This proves that an observed idle-grace gap can produce the historical error signature. It does not prove that the historical browser run delivered those four empty callbacks; the original numeric jump alone cannot distinguish empty callbacks from callbacks that did not execute. This fix is therefore deliberately limited to the proven, observed-empty-callback path. It does not waive unseen frame discontinuities.

## Implementation and preserved guards

- `CaptureCore.invalidateMonitoringTimeline()` is legal only in `monitoring`. It clears `expectedFrame`, `ringWrite`, and `ringLength`, so no pre-gap timeline or pre-roll can enter a later take.
- The processor calls that method only after an empty input callback while both the requested and core states are idle monitoring.
- Requested Arm and Start count as active before the browser-delivered channel format is known. Their first empty callback is rejected immediately instead of receiving setup grace.
- The existing first-input behavior is retained: Start followed directly by a valid first block anchors the take to that block's `currentFrame`.
- Stop during an idle observed gap remains take-free and idempotent.

The actual-processor regressions cover the exact four-empty-block sequence, pure monitoring recovery, active recording gaps, pre-format armed gaps, waiting-for-quiet gaps, an unseen nonempty frame jump, Start before the first valid input, an empty callback after pre-format Start, and Stop during an idle gap.

## RED and verification evidence

- Corrected meaningful RED against the frozen round-three baseline: the processor suite exits 1 with four failures. Both recovery cases report the 128-to-640 discontinuity, while pre-format Arm and Start gaps emit no error. Log: `/tmp/opstudio-task6-round3-red-corrected.log`. The earlier exploratory RED log is retained separately at `/tmp/opstudio-task6-round3-red.log`.
- Processor GREEN: **11/11** pass. Log: `/tmp/opstudio-task6-round3-green.log`.
- Recording-focused GREEN: core, processor, session, and modal suites pass **59/59**. Log: `/tmp/opstudio-task6-round3-focused.log`.
- Full unit suite: `npm test` passes **61 files / 684 tests**. Existing expected React and simulated-error diagnostics remain, with no failed tests. Log: `/tmp/opstudio-task6-round3-unit-final.log`.
- Production build: `npm run build` passes and emits `dist/assets/captureProcessor-C_h0dtKF.js`. Log: `/tmp/opstudio-task6-round3-build-final.log`.
- `npx tsc -b --pretty false`, scoped ESLint for the three changed runtime/test files, and scoped whitespace validation pass with empty output. Logs: `/tmp/opstudio-task6-round3-tsc-final.log`, `/tmp/opstudio-task6-round3-lint-final.log`, and `/tmp/opstudio-task6-round3-diff-check-final.log`.

No browser or production acceptance claim is made for this round. Controller-owned localized browser and production-worklet checks remain the acceptance gate. No personal microphone, audio interface, or physical OP hardware was used.
