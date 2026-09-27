import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/Users/stevencommander/Desktop/AI/op-patchstudio-improved';
const require=createRequire(root+'/package.json');
const {chromium,expect}=require('@playwright/test');
const JSZip=require('jszip');
const origin='http://127.0.0.1:5188';
const result={origin,checks:[],errors:[],failedRequests:[]};
const browser=await chromium.launch();result.browser=browser.version();
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(()=>{
 const state={tracks:[],contexts:[],calls:0,workletLoads:[]};
 const originalAddModule=AudioWorklet.prototype.addModule;
 AudioWorklet.prototype.addModule=async function(url,options){await originalAddModule.call(this,url,options);state.workletLoads.push(String(url));};
 const getUserMedia=async()=>{
  state.calls++;const audio=new AudioContext({sampleRate:48000});state.contexts.push(audio);await audio.resume();
  const destination=audio.createMediaStreamDestination();const buffer=audio.createBuffer(1,48000*30,48000);
  for(let i=0;i<buffer.length;i++)buffer.getChannelData(0)[i]=.005*Math.sin(i*.071);
  const source=audio.createBufferSource();source.buffer=buffer;source.connect(destination);source.start();
  const track=destination.stream.getAudioTracks()[0],stop=track.stop.bind(track);
  track.stop=()=>{stop();try{source.stop();}catch{}source.disconnect();void audio.close();};state.tracks.push(track);
  return destination.stream;
 };
 const events=new EventTarget();const facade={getUserMedia,enumerateDevices:async()=>[{deviceId:'synthetic-input',groupId:'synthetic',kind:'audioinput',label:'Synthetic input',toJSON:()=>({})}],getSupportedConstraints:()=>({}),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),ondevicechange:null};
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:facade});state.getUserMedia=getUserMedia;
 Object.defineProperty(window,'__offlineSynthetic',{value:state});
 if(navigator.mediaDevices.getUserMedia!==getUserMedia)throw new Error('Synthetic facade failed closed');
});
async function projectAction(page,name){const menu=page.locator('.studio-project-menu');if(await menu.getAttribute('open')===null)await menu.locator('summary').click();await menu.getByRole('button',{name,exact:true}).click();}
async function download(page,action){const event=page.waitForEvent('download');await action();const d=await event;assert.equal(await d.failure(),null);return readFile(await d.path());}
async function backup(page){const bytes=await download(page,()=>projectAction(page,'Download project'));const zip=await JSZip.loadAsync(bytes);return {bytes,zip,manifest:JSON.parse(await zip.file('manifest.json').async('string'))};}
function watch(page){page.on('pageerror',e=>result.errors.push(e.message));page.on('requestfailed',r=>result.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));}
try{
 let page=await context.newPage();watch(page);await page.goto(origin);await page.getByRole('tab',{name:'drum tab',exact:true}).waitFor();
 await expect.poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&Boolean(await caches.match('/index.html',{ignoreSearch:true}));}),{timeout:20000}).toBe(true);
 await page.getByRole('region',{name:'Drum pad instrument, 0 of 24 loaded',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 result.initialResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,initiatorType:r.initiatorType,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})));
 if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)))await page.reload();
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 result.install=await page.evaluate(async()=>({controller:navigator.serviceWorker.controller.scriptURL,caches:await Promise.all((await caches.keys()).map(async name=>({name,urls:(await(await caches.open(name)).keys()).map(r=>r.url)})))}));
 assert.ok(result.install.caches.some(c=>c.urls.some(u=>u.includes('index.html'))));
 await page.close();await context.setOffline(true);page=await context.newPage();watch(page);await page.goto(origin);await page.getByRole('tab',{name:'drum tab',exact:true}).waitFor();result.checks.push('offline new-document cold start');
 const source=await readFile(root+'/tests/fixtures/task7-audio/original.wav');
 await page.getByRole('button',{name:'CLP drum key R',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add sample',exact:true}).click();await(await chooser).setFiles({name:'offline-original.wav',mimeType:'audio/wav',buffer:source});await page.getByRole('dialog',{name:'Import audio'}).getByRole('button',{name:'Apply import',exact:true}).click();
 const focus=page.getByRole('region',{name:'Focused sample editor'});await expect(focus).toContainText('offline-original.wav');await page.getByRole('textbox',{name:'Instrument name',exact:true}).fill('Offline proof');await page.getByRole('textbox',{name:'Instrument name',exact:true}).blur();
 const trim=focus.getByLabel('In point (seconds)',{exact:true});await trim.fill('.02');await trim.blur();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(trim).toHaveValue('0');await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(trim).toHaveValue('0.02');await expect(page.locator('.studio-save-state')).toHaveText('Saved locally');result.checks.push('offline import trim name Undo Redo autosave');
 const before=await backup(page);const sample=before.manifest.project.drumSamples[0];assert.equal(sample.originalIndex,5);assert.equal(sample.settings.inPoint,.02);const asset=before.manifest.samples.find(s=>s.id===sample.sampleId);assert.deepEqual(await before.zip.file(asset.sourcePath).async('nodebuffer'),source);
 await page.reload();const recovery=page.getByRole('dialog',{name:'restore session'});await recovery.getByRole('button',{name:'restore',exact:true}).click();await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Offline proof');
 const restored=await backup(page);const restoredSample=restored.manifest.project.drumSamples[0],restoredAsset=restored.manifest.samples.find(s=>s.id===restoredSample.sampleId);assert.equal(restoredSample.settings.inPoint,.02);assert.deepEqual(await restored.zip.file(restoredAsset.audioPath).async('nodebuffer'),await before.zip.file(asset.audioPath).async('nodebuffer'));result.checks.push('offline reload recovery exact source PCM and trim');
 await projectAction(page,'Save to library');await page.getByText('Saved Offline proof to the library.',{exact:true}).waitFor();await page.getByRole('textbox',{name:'Instrument name',exact:true}).fill('Temporary name');await page.getByRole('tab',{name:'library tab',exact:true}).click();await page.getByRole('button',{name:/^(load preset|load)$/}).click();await page.getByRole('button',{name:'ok',exact:true}).click();await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Offline proof');result.checks.push('offline library save and load');
 await page.getByRole('button',{name:'Export OP-XY',exact:true}).click();const exp=page.getByRole('dialog',{name:'Export OP-XY preset'});const bytes=await download(page,()=>exp.getByRole('button',{name:'Download preset',exact:true}).click());await exp.getByRole('button',{name:'Close',exact:true}).click();const zip=await JSZip.loadAsync(bytes),patch=JSON.parse(await zip.file('patch.json').async('string'));assert.equal(patch.regions.length,1);assert.equal(patch.regions[0].lokey,58);assert.equal(patch.regions[0]['sample.start'],882);assert.equal(patch.regions[0]['sample.end'],8820);assert.equal(patch.regions[0].framecount,8820);
 const wav=await zip.file(patch.regions[0].sample).async('nodebuffer');let format,dataLength;for(let offset=12;offset+8<=wav.length;){const id=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);if(id==='fmt ')format={channels:wav.readUInt16LE(offset+10),rate:wav.readUInt32LE(offset+12),depth:wav.readUInt16LE(offset+22)};if(id==='data')dataLength=size;offset+=8+size+(size%2);}assert.deepEqual(format,{channels:1,rate:44100,depth:16});assert.equal(dataLength/2,patch.regions[0].framecount);result.device=patch.regions[0];result.checks.push('offline actual device ZIP sparse mapping and trim');
 assert.equal(await page.evaluate(()=>navigator.mediaDevices.getUserMedia===window.__offlineSynthetic.getUserMedia),true);
 const workletResponses=[];page.on('response',response=>{if(response.url().includes('captureProcessor'))workletResponses.push({url:response.url(),fromServiceWorker:response.fromServiceWorker(),status:response.status()});});
 await page.getByRole('button',{name:'Record takes',exact:true}).first().click();const recorder=page.getByRole('dialog',{name:'Record takes'});await recorder.getByRole('button',{name:'Start recording',exact:true}).click();
 await expect.poll(async()=>Number((await recorder.getByText(/Take time/).textContent())?.match(/Take time ([\d.]+)/)?.[1]??0)).toBeGreaterThan(.03);
 await recorder.getByRole('button',{name:'Stop recording',exact:true}).click();await expect(recorder.locator('input[aria-label^=\"Name for take\"]')).toHaveCount(1);await recorder.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__offlineSynthetic.calls),1);await expect.poll(()=>page.evaluate(()=>window.__offlineSynthetic.tracks.every(t=>t.readyState==='ended')&&window.__offlineSynthetic.contexts.every(c=>c.state==='closed'))).toBe(true);
 result.workletLoads=await page.evaluate(()=>window.__offlineSynthetic.workletLoads);assert.equal(result.workletLoads.length,1);assert.ok(result.workletLoads[0].includes('captureProcessor'));assert.ok(result.install.caches.some(c=>c.urls.some(u=>u.includes(result.workletLoads[0]))));result.workletResponses=workletResponses;const afterCancel=await backup(page);assert.equal(afterCancel.manifest.project.drumSamples.length,1);result.checks.push('offline actual worklet take and Cancel stream cleanup');
 await page.getByRole('tab',{name:'donate tab',exact:true}).click();await expect(page.getByText('Live Patreon posts are unavailable.',{exact:false})).toBeVisible();
 await page.getByRole('tab',{name:'feedback tab',exact:true}).click();await expect(page.getByText(/The hosted feedback form is unavailable while offline/)).toBeVisible();assert.equal(await page.locator('iframe').count(),0);
 await page.getByRole('tab',{name:'drum tab',exact:true}).click();await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Offline proof');result.checks.push('offline donation and feedback fallback with return to unchanged instrument');
 assert.deepEqual(result.errors,[]);result.status='PASS';
} catch(error){result.status='FAIL';result.failure=String(error);throw error;}finally{await writeFile('/tmp/opstudio-task9-offline-proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await context.close();await browser.close();}
