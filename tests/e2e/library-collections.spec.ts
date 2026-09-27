import {test,expect,type Download} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {openWorkspace,projectAction} from './workspace-actions';
import {applyAudioImport} from './import-helpers';

function keyboardTone(){
  const frames=4410,bytes=Buffer.alloc(44+frames*2);
  bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
  bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(44100,24);bytes.writeUInt32LE(88200,28);
  bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++)bytes.writeInt16LE(Math.round(2400*Math.sin(2*Math.PI*220*i/44100)),44+i*2);
  return {name:'Stage-C4.wav',mimeType:'audio/wav',buffer:bytes};
}
async function assertBundle(download:Download){
  expect(await download.failure()).toBeNull();
  const file=await download.path();expect(file).not.toBeNull();
  const zip=await JSZip.loadAsync(await readFile(file!));
  const manifests=Object.keys(zip.files).filter(name=>name.endsWith('.preset/patch.json'));
  expect(manifests).toHaveLength(2);
  const regionCounts:number[]=[];
  for(const name of manifests){
    expect(name).not.toMatch(/(^|\/)\.\.(\/|$)/);
    const folder=name.slice(0,-'patch.json'.length);
    const patch=JSON.parse(await zip.file(name)!.async('string')) as {regions:Array<{sample:string;lokey:number;framecount:number}>};
    regionCounts.push(patch.regions.length);
    for(const region of patch.regions){
      const member=zip.file(folder+region.sample);expect(member,region.sample).not.toBeNull();
      const audio=await member!.async('uint8array');expect(Buffer.from(audio.subarray(0,4)).toString()).toBe('RIFF');
      expect(region.framecount).toBeGreaterThan(0);
    }
    if(patch.regions.length===10)expect(patch.regions.map(r=>r.lokey)).toEqual([53,55,57,58,60,61,63,65,69,70]);
  }
  expect(regionCounts.sort((a,b)=>a-b)).toEqual([1,10]);
}

async function openLibrarySection(page:import('@playwright/test').Page,name:string|RegExp){
  const section=page.getByRole('button',{name});
  const summary=page.getByText('Browse collections',{exact:true});
  const disclosure=page.locator('details.studio-library-collection-disclosure');
  await expect(async()=>{
    if(await summary.isVisible()&&!await disclosure.evaluate(element=>(element as HTMLDetailsElement).open))await summary.click();
    await expect(section).toBeVisible({timeout:500});
  }).toPass();
  await section.click();
}

test('collections retain mixed presets and export every member despite a search filter',async({page})=>{
  await page.goto('/');
  await openWorkspace(page,'drum');
  await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  await page.getByLabel('Instrument name',{exact:true}).fill('Stage drums');
  await page.getByLabel('Instrument name',{exact:true}).blur();
  await projectAction(page,'Save to library');
  await expect(page.getByText('Saved Stage drums to the library.',{exact:true})).toBeVisible();
  await openWorkspace(page,'multisample');
  await page.getByLabel('choose multisample audio files').setInputFiles(keyboardTone());
  await applyAudioImport(page);
  await page.getByLabel('Instrument name',{exact:true}).fill('Stage keys');
  await page.getByLabel('Instrument name',{exact:true}).blur();
  await projectAction(page,'Save to library');
  await expect(page.getByText('Saved Stage keys to the library.',{exact:true})).toBeVisible();
  await page.getByLabel('Instrument name',{exact:true}).fill('Keep my working instrument');
  await page.getByLabel('Instrument name',{exact:true}).blur();
  await openWorkspace(page,'library');
  await page.getByRole('button',{name:'New collection',exact:true}).click();
  await page.getByLabel('Collection name',{exact:true}).fill('Evening set');
  await page.getByRole('button',{name:'Create collection',exact:true}).click();
  await openLibrarySection(page,/^All presets/);
  await page.getByRole('checkbox',{name:'Select Stage drums',exact:true}).check();
  await page.getByRole('checkbox',{name:'Select Stage keys',exact:true}).check();
  await page.getByRole('button',{name:'Add to collection',exact:true}).click();
  await page.getByLabel('Choose collection',{exact:true}).selectOption({label:'Evening set'});
  await page.getByRole('dialog',{name:'Add to collection',exact:true}).getByRole('button',{name:'Add to collection',exact:true}).click();
  await openLibrarySection(page,'Collection Evening set');
  await expect(page.getByRole('checkbox',{name:'Select Stage drums',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Select Stage keys',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'Select Stage drums',exact:true}).check();
  await page.getByRole('checkbox',{name:'Select Stage keys',exact:true}).check();
  const selectedDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export selected',exact:true}).click();
  await assertBundle(await selectedDownload);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();
  const moveUp=page.getByRole('button',{name:'Move Stage drums up',exact:true});
  const firstAfterMove=await moveUp.isEnabled()?'Select Stage drums':'Select Stage keys';
  if(firstAfterMove==='Select Stage drums')await moveUp.click();
  else await page.getByRole('button',{name:'Move Stage keys up',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/^Select Stage /}).first()).toHaveAttribute('aria-label',firstAfterMove);
  await page.getByLabel('Search presets, descriptions, and tags',{exact:true}).fill('keys');
  await expect(page.getByRole('checkbox',{name:'Select Stage drums',exact:true})).toHaveCount(0);
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:/^Export collection/}).click();
  await assertBundle(await pending);
  await page.getByLabel('Search presets, descriptions, and tags',{exact:true}).fill('');
  const offlineNotice=page.getByRole('button',{name:'Later',exact:true});
  if(await offlineNotice.isVisible())await offlineNotice.click();
  await page.screenshot({path:'output/playwright/collections-desktop.png',fullPage:true});
  await openWorkspace(page,'multisample');
  await expect(page.getByLabel('Instrument name',{exact:true})).toHaveValue('Keep my working instrument');
  await page.reload();
  await page.getByRole('button',{name:'restore',exact:true}).click();
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Library'}).click();
  await openLibrarySection(page,'Collection Evening set');
  await expect(page.getByRole('checkbox',{name:'Select Stage drums',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Select Stage keys',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:/^Select Stage /}).first()).toHaveAttribute('aria-label',firstAfterMove);
  await page.getByRole('button',{name:'Rename collection',exact:true}).click();
  await page.getByLabel('Collection name',{exact:true}).fill('Evening show');
  await page.getByRole('button',{name:'Save collection name',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Evening show',exact:true})).toBeVisible();
  await page.setViewportSize({width:820,height:900});
  await expect.poll(async()=>{
    const preview=await page.getByRole('button',{name:'Preview first sample of Stage keys',exact:true}).boundingBox();
    const remove=await page.getByRole('button',{name:'Remove Stage keys from collection',exact:true}).boundingBox();
    return preview&&remove?remove.y-preview.y:Infinity;
  }).toBeLessThanOrEqual(220);
  await page.screenshot({path:'output/playwright/collections-medium.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'output/playwright/collections-narrow.png',fullPage:true});
  await page.getByRole('button',{name:'Remove Stage drums from collection',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Select Stage drums',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Delete collection',exact:true}).click();
  await page.getByRole('button',{name:'ok',exact:true}).click();
  await openLibrarySection(page,/^All presets/);
  await expect(page.getByRole('checkbox',{name:'Select Stage drums',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Select Stage keys',exact:true})).toBeVisible();
});
