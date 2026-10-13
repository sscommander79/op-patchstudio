import {test as base,expect,type Locator,type Page} from './control-audit-test';
import {applyAudioImport} from './import-helpers';
import {expectDrumLoaded,expectMultisampleLoaded,gotoWorkspace,openWorkspace,projectAction} from './workspace-actions';

// Remaining surface gallery. Covers surfaces the exhaustive gallery only touches in passing: every Help
// topic, each multisampling guide disclosure, an import review for a file with no known pitch, the
// library's empty states and their recovery actions, and the install promotion.
// Screenshots are evidence only; passing assertions are not visual approval.
//
// Isolation: every non-local request is aborted and recorded, microphone and MIDI permission requests
// are replaced with a counting rejection, and each test runs in a disposable browser context.
//
// The install promotion is driven by a synthetic `beforeinstallprompt` event whose prompt() is a stub
// and whose userChoice is decided by the test. It exercises the app's own promotion only. It is not a
// test of the browser's native install dialog and installs nothing.

const GALLERY=process.env.OPSTUDIO_REMAINING_GALLERY??'/Users/stevencommander/Documents/ChatGPT/OPXY/design/exhaustive-validation-2026-10-07/evidence/remaining-gallery';
const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
const VIEWPORTS={390:{width:390,height:844},1440:{width:1440,height:1000}} as const;
const PRESENTATIONS=[{width:390,appearance:'opxy',theme:'dark'},{width:1440,appearance:'field',theme:'light'}] as const;
type Appearance='field'|'opxy';
type Theme='light'|'dark';

type Guard={
  /** Every non-local URL the page tried to reach; all of them were aborted. */
  external:string[];
  deviceRequests:string[];
};

const test=base.extend<{guard:Guard}>({
  guard:[async({context},use,testInfo)=>{
    const guard:Guard={external:[],deviceRequests:[]};
    await context.route(url=>/^https?:$/.test(url.protocol)&&!LOCAL_HOSTS.has(url.hostname),route=>{guard.external.push(route.request().url());return route.abort('blockedbyclient');});
    await context.exposeBinding('__remainingDeviceRequest',(_source,kind:string)=>{guard.deviceRequests.push(kind);});
    await context.addInitScript(()=>{
      const report=(kind:string)=>void (window as Window&{__remainingDeviceRequest?:(kind:string)=>Promise<void>}).__remainingDeviceRequest?.(kind);
      const denied=()=>new DOMException('Device access is disabled in the remaining surface run','NotAllowedError');
      Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:()=>{report('midi');return Promise.reject(denied());}});
      if(navigator.mediaDevices)Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{report('microphone');return Promise.reject(denied());}});
    });
    await use(guard);
    await testInfo.attach('external-requests-aborted',{body:JSON.stringify(guard.external,null,2),contentType:'application/json'});
    expect(guard.deviceRequests,'Viewing these surfaces must never ask for the microphone or MIDI').toEqual([]);
  },{auto:true}],
});

// The default suite does not block service workers; without this a worker could answer before the guard sees a request.
test.use({serviceWorkers:'block'});

// Deterministic 1 s, 48 kHz mono 16-bit sine; generated in memory.
function tone(name:string) {
  const frames=48000,buffer=Buffer.alloc(44+frames*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(48000,24);buffer.writeUInt32LE(96000,28);
  buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  for(let frame=0;frame<frames;frame++)buffer.writeInt16LE(Math.round(Math.sin(2*Math.PI*261.63*frame/48000)*12000),44+frame*2);
  return {name,mimeType:'audio/wav',buffer};
}

async function present(page:Page,width:keyof typeof VIEWPORTS,appearance:Appearance,theme:Theme) {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.addInitScript(({appearance,theme})=>{localStorage.setItem('opstudio-appearance',appearance);localStorage.setItem('opstudio-theme',theme);},{appearance,theme});
}

async function expectPresentation(page:Page,appearance:Appearance,theme:Theme) {
  await expect(page.locator('html')).toHaveAttribute('data-studio-theme',theme);
  await expect(page.getByRole('combobox',{name:'Theme',exact:true})).toHaveValue(theme);
  await expect(page.getByRole('radio',{name:appearance==='opxy'?'OP-XY':'OP-1 Field',exact:true})).toBeChecked();
}

/** Wait on observable state rather than a fixed sleep: lazy surfaces loaded, fonts ready, finite animations done. */
async function settle(page:Page) {
  await expect(page.getByText(/^Loading (workspace|devices|feedback|support)…$/)).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running'&&Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).length),
    {message:'finite animations and transitions finish before capture'}).toBe(0);
}

/** Toasts and install/update notices are not the surface under review; they are dismissed the way a user would. */
async function clearTransientOverlays(page:Page) {
  if(await page.locator('[role="dialog"]').count())return;
  for(const control of [page.getByRole('button',{name:/^Dismiss .+ notification$/}),page.getByRole('button',{name:/^(Later|Got it)$/}),page.getByRole('button',{name:'Dismiss',exact:true})])
    for(const item of await control.all())if(await item.isVisible())await item.click();
}

/** The page itself must not scroll sideways. Tables and keyboards may scroll inside their own containers. */
async function expectNoPageOverflow(page:Page,label:string) {
  await expect(async()=>{
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,`${label}: the page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
  }).toPass({timeout:3000});
}

type Surface={
  /** Audit a page surface, then save a full-page screenshot. */
  capture:(name:string)=>Promise<void>;
  /** Save a viewport screenshot of something fixed to the viewport (a dialog or the install promotion). */
  captureFixed:(name:string,layer:Locator)=>Promise<void>;
};

// The project name is part of the path so the default all-browser suite never overwrites another project's evidence.
function surface(page:Page,project:string,folder:string,journey:string):Surface {
  let index=0;
  const file=(name:string)=>`${GALLERY}/${project.toLowerCase().replace(/[^a-z0-9]+/g,'-')}/${folder}/${journey}-${String(++index).padStart(2,'0')}-${name}.png`;
  return {
    capture:async name=>{
      await clearTransientOverlays(page);await settle(page);await expectNoPageOverflow(page,name);
      await page.screenshot({path:file(name),fullPage:true});
    },
    captureFixed:async(name,layer)=>{
      await settle(page);await expect(layer).toBeVisible();await expectNoPageOverflow(page,name);
      await page.screenshot({path:file(name)});
    },
  };
}

const slug=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const instrumentName=(page:Page)=>page.getByRole('region',{name:'Instrument project controls'}).getByRole('textbox',{name:'Instrument name',exact:true});

// Titles and one sentence of each body, copied from the topics list in StudioShell.tsx.
const helpTopics=[
  {title:'Choose a task',says:'Choose a source to get the right steps'},
  {title:'Audio files and recorded notes',says:'Confirm the original note for each file before adding it.'},
  {title:'Holding a sound with a loop',says:'Looping reuses existing audio; it does not record more notes.'},
  {title:'Hardware synth connections',says:'Manual and sound-triggered recording are also available.'},
  {title:'Software synth connections',says:'The browser does not host the plugin.'},
  {title:'Recording and review',says:'Captured takes stay in review until you add them to the project.'},
  {title:'Library',says:'The library is stored in this browser.'},
  {title:'Back up or transfer',says:'Full-library backup and restore is not available yet.'},
] as const;

async function helpJourney(page:Page,s:Surface) {
  await page.goto('/#/studio/transfer');
  const task=page.getByRole('heading',{level:1,name:'Back up and transfer'});
  await expect(task).toBeVisible();
  const help=page.getByRole('dialog',{name:'Help'}),topicNav=help.getByRole('navigation',{name:'Help topics'});
  for(const topic of helpTopics) {
    await page.getByRole('button',{name:'Help',exact:true}).click();
    await expect(help.getByRole('heading',{level:2,name:'Studio guide'})).toBeVisible();
    await expect(topicNav.getByRole('button'),'all eight topics are offered').toHaveCount(helpTopics.length);
    const choice=topicNav.getByRole('button',{name:topic.title,exact:true});
    await choice.click();
    await expect(choice).toHaveAttribute('aria-current','page');
    await expect(help.getByRole('article'),'one guide is shown for the chosen topic').toHaveCount(1);
    await expect(help.getByRole('heading',{level:3,name:topic.title,exact:true})).toBeVisible();
    await expect(help.getByRole('article')).toContainText(topic.says);
    await s.captureFixed(`help-${slug(topic.title)}`,help);
    // Returning closes Help and leaves the task that was open underneath.
    await help.getByRole('button',{name:'Return to my task',exact:true}).click();
    await expect(help).toBeHidden();
    await expect(task).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#/studio/transfer');
  }
}

// Summary text and one visible consequence of opening each disclosure, copied from MultisampleGuide.tsx.
// Item counts are for a project with at most one recording.
const guideDisclosures=[
  {summary:'Steps for a first instrument',says:'plays the sample at its original pitch',items:5},
  {summary:'When should I use looping?',says:'Usually leave it off:',items:0},
  {summary:'How do I set good loop points?',says:'Pick a steady section',items:5},
  {summary:'What should I listen for?',says:'The beginning sounds cut off:',items:3},
  {summary:'What do the status marks mean?',says:'Valid values do not guarantee a good sound.',items:0},
] as const;

async function guideJourney(page:Page,s:Surface) {
  await gotoWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,0);
  const guide=page.getByRole('complementary',{name:'Multisampling guide'});
  await expect(guide.getByRole('heading',{level:3,name:'Start with one recording'})).toBeVisible();
  await expect(guide.locator('details')).toHaveCount(guideDisclosures.length);
  const disclosure=(summary:string)=>guide.locator('details').filter({has:page.locator('summary',{hasText:summary})});
  // With nothing loaded the first-instrument steps start open and the rest start closed.
  for(const [index,item] of guideDisclosures.entries())await expect(disclosure(item.summary)).toHaveJSProperty('open',index===0);
  await s.capture('guide-empty-project');

  for(const item of guideDisclosures) {
    const details=disclosure(item.summary),summary=details.locator('summary');
    if(!await details.evaluate(element=>(element as HTMLDetailsElement).open))await summary.click();
    await expect(details).toHaveJSProperty('open',true);
    await expect(details.getByText(item.says)).toBeVisible();
    if(item.items)await expect(details.getByRole('listitem')).toHaveCount(item.items);
    if(item.summary==='When should I use looping?')await expect(details.getByRole('img',{name:'Play the beginning once, then repeat the selected loop section'})).toBeVisible();
    await s.capture(`guide-${slug(item.summary)}`);
    await summary.click();
    await expect(details).toHaveJSProperty('open',false);
    await expect(details.getByText(item.says)).toBeHidden();
  }

  // Loading a recording changes the guide's advice; reading the guide changed nothing in the project.
  await page.getByLabel('choose multisample audio files').setInputFiles(tone('remaining-C4.wav'));
  await applyAudioImport(page);
  await expectMultisampleLoaded(page,1);
  await expect(guide.getByRole('heading',{level:3,name:'Check it by listening'})).toBeVisible();
  await expect(guide.getByText('Next: check the original pitch',{exact:true})).toBeVisible();
  await expect(guide).toContainText('Current sample:');
  await s.capture('guide-one-recording');
}

async function importReviewJourney(page:Page,s:Surface) {
  await gotoWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,0);
  const chooser=page.getByLabel('choose multisample audio files'),editor=page.getByRole('region',{name:'Focused multisample editor'});
  await chooser.setInputFiles(tone('remaining-C4.wav'));
  await applyAudioImport(page);
  await expectMultisampleLoaded(page,1);
  await instrumentName(page).fill('Remaining keys');await instrumentName(page).blur();

  // No note in the name and no pitch metadata: the review must ask rather than guess.
  await chooser.setInputFiles(tone('mystery-take.wav'));
  const dialog=page.getByRole('dialog',{name:'Import audio'});
  await expect(dialog.getByRole('heading',{level:2,name:'Add audio to your instrument'})).toBeVisible();
  await expect(dialog.getByText(/^1 audio file ready\./)).toBeVisible();
  const include=dialog.getByRole('checkbox',{name:'Include mystery-take.wav',exact:true});
  const note=dialog.getByRole('combobox',{name:'Recorded note for mystery-take.wav',exact:true});
  const assignment=dialog.getByRole('combobox',{name:'Assignment for mystery-take.wav',exact:true});
  const add=dialog.getByRole('button',{name:'Add selected sounds',exact:true}),cancel=dialog.getByRole('button',{name:'Cancel import',exact:true});
  await expect(dialog.getByText('Which note was recorded? Choose the original note before adding this file.',{exact:true})).toBeVisible();
  await expect(note).toHaveValue('');
  await expect(include).not.toBeChecked();await expect(include).toBeDisabled();
  await expect(assignment).toBeDisabled();
  await expect(add).toBeDisabled();
  await s.captureFixed('import-unknown-pitch',dialog);

  const details=dialog.locator('details.studio-technical-details');
  await expect(details).toHaveJSProperty('open',false);
  await details.getByText('Audio file details',{exact:true}).click();
  await expect(details).toHaveJSProperty('open',true);
  await expect(details).toContainText(/source bit depth .+ · source rate .+ · source channels .+ · decoded \d+ Hz \/ \d+ ch/);
  await s.captureFixed('import-file-details',dialog);

  // Naming the note unlocks the row; the include box then decides whether anything would be added.
  await note.selectOption('40');
  await expect(include).toBeEnabled();await expect(include).toBeChecked();
  await expect(assignment).toBeEnabled();await expect(assignment).toHaveValue('root');
  await expect(add).toBeEnabled();
  await include.uncheck();
  await expect(add,'nothing is selected, so nothing can be added').toBeDisabled();
  await s.captureFixed('import-note-chosen-not-included',dialog);
  await include.check();
  await expect(add).toBeEnabled();
  await s.captureFixed('import-note-chosen-included',dialog);

  // Cancel discards the review and leaves the project exactly as it was.
  await cancel.click();
  await expect(dialog).toBeHidden();
  await expectMultisampleLoaded(page,1);
  await expect(instrumentName(page)).toHaveValue('Remaining keys');
  await expect(editor).toContainText('remaining-C4.wav');
  await expect(page.getByText('mystery-take.wav')).toHaveCount(0);
  await s.capture('import-cancelled-project-kept');
}

// Small screens tuck the collection list behind a disclosure.
async function openLibrarySection(page:Page,name:string|RegExp) {
  const section=page.getByRole('navigation',{name:'Library sections'}).getByRole('button',{name});
  const summary=page.getByText('Browse collections',{exact:true});
  const disclosure=page.locator('details.studio-library-collection-disclosure');
  await expect(async()=>{
    if(await summary.isVisible()&&!await disclosure.evaluate(element=>(element as HTMLDetailsElement).open))await summary.click();
    await expect(section).toBeVisible({timeout:500});
  }).toPass();
  await section.click();
}

async function libraryJourney(page:Page,s:Surface) {
  // The states under review need one saved preset: with none, the library shows its first-run message instead.
  await page.goto('/#/studio/library');
  await expect(page.getByText('No saved presets yet',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Build a drum kit',exact:true}).click();
  await expectDrumLoaded(page,0);
  await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  await expectDrumLoaded(page,10);
  await instrumentName(page).fill('Remaining kit');await instrumentName(page).blur();
  await projectAction(page,'Save to library');
  await expect(page.getByText('Saved drum kit “Remaining kit” to the library in this browser.',{exact:true})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Saved in this browser'})).toBeVisible({timeout:15_000});
  await openWorkspace(page,'library');
  const saved=page.getByRole('checkbox',{name:'Select Remaining kit',exact:true});
  const title=(name:string)=>page.getByRole('heading',{level:1,name,exact:true});
  const browseAll=page.getByRole('button',{name:'Browse all presets',exact:true});
  await expect(saved).toBeVisible();

  await openLibrarySection(page,/^Favorites/);
  await expect(title('Favorites')).toBeVisible();
  await expect(page.getByText('No favorites yet',{exact:true})).toBeVisible();
  await expect(page.getByText('Use the star on a preset to mark it as a favorite.',{exact:true})).toBeVisible();
  await expect(saved).toHaveCount(0);
  await s.capture('library-favorites-empty');
  await browseAll.click();
  await expect(title('All presets')).toBeVisible();
  await expect(saved).toBeVisible();

  const search=page.getByLabel('Search presets, descriptions, and tags',{exact:true});
  await search.fill('zzzzmissing');
  await expect(page.getByText('No presets match your search',{exact:true})).toBeVisible();
  await expect(page.getByText('1 preset in this section is hidden by the search or filters above.',{exact:true})).toBeVisible();
  await expect(saved).toHaveCount(0);
  await s.capture('library-search-miss');
  await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();
  await expect(search).toHaveValue('');
  await expect(saved).toBeVisible();

  await page.getByRole('button',{name:'New collection',exact:true}).click();
  const creating=page.getByRole('dialog',{name:'New collection',exact:true});
  await creating.getByLabel('Collection name',{exact:true}).fill('Empty shelf');
  await creating.getByRole('button',{name:'Create collection',exact:true}).click();await expect(creating).toBeHidden();
  await openLibrarySection(page,'Collection Empty shelf');
  await expect(title('Empty shelf')).toBeVisible();
  await expect(page.getByText('This collection is empty',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Export collection (0)',exact:true})).toBeDisabled();
  await expect(saved).toHaveCount(0);
  await s.capture('library-collection-empty');
  await browseAll.click();
  await expect(title('All presets')).toBeVisible();
  await expect(saved,'the saved preset was never moved or removed').toBeVisible();
}

type SyntheticInstall={promptCalls:number};
const INSTALL_KEYS=['pwa_install_dismissed','pwa_install_accepted','pwa_install_remind_later'] as const;

/** Dispatches a stand-in for the browser's install event. prompt() only counts the call; no browser dialog exists. */
async function offerSyntheticInstall(page:Page,outcome:'accepted'|'dismissed') {
  await expect(async()=>{
    const handled=await page.evaluate(outcome=>{
      const record:SyntheticInstall={promptCalls:0};
      let choose:(choice:{outcome:string;platform:string})=>void=()=>undefined;
      const userChoice=new Promise<{outcome:string;platform:string}>(resolve=>{choose=resolve;});
      const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{platforms:['web'],userChoice,
        prompt:()=>{record.promptCalls++;choose({outcome,platform:'web'});return Promise.resolve();}});
      (window as Window&{__syntheticInstall?:SyntheticInstall}).__syntheticInstall=record;
      window.dispatchEvent(event);
      return event.defaultPrevented;
    },outcome);
    // The app calls preventDefault when it takes the event; until its listener is attached nothing is scheduled.
    expect(handled,'the app took the synthetic install event').toBe(true);
  }).toPass();
}

const installState=(page:Page)=>page.evaluate(keys=>({
  stored:keys.filter(key=>localStorage.getItem(key)!==null),visits:localStorage.getItem('pwa_visit_count'),
  promptCalls:(window as Window&{__syntheticInstall?:SyntheticInstall}).__syntheticInstall?.promptCalls??-1,
}),[...INSTALL_KEYS]);

async function installPromotionJourney(page:Page,s:Surface,guard:Guard) {
  const overview=page.getByRole('heading',{level:1,name:'What are you working on?'});
  const promotion=page.getByRole('region',{name:'Install OP-PatchStudio',exact:true});
  const viewport=page.viewportSize()!;
  const choices=[
    {button:'Later',title:'Hide this and ask again after 6 more visits',outcome:'dismissed',stored:['pwa_install_remind_later'],promptCalls:0},
    {button:'Dismiss',title:'Hide this for a week',outcome:'dismissed',stored:['pwa_install_dismissed'],promptCalls:0},
    {button:'Install',title:"Open the browser's install dialog",outcome:'accepted',stored:['pwa_install_accepted'],promptCalls:1},
  ] as const;
  await page.goto('/');
  for(const choice of choices) {
    await expect(overview).toBeVisible();
    const before=guard.external.length;
    await offerSyntheticInstall(page,choice.outcome);
    // The app shows its promotion a few seconds after the event, on its own timer.
    await expect(promotion).toBeVisible({timeout:15_000});
    await expect(promotion).toHaveCSS('opacity','1');
    await expect(promotion.getByText('Install OP-PatchStudio (optional)',{exact:true})).toBeVisible();
    await expect(promotion).toContainText('Installing does not back it up.');
    await expect(promotion.getByRole('button')).toHaveCount(choices.length);
    for(const item of choices) {
      const control=promotion.getByRole('button',{name:item.button,exact:true});
      await expect(control).toHaveAttribute('title',item.title);
      await expect(control).toBeInViewport({ratio:1});
      const box=(await control.boundingBox())!;
      expect(box.x,`"${item.button}" is not cut off on the left`).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width,`"${item.button}" is not cut off on the right`).toBeLessThanOrEqual(viewport.width);
    }
    expect((await installState(page)).promptCalls,'showing the promotion never opens the install prompt by itself').toBe(0);
    await s.captureFixed(`install-promotion-before-${slug(choice.button)}`,promotion);

    await promotion.getByRole('button',{name:choice.button,exact:true}).click();
    await expect(promotion).toHaveCount(0);
    await expect.poll(()=>installState(page),{message:`${choice.button} records only its own decision`})
      .toEqual({stored:choice.stored,visits:choice.button==='Later'?'0':expect.stringMatching(/^[1-9]\d*$/),promptCalls:choice.promptCalls});
    await expect(overview).toBeVisible();
    expect(guard.external.slice(before),'the promotion and its three actions reach no outside server').toEqual([]);
    await s.capture(`install-promotion-after-${slug(choice.button)}`);

    // Each choice suppresses the promotion for later visits, so the next one starts from a clean record.
    await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('pwa_'))localStorage.removeItem(key);});
    await page.reload();
  }
}

for(const {width,appearance,theme} of PRESENTATIONS) {
  const folder=`${width}-${appearance}-${theme}`;
  test.describe(`remaining surfaces ${width}px ${appearance} ${theme}`,()=>{
    test.beforeEach(async({page})=>{test.setTimeout(180_000);await present(page,width,appearance,theme);});

    test('each of the eight Help topics shows its own guide and returns to the open task',async({page},testInfo)=>{
      await helpJourney(page,surface(page,testInfo.project.name,folder,'a-help'));
      await expectPresentation(page,appearance,theme);
    });

    test('each of the five multisampling guide disclosures opens, explains and closes',async({page},testInfo)=>{
      await guideJourney(page,surface(page,testInfo.project.name,folder,'b-guide'));
      await expectPresentation(page,appearance,theme);
    });

    test('import review asks for an unknown pitch, shows file details, honours include, and Cancel keeps the project',async({page},testInfo)=>{
      await importReviewJourney(page,surface(page,testInfo.project.name,folder,'c-import'));
      await expectPresentation(page,appearance,theme);
    });

    test('library favorites, search miss and empty collection each explain themselves and lead back to all presets',async({page},testInfo)=>{
      await libraryJourney(page,surface(page,testInfo.project.name,folder,'d-library'));
      await expectPresentation(page,appearance,theme);
    });

    test('install promotion from a synthetic beforeinstallprompt (not a native install test): Later, Dismiss and accepted Install',async({page,guard},testInfo)=>{
      await installPromotionJourney(page,surface(page,testInfo.project.name,folder,'e-install'),guard);
      await expectPresentation(page,appearance,theme);
    });
  });
}
