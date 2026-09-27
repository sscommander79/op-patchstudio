import { describe, expect, it } from 'vitest';
import { captureExternalTransfer, captureFileList, resolveCapturedTransfer } from '../../utils/externalFileIntake';

type Entry = {
  name:string; isFile:boolean; isDirectory:boolean;
  file?:(ok:(file:File)=>void,fail:(error:Error)=>void)=>void;
  createReader?:()=>{readEntries:(ok:(entries:Entry[])=>void,fail:(error:Error)=>void)=>void};
};

function fileEntry(file:File,path=file.name):Entry {
  return {name:path,isFile:true,isDirectory:false,file:ok=>queueMicrotask(()=>ok(file))};
}
function failedEntry(name:string):Entry {
  return {name,isFile:true,isDirectory:false,file:(_ok,fail)=>queueMicrotask(()=>fail(new Error('permission denied')))};
}
function directory(name:string,batches:Entry[][]):Entry {
  let index=0;
  return {name,isFile:false,isDirectory:true,createReader:()=>({readEntries:(ok)=>queueMicrotask(()=>ok(batches[index++] ?? []))})};
}
function transfer(items:Array<{entry?:Entry|null;file?:File|null;throwCapture?:boolean}>,fallback:File[]=[]):DataTransfer {
  return {
    types:['Files'], files:fallback as unknown as FileList,
    items:items.map(item=>({kind:'file',type:item.file?.type ?? '',getAsFile:()=>item.file ?? null,
      webkitGetAsEntry:()=>{if(item.throwCapture)throw new Error('capture denied');return item.entry ?? null;}})) as unknown as DataTransferItemList,
  } as unknown as DataTransfer;
}

describe('external transfer intake',()=>{
  it('captures item access synchronously, reads every directory batch, and keeps deterministic order',async()=>{
    const a=new File(['a'],'same.wav',{type:'audio/wav',lastModified:7});
    const b=new File(['b'],'same.wav',{type:'audio/wav',lastModified:7});
    const nested=directory('kit',[[fileEntry(b,'z.wav')],[fileEntry(a,'a.wav')],[]]);
    let insideDrop=true;
    const data={types:['Files'],files:[] as unknown as FileList,items:[{kind:'file',type:'',getAsFile:()=>null,
      webkitGetAsEntry:()=>{expect(insideDrop).toBe(true);return nested;}}] as unknown as DataTransferItemList} as unknown as DataTransfer;
    const captured=captureExternalTransfer(data); insideDrop=false;
    const result=await resolveCapturedTransfer(captured);
    expect(result.files.map(record=>record.path)).toEqual(['kit/a.wav','kit/z.wav']);
    expect(result.files.map(record=>record.file)).toEqual([a,b]);
    expect(new Set(result.files.map(record=>record.id)).size).toBe(2);
  });

  it('retains valid siblings and an associated direct-file fallback when capture or entry resolution fails',async()=>{
    const good=new File(['good'],'good.wav',{type:'audio/wav'});
    const fallback=new File(['fallback'],'fallback.wav',{type:'audio/wav'});
    const result=await resolveCapturedTransfer(captureExternalTransfer(transfer([
      {entry:fileEntry(good),file:good},{entry:failedEntry('blocked.wav'),file:fallback},{throwCapture:true},
    ])));
    expect(result.files.map(record=>record.file)).toEqual([good,fallback]);
    expect(result.failed.map(record=>record.name)).toContain('item 3');
    expect(result.failed.some(record=>record.reason.includes('permission denied'))).toBe(true);
  });

  it('continues after failed nested legacy and modern children',async()=>{
    const legacyGood=new File(['legacy'],'legacy.wav',{type:'audio/wav'});
    const modernGood=new File(['modern'],'modern.wav',{type:'audio/wav'});
    const legacy=directory('legacy-kit',[[failedEntry('blocked.wav'),fileEntry(legacyGood)],[]]);
    const modern={kind:'directory',name:'modern-kit',async *values(){
      yield {kind:'file',name:'blocked.wav',getFile:async()=>{throw new Error('modern denied')}};
      yield {kind:'file',name:'modern.wav',getFile:async()=>modernGood};
    }};
    const data={types:['Files'],files:[] as unknown as FileList,items:[
      {kind:'file',getAsFile:()=>null,webkitGetAsEntry:()=>legacy},
      {kind:'file',getAsFile:()=>null,webkitGetAsEntry:()=>null,getAsFileSystemHandle:()=>Promise.resolve(modern)},
    ] as unknown as DataTransferItemList} as unknown as DataTransfer;
    const result=await resolveCapturedTransfer(captureExternalTransfer(data));
    expect(result.files.map(item=>item.path)).toEqual(['legacy-kit/legacy.wav','modern-kit/modern.wav']);
    expect(result.failed.map(item=>item.reason)).toEqual(expect.arrayContaining(['permission denied','modern denied']));
  });

  it('keeps children captured before a later legacy batch or modern iterator failure',async()=>{
    const legacyFile=new File(['legacy'],'legacy.wav',{type:'audio/wav'}),modernFile=new File(['modern'],'modern.wav',{type:'audio/wav'});
    let batch=0;const legacy:Entry={name:'legacy-kit',isFile:false,isDirectory:true,createReader:()=>({readEntries:(ok,fail)=>queueMicrotask(()=>batch++===0?ok([fileEntry(legacyFile)]):fail(new Error('later directory batch denied')))})};
    const modern={kind:'directory',name:'modern-kit',async *values(){yield {kind:'file',name:'modern.wav',getFile:async()=>modernFile};throw new Error('later iterator denied')}};
    const data={types:['Files'],files:[] as unknown as FileList,items:[
      {kind:'file',getAsFile:()=>null,webkitGetAsEntry:()=>legacy},
      {kind:'file',getAsFile:()=>null,webkitGetAsEntry:()=>null,getAsFileSystemHandle:()=>Promise.resolve(modern)},
    ] as unknown as DataTransferItemList} as unknown as DataTransfer;
    const result=await resolveCapturedTransfer(captureExternalTransfer(data));
    expect(result.files.map(item=>item.path)).toEqual(['legacy-kit/legacy.wav','modern-kit/modern.wav']);
    expect(result.failed.map(item=>item.reason)).toEqual(expect.arrayContaining(['later directory batch denied','later iterator denied']));
  });

  it('uses the matching FileList fallback when all item access channels are unreadable',async()=>{
    const fallback=new File(['fallback'],'fallback.wav',{type:'audio/wav'});
    const result=await resolveCapturedTransfer(captureExternalTransfer(transfer([{entry:null,file:null,throwCapture:true}],[fallback])));
    expect(result.files.map(item=>item.file)).toEqual([fallback]);
  });

  it('associates FileList fallbacks by file-item order when text items are interleaved',async()=>{
    const fallback=new File(['fallback'],'fallback.wav',{type:'audio/wav'});
    const data={types:['text/plain','Files'],files:[fallback] as unknown as FileList,items:[
      {kind:'string',type:'text/plain',getAsFile:()=>null},
      {kind:'file',type:'audio/wav',getAsFile:()=>null,webkitGetAsEntry:()=>{throw new Error('capture denied')}},
    ] as unknown as DataTransferItemList} as unknown as DataTransfer;
    const result=await resolveCapturedTransfer(captureExternalTransfer(data));
    expect(result.files.map(item=>item.file)).toEqual([fallback]);
  });

  it('enforces the global entry limit for modern directory handles',async()=>{
    const modern={kind:'directory',name:'huge',async *values(){for(let index=0;index<1025;index++)yield {kind:'directory',name:`d-${String(index).padStart(4,'0')}`,async *values(){}};}};
    const data={types:['Files'],files:[] as unknown as FileList,items:[{kind:'file',getAsFile:()=>null,webkitGetAsEntry:()=>null,getAsFileSystemHandle:()=>Promise.resolve(modern)}] as unknown as DataTransferItemList} as unknown as DataTransfer;
    const result=await resolveCapturedTransfer(captureExternalTransfer(data));
    expect(result.unsupported.some(item=>item.reason==='entry limit reached')).toBe(true);
  });

  it('uses FileList only when item channels are unavailable and never fetches path or URL payloads',async()=>{
    const fallback=new File(['one'],'chooser.wav',{type:''});
    const result=await resolveCapturedTransfer(captureExternalTransfer({types:['text/uri-list'],items:[] as unknown as DataTransferItemList,files:[fallback] as unknown as FileList} as unknown as DataTransfer));
    expect(result.files).toHaveLength(1);
    const textOnly=await resolveCapturedTransfer(captureExternalTransfer({types:['text/uri-list'],items:[] as unknown as DataTransferItemList,files:[] as unknown as FileList} as unknown as DataTransfer));
    expect(textOnly.files).toEqual([]);
    expect(textOnly.unsupported[0]?.reason).toMatch(/chooser/i);
  });

  it('retains distinct files with identical names, sizes, and timestamps',async()=>{
    const first=new File(['a'],'same.wav',{lastModified:4}),second=new File(['b'],'same.wav',{lastModified:4});
    const result=await resolveCapturedTransfer(captureFileList([first,second]));
    expect(result.files.map(item=>item.file)).toEqual([first,second]);
    expect(new Set(result.files.map(item=>item.id))).toHaveProperty('size',2);
  });

  it('recognizes internal sample drags without also importing their files',async()=>{
    const file=new File(['x'],'x.wav',{type:'audio/wav'});
    const captured=captureExternalTransfer({types:['application/x-op-patchstudio-sample','Files'],items:[] as unknown as DataTransferItemList,files:[file] as unknown as FileList} as unknown as DataTransfer);
    expect(captured.kind).toBe('internal');
    expect((await resolveCapturedTransfer(captured)).files).toEqual([]);
  });
  it('rejects cancellation after a late entry callback instead of publishing its file',async()=>{
    let release!:(file:File)=>void;const entry:Entry={name:'late.wav',isFile:true,isDirectory:false,file:ok=>{release=ok}};const controller=new AbortController();const pending=resolveCapturedTransfer(captureExternalTransfer(transfer([{entry}])),controller.signal);await Promise.resolve();controller.abort();release(new File(['late'],'late.wav'));await expect(pending).rejects.toMatchObject({name:'AbortError'});
  });
});
