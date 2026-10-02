import { defineConfig, type Plugin } from 'vite';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import base from './vite.config';

// Opt-in browser-test instrumentation. Normal dev/build configuration never
// imports this file. Only source locations/event names are recorded, not values.
const controls: Plugin = {
  name: 'studio-control-audit',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('/src/') || !id.endsWith('.tsx') || id.includes('/src/test/')) return;
    const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const sourceHash=createHash('sha256').update(code).digest('hex');
    const patches: Array<{start:number;end:number;text:string}> = [];
    const visit = (node:ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        const site = `${id.slice(id.indexOf('/src/')+1)}:${position.line+1}:${position.character+1}`;
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const handlers = attrs.filter(a => /^on[A-Z]/.test(a.name.getText(source)));
        const tag = node.tagName.getText(source);
        if (handlers.length || /^(button|input|select|textarea|a|summary)$/.test(tag)) {
          if (/^[a-z]/.test(tag)) patches.push({start:node.tagName.end,end:node.tagName.end,text:` data-audit-site=${JSON.stringify(site)} data-audit-hash=${JSON.stringify(sourceHash)}`});
          for (const attr of handlers) {
            const init = attr.initializer;
            if (init && ts.isJsxExpression(init) && init.expression) {
              const expr = init.expression;
              // Insert delimiters, rather than replacing the expression, so nested
              // JSX handler expressions keep their own instrumentation.
              patches.push({start:expr.getStart(source),end:expr.getStart(source),text:'__studioAuditHandler('});
              patches.push({start:expr.end,end:expr.end,text:`,${JSON.stringify(site)},${JSON.stringify(attr.name.getText(source))},${JSON.stringify(sourceHash)})`});
            }
          }
        }
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
    if (!patches.length) return;
    let result = code;
    for (const p of patches.sort((a,b)=>b.start-a.start)) result=result.slice(0,p.start)+p.text+result.slice(p.end);
    return {code:`const __studioAuditCache=new WeakMap();const __studioAuditHandler=(fn,site,event,sourceHash)=>{if(typeof fn!=='function')return fn;let cache=__studioAuditCache.get(fn);if(!cache){cache=new Map();__studioAuditCache.set(fn,cache)}const key=site+event;if(!cache.has(key))cache.set(key,function(...args){globalThis.__opstudioControlAudit?.({site,event,sourceHash});return fn.apply(this,args)});return cache.get(key)};\n${result}`,map:null};
  },
};
export default defineConfig({...base,plugins:[controls,...(base.plugins||[])]});
