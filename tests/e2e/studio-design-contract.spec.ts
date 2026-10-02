import {nativeControlKeys} from './keyboard-policy';
import { expect, test, type Locator, type Page } from './control-audit-test';

// Semantic and layout contract for the unified launch surface and the drum workbench.
// These assertions are independent of the pixel baselines in tests/visual, so a re-recorded
// screenshot cannot approve a structural regression. See docs/design-system/studio-launch-contract.md.

const production = process.env.PLAYWRIGHT_PRODUCTION === '1';

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds, 'element should be rendered').not.toBeNull();
  return bounds!;
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Resolves a CSS colour expression to the browser's computed rgb() string for comparison.
async function resolveColor(page: Page, value: string) {
  return page.evaluate(color => {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, value);
}

// WCAG contrast ratio between an element's text colour and the solid background of `backgroundOf`.
async function contrast(foreground: Locator, backgroundOf: Locator, property: 'color' | 'fill' = 'color') {
  const channels = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  const luminance = ([r, g, b]: number[]) => {
    const [lr, lg, lb] = [r, g, b].map(channel => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };
  const fg = luminance(channels(await foreground.evaluate((element, key) => getComputedStyle(element)[key as 'color'], property)));
  const bg = luminance(channels(await backgroundOf.evaluate(element => getComputedStyle(element).backgroundColor)));
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

async function openLaunch(page: Page) {
  await page.goto('/#/studio/overview', { waitUntil: 'domcontentloaded' });
  const launch = page.getByRole('region', { name: 'What are you working on?' });
  await expect(launch).toBeVisible();
  return launch;
}

test.describe('unified launch surface', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop contract; the narrow contract below covers small screens.');

  test('desktop: one horizontal header, one launch row, gear strip, then secondary shortcuts', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const launch = await openLaunch(page);

    await expect(page.locator('.studio-shell-brand')).toHaveCount(1);
    await expect(page.locator('.studio-shell-sidebar, .studio-app-header')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(1);
    const primary = page.getByRole('navigation', { name: 'Workspace' }).getByRole('button');
    await expect(primary).toHaveText(['Overview', 'Library', 'Transfer', 'Devices']);
    const primaryTops = await primary.evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)));
    expect(new Set(primaryTops).size).toBe(1);
    await expect(page.getByRole('navigation', { name: 'Tools' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(['What are you working on?']);

    const modules = launch.getByRole('article');
    await expect(modules).toHaveCount(4);
    await expect(modules.getByRole('heading', { level: 2 })).toHaveText(['Multisample a synth', 'Sample a sound', 'Build a drum kit', 'Record OP-XY tracks']);
    const moduleBoxes = await Promise.all([0, 1, 2, 3].map(index => box(modules.nth(index))));
    for (const bounds of moduleBoxes) {
      expect(Math.abs(bounds.y - moduleBoxes[0].y)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds.width - moduleBoxes[0].width)).toBeLessThanOrEqual(4);
      expect(Math.abs(bounds.height - moduleBoxes[0].height)).toBeLessThanOrEqual(2);
    }
    for (const [index, kind] of ['note-range', 'capture', 'pad-map', 'tracks'].entries()) {
      const diagram = modules.nth(index).locator(`[data-launch-diagram="${kind}"]`);
      await expect(diagram).toHaveAttribute('role', 'img');
      const bounds = await box(diagram);
      expect(bounds.height, `${kind} diagram height`).toBeGreaterThanOrEqual(96);
      expect(bounds.height / moduleBoxes[index].height, `${kind} diagram share of module`).toBeGreaterThanOrEqual(0.3);
      expect(bounds.width / moduleBoxes[index].width, `${kind} diagram width`).toBeGreaterThanOrEqual(0.85);
    }
    await expect(modules.nth(0).locator('[data-zone]')).toHaveCount(24);
    await expect(modules.nth(2).locator('[data-pad-illustration]')).toHaveCount(6);
    const padPositions = await modules.nth(2).locator('.studio-launch-pad').evaluateAll(pads => pads.map(pad => ({ x: pad.getAttribute('x'), y: pad.getAttribute('y') })));
    expect(new Set(padPositions.map(pad => pad.x)).size).toBe(3);
    expect(new Set(padPositions.map(pad => pad.y)).size).toBe(2);
    const padDiagram = await box(modules.nth(2).locator('[data-launch-diagram="pad-map"]'));
    const firstPad = await box(modules.nth(2).locator('.studio-launch-pad').first());
    const lastPad = await box(modules.nth(2).locator('.studio-launch-pad').last());
    expect(Math.abs(firstPad.x - padDiagram.x)).toBeLessThan(1);
    expect((lastPad.x + lastPad.width - firstPad.x) / padDiagram.width).toBeGreaterThan(0.95);
    const padHeading = await box(modules.nth(2).locator('.studio-launch-module-heading'));
    expect(Math.abs(firstPad.x - padHeading.x)).toBeLessThan(1);
    await expect(modules.nth(2).locator('[data-percussion]')).toHaveCount(6);
    const capture = modules.nth(1);
    const marker = await box(capture.locator('.studio-launch-diagram-marker'));
    const bars = capture.locator('.studio-launch-diagram-wave rect');
    const tail = await box(bars.nth(12));
    expect(marker.x).toBeGreaterThanOrEqual(tail.x);
    expect(marker.x).toBeLessThanOrEqual(tail.x + tail.width);

    const gear = launch.getByRole('button', { name: 'External gear Open devices' });
    const gearBox = await box(gear);
    const row = { left: moduleBoxes[0].x, right: moduleBoxes[3].x + moduleBoxes[3].width, bottom: moduleBoxes[0].y + moduleBoxes[0].height };
    expect(gearBox.y).toBeGreaterThan(row.bottom);
    expect(Math.abs(gearBox.x - row.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(gearBox.x + gearBox.width - row.right)).toBeLessThanOrEqual(2);
    expect(gearBox.height).toBeLessThan(moduleBoxes[0].height);
    const gearLuminance = await gear.evaluate(element => {
      const [r, g, b] = getComputedStyle(element).backgroundColor.match(/\d+/g)!.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
    expect(gearLuminance, 'External gear is a dark strip').toBeLessThan(0.15);

    const library = launch.getByRole('button', { name: 'Open library Browse saved instruments' });
    const transfer = launch.getByRole('button', { name: 'Back up or transfer Keep an editable project copy' });
    const [libraryBox, transferBox] = [await box(library), await box(transfer)];
    expect(libraryBox.y).toBeGreaterThan(gearBox.y + gearBox.height);
    expect(Math.abs(libraryBox.y - transferBox.y)).toBeLessThanOrEqual(2);
    expect(libraryBox.height).toBeLessThan(gearBox.height);

    // Compact: the whole launch surface fits in one 1440×1000 desktop viewport.
    const launchBox = await box(launch);
    expect(launchBox.y + launchBox.height).toBeLessThanOrEqual(1000);
    await noHorizontalOverflow(page);
  });

  test('keyboard order follows the launch hierarchy and every target is operable', async ({ page }) => {
    const {forward,backward}=await nativeControlKeys(page.context());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openLaunch(page);
    await expect(page.getByRole('heading', { level: 1, name: 'What are you working on?' })).toBeFocused();
    const launch = page.getByRole('region', { name: 'What are you working on?' });
    const order = [
      'Setup guide: multisample a synth', 'Open capture',
      'Setup guide: sample a sound', 'Open sampler',
      'Setup guide: build a drum kit', 'Open kit',
      'Record OP-XY tracks',
      'External gear Open devices',
      'Open library Browse saved instruments', 'Back up or transfer Keep an editable project copy',
    ];
    for (const name of order) {
      await page.keyboard.press(forward);
      await expect(launch.getByRole('button', { name, exact: true })).toBeFocused();
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
      expect(outline, `${name} shows a focus outline`).not.toBe('none');
    }
    await page.keyboard.press(backward);
    await page.keyboard.press(backward);
    await page.keyboard.press(backward);
    await page.keyboard.press(backward);
    await expect(page.getByRole('button', { name: 'Open kit', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/studio\/drum$/);
    await expect(page.getByRole('group', { name: 'Drum keyboard', exact: true })).toBeVisible();
  });

  test('task calls to action open their tools directly; setup guidance stays optional', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const launch = await openLaunch(page);

    await launch.getByRole('button', { name: 'Open kit', exact: true }).click();
    await expect(page).toHaveURL(/#\/studio\/drum$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Drum kit editor' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Build your kit' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const guide = page.getByRole('group', { name: 'Kit setup guide' });
    await expect(guide).toBeVisible();
    await guide.locator('summary').click();
    await expect(guide.getByText('Select a browser audio input in Record takes.')).toBeVisible();

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
    await launch.getByRole('button', { name: 'Open capture', exact: true }).click();
    const recorder = page.getByRole('dialog', { name: 'Record takes' });
    await expect(recorder).toBeVisible();
    await expect(recorder.getByText('Guided automatic multisampling')).toBeVisible();
    await recorder.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page).toHaveURL(/#\/studio\/multisample$/);

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
    await launch.getByRole('button', { name: 'Open sampler', exact: true }).click();
    await expect(recorder).toBeVisible();
    await expect(recorder.getByLabel('Capture mode')).toBeFocused();
    await expect(recorder.getByText('Guided automatic multisampling')).toHaveCount(0);
    await recorder.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
    await launch.getByRole('button', { name: 'Setup guide: build a drum kit' }).click();
    await expect(page).toHaveURL(/#\/studio\/create$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Build your kit' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
    await launch.getByRole('button', { name: 'External gear Open devices' }).click();
    await expect(page).toHaveURL(/#\/studio\/devices$/);
    await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();

    await page.goto('/#/studio/create', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'What would you like to make?' })).toBeVisible();
    await expect(page.locator('[data-launch-diagram]')).toHaveCount(0);
  });

  test('semantic colour: neutral actions, cyan loaded, orange selected, red destructive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const launch = await openLaunch(page);
    const cyan = await resolveColor(page, 'var(--studio-system-cyan)');
    const orange = await resolveColor(page, 'var(--studio-system-orange)');
    const red = await resolveColor(page, 'var(--studio-system-red)');
    const background = (locator: Locator) => locator.evaluate(element => getComputedStyle(element).backgroundColor);

    for (const name of ['Open capture', 'Open sampler', 'Open kit']) {
      expect(await background(launch.getByRole('button', { name, exact: true }))).not.toBe(cyan);
    }
    await launch.getByRole('button', { name: 'Open kit', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Drum keyboard', exact: true })).toBeVisible();
    expect(await background(page.getByRole('button', { name: 'Export OP-XY', exact: true }))).not.toBe(cyan);
    expect(await background(page.getByRole('button', { name: 'Load demo kit', exact: true }))).not.toBe(cyan);
    expect(await background(page.getByRole('button', { name: 'Focus', exact: true }))).not.toBe(cyan);
    expect(await background(page.getByRole('button', { name: 'Add sounds', exact: true }))).not.toBe(cyan);
    expect(await page.getByRole('button', { name: 'reset instrument' }).evaluate(element => getComputedStyle(element).borderLeftColor)).toBe(red);

    await page.getByRole('button', { name: 'Load demo kit', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Drum pad instrument, 10 of 24 loaded' })).toBeVisible();
    const loaded = page.locator('[data-drum-pad][data-pad-state="loaded"]:not([data-pad-selected])').first();
    expect(await loaded.evaluate(element => getComputedStyle(element, '::after').backgroundColor)).toBe(cyan);
    const selected = page.locator('[data-drum-pad][data-pad-selected="true"]').first();
    expect(await background(selected)).toBe(orange);
    await expect(page.locator('.studio-drum-loaded-count')).toHaveText('10 / 24 loaded');
    await expect(page.locator('.studio-drum-loaded-count i.fa-check-circle')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
    await expect(launch.getByText('10 / 24 pads loaded')).toBeVisible();
    expect(await launch.getByText('10 / 24 pads loaded').evaluate(element => getComputedStyle(element, '::before').backgroundColor)).toBe(cyan);
  });

  test('build identity is exposed and matches the server that delivered it', async ({ page }) => {
    await openLaunch(page);
    const html = page.locator('html');
    const mode = production ? 'production' : 'development';
    await expect(html).toHaveAttribute('data-opstudio-mode', mode);
    await expect(html).toHaveAttribute('data-opstudio-version', /^\d+\.\d+\.\d+$/);
    const buildId = await html.getAttribute('data-opstudio-build');
    expect(buildId).toBeTruthy();
    await expect(page.locator(`footer [data-opstudio-build="${buildId}"]`)).toHaveText(new RegExp(`^v\\d+\\.\\d+\\.\\d+ · ${production ? '' : 'dev '}build ${buildId!.slice(-8)}$`));
    if (!production) {
      const served = await page.evaluate(async () => (await fetch('/__opstudio/build.json', { cache: 'no-store' })).json());
      expect(served).toMatchObject({ buildId, mode: 'development' });
    }
    await expect(page.getByText('This tab is running a different build from the local server.')).toHaveCount(0);
  });
});

test.describe('narrow launch and drum workbench', () => {
  test('medium launch uses two equal rows with aligned actions', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1100 });
    const launch = await openLaunch(page);
    const modules = launch.getByRole('article');
    const bounds = await Promise.all([0, 1, 2, 3].map(index => box(modules.nth(index))));
    expect(Math.abs(bounds[0].y - bounds[1].y)).toBeLessThan(2);
    expect(Math.abs(bounds[2].y - bounds[3].y)).toBeLessThan(2);
    expect(bounds[2].y).toBeGreaterThanOrEqual(bounds[0].y + bounds[0].height);
    expect(Math.abs(bounds[0].x - bounds[2].x)).toBeLessThan(2);
    const actions = await Promise.all([0, 1, 2, 3].map(index => box(modules.nth(index).locator('.studio-launch-cta'))));
    expect(Math.abs(actions[0].y - actions[1].y)).toBeLessThan(2);
    expect(Math.abs(actions[2].y - actions[3].y)).toBeLessThan(2);
    await noHorizontalOverflow(page);
  });

  test('narrow launch stacks modules without overflow and keeps 44px targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const launch = await openLaunch(page);
    const modules = launch.getByRole('article');
    const boxes = await Promise.all([0, 1, 2, 3].map(index => box(modules.nth(index))));
    expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height);
    expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[1].y + boxes[1].height);
    expect(boxes[3].y).toBeGreaterThanOrEqual(boxes[2].y + boxes[2].height);
    for (const bounds of boxes) expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    for (const target of await launch.getByRole('button').all()) {
      const bounds = await box(target);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    }
    for (const meta of await launch.locator('.studio-launch-meta').all()) {
      expect(await meta.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await noHorizontalOverflow(page);
  });

  for (const width of [1440, 1024]) {
    test(`desktop drum workbench at ${width}px: compact header zone, stacked banks left, editor right, quiet EMPTY labels`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'Desktop contract');
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/studio/drum', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('group', { name: 'Drum keyboard', exact: true })).toBeVisible();

      const toolbar = await box(page.getByRole('region', { name: 'Instrument project controls' }));
      expect(toolbar.height, 'project toolbar is a single compact row').toBeLessThanOrEqual(64);
      const demo = await box(page.getByRole('region', { name: 'Studio Seed demo kit' }));
      expect(demo.height, 'demo strip is compact').toBeLessThanOrEqual(64);
      const performance = await box(page.locator('.studio-editor-stage--drum .studio-performance-column'));
      const editor = await box(page.locator('.studio-editor-stage--drum .studio-editor-column'));
      expect(performance.y - (toolbar.y + toolbar.height), 'workbench starts close to the toolbar').toBeLessThanOrEqual(90);
      expect(editor.x).toBeGreaterThanOrEqual(performance.x + performance.width - 2);
      expect(Math.abs(editor.y - performance.y)).toBeLessThanOrEqual(2);
      expect(performance.width).toBeGreaterThanOrEqual(editor.width);
      const lower = await box(page.getByRole('group', { name: 'Lower octave drum keys', exact: true }));
      const upper = await box(page.getByRole('group', { name: 'Upper octave drum keys', exact: true }));
      expect(upper.y).toBeGreaterThanOrEqual(lower.y + lower.height - 2);
      expect(Math.abs(upper.x - lower.x)).toBeLessThanOrEqual(2);

      const statuses = page.locator('.studio-desktop-pad-banks .studio-drum-pad-status');
      await expect(statuses).toHaveCount(24);
      const visibleEmpty = await statuses.evaluateAll(labels => labels.filter(label => label.textContent === 'EMPTY' && getComputedStyle(label).clipPath === 'none').length);
      expect(visibleEmpty, 'EMPTY is not repeated visually under empty pads').toBe(0);
      await expect(page.getByRole('button', { name: 'SD1 drum key S', exact: true })).toHaveAccessibleDescription('EMPTY');
      await expect(page.getByRole('button', { name: 'KD1 drum key A', exact: true })).toHaveAccessibleDescription('SELECTED');

      // Tray header status is readable on the dark tray and neutral at zero (no completion check).
      const header = page.locator('.studio-drum-surface > .studio-performance-header');
      const count = header.locator('.studio-drum-loaded-count');
      await expect(count).toHaveText('0 / 24 loaded');
      await expect(count.locator('i')).toHaveCount(0);
      expect(await contrast(count, header), 'loaded count contrast').toBeGreaterThanOrEqual(4.5);
      expect(await contrast(header.locator('.fa-question-circle'), header), 'help icon contrast').toBeGreaterThanOrEqual(3);
      await expect(page.getByRole('region', { name: 'Drum pad instrument, 0 of 24 loaded' })).toBeVisible();
      const toolbarRegion = page.getByRole('region', { name: 'Instrument project controls' });
      expect(await contrast(toolbarRegion.locator('.studio-save-state'), toolbarRegion), 'save state contrast').toBeGreaterThanOrEqual(4.5);

      // The empty selected-pad panel is sized by its content, not a fixed tall block.
      const emptyPanel = await box(page.locator('.studio-editor-column .studio-empty-pad'));
      expect(emptyPanel.height, 'empty selected-pad panel height').toBeLessThanOrEqual(150);
      await noHorizontalOverflow(page);
    });
  }

  for (const width of [900, 390]) {
    test(`drum workbench collapses to one column without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/studio/drum', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('group', { name: 'Drum keyboard', exact: true })).toBeVisible();
      const performance = await box(page.locator('.studio-editor-stage--drum .studio-performance-column'));
      const editor = await box(page.locator('.studio-editor-stage--drum .studio-editor-column'));
      expect(editor.y).toBeGreaterThanOrEqual(performance.y + performance.height - 2);
      expect(editor.x + editor.width).toBeLessThanOrEqual(width);
      await noHorizontalOverflow(page);
    });
  }
});
