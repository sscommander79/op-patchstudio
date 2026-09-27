# OP-PatchStudio: improvement assessment

Assessed 2026-09-05 against the local `codex/studio-upgrade` worktree, its acceptance evidence, and the live upstream backlog. This is a prioritized product and engineering assessment, not a claim that every possible idea has been discovered or that future features are implemented. Final automatic-capture verification is tracked separately in [auto-sampling.md](auto-sampling.md).

## Recommendation

Make this the quickest dependable route from **a sound you own to an instrument you enjoy playing on OP-XY**. The most valuable next work is connection setup, capture quality, easy review and reliable transfer. Broad device support and a cloud platform would compete with that goal before the core workflow has been heard on the hardware.

Keep three distinct promises: the app can verify a file, the browser can demonstrate a workflow, and a person can confirm an instrument sounds right on the OP-XY. None substitutes for the others. “Perfect multisampling” is not a testable universal promise: a recording captures a particular note, velocity, patch state and duration; it cannot preserve every live modulation or interaction of the original synth.

## What already exists

The fork already has guarded import review, sparse drum mapping, filename-based drum suggestions, exact frame/loop editing, crossfade metadata, waveform playheads, transient slicing/manual chopping, manual/sound-triggered batch recording, a local library, lossless project backups, bounded Undo/Redo, recovery, dark mode, responsive Focus/Table views, a demo and conservative offline updates. These were accepted in the earlier [acceptance matrix](acceptance-matrix.md), with physical-device/listening limits explicit.

The current automatic-capture source adds MIDI sequencing, a one-note test, note-range capture, warning/retry review, independent NINA/Digitakt and Ableton routing preferences, and cancellation ownership. It deliberately preserves source audio. Its latest verification status must come from the current report, not earlier test totals.

## Prioritized opportunities

Priority means sequence, not a fabricated delivery estimate. **Next** should follow successful first hardware tests; **Then** follows a demonstrated need; **Explore** needs a separate feasibility decision. Effort is relative: small = local UI/helper change, medium = several coordinated components and tests, large = subsystem/integration or platform work.

| ID | Opportunity and user benefit | Priority / effort | Evidence needed to accept it |
|---|---|---|---|
| C1 | Guided connection setup: separate “MIDI reaches synth” and “audio returns” checks, chosen channel, named route and visible input activity. Reduces silent sessions. | Next / medium | First-time setup succeeds for NINA/Digitakt and one Live instrument; no permission on loading a profile; changing or losing a device invalidates the check. |
| C2 | Make Test → Range seamless: let a successful test serve as the first matching note, or offer explicit replacement/removal. Currently occupied roots are blocked, so the test take must be removed before capturing the same range. | Next / small | Existing take remains until a successful replacement; exact roots and one review item per intended note; failed retry keeps original. |
| C3 | Progress by note with estimated time, completed/failed count, and clear stopping state. | Next / small | Estimate distinguishes recording time from setup; no false completion while audio is still sealing. |
| C4 | Persist capture jobs and completed takes for recovery; Resume only missing/failed notes after explicit route recheck. Current review tray is temporary. | Then / large | Crash/reload retains exact completed PCM and settings; no automatic MIDI on reopening; resumed jobs never duplicate successful notes. |
| C5 | Per-note retry for any take, including one that sounds wrong without triggering a warning; retain a small take history or A/B comparison. | Next / medium | Replacement is explicit and reversible; audition is excluded during recording; history respects memory limits. |
| C6 | Editable quiet/noise and clipping analysis with an explanation of each warning; detect one dead stereo channel, unexpected mono and DC offset. | Next / medium | Fixtures cover intentional quiet patches, asymmetric stereo and distorted sounds; warnings assist rather than silently transform audio. |
| C7 | Capture presets for pluck, sustained pad and one-shot; expose duration and size tradeoffs in plain language. | Next / small | Settings remain editable and within limits; longer envelopes are not truncated by a misleading preset. |
| C8 | Adaptive end-of-tail and between-note quiet detection, with a maximum time and manual override. | Then / medium | Noise floor, long reverb and continuously sounding patches terminate predictably; no overlap from the previous note; users can retain deliberate ambience. |
| C9 | Calibrated routing latency and onset alignment. Measure each actual route before proposing compensation. | Then / large | Repeatable impulse/onset measurements across buffer sizes and devices; drift distribution recorded; no claim of sample-accurate browser scheduling. |
| C10 | Batch selected patches only, with named jobs and verified program changes. | Explore / large | NINA patch/channel behavior verified; no unrequested patch changes; interrupted jobs recover without losing the original patch identity. |
| S1 | Non-destructive start/end suggestions with an attack safety margin and A/B audition. Addresses leading silence without eating soft attacks. | Next / medium | Slow attacks, quiet prefixes, noise and reverb fixtures; original audio and prior markers recoverable with Undo. |
| S2 | Sustain-loop suggestions: search only a user-approved sustain region, compare both channels, rank candidates and allow “no good loop.” | Then / large | Periodic, detuned, stereo, evolving and noisy patches; measured boundary error plus listening; no forced loop or unverified hardware crossfade equivalence. |
| S3 | Root-pitch/tuning check with confidence and “unknown.” Useful for detecting a wrong octave or route. | Then / medium | Octave errors and noisy/polyphonic samples covered; never retune or remap silently; known-pitch fixtures and hardware comparisons. |
| S4 | Adaptive note spacing within the OP-XY export zone budget. Spend more samples where timbre changes most. | Explore / large | Compare sparse and dense captures through blind listening; budget visible; hard zones/roots preserved and editable. |
| S5 | Capture multiple velocities/round robins for source preservation, while making target limitations explicit. | Explore / large | Verify target format and firmware before promising layered playback. Separate presets are a possible fallback, not equivalent to native layers. |
| S6 | Level-matched A/B playback and optional whole-instrument gain adjustment. Preserve relative note/velocity dynamics. | Then / medium | No peak normalization per note by default; measured headroom and listening comparisons; transformation recorded and undoable. |
| S7 | Envelope/loop preview calibration against recorded OP-XY output. | Next after hardware / large | Raw preset parameters paired with measured attack/release/loop behavior at multiple settings; preview approximation remains labelled until supported by measurements. |
| W1 | A compact capture workspace with Setup → Capture → Review → Export, while retaining the existing manual recorder. | Next / medium | User completes first instrument without confusing manual controls with automatic controls; keyboard-only and narrow viewport flows pass. |
| W2 | Bulk editing with a field selection checklist (“only play mode”, “only gain”), and preview of affected samples. | Then / medium | Unselected fields remain byte/value-identical; mixed values stay distinguishable; one Undo restores the batch. |
| W3 | Visual zone map showing range boundaries, overlaps/gaps and the currently triggered source. | Then / medium | Mapping shown matches exported regions; note naming convention never changes MIDI numbers; screen-reader alternative exists. |
| W4 | Library tags for source synth, patch, mood, instrument type and capture settings; duplicate detection by content. | Then / medium | Existing libraries migrate without loss; duplicate detection distinguishes audio identity from different settings; searches stay responsive. |
| W5 | Searchable in-app help, contextual loop/release explanations, and short route-specific walkthroughs. | Next / small | Links/labels match current UI; tutorial finishes with a playable file, not just a completed dialog; no essential network dependency. |
| W6 | Export presets for “preserve source”, “smaller file” and “mono”; show actual conversion consequences before export. | Then / medium | Previewed frame count/bytes agree with output; explain quality tradeoffs; preserve existing format validation. |
| W7 | More precise numeric editing and readable units; consistent validation, keyboard steps and error placement. | Next / medium | Empty/partial numeric input never hangs or corrupts settings; draft versus committed value is clear; invalid settings cannot enter export. |
| T1 | Transfer checklist with a clear `.opstudio` versus `.preset` distinction, folder preview and a tested-fixture badge. | Next / small | Real device accepts the shown extracted folder; “tested” includes firmware/date and never means all formats are certified. |
| T2 | Native companion for direct MTP upload, device file browsing and optional application audio capture. | Explore / large | First prove one new preset transfer and read-back checksum on Mac/OP-XY. Handle OS/Fieldkit ownership, unplug, partial transfer and names; stage then finalize without overwriting unapproved content. Local API must be origin-scoped and authenticated. |
| T3 | A small Ableton routing helper/template before considering a Max for Live device. | Then / medium | Works with a named Live version and one stock instrument; routes notes and audio without feedback; fallback instructions remain available. |
| T4 | Import external autosampler exports and preserve source mappings. Could deliver value sooner than rebuilding every advanced capture tool. | Explore / medium–large | Round-trip fixtures for each supported format, explicit unsupported-field report, source retained; no claim that Live/Logic/SampleRobot exports are automatically OP-XY-ready. |
| T5 | Additional device exporters (OP-1/field/OP-Z), each with its own constraints. | Explore / large | Separate validated writer, reference files and physical test owner for each device; no generic “all OP devices” compatibility claim. |
| T6 | Optional cloud backup/sharing with conflict-safe restore and provenance. | Explore / large | Local editing remains independent; authenticated sharing, quota/failure/version conflicts tested; never confuse cloud sync with a backup. |
| T7 | Online sample search with license/provenance metadata and explicit import. | Explore / large | Provider integration and permission costs understood; license information travels with project; no dependency for offline capture. |
| T8 | Tape editing, internet radio and broad DAW features. | Defer / large | Require a separate product case: presently they dilute the OP-XY instrument workflow and add significant formats/routing complexity. |
| R1 | Capture/export diagnostics bundle containing versions, settings, stage/error codes and timing; audio inclusion opt-in. | Next / medium | Useful for reproducing failures without private source audio; no device/account secrets; user can inspect the bundle. |
| R2 | Durable project checkpoints and visible storage health/quota. Extend existing lossless archives instead of inventing a second format. | Then / medium | Transaction faults and storage eviction recover conservatively; backup restore is tested, not merely backup creation. |
| R3 | Performance budget at 24 zones and high sample rates; worker-based analysis and cancellation for expensive operations. | Then / medium | Measure peak memory, main-thread blocking, load/export time and cancellation latency on a representative slower machine. |
| R4 | Accessibility with actual VoiceOver/touch testing, zoom and short landscape displays. | Next / medium | User observes focus, error announcements, numeric editing and Stop/Close; browser emulation is supporting evidence only. |
| R5 | A reference corpus of synthetic and user-approved real audio with file/export invariants. | Next / medium | Includes silence, clipped input, stereo imbalance, long release, malformed metadata and capacity boundaries; fixtures are redistributable. |
| R6 | Smaller recording/routing components and shared validation; format the dense controller/UI code for reviewability. | Then / medium | Behavior-preserving tests pass; refactor after current capture behavior stabilizes, with no broad rewrite. |
| R7 | Reproducible local workspace outside on-demand cloud storage, with verified backup of uncommitted work. | Now / medium | Working-tree bytes and git/worktree links match before retiring any location; a fresh install/build succeeds without hydration stalls. Do not delete or move the original blindly. |
| R8 | Release discipline: one frozen build identity, scoped evidence, remote CI after authorized publication, and small releases. | Now / small | Test outputs correspond to the exact final source/build; no green earlier run used to cover later edits; change log and user steps agree. |

## Refinement methods

1. **Measure the complete task.** Record time to first successful note, first five-note instrument, corrections required, and successful OP-XY load. A faster dialog is not success if it produces unusable audio.
2. **Use controlled comparisons.** Capture the same simple patch, range, velocity, hold/tail and audio settings before/after a change. Compare source recordings with the OP-XY output at matched listening level. Repeat with a slow pad only after the simple case passes.
3. **Protect attacks and dynamics.** Suggested edits remain drafts; retain original audio and processing settings. Compare both stereo channels. Distorted patches and very quiet sounds are not necessarily recording failures.
4. **Define quality gates before adding DSP.** Measure onset displacement, premature tail cuts, boundary discontinuity, pitch error on monophonic reference tones and export frame correctness. Numeric improvements must also survive listening tests; there is no single universal “perfect” score.
5. **Treat failures as first-class flows.** Exercise permission denial, missing inputs, disconnect, hidden page, repeated Stop, late callbacks, occupied notes, quota exhaustion and reload. A partial successful range must remain recoverable.
6. **Test from real artifacts.** Inspect the actual downloaded ZIP and source backup, then reimport them. Mock-only MIDI checks previously concealed a wrong WebMidi lookup; native synthetic devices provide a stronger integration boundary.
7. **Observe one user first.** Run the return checklist with this exact NINA/Digitakt/Live setup. Record where the instructions were needed; use that evidence to choose the next UI change before a broad redesign.
8. **Keep changes small and attributable.** One hypothesis, affected test, implementation, frozen review and release note. Repeat full suites only for meaningful source changes or unresolved failures.

## Approaches compared

| Approach | Advantage | Cost / limitation | Recommendation |
|---|---|---|---|
| Continue browser studio | Reuses existing editor, export, offline and backup work; no installer for basic editing. | Routing depends on browser/OS devices; background timing and device transfer need proof. | Primary path now. |
| Import from an established autosampler | Gains advanced capture options without implementing all of them here. | Adds an external step and format/mapping validation; may require software the user does not own. | Explore importer demand; do not require a purchase. |
| Native companion | Can address device transfer and application-level audio integration together. | Installer, signing, updates, local API security, platform testing and long-term maintenance. | Feasibility spike after hardware acceptance, starting with one Mac/OP-XY transfer. |
| Full native DAW/plug-in host | Maximum control of capture environment. | Much larger product; hosting requirements and stock Live instruments need special handling. | Not the next build. |

Apple’s Auto Sampler provides note-range, velocity and loop-search controls; SampleRobot offers automated capture and loop-editing workflows. These are useful usability benchmarks, not evidence that their algorithms or formats can simply be copied. Ableton Sampler supports expressive zone mapping; that does not establish equivalent OP-XY capabilities. [Apple controls](https://support.apple.com/guide/logicpro/auto-sampler-controls-lgced6eded3c/mac), [SampleRobot](https://samplerobot.com/pages/samplerobot), [Ableton instrument reference](https://www.ableton.com/en/manual/live-instrument-reference/).

Teenage Engineering documents MTP and Fieldkit for Mac transfers. This supports investigating a companion, but does not by itself prove direct browser upload will work. [OP-XY transfer guide](https://teenage.engineering/guides/op-xy/how-to).

## Live upstream backlog disposition

The GitHub API returned **27 open issues and 2 open pull requests** on 2026-09-05. “Covered” below means the local fork has a corresponding implementation/evidence; it does not close the upstream issue or certify physical behavior. Historical `BUGS.md` is not current fork status. Snapshot: `upstream-open-issues-20260905.json` beside this report.

| Upstream | Local disposition / next action |
|---|---|
| [#111](https://github.com/joseph-holland/op-patchstudio/issues/111) envelope preview | Partly addressed with honest approximation; physical calibration remains S7. Do not use the issue's timing claim as a measured device contract. |
| [#110](https://github.com/joseph-holland/op-patchstudio/issues/110) empty drum pads | Covered: sparse mapping/export evidence, Task 1. Physical sparse-pad check remains. |
| [#109](https://github.com/joseph-holland/op-patchstudio/issues/109) marker drag | Covered: pointer capture and Task 4 drag-outside tests. |
| [#108](https://github.com/joseph-holland/op-patchstudio/issues/108) batch recording | Covered: reviewed batch takes/assignment, Task 6. |
| [#107](https://github.com/joseph-holland/op-patchstudio/issues/107) sound trigger | Covered: sound-triggered recorder; real-input threshold tuning remains. |
| [#106](https://github.com/joseph-holland/op-patchstudio/issues/106) auto start marker | Remaining refinement S1; sound triggering is not an equivalent post-recording trim suggestion. |
| [#105](https://github.com/joseph-holland/op-patchstudio/issues/105) save selected settings to all | Existing bulk tools are partial coverage; verify field-selective behavior before claiming equivalence. W2. |
| [#102](https://github.com/joseph-holland/op-patchstudio/issues/102) crossfade | Covered: editing/export metadata; actual audible device parity remains. |
| [#100](https://github.com/joseph-holland/op-patchstudio/issues/100) playhead | Covered: detailed waveform transport/playhead. |
| [#99](https://github.com/joseph-holland/op-patchstudio/issues/99) release-loop help | Documentation/preview explanations exist; refine contextual explanation and test understanding under W5. |
| [#97](https://github.com/joseph-holland/op-patchstudio/issues/97) filename drum suggestions | Covered: explicit reviewed proposals in `audioImport.ts`/import provider. |
| [#96](https://github.com/joseph-holland/op-patchstudio/issues/96) local install | README has served development/preview instructions; offline production checks exist. R7 addresses the newly observed cloud-file issue. |
| [#76](https://github.com/joseph-holland/op-patchstudio/issues/76) tutorials | Partly covered by demo/help; route walkthroughs and a hardware checklist extend this. W5. |
| [#75](https://github.com/joseph-holland/op-patchstudio/issues/75) README | Fork README rewritten; keep automatic-capture instructions synchronized with final UI. |
| [#71](https://github.com/joseph-holland/op-patchstudio/issues/71) transient slicing | Covered: preview/edit/apply/Undo, Task 5. |
| [#57](https://github.com/joseph-holland/op-patchstudio/issues/57) system-audio companion | Virtual routing guidance now; native companion remains T2/T3. |
| [#56](https://github.com/joseph-holland/op-patchstudio/issues/56) tape editor | Defer: separate product scope T8. |
| [#55](https://github.com/joseph-holland/op-patchstudio/issues/55) tape backup | Defer until device-specific storage/restore contract and test owner exist. |
| [#54](https://github.com/joseph-holland/op-patchstudio/issues/54) online libraries | Explore T7 after core workflow. |
| [#53](https://github.com/joseph-holland/op-patchstudio/issues/53) more OP exporters | Explore T5; no blanket compatibility. |
| [#52](https://github.com/joseph-holland/op-patchstudio/issues/52) radio recording | Defer T8; external streaming and content provenance are additional work. |
| [#51](https://github.com/joseph-holland/op-patchstudio/issues/51) dark theme | Covered: Task 8 theme/canvas/contrast evidence. |
| [#50](https://github.com/joseph-holland/op-patchstudio/issues/50) live chopping | Manual audio-clock chopping covered; beat quantization is not claimed complete. |
| [#49](https://github.com/joseph-holland/op-patchstudio/issues/49) cloud/device sync | Local backups covered; cloud/device synchronization remains T6. |
| [#48](https://github.com/joseph-holland/op-patchstudio/issues/48) device browser/backup | Explore T2; current export is not a device file browser. |
| [#43](https://github.com/joseph-holland/op-patchstudio/issues/43) mobile pinning | Pinning code and responsive tests exist; reproduce on a physical touch device before calling this device issue closed. |
| [#42](https://github.com/joseph-holland/op-patchstudio/issues/42) octave swipe | Alternative octave controls exist; physical swipe-specific acceptance remains to check. |
| [PR #113](https://github.com/joseph-holland/op-patchstudio/pull/113) desktop-app drag payloads | Corresponding intake/guarded review was implemented in Task 7; confirm real Splice drag separately if used. No upstream PR merged here. |
| [PR #114](https://github.com/joseph-holland/op-patchstudio/pull/114) test gate | Fork already has broader local/CI configuration; remote CI/branch protection require publication/configuration authorization. |

## Cost-conscious execution

Use Astra for bounded design decisions, source review and acceptance; one Sol worker for cohesive implementation/testing. Use smaller mechanical tooling for file inventories, fixture generation and comparisons. No AI inference is needed each time a musician records a patch.

Genspark is appropriate for a future large cross-product/format research packet, not for local real-time audio or file-identity tests. No general Genspark research tool is callable in this session. The Max/MSP reference query was attempted and failed because its generated-answer API key is absent; no answer from that query informed a DSP implementation. Current assessment uses primary manufacturer/product documentation and local evidence. Do not add accounts, paid dependencies or duplicate research simply to redistribute tokens.

## Next decision after the return test

If both routes and OP-XY playback pass, prioritize **C1/C2/C5/W1** (connection and review friction), then **S1/S2** (non-destructive trim/loop suggestions). If capture quality fails, resolve that specific route/timing problem first. If transferring files is the main remaining friction, investigate **T2** before expanding the sampler's sound-processing features.
