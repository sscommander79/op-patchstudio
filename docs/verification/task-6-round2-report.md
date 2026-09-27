# Task 6 fix round 2 report

## Result

Both remaining P2 findings and the adjacent same-instance cleanup edge from `task-6-round1-rereview.md` are fixed. The round changes only `CaptureSession`, `RecordingModal`, and their focused unit tests. The accepted synthetic browser harness, production fake-device configuration, library behavior and unrelated Task 9 surfaces are unchanged.

## Finding dispositions

- **RR1 — fixed.** Every audition now acquires a monotonically increasing preview ticket at handler entry, before preview cleanup or capture Stop. The ticket is checked after preview cleanup, after the shared capture Stop and after context resume. A later audition, Stop preview, capture start, Apply or Close invalidates all earlier phases. Pending preview state keeps Stop preview accessible while an audition is waiting before context allocation. Immediate context registration and exact source-instance ended ownership remain intact.
  - The regressions hold an active capture Stop, issue two same-take or different-take auditions, then release Stop and resolve preview work. Only the latest request starts. Close owns every context that was created.
  - A separate regression starts an audition that is waiting behind capture Stop, presses Stop preview before any preview context exists, releases Stop, and proves no context or source is created.
- **RR2 — fixed.** MIDI-root proposal and exhaustion logic now runs only for multisample recording. Drum takes retain the common draft shape with a harmless valid root placeholder; pad placement and project admission remain their governing constraints.
  - A real provider/modal regression restores 128 small legacy multisample roots, records and applies a drum take, confirms one drum was added, and confirms all 128 multisamples remain unchanged.
  - The paired multisample regression uses the same 128-root project and confirms root exhaustion remains visible with no review take admitted.
- **C1 — fixed.** `releaseGraph()` snapshots and clears all shared graph fields before starting or awaiting any setup/context close. A stale cleanup therefore cannot observe replacement-owned fields after its held close resumes. `dispose()` also captures its generation and publishes `closed` only if it still owns the current session generation.
  - The regression holds setup A's module load and context close, starts disposal, enables and adopts graph B on the same `CaptureSession`, then releases A. B remains monitoring; its track and context are untouched until the final explicit disposal.

## RED and verification evidence

- Meaningful RED: `npx vitest run src/test/components/RecordingModal.test.tsx src/test/audio/recording/captureSession.test.ts` produced four required failures: same-take and different-take queued auditions each started two sources, the 128-root drum take was rejected, and stale setup cleanup closed the replacement graph. Log: `/tmp/opstudio-task6-round2-red.log`.
- Focused final: session, modal and recording application/reducer suites pass **47/47**. Log: `/tmp/opstudio-task6-round2-focused-final.log`.
- Full unit suite: `npm test` passes **61 files / 676 tests**. Existing expected console/React test diagnostics remain, with no failed tests. Log: `/tmp/opstudio-task6-round2-unit-final.log`.
- Production build: `npm run build` passes and emits `dist/assets/captureProcessor-CJEaL2V6.js`. Log: `/tmp/opstudio-task6-round2-build-final.log`.
- TypeScript project check, scoped ESLint for all four changed runtime/test files, and full-tree whitespace validation pass with empty output. Logs: `/tmp/opstudio-task6-round2-tsc.log`, `/tmp/opstudio-task6-round2-lint-final.log`, `/tmp/opstudio-task6-round2-diff-check-final.log`.

Round-one browser evidence remains the applicable baseline: all 10 recording cases passed across the five configured profiles, the production explicit fake-device/worklet gate passed, and the full broader browser run had 94 passes plus one unrelated intermittent Firefox library failure whose isolated rerun passed. No browser or server was launched in this round. No personal microphone, audio interface or physical OP hardware was used.
