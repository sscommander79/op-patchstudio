import { expect, type Download, type Page } from '@playwright/test';

export type StudioWorkspace='drum'|'multisample'|'library';

export async function openWorkspace(page:Page,workspace:StudioWorkspace) {
  const navigation=page.getByRole('navigation',{name:'Workspace'});
  if(workspace==='library')await navigation.getByRole('button',{name:'Library',exact:true}).click();
  else {
    const editor = page.getByRole('region', {name: workspace === 'drum' ? /Drum pad instrument/ : /Multisample instrument/});
    if (!(await editor.isVisible())) {
      await navigation.getByRole('button', {name:'Overview',exact:true}).click();
      await page.getByRole('button', {name:workspace==='drum'?'Open kit':'Open capture',exact:true}).click();
      if (workspace === 'multisample') {
        const recorder = page.getByRole('dialog', {name:'Record takes',exact:true});
        await expect(recorder).toBeVisible();
        await recorder.getByRole('button', {name:'Close',exact:true}).click();
      }
    }
  }
  if(workspace==='drum') await expect(page.getByRole('region',{name:/Drum pad instrument/})).toBeVisible();
  else if(workspace==='multisample') await expect(page.getByRole('region',{name:/Multisample instrument/})).toBeVisible();
  else await expect(page.getByRole('complementary',{name:'Library collections'})).toBeVisible();
}

export async function gotoWorkspace(page:Page,workspace:StudioWorkspace) {
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await openWorkspace(page,workspace);
}

export async function projectAction(page:Page,name:'Save to library'|'Download project'|'Open project'|'Open library') {
  const menu=page.locator('details.studio-project-menu');
  if(await menu.getAttribute('open')===null) await menu.locator('summary').click();
  const action=menu.getByRole('button',{name,exact:true});
  await expect(action).toBeVisible();
  await action.click();
}

export async function downloadDevicePreset(page:Page):Promise<Download> {
  await page.getByRole('button',{name:'Export OP-XY',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Export OP-XY preset'});
  await expect(dialog).toBeVisible();
  const event=page.waitForEvent('download');
  await dialog.getByRole('button',{name:'Download preset',exact:true}).click();
  const download=await event;
  await expect(dialog.getByRole('status',{name:'Preset download status'})).toContainText('browser created');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  return download;
}

export async function chooseDrumPadFile(page:Page,padName:string) {
  const desktop=page.getByRole('button',{name:padName,exact:true});
  const padByLabel:Record<string,number>={KD1:1,KD2:2,SD1:3,SD2:4,RIM:5,CLP:6,TB:7,SH:8,CH:9,CL:10,OH:11,CAB:12,LT1:13,RC:14,MT:15,CC:16,HT:17,COW:18,TRI:19,LT2:20,LC:21,WS:22,HC:23,GUI:24};
  const label=padName.split(' ')[0],mobile=page.getByRole('button',{name:new RegExp(`^Pad ${padByLabel[label]},`)});
  if(await desktop.count())await desktop.click();else await mobile.click();
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Add sample',exact:true}).click();
  return chooser;
}

export async function openAdvanced(page:Page,name:RegExp) {
  const details=page.locator('details.studio-advanced-disclosure').filter({hasText:name}).first();
  if(await details.getAttribute('open')===null) await details.locator('summary').click();
  return details;
}

export async function expectDrumLoaded(page:Page,count:number) {
  await expect(page.getByRole('region',{name:`Drum pad instrument, ${count} of 24 loaded`})).toBeVisible();
}

export async function expectMultisampleLoaded(page:Page,count:number) {
  await expect(page.getByRole('region',{name:`Multisample instrument, ${count} of 24 loaded`})).toBeVisible();
}
