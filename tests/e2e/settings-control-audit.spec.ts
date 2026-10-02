import {expect,test} from './control-audit-test';
import {gotoWorkspace,openAdvanced,projectAction} from './workspace-actions';

// Disposable browser projects only. Exercise the public controls and the shared
// undo/redo contract; no physical MIDI/audio devices or saved user projects.
for (const workspace of ['drum','multisample'] as const) {
  test(`${workspace}: every persisted preset select option is editable and undoable`,async({page})=>{
    await gotoWorkspace(page,workspace);
    const settings=await openAdvanced(page,/Preset and performance settings/);
    if(workspace==='multisample')await settings.getByRole('heading',{name:'advanced',exact:true}).click();
    const selects=settings.locator('select[id]');
    expect(await selects.count()).toBeGreaterThan(0);
    for(let i=0;i<await selects.count();i++) {
      const select=selects.nth(i);
      if(!await select.isVisible()||!await select.isEnabled())continue;
      const original=await select.inputValue();
      const values=await select.locator('option:not([disabled])').evaluateAll(options=>options.map(o=>(o as HTMLOptionElement).value));
      for(const value of values.filter(v=>v!==original)) {
        await test.step(`${workspace} ${await select.getAttribute('id')} = ${value}`,async()=>{
          await select.selectOption(value);
          await expect(select).toHaveValue(value);
          await page.getByRole('button',{name:'Undo',exact:true}).click();
          await expect(select).toHaveValue(original);
          await page.getByRole('button',{name:'Redo',exact:true}).click();
          await expect(select).toHaveValue(value);
          await page.getByRole('button',{name:'Undo',exact:true}).click();
          await expect(select).toHaveValue(original);
        });
      }
    }
  });
  test(`${workspace}: every visible preset slider supports keyboard change and undo`,async({page})=>{
    await gotoWorkspace(page,workspace);
    const settings=await openAdvanced(page,/Preset and performance settings/);
    if(workspace==='multisample')await settings.getByRole('heading',{name:'advanced',exact:true}).click();
    const sliders=settings.getByRole('slider');
    expect(await sliders.count()).toBeGreaterThan(0);
    for(let i=0;i<await sliders.count();i++) {
      const slider=sliders.nth(i);
      if(!await slider.isVisible()||!await slider.isEnabled())continue;
      const original=await slider.getAttribute('aria-valuenow');
      const max=await slider.getAttribute('aria-valuemax');
      await test.step(`${workspace} slider ${await slider.getAttribute('id')||i}`,async()=>{
        await slider.focus();
        await slider.press(original===max?'ArrowLeft':'ArrowRight');
        await slider.press('Tab');
        await expect(slider).not.toHaveAttribute('aria-valuenow',original!);
        await page.getByRole('button',{name:'Undo',exact:true}).click();
        await expect(slider).toHaveAttribute('aria-valuenow',original!);
      });
    }
  });
}

test('Project menu Open library synchronizes the route and survives reload',async({page})=>{
  await gotoWorkspace(page,'drum');
  await projectAction(page,'Open library');
  await expect(page.getByRole('complementary',{name:'Library collections'})).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/library$/);
  await page.reload();
  await expect(page.getByRole('complementary',{name:'Library collections'})).toBeVisible();
});

test('repeated Back while recording does not grow browser history',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open sampler',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});
  await expect(recorder).toBeVisible();
  const length=await page.evaluate(()=>history.length);
  for(let attempt=0;attempt<3;attempt++){
    await page.goBack();
    await expect(page).toHaveURL(/#\/studio\/multisample$/);
    await expect(recorder).toBeVisible();
    expect(await page.evaluate(()=>history.length)).toBe(length);
  }
});
