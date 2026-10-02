import { test, expect } from './control-audit-test';

test.beforeEach(async ({ page }) => {
  // Exercise source storage integration in a real browser without mounting the app's
  // autosave lifecycle, which is covered separately by the UI workflow tests.
  await page.route('http://127.0.0.1:5187/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Storage integrity</title>',
  }));
});

// These use the app's real source storage functions and the browser's real IndexedDB.
// A transaction fault is injected at the browser boundary, not a fake database.
test('failed session replacement retains the previous complete recovery snapshot', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const defaultsUrl = '/src/utils/defaultSettings.ts';
    const sessionUrl = '/src/utils/sessionStorageIndexedDB.ts';
    const dbUrl = '/src/utils/indexedDB.ts';
    const { defaultDrumSettings, defaultMultisampleSettings } = await import(defaultsUrl);
    const { sessionStorageIndexedDB: session } = await import(sessionUrl);
    const { indexedDB: db } = await import(dbUrl);
    const audio = new AudioBuffer({ length: 32, sampleRate: 48000, numberOfChannels: 1 });
    audio.getChannelData(0).fill(Math.fround(0.12345678));
    const sample = {
      file: new File([new Uint8Array([1, 2, 3, 4])], 'original.wav', { type: 'audio/wav' }),
      audioBuffer: audio, name: 'original.wav', isLoaded: true, isAssigned: true,
      assignedKey: 5, inPoint: 0, outPoint: audio.duration, playmode: 'oneshot',
      reverse: false, transpose: 0, pan: 0, gain: 0, hasBeenEdited: false,
      originalBitDepth: 24, originalSampleRate: 48000, originalChannels: 1,
    };
    const state = {
      drumSettings: { ...defaultDrumSettings, presetName: 'Keep me' },
      multisampleSettings: defaultMultisampleSettings, drumSamples: [sample], multisampleFiles: [],
      selectedMultisample: null, isDrumKeyboardPinned: false, isMultisampleKeyboardPinned: false,
      importedDrumPreset: null, importedMultisamplePreset: null, midiNoteMapping: 'C4',
    };
    await session.saveSession(state);
    const before = await db.getSession('current-session');
    const original = IDBObjectStore.prototype.put;
    let rejected = false;
    try {
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'sessions') throw new DOMException('Injected transaction failure', 'DataCloneError');
        return original.apply(this, args);
      };
      await session.saveSession({ ...state, drumSettings: { ...state.drumSettings, presetName: 'Must not replace' } });
    } catch {
      rejected = true;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    const after = await db.getSession('current-session');
    const referenced = await Promise.all(before.drumSamples.map(async (entry: { sampleId: string }) => {
      const row = await db.getSample(entry.sampleId);
      return !!row && row.data.size > 0;
    }));
    return { rejected, before, after, referenced };
  });
  expect(result.rejected).toBe(true);
  expect(result.after).toEqual(result.before);
  expect(result.referenced).toEqual([true]);
});

test('library audio preserves precision, channel count and original sample rate', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const libraryUrl = '/src/utils/libraryUtils.ts';
    const defaultsUrl = '/src/utils/defaultSettings.ts';
    const dbUrl = '/src/utils/indexedDB.ts';
    const { savePresetToLibrary, blobToAudioBuffer } = await import(libraryUrl);
    const { defaultDrumSettings, defaultMultisampleSettings } = await import(defaultsUrl);
    const { indexedDB: db } = await import(dbUrl);
    const audio = new AudioBuffer({ length: 32, sampleRate: 48000, numberOfChannels: 2 });
    audio.getChannelData(0).fill(Math.fround(0.12345678));
    audio.getChannelData(1).fill(Math.fround(-0.00000013));
    const state = {
      drumSettings: defaultDrumSettings, multisampleSettings: defaultMultisampleSettings,
      drumSamples: [{ file: new File(['source'], 'precise.wav'), audioBuffer: audio,
        name: 'precise.wav', isLoaded: true, isAssigned: true, assignedKey: 0,
        originalBitDepth: 24, originalSampleRate: 48000, originalChannels: 2,
        duration: audio.duration, inPoint: 0, outPoint: audio.duration }],
      multisampleFiles: [], importedDrumPreset: null, importedMultisamplePreset: null,
    };
    const saved = await savePresetToLibrary(state, 'Precision fixture', 'drum');
    if (!saved.success) throw new Error(saved.error);
    const presets = await db.getAllPresets();
    const preset = presets.find((item: { name: string }) => item.name === 'Precision fixture');
    const context = new AudioContext({ sampleRate: 44100 });
    try {
      const restored = await blobToAudioBuffer(preset.data.drumSamples[0].audioBlob, context);
      return { channels: restored.numberOfChannels, rate: restored.sampleRate, length: restored.length,
        left: restored.getChannelData(0)[0], right: restored.getChannelData(1)[0] };
    } finally { await context.close(); }
  });
  expect(result).toEqual({ channels: 2, rate: 48000, length: 32,
    left: Math.fround(0.12345678), right: Math.fround(-0.00000013) });
});

test('a stale storage owner detects another revision and cannot overwrite it before explicit restore',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const sessionUrl='/src/utils/sessionStorageIndexedDB.ts',defaultsUrl='/src/utils/defaultSettings.ts',dbUrl='/src/utils/indexedDB.ts';const {SessionStorageManagerIndexedDB:Manager}=await import(sessionUrl);const {defaultDrumSettings,defaultMultisampleSettings}=await import(defaultsUrl);const {indexedDB:db}=await import(dbUrl);const owner=Manager.createForTesting(),other=Manager.createForTesting();
  const state={drumSettings:{...defaultDrumSettings,presetName:'Owner A'},multisampleSettings:defaultMultisampleSettings,drumSamples:[],multisampleFiles:[],selectedMultisample:null,isDrumKeyboardPinned:false,isMultisampleKeyboardPinned:false,importedDrumPreset:null,importedMultisamplePreset:null,midiNoteMapping:'C3'};
  try{await owner.saveSession(state);const unchanged=await owner.hasExternalRevisionChange();await other.loadSession();await other.saveSession({...state,drumSettings:{...state.drumSettings,presetName:'Owner B'}});const changed=await owner.hasExternalRevisionChange();let staleSaveRejected=false;try{await owner.saveSession(state);}catch{staleSaveRejected=true;}const retained=(await db.getSession('current-session')).drumSettings.presetName;const restored=await owner.restoreSession();const afterRestore=await owner.hasExternalRevisionChange();return{unchanged,changed,staleSaveRejected,retained,restoredName:restored.drumSettings.presetName,afterRestore};}finally{owner.dispose();other.dispose();}
 });expect(result).toEqual({unchanged:false,changed:true,staleSaveRejected:true,retained:'Owner B',restoredName:'Owner B',afterRestore:false});
});

test('library saved flag changes advance revisions and reject a stale writer',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const sessionUrl='/src/utils/sessionStorageIndexedDB.ts',defaultsUrl='/src/utils/defaultSettings.ts',dbUrl='/src/utils/indexedDB.ts';const {SessionStorageManagerIndexedDB:Manager}=await import(sessionUrl);const {defaultDrumSettings,defaultMultisampleSettings}=await import(defaultsUrl);const {indexedDB:db}=await import(dbUrl);const owner=Manager.createForTesting(),stale=Manager.createForTesting();
  const state={drumSettings:{...defaultDrumSettings,presetName:'Flag fixture'},multisampleSettings:defaultMultisampleSettings,drumSamples:[],multisampleFiles:[],selectedMultisample:null,isDrumKeyboardPinned:false,isMultisampleKeyboardPinned:false,importedDrumPreset:null,importedMultisamplePreset:null,midiNoteMapping:'C3'};
  try{await owner.saveSession(state);await stale.loadSession();const first=await db.getSession('current-session');await owner.markSessionAsSavedToLibrary();const marked=await db.getSession('current-session');let staleFlagRejected=false;try{await stale.resetSavedToLibraryFlag();}catch{staleFlagRejected=true;}const afterStale=await db.getSession('current-session');await owner.resetSavedToLibraryFlag();const reset=await db.getSession('current-session');return{marked:marked.savedToLibrary,reset:reset.savedToLibrary,markAdvanced:first.revisionToken!==marked.revisionToken,resetAdvanced:marked.revisionToken!==reset.revisionToken,staleFlagRejected,unchangedAfterStale:JSON.stringify(afterStale)===JSON.stringify(marked),name:reset.drumSettings.presetName};}finally{owner.dispose();stale.dispose();}
 });expect(result).toEqual({marked:true,reset:false,markAdvanced:true,resetAdvanced:true,staleFlagRejected:true,unchangedAfterStale:true,name:'Flag fixture'});
});

test('window focus detects a missed cross-tab notification and preserves the other saved revision',async({page,context})=>{
 await page.unroute('http://127.0.0.1:5187/');const {gotoWorkspace}=await import('./workspace-actions');await gotoWorkspace(page,'drum');const name=page.getByRole('textbox',{name:'Instrument name',exact:true});await name.fill('Original tab');await name.blur();await expect(page.getByRole('status').filter({hasText:'Saved locally'})).toBeVisible();
 const other=await context.newPage();await other.route('http://127.0.0.1:5187/',route=>route.fulfill({contentType:'text/html',body:'<title>Isolated competing tab</title>'}));await other.goto('/');
 await other.evaluate(async()=>{const dbUrl='/src/utils/indexedDB.ts';const {indexedDB:db}=await import(dbUrl);const current=await db.getSession('current-session');await db.updateSessionWithRevision('current-session',current.revisionToken,(session:Record<string,unknown>)=>({...session,drumSettings:{...(session.drumSettings as Record<string,unknown>),presetName:'Other tab saved'}}));});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('alert').filter({hasText:/Saved recovery changed in another tab/})).toBeVisible();await name.fill('Unsaved stale edit');await name.blur();await expect(page.getByRole('button',{name:'Retry save',exact:true})).toHaveCount(0);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(page.getByRole('alert').filter({hasText:/another tab/})).toBeVisible();const retained=await other.evaluate(async()=>{const dbUrl='/src/utils/indexedDB.ts';const {indexedDB:db}=await import(dbUrl);return(await db.getSession('current-session')).drumSettings.presetName;});expect(retained).toBe('Other tab saved');await expect(name).toHaveValue('Unsaved stale edit');await other.close();
});
