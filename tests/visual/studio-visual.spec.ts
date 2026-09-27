import { expect, test, type Page } from '@playwright/test';

// Reviewed pixel baselines. Update only with `npm run test:visual -- --update-snapshots` after a person
// has compared the new images with the approved references and recorded the review
// (docs/design-system/studio-launch-contract.md, "Changing a baseline").

test.skip(process.platform !== 'darwin' && process.env.OPSTUDIO_VISUAL !== '1',
  'Baselines are recorded on macOS Chromium; other platforms need their own reviewed baselines.');

const viewports = { desktop: { width: 1440, height: 1000 }, narrow: { width: 390, height: 844 } } as const;

// The footer build marker holds a per-server-start id in a proportional font, so its width varies.
// Its text is pinned before capture (the build marker itself is asserted in the design contract).
const stable = async (page: Page) => {
  await page.locator('footer [data-opstudio-build]').evaluate(element => { element.textContent = 'v0.0.0 · build pinned'; });
  return { fullPage: true };
};

for (const scheme of ['light', 'dark'] as const) {
  for (const [size, viewport] of Object.entries(viewports)) {
    test.describe(`${size} ${scheme}`, () => {
      test.use({ viewport, colorScheme: scheme });

      test('launch', async ({ page }) => {
        await page.goto('/#/studio/overview', { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-studio-theme', scheme);
        await expect(page.getByRole('region', { name: 'What are you working on?' })).toBeVisible();
        await expect(page).toHaveScreenshot(`launch-${size}-${scheme}.png`, await stable(page));
      });

      test('empty drum workbench', async ({ page }) => {
        await page.goto('/#/studio/drum', { waitUntil: 'networkidle' });
        await expect(page.getByRole('region', { name: 'Drum pad instrument, 0 of 24 loaded' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load demo kit', exact: true })).toBeVisible();
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await expect(page).toHaveScreenshot(`drum-empty-${size}-${scheme}.png`, await stable(page));
      });

      test('drum workbench with the Studio Seed kit', async ({ page }) => {
        await page.goto('/#/studio/drum', { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
        // The load notification auto-dismisses after five seconds; wait so it is never recorded.
        await expect(page.getByText('Studio Seed loaded')).toBeHidden({ timeout: 10_000 });
        // Studio Seed selects its first voice; blur so no transient focus ring is recorded.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await expect(page).toHaveScreenshot(`drum-${size}-${scheme}.png`, await stable(page));
      });
    });
  }
}
