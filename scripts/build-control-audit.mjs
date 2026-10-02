import ts from 'typescript';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const output=process.argv[2]||'docs/verification/functional-audit-2026-09-27';
const runDirs=process.argv.slice(3);
const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(file!=='src/test')walk(file);}else if(/\.tsx?$/.test(file)&&!file.endsWith('.d.ts')&&!file.includes(' 2.'))files.push(file);}}walk('src');
const controls=[],functions=[];const hashes=new Map();
for(const file of files){const code=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);hashes.set(file,createHash('sha256').update(code).digest('hex'));function visit(node){const pos=source.getLineAndCharacterOfPosition(node.getStart(source)),site=`${file}:${pos.line+1}:${pos.character+1}`;
if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node))&&node.body)functions.push({site,name:node.name?.getText(source)||'(callback)'});
if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){const tag=node.tagName.getText(source),attrs=node.attributes.properties.filter(ts.isJsxAttribute),handlers=attrs.filter(a=>/^on[A-Z]/.test(a.name.getText(source))).map(a=>a.name.getText(source));if(handlers.length||/^(button|input|select|textarea|a|summary|Button|IconButton|TextInput|NumberInput|Slider|Toggle|Checkbox|Dropdown|Select|RadioButton)$/.test(tag)){let label=attrs.find(a=>['aria-label','labelText','title','label'].includes(a.name.getText(source)))?.initializer?.getText(source);if(!label&&ts.isJsxElement(node.parent))label=node.parent.children.map(x=>x.getText(source)).join(' ').replace(/\s+/g,' ').slice(0,180);controls.push({site,file,line:pos.line+1,column:pos.character+1,tag,label:label||'',handlers,evidence:[]});}}
ts.forEachChild(node,visit);}visit(source);}
// Static local imports from the actual entry point distinguish dormant files.
const reachable=new Set(),unresolved=[];
function visitImport(file){if(reachable.has(file))return;reachable.add(file);const code=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true);function edge(node){let spec;if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))spec=node.moduleSpecifier.text;if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){if(ts.isStringLiteral(node.arguments[0]))spec=node.arguments[0].text;else unresolved.push(file);}if(spec?.startsWith('.')){const base=path.normalize(path.join(path.dirname(file),spec)),resolved=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>files.includes(p));if(resolved)visitImport(resolved);}ts.forEachChild(node,edge);}edge(ast);}visitImport('src/main.tsx');
for(const c of controls)c.runtimeImportReachable=reachable.has(c.file);
const bySite=new Map(controls.map(c=>[c.site,c]));let testCount=0;
for(const dir of runDirs){
 const manifestPath=path.join(dir,'manifest.json');
 if(!fs.existsSync(manifestPath))throw new Error(`Missing audit run manifest: ${dir}`);
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(!manifest.complete||!manifest.runId)throw new Error(`Incomplete audit run: ${dir}`);
 for(const file of fs.readdirSync(dir)){
  if(!file.endsWith('.json')||file==='manifest.json')continue;
  const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  if(r.runId!==manifest.runId)throw new Error(`Mismatched audit run identity: ${file}`);
  if(!['passed','pass'].includes(r.status))continue;
  if(!r.testFile||!fs.existsSync(r.testFile)||createHash('sha256').update(fs.readFileSync(r.testFile)).digest('hex')!==r.testSourceHash)continue;
  testCount++;
  for(const hit of r.hits||[]){const c=bySite.get(hit.site);if(c&&hit.sourceHash===hashes.get(c.file))c.evidence.push({test:r.test,project:r.project,status:r.status,event:hit.event,count:hit.count});}
 }
}
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'source-inventory.json'),JSON.stringify({scope:'Current production source. Line+column distinguish multiple controls on one line. Actual invocation is evidence of execution, not standalone proof of correctness.',files:files.length,unresolvedDynamicImports:unresolved,controls,functions},null,2));
const clean=s=>s.replaceAll('|','/').replaceAll('\n',' ');const md=['# Control interaction inventory','','Source-site identifiers include column numbers. An executed event does not prove every state or output is correct; use named tests and assertions. UNEXERCISED sites remain explicit gaps. Current test-file fingerprints exclude evidence from deleted or modified tests. Only passed tests from complete, uniquely identified fresh runs contribute evidence. DOM click means an input event only; handler events demonstrate invocation, neither alone proves correctness. Evidence is accepted only when its SHA-256 source hash matches the current file; stale runs are excluded.','','| Source site | Element | Label/expression | Events seen | Evidence tests |','|---|---|---|---|---|'];for(const c of controls){const events=[...new Set(c.evidence.map(e=>`${e.project}:${e.event}`))],tests=[...new Set(c.evidence.map(e=>e.test.join(' / ')))];md.push(`| ${c.site} | ${c.tag} | ${clean(c.label)} | ${events.length?events.join(', '):c.runtimeImportReachable?'UNEXERCISED':'NOT IMPORTED BY APP ENTRY'} | ${tests.map(clean).join('<br>')} |`);}fs.writeFileSync(path.join(output,'control-inventory.md'),md.join('\n')+'\n');
console.log(JSON.stringify({sourceFiles:files.length,controlSites:controls.length,functionSites:functions.length,testsRecorded:testCount,sitesWithExecution:controls.filter(c=>c.evidence.length).length,sitesWithoutExecution:controls.filter(c=>!c.evidence.length).length,unimportedSites:controls.filter(c=>!c.runtimeImportReachable).length}));
