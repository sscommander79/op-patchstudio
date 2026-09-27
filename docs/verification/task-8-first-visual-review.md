# Task 8 first frozen visual review

Astra controller, 2026-09-05. This is an intermediate visual assessment, not Task8 acceptance or the final independent source review. Sol explicitly froze source/tests/E2E/config. Production preview ran at127.0.0.1:5188; isolated playwright-cli session opstudio8 used Chromium152.0.7977.76. Viewports:1440×1000,320×740,844×390. This was viewport resizing in a desktop Chromium context, not a touch-device/browser-matrix certification. Browser and preview were closed before release. No runtime files changed.

## Observed progress

- Empty workspace offered Studio Seed after recovery readiness. Loading populated ten sounds, selected Seed Kick, set the name and displayed the guide.
- Focus exposes mode/direction/numeric trim/transpose/gain/pan and retained detailed/slice/replace/clear/assignment actions. The waveform rendered in both themes.
- Mobile Lower/Upper controls and twelve ordered pad targets fit inside the instrument at320px. Measured pad boxes were about84.94×66.5px, with separate gaps; bank controls129×57.31px. This solves the earlier overlapping-key target geometry.
- New export preflight was readable at320px and scrollable. Sixteen successive Tab presses in the empty multisample preflight stayed inside its dialog. Escape closed it and restored focus to Export OP-XY. This result does not generalize to older dialogs.
- No forced rotation overlay appeared. Full E2E adaptation/execution, subjective audition, physical hardware and assistive technology remain unperformed.

## Required corrections before the next visual pass

1. **Dark theme inheritance is incomplete.** The main content surround remains light gray while the header becomes near-white. Dark toolbar backup explanation, Studio Seed bold name, guide heading/steps and other inherited text resolve to rgb(26,26,26) against dark panels. `load and play samples` and `preset settings` resolve to rgb(34,34,34). Carbon dropdown text, tick labels and several legacy actions are similarly difficult to read. Fix actual component/token inheritance and explicit old colors across retained surfaces; do not solve this with a page-wide inversion or blanket important override. Verify actual computed text/background pairs, including the MainTabs/content surround, headings and form controls.
2. **Accent action text is unreadable.** Record takes and neighboring inherited primary actions remain white; in dark mode Record takes is rgb(255,255,255) on rgb(208,239,98). The same light-mode buttons are white on the darker lime. New toolbar/demo buttons correctly use dark text, so the mix is visibly inconsistent. Apply the readable semantic accent-text color to the actual shared legacy button source; measure disabled states separately rather than treating opacity as accessible evidence.
3. **320px page overflow and header/view layout.** documentElement.scrollWidth=363 for320px viewport in both instruments. Theme picker right edge363.375 is a direct overflow source; the Focus/Table group extends to333.3125. Header title and theme selector collide. Stack/reflow these at narrow width; do not hide the problem with document overflow-x:hidden. Main navigation is an intentional local horizontal scroller (client288/scroll575 at320px), so offscreen tab coordinates alone are not page-overflow evidence; retain a usable discoverable navigation treatment.
4. **Focus composition remains too tall and the import/creative actions are too low.** Loaded desktop screenshot is3333px tall; at320px the pad bank begins around1134px, after the large toolbar, persistent full demo card and guide. Import/record/slice actions are below the entire selected editor. The full preset-settings and processing cards stay expanded, contrary to the planned compact disclosure composition. Make Add/Slice/Record available adjacent to the instrument; compact the loaded demo affordance and guide; place waveform/selected controls coherently side by side where width allows; use the specified labeled advanced disclosures with meaningful summaries. Preserve every capability and changed-setting visibility. This is completion of workspace-design.md, not an extra feature request.
5. **Short-landscape toolbar consumes the working area.** At844×390 the sticky toolbar covers approximately178px at the top, leaving only a small strip for the instrument/editor. The current small-width static rule does not address short wide screens. Use a compact/static short-height behavior or equivalent so focused content and dialog controls remain usable; verify actual scroll positions, not only CSS positioning.
6. **Detailed drum editor lacks modal ownership.** Clicking Detailed edit opens visible sample options, but document.querySelectorAll('[role=dialog]').length is0. Focus remains on the underlying Detailed edit button. Escape leaves sample options visible. Waiting for getByRole('dialog') timed out30seconds, then a direct DOM check confirmed the absence. Cancel closes it. Bring this retained modal into the shared semantic/topmost focus lifecycle, including nested waveform editor behavior and exact Cancel/Save/Undo preservation. Do not infer all-dialog coverage from the57 passing custom-dialog tests.
7. **Retained labels and attribution need reconciliation.** Keyboard help still says clicking empty keys immediately opens a chooser, contrary to the new Select→Add flow; several icon glyphs remain in accessible button names. Update relevant shortcut/help copy and hide decorative icons as the brief requires. Footer repository still points upstream: preserve author/license/donation acknowledgement while linking this fork appropriately. Task9 remains responsible for broader documentation and the separately recorded remote-HTML defect.

## Screenshots

All files are under docs/verification/images:
- task8-first-desktop-empty.png
- task8-first-desktop-demo.png
- task8-first-desktop-dark.png
- task8-first-phone-dark.png (full page)
- task8-first-phone-dark-viewport.png
- task8-first-phone-export-dark.png
- task8-first-phone-detail-dark.png
- task8-first-landscape-multi-dark.png
- task8-first-phone-multi-light.png

The first visual gate did not download device audio or test every tool. Existing root browser results for Tasks1–7 remain historical evidence; Task8's changed interaction routes still need adapted E2E definitions and a full gate. These seven visual/interaction corrections should be completed in the ongoing initial Task8 implementation, then frozen for a focused second visual pass before the full independent review.
