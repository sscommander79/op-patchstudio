import {expect,type Page} from '@playwright/test';

/** Complete the user-visible review introduced for every actual audio intake. */
export async function applyAudioImport(page:Page) {
  const dialog=page.getByRole('dialog',{name:'Import audio'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Apply import'})).toBeEnabled();
  await dialog.getByRole('button',{name:'Apply import'}).click();
  await expect(dialog).not.toBeVisible();
}
