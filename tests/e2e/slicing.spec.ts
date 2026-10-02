import { expect, test, type Download, type Page } from './control-audit-test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import {downloadDevicePreset, gotoWorkspace, expectDrumLoaded, openAdvanced, openWorkspace, projectAction} from './workspace-actions';

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

// Keep both controls within the modal body before a native browser drag. Playwright's
// target auto-scroll after mouse-down can otherwise move the drag source behind the fixed header.
async function dragSoundToPad(dialog:ReturnType<Page['getByRole']>,number:number,pad:string) {
  const source=dialog.getByRole('button',{name:`Select sound ${number}`,exact:true}),target=dialog.getByRole('button',{name:pad,exact:true});
  await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
  const from=await source.boundingBox(),to=await target.boundingBox();expect(from).not.toBeNull();expect(to).not.toBeNull();
  const top=Math.min(from!.y,to!.y),bottom=Math.max(from!.y+from!.height,to!.y+to!.height);
  await dialog.getByRole('main',{name:'Slicing controls'}).evaluate((node,bounds)=>{const rect=node.getBoundingClientRect();if(bounds.top<rect.top+8)node.scrollTop+=bounds.top-rect.top-8;else if(bounds.bottom>rect.bottom-8)node.scrollTop+=bounds.bottom-rect.bottom+8;},{top,bottom});
  const body=await dialog.getByRole('main',{name:'Slicing controls'}).boundingBox(),start=await source.boundingBox(),end=await target.boundingBox();
  expect(start!.y).toBeGreaterThanOrEqual(body!.y);expect(end!.y+end!.height).toBeLessThanOrEqual(body!.y+body!.height);
  await source.dragTo(target);
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

const projectPadState=(manifest:ProjectManifest)=>manifest.project.drumSamples.map(({sampleId,...fields})=>{void sampleId;return fields;});

type SliceProvenance={sourceIdentity:string;sourceName:string;startFrame:number;endFrame:number;sourceFrameCount:number;sourceSampleRate:number;sourceChannels:number};
type ProjectManifest={
  project:{drumSamples:Array<{name:string;sampleId:string;assignedKey?:number;sourceIdentity?:string;sliceProvenance?:SliceProvenance}>};
  samples:Array<{id:string;name:string;audioPath:string;sourcePath?:string;metadata:{sampleRate:number;channels:number};audio:{frames:number;sampleRate:number;channels:number}}>;
};

async function readProject(bytes:Buffer) {
  const zip=await JSZip.loadAsync(bytes),file=zip.file('manifest.json');
  if(!file)throw new Error('Project backup has no manifest.json');
  return JSON.parse(await file.async('string')) as ProjectManifest;
}

test('direct slice replacement and existing-pad unassignment preserve originals, cancel, and atomic Undo/Redo',async({page})=>{
  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();await expectDrumLoaded(page,10);
  const backup=async()=>{const event=page.waitForEvent('download');await projectAction(page,'Download project');return downloadedBytes(await event);};
  const before=await backup();
  const open=async()=>{await page.getByRole('button',{name:'Slice this sample',exact:true}).click();const dialog=page.getByRole('dialog',{name:'slice audio'});await expect(dialog.getByRole('button',{name:'Select sound 1',exact:true})).toBeVisible();return dialog;};
  let dialog=await open();
  const selector=dialog.getByRole('button',{name:'Select sound 1',exact:true}),waveform=dialog.getByLabel('Sound 1 waveform');
  await selector.scrollIntoViewIfNeeded();const soundBox=await selector.boundingBox(),waveBox=await waveform.boundingBox();
  expect(soundBox!.y).toBeGreaterThanOrEqual(waveBox!.y+waveBox!.height-1);
  expect(soundBox!.y-waveBox!.y-waveBox!.height).toBeLessThan(100);
  await dragSoundToPad(dialog,1,'Pad 1, KD1, Seed Kick');
  await expect(dialog.getByRole('alert')).toContainText('preserve the existing sound');
  await expect(dialog.getByRole('button',{name:'Keep',exact:true})).toBeFocused();
  await expect(dialog.getByRole('button',{name:'Add sounds to kit'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Keep',exact:true}).click();
  await dragSoundToPad(dialog,1,'Pad 1, KD1, Seed Kick');
  await dialog.getByRole('button',{name:'Replace',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Pad 1, KD1, Sound 1',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Pad 3, SD1, Seed Snare',exact:true}).click();
  await expect(dialog.getByLabel('Destination pad')).toHaveValue('2');
  await dialog.getByRole('button',{name:'Unassign pad sound',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Pad 3, SD1, Empty',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expectDrumLoaded(page,10);
  const afterCancel=await backup();expect(projectPadState(await readProject(afterCancel))).toEqual(projectPadState(await readProject(before)));
  dialog=await open();
  await dragSoundToPad(dialog,1,'Pad 1, KD1, Seed Kick');
  await dialog.getByRole('button',{name:'Replace',exact:true}).click();
  await dialog.getByRole('button',{name:'Pad 3, SD1, Seed Snare',exact:true}).click();
  await dialog.getByRole('button',{name:'Unassign pad sound',exact:true}).click();
  const overflow=dialog.getByRole('checkbox');if(await overflow.count())await overflow.check();
  await dialog.getByRole('button',{name:'Add sounds to kit'}).click();await expect(dialog).not.toBeVisible();await expectDrumLoaded(page,9);
  const committed=await backup(),committedProject=await readProject(committed),originalProject=await readProject(before);
  for(const name of ['Seed Kick','Seed Snare']){
    const originalRef=originalProject.project.drumSamples.find(sample=>sample.name===name),retainedRef=committedProject.project.drumSamples.find(sample=>sample.name===name);
    expect(originalRef).toBeDefined();expect(retainedRef).toBeDefined();expect(retainedRef!.assignedKey).toBeUndefined();
    const original=originalProject.samples.find(sample=>sample.id===originalRef!.sampleId)!,retained=committedProject.samples.find(sample=>sample.id===retainedRef!.sampleId)!;
    expect(original).toBeDefined();expect(retained).toBeDefined();
    const oldZip=await JSZip.loadAsync(before),newZip=await JSZip.loadAsync(committed);
    expect(await newZip.file(retained.audioPath)!.async('uint8array')).toEqual(await oldZip.file(original.audioPath)!.async('uint8array'));
    if(original.sourcePath){expect(retained.sourcePath).toBeDefined();expect(await newZip.file(retained.sourcePath!)!.async('uint8array')).toEqual(await oldZip.file(original.sourcePath)!.async('uint8array'));}
  }
  expect(committedProject.project.drumSamples.find(sample=>sample.assignedKey===0)?.sliceProvenance).toBeTruthy();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expectDrumLoaded(page,10);
  expect(projectPadState(await readProject(await backup()))).toEqual(projectPadState(originalProject));
  await page.getByRole('button',{name:'Redo',exact:true}).click();await expectDrumLoaded(page,9);
  expect(projectPadState(await readProject(await backup()))).toEqual(projectPadState(committedProject));
});

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
  await dialog.getByText('Detection settings',{exact:true}).click();
  await dialog.getByText('Detailed timing',{exact:true}).click();
  await dialog.getByRole('button',{name:'Reset to full source'}).click();
  const sourceFrames=Number(await dialog.getByLabel('Sound 1 End frame').inputValue());
  expect(sourceFrames).toBe(48_000);
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
  // Short slice previews may finish before a Stop click becomes actionable.
  await expect(dialog.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
  const firstEnd=dialog.getByLabel('Sound 1 End frame');
  await firstEnd.click();
  await firstEnd.press('ControlOrMeta+A');
  await firstEnd.pressSequentially('10000');
  await firstEnd.press('Enter');
  await dialog.getByRole('button',{name:'Select sound 2'}).click();
  // Short slice previews may finish before a Stop click becomes actionable.
  await expect(dialog.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
  await expect(dialog.getByLabel('Sound 2 Start frame')).toHaveValue('12000');
  await dialog.getByRole('button',{name:'Select sound 1'}).click();
  await dragSoundToPad(dialog,1,'Pad 9, CH, Empty');
  await expect(dialog.getByRole('button',{name:'Pad 9, CH, Sound 1',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Select sound 2'}).click();
  // Short slice previews may finish before a Stop click becomes actionable.
  await expect(dialog.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
  await dialog.getByLabel('Destination pad').selectOption('2');
  await dialog.getByRole('button',{name:'Assign selected sound',exact:true}).click();
  await dialog.getByRole('button',{name:'Add sounds to kit'}).click();
  await expect(dialog).not.toBeVisible();
  await expectDrumLoaded(page,2);
  await expect(page.getByRole('region',{name:'Unassigned sounds'}).getByRole('button',{name:'browser-break.wav',exact:true})).toBeVisible();
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
  await expectDrumLoaded(page,2);
  await expect(page.getByRole('region',{name:'Unassigned sounds'}).getByRole('button',{name:'browser-break.wav',exact:true})).toBeVisible();
  const restoredBackupEvent=page.waitForEvent('download');
  await projectAction(page,'Download project');
  const restored=await readProject(await downloadedBytes(await restoredBackupEvent));
  expect(restored.project.drumSamples.filter(ref=>ref.sliceProvenance).map(ref=>ref.sliceProvenance)).toEqual(
    manifest.project.drumSamples.filter(ref=>ref.sliceProvenance).map(ref=>ref.sliceProvenance),
  );
});

// Regression contract: draft slice edits must not disappear via browser history.
test('edited slicing session survives browser Back until explicitly discarded',async({page})=>{
  await gotoWorkspace(page,'drum');
  const dialog=await openExternalSlicer(page);
  await dialog.getByLabel('Destination pad').selectOption('2');
  await dialog.getByRole('button',{name:'Assign selected sound',exact:true}).click();
  await page.goBack();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/drum$/);
  await expect(dialog.locator('[data-slice-pad="2"]')).toHaveAttribute('aria-label',/Sound 1/);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.goBack();
  await expect(page).toHaveURL(/#\/studio\/overview$/);
});


// A scrolling dialog must keep its final actions reachable, including at short/phone viewports.
for(const viewport of [{width:1280,height:720},{width:390,height:640}]) {
  test(`slicer groups, disclosure keyboard access and fixed footer at ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
    await page.setViewportSize(viewport);await gotoWorkspace(page,'drum');const dialog=await openExternalSlicer(page);
    const cancel=dialog.getByRole('button',{name:'Cancel',exact:true}),apply=dialog.getByRole('button',{name:'Add sounds to kit'});
    const footerBefore=await cancel.boundingBox();expect(footerBefore).not.toBeNull();
    expect(footerBefore!.y).toBeGreaterThanOrEqual(0);expect(footerBefore!.y+footerBefore!.height).toBeLessThanOrEqual(viewport.height);
    expect((await apply.boundingBox())!.x+(await apply.boundingBox())!.width).toBeLessThanOrEqual(viewport.width);
    const body=dialog.getByRole('main',{name:'Slicing controls'});await body.focus();await body.press('Home');
    const detection=dialog.getByText('Detection settings',{exact:true});await detection.focus();await detection.press('Enter');
    await expect(dialog.getByLabel('Detection sensitivity')).toBeVisible();
    await expect(detection).toBeFocused();
    await detection.press('Enter');await expect(dialog.getByLabel('Detection sensitivity')).not.toBeVisible();
    await dialog.getByRole('button',{name:'Split sound',exact:true}).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button',{name:'Split sound',exact:true})).toBeVisible();
    const timing=dialog.getByText('Detailed timing',{exact:true});await timing.focus();await timing.press('Enter');
    await expect(dialog.getByLabel('Sound 1 Start frame')).toBeVisible();
    await dialog.getByLabel('Destination pad').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('region',{name:'Assign to keys'})).toBeVisible();
    const footerAfter=await cancel.boundingBox();expect(footerAfter!.y).toBeCloseTo(footerBefore!.y,1);
    const geometry=await body.evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,width:el.clientWidth,contentWidth:el.scrollWidth,top:el.scrollTop}));
    expect(geometry.scroll).toBeGreaterThan(geometry.client);expect(geometry.top).toBeGreaterThan(0);expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.width+1);
    await expect(cancel).toBeVisible();await expect(apply).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('slicer-grouped.png')});
    await cancel.click();await expect(dialog).not.toBeVisible();await expectDrumLoaded(page,0);
  });
}
