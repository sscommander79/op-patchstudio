import {test as base} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export * from '@playwright/test';

export const test=base.extend<{controlAudit:void}>({
  controlAudit:[async({context},use,testInfo)=>{
    if(process.env.OPSTUDIO_CONTROL_AUDIT!=='1'){await use();return;}
    const runId=process.env.OPSTUDIO_CONTROL_AUDIT_RUN_ID;
    if(!runId||!process.env.OPSTUDIO_CONTROL_AUDIT_DIR)throw new Error('Use scripts/run-control-audit.mjs for a fresh audit run');
    const testFile=path.relative(process.cwd(),testInfo.file);
    const testSourceHash=createHash('sha256').update(await readFile(testInfo.file)).digest('hex');
    const hits=new Map<string,{site:string;sourceHash:string;event:string;count:number}>();
    await context.exposeBinding('__opstudioControlAudit',(_source,entry:{site:string;sourceHash:string;event:string})=>{
      if(!entry||!/^src\/[^:]+:\d+:\d+$/.test(entry.site))return;
      const key=`${entry.site} ${entry.event}`,hit=hits.get(key)||{...entry,count:0};hit.count++;hits.set(key,hit);
    });
    await context.addInitScript(()=>{
      document.addEventListener('click',event=>{
        const el=(event.target as Element)?.closest?.('[data-audit-site]');
        const site=el?.getAttribute('data-audit-site');
        const sourceHash=el?.getAttribute('data-audit-hash');
        if(site&&sourceHash)void (globalThis as typeof globalThis & {__opstudioControlAudit?:(entry:{site:string;sourceHash:string;event:string})=>Promise<void>}).__opstudioControlAudit?.({site,sourceHash,event:'DOM click'});
      },true);
    });
    await use();
    const report={runId,testFile,testSourceHash,test:testInfo.titlePath,project:testInfo.project.name,status:testInfo.status,hits:[...hits.values()]};
    const data=JSON.stringify(report,null,2);
    await testInfo.attach('control-interactions',{body:data,contentType:'application/json'});
    const dir=process.env.OPSTUDIO_CONTROL_AUDIT_DIR;await mkdir(dir,{recursive:true});
    const name=createHash('sha256').update(`${testInfo.project.name}:${testInfo.titlePath.join('/')}:${testInfo.repeatEachIndex}`).digest('hex');
    await writeFile(`${dir}/${name}.json`,data);
  },{auto:true}],
});
