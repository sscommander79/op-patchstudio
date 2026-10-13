import {test,expect} from './control-audit-test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {gotoWorkspace,expectDrumLoaded} from './workspace-actions';
import {applyAudioImport} from './import-helpers';

// Independent PCM input: no application encoder or mocked AudioBuffer/state.
function wav(name:string,polarity=1){
  const frames=44100,buffer=Buffer.alloc(44+frames*2);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(44100,24);buffer.writeUInt32LE(88200,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  for(let frame=0;frame<frames;frame++)buffer.writeInt16LE(polarity*8192,44+frame*2);
  return{name,mimeType:'audio/wav',buffer};
}
function chunk(bytes:Buffer,id:string){
  for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)===id)return bytes.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
  throw new Error(`Missing WAV ${id}`);
}

test('approved desktop journey preserves edits and exports a real OP-XY kit',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  // Observe real Web Audio starts without substituting buffers, graph nodes or playback.
  await page.addInitScript(()=>{const original=AudioBufferSourceNode.prototype.start;Reflect.set(window,'__approvedDrumStarts',[]);AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){const result=original.apply(this,args);(Reflect.get(window,'__approvedDrumStarts') as unknown[]).push({args,frames:this.buffer?.length,rate:this.buffer?.sampleRate});return result;};});
  await gotoWorkspace(page,'drum');
  const design=page.locator('.drum-design'),workflow=page.getByRole('navigation',{name:'Drum workflow'});
  const editor=page.getByRole('region',{name:'Focused sample editor'});
  const phase=async(name:string)=>workflow.getByRole('button',{name:new RegExp(`${name}$`)}).click();
  const trim=async()=>{await design.getByRole('button',{name:'Trim',exact:true}).click();return page.getByRole('dialog',{name:'Zoom and edit',exact:true});};
  const shot=async(name:string)=>testInfo.attach(name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});

  await expect(workflow.getByRole('button')).toHaveCount(4);
  for(const label of ['Add sounds','Prepare','Try the kit','Export'])await expect(workflow.getByRole('button',{name:new RegExp(`${label}$`)})).toBeVisible();
  await phase('Add sounds');
  const choosing=page.waitForEvent('filechooser');
  await design.getByRole('button',{name:'Choose files',exact:true}).click();
  await(await choosing).setFiles([wav('kick-approved.wav'),wav('snare-approved.wav',-1)]);
  await applyAudioImport(page);await expectDrumLoaded(page,2);
  const keyboard=page.getByRole('group',{name:'Drum keyboard',exact:true});
  await expect(keyboard.locator('.studio-drum-pad')).toHaveCount(24);
  await expect(keyboard.locator('.studio-pad-row--upper .studio-drum-pad')).toHaveCount(10);
  await expect(keyboard.locator('.studio-pad-row--lower .studio-drum-pad')).toHaveCount(14);
  const roles=['KD1','KD2','SD1','SD2','RIM','CLP','TB','SH','CH','CL','OH','CAB','LT1','RC','MT','CC','HT','COW','TRI','LT2','LC','WS','HC','GUI'];
  for(let index=0;index<roles.length;index++)await expect(keyboard.locator(`[id^="drum-key-${index}-"]`).filter({has:page.locator('.studio-drum-pad-slot')})).toContainText(roles[index]);
  await keyboard.getByRole('button',{name:'KD1 drum key A',exact:true}).click();
  await expect(editor).toContainText('kick-approved.wav');
  let zoom=await trim();
  const decodedFrames=Number(await zoom.getByLabel('Playback end frames',{exact:true}).inputValue());
  // Read the real decoder length. Exactly one second of input yields its native sample rate.
  expect([44100,48000]).toContain(decodedFrames);
  const start=decodedFrames/10,end=decodedFrames*9/10;
  await zoom.getByLabel('Playback start frames',{exact:true}).fill(String(start));
  await zoom.getByRole('button',{name:'Cancel',exact:true}).click();
  zoom=await trim();await expect(zoom.getByLabel('Playback start frames',{exact:true})).toHaveValue('0');
  await zoom.getByLabel('Playback start frames',{exact:true}).fill(String(start));
  await zoom.getByLabel('Playback end frames',{exact:true}).fill(String(end));
  await zoom.getByRole('button',{name:'Save markers',exact:true}).click();
  await shot('prepare-real-trim');
  await phase('Try the kit');
  const startsBefore=await page.evaluate(()=>Reflect.get(window,'__approvedDrumStarts').length);
  await design.getByRole('button',{name:'Listen',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__approvedDrumStarts').length)).toBe(startsBefore+1);
  const lastStart=await page.evaluate(()=>Reflect.get(window,'__approvedDrumStarts').at(-1));
  expect(lastStart.frames).toBe(decodedFrames);expect(lastStart.args[1]).toBeCloseTo(.1);expect(lastStart.args[2]).toBeCloseTo(.8);
  await testInfo.attach('real-audition-call',{body:JSON.stringify(lastStart),contentType:'application/json'});
  await shot('try-real-audio');
  await phase('Prepare');await editor.getByRole('button',{name:/^Organize/}).click();

  const replace=async()=>{const choosing=page.waitForEvent('filechooser');await editor.getByRole('button',{name:'Replace',exact:true}).click();await(await choosing).setFiles(wav('replacement-approved.wav'));};
  await replace();const intake=page.getByRole('dialog',{name:'Import audio'});
  await expect(intake).toBeVisible();await intake.getByRole('button',{name:'Cancel import',exact:true}).click();
  await expect(editor).toContainText('kick-approved.wav');
  await replace();await applyAudioImport(page);await expect(editor).toContainText('replacement-approved.wav');
  await design.getByRole('button',{name:'Undo',exact:true}).click();await expect(editor).toContainText('kick-approved.wav');
  zoom=await trim();await expect(zoom.getByLabel('Playback start frames',{exact:true})).toHaveValue(String(start));await expect(zoom.getByLabel('Playback end frames',{exact:true})).toHaveValue(String(end));await zoom.getByRole('button',{name:'Cancel',exact:true}).click();
  await editor.getByRole('button',{name:'Remove',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'confirm action',exact:true});
  await confirmation.getByRole('button',{name:'cancel',exact:true}).click();await expectDrumLoaded(page,2);
  await editor.getByRole('button',{name:'Remove',exact:true}).click();await confirmation.getByRole('button',{name:'ok',exact:true}).click();await expectDrumLoaded(page,1);
  await design.getByRole('button',{name:'Undo',exact:true}).click();await expectDrumLoaded(page,2);await expect(editor).toContainText('kick-approved.wav');

  await phase('Export');await design.getByRole('button',{name:'Download OP-XY preset',exact:true}).click();
  const preflight=page.getByRole('dialog',{name:'Export OP-XY preset',exact:true});
  await preflight.getByLabel('Instrument name',{exact:true}).fill('Approved drum journey');await shot('export-real-preflight');
  const pending=page.waitForEvent('download');await preflight.getByRole('button',{name:'Download OP-XY preset',exact:true}).click();
  const download=await pending;expect(await download.failure()).toBeNull();
  const file=await download.path();expect(file).not.toBeNull();
  const bytes=await readFile(file!);await testInfo.attach('actual-op-xy-preset.zip',{body:bytes,contentType:'application/zip'});
  const zip=await JSZip.loadAsync(bytes),manifest=zip.file('patch.json');expect(manifest).not.toBeNull();
  const patch=JSON.parse(await manifest!.async('string'));
  expect(patch.regions).toHaveLength(2);
  expect(patch.regions.map((region:{lokey:number,hikey:number})=>[region.lokey,region.hikey])).toEqual([[53,53],[55,55]]);
  expect(patch.regions.map((region:{sample:string})=>region.sample)).toEqual(['kick-approved.wav','snare-approved.wav']);
  for(const [index,region]of patch.regions.entries()){
    const member=zip.file(region.sample);expect(member).not.toBeNull();const audio=Buffer.from(await member!.async('uint8array'));
    const format=chunk(audio,'fmt '),data=chunk(audio,'data');expect(format.readUInt32LE(4)).toBe(44100);
    const frameBytes=format.readUInt16LE(12);expect(data.length/frameBytes).toBe(44100);expect(region.framecount).toBe(44100);
    expect(region['sample.start']).toBe(index===0?4410:0);expect(region['sample.end']).toBe(index===0?39690:44100);
    expect(data.some(value=>value!==0)).toBe(true);
  }
  await expect(preflight.getByRole('status',{name:'Preset download status'})).toContainText('browser created');await shot('export-real-complete');
  await preflight.getByRole('button',{name:'Return to kit',exact:true}).click();
  await expect(preflight).toBeHidden();
  await expect(workflow.getByRole('button',{name:/Prepare$/})).toHaveAttribute('aria-current','step');
  await expect(editor).toBeVisible();await expectDrumLoaded(page,2);await expect(editor).toContainText('kick-approved.wav');
  await shot('completion-return-to-prepare');
  await phase('Export');await design.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Open kit',exact:true}).click();
  await expectDrumLoaded(page,2);await keyboard.getByRole('button',{name:'KD1 drum key A',exact:true}).click();
  zoom=await trim();await expect(zoom.getByLabel('Playback start frames',{exact:true})).toHaveValue(String(start));await expect(zoom.getByLabel('Playback end frames',{exact:true})).toHaveValue(String(end));await zoom.getByRole('button',{name:'Cancel',exact:true}).click();
  await shot('overview-return-preserves-kit');expect(errors).toEqual([]);
});
