import {test,expect} from './control-audit-test';

for(const task of ['Multisample a synth','Sample a sound','Build a drum kit'])test(`guided ${task} navigation help and import entry`,async({page})=>{
  await page.goto('/#/studio/create');
  await page.getByRole('button',{name:new RegExp(`^${task}`)}).click();
  if(task!=='Build a drum kit'){
    await page.getByRole('button',{name:/^Hardware synth/}).click();
    await page.getByRole('button',{name:'Connection help',exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('Hardware');
    await page.getByRole('button',{name:'Close Help',exact:true}).click();
    await page.getByRole('button',{name:'Continue to setup',exact:true}).click();
  }
  await expect(page.getByRole('heading',{name:'Before recording'})).toBeVisible();
  await page.getByRole('button',{name:'Setup help',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close Help',exact:true}).click();
  await page.getByRole('button',{name:'Open editor to import audio',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(task==='Build a drum kit'?'#/studio/drum$':'#/studio/multisample$'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('transfer actions open the expected workspace',async({page})=>{
  for(const action of ['Open library','Open drum kit editor (Project menu)','Open drum kit editor (Export OP-XY)']){
    await page.goto('/#/studio/transfer');
    await page.getByRole('button',{name:action,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(action==='Open library'?'#/studio/library$':'#/studio/drum$'));
  }
});

test('guided Back controls retain task choice without opening a recorder',async({page})=>{
 await page.goto('/#/studio/create');await page.getByRole('button',{name:/^Multisample a synth/}).click();
 await page.getByRole('button',{name:'← Back to Create',exact:true}).click();await expect(page).toHaveURL(/#\/studio\/create$/);
 await page.getByRole('button',{name:/^Multisample a synth/}).click();await page.getByRole('button',{name:/^Hardware synth/}).click();await page.getByRole('button',{name:'Continue to setup',exact:true}).click();
 await page.getByRole('button',{name:'← Back',exact:true}).click();await expect(page.getByRole('button',{name:/^Hardware synth/})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
});
