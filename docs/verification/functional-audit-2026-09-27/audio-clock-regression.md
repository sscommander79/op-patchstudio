# Audition clock-advance regression

The final two-worker production matrix found 603 passing tests, 41 skips and one Chromium keyboard-audition failure. Its retained native-browser trace reports NotSupportedError: the attack value curve started at 0.2186666667 for 0.0069853457 seconds while decay was scheduled at 0.2203186790. The intervals overlap, so source.start was never reached for the second note.

The underlying AudioParam API clamps a past curve start to the current audio clock. Computing the next segment from the original timestamp can therefore overlap an attack moved forward by the browser. This explains the captured failure. It does not establish the cause of every earlier failure without a trace.

References: [Web Audio specification, value curves](https://webaudio.github.io/web-audio-api/#dom-audioparam-setvaluecurveattime) and [linear ramps](https://webaudio.github.io/web-audio-api/#dom-audioparam-linearramptovalueattime). Context7 resolved and retrieved the official Web Audio specification. The required Max reference query returned no applicable browser API guidance.

## Fix and regression

Attack and decay retain the existing 51 Float32 curve samples and segment durations. They now schedule those points with linear ramps, matching the curve interpolation without reserving overlapping curve intervals. Release, exported ADSR values, playback speed and audio data are unchanged. No extra audition latency was added. The browser-only envelope remains an approximation; physical sound equivalence is not claimed.

A new unit regression models native curve clamping after a 20 ms audio-clock advance. It failed before the fix and passes afterward. All 31 audio-player tests pass, including original lifecycle/release coverage; strengthened assertions check maximum segment timing and velocity scaling.

A real-browser regression forces 25 ms to pass between timestamp capture and scheduling. It fails against the old production build with zero source starts. The rebuilt instrumented table suite passes: 24 passed / 1 documented Firefox injection skip. Ordinary Enter/Space tests pass on all five profiles; the positive-clock-advance regression passes on Chromium/WebKit desktop and mobile profiles. All six current synthetic recording cases also pass. Evidence: audio-clock-overlap-trace.zip, opstudio-audio-clock-red.log, opstudio-audio-clock-green.log, opstudio-audio-clock-browser-red.log. No assertion was relaxed to hide the failure.

The earlier one-off WebKit folder timeout passed five unchanged repeats and the entire later two-worker matrix. Its cause remains unproven; the historical failed run remains retained.

## Firefox test-harness disposition

A separate running-context probe blocked the main thread for 250 ms and then yielded. Chromium currentTime advanced 0.069333 → 0.314667 during the task; WebKit 0.069333 → 0.320000. Firefox remained 0.112000 during the task and advanced to 0.394667 after yielding. Thus the synchronous within-task clock-advance injection is inapplicable on this Firefox version. Only that extra injection case is skipped for Firefox, with the reason in the test. Its ordinary desktop/mobile-width audition tests still execute. This is not a hardware claim or a claim about every future browser implementation.

The initial strengthened clock-probe run had 24 passing cases and this one harness assertion failure; it is retained as opstudio-audio-clock-probe-green.log despite its historical filename. Final focused evidence is opstudio-audio-clock-final.log.

Sixth independent read-only Fable review found no blocking issues. Low-priority residuals: per-point release granularity, extra automation event count, fixed-size local helper assumptions, and existing approximate envelope endpoint shape. Human listening remains pending.

Final rebuilt production matrix: **608 passed / 42 documented skips / zero failures**, evidence/opstudio-production-verified.log. The ordinary and forced-clock audition regressions pass wherever applicable.
