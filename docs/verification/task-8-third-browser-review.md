# Task 8 initial browser gate and third visual review

Astra controller, 2026-09-05. Runtime/tests/config frozen throughout. Fresh production build passed (`/tmp/opstudio-task8-frozen-build.log`). Production preview5188 served isolated CLI Chromium152.0.7977.76 session opstudio8c and a separate three-engine demo harness. Full E2E used its own configured devserver5187 and isolated contexts. All browsers/servers finished or closed before implementation release.

## Visual corrections verified

Desktop1440×1000 now has a full-width instrument above a full-width selected editor. Outer content934px / inner870px; Focus836px with waveform369px and controls451px. No earlier keyboard/control clipping; retained controls fit. At960×800, pagewidth960 and Focus796px split351/429px. Detailed Forward and Play(P) are enabled and now rgb(243,243,235) on rgb(44,48,42), replacing the unreadable pale pairs. At320×740, pagewidth320 in light/dark and all12 displayed pad targets84.9375×66.5px. These measurements cover viewport resizing, not all touch/browser/assistive-technology combinations.

Screenshots: images/task8-third-desktop-dark.png, task8-third-intermediate-dark.png, task8-third-phone-dark.png, task8-third-phone-light.png. Desktop captured after scrolling to top; earlier full-page screenshots taken at another scroll position could show the sticky toolbar at that position.

## Confirmed functional and theme findings

- **Exact export-frame regression:** new StudioSeed workflow fails all5profiles at Seed Shaker slot7:6175frames instead of6174. Root production WAV/backup harness independently reproduces6175vs6174. Source PCM recipe is correct; same-rate precision conversion reaches `ceil(duration*rate)` with floating-roundup. Keep exact test/recipe; fix source-length computation. `/tmp/opstudio-task8-studio-browser.log`, `/tmp/opstudio-task8-demo-proof.log`.
- **Invalid root note breaks portable backup:** actual multisample chooser imported original-44100.wav with explicit Use empty root note/Include consent. Focus Root note128→blur remains128; Project→Download project returns exact alert `Could not download project: Invalid root note`. Restoring60 repairs state. This confirms independent reviewR2.
- **Unreadable dark toast:** actual StudioSeed Replace triggers title rgb(243,243,235), body rgb(184,192,177), surface rgb(248,249,250). Screenshot and computed styles corroborate reviewR7. This is not a transient theme color or disabled-state exception.

## Full browser matrix result and diagnosis

`npx playwright test --workers=4`: **78passed,45failed,2explicitdesktop-onlymobile skips,3.1minutes** (125configured). Log `/tmp/opstudio-task8-initial-full-browser.log`; failed snapshots preserved under `/tmp/opstudio-task8-before-round1/browser-failures` before the next run can overwrite them. This is a failed gate, not a pass with retries.

Five failures are the actual demo frame bug. The remaining observed failure points are incomplete locator adaptations, which block those tests before their later behavioral assertions:

- Codec import, portable backup, keyboard Undo, malformed backup and recording still expect old exact `1 sample loaded`/`8 samples loaded` text, despite the new instrument region count.
- Desktop row chooser case does not enter Table before finding its row input.
- Cancelled multisample import calls the drum loaded-count helper while still on multisample.
- Drum loop upload expects a standalone filename element while the new Focus heading combines pad and filename; mobile multisample helper still expects old `no samples loaded` copy.

Complete intentional locators and preserve all actual archive, PCM, state, Undo and cancellation assertions. Do not force-click, add arbitrary waits/retries, change product behavior merely to restore old selectors, or declare later behaviors verified because the first locator error looks superficial. Rerun after fixes to expose any later issues.

## Demo proof harness and limits

Prepared `/tmp/opstudio-task8-demo-proof.mjs` for two fresh UI generations per Chromium/Firefox/WebKit, real portable reopen/rebackup, cross-engineFloat32 tolerance1e-6 and every16-bit PCM sample against writer quantization. Initial harness mistakes (display-name versus source-filename lookup, signed-zero strict comparison) were corrected; neither was reported as a product defect. The corrected harness stops on the real6175frame regression in Chromium, so no full three-engine/audio acceptance is claimed. Partial WAV artifacts are not a completed listening kit. Finish/reissue artifacts only after all proof gates pass.

Independent `task-8-review.md` requires R1–R7 corrections. Task8 remains pending; root performed no subjective audition, screen-reader or physical device test. Sol receives a consolidated correction pass plus E2E adaptation, with baseline `/tmp/opstudio-task8-before-round1`.
