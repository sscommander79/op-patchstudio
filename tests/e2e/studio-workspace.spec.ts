import { expect, test, type Download } from './control-audit-test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import {gotoWorkspace} from './workspace-actions';

const expectedBySlot=new Map([
  [0,21_168],[2,13_230],[4,4_410],[5,11_466],[7,6_174],
  [8,4_410],[10,24_255],[12,18_522],[16,11_466],[17,19_404],
]);

async function downloadedBytes(download:Download) {
  expect(await download.failure()).toBeNull();
  const path=await download.path();
  if(!path)throw new Error('Studio Seed download did not produce a file');
  return readFile(path);
}

function wavInfo(bytes:Uint8Array) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  expect(Buffer.from(bytes.subarray(0,4)).toString('ascii')).toBe('RIFF');
  expect(Buffer.from(bytes.subarray(8,12)).toString('ascii')).toBe('WAVE');
  let channels=0,sampleRate=0,bits=0,frames=0,first=1,last=1;
  for(let offset=12;offset+8<=bytes.length;) {
    const id=Buffer.from(bytes.subarray(offset,offset+4)).toString('ascii'),size=view.getUint32(offset+4,true),body=offset+8;
    if(id==='fmt '){channels=view.getUint16(body+2,true);sampleRate=view.getUint32(body+4,true);bits=view.getUint16(body+14,true);}
    if(id==='data'){
      frames=size/(channels*(bits/8));first=view.getInt16(body,true);last=view.getInt16(body+size-2,true);
      break;
    }
    offset=body+size+(size%2);
  }
  return {channels,sampleRate,bits,frames,first,last};
}

test('Studio Seed plays, edits atomically, restores, and exports its sparse ten-voice map',async({page})=>{
  await page.addInitScript({content:`
    window.__studioSeedSourceStarts = 0;
    const originalCreateBufferSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = originalCreateBufferSource.call(this);
      const originalStart = source.start.bind(source);
      source.start = (...args) => {
        window.__studioSeedSourceStarts += 1;
        return originalStart(...args);
      };
      return source;
    };
  `});
  await gotoWorkspace(page,'drum');
  await page.getByRole('button',{name:'Load demo kit',exact:true}).click();
  await expect(page.getByRole('region',{name:'Drum pad instrument, 10 of 24 loaded'})).toBeVisible();
  await expect(page.getByLabel('Instrument name')).toHaveValue('Studio Seed');
  const guide=page.getByLabel('First preset guide');
  await expect(guide).toBeVisible();
  await expect(guide.locator('li').first()).toHaveAttribute('data-done','false');

  await page.getByRole('button',{name:'Play selected',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as typeof window & {__studioSeedSourceStarts?:number}).__studioSeedSourceStarts??0)).toBeGreaterThan(0);
  await expect(guide.locator('li').first()).toHaveAttribute('data-done','true');

  const direction=page.getByRole('button',{name:'Forward',exact:true});
  await direction.click();
  await expect(page.getByRole('button',{name:'Reverse',exact:true})).toBeVisible();
  await expect(guide.locator('li').nth(1)).toHaveAttribute('data-done','true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(direction).toBeVisible();
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reverse',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(direction).toBeVisible();

  await page.getByRole('button',{name:'Export OP-XY',exact:true}).click();
  const preflight=page.getByRole('dialog',{name:'Export OP-XY preset'});
  await expect(preflight).toContainText('10 mapped samples');
  await expect(preflight).toContainText('0 retained unassigned samples');
  await expect(preflight.getByLabel(/Include .* unassigned/)).toHaveCount(0);
  const event=page.waitForEvent('download');
  await preflight.getByRole('button',{name:'Download preset',exact:true}).click();
  const zip=await JSZip.loadAsync(await downloadedBytes(await event));
  const patchFile=zip.file('patch.json');
  expect(patchFile).not.toBeNull();
  const patch=JSON.parse(await patchFile!.async('string')) as {regions:Array<{sample:string;framecount:number;lokey:number;hikey:number}>};
  expect(patch.regions).toHaveLength(10);
  for(const [slot,frames] of expectedBySlot) {
    const region=patch.regions.find(candidate=>candidate.lokey===53+slot);
    expect(region,`missing physical slot ${slot}`).toMatchObject({lokey:53+slot,hikey:53+slot,framecount:frames});
  }
  const rendered=[];
  for(const region of patch.regions) {
    const member=zip.file(region.sample);expect(member,`missing ${region.sample}`).not.toBeNull();
    rendered.push(wavInfo(await member!.async('uint8array')));
  }
  expect(rendered.map(item=>item.frames).sort((a,b)=>a-b)).toEqual([...expectedBySlot.values()].sort((a,b)=>a-b));
  expect(rendered.every(item=>item.channels===1&&item.sampleRate===44_100&&item.bits===16&&item.first===0&&item.last===0)).toBe(true);
  await preflight.getByRole('button',{name:'Close',exact:true}).click();

  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.getByRole('region',{name:'Drum pad instrument, 0 of 24 loaded'})).toBeVisible();
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(page.getByRole('region',{name:'Drum pad instrument, 10 of 24 loaded'})).toBeVisible();
});
