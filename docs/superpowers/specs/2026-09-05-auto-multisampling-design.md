# Automatic multisampling: first usable version

The user approved staged automatic capture for NINA through Digitakt II and Ableton stock instruments through virtual MIDI/audio routing. Build in the existing isolated codex/studio-upgrade worktree. No commits, pushes, direct device transfers, account changes or real hardware automation during development.

## Scope

Extend multisample recording with a MIDI-driven capture mode. Choose audio input, MIDI output, channel 1–16, inclusive MIDI note range, note step, velocity 1–127, hold duration, release-tail duration and between-note settling time. One-note Test uses the same engine as a range. Cap the run to 24 notes and the existing 32-take/256MiB capture budget; each capture, including readiness lead, must stay within the existing 20-second duration limit. Use MIDI note numbers as authoritative mapping, with labels as a convenience. Defaults: notes 48–72 every 6 semitones, velocity100, hold1s/release1s, settling0.25s.

Keep the existing CaptureSession and processor, strict frame-gap rejection, owned resource cleanup and recording commit/archive checks. Each note uses a sequential owned capture; wait for real captured frames before sending note-on, then hold, note-off, capture release and seal before advancing. Do not equate the optimistic recording status with processor readiness. Bounded timeout rejects absent input. No simultaneous sessions or application playback during capture. Browser scheduling and interface latency are not claimed sample-accurate.

Capture callbacks are associated with an immutable run/note identity. Late permission, callbacks, timers or processor errors cannot advance a cancelled/replaced run or label one note's audio as another. Stop/close/unmount/page hiding/device disconnect clean up the active note and session. Send note-off only for owned notes; do not modify the synth patch or send global panic to unrelated MIDI channels. Permission is requested only by explicit user action, with supported-browser/retry guidance.

Completed captures remain in the existing review tray with explicit root notes and names. A stopped run retains finished takes and discards its unfinished take. Per-note retry must preserve the old take until the replacement succeeds. Detect silent/clipped recordings with bounded analysis and visible review warnings; keep them unselected rather than silently accepting poor captures. Initial implementation preserves complete source audio; loop suggestions and destructive automatic trimming are deferred until hardware timing is measured. Users can use the existing trim/loop editor. Do not silently normalize dynamics.

Apply uses existing prepareRecordingApplication and COMMIT_PREPARED_RECORDINGS with final manifest validation and one undo step. Never overwrite occupied roots without existing explicit replacement approval. Block invalid/conflicting runs before MIDI output, or present clear destination conflict in review; no hidden remapping. Preserve manual/sound recording and drum behavior.

Save only nonsensitive routing/settings preferences for named NINA/Digitakt II and Ableton profiles; storage failure cannot prevent capture. Device IDs may change, so unresolved devices require selection. No automatic permission requests on profile load. Explain NINA USB-C MIDI plus stereo audio via Digitakt II; Ableton uses an external MIDI route and virtual audio input, not browser plug-in hosting. Preset export uses existing tools; physical OP-XY transfer/listening remains a user validation step.

## Verification

Meaningful deterministic tests cover MIDI order/root mapping, readiness, release capture, cancellation at every asynchronous boundary, disconnect/error/missing take, invalid ranges/capacity, silent/clipped warnings and retry preservation. Component coverage verifies review integration, unchanged manual/drum paths, no project mutation before Apply, and one Undo. A production Chromium proof replaces only external MIDI/audio devices with explicit synthetic fixtures and exercises the actual worklet and UI; it must never fall back to physical inputs. Existing recorder tests plus full type/lint/unit/build gates run once after implementation. No claim of NINA/Ableton/OP-XY hardware success without measured device evidence.

## Implementation boundaries and model use

One Sol implementer with a short brief; controller Astra designs and reviews once after the writer freezes. No worker subagents or repeated broad reviews. Use existing dependencies. Current MaxMSPMCP reference query failed because its generated-answer API key is absent; no reference answer was obtained. This feature sequences the existing recorder and introduces no new DSP engine. Fetch current MIDI API documentation through Context7 before using API-specific output methods. The approved user workflow takes precedence over redundant skill approval/commit steps.
