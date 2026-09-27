import {beforeAll,describe,expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {indexedDB as database,STORES,type PresetData} from '../../utils/indexedDB';

const legacyPreset:PresetData={id:'legacy',name:'Legacy kit',type:'drum',createdAt:1,updatedAt:2,isFavorite:true,
  tags:['old'],description:'kept',data:{drumSamples:[{audioBlob:new Blob([new Uint8Array(1024)])}],multisampleFiles:[]}};

async function createLegacyDatabase(factory:IDBFactory){
  await new Promise<void>((resolve,reject)=>{
    const request=factory.open('op-patchstudio-db',1);
    request.onerror=()=>reject(request.error);
    request.onupgradeneeded=()=>{
      const db=request.result;
      db.createObjectStore(STORES.SESSIONS,{keyPath:'id'});
      db.createObjectStore(STORES.SAMPLES,{keyPath:'id'});
      const presets=db.createObjectStore(STORES.PRESETS,{keyPath:'id'});
      presets.createIndex('name','name');presets.createIndex('type','type');presets.createIndex('createdAt','createdAt');
      db.createObjectStore(STORES.METADATA,{keyPath:'key'});
      presets.put(legacyPreset);
    };
    request.onsuccess=()=>{request.result.close();resolve();};
  });
}

describe('library payload and summary integrity',()=>{
  beforeAll(async()=>{const factory=new IDBFactory();vi.stubGlobal('indexedDB',factory);await createLegacyDatabase(factory);await database.init();});
  it('migrates a legacy payload to a lightweight independently stored summary',async()=>{
    const summaries=await database.getPresetSummaries();
    expect(summaries).toEqual([{id:'legacy',name:'Legacy kit',type:'drum',createdAt:1,updatedAt:2,isFavorite:true,
      tags:['old'],description:'kept',sampleCount:1,hasPreview:true}]);
    expect(summaries[0]).not.toHaveProperty('data');
    expect(await database.getPreset('legacy')).toMatchObject({data:expect.objectContaining({drumSamples:expect.any(Array)})});
  });

  it('writes payload and summary together and metadata edits preserve audio',async()=>{
    const audio=new Blob([new Uint8Array([1,2,3,4])]);
    const preset={...legacyPreset,id:'atomic',data:{drumSamples:[{audioBlob:audio}]},isFavorite:false};
    await database.savePreset(preset);
    expect((await database.getPresetSummaries()).find(row=>row.id==='atomic')).toMatchObject({sampleCount:1,hasPreview:true,isFavorite:false});
    await database.updatePresetMetadata('atomic',{toggleFavorite:true,tags:['edited']});
    const saved=(await database.getPreset('atomic'))!;
    expect(saved).toMatchObject({isFavorite:true,tags:['edited']});
    const stored=(saved.data as {drumSamples:Array<{audioBlob:Blob}>}).drumSamples[0].audioBlob;
    expect([...new Uint8Array(await stored.arrayBuffer())]).toEqual([1,2,3,4]);
  });

  it('rolls back both payload and summary when an atomic preset write aborts',async()=>{
    await database.savePreset({...legacyPreset,id:'write-rollback',name:'Before'});
    const original=IDBObjectStore.prototype.put;
    const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){
      const request=original.apply(this,args);
      if(this.name===STORES.PRESET_SUMMARIES)request.addEventListener('success',()=>this.transaction.abort(),{once:true});
      return request;
    });
    await expect(database.savePreset({...legacyPreset,id:'write-rollback',name:'After'})).rejects.toThrow();
    spy.mockRestore();
    expect((await database.getPreset('write-rollback'))?.name).toBe('Before');
    expect((await database.getPresetSummaries()).find(row=>row.id==='write-rollback')?.name).toBe('Before');
  });

  it('rolls back payload, summaries, and collections when bulk deletion aborts',async()=>{
    await database.savePreset({...legacyPreset,id:'delete-a'});
    await database.savePreset({...legacyPreset,id:'delete-b'});
    await database.createLibraryCollection('Keep','keep');
    await database.changeLibraryCollection('keep',{type:'add',presetIds:['delete-a','delete-b']});
    const original=IDBObjectStore.prototype.delete;
    const spy=vi.spyOn(IDBObjectStore.prototype,'delete').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['delete']>){
      const request=original.apply(this,args);
      if(this.name===STORES.PRESET_SUMMARIES)request.addEventListener('success',()=>this.transaction.abort(),{once:true});
      return request;
    });
    await expect(database.deletePresetsFromLibrary(['delete-a','delete-b'])).rejects.toThrow();
    spy.mockRestore();
    expect(await database.getPreset('delete-a')).not.toBeNull();
    expect(await database.getPreset('delete-b')).not.toBeNull();
    expect((await database.getLibraryCollections()).find(row=>row.id==='keep')?.presetIds).toEqual(['delete-a','delete-b']);
  });

  it('browses 64 one-megabyte presets without hydrating audio into summaries',async()=>{
    const audio=new Blob([new Uint8Array(1024*1024)]);
    for(let index=0;index<64;index++)await database.savePreset({...legacyPreset,id:`benchmark-${index}`,name:`Preset ${index}`,
      data:{drumSamples:[{audioBlob:audio}]}});
    const started=performance.now();
    const summaries=(await database.getPresetSummaries()).filter(row=>row.id.startsWith('benchmark-'));
    const elapsedMs=performance.now()-started;
    expect(summaries).toHaveLength(64);
    expect(summaries.some(summary=>Object.values(summary).some(value=>value instanceof Blob))).toBe(false);
    expect(JSON.stringify(summaries)).not.toContain('audioBlob');
    console.info(`library-summary-benchmark presets=64 hydratedAudioBytes=0 elapsedMs=${elapsedMs.toFixed(2)}`);
  });
});
