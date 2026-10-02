# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-visual.spec.ts >> desktop light >> empty drum workbench
- Location: tests/visual/studio-visual.spec.ts:31:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  5594 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: drum-empty-desktop-light.png

Call log:
  - Expect "toHaveScreenshot(drum-empty-desktop-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 5594 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 5594 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic "Studio navigation" [ref=e6]:
        - generic [ref=e7]:
          - generic [ref=e8]:
            - strong [ref=e9]: OP–PatchStudio
            - generic [ref=e10]: Unofficial preset studio
          - navigation "Workspace" [ref=e11]:
            - button "Overview" [ref=e12] [cursor=pointer]
            - button "Library" [ref=e13] [cursor=pointer]
            - button "Transfer" [ref=e14] [cursor=pointer]
            - button "Devices" [ref=e15] [cursor=pointer]
          - generic [ref=e16]:
            - generic [ref=e17]: LOCAL WORKSPACE
            - group "Appearance" [ref=e18]:
              - generic [ref=e20] [cursor=pointer]:
                - radio "OP-1 Field" [checked] [ref=e21]
                - generic [ref=e27]: OP-1 Field
              - generic [ref=e28] [cursor=pointer]:
                - radio "OP-XY" [ref=e29]
                - generic [ref=e33]: OP-XY
            - generic [ref=e34]:
              - generic [ref=e35]: Theme
              - combobox "Theme" [ref=e36]:
                - option "System" [selected]
                - option "Light"
                - option "Dark"
            - button "Help" [ref=e37] [cursor=pointer]
        - paragraph [ref=e38]:
          - generic [ref=e39]:
            - text: Studio /
            - strong [ref=e40]: Drum kit editor
      - main [ref=e42]:
        - heading "Drum kit editor" [level=1] [ref=e43]
        - region "Instrument project controls" [ref=e44]:
          - generic [ref=e45]:
            - generic [ref=e46]:
              - generic [ref=e47]: Instrument name
              - textbox "Instrument name" [ref=e48]
            - status [ref=e49]: Unsaved changes
            - generic [ref=e50]:
              - button "Undo" [disabled] [ref=e51]
              - button "Redo" [disabled] [ref=e52]
              - group [ref=e53]:
                - generic "Project" [ref=e54] [cursor=pointer]
              - button "Export OP-XY" [ref=e55] [cursor=pointer]
        - region "drum tool content" [ref=e57]:
          - generic [ref=e58]:
            - generic [ref=e59]:
              - region "Studio Seed demo kit" [ref=e60]:
                - generic [ref=e61]:
                  - paragraph [ref=e62]: STARTER KIT
                  - strong [ref=e63]: Studio Seed
                  - paragraph [ref=e64]: Ten deterministic synthesized drum voices. Loading makes no sound until you play a pad.
                - button "Load demo kit" [ref=e65] [cursor=pointer]
              - group "Kit setup guide" [ref=e66]:
                - generic "Kit setup guide Optional" [ref=e67] [cursor=pointer]:
                  - generic [ref=e68]: Kit setup guide
                  - generic [ref=e69]: Optional
            - generic [ref=e70]:
              - generic [ref=e71]:
                - region "Drum pad instrument, 0 of 24 loaded" [ref=e73]:
                  - generic [ref=e74]:
                    - generic [ref=e75]:
                      - heading "PERFORMANCE / drum pads" [level=3] [ref=e76]
                      - generic [aria-hidden] [ref=e79]: 
                    - generic [ref=e80]:
                      - generic [ref=e81]: 0 / 24 loaded
                      - button "organize" [ref=e82] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e83]: 
                      - button "midi" [ref=e85] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e86]: 
                      - button "Pin keyboard to top" [ref=e88] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e89]: 
                  - text:  
                  - group "Drum keyboard" [ref=e90]:
                    - generic [ref=e91]:
                      - group "Lower octave drum keys" [ref=e92]:
                        - paragraph [ref=e93]:
                          - text: Lower pads · 1–12
                          - generic [ref=e94]: Computer keys active
                        - generic [ref=e95]:
                          - generic [ref=e96]:
                            - button "KD2 drum key W" [ref=e98] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e99]: W
                              - strong [ref=e100]: KD2
                              - generic [ref=e101]: EMPTY
                            - button "SD2 drum key E" [ref=e103] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e104]: E
                              - strong [ref=e105]: SD2
                              - generic [ref=e106]: EMPTY
                            - button "CLP drum key R" [ref=e108] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e109]: R
                              - strong [ref=e110]: CLP
                              - generic [ref=e111]: EMPTY
                            - button "CH drum key Y" [ref=e113] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e114]: "Y"
                              - strong [ref=e115]: CH
                              - generic [ref=e116]: EMPTY
                            - button "OH drum key U" [ref=e118] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e119]: U
                              - strong [ref=e120]: OH
                              - generic [ref=e121]: EMPTY
                          - generic [ref=e122]:
                            - button "KD1 drum key A" [ref=e124] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e125]: A
                              - strong [ref=e126]: KD1
                              - generic [ref=e127]: SELECTED
                            - button "SD1 drum key S" [ref=e129] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e130]: S
                              - strong [ref=e131]: SD1
                              - generic [ref=e132]: EMPTY
                            - button "RIM drum key D" [ref=e134] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e135]: D
                              - strong [ref=e136]: RIM
                              - generic [ref=e137]: EMPTY
                            - button "TB drum key F" [ref=e139] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e140]: F
                              - strong [ref=e141]: TB
                              - generic [ref=e142]: EMPTY
                            - button "SH drum key G" [ref=e144] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e145]: G
                              - strong [ref=e146]: SH
                              - generic [ref=e147]: EMPTY
                            - button "CL drum key H" [ref=e149] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e150]: H
                              - strong [ref=e151]: CL
                              - generic [ref=e152]: EMPTY
                            - button "CAB drum key J" [ref=e154] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e155]: J
                              - strong [ref=e156]: CAB
                              - generic [ref=e157]: EMPTY
                      - group "Upper octave drum keys" [ref=e158]:
                        - paragraph [ref=e159]:
                          - text: Upper pads · 13–24
                          - generic [ref=e160]: Press Z / X to play
                        - generic [ref=e161]:
                          - generic [ref=e162]:
                            - button "RC drum key W" [ref=e164] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e165]: W
                              - strong [ref=e166]: RC
                              - generic [ref=e167]: EMPTY
                            - button "CC drum key E" [ref=e169] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e170]: E
                              - strong [ref=e171]: CC
                              - generic [ref=e172]: EMPTY
                            - button "COW drum key R" [ref=e174] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e175]: R
                              - strong [ref=e176]: COW
                              - generic [ref=e177]: EMPTY
                            - button "LC drum key Y" [ref=e179] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e180]: "Y"
                              - strong [ref=e181]: LC
                              - generic [ref=e182]: EMPTY
                            - button "HC drum key U" [ref=e184] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e185]: U
                              - strong [ref=e186]: HC
                              - generic [ref=e187]: EMPTY
                          - generic [ref=e188]:
                            - button "LT1 drum key A" [ref=e190] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e191]: A
                              - strong [ref=e192]: LT1
                              - generic [ref=e193]: EMPTY
                            - button "MT drum key S" [ref=e195] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e196]: S
                              - strong [ref=e197]: MT
                              - generic [ref=e198]: EMPTY
                            - button "HT drum key D" [ref=e200] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e201]: D
                              - strong [ref=e202]: HT
                              - generic [ref=e203]: EMPTY
                            - button "TRI drum key F" [ref=e205] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e206]: F
                              - strong [ref=e207]: TRI
                              - generic [ref=e208]: EMPTY
                            - button "LT2 drum key G" [ref=e210] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e211]: G
                              - strong [ref=e212]: LT2
                              - generic [ref=e213]: EMPTY
                            - button "WS drum key H" [ref=e215] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e216]: H
                              - strong [ref=e217]: WS
                              - generic [ref=e218]: EMPTY
                            - button "GUI drum key J" [ref=e220] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e221]: J
                              - strong [ref=e222]: GUI
                              - generic [ref=e223]: EMPTY
                - generic "Add and create sounds" [ref=e224]:
                  - button "Add sounds" [ref=e225] [cursor=pointer]
                  - button "Slice audio" [ref=e226] [cursor=pointer]
                  - button "Record takes" [ref=e227] [cursor=pointer]
              - generic [ref=e229]:
                - generic [ref=e230]:
                  - heading "EDIT / Sample management" [level=3] [ref=e232]
                  - generic "Sample workspace view" [ref=e233]:
                    - button "Focus" [pressed] [ref=e234]
                    - button "Table" [ref=e235]
                - generic [ref=e236]:
                  - region "Focused sample editor" [ref=e237]:
                    - generic [ref=e238]:
                      - generic [ref=e239]:
                        - paragraph [ref=e240]: SELECTED SOUND
                        - heading "Pad 1 · Empty" [level=3] [ref=e241]
                      - generic [ref=e242]:
                        - button "Previous pad" [disabled] [ref=e243]
                        - button "Next pad →" [ref=e244] [cursor=pointer]
                    - generic [ref=e245]:
                      - paragraph [ref=e246]: This selected pad is empty. Add a sample or record a sound into it.
                      - generic [ref=e247]:
                        - button "Add sample" [ref=e248] [cursor=pointer]
                        - button "Record here" [ref=e249] [cursor=pointer]
                    - region "Unassigned sounds" [ref=e250]:
                      - generic [ref=e251]:
                        - heading "Unassigned sounds" [level=4] [ref=e252]
                        - generic [ref=e253]: "0"
                      - paragraph [ref=e254]: Imported sources and overflow sounds appear here until you assign them.
                  - generic "Drum instrument actions" [ref=e255]:
                    - button "reset instrument" [ref=e256] [cursor=pointer]
                    - button "clear all" [disabled] [ref=e257]:
                      - generic [aria-hidden] [ref=e258]: 
                      - text: clear all
                    - button "import OP-1 preset" [ref=e259] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e260]: 
                      - text: import OP-1 preset
                    - button "bulk edit" [disabled] [ref=e261]:
                      - generic [aria-hidden] [ref=e262]: 
                      - text: bulk edit
                    - button "browse folder" [ref=e263] [cursor=pointer]
            - group [ref=e264]:
              - generic "Preset and performance settings poly · transpose 0 · volume 69%" [ref=e265] [cursor=pointer]:
                - text: Preset and performance settings
                - generic [ref=e266]: poly · transpose 0 · volume 69%
              - option "poly" [selected]
              - option "mono"
              - option "legato"
              - text:  
            - group [ref=e267]:
              - generic "Audio output and processing WAV · 44.1 kHz · 16-bit · stereo" [ref=e268] [cursor=pointer]:
                - text: Audio output and processing
                - generic [ref=e269]: WAV · 44.1 kHz · 16-bit · stereo
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
              - option "original" [selected]
              - option "mono"
              - text:  
    - generic [ref=e270]:
      - generic [ref=e271]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
      - generic [ref=e272]:
        - generic [ref=e273]: proudly open source
        - generic [ref=e274]: "|"
        - link "github fork" [ref=e275] [cursor=pointer]:
          - /url: https://github.com/sscommander79/op-patchstudio
        - generic [ref=e276]: "|"
        - generic [ref=e277]: v0.0.0 · build pinned
      - generic [ref=e278]:
        - text: fork maintained by sscommander79 · original project by
        - link "joseph-holland" [ref=e279] [cursor=pointer]:
          - /url: https://github.com/joseph-holland
      - generic [ref=e280]:
        - text: inspired by the awesome
        - link "opxy-drum-tool" [ref=e281] [cursor=pointer]:
          - /url: https://buba447.github.io/opxy-drum-tool/
        - text: by zeitgeese
  - generic:
    - generic:
      - heading "keyboard controls" [level=3]
      - paragraph:
        - strong: "load:"
        - text: select an empty pad and use Add sounds, or drag audio directly onto a pad
      - paragraph:
        - strong: "play:"
        - text: use keyboard keys (
        - strong: A-J, W, E, R, Y, U
        - text: ) to trigger samples and
        - strong: Z
        - text: /
        - strong: X
        - text: to switch octaves
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
> 36 |         await expect(page).toHaveScreenshot(`drum-empty-${size}-${scheme}.png`, await stable(page));
     |                            ^ Error: expect(page).toHaveScreenshot(expected) failed
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
  47 |         await expect(page).toHaveScreenshot(`drum-${size}-${scheme}.png`, await stable(page));
  48 |       });
  49 |     });
  50 |   }
  51 | }
  52 | 
```