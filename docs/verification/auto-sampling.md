# Automatic multisampling verification — 2026-09-05

## Delivered behavior

- One-note test and automatic selected-note range capture, defaulting to MIDI 48–72 in steps of 6, velocity 100, channel 1, one-second hold/tail, and 0.25-second settling.
- A fresh owned `CaptureSession` per note. MIDI note-on waits for `elapsedFrames > 0`; note-off precedes release tail and clean stop/materialization. A take remains private until that sequence succeeds.
- Validation before range generation, a 24-note automatic limit, a 20-second per-take timing bound, and the existing 32-take/256 MiB retained-review budget.
- Incomplete maximum-length/error captures do not become completed takes. Silent and clipped results remain reviewable but unselected, with a targeted retry action.
- Owned-note cleanup on Stop, error, MIDI disconnect, page hiding, and component teardown. Run identities and serialized cleanup prevent an old run from clearing or interfering with a restarted run.
- Independent saved audio input, MIDI output, and note/timing settings for Custom, NINA through Digitakt II, and Ableton routing profiles. Missing saved devices block capture until the user explicitly chooses an available input/output.
- Existing audition playback stops when recording opens, and keyboard/drum MIDI surfaces do not request permission or respond while recording owns the dialog. MIDI permission begins only from an explicit user action.
- Completed takes enter the existing recording review and Apply flow; roots, names, selection, and occupied targets are locked while automatic capture is active.

## Verification results

- Pre-change baseline: **5 files / 65 tests passed**.
- Full repository check during implementation: **79 files / 787 tests passed**, plus lint, TypeScript, production build, and PWA verification.
- Final affected regression after all ownership, routing, StrictMode, visibility, and permission changes: **5 files / 80 tests passed** in 2.27 seconds with clean output.
- Final preference-safety regression after the last bounded review: **1 file / 12 tests passed**, covering explicit profile allowlisting and preservation of an unresolved saved input across profile switches.
- Final TypeScript check: **passed**.
- Final lint: **passed**. The command ignored only the temporarily parked, cloud-offloaded dependency backup; source and test coverage were unchanged.
- Final production build: **passed**, 573 modules transformed. PWA verification confirmed 32 unique precache URLs and 10 revisioned stable assets. Existing Carbon Sass deprecation and chunk-size advisories remain warnings.
- Production Chromium with explicit synthetic devices: **2/2 passed**. The automatic test verified zero MIDI permission calls before Enable MIDI, exactly one explicit permission call, Stop cleanup and recorder reopen, exact note messages `90/60/100`, `80/60/0`, `90/66/100`, `80/66/0`, roots 60 and 66, two applied samples, project backup, and a valid two-region OP-XY ZIP. It then reloaded the cached production application offline and completed another synthetic one-note capture. The companion test confirmed `getUserMedia` used only Chromium's deterministic fake audio input.
- Four saved evidence archives passed ZIP integrity checks.
- Independent final whole-app run passed TypeScript and unmodified lint configuration. It exposed a waveform test readiness race; after explicitly waiting for the animation callback subscription, the affected file passed 17/17 and the full suite passed **79 files / 790 tests**. All original playhead assertions remain intact; no runtime behavior changed. The first failing run is retained as evidence.
- Independent narrow-screen review at 390 × 844 confirmed no horizontal dialog overflow and reachable capture controls, review tray, Cancel and Add selected takes. Screenshots and geometry are in `auto-sampling-final-evidence/`.
- Independent archive inspection confirmed all four ZIPs, WAV frame counts, and the automatic fixture’s MIDI root mapping at 60 and 66.

The first final browser attempt correctly stopped at device preflight because the test had left the required instrument name empty. The test now performs that normal workflow step and allows 60 seconds for capture plus two downloads; the rerun passed in 2.5 seconds. Earlier production attempts also exposed multiple Chromium fake inputs and background MIDI permission requests from mounted keyboard surfaces; the test now requires every enumerated input to be synthetic and the product requires explicit MIDI connection.

## Evidence

- `auto-sampling-desktop.png` and `auto-sampling-narrow.png` show the production recording dialog before MIDI permission. The narrow dialog uses its existing internal scroll container.
- `auto-sampling-final-evidence/synthetic-two-note-capture.opstudio` — SHA-256 `1408a55ac7ae8adaf82b2d90594a351bae9f173f76a3e43068e028a3f3e8f835`
- `auto-sampling-final-evidence/synthetic-two-note-opxy.zip` — SHA-256 `c89e6c4dd7b6e71c3560536c3696c326493669739780d07902114f651d562f77`
- The synthetic OP-XY ZIP contains two 9,216-frame WAV regions named `MIDI 60.wav` and `MIDI 66.wav`. These are timing and format fixtures, not tuned-instrument or NINA recordings.
- `return-test-pack/studio-seed-return-test.opstudio` — SHA-256 `34f22cd3116b0e93ac0c6c3a28f9388e7846a4e92cd24a954732abf4e9a74be7`
- `return-test-pack/studio-seed-return-test-opxy.zip` — SHA-256 `9df899f96bd9359e14eec79f741e44f4a11e29e7db05492a4ea3e6168ec59ef1`
- The Studio Seed device ZIP contains the expected 10 deterministic mono WAV regions at roots 53, 55, 57, 58, 60, 61, 63, 65, 69, and 70, totaling 134,505 frames.

## Review corrections covered

- Invalid zero/negative step values cannot enter an unbounded loop.
- Stop, repeated Stop, permission/readiness cancellation, and immediate restart preserve capture ownership.
- StrictMode effect replay restores the mounted guard.
- Page-hidden cancellation sends owned-note cleanup.
- Healthy WebMidi outputs use the normal connected-output lookup; `{disconnected:true}` is not used for live routing.
- Already-enabled MIDI refreshes outputs on mount.
- A saved unavailable audio ID remains unresolved and cannot silently fall back to the default input.
- Named profiles keep independent input/output/settings instead of overwriting one shared route.
- Stored profile names are checked against the explicit three-profile allowlist, so prototype property names cannot select invalid route data.
- Switching away from an unavailable saved input preserves its unresolved ID and continues to require an explicit replacement when the user returns.

## Documentation and hardware boundary

Context7 was queried for current Web MIDI documentation and returned no matching API material. The primary fallback references were [MDN: `MIDIOutput.send()`](https://developer.mozilla.org/en-US/docs/Web/API/MIDIOutput/send) and [MDN: `Navigator.requestMIDIAccess()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess).

No real microphone, MIDI port, NINA, Digitakt II, Ableton route, or OP-XY import was used. Browser scheduling remains interface-timed rather than sample-accurate. If a physical MIDI route disconnects, the best-effort note-off may not reach the synth; the user may need to stop the note on the instrument. Complete the real-device matrix in `docs/verification/auto-sampling-hardware-check.md`, including input/output selection, disconnect recovery, silence/clipping review, retry, project reopen, device transfer, and listening checks.

macOS cloud offloading interrupted verification twice. The final source checks and browser run completed after bounded materialization. Final verification used a local source mirror outside the cloud-managed workspace. A refreshed hashed source/evidence snapshot is recorded in `unattended-completion.md`; this is a readable-file safety copy, not a complete Git backup.

## Next steps

Use [When you return](when-you-return.md) for equipment and listening checks. The [improvement assessment](improvement-assessment-2026-09-05.md) prioritizes 40 opportunities and dispositions all 27 open upstream issues plus two pull requests reviewed on September 5.
