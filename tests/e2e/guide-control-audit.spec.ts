import {test,expect} from './control-audit-test';

for(const source of ['A software instrument','A hardware instrument'])test(`guided ${source} reaches source-specific connection help`,async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Choose a source',exact:true}).click();
 await page.getByRole('button',{name:new RegExp(source)}).click();
 await expect(page.getByRole('region',{name:source+' steps'})).toBeVisible();
 await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('dialog',{name:'Help',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Help',exact:true}).click();
 await page.getByRole('button',{name:'Connect and check sound',exact:true}).click();await expect(page.getByRole('dialog',{name:'Record takes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('drum setup help and import entry reach the drum editor',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Setup guide: build a drum kit',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Before recording'})).toBeVisible();await page.getByRole('button',{name:'Setup help',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close Help',exact:true}).click();await page.getByRole('button',{name:'Open editor to import audio',exact:true}).click();await expect(page).toHaveURL(/#\/studio\/drum$/);
});
test('transfer actions open the selected editor or library',async({page})=>{
 await page.goto('/#/studio/transfer');await page.getByRole('button',{name:'Browse saved instruments',exact:true}).click();await expect(page).toHaveURL(/#\/studio\/library$/);
 await page.getByRole('button',{name:'Transfer',exact:true}).click();await page.getByRole('button',{name:'Return to drum kit editor',exact:true}).click();await expect(page).toHaveURL(/#\/studio\/drum$/);
});
test('source Back returns to Overview without opening a recorder',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Choose a source',exact:true}).click();await page.getByRole('button',{name:/A hardware instrument/}).click();await page.getByRole('button',{name:'← Back to Overview',exact:true}).click();await expect(page).toHaveURL(/#\/studio\/overview$/);await expect(page.getByRole('dialog')).toHaveCount(0);
});
