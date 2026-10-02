import {test,expect} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';

test('focused drum controls persist modes trim and slider gestures with Undo',async({page})=>{
  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  const mode=editor.getByRole('combobox',{name:'Mode',exact:true});
  await expect(mode).toBeVisible();
  const originalMode=await mode.inputValue();
  for(const value of ['oneshot','group','loop','gate'].filter(value=>value!==originalMode)){
    await mode.selectOption(value);await expect(mode).toHaveValue(value);
    await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(mode).toHaveValue(originalMode);
  }
  for(const label of ['In point (seconds)','Out point (seconds)']) {
    const field=editor.getByLabel(label,{exact:true}),original=await field.inputValue();
    const changed=label.startsWith('In')?'0.01':String(Number(original)/2);
    await field.fill(changed);await field.blur();await expect(field).toHaveValue(changed);
    await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(field).toHaveValue(original);
  }
  for(const label of [/^Transpose/,/^Gain/,/^Pan/]) {
    const slider=editor.getByRole('slider',{name:label}),original=await slider.inputValue();
    await slider.focus();await page.keyboard.press('ArrowRight');await slider.blur();
    await expect(slider).toHaveValue(String(Number(original)+1));
    await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(slider).toHaveValue(original);
  }
});

test('focused drum moves a sound to an empty pad then Undo restores its position',async({page})=>{
  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  await expect(editor.getByRole('button',{name:'Play selected',exact:true})).toBeVisible();
  const original=await editor.getByRole('heading',{level:3}).textContent();
  await editor.getByLabel('Move or swap with pad').selectOption('23');
  await editor.getByRole('button',{name:'Move or swap',exact:true}).click();
  await expect(editor.getByRole('heading',{level:3})).toHaveText((original||'').replace('Pad 1','Pad 24'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  const lowerBank=page.getByRole('button',{name:'Lower pads 1–12',exact:true});
  if(await lowerBank.isVisible())await lowerBank.click();
  await page.locator('[data-drum-pad="0"]').click();
  await expect(editor.getByRole('heading',{level:3})).toHaveText(original||'');
});

test('focused drum clear cancellation preserves sound and confirmation is undoable',async({page})=>{
  await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  const editor=page.getByRole('region',{name:'Focused sample editor'}),title=editor.getByRole('heading',{level:3});
  await expect(editor.getByRole('button',{name:'Play selected',exact:true})).toBeVisible();
  const original=await title.textContent();
  await editor.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('button',{name:'cancel',exact:true}).click();await expect(title).toHaveText(original||'');
  await editor.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('button',{name:'ok',exact:true}).click();await expect(title).toContainText('Empty');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(title).toHaveText(original||'');
});
