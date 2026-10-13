import { expect, test, type Locator, type Page } from './control-audit-test';
import { gotoWorkspace, openAdvanced } from './workspace-actions';

// Regression for the 2026-10-07 visual review (high 1-3): multisample envelope/filter settings and the
// drum bulk-edit primary action lost their text, curve and state in dark themes. Every ratio below is
// read from computed styles in a real browser and composited over the painted ancestors; nothing is
// asserted about pixel positions or sizes.

type Mode = 'text' | 'stroke' | 'fill' | 'surface' | 'knob';

/**
 * WCAG contrast ratio for one element.
 *   text    - its text colour against the background painted behind it (own fill included)
 *   stroke  - its SVG stroke against the background behind the drawing
 *   fill    - its SVG fill against the background behind the drawing
 *   surface - its own background against the surface of its parent (does a filled control stand out?)
 *   knob    - its ::before background against its own background (Carbon toggle knob on its track)
 */
async function contrast(target: Locator, mode: Mode): Promise<number> {
  return target.evaluate((element, mode) => {
    type RGBA = [number, number, number, number];
    const parse = (value: string): RGBA => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) throw new Error(`Unparsed colour "${value}"`);
      const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2].map(index => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha) as RGBA;
    };
    const luminance = ([r, g, b]: RGBA) => [r, g, b].map(channel => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
      .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (a: RGBA, b: RGBA) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
    // Ancestors from the document root down, each background composited over the one below.
    const painted = (from: Element | null): RGBA => {
      const chain: Element[] = [];
      for (let node = from; node; node = node.parentElement) chain.push(node);
      let result: RGBA = [255, 255, 255, 1];
      for (const node of chain.reverse()) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) result = over(color, result);
      }
      return result;
    };
    const opacity = (from: Element | null) => { let value = 1; for (let node = from; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity); return value; };
    const style = getComputedStyle(element);
    if (mode === 'surface') return ratio(painted(element), painted(element.parentElement));
    if (mode === 'knob') return ratio(over(parse(getComputedStyle(element, '::before').backgroundColor), painted(element)), painted(element));
    const behind = mode === 'text' ? painted(element) : painted(element.parentElement);
    const raw = parse(mode === 'text' ? style.color : mode === 'stroke' ? style.stroke : style.fill);
    return ratio(over([raw[0], raw[1], raw[2], raw[3] * opacity(element)], behind), behind);
  }, mode);
}

// Colour transitions (0.2 s) may still be running right after a click, so ratios are polled until they settle.
const expectContrast = (target: Locator, mode: Mode, minimum: number, label: string) =>
  expect.poll(() => contrast(target, mode), { message: `${label}: ${mode} contrast` }).toBeGreaterThanOrEqual(minimum);

async function uiReady(page: Page, appearance: string, theme: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.evaluate(() => [document.documentElement.dataset.studioAppearance, document.documentElement.dataset.studioTheme])).toEqual([appearance, theme]);
}

for (const appearance of ['field', 'opxy'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    const name = `${appearance} ${theme}`;
    test.describe(name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.addInitScript(([storedAppearance, storedTheme]) => { localStorage.setItem('opstudio-theme', storedTheme); localStorage.setItem('opstudio-appearance', storedAppearance); }, [appearance, theme]);
      });

      test('multisample envelope, filter note and loop toggles stay legible and show their state', async ({ page }) => {
        await gotoWorkspace(page, 'multisample');
        await uiReady(page, appearance, theme);
        const settings = await openAdvanced(page, /Preset and performance settings/);

        // High 1: the oversized "coming soon" slab is gone; one honest line of readable text remains.
        await expect(settings.getByText('coming soon')).toHaveCount(0);
        const note = settings.locator('[data-filter-note]');
        await expect(note).toContainText('filter envelopes are saved in the exported preset');
        await expectContrast(note, 'text', 4.5, 'filter note');

        // High 2: amp/filter selector. Both labels are readable; the active one is also bolder, so the
        // edited envelope is identified by more than a shade of gray.
        const envelopeSwitch = settings.getByRole('switch', { name: 'Edit filter envelope', exact: true });
        const label = (which: 'amp' | 'filter') => settings.locator(`[data-envelope-label="${which}"]`);
        const weight = (which: 'amp' | 'filter') => label(which).evaluate(element => Number(getComputedStyle(element).fontWeight));
        const curve = settings.locator('[data-envelope-curve="active"]');
        for (const [active, inactive, checked] of [['amp', 'filter', 'false'], ['filter', 'amp', 'true']] as const) {
          await expect(envelopeSwitch).toHaveAttribute('aria-checked', checked);
          await expect(label(active)).toHaveAttribute('data-active', 'true');
          await expect(label(inactive)).toHaveAttribute('data-active', 'false');
          await expectContrast(label(active), 'text', 4.5, `${active} label (active)`);
          await expectContrast(label(inactive), 'text', 4.5, `${inactive} label (inactive)`);
          expect(await weight(active), `${active} label is emphasised while active`).toBeGreaterThan(await weight(inactive));
          await expectContrast(curve, 'stroke', 3, `${active} envelope curve`);
          await expectContrast(settings.locator('.adsr-envelope-container svg text', { hasText: active }), 'fill', 4.5, `${active} curve label`);
          await expectContrast(envelopeSwitch, 'surface', 3, 'envelope switch track');
          await expectContrast(envelopeSwitch.locator('[data-switch-knob]'), 'surface', 3, 'envelope switch knob');
          if (active === 'amp') await envelopeSwitch.click();
        }

        // High 2: loop toggles keep a visible track and knob in both states, with readable state text.
        for (const id of ['multisample-loop-enabled', 'multisample-loop-onrelease']) {
          const toggle = settings.locator(`#${id}`), toggleLabel = settings.locator(`#${id}_label`);
          const track = toggleLabel.locator('.cds--toggle__switch'), text = toggleLabel.locator('.cds--toggle__text');
          for (const state of ['true', 'false'] as const) {
            await expect(toggle).toHaveAttribute('aria-checked', state);
            await expect(text).toHaveText(state === 'true' ? 'on' : 'off');
            await expectContrast(text, 'text', 4.5, `${id} ${state} text`);
            await expectContrast(track, 'surface', 3, `${id} ${state} track`);
            await expectContrast(track, 'knob', 3, `${id} ${state} knob`);
            if (state === 'true') await toggleLabel.click();
          }
        }
      });

      test('drum bulk edit: the enabled Apply action reads as enabled', async ({ page }) => {
        await gotoWorkspace(page, 'drum');
        await uiReady(page, appearance, theme);
        await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
        await page.getByRole('button', { name: 'Edit multiple sounds', exact: true }).click();
        const bulk = page.getByRole('dialog', { name: 'Bulk edit samples', exact: true });
        await expect(bulk).toBeVisible();

        // High 3: label on its own fill, and the fill against the dialog footer it sits on.
        const apply = bulk.getByRole('button', { name: 'Apply to 10 samples', exact: true });
        await expect(apply).toBeEnabled();
        await expectContrast(apply, 'text', 4.5, 'Apply label');
        await expectContrast(apply, 'surface', 3, 'Apply fill');
        await expectContrast(bulk.getByRole('button', { name: 'Cancel', exact: true }), 'text', 4.5, 'Cancel label');
      });
    });
  }
}
