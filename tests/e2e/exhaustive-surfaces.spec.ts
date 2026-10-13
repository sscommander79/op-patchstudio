import {test as base,expect,type Locator,type Page} from './control-audit-test';
import {applyAudioImport} from './import-helpers';
import {expectDrumLoaded,expectMultisampleLoaded,gotoWorkspace,openAdvanced,openWorkspace,projectAction} from './workspace-actions';

// Exhaustive surface gallery. Each journey walks connected screens and dialogs as a user would, asserts
// the consequences that matter on every surface (no sideways page scroll, one main landmark, reachable
// dialog actions, work preserved across Cancel and navigation) and saves a screenshot for human review.
// Screenshots are evidence only; passing assertions are not visual approval.
//
// Isolation: every non-local request is intercepted (aborted unless a test opts in to a synthetic
// response), microphone and MIDI permission requests are replaced with a counting rejection, and each
// test runs in a disposable browser context.

const GALLERY=process.env.OPSTUDIO_EXHAUSTIVE_GALLERY??'/Users/stevencommander/Documents/ChatGPT/OPXY/design/exhaustive-validation-2026-10-07/evidence/gallery';
const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
const VIEWPORTS={390:{width:390,height:844},1440:{width:1440,height:1000}} as const;
type Width=keyof typeof VIEWPORTS;
type Appearance='field'|'opxy';
type Theme='light'|'dark';

type Guard={
  /** Every non-local URL the page tried to reach. */
  external:string[];
  /** Non-local URLs that were aborted because no test opted in to them. */
  blocked:string[];
  deviceRequests:string[];
  serve:(host:RegExp,response:{contentType:string;body:string})=>void;
  requestsTo:(host:RegExp)=>string[];
};

const test=base.extend<{guard:Guard}>({
  guard:[async({context},use,testInfo)=>{
    const synthetic:{host:RegExp;response:{contentType:string;body:string}}[]=[];
    const guard:Guard={external:[],blocked:[],deviceRequests:[],
      serve:(host,response)=>{synthetic.push({host,response});},
      requestsTo:host=>guard.external.filter(url=>host.test(new URL(url).hostname))};
    await context.route(url=>/^https?:$/.test(url.protocol)&&!LOCAL_HOSTS.has(url.hostname),route=>{
      const url=route.request().url();guard.external.push(url);
      const match=synthetic.find(item=>item.host.test(new URL(url).hostname));
      if(match)return route.fulfill({status:200,...match.response});
      guard.blocked.push(url);return route.abort('blockedbyclient');
    });
    await context.exposeBinding('__exhaustiveDeviceRequest',(_source,kind:string)=>{guard.deviceRequests.push(kind);});
    await context.addInitScript(()=>{
      const report=(kind:string)=>void (window as Window&{__exhaustiveDeviceRequest?:(kind:string)=>Promise<void>}).__exhaustiveDeviceRequest?.(kind);
      const denied=()=>new DOMException('Device access is disabled in the exhaustive surface run','NotAllowedError');
      Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:()=>{report('midi');return Promise.reject(denied());}});
      if(navigator.mediaDevices)Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{report('microphone');return Promise.reject(denied());}});
    });
    await use(guard);
    await testInfo.attach('external-requests',{body:JSON.stringify({attempted:guard.external,blocked:guard.blocked},null,2),contentType:'application/json'});
    expect(guard.deviceRequests,'Viewing these surfaces must never ask for the microphone or MIDI').toEqual([]);
  },{auto:true}],
});

// Deterministic 1 s, 48 kHz mono 16-bit sine; generated in memory.
function tone(name='gallery-C4.wav') {
  const frames=48000,buffer=Buffer.alloc(44+frames*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(48000,24);buffer.writeUInt32LE(96000,28);
  buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  for(let frame=0;frame<frames;frame++)buffer.writeInt16LE(Math.round(Math.sin(2*Math.PI*261.63*frame/48000)*12000),44+frame*2);
  return {name,mimeType:'audio/wav',buffer};
}

async function present(page:Page,width:Width,appearance:Appearance,theme:Theme) {
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
async function expectNoPageOverflow(page:Page,label:string,soft=false) {
  const measure=()=>page.evaluate(()=>{
    const root=document.documentElement,limit=root.clientWidth,overflow=root.scrollWidth-limit;
    if(overflow<=0)return {overflow:0,offenders:[] as string[]};
    const contained=(element:Element)=>{
      for(let node=element.parentElement;node&&node!==root;node=node.parentElement)if(/auto|scroll|hidden|clip/.test(getComputedStyle(node).overflowX))return true;
      return false;
    };
    const offenders=[...document.querySelectorAll('body *')].filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.right>limit+1&&!contained(element);})
      .slice(0,6).map(element=>`${element.tagName.toLowerCase()}${element.id?`#${element.id}`:''}${typeof element.className==='string'&&element.className?`.${element.className.trim().split(/\s+/).join('.')}`:''}`);
    return {overflow,offenders};
  });
  await (soft?expect.soft:expect)(async()=>{
    const result=await measure();
    expect(result.overflow,`${label}: the page scrolls sideways by ${result.overflow}px; widest elements: ${result.offenders.join(' | ')}`).toBeLessThanOrEqual(0);
  }).toPass({timeout:3000});
}

/** Exactly one page-level main landmark. A dialog's own content region is not a page landmark. */
async function expectOneMain(page:Page,label:string) {
  await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('main, [role="main"]')].filter(element=>!element.closest('[role="dialog"]')).length),
    {message:`${label}: one main landmark`}).toBe(1);
}

/** Named dialog actions can be scrolled to, sit inside the viewport and are not covered by another layer. */
async function expectDialogUsable(page:Page,dialog:Locator,actions:(string|RegExp)[]) {
  await expect(dialog).toBeVisible();
  const viewport=page.viewportSize()!;
  for(const name of actions) {
    const control=dialog.getByRole('button',{name,exact:true}).first();
    await control.scrollIntoViewIfNeeded();
    await expect(control,`"${name}" can be brought into view`).toBeInViewport({ratio:.9});
    const box=(await control.boundingBox())!;
    expect(box.x,`"${name}" is not cut off on the left`).toBeGreaterThanOrEqual(-1);
    expect(box.x+box.width,`"${name}" is not cut off on the right`).toBeLessThanOrEqual(viewport.width+1);
    expect(await control.evaluate(element=>{const rect=element.getBoundingClientRect(),top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return !!top&&(element===top||element.contains(top));}),
      `"${name}" is not covered by another layer`).toBe(true);
  }
}

type Surface={
  /** Audit a page surface, then save a full-page screenshot. */
  capture:(name:string)=>Promise<void>;
  /** Check a dialog's actions, then save a viewport screenshot (dialogs are fixed to the viewport). */
  captureDialog:(name:string,dialog:Locator,actions:(string|RegExp)[])=>Promise<void>;
};

function surface(page:Page,folder:string,journey:string,softLayout=false):Surface {
  let index=0;
  const file=(name:string)=>`${GALLERY}/${folder}/${journey}-${String(++index).padStart(2,'0')}-${name}.png`;
  return {
    capture:async name=>{
      await clearTransientOverlays(page);await settle(page);
      await expectNoPageOverflow(page,name,softLayout);await expectOneMain(page,name);
      await page.screenshot({path:file(name),fullPage:true});
    },
    captureDialog:async(name,dialog,actions)=>{
      await settle(page);await expectDialogUsable(page,dialog,actions);
      await expectNoPageOverflow(page,name,softLayout);
      await page.screenshot({path:file(name)});
    },
  };
}

const workspaceNav=(page:Page,name:'Overview'|'Library'|'Transfer'|'Devices')=>page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name,exact:true});
const instrumentName=(page:Page)=>page.getByRole('region',{name:'Instrument project controls'}).getByRole('textbox',{name:'Instrument name',exact:true});
const focusInside=(dialog:Locator)=>dialog.evaluate(element=>element.contains(document.activeElement));

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

async function loadDemoKit(page:Page,name:string) {
  await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  await expectDrumLoaded(page,10);
  await instrumentName(page).fill(name);await instrumentName(page).blur();
}

const sources=[
  {title:'One audio file',action:'Add audio file',needs:'An audio recording and the note it was played on.'},
  {title:'A set of recorded notes',action:'Add recorded notes',needs:'Audio files from your own recordings or a compatible sample pack.'},
  {title:'A software instrument',action:'Connect and check sound',needs:'Your instrument open in music software'},
  {title:'A hardware instrument',action:'Connect and check sound',needs:'Your synth, a MIDI output to it and an audio input from it.'},
] as const;

async function shellJourney(page:Page,s:Surface) {
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1,name:'What are you working on?'})).toBeVisible();
  for(const module of ['Make a playable instrument','Record a drum sound','Build a drum kit','Record OP-XY tracks'])await expect(page.getByRole('heading',{level:2,name:module,exact:true})).toBeVisible();
  await s.capture('overview');

  const tracks=page.getByRole('dialog',{name:'Record OP-XY tracks',exact:true});
  await page.getByRole('button',{name:'Record OP-XY tracks',exact:true}).click();
  await s.captureDialog('track-recorder-no-device',tracks,['Close']);
  await tracks.getByRole('button',{name:'Close',exact:true}).first().click();await expect(tracks).toBeHidden();

  await page.getByRole('button',{name:'Setup guide: build a drum kit',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'Build your kit'})).toBeVisible();
  await s.capture('drum-setup-guide');
  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'What would you like to make?'})).toBeVisible();
  await s.capture('guided-create');

  await workspaceNav(page,'Overview').click();
  await page.getByRole('button',{name:'Choose a source',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'Where will your sound come from?'})).toBeVisible();
  for(const source of sources) {
    const card=page.getByRole('button',{name:new RegExp(`^${source.title}`)});
    await card.click();await expect(card).toHaveAttribute('aria-pressed','true');
    const steps=page.getByRole('region',{name:`${source.title} steps`});
    await expect(steps).toContainText(source.needs);
    await expect(steps.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('button',{name:source.action,exact:true})).toBeVisible();
    await s.capture(`source-${source.title.toLowerCase().replace(/[^a-z]+/g,'-')}`);
  }

  // Help opens over the chosen source and must hand the same choice back.
  const hardware=page.getByRole('button',{name:/^A hardware instrument/});
  await page.getByRole('button',{name:'Help',exact:true}).click();
  const help=page.getByRole('dialog',{name:'Help'});
  await expect(help.getByRole('heading',{level:3,name:'Choose a task'})).toBeVisible();
  await s.captureDialog('help-topic',help,['Close Help','Return to my task']);
  await help.getByRole('navigation',{name:'Help topics'}).getByRole('button',{name:'Hardware synth connections',exact:true}).click();
  await expect(help.getByRole('heading',{level:3,name:'Hardware synth connections'})).toBeVisible();
  const search=help.getByRole('searchbox',{name:'Search help'});
  await search.fill('record');
  await expect.poll(()=>help.getByRole('article').count(),{message:'a broad search lists several guides'}).toBeGreaterThan(1);
  await s.captureDialog('help-results',help,['Close Help']);
  await search.fill('zzzzmissing');
  await expect(help.getByText('No guide matches this search.',{exact:false})).toBeVisible();
  await expect(help.getByRole('article')).toHaveCount(0);
  await s.captureDialog('help-no-results',help,['Clear search','Close Help']);
  await help.getByRole('button',{name:'Clear search',exact:true}).click();
  await expect(help.getByRole('heading',{level:3,name:'Hardware synth connections'})).toBeVisible();
  await help.getByRole('button',{name:'Return to my task',exact:true}).click();
  await expect(help).toBeHidden();
  await expect(hardware).toHaveAttribute('aria-pressed','true');

  await workspaceNav(page,'Transfer').click();
  await expect(page.getByRole('heading',{level:1,name:'Back up and transfer'})).toBeVisible();
  const choice=page.getByLabel('Instrument to save or download');
  await choice.selectOption('multisample');
  await instrumentName(page).fill('Gallery keys');
  await expect(page.getByText('Playable instrument — Gallery keys')).toBeVisible();
  for(const action of ['Back up project','Open project','Save to library','Download OP-XY preset'])await expect(page.getByRole('region',{name:'Instrument project controls'}).getByRole('button',{name:action,exact:true}).first()).toBeVisible();
  await expect(page.getByText('The app cannot confirm that you copied or played it on your OP-XY.')).toBeVisible();
  await s.capture('transfer');

  await workspaceNav(page,'Devices').click();
  await expect(page.getByRole('heading',{level:1,name:'Devices'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enable MIDI',exact:true})).toBeEnabled();
  await expect(page.getByRole('combobox',{name:'MIDI output',exact:true})).toBeDisabled();
  await expect(page.getByRole('combobox',{name:'MIDI channel',exact:true})).toBeDisabled();
  await expect(page.getByText(/No MIDI events yet/)).toBeVisible();
  await s.capture('devices-no-device');

  // The transfer choice and the typed name survive a trip through another workspace.
  await workspaceNav(page,'Transfer').click();
  await expect(choice).toHaveValue('multisample');
  await expect(instrumentName(page)).toHaveValue('Gallery keys');
}

async function drumJourney(page:Page,s:Surface) {
  await gotoWorkspace(page,'drum');
  await expectDrumLoaded(page,0);
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  await expect(editor).toBeVisible();
  await s.capture('drum-empty-focus');
  const view=(name:'Focus'|'Table')=>page.getByRole('button',{name,exact:true});
  await view('Table').click();await expect(view('Table')).toHaveAttribute('aria-pressed','true');
  await s.capture('drum-empty-table');
  await view('Focus').click();

  await loadDemoKit(page,'Gallery kit');
  await expect(editor.getByRole('button',{name:'Play selected',exact:true})).toBeVisible();
  await s.capture('drum-demo-focus');
  await view('Table').click();
  await expect(page.getByTitle('settings',{exact:true}).first()).toBeVisible();
  await s.capture('drum-demo-table');

  await page.getByTitle('settings',{exact:true}).first().click();
  const options=page.getByRole('dialog',{name:'Sample options',exact:true});
  await s.captureDialog('drum-sample-options',options,['Cancel','Save']);
  await options.getByRole('button',{name:'Cancel',exact:true}).click();await expect(options).toBeHidden();

  await page.getByTitle('slice this sample',{exact:true}).first().click();
  const slicer=page.getByRole('dialog',{name:'slice audio',exact:true});
  await expect(slicer.locator('canvas').first()).toBeVisible();
  await s.captureDialog('drum-slice-audio',slicer,['Cancel']);
  await slicer.getByRole('button',{name:'Cancel',exact:true}).click();await expect(slicer).toBeHidden();

  await page.getByRole('button',{name:'Edit multiple sounds',exact:true}).click();
  const bulk=page.getByRole('dialog',{name:'Bulk edit samples',exact:true});
  await s.captureDialog('drum-bulk-edit',bulk,['Cancel','Apply to 10 samples']);
  await bulk.getByRole('button',{name:'Cancel',exact:true}).click();await expect(bulk).toBeHidden();

  await page.getByRole('button',{name:'Record takes',exact:true}).click();
  const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});
  await s.captureDialog('drum-record-takes-no-device',recorder,['Close']);
  await recorder.getByRole('button',{name:'Close',exact:true}).click();await expect(recorder).toBeHidden();

  await page.getByRole('region',{name:'Instrument project controls'}).getByRole('button',{name:'Download OP-XY preset',exact:true}).click();
  const preflight=page.getByRole('dialog',{name:'Export OP-XY preset',exact:true});
  await expect(preflight.getByLabel('Instrument name',{exact:true})).toHaveValue('Gallery kit');
  await expect(preflight).toContainText('10 mapped samples');
  await s.captureDialog('drum-export-preflight',preflight,['Close','Download OP-XY preset']);
  await preflight.getByText('File naming and format',{exact:true}).click();
  await expect(preflight.getByLabel('Audio format')).toBeVisible();
  await s.captureDialog('drum-export-format',preflight,['Close','Download OP-XY preset']);
  await preflight.getByRole('button',{name:'Close',exact:true}).click();await expect(preflight).toBeHidden();

  // Every dialog above was cancelled: the kit is untouched.
  await expectDrumLoaded(page,10);
  await expect(instrumentName(page)).toHaveValue('Gallery kit');
  await openAdvanced(page,/Preset and performance settings/);
  await s.capture('drum-preset-settings');

  await workspaceNav(page,'Overview').click();
  await expect(page.getByText('10 / 24 pads loaded',{exact:true})).toBeVisible();
  await s.capture('overview-with-kit');
  await page.getByRole('button',{name:'Open kit',exact:true}).click();
  await expectDrumLoaded(page,10);
  await expect(instrumentName(page)).toHaveValue('Gallery kit');
}

async function multisampleJourney(page:Page,s:Surface) {
  await gotoWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,0);
  const editor=page.getByRole('region',{name:'Focused multisample editor'});
  await expect(editor.getByRole('heading',{name:'Add samples to your instrument'})).toBeVisible();
  await s.capture('multisample-empty-focus');
  const view=(name:'Focus'|'Table')=>page.getByRole('button',{name,exact:true});
  await view('Table').click();await expect(view('Table')).toHaveAttribute('aria-pressed','true');
  await s.capture('multisample-empty-table');
  await view('Focus').click();

  await page.getByLabel('choose multisample audio files').setInputFiles(tone());
  await applyAudioImport(page);
  await expectMultisampleLoaded(page,1);
  await expect(editor).toContainText('gallery-C4.wav');
  await expect(page.getByRole('complementary',{name:'Multisampling guide'})).toBeVisible();
  await instrumentName(page).fill('Gallery keys');await instrumentName(page).blur();
  await s.capture('multisample-loaded-focus');

  const suggestions=page.getByRole('region',{name:'Marker suggestions'});
  await suggestions.getByRole('button',{name:'Analyze sound',exact:true}).click();
  await expect(suggestions.getByRole('status')).toContainText(/Trim:|No safe trim suggested\./);
  await s.capture('multisample-loop-suggestion');
  await suggestions.getByRole('button',{name:'Discard suggestion',exact:true}).click();
  await expect(suggestions.getByRole('status')).toHaveCount(0);

  const zoomButton=editor.getByRole('button',{name:'Zoom and edit waveform',exact:true}).last();
  const zoom=page.getByRole('dialog',{name:'Zoom and edit',exact:true});
  await zoomButton.click();
  const loopStart=zoom.getByLabel('Loop start frames');
  // Wait for the audio-backed draft rather than reading the modal's initial placeholder.
  await expect.poll(async()=>Number(await zoom.getByLabel('Playback end frames').inputValue())).toBeGreaterThan(1);
  const original=await loopStart.inputValue();
  await loopStart.fill(String(Number(original)+240));
  await s.captureDialog('multisample-zoom-and-loop',zoom,['Cancel','Save markers']);
  await zoom.getByRole('button',{name:'Cancel',exact:true}).click();await expect(zoom).toBeHidden();
  await zoomButton.click();
  await expect(loopStart,'Cancel discards the marker draft').toHaveValue(original);
  await zoom.getByRole('button',{name:'Cancel',exact:true}).click();await expect(zoom).toBeHidden();

  await view('Table').click();
  await expect(page.getByPlaceholder('C4 or 60').first()).toBeVisible();
  await s.capture('multisample-loaded-table');
  await view('Focus').click();

  const settings=await openAdvanced(page,/Preset and performance settings/);
  await expect(settings.locator('[aria-label="Basic settings"]')).toBeVisible();
  await s.capture('multisample-settings');

  await page.getByRole('region',{name:'Instrument project controls'}).getByRole('button',{name:'Download OP-XY preset',exact:true}).click();
  const preflight=page.getByRole('dialog',{name:'Export OP-XY preset',exact:true});
  await expect(preflight.getByLabel('Instrument name',{exact:true})).toHaveValue('Gallery keys');
  await expect(preflight).toContainText('1 mapped sample');
  await s.captureDialog('multisample-export-preflight',preflight,['Close','Download OP-XY preset']);
  await preflight.getByRole('button',{name:'Close',exact:true}).click();await expect(preflight).toBeHidden();

  await workspaceNav(page,'Overview').click();
  await expect(page.getByText('1 / 24 zones loaded',{exact:true})).toBeVisible();
  await s.capture('overview-with-instrument');
  await openWorkspace(page,'multisample');
  await expectMultisampleLoaded(page,1);
  await expect(instrumentName(page)).toHaveValue('Gallery keys');
  await expect(editor).toContainText('gallery-C4.wav');
}

async function libraryJourney(page:Page,s:Surface,guard:Guard) {
  await page.goto('/#/studio/library');
  await expect(page.getByRole('complementary',{name:'Library collections'})).toBeVisible();
  await expect(page.getByText('No saved presets yet',{exact:true})).toBeVisible();
  await s.capture('library-empty');

  await page.getByRole('button',{name:'Build a drum kit',exact:true}).click();
  await expectDrumLoaded(page,0);
  await loadDemoKit(page,'Gallery kit');
  await projectAction(page,'Save to library');
  await expect(page.getByText('Saved drum kit “Gallery kit” to the library in this browser.',{exact:true})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Saved in this browser'})).toBeVisible({timeout:15_000});

  await openWorkspace(page,'library');
  const saved=page.getByRole('checkbox',{name:'Select Gallery kit',exact:true});
  await expect(saved).toBeVisible();
  await s.capture('library-populated');

  const search=page.getByLabel('Search presets, descriptions, and tags',{exact:true});
  await search.fill('zzzzmissing');
  await expect(page.getByText('No presets match your search',{exact:true})).toBeVisible();
  await s.capture('library-no-results');
  await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();
  await expect(saved).toBeVisible();

  const edit=page.getByRole('button',{name:'Edit details for Gallery kit',exact:true});
  const details=page.getByRole('dialog',{name:'Edit details for Gallery kit',exact:true});
  await edit.click();
  await details.getByLabel('Preset description',{exact:true}).fill('Discarded description');
  await s.captureDialog('library-details',details,['Cancel','Save details']);
  await details.getByRole('button',{name:'Cancel',exact:true}).click();await expect(details).toBeHidden();
  await edit.click();
  await expect(details.getByLabel('Preset description',{exact:true}),'Cancel discards the description draft').not.toHaveValue('Discarded description');
  await details.getByLabel('Preset description',{exact:true}).fill('Punchy starter kit');
  await details.getByLabel('Preset tags',{exact:true}).fill('demo, drums');
  await details.getByRole('button',{name:'Save details',exact:true}).click();await expect(details).toBeHidden();
  await search.fill('punchy');await expect(saved).toBeVisible();
  await search.fill('');

  await page.getByRole('button',{name:'New collection',exact:true}).click();
  const creating=page.getByRole('dialog',{name:'New collection',exact:true});
  await creating.getByLabel('Collection name',{exact:true}).fill('Evening set');
  await s.captureDialog('library-new-collection',creating,['Cancel','Create collection']);
  await creating.getByRole('button',{name:'Create collection',exact:true}).click();await expect(creating).toBeHidden();
  await openLibrarySection(page,/^All presets/);
  await saved.check();
  await page.getByRole('group',{name:'Selected preset actions'}).getByRole('button',{name:'Add to collection',exact:true}).click();
  const adding=page.getByRole('dialog',{name:'Add to collection',exact:true});
  await adding.getByLabel('Choose collection',{exact:true}).selectOption({label:'Evening set'});
  await s.captureDialog('library-add-to-collection',adding,['Cancel','Add to collection']);
  await adding.getByRole('button',{name:'Add to collection',exact:true}).click();await expect(adding).toBeHidden();
  await openLibrarySection(page,'Collection Evening set');
  await expect(page.getByRole('heading',{level:1,name:'Evening set',exact:true})).toBeVisible();
  await expect(saved).toBeVisible();
  await s.capture('library-collection');

  // Feedback: nothing reaches Google until the user asks for the form.
  await page.goto('/#/feedback');
  await expect(page.getByRole('heading',{level:1,name:'Feedback'})).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(guard.requestsTo(/google\./),'no Google request before the user opts in').toEqual([]);
  await s.capture('feedback-before-opt-in');
  guard.serve(/(^|\.)google\.com$/,{contentType:'text/html',body:'<!doctype html><title>Synthetic form</title><body style="font-family:sans-serif"><h1>Synthetic feedback form</h1><p>Local stand-in. Nothing is sent to Google.</p></body>'});
  await page.getByRole('button',{name:'Load Google form',exact:true}).click();
  await expect(page.frameLocator('iframe[title="OP-PatchStudio feedback form"]').getByRole('heading',{name:'Synthetic feedback form'})).toBeVisible();
  expect(guard.requestsTo(/google\./).length,'the form is requested only after opting in').toBeGreaterThan(0);
  await s.capture('feedback-after-opt-in-synthetic');

  // Support: the post list is requested through a relay only after the user asks for it.
  const relay=/allorigins\.win$|cors-anywhere\.herokuapp\.com$|thingproxy\.freeboard\.io$/;
  await page.goto('/#/donate');
  await expect(page.getByRole('heading',{level:1,name:'Support the project'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Load project posts',exact:true})).toBeVisible();
  expect(guard.requestsTo(relay),'no relay request before the user opts in').toEqual([]);
  expect(guard.requestsTo(/patreon\.com$/),'no Patreon request before the user opts in').toEqual([]);
  await s.capture('support-before-opt-in');
  guard.serve(relay,{contentType:'application/json',body:JSON.stringify({data:[{id:'gallery',attributes:{title:'Synthetic gallery post',content:'Synthetic feed only.',published_at:'2026-09-01',url:'https://www.patreon.com/posts/gallery'}}]})});
  await page.getByRole('button',{name:'Load project posts',exact:true}).click();
  await expect(page.getByRole('heading',{level:3,name:'Synthetic gallery post',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Read more: Synthetic gallery post/})).toHaveAttribute('target','_blank');
  await s.capture('support-after-opt-in-synthetic');

  // Reloading offers the saved work back; Escape must not throw it away.
  await page.getByRole('link',{name:'← Back to the studio'}).click();
  await expect(page.getByRole('heading',{level:1,name:'What are you working on?'})).toBeVisible();
  await page.reload();
  const recovery=page.getByRole('dialog',{name:'Restore saved work?',exact:true});
  await expect(recovery).toContainText(/\d+ drum samples? and \d+ multisample files?/);
  await page.keyboard.press('Escape');
  await s.captureDialog('restore-saved-work',recovery,['Discard saved work and start new','Restore saved work']);
  await recovery.getByRole('button',{name:'Restore saved work',exact:true}).click();await expect(recovery).toBeHidden();
  await openWorkspace(page,'drum');
  await expectDrumLoaded(page,10);
  await expect(instrumentName(page)).toHaveValue('Gallery kit');
  await openWorkspace(page,'library');
  await expect(saved).toBeVisible();
}

for(const width of [390,1440] as const)for(const appearance of ['field','opxy'] as const)for(const theme of ['light','dark'] as const) {
  const folder=`${width}-${appearance}-${theme}`;
  test.describe(`${width}px ${appearance} ${theme}`,()=>{
    test.beforeEach(async({page})=>{test.setTimeout(180_000);await present(page,width,appearance,theme);});

    test('overview, source choices, help, transfer and devices keep the chosen task',async({page})=>{
      await shellJourney(page,surface(page,folder,'a-shell'));
      await workspaceNav(page,'Overview').click();
      await expectPresentation(page,appearance,theme);
    });

    test('drum kit from empty to demo, with every cancelled dialog leaving the kit intact',async({page})=>{
      await drumJourney(page,surface(page,folder,'b-drum'));
      await expectPresentation(page,appearance,theme);
    });

    test('multisample from empty to loaded, loop review, zoom, settings and export',async({page})=>{
      await multisampleJourney(page,surface(page,folder,'c-multisample'));
      await expectPresentation(page,appearance,theme);
    });

    test('library, opted-in feedback and support content, and restoring saved work',async({page,guard})=>{
      await libraryJourney(page,surface(page,folder,'d-library'),guard);
      await expectPresentation(page,appearance,theme);
    });
  });
}

// Simulation only: the root font size is doubled with CSS. This is not browser zoom and does not change
// the viewport or media queries; it shows how rem-based text and controls reflow at double size.
for(const width of [390,1440] as const) {
  test(`simulated 200% text size (root font-size CSS, not browser zoom) at ${width}px keeps actions reachable`,async({page})=>{
    test.setTimeout(180_000);
    await present(page,width,'field','light');
    const s=surface(page,`large-text-200-simulated-${width}`,'text',true);
    await page.goto('/');
    const title=page.getByRole('heading',{level:1,name:'What are you working on?'});
    const fontSize=()=>title.evaluate(element=>parseFloat(getComputedStyle(element).fontSize));
    const before=await fontSize();
    await page.addStyleTag({content:'html{font-size:200% !important}'});
    // Fluid clamp() mixes rem with viewport units; it need not grow by an arbitrary 1.5x.
    // Record this as a text-size simulation and require a real increase, not browser zoom equivalence.
    expect(await fontSize(),'page text responds to the larger root font').toBeGreaterThan(before);
    await s.capture('overview');
    for(const action of ['Choose a source','Record a sound','Open kit','Record OP-XY tracks']) {
      const control=page.getByRole('button',{name:action,exact:true});
      await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport({ratio:.9});
    }

    await page.getByRole('button',{name:'Choose a source',exact:true}).click();
    await expect(page.getByRole('button',{name:'Add audio file',exact:true})).toBeVisible();
    await s.capture('choose-source');
    await page.getByRole('button',{name:'Help',exact:true}).click();
    const help=page.getByRole('dialog',{name:'Help'});
    await s.captureDialog('help',help,['Close Help','Return to my task']);
    await help.getByRole('button',{name:'Close Help',exact:true}).click();await expect(help).toBeHidden();

    await page.getByRole('button',{name:'Open instrument editor',exact:true}).click();
    await expectMultisampleLoaded(page,0);
    await s.capture('multisample-empty');

    await openWorkspace(page,'drum');
    await loadDemoKit(page,'Large text kit');
    await s.capture('drum-demo-focus');
    const toolbar=page.getByRole('region',{name:'Instrument project controls'});
    for(const button of await toolbar.getByRole('button').all()) {
      await expect.poll(()=>button.evaluate(el=>el.scrollWidth-el.clientWidth),'toolbar labels fit inside their controls').toBeLessThanOrEqual(1);
    }
    expect((await toolbar.getByRole('textbox',{name:'Instrument name'}).boundingBox())!.width).toBeGreaterThan(150);
    const theme=page.getByRole('combobox',{name:'Theme',exact:true});
    expect(await theme.evaluate(el=>{const select=el as HTMLSelectElement,style=getComputedStyle(el),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;ctx.font=style.font;return select.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-ctx.measureText(select.selectedOptions[0].text).width;})).toBeGreaterThan(20);
    await page.getByRole('button',{name:'Table',exact:true}).click();
    await expect(page.getByTitle('settings',{exact:true}).first()).toBeVisible();
    await s.capture('drum-demo-table');
    await page.getByRole('region',{name:'Instrument project controls'}).getByRole('button',{name:'Download OP-XY preset',exact:true}).click();
    const preflight=page.getByRole('dialog',{name:'Export OP-XY preset',exact:true});
    await s.captureDialog('export-preflight',preflight,['Close','Download OP-XY preset']);
    await preflight.getByRole('button',{name:'Close',exact:true}).click();await expect(preflight).toBeHidden();
    await expectDrumLoaded(page,10);

    await workspaceNav(page,'Library').click();
    await expect(page.getByText('No saved presets yet',{exact:true})).toBeVisible();
    await s.capture('library-empty');
    await workspaceNav(page,'Transfer').click();
    await expect(page.getByRole('heading',{level:1,name:'Back up and transfer'})).toBeVisible();
    await s.capture('transfer');
    await workspaceNav(page,'Devices').click();
    await expect(page.getByRole('heading',{level:1,name:'Devices'})).toBeVisible();
    await s.capture('devices-no-device');
  });
}

test.describe('keyboard',()=>{
  async function expectFocusTrapped(page:Page,dialog:Locator,presses=24) {
    await expect.poll(()=>focusInside(dialog),{message:'focus moves into the dialog when it opens'}).toBe(true);
    for(const key of ['Tab','Shift+Tab'])for(let press=0;press<presses;press++) {
      await page.keyboard.press(key);
      expect(await focusInside(dialog),`${key} press ${press+1} keeps focus inside the dialog`).toBe(true);
    }
  }

  test('1440px: header order, workspace heading focus, and Help traps then returns focus',async({page})=>{
    await present(page,1440,'field','light');
    await page.goto('/');
    await expect(page.getByRole('heading',{level:1,name:'What are you working on?'})).toBeFocused();
    // The heading is focused after the header, so the header is walked backwards.
    const order:string[]=[];
    for(let press=0;press<10;press++) {
      await page.keyboard.press('Shift+Tab');
      order.push(await page.evaluate(()=>{const element=document.activeElement;return (element?.getAttribute('aria-label')||element?.textContent||'').trim();}));
    }
    const positions=['Help','Devices','Transfer','Library','Overview'].map(name=>order.indexOf(name));
    expect(positions.every(position=>position>=0),`every header control is reachable by keyboard; saw ${order.join(' › ')}`).toBe(true);
    expect([...positions].sort((a,b)=>a-b),'header controls are reached in their visual order').toEqual(positions);

    await workspaceNav(page,'Library').focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('heading',{level:1,name:'All presets'})).toBeFocused();

    const helpButton=page.getByRole('button',{name:'Help',exact:true});
    await helpButton.focus();await page.keyboard.press('Enter');
    const help=page.getByRole('dialog',{name:'Help'});
    const close=help.getByRole('button',{name:'Close Help',exact:true});
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(help.getByRole('button',{name:'Return to my task',exact:true}).last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await expectFocusTrapped(page,help);
    await page.screenshot({path:`${GALLERY}/keyboard/help-focus-trapped-1440.png`});
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(helpButton).toBeFocused();
  });

  test('1440px: export, demo and confirmation dialogs trap focus, default to the safe action and return focus',async({page})=>{
    test.setTimeout(120_000);
    await present(page,1440,'opxy','dark');
    await gotoWorkspace(page,'drum');
    await loadDemoKit(page,'Keyboard kit');

    const exportButton=page.getByRole('region',{name:'Instrument project controls'}).getByRole('button',{name:'Download OP-XY preset',exact:true});
    await exportButton.focus();await page.keyboard.press('Enter');
    const preflight=page.getByRole('dialog',{name:'Export OP-XY preset',exact:true});
    await expect(preflight).toBeVisible();
    await expectFocusTrapped(page,preflight);
    await page.screenshot({path:`${GALLERY}/keyboard/export-focus-trapped-1440.png`});
    await page.keyboard.press('Escape');
    await expect(preflight).toBeHidden();
    await expect(exportButton).toBeFocused();

    const demoButton=page.getByRole('button',{name:'Add demo kit',exact:true});
    await demoButton.focus();await page.keyboard.press('Enter');
    const demo=page.getByRole('dialog',{name:'Add the demo kit',exact:true});
    await expect(demo).toBeVisible();
    await expectFocusTrapped(page,demo,12);
    await page.keyboard.press('Escape');
    await expect(demo).toBeHidden();
    await expect(demoButton).toBeFocused();
    await expectDrumLoaded(page,10);

    // A destructive confirmation opens on its safe choice, so Enter keeps the sound.
    const editor=page.getByRole('region',{name:'Focused sample editor'}),title=editor.getByRole('heading',{level:3});
    await expect(editor.getByRole('button',{name:'Play selected',exact:true})).toBeVisible();
    const sound=await title.textContent();
    const clear=editor.getByRole('button',{name:'Clear',exact:true});
    await clear.focus();await page.keyboard.press('Enter');
    const cancel=page.getByRole('button',{name:'cancel',exact:true});
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cancel).toBeHidden();
    await expect(title).toHaveText(sound??'');
    await expect(clear).toBeFocused();
    await expectDrumLoaded(page,10);
  });

  test('390px: preset details return focus, and the restore decision cannot be dismissed with Escape',async({page})=>{
    test.setTimeout(120_000);
    await present(page,390,'field','dark');
    await gotoWorkspace(page,'drum');
    await loadDemoKit(page,'Keyboard kit');
    await projectAction(page,'Save to library');
    await expect(page.getByText('Saved drum kit “Keyboard kit” to the library in this browser.',{exact:true})).toBeVisible();
    await expect(page.getByRole('status').filter({hasText:'Saved in this browser'})).toBeVisible({timeout:15_000});

    await openWorkspace(page,'library');
    const edit=page.getByRole('button',{name:'Edit details for Keyboard kit',exact:true});
    await edit.focus();await page.keyboard.press('Enter');
    const details=page.getByRole('dialog',{name:'Edit details for Keyboard kit',exact:true});
    await expect(details).toBeVisible();
    await expectFocusTrapped(page,details,10);
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(edit).toBeFocused();

    await page.reload();
    const recovery=page.getByRole('dialog',{name:'Restore saved work?',exact:true});
    const discard=recovery.getByRole('button',{name:'Discard saved work and start new',exact:true}),restore=recovery.getByRole('button',{name:'Restore saved work',exact:true});
    await expect(restore).toBeFocused();
    await page.keyboard.press('Tab');await expect(discard).toBeFocused();
    await page.keyboard.press('Tab');await expect(restore,'Tab wraps inside the recovery dialog').toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(discard).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(recovery,'Escape neither restores nor discards').toBeVisible();
    await page.screenshot({path:`${GALLERY}/keyboard/restore-focus-trapped-390.png`});
    await restore.focus();await page.keyboard.press('Enter');
    await expect(recovery).toBeHidden();
    await openWorkspace(page,'drum');
    await expectDrumLoaded(page,10);
    await expect(instrumentName(page)).toHaveValue('Keyboard kit');
  });
});
