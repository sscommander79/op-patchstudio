import {test,expect} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';
for(const width of [1440,390])test(`drum ${width}px row Play Record Slice and settings preview retain the instrument`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(()=>{
  const original=AudioBufferSourceNode.prototype.start;
  Object.defineProperty(window,'__auditPlayback',{value:0,writable:true});
  AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){(window as unknown as {__auditPlayback:number}).__auditPlayback++;return original.apply(this,args);};
 });
 await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();await page.getByRole('button',{name:'Table',exact:true}).click();
 const plays=()=>page.evaluate(()=>(window as unknown as {__auditPlayback:number}).__auditPlayback);
 const before=await plays();await page.getByTitle('play',{exact:true}).first().click();await expect.poll(plays).toBeGreaterThan(before);
 await page.getByTitle('record',{exact:true}).first().click();const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});await expect(recorder).toBeVisible();await recorder.getByRole('button',{name:'Close',exact:true}).click();await expect(recorder).toBeHidden();
 await page.getByTitle('slice this sample',{exact:true}).first().click();const slice=page.getByRole('dialog',{name:'slice audio',exact:true});await expect(slice).toBeVisible();await expect(slice.locator('canvas').first()).toBeVisible();await slice.getByRole('button',{name:'Cancel',exact:true}).click();await expect(slice).toBeHidden();
 await page.getByTitle('settings',{exact:true}).first().click();const settings=page.getByRole('dialog',{name:'sample options',exact:true});const beforePreview=await plays();await settings.getByRole('button',{name:/play.*\(p\)/i}).click();await expect.poll(plays).toBeGreaterThan(beforePreview);await settings.getByRole('button',{name:'cancel',exact:true}).click();
 await expect(page.getByRole('region',{name:'Drum pad instrument, 10 of 24 loaded',exact:true})).toBeVisible();
});
