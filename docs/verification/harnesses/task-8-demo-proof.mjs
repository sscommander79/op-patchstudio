import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(root+'package.json');
const {chromium,firefox,webkit}=require('playwright');
const JSZip=require('jszip');
const out=root+'docs/verification/demo-audio';
await mkdir(out,{recursive:true});
const slots=[0,2,4,5,7,8,10,12,16,17];
const baseline=new Map();const results=[];
async function takeDownload(page,action){const promise=page.waitForEvent('download');await action();const download=await promise;assert.equal(await download.failure(),null);return new Uint8Array(await readFile(await download.path()));}
async function projectAction(page,name){const menu=page.locator('.studio-project-menu');if((await menu.getAttribute('open'))===null)await menu.locator('summary').click();await menu.getByRole('button',{name,exact:true}).click();}
async function backup(page){return takeDownload(page,()=>projectAction(page,'Download project'));}
async function unpack(bytes){const zip=await JSZip.loadAsync(bytes);const manifest=JSON.parse(await zip.file('manifest.json').async('string'));const audio=new Map();for(const item of manifest.samples){const data=await zip.file(item.audioPath).async('uint8array');assert.deepEqual(data,await zip.file(item.sourcePath).async('uint8array'));assert.equal(item.metadata.bitDepth,32);audio.set(item.name,{data,item});}return {audio,manifest};}
function wav(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let fmt,data;for(let p=12;p+8<=bytes.length;){const id=Buffer.from(bytes.subarray(p,p+4)).toString(),n=view.getUint32(p+4,true);if(id==='fmt ')fmt={channels:view.getUint16(p+10,true),rate:view.getUint32(p+12,true),depth:view.getUint16(p+22,true)};if(id==='data')data={offset:p+8,bytes:n};p+=8+n+(n%2);}assert.ok(fmt&&data);return {view,fmt,data};}
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch({headless:true});try{
 let first;let maxDifference=0;let checkedPcm=0;let archiveBytes=0;
 for(let iteration=0;iteration<2;iteration++){
  const context=await browser.newContext();try{
   const page=await context.newPage();await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:'Load demo kit',exact:true}).click();await page.getByRole('textbox',{name:'Instrument name',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#instrument-name')?.value==='Studio Seed');
   const bytes=await backup(page);const current=await unpack(bytes);archiveBytes=bytes.length;assert.equal(current.audio.size,10);assert.deepEqual(current.manifest.project.drumSamples.map(s=>s.originalIndex),slots);
   if(iteration===0){
    first=current;
    for(const [voice,{data}] of current.audio){
     const view=new DataView(data.buffer,data.byteOffset,data.byteLength);assert.equal(view.getUint32(8,true),1);assert.equal(view.getFloat64(16,true),44100);
     let sum=0,peak=0;for(let p=24;p<data.length;p+=4){const value=view.getFloat32(p,true);assert.ok(Number.isFinite(value));sum+=value;peak=Math.max(peak,Math.abs(value));}
     assert.equal(view.getFloat32(24,true),0);assert.equal(view.getFloat32(data.length-4,true),0);assert.ok(Math.abs(sum/((data.length-24)/4))<1e-6);assert.ok(peak>0&&peak<.29);
     if(!baseline.has(voice))baseline.set(voice,data);else{const ref=baseline.get(voice);assert.equal(ref.length,data.length);const rv=new DataView(ref.buffer,ref.byteOffset,ref.byteLength);for(let p=24;p<data.length;p+=4)maxDifference=Math.max(maxDifference,Math.abs(view.getFloat32(p,true)-rv.getFloat32(p,true)));}
    }
    assert.ok(maxDifference<=1e-6);
    // Actual backup reopening and second backup preserve sources and identities.
    const chooser=page.waitForEvent('filechooser');await projectAction(page,'Open project');await(await chooser).setFiles({name:'Studio Seed.opstudio',mimeType:'application/zip',buffer:Buffer.from(bytes)});await page.getByText('Opened project backup Studio Seed.opstudio',{exact:true}).waitFor();
    const reopened=await unpack(await backup(page));for(const [voice,{data}] of current.audio)assert.deepEqual(reopened.audio.get(voice).data,data);
    assert.deepEqual(reopened.manifest.project.drumSamples.map(s=>s.sourceIdentity),current.manifest.project.drumSamples.map(s=>s.sourceIdentity));
    await page.getByRole('button',{name:'Export OP-XY',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Export OP-XY preset'});const device=await takeDownload(page,()=>dialog.getByRole('button',{name:'Download preset',exact:true}).click());const zip=await JSZip.loadAsync(device);const patch=JSON.parse(await zip.file('patch.json').async('string'));assert.deepEqual(patch.regions.map(r=>r.lokey),slots.map(s=>s+53));
    for(const region of patch.regions){const ref=current.manifest.project.drumSamples.find(s=>s.originalIndex===region.lokey-53);const source=current.audio.get(current.manifest.samples.find(s=>s.id===ref.sampleId).name).data;const original=new DataView(source.buffer,source.byteOffset,source.byteLength);const file=await zip.file(region.sample).async('uint8array');const info=wav(file);assert.deepEqual(info.fmt,{channels:1,rate:44100,depth:16});assert.equal(info.data.bytes/2,(source.length-24)/4);for(let i=0;i<info.data.bytes/2;i++){assert.equal(info.view.getInt16(info.data.offset+i*2,true),(Math.round(original.getFloat32(24+i*4,true)*32767)||0),`${name} ${ref.name} frame${i}`);checkedPcm++;}if(name==='chromium')await writeFile(`${out}/${ref.name.replaceAll(' ','-')}.wav`,file);}
    if(name==='chromium'){await writeFile(`${out}/Studio-Seed.opstudio`,bytes);await writeFile(`${out}/Studio-Seed-device.zip`,device);}
   }else{for(const [voice,{data}]of current.audio)assert.deepEqual(data,first.audio.get(voice).data,`${name} repeated generation ${voice}`);}
  }finally{await context.close();}
 }
 results.push({browser:name,version:browser.version(),voices:10,archiveBytes,sameEngineRepeatedBytes:true,sourceBackupReopenExact:true,maxFloat32DifferenceFromChromium:maxDifference,quantizedSamplesChecked:checkedPcm});console.log(JSON.stringify(results.at(-1)));
 }finally{await browser.close();}
}
await writeFile(`${out}/verification.json`,JSON.stringify(results,null,2)+'\n');
