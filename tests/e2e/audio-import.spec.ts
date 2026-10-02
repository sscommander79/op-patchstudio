import {expect,test,type Download} from './control-audit-test';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {expectDrumLoaded, expectMultisampleLoaded, gotoWorkspace, openWorkspace, projectAction} from './workspace-actions';

const fixture=(name:string)=>path.join(process.cwd(),'tests/fixtures/task7-audio',name);
async function downloadedBytes(download:Download){expect(await download.failure()).toBeNull();const saved=await download.path();if(!saved)throw new Error('Project download produced no file');return readFile(saved);}
async function inspectProject(bytes:Buffer){const zip=await JSZip.loadAsync(bytes),entry=zip.file('manifest.json');if(!entry)throw new Error('Project backup has no manifest');return {zip,manifest:JSON.parse(await entry.async('string')) as {samples:Array<{name:string;sourcePath?:string;metadata:Record<string,unknown>;audio:{frames:number;sampleRate:number;channels:number}}>}};}

test('actual codec files stay truthful through chooser review, one Apply, and Undo',async({page})=>{
  await gotoWorkspace(page,'drum');
  const names=['original.wav','original-44100.wav','sample.aiff','sample.mp3','sample-44100.mp3','sample.flac','sample.m4a','sample.ogg','sample-vorbis.ogg'];
  await page.getByLabel('choose drum audio files').setInputFiles(names.map(fixture));
  const dialog=page.getByRole('dialog',{name:'Import audio'});await expect(dialog).toBeVisible();
  const expectedPrepared=9;await expect(dialog.getByLabel(/^Include /)).toHaveCount(expectedPrepared);
  await expect(dialog.getByLabel('Include sample.m4a')).toBeVisible();
  const compressed=dialog.getByLabel('Include sample-44100.mp3').locator('xpath=ancestor::li');
  await expect(compressed).toContainText('source bit depth unknown');await expect(compressed).toContainText('source rate unknown');await expect(compressed).toContainText(/decoded 48000 Hz/);
  const wave=dialog.getByLabel('Include original-44100.wav').locator('xpath=ancestor::li');await expect(wave).toContainText('source rate 44100 Hz');
  await dialog.getByRole('button',{name:'Apply import'}).click();await expect(dialog).not.toBeVisible();await expectDrumLoaded(page,0);await expect(page.getByRole('region',{name:'Unassigned sounds'}).getByRole('listitem')).toHaveCount(expectedPrepared);

  const backupEvent=page.waitForEvent('download');await projectAction(page,'Download project');const backup=await backupEvent,backupBytes=await downloadedBytes(backup);
  const saved=await inspectProject(backupBytes),mp3=saved.manifest.samples.find(sample=>sample.name==='sample-44100.mp3');
  expect(mp3?.sourcePath).toBeTruthy();expect(mp3?.metadata).not.toHaveProperty('bitDepth');expect(mp3?.metadata).not.toHaveProperty('sampleRate');expect(mp3?.metadata).not.toHaveProperty('channels');
  expect(mp3?.audio.sampleRate).toBe(48_000);expect(mp3?.audio.frames).toBeGreaterThan(8_000);
  expect(Buffer.from(await saved.zip.file(mp3!.sourcePath!)!.async('uint8array'))).toEqual(await readFile(fixture('sample-44100.mp3')));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expectDrumLoaded(page,0);await expect(page.getByRole('region',{name:'Unassigned sounds'}).getByRole('listitem')).toHaveCount(0);
  const chooser=page.waitForEvent('filechooser');await projectAction(page,'Open project');await (await chooser).setFiles({name:backup.suggestedFilename(),mimeType:'application/zip',buffer:backupBytes});
  await expectDrumLoaded(page,0);await expect(page.getByRole('region',{name:'Unassigned sounds'}).getByRole('listitem')).toHaveCount(expectedPrepared);
  const restoredEvent=page.waitForEvent('download');await projectAction(page,'Download project');const restored=await inspectProject(await downloadedBytes(await restoredEvent));const restoredMp3=restored.manifest.samples.find(sample=>sample.name==='sample-44100.mp3');
  expect(restoredMp3?.metadata).not.toHaveProperty('sampleRate');expect(Buffer.from(await restored.zip.file(restoredMp3!.sourcePath!)!.async('uint8array'))).toEqual(await readFile(fixture('sample-44100.mp3')));
});

test('desktop row multi-chooser is one reviewed batch with collision-free explicit pads',async({page},testInfo)=>{
  test.skip(testInfo.project.name.startsWith('Mobile'),'desktop row chooser acceptance');
  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Table',exact:true}).click();await page.getByLabel('choose drum row 1 audio files').setInputFiles([
    {name:'texture.wav',mimeType:'audio/wav',buffer:await readFile(fixture('original.wav'))},
    {name:'kick.wav',mimeType:'audio/wav',buffer:await readFile(fixture('original.wav'))},
  ]);
  const dialog=page.getByRole('dialog',{name:'Import audio'});await expect(dialog.getByLabel(/^Include /)).toHaveCount(2);
  await expect(dialog.getByLabel('Destination for texture.wav')).toHaveValue('pad:0');await expect(dialog.getByLabel('Destination for kick.wav')).toHaveValue('pad:1');
  await dialog.getByRole('button',{name:'Apply import'}).click();await expectDrumLoaded(page,2);await page.getByRole('button',{name:'Undo',exact:true}).click();await expectDrumLoaded(page,0);
});

test('one sound added after selecting SD2 loads into SD2 rather than the first matching snare pad',async({page})=>{
  await gotoWorkspace(page,'drum');
  await page.getByRole('button',{name:/^(SD2 drum key|Pad 4, SD2,)/}).click();
  await page.getByLabel('choose drum audio files').setInputFiles({name:'snare.wav',mimeType:'audio/wav',buffer:await readFile(fixture('original.wav'))});
  await expect(page.getByRole('heading',{name:'Pad 4 · snare.wav'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Import audio'})).not.toBeVisible();
  await page.getByRole('button',{name:/^(SD1 drum key|Pad 3, SD1,)/}).click();
  await expect(page.getByRole('heading',{name:'Pad 3 · Empty'})).toBeVisible();
});

test('Replace on a loaded pad proposes that pad and applies the replacement',async({page})=>{
  await gotoWorkspace(page,'drum');
  await page.getByRole('button',{name:/^(SD1 drum key|Pad 3, SD1,)/}).click();
  await page.getByLabel('Choose audio for pad 3').setInputFiles({name:'old-snare.wav',mimeType:'audio/wav',buffer:await readFile(fixture('original.wav'))});
  await expect(page.getByRole('heading',{name:'Pad 3 · old-snare.wav'})).toBeVisible();
  await page.getByRole('button',{name:'Replace',exact:true}).click();
  await page.getByLabel('Choose audio for pad 3').setInputFiles({name:'new-snare.wav',mimeType:'audio/wav',buffer:await readFile(fixture('original.wav'))});
  const dialog=page.getByRole('dialog',{name:'Import audio'});
  await expect(dialog.getByLabel('Destination for new-snare.wav')).toHaveValue('replace:2');
  await dialog.getByRole('button',{name:'Apply import'}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'Pad 3 · new-snare.wav'})).toBeVisible();
});

test('actual chooser sends unknown-extension, empty, and unsupported files to shared review classification',async({page})=>{
  await gotoWorkspace(page,'multisample');
  await page.getByLabel('choose multisample audio files').setInputFiles([
    {name:'C4.weird',mimeType:'',buffer:await readFile(fixture('original.wav'))},
    {name:'empty.wav',mimeType:'audio/wav',buffer:Buffer.alloc(0)},
    {name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('plain text')},
  ]);
  const dialog=page.getByRole('dialog',{name:'Import audio'});await expect(dialog.getByLabel('Include C4.weird')).toBeVisible();await expect(dialog).toContainText(/empty\.wav:.*empty/i);await expect(dialog).toContainText(/unsupported\.txt:.*(unsupported|signature|audio)/i);
  await dialog.getByRole('button',{name:'Cancel import'}).click();await expectMultisampleLoaded(page,0);
});

test('malformed patch settings are rejected in both modes without changing settings',async({page})=>{
  await gotoWorkspace(page,'drum');const invalid=Buffer.from(JSON.stringify({type:'drum',engine:{playmode:['mono']}}));
  await page.getByLabel('choose drum patch settings').setInputFiles({name:'patch.json',mimeType:'application/json',buffer:invalid});await expect(page.getByText('import failed',{exact:true}).last()).toBeVisible();await expect(page.locator('#preset-playmode')).toHaveValue('poly');
  await openWorkspace(page,'multisample');const invalidMulti=Buffer.from(JSON.stringify({type:'multisampler',engine:{playmode:['mono']}}));
  await page.getByLabel('choose multisample patch settings').setInputFiles({name:'patch.json',mimeType:'application/json',buffer:invalidMulti});await expect(page.getByText('import failed',{exact:true}).last()).toBeVisible();await expect(page.locator('#playmode')).toHaveValue('poly');
});

test('a captured nested drop keeps a valid sibling and reports the blocked child',async({page})=>{
  await gotoWorkspace(page,'drum');const wav=Array.from(await readFile(fixture('original.wav')));
  await page.evaluate(bytes=>{const good=new File([new Uint8Array(bytes)],'good.wav',{type:'audio/wav'});let batch=0;const blocked={name:'blocked.wav',isFile:true,isDirectory:false,file:(_ok:unknown,fail:(error:Error)=>void)=>queueMicrotask(()=>fail(new Error('permission denied')))};const valid={name:'good.wav',isFile:true,isDirectory:false,file:(ok:(file:File)=>void)=>queueMicrotask(()=>ok(good))};const directory={name:'kit',isFile:false,isDirectory:true,createReader:()=>({readEntries:(ok:(entries:unknown[])=>void)=>queueMicrotask(()=>ok(batch++===0?[blocked,valid]:[]))})};const transfer={types:['Files'],files:[],items:[{kind:'file',type:'',getAsFile:()=>null,webkitGetAsEntry:()=>directory}]};const event=new DragEvent('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:transfer});document.querySelector<HTMLElement>('[data-audio-import="drum"]')!.dispatchEvent(event);},wav);
  const dialog=page.getByRole('dialog',{name:'Import audio'});await expect(dialog.getByLabel('Include good.wav')).toBeVisible();await expect(dialog).toContainText('permission denied');await dialog.getByRole('button',{name:'Cancel import'}).click();await expectDrumLoaded(page,0);
});
