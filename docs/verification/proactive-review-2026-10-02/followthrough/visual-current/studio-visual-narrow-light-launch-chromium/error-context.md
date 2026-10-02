# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-visual.spec.ts >> narrow light >> launch
- Location: tests/visual/studio-visual.spec.ts:24:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 2514px, received 390px by 2576px. 149226 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: launch-narrow-light.png

Call log:
  - Expect "toHaveScreenshot(launch-narrow-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 2514px, received 390px by 2576px. 149226 pixels (ratio 0.15 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 2514px, received 390px by 2576px. 149226 pixels (ratio 0.15 of all image pixels) are different.

```

# Page snapshot

```yaml
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
    - main [ref=e37]:
      - region [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - heading "What are you working on?" [active] [level=1] [ref=e41]
            - paragraph [ref=e42]: Choose a starting point. Everything stays local.
          - paragraph [ref=e43]: No cloud · no accountProjects stay in this browser
        - generic [ref=e44]:
          - article [ref=e45]:
            - generic [ref=e46]:
              - heading "Multisample a synth" [level=2] [ref=e47]
              - paragraph [ref=e48]: Capture notes / build an instrument
            - 'img "Note range diagram: 24 zones across the keyboard, 0 loaded" [ref=e49]'
            - generic [ref=e92]:
              - generic [ref=e93]: Note range
              - generic [ref=e94]:
                - 'button "Setup guide: multisample a synth" [ref=e95] [cursor=pointer]': Setup guide
                - button "Open capture" [ref=e96] [cursor=pointer]: Open capture →
          - article [ref=e97]:
            - generic [ref=e98]:
              - heading "Sample a sound" [level=2] [ref=e99]
              - paragraph [ref=e100]: Record / review / add
            - 'img "Capture diagram: record a take, review the waveform, then add it" [ref=e101]':
              - generic [ref=e118]: REVIEW
            - generic [ref=e119]:
              - generic [ref=e120]: Record takes
              - generic [ref=e121]:
                - 'button "Setup guide: sample a sound" [ref=e122] [cursor=pointer]': Setup guide
                - button "Open sampler" [ref=e123] [cursor=pointer]: Open sampler →
          - article [ref=e124]:
            - generic [ref=e125]:
              - heading "Build a drum kit" [level=2] [ref=e126]
              - paragraph [ref=e127]: Pad map / shape / export
            - 'img "Drum kit illustration: bass drum, snare and percussion on six colorful pads" [ref=e128]'
            - generic [ref=e166]:
              - generic [ref=e167]: 24 sample slots
              - generic [ref=e168]:
                - 'button "Setup guide: build a drum kit" [ref=e169] [cursor=pointer]': Setup guide
                - button "Open kit" [ref=e170] [cursor=pointer]: Open kit →
          - article [ref=e171]:
            - generic [ref=e172]:
              - heading "Record OP-XY tracks" [level=2] [ref=e173]
              - paragraph [ref=e174]: Capture / review / export
            - 'img "Multitrack recording illustration: capture OP-XY tracks into separate audio lanes" [ref=e175]'
            - generic [ref=e200]:
              - generic [ref=e201]: Separate audio tracks
              - button "Record OP-XY tracks" [ref=e203] [cursor=pointer]: Open recorder →
        - button "External gear Open devices" [ref=e204] [cursor=pointer]:
          - generic [ref=e205]:
            - strong [ref=e206]: External gear
            - generic [ref=e207]: Connect / map / save a setup
          - generic [aria-hidden] [ref=e208]:
            - generic [ref=e209]: MIDI CC
            - generic [ref=e210]: →
            - generic [ref=e211]: Synth
            - generic [ref=e212]: →
            - generic [ref=e213]: State
          - generic [ref=e214]: Open devices →
        - generic [ref=e215]:
          - button "Open library Browse saved instruments" [ref=e216] [cursor=pointer]:
            - strong [ref=e217]: Open library
            - generic [ref=e218]: Browse saved instruments →
          - button "Back up or transfer Keep an editable project copy" [ref=e219] [cursor=pointer]:
            - strong [ref=e220]: Back up or transfer
            - generic [ref=e221]: Keep an editable project copy →
        - paragraph [ref=e222]:
          - generic [ref=e223]: Projects save locally
          - generic [ref=e224]: Transfer from the project controls
  - generic [ref=e225]:
    - generic [ref=e226]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
    - generic [ref=e227]:
      - generic [ref=e228]: proudly open source
      - generic [ref=e229]: "|"
      - link "github fork" [ref=e230] [cursor=pointer]:
        - /url: https://github.com/sscommander79/op-patchstudio
      - generic [ref=e231]: "|"
      - generic [ref=e232]: v0.0.0 · build pinned
    - generic [ref=e233]:
      - text: fork maintained by sscommander79 · original project by
      - link "joseph-holland" [ref=e234] [cursor=pointer]:
        - /url: https://github.com/joseph-holland
    - generic [ref=e235]:
      - text: inspired by the awesome
      - link "opxy-drum-tool" [ref=e236] [cursor=pointer]:
        - /url: https://buba447.github.io/opxy-drum-tool/
      - text: by zeitgeese
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
> 28 |         await expect(page).toHaveScreenshot(`launch-${size}-${scheme}.png`, await stable(page));
     |                            ^ Error: expect(page).toHaveScreenshot(expected) failed
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
  47 |         await expect(page).toHaveScreenshot(`drum-${size}-${scheme}.png`, await stable(page));
  48 |       });
  49 |     });
  50 |   }
  51 | }
  52 | 
```