import { expect, test, type Page } from './control-audit-test';
import { expectMultisampleLoaded, gotoWorkspace } from './workspace-actions';
import { applyAudioImport } from './import-helpers';
import { nativeControlKeys } from './keyboard-policy';

// OP-1 Field | OP-XY appearance: persistence, independence from Theme, state preservation,
// keyboard/focus, canvas repaint and narrow layout. Uses only the built-in synthetic demo kit.

const appearanceGroup = (page: Page) => page.getByRole('group', { name: 'Appearance' });
const radio = (page: Page, name: 'OP-1 Field' | 'OP-XY') => appearanceGroup(page).getByRole('radio', { name, exact: true });
const htmlAppearance = (page: Page) => page.evaluate(() => [document.documentElement.dataset.studioAppearance, document.body.dataset.studioAppearance]);

// Deterministic 0.1 s, 48 kHz mono 16-bit sine at C4; generated in memory, no hardware or recorded audio.
function toneWav(name: string) {
  const frames = 4800, buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(48000, 24);
  buffer.writeUInt32LE(96000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index++) buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 261.63 * index / 48000) * 12000), 44 + index * 2);
  return { name, mimeType: 'audio/wav', buffer };
}

// WCAG contrast of a computed SVG fill/stroke against the black artwork screen it is drawn on.
async function contrastOnScreen(page: Page, selector: string, property: 'fill' | 'stroke') {
  return page.locator(selector).first().evaluate((element, key) => {
    const svg = element.closest('svg')!;
    const screen = svg.querySelector('.studio-opxy-art-screen')!;
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = ([r, g, b]: number[]) => [r, g, b].map(channel => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
    const fg = luminance(rgb(getComputedStyle(element)[key as 'fill']));
    const bg = luminance(rgb(getComputedStyle(screen).fill));
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  }, property);
}

// Rendered line count of an element, used to catch a brand squeezed onto several lines.
const lineCount = (page: Page, selector: string) => page.locator(selector).first().evaluate(element => {
  const style = getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  return Math.round(element.getBoundingClientRect().height / lineHeight);
});

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('studio appearance', () => {
  test('defaults to Field, persists OP-XY across reload, and falls back for an invalid value', async ({ page }) => {
    await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
    await expect(appearanceGroup(page).getByRole('radio')).toHaveCount(2);
    await expect(radio(page, 'OP-1 Field')).toBeChecked();
    expect(await htmlAppearance(page)).toEqual(['field', 'field']);
    await expect(page.locator('[data-appearance-art="opxy"]')).toHaveCount(0);
    await expect(page.locator('[data-launch-diagram="pad-map"] [data-percussion]')).toHaveCount(6);
    await expect(page.getByRole('tablist')).toHaveCount(0);

    await radio(page, 'OP-XY').check();
    expect(await htmlAppearance(page)).toEqual(['opxy', 'opxy']);
    await expect(page.locator('.studio-launch [data-appearance-art="opxy"]')).toHaveCount(4);
    expect(await page.evaluate(() => localStorage.getItem('opstudio-appearance'))).toBe('opxy');
    expect(await page.evaluate(() => localStorage.getItem('opstudio-theme'))).toBeNull();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(radio(page, 'OP-XY')).toBeChecked();
    expect(await htmlAppearance(page)).toEqual(['opxy', 'opxy']);

    await page.evaluate(() => localStorage.setItem('opstudio-appearance', 'purple'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(radio(page, 'OP-1 Field')).toBeChecked();
    expect(await htmlAppearance(page)).toEqual(['field', 'field']);
  });

  // Throws only for the presentation keys: other, pre-existing app storage readers are outside this feature.
  test('blocked presentation storage still renders and switches in memory', async ({ page }) => {
    await page.addInitScript(() => {
      const keys = new Set(['opstudio-appearance', 'opstudio-theme']);
      const { getItem, setItem } = Storage.prototype;
      Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, value(this: Storage, key: string) { if (keys.has(key)) throw new DOMException('blocked', 'SecurityError'); return getItem.call(this, key); } });
      Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value(this: Storage, key: string, value: string) { if (keys.has(key)) throw new DOMException('blocked', 'SecurityError'); return setItem.call(this, key, value); } });
    });
    await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
    await expect(radio(page, 'OP-1 Field')).toBeChecked();
    await radio(page, 'OP-XY').check();
    await expect(radio(page, 'OP-XY')).toBeChecked();
    expect(await htmlAppearance(page)).toEqual(['opxy', 'opxy']);
  });

  test('Theme and Appearance are independent in both directions', async ({ page }) => {
    await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
    const theme = page.getByRole('combobox', { name: 'Theme' });
    await theme.selectOption('light');
    await radio(page, 'OP-XY').check();
    await expect(theme).toHaveValue('light');
    expect(await page.evaluate(() => document.documentElement.dataset.studioTheme)).toBe('light');
    const lightPage = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await theme.selectOption('dark');
    await expect(radio(page, 'OP-XY')).toBeChecked();
    expect(await page.evaluate(() => [document.documentElement.dataset.studioTheme, document.documentElement.dataset.studioAppearance])).toEqual(['dark', 'opxy']);
    const darkPage = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkPage).not.toBe(lightPage);
    expect(await page.evaluate(() => [localStorage.getItem('opstudio-theme'), localStorage.getItem('opstudio-appearance')])).toEqual(['dark', 'opxy']);

    // The hardware gear strip is a black chassis in both brightness schemes.
    for (const scheme of ['light', 'dark'] as const) {
      await theme.selectOption(scheme);
      const luminance = await page.locator('.studio-launch-gear').evaluate(element => {
        const style = getComputedStyle(element);
        const source = style.backgroundImage !== 'none' ? style.backgroundImage : style.backgroundColor;
        const [r, g, b] = (source.match(/\d+(\.\d+)?/g) ?? ['255', '255', '255']).slice(0, 3).map(Number);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      });
      expect(luminance, `${scheme} gear strip`).toBeLessThan(0.15);
    }
  });

  test('switching with an edited demo kit keeps route, samples, edits, undo and focus', async ({ page }) => {
    await gotoWorkspace(page, 'drum');
    await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
    const loaded = page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' });
    await expect(loaded).toBeVisible();
    await page.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reverse', exact: true })).toBeVisible();
    const url = page.url();

    await radio(page, 'OP-1 Field').focus();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'OP-XY')).toBeChecked();
    await expect(radio(page, 'OP-XY')).toBeFocused();
    expect(await htmlAppearance(page)).toEqual(['opxy', 'opxy']);

    expect(page.url()).toBe(url);
    await expect(loaded).toBeVisible();
    await expect(page.getByLabel('Instrument name')).toHaveValue('Studio Seed');
    await expect(page.getByRole('button', { name: 'Reverse', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Loaded and selected pads keep text states; OP-XY adds a square marker, not a colour-only cue.
    const selected = page.locator('.studio-drum-pad[aria-current="true"]').first();
    await expect(selected).toBeVisible();
    // The existing design prints SELECTED everywhere except narrow phone lower-row keys, which keep LOADED
    // and rely on aria-current plus the key treatment. Assert exactly that rule, not a blanket label.
    const compactLowerKey = await selected.evaluate(element => Boolean(element.closest('.studio-mobile-pad-grid .studio-pad-row--lower')));
    await expect(selected.locator('.studio-drum-pad-status')).toHaveText(compactLowerKey ? 'LOADED' : 'SELECTED');
    // OP-XY selection is an inverted key with an inset ring, in every row and width.
    expect(await selected.evaluate(element => getComputedStyle(element).boxShadow)).toContain('inset');
    const selectedLuminance = () => selected.evaluate(element => {
      const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const lum = (value: string) => { const [r, g, b] = rgb(value); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
      const image = getComputedStyle(element).backgroundImage;
      const key = image !== 'none' ? image : getComputedStyle(element).backgroundColor;
      return [lum(key), lum(getComputedStyle(element.querySelector('.studio-drum-pad-name')!).color)];
    });
    // Wait for the existing key-colour transition to settle before measuring contrast.
    await expect.poll(async () => (await selectedLuminance())[0]).toBeGreaterThan(0.7);
    await expect.poll(async () => (await selectedLuminance())[1]).toBeLessThan(0.2);
    const loadedPad = page.locator('.studio-drum-pad[data-pad-state="loaded"]:not([aria-current])').first();
    expect(await loadedPad.evaluate(element => getComputedStyle(element, '::after').borderRadius)).toBe('0px');
    const selectedBg = await selected.evaluate(element => getComputedStyle(element).backgroundImage + getComputedStyle(element).backgroundColor);
    const loadedBg = await loadedPad.evaluate(element => getComputedStyle(element).backgroundImage + getComputedStyle(element).backgroundColor);
    expect(selectedBg).not.toBe(loadedBg);

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Forward', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Drum pad instrument, 0 of 24 loaded' })).toBeVisible();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(loaded).toBeVisible();

    await radio(page, 'OP-XY').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(radio(page, 'OP-1 Field')).toBeChecked();
    await expect(radio(page, 'OP-1 Field')).toBeFocused();
    await expect(loaded).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('waveform canvases repaint with the new appearance tokens', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('opstudio-theme', 'dark'));
    await gotoWorkspace(page, 'drum');
    await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
    const canvas = page.locator('.studio-focus-main canvas').first();
    await expect(canvas).toBeVisible();
    const cornerPixel = () => canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d')!;
      const x = Math.floor(element.width / 2), y = 1;
      return Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
    });
    const panelRgb = () => page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--studio-panel');
      document.body.append(probe);
      const rgb = getComputedStyle(probe).color.match(/\d+/g)!.slice(0, 3).map(Number);
      probe.remove();
      return rgb;
    });
    const near = (a: number[], b: number[]) => a.every((value, index) => Math.abs(value - b[index]) <= 3);

    await expect.poll(async () => near(await cornerPixel(), await panelRgb())).toBe(true);
    const fieldPixel = await cornerPixel();
    await radio(page, 'OP-XY').check();
    await expect.poll(async () => near(await cornerPixel(), await panelRgb())).toBe(true);
    expect(await cornerPixel()).not.toEqual(fieldPixel);
  });

  test('keyboard: one tab stop, arrows select, focus ring visible, 44px targets', async ({ page, context }) => {
    // WebKit's platform policy can keep plain Tab off buttons and radios; calibrate on independent native HTML.
    const { forward, backward } = await nativeControlKeys(context);
    await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
    const theme = page.getByRole('combobox', { name: 'Theme' });
    // Entry from the preceding control lands on the checked radio only.
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Devices', exact: true }).focus();
    await page.keyboard.press(forward);
    await expect(radio(page, 'OP-1 Field')).toBeFocused();
    // Exit forward skips the unchecked radio.
    await page.keyboard.press(forward);
    await expect(radio(page, 'OP-XY')).not.toBeFocused();
    await expect(theme).toBeFocused();
    // Backward re-entry returns to the checked radio.
    await page.keyboard.press(backward);
    await expect(radio(page, 'OP-1 Field')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'OP-XY')).toBeChecked();
    await expect(radio(page, 'OP-XY')).toBeFocused();
    const choice = page.locator('.studio-appearance-choice:has(input[value="opxy"])');
    expect(await choice.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
    // 44 CSS px; allow only layout-engine float rounding (Firefox reports 43.999996).
    for (const label of await page.locator('.studio-appearance-choice').all()) {
      const bounds = (await label.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44 - 0.01);
      expect(bounds.height).toBeGreaterThanOrEqual(44 - 0.01);
    }
    // Checked state is also shown by weight, not colour alone.
    const weights = await page.locator('.studio-appearance-choice').evaluateAll(elements => elements.map(element => Number(getComputedStyle(element).fontWeight)));
    expect(weights[1]).toBeGreaterThan(weights[0]);
    // Backward exit from the group then reverse selection with the other arrow.
    await page.keyboard.press(backward);
    await expect(radio(page, 'OP-XY')).not.toBeFocused();
    await expect(radio(page, 'OP-1 Field')).not.toBeFocused();
    await page.keyboard.press(forward);
    await expect(radio(page, 'OP-XY')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(radio(page, 'OP-1 Field')).toBeChecked();
    await expect(radio(page, 'OP-1 Field')).toBeFocused();
    const fieldChoice = page.locator('.studio-appearance-choice:has(input[value="field"])');
    expect(await fieldChoice.evaluate(element => getComputedStyle(element).outlineStyle), 'ring after reverse arrow').not.toBe('none');
    // Pointer selection does not leave a keyboard focus ring behind.
    await page.locator('.studio-appearance-choice:has(input[value="opxy"])').click();
    await expect(radio(page, 'OP-XY')).toBeChecked();
    expect(await page.locator('.studio-appearance-choice:has(input[value="opxy"])').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none');
  });

  test('multisample: switching keeps the imported zone, a root-note edit and its undo', async ({ page }) => {
    await gotoWorkspace(page, 'multisample');
    await page.getByLabel('choose multisample audio files').setInputFiles(toneWav('appearance-C4.wav'));
    await applyAudioImport(page);
    await expectMultisampleLoaded(page, 1);
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    const root = page.getByPlaceholder('C4 or 60').first();
    await expect(root).toBeVisible();
    const original = await root.inputValue();
    await root.fill('64');
    await root.press('Enter');
    await expect(root).not.toHaveValue(original);
    const edited = await root.inputValue();
    const url = page.url();

    await radio(page, 'OP-XY').check();
    expect(await htmlAppearance(page)).toEqual(['opxy', 'opxy']);
    expect(page.url()).toBe(url);
    await expectMultisampleLoaded(page, 1);
    await expect(root).toHaveValue(edited);
    await expect(page.getByText('appearance-C4.wav', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(root).toHaveValue(original);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(root).toHaveValue(edited);

    await radio(page, 'OP-1 Field').check();
    await expect(root).toHaveValue(edited);
    await expectMultisampleLoaded(page, 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(root).toHaveValue(original);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`OP-XY launch artwork labels and useful outlines stay legible on black (${scheme})`, async ({ page }) => {
      await page.addInitScript(value => { localStorage.setItem('opstudio-theme', value); localStorage.setItem('opstudio-appearance', 'opxy'); }, scheme);
      await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.studio-launch [data-appearance-art="opxy"]')).toHaveCount(4);
      for (const selector of ['.studio-opxy-art-label', '.studio-opxy-art-lane-number']) {
        expect(await contrastOnScreen(page, selector, 'fill'), `${selector} text`).toBeGreaterThanOrEqual(4.5);
      }
      for (const selector of ['.studio-opxy-art-zone--empty', '.studio-opxy-art-pad--empty', '.studio-opxy-art-pad--loaded', '.studio-opxy-art-trim']) {
        expect(await contrastOnScreen(page, selector, 'stroke'), `${selector} outline`).toBeGreaterThanOrEqual(3);
      }
      expect(await contrastOnScreen(page, '.studio-opxy-art-clip', 'fill'), 'track clips').toBeGreaterThanOrEqual(3);
    });
  }

  for (const width of [390, 834, 1024, 1280, 1440]) {
    test(`header brand and settings stay readable at ${width}px in both appearances`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const appearance of ['field', 'opxy'] as const) {
        await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
        await page.evaluate(value => localStorage.setItem('opstudio-appearance', value), appearance);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(radio(page, appearance === 'field' ? 'OP-1 Field' : 'OP-XY')).toBeChecked();
        expect(await lineCount(page, '.studio-shell-brand strong'), `${appearance} brand name`).toBe(1);
        if (await page.locator('.studio-shell-brand small').isVisible()) expect(await lineCount(page, '.studio-shell-brand small'), `${appearance} tagline`).toBe(1);
        for (const label of await appearanceGroup(page).locator('.studio-appearance-label').all()) {
          await expect(label).toBeVisible();
          expect(await label.evaluate(element => element.getClientRects().length), 'appearance label on one line').toBe(1);
        }
        const nav = await page.getByRole('navigation', { name: 'Workspace' }).boundingBox();
        const brand = await page.locator('.studio-shell-brand').boundingBox();
        const group = await appearanceGroup(page).boundingBox();
        const overlap = (a: typeof nav, b: typeof nav) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap(brand, group) || overlap(nav, group) || overlap(brand, nav)).toBe(false);
        await noHorizontalOverflow(page);
      }
    });
  }

  for (const width of [1440, 390]) {
    test(`OP-XY screens render without horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => localStorage.setItem('opstudio-appearance', 'opxy'));
      await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
      await expect(appearanceGroup(page).getByText('OP-1 Field')).toBeVisible();
      await expect(appearanceGroup(page).getByText('OP-XY')).toBeVisible();
      await noHorizontalOverflow(page);
      for (const route of ['library', 'transfer', 'devices', 'drum', 'multisample']) {
        await page.goto(`/#/studio/${route}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.studio-shell-content h1').first()).toBeAttached();
        await page.waitForLoadState('networkidle');
        await noHorizontalOverflow(page);
        expect(await htmlAppearance(page)).toEqual(['opxy', 'opxy']);
      }
      await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      const help = page.getByRole('dialog', { name: 'Help' });
      await expect(help).toBeVisible();
      const [fg, bg] = await help.evaluate(element => [getComputedStyle(element).color, getComputedStyle(element).backgroundColor]);
      expect(fg).not.toBe(bg);
      await noHorizontalOverflow(page);
    });
  }
});
