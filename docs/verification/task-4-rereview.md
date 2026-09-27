# Task 4 bounded re-review — round 1

Reviewed 2026-09-04. Scope: R1–R11 from `task-4-review.md`, the 713-line round-1 diff against `/tmp/opstudio-task4-before-round1/src`, the implementation report's remediation section, the changed source and its actual callers, and regression evidence. Source and browser tests remained frozen. This review started no browser, server or test rerun.

**Spec verdict: changes required.** Nine findings are resolved; R1 and R9 each retain a narrower P2 integration case described below. The prior P1 data-loss and archive-readability triggers are fixed.

**Code-quality verdict: changes required for the two bounded residuals.** Source completion ownership, stable physical key ownership, bounded voice buffers and per-recipient normalization now have coherent implementations. The remaining issues concern distinguishing initial hydration from explicit preset replacement, and using a valid common resume position for the source and clock.

## Finding dispositions

| Prior finding | Disposition | Current evidence |
| --- | --- | --- |
| R1 — crossfade edits overwritten on restore/add | Original P1 trigger fixed; narrower P2 replacement case remains | `importedCrossfade.ts:98` preserves existing values. Matching-JSON archive/reducer and library restoration tests now preserve `{ fraction: .25 }`. Automatically associated provenance is removed when a later duplicate makes the identity ambiguous. Explicit replacement still incorrectly preserves old automatic values; see RR1. |
| R2 — legacy v1 archives rejected | Resolved | `projectArchive.ts:304-316` validates finite legacy marker bounds before the canonical deserializer normalizes them. Structure, ZIP, audio, reference, size and crossfade shape checks remain. Actual approved Task 3-generated archive fixture is tested, rather than a current serializer simulating old output. |
| R3 — Pause/new voice reset by old completion | Resolved for reviewed trigger | `WaveformZoomModal.tsx:146-151,290-296` clears ownership before stopping and checks request generation plus returned note ID. Tests now deliver old completion after Pause and after a replacement starts. Resume retains the full selected voice rather than shortening its loop. |
| R4 — P key ownership lost during rerender | Resolved | `WaveformZoomModal.tsx:344-353` keeps listeners stable while callback refs update. Key ownership survives asynchronous playback rerender until keyup or actual teardown; regression test includes that transition. |
| R5 — absent mobile editor | Resolved in source; browser acceptance belongs to controller | Both table mobile return branches now mount the same editor props and callbacks as desktop. The controller's running round-1 log already records all five portrait cases passing; this is not a claim that its complete matrix passed. |
| R6 — outside drag backdrop cancellation | Resolved in source | The backdrop now dismisses on independent backdrop pointerdown (`WaveformZoomModal.tsx:396`), so the click synthesized after pointerup cannot cancel the modal. Regression test delivers that trailing click. |
| R7 — inherited gain ignored | Resolved | `useAudioPlayer.ts:859` combines velocity with the existing `10^(dB/20)` gain convention before scheduling ADSR. Positive and negative gain cases inspect both envelope and release curves. |
| R8 — release audio beyond trim | Resolved | `useAudioPlayer.ts:801-818` copies only the canonical selected frames, reversing that bounded copy when needed. Loop times are rebased to it. Disabling loop cannot expose frames excluded from this buffer; tests inspect distinct forward/reverse sample data and source immutability. |
| R9 — live draft retargets clock only | Original active-playback trigger fixed; paused-edit P2 case remains | `previewClockRef` stores copied bounds and settings for the sounding voice. The active marker-edit regression test verifies the old source/clock remain aligned. Resume after changing the selected range needs RR2. |
| R10 — crossfade applied with looping off | Resolved | `WaveformZoomModal.tsx:280` gates smoothing on loop enablement. The disabled-loop regression inspects unchanged channel data passed to playback. |
| R11 — Save for all leaves invalid recipient bounds | Resolved | Both reducers normalize against each recipient buffer. Multisample crossfade is converted to a shared, normal-range fraction. The real history/context test covers two durations/sample rates and one Undo/Redo operation. |

## Remaining actionable cases

### RR1 — P2: Explicitly importing a second preset retains the first preset's automatic crossfade

**Location:** `src/utils/importedCrossfade.ts:95-100`; actual replacement path `src/context/AppContext.tsx:1291-1296`, reached by `src/components/multisample/MultisamplePresetSettings.tsx:200`.

**Exact trigger:** Load `tone.wav`; import preset A with its unique region `{ sample: 'tone.wav', framecount: 100, 'loop.crossfade': 25 }`. Do not edit its crossfade. Explicitly import preset B with the same unique sample identity but crossfade `90`. The second import replaces `importedMultisamplePreset` and hydrates its settings, but `file.loopCrossfade ?? region.crossfade` retains A's automatic 25% value and provenance. Preview and export therefore ignore B's valid 90% value. No ambiguity or mapping warning explains this omission.

**Expected behavior (controller ruling):** A deliberate `IMPORT_MULTISAMPLE_PRESET` applies each newly and unambiguously matched region crossfade as part of that one undoable import, replacing prior automatic or manual values for the matched sample. Ordinary sample addition, session restore and library restore retain authoritative edited state. Unmatched or ambiguous raw regions stay unapplied; invalidate stale automatic associations without discarding an unmatched human-authored fraction. Do not restore the old R1 behavior that overwrote edits on every sample addition or session reload.

**Required verification:** Sequential real reducer imports of two matching presets, both with and without an intermediate manual edit, and one Undo restoring the prior value; retain the existing add/restore edited-value preservation tests and duplicate/unmatched identity tests. The current new test verifies add/restore retention, not replacement.

### RR2 — P2: Editing bounds while paused gives source and clock different resume positions

**Location:** `src/components/common/WaveformZoomModal.tsx:278,285-287,306-308`; downstream offset clamp `src/hooks/useAudioPlayer.ts:863`.

**Exact trigger:** In a 100-frame, 100 Hz sample, play to frame 50 and Pause. Change Sample start to frame 80, leaving end at 100, then Play. The modal retains `startFrame = 50` and passes offset `(50 - 80) / 100 = -0.3`. The hook clamps that offset to zero, so audio actually resumes at source frame 80, while the clock still starts at 50. The displayed playhead sticks at 80 for the first 30 frames of calculated travel, then remains behind the source. If the paused point lies beyond a newly shortened end, the source can instead begin at its buffer end and finish immediately while the UI describes an in-progress resume. Reverse playback has the corresponding case.

**Expected behavior:** Normalize or reset the paused position against the current selected range before constructing both the source offset and the clock. If editing invalidates resume, consistently restart at the appropriate boundary. A positive-length nonlooping forward resume must begin before the selected end, and reverse handling should follow the same boundary convention as its bounded voice.

**Required verification:** Pause, move the sample start past the paused frame, resume; also shorten the end before the paused frame and cover reverse. Assert both the actual hook offset/buffer and displayed clock, beyond only the first clamped frame.

## Evidence and limits

The implementation reports 84 focused and 569 full passing unit tests plus build/lint checks for this frozen round. The expanded tests now exercise several previously mocked-away transitions. They do not cover RR1 or RR2, so their passing totals do not settle those cases.

The actual Task 3 fixture generation log `/tmp/opstudio-task4-task3-fixture.log` records an archive emitted and reimported by the approved prior implementation: 2,190 bytes, SHA-256 `2a8848a7d74ec1c932bc91b8a44f1fc14df829c3c408a79c3db5eec2055b94ec`. Its current regression then checks canonical restoration. This is appropriate backward-compatibility evidence. The v1 migration accepts bounded finite legacy marker values and normalizes them; it does not claim fractional or empty ranges remain canonical live state.

The controller owns `/tmp/opstudio-task4-round1-browser.log`. At review time the run was still in progress and already contained failures in the main editor/export and drum scenarios; it must not be reported as a passing matrix. Those failures require controller disposition and are not assumed to share a cause with RR1/RR2.

No broader re-audit of Tasks 1–3 or new inline editor requirement was introduced. The prior disposition that live inline waveform edits are local modal drafts remains unchanged. The pre-existing five-source-frame cut padding remains outside these findings. Physical OP-XY validation, audible crossfade equivalence and ADSR timing calibration remain pending exactly as in the research note.

**Recommendation:** Fix RR1/RR2, disposition the controller's actual browser failures, then perform a focused final check of those changes.
