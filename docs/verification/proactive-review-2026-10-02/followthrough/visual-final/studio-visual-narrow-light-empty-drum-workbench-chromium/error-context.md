# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-visual.spec.ts >> narrow light >> empty drum workbench
- Location: tests/visual/studio-visual.spec.ts:31:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 2304px, received 390px by 2366px. 215793 pixels (ratio 0.24 of all image pixels) are different.

  Snapshot: drum-empty-narrow-light.png

Call log:
  - Expect "toHaveScreenshot(drum-empty-narrow-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 2304px, received 390px by 2366px. 215793 pixels (ratio 0.24 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 2304px, received 390px by 2366px. 215793 pixels (ratio 0.24 of all image pixels) are different.

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
              - textbox "Instrument name" [ref=e46]
            - status [ref=e47]: Unsaved changes
            - generic [ref=e48]:
              - button "Undo" [disabled] [ref=e49]
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
                  - paragraph [ref=e62]: Ten deterministic synthesized drum voices. Loading makes no sound until you play a pad.
                - button "Load demo kit" [ref=e63] [cursor=pointer]
              - group "Kit setup guide" [ref=e64]:
                - generic "Kit setup guide Optional" [ref=e65] [cursor=pointer]:
                  - generic [ref=e66]: Kit setup guide
                  - generic [ref=e67]: Optional
            - generic [ref=e68]:
              - generic [ref=e69]:
                - region "Drum pad instrument, 0 of 24 loaded" [ref=e71]:
                  - generic [ref=e72]:
                    - generic [ref=e73]:
                      - heading "PERFORMANCE / drum pads" [level=3] [ref=e74]
                      - generic [aria-hidden] [ref=e77]: 
                    - button "Pin keyboard to top" [ref=e79] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e80]: 
                  - text:  
                  - group "Drum keyboard" [ref=e81]:
                    - generic [ref=e82]:
                      - group "Drum pad bank" [ref=e83]:
                        - button "Lower pads 1–12" [pressed] [ref=e84]
                        - button "Upper pads 13–24" [ref=e85]
                      - group "Lower twelve drum pads" [ref=e86]:
                        - generic [ref=e87]:
                          - button "Pad 2, KD2, empty" [ref=e89] [cursor=pointer]:
                            - strong [ref=e90]: KD2
                            - generic [ref=e91]: EMPTY
                          - button "Pad 4, SD2, empty" [ref=e93] [cursor=pointer]:
                            - strong [ref=e94]: SD2
                            - generic [ref=e95]: EMPTY
                          - button "Pad 6, CLP, empty" [ref=e97] [cursor=pointer]:
                            - strong [ref=e98]: CLP
                            - generic [ref=e99]: EMPTY
                          - button "Pad 9, CH, empty" [ref=e101] [cursor=pointer]:
                            - strong [ref=e102]: CH
                            - generic [ref=e103]: EMPTY
                          - button "Pad 11, OH, empty" [ref=e105] [cursor=pointer]:
                            - strong [ref=e106]: OH
                            - generic [ref=e107]: EMPTY
                        - generic [ref=e108]:
                          - button "Pad 1, KD1, empty" [ref=e110] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e111]: A
                            - strong [ref=e112]: KD1
                            - generic [ref=e113]: EMPTY
                          - button "Pad 3, SD1, empty" [ref=e115] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e116]: S
                            - strong [ref=e117]: SD1
                            - generic [ref=e118]: EMPTY
                          - button "Pad 5, RIM, empty" [ref=e120] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e121]: D
                            - strong [ref=e122]: RIM
                            - generic [ref=e123]: EMPTY
                          - button "Pad 7, TB, empty" [ref=e125] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e126]: F
                            - strong [ref=e127]: TB
                            - generic [ref=e128]: EMPTY
                          - button "Pad 8, SH, empty" [ref=e130] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e131]: G
                            - strong [ref=e132]: SH
                            - generic [ref=e133]: EMPTY
                          - button "Pad 10, CL, empty" [ref=e135] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e136]: H
                            - strong [ref=e137]: CL
                            - generic [ref=e138]: EMPTY
                          - button "Pad 12, CAB, empty" [ref=e140] [cursor=pointer]:
                            - generic [aria-hidden] [ref=e141]: J
                            - strong [ref=e142]: CAB
                            - generic [ref=e143]: EMPTY
                - generic "Add and create sounds" [ref=e144]:
                  - button "Add sounds" [ref=e145] [cursor=pointer]
                  - button "Slice audio" [ref=e146] [cursor=pointer]
                  - button "Record takes" [ref=e147] [cursor=pointer]
              - generic [ref=e149]:
                - generic [ref=e150]:
                  - heading "EDIT / Sample management" [level=3] [ref=e152]
                  - generic "Sample workspace view" [ref=e153]:
                    - button "Focus" [pressed] [ref=e154]
                    - button "Table" [ref=e155]
                - generic [ref=e156]:
                  - region "Focused sample editor" [ref=e157]:
                    - generic [ref=e158]:
                      - generic [ref=e159]:
                        - paragraph [ref=e160]: SELECTED SOUND
                        - heading "Pad 1 · Empty" [level=3] [ref=e161]
                      - generic [ref=e162]:
                        - button "Previous pad" [disabled] [ref=e163]
                        - button "Next pad →" [ref=e164] [cursor=pointer]
                    - generic [ref=e165]:
                      - paragraph [ref=e166]: This selected pad is empty. Add a sample or record a sound into it.
                      - generic [ref=e167]:
                        - button "Add sample" [ref=e168] [cursor=pointer]
                        - button "Record here" [ref=e169] [cursor=pointer]
                    - region "Unassigned sounds" [ref=e170]:
                      - generic [ref=e171]:
                        - heading "Unassigned sounds" [level=4] [ref=e172]
                        - generic [ref=e173]: "0"
                      - paragraph [ref=e174]: Imported sources and overflow sounds appear here until you assign them.
                  - generic "Drum instrument actions" [ref=e175]:
                    - button "reset instrument" [ref=e176] [cursor=pointer]
                    - button "clear all" [disabled] [ref=e177]:
                      - generic [aria-hidden] [ref=e178]: 
                      - text: clear all
                    - button "import OP-1 preset" [ref=e179] [cursor=pointer]:
                      - generic [aria-hidden] [ref=e180]: 
                      - text: import OP-1 preset
                    - button "bulk edit" [disabled] [ref=e181]:
                      - generic [aria-hidden] [ref=e182]: 
                      - text: bulk edit
                    - button "browse folder" [ref=e183] [cursor=pointer]
            - group [ref=e184]:
              - generic "Preset and performance settings poly · transpose 0 · volume 69%" [ref=e185] [cursor=pointer]:
                - text: Preset and performance settings
                - generic [ref=e186]: poly · transpose 0 · volume 69%
              - option "poly" [selected]
              - option "mono"
              - option "legato"
              - text:  
            - group [ref=e187]:
              - generic "Audio output and processing WAV · 44.1 kHz · 16-bit · stereo" [ref=e188] [cursor=pointer]:
                - text: Audio output and processing
                - generic [ref=e189]: WAV · 44.1 kHz · 16-bit · stereo
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
    - generic [ref=e190]:
      - generic [ref=e191]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
      - generic [ref=e192]:
        - generic [ref=e193]: proudly open source
        - generic [ref=e194]: "|"
        - link "github fork" [ref=e195] [cursor=pointer]:
          - /url: https://github.com/sscommander79/op-patchstudio
        - generic [ref=e196]: "|"
        - generic [ref=e197]: v0.0.0 · build pinned
      - generic [ref=e198]:
        - text: fork maintained by sscommander79 · original project by
        - link "joseph-holland" [ref=e199] [cursor=pointer]:
          - /url: https://github.com/joseph-holland
      - generic [ref=e200]:
        - text: inspired by the awesome
        - link "opxy-drum-tool" [ref=e201] [cursor=pointer]:
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