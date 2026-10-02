import {test,expect} from './control-audit-test';
import {gotoWorkspace,openAdvanced} from './workspace-actions';
import {applyAudioImport} from './import-helpers';
function tone(){
 const n=4800,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(10000*Math.sin(i/20)),44+2*i);return{name:'utility-C4.wav',mimeType:'audio/wav',buffer:b};
}
for(const workspace of ['drum','multisample'] as const)test(`${workspace} clear reset defaults and pin controls preserve Undo and persistence`,async({page,context,browser,baseURL})=>{
 await gotoWorkspace(page,workspace);
 if(workspace==='drum')await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
 else{await page.getByLabel('choose multisample audio files').setInputFiles(tone());await applyAudioImport(page);}
 const count=workspace==='drum'?10:1,prefix=workspace==='drum'?'Drum pad':'Multisample';
 const loaded=page.getByRole('region',{name:`${prefix} instrument, ${count} of 24 loaded`,exact:true});await expect(loaded).toBeVisible();
 const pin=loaded.locator('.pin-button');
 const wasPinned=(await loaded.getAttribute('class'))!.split(' ').includes('pinned');
 await pin.click();if(wasPinned)await expect(loaded).not.toHaveClass(/\bpinned\b/);else await expect(loaded).toHaveClass(/\bpinned\b/);
 await pin.click();if(wasPinned)await expect(loaded).toHaveClass(/\bpinned\b/);else await expect(loaded).not.toHaveClass(/\bpinned\b/);
 const name=page.getByLabel('Instrument name',{exact:true});await name.fill('Keep utility kit');await name.blur();
 for(const action of ['clear all','reset instrument']){
  await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('button',{name:'cancel',exact:true}).click();await expect(loaded).toBeVisible();await expect(name).toHaveValue('Keep utility kit');
  await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('button',{name:'ok',exact:true}).click();await expect(page.getByRole('region',{name:`${prefix} instrument, 0 of 24 loaded`,exact:true})).toBeVisible();
  if(action==='reset instrument')await expect(name).toHaveValue('');else await expect(name).toHaveValue('Keep utility kit');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(loaded).toBeVisible();await expect(name).toHaveValue('Keep utility kit');
 }
 const settings=await openAdvanced(page,/Audio output and processing/);await settings.locator('#normalize-toggle_label').click();await expect(settings.locator('#normalize-toggle')).toHaveAttribute('aria-checked','true');
 const menu=page.locator('details.studio-project-menu');await menu.locator('summary').click();await menu.getByRole('button',{name:'Save settings as default',exact:true}).click();
 const cookies=await context.cookies();expect(cookies.some(cookie=>decodeURIComponent(cookie.value).includes('"normalize":true'))).toBe(true);
 // A fresh browser context carries only saved defaults cookies, without session IndexedDB.
 const defaultsContext=await browser.newContext({baseURL,storageState:{cookies,origins:[]}});const fresh=await defaultsContext.newPage();await gotoWorkspace(fresh,workspace);const restored=await openAdvanced(fresh,/Audio output and processing/);await expect(restored.locator('#normalize-toggle')).toHaveAttribute('aria-checked','true');await defaultsContext.close();
});

test('drum organize control reveals both row drop zones and returns to playing',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await gotoWorkspace(page,'drum');
 const organize=page.getByRole('button',{name:'organize',exact:true});await organize.click();await expect(organize).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('region',{name:/Drop zone for lower row samples/})).toBeVisible();await expect(page.getByRole('region',{name:/Drop zone for upper row samples/})).toBeVisible();
 await organize.click();await expect(organize).toHaveAttribute('aria-pressed','false');await expect(page.getByRole('region',{name:/Drop zone for lower row samples/})).toHaveCount(0);
});
