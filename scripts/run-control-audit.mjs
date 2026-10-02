import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
const [suite,...extra]=process.argv.slice(2);
const commands={unit:['vitest','run','--config=vitest.control-audit.config.ts'],browser:['playwright','test','--config=playwright.control-audit.config.ts'],recording:['playwright','test','--config=playwright.control-audit-recording.config.ts']};
if(!commands[suite])throw new Error('Usage: node scripts/run-control-audit.mjs unit|browser|recording [test runner arguments]');
const directory=await mkdtemp(path.join(tmpdir(),'opstudio-control-run-')),runId=randomUUID();
const manifest={runId,suite,startedAt:new Date().toISOString(),complete:false,arguments:extra};
const manifestPath=path.join(directory,'manifest.json');
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
console.log(`Control evidence directory: ${directory}`);
const env={...process.env,OPSTUDIO_CONTROL_AUDIT:'1',OPSTUDIO_CONTROL_AUDIT_DIR:directory,OPSTUDIO_CONTROL_AUDIT_RUN_ID:runId};
if(suite==='recording'){env.PLAYWRIGHT_FAKE_AUDIO_FILE=path.join(directory,'fake-audio.wav');env.PLAYWRIGHT_STEM_FAKE_DEVICE='1';}
const code=await new Promise((resolve,reject)=>{const child=spawn('npx',[...commands[suite],...extra],{stdio:'inherit',env});child.on('error',reject);child.on('exit',(code,signal)=>resolve(signal?1:code??1));});
await writeFile(manifestPath,JSON.stringify({...manifest,complete:true,finishedAt:new Date().toISOString(),exitCode:code},null,2));
console.log(`Completed control evidence: ${directory} (exit ${code})`);
process.exitCode=code;
