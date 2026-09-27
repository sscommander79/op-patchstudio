import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { indexedDB as db, STORES } from '../../utils/indexedDB';
import { sessionStorageIndexedDB as sessions } from '../../utils/sessionStorageIndexedDB';
import { appReducer, initialState, type AppAction } from '../../context/AppContext';
import { savePresetToLibrary, deserializeLibraryPreset, type LibraryPreset } from '../../utils/libraryUtils';
import { encodeStoredAudio, decodeStoredAudio, STORED_AUDIO_TYPE } from '../../utils/storedAudio';

const PositionalAudioBuffer = globalThis.AudioBuffer as unknown as new(channels:number,length:number,sampleRate:number)=>AudioBuffer;
export function audioFixture() {
  const audio = new PositionalAudioBuffer(2, 3, 48000);
  audio.getChannelData(0).set([Math.fround(0.12345678), 1.25, -0.00000013]);
  audio.getChannelData(1).set([-0, -1.3, 0.99999994]);
  return audio;
}
export function projectFixture() {
  const audio = audioFixture();
  const file = new File(['original source'], 'source.aif', {type: 'audio/aiff', lastModified: 123});
  const state = {...initialState, drumSamples: initialState.drumSamples.map(s => ({...s})), drumSettings: {...initialState.drumSettings, presetName: 'old'}};
  state.drumSamples[5] = {...state.drumSamples[5], file, audioBuffer: audio, name: 'editable name', isLoaded: true, originalSampleRate: 96000, originalBitDepth: 32, originalChannels: 2, isFloat: true, gain: 7, outPoint: audio.duration};
  state.drumSamples[25] = {...state.drumSamples[5], isAssigned: false, assignedKey: undefined};
  state.importedDrumPreset = {fx: {drive: 22}};
  state.importedMultisamplePreset = {fx: {delay: 31}};
  state.midiNoteMapping = 'C4';
  return state;
}
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('AudioBuffer', class extends PositionalAudioBuffer { constructor(options: AudioBufferOptions) { super(options.numberOfChannels ?? 1, options.length, options.sampleRate); } });
  vi.stubGlobal('AudioContext', class {
    createBuffer(c: number, l: number, r: number) { return new PositionalAudioBuffer(c, l, r); }
    async decodeAudioData() { return new PositionalAudioBuffer(1, 1000, 44100); }
    async close() {}
  });
  vi.stubGlobal('indexedDB', new IDBFactory());
  await db.init();
  sessions.resetForTesting();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('durable storage behavior', () => {
  it('rejects a write whose transaction aborts after request success', async () => {
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(db.update(STORES.METADATA, {key: 'test', value: 1})).rejects.toThrow();
  });
  it('retains all prior samples when replacing session transaction aborts', async () => {
    await sessions.saveSession(projectFixture());
    const old = await db.getSession('current-session');
    const oldRows = await db.getAllSamples();
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = original.apply(this, args);
      if(this.name === STORES.SESSIONS) request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    const next = projectFixture(); next.drumSettings.presetName = 'new';
    await sessions.saveSession(next).catch(() => {});
    spy.mockRestore();
    expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('old');
    for (const row of oldRows) {
      const restored = await db.getSample(row.id);
      expect(restored).not.toBeNull();
      expect(new Uint8Array(await restored!.data.arrayBuffer())).toEqual(new Uint8Array(await row.data.arrayBuffer()));
    }
    expect((await db.getSession('current-session'))?.drumSamples).toEqual(old?.drumSamples);
  });
  it('round-trips current audio exactly with source metadata and editable state', async () => {
    const state = projectFixture();
    await sessions.saveSession(state);
    const saved = (await sessions.loadSession())!;
    const loaded = (await sessions.loadSampleFromSession(saved.drumSamples[0].sampleId))!;
    expect(loaded.audioBuffer.sampleRate).toBe(48000);
    expect(loaded.audioBuffer.numberOfChannels).toBe(2);
    expect(Array.from(loaded.audioBuffer.getChannelData(0))).toEqual([Math.fround(0.12345678), 1.25, Math.fround(-0.00000013)]);
    expect(loaded.metadata.isFloat).toBe(true);
    expect(loaded.metadata.sampleRate).toBe(96000);
    expect(await loaded.file.text()).toBe('original source');
    expect(saved.importedDrumPreset).toEqual({fx: {drive: 22}});
    expect(saved.midiNoteMapping).toBe('C4');
  });
  it('library storage preserves over-range and precision-sensitive Float32 audio', async () => {
    await expect(savePresetToLibrary(projectFixture(), 'precise', 'drum')).resolves.toEqual({success:true});
    const preset = (await db.getAllPresets())[0];
    const {blobToAudioBuffer} = await import('../../utils/libraryUtils');
    const stored = preset.data as {drumSamples:Array<{audioBlob:Blob}>};
    const audio = await blobToAudioBuffer(stored.drumSamples[0].audioBlob, new AudioContext());
    expect(Array.from(audio.getChannelData(0))).toEqual([Math.fround(0.12345678), 1.25, Math.fround(-0.00000013)]);
  });
  it('restores imported preset effects and mapping in the same reducer action', () => {
    const payload = {...projectFixture(), drumSamples: [], importedDrumPreset: {fx:{drive:22}}, importedMultisamplePreset: {fx:{delay:31}}, midiNoteMapping:'C4'};
    const result = appReducer(initialState, {type:'RESTORE_SESSION', payload} as AppAction);
    expect(result.importedDrumPreset).toEqual({fx:{drive:22}});
    expect(result.importedMultisamplePreset).toEqual({fx:{delay:31}});
    expect(result.midiNoteMapping).toBe('C4');
  });
});

it('serializes delayed A, immutable B and clear; a failed operation does not poison C', async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => {release=r;});
  const replace = db.replaceSessionWithSamples.bind(db);
  const spy = vi.spyOn(db,'replaceSessionWithSamples').mockImplementationOnce(async (...args) => {await gate; await replace(...args);});
  const a = projectFixture(); a.drumSettings.presetName='A';
  const b = projectFixture(); b.drumSettings.presetName='B';
  const saveA = sessions.saveSession(a);
  const saveB = sessions.saveSession(b);
  b.drumSettings.presetName='mutated after scheduling';
  release(); await saveA; await saveB;
  expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('B');
  const saveAgain = sessions.saveSession(a);
  const clear = sessions.clearCurrentSession();
  await Promise.all([saveAgain,clear]);
  expect(await db.getSession('current-session')).toBeNull();
  expect(await db.getAllSamples()).toEqual([]);
  spy.mockRejectedValueOnce(new Error('disk failure'));
  await expect(sessions.saveSession(a)).rejects.toThrow('disk failure');
  const c = projectFixture(); c.drumSettings.presetName='C';
  await sessions.saveSession(c);
  expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('C');
});
it('successful replacement removes obsolete audio rows and references only the new rows', async () => {
  await sessions.saveSession(projectFixture());
  const oldIds = (await db.getAllSamples()).map(s=>s.id);
  await sessions.saveSession(projectFixture());
  const session = (await db.getSession('current-session'))!;
  const rows = await db.getAllSamples();
  expect(rows).toHaveLength(2);
  expect(rows.map(s=>s.id).sort()).toEqual(session.drumSamples.map(s=>s.sampleId).sort());
  for (const id of oldIds) expect(await db.getSample(id)).toBeNull();
});
it('validates audio payload bounds, keeps both channels exact and reads legacy JSON/raw bytes', async () => {
  const blob = encodeStoredAudio(audioFixture());
  const audio = await decodeStoredAudio(blob);
  expect(Array.from(audio.getChannelData(1))).toEqual([-0,Math.fround(-1.3),Math.fround(0.99999994)]);
  expect(audio.length).toBe(3);
  const bytes = await blob.arrayBuffer();
  await expect(decodeStoredAudio(new Blob([bytes.slice(0,-1)],{type:STORED_AUDIO_TYPE}))).rejects.toThrow();
  new DataView(bytes).setUint32(12,0xffffffff,true);
  await expect(decodeStoredAudio(new Blob([bytes],{type:STORED_AUDIO_TYPE}))).rejects.toThrow();
  const legacy = new Blob([JSON.stringify({numberOfChannels:1,length:2,sampleRate:48000,channelData:[[0.125,-0.5]]})],{type:'application/json'});
  expect(Array.from((await decodeStoredAudio(legacy)).getChannelData(0))).toEqual([0.125,-0.5]);
  const decode = vi.fn(async (_bytes: ArrayBuffer) => audioFixture());
  const raw = new Blob(['RIFF legacy'],{type:'audio/wav'});
  await decodeStoredAudio(raw,{decodeAudioData:decode} as unknown as AudioContext);
  expect(new TextDecoder().decode(decode.mock.calls[0][0])).toBe('RIFF legacy');
});
it('complete session restore preserves sparse assignments, source metadata, multisample zero endpoints and envelopes', async () => {
  const state = projectFixture();
  state.multisampleSettings={...state.multisampleSettings,transpose:12,portamentoType:'exponential',portamentoAmount:67,audioFormat:'aiff',renameFiles:true,
    ampEnvelope:{attack:11,decay:22,sustain:33,release:44},filterEnvelope:{attack:55,decay:66,sustain:77,release:88}};
  state.multisampleFiles=[{...state.drumSamples[5],rootNote:66,loopStart:0,loopEnd:0,loopCrossfade:{fraction:0.9,importedRaw:90,importedFramecount:100,sourceIdentity:'samples/tone.wav'}}];
  state.selectedMultisample=0;
  await sessions.saveSession(state);
  const restored = appReducer(initialState,{type:'RESTORE_SESSION',payload:await sessions.restoreSession()});
  expect(restored.drumSamples[0].isLoaded).toBe(false);
  expect(restored.drumSamples[5]).toMatchObject({name:'editable name',gain:7,isFloat:true,originalSampleRate:96000});
  expect(restored.drumSamples[25]).toMatchObject({isLoaded:true,isAssigned:false});
  expect(restored.multisampleFiles[0]).toMatchObject({rootNote:66,loopStart:0,loopEnd:1/restored.multisampleFiles[0].audioBuffer!.sampleRate,loopCrossfade:{fraction:0.9,importedRaw:90,importedFramecount:100,sourceIdentity:'samples/tone.wav'}});
  expect(restored.multisampleSettings).toMatchObject({transpose:12,portamentoType:'exponential',portamentoAmount:67,audioFormat:'aiff',renameFiles:true,
    ampEnvelope:{attack:11,decay:22,sustain:33,release:44},filterEnvelope:{attack:55,decay:66,sustain:77,release:88}});
});
it('library reload restores only its instrument, retaining the other mode; broken audio rejects before an editor update', async () => {
  const state = projectFixture();
  state.multisampleFiles=[{...state.drumSamples[5],rootNote:66,loopStart:0,loopEnd:0,loopCrossfade:{fraction:0.25}}];
  state.importedMultisamplePreset={fx:{delay:31},regions:[{sample:'source.aif',framecount:3,'loop.crossfade':3}]};
  state.multisampleSettings={...state.multisampleSettings,transpose:19,portamentoAmount:63,ampEnvelope:{attack:1,decay:2,sustain:3,release:4},filterEnvelope:{attack:5,decay:6,sustain:7,release:8},audioFormat:'aiff',renameFiles:true};
  await savePresetToLibrary(state,'multi','multisample');
  const preset = (await db.getAllPresets())[0] as unknown as LibraryPreset;
  const project = await deserializeLibraryPreset(preset);
  const otherState={...initialState,drumSettings:{...initialState.drumSettings,presetName:'keep drums'},drumSamples:state.drumSamples};
  let editor=appReducer(otherState,{type:'RESTORE_LIBRARY',payload:{mode:'multisample',project}});
  expect(editor.drumSettings.presetName).toBe('keep drums');
  expect(editor.drumSamples).toBe(otherState.drumSamples);
  expect(editor.multisampleSettings).toEqual(state.multisampleSettings);
  expect(editor.multisampleFiles[0].loopEnd).toBe(1/editor.multisampleFiles[0].audioBuffer!.sampleRate);
  expect(editor.multisampleFiles[0].loopCrossfade).toEqual({fraction:0.25});
  expect(editor.importedMultisamplePreset).toEqual({fx:{delay:31},regions:[{sample:'source.aif',framecount:3,'loop.crossfade':3}]});
  const before=editor;
  preset.data.multisampleFiles[0].audioBlob = new Blob(['bad'],{type:STORED_AUDIO_TYPE});
  await expect((async()=>{const project=await deserializeLibraryPreset(preset); editor=appReducer(editor,{type:'RESTORE_LIBRARY',payload:{mode:'multisample',project}});})()).rejects.toThrow();
  expect(editor).toBe(before);
});
it('reuses immutable audio encoding across settings saves and encodes a replacement buffer separately', async()=>{
  const state=projectFixture();
  const audio=state.drumSamples[5].audioBuffer!;
  const first=encodeStoredAudio(audio);
  state.drumSettings.presetName='settings edit';
  expect(encodeStoredAudio(audio)).toBe(first);
  const replacement=audioFixture(); replacement.getChannelData(0)[0]=0.75;
  const next=encodeStoredAudio(replacement);
  expect(next).not.toBe(first);
  expect((await decodeStoredAudio(next)).getChannelData(0)[0]).toBe(0.75);
  expect((await decodeStoredAudio(first)).getChannelData(0)[0]).toBe(Math.fround(0.12345678));
});
it('legacy JSON session audio produces a nonempty honestly typed source file',async()=>{
  await db.saveSample({id:'legacy',name:'original.aif',type:'audio/aiff',size:111,data:new Blob([JSON.stringify({numberOfChannels:1,length:2,sampleRate:48000,channelData:[[0.125,-0.5]]})],{type:'application/json'}),createdAt:1,metadata:{sampleRate:48000,channels:1,bitDepth:24,duration:2/48000}});
  const sample=await sessions.loadSampleFromSession('legacy');
  expect(sample.file.size).toBeGreaterThan(0);
  expect(sample.file.type).toBe(STORED_AUDIO_TYPE);
  expect(sample.file.name).toBe('original.opfloat');
  expect(Array.from(sample.audioBuffer.getChannelData(0))).toEqual([0.125,-0.5]);
});
it('preserves audio and source files on IndexedDB engines that reject Blob/File records',async()=>{
  const containsBlob=(value:unknown):boolean => value instanceof Blob || (value !== null && typeof value==='object' && Object.values(value).some(containsBlob));
  const original=IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){
    if(containsBlob(args[0])) throw new DOMException('Error preparing Blob/File data to be stored in object store','UnknownError');
    return original.apply(this,args);
  });
  const originalAdd=IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['add']>){
    if(containsBlob(args[0])) throw new DOMException('Error preparing Blob/File data to be stored in object store','UnknownError');
    return originalAdd.apply(this,args);
  });
  const state=projectFixture();
  await sessions.saveSession(state);
  const restored=await sessions.restoreSession();
  expect(Array.from(restored.drumSamples[0].audioBuffer!.getChannelData(0))).toEqual([Math.fround(0.12345678),1.25,Math.fround(-0.00000013)]);
  expect(await restored.drumSamples[0].file!.text()).toBe('original source');
  expect(restored.drumSamples[0].file!.name).toBe('source.aif');
  expect(restored.drumSamples[0].file!.lastModified).toBe(123);
  await expect(savePresetToLibrary(state,'portable','drum')).resolves.toEqual({success:true});
  const preset=(await db.getAllPresets())[0] as unknown as LibraryPreset;
  const library=await deserializeLibraryPreset(preset);
  expect(await library.drumSamples[0].file!.text()).toBe('original source');
  expect(library.drumSamples[0].file!.name).toBe('source.aif');
});
it('reads legacy native Blob rows without rewriting or deleting them',async()=>{
  const legacy=new Blob([JSON.stringify({numberOfChannels:1,length:2,sampleRate:48000,channelData:[[0.125,-0.5]]})],{type:'application/json'});
  const connection=await new Promise<IDBDatabase>((resolve,reject)=>{const request=globalThis.indexedDB.open('op-patchstudio-db');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise<void>((resolve,reject)=>{const tx=connection.transaction(STORES.SAMPLES,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.objectStore(STORES.SAMPLES).put({id:'native-legacy',name:'old.aif',type:'audio/aiff',size:100,data:legacy,createdAt:1,metadata:{sampleRate:48000,channels:1,bitDepth:24,duration:2/48000}});});
  const loaded=await sessions.loadSampleFromSession('native-legacy');
  expect(Array.from(loaded.audioBuffer.getChannelData(0))).toEqual([0.125,-0.5]);
  const untouched=await new Promise<{data:Blob}>((resolve,reject)=>{const request=connection.transaction(STORES.SAMPLES).objectStore(STORES.SAMPLES).get('native-legacy');request.onsuccess=()=>resolve(request.result as {data:Blob});request.onerror=()=>reject(request.error);});
  expect(untouched.data.type).toBe('application/json');
  expect(untouched.data.size).toBe(legacy.size);
  connection.close();
});
it('keeps a settings-only project recoverable before audio is added and after the last sample is removed',async()=>{
  const state={...initialState,drumSettings:{...initialState.drumSettings,presetName:'Before samples'},importedDrumPreset:{fx:{drive:37}}};
  await sessions.saveSession(state);
  expect((await sessions.getCurrentSession())?.importedDrumPreset).toEqual({fx:{drive:37}});
  await sessions.saveSession(projectFixture());
  await sessions.saveSession(state);
  const restored=await sessions.restoreSession();
  expect(restored.drumSamples).toEqual([]);
  expect(restored.drumSettings.presetName).toBe('Before samples');
  expect((await sessions.getCurrentSession())?.drumSettings.presetName).toBe('Before samples');
});
it('reports a committed library preset truthfully even if its informational marker fails',async()=>{
  const state=projectFixture();
  await sessions.saveSession(state);
  vi.spyOn(db,'saveSession').mockRejectedValueOnce(new Error('session marker failed'));
  const outcome=await savePresetToLibrary(state,'committed library preset','drum');
  expect((await db.getAllPresets()).map(p=>p.name)).toEqual(['committed library preset']);
  expect(outcome).toEqual({success:true});
  // A caller retries only failures; truthful success prevents a duplicate row.
  if(!outcome.success) await savePresetToLibrary(state,'committed library preset','drum');
  expect(await db.getAllPresets()).toHaveLength(1);
});
