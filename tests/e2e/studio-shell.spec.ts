import { expect, test } from '@playwright/test';

test('desktop studio uses the available width and has one brand header', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.studio-shell')).toBeVisible();
  const shellWidth = await page.locator('.studio-shell').evaluate(element => element.getBoundingClientRect().width);
  expect(shellWidth).toBeGreaterThan(1300);
  await expect(page.locator('.studio-shell-brand')).toHaveCount(1);
  await expect(page.locator('.studio-app-header')).toHaveCount(0);
  await expect(page.locator('.studio-shell-sidebar')).toHaveCount(0);
});

test('overview does not load the drum editor until it is opened', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(request.url()));
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(requested.some(url => /\/DrumTool(?:\.tsx|-[^/]+\.js)/.test(url))).toBe(false);
  await page.getByRole('button', { name: 'Open kit', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Drum keyboard', exact: true })).toBeVisible();
  expect(requested.some(url => /\/DrumTool(?:\.tsx|-[^/]+\.js)/.test(url))).toBe(true);
});

test('overview defers device and recording workspaces until requested', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(request.url()));
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(requested.some(url => /\/(?:DevicesWorkspace|StemRecordingModal|SliceAudioModal)(?:\.tsx|-[^/]+\.js)/.test(url))).toBe(false);
  await page.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  expect(requested.some(url => /\/DevicesWorkspace(?:\.tsx|-[^/]+\.js)/.test(url))).toBe(true);
});

test('top-level workspace navigation survives reload and browser Back', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect(page).toHaveURL(/#\/studio\/devices$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page).toHaveURL(/#\/studio\/library$/);
  await page.reload();
  await expect(page.getByText('Studio / Library')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
});

test('single-sample path reaches manual recording; Help search and navigation preserve the recorder', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What would you like to make?' })).toBeVisible();
  await page.getByRole('button', { name: /Sample a sound Record \/ review/ }).click();
  await page.getByRole('button', { name: /Software synth Run it in your DAW/ }).click();
  await page.getByRole('button', { name: 'Continue to setup' }).click();
  await expect(page.getByText('MIDI is optional for recording a single sound.')).toBeVisible();
  await page.getByRole('button', { name: 'Open editor and Record takes' }).click();
  const recorder = page.getByRole('dialog', { name: 'Record takes' });
  await expect(recorder).toBeVisible();
  await expect(recorder.getByLabel('Capture mode')).toBeFocused();
  await page.goBack();
  await expect(recorder).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/multisample$/);

  await recorder.getByRole('button', { name: 'Recording help' }).click();
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  await expect(help.getByRole('heading', { name: 'Recording and review' })).toBeVisible();
  await help.getByRole('searchbox', { name: 'Search help' }).fill('backup');
  await expect(help.getByRole('heading', { name: 'Recording and review' })).toBeHidden();
  await help.getByRole('button', { name: 'Software synth connections' }).click();
  await expect(help.getByRole('searchbox', { name: 'Search help' })).toHaveValue('');
  await expect(help.getByRole('heading', { name: 'Software synth connections' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await expect(recorder).toBeVisible();
  await expect(recorder.getByRole('button', { name: 'Recording help' })).toBeFocused();

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).evaluate(button => (button as HTMLElement).click());
  await expect(recorder).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What would you like to make?' })).toBeHidden();
  await recorder.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(recorder).toBeHidden();
});

test('automatic multisampling and drum setup reach their actual recorders', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: /Multisample a synth Capture notes/ }).click();
  await page.getByRole('button', { name: 'Continue to setup' }).click();
  await page.getByRole('button', { name: 'Open editor and Record takes' }).click();
  const recorder = page.getByRole('dialog', { name: 'Record takes' });
  await expect(recorder).toBeVisible();
  await expect(recorder.locator('[data-studio-automatic-panel]')).toBeFocused();
  await expect(recorder.getByText('Guided automatic multisampling')).toBeVisible();
  await expect(recorder.getByRole('navigation', { name: 'Automatic multisampling steps' })).toContainText('Connect and check');
  await expect(recorder.getByLabel('Capture mode')).toBeHidden();
  await recorder.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: /Build a drum kit Pad map/ }).click();
  await page.getByRole('button', { name: 'Open editor and Record takes' }).click();
  await expect(recorder).toBeVisible();
  await expect(recorder.getByText('Guided automatic multisampling')).toHaveCount(0);
  await expect(recorder.getByLabel('Capture mode')).toBeFocused();
});

test('management distinguishes an editable project from library and device export', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByRole('heading', { name: 'Editable project archive' })).toBeVisible();
  await expect(page.getByText('Full-library backup and restore is not available yet.')).toBeVisible();
  await expect(page.getByText(/copy the intact .preset folder/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open drum kit editor (Export OP-XY)' })).toBeVisible();
  await page.getByRole('button', { name: 'Open drum kit editor (Project menu)' }).click();
  await expect(page.getByRole('button', { name: 'Export OP-XY', exact: true })).toBeVisible();
  await page.locator('details.studio-project-menu summary').click();
  await expect(page.getByText('Project backup keeps editable audio and settings; device patch export is separate.')).toBeVisible();
});

test('narrow Overview and Help retain usable navigation without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Library' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Help', exact: true }).last().click();
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  await expect(help.getByRole('button', { name: 'Close Help' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('route focus keeps narrow navigation visible and uses the shell as the only workspace map', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'Help', exact: true }).last()).toBeInViewport();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: /Multisample a synth Capture notes/ }).click();
  await expect(page.getByRole('heading', { name: 'Where is your synth?' })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'Help', exact: true }).last()).toBeInViewport();
  const outline = await page.getByRole('heading', { name: 'Where is your synth?' }).evaluate(element => getComputedStyle(element).outlineStyle);
  expect(outline).toBe('none');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Open kit', exact: true }).click();
  await expect(page.getByText('Studio / Drum kit editor')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'main navigation tabs' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Library' }).click();
  await expect(page.getByText('Studio / Library')).toBeVisible();
});
