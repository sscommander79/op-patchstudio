# User recording review — 2026-09-19

Status: audio problem NOT demonstrated resolved. No production code changes in this review.

Evidence: inspected screen recording frames at three-second intervals and full resolution at3s. Recording shows old raw-frame audition labels with pending Update now notice behind dialog. Extracted audio for analysis; no claim of reliable subjective listening judgment. Located matching local Mobbngz Drum.wav, stereo44100Hz465225frames (506367 at48000Hz). Source remained unchanged and was not sent to Genspark or added to repository.

Local old-detector reproduction first cuts:2552,18334,33837,50017,60538, matching the video. New detector:1979,17779,33713,50002,59842. Both returned33 regions in the ffmpeg-resampled test; video shows34, so resampling/runtime equivalence is approximate, not exact.

Residual evidence: around cut17779, an abrupt signal rise exists at17514 (about5.5ms before cut), with peak amplitude0.08645 in the preceding240frames. Other boundaries need local high-resolution review. Waveform evidence establishes that moving cuts earlier did not universally precede initial attack activity. Do not treat synthetic tests or cached-client diagnosis as resolution of the user's complaint.

Genspark received code plus observed numerical/UI findings, not user audio/video. Its read-only recommendation follows; source-separation claims must remain limited, and no automatic update may discard a draft.

**Assessment**

The video reflects two separate problems, neither attributable to user error:

- **Stale client:** the 34 unlabeled audition controls and raw-frame workflow are older cached UI. The current modal labels auditions and provides a waveform, manual mode, and Stop controls (`SliceAudioModal.tsx:155-175`). However, the blocking modal uses `z-index: 10000`, so the update notice can remain hidden behind it. The update flow requires explicit consent before reload, which is correct, but discovery and safe timing are inadequate.
- **Residual boundary error:** the newer onset results are closer, but the actual-source observations show some markers still land after an incipient attack. Synthetic onset tests do not establish that one-shot beginnings are intact.

**Current Coupling**

The data model is a sorted list of start markers plus one final `sliceEnd`. `buildSliceRanges()` sets each slice’s end to the next slice’s start (`audioSlicing.ts:239-243`). Consequently, moving a marker changes both the selected sound’s start and the preceding sound’s end. There is no way to preserve a clean silent gap between sounds: assigning the next attack correctly necessarily extends the previous slice to that same frame.

This is **trimming**, not source separation. Independent Start/End controls can exclude silence, tails, bleed, or the next incipient attack; they cannot isolate simultaneous or overlapping instruments.

**Implementation Recommendation**

Make the primary editor sound-oriented rather than marker-oriented:

- Show a numbered sound list. Selecting “Sound 2” highlights its region and displays an enlarged, zoomable waveform centered on its boundaries.
- Provide obvious **Play / Stop**, **Previous / Next**, and keyboard equivalents.
- Store independent `{start, end}` ranges. Present Start and End in milliseconds/seconds by default, with waveform dragging. Permit `current.end < next.start` so clean gaps are discarded.
- Put frames, sensitivity, minimum spacing, marker insertion, and exact numeric editing under **Advanced**.
- Re-run automatic detection as a proposal, never silently overwrite manual edits without confirmation.
- Show placement before Apply: “24 sounds go to pads; 10 remain unassigned.” Require an explicit choice for `>24`: apply first 24 and retain overflow, choose sounds, or cancel.
- Preserve the source asset unchanged. Apply should create derived one-shots as one undoable batch; Cancel must create nothing; Undo must remove all products and restore any replaced source state.
- Surface the update notice above the modal, but disable immediate reload while slicing or while unsaved changes exist. Offer “Update after Save/Close”; never auto-reload and risk loss.

**Acceptance Checks**

Using the local actual source only, without reading or transmitting it:

- Verify every proposed cut around `1979, 17779, 33713, 50002, 59842` at high zoom and by audition; starts must precede the first audible attack.
- Confirm each End can stop in the quiet gap before the next attack without moving that next Start.
- Verify all detected sounds with Previous/Next and Play/Stop, especially low-level attacks.
- Confirm exact preservation through Cancel, Apply, Undo, and re-open.
- Confirm explicit, accurate behavior for 24 and more than 24 outputs.
- Confirm a pending update remains visible and cannot reload away active work.

**Top 3 Risks**

1. Late cuts remove attack transients and permanently weaken derived one-shots.
2. Coupled boundaries force either next-hit leakage or damaged starts.
3. Hidden update state leaves users on stale behavior or encourages unsafe reloads.
