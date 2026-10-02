import { expect, test, type Download, type Page } from './control-audit-test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import {expectDrumLoaded, gotoWorkspace, projectAction} from './workspace-actions';

type RecordingManifest={
  project:{drumSamples:Array<{name:string;sampleId:string}>};
  samples:Array<{id:string;name:string;type:string;sourcePath?:string;metadata:{sampleRate:number;channels:number;bitDepth:number;isFloat:boolean};audioPath:string;audio:{bytes:number;frames:number;sampleRate:number;channels:number}}>;
};
type SyntheticState={calls:number;tracks:MediaStreamTrack[];contexts:AudioContext[];constraints:MediaStreamConstraints[];stubInstalled:boolean;getUserMedia:MediaDevices['getUserMedia'];triggerBurst:(seconds?:number)=>Promise<void>};
declare global {interface Window {__opRecordingSynthetic:SyntheticState}}

async function downloadedBytes(download:Download) {
  expect(await download.failure()).toBeNull();const path=await download.path();if(!path)throw new Error('Download did not produce a file');return readFile(path);
}

async function readRecordingProject(bytes:Buffer) {
  const zip=await JSZip.loadAsync(bytes),manifestFile=zip.file('manifest.json');if(!manifestFile)throw new Error('Project backup has no manifest');
  return {zip,manifest:JSON.parse(await manifestFile.async('string')) as RecordingManifest};
}

async function openDrumRecorder(page:Page) {
  await page.getByRole('button',{name:'Record takes',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Record takes'});await expect(dialog).toBeVisible();return dialog;
}

async function assertSyntheticFacade(page:Page) {
  await expect.poll(()=>page.evaluate(()=>window.__opRecordingSynthetic.stubInstalled&&navigator.mediaDevices.getUserMedia===window.__opRecordingSynthetic.getUserMedia)).toBe(true);
}

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const sessions:Array<{context:AudioContext;destination:MediaStreamAudioDestinationNode;sources:Set<AudioBufferSourceNode>}>=[];
    const getUserMedia:MediaDevices['getUserMedia']=async constraints=>{
      state.calls+=1;state.constraints.push(constraints);
      const context=new AudioContext({sampleRate:48_000});state.contexts.push(context);await context.resume();
      const destination=context.createMediaStreamDestination();
      const sources=new Set<AudioBufferSourceNode>(),buffer=context.createBuffer(1,48_000*30,48_000),channel=buffer.getChannelData(0);
      for(let frame=0;frame<channel.length;frame+=1)channel[frame]=.005*Math.sin(frame*.071);
      const source=context.createBufferSource();source.buffer=buffer;source.connect(destination);source.start();sources.add(source);sessions.push({context,destination,sources});
      const track=destination.stream.getAudioTracks()[0],stop=track.stop.bind(track);
      track.stop=()=>{stop();for(const owned of sources){try{owned.stop();}catch{/* ended */}owned.disconnect();}sources.clear();void context.close();};state.tracks.push(track);
      return destination.stream;
    };
    Object.defineProperty(getUserMedia,'__opPatchStudioSynthetic',{value:true});
    const events=new EventTarget(),facade={getUserMedia,enumerateDevices:async()=>[{deviceId:'synthetic-input',groupId:'synthetic',kind:'audioinput',label:'Synthetic input',toJSON:()=>({})} as MediaDeviceInfo],getSupportedConstraints:()=>({}),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),ondevicechange:null};
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:facade});
    const state:SyntheticState={calls:0,tracks:[],contexts:[],constraints:[],stubInstalled:navigator.mediaDevices===facade&&navigator.mediaDevices.getUserMedia===getUserMedia,getUserMedia,triggerBurst:async(seconds=.1)=>{
      const session=sessions.at(-1);if(!session||session.context.state==='closed')throw new Error('Synthetic input is not active');
      const frames=Math.round(session.context.sampleRate*seconds),buffer=session.context.createBuffer(1,frames,session.context.sampleRate),channel=buffer.getChannelData(0);
      for(let frame=0;frame<frames;frame+=1)channel[frame]=.8*Math.sin(frame*.19);
      const source=session.context.createBufferSource();source.buffer=buffer;source.connect(session.destination);session.sources.add(source);source.onended=()=>{session.sources.delete(source);source.disconnect();};source.start(session.context.currentTime+.35);
    }};
    Object.defineProperty(window,'__opRecordingSynthetic',{value:state});
    if(!state.stubInstalled)throw new Error('Synthetic MediaDevices facade installation failed closed');
  });
});

test('records two sound-triggered PCM takes, applies one, preserves one, and archives exact recording metadata',async({page})=>{
  await gotoWorkspace(page,'drum');await assertSyntheticFacade(page);await page.getByRole('textbox',{name:'Instrument name',exact:true}).fill('Recording contract');await page.getByRole('textbox',{name:'Instrument name',exact:true}).blur();
  const dialog=await openDrumRecorder(page);
  expect(await page.evaluate(()=>window.__opRecordingSynthetic.calls)).toBe(0);
  await dialog.getByLabel('Capture mode').selectOption('sound');await dialog.getByLabel('Trigger threshold').fill('-20');await dialog.getByLabel('Pre-roll').fill('0.1');await dialog.getByLabel('Silence stop').fill('0.2');await dialog.getByLabel('Maximum take length').fill('2');
  await dialog.getByRole('button',{name:'Enable input'}).click();await expect(dialog.getByText(/State: monitoring/)).toBeVisible();
  await dialog.getByRole('button',{name:'Arm sound trigger'}).click();
  const rows=dialog.getByRole('group',{name:/^Take /});await page.evaluate(()=>window.__opRecordingSynthetic.triggerBurst());await expect(rows).toHaveCount(1,{timeout:15_000});await page.evaluate(()=>window.__opRecordingSynthetic.triggerBurst());await expect(rows).toHaveCount(2,{timeout:15_000});
  await dialog.getByRole('button',{name:'Stop recording'}).click();
  const names=dialog.locator('input[aria-label^="Name for take"]'),selections=dialog.locator('input[aria-label^="Select take"]');
  await names.first().fill('Browser burst');await selections.nth(1).uncheck();
  await dialog.getByRole('button',{name:'Add selected takes'}).click();await expect(dialog.getByRole('status')).toContainText('1 take added');
  await expect(rows).toHaveCount(1);await expect(names.first()).toHaveValue('Take 2');
  await dialog.getByRole('button',{name:'Close'}).click();
  await dialog.getByRole('alertdialog',{name:'Discard recording work'}).getByRole('button',{name:'Stop and discard'}).click();
  await expect(dialog).toBeHidden();await expectDrumLoaded(page,1);

  const backupEvent=page.waitForEvent('download');await projectAction(page,'Download project');
  const {zip,manifest}=await readRecordingProject(await downloadedBytes(await backupEvent));
  const reference=manifest.project.drumSamples.find(item=>item.name==='Browser burst.opfloat');expect(reference).toBeTruthy();
  const asset=manifest.samples.find(item=>item.id===reference!.sampleId);expect(asset).toBeTruthy();expect(asset!.sourcePath).toBeTruthy();
  expect(asset!.type).toBe('application/vnd.op-patchstudio.float32');expect(asset!.metadata).toMatchObject({bitDepth:32,isFloat:true});
  expect(asset!.audio).toMatchObject({channels:asset!.metadata.channels,sampleRate:asset!.metadata.sampleRate});expect(asset!.audio.frames).toBeGreaterThan(8_000);expect(asset!.audio.frames).toBeLessThanOrEqual(asset!.audio.sampleRate*2);
  const audio=await zip.file(asset!.audioPath)!.async('uint8array'),source=await zip.file(asset!.sourcePath!)!.async('uint8array');
  expect(audio.byteLength).toBe(24+asset!.audio.frames*asset!.audio.channels*4);expect(source).toEqual(audio);
  const header=new DataView(audio.buffer,audio.byteOffset,audio.byteLength);expect(header.getUint32(0,true)).toBe(0x5341504f);expect(header.getUint32(12,true)).toBe(asset!.audio.frames);

  await page.getByRole('button',{name:'Undo',exact:true}).click();await expectDrumLoaded(page,0);await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Recording contract');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await expectDrumLoaded(page,1);await expect(page.getByRole('textbox',{name:'Instrument name',exact:true})).toHaveValue('Recording contract');
  expect(await page.evaluate(()=>window.__opRecordingSynthetic.constraints)).toEqual([expect.objectContaining({audio:expect.objectContaining({echoCancellation:false,autoGainControl:false,noiseSuppression:false})})]);
  await expect.poll(()=>page.evaluate(()=>window.__opRecordingSynthetic.tracks.every(track=>track.readyState==='ended'))).toBe(true);
});

test('manual Start and Stop can repeat, and Cancel releases every input without changing the project',async({page})=>{
  await gotoWorkspace(page,'drum');await assertSyntheticFacade(page);const dialog=await openDrumRecorder(page);
  for(let take=1;take<=2;take+=1){
    await dialog.getByRole('button',{name:'Start recording'}).click();await expect(dialog.getByText(/State: recording/)).toBeVisible();
    await expect.poll(async()=>Number((await dialog.getByText(/Take time/).textContent())?.match(/Take time ([\d.]+)/)?.[1]??0),{timeout:5_000}).toBeGreaterThan(.02);
    await dialog.getByRole('button',{name:'Stop recording'}).click();await expect(dialog.locator('input[aria-label^="Name for take"]')).toHaveCount(take);
  }
  expect(await page.evaluate(()=>window.__opRecordingSynthetic.calls)).toBe(2);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await dialog.getByRole('alertdialog',{name:'Discard recording work'}).getByRole('button',{name:'Stop and discard'}).click();
  await expect(dialog).toBeHidden();await expectDrumLoaded(page,0);
  await expect.poll(()=>page.evaluate(()=>window.__opRecordingSynthetic.tracks.every(track=>track.readyState==='ended'))).toBe(true);
});

for (const width of [390, 1280]) test(`recorder keeps actions visible and owns discard focus at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:500});
  await gotoWorkspace(page,'drum');
  const dialog=await openDrumRecorder(page);
  const apply=dialog.getByRole('button',{name:'Add selected takes'});
  const bounds=await apply.boundingBox();expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(500);
  await dialog.getByRole('button',{name:'Start recording'}).click();
  await expect(dialog.getByText(/State: recording/)).toBeVisible();
  // Initial WebKit frames can be silent; an all-silent manual take is intentionally discarded.
  await page.evaluate(()=>window.__opRecordingSynthetic.triggerBurst(.5));
  await expect.poll(async()=>Number((await dialog.getByText(/Take time/).textContent())?.match(/Level ([\d.]+)%/)?.[1]??0),{intervals:[20,50,100]}).toBeGreaterThan(1);
  await dialog.getByRole('button',{name:'Stop recording'}).click();
  await expect(dialog.locator('input[aria-label^="Name for take"]')).toHaveCount(1);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  const resume=dialog.getByRole('button',{name:'Resume recording'});
  await expect(resume).toBeFocused();await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button',{name:'Stop and discard'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(resume).toBeFocused();
  await expect(dialog.locator('input[aria-label^="Name for take"]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('alertdialog')).toHaveCount(0);
  await expect(dialog.locator('input[aria-label^="Name for take"]')).toBeEnabled();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await dialog.getByRole('button',{name:'Stop and discard'}).click();
  await expect(dialog).toHaveCount(0);await expectDrumLoaded(page,0);
});
