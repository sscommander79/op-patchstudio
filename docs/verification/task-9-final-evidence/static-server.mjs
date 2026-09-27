import http from 'node:http';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const pointer='/tmp/opstudio-task9-served-root';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.md':'text/plain'};
const server=http.createServer(async(req,res)=>{
 try{
  const root=resolve((await readFile(pointer,'utf8')).trim());const url=new URL(req.url,'http://127.0.0.1:5188');const pathname=decodeURIComponent(url.pathname);let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  if(pathname.endsWith('/'))file=resolve(file,'index.html');
  try{if(!(await stat(file)).isFile())throw new Error('Not a file');}catch{res.writeHead(404,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Not found');return;}
  if(root.endsWith('opstudio-task9-build-c')&&pathname==='/assets/task9-proof-static.svg'){
    const hold='/tmp/opstudio-task9-hold-c';
    try{await stat(hold);await writeFile('/tmp/opstudio-task9-hold-c-reached','held');while(true){try{await stat(hold);}catch{break;}await new Promise(r=>setTimeout(r,25));}}catch{}
  }
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-cache','Content-Length':body.length});res.end(body);
 }catch(error){res.writeHead(500,{'Content-Type':'text/plain'}).end(String(error));}
});
server.listen(5188,'127.0.0.1',()=>console.log('Isolated production proof server: http://127.0.0.1:5188; root pointer '+pointer));
