import {afterEach,beforeEach} from 'vitest';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Loaded only by vitest.control-audit.config.ts. No values or audio are recorded.
const runId=process.env.OPSTUDIO_CONTROL_AUDIT_RUN_ID;
if(!runId||!process.env.OPSTUDIO_CONTROL_AUDIT_DIR)throw new Error('Use scripts/run-control-audit.mjs for a fresh audit run');
const hits=new Map<string,{site:string;sourceHash:string;event:string;count:number}>();
(globalThis as typeof globalThis & {__opstudioControlAudit:(entry:{site:string;sourceHash:string;event:string})=>void}).__opstudioControlAudit=entry=>{
  const key=`${entry.site} ${entry.event}`,hit=hits.get(key)||{...entry,count:0};hit.count++;hits.set(key,hit);
};
let testFile='',testSourceHash='';
beforeEach(async context=>{hits.clear();testFile=path.relative(process.cwd(),context.task.file.filepath);testSourceHash=createHash('sha256').update(await readFile(context.task.file.filepath)).digest('hex');});
afterEach(async context=>{
  const dir=process.env.OPSTUDIO_CONTROL_AUDIT_DIR!;
  await mkdir(dir,{recursive:true});
  const testName=`${context.task.file.name}: ${context.task.name}`;
  const name=createHash('sha256').update(context.task.id).digest('hex');
  await writeFile(`${dir}/${name}.json`,JSON.stringify({runId,testFile,testSourceHash,test:[testName],project:'unit',status:context.task.result?.state||'unknown',hits:[...hits.values()]},null,2));
});
