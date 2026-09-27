/**
 * External file capture/traversal. The synchronous capture pattern and repeated
 * directory-reader batches were adapted from eimerreis's MIT-licensed PR #113.
 */
export const EXTERNAL_INTAKE_LIMITS={files:256,entries:1024,depth:16,sourceBytes:256*1024*1024} as const;
export const INTERNAL_SAMPLE_DRAG_TYPE='application/x-op-patchstudio-sample';
export interface IntakeFileRecord {id:string;file:File;path:string;sourceOrdinal?:number}
export interface IntakeIssue {name:string;reason:string}
type LegacyEntry={name:string;isFile:boolean;isDirectory:boolean;file?:(ok:(file:File)=>void,fail?:(reason:unknown)=>void)=>void;createReader?:()=>{readEntries:(ok:(entries:LegacyEntry[])=>void,fail?:(reason:unknown)=>void)=>void}};
type ModernHandle={kind:'file'|'directory';name:string;getFile?:()=>Promise<File>;values?:()=>AsyncIterableIterator<ModernHandle>};
interface CapturedItem {ordinal:number;file:File|null;entry:LegacyEntry|null;handle?:Promise<{value:ModernHandle|null;error?:unknown}>;error?:unknown}
export interface CapturedExternalTransfer {kind:'external'|'internal';operationId:string;items:CapturedItem[];fallbackFiles:File[];unsupportedText:boolean}
let operationSerial=0;
const reason=(value:unknown)=>value instanceof Error?value.message:String(value||'access failed');
const list=<T>(value:ArrayLike<T>|null|undefined)=>value?Array.from(value):[];

export function captureExternalTransfer(dataTransfer:DataTransfer):CapturedExternalTransfer {
  const operationId=`intake-${++operationSerial}`;
  if(list(dataTransfer.types).includes(INTERNAL_SAMPLE_DRAG_TYPE))return {kind:'internal',operationId,items:[],fallbackFiles:[],unsupportedText:false};
  const items:CapturedItem[]=[];
  for(const item of list(dataTransfer.items)) {
    if(item.kind!=='file')continue;
    const ordinal=items.length;
    const captured:CapturedItem={ordinal,file:null,entry:null};
    try {captured.file=item.getAsFile?.()??null;} catch(error){captured.error=error;}
    try {captured.entry=(item as DataTransferItem&{webkitGetAsEntry?:()=>LegacyEntry|null}).webkitGetAsEntry?.()??null;} catch(error){captured.error=captured.error??error;}
    try {
      const promise=(item as DataTransferItem&{getAsFileSystemHandle?:()=>Promise<ModernHandle|null>}).getAsFileSystemHandle?.();
      if(promise)captured.handle=promise.then(value=>({value}),error=>({value:null,error}));
    } catch(error){captured.error=captured.error??error;}
    items.push(captured);
  }
  // Preserve FileList as a synchronous fallback channel. Resolution associates
  // entries by item ordinal so a blocked item cannot hide bytes the browser did expose.
  const fallbackFiles=list(dataTransfer.files);
  return {kind:'external',operationId,items,fallbackFiles,unsupportedText:!items.length&&!fallbackFiles.length&&list(dataTransfer.types).some(type=>type==='text/uri-list'||type==='text/plain')};
}

export function captureFileList(files:ArrayLike<File>):CapturedExternalTransfer {
  return {kind:'external',operationId:`intake-${++operationSerial}`,items:[],fallbackFiles:list(files),unsupportedText:false};
}

export async function resolveCapturedTransfer(captured:CapturedExternalTransfer,signal?:AbortSignal):Promise<{files:IntakeFileRecord[];failed:IntakeIssue[];unsupported:IntakeIssue[]}> {
  const files:IntakeFileRecord[]=[],failed:IntakeIssue[]=[],unsupported:IntakeIssue[]=[];let encountered=0,totalBytes=0,fileSerial=0,sourceOrdinal=0;
  const check=()=>{if(signal?.aborted)throw new DOMException('Import canceled','AbortError')};
  const abortError=(error:unknown)=>error instanceof DOMException&&error.name==='AbortError';
  const add=(file:File,path:string)=>{check();const ordinal=sourceOrdinal++;if(encountered>EXTERNAL_INTAKE_LIMITS.entries){unsupported.push({name:path,reason:'entry limit reached'});return;}
    if(!file.size){unsupported.push({name:path,reason:'file is empty'});return;}if(files.length>=EXTERNAL_INTAKE_LIMITS.files){unsupported.push({name:path,reason:'256-file intake limit reached'});return;}
    if(totalBytes+file.size>EXTERNAL_INTAKE_LIMITS.sourceBytes){unsupported.push({name:path,reason:'256 MiB source-byte limit reached'});return;}
    totalBytes+=file.size;files.push({id:`${captured.operationId}-file-${++fileSerial}`,file,path,sourceOrdinal:ordinal});};
  const readFile=(entry:LegacyEntry)=>new Promise<File>((resolve,reject)=>{
    if(!entry.file){reject(new Error('file entry is unreadable'));return;}
    entry.file(resolve,reject);
  });
  const readBatch=(reader:ReturnType<NonNullable<LegacyEntry['createReader']>>)=>new Promise<LegacyEntry[]>((resolve,reject)=>reader.readEntries(resolve,reject));
  const walkEntry=async(entry:LegacyEntry,parent:string,depth:number):Promise<void>=>{check();encountered++;const path=parent?`${parent}/${entry.name}`:entry.name;
    if(depth>EXTERNAL_INTAKE_LIMITS.depth){unsupported.push({name:path,reason:'directory depth limit reached'});return;}
    if(encountered>EXTERNAL_INTAKE_LIMITS.entries){unsupported.push({name:path,reason:'entry limit reached'});return;}
    if(entry.isFile){add(await readFile(entry),path);return;}if(!entry.isDirectory||!entry.createReader)throw new Error('unsupported directory entry');
    const reader=entry.createReader(),children:LegacyEntry[]=[];let enumerationError:unknown;
    try{while(true){check();const batch=await readBatch(reader);if(!batch.length)break;children.push(...batch);if(encountered+children.length>EXTERNAL_INTAKE_LIMITS.entries)break;}}
    catch(error){if(abortError(error))throw error;enumerationError=error;}
    children.sort((a,b)=>a.name.localeCompare(b.name));for(const child of children){try{await walkEntry(child,path,depth+1);}catch(error){if(abortError(error))throw error;failed.push({name:`${path}/${child.name}`,reason:reason(error)});}}
    if(enumerationError)failed.push({name:path,reason:reason(enumerationError)});
  };
  const walkHandle=async(handle:ModernHandle,parent:string,depth:number):Promise<void>=>{check();encountered++;const path=parent?`${parent}/${handle.name}`:handle.name;
    if(depth>EXTERNAL_INTAKE_LIMITS.depth){unsupported.push({name:path,reason:'directory depth limit reached'});return;}
    if(encountered>EXTERNAL_INTAKE_LIMITS.entries){unsupported.push({name:path,reason:'entry limit reached'});return;}
    if(handle.kind==='file'&&handle.getFile){add(await handle.getFile(),path);return;}if(handle.kind!=='directory'||!handle.values)throw new Error('unsupported file-system handle');
    const children:ModernHandle[]=[];let enumerationError:unknown;
    try{for await(const child of handle.values()){children.push(child);if(children.length+encountered>EXTERNAL_INTAKE_LIMITS.entries){unsupported.push({name:path,reason:'entry limit reached'});break;}}}
    catch(error){if(abortError(error))throw error;enumerationError=error;}
    children.sort((a,b)=>a.name.localeCompare(b.name));for(const child of children){try{await walkHandle(child,path,depth+1);}catch(error){if(abortError(error))throw error;failed.push({name:`${path}/${child.name}`,reason:reason(error)});}}
    if(enumerationError)failed.push({name:path,reason:reason(enumerationError)});
  };
  if(captured.kind==='internal')return {files,failed,unsupported};
  if(captured.items.length){for(const item of captured.items){check();const label=item.entry?.name??item.file?.name??`item ${item.ordinal+1}`;let resolved=false;
    try {if(item.entry){await walkEntry(item.entry,'',0);resolved=true;}else if(item.handle){const found=await item.handle;if(found.error)throw found.error;if(found.value){await walkHandle(found.value,'',0);resolved=true;}}else if(item.file){add(item.file,item.file.name);resolved=true;}else if(item.error)throw item.error;}catch(error){if(abortError(error))throw error;failed.push({name:label,reason:reason(error)});}
    const fallback=item.file??captured.fallbackFiles[item.ordinal];if(!resolved&&fallback){add(fallback,(fallback as File&{webkitRelativePath?:string}).webkitRelativePath||fallback.name);resolved=true;}if(!resolved&&!failed.some(issue=>issue.name===label))failed.push({name:label,reason:reason(item.error)});
  }} else for(const file of captured.fallbackFiles)add(file,(file as File&{webkitRelativePath?:string}).webkitRelativePath||file.name);
  if(captured.unsupportedText)unsupported.push({name:'Dropped path or URL',reason:'No readable file bytes were supplied; use the file chooser'});
  return {files,failed,unsupported};
}
