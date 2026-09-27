# Task 6 fix round 1 report

## Result

All six findings in `task-6-review.md` are addressed. The corrected synthetic capture matrix passes in all five configured browser profiles, and the separate production build passes a real Chromium fake-device capture using only the explicit generated WAV fixture.

## Finding dispositions

- **R1 — fixed.** `CaptureSession` registers the granted stream and each created `AudioContext` in a generation-bound setup attempt before the next asynchronous boundary. Stop, Close, failure and replacement request cleanup immediately; a late continuation can release only its own attempt. Setup errors name the exact stage and preserve the DOMException name and message. Regressions hold `audioWorklet.addModule` and `resume` separately, check cleanup before release, and prove a stale setup cannot adopt or close a newer graph.
- **R2 — fixed.** Preview starts have an independent generation. Pending contexts are registered before `resume`; replacement, Stop preview, capture start, Apply and Close invalidate them. The ended callback compares the exact owned preview instance. Regressions start two deferred auditions of the same take, resolve them out of order, stop the surviving preview, and cancel a pending preview by starting capture. At most one source starts and every canceled context receives `close()`.
- **R3 — fixed.** Root-note proposals reserve current project roots and the actual retained/user-edited tray roots, read from the current state ref. An explicit target is the proposal anchor, including wrap at MIDI 127. Occupied-note free/replace decisions bind to the first selected take and reserve other tray rows. Exhaustion produces a visible error rather than a duplicate. Regressions cover edited and removed rows, selective Apply followed by another capture, explicit root 64 continuation, first-selected free/replace behavior, wrap and full 0–127 exhaustion.
- **R4 — fixed.** Stop is one shared idempotent promise. Dispose, graph replacement and terminal failure force-settle its internal wait before removing the response path. Generation checks prevent an old acknowledgement or timer from overwriting a replacement/closed session. Regressions cover identical double-Stop promises, Stop then dispose, setup replacement during Stop, late acknowledgement, and Apply Stop followed by Close.
- **R5 — fixed.** Apply has its own generation and `AbortController`. Close, unmount and reopen cancel the owned operation and reset `applying`; only the owning operation may clear or publish state. Preparation uses current reducer state and receives the abort signal. The persistent-modal regression reopens and successfully applies a fresh take while the old Apply Stop is still pending, then resolves the old continuation and verifies the new project/result remain intact.
- **R6 — fixed.** Both reducer notification and modal receipt feedback use total confirmed `appliedIds`. Drum overflow reports its actual placement, for example `2 takes added; 2 kept unassigned.` Multisample capacity excess remains described as retained in review. Tests cover a full 24-pad modal/reducer application and a mixed-hole reducer batch, including the preserved unassigned assets.

## Browser harness and production diagnosis

The synthetic harness now replaces `navigator.mediaDevices` with a complete test-owned facade using `Object.defineProperty`, stores the exact synthetic `getUserMedia` identity, and asserts that identity immediately after navigation and before opening or enabling recording. Installation throws if verification fails, so no configured browser can fall through to native input. Sound-triggered coverage schedules exactly two delayed bursts only after Arm and waits through each quiet tail; the source no longer contains autonomous repeating bursts. The loaded-count assertion accepts the product's correct singular/plural form.

The production fake-device failure was isolated before behavior changed. `navigator.mediaDevices.getUserMedia({audio:true})` itself rejected with `NotSupportedError: Not supported`; no context or worklet stage had started. Playwright 1.54.1 was launching `chromium_headless_shell-1181`, even though both required fake-media flags were present. That binary exposed blank placeholder devices and rejected audio capture in this environment. The dedicated project now sets `channel: 'chromium'`, which launches the full bundled `Chromium.app` with the same `--use-fake-device-for-media-stream` and `--use-file-for-fake-audio-capture=<explicit path>` flags. The positive gate asserts a named `Fake ... Audio Input`, 48 kHz mono settings, production monitoring, elapsed capture, one completed take, Cancel with an unchanged project, and ended tracks.

Playwright's page `response` event did not expose the AudioWorklet module request. The production gate nevertheless proves module load and processor execution: `CaptureSession` cannot enter monitoring until `audioWorklet.addModule()` resolves, and the completed take can only arrive from the registered production processor. The build emits `dist/assets/captureProcessor-CJEaL2V6.js`; the missing page-response observation is not presented as MIME evidence.

## Changed files in this round

- Runtime: `src/audio/recording/captureSession.ts`, `src/components/common/RecordingModal.tsx`, `src/utils/recordingApplication.ts`, `src/context/AppContext.tsx`.
- Unit tests: `src/test/audio/recording/captureSession.test.ts`, `src/test/components/RecordingModal.test.tsx`, `src/test/context/recordingApplication.test.ts`.
- Browser/config: `tests/e2e/recording.spec.ts`, `tests/e2e/recording-fake-device.spec.ts`, `playwright.recording-device.config.ts`.

## Verification evidence

- Initial lifecycle RED: `npx vitest run src/test/audio/recording/captureSession.test.ts` — 3 expected failures / 14 passes, covering held module cleanup, held resume cleanup and Stop disposal settlement. Log: `/tmp/opstudio-task6-round1-session-red.log`.
- Focused final: the three changed recording suites — 41/41 pass. Log: `/tmp/opstudio-task6-round1-focused-final.log`.
- Full unit: `npm test` — 61 files / 670 tests pass. Log: `/tmp/opstudio-task6-round1-unit-final.log`.
- Production build: `npm run build` — pass; local worklet `dist/assets/captureProcessor-CJEaL2V6.js`. Log: `/tmp/opstudio-task6-round1-build-final.log`.
- Corrected synthetic matrix: `npx playwright test tests/e2e/recording.spec.ts --trace=on` — 10/10 pass across Chromium, Firefox, WebKit, Mobile Chrome and Mobile Safari. Log: `/tmp/opstudio-task6-round1-recording-browser.log`.
- Production native fake-device gate: `PLAYWRIGHT_PRODUCTION=1 PLAYWRIGHT_FAKE_AUDIO_FILE=/tmp/opstudio-task6-fake-input.wav npx playwright test --config=playwright.recording-device.config.ts --trace=on` — 1/1 pass. Log: `/tmp/opstudio-task6-round1-production-fake-final.log`.
- Scoped ESLint for all changed recording runtime/tests/browser/config files except the legacy context module — pass with empty output. Log: `/tmp/opstudio-task6-round1-lint-final.log`. The changed context module also passes with its ten pre-existing unrelated `any`, unused-variable and Fast Refresh rules disabled. Log: `/tmp/opstudio-task6-round1-context-line-lint-final.log`.
- TypeScript project check and full-tree whitespace check pass with empty output. Logs: `/tmp/opstudio-task6-round1-tsc.log`, `/tmp/opstudio-task6-round1-diff-check-final.log`.

The earlier 128-frame core RED remains a disclosed fixture arithmetic correction, not a product defect. No physical microphone, hardware audio interface or OP device was used. Hardware ADC fidelity and physical export playback remain unverified. Task 8 workspace redesign and Task 9 global dependency/lint/offline work remain outside this round.
