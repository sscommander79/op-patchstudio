import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

type Ownership={current?:string;previous?:string;waiting?:string;complete?:boolean};
type WorkerEvent={
  data?:{type?:string};
  source?:{id:string;type:string;url:string;postMessage:(message:unknown)=>void};
  ports?:Array<{postMessage:(message:unknown)=>void}>;
  waitUntil:(promise:Promise<unknown>)=>void;
};
type WorkerListener=(event:WorkerEvent)=>void;

interface CacheState {
  names:Set<string>;
  ownership?:Ownership;
  activeId?:string;
  waitingId?:string;
  installingId?:string;
  metadataReads:number;
  beforeMetadataRead?:(read:number,state:CacheState)=>void;
  beforeIdentityReply?:(id:string,state:CacheState)=>void;
  skipWaiting?:()=>Promise<void>;
}

function deferred() {
  let resolve!:()=>void;
  const promise=new Promise<void>(done=>{resolve=done;});
  return {promise,resolve};
}

function loadLifecycle(buildId:string,windowIds:string[],state:CacheState) {
  const listeners=new Map<string,WorkerListener>();
  const deleted:string[]=[];
  const skipWaiting=vi.fn(state.skipWaiting??(async()=>undefined)),postMessage=vi.fn();
  const clients=windowIds.map(id=>({id,type:'window',url:`https://studio.test/${id}`}));
  class FakePort {
    peer?:FakePort;
    onmessage?:({data}:{data:unknown})=>void;
    postMessage(data:unknown){queueMicrotask(()=>this.peer?.onmessage?.({data}));}
    start(){}
    close(){}
  }
  class FakeMessageChannel {
    port1=new FakePort();port2=new FakePort();
    constructor(){this.port1.peer=this.port2;this.port2.peer=this.port1;}
  }
  const identifiedWorkers=new Map<string,{postMessage:(message:{type?:string},ports?:FakePort[])=>void}>();
  const identifiedWorker=(id:string|undefined)=>{
    if(!id)return null;
    let remote=identifiedWorkers.get(id);
    if(!remote){remote={postMessage:(message,ports)=>{
      if(message.type==='OPSTUDIO_IDENTIFY_WORKER'){
        state.beforeIdentityReply?.(id,state);
        ports?.[0]?.postMessage({type:'OPSTUDIO_WORKER_IDENTITY',buildId:id});
      }
    }};identifiedWorkers.set(id,remote);}
    return remote;
  };
  const registration={
    scope:'https://studio.test/',
    get active(){return identifiedWorker(state.activeId);},
    get waiting(){return identifiedWorker(state.waitingId);},
    get installing(){return identifiedWorker(state.installingId);},
  };
  const worker={
    registration,
    clients:{matchAll:vi.fn(async()=>clients)},
    skipWaiting,
    addEventListener:(type:string,listener:WorkerListener)=>listeners.set(type,listener),
  };
  const cacheStorage={
    keys:vi.fn(async()=>[...state.names]),
    delete:vi.fn(async(name:string)=>{deleted.push(name);state.names.delete(name);return true;}),
    open:vi.fn(async(name:string)=>{
      if(name!=='op-patchstudio-lifecycle-metadata-v1')return {match:vi.fn(),put:vi.fn()};
      return {
        match:vi.fn(async()=>{
          state.metadataReads+=1;
          state.beforeMetadataRead?.(state.metadataReads,state);
          return state.ownership?new Response(JSON.stringify(state.ownership)):undefined;
        }),
        put:vi.fn(async(_url:string,response:Response)=>{state.ownership=await response.json() as Ownership;}),
      };
    }),
  };
  const source=readFileSync(`${process.cwd()}/scripts/pwa-cache-lifecycle.js`,'utf8')
    .replace('__OPSTUDIO_PWA_BUILD_ID__',buildId);
  Function('self','caches','Response','URL','MessageChannel','setTimeout','clearTimeout',source)(worker,cacheStorage,Response,URL,FakeMessageChannel,setTimeout,clearTimeout);
  const dispatch=async(type:string,data?:{type:string},sourceId=windowIds[0]??'requester')=>{
    let work:Promise<unknown>=Promise.resolve();
    const sourceClient={id:sourceId,type:'window',url:`https://studio.test/${sourceId}`,postMessage};
    listeners.get(type)?.({data,source:sourceClient,waitUntil:promise=>{work=Promise.resolve(promise);}});
    await work;
  };
  return {dispatch,deleted,postMessage,skipWaiting};
}

function cache(buildId:string){return `op-patchstudio-${buildId}-precache-v2-https://studio.test/`;}
function state(names:string[],ownership?:Ownership):CacheState{return {names:new Set(names),ownership,metadataReads:0};}

describe('PWA cache lifecycle',()=>{
  it('accepts activation only from the sole scoped app window',async()=>{
    const shared=state([],{current:'A',complete:true});
    const multiple=loadLifecycle('B',['one','two'],shared);
    await multiple.dispatch('message',{type:'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT'},'one');
    expect(multiple.skipWaiting).not.toHaveBeenCalled();
    expect(multiple.postMessage).toHaveBeenCalledWith({type:'OPSTUDIO_UPDATE_BLOCKED_OPEN_TABS'});

    const sole=loadLifecycle('B',['one'],shared);
    await sole.dispatch('message',{type:'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT'},'different');
    expect(sole.skipWaiting).not.toHaveBeenCalled();
    await sole.dispatch('message',{type:'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT'},'one');
    expect(sole.skipWaiting).toHaveBeenCalledOnce();
  });

  it('releases the lifecycle queue before waiting for activation to finish',async()=>{
    const activationGate=deferred();
    const shared=state([cache('A'),cache('B')],{current:'A',complete:true});
    shared.activeId='A';shared.waitingId='B';shared.skipWaiting=()=>activationGate.promise;
    const waitingB=loadLifecycle('B',['one'],shared);
    const requesting=waitingB.dispatch('message',{type:'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT'},'one');
    await vi.waitFor(()=>expect(waitingB.skipWaiting).toHaveBeenCalledOnce());
    shared.activeId='B';shared.waitingId=undefined;
    const activating=waitingB.dispatch('activate');
    let activationRanBeforeSkipWaitingResolved=false;
    try {
      await vi.waitFor(()=>expect(shared.ownership).toEqual({current:'B',previous:'A',complete:true}),{timeout:100});
      activationRanBeforeSkipWaitingResolved=true;
    } catch { /* the assertion below records the queue cycle */ }
    activationGate.resolve();
    await Promise.all([requesting,activating]);
    expect(activationRanBeforeSkipWaitingResolved).toBe(true);
  });

  it('removes a superseded waiting build while retaining active, previous, and newest waiting builds',async()=>{
    const shared=state([cache('P'),cache('A'),cache('B'),'unrelated-cache'],{current:'A',previous:'P',complete:true});
    shared.activeId='A';shared.waitingId='B';
    const waitingB=loadLifecycle('B',['one','two'],shared);
    await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect([...shared.names]).toEqual([cache('P'),cache('A'),cache('B'),'unrelated-cache']);

    shared.names.add(cache('C'));shared.waitingId='C';
    const waitingC=loadLifecycle('C',['one','two'],shared);
    await waitingC.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect([...shared.names]).toEqual([cache('P'),cache('A'),'unrelated-cache',cache('C')]);
    expect(shared.ownership).toEqual({current:'A',previous:'P',complete:true});

    shared.names.add(cache('D'));shared.waitingId='D';
    const waitingD=loadLifecycle('D',['one','two'],shared);
    await waitingD.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect([...shared.names]).toEqual([cache('P'),cache('A'),'unrelated-cache',cache('D')]);
    expect(shared.ownership).toEqual({current:'A',previous:'P',complete:true});

    shared.activeId='D';shared.waitingId=undefined;
    await waitingD.dispatch('activate');
    expect([...shared.names]).toEqual([cache('A'),'unrelated-cache',cache('D')]);
    expect(shared.ownership).toEqual({current:'D',previous:'A',complete:true});
  });

  it('fails closed when ownership changes immediately before deletion',async()=>{
    const shared=state([cache('P'),cache('A'),cache('B'),cache('C')],{current:'A',previous:'P',complete:true});
    shared.activeId='A';shared.waitingId='B';
    shared.beforeMetadataRead=(read,current)=>{if(read===2)current.ownership={current:'A',previous:'changed',complete:true};};
    const waitingB=loadLifecycle('B',['one'],shared);
    await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect(waitingB.deleted).toEqual([]);
    expect(shared.names.has(cache('C'))).toBe(true);
  });

  it('fails closed when active identity is unknown or disagrees with activation metadata',async()=>{
    for(const activeId of [undefined,'different-active']){
      const shared=state([cache('P'),cache('A'),cache('B'),cache('old')],{current:'A',previous:'P',complete:true});
      shared.activeId=activeId;shared.waitingId='B';
      const waitingB=loadLifecycle('B',['one'],shared);
      await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
      expect(waitingB.deleted).toEqual([]);
      expect(shared.names.has(cache('old'))).toBe(true);
    }
  });

  it('aborts when the waiting slot changes during the final ownership recheck',async()=>{
    const shared=state([cache('P'),cache('A'),cache('B'),cache('C')],{current:'A',previous:'P',complete:true});
    shared.activeId='A';shared.waitingId='B';
    shared.beforeMetadataRead=(read,current)=>{if(read===2)current.waitingId='C';};
    const waitingB=loadLifecycle('B',['one'],shared);
    await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect(waitingB.deleted).toEqual([]);
    expect(shared.names.has(cache('C'))).toBe(true);
  });

  it('rejects captured worker-slot references that change during identity replies',async()=>{
    const shared=state([cache('P'),cache('A'),cache('B'),cache('C')],{current:'A',previous:'P',complete:true});
    shared.activeId='A';shared.waitingId='B';
    shared.beforeIdentityReply=(id,current)=>{if(id==='B'){current.waitingId='C';current.beforeIdentityReply=undefined;}};
    const waitingB=loadLifecycle('B',['one'],shared);
    await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect(waitingB.deleted).toEqual([]);
    expect(shared.names.has(cache('C'))).toBe(true);
  });

  it('keeps existing generations when active-worker ownership is unavailable',async()=>{
    const shared=state([cache('A'),cache('B')]);
    const waitingB=loadLifecycle('B',['one'],shared);
    await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect(waitingB.deleted).toEqual([]);
  });

  it('keeps pre-metadata caches through migration until a later activation establishes the previous worker',async()=>{
    const shared=state([cache('legacy-A'),cache('B')]);shared.activeId='B';
    const waitingB=loadLifecycle('B',['one'],shared);
    await waitingB.dispatch('activate');
    expect(waitingB.deleted).toEqual([]);
    expect(shared.ownership).toEqual({current:'B',complete:false});

    shared.names.add(cache('C'));shared.activeId='B';shared.waitingId='C';
    const waitingC=loadLifecycle('C',['one'],shared);
    await waitingC.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect(waitingC.deleted).toEqual([]);
    shared.activeId='C';shared.waitingId=undefined;await waitingC.dispatch('activate');
    expect([...shared.names]).toEqual([cache('B'),cache('C')]);
    expect(shared.ownership).toEqual({current:'C',previous:'B',complete:true});
  });

  it('does not let stale waiting B prune C while C occupies the installing slot',async()=>{
    const shared=state([cache('P'),cache('A'),cache('B'),cache('C')],{current:'A',previous:'P',complete:true});
    shared.activeId='A';shared.waitingId='B';shared.installingId='C';
    const waitingB=loadLifecycle('B',['one'],shared);
    await waitingB.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect(waitingB.deleted).toEqual([]);
    expect(shared.names.has(cache('C'))).toBe(true);
    expect(shared.ownership).toEqual({current:'A',previous:'P',complete:true});
  });

  it('makes natural C activation authoritative over stale B metadata before D cleanup',async()=>{
    const shared=state([cache('P'),cache('A'),cache('B'),cache('C'),'unrelated-cache'],{current:'A',previous:'P',waiting:'B',complete:true});
    shared.activeId='C';
    const workerC=loadLifecycle('C',['one'],shared);
    await workerC.dispatch('activate');
    expect(shared.ownership).toEqual({current:'C',previous:'A',complete:true});
    expect([...shared.names]).toEqual([cache('A'),cache('C'),'unrelated-cache']);

    shared.names.add(cache('D'));shared.waitingId='D';
    const workerD=loadLifecycle('D',['one'],shared);
    await workerD.dispatch('message',{type:'OPSTUDIO_CLAIM_WAITING'});
    expect([...shared.names]).toEqual([cache('A'),cache('C'),'unrelated-cache',cache('D')]);
  });
});
