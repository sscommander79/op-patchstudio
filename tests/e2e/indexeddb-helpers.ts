import type { Page } from '@playwright/test';

interface StoredSession {
  id:string;
  timestamp:number;
  drumSettings?:{presetName?:string};
  [key:string]:unknown;
}

const databaseName='op-patchstudio-db';
const sessionsStore='sessions';

export async function readCurrentSession(page:Page):Promise<StoredSession|null> {
  return page.evaluate(async ({databaseName,sessionsStore}) => new Promise<StoredSession|null>((resolve,reject) => {
    const request=indexedDB.open(databaseName);
    request.onupgradeneeded=()=>request.transaction?.abort();
    request.onerror=()=>reject(request.error??new Error('Could not open the application database'));
    request.onsuccess=()=>{
      const db=request.result,transaction=db.transaction(sessionsStore,'readonly'),get=transaction.objectStore(sessionsStore).get('current-session');
      let value:StoredSession|null=null;
      get.onsuccess=()=>{value=(get.result as StoredSession|undefined)??null;};
      get.onerror=()=>reject(get.error??new Error('Could not read the current session'));
      transaction.oncomplete=()=>{db.close();resolve(value);};
      transaction.onabort=transaction.onerror=()=>{const error=transaction.error??new Error('Current-session read aborted');db.close();reject(error);};
    };
  }),{databaseName,sessionsStore});
}

export async function setCurrentSessionTimestamp(page:Page,timestamp:number):Promise<void> {
  await page.evaluate(async ({databaseName,sessionsStore,timestamp}) => new Promise<void>((resolve,reject) => {
    const request=indexedDB.open(databaseName);
    request.onupgradeneeded=()=>request.transaction?.abort();
    request.onerror=()=>reject(request.error??new Error('Could not open the application database'));
    request.onsuccess=()=>{
      const db=request.result,transaction=db.transaction(sessionsStore,'readwrite'),store=transaction.objectStore(sessionsStore),get=store.get('current-session');
      get.onsuccess=()=>{
        if(!get.result){transaction.abort();return;}
        store.put({...get.result,timestamp});
      };
      get.onerror=()=>transaction.abort();
      transaction.oncomplete=()=>{db.close();resolve();};
      transaction.onabort=transaction.onerror=()=>{const error=transaction.error??get.error??new Error('Current-session update aborted');db.close();reject(error);};
    };
  }),{databaseName,sessionsStore,timestamp});
}
