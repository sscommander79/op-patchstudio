import path from 'node:path';
import {test,expect,type Page} from './control-audit-test';
import {applyAudioImport} from './import-helpers';
import {expectDrumLoaded,expectMultisampleLoaded,gotoWorkspace,openWorkspace} from './workspace-actions';

const fixture=path.resolve('tests/fixtures/task7-audio/original-44100.wav');
const GUARD_NOTICE='Finish or close the open dialog before changing workspaces. Your work remains here.';

// The notice sits behind the modal backdrop, so it is matched by structure rather than by accessible role.
const guardNotice=(page:Page)=>page.locator('.studio-shell-content p.studio-message-warning[role="alert"]');
const location=(page:Page)=>page.locator('.studio-shell-location strong');
const footerLink=(page:Page,name:'Feedback'|'Support the project')=>page.getByRole('navigation',{name:'Project information'}).getByRole('link',{name,exact:true});
const sourceHeading=(page:Page)=>page.getByRole('heading',{level:1,name:'Where will your sound come from?',exact:true});
const setupHeading=(page:Page)=>page.getByRole('heading',{level:1,name:'Build your kit',exact:true});
const createHeading=(page:Page)=>page.getByRole('heading',{level:1,name:'What would you like to make?',exact:true});
// A real address-bar or link hash change; the footer links are covered by the modal backdrop.
const changeHash=(page:Page,hash:string)=>page.evaluate(next=>{window.location.hash=next;},hash);

async function openDrumRecorder(page:Page) {
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Record a sound',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});
  await expect(recorder).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/drum$/);
  return recorder;
}

test('source and setup deep links survive reload as distinct pages and the legacy create route still works',async({page})=>{
  await page.goto('/#/studio/source');
  await expect(sourceHeading(page)).toBeVisible();
  await expect(location(page)).toHaveText('Choose source');
  await page.reload();
  await expect(sourceHeading(page)).toBeVisible();
  await expect(setupHeading(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/studio\/source$/);

  await page.goto('/#/studio/setup');
  await expect(setupHeading(page)).toBeVisible();
  await expect(location(page)).toHaveText('Set up');
  await page.reload();
  await expect(setupHeading(page)).toBeVisible();
  await expect(sourceHeading(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/studio\/setup$/);

  await page.goto('/#/studio/create');
  await expect(createHeading(page)).toBeVisible();
  await expect(location(page)).toHaveText('Create');
  await page.reload();
  await expect(createHeading(page)).toBeVisible();
  await page.getByRole('button',{name:/^Make a playable instrument/}).click();
  await expect(page).toHaveURL(/#\/studio\/source$/);
  await page.reload();
  await expect(sourceHeading(page)).toBeVisible();

  await page.goto('/#/studio/overview');
  await expect(page.getByRole('heading',{level:1,name:'What are you working on?',exact:true})).toBeVisible();
  await page.goto('/#/studio/create');
  await expect(createHeading(page)).toBeVisible();
  await page.getByRole('button',{name:/^Build a drum kit/}).click();
  await expect(page).toHaveURL(/#\/studio\/setup$/);
  await page.reload();
  await expect(setupHeading(page)).toBeVisible();
  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(createHeading(page)).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/create$/);
});

test('the chosen source is retained across Help and carried into the recorder',async({page})=>{
  await page.goto('/#/studio/source');
  const software=page.getByRole('button',{name:/A software instrument/});
  await software.click();
  await expect(software).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'← Back to Overview',exact:true}).click();
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await expect(software).toHaveAttribute('aria-pressed','true');

  await page.getByRole('button',{name:'Help',exact:true}).click();
  const help=page.getByRole('dialog',{name:'Help',exact:true});
  await expect(help).toBeVisible();
  await help.getByRole('button',{name:'Close Help',exact:true}).click();
  await expect(help).toBeHidden();
  await expect(software).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('region',{name:'A software instrument steps'})).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/source$/);

  await page.getByRole('button',{name:'Connect and check sound',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});
  await expect(recorder).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\/multisample$/);
  await expect(recorder).toContainText('Record a sound from your music software');

  await recorder.getByRole('button',{name:'Recording help',exact:true}).click();
  await expect(help).toBeVisible();
  await help.getByRole('button',{name:'Close Help',exact:true}).click();
  await expect(help).toBeHidden();
  await expect(recorder).toBeVisible();
  await expect(recorder).toContainText('Record a sound from your music software');
  await expect(recorder).not.toContainText('Record a sound from your synth');
});

test('footer Feedback and Support pages are reachable and returning preserves both instruments and edits',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await page.getByLabel('Instrument audio files').setInputFiles(fixture);
  await applyAudioImport(page);
  await expectMultisampleLoaded(page,1);

  await openWorkspace(page,'drum');
  await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  await expectDrumLoaded(page,10);
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  const selected=await editor.getByRole('heading',{level:3}).textContent();
  const gain=editor.getByRole('slider',{name:/^Gain/});
  const edited=String(Number(await gain.inputValue())+1);
  await gain.focus();await page.keyboard.press('ArrowRight');await gain.blur();
  await expect(gain).toHaveValue(edited);

  await footerLink(page,'Feedback').click();
  await expect(page).toHaveURL(/#\/feedback$/);
  await expect(page.getByRole('heading',{level:1,name:'Feedback',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'← Back to the studio',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'What are you working on?',exact:true})).toBeVisible();
  await expect(page.getByText('10 / 24 pads loaded',{exact:true})).toBeVisible();
  await expect(page.getByText('1 / 24 zones loaded',{exact:true})).toBeVisible();

  await footerLink(page,'Support the project').click();
  await expect(page).toHaveURL(/#\/donate$/);
  await expect(page.getByRole('heading',{level:1,name:'Support the project',exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading',{level:1,name:'What are you working on?',exact:true})).toBeVisible();

  await openWorkspace(page,'drum');
  await expectDrumLoaded(page,10);
  await expect(editor.getByRole('heading',{level:3})).toHaveText(selected||'');
  await expect(gain).toHaveValue(edited);
  await openWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,1);
});

test('a feedback or support hash cannot bypass an open recorder or lose its pending settings',async({page})=>{
  const recorder=await openDrumRecorder(page);
  const starts=recorder.getByRole('combobox',{name:'Recording starts',exact:true});
  await starts.selectOption('sound');
  await recorder.locator('summary',{hasText:'Technical details'}).click();
  const length=recorder.getByLabel('Maximum take length',{exact:true});
  await length.fill('7');await length.blur();
  await expect(length).toHaveValue('7');

  for(const hash of ['#/feedback','#/donate']) {
    await changeHash(page,hash);
    await expect(page).toHaveURL(/#\/studio\/drum$/);
    await expect(guardNotice(page)).toHaveText(GUARD_NOTICE);
    await expect(recorder).toBeVisible();
    await expect(page.getByRole('heading',{level:1,name:hash==='#/feedback'?'Feedback':'Support the project',exact:true})).toHaveCount(0);
    await expect(starts).toHaveValue('sound');
    await expect(length).toHaveValue('7');
  }

  await recorder.getByRole('button',{name:'Close',exact:true}).click();
  await expect(recorder).toBeHidden();
  await expect(guardNotice(page)).toHaveCount(0);
  await footerLink(page,'Feedback').click();
  await expect(page).toHaveURL(/#\/feedback$/);
  await expect(page.getByRole('heading',{level:1,name:'Feedback',exact:true})).toBeVisible();
});

test('a support hash cannot bypass a pending audio import review',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await page.getByLabel('Instrument audio files').setInputFiles(fixture);
  const review=page.getByRole('dialog',{name:'Import audio'});
  await expect(review).toBeVisible();
  const note=review.getByLabel('Recorded note for original-44100.wav');
  await note.selectOption('64');
  await expect(review.getByLabel('Include original-44100.wav')).toBeChecked();
  await expect(page).toHaveURL(/#\/studio\/multisample$/);

  await changeHash(page,'#/donate');
  await expect(page).toHaveURL(/#\/studio\/multisample$/);
  await expect(guardNotice(page)).toHaveText(GUARD_NOTICE);
  await expect(review).toBeVisible();
  await expect(page.getByRole('heading',{level:1,name:'Support the project',exact:true})).toHaveCount(0);
  await expect(note).toHaveValue('64');
  await expect(review.getByLabel('Include original-44100.wav')).toBeChecked();
  await expect(review.getByRole('button',{name:'Add selected sounds'})).toBeEnabled();

  await review.getByRole('button',{name:'Cancel import',exact:true}).click();
  await expect(review).toBeHidden();
  await expect(guardNotice(page)).toHaveCount(0);
  await expectMultisampleLoaded(page,0);
  await footerLink(page,'Support the project').click();
  await expect(page).toHaveURL(/#\/donate$/);
  await expect(page.getByRole('heading',{level:1,name:'Support the project',exact:true})).toBeVisible();
});

test('the workspace guard notice clears when the blocking dialog is dismissed',async({page})=>{
  const recorder=await openDrumRecorder(page);
  await expect(guardNotice(page)).toHaveCount(0);

  await changeHash(page,'#/studio/library');
  await expect(page).toHaveURL(/#\/studio\/drum$/);
  await expect(guardNotice(page)).toHaveText(GUARD_NOTICE);
  await expect(recorder).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Library collections'})).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(recorder).toBeHidden();
  await expect(guardNotice(page)).toHaveCount(0);
  await expect(page.getByRole('region',{name:/Drum pad instrument/})).toBeVisible();

  await openWorkspace(page,'library');
  await expect(page).toHaveURL(/#\/studio\/library$/);
  await expect(guardNotice(page)).toHaveCount(0);
});

test('a blanked drum Focus playback end restores the last valid trim on blur and a real edit stays undoable',async({page})=>{
  await gotoWorkspace(page,'drum');
  await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  await expect(editor.getByRole('button',{name:'Play selected',exact:true})).toBeVisible();
  const start=editor.getByLabel('Playback start (seconds)',{exact:true}),end=editor.getByLabel('Playback end (seconds)',{exact:true});
  const originalStart=await start.inputValue(),originalEnd=await end.inputValue();
  expect(Number(originalEnd)).toBeGreaterThan(Number(originalStart));

  await end.fill('');
  await expect(end).toHaveValue('');
  await end.blur();
  await expect(end).toHaveValue(originalEnd);
  await expect(start).toHaveValue(originalStart);
  expect(Number(await end.inputValue())).toBeGreaterThan(0);

  const changed=String(Number(originalEnd)/2);
  await end.fill(changed);await end.blur();
  await expect(end).toHaveValue(changed);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(end).toHaveValue(originalEnd);
  await expect(start).toHaveValue(originalStart);
});
