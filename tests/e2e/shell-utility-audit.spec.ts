import {test,expect} from './control-audit-test';
import {gotoWorkspace,openWorkspace,projectAction} from './workspace-actions';

test('theme picker persists explicit choices and follows system changes',async({page})=>{
 await page.goto('/');const picker=page.getByRole('combobox',{name:'Theme',exact:true});
 for(const choice of ['dark','light']){
  await picker.selectOption(choice);await expect(page.locator('html')).toHaveAttribute('data-studio-theme',choice);
  await page.reload();await expect(picker).toHaveValue(choice);await expect(page.locator('html')).toHaveAttribute('data-studio-theme',choice);
 }
 await picker.selectOption('system');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-studio-theme','dark');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-studio-theme','light');
});

test('start new discards the offered session while retaining library presets',async({page})=>{
 await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
 const name=page.getByLabel('Instrument name',{exact:true});await name.fill('Recovery library keep');await name.blur();await projectAction(page,'Save to library');await expect(page.getByText('Saved Recovery library keep to the library.',{exact:true})).toBeVisible();
 await name.fill('Discard this draft');await name.blur();await expect(page.getByRole('status').filter({hasText:'Saved locally'})).toBeVisible();
 await page.reload();const recovery=page.getByRole('dialog',{name:'restore session',exact:true});await expect(recovery).toBeVisible();
 await recovery.getByRole('button',{name:'start new',exact:true}).click();await expect(recovery).toBeHidden();
 await openWorkspace(page,'drum');await expect(page.getByRole('region',{name:'Drum pad instrument, 0 of 24 loaded',exact:true})).toBeVisible();await expect(name).not.toHaveValue('Discard this draft');
 await openWorkspace(page,'library');await expect(page.getByRole('checkbox',{name:'Select Recovery library keep',exact:true})).toBeVisible();
});
