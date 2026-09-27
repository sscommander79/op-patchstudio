# Physical OP-XY check (pending)

Software tests use simulated MIDI and generated audio. They cannot certify OP-XY mute behavior, routing, or physical timing.

1. Save the OP-XY project. Use a short test pattern with a distinct sound on each of tracks 1–8. Note any originally muted tracks: this recorder finishes with all eight unmuted.
2. Connect MIDI to the OP-XY and route its stereo audio to a computer input. In OP-XY COM settings, enable the appropriate incoming clock/transport and control messages. Choose that exact MIDI output and audio input in the app.
3. Start with one bar, 120 BPM, and a short tail. Record test. Verify the desired track is present, the first attack is intact, and no subsequent pattern restart is captured.
4. Record two tracks. Import their WAVs into Ableton at the same start position. Listen and inspect attack positions. Measure any input delay before changing the advanced latency field. A positive adjustment should crop later in the captured input.
5. Test tracks with long release, shared effects, audio input and random/probability events separately. MIDI note mutes do not silence existing audio tails or isolate shared effects; sequential performances may differ.
6. Record all selected tracks, download the ZIP, and check track names, sample rates, channel counts and durations. Verify the manifest settings describe each recorded take.
7. Retry a track. Confirm the old take remains if the retry fails or is stopped.
8. Stop while recording. Confirm OP-XY transport stops and tracks 1–8 are unmuted. Disconnect MIDI during a test and follow the manual recovery message; the browser cannot send recovery messages to an unplugged device.
9. Send a recording to Slice this recording, assign sounds to OP-XY keys, and confirm the original reviewed recording remains available afterward.

Until these checks are performed, timing and track isolation remain unverified. This initial version covers short patterns with at most 16 seconds of music plus tail per track, not full-song export.
