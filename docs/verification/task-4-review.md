# Task 4 independent review

Reviewed 2026-09-04 against `task-4-brief.md`, `audio-contract-research.md`, the implementation report, the complete 3,718-line Task 4 review package, and the relevant current implementations and callers. Baseline source: `/tmp/opstudio-before-task4/src`. Application source and browser tests were not changed by this review. No browser/server or broad test rerun was started.

**Spec verdict: changes required.** Frame/container conversion and most modal editing requirements are implemented, but transport, imported-value persistence, prior archive compatibility, mobile access, and per-buffer normalization have load-bearing gaps.

**Code-quality verdict: changes required.** The new pure frame helpers and boundary-specific serialization are sound improvements. The principal weaknesses are integration lifecycle ownership: the modal conflates intentional source stops with natural completion, and import association conflates initial hydration with restoring authoritative edited state. Several unit tests mock precisely those integration boundaries.

No P0 finding. Two P1 findings and nine P2 findings follow. These are software findings, not claims about physical OP-XY behavior.

## Actionable findings

### R1 — P1: Import association overwrites saved crossfade edits

- **Location:** `src/utils/importedCrossfade.ts:89-93`; actual callers `src/context/AppContext.tsx:1219-1222` and `1364-1367`.
- **Trigger:** Import a uniquely matched region with a 90% crossfade, deliberately change it to 25% and save, then add another sample or restore the session. `associateImportedCrossfades` always replaces `file.loopCrossfade` with the original region value. The durable serializer preserves the edited value, but the reducer discards it during restore. Save for all is vulnerable to the same reapplication.
- **Expected:** Existing deliberate edits and restored sample state remain authoritative. Associate imported values only when initial import/hydration needs them, with an explicit policy for replacing an imported preset. Preserve the untouched original JSON separately. Also re-evaluate prior automatically associated provenance if a subsequently added duplicate makes the identity ambiguous; the current ambiguous branch preserves the stale association.
- **Verification needed:** Real reducer/session and library restoration with both matching original region JSON and an edited crossfade, plus adding an unrelated file and adding a duplicate identity. Current storage fixtures do not include a matching imported region that can overwrite their edited values.

### R2 — P1: Previously valid v1 project archives become unreadable

- **Location:** `src/utils/projectArchive.ts:310-317`; unchanged archive version at `267`.
- **Trigger:** Load a Task 3 v1 archive containing an empty loop (`loopStart == loopEnd`) or marker seconds that are valid under the previous contract but not exact decoded-buffer frame boundaries. Task 3 exported these values unchanged; its archive fixture itself used `loopStart: 0, loopEnd: 0`. Task 4 rejects them before its new deserializer can normalize them.
- **Expected:** A bounded migration path for legacy v1 archives, followed by canonical normalization. Preserve structural, finite-number, audio integrity, size and reference checks. If stricter newly authored archives need a distinguishable contract, version it; do not claim all existing v1 archives remain compatible while rejecting previously generated files.
- **Verification needed:** An actual archive produced by the approved Task 3 serializer/importer, loaded through Task 4. Newly exported Task 4 round trips do not exercise backward compatibility.

### R3 — P2: Real source completion undoes Pause and can reset a newer preview

- **Location:** `src/components/common/WaveformZoomModal.tsx:282` and `301`; `src/hooks/useAudioPlayer.ts:899-905`.
- **Trigger:** Play, wait for a visible nonzero playhead, then Pause. Pause force-stops the source. Its asynchronous `onended` callback subsequently resets transport to stopped and the playhead to the initial boundary, so Play restarts rather than resumes. A late completion from a stopped older source can also clear the current note and UI after a newer start.
- **Expected:** Distinguish intentional stop/pause/cancellation from natural completion, and scope completion callbacks to the currently owned request/source. Preserve the paused position through the stopped source's ended event.
- **Verification needed:** Deliver `onEnded` after Pause and after a replacement source starts; do not just assert that the mocked release function was called.

### R4 — P2: P key ownership is cleared by playback rerenders

- **Location:** `src/components/common/WaveformZoomModal.tsx:312-318`.
- **Trigger:** Hold P to start a loop, then release P after playback has started. The key effect depends on `play`; starting playback changes transport and recreates `play`, so effect cleanup clears `previewHeldRef`. Keyup then sees no ownership and does not stop the note. Playhead updates can recreate the same effect as well.
- **Expected:** A held physical key remains owned across ordinary rerenders, until keyup or actual modal teardown/cancellation. Keep current callbacks available without using effect replacement as a key release.
- **Verification needed:** P down, asynchronous start completion, clock/render update, P up; assert no remaining source. Retain typing/modal ownership protections from Task 3.

### R5 — P2: Mobile table branches never render the editor they open

- **Location:** `src/components/multisample/MultisampleSampleTable.tsx:499-775` versus `1179-1197`; same pattern in `src/components/drum/DrumSampleTable.tsx:273` versus `776-787`.
- **Trigger:** On a user agent detected as mobile, tap the sample's zoom control. It sets the open state, but the early mobile return excludes the only `WaveformZoomModal` instance. Removing the portrait rotation gate cannot make this route usable.
- **Expected:** Mount the editor for both desktop and mobile branches, with identical draft, preview and Save behavior. Verify a real mobile user agent in portrait and landscape, not only a narrow desktop viewport.
- **Evidence:** Controller browser log `/tmp/opstudio-task4-browser.log` records missing dialogs for the Mobile Chrome and Mobile Safari editing cases. The missing modal branch predates Task 4, but delivering usable mobile loop editing is a direct Task 4 requirement.

### R6 — P2: Outside dragging can close the modal through a generated backdrop click

- **Location:** `src/components/common/WaveformZoomModal.tsx:233-248` and `359-361`.
- **Trigger:** Start a marker drag inside the canvas and release outside the modal content. The browser can generate a click whose target is the backdrop after pointer capture is released; the backdrop handler treats it as Cancel. The draft disappears instead of completing the drag.
- **Expected:** Ignore backdrop clicks generated by an active/just-completed drag; preserve deliberate independent backdrop dismissal. Outside pointerup should finalize the drag and keep the editor open, and pointercancel should restore its baseline.
- **Evidence:** The controller's WebKit editing test reaches the outside-drag assertion and then reports that the dialog no longer exists. The source has no drag-origin suppression for backdrop clicks. Confirm the exact browser event sequence while fixing; do not weaken the outside-drag assertion.

### R7 — P2: The inherited gain value is passed but never applied

- **Location:** `src/components/common/WaveformZoomModal.tsx:278-282`; `src/hooks/useAudioPlayer.ts:840-848`.
- **Trigger:** Set drum or multisample gain to a nonzero value and preview in the new editor. The callers forward gain and the modal passes it to `playWithADSR`, but that function never reads `options.gain`; its envelope is scaled only by velocity. Only the separate plain `play` function applies the dB gain.
- **Expected:** Apply the inherited gain consistently with the existing dB convention while retaining the raw ADSR values and velocity scaling. This is a missing requested integration, not evidence of calibrated hardware ADSR timing.
- **Verification needed:** Assert actual gain/envelope or rendered sample amplitude at two nonzero gain settings through the ADSR path, including release.

### R8 — P2: Released loops can play past the selected sample boundary

- **Location:** `src/hooks/useAudioPlayer.ts:854-865` and `671-674`.
- **Trigger:** Select a short sample range inside a longer buffer, enable loop until release, use a long release, then release. Looping playback starts without duration and stores no selected end boundary. Disabling `source.loop` lets it run to the full underlying buffer end, past the selected out point; reverse playback similarly can run past the selected in point. The displayed clock clamps at the selected boundary while audio continues.
- **Expected:** Preserve and enforce the selected range during the release tail, in either direction and at the chosen playback rate. An immutable bounded preview buffer or explicit source-position-aware stopping can satisfy this without imposing a duration on the sustained loop.
- **Verification needed:** Distinct audible/inspectable data outside a trimmed selection, with a release longer than its remaining tail, both forward and reverse.

### R9 — P2: Editing during playback makes the playhead describe different audio

- **Location:** `src/components/common/WaveformZoomModal.tsx:255-265` versus `272-282`.
- **Trigger:** Start a loop, then change loop/sample markers while it is playing. The sounding source retains its start-time buffer and boundaries, while every animation frame calculates against the current draft. The playhead now wraps or clamps at the new markers even though the source plays the old interval. Changing crossfade likewise updates the draft without updating the sounding copy.
- **Expected:** Either stop/restart the preview on a deliberate draft edit or keep a clearly owned immutable playback snapshot for both the source and its clock until restarting. Position display and sounding bounds must refer to the same preview generation.
- **Verification needed:** Change loop bounds and sample bounds while playing, then inspect source configuration and clock together.

### R10 — P2: Loop Off still applies loop crossfade processing

- **Location:** `src/components/common/WaveformZoomModal.tsx:275-276`.
- **Trigger:** Set a crossfade, disable looping, and play the selection. `requestedFrames` depends only on the presence of loop points, so the copied audio is still altered at the loop head even though `loopEnabled` is false. Turning looping off should not introduce loop smoothing into an ordinary one-shot preview.
- **Expected:** Apply this loop-specific approximation only when looping is enabled. Preserve the saved crossfade setting for later re-enablement.
- **Verification needed:** With disabled looping and a nonzero crossfade, inspect the buffer handed to actual playback and verify its samples match the source.

### R11 — P2: Save for all leaves other samples with invalid live ranges

- **Location:** `src/context/AppContext.tsx:1407-1427`; modal payload `src/components/common/WaveformZoomModal.tsx:349-351`.
- **Trigger:** Open a long sample, set a selection beyond the end of a shorter loaded sample, then Save for all. The reducers copy the same second values verbatim to every sample; they do not normalize against each actual buffer. Different sample rates can also leave fractional frame boundaries. Export/storage later normalize these values, but the live project and ordinary preview callers can observe invalid ranges in the meantime.
- **Expected:** Preserve one global history action while normalizing the applied sample/loop bounds for each recipient buffer. Retain the deliberate shared crossfade fraction without source-specific provenance.
- **Verification needed:** Save for all across different lengths and sample rates; inspect live state immediately, then Undo/Redo, preview and export. Existing modal tests only inspect the outgoing payload.

## Verification and scope disposition

The full implementation-reported unit/build evidence was inspected as evidence, not substituted for integration review. The controller completed the browser matrix with **66 passed and 9 failed**, recorded in `/tmp/opstudio-task4-browser.log`. Chromium's main editing/export scenario passed. Other failures include missing mobile dialogs, WebKit's outside-drag dismissal, a Firefox cut-toggle interaction, and portrait upload/dialog failures. This review does not classify every remaining browser failure as the same cause: the controller should disposition the Firefox toggle and portrait upload/event behavior separately during the bounded fix round.

The modal unit tests replace `useAudioPlayer` with a stub; their pause/resume test never delivers source completion. They therefore cannot establish real Pause or source ownership correctness. The added hook tests establish endpoint/reverse configuration but do not cover the selected release boundary or inherited gain. Container byte tests are materially useful: they inspect actual RIFF/AIFF bytes rather than just mock arguments.

**Inline gesture disposition:** No reachable global per-move inline editing regression was found. All four current `SmallWaveform` table callers supply `onZoomEdit`, which disables its drag handlers at `SmallWaveform.tsx:399-402`; the only live `EnhancedWaveformEditor` caller writes local drum-settings draft state and commits on Save. A preliminary suspicion about SmallWaveform history was withdrawn after reading these actual render paths. Its dead drag path still uses `length - 1`, but this review does not demand unrelated dead-code work or introduce a new inline surface. If a downstream task enables inline dragging, it must wire explicit physical gesture start/end/cancel to Task 3 history and the shared frame contract.

**Conversion padding disposition:** The 2,210-frame cut result with loop end 2,205 is explainable and predates Task 4. `cutAudioAtLoopEnd` adds `LOOP_END_PADDING = 5` source frames, then conversion allocates `ceil((2400 + 5) * 44100 / 48000) = 2210`. The selected loop boundary itself converts to 2,205. This is retained padding, not a new off-by-one bug or a fade algorithm. The Task 4 metadata correctly uses the actual final 2,210-frame count for crossfade (`round(.25 * 2210) = 553`). Document this retained behavior instead of calling the cut an exact unpadded truncation; no finding is raised against the accepted pre-existing policy.

**Positive contract checks:** The canonical helper permits a one-frame range and final boundary, clamps disjoint loops to the nearest valid frame, and never mutates source channels. WAV writes start unchanged and end minus one; AIFF writes end boundaries unchanged. Root-note-only WAV output has zero sample loops. Export crossfade scales by final buffer length and is not baked into export audio. Raw imported JSON is kept separately. Approximate crossfade/ADSR copy correctly avoids hardware certification, and raw envelope values remain export truth. Modal Save/Cancel and explicit per-save dispatch are structurally sound on the reachable desktop route.

**Existing issues outside this review:** No new general Task 1 export, Task 2 database, or Task 3 history findings were added beyond the direct Task 4 compatibility regressions above. Hardware ADSR timing, audible crossfade equivalence, OP-XY JSON interpretation and device import round trips remain pending physical verification as documented in the research note.

**Acceptance recommendation:** Do not accept Task 4 yet. Fix and verify R1–R11, disposition the remaining browser failures, and re-review the bounded changes before moving to the next implementation task.
