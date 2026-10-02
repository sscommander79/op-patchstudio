import { expect, test, type Download, type Page } from './control-audit-test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import {applyAudioImport} from './import-helpers';
import {chooseDrumPadFile, downloadDevicePreset, expectMultisampleLoaded, gotoWorkspace, openAdvanced} from './workspace-actions';

function wavFixture48k(name = 'loop-C4.wav') {
  const frames = 4800;
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(48000, 24); buffer.writeUInt32LE(96000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let frame = 0; frame < frames; frame += 1) buffer.writeInt16LE(Math.round(Math.sin(frame / 20) * 12000), 44 + frame * 2);
  return { name, mimeType: 'audio/wav', buffer };
}

function chunk(bytes: Uint8Array, wanted: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = Buffer.from(bytes.subarray(offset, offset + 4)).toString('ascii');
    const size = view.getUint32(offset + 4, true);
    if (id === wanted) return { offset: offset + 8, size, view };
    offset += 8 + size + (size % 2);
  }
  throw new Error(`Missing ${wanted} chunk`);
}

async function uploadMultisample(page: Page) {
  await gotoWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,0);
  const input = page.getByLabel('choose multisample audio files');
  await expect(input).toBeAttached();
  await input.setInputFiles(wavFixture48k());
  await applyAudioImport(page);
  await expect(page.getByText('loop-C4.wav', { exact: true }).first()).toBeVisible();
}

async function uploadDrum(page: Page) {
  await gotoWorkspace(page,'drum');
  const chooser = await chooseDrumPadFile(page,'KD1 drum key A');
  await (await chooser).setFiles(wavFixture48k('drum.wav'));
  await expect(page.getByRole('region',{name:'Focused sample editor'})).toContainText('drum.wav');
}

async function openEditor(page: Page) {
  const zoom = page.getByTitle('zoom and edit').first();
  await expect(zoom).toBeVisible();
  const touchCapable = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touchCapable) await zoom.tap();
  else await zoom.click();
  return page.getByRole('dialog', { name: 'zoom and edit' });
}

async function readPatch(download: Download) {
  const path = await download.path();
  if (!path) throw new Error('Download did not produce a file');
  const zip = await JSZip.loadAsync(await readFile(path));
  const patchFile = zip.file('patch.json');
  if (!patchFile) throw new Error('Preset has no patch.json');
  const patch = JSON.parse(await patchFile.async('string')) as { regions: Array<Record<string, number | string | boolean>> };
  const audio = await zip.file(String(patch.regions[0].sample))!.async('uint8array');
  return { patch, audio };
}

test('zoom editor saves one atomic half-open edit and exports real converted loop bytes', async ({ page }) => {
  await uploadMultisample(page);
  let dialog = await openEditor(page);
  await expect(dialog.getByLabel('Sample start frames')).toHaveValue('0');
  await expect(dialog.getByLabel('Sample end frames')).toHaveValue('4800');
  const snapping=dialog.getByRole('checkbox',{name:'snap to zero crossings'});await snapping.uncheck();await expect(snapping).not.toBeChecked();await snapping.check();await expect(snapping).toBeChecked();

  const playhead = dialog.getByText(/^Playhead:/);
  const readPlayhead = async () => Number((await playhead.textContent())?.match(/\d+/)?.[0] ?? 0);
  await dialog.getByRole('button', { name: 'play' }).click();
  await expect.poll(readPlayhead).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'pause' }).click();
  const pausedText = await playhead.textContent();
  await page.waitForTimeout(150);
  await expect(playhead).toHaveText(pausedText ?? '');
  await dialog.getByRole('button', { name: 'play' }).click();
  await expect(dialog.getByRole('button', { name: 'pause' })).toBeEnabled();
  const resumedFrom = await readPlayhead();
  await expect.poll(readPlayhead).not.toBe(resumedFrom);
  await dialog.getByRole('button', { name: 'stop' }).click();
  await page.keyboard.down('p');
  await expect(dialog.getByRole('button', { name: 'pause' })).toBeEnabled();
  const heldFrom = await readPlayhead();
  await expect.poll(readPlayhead).not.toBe(heldFrom);
  await page.keyboard.up('p');
  await expect(dialog.getByRole('button', { name: 'pause' })).toBeDisabled();

  await dialog.getByLabel('Loop start frames').fill('480');
  await dialog.getByLabel('Loop end frames').fill('2400');
  await dialog.getByLabel('Loop crossfade percent').fill('25');
  await dialog.getByRole('button', { name: 'save markers' }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  dialog = await openEditor(page);
  await expect(dialog.getByLabel('Loop start frames')).toHaveValue('960');
  await expect(dialog.getByLabel('Loop end frames')).toHaveValue('3840');
  await expect(dialog.getByLabel('Loop crossfade percent')).toHaveValue('0');
  await dialog.getByRole('button', { name: 'cancel' }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  dialog = await openEditor(page);
  await expect(dialog.getByLabel('Loop start frames')).toHaveValue('480');
  await expect(dialog.getByLabel('Loop end frames')).toHaveValue('2400');
  await expect(dialog.getByLabel('Loop crossfade percent')).toHaveValue('25');

  const canvas = dialog.getByLabel(/waveform editor/i);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Waveform canvas has no bounds');
  await page.mouse.move(box.x + 1, box.y + box.height - 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height - 4);
  await page.mouse.move(box.x - 100, box.y + box.height - 4);
  await page.mouse.up();
  await expect(dialog.getByLabel('Sample start frames')).toHaveValue('0');

  await dialog.getByLabel('Loop start frames').fill('1000');
  await dialog.getByRole('button', { name: 'cancel' }).click();
  dialog = await openEditor(page);
  await expect(dialog.getByLabel('Loop start frames')).toHaveValue('480');
  await dialog.getByRole('button', { name: 'cancel' }).click();

  await openAdvanced(page,/Audio output and processing/);
  await page.locator('#sample-rate').selectOption('44100');
  const cutAtLoopEnd = page.locator('#cut-loop-toggle[role="switch"]');
  await page.locator('#cut-loop-toggle_label .cds--toggle__appearance').click();
  await expect(cutAtLoopEnd).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('textbox', { name: 'Instrument name', exact: true }).fill('Loop contract');
  const { patch, audio } = await readPatch(await downloadDevicePreset(page));
  const region = patch.regions[0];
  expect(region).toMatchObject({
    framecount: 2210,
    'sample.start': 0,
    'sample.end': 2210,
    'loop.start': 441,
    'loop.end': 2205,
    'loop.crossfade': 553,
    'loop.enabled': true,
  });
  const data = chunk(audio, 'data');
  expect(data.size / 2).toBe(2210);
  const smpl = chunk(audio, 'smpl');
  expect(smpl.view.getUint32(smpl.offset + 28, true)).toBe(1);
  expect(smpl.view.getUint32(smpl.offset + 36 + 8, true)).toBe(441);
  expect(smpl.view.getUint32(smpl.offset + 36 + 12, true)).toBe(2204);
});

test('portrait touch opens the responsive editor without a rotation gate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uploadMultisample(page);
  let dialog = await openEditor(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'cancel' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  dialog = await openEditor(page);
  await expect(dialog).toBeVisible();
});

test('drum table opens the same frame editor and Cancel preserves its markers', async ({ page }) => {
  await uploadDrum(page);
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  let dialog = await openEditor(page);
  await expect(dialog.getByLabel('Sample start frames')).toHaveValue('0');
  await expect(dialog.getByLabel('Sample end frames')).toHaveValue('4800');
  await dialog.getByLabel('Sample start frames').fill('480');
  await dialog.getByRole('button', { name: 'cancel' }).click();
  dialog = await openEditor(page);
  await expect(dialog.getByLabel('Sample start frames')).toHaveValue('0');
  await expect(dialog.getByLabel('Sample end frames')).toHaveValue('4800');
});

test('waveform surface opens zoom and Escape preserves existing markers',async({page})=>{
 await uploadDrum(page);const editor=page.getByRole('region',{name:'Focused sample editor'});const before=await editor.getByLabel('In point (seconds)',{exact:true}).inputValue();await editor.locator('canvas').click({position:{x:40,y:45}});const dialog=page.getByRole('dialog',{name:'zoom and edit',exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel('Sample start frames').fill('100');await dialog.press('Escape');await expect(dialog).toBeHidden();await expect(editor.getByLabel('In point (seconds)',{exact:true})).toHaveValue(before);
});
