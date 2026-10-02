# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-visual.spec.ts >> desktop light >> drum workbench with the Studio Seed kit
- Location: tests/visual/studio-visual.spec.ts:39:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 1440px by 1738px, received 1440px by 1870px. 76204 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: drum-desktop-light.png

Call log:
  - Expect "toHaveScreenshot(drum-desktop-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 1440px by 1738px, received 1440px by 1870px. 76204 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 1440px by 1738px, received 1440px by 1870px. 76204 pixels (ratio 0.03 of all image pixels) are different.

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
              - textbox "Instrument name" [ref=e48]: Studio Seed
            - status [ref=e49]: Saved locally
            - generic [ref=e50]:
              - button "Undo" [ref=e51] [cursor=pointer]
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
                - button "Add demo kit" [ref=e64] [cursor=pointer]
              - group "Kit setup guide" [ref=e65]:
                - generic "Kit setup guide Optional" [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: Kit setup guide
                  - generic [ref=e68]: Optional
              - group "First preset guide" [ref=e69]:
                - generic "Your first preset · 3-step guide 0/3 complete" [ref=e70] [cursor=pointer]:
                  - generic [ref=e71]: Your first preset · 3-step guide
                  - generic [ref=e72]: 0/3 complete
            - generic [ref=e73]:
              - generic [ref=e74]:
                - region "Drum pad instrument, 10 of 24 loaded" [ref=e76]:
                  - generic [ref=e77]:
                    - generic [ref=e78]:
                      - heading "PERFORMANCE / drum pads" [level=3] [ref=e79]
                      - generic [aria-hidden] [ref=e82]: 
                    - generic [ref=e83]:
                      - generic [ref=e84]:
                        - generic [aria-hidden] [ref=e85]: 
                        - text: 10 / 24 loaded
                      - button "organize" [ref=e86] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e87]: 
                      - button "midi" [ref=e89] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e90]: 
                      - button "Pin keyboard to top" [ref=e92] [cursor=pointer]:
                        - generic [aria-hidden] [ref=e93]: 
                  - text:  
                  - group "Drum keyboard" [ref=e94]:
                    - generic [ref=e95]:
                      - group "Lower octave drum keys" [ref=e96]:
                        - paragraph [ref=e97]:
                          - text: Lower pads · 1–12
                          - generic [ref=e98]: Computer keys active
                        - generic [ref=e99]:
                          - generic [ref=e100]:
                            - button "KD2 drum key W" [ref=e102] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e103]: W
                              - strong [ref=e104]: KD2
                              - generic [ref=e105]: EMPTY
                            - button "SD2 drum key E" [ref=e107] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e108]: E
                              - strong [ref=e109]: SD2
                              - generic [ref=e110]: EMPTY
                            - button "CLP drum key R" [ref=e112] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e113]: R
                              - strong [ref=e114]: CLP
                              - generic [ref=e115]: LOADED
                            - button "CH drum key Y" [ref=e117] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e118]: "Y"
                              - strong [ref=e119]: CH
                              - generic [ref=e120]: LOADED
                            - button "OH drum key U" [ref=e122] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e123]: U
                              - strong [ref=e124]: OH
                              - generic [ref=e125]: LOADED
                          - generic [ref=e126]:
                            - button "KD1 drum key A" [ref=e128] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e129]: A
                              - strong [ref=e130]: KD1
                              - generic [ref=e131]: SELECTED
                            - button "SD1 drum key S" [ref=e133] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e134]: S
                              - strong [ref=e135]: SD1
                              - generic [ref=e136]: LOADED
                            - button "RIM drum key D" [ref=e138] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e139]: D
                              - strong [ref=e140]: RIM
                              - generic [ref=e141]: LOADED
                            - button "TB drum key F" [ref=e143] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e144]: F
                              - strong [ref=e145]: TB
                              - generic [ref=e146]: EMPTY
                            - button "SH drum key G" [ref=e148] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e149]: G
                              - strong [ref=e150]: SH
                              - generic [ref=e151]: LOADED
                            - button "CL drum key H" [ref=e153] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e154]: H
                              - strong [ref=e155]: CL
                              - generic [ref=e156]: EMPTY
                            - button "CAB drum key J" [ref=e158] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e159]: J
                              - strong [ref=e160]: CAB
                              - generic [ref=e161]: EMPTY
                      - group "Upper octave drum keys" [ref=e162]:
                        - paragraph [ref=e163]:
                          - text: Upper pads · 13–24
                          - generic [ref=e164]: Press Z / X to play
                        - generic [ref=e165]:
                          - generic [ref=e166]:
                            - button "RC drum key W" [ref=e168] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e169]: W
                              - strong [ref=e170]: RC
                              - generic [ref=e171]: EMPTY
                            - button "CC drum key E" [ref=e173] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e174]: E
                              - strong [ref=e175]: CC
                              - generic [ref=e176]: EMPTY
                            - button "COW drum key R" [ref=e178] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e179]: R
                              - strong [ref=e180]: COW
                              - generic [ref=e181]: LOADED
                            - button "LC drum key Y" [ref=e183] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e184]: "Y"
                              - strong [ref=e185]: LC
                              - generic [ref=e186]: EMPTY
                            - button "HC drum key U" [ref=e188] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e189]: U
                              - strong [ref=e190]: HC
                              - generic [ref=e191]: EMPTY
                          - generic [ref=e192]:
                            - button "LT1 drum key A" [ref=e194] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e195]: A
                              - strong [ref=e196]: LT1
                              - generic [ref=e197]: LOADED
                            - button "MT drum key S" [ref=e199] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e200]: S
                              - strong [ref=e201]: MT
                              - generic [ref=e202]: EMPTY
                            - button "HT drum key D" [ref=e204] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e205]: D
                              - strong [ref=e206]: HT
                              - generic [ref=e207]: LOADED
                            - button "TRI drum key F" [ref=e209] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e210]: F
                              - strong [ref=e211]: TRI
                              - generic [ref=e212]: EMPTY
                            - button "LT2 drum key G" [ref=e214] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e215]: G
                              - strong [ref=e216]: LT2
                              - generic [ref=e217]: EMPTY
                            - button "WS drum key H" [ref=e219] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e220]: H
                              - strong [ref=e221]: WS
                              - generic [ref=e222]: EMPTY
                            - button "GUI drum key J" [ref=e224] [cursor=pointer]:
                              - generic [aria-hidden] [ref=e225]: J
                              - strong [ref=e226]: GUI
                              - generic [ref=e227]: EMPTY
                - generic "Add and create sounds" [ref=e228]:
                  - button "Add sounds" [ref=e229] [cursor=pointer]
                  - button "Slice audio" [ref=e230] [cursor=pointer]
                  - button "Record takes" [ref=e231] [cursor=pointer]
              - generic [ref=e233]:
                - generic [ref=e234]:
                  - heading "EDIT / Sample management" [level=3] [ref=e236]
                  - generic "Sample workspace view" [ref=e237]:
                    - button "Focus" [pressed] [ref=e238]
                    - button "Table" [ref=e239]
                - generic [ref=e240]:
                  - region "Focused sample editor" [ref=e241]:
                    - generic [ref=e242]:
                      - generic [ref=e243]:
                        - paragraph [ref=e244]: SELECTED SOUND
                        - heading "Pad 1 · Seed Kick" [level=3] [ref=e245]
                      - generic [ref=e246]:
                        - button "Play selected" [ref=e247] [cursor=pointer]
                        - button "Previous pad" [disabled] [ref=e248]
                        - button "Next pad →" [ref=e249] [cursor=pointer]
                    - generic [ref=e250]:
                      - generic [ref=e251]:
                        - button "" [ref=e252] [cursor=pointer]
                        - generic [ref=e254] [cursor=pointer]
                      - generic [ref=e255]:
                        - generic [ref=e256]:
                          - text: Mode
                          - combobox "Mode" [ref=e257]:
                            - option "One shot" [selected]
                            - option "Mute group"
                            - option "Loop"
                            - option "Gate"
                        - button "Forward" [ref=e258] [cursor=pointer]
                        - generic [ref=e259]:
                          - text: In point (seconds)
                          - spinbutton "In point (seconds)" [ref=e260]: "0"
                        - generic [ref=e261]:
                          - text: Out point (seconds)
                          - spinbutton "Out point (seconds)" [ref=e262]: "0.48"
                        - generic [ref=e263]:
                          - text: Transpose
                          - status "Transpose 0" [ref=e264]: 0 st
                          - slider "Transpose" [ref=e265]: "0"
                        - generic [ref=e266]:
                          - text: Gain
                          - status "Gain 0" [ref=e267]: 0 dB
                          - slider "Gain" [ref=e268]: "0"
                        - generic [ref=e269]:
                          - text: Pan
                          - status "Pan 0" [ref=e270]: "0"
                          - slider "Pan" [ref=e271]: "0"
                    - generic [ref=e272]:
                      - button "Detailed edit" [ref=e273] [cursor=pointer]
                      - button "Slice this sample" [ref=e274] [cursor=pointer]
                      - button "Replace" [ref=e275] [cursor=pointer]
                      - button "Clear" [ref=e276] [cursor=pointer]
                    - generic [ref=e277]:
                      - generic [ref=e278]:
                        - text: Move or swap with pad
                        - combobox "Move or swap with pad" [ref=e279]:
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
                      - paragraph [ref=e280]: Pad 1 contains Seed Kick. The sounds will swap.
                      - button "Move or swap" [disabled] [ref=e281]
                    - region "Unassigned sounds" [ref=e282]:
                      - generic [ref=e283]:
                        - heading "Unassigned sounds" [level=4] [ref=e284]
                        - generic [ref=e285]: "0"
                      - paragraph [ref=e286]: Imported sources and overflow sounds appear here until you assign them.
                  - generic "Drum instrument actions" [ref=e287]:
                    - button "reset instrument" [ref=e288] [cursor=pointer]
                    - button "clear all" [ref=e289] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e290]: 
                      - text: clear all
                    - button "import OP-1 preset" [ref=e291] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e292]: 
                      - text: import OP-1 preset
                    - button "bulk edit" [ref=e293] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e294]: 
                      - text: bulk edit
                    - button "browse folder" [ref=e295] [cursor=pointer]
            - group [ref=e296]:
              - generic "Preset and performance settings poly · transpose 0 · volume 69%" [ref=e297] [cursor=pointer]:
                - text: Preset and performance settings
                - generic [ref=e298]: poly · transpose 0 · volume 69%
              - option "poly" [selected]
              - option "mono"
              - option "legato"
              - text:  
            - group [ref=e299]:
              - generic "Audio output and processing WAV · 44.1 kHz · 16-bit · mono" [ref=e300] [cursor=pointer]:
                - text: Audio output and processing
                - generic [ref=e301]: WAV · 44.1 kHz · 16-bit · mono
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
    - generic [ref=e302]:
      - generic [ref=e303]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
      - generic [ref=e304]:
        - generic [ref=e305]: proudly open source
        - generic [ref=e306]: "|"
        - link "github fork" [ref=e307] [cursor=pointer]:
          - /url: https://github.com/sscommander79/op-patchstudio
        - generic [ref=e308]: "|"
        - generic [ref=e309]: v0.0.0 · build pinned
      - generic [ref=e310]:
        - text: fork maintained by sscommander79 · original project by
        - link "joseph-holland" [ref=e311] [cursor=pointer]:
          - /url: https://github.com/joseph-holland
      - generic [ref=e312]:
        - text: inspired by the awesome
        - link "opxy-drum-tool" [ref=e313] [cursor=pointer]:
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