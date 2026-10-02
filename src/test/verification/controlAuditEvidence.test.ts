import {beforeAll,describe,expect,it} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const testFile=path.relative(process.cwd(),fileURLToPath(import.meta.url));
let site='',sourceFile='';
const runBuilder=(directory?:string)=>{
 const output=mkdtempSync(path.join(tmpdir(),'opstudio-evidence-proof-output-'));
 execFileSync(process.execPath,['scripts/build-control-audit.mjs',output,...(directory?[directory]:[])],{stdio:'pipe'});
 return JSON.parse(readFileSync(path.join(output,'source-inventory.json'),'utf8')) as {controls:Array<{site:string;file:string;evidence:unknown[]}>};
};
beforeAll(()=>{const control=runBuilder().controls.find(c=>c.file==='src/components/common/IconButton.tsx')!;site=control.site;sourceFile=control.file;});
const evidence=(status='passed')=>({runId:'proof-run',testFile,testSourceHash:hash(testFile),status,test:['evidence proof'],project:'chromium',hits:[{site,sourceHash:hash(sourceFile),event:'onClick',count:1}]});
const run=(record:ReturnType<typeof evidence>,manifest={runId:'proof-run',complete:true})=>{
 const directory=mkdtempSync(path.join(tmpdir(),'opstudio-evidence-proof-run-'));
 writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest));writeFileSync(path.join(directory,'test.json'),JSON.stringify(record));return directory;
};
const hits=(directory:string)=>runBuilder(directory).controls.find(c=>c.site===site)!.evidence.length;

// Each case launches several full-repository AST scans; allow loaded CI hosts time
// without weakening any evidence-admission assertions.
describe('control evidence admission',{timeout:30_000},()=>{
 it('admits a passing current test with current source and a complete matching run',()=>{expect(hits(run(evidence()))).toBe(1);});
 it('does not count failed, skipped or indeterminate tests',()=>{
  for(const status of ['failed','skipped','unknown'])expect(hits(run(evidence(status)))).toBe(0);
 });
 it('rejects stale application source and modified or deleted test evidence',()=>{
  const source=evidence();source.hits[0].sourceHash='old';expect(hits(run(source))).toBe(0);
  const changed=evidence();changed.testSourceHash='old';expect(hits(run(changed))).toBe(0);
  const deleted=evidence();deleted.testFile='tests/deleted-audit-test.ts';expect(hits(run(deleted))).toBe(0);
 });
 it('refuses incomplete or mismatched run identities',()=>{
  expect(()=>hits(run(evidence(),{runId:'proof-run',complete:false}))).toThrow();
  expect(()=>hits(run(evidence(),{runId:'different-run',complete:true}))).toThrow();
 });
});
