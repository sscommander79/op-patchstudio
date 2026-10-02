import {test,expect} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';

for (const width of [1440,390]) {
  test(`drum table ${width}px settings Save Cancel and Undo preserve edits`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await gotoWorkspace(page,'drum');
    await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
    await page.getByRole('button',{name:'Table',exact:true}).click();
    const settings=page.getByTitle('settings',{exact:true}).first();
    await settings.click();
    const dialog=page.getByRole('dialog',{name:'sample options',exact:true});
    const mode=dialog.locator('select');
    await expect(mode).toHaveValue('oneshot');
    await mode.selectOption('loop');
    await dialog.getByRole('button',{name:'forward',exact:true}).click();
    for(const id of ['sample-transpose','sample-gain','sample-pan']) {
      const slider=dialog.locator(`[id="${id}"]`);
      await slider.focus();await page.keyboard.press('ArrowRight');
    }
    await dialog.getByRole('button',{name:'cancel',exact:true}).click();
    await expect(dialog).toBeHidden();await settings.click();
    await expect(mode).toHaveValue('oneshot');
    await expect(dialog.getByRole('button',{name:'forward',exact:true})).toBeVisible();
    await mode.selectOption('group');
    await dialog.getByRole('button',{name:'forward',exact:true}).click();
    await dialog.getByRole('button',{name:'save',exact:true}).click();
    await expect(dialog).toBeHidden();await settings.click();
    await expect(mode).toHaveValue('group');
    await expect(dialog.getByRole('button',{name:'reverse',exact:true})).toBeVisible();
    await dialog.getByRole('button',{name:'cancel',exact:true}).click();
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    await settings.click();await expect(mode).toHaveValue('oneshot');
    await expect(dialog.getByRole('button',{name:'forward',exact:true})).toBeVisible();
  });
  test(`drum table ${width}px clear and undo restore a loaded pad`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await gotoWorkspace(page,'drum');
    await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
    await page.getByRole('button',{name:'Table',exact:true}).click();
    const clear=page.getByTitle('clear',{exact:true}).first();
    await expect(clear).toBeEnabled();await clear.click();
    await page.getByRole('button',{name:'ok',exact:true}).click();
    await expect(clear).toBeDisabled();
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    await expect(clear).toBeEnabled();
  });
}

test('bulk editing all ten demo sounds is one undoable operation',async({page})=>{
  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  await expect(editor.getByRole('button',{name:'Play selected',exact:true})).toBeVisible();
  if(process.env.PLAYWRIGHT_PRODUCTION==='1')await expect(page.locator('.studio-pwa-notice')).toBeVisible();
  await page.getByRole('button',{name:'bulk edit',exact:true}).click();
  await expect(page.locator('.studio-pwa-notice')).not.toBeVisible();
  const dialog=page.getByRole('dialog');
  await dialog.locator('select').first().selectOption('gate');
  for(const [index,value] of ['12','-6','25'].entries())await dialog.locator('input[type="number"]').nth(index).fill(value);
  for(const index of [1,2]){const slider=dialog.locator('input[type="range"]').nth(index);const before=Number(await slider.inputValue());await slider.focus();await slider.press('ArrowRight');await expect(slider).toHaveValue(String(before+1));await slider.press('ArrowLeft');await expect(slider).toHaveValue(String(before));}
  await dialog.getByRole('button',{name:/apply to 10 samples/}).click();await expect(dialog).toBeHidden();
  await expect(editor.getByRole('combobox',{name:'Mode',exact:true})).toHaveValue('gate');
  await expect(editor.getByRole('slider',{name:'Transpose',exact:true})).toHaveValue('12');
  await expect(editor.getByRole('slider',{name:'Gain',exact:true})).toHaveValue('-6');
  await expect(editor.getByRole('slider',{name:'Pan',exact:true})).toHaveValue('25');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(editor.getByRole('combobox',{name:'Mode',exact:true})).toHaveValue('oneshot');
  await expect(editor.getByRole('slider',{name:'Transpose',exact:true})).toHaveValue('0');
  await expect(editor.getByRole('slider',{name:'Gain',exact:true})).toHaveValue('0');
  await expect(editor.getByRole('slider',{name:'Pan',exact:true})).toHaveValue('0');
});
