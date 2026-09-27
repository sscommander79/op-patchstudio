import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {indexedDB as db} from '../../utils/indexedDB';
import {SessionStorageManagerIndexedDB} from '../../utils/sessionStorageIndexedDB';
import {initialState} from '../../context/AppContext';
import {createProjectSnapshot,serializeProject} from '../../utils/projectSerialization';
let sessions: SessionStorageManagerIndexedDB;
beforeEach(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());await db.init();sessions=SessionStorageManagerIndexedDB.createForTesting();});
afterEach(()=>vi.unstubAllGlobals());
it('commits a settings-only session and clears it durably',async()=>{
  await sessions.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'saved name'}});
  expect((await sessions.loadSession())?.drumSettings.presetName).toBe('saved name');
  await sessions.clearCurrentSession();
  expect(await sessions.loadSession()).toBeNull();
});
it('rejects stale saves and deletes from a second manager without changing newer recovery',async()=>{
  const first=SessionStorageManagerIndexedDB.createForTesting();
  const stale=SessionStorageManagerIndexedDB.createForTesting();
  await first.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'base'}});
  await stale.loadSession();
  await first.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'newer'}});
  expect((await stale.loadSession())?.drumSettings.presetName).toBe('newer');
  await expect(stale.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'stale'}})).rejects.toThrow('another tab');
  expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('newer');
  await expect(stale.markSessionAsSavedToLibrary()).rejects.toThrow('another tab');
  expect((await db.getSession('current-session'))?.savedToLibrary).not.toBe(true);
  await expect(stale.clearCurrentSession()).rejects.toThrow('another tab');
  expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('newer');
});
it('accepts a legacy row without a revision token once, then protects its replacement',async()=>{
  const {session}=serializeProject(createProjectSnapshot({...initialState,drumSettings:{...initialState.drumSettings,presetName:'legacy'}}));
  await db.saveSession(session);
  const first=SessionStorageManagerIndexedDB.createForTesting();
  const stale=SessionStorageManagerIndexedDB.createForTesting();
  await first.loadSession();
  await stale.loadSession();
  await first.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'upgraded'}});
  await expect(stale.clearCurrentSession()).rejects.toThrow('another tab');
  expect((await db.getSession('current-session'))?.revisionToken).toBeTruthy();
});
it('refuses a restore snapshot whose revision changed after its atomic read',async()=>{
  const first=SessionStorageManagerIndexedDB.createForTesting();
  const other=SessionStorageManagerIndexedDB.createForTesting();
  await first.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'captured'}});
  await other.loadSession();
  const read=db.getSessionWithSamples.bind(db);
  vi.spyOn(db,'getSessionWithSamples').mockImplementationOnce(async id=>{
    const captured=await read(id);
    await other.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'newer'}});
    return captured;
  });
  await expect(first.restoreSession()).rejects.toThrow('another tab');
  expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('newer');
});
it('delivers the localStorage nonce fallback when BroadcastChannel notification is unavailable',()=>{
  const listener=vi.fn();
  sessions.subscribeExternalChange(listener);
  window.dispatchEvent(new StorageEvent('storage',{key:'op-patchstudio-session-change',newValue:'another-source:nonce'}));
  expect(listener).toHaveBeenCalledOnce();
});
it('refuses a captured legacy restore when the row was deleted during decode',async()=>{
  const {session}=serializeProject(createProjectSnapshot({...initialState,drumSettings:{...initialState.drumSettings,presetName:'legacy'}}));
  await db.saveSession(session);
  const read=db.getSessionWithSamples.bind(db);
  vi.spyOn(db,'getSessionWithSamples').mockImplementationOnce(async id=>{const captured=await read(id);await db.deleteSession(id);return captured;});
  await expect(sessions.restoreSession()).rejects.toThrow(/another tab|no longer available/i);
});
it('ignores a delayed notification for the already adopted revision',async()=>{
  await sessions.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'saved'}});
  const revisionToken=(await sessions.loadSession())!.revisionToken!;
  const listener=vi.fn();sessions.subscribeExternalChange(listener);
  window.dispatchEvent(new StorageEvent('storage',{key:'op-patchstudio-session-change',newValue:JSON.stringify({sourceId:'other',revisionToken})}));
  expect(listener).not.toHaveBeenCalled();
  window.dispatchEvent(new StorageEvent('storage',{key:'op-patchstudio-session-change',newValue:JSON.stringify({sourceId:'other',revisionToken:'newer'})}));
  expect(listener).toHaveBeenCalledOnce();
});
it('rejects a restore interleaved with a queued save without rewinding later CAS writes',async()=>{
  await sessions.saveSession({...initialState,drumSettings:{...initialState.drumSettings,presetName:'base'}});
  const read=db.getSessionWithSamples.bind(db);let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  vi.spyOn(db,'getSessionWithSamples').mockImplementationOnce(async id=>{const captured=await read(id);await gate;return captured;});
  const restore=sessions.restoreSession();
  await Promise.resolve();
  const newer={...initialState,drumSettings:{...initialState.drumSettings,presetName:'newer'}};
  await sessions.saveSession(newer);release();
  await expect(restore).rejects.toThrow('another tab');
  await expect(sessions.saveSession({...newer,drumSettings:{...newer.drumSettings,presetName:'after race'}})).resolves.toBe('current-session');
  expect((await db.getSession('current-session'))?.drumSettings.presetName).toBe('after race');
});
