import {test as base,expect,type Page} from './control-audit-test';
import {applyAudioImport} from './import-helpers';
import {expectDrumLoaded,expectMultisampleLoaded,gotoWorkspace} from './workspace-actions';

// Final coverage gaps. Each test reaches a control the current source inventory shows with no recorded
// interaction, through the same path a user takes, and asserts what the control changed.
//
// Isolation: every non-local request is aborted unless a test fulfils it itself, MIDI and microphone
// requests are replaced with a counting rejection, and each test runs in a disposable browser context.
// No physical device, saved browser profile or outside service is used.

const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
type Guard={external:string[];deviceRequests:string[]};

const test=base.extend<{guard:Guard}>({
  guard:[async({context},use)=>{
    const guard:Guard={external:[],deviceRequests:[]};
    await context.route(url=>/^https?:$/.test(url.protocol)&&!LOCAL_HOSTS.has(url.hostname),route=>{guard.external.push(route.request().url());return route.abort('blockedbyclient');});
    await context.exposeBinding('__finalGapDeviceRequest',(_source,kind:string)=>{guard.deviceRequests.push(kind);});
    await context.addInitScript(()=>{
      const report=(kind:string)=>void (window as Window&{__finalGapDeviceRequest?:(kind:string)=>Promise<void>}).__finalGapDeviceRequest?.(kind);
      const denied=()=>new DOMException('Device access is disabled in the final gap run','NotAllowedError');
      Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:()=>{report('midi');return Promise.reject(denied());}});
      if(navigator.mediaDevices)Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{report('microphone');return Promise.reject(denied());}});
    });
    await use(guard);
  },{auto:true}],
});

test.use({serviceWorkers:'block'});
test.beforeEach(()=>{test.setTimeout(90_000);});

// Deterministic 1 s, 48 kHz mono 16-bit sine; generated in memory.
function tone(name:string,frequency=261.63) {
  const frames=48000,buffer=Buffer.alloc(44+frames*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(48000,24);buffer.writeUInt32LE(96000,28);
  buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  for(let frame=0;frame<frames;frame++)buffer.writeInt16LE(Math.round(Math.sin(2*Math.PI*frequency*frame/48000)*12000),44+frame*2);
  return {name,mimeType:'audio/wav',buffer};
}

const toolbar=(page:Page)=>page.getByRole('region',{name:'Instrument project controls'});
const instrumentName=(page:Page)=>toolbar(page).getByRole('textbox',{name:'Instrument name',exact:true});
const overviewHeading=(page:Page)=>page.getByRole('heading',{level:1,name:'What are you working on?'});

/** One named kit with a single sound on pad 3, built through the pad's own file input. */
async function drumKitWithPadThree(page:Page,kit:string,file:string) {
  await gotoWorkspace(page,'drum');
  await page.getByRole('button',{name:/^(SD1 drum key|Pad 3, SD1,)/}).click();
  await page.getByLabel('Choose audio for pad 3').setInputFiles(tone(file));
  await expect(page.getByRole('heading',{name:`Pad 3 · ${file}`})).toBeVisible();
  await expectDrumLoaded(page,1);
  await instrumentName(page).fill(kit);await instrumentName(page).blur();
}

/** In-app navigation, so the project in memory is the one the transfer page shows. */
async function openTransfer(page:Page) {
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Overview',exact:true}).click();
  await page.getByRole('button',{name:/^Back up or transfer/}).click();
  await expect(page.getByRole('heading',{level:1,name:'Back up and transfer'})).toBeVisible();
}

test('transfer instrument choice retargets the file actions without losing either project, and Save to library saves the chosen one',async({page})=>{
  await drumKitWithPadThree(page,'Gap transfer kit','gap-kick.wav');
  await openTransfer(page);
  const choice=page.getByRole('combobox',{name:'Instrument to save or download'});
  const selected=toolbar(page).locator('.studio-toolbar-instrument');
  // Arriving from the drum editor preselects the drum kit.
  await expect(choice).toHaveValue('drum');
  await expect(selected).toHaveText('Selected for saving and download: Drum kit — Gap transfer kit');
  await expect(page.getByRole('button',{name:'Return to drum kit editor',exact:true})).toBeVisible();

  await choice.selectOption('multisample');
  await expect(selected).toContainText('Playable instrument — ');
  await expect(selected).not.toContainText('Gap transfer kit');
  await expect(instrumentName(page)).not.toHaveValue('Gap transfer kit');
  await expect(page.getByRole('button',{name:'Return to multisample editor',exact:true})).toBeVisible();

  // Switching back shows the drum kit unchanged: choosing an instrument edits neither.
  await choice.selectOption('drum');
  await expect(selected).toHaveText('Selected for saving and download: Drum kit — Gap transfer kit');
  await expect(instrumentName(page)).toHaveValue('Gap transfer kit');

  await toolbar(page).getByRole('button',{name:'Save to library',exact:true}).click();
  await expect(page.getByText('Saved drum kit “Gap transfer kit” to the library in this browser.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Return to drum kit editor',exact:true}).click();
  await expectDrumLoaded(page,1);
  await expect(instrumentName(page)).toHaveValue('Gap transfer kit');
});

test('transfer Back up project downloads an archive that Open project restores over a later edit',async({page},testInfo)=>{
  await drumKitWithPadThree(page,'Gap backup kit','gap-snare.wav');
  await openTransfer(page);
  const downloading=page.waitForEvent('download');
  await toolbar(page).getByRole('button',{name:'Back up project',exact:true}).click();
  const download=await downloading,filename=download.suggestedFilename();
  await expect(page.getByText(`Project backup download requested: ${filename}. Check your downloads to keep the file.`,{exact:true})).toBeVisible();
  const saved=testInfo.outputPath(filename);
  await download.saveAs(saved);

  // Edit after the backup so restoring it has something visible to undo.
  await instrumentName(page).fill('Edited after backup');await instrumentName(page).blur();
  await expect(toolbar(page).locator('.studio-toolbar-instrument')).toContainText('Edited after backup');

  const choosing=page.waitForEvent('filechooser');
  await toolbar(page).getByRole('button',{name:'Open project',exact:true}).click();
  await (await choosing).setFiles(saved);
  await expect(instrumentName(page)).toHaveValue('Gap backup kit',{timeout:15_000});
  await expect(page.getByText(/^Could not open project:/)).toHaveCount(0);
  await page.getByRole('button',{name:'Return to drum kit editor',exact:true}).click();
  await expectDrumLoaded(page,1);
  await expect(page.getByRole('button',{name:/^(SD1 drum key|Pad 3, SD1,)/})).toBeVisible();
});

test('drum-recording entries: the overview setup guide opens the kit steps and the guided card opens the editor with the recorder',async({page,guard})=>{
  await page.goto('/');
  await expect(overviewHeading(page)).toBeVisible();
  await page.getByRole('button',{name:'Setup guide: record a drum sound',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'Build your kit'})).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/studio/setup');
  await expect(page.getByRole('button',{name:'Open editor and Record takes',exact:true})).toBeVisible();

  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'What would you like to make?'})).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/studio/create');
  await page.getByRole('button',{name:/^Record a drum sound/}).click();
  // The card goes straight to the drum editor with the recorder open, not to the setup steps.
  await expectDrumLoaded(page,0);
  await expect(page.getByRole('dialog',{name:'Record takes'})).toBeVisible();
  await expect(page.getByRole('heading',{level:1,name:'Build your kit'})).toHaveCount(0);
  expect(guard.deviceRequests.filter(kind=>kind==='midi'),'opening the recorder never asks for MIDI').toEqual([]);
});

test('drum focus: Zoom and edit waveform saves a shorter playback end, and Replace opens a chooser that swaps the pad sound',async({page})=>{
  await drumKitWithPadThree(page,'Gap focus kit','gap-old.wav');
  const focus=page.getByRole('region',{name:'Focused sample editor'});
  const playbackEnd=focus.getByLabel('Playback end (seconds)');
  const before=Number(await playbackEnd.inputValue());
  expect(before).toBeGreaterThan(0.5);

  // The explicit button in the action row, not the waveform's own zoom affordance.
  await focus.locator('.studio-action-row').getByRole('button',{name:'Zoom and edit waveform',exact:true}).click();
  const zoom=page.getByRole('dialog',{name:'Zoom and edit',exact:true});
  const endFrames=zoom.getByLabel('Playback end frames');
  await expect.poll(async()=>Number(await endFrames.inputValue())).toBeGreaterThan(1);
  const half=Math.round(Number(await endFrames.inputValue())/2);
  await endFrames.fill(String(half));await endFrames.blur();
  await zoom.getByRole('button',{name:'Save markers',exact:true}).click();
  await expect(zoom).toBeHidden();
  await expect.poll(async()=>Number(await playbackEnd.inputValue()),{message:'the saved marker reaches the focus editor'}).toBeLessThan(before*0.75);

  const choosing=page.waitForEvent('filechooser');
  await focus.getByRole('button',{name:'Replace',exact:true}).click();
  await (await choosing).setFiles(tone('gap-new.wav',440));
  const review=page.getByRole('dialog',{name:'Import audio'});
  await expect(review.getByLabel('Destination for gap-new.wav')).toHaveValue('replace:2');
  await review.getByRole('button',{name:'Add selected sounds'}).click();
  await expect(review).toBeHidden();
  await expect(page.getByRole('heading',{name:'Pad 3 · gap-new.wav'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Unassigned sounds'}).getByRole('button',{name:'gap-old.wav',exact:true})).toBeVisible();
  await expectDrumLoaded(page,1);
});

test('multisample focus: Zoom and edit waveform opens the loop editor, and Cancel discards a changed marker',async({page})=>{
  await gotoWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,0);
  await page.getByLabel('choose multisample audio files').setInputFiles(tone('gap-C4.wav'));
  await applyAudioImport(page);
  await expectMultisampleLoaded(page,1);
  const editor=page.getByRole('region',{name:'Focused multisample editor'});
  const open=editor.locator('.studio-action-row').getByRole('button',{name:'Zoom and edit waveform',exact:true});
  const zoom=page.getByRole('dialog',{name:'Zoom and edit',exact:true});

  await open.click();
  const endFrames=zoom.getByLabel('Playback end frames');
  await expect.poll(async()=>Number(await endFrames.inputValue())).toBeGreaterThan(1);
  // Loop markers belong to the multisample editor only.
  await expect(zoom.getByLabel('Loop start frames')).toBeVisible();
  const original=await endFrames.inputValue();
  await endFrames.fill(String(Math.round(Number(original)/2)));await endFrames.blur();
  await zoom.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(zoom).toBeHidden();

  // Reopening shows the stored marker, so Cancel changed nothing in the project.
  await open.click();
  await expect.poll(()=>endFrames.inputValue(),{message:'the cancelled marker was not stored'}).toBe(original);
  await zoom.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(zoom).toBeHidden();
  await expect(editor).toContainText('gap-C4.wav');
  await expectMultisampleLoaded(page,1);
});

test('Devices: Edit CC mapping opens the slot editor, edits update the enabled count, and collapsing keeps them',async({page,guard})=>{
  await page.goto('/#/studio/devices');
  await expect(page.getByRole('heading',{level:1,name:'Devices'})).toBeVisible();
  const mapping=page.locator('details.studio-advanced-disclosure').filter({has:page.locator('summary',{hasText:'Edit CC mapping'})});
  const summary=mapping.locator('summary'),slotOne=mapping.getByRole('checkbox',{name:'Enable CC slot 1',exact:true});
  const enabledCount=async()=>Number((await summary.innerText()).match(/(\d+) of \d+ enabled/)?.[1]??NaN);
  await expect(mapping).toHaveJSProperty('open',false);
  await expect(slotOne).toBeHidden();

  await summary.click();
  await expect(mapping).toHaveJSProperty('open',true);
  await expect(slotOne).toBeVisible();
  await expect(mapping.getByRole('checkbox',{name:/^Enable CC slot \d+$/})).toHaveCount(8);

  const started=await enabledCount(),wasEnabled=await slotOne.isChecked();
  expect(Number.isNaN(started)).toBe(false);
  await slotOne.click();
  await expect.poll(enabledCount,{message:'the summary counts the toggled slot'}).toBe(started+(wasEnabled?-1:1));
  await slotOne.click();
  await expect.poll(enabledCount).toBe(started);
  await mapping.getByLabel('CC slot 1 label',{exact:true}).fill('Gap cutoff');
  await expect(mapping.getByRole('heading',{level:3,name:'Slot 1 / Gap cutoff',exact:true})).toBeVisible();

  await summary.click();
  await expect(mapping).toHaveJSProperty('open',false);
  await expect(slotOne).toBeHidden();
  await summary.click();
  await expect(mapping.getByLabel('CC slot 1 label',{exact:true}),'collapsing the editor keeps the edit').toHaveValue('Gap cutoff');
  expect(await enabledCount()).toBe(started);
  expect(guard.deviceRequests,'editing the mapping asks for no device and sends no MIDI').toEqual([]);
});

test('Support: failed post loading offers the direct Patreon link, and the back link returns to the overview',async({page,context,guard})=>{
  // Registered after the guard, so it wins for Patreon only; the relay services still fail.
  await context.route(/^https:\/\/www\.patreon\.com\//,route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Isolated destination</title>'}));
  await page.goto('/#/donate');
  await expect(page.getByRole('heading',{level:1,name:'Support the project'})).toBeVisible();
  const warning=page.getByText('Live Patreon posts are unavailable.');
  await expect(warning).toHaveCount(0);
  expect(guard.external,'nothing is requested before the visitor asks for posts').toEqual([]);

  await page.getByRole('button',{name:'Load project posts',exact:true}).click();
  await expect(warning).toBeVisible({timeout:45_000});
  await expect(page.getByRole('button',{name:'Load project posts',exact:true})).toHaveCount(0);
  await expect(page.getByText('No posts available.')).toHaveCount(0);
  expect(guard.external.length,'the relay requests were made and blocked').toBeGreaterThan(0);
  expect(guard.external.every(url=>!new URL(url).hostname.endsWith('patreon.com'))).toBe(true);

  const direct=page.getByRole('link',{name:'View posts directly on Patreon.',exact:true});
  await expect(direct).toHaveAttribute('href','https://www.patreon.com/c/oppatchstudio/posts');
  await expect(direct).toHaveAttribute('rel',/noopener/);
  const opening=page.waitForEvent('popup');
  await direct.click();
  const popup=await opening;
  await expect(popup).toHaveURL('https://www.patreon.com/c/oppatchstudio/posts');
  await popup.close();

  await page.getByRole('link',{name:'← Back to the studio',exact:true}).click();
  await expect(overviewHeading(page)).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/studio/overview');
});

test('guided automatic recording: Optional MIDI details keeps separate settings per routing example without asking for a device',async({page,guard})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await page.getByRole('button',{name:/A hardware instrument/}).click();
  await page.getByRole('button',{name:'Connect and check sound',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes'});
  await expect(recorder.getByRole('heading',{name:'Connect and check',exact:true})).toBeVisible();
  const details=recorder.locator('details').filter({has:page.locator('summary',{hasText:'Optional MIDI details'})});
  const checklist=recorder.locator('details').filter({has:page.locator('summary',{hasText:'Connection checklist'})});
  const profile=details.getByLabel('Routing profile'),channel=details.getByLabel('MIDI channel',{exact:true});
  await expect(details).toHaveJSProperty('open',false);
  await expect(profile).toBeHidden();

  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open',true);
  await expect(profile).toHaveValue('custom');
  await expect(channel).toHaveValue('1');
  await checklist.locator('summary').click();
  await expect(checklist.getByRole('listitem')).toHaveCount(2);

  await profile.selectOption('nina-digitakt');
  await expect(details).toContainText('Example: connect MIDI to the synth and choose the audio input that carries the synth’s sound back.');
  await expect(checklist.getByRole('listitem'),'the checklist follows the chosen example').toHaveCount(3);
  await channel.fill('5');await channel.blur();
  await expect(channel).toHaveValue('5');

  // Each routing example remembers its own settings.
  await profile.selectOption('custom');
  await expect(channel).toHaveValue('1');
  await expect(checklist.getByRole('listitem')).toHaveCount(2);
  await profile.selectOption('nina-digitakt');
  await expect(channel).toHaveValue('5');
  await expect.poll(()=>page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem('op-patchstudio:auto-sampling:v1')??'null') as {profile?:string;routes?:Record<string,{settings?:{channel?:number}}>}|null;
    return {profile:stored?.profile,hardware:stored?.routes?.['nina-digitakt']?.settings?.channel,custom:stored?.routes?.custom?.settings?.channel};
  }),{message:'the choice is stored for the next visit'}).toEqual({profile:'nina-digitakt',hardware:5,custom:1});

  // Nothing here is a sound check, so recording stays locked and no MIDI permission was requested.
  await expect(recorder.getByRole('button',{name:'Continue to record'})).toBeDisabled();
  expect(guard.deviceRequests.filter(kind=>kind==='midi'),'these details never ask for MIDI').toEqual([]);
});

test('an empty keyboard note targets the adjacent Add sounds chooser and imports at that original note',async({page})=>{
  await gotoWorkspace(page,'multisample');
  await page.getByRole('button',{name:'MIDI note 73, empty',exact:true}).click();
  const choosing=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Add sounds to MIDI 73',exact:true}).click();
  await(await choosing).setFiles(tone('no-pitch-in-name.wav'));
  const review=page.getByRole('dialog',{name:'Import audio'});
  await expect(review.getByLabel('Recorded note for no-pitch-in-name.wav')).toHaveValue('73');
  await review.getByRole('button',{name:'Add selected sounds'}).click();
  await expect(review).toBeHidden();await expectMultisampleLoaded(page,1);
  await expect(page.getByRole('region',{name:'Focused multisample editor'}).getByRole('spinbutton',{name:'Root note',exact:true})).toHaveValue('73');
});

test('a search miss in Favorites can switch to all presets and clear the query without losing the saved favorite',async({page})=>{
  await drumKitWithPadThree(page,'Gap favorite kit','gap-favorite.wav');await openTransfer(page);
  await toolbar(page).getByRole('button',{name:'Save to library',exact:true}).click();
  await expect(page.getByText('Saved drum kit “Gap favorite kit” to the library in this browser.',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Library',exact:true}).click();
  await page.getByRole('button',{name:'Add Gap favorite kit to favorites',exact:true}).click();
  const scopes=page.getByRole('navigation',{name:'Library sections'});
  await scopes.getByRole('button',{name:/^Favorites/}).click();
  await page.getByLabel('Search presets, descriptions, and tags',{exact:true}).fill('no-matching-name');
  await expect(page.getByText('No presets match your search',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Browse all presets',exact:true}).click();
  await expect(page.getByRole('heading',{name:'All presets',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Select Gap favorite kit',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Remove Gap favorite kit from favorites',exact:true})).toBeVisible();
});

test('focused drum audition starts audio and direction changes are undoable',async({page})=>{
  await page.addInitScript(()=>{const original=AudioBufferSourceNode.prototype.start;Reflect.set(window,'gapAuditions',0);AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){Reflect.set(window,'gapAuditions',Reflect.get(window,'gapAuditions')+1);return original.apply(this,args);};});
  await drumKitWithPadThree(page,'Gap audition kit','gap-audition.wav');
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  await editor.getByRole('button',{name:'Play selected',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'gapAuditions'))).toBeGreaterThan(0);
  await editor.getByRole('button',{name:'Forward',exact:true}).click();
  await expect(editor.getByRole('button',{name:'Reverse',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(editor.getByRole('button',{name:'Forward',exact:true})).toHaveAttribute('aria-pressed','false');
  await editor.locator('canvas').first().click({position:{x:40,y:45}});
  const zoom=page.getByRole('dialog',{name:'Zoom and edit',exact:true});await expect(zoom).toBeVisible();
  await zoom.getByRole('button',{name:'Cancel',exact:true}).click();await expect(zoom).toBeHidden();
});
