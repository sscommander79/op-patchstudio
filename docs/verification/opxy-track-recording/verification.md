# OP-XY track recorder verification — 2026-09-21

Source checkout: `/Users/stevencommander/Desktop/AI/op-patchstudio-improved`, branch `codex/studio-upgrade`.
Validation runtime: `/tmp/opstudio-sep18-validation`. The refresh manifest `VALIDATION-PROVENANCE.json` records source-file hashes; current source files were used with no baseline fallbacks.

Implementation was delegated to Genspark using Sol. Codex reviewed lifecycle/timing/memory behavior, supplied bounded corrections, authored independent regression tests, and executed checks. No upstream Stem Extractor source was supplied to the implementation worker. No commit, push, public deployment, or physical OP-XY operation was performed.

## Evidence gathered

- Existing recording baseline: 51 passing checks (capture core/session, automatic sampler, studio presentation/storage).
- Existing sampler/slicer regression snapshot: 49 passing checks.
- Independent engine tests first reproduced stale permission cleanup and early crop/capture termination defects. Revised implementation passed five checks: late permission isolation, no MIDI before readiness, positive input latency and full capture guard, immediate input-error cleanup, and cleanup after every sequential track.
- Synthetic browser test uses Chromium's generated audio device and a stub MIDI output. It exercised the actual AudioWorklet/CaptureSession path: record test, replace that track during a two-track run, export individual 24-bit WAV, export ZIP, check per-take settings after changing the form, open the slicer, and return without losing reviewed recordings.
- Synthetic browser test passed. Browser-negotiated capture was 44.1 kHz stereo; exported WAV matched the reported input format, contained exactly two seconds, and ZIP metadata retained the original 120 BPM after the form changed to 100 BPM. This is software-path evidence, not hardware timing/isolation evidence.

## Reproduce synthetic browser check

Build first with `npm run build`, then:

```sh
PLAYWRIGHT_STEM_FAKE_DEVICE=1 PLAYWRIGHT_FAKE_AUDIO_FILE=/tmp/opstudio-ci-fake-audio.wav npx playwright test --config=playwright.stem-recording.config.ts
```

The configuration always forces Chromium's fake audio device. Global setup writes a deterministic generated WAV to the explicitly supplied fixture path. MIDI is replaced in the test page with an in-memory stub. No real device output is used. The test intentionally skips outside this explicit configuration.

## Final acceptance

- `npm run build`: passed, including TypeScript and PWA verification (32 unique precache URLs).
- Focused unit/component regression run: **94 passed in 8 files**.
- Scoped ESLint: passed with no findings.
- Final production synthetic-device test: **1 passed**, including WAV/ZIP format and duration checks, slicer round trip, focused discard prompt, and Escape preserving takes.
- Production entry/unsupported-browser checks: **6 passed** across Chromium, WebKit, and Mobile Chrome. WebKit entry checks do not imply Web MIDI recording support.
- Native in-app preview inspection: recorder opens/closes correctly, no browser console errors, 390px viewport has 390px document width and 366px dialog/client/scroll width (no horizontal clipping), with vertical scrolling available. Temporary viewport override was reset.
- Preview `http://127.0.0.1:5193/` and existing source preview `http://127.0.0.1:5188/` serve the verified build index. Existing user tab at 5192 was preserved without reload or device access.
- Genspark authored implementation and initial tests. Root corrected test-only mock typing/setup and outdated text assertions, then reran validation. No application behavior was changed by these test corrections.

Physical OP-XY validation remains pending; follow `physical-checklist.md`. No guarantee of hardware synchronization, original mute-state restoration, source isolation, or full-song recording is made. First version: eight instrument tracks, short 4/4 patterns, at most 16 seconds of music plus tail per track, browser memory limits, temporary reviewed takes until downloaded or explicitly discarded.
