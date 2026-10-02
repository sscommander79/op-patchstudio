import { expect, test, type Locator, type Page } from './control-audit-test';
import { mkdir, writeFile } from 'node:fs/promises';
import { expectMultisampleLoaded, gotoWorkspace } from './workspace-actions';
import { applyAudioImport } from './import-helpers';

// OP-XY LIGHT presentation regression: every route, expanded settings, dialogs and meaningful control
// states are scanned for text/icon contrast against the *effective* painted background (ancestors,
// translucent layers, gradients and opacity are composited). Hardware surfaces (black chassis, keys,
// launch artwork) are part of the approved design and are scanned against their own black backgrounds.
// Screenshots are evidence for human review only; assertions below are numeric, not visual approval.

const SHOTS = 'output/playwright/opxy-light-20260930';
const REPORT_ONLY = process.env.OPXY_LIGHT_REPORT === '1';

type Finding = { text: string; path: string; ratio: number; fg: string; bg: string; required: number; kind: 'text' | 'icon' | 'control-edge' };

// Deterministic 0.1 s, 48 kHz mono 16-bit sine; generated in memory.
function toneWav(name: string) {
  const frames = 4800, buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(48000, 24);
  buffer.writeUInt32LE(96000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index++) buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 261.63 * index / 48000) * 12000), 44 + index * 2);
  return { name, mimeType: 'audio/wav', buffer };
}

/**
 * Scan visible text and font icons inside `root` and return every element whose colour falls below
 * WCAG AA (4.5:1 text, 3:1 large text and icons) against the composited background behind it.
 * Enabled button/select/input edges must also reach 3:1 against the surface they sit on, either
 * through their border or their filled background (WCAG 1.4.11 non-text contrast).
 */
async function scanContrast(scope: Locator): Promise<Finding[]> {
  return scope.evaluate(root => {
    type RGBA = [number, number, number, number];
    const parse = (value: string): RGBA | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    // Mean of every colour stop; gradients here are near-uniform chassis/overlay fades.
    const gradientColor = (image: string): RGBA | null => {
      const stops = [...image.matchAll(/rgba?\([^)]+\)/g)].map(match => parse(match[0])!).filter(Boolean);
      if (!stops.length) return null;
      const sum = stops.reduce((acc, stop) => acc.map((value, index) => value + stop[index]) as RGBA, [0, 0, 0, 0] as RGBA);
      return sum.map(value => value / stops.length) as RGBA;
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2].map(index => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha) as RGBA;
    };
    const luminance = ([r, g, b]: RGBA) => [r, g, b].map(channel => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
      .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (a: RGBA, b: RGBA) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
    const layer = (element: Element): RGBA | null => {
      const style = getComputedStyle(element);
      const image = style.backgroundImage !== 'none' ? gradientColor(style.backgroundImage) : null;
      const color = parse(style.backgroundColor);
      const base = color && color[3] > 0 ? color : null;
      if (image && base) return over(image, base);
      return image ?? base;
    };
    // Paint order approximation: ancestors from the root down, each layer composited over the one below.
    // Absolutely positioned labels printed outside their parent (drum status text on the black tray
    // below a key) are painted over what lies behind them, not over that parent's own fill.
    const outside = (inner: DOMRect, outer: DOMRect) => { const x = inner.left + inner.width / 2, y = inner.top + inner.height / 2; return x < outer.left || x > outer.right || y < outer.top || y > outer.bottom; };
    const backgroundOf = (element: Element): RGBA => {
      const chain: Element[] = [];
      const rect = element.getBoundingClientRect();
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (node !== element && getComputedStyle(element).position === 'absolute' && outside(rect, node.getBoundingClientRect())) continue;
        chain.push(node);
      }
      let painted: RGBA = [255, 255, 255, 1];
      for (const node of chain.reverse()) {
        const own = layer(node);
        if (own) painted = over(own, painted);
      }
      return painted;
    };
    const opacityOf = (element: Element) => { let value = 1; for (let node: Element | null = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity); return value; };
    const pathOf = (element: Element) => {
      const parts: string[] = [];
      for (let node: Element | null = element; node && node !== document.body && parts.length < 5; node = node.parentElement) {
        const cls = typeof node.className === 'string' && node.className.trim() ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
        const label = node.getAttribute('aria-label');
        parts.unshift(`${node.tagName.toLowerCase()}${cls}${label ? `[aria-label="${label.slice(0, 30)}"]` : ''}`);
      }
      return parts.join(' > ');
    };
    const hex = (c: RGBA) => `rgb(${c.slice(0, 3).map(Math.round).join(',')}${c[3] < 1 ? `/${c[3].toFixed(2)}` : ''})`;
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      if (element.closest('[aria-hidden="true"]:not(i), .studio-visually-hidden, [hidden]')) return false;
      // Content of a closed <details> is not rendered (Firefox/WebKit still report a box and stale styles).
      const details = element.closest('details:not([open])');
      if (details && !element.closest('summary')) return false;
      if (style.clipPath.includes('inset(50%)') || style.clip === 'rect(0px, 0px, 0px, 0px)') return false;
      return opacityOf(element) > 0.05;
    };
    const disabled = (element: Element) => Boolean(element.closest(':disabled, [aria-disabled="true"]'));
    const findings: { text: string; path: string; ratio: number; fg: string; bg: string; required: number; kind: 'text' | 'icon' | 'control-edge' }[] = [];

    // 1. Text: elements with their own non-whitespace text node.
    const all = [root, ...root.querySelectorAll('*')];
    for (const element of all) {
      if (element.closest('svg, canvas, option, script, style, noscript')) continue;
      const own = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()).map(node => node.textContent!.trim()).join(' ');
      const isIcon = element.tagName === 'I' && /\bfa[srb]?\b|\bfa-/.test(String((element as HTMLElement).className));
      if (!own && !isIcon) continue;
      if (!visible(element) || disabled(element)) continue;
      // Native form values are painted by the control itself; the control is covered by the edge check.
      if (element instanceof HTMLTextAreaElement) continue;
      const style = getComputedStyle(element);
      const fgRaw = parse(style.color);
      if (!fgRaw) continue;
      const bg = backgroundOf(element);
      const alpha = opacityOf(element);
      const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * alpha], bg);
      const size = parseFloat(style.fontSize), weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const required = isIcon || large ? 3 : 4.5;
      const value = ratio(fg, bg);
      if (value + 0.005 < required) findings.push({ text: (own || `[icon ${String((element as HTMLElement).className).slice(0, 40)}]`).slice(0, 60), path: pathOf(element), ratio: Number(value.toFixed(2)), fg: hex(fg), bg: hex(bg), required, kind: isIcon ? 'icon' : 'text' });
    }

    // 2. Enabled control boundaries against the surface they sit on.
    // Disclosure rows (summary, role=button headers) are bounded by their ruled section; drum keys are the
    // approved black hardware and are covered by studio-appearance.spec.ts.
    for (const control of root.querySelectorAll('button, select, input:not([type="hidden"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])')) {
      if (!visible(control) || disabled(control) || control.closest('svg') || control.classList.contains('studio-drum-pad')) continue;
      const style = getComputedStyle(control);
      const surface = control.parentElement ? backgroundOf(control.parentElement) : [255, 255, 255, 1] as RGBA;
      const fill = backgroundOf(control);
      const edges = ['Top', 'Right', 'Bottom', 'Left'].filter(side => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1 && style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none')
        .map(side => parse(style.getPropertyValue(`border-${side.toLowerCase()}-color`))).filter(edge => edge && edge[3] > 0) as RGBA[];
      const edgeBest = Math.max(0, ...edges.map(edge => ratio(over(edge, surface), surface)));
      const fillRatio = ratio(fill, surface);
      // Text-only links/tabs/nav items without boundary are identified by text contrast, not by a box edge.
      const boxed = edges.length > 0 || fillRatio > 1.05;
      if (!boxed) continue;
      const best = Math.max(edgeBest, fillRatio);
      // Controls sitting inside a bordered group (segmented switches, command bars) are bounded by the group.
      if (best < 3 && !control.parentElement?.closest('.studio-view-switch, .studio-editor-command-bar, .studio-toolbar-actions, .studio-appearance-switch, .studio-cc-grid, .tab-bar, .studio-help-topics, .studio-start-grid')) {
        findings.push({ text: (control.textContent || control.getAttribute('aria-label') || '').trim().slice(0, 60), path: pathOf(control), ratio: Number(best.toFixed(2)), fg: edges[0] ? hex(edges[0]) : hex(fill), bg: hex(surface), required: 3, kind: 'control-edge' });
      }
    }
    return findings;
  });
}

async function noHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow px`).toBeLessThanOrEqual(0);
}

const allFindings: Record<string, Finding[]> = {};
async function check(page: Page, label: string, scope?: Locator) {
  // Let fades (keybed indicator, toasts) settle so a mid-transition opacity is not measured.
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))), new Promise(resolve => setTimeout(resolve, 2000))]));
  await page.waitForTimeout(100);
  const target = scope ?? page.locator('body');
  // Controls enabled by the action just taken may still be transitioning (opacity/colour); re-measure briefly.
  let findings = await scanContrast(target);
  for (let attempt = 0; findings.length && attempt < 4; attempt++) { await page.waitForTimeout(250); findings = await scanContrast(target); }
  allFindings[label] = findings;
  await page.screenshot({ path: `${SHOTS}/${label}.png`, fullPage: !scope });
  if (REPORT_ONLY) return;
  expect(findings, `${label}: low-contrast text, icons or control edges`).toEqual([]);
}

async function setLightOpxy(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('opstudio-theme', 'light'); localStorage.setItem('opstudio-appearance', 'opxy'); });
}

async function expectLightOpxy(page: Page) {
  expect(await page.evaluate(() => [document.documentElement.dataset.studioTheme, document.documentElement.dataset.studioAppearance])).toEqual(['light', 'opxy']);
}

async function expandSettings(page: Page) {
  for (const details of await page.locator('details.studio-advanced-disclosure').all()) {
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
  }
  // Collapsible sections inside preset settings are role=button headers with aria-expanded.
  for (const header of await page.locator('.studio-advanced-disclosure [role="button"][aria-expanded="false"]').all()) await header.click();
}

test.describe('OP-XY light appearance', () => {
  test.beforeAll(async () => { await mkdir(SHOTS, { recursive: true }); });
  test.afterAll(async ({ browserName: _browserName }, testInfo) => {
    if (REPORT_ONLY) await writeFile(`${SHOTS}/findings-${testInfo.project.name}-${process.pid}.json`, JSON.stringify(allFindings, null, 2));
  });

  for (const width of [390, 1440] as const) {
    test.describe(`${width}px`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await setLightOpxy(page);
      });

      test('overview, create, transfer, devices and help', async ({ page }) => {
        await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
        await expectLightOpxy(page);
        await check(page, `overview-${width}`);
        await noHorizontalOverflow(page, 'overview');

        await page.goto('/#/studio/create', { waitUntil: 'domcontentloaded' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'What would you like to make?' })).toBeVisible();
        await check(page, `create-${width}`);
        await noHorizontalOverflow(page, 'create');

        await page.getByRole('button', { name: /Multisample a synth/ }).click();
        await expect(page.getByRole('button', { name: 'Continue to setup' })).toBeVisible();
        // Selected source card (aria-pressed) is part of this state.
        await check(page, `create-source-${width}`);
        await noHorizontalOverflow(page, 'create source');
        await page.getByRole('button', { name: 'Continue to setup' }).click();
        await check(page, `create-setup-${width}`);
        await noHorizontalOverflow(page, 'create setup');

        await page.goto('/#/studio/transfer', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Back up or transfer' })).toBeVisible();
        await check(page, `transfer-${width}`);
        await noHorizontalOverflow(page, 'transfer');

        await page.goto('/#/studio/devices', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Devices', level: 1 })).toBeVisible();
        await check(page, `devices-${width}`);
        await noHorizontalOverflow(page, 'devices');

        await page.getByRole('button', { name: 'Help', exact: true }).click();
        const help = page.getByRole('dialog', { name: 'Help' });
        await expect(help).toBeVisible();
        await check(page, `dialog-help-${width}`, help);
        await noHorizontalOverflow(page, 'help');
      });

      test('drum editor: empty, demo loaded, selection, settings, dialogs', async ({ page }) => {
        await page.goto('/#/studio/drum', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('region', { name: /Drum pad instrument/ })).toBeVisible();
        await expectLightOpxy(page);
        await check(page, `drum-empty-${width}`);
        await noHorizontalOverflow(page, 'drum empty');

        await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
        await expandSettings(page);
        await check(page, `drum-loaded-settings-${width}`);
        await noHorizontalOverflow(page, 'drum loaded');
        // Disabled state stays visibly different from enabled: bulk edit needs 2+ loaded pads (enabled here).
        await expect(page.getByRole('button', { name: 'bulk edit' })).toBeEnabled();

        await page.getByRole('button', { name: 'Table', exact: true }).click();
        await check(page, `drum-table-${width}`);
        await noHorizontalOverflow(page, 'drum table');

        await page.getByRole('button', { name: 'bulk edit' }).click();
        const bulk = page.getByRole('dialog').last();
        await expect(bulk).toBeVisible();
        await check(page, `dialog-drum-bulk-${width}`, bulk);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await page.getByRole('button', { name: 'Record takes', exact: true }).first().click();
        const recorder = page.getByRole('dialog', { name: 'Record takes' });
        await expect(recorder).toBeVisible();
        await check(page, `dialog-drum-record-${width}`, recorder);
        await recorder.getByRole('button', { name: 'Close', exact: true }).click();

        await page.getByRole('button', { name: 'Export OP-XY', exact: true }).click();
        const exportDialog = page.getByRole('dialog', { name: 'Export OP-XY preset' });
        await expect(exportDialog).toBeVisible();
        for (const summary of await exportDialog.locator('details:not([open]) > summary').all()) await summary.click();
        await check(page, `dialog-export-${width}`, exportDialog);
        await noHorizontalOverflow(page, 'export dialog');
        await exportDialog.getByRole('button', { name: 'Close', exact: true }).click();

        await page.locator('details.studio-project-menu > summary').click();
        await check(page, `drum-project-menu-${width}`, page.locator('.studio-project-menu-popover'));
      });

      test('multisample editor: empty, loaded zone, MIDI panel, settings, recorder', async ({ page }) => {
        await gotoWorkspace(page, 'multisample');
        await expectLightOpxy(page);
        await check(page, `multisample-empty-${width}`);
        await noHorizontalOverflow(page, 'multisample empty');
        await page.getByRole('button', { name: 'Table', exact: true }).click();
        await expect(page.getByText('no samples loaded', { exact: true })).toBeVisible();
        await check(page, `multisample-empty-table-${width}`);
        await noHorizontalOverflow(page, 'multisample empty table');
        await page.getByRole('button', { name: 'Focus', exact: true }).click();

        await page.getByLabel('choose multisample audio files').setInputFiles(toneWav('light-C4.wav'));
        await applyAudioImport(page);
        await expectMultisampleLoaded(page, 1);
        const midi = page.getByRole('button', { name: /midi/i }).filter({ hasText: /^midi$/i });
        if (await midi.count()) {
          await check(page, `multisample-midi-closed-${width}`, midi.first());
          await midi.first().click();
          await check(page, `multisample-midi-open-${width}`, page.locator('.studio-multisample-surface'));
          await midi.first().click();
        }
        await expandSettings(page);
        await check(page, `multisample-loaded-settings-${width}`);
        await noHorizontalOverflow(page, 'multisample loaded');

        await page.getByRole('button', { name: 'Table', exact: true }).click();
        await check(page, `multisample-table-${width}`);
        await noHorizontalOverflow(page, 'multisample table');

        await page.getByRole('button', { name: 'Record takes', exact: true }).first().click();
        const recorder = page.getByRole('dialog', { name: 'Record takes' });
        await expect(recorder).toBeVisible();
        await check(page, `dialog-multisample-record-${width}`, recorder);
        await noHorizontalOverflow(page, 'recorder');
      });

      test('library: empty and saved entry with selection', async ({ page }) => {
        await page.goto('/#/studio/library', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('complementary', { name: 'Library collections' })).toBeVisible();
        await expectLightOpxy(page);
        await check(page, `library-empty-${width}`);
        await noHorizontalOverflow(page, 'library empty');

        await gotoWorkspace(page, 'drum');
        await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
        await page.locator('details.studio-project-menu > summary').click();
        await page.locator('.studio-project-menu-popover').getByRole('button', { name: 'Save to library', exact: true }).click();
        await expect(page.getByText(/saved to library|Saved/i).first()).toBeVisible();
        await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Library', exact: true }).click();
        await expect(page.getByRole('complementary', { name: 'Library collections' })).toBeVisible();
        const select = page.getByRole('checkbox', { name: /select/i }).first();
        if (await select.count()) await select.check();
        await check(page, `library-entry-${width}`);
        await noHorizontalOverflow(page, 'library entry');
      });
    });
  }

  test('1056px: loaded focus editors fit their column; bulk edit keeps heading and actions in view', async ({ page }) => {
    await page.setViewportSize({ width: 1056, height: 904 });
    await setLightOpxy(page);
    const clipped = (selector: string) => page.locator(selector).evaluateAll(elements => elements.map(element => element.scrollWidth - element.clientWidth));
    await gotoWorkspace(page, 'drum');
    await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
    for (const value of await clipped('.studio-focus, .studio-focus-main, .studio-sample-controls, .studio-assignment')) expect(value, 'drum focus overflow px').toBeLessThanOrEqual(1);
    const outPoint = page.getByLabel('Out point (seconds)');
    const [box, column] = [await outPoint.boundingBox(), await page.locator('.studio-focus').boundingBox()];
    expect(box!.x + box!.width).toBeLessThanOrEqual(column!.x + column!.width + 1);
    await check(page, 'drum-focus-1056');
    await noHorizontalOverflow(page, 'drum focus 1056');

    await page.getByRole('button', { name: 'bulk edit' }).click();
    const bulk = page.getByRole('dialog', { name: 'bulk edit samples' });
    await expect(bulk).toBeVisible();
    await expect(bulk.getByRole('heading', { name: 'bulk edit samples' })).toBeInViewport({ ratio: 1 });
    await expect(bulk.getByRole('button', { name: /apply to 10 samples/ })).toBeInViewport({ ratio: 1 });
    for (const range of await bulk.locator('input[type="range"]').all()) {
      const bounds = (await range.boundingBox())!;
      expect(bounds.height, 'bulk slider keeps a 44px target').toBeGreaterThanOrEqual(43.5);
      expect(await range.evaluate(element => getComputedStyle(element).backgroundImage), 'no painted block track').toBe('none');
    }
    await check(page, 'dialog-drum-bulk-1056', bulk);
    await bulk.getByRole('button', { name: 'cancel' }).click();
    await expect(bulk).toHaveCount(0);

    // Reloading with saved drum work offers session restoration; scan that dialog, then start fresh.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const restore = page.locator('[aria-labelledby="session-restoration-title"]');
    await expect(restore).toBeVisible();
    await check(page, 'dialog-session-restore-1056', restore);
    await restore.getByRole('button', { name: 'start new' }).click();
    await expect(restore).toHaveCount(0);
    await gotoWorkspace(page, 'multisample');
    await page.getByLabel('choose multisample audio files').setInputFiles(toneWav('focus-C4.wav'));
    await applyAudioImport(page);
    await expectMultisampleLoaded(page, 1);
    for (const value of await clipped('.studio-focus, .studio-focus-main, .studio-sample-controls')) expect(value, 'multisample focus overflow px').toBeLessThanOrEqual(1);
    await check(page, 'multisample-focus-1056');
  });

  // A native select never reports clipped option text through scrollWidth, so the selected label is
  // measured with the select's own font and compared with its content box minus the native arrow.
  const selectTextFits = (select: Locator) => select.evaluate((element: HTMLSelectElement) => {
    const style = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const longest = Math.max(...[...element.options].map(option => context.measureText(option.text).width));
    const arrow = 24;
    const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - arrow;
    return { longest: Math.ceil(longest), available: Math.floor(available), width: element.getBoundingClientRect().width };
  });

  for (const width of [390, 320] as const) {
    test(`${width}px library filters: full-width search, unclipped type and sort, visible favorites`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await setLightOpxy(page);
      await page.goto('/#/studio/library', { waitUntil: 'domcontentloaded' });
      const search = page.getByRole('searchbox', { name: 'Search presets, descriptions, and tags' });
      const type = page.getByRole('combobox', { name: 'Preset type' });
      const sort = page.getByRole('combobox', { name: 'Sort presets' });
      await expect(search).toBeVisible();
      await expect(page.getByLabel('Favorites only')).toBeVisible();
      const toolbar = (await page.getByRole('search', { name: 'Library filters' }).boundingBox())!;
      const [s, t] = [await search.boundingBox(), await type.boundingBox()];
      expect(s!.width, 'search spans the toolbar').toBeGreaterThan(toolbar.width - 2);
      expect(t!.y, 'filters sit below search').toBeGreaterThan(s!.y);
      for (const [name, select] of [['type', type], ['sort', sort]] as const) {
        const fit = await selectTextFits(select);
        expect(fit.longest, `${name} longest option fits (${JSON.stringify(fit)})`).toBeLessThanOrEqual(fit.available);
      }
      expect((await selectTextFits(sort)).width).toBeGreaterThanOrEqual(180);
      await noHorizontalOverflow(page, `library filters ${width}`);
      await check(page, `library-filters-${width}`, page.getByRole('search', { name: 'Library filters' }));
    });
  }

  test('stem recorder dialog (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setLightOpxy(page);
    await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Record OP-XY tracks' }).click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    await check(page, 'dialog-stem-1440', dialog);
  });

  test('field and dark presentations keep their own page tokens', async ({ page }) => {
    await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
    const pageColor = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.evaluate(() => { localStorage.setItem('opstudio-theme', 'light'); localStorage.setItem('opstudio-appearance', 'field'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await pageColor()).toBe('rgb(232, 231, 225)');
    await page.evaluate(() => { localStorage.setItem('opstudio-theme', 'dark'); localStorage.setItem('opstudio-appearance', 'opxy'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await pageColor()).toBe('rgb(5, 5, 5)');
  });
});
