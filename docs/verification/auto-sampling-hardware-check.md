# Automatic sampling: hardware acceptance

Status: NOT PERFORMED. Synthetic browser results do not establish NINA, Ableton routing or OP-XY playback quality.

## First test: NINA through Digitakt II

1. Select one simple NINA patch with a clear attack and short release. Keep patch settings unchanged during the run.
2. Connect NINA's USB-C DAW port to the Mac for MIDI. Connect NINA main left/right audio outputs to Digitakt II IN L/R; connect Digitakt II USB to the Mac. MIDI carries control, not NINA's audio.
3. In Digitakt II choose USB AUDIO/MIDI and the USB OUT source EXT where supported by the installed firmware. This sends the external inputs to the computer rather than the full Digitakt mix. Keep monitoring separate from the capture return to avoid feedback.
4. In the app choose the matching audio input, NINA MIDI output and patch MIDI channel. Start with a single test note, velocity100, one-second hold and one-second tail. Set sensible input gain on the hardware; the app must not silently normalize the patch.
5. Listen to the captured note. Confirm the attack is intact, the release is complete, both stereo channels are correct and no note remains held after Stop. Record actual audio-interface settings and any warning.
6. After listening, remove the one-note test from the review tray so its root is free for the range. Capture MIDI notes48,54,60,66,72. Listen to each take before Apply. Confirm the root numbers and that failed/retried takes do not erase a prior good capture. Apply once and confirm Undo restores the prior instrument.
7. Export the OP-XY preset, transfer through MTP/Fieldkit and play across note boundaries. Check pitch, attacks, release behavior and unwanted loop/click artifacts. Record OP-XY firmware and the tested preset archive.

## Second test: Ableton stock instrument

1. Create one MIDI track with a stock instrument and fixed patch. Use an external virtual MIDI route (for example a configured macOS IAC bus) into that track.
2. Route that track's output to a virtual audio input available to the browser. A configured BlackHole device is one option. Do not include the app's own monitoring/output in the captured route.
3. Select those routes in the app and repeat the one-note and short-range tests above. An installed AU/VST or Live stock device remains hosted by Live; the browser does not host it.
4. Record Live version, instrument/patch, MIDI channel, routing, audio sample rate and audible results. Test a longer-release/evolving patch separately after the simple patch succeeds.

## Evidence record

For each route record date, computer/browser version, synth/firmware or Live instrument, interface settings, note range/velocity/hold/tail, source take identities, exported archive, clipping/silence warnings, Stop/Cancel behavior, transfer outcome and listening observations. All entries remain pending until actually observed. Direct automatic upload is not part of this version.

References checked during design: [NINA manual](https://www.melbourneinstruments.com/s/NINA-UserManual-1-3-June-2023.pdf), [Digitakt II manual](https://www.elektron.se/wp-content/uploads/2025/06/Digitakt-2-User-Manual_ENG_OS1.15_250625.pdf), [Apple IAC routing](https://support.apple.com/guide/audio-midi-setup/transfer-midi-information-between-apps-ams1013/mac), [BlackHole routing](https://github.com/ExistentialAudio/BlackHole), [OP-XY transfer guide](https://teenage.engineering/guides/op-xy/how-to). Menu names may depend on installed firmware.
