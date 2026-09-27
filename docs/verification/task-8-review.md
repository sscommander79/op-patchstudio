# Task 8 independent review

Reviewer: Astra, 2026-09-05. Scope: the frozen Task 8 package in `task-8-review-package.txt`, compared with the accepted Task 7 source/test snapshot at `/tmp/opstudio-before-task8`. This review changes this document only. No reviewer browser/server, full test run, runtime edit, commit, or integration occurred.

**Spec compliance: CHANGES REQUIRED.**

**Source correctness: CHANGES REQUIRED.**

The focused workspace and most shared integration contracts are implemented, but the new tray replacement path bypasses accepted import protections, several multisample Focus interactions are incomplete, and actual demo export fails its exact frame contract. The controller also observed a remaining dark notification contrast defect. Passing unit/build gates do not override these findings.

## Findings

### R1 — P1 — Route unassigned-sound replacement through guarded import admission

**Confirmed source bug and retained-contract regression.** `src/components/drum/DrumTool.tsx:136–144`, especially the direct decode at line 139 and dispatch at line 144.

Select a loaded unassigned sound in Focus and use Replace. Indices below 24 use the shared intake path, but this new branch calls `readAudioMetadata` directly and subsequently updates the captured numeric index. While decoding, opening/replacing the project, Undo, deleting/reordering that tray, or another import can change the destination and current capacity. The late completion has no project-generation or expected-asset check; its capacity calculation uses the state captured before the await. It can consequently apply old work to a different live project/asset and evade the current-state admission contract.

The replacement also spreads the previous sample at line 140, carrying its `sourceIdentity` and any `sliceProvenance` onto unrelated new audio. An overflow slice replaced by a shorter file therefore retains the old source/frame provenance, rather than becoming a truthful new original; this branch performs no complete archive metadata validation. These problems are introduced by the Task 8 tray route, not an accepted Task 7 limitation.

Use the shared prepared-intake/guarded-commit mechanism with an explicit unassigned replacement destination and expected individual asset, fresh source identity, appropriate provenance reset, and complete live candidate validation. Regress deferred decode followed by project replacement/Undo and tray movement; also replace an overflow slice and verify fresh provenance plus successful lossless backup/reopen. One successful replacement must remain one Undo.

### R2 — P2 — Validate multisample Focus numeric edits before committing

**Controller-confirmed production browser bug with source confirmation.** `src/components/multisample/MultisampleFocusWorkspace.tsx:31`.

Typing a root note of 128, a fractional root, or a negative/out-of-buffer sample or loop marker and blurring dispatches that value directly. Native `min`, `max`, and `step` attributes do not validate this custom blur handler. `UPDATE_MULTISAMPLE_FILE` merges the updates without normalization (`AppContext.tsx:1349–1361`); portable validation requires an integer root in 0–127 and markers within the audio bounds (`projectArchive.ts:202`, `:365`). A normal Focus edit can thus make a previously valid project fail backup. The retained Table root editor instead parses and rejects invalid notes at `MultisampleSampleTable.tsx:271–297`.

The controller reproduced the root case in the production UI after importing a real 44.1 kHz WAV through the shared review flow: Root note → 128 → blur → Project → Download project leaves the field at 128 and displays `Could not download project: Invalid root note`. Fractional/marker variants above are source-traced, not additional browser claims.

Validate finite integer note bounds and normalize/validate the complete sample/loop range with the shared frame contract before dispatch. Keep invalid text local with a visible explanation or restore the previous value; never add an invalid musical history entry. Test invalid roots, both ends of marker bounds, one-frame audio, and an actual backup after accepted/rejected edits.

### R3 — P2 — Preserve configured multisample playback in Focus

**Confirmed source bug and capability regression.** `src/components/multisample/MultisampleFocusWorkspace.tsx:36`.

Enable looping or change the amplitude envelope, then use Play selected in Focus. This calls ordinary `useAudioPlayer.play`, which does not implement loop options or ADSR and starts a bounded one-shot (`useAudioPlayer.ts:967–1054`). Passing `loopEnabled`, `loopStart`, and `loopEnd` here has no effect. The retained Table uses `playWithADSR` with envelope, play mode, loop/release settings, and trim (`MultisampleSampleTable.tsx:345–375`). Consequently the primary editor cannot audition the settings it invites the user to adjust. There is also no explicit Stop/release action in Focus.

Reuse the retained calibrated preview path and its stop/release lifecycle. Verify a non-default envelope and an enabled nontrivial loop through actual source-node behavior, plus Stop and cleanup on selection/view changes. This does not reopen earlier hardware-calibration limitations: the defect is disagreement between two application routes.

### R4 — P2 — Initialize and reconcile the automatically selected multisample identity

**Confirmed source bug.** `src/components/multisample/MultisampleTool.tsx:31–32`, `:49–50`.

Open an empty multisample workspace, import two sounds, and edit the automatically displayed highest root below the other sound's root without first changing the Zone selector. The selection ref was initialized when the list was empty and remains undefined; its reconciliation effect returns immediately. The reducer sorts after the root change, so Focus stays at array index 0 and switches to the other asset. Subsequent edits affect that other sound. Explicitly selecting a Zone first hides this case because only `selectZone` initializes the ref.

Establish the individual asset identity when initial/fallback/import selection resolves, and reconcile it after root sorting, replacement, deletion, and Undo. Test the automatic first selection rather than only a prior explicit dropdown selection; follow the same asset without adding musical history for selection.

### R5 — P2 — Add the specified silent arrow selection for drum pads

**Source-confirmed specification gap.** `src/components/drum/DrumKeyboard.tsx:516–532`, `:702–710`.

The approved workspace design explicitly requires arrow navigation to change selection without starting sound. Desktop pads handle only Enter/Space; the new mobile bank buttons only select on activation. Arrow keys therefore do not select the neighboring pad, and activating a loaded pad always auditions it. Keyboard users lack the specified silent pad-selection route.

Implement predictable arrow movement through physical targets, including bank boundaries, keeping focus and selected editor aligned without audio or history changes. Retain Enter/Space audition and MIDI's independent editing target. Verify both layouts and actual zero source starts during arrow navigation.

### R6 — P2 — Preserve exact demo frames during same-rate precision conversion

**Controller-confirmed browser bug.** Task 8 trigger: fresh Studio Seed's honest Float32 originals and explicit 44.1 kHz/16-bit output in `src/utils/studioDemo.ts:160–161`. Root cause: `src/utils/audio.ts:410` (an inherited helper newly exercised by the required demo route).

Fresh Studio Seed → Export OP-XY → Download creates Seed Shaker with 6,175 frames instead of the specified 6,174. The controller reports the failure in all five configured Studio Seed browser profiles (`/tmp/opstudio-task8-studio-browser.log`) and independently in its production downloaded-WAV proof. Actual play/edit/Undo reached export; this is not a locator failure.

The converter allocates `ceil(duration * rate)`: independently evaluated arithmetic gives `(6174 / 44100) * 44100 = 6174.000000000001`, then 6,175. Precision-only conversion still enters this path because source depth 32 differs from target 16 (`patchGeneration.ts:235–242`). Calculate output frames from integer source dimensions and preserve exact length at unchanged rate; reconcile estimation where applicable. Keep the exact 6,174-frame recipe/browser assertion, and test real WAV bytes plus patch region framecount. Do not relabel the source precision or relax the recipe to make the gate pass.

### R7 — P2 — Supply dark notification surface tokens

**Controller-observed rendered bug with source confirmation.** `src/styles/studio.css:58–65`, with the retained consumer at `src/components/common/NotificationSystem.tsx:67–72`.

In dark mode, loading Studio Seed produces a nearly white notification with nearly white text; the controller captured `images/task8-third-desktop-dark.png`. Studio overrides notification text through the shared text variables but leaves `--color-bg-notification` at the light value supplied by `device-themes.scss:173`. Notification titles, messages, and dismiss affordances therefore lose readability in a workflow explicitly covered by theme acceptance.

The controller's production computed-style probe measured title `rgb(243, 243, 235)` and message `rgb(184, 192, 177)` against notification background `rgb(248, 249, 250)`. These are observed resolved colors, not an inference from proposed tokens.

Map notification background/border/foreground to the resolved semantic palette and verify actual computed contrast for success and failure messages in both themes. Do not infer closure from the stylesheet alone.

### R8 — P2 — Derive preflight format and size from the actual conversion plan

**Confirmed source bug; bounded addendum during round 1.** Verified against `/tmp/opstudio-task8-before-round1/src` and the unchanged relevant live helpers. `src/utils/deviceExportPreflight.ts:9`, `:39–49` disagree with `src/utils/patchGeneration.ts:234–243` and `:274–290`.

With output sample rate set to 0, preflight promises `decoded rate per sample` and estimates the decoded frame count. Export instead uses the known original source rate whenever another setting requires conversion; only the no-conversion branch keeps the decoded buffer. Mono downmix, depth conversion, normalization, and multisample cut-at-loop-end can therefore change the actual rate while the new preflight says it will remain the decoded rate.

Minimal deterministic example: one mapped stereo sample with 48,000 decoded frames at 48 kHz, known original rate 44.1 kHz and original depth 16, output rate 0, output mono, WAV/16-bit. Preflight reports decoded rate and estimates 48,000 mono frames (96,044 bytes including its 44-byte header). Downmix makes `needsConversion` true; export chooses 44.1 kHz and produces a one-second 44,100-frame mono payload (88,244 bytes with the plain WAV header). This is a source-traced counterexample, not a newly executed browser/PCM test. The mismatch is independent of R6's floating-point extra frame.

The same divergence affects an accepted restored project with `settings.channels = 2`: preflight labels it `stereo` and counts two channels (`deviceExportPreflight.ts:10`, `:47`), while both hook callers translate every value other than 1 to `keep` (`usePatchGeneration.ts:24`, `:72`). The writer therefore retains a mono source as mono, including when another conversion is required. `projectArchive.ts:97` accepts 2, so this is reachable through a valid backup even though the current channel picker only offers 0/original and 1/mono. Preserve the accepted writer semantics; this finding does not require adding upmix. Make the label and size describe effective per-source channels accurately.

Share the effective per-sample conversion/rate/frame/channel decision between preflight and export, retaining the accepted export semantics or explicitly reconciling any intended change. Test known source/decoded rate mismatch with automatic output rate both with and without conversion, for both instruments, then compare the preflight's stated rate/channels/estimated audio extent with actual WAV headers and patch frame counts. Include unknown-original-rate fallback, multisample cut-at-loop-end, and a mono source in a valid restored channels=2 project. Do not describe every automatic-rate export as either source-rate or decoded-rate without accounting for the actual branch.

## Contracts checked and retained evidence

- `AppContent` remains the single `useSessionManagement` owner. The toolbar consumes revision-aware save state and its retry callback; project backup and device export are distinct actions.
- Preflight calls both generation functions through explicit success/error results, keeps failures visible, defaults drum device export to mapped audio, and identifies retained unassigned assets. Low-level helper default behavior remains compatible.
- Studio Seed source formulas, sparse slots, frame dimensions, peak/window/seed definitions, honest Float32 metadata, and original provenance agree with the design. The complete guarded candidate receives shared capacity and archive validation; replacement also checks retention of the immediately previous musical state. The actual device length defect is R6.
- Focus assignment now relocates an unassigned asset to a physical pad and retains the displaced asset in the tray. Drum selection compares individual File/AudioBuffer identity rather than shared source-family identity.
- Theme preference and guide dismissal are presentation state. The new ownership hook provides topmost Escape and focus restoration; recovery does not treat Escape as discard. Controller's earlier real nested detailed/waveform focus result remains evidence for that exercised flow, not all assistive technology.
- The controller's third visual report confirms full-width desktop/intermediate composition and readable Detailed Forward/Play controls after the earlier two passes. This review does not infer a broader rendered pass from CSS; R7 remains open.
- `LICENSE` is unchanged and retains the MIT grant plus Joseph Holland and Brandon Withrow copyright notices. Footer keeps Joseph Holland and Zeitgeese acknowledgements, links the user fork, and retains explicit unofficial/non-endorsement language. Donation navigation remains present.
- Reported worker gates: 762 unit tests and scoped lint passed; controller's fresh production build passed. These were not rerun by this reviewer. Controller owns the remaining full browser matrix and production demo/artifact checks.

## Required disposition and limits

Address R1–R8 in a bounded implementation pass, retain meaningful regression checks, then freeze for focused independent rereview and fresh affected browser/artifact gates. The source-correctness verdict already requires changes independently of remaining matrix results. The acceptance matrix should continue to show Task 8 pending.

No subjective human audition, assistive-technology conformance, or physical OP-XY transfer/import/playback is established here. Task 9's broad lint/dependencies/bundle/offline/CI work and previously recorded remote Patreon HTML issue are not Task 8 findings. Earlier accepted DSP/archive limitations are not reopened.
