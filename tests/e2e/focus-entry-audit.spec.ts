import {test,expect} from './control-audit-test';
import {gotoWorkspace} from './workspace-actions';
import {applyAudioImport} from './import-helpers';
function tone(){const n=4800,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(10000*Math.sin(i/20)),44+i*2);return{name:'focus-entry-C4.wav',mimeType:'audio/wav',buffer:b};}
for(const workspace of ['drum','multisample'] as const)test(`${workspace} focus import record and clear entry points preserve reviewed audio`,async({page})=>{
 await gotoWorkspace(page,workspace);
 if(workspace==='drum'){await page.getByRole('button',{name:'Record here',exact:true}).click();const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});await expect(recorder).toBeVisible();await recorder.getByRole('button',{name:'Close',exact:true}).click();}
 const importButton=page.getByRole('button',{name:workspace==='drum'?'Add sample':'Add samples',exact:true});
 const choosing=page.waitForEvent('filechooser');await importButton.click();await(await choosing).setFiles(tone());if(workspace==='multisample')await applyAudioImport(page);else await expect(page.getByRole('region',{name:'Drum pad instrument, 1 of 24 loaded',exact:true})).toBeVisible();
 const record=page.getByRole('button',{name:workspace==='drum'?'Record here':'Record at root',exact:true});
 if(workspace==='multisample'){await record.click();const recorder=page.getByRole('dialog',{name:'Record takes',exact:true});await expect(recorder).toBeVisible();await recorder.getByRole('button',{name:'Close',exact:true}).click();await expect(recorder).toBeHidden();}
 if(workspace==='drum'){
  await page.getByRole('button',{name:'Slice this sample',exact:true}).click();const slice=page.getByRole('dialog',{name:'slice audio',exact:true});await expect(slice.locator('canvas').first()).toBeVisible();await slice.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Table',exact:true}).click();await page.getByRole('button',{name:'Focus',exact:true}).click();await expect(page.getByRole('button',{name:'Detailed edit',exact:true})).toBeVisible();
 }else{
  const clear=page.getByRole('button',{name:'Clear zone',exact:true});await clear.click();await page.getByRole('button',{name:'cancel',exact:true}).click();await expect(clear).toBeVisible();await clear.click();await page.getByRole('button',{name:'ok',exact:true}).click();await expect(page.getByRole('region',{name:'Multisample instrument, 0 of 24 loaded',exact:true})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('region',{name:'Multisample instrument, 1 of 24 loaded',exact:true})).toBeVisible();
 }
 const adding=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add sounds',exact:true}).click();await(await adding).setFiles({name:'not-audio.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
 const review=page.getByRole('dialog',{name:'Import audio',exact:true});await expect(review).toContainText('not-audio.txt');await review.getByRole('button',{name:'Cancel import',exact:true}).click();
 await expect(page.getByRole('region',{name:workspace==='drum'?'Drum pad instrument, 1 of 24 loaded':'Multisample instrument, 1 of 24 loaded',exact:true})).toBeVisible();
});
