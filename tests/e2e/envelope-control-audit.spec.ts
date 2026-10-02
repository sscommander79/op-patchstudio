import {test,expect} from './control-audit-test';
import {gotoWorkspace,openAdvanced} from './workspace-actions';
test('envelope knobs keyboard edit Undo and preset randomization remain coherent',async({page})=>{
 await gotoWorkspace(page,'multisample');const settings=await openAdvanced(page,/Preset and performance settings/);
 for(const name of ['attack','decay','sustain','release']){
  const knob=settings.getByRole('slider',{name,exact:true});await expect(knob).toBeVisible();const before=await knob.getAttribute('aria-valuenow');await knob.focus();await knob.press('ArrowRight');await knob.press('Tab');await expect(knob).not.toHaveAttribute('aria-valuenow',before!);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(knob).toHaveAttribute('aria-valuenow',before!);
 }
 const readValues=async()=>Promise.all(['attack','decay','sustain','release'].map(name=>settings.getByRole('slider',{name,exact:true}).getAttribute('aria-valuenow')));
 const before=await readValues();await settings.getByTitle('generate new random values',{exact:true}).click();await expect.poll(readValues).not.toEqual(before);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(readValues).toEqual(before);
 await settings.getByRole('slider',{name:'attack',exact:true}).press('End');await settings.getByRole('button',{name:/reset settings/}).click();await expect(settings.getByRole('button',{name:/reset settings/})).toBeDisabled();
});

test('multisample disclosures and loop controls support keyboard edits and Undo',async({page})=>{
 await gotoWorkspace(page,'multisample');const settings=await openAdvanced(page,/Preset and performance settings/);
 for(const name of ['Basic settings','Advanced settings','Envelopes and filters']){
  const header=settings.getByRole('button',{name,exact:true});const before=await header.getAttribute('aria-expanded');await header.focus();await header.press('Space');await expect(header).toHaveAttribute('aria-expanded',before==='true'?'false':'true');await header.press('Enter');await expect(header).toHaveAttribute('aria-expanded',before!);
 }
 const basic=settings.getByRole('button',{name:'Basic settings',exact:true});if(await basic.getAttribute('aria-expanded')!=='true')await basic.press('Enter');
 for(const id of ['multisample-loop-enabled','multisample-loop-onrelease']){
  const toggle=settings.locator('#'+id);const before=await toggle.getAttribute('aria-checked');await settings.locator('#'+id+'_label').click();await expect(toggle).toHaveAttribute('aria-checked',before==='true'?'false':'true');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(toggle).toHaveAttribute('aria-checked',before!);
 }
});
