import {test,expect} from './control-audit-test';
import {applyAudioImport} from './import-helpers';
import {openWorkspace,projectAction} from './workspace-actions';

function tone(){
  const rate=44100,frames=rate*4,buffer=Buffer.alloc(44+frames*2);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);
  buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);
  buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++)buffer.writeInt16LE(Math.round(3000*Math.sin(2*Math.PI*220*i/rate)),44+2*i);
  return {name:'Library-C4.wav',mimeType:'audio/wav',buffer};
}

test('library details persist and sample previews leave the working instrument unchanged',async({page})=>{
  await page.addInitScript(()=>{
    const original=AudioContext.prototype.createBufferSource;
    const counts={starts:0,stops:0};Object.assign(window,{libraryAudioCounts:counts});
    AudioContext.prototype.createBufferSource=function(){
      const source=original.call(this),start=source.start.bind(source),stop=source.stop.bind(source);
      source.start=(...args:Parameters<typeof source.start>)=>{counts.starts++;start(...args);};
      source.stop=(...args:Parameters<typeof source.stop>)=>{counts.stops++;stop(...args);};
      return source;
    };
  });
  await page.goto('/');
  await openWorkspace(page,'multisample');
  await page.getByLabel('choose multisample audio files').setInputFiles(tone());
  await applyAudioImport(page);
  await page.getByLabel('Instrument name',{exact:true}).fill('Library audition');
  await page.getByLabel('Instrument name',{exact:true}).blur();
  await projectAction(page,'Save to library');
  await expect(page.getByText('Saved Library audition to the library.',{exact:true})).toBeVisible();
  await page.getByLabel('Instrument name',{exact:true}).fill('Unsaved current instrument');
  await page.getByLabel('Instrument name',{exact:true}).blur();
  const undoBefore=await page.getByRole('button',{name:'Undo',exact:true}).isEnabled();
  await openWorkspace(page,'library');
  await page.getByRole('button',{name:'Edit details for Library audition',exact:true}).click();
  await page.getByLabel('Preset description',{exact:true}).fill('Warm sound for evening sketches');
  await page.getByLabel('Preset tags',{exact:true}).fill('Warm, nina, Warm');
  await page.getByRole('button',{name:'Save details',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'add to favorites',exact:true}).click();
  await expect(page.getByRole('button',{name:'remove from favorites',exact:true})).toBeVisible();
  await page.getByLabel('Search presets, descriptions, and tags',{exact:true}).fill(' nina ');
  await expect(page.getByRole('button',{name:'Preview first sample of Library audition',exact:true})).toBeVisible();
  const starts=await page.evaluate(()=>(window as typeof window&{libraryAudioCounts:{starts:number}}).libraryAudioCounts.starts);
  await page.getByRole('button',{name:'Preview first sample of Library audition',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as typeof window&{libraryAudioCounts:{starts:number}}).libraryAudioCounts.starts)).toBe(starts+1);
  await page.getByRole('button',{name:'Stop preview of Library audition',exact:true}).click();
  await expect(page.getByRole('status',{name:'Library preview status'})).toHaveText('Preview stopped.');
  await openWorkspace(page,'multisample');
  await expect(page.getByLabel('Instrument name',{exact:true})).toHaveValue('Unsaved current instrument');
  await expect(page.getByRole('region',{name:'Multisample instrument, 1 of 24 loaded'})).toBeVisible();
  expect(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled()).toBe(undoBefore);
  await page.reload();
  await page.getByRole('button',{name:'restore',exact:true}).click();
  await expect(page).toHaveURL(/#\/studio\/multisample$/);
  await expect(page.getByRole('region',{name:'Multisample instrument, 1 of 24 loaded'})).toBeVisible();
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Library'}).click();
  await expect(page.getByRole('button',{name:'remove from favorites',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit details for Library audition',exact:true}).click();
  await expect(page.getByLabel('Preset description',{exact:true})).toHaveValue('Warm sound for evening sketches');
  await expect(page.getByLabel('Preset tags',{exact:true})).toHaveValue('Warm, nina');
  await page.screenshot({path:'output/playwright/library-details-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await page.getByRole('button',{name:'restore',exact:true}).click();
  await expect(page.getByRole('button',{name:'restore',exact:true})).toBeHidden();
  await expect(page).toHaveURL(/#\/studio\/library$/);
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Library'}).click();
  await expect(page.getByRole('button',{name:'Edit details for Library audition',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Preview first sample of Library audition',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  for(const name of ['load','download','Preview first sample of Library audition','Edit details for Library audition','delete preset']){
    const box=await page.getByRole('button',{name,exact:true}).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x,name).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width,name).toBeLessThanOrEqual(390);
    expect(box!.height,name).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({path:'output/playwright/library-narrow.png',fullPage:true});
});
