# When you return: testing OP-PatchStudio

Start with one NINA note. You do not need to complete every test at once. Software verification is recorded in [auto-sampling.md](auto-sampling.md); this checklist covers what needs your equipment, ears and choices. All physical results are pending until you perform them.

## 1. Prepare the first route

- Open the local app at **http://127.0.0.1:5188/**. Back up any work you want to keep as an `.opstudio` project before replacing it. If an update is offered, save first and close other Studio tabs before updating.
- Have headphones, NINA, Digitakt II, OP-XY, USB connections and two audio cables available. Note your browser, Live version and device firmware versions; no firmware update is required for this first test.
- Choose one simple NINA patch with a clear attack, short release and no arpeggiator/held notes. Leave its settings fixed during the test.
- Connect **NINA DAW USB-C → Mac** for MIDI, **NINA main L/R → Digitakt II IN L/R** for audio, and **Digitakt II USB → Mac**. NINA's USB-C carries MIDI; it is not the audio return. [NINA manual, rear panel and MIDI appendix](https://www.melbourneinstruments.com/s/NINA-UserManual-1-3-June-2023.pdf).
- On Digitakt II, use **USB CONFIG: USB AUDIO/MIDI** and **USB OUT: EXT** to send its external inputs to the computer. These menu names are documented for OS 1.15; if yours differ, report what you see instead of changing unrelated settings. Keep the Digitakt sequencer stopped. [Digitakt II manual, sections 14.6.4 and 14.8.1](https://www.elektron.se/wp-content/uploads/2025/06/Digitakt-2-User-Manual_ENG_OS1.15_250625.pdf).

## 2. Capture and hear one NINA note

1. In **Multisample → Record takes**, choose **NINA through Digitakt II** under Routing profile, then the Digitakt audio input, NINA MIDI output and the channel used by your NINA patch. Enable MIDI if requested.
2. If the audio inputs have generic names, **Enable input** can request audio permission; then **Stop recording** releases that manual input session. Select the now-labelled Digitakt input before automatic capture. Do not use an unidentified default microphone as the synth return.
3. Start with **Start note 48, End note 72, Note step 6, Velocity 100, Hold duration 1 second, Release tail 1 second**. Click **Test one note**. Grant browser audio/MIDI permission when you deliberately start that action. Keep the app visible.
4. Audition the completed take. Does it contain the intended NINA sound, both stereo channels, the whole attack and the whole release? Is there unwanted silence, clipping or another device playing? A little leading capture time is currently preserved; automatic trimming is not applied.
5. Test Stop once during another note. The app should release its note and discard the unfinished take. If the synth continues sounding, stop that note on NINA and report the route/settings; disconnecting a cable can prevent a note-off message from reaching it.

If you hear no sound, stop here. Report whether NINA received a note, whether the app showed input activity, and the exact input/output/channel selected. Repeatedly recording a full range will not fix an incorrect route.

## 3. Build the short instrument

1. After listening, remove the one-note test from the review tray so note 48 is free. Capture the default range: **48, 54, 60, 66, 72**. The app blocks occupied roots rather than silently replacing them.
2. Listen to each take. Retry warned captures after fixing the cause. If an unflagged take sounds wrong, keep a note of it; do not assume a clean warning list guarantees a good musical result.
3. Click **Add selected takes**. Confirm there are five intended root notes. Use **Undo** once, confirm the instrument returns to its prior state, then **Redo**.
4. For this first unlooped sound check, turn **loop enabled** off in the multisample settings before exporting. The instrument defaults may otherwise loop the entire recording, including its attack and release. We will test deliberate sustain loops separately after the basic capture passes.
5. Save both a **project backup (`.opstudio`)** and a **device preset (`.preset.zip`)**, using a new test name such as `NINA first test`. The project is for this app; the preset is for the OP-XY.

## 4. Play it on OP-XY

1. Extract the device ZIP. Keep `patch.json` and the audio inside the extracted `.preset` folder together.
2. Connect OP-XY to the Mac, press **COM**, then **M4** for MTP. Use Fieldkit on Mac and copy the new `.preset` folder into `presets`. Use a new test name so you do not replace a valued preset. Eject with M4. [Official OP-XY transfer instructions](https://teenage.engineering/guides/op-xy/how-to).
3. Load the preset and play low, middle and high notes, then notes between the sampled roots. Check that pitch rises in the expected direction, attacks are intact, note boundaries are reasonable and release behavior sounds right.
4. Tell me whether the result is musically useful. “The file loaded” and “the instrument sounds good” are separate results.

If the return-test pack contains a Studio Seed demo preset, you can transfer that first to check the export/transfer path independently of your recording setup. Synthetic automatic-capture files are technical fixtures, not recordings of NINA and not a tuned musical reference.

## 5. Repeat with one Ableton stock synth

1. Use one Live MIDI track and a simple stock instrument patch. Disable the other tracks/clips for this test.
2. Use a dedicated virtual MIDI route such as an enabled macOS IAC bus. In Live, enable Track input for that port, select it and the chosen channel under MIDI From, and use Monitor **In** for this test. [Apple IAC setup](https://support.apple.com/guide/audio-midi-setup/transfer-midi-information-between-apps-ams1013/mac), [Live routing/monitoring](https://www.ableton.com/en/manual/routing-and-i-o/).
3. Route the instrument's audio to a virtual audio input the browser can select. BlackHole is one option if already installed/configured. Keep app playback out of that captured return. [BlackHole routing documentation](https://github.com/ExistentialAudio/BlackHole).
4. Choose the **Ableton virtual routing** profile in the app, select that MIDI/audio pair, and repeat the one-note → five-note → OP-XY checks above. Live continues to host the stock instrument; the browser does not load it as a plug-in.
5. If virtual routing is not configured, that is the next assisted setup task. You do not need to buy an additional sampler or change your normal Live template to complete the NINA test.

## Optional second pass

Once the simple sounds pass, try one longer-release/evolving patch, then a stereo effect-heavy patch. Increase hold/tail within the app's limit and describe any cutoff, loop click, phase change or loss of movement. Do not expect a short one-velocity recording to reproduce every modulation of the original synth.

For the wider studio, useful checks are: sparse drum pads on OP-XY, physical phone touch/scroll/octave controls, VoiceOver navigation if you use it, reopening a saved project, and a real desktop-app sample drag if that is part of your workflow. The full [device checklist](device-validation-checklist.md) records format/marker/envelope checks for later coverage.

## What to send back

Copy this short record for each route. Keep the `.opstudio` and `.preset.zip` files if a result is wrong so I can reproduce it.

```text
Route: NINA / Ableton
Browser and OS:
NINA / Digitakt / OP-XY firmware, or Live version + instrument:
Patch name:
Audio input / MIDI output / MIDI channel:
Notes / velocity / hold / tail:
One-note test: heard correctly / silent / clipped / other
Five-note capture: pass / failed note numbers
Stop released note: yes / no
Undo and project reopen: pass / fail / not tried
OP-XY import: pass / fail / not tried
OP-XY sound: useful / describe what differs
Exact error text, if any:
Saved test filenames:
```

If a local-file warning prevents loading or updating the app, tell me that before hardware testing. Cloud-only project files were an observed development blocker; do not delete the project, clear browser storage or overwrite your presets to troubleshoot it.
