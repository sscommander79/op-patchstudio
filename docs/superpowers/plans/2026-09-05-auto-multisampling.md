# Automatic Multisampling Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development with one Sol worker for this cohesive feature. No commits or additional agents. User approved execution in chat.

**Goal:** Automatically play and capture a short note range, review it, and export an OP-XY multisample preset.

**Architecture:** A small injected MIDI/capture sequencing controller owns asynchronous note capture. RecordingModal integrates its results into the existing review and atomic Apply flow; the existing PCM recorder and export remain authoritative.

**Tech Stack:** Existing React/TypeScript, Web MIDI, Web Audio CaptureSession, Vitest and Playwright. No new dependency required.

**Spec:** docs/superpowers/specs/2026-09-05-auto-multisampling-design.md

## Global constraints

Only multisample automation changes; preserve manual/sound recording and drum behavior. One patch/velocity, maximum24notes, existing32takes/256MiB/20seconds capture limits. No direct transfer, MIDI bank scanning, new DSP/automatic loops, real hardware test, commits, pushes or deployment. Development worktree already includes all accepted prior changes; do not reset it. Default sample range48–72/step6, velocity100, hold1s/release1s/settling0.25s. Source and review identities survive rejected/aborted operations.

## Task 1: Complete, bounded autosampling workflow

Files: create src/audio/recording/autoSampler.ts and focused src/test/audio/autoSampler.test.ts (adapt test folder to local conventions); add a small output/profile UI module if this keeps RecordingModal readable; modify src/components/common/RecordingModal.tsx and its existing tests; create tests/e2e/auto-sampling.spec.ts and a concise docs/verification/auto-sampling.md. Only extend captureSession.ts if a minimal read-only readiness hook is necessary; do not weaken core clock checks.

Interfaces: consume CaptureSession enableInput/start/stop/dispose, onStatus/onTake/onError and retained-budget callback; consume a MIDI output adapter with note-on/note-off/connectivity; produce explicitly note-tagged SessionTake results and progress/error callbacks. Keep timers/capture/MIDI injectable for deterministic tests. Browser integration owns permission and routing selection. Existing recordingApplication owns final project admission.

- [ ] Inspect the exact existing session, recording modal, MIDI hook, tests and reducer receipt flow; fetch current MIDI API docs. Record a baseline of files before editing.
- [ ] Write RED sequencing tests using a fake capture that stays pending until an explicit recorded-frame signal. Assert no note-on before readiness, exact selected channel/note/velocity, note-off before tail sealing, and next note only after previous take arrives.
- [ ] Add RED cancellation/error tests: permission pending, hold, tail, missing take, silent/clipped input, output disconnect, capacity rejection, retry failure preserving prior take. Assert no late advance or stuck owned note.
- [ ] Implement the bounded controller and pass those tests; explicit validators reject nonfinite/fractional MIDI parameters, backwards range, zero step and excessive total duration/count.
- [ ] Integrate explicit MIDI enable/output selection and automatic mode in multisample RecordingModal. Add one-note Test, range Start, Stop, progress, clear routing help, review warnings and per-note Retry. Reuse review Apply and preserve previous takes on failed retry. Lock conflicting input/preview/Apply/settings controls while capturing.
- [ ] Add named routing/settings profiles with guarded storage, resolved-device checks and no implicit permission prompts. Retain old manual/sound UI defaults and all existing regression coverage.
- [ ] Verify component integration and actual synthetic production browser path: chosen MIDI notes create matching roots, no state mutation before Apply, valid exported project/device package, Stop/Cancel releases all owned resources. No physical-device fallback in test fixtures.
- [ ] Run focused recorder/controller/UI tests, then npm run check once. Build and run the new production browser case plus affected existing recording cases; controller may reuse these logs instead of repeating full unrelated matrices.
- [ ] Freeze source/tests/config; write concise actual results, changed-file list and known hardware limitations to docs/verification/auto-sampling.md. Controller performs one scoped specification/code review and a final runnable-preview check. Leave hardware validation explicitly pending.

## Hardware acceptance (not automated in development)

User selects one NINA patch and checks a one-note recording through Digitakt II, then a short range and OP-XY transfer/playback. Repeat with one Ableton stock synth through configured virtual routes. Listen for attack truncation, tail overlap, pitch/root errors and clipping. Direct upload and wider automation remain outside this first version.
