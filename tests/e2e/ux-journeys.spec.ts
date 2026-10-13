import {test,expect} from '@playwright/test';
import path from 'node:path';
const fixture=path.resolve('tests/fixtures/task7-audio/original-44100.wav');

test('one recording uses musical import review and finishes in the editable instrument',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add audio file',exact:true})).toBeVisible();
  await page.getByLabel('Instrument audio files').setInputFiles(fixture);
  const review=page.getByRole('dialog',{name:'Import audio'});
  await expect(review).toBeVisible();
  await expect(review.getByLabel('Recorded note for original-44100.wav')).toHaveValue('');
  await expect(review.getByLabel('Include original-44100.wav')).toBeDisabled();
  await review.getByLabel('Recorded note for original-44100.wav').selectOption('60');
  await expect(review.getByLabel('Include original-44100.wav')).toBeChecked();
  await review.getByRole('button',{name:'Add selected sounds'}).click();
  await expect(review).toBeHidden();
  await expect(page.getByRole('heading',{level:1,name:'Multisample editor'})).toBeAttached();
  await expect(page.getByRole('region',{name:'Multisample instrument, 1 of 24 loaded'})).toBeVisible();
  await page.getByRole('textbox',{name:'Instrument name',exact:true}).fill('Journey test');
  await page.getByText('Project',{exact:true}).click();
  await page.getByRole('button',{name:'Save to library',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved playable instrument “Journey test” to the library in this browser.'})).toBeVisible();
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByText('Journey test',{exact:true})).toBeVisible();
});

test('source routes reach recording without claiming the browser runs the plugin',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await page.getByRole('button',{name:/A software instrument/}).click();
  await expect(page.getByRole('region',{name:'A software instrument steps'})).toContainText('Your music software runs the instrument');
  await page.getByRole('button',{name:'Connect and check sound',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes'});await expect(recorder).toBeVisible();
  await expect(recorder).toContainText(/music software/i);
  await page.keyboard.press('Escape');await expect(recorder).toBeHidden();
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await page.getByRole('button',{name:/A hardware instrument/}).click();await page.getByRole('button',{name:'Connect and check sound',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Record takes'})).toBeVisible();
});

test('source cards reflow and keyboard focus reaches optional help at narrow widths',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add audio file',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'Help',exact:true}).click();
  const help=page.getByRole('dialog',{name:'Help'});await expect(help).toBeVisible();
  await help.getByRole('searchbox',{name:'Search help'}).fill('zzzzmissing');
  await help.getByRole('button',{name:'Clear search'}).click();
  await expect(help.getByRole('heading',{name:'Choose a task'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(help).toBeHidden();
});

test('transfer exposes real backup actions and describes manual device copying',async({page})=>{
  await page.goto('/#/studio/transfer');
  await expect(page.getByRole('heading',{name:'Back up and transfer'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Back up project',exact:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Download OP-XY preset',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'How to copy to OP-XY'})).toBeVisible();
  await expect(page.getByText('The app cannot confirm that you copied or played it on your OP-XY.')).toBeVisible();
});

for(const width of [390,768,1024,1440])for(const appearance of ['field','opxy'])for(const theme of ['light','dark']){
  test(`populated instrument fits ${width}px ${appearance} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(({appearance,theme})=>{localStorage.setItem('opstudio-appearance',appearance);localStorage.setItem('opstudio-theme',theme);},{appearance,theme});
    await page.goto('/');await page.getByRole('button',{name:'Choose a source',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByLabel('Instrument audio files').setInputFiles(fixture);
    await page.getByLabel('Recorded note for original-44100.wav').selectOption('60');
    await page.getByRole('button',{name:'Add selected sounds'}).click();
    const editor=page.getByRole('region',{name:'Focused multisample editor'});
    await expect(editor).toContainText('original-44100.wav');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    const editorBox=await editor.boundingBox(),guideBox=await page.getByRole('complementary',{name:'Multisampling guide'}).boundingBox();
    expect(editorBox!.y).toBeLessThan(guideBox!.y+120);
    const original=page.locator('[data-multisample-root="60"]');
    await expect(original).toHaveClass(/studio-original-note/);
    await expect.poll(async()=>{const k=await original.boundingBox();return !!k&&k.x>=0&&k.x+k.width<=width;}).toBe(true);
    const notifications=page.getByRole('button',{name:/Dismiss .* notification/});
    for(const close of await notifications.all())await close.click();
    await page.screenshot({path:`/Users/stevencommander/Documents/ChatGPT/OPXY/design/project-ux-implementation-2026-10-06/evidence/editor-${appearance}-${theme}-${width}.png`});
  });
}
