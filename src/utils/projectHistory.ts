import type { AppAction, AppState } from '../context/AppContext';

export const HISTORY_ENTRY_LIMIT = 100;
export const HISTORY_ASSET_BYTES = 128 * 1024 * 1024;
const musicalKeys = ['drumSettings','multisampleSettings','drumSamples','multisampleFiles','importedDrumPreset','importedMultisamplePreset','midiNoteMapping'] as const;
export type EditableProjectSnapshot = Pick<AppState, typeof musicalKeys[number]>;

/** AudioBuffer and File are immutable assets. Editing audio must replace the asset. */
export function selectEditableProject(state: EditableProjectSnapshot): EditableProjectSnapshot {
  const cloneSample = <T extends {audioBuffer: AudioBuffer | null; file: File | null}>(s:T):T => {
    const {audioBuffer,file,...metadata}=s;
    return {...structuredClone(metadata),audioBuffer,file} as T;
  };
  return {drumSettings:structuredClone(state.drumSettings),multisampleSettings:structuredClone(state.multisampleSettings),
    drumSamples:state.drumSamples.map(s=>s ? cloneSample(s):s),multisampleFiles:state.multisampleFiles.map(cloneSample),
    importedDrumPreset:structuredClone(state.importedDrumPreset),importedMultisamplePreset:structuredClone(state.importedMultisamplePreset),midiNoteMapping:state.midiNoteMapping};
}
function equal(a:unknown,b:unknown):boolean {
  if(Object.is(a,b)) return true;
  if(!a || !b || typeof a!=='object' || typeof b!=='object') return false;
  // Distinct assets must never be mistaken for equal opaque objects.
  if(a instanceof Blob || b instanceof Blob || 'getChannelData' in a || 'getChannelData' in b) return false;
  const ak=Object.keys(a),bk=Object.keys(b);
  return ak.length===bk.length && ak.every(k=>Object.prototype.hasOwnProperty.call(b,k) && equal((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
function sameProject(a:EditableProjectSnapshot,b:EditableProjectSnapshot) {return musicalKeys.every(k=>equal(a[k],b[k]));}
function assets(project:EditableProjectSnapshot) {
  const found=new Map<object,number>();
  for(const sample of [...project.drumSamples,...project.multisampleFiles]) {
    if(sample?.audioBuffer) found.set(sample.audioBuffer,sample.audioBuffer.length*sample.audioBuffer.numberOfChannels*4);
    if(sample?.file) found.set(sample.file,sample.file.size);
  }
  return found;
}
export function retainedAssetBytes(current:EditableProjectSnapshot,snapshots:EditableProjectSnapshot[]):number {
  const live=assets(current),retained=new Map<object,number>();
  for(const snapshot of snapshots) for(const [asset,size] of assets(snapshot)) if(!live.has(asset)) retained.set(asset,size);
  return [...retained.values()].reduce((sum,n)=>sum+n,0);
}
export interface ProjectHistory {
  present:AppState; past:EditableProjectSnapshot[]; future:EditableProjectSnapshot[]; limited:boolean;
  group?:{token:string; before:EditableProjectSnapshot};
}
export function createHistory(state:AppState):ProjectHistory {return {present:state,past:[],future:[],limited:false};}
function bound(h:ProjectHistory):ProjectHistory {
  const past=[...h.past],future=[...h.future]; let group=h.group,limited=h.limited;
  const retained = () => [...past,...future,...(group ? [group.before] : [])];
  while(past.length+future.length+(group ? 1 : 0)>HISTORY_ENTRY_LIMIT || retainedAssetBytes(h.present,retained())>HISTORY_ASSET_BYTES) {
    if(past.length) past.shift(); else if(future.length) future.shift(); else break;
    limited=true;
  }
  if(group && (past.length+future.length+1>HISTORY_ENTRY_LIMIT || retainedAssetBytes(h.present,retained())>HISTORY_ASSET_BYTES)) {
    group=undefined;
    limited=true;
  }
  return {...h,past,future,group,limited};
}
function applySnapshot(state:AppState,snapshot:EditableProjectSnapshot):AppState {
  return {...state,...snapshot,sessionSaveStatus:state.sessionSaveStatus==='saved'?'idle':state.sessionSaveStatus};
}
export function reduceHistory(h:ProjectHistory,action:AppAction,reduce:(s:AppState,a:AppAction)=>AppState):ProjectHistory {
  const finishGroup = (source:ProjectHistory):ProjectHistory => {
    if(!source.group) return source;
    const {before}=source.group;
    if(sameProject(before,source.present)) return bound({...source,group:undefined});
    return bound({...source,past:[...source.past,before],future:[],group:undefined});
  };
  if(action.type==='BEGIN_EDIT') {
    if(h.group?.token===action.payload) return h;
    const settled=finishGroup(h);
    return bound({...settled,group:{token:action.payload,before:selectEditableProject(settled.present)}});
  }
  if(action.type==='END_EDIT' || action.type==='CANCEL_EDIT') {
    if(h.group?.token!==action.payload) return h;
    if(action.type==='CANCEL_EDIT') return bound({...h,present:applySnapshot(h.present,h.group.before),group:undefined});
    return finishGroup(h);
  }
  if(action.type==='UNDO' || action.type==='REDO') {
    const settled=finishGroup(h);
    const undo=action.type==='UNDO',from=undo?settled.past:settled.future;
    if(!from.length) return settled;
    const current=selectEditableProject(settled.present),snapshot=from[from.length-1];
    return bound({...settled,present:applySnapshot(settled.present,snapshot),past:undo?from.slice(0,-1):[...settled.past,current],future:undo?[...settled.future,current]:from.slice(0,-1),group:undefined});
  }
  const next=action.type==='BATCH_EDIT'?action.payload.reduce(reduce,h.present):reduce(h.present,action);
  if(action.type==='RESTORE_SESSION') return createHistory(next);
  if(sameProject(h.present,next)) return {...h,present:next};
  const before=selectEditableProject(h.present);
  if(h.group) return bound({...h,present:applySnapshot(next,next)});
  return bound({...h,present:applySnapshot(next,next),past:[...h.past,before],future:[]});
}
