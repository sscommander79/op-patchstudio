# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studio-visual.spec.ts >> desktop light >> launch
- Location: tests/visual/studio-visual.spec.ts:24:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  5594 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: launch-desktop-light.png

Call log:
  - Expect "toHaveScreenshot(launch-desktop-light.png)" with timeout 5000ms
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
    - main [ref=e39]:
      - region [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - heading "What are you working on?" [active] [level=1] [ref=e43]
            - paragraph [ref=e44]: Choose a starting point. Everything stays local.
          - paragraph [ref=e45]: No cloud · no accountProjects stay in this browser
        - generic [ref=e46]:
          - article [ref=e47]:
            - generic [ref=e48]:
              - heading "Multisample a synth" [level=2] [ref=e49]
              - paragraph [ref=e50]: Capture notes / build an instrument
            - 'img "Note range diagram: 24 zones across the keyboard, 0 loaded" [ref=e51]'
            - generic [ref=e94]:
              - generic [ref=e95]: Note range
              - generic [ref=e96]:
                - 'button "Setup guide: multisample a synth" [ref=e97] [cursor=pointer]': Setup guide
                - button "Open capture" [ref=e98] [cursor=pointer]: Open capture →
          - article [ref=e99]:
            - generic [ref=e100]:
              - heading "Sample a sound" [level=2] [ref=e101]
              - paragraph [ref=e102]: Record / review / add
            - 'img "Capture diagram: record a take, review the waveform, then add it" [ref=e103]':
              - generic [ref=e120]: REVIEW
            - generic [ref=e121]:
              - generic [ref=e122]: Record takes
              - generic [ref=e123]:
                - 'button "Setup guide: sample a sound" [ref=e124] [cursor=pointer]': Setup guide
                - button "Open sampler" [ref=e125] [cursor=pointer]: Open sampler →
          - article [ref=e126]:
            - generic [ref=e127]:
              - heading "Build a drum kit" [level=2] [ref=e128]
              - paragraph [ref=e129]: Pad map / shape / export
            - 'img "Drum kit illustration: bass drum, snare and percussion on six colorful pads" [ref=e130]'
            - generic [ref=e168]:
              - generic [ref=e169]: 24 sample slots
              - generic [ref=e170]:
                - 'button "Setup guide: build a drum kit" [ref=e171] [cursor=pointer]': Setup guide
                - button "Open kit" [ref=e172] [cursor=pointer]: Open kit →
          - article [ref=e173]:
            - generic [ref=e174]:
              - heading "Record OP-XY tracks" [level=2] [ref=e175]
              - paragraph [ref=e176]: Capture / review / export
            - 'img "Multitrack recording illustration: capture OP-XY tracks into separate audio lanes" [ref=e177]'
            - generic [ref=e202]:
              - generic [ref=e203]: Separate audio tracks
              - button "Record OP-XY tracks" [ref=e205] [cursor=pointer]: Open recorder →
        - button "External gear Open devices" [ref=e206] [cursor=pointer]:
          - generic [ref=e207]:
            - strong [ref=e208]: External gear
            - generic [ref=e209]: Connect / map / save a setup
          - generic [aria-hidden] [ref=e210]:
            - generic [ref=e211]: MIDI CC
            - generic [ref=e212]: →
            - generic [ref=e213]: Synth
            - generic [ref=e214]: →
            - generic [ref=e215]: State
          - generic [ref=e216]: Open devices →
        - generic [ref=e217]:
          - button "Open library Browse saved instruments" [ref=e218] [cursor=pointer]:
            - strong [ref=e219]: Open library
            - generic [ref=e220]: Browse saved instruments →
          - button "Back up or transfer Keep an editable project copy" [ref=e221] [cursor=pointer]:
            - strong [ref=e222]: Back up or transfer
            - generic [ref=e223]: Keep an editable project copy →
        - paragraph [ref=e224]:
          - generic [ref=e225]: Projects save locally
          - generic [ref=e226]: Transfer from the project controls
  - generic [ref=e227]:
    - generic [ref=e228]: OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.
    - generic [ref=e229]:
      - generic [ref=e230]: proudly open source
      - generic [ref=e231]: "|"
      - link "github fork" [ref=e232] [cursor=pointer]:
        - /url: https://github.com/sscommander79/op-patchstudio
      - generic [ref=e233]: "|"
      - generic [ref=e234]: v0.0.0 · build pinned
    - generic [ref=e235]:
      - text: fork maintained by sscommander79 · original project by
      - link "joseph-holland" [ref=e236] [cursor=pointer]:
        - /url: https://github.com/joseph-holland
    - generic [ref=e237]:
      - text: inspired by the awesome
      - link "opxy-drum-tool" [ref=e238] [cursor=pointer]:
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