import {test,expect} from './control-audit-test';
import {gotoWorkspace,openWorkspace,projectAction} from './workspace-actions';
for(const width of [1440,390])test(`library ${width}px favorites and collection down/remove retain saved presets`,async({page})=>{
 await page.setViewportSize({width,height:1000});await gotoWorkspace(page,'drum');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
 for(const name of ['First audit kit','Second audit kit']){
  await page.getByLabel('Instrument name',{exact:true}).fill(name);await page.getByLabel('Instrument name',{exact:true}).blur();await projectAction(page,'Save to library');await expect(page.getByText(`Saved ${name} to the library.`,{exact:true})).toBeVisible();
 }
 await openWorkspace(page,'library');await page.getByTitle('add to favorites',{exact:true}).first().click();
 const scope=page.getByRole('complementary',{name:'Library collections'});const browse=scope.locator('details');if(await browse.getAttribute('open')===null)await browse.locator('summary').click();await scope.getByRole('button',{name:/^Favorites/}).click();
 await expect(page.getByRole('checkbox',{name:/^Select .*audit kit$/})).toHaveCount(1);await page.getByTitle('remove from favorites',{exact:true}).click();await expect(page.getByRole('checkbox',{name:/^Select .*audit kit$/})).toHaveCount(0);
 await scope.getByRole('button',{name:/^All presets/}).click();await page.getByRole('button',{name:'New collection',exact:true}).click();await page.getByLabel('Collection name',{exact:true}).fill('Audit order');await page.getByRole('button',{name:'Create collection',exact:true}).click();await scope.getByRole('button',{name:/^All presets/}).click();
 for(const name of ['First audit kit','Second audit kit'])await page.getByRole('checkbox',{name:`Select ${name}`,exact:true}).check();
 await page.getByRole('button',{name:'Add to collection',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add to collection',exact:true});await dialog.getByLabel('Choose collection',{exact:true}).selectOption({label:'Audit order'});await dialog.getByRole('button',{name:'Add to collection',exact:true}).click();await scope.getByRole('button',{name:'Collection Audit order',exact:true}).click();
 const rows=page.getByRole('checkbox',{name:/^Select .*audit kit$/});const first=(await rows.first().getAttribute('aria-label'))!.replace('Select ','');
 await page.getByRole('button',{name:`Move ${first} down`,exact:true}).click();await expect(rows.last()).toHaveAttribute('aria-label',`Select ${first}`);
 await page.getByRole('button',{name:`Move ${first} up`,exact:true}).click();await expect(rows.first()).toHaveAttribute('aria-label',`Select ${first}`);
 await page.getByRole('button',{name:`Remove ${first} from collection`,exact:true}).click();await expect(rows).toHaveCount(1);await scope.getByRole('button',{name:/^All presets/}).click();await expect(rows).toHaveCount(2);
});
