import {test,expect} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';

test('demo add replace cancel and Undo preserve the existing instrument',async({page})=>{
 await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
 const count=page.getByRole('region',{name:'Drum pad instrument, 10 of 24 loaded',exact:true});await expect(count).toBeVisible();
 const open=()=>page.getByRole('button',{name:'Add demo kit',exact:true}).click();
 await open();const dialog=page.getByRole('dialog',{name:'Add the demo kit'});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(count).toBeVisible();
 await open();await dialog.getByRole('button',{name:'Close demo kit',exact:true}).click();await expect(count).toBeVisible();
 await open();await dialog.getByRole('button',{name:'Add to project',exact:true}).click();await expect(dialog).toBeHidden();
 await expect(page.getByRole('region',{name:'Drum pad instrument, 20 of 24 loaded',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(count).toBeVisible();
 const name=page.getByLabel('Instrument name',{exact:true});await name.fill('Keep this name');await name.blur();
 await open();await dialog.getByRole('button',{name:'Replace drum kit',exact:true}).click();await expect(dialog).toBeHidden();await expect(name).not.toHaveValue('Keep this name');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(name).toHaveValue('Keep this name');
});

test('first preset guide exports through preflight and remembers dismissal',async({page})=>{
 await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
 const guide=page.locator('details[aria-label="First preset guide"]');await expect(guide).toBeVisible();await guide.locator('summary').click();
 await guide.getByRole('button',{name:'Open export',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Export OP-XY preset'});await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Close export preflight',exact:true}).click();
 await guide.getByRole('button',{name:'Dismiss guide',exact:true}).click();await expect(guide).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('opstudio-first-preset-guide'))).toBe('dismissed');
});
