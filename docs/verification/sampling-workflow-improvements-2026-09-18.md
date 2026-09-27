# Sampling workflow improvements — September 18, 2026

Status: implemented in the authorized worktree and checked in an assembled local validation snapshot. The local preview on port 5188 serves the resulting build. Full current-checkout verification remains limited by unavailable iCloud files; hardware listening/import remains pending.

## Change contract

1. Guided setup: choose the NINA/Digitakt, Ableton or custom route, read source-specific steps, deliberately request audio/MIDI permission, and run a return-signal check. Show absent/quiet/clipped signal clearly; do not infer that a cable name proves correct routing. Stop, close, hidden-page and disconnect behavior must release owned resources. A sound check must not accidentally add a sample or occupy a root.
2. Audio refinement: suggest silence bounds conservatively across all channels with attack/release padding. Offer an optional sustain-loop candidate only when a bounded search supports it. Preview before accepting, keep original audio, and provide a reversible path. Reject silence, very short signals, invalid input and weak candidates; never label a suggestion perfect or guaranteed click-free.
3. Transfer: show current instrument readiness and honest estimated audio size, retain existing export validation, and provide concrete download/unzip/MTP/copy/listen steps. A local download must not be described as a completed hardware transfer.

In scope: the existing browser app and tests in the authorized improvement worktree. Existing projects, device export format and manual editing remain compatible. No native companion, plug-in hosting, purchases, account changes, hardware access, commit, push or remote deployment.

## Direct USB investigation

Teenage Engineering documents USB connection followed by COM → M4 for MTP mode and use of field-kit on macOS. The connected device exposes presets, projects and samples folders. This provides a supported guided-transfer path: [official OP-XY guide](https://teenage.engineering/guides/op-xy/how-to).

Chrome documents WebUSB as permission-based access to device interfaces and endpoint transfers. Opening USB alone does not implement MTP or validate OP-XY import. We have no physical interface descriptors or tested MTP transport for this app. Direct browser upload is therefore unverified; the current deliverable is guided file transfer. A future proof of concept needs explicit hardware selection, descriptor inspection, platform-specific interface-claim testing, a small new test folder, transfer integrity/read-back checks, cancellation and reconnect recovery. Source: [Chrome WebUSB documentation](https://developer.chrome.com/docs/capabilities/usb).

Context7 was queried twice via the find-docs workflow and returned unrelated WebUSB application libraries, not usable API documentation. The official Chrome source is the disclosed fallback; no library-specific implementation is based on those unrelated matches.

## Audio design evidence and limits

The Max/MSP reference query was attempted before DSP design. Its answer was withheld because its validator treated “Patch-level” as an unconfirmed object, so it supplies no usable algorithm evidence. A second prose-only query returned an explicit coverage gap for seam matching and conservative stereo trimming; no algorithm claims are attributed to that library.

Audacity documents that stereo zero crossings may occur at different positions, and cutting both channels at one crossing can still click. Suggestions must compare channels together and preserve their alignment; user audition remains necessary. Source: [Audacity zero-crossing documentation](https://manual.audacityteam.org/man/select_menu_at_zero_crossings.html).

Apple’s Auto Sampler provides loop-search start/end controls separately from note sustain/release durations. This supports constraining loop search to a suitable sustain region rather than assuming the entire recording is stationary. Source: [Apple Auto Sampler controls](https://support.apple.com/en-ie/guide/logicpro/lgced6eded3c/10.7/mac/11.0).

## Verification results

- Fresh combined `npm run check`: **exit 0**, TypeScript and lint passed; **80 files / 799 tests passed**; production build and PWA verification passed (32 unique precache entries, 10 revisioned stable assets).
- Production Chromium synthetic-device suite: **2/2 passed**, including a temporary extension that sends one note, confirms a passing peak-level sound check and exactly matched MIDI on/off, and confirms **zero retained takes**. The existing exact-range capture, export and cache-ready offline capture checks also passed. No real microphone or MIDI input/output was used.
- Independent browser interaction: preview did not change project markers; Apply trim narrowed 0–2 seconds to approximately 0.180–1.820 while retaining the existing interior loop. Apply loop changed 0.4–1.6 seconds to approximately 0.681–1.322 without changing trim. Each operation was reversed through project Undo to the exact original markers.
- At 390 × 844, the document width was 390 pixels; setup and export dialogs had no horizontal overflow. All new action buttons and transfer instructions were reachable; screenshots were visually reviewed.
- Final helper benchmark: a 20-second stereo 96 kHz periodic fixture analyzed in approximately **33 ms** on this machine. PCM hashes were identical before/after. This is one fixture observation, not a guarantee for every device or sound.
- The first combined run caught a TypeScript control-flow error in the helper; it was corrected before the final passing run. The failed and passing logs are retained.

Evidence is in [sampling-workflow-20260918-evidence](sampling-workflow-20260918-evidence/). The synthetic harness extension is preserved as a text artifact because its original test file was cloud-only and was not overwritten.

| Outcome | Implementation | Verification status |
|---|---|---|
| Guided routing and noncommitting sound check | AutoSamplingPanel | Confirmed in component tests and synthetic production browser capture; real NINA/Ableton pending |
| Separate trim/loop suggestions, preview and Undo | sampleSuggestions and MultisampleFocusWorkspace | Confirmed with deterministic audio tests and actual browser Undo; subjective sound quality pending |
| Readiness checklist, estimated size and transfer guide | ExportPreflight | Confirmed in component tests, browser download and narrow-screen review; physical transfer pending |
| Direct browser USB upload | Feasibility investigation only | Not implemented or hardware-verified |

## Local source availability

On September 18, an independent hash check found 136 readable `src/` and `public/` files identical to the final September 5 safety copy, while 86 were cloud-only and could not be read. Bounded read/download attempts did not restore all required files. Cloud-only source is not overwritten. Validation uses a local workspace with all currently readable files overlaid on the saved baseline; The final [VALIDATION-PROVENANCE.json](sampling-workflow-20260918-evidence/VALIDATION-PROVENANCE.json) identifies 174 byte-verified current files and 101 saved-baseline fallback files (including tests/configuration, not just application source). This is evidence for that assembled snapshot, not a fresh full-checkout verification of inaccessible source.

## Hands-on acceptance after software checks

- Choose the NINA/Digitakt profile and deliberately enable MIDI. Run Check sound; verify the intended NINA patch returns through the selected input, then lower/raise the interface level to check quiet/clipping feedback. A meter cannot identify which instrument produced a signal.
- Change the input or MIDI route and confirm its previous check no longer establishes readiness. Stop midway and verify no held note remains.
- Capture a sound with silence around it. In the focused multisample editor, analyze it, preview the proposed trim and loop, and compare the attack/release and stereo image. Discard unwanted suggestions; after applying, use Undo to restore the old markers.
- Export, extract the `.preset` folder with its contents together, transfer it to OP-XY, then listen to mapped notes, release tails and loop seams on the hardware.

## How to find the additions

1. **Multisample → Record takes:** choose a routing profile; open **Set up and check this route**; use **Check sound on one note**. **Test one note** still records a take. NINA and Ableton profiles require a successful sound check before full-range capture.
2. **Multisample → Focus:** select a loaded zone and choose **Analyze sound**. Preview/apply trim and loop independently. Suggestions alter markers only, not the source recording; the existing global Undo restores applied changes. Enable loop playback in instrument settings when using loop markers.
3. **Export OP-XY:** review the optional listening/storage checklist, download, then follow the shown extraction and transfer steps. The checklist is a user acknowledgment, not automatic device detection.

## Preserved work and safety copy

No commits or remote changes were made. Existing offloaded source remains untouched. Modified source/tests plus this report and evidence have a hashed local safety copy at `/Users/stevencommander/Library/Application Support/OPPatchStudio/Backups/20260918-sampling-improvements`; this is an incremental copy, not a complete Git repository. Existing hashed preview assets were retained while the new generated build was copied to the local preview to avoid breaking already-open pages.
