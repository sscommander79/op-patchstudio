import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import {downloadDevicePreset, expectDrumLoaded, openAdvanced, openWorkspace, projectAction} from './workspace-actions';

function transientWav(name = 'browser-break.wav') {
  const sampleRate=48_000,frames=48_000,buffer=Buffer.alloc(44+frames*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);
  buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);
  buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  for(const onset of [4_000,18_000,35_000]) {
    for(let offset=0;offset<64;offset+=1) buffer.writeInt16LE(Math.round(30_000*Math.exp(-offset/9)),44+(onset+offset)*2);
  }
  return {name,mimeType:'audio/wav',buffer};
}

async function openExternalSlicer(page:Page) {
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Slice audio',exact:true}).click();
  await (await chooser).setFiles(transientWav());
  const dialog=page.getByRole('dialog',{name:'slice audio'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Sound 1 of 3',{exact:true})).toBeVisible();
  return dialog;
}

async function downloadedBytes(download:Download) {
  expect(await download.failure()).toBeNull();
  const path=await download.path();
  if(!path)throw new Error('Download did not produce a file');
  return readFile(path);
}

function wavFrames(bytes:Uint8Array) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let channels=0,bits=0;
  for(let offset=12;offset+8<=bytes.length;) {
    const id=Buffer.from(bytes.subarray(offset,offset+4)).toString('ascii'),size=view.getUint32(offset+4,true);
    if(id==='fmt '){channels=view.getUint16(offset+10,true);bits=view.getUint16(offset+22,true);}
    if(id==='data')return size/(channels*(bits/8));
    offset+=8+size+(size%2);
  }
  throw new Error('Exported WAV has no data chunk');
}

type SliceProvenance={sourceIdentity:string;sourceName:string;startFrame:number;endFrame:number;sourceFrameCount:number;sourceSampleRate:number;sourceChannels:number};
type ProjectManifest={
  project:{drumSamples:Array<{name:string;sampleId:string;assignedKey?:number;sourceIdentity?:string;sliceProvenance?:SliceProvenance}>};
  samples:Array<{id:string;name:string;sourcePath?:string;metadata:{sampleRate:number;channels:number};audio:{frames:number;sampleRate:number;channels:number}}>;
};

async function readProject(bytes:Buffer) {
  const zip=await JSZip.loadAsync(bytes),file=zip.file('manifest.json');
  if(!file)throw new Error('Project backup has no manifest.json');
  return JSON.parse(await file.async('string')) as ProjectManifest;
}

test('slice source, live clock mark, apply, export, undo, and portable provenance round trip',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await openWorkspace(page,'drum');
  await page.getByRole('textbox',{name:'Instrument name',exact:true}).fill('Sliced break');
  await openAdvanced(page,/Audio output and processing/);
  await page.locator('#sample-rate').selectOption('22050');

  let dialog=await openExternalSlicer(page);
  await dialog.getByRole('button',{name:'Select sound 2'}).click();
  await expect(dialog.getByRole('button',{name:'Stop',exact:true})).toBeEnabled();
  await dialog.getByRole('button',{name:'Stop',exact:true}).click();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expectDrumLoaded(page,0);
  await expect(page.locator('#sample-rate')).toHaveValue('22050');
  await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Sliced break');

  dialog=await openExternalSlicer(page);
  await dialog.getByText('Advanced').click();
  await dialog.getByRole('button',{name:'Reset to full source'}).click();
  const sourceFrames=48_000;
  expect(sourceFrames).toBeGreaterThan(12_000);
  await dialog.getByRole('button',{name:'Play source'}).click();
  await expect(dialog.getByRole('button',{name:'Mark split (M)'})).toBeEnabled();
  await page.waitForTimeout(80);
  await dialog.getByRole('button',{name:'Mark split (M)'}).click();
  const liveFrame=Number(await dialog.getByLabel('Sound 2 Start frame').inputValue());
  expect(liveFrame).toBeGreaterThan(0);
  expect(liveFrame).toBeLessThan(sourceFrames);
  await dialog.getByRole('button',{name:'Stop source'}).click();
  const typedMarker=dialog.getByLabel('Sound 2 Start frame');
  await typedMarker.click();
  await typedMarker.press('ControlOrMeta+A');
  await typedMarker.pressSequentially('12000');
  await typedMarker.press('Enter');
  await expect(dialog.getByText('Sound 2 of 2',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Select sound 1'}).click();
  await dialog.getByRole('button',{name:'Stop',exact:true}).click();
  const firstEnd=dialog.getByLabel('Sound 1 End frame');
  await firstEnd.click();
  await firstEnd.press('ControlOrMeta+A');
  await firstEnd.pressSequentially('10000');
  await firstEnd.press('Enter');
  await dialog.getByRole('button',{name:'Select sound 2'}).click();
  await dialog.getByRole('button',{name:'Stop',exact:true}).click();
  await expect(dialog.getByLabel('Sound 2 Start frame')).toHaveValue('12000');
  await dialog.getByRole('button',{name:'Select sound 1'}).click();
  await dialog.getByRole('button',{name:'Select sound 1',exact:true}).dragTo(dialog.getByRole('button',{name:'Pad 9, CH, Empty',exact:true}));
  await expect(dialog.getByRole('button',{name:'Pad 9, CH, Sound 1',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Select sound 2'}).click();
  await dialog.getByRole('button',{name:'Stop',exact:true}).click();
  await dialog.getByLabel('Destination pad').selectOption('2');
  await dialog.getByRole('button',{name:'Assign selected sound',exact:true}).click();
  await dialog.getByRole('button',{name:'Add sounds to kit'}).click();
  await expect(dialog).not.toBeVisible();
  await expectDrumLoaded(page,3);
  await expect(page.locator('#bit-depth')).toHaveValue('16');

  const backupEvent=page.waitForEvent('download');
  await projectAction(page,'Download project');
  const backupDownload=await backupEvent,backupBytes=await downloadedBytes(backupDownload);
  const manifest=await readProject(backupBytes);
  const sliceRefs=manifest.project.drumSamples.filter(ref=>ref.sliceProvenance).sort((a,b)=>a.sliceProvenance!.startFrame-b.sliceProvenance!.startFrame);
  expect(sliceRefs).toHaveLength(2);
  expect(sliceRefs.map(ref=>ref.assignedKey)).toEqual([8,2]);
  expect(sliceRefs.map(ref=>ref.sliceProvenance!.startFrame)).toEqual([0,12000]);
  expect(sliceRefs[0].sliceProvenance!.endFrame).toBe(10000);
  expect(sliceRefs[1].sliceProvenance!.endFrame).toBe(sourceFrames);
  const sourceIdentity=sliceRefs[0].sliceProvenance!.sourceIdentity;
  expect(sliceRefs.every(ref=>ref.sourceIdentity===sourceIdentity&&ref.sliceProvenance!.sourceIdentity===sourceIdentity)).toBe(true);
  const originalRefs=manifest.project.drumSamples.filter(ref=>ref.sourceIdentity===sourceIdentity&&!ref.sliceProvenance);
  expect(originalRefs).toHaveLength(1);
  const originalAsset=manifest.samples.find(sample=>sample.id===originalRefs[0].sampleId)!;
  expect(originalAsset.sourcePath).toBeTruthy();
  expect(originalAsset.metadata).toMatchObject({sampleRate:48_000,channels:1});
  expect(originalAsset.audio.frames).toBe(sourceFrames);
  for(const ref of sliceRefs) {
    const asset=manifest.samples.find(sample=>sample.id===ref.sampleId)!;
    expect(asset.sourcePath).toBeUndefined();
    expect(asset.audio.frames).toBe(ref.sliceProvenance!.endFrame-ref.sliceProvenance!.startFrame);
    expect(ref.sliceProvenance).toMatchObject({sourceIdentity,sourceName:'browser-break.wav',sourceFrameCount:sourceFrames,sourceSampleRate:asset.audio.sampleRate,sourceChannels:asset.audio.channels});
  }

  const patchZip=await JSZip.loadAsync(await downloadedBytes(await downloadDevicePreset(page)));
  const patch=JSON.parse(await patchZip.file('patch.json')!.async('string')) as {regions:Array<{sample:string;framecount:number;lokey:number}>};
  expect(patch.regions).toHaveLength(2);
  expect(patch.regions.map(region=>region.lokey).sort((a,b)=>a-b)).toEqual([55,61]);
  for(const ref of sliceRefs) {
    const region=patch.regions.find(candidate=>candidate.lokey===53+ref.assignedKey!)!;
    const provenance=ref.sliceProvenance!,asset=manifest.samples.find(sample=>sample.id===ref.sampleId)!;
    const expectedFrames=Math.ceil((provenance.endFrame-provenance.startFrame)*22_050/asset.audio.sampleRate);
    expect(region.framecount).toBe(expectedFrames);
    expect(wavFrames(await patchZip.file(region.sample)!.async('uint8array'))).toBe(expectedFrames);
    expect(Math.abs(expectedFrames/22_050-(provenance.endFrame-provenance.startFrame)/asset.audio.sampleRate)).toBeLessThanOrEqual(1/22_050);
  }

  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expectDrumLoaded(page,0);
  await expect(page.locator('#sample-rate')).toHaveValue('22050');
  await expect(page.locator('#bit-depth')).toHaveValue('16');
  await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Sliced break');

  const openChooser=page.waitForEvent('filechooser');
  await projectAction(page,'Open project');
  await (await openChooser).setFiles({name:backupDownload.suggestedFilename(),mimeType:'application/zip',buffer:backupBytes});
  await expectDrumLoaded(page,3);
  const restoredBackupEvent=page.waitForEvent('download');
  await projectAction(page,'Download project');
  const restored=await readProject(await downloadedBytes(await restoredBackupEvent));
  expect(restored.project.drumSamples.filter(ref=>ref.sliceProvenance).map(ref=>ref.sliceProvenance)).toEqual(
    manifest.project.drumSamples.filter(ref=>ref.sliceProvenance).map(ref=>ref.sliceProvenance),
  );
});
