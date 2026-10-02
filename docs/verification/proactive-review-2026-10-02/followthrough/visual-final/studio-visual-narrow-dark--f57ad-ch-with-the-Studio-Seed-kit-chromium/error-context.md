# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-visual.spec.ts >> narrow dark >> drum workbench with the Studio Seed kit
- Location: tests/visual/studio-visual.spec.ts:39:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 3435px, received 390px by 3497px. 240524 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: drum-narrow-dark.png

Call log:
  - Expect "toHaveScreenshot(drum-narrow-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 3435px, received 390px by 3497px. 240524 pixels (ratio 0.18 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 3435px, received 390px by 3497px. 240524 pixels (ratio 0.18 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic "Studio navigation" [ref=e6]:
        - generic [ref=e7]:
          - strong [ref=e9]: OP–PatchStudio
          - navigation "Workspace" [ref=e10]:
            - button "Overview" [ref=e11] [cursor=pointer]
            - button "Library" [ref=e12] [cursor=pointer]
            - button "Transfer" [ref=e13] [cursor=pointer]
            - button "Devices" [ref=e14] [cursor=pointer]
          - generic [ref=e15]:
            - group "Appearance" [ref=e16]:
              - generic [ref=e18] [cursor=pointer]:
                - radio "OP-1 Field" [checked] [ref=e19]
                - generic [ref=e25]: OP-1 Field
              - generic [ref=e26] [cursor=pointer]:
                - radio "OP-XY" [ref=e27]
                - generic [ref=e31]: OP-XY
            - generic [ref=e32]:
              - generic [ref=e33]: Theme
              - combobox "Theme" [ref=e34]:
                - option "System" [selected]
                - option "Light"
                - option "Dark"
            - button "Help" [ref=e35] [cursor=pointer]
        - paragraph [ref=e36]:
          - generic [ref=e37]:
            - text: Studio /
            - strong [ref=e38]: Drum kit editor
      - main [ref=e40]:
        - heading "Drum kit editor" [level=1] [ref=e41]
        - region "Instrument project controls" [ref=e42]:
          - generic [ref=e43]:
            - generic [ref=e44]:
              - generic [ref=e45]: Instrument name
              - textbox "Instrument name" [ref=e46]: Studio Seed
            - status [ref=e47]: Saved locally
            - generic [ref=e48]:
              - button "Undo" [ref=e49] [cursor=pointer]
              - button "Redo" [disabled] [ref=e50]
              - group [ref=e51]:
                - generic "Project" [ref=e52] [cursor=pointer]
              - button "Export OP-XY" [ref=e53] [cursor=pointer]
        - region "drum tool content" [ref=e55]:
          - generic [ref=e56]:
            - generic [ref=e57]:
              - region "Studio Seed demo kit" [ref=e58]:
                - generic [ref=e59]:
                  - paragraph [ref=e60]: STARTER KIT
                  - strong [ref=e61]: Studio Seed
                - button "Add demo kit" [ref=e62] [cursor=pointer]
              - group "Kit setup guide" [ref=e63]:
                - generic "Kit setup guide Optional" [ref=e64] [cursor=pointer]:
                  - generic [ref=e65]: Kit setup guide
                  - generic [ref=e66]: Optional
              - group "First preset guide" [ref=e67]:
                - generic "Your first preset · 3-step guide 0/3 complete" [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: Your first preset · 3-step guide
                  - generic [ref=e70]: 0/3 complete
            - generic [ref=e71]:
              - generic [ref=e72]:
                - region "Drum pad instrument, 10 of 24 loaded" [ref=e74]:
                  - generic [ref=e75]:
                    - generic [ref=e76]:
                      - heading "PERFORMANCE / drum pads" [level=3] [ref=e77]
                      - generic [aria-hidden] [ref=e80]: 
                    - button "Pin keyboard to top" [ref=e82] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e83]: 
                  - text:  
                  - group "Drum keyboard" [ref=e84]:
                    - generic [ref=e85]:
                      - group "Drum pad bank" [ref=e86]:
                        - button "Lower pads 1–12" [pressed] [ref=e87]
                        - button "Upper pads 13–24" [ref=e88]
                      - group "Lower twelve drum pads" [ref=e89]:
                        - generic [ref=e90]:
                          - button "Pad 2, KD2, empty" [ref=e92] [cursor=pointer]:
                            - strong [ref=e93]: KD2
                            - generic [ref=e94]: EMPTY
                          - button "Pad 4, SD2, empty" [ref=e96] [cursor=pointer]:
                            - strong [ref=e97]: SD2
                            - generic [ref=e98]: EMPTY
                          - button "Pad 6, CLP, Seed Clap" [ref=e100] [cursor=pointer]:
                            - strong [ref=e101]: CLP
                            - generic [ref=e102]: LOADED
                          - button "Pad 9, CH, Seed Closed Hat" [ref=e104] [cursor=pointer]:
                            - strong [ref=e105]: CH
                            - generic [ref=e106]: LOADED
                          - button "Pad 11, OH, Seed Open Hat" [ref=e108] [cursor=pointer]:
                            - strong [ref=e109]: OH
                            - generic [ref=e110]: LOADED
                        - generic [ref=e111]:
                          - button "Pad 1, KD1, Seed Kick" [ref=e113] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e114]: A
                            - strong [ref=e115]: KD1
                            - generic [ref=e116]: LOADED
                          - button "Pad 3, SD1, Seed Snare" [ref=e118] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e119]: S
                            - strong [ref=e120]: SD1
                            - generic [ref=e121]: LOADED
                          - button "Pad 5, RIM, Seed Rim" [ref=e123] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e124]: D
                            - strong [ref=e125]: RIM
                            - generic [ref=e126]: LOADED
                          - button "Pad 7, TB, empty" [ref=e128] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e129]: F
                            - strong [ref=e130]: TB
                            - generic [ref=e131]: EMPTY
                          - button "Pad 8, SH, Seed Shaker" [ref=e133] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e134]: G
                            - strong [ref=e135]: SH
                            - generic [ref=e136]: LOADED
                          - button "Pad 10, CL, empty" [ref=e138] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e139]: H
                            - strong [ref=e140]: CL
                            - generic [ref=e141]: EMPTY
                          - button "Pad 12, CAB, empty" [ref=e143] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e144]: J
                            - strong [ref=e145]: CAB
                            - generic [ref=e146]: EMPTY
                - generic "Add and create sounds" [ref=e147]:
                  - button "Add sounds" [ref=e148] [cursor=pointer]
                  - button "Slice audio" [ref=e149] [cursor=pointer]
                  - button "Record takes" [ref=e150] [cursor=pointer]
              - generic [ref=e152]:
                - generic [ref=e153]:
                  - heading "EDIT / Sample management" [level=3] [ref=e155]
                  - generic "Sample workspace view" [ref=e156]:
                    - button "Focus" [pressed] [ref=e157]
                    - button "Table" [ref=e158]
                - generic [ref=e159]:
                  - region "Focused sample editor" [ref=e160]:
                    - generic [ref=e161]:
                      - generic [ref=e162]:
                        - paragraph [ref=e163]: SELECTED SOUND
                        - heading "Pad 1 · Seed Kick" [level=3] [ref=e164]
                      - generic [ref=e165]:
                        - button "Play selected" [ref=e166] [cursor=pointer]
                        - button "Previous pad" [disabled] [ref=e167]
                        - button "Next pad →" [ref=e168] [cursor=pointer]
                    - generic [ref=e169]:
                      - generic [ref=e170]:
                        - button "" [ref=e171] [cursor=pointer]
                        - generic [ref=e173] [cursor=pointer]
                      - generic [ref=e174]:
                        - generic [ref=e175]:
                          - text: Mode
                          - combobox "Mode" [ref=e176]:
                            - option "One shot" [selected]
                            - option "Mute group"
                            - option "Loop"
                            - option "Gate"
                        - button "Forward" [ref=e177] [cursor=pointer]
                        - generic [ref=e178]:
                          - text: In point (seconds)
                          - spinbutton "In point (seconds)" [ref=e179]: "0"
                        - generic [ref=e180]:
                          - text: Out point (seconds)
                          - spinbutton "Out point (seconds)" [ref=e181]: "0.48"
                        - generic [ref=e182]:
                          - text: Transpose
                          - status "Transpose 0" [ref=e183]: 0 st
                          - slider "Transpose" [ref=e184]: "0"
                        - generic [ref=e185]:
                          - text: Gain
                          - status "Gain 0" [ref=e186]: 0 dB
                          - slider "Gain" [ref=e187]: "0"
                        - generic [ref=e188]:
                          - text: Pan
                          - status "Pan 0" [ref=e189]: "0"
                          - slider "Pan" [ref=e190]: "0"
                    - generic [ref=e191]:
                      - button "Detailed edit" [ref=e192] [cursor=pointer]
                      - button "Slice this sample" [ref=e193] [cursor=pointer]
                      - button "Replace" [ref=e194] [cursor=pointer]
                      - button "Clear" [ref=e195] [cursor=pointer]
                    - generic [ref=e196]:
                      - generic [ref=e197]:
                        - text: Move or swap with pad
                        - combobox "Move or swap with pad" [ref=e198]:
                          - option "Pad 1" [selected]
                          - option "Pad 2"
                          - option "Pad 3"
                          - option "Pad 4"
                          - option "Pad 5"
                          - option "Pad 6"
                          - option "Pad 7"
                          - option "Pad 8"
                          - option "Pad 9"
                          - option "Pad 10"
                          - option "Pad 11"
                          - option "Pad 12"
                          - option "Pad 13"
                          - option "Pad 14"
                          - option "Pad 15"
                          - option "Pad 16"
                          - option "Pad 17"
                          - option "Pad 18"
                          - option "Pad 19"
                          - option "Pad 20"
                          - option "Pad 21"
                          - option "Pad 22"
                          - option "Pad 23"
                          - option "Pad 24"
                      - paragraph [ref=e199]: Pad 1 contains Seed Kick. The sounds will swap.
                      - button "Move or swap" [disabled] [ref=e200]
                    - region "Unassigned sounds" [ref=e201]:
                      - generic [ref=e202]:
                        - heading "Unassigned sounds" [level=4] [ref=e203]
                        - generic [ref=e204]: "0"
                      - paragraph [ref=e205]: Imported sources and overflow sounds appear here until you assign them.
                  - generic "Drum instrument actions" [ref=e206]:
                    - button "reset instrument" [ref=e207] [cursor=pointer]
                    - button "clear all" [ref=e208] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e209]: 
                      - text: clear all
                    - button "import OP-1 preset" [ref=e210] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e211]: 
                      - text: import OP-1 preset
                    - button "bulk edit" [ref=e212] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e213]: 
                      - text: bulk edit
                    - button "browse folder" [ref=e214] [cursor=pointer]
            - group [ref=e215]:
              - generic "Preset and performance settings poly · transpose 0 · volume 69%" [ref=e216] [cursor=pointer]:
                - text: Preset and performance settings
                - generic [ref=e217]: poly · transpose 0 · volume 69%
              - option "poly" [selected]
              - option "mono"
              - option "legato"
              - text:  
            - group [ref=e218]:
              - generic "Audio output and processing WAV · 44.1 kHz · 16-bit · mono" [ref=e219] [cursor=pointer]:
                - text: Audio output and processing
                - generic [ref=e220]: WAV · 44.1 kHz · 16-bit · mono
              - text: 
              - option "original"
              - option "44.1 khz" [selected]
              - option "22 khz"
              - option "11 khz"
              - option "original"
              - option "24-bit"
              - option "16-bit" [selected]
              - option "12-bit"
              - option "8-bit"
              - option "original"
              - option "mono" [selected]
              - text:  
    - generic [ref=e221]:
      - generic [ref=e222]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
      - generic [ref=e223]:
        - generic [ref=e224]: proudly open source
        - generic [ref=e225]: "|"
        - link "github fork" [ref=e226] [cursor=pointer]:
          - /url: https://github.com/sscommander79/op-patchstudio
        - generic [ref=e227]: "|"
        - generic [ref=e228]: v0.0.0 · build pinned
      - generic [ref=e229]:
        - text: fork maintained by sscommander79 · original project by
        - link "joseph-holland" [ref=e230] [cursor=pointer]:
          - /url: https://github.com/joseph-holland
      - generic [ref=e231]:
        - text: inspired by the awesome
        - link "opxy-drum-tool" [ref=e232] [cursor=pointer]:
          - /url: https://buba447.github.io/opxy-drum-tool/
        - text: by zeitgeese
  - generic:
    - generic:
      - heading "keyboard controls" [level=3]
      - paragraph:
        - strong: "load:"
        - text: select an empty pad, then use Add sounds nearby
      - paragraph:
        - strong: "play:"
        - text: tap keys to play loaded samples
      - paragraph:
        - strong: "pin:"
        - text: use the pin icon to keep the keyboard at the top of the screen
  - generic:
    - generic:
      - generic:
        - paragraph: snap all sample markers to zero crossings for cleaner audio. this does not affect future imports.
```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test';
  2  | 
  3  | // Reviewed pixel baselines. Update only with `npm run test:visual -- --update-snapshots` after a person
  4  | // has compared the new images with the approved references and recorded the review
  5  | // (docs/design-system/studio-launch-contract.md, "Changing a baseline").
  6  | 
  7  | test.skip(process.platform !== 'darwin' && process.env.OPSTUDIO_VISUAL !== '1',
  8  |   'Baselines are recorded on macOS Chromium; other platforms need their own reviewed baselines.');
  9  | 
  10 | const viewports = { desktop: { width: 1440, height: 1000 }, narrow: { width: 390, height: 844 } } as const;
  11 | 
  12 | // The footer build marker holds a per-server-start id in a proportional font, so its width varies.
  13 | // Its text is pinned before capture (the build marker itself is asserted in the design contract).
  14 | const stable = async (page: Page) => {
  15 |   await page.locator('footer [data-opstudio-build]').evaluate(element => { element.textContent = 'v0.0.0 · build pinned'; });
  16 |   return { fullPage: true };
  17 | };
  18 | 
  19 | for (const scheme of ['light', 'dark'] as const) {
  20 |   for (const [size, viewport] of Object.entries(viewports)) {
  21 |     test.describe(`${size} ${scheme}`, () => {
  22 |       test.use({ viewport, colorScheme: scheme });
  23 | 
  24 |       test('launch', async ({ page }) => {
  25 |         await page.goto('/#/studio/overview', { waitUntil: 'networkidle' });
  26 |         await expect(page.locator('html')).toHaveAttribute('data-studio-theme', scheme);
  27 |         await expect(page.getByRole('region', { name: 'What are you working on?' })).toBeVisible();
  28 |         await expect(page).toHaveScreenshot(`launch-${size}-${scheme}.png`, await stable(page));
  29 |       });
  30 | 
  31 |       test('empty drum workbench', async ({ page }) => {
  32 |         await page.goto('/#/studio/drum', { waitUntil: 'networkidle' });
  33 |         await expect(page.getByRole('region', { name: 'Drum pad instrument, 0 of 24 loaded' })).toBeVisible();
  34 |         await expect(page.getByRole('button', { name: 'Load demo kit', exact: true })).toBeVisible();
  35 |         await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  36 |         await expect(page).toHaveScreenshot(`drum-empty-${size}-${scheme}.png`, await stable(page));
  37 |       });
  38 | 
  39 |       test('drum workbench with the Studio Seed kit', async ({ page }) => {
  40 |         await page.goto('/#/studio/drum', { waitUntil: 'networkidle' });
  41 |         await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
  42 |         await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
  43 |         // The load notification auto-dismisses after five seconds; wait so it is never recorded.
  44 |         await expect(page.getByText('Studio Seed loaded')).toBeHidden({ timeout: 10_000 });
  45 |         // Studio Seed selects its first voice; blur so no transient focus ring is recorded.
  46 |         await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
> 47 |         await expect(page).toHaveScreenshot(`drum-${size}-${scheme}.png`, await stable(page));
     |                            ^ Error: expect(page).toHaveScreenshot(expected) failed
  48 |       });
  49 |     });
  50 |   }
  51 | }
  52 | 
```