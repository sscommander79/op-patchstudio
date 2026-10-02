import {errors,expect,test} from '@playwright/test';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setDirectoryFiles} from './import-helpers';

for(const outcome of ['completed selection','wrong files','missing events','transport error'] as const){
  test(`directory wait recovery verifies ${outcome}`,async({page},testInfo)=>{
    const folder=await mkdtemp(path.join(tmpdir(),'opstudio-directory-proof-'));
    try{
      await writeFile(path.join(folder,'actual.txt'),'real directory fixture');
      await page.setContent('<input aria-label="Folder" type="file" webkitdirectory multiple>');
      const choosing=page.waitForEvent('filechooser');
      await page.getByLabel('Folder').click();
      const chooser=await choosing;
      const setFiles=chooser.setFiles.bind(chooser);
      const transportError=new Error('Simulated transport error');
      // Fault-inject only the driver's completion, retaining real directory input
      // events for the positive and wrong-file cases.
      chooser.setFiles=async(files,options)=>{
        if(outcome==='transport error')throw transportError;
        if(outcome!=='missing events')await setFiles(files,options);
        throw new errors.TimeoutError('Simulated lost directory input acknowledgement');
      };
      const selected=setDirectoryFiles(chooser,folder,[outcome==='wrong files'?'missing.txt':'actual.txt'],testInfo);
      if(outcome==='completed selection'){
        await selected;
        expect(testInfo.annotations.some(a=>a.type==='playwright-directory-event-race')).toBe(true);
      }else if(outcome==='transport error')await expect(selected).rejects.toBe(transportError);
      else await expect(selected).rejects.toThrow('Both native directory events');
    }finally{await rm(folder,{recursive:true,force:true});}
  });
}
