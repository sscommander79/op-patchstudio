import {expect,test} from '@playwright/test';
import {openWorkspace} from './workspace-actions';

for (const width of [1440, 1024]) {
  test(`desktop drum workbench keeps both banks beside the editor at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await openWorkspace(page,'drum');

    const performance=await page.locator('.studio-editor-stage--drum .studio-performance-column').boundingBox();
    const editor=await page.locator('.studio-editor-stage--drum .studio-editor-column').boundingBox();
    expect(performance).not.toBeNull();
    expect(editor).not.toBeNull();
    expect(editor!.x).toBeGreaterThanOrEqual(performance!.x+performance!.width-2);
    expect(Math.abs(editor!.y-performance!.y)).toBeLessThanOrEqual(2);

    const banks=page.locator('.studio-desktop-pad-bank');
    const lower=await banks.nth(0).boundingBox();
    const upper=await banks.nth(1).boundingBox();
    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(upper!.y).toBeGreaterThanOrEqual(lower!.y+lower!.height-2);
    expect(Math.abs(upper!.x-lower!.x)).toBeLessThanOrEqual(2);

    const key=await page.locator('[data-drum-pad="0"]').boundingBox();
    const state=await page.locator('[data-drum-pad="0"] .studio-drum-pad-status').boundingBox();
    expect(key).not.toBeNull();
    expect(state).not.toBeNull();
    expect(state!.y).toBeGreaterThanOrEqual(key!.y+key!.height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

for(const width of [1280,900,770]){
  test(`all desktop drum pads remain reachable at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await openWorkspace(page,'drum');
    const pads=page.getByRole('group',{name:'Drum keyboard',exact:true});
    await expect(pads.locator('[data-drum-pad]')).toHaveCount(24);
    const w=await pads.locator('[data-drum-pad="1"]').boundingBox();
    const a=await pads.locator('[data-drum-pad="0"]').boundingBox();
    const s=await pads.locator('[data-drum-pad="2"]').boundingBox();
    expect(w).not.toBeNull();expect(a).not.toBeNull();expect(s).not.toBeNull();
    expect(w!.y+w!.height).toBeLessThanOrEqual(a!.y);
    expect(w!.x+w!.width/2).toBeGreaterThan(a!.x+a!.width/2);
    expect(w!.x+w!.width/2).toBeLessThan(s!.x+s!.width/2);
    const statusSize=await pads.locator('[data-drum-pad="0"] .studio-drum-pad-status').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(statusSize).toBeGreaterThanOrEqual(10);
    const lowerLabelAlignment=await pads.locator('[data-drum-pad="0"]').evaluate(el=>getComputedStyle(el).textAlign);
    expect(lowerLabelAlignment).toBe('center');
    await expect(pads.getByText('Lower pads · 1–12')).toBeVisible();
    await expect(pads.getByText('Upper pads · 13–24')).toBeVisible();
    const last=pads.locator('[data-drum-pad="23"]');
    const bank=page.getByRole('group',{name:'Upper octave drum keys',exact:true});
    const bounds=await bank.boundingBox(),lastBounds=await last.boundingBox();
    expect(bounds).not.toBeNull();expect(lastBounds).not.toBeNull();
    expect(lastBounds!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(lastBounds!.x+lastBounds!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width);
    await last.click();
    await expect(page.getByRole('heading',{name:'Pad 24 · Empty'})).toBeVisible();
    const first=pads.locator('[data-drum-pad="0"]');
    await first.click();
    await expect(page.getByRole('heading',{name:'Pad 1 · Empty'})).toBeVisible();
    await expect(first.locator('.studio-drum-pad-status')).toHaveText('SELECTED');
    await expect(last.locator('.studio-drum-pad-status')).toHaveText('EMPTY');
    await pads.locator('[data-drum-pad="11"]').press('ArrowRight');
    await expect(pads.locator('[data-drum-pad="12"]')).toBeFocused();
    const actions=page.getByLabel('Add and create sounds');
    const add=await actions.getByRole('button',{name:'Add sounds'}).boundingBox();
    const record=await actions.getByRole('button',{name:'Record takes'}).boundingBox();
    expect(add).not.toBeNull();expect(record).not.toBeNull();
    expect(record!.y).toBe(add!.y);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('phone bank controls still expose all 24 drum slots',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await openWorkspace(page,'drum');
  const pads=page.getByRole('group',{name:'Drum keyboard',exact:true});
  await expect(pads.locator('[data-drum-pad]')).toHaveCount(12);
  const upperRow=await pads.locator('.studio-pad-row--upper').boundingBox();
  const lowerRow=await pads.locator('.studio-pad-row--lower').boundingBox();
  expect(upperRow).not.toBeNull();expect(lowerRow).not.toBeNull();
  expect(lowerRow!.y).toBeGreaterThanOrEqual(upperRow!.y+upperRow!.height);
  const grid=await pads.locator('.studio-mobile-pad-grid').boundingBox();
  const lastLowerKey=await pads.locator('[data-drum-pad="11"]').boundingBox();
  expect(grid).not.toBeNull();expect(lastLowerKey).not.toBeNull();
  expect(lastLowerKey!.width).toBeGreaterThanOrEqual(44);
  expect(lastLowerKey!.x+lastLowerKey!.width).toBeLessThanOrEqual(grid!.x+grid!.width);
  const upperKey=await pads.locator('[data-drum-pad="1"]').boundingBox();
  const upperStatus=await pads.locator('[data-drum-pad="1"] .studio-drum-pad-status').boundingBox();
  expect(upperKey).not.toBeNull();expect(upperStatus).not.toBeNull();
  expect(upperStatus!.y).toBeGreaterThanOrEqual(upperKey!.y+upperKey!.height);
  expect(lowerRow!.y).toBeGreaterThanOrEqual(upperStatus!.y+upperStatus!.height);
  await pads.getByRole('button',{name:'Upper pads 13–24',exact:true}).click();
  await pads.locator('[data-drum-pad="23"]').click();
  await expect(page.getByRole('heading',{name:'Pad 24 · Empty'})).toBeVisible();
  await pads.getByRole('button',{name:'Lower pads 1–12',exact:true}).click();
  await pads.locator('[data-drum-pad="0"]').click();
  await expect(page.getByRole('heading',{name:'Pad 1 · Empty'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('loaded labels remain legible on the narrow drum keys',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await openWorkspace(page,'drum');
  await page.getByRole('button',{name:'Load demo kit'}).click();
  const loadedLabels=page.locator('.studio-mobile-pad-grid .studio-pad-row--lower [data-pad-state="loaded"] .studio-drum-pad-status');
  await expect(loadedLabels.first()).toBeVisible();
  const clipped=await loadedLabels.evaluateAll(labels=>labels.filter(label=>label.scrollWidth>label.clientWidth).length);
  expect(clipped).toBe(0);
});
