import {errors,expect,type FileChooser,type Page,type TestInfo} from '@playwright/test';
import path from 'node:path';

/** Playwright 1.63 can register its directory input listener after selection.
 * Record both native events before selection; never retry or replace the upload.
 * Callers must still assert the application's import review and resulting state.
 */
export async function setDirectoryFiles(chooser:FileChooser,folder:string,names:string[],testInfo:TestInfo) {
  const input=chooser.element();
  const observed=await input.evaluateHandle(node=>{
    if(!(node instanceof HTMLInputElement)||!node.webkitdirectory)throw new Error('Expected a directory input');
    type FileEntry={name:string;relativePath:string};
    const events:{input:FileEntry[]|null;change:FileEntry[]|null}={input:null,change:null};
    const capture=(event:Event)=>{
      events[event.type as 'input'|'change']=Array.from(node.files??[],file=>({name:file.name,relativePath:file.webkitRelativePath})).sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
    };
    node.addEventListener('input',capture);
    node.addEventListener('change',capture);
    return {events,dispose:()=>{node.removeEventListener('input',capture);node.removeEventListener('change',capture);}};
  });
  try{
    let driverTimeout=false;
    try{await chooser.setFiles(folder,{timeout:5000});}
    catch(error){if(!(error instanceof errors.TimeoutError))throw error;driverTimeout=true;}
    const expected=names.map(name=>({name,relativePath:`${path.basename(folder)}/${name}`})).sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
    const events=await observed.evaluate(record=>record.events);
    expect(events,'Both native directory events must contain exactly the expected files and relative paths').toEqual({input:expected,change:expected});
    await testInfo.attach('directory-selection-events',{body:JSON.stringify({driverTimeout,events}),contentType:'application/json'});
    if(driverTimeout){
      testInfo.annotations.push({type:'playwright-directory-event-race',description:'setFiles timed out after both native events confirmed the exact directory selection; application assertions still required.'});
      console.warn('Playwright directory wait timed out; exact native input/change events verified.');
    }
  }finally{
    await observed.evaluate(record=>record.dispose());
    await observed.dispose();
  }
}

/** Complete the user-visible review introduced for every actual audio intake. */
export async function applyAudioImport(page:Page) {
  const dialog=page.getByRole('dialog',{name:'Import audio'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Apply import'})).toBeEnabled();
  await dialog.getByRole('button',{name:'Apply import'}).click();
  await expect(dialog).not.toBeVisible();
}
