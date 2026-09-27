# Task 7 independent spec and quality review

Date: 2026-09-04. Reviewer: Astra. Branch: `codex/studio-upgrade`. All implementation changes remain uncommitted.

**Spec verdict: changes required. Quality verdict: changes required.** The shared preparation/review/atomic-commit architecture is present, and the reported automated gates are green. Nine findings below prevent Task 7 acceptance, including the bounded late pre-fix identity addendum R9. Passing tests do not cover the demonstrated boundary failures.

## Scope and evidence

Read the entire 4,151-line `task-7-review-package.txt`, including new source/tests and fixture hashes, the Task 7 report, brief, integration checklist, browser checklist, upstream-import notes, approved design, and plan/global constraints. Reviewed against the accepted Task 6 source baseline `/tmp/opstudio-before-task7/src`; the supplied E2E baseline is `/tmp/opstudio-task6-before-round2/tests`. Also inspected actual callers, serializer/archive admission, history, and relevant existing audio-header code to resolve specific questions. This is a Task 7 review, not the final Task 10 cross-feature audit.

Inspected the retained outputs: focused **97/97**, full unit **726/726**, production build completion, and controller full browser **105/105** (1.2 minutes). Logs: `/tmp/opstudio-task7-focused-green.log`, `/tmp/opstudio-task7-full-unit-green.log`, `/tmp/opstudio-task7-build-green.log`, `/tmp/opstudio-task7-full-browser.log`. Controller separately reported the localized new browser **10/10** pass. The implementer reports scoped lint clean; inherited global lint work remains Task 9. Earlier interactive RED observations were not independently rerun or reconstructed.

Ran only bounded read-only source probes: transpiled actual pure modules in memory; exercised real File objects, directory callback/iterator failures, preset validation, and actual ZIP export/import. One AIFF allocation-boundary probe used an allocator that records its arguments and immediately throws; **no large allocation was performed**. No browser/server, broad test rerun, runtime/test/config edit, commit, or publication was performed by this reviewer. This review document is the only written artifact.

## Findings

### R1 — P2: The desktop drum-row multiple chooser silently keeps only its last file

Location: `src/components/drum/DrumSampleTable.tsx:563-566`; integration at `src/components/drum/DrumTool.tsx:122` and `src/components/common/AudioImportProvider.tsx:24-26`.

Trigger: select two or more valid audio files through a desktop drum table row's `multiple` file input. Its `forEach` calls `handleFileSelect` separately, and each reaches `beginFiles([file], ...)`. Every provider start increments the generation and aborts the previous operation before its first awaited resolution can publish. Only the last file reaches review; preceding selected files have neither rows nor rejected-file explanations.

Evidence: direct trace of the actual rendered input through the actual parent callback and shared provider. Existing browser helpers exercise single-file row/key imports and the separate general batch chooser, so the green matrix does not exercise this path. Send one captured batch with the intended pad sequence through one operation; add an actual desktop row multi-chooser regression that verifies all selected identities, retained overflow, and one Apply/Undo.

### R2 — P2: Actual chooser prefilters still bypass visible shared rejection handling

Location: `src/components/drum/DrumTool.tsx:103-125`; `src/components/multisample/MultisampleSampleTable.tsx:247-276`.

Trigger: choose a zero-byte WAV through an individual drum key/row, or choose an unsupported file alongside a valid audio file through multisample Browse using the chooser's all-files option. The drum caller throws before shared intake and only logs to the console. Multisample Browse filters the unsupported file before `onFilesSelected`, leaving shared intake unable to identify or explain its omission. A signature-valid file with absent MIME and an unexpected extension is also dropped at these callers despite the shared reader's signature-based behavior.

Evidence: actual caller source, including the still-active `extractAudioFiles` call. These filters are inherited code left in an explicitly inventoried Task 7 integration seam; they are not isolated fallback handlers. Route every selected File into the shared classifier so malformed/unsupported/empty input gets a visible per-item disposition consistently across chooser and drop surfaces.

### R3 — P2: A later directory enumeration failure discards earlier accessible children

Location: `src/utils/externalFileIntake.ts:60-61,67`.

Trigger: a legacy reader returns a successful first batch containing `good.wav`, then its next `readEntries` call fails; equivalently, a modern directory iterator yields a valid file handle and subsequently throws. Both walkers collect all children before processing any. The enumeration exception escapes before the collected children are walked, so already accessible children vanish.

Evidence: probes against the actual module returned `files: []` with `later directory batch denied` for the legacy case, and `files: []` with `later iterator denied` for the modern case. Each first batch/yield supplied a real nonempty File. Current regressions exercise failed child `file/getFile` resolution, not failed enumeration after a successful batch. Preserve, sort, and process captured children while reporting the directory-level failure; retain cancellation propagation and bounds.

### R4 — P2: Coercion admits an invalid play-mode array into live drum settings

Location: `src/utils/presetImport.ts:55`; actual consumption at `src/components/drum/DrumPresetSettings.tsx:98-108`.

Trigger: import `{"type":"drum","engine":{"playmode":["mono"]}}`. `String(engine.playmode)` equals `mono`, so validation succeeds. The untouched array is returned by `extractDrumSettings` and dispatched as `SET_DRUM_PRESET_PLAYMODE` instead of being rejected without mutation.

Evidence: actual-module probe returned `success: true` and extracted `playmode: ["mono"]`. Actual `exportProjectArchive` with the resulting setting then rejected `Invalid drum settings.presetSettings.playmode`. Require a string scalar before enum membership and validate actual known enums with their supported domains. Preserve the optional-engine minimal-preset contract and exact safe unknown values. Test through both actual settings callers, including no state/history change on malformed known values.

### R5 — P1: Accepted preset JSON can make portable backup fail or become unreadable

Location: `src/utils/presetImport.ts:46-51,132-135`; downstream contracts at `src/utils/projectArchive.ts:60,279-292`.

Trigger A: import a valid drum object with two safe string values of 1,048,500 characters each. Its JSON is 2,097,029 bytes and passes both the per-string and incoming-plus-retained checks. Only 123 bytes remain below 2 MiB, but the full manifest also includes project settings, references, and manifest structure. Actual export produced a 2,098,311-byte ZIP; reopening that exact returned ZIP failed `Project manifest is missing or too large`.

Trigger B: import a safe unknown property with a 1,025-character key. Preset validation accepts it, but actual archive export fails `Invalid project manifest.project.importedDrumPreset key` because archive JSON permits keys only through 1,024 characters. Preset-relative nesting limits likewise need to account for wrapping inside the manifest, rather than assuming identical root-relative budgets.

Evidence: both triggers ran against actual preset and archive modules, with real File input and actual ZIP creation. These are admission/portability failures, not merely theoretical size estimates. Validate the resulting complete project manifest's metadata bounds at import admission, including current retained state, while keeping safe unknown fields and raw numeric precision. Share the serializer/admission rules rather than requiring audio encoding merely to import settings. The archive export path should also refuse any manifest its own importer cannot reopen. Add an accepted-near-limit round trip and rejected-over-limit/key/depth boundary cases.

### R6 — P1: Delayed patch-settings reads can overwrite a replacement project or bypass the current combined bound

Location: `src/components/drum/DrumPresetSettings.tsx:94-108`; `src/components/multisample/MultisamplePresetSettings.tsx:194-200`; `src/utils/presetImport.ts:133-135`.

Trigger: begin a patch settings import, replace/reset/open the project while `file.text()` is pending, then let the read finish. Both actual callers dispatch successful results unconditionally, using the old render's state; neither owns an operation generation nor checks current `projectGeneration`. An older import finishing after a newer one can similarly replace its settings. In addition, two mode imports begun with no retained opposite preset each validate against that stale empty value and can later retain a combined payload exceeding the accepted bound.

Evidence: direct actual-caller source trace across the asynchronous file-read boundary. The new audio provider's generation/cancel protection does not encompass either settings caller; the reducer actions used here contain no expected generation or current-manifest admission. This is an explicitly required Task 7 canceled-read/current-state preservation boundary, although the older callers were already unguarded. Recheck operation ownership, project generation, and the complete candidate manifest against live state at the synchronous commit boundary. Add delayed-read replacement, superseding-read, and simultaneous cross-mode admission regressions through the callers/reducer. No browser race was executed by this reviewer.

### R7 — P1: Known AIFF dimensions can request gigabytes before the import budget is checked

Location: `src/utils/audioImport.ts:24-26`; `src/utils/audioFormats.ts:200-209,277-288`.

Trigger: an AIFF with a valid FORM/COMM structure advertises one billion mono frames, but has only an empty SSND body. Shared intake accepts the 54-byte File. When browser decoding rejects it, the manual fallback trusts COMM and calls `createBuffer(1, 1000000000, 48000)` before validating source containment or decoded capacity. The shared preparation budget runs only after the decoder returns.

Evidence: an actual-reader probe constructed this 54-byte header from the original AIFF fixture. A refusal-only allocator recorded a **4,000,000,000-byte PCM request**. The probe allocated no large buffer. This is a known, inspectable header/allocation boundary; the documented limitation for unknowable compressed decoder allocation does not cover it. Validate PCM container extents, channels/rate/frame arithmetic, and the applicable decoded budget before browser/manual allocation. Preserve the working AIFF fallback. The accepted Task 5 `inspectSliceSourceHeader` already demonstrates bounded container inspection, but its slicing-specific ceiling must not be copied accidentally as the import contract. Include a regression proving no decoder/allocator invocation for impossible declared dimensions and retain real valid AIFF tests.

### R8 — P2: Explicit drop destinations and filename suggestions can reserve the same pad

Location: `src/components/common/AudioImportProvider.tsx:29-32`; `src/utils/audioImport.ts:40-43,58-60`.

Trigger: drop `[texture.wav, kick.wav]` onto empty pad 0 through a single drum key. Filename planning independently proposes `[unassigned, pad 0]`; the subsequent explicit-target override changes the first row to pad 0 without updating reservations for later suggestions. Review therefore presents two included rows targeting the same initially empty pad. Apply places the first in its local trial state and rejects the second as occupied, rejecting the entire batch despite the untouched project and untouched review choices.

Evidence: deterministic source trace of the actual `drumPads: [0]` intent, proposal reservation, override, and finalizer occupancy check. The same issue can occur when explicit physical-row targets and overflow suggestions overlap. Resolve explicit destination intent and filename proposals within one reservation plan, preserving unknown/unassigned policy and user control. Add a real multi-file key-drop or provider regression that verifies collision-free initial proposals and a successful single Apply.

## Prior controller findings: disposition

| Earlier finding | Independent disposition |
| --- | --- |
| Failed nested child loses valid siblings | Fixed for individual legacy/modern child failures by per-child catches and regression fixtures. R3 identifies the remaining enumeration-failure variant. |
| Modern global encountered-entry limit | Counter/check now exists in both walkers and has a modern directory limit regression. |
| FileList fallback and interleaved string ordinals | Captured FileList is retained; file-item ordinals exclude strings; focused regressions cover both specified cases. No name/size/time identity dedup was introduced. |
| Staged decoded capacity | Sequential preparation charges existing assets and each retained logical header/buffer; later files stop decoding after exhaustion. R7 remains for known preallocation dimensions. |
| Partial receipt loop and repeated Apply ID | Receipt is gated by `pendingCommit`, consumed once, and each Apply gets a serial suffix. Actual provider test frees capacity and applies the retained row on a second receipt. |
| Replacement consent identity | Drum and multisample selectors capture File/AudioBuffer identity when Replace is selected; finalizer compares that identity to live occupancy. Regression tests cover target replacement after consent. |
| Project replacement and unmount cancellation | Audio provider owns project generation from resolution through review, aborts/cancels on replacement, and invalidates/aborts on unmount. R6 covers the distinct unguarded patch-settings callers. |
| Conflicting open/closed hats | Both tokens produce multiple categories and remain unassigned; regression present. R8 covers reservation interaction with explicit intent. |
| 44.1 kHz source versus 48 kHz decoded fields | Dedicated readers provide separate source rate/channels; imports persist those fields, while compressed source fields remain unknown. Real fixture browser assertions exercise the rate distinction. |
| Imported crossfade bypass, loop defaults and zero crossing | Finalizer preserves the 20/80 defaults, embedded loop choice, current zero-crossing setting, and calls accepted imported-crossfade association. Focused test checks note label/default-loop/crossfade association. |

## Remaining acceptance evidence and limits

The two new browser scenarios prove real codec chooser review/Apply/Undo and synthetic nested-drop partial failure/Cancel across configured profiles. Existing export workflows now pass through shared review and download real WAV-based ZIPs. They do **not** establish the complete new codec-source persistence story: the codec scenario does not download/reopen a portable backup, compare original compressed bytes, or verify unknown metadata after session/library restoration. The new invalid-preset shape/prototype tests also exercise the helper rather than both actual settings chooser routes. These are bounded Task 7 acceptance gaps to close with the fix round; they are not asserted runtime defects beyond R1–R8.

Source inspection and unit archive tests support original File retention, lossless decoded storage, optional source metadata, 256-reference/project-byte admission, legacy v1 compatibility, current multisample 24-zone admission with larger legacy collections retained, and one history action per successful guarded Apply. The optional-engine adjustment correctly retains the established minimal valid preset. Existing OP-1 entry and its project-generation guard remain present. Upstream eimerreis/PR #113 attribution is retained. No Task 8 workspace/dark-mode or Task 9 global-lint/offline expansion was required for this review.

Bundled Chromium's M4A rejection is an observed decoder capability; AIFF manual fallback and differing lossy frame counts remain explicitly documented. Finder/Splice desktop integration, microphone input, hardware compatibility, and affiliation were not verified or claimed. Final cross-feature acceptance remains Task 10. Re-review the bounded fixes and new evidence before marking Task 7 accepted.

## Late pre-fix identity addendum

This is a bounded addition to the original review, not another review round. The controller identified the candidate while preparing the first fix round; the reviewer independently checked the actual identity consumers and a narrow fresh-module probe. No additional runtime/test/browser work was performed.

### R9 — P2: A page-local intake counter is persisted as a reusable source-family identity

Location: `src/utils/audioImport.ts:26`; origin at `src/utils/externalFileIntake.ts:13,39,50`; consumers at `src/utils/audioSlicing.ts:366-368,389-402` and `src/utils/projectSerialization.ts:41,47,92,97`.

Trigger: import a source as the first intake, save/restore that project after a page reload, then import unrelated bytes as the fresh page's first intake. `operationSerial` restarts at zero, so each file receives intake ID `intake-1-file-1`; preparation persists `source:intake-1-file-1` as both samples' `sourceIdentity`. Project serialization/restoration preserves the old value and does not advance the new page's counter.

Evidence: two separately initialized instances of the actual intake/preparation modules, each receiving a real File with different contents, both returned `source:intake-1-file-1`. The probe confirmed distinct File objects and distinct original bytes. Source tracing shows that slicing an existing sample reuses its `sourceIdentity` and copies it into each derived sample and `sliceProvenance`, so later slices of those unrelated originals falsely share one persistent source family. This violates the stable original-source provenance contract; it is not a requirement for every individual slice to have a different family identity.

Impact qualification: no current audio deduplication, byte loss, or replacement-consent bypass was established. Slice finalization additionally checks File/AudioBuffer reference identity, and portable assets use separate sample IDs. The demonstrated defect is collision of persisted source provenance and its propagation to derived slices. Crossfade provenance has a separate filename-based identity contract and is not asserted affected.

Give each newly imported source a collision-resistant persistent identity, independent of operation/receipt IDs, while preserving existing legacy source IDs and intentional original-plus-derived family sharing. Add a save/restore-or-fresh-module regression with two different sources that previously reused the same intake ID, then verify their derived slices retain the correct distinct families. Do not reject legitimate shared identities within one source's slice family.
