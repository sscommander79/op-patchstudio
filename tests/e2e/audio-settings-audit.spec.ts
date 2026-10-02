import {test,expect} from './control-audit-test';
import {gotoWorkspace,openAdvanced} from './workspace-actions';
for(const workspace of ['drum','multisample'] as const)test(`${workspace} audio output controls and normalization retain Undo behavior`,async({page})=>{
 await gotoWorkspace(page,workspace);const settings=await openAdvanced(page,/Audio output and processing/);
 const selects=settings.locator('select');expect(await selects.count()).toBeGreaterThan(0);
 for(let i=0;i<await selects.count();i++){
  const select=selects.nth(i);if(!await select.isVisible())continue;
  const original=await select.inputValue(),values=await select.locator('option:not([disabled])').evaluateAll(items=>items.map(item=>(item as HTMLOptionElement).value));
  for(const value of values.filter(value=>value!==original)){
   await select.selectOption(value);await expect(select).toHaveValue(value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(select).toHaveValue(original);
  }
 }
 const normalize=settings.locator('#normalize-toggle');await settings.locator('#normalize-toggle_label').click();await expect(normalize).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(normalize).toHaveAttribute('aria-checked','false');
 const sliders=settings.getByRole('slider');
 for(let i=0;i<await sliders.count();i++){
  const slider=sliders.nth(i);if(!await slider.isVisible()||!await slider.isEnabled())continue;
  const original=await slider.getAttribute('aria-valuenow'),max=await slider.getAttribute('aria-valuemax');
  await slider.focus();await slider.press(original===max?'ArrowLeft':'ArrowRight');await slider.press('Tab');
  await expect(slider).not.toHaveAttribute('aria-valuenow',original!);
  if(await slider.getAttribute('id')==='normalize-level'){await expect(settings.getByText('normalization level: -0.1 dbfs',{exact:true})).toBeVisible();await expect(slider).toHaveAttribute('aria-valuetext','-0.1 dB');}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(slider).toHaveAttribute('aria-valuenow',original!);
 }
 await settings.locator('#normalize-toggle_label').click();await settings.getByRole('button',{name:'reset audio settings',exact:true}).click();
 await page.getByRole('button',{name:'cancel',exact:true}).click();await expect(normalize).toHaveAttribute('aria-checked','true');
 await settings.getByRole('button',{name:'reset audio settings',exact:true}).click();await page.getByRole('button',{name:'ok',exact:true}).click();await expect(normalize).toHaveAttribute('aria-checked','false');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(normalize).toHaveAttribute('aria-checked','true');
});
