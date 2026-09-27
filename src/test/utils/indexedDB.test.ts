import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { indexedDB as database, STORES, type PresetData, type SampleData, type SessionData } from '../../utils/indexedDB';
import { defaultDrumSettings, defaultMultisampleSettings } from '../../utils/defaultSettings';

const session = (id = 'session-1'): SessionData => ({
  id, timestamp:1, drumSettings:structuredClone(defaultDrumSettings),
  multisampleSettings:structuredClone(defaultMultisampleSettings), drumSamples:[], multisampleFiles:[],
  selectedMultisample:null, isDrumKeyboardPinned:false, isMultisampleKeyboardPinned:false,
});
const sample = (id = 'sample-1', type = 'audio/wav'): SampleData => ({
  id, name:`${id}.wav`, type, size:4, data:new Blob([new Uint8Array([1,2,3,4])],{type}),
  metadata:{duration:1}, createdAt:1,
});
const preset = (id = 'preset-1', type:PresetData['type'] = 'drum'): PresetData => ({
  id, name:id, type, data:{version:1}, createdAt:1, updatedAt:1,
});

describe('IndexedDB operations against a browser-compatible implementation', () => {
  beforeAll(async () => { vi.stubGlobal('indexedDB',new IDBFactory()); await database.init(); });
  beforeEach(async () => { await database.clearAll(); });
  afterAll(() => { vi.unstubAllGlobals(); });

  it('adds, reads, updates, lists, and deletes a generic record', async () => {
    await database.add(STORES.METADATA,{key:'one',value:1});
    expect(await database.get(STORES.METADATA,'one')).toEqual({key:'one',value:1});
    await database.update(STORES.METADATA,{key:'one',value:2});
    expect(await database.getAll(STORES.METADATA)).toEqual([{key:'one',value:2}]);
    await database.delete(STORES.METADATA,'one');
    expect(await database.get(STORES.METADATA,'one')).toBeNull();
  });

  it('rejects a duplicate add after the transaction aborts', async () => {
    await database.add(STORES.METADATA,{key:'duplicate'});
    await expect(database.add(STORES.METADATA,{key:'duplicate'})).rejects.toBeTruthy();
    expect(await database.getAll(STORES.METADATA)).toHaveLength(1);
  });

  it('persists sessions through the typed convenience methods', async () => {
    await database.saveSession(session());
    expect(await database.getSession('session-1')).toEqual(session());
    expect(await database.getAllSessions()).toEqual([session()]);
    await database.deleteSession('session-1');
    expect(await database.getSession('session-1')).toBeNull();
  });

  it('stores Blob-backed samples and queries the type index', async () => {
    await database.saveSample(sample('kick','audio/wav')); await database.saveSample(sample('tone','audio/aiff'));
    expect(await database.getAllSamples()).toHaveLength(2);
    const waves=await database.getSamplesByType('audio/wav');
    expect(waves.map(({id})=>id)).toEqual(['kick']);
    expect(Array.from(new Uint8Array(await waves[0].data.arrayBuffer()))).toEqual([1,2,3,4]);
    await database.deleteSample('kick'); expect(await database.getSample('kick')).toBeNull();
  });

  it('stores presets and queries the preset type index', async () => {
    await database.savePreset(preset('kit','drum')); await database.savePreset(preset('keys','multisample'));
    expect(await database.getPreset('kit')).toEqual(preset('kit','drum'));
    expect((await database.getPresetsByType('multisample')).map(({id})=>id)).toEqual(['keys']);
    expect(await database.getAllPresets()).toHaveLength(2);
    await database.deletePreset('kit'); expect(await database.getPreset('kit')).toBeNull();
  });

  it('merges overlapping metadata edits with the latest stored preset and preserves audio', async () => {
    const audio=new Blob([new Uint8Array([1,2,3,4])],{type:'audio/wav'});
    await database.savePreset({...preset(),data:{samples:[{audioBlob:audio}]},isFavorite:false,tags:['original']});
    const [favorite,details]=await Promise.all([
      database.updatePresetMetadata('preset-1',{toggleFavorite:true}),
      database.updatePresetMetadata('preset-1',{description:'Warm keys',tags:['warm','keys']}),
    ]);
    expect(favorite.isFavorite).toBe(true);
    expect(details).toMatchObject({isFavorite:true,description:'Warm keys',tags:['warm','keys']});
    const saved=await database.getPreset('preset-1');
    expect(saved).toMatchObject({isFavorite:true,description:'Warm keys',tags:['warm','keys']});
    const preserved=((saved?.data as {samples:Array<{audioBlob:Blob}>}).samples[0]).audioBlob;
    expect(Array.from(new Uint8Array(await preserved.arrayBuffer()))).toEqual([1,2,3,4]);
  });

  it('does not recreate a deleted preset during metadata update', async () => {
    await database.savePreset(preset());await database.deletePreset('preset-1');
    await expect(database.updatePresetMetadata('preset-1',{toggleFavorite:true})).rejects.toThrow(/no longer exists/i);
    expect(await database.getPreset('preset-1')).toBeNull();
  });

  it('keeps collection membership ordered and merges overlapping additions without copying preset audio', async () => {
    const audio = new Blob([new Uint8Array([7, 8, 9])], {type:'audio/wav'});
    await database.savePreset({...preset('a'),data:{audio}});
    await database.savePreset(preset('b'));
    await database.savePreset(preset('c'));
    const created = await database.createLibraryCollection('Evening set', 'evening');
    expect(created.presetIds).toEqual([]);
    await Promise.all([
      database.changeLibraryCollection('evening',{type:'add',presetIds:['a','b']}),
      database.changeLibraryCollection('evening',{type:'add',presetIds:['c','a']}),
    ]);
    expect((await database.getLibraryCollections())[0].presetIds).toEqual(['a','b','c']);
    await database.changeLibraryCollection('evening',{type:'move',presetId:'c',direction:-1});
    expect((await database.getLibraryCollections())[0].presetIds).toEqual(['a','c','b']);
    const saved = await database.getPreset('a');
    expect(Array.from(new Uint8Array(await ((saved?.data as {audio:Blob}).audio).arrayBuffer()))).toEqual([7,8,9]);
  });

  it('never recreates a deleted collection or missing preset through a late membership edit', async () => {
    await database.savePreset(preset('a'));
    await database.createLibraryCollection('Set', 'set');
    await expect(database.changeLibraryCollection('set',{type:'add',presetIds:['missing']})).rejects.toThrow(/preset no longer exists/i);
    expect((await database.getLibraryCollections())[0].presetIds).toEqual([]);
    await database.deleteLibraryCollection('set');
    await expect(database.changeLibraryCollection('set',{type:'add',presetIds:['a']})).rejects.toThrow(/collection no longer exists/i);
    expect(await database.getLibraryCollections()).toEqual([]);
    expect(await database.getPreset('a')).not.toBeNull();
  });

  it('deleting a preset removes its references without deleting other collection members', async () => {
    await database.savePreset(preset('a')); await database.savePreset(preset('b'));
    await database.createLibraryCollection('Set', 'set');
    await database.changeLibraryCollection('set',{type:'add',presetIds:['a','b']});
    await database.deletePresetFromLibrary('a');
    expect((await database.getLibraryCollections())[0].presetIds).toEqual(['b']);
    expect(await database.getPreset('a')).toBeNull();
    expect(await database.getPreset('b')).not.toBeNull();
  });

  it('clears every owned store without deleting unrelated browser storage', async () => {
    await database.saveSession(session()); await database.saveSample(sample()); await database.savePreset(preset());
    await database.add(STORES.METADATA,{key:'meta'}); await database.clearAll();
    expect(await Promise.all([database.getAllSessions(),database.getAllSamples(),database.getAllPresets(),database.getAll(STORES.METADATA)])).toEqual([[],[],[],[]]);
  });

  it('reports a nonzero estimate for stored values', async () => {
    await database.saveSession(session()); await database.saveSample(sample());
    expect(await database.getDatabaseSize()).toBeGreaterThan(0);
  });
});
