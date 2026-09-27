# OP-XY track recording: initial implementation contract

User approved independently written implementation on 2026-09-21. Extend existing MIT recorder and studio shell. No Stem Extractor source is to be copied or supplied to the implementation worker. No external recording service, login, upload, public deployment, or device activity during implementation.

## User workflow
Record OP-XY tracks opens a guided modal. Explicitly enable MIDI/audio, choose input/output, select instrument tracks, set BPM/bars, and acknowledge the final mute state. Record a test track and listen. Record selected tracks sequentially, review retained results, retry a single track without losing its old take on failure, download individual WAVs or ZIP, or send a recording into the existing slicer and key-mapping flow.

## Bounded first version
4/4 short patterns; music plus tail at most 16 seconds per track, within existing 20-second capture safety limit; eight instrument tracks; at most 64 MiB retained PCM. Long songs, streamed disk recording, arbitrary hardware, external plugins, automatic source separation, hardware preset transfer, and guaranteed sample-accurate synchronization are outside this first version. User-facing limits must be visible.

## Correctness requirements
No MIDI, permissions, or audio on mount. Input must be delivering frames before transport starts. MIDI uses selected output only, CC9 on channels1..8; reset is STOP and all eight instrument tracks unmuted, not a claimed restoration of unknown original states. Cancel clears scheduled messages before STOP and individually attempts mute reset, then closes owned audio. Disconnection must retain completed takes and explain manual recovery. Navigation/close guards preserve review takes.

Audio clock and captured absolute frame metadata anchor equal musical windows; preserve leading silence, actual sample rate and mono/stereo; configurable input timing offset. Reject missing/truncated coverage. Hardware latency and phase/timing alignment remain unverified without loopback measurement. Clock delays must not silently produce a burst of overdue ticks.

## Evidence sources
- https://teenage.engineering/guides/op-xy/midi-references (CC9 track mute, channels1–16)
- https://teenage.engineering/guides/op-xy/mix (mutes affect notes, not audio)
- https://teenage.engineering/guides/op-xy/com (MIDI configuration)
- MDN Web MIDI send, clear, requestMIDIAccess docs retrieved through Context7 /mdn/content.
The local Max/MSP retrieval did not contain directly relevant browser track-recording guidance. It is not evidence for this design.

## Verification
Deterministic engine tests for scheduling, frame windows, validation, memory, readiness, stale completion, cancel/disconnect/retry. Existing capture and sampler regressions. UI permission/unsupported/close/Stop tests. Production browser entry and fake-device tests where available. Build/lint, responsive inspection, local preview. Separate physical checklist: MIDI channel correspondence, CC9 polarity, notes versus sustained audio, effects bleed, clock reception, input latency, known loop timing, retry/cancel, disconnect and mute recovery. Passing software checks does not constitute physical-device verification.
