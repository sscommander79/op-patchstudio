import { test, expect, type Page } from './control-audit-test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import {applyAudioImport} from './import-helpers';
import {readCurrentSession,setCurrentSessionTimestamp} from './indexeddb-helpers';
import {chooseDrumPadFile, downloadDevicePreset, expectDrumLoaded, gotoWorkspace, openAdvanced, openWorkspace, projectAction} from './workspace-actions';

// Hand-built PCM fixtures avoid exercising the application's encoder to
// generate its own expected input. Distinct polarity catches file collisions.
function wavFixture(name: string, polarity = 1) {
  const frames = 4410;
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(44100, 24); buffer.writeUInt32LE(88200, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) buffer.writeInt16LE(polarity * 8192, 44 + i * 2);
  return { name, mimeType: 'audio/wav', buffer };
}

async function loadPad(page: Page, label: string, file: ReturnType<typeof wavFixture>) {
  const chooser = await chooseDrumPadFile(page,label);
  await (await chooser).setFiles(file);
  await expect(page.getByRole('region',{name:'Focused sample editor'})).toContainText(file.name);
  await expect(page.getByRole('button', { name: 'Export OP-XY', exact: true })).toBeVisible();
}

async function downloadPatch(page: Page, rename = true) {
  if (rename) await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Browser integrity');
  const download = await downloadDevicePreset(page);
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  if (!path) throw new Error('Download did not produce a file');
  const zip = await JSZip.loadAsync(await readFile(path));
  const manifest = zip.file('patch.json');
  if (!manifest) throw new Error('Preset has no patch.json');
  const patch = JSON.parse(await manifest.async('string')) as {
    regions: { lokey: number; hikey: number; sample: string; framecount: number }[];
    octave: number;
    engine: Record<string, unknown>;
    envelope: Record<string, unknown>;
    fx: Record<string, unknown>;
  };
  for (const region of patch.regions) {
    const member = zip.file(region.sample);
    expect(member, `Missing audio: ${region.sample}`).not.toBeNull();
    expect((await member!.async('uint8array')).length).toBeGreaterThan(44);
  }
  return { zip, patch };
}

test('a kit with empty pads exports the same pad assignments', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'KD1 drum key A', wavFixture('kick.wav'));
  await loadPad(page, 'CLP drum key R', wavFixture('clap.wav'));
  await expectDrumLoaded(page,2);
  const { patch } = await downloadPatch(page);
  expect(patch.regions.map(region => [region.lokey, region.hikey])).toEqual([[53, 53], [58, 58]]);
});

test('same-name samples remain distinct audio files in the downloaded kit', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'KD1 drum key A', wavFixture('hit.wav', 1));
  await loadPad(page, 'KD2 drum key W', wavFixture('hit.wav', -1));
  await expectDrumLoaded(page,2);
  const { zip, patch } = await downloadPatch(page);
  expect(new Set(patch.regions.map(region => region.sample)).size).toBe(2);
  const first = await zip.file(patch.regions[0].sample)!.async('uint8array');
  const second = await zip.file(patch.regions[1].sample)!.async('uint8array');
  expect(first).not.toEqual(second);
});

test('imported multisample settings survive the real upload and export flow', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await openWorkspace(page,'multisample');
  await page.getByLabel('choose multisample audio files').setInputFiles(wavFixture('tone-C4.wav'));
  await applyAudioImport(page);
  await expect(page.getByText('tone-C4.wav', { exact: true }).first()).toBeVisible();
  await openAdvanced(page,/Preset and performance settings/);
  const imported = {
    type: 'multisampler', octave: 3,
    engine: { transpose: 12, playmode: 'mono', customHardwareField: 42 },
    envelope: { amp: { attack: 123, decay: 456, sustain: 789, release: 1000 } },
  };
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import patch\.json/ }).click();
  await (await chooser).setFiles({ name: 'patch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(page.getByText('successfully imported multisample preset settings', { exact: true })).toBeVisible();
  const { patch } = await downloadPatch(page);
  expect.soft(patch.octave).toBe(3);
  expect.soft(patch.engine.transpose).toBe(12);
  expect.soft(patch.engine.playmode).toBe('mono');
  expect.soft(patch.engine.customHardwareField).toBe(42);
  expect.soft(patch.envelope.amp).toEqual(imported.envelope.amp);
});

test('an older saved session can be restored after reload with its pad assignments', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'CLP drum key R', wavFixture('recover-me.wav'));
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Keep this session');
  await expect.poll(async () => (await readCurrentSession(page))?.drumSettings?.presetName).toBe('Keep this session');
  // Simulate returning two days later without a real clock delay. The saved
  // audio and musical state came from the actual file chooser and autosave.
  await setCurrentSessionTimestamp(page,Date.now()-2*24*60*60*1000);
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'restore session' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'restore', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await openWorkspace(page,'drum');
  await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Keep this session');
  const { patch } = await downloadPatch(page);
  expect(patch.regions.map(region => [region.lokey, region.hikey])).toEqual([[58, 58]]);
});

test('a failed autosave offers a retry that saves the current work', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    // Keep the injected outage active through subsequent edits. A one-shot
    // failure let autosave recover before Playwright could click Retry save.
    let storageAvailable = false;
    document.addEventListener('click', event => {
      if ((event.target as Element).closest('button')?.textContent?.trim() === 'Retry save') storageAvailable = true;
    }, { capture: true });
    IDBObjectStore.prototype.put = function (...args) {
      const value = args[0] as { drumSamples?: unknown[] };
      if (this.name === 'sessions' && value.drumSamples?.length && !storageAvailable) {
        throw new DOMException('Simulated storage failure', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'CLP drum key R', wavFixture('retry-me.wav'));
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Retry this save');
  const retry = page.getByRole('button', { name: /retry.*save|save.*retry/i });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(async () => (await readCurrentSession(page))?.drumSettings?.presetName).toBe('Retry this save');
  await expect(retry).not.toBeVisible();
});

test('library reload restores saved multisample settings and keeps the drum kit', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'CLP drum key R', wavFixture('keep-drum.wav'));
  await openWorkspace(page,'multisample');
  await page.getByLabel('choose multisample audio files').setInputFiles(wavFixture('library-C4.wav'));
  await applyAudioImport(page);
  await expect(page.getByText('library-C4.wav', { exact: true }).first()).toBeVisible();
  await openAdvanced(page,/Preset and performance settings/);
  const original = {
    type: 'multisampler', name: 'Library complete', octave: 2,
    engine: { transpose: 12, playmode: 'legato', volume: 12345 },
    envelope: { amp: { attack: 123, decay: 456, sustain: 789, release: 1000 } },
    fx: { active: true, vendorSetting: 72 },
  };
  const importSettings = async (preset: Record<string, unknown>) => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import patch\.json/ }).click();
    await (await chooser).setFiles({ name: 'patch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(preset)) });
    await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue(String(preset.name));
  };
  await importSettings(original);
  await projectAction(page,'Save to library');
  await expect(page.getByText('Saved Library complete to the library.', { exact: true })).toBeVisible();
  await importSettings({ type: 'multisampler', name: 'Temporary setting', octave: -1, engine: { transpose: -12, playmode: 'poly', volume: 32767 }, fx: { active: false } });
  await openWorkspace(page,'library');
  await page.getByRole('button', { name: /^(load preset|load)$/ }).click();
  await page.getByRole('button', { name: 'ok', exact: true }).click();
  await expect(page.locator('.studio-shell-location strong')).toHaveText('Multisample editor');
  await expect(page).toHaveURL(/#\/studio\/multisample$/);
  await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Library complete');
  const { patch } = await downloadPatch(page);
  expect.soft(patch.octave).toBe(2);
  expect.soft(patch.engine.transpose).toBe(12);
  expect.soft(patch.engine.playmode).toBe('legato');
  expect.soft(patch.engine.volume).toBe(12345);
  expect.soft(patch.envelope.amp).toEqual(original.envelope.amp);
  expect.soft(patch.fx.vendorSetting).toBe(72);
  await openWorkspace(page,'drum');
  const drum = await downloadPatch(page);
  expect(drum.patch.regions.map(region => region.lokey)).toEqual([58]);
});


test('portable project restores sparse audio and its import can be undone', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'CLP drum key R', wavFixture('project-clap.wav'));
  await expectDrumLoaded(page,1);
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Portable project');
  const backupEvent = page.waitForEvent('download');
  await projectAction(page,'Download project');
  const backup = await backupEvent;
  expect(backup.suggestedFilename()).toMatch(/\.opstudio$/);
  const backupPath = await backup.path();
  if (!backupPath) throw new Error('Project backup did not produce a file');
  await loadPad(page, 'KD1 drum key A', wavFixture('added-kick.wav'));
  await expectDrumLoaded(page,2);
  const chooserEvent = page.waitForEvent('filechooser');
  await projectAction(page,'Open project');
  await (await chooserEvent).setFiles({ name: backup.suggestedFilename(), mimeType: 'application/zip', buffer: await readFile(backupPath) });
  await expectDrumLoaded(page,1);
  let exported = await downloadPatch(page, false);
  expect(exported.patch.regions.map(region => region.lokey)).toEqual([58]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectDrumLoaded(page,2);
  exported = await downloadPatch(page, false);
  expect(exported.patch.regions.map(region => region.lokey)).toEqual([53, 58]);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectDrumLoaded(page,1);
  exported = await downloadPatch(page, false);
  expect(exported.patch.regions.map(region => region.lokey)).toEqual([58]);
});

test('settings-only work is offered for recovery after reload', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Settings before samples');
  await expect.poll(async () => (await readCurrentSession(page))?.drumSettings?.presetName).toBe('Settings before samples');
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'restore session' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'restore', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await openWorkspace(page,'drum');
  await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Settings before samples');
});

test('keyboard undo and redo restore whole audio loads without changing pad banks', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'CLP drum key R', wavFixture('undo-clap.wav'));
  await loadPad(page, 'KD1 drum key A', wavFixture('undo-kick.wav'));
  await expectDrumLoaded(page,2);
  await page.keyboard.press('Control+z');
  await expectDrumLoaded(page,1);
  const desktopClap=page.getByRole('button',{name:'CLP drum key R',exact:true});
  if(await desktopClap.count()) {
    await expect(desktopClap).toBeVisible();
  } else {
    await expect(page.getByRole('button',{name:'Lower pads 1–12',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('button',{name:'Pad 6, CLP, undo-clap.wav',exact:true})).toBeVisible();
  }
  await page.keyboard.press('Control+Shift+z');
  await expectDrumLoaded(page,2);
  const { patch } = await downloadPatch(page);
  expect(patch.regions.map(region => region.lokey)).toEqual([53, 58]);
});

test('preset import undoes atomically and confirmation keeps project shortcuts blocked', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await openAdvanced(page,/Preset and performance settings/);
  const imported = {
    type: 'drum',
    engine: {
      playmode: 'legato', transpose: 9,
      'velocity.sensitivity': 16384, volume: 24576, width: 8192,
    },
  };
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import patch\.json/ }).click();
  await (await chooser).setFiles({ name:'patch.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(imported)) });
  await expect(page.getByText('successfully imported drum preset settings', { exact:true })).toBeVisible();
  await expect(page.getByText('transpose: 9', { exact:true })).toBeVisible();
  await expect(page.getByText('velocity: 50%', { exact:true })).toBeVisible();
  await expect(page.getByText('volume: 75%', { exact:true })).toBeVisible();
  await expect(page.getByText('width: 25%', { exact:true })).toBeVisible();

  await page.getByRole('button', { name:/reset settings$/ }).click();
  const dialog = page.getByRole('dialog', { name:'confirm action' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name:'ok', exact:true }).focus();
  await page.keyboard.press('Control+z');
  await expect(dialog).toBeVisible();
  await expect(page.getByText('transpose: 9', { exact:true })).toBeVisible();
  await dialog.getByRole('button', { name:'cancel', exact:true }).click();

  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.getByText('transpose: 0', { exact:true })).toBeVisible();
  await expect(page.getByText('velocity: 20%', { exact:true })).toBeVisible();
  await expect(page.getByText('volume: 69%', { exact:true })).toBeVisible();
  await expect(page.getByText('width: 0%', { exact:true })).toBeVisible();
});

test('malformed project backup leaves the current sparse project untouched', async ({ page }) => {
  await gotoWorkspace(page,'drum');
  await loadPad(page, 'CLP drum key R', wavFixture('keep-after-invalid-project.wav'));
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Keep current work');

  const chooser = page.waitForEvent('filechooser');
  await projectAction(page,'Open project');
  await (await chooser).setFiles({
    name: 'broken.opstudio',
    mimeType: 'application/zip',
    buffer: Buffer.from('not a zip archive'),
  });

  const backupError = page.getByRole('region', { name: 'Instrument project controls' }).getByRole('alert');
  await expect(backupError).toContainText('Could not open project');
  await expect(backupError).toContainText('current project was kept');
  await expectDrumLoaded(page,1);
  await expect(page.getByRole('textbox', { name: 'Instrument name', exact: true })).toHaveValue('Keep current work');
  const { patch } = await downloadPatch(page);
  expect(patch.regions.map(region => region.lokey)).toEqual([58]);
});
