import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {realpath,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import type http from 'node:http';
import {HttpError} from './storage.js';
// Locate the package in both source (tsx) and compiled dist/src layouts.
const packageDir=fileURLToPath(new URL(import.meta.url.includes('/dist/src/')?'../../':'../',import.meta.url));
export const defaultWebDir=path.resolve(packageDir,'../web/dist');
export async function serveShell(req:http.IncomingMessage,res:http.ServerResponse,pathname:string,webDir:string):Promise<void> {
 if(!['GET','HEAD'].includes(req.method||''))throw new HttpError(405,'Method not allowed');
 const icon=['/favicon.svg','/favicon.ico','/favicon-16.png','/favicon-32.png','/favicon-48.png','/apple-touch-icon.png','/icon-192.png','/icon-512.png'].includes(pathname);
 if(pathname!=='/'&&pathname!=='/index.html'&&!icon&&!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname))throw new HttpError(404,'Not found');
 const relative=pathname==='/'?'index.html':pathname.slice(1);
 let file:string,root:string,info;
 try{root=await realpath(webDir);file=await realpath(path.join(root,relative));info=await stat(file);}catch{throw new HttpError(404,'Dashboard build is unavailable');}
 if(!file.startsWith(root+path.sep)||!info.isFile())throw new HttpError(404,'Not found');
 if(icon)res.setHeader('Cache-Control','public, max-age=86400');
 const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',info.size);res.writeHead(200);
 if(req.method==='HEAD'){res.end();return;}
 await pipeline(createReadStream(file),res);
}
