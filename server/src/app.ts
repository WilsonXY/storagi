import http from 'node:http';
import {Server as TusServer} from '@tus/server';
import {NodeRequest} from 'srvx/node';
import path from 'node:path';
import {readdir,stat,open,mkdir,realpath} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transfers,FileLocks} from './transfers.js';
import {serveShell,defaultWebDir} from './static.js';
import {timingSafeEqual} from 'node:crypto';
import type * as oidc from 'openid-client';
import type {Config} from './config.js';
import {Storage,HttpError} from './storage.js';
import {Auth,googleConfig} from './auth.js';
export type AppOptions={oidc?:oidc.Configuration;now?:()=>number;freeBytes?:()=>number;webDir?:string};
const SESSION='__Host-storagi-session',FLOW='__Host-storagi-flow';
function cookies(header:string|undefined) {return Object.fromEntries((header||'').split(';').map(c=>{const i=c.indexOf('=');return[c.slice(0,i).trim(),c.slice(i+1)];}));}
function cookie(name:string,value:string,maxAge:number) {return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
function json(res:http.ServerResponse,status:number,value:unknown) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
function equal(a:string,b:string) {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function createApp(config:Config,options:AppOptions={}) {
 const webDir=options.webDir??defaultWebDir;
 await mkdir(config.dataDir,{recursive:true,mode:0o700});
 const dataPath=await realpath(config.dataDir);
 const webPath=await realpath(webDir).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return path.resolve(webDir);});
 if(dataPath===webPath||dataPath.startsWith(webPath+path.sep)||webPath.startsWith(dataPath+path.sep))throw new Error('DATA_DIR and public web directory must be separate');
 const storage=new Storage(config.dataDir,config.budgetBytes,config.diskReserveBytes,options.now,options.freeBytes);
 let auth:Auth;
 try {auth=new Auth(storage,config.origin,config.ownerSub,options.oidc??await googleConfig(config.clientId,config.clientSecret));}
 catch(error){storage.close();throw error;}
 const transfers=new Transfers(storage),locks=new FileLocks();
 function checkFile(id:string) {const row=storage.get(id);if(!row)throw new HttpError(404,'Not found');if(row.expiresAt<=storage.now())throw new HttpError(410,'File expired');}

 const tus=new TusServer({path:'/api/uploads',datastore:transfers,relativeLocation:true,allowedOrigins:[],maxSize:config.budgetBytes,namingFunction:()=>crypto.randomUUID(),locker:req=>({newLock:id=>{
   const lock=locks.newLock(id);
   return {async lock(signal,release){
     await lock.lock(signal,release);
     try{
       if(!auth.session(cookies(req.headers.get('cookie')||'')[SESSION]||''))throw new HttpError(401,'Authentication required');
       if(req.method!=='POST')checkFile(id);
     }catch(error){await lock.unlock();throw error;}
   },unlock:()=>lock.unlock()};
 }}),onResponseError:(_req,error)=>({status_code:error instanceof HttpError?error.status:('status_code' in error?error.status_code:500),body:JSON.stringify({error:error instanceof HttpError?error.message:'Upload request failed'})})});
 async function recover() {
   for(const row of storage.rows()) {
     if(!storage.db.prepare('SELECT 1 FROM tus WHERE id=?').get(row.id)){await transfers.remove(row.id);continue;}
     let info;try{info=await stat(path.join(storage.filesDir,row.id));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;storage.forget(row.id);continue;}
     if(row.expiresAt<=storage.now()||info.size>row.size){await transfers.remove(row.id);continue;}
     if(row.uploadedAt===null&&info.size===row.size){
       const file=await open(path.join(storage.filesDir,row.id),'r');try{await file.sync();}finally{await file.close();}
       storage.complete(row.id,Math.min(info.mtimeMs,storage.now()));
     }
   }
   for(const id of await readdir(storage.filesDir))if(!storage.get(id))await transfers.remove(id);
 }
 try{await recover();}catch(error){storage.close();throw error;}
 let cleaning:Promise<void>|undefined;
 function cleanup():Promise<void> {
   if(cleaning)return cleaning;
   cleaning=(async()=>{
     auth.prune();
     let failure:{error:unknown}|undefined;
     for(const row of storage.rows())if(row.expiresAt<=storage.now()) {
       try{await locks.with(row.id,async()=>{const current=storage.get(row.id);if(current&&current.expiresAt<=storage.now())await transfers.remove(row.id);});}
       catch(error){failure??={error};}
     }
     if(failure)throw failure.error;
   })().finally(()=>{cleaning=undefined;});return cleaning;
 }
 const timer=setInterval(()=>{void cleanup().catch(()=>{console.error('Storage cleanup failed; reserved capacity retained');});},60000);timer.unref();
 async function handle(req:http.IncomingMessage,res:http.ServerResponse) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const url=new URL(req.url||'/',config.origin),method=req.method||'GET',c=cookies(req.headers.cookie);
  if(req.headers.host!==new URL(config.origin).host) throw new HttpError(400,'Invalid host');
  if(url.pathname==='/auth/login'&&method==='GET') {
    if(auth.session(c[SESSION]||'')){res.writeHead(302,{Location:'/'});res.end();return;}
    const flow=await auth.begin(); res.setHeader('Set-Cookie',cookie(FLOW,flow.token,600));res.writeHead(302,{Location:flow.url});res.end();return;
  }
  if(url.pathname==='/auth/callback'&&method==='GET') {
    try {
      const result=await auth.callback(c[FLOW]||'',url);
      if(c[SESSION])auth.revoke(c[SESSION]);
      res.setHeader('Set-Cookie',[cookie(FLOW,'',0),cookie(SESSION,result.token,7*86400)]);res.writeHead(302,{Location:'/'});res.end();
    }catch(error){res.setHeader('Set-Cookie',cookie(FLOW,'',0));throw new HttpError(error instanceof HttpError?error.status:401,'Login failed; try again');}
    return;
  }
  if(url.pathname.startsWith('/api')||url.pathname.startsWith('/auth')) {
    if(req.headers.origin&&req.headers.origin!==config.origin||req.headers['sec-fetch-site']==='cross-site') throw new HttpError(403,'Same-origin requests required');
    const session=auth.session(c[SESSION]||''); if(!session)throw new HttpError(401,'Authentication required');
    if(!['GET','HEAD','OPTIONS'].includes(method)) {
      const csrf=req.headers['x-csrf-token'];if(typeof csrf!=='string'||!equal(csrf,session.csrf)||req.headers.origin!==config.origin)throw new HttpError(403,'CSRF validation failed');
    }
    if(url.pathname==='/api/session'&&method==='GET') {json(res,200,{authenticated:true,csrfToken:session.csrf});return;}
    if(url.pathname==='/auth/logout'&&method==='POST'){auth.revoke(c[SESSION]);res.setHeader('Set-Cookie',cookie(SESSION,'',0));res.writeHead(204);res.end();return;}
    if(url.pathname==='/api/files'&&method==='GET'){
      const q=(url.searchParams.get('q')||'').toLocaleLowerCase();
      const files=storage.rows().filter(r=>r.uploadedAt!==null&&r.expiresAt>storage.now()&&r.name.toLocaleLowerCase().includes(q)).sort((a,b)=>b.uploadedAt!-a.uploadedAt!||b.id.localeCompare(a.id)).map(r=>({id:r.id,name:r.name,size:r.size,uploadedAt:new Date(r.uploadedAt!).toISOString(),expiresAt:new Date(r.expiresAt).toISOString()}));
      json(res,200,{files,...storage.usage()});return;
    }
    const uploadMatch=/^\/api\/uploads(?:\/([a-f0-9-]{36}))?$/.exec(url.pathname);
    const fileMatch=/^\/api\/files\/([a-f0-9-]{36})(\/download)?$/.exec(url.pathname);
    if(uploadMatch||fileMatch) {
      const id=uploadMatch?.[1]??fileMatch?.[1];
      if(uploadMatch){
          if(id)checkFile(id);
          if(!['POST','PATCH','HEAD','DELETE','OPTIONS'].includes(method)||method==='POST'&&id||!id&& !['POST','OPTIONS'].includes(method))throw new HttpError(405,'Method not allowed');
          if(req.headers['upload-defer-length']!==undefined||req.headers['upload-concat']!==undefined)throw new HttpError(400,'Deferred lengths and concatenation are not supported');
          if(method==='POST'&&(!/^\d+$/.test(String(req.headers['upload-length']??''))||!Number.isSafeInteger(Number(req.headers['upload-length']))))throw new HttpError(400,'Known nonnegative Upload-Length required');
          res.setHeader('Content-Type','application/json; charset=utf-8');
          const response=await tus.handleWeb(new NodeRequest({req,res}));
          if(response.status>=400){let message='Upload request failed';try{const body=JSON.parse(await response.text());if(typeof body.error==='string')message=body.error;}catch{}json(res,response.status,{error:message});return;}
          if(res.destroyed){await response.body?.cancel();return;}
          const body=Buffer.from(await response.arrayBuffer());
          res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);return;
        }
      const send=await locks.with(id!,async()=>{
        if(!auth.session(c[SESSION]||''))throw new HttpError(401,'Authentication required');
        checkFile(id!);
        if(method==='DELETE'&&!fileMatch![2]){await transfers.remove(id!);res.writeHead(204);res.end();return;}
        if(['GET','HEAD'].includes(method)&&fileMatch![2]){
          const row=storage.get(id!)!;if(row.uploadedAt===null)throw new HttpError(404,'Not found');
          const etag=`"${row.id}"`,modified=new Date(row.uploadedAt!).toUTCString();
          res.setHeader('ETag',etag);res.setHeader('Last-Modified',modified);
          let start=0,end=row.size-1,status=200;
          const ifRange=req.headers['if-range'];
          if(req.headers.range&&(!ifRange||ifRange===etag||ifRange===modified)){
            const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            if(!range||!range[1]&&!range[2]){res.setHeader('Content-Range',`bytes */${row.size}`);throw new HttpError(416,'Invalid range');}
            start=range[1]?Number(range[1]):Math.max(0,row.size-Number(range[2]));end=range[1]?(range[2]?Math.min(Number(range[2]),row.size-1):row.size-1):row.size-1;
            if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=row.size){res.setHeader('Content-Range',`bytes */${row.size}`);throw new HttpError(416,'Invalid range');}
            status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${row.size}`);
          }
          res.setHeader('Content-Type','application/octet-stream');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',Math.max(0,end-start+1));
          res.setHeader('Content-Disposition',`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(row.name).replace(/['()*]/g,ch=>'%'+ch.charCodeAt(0).toString(16))}`);
          if(method==='HEAD'||row.size===0){res.writeHead(status);res.end();return;}
          const file=await open(path.join(storage.filesDir,id!),'r'),release=storage.pin(id!);
          // Linux retains the immutable inode after unlink; the pin keeps its quota charged.
          return async()=>{
            try{res.setTimeout(30000,()=>res.destroy());res.writeHead(status);await pipeline(file.createReadStream({start,end,autoClose:false}),res);}
            finally{await file.close();release();}
          };
        }
        throw new HttpError(405,'Method not allowed');
      });if(send)await send();return;
    }
    throw new HttpError(404,'Not found');
  }
  await serveShell(req,res,url.pathname,webDir);
 }
 const server=http.createServer((req,res)=>{void handle(req,res).catch(error=>{if(res.headersSent){res.destroy();return;}json(res,error instanceof HttpError?error.status:500,{error:error instanceof HttpError?error.message:'Request failed'});});});
 server.requestTimeout=15*60000;
 async function close(){clearInterval(timer);if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await cleaning;storage.close();}
 return {server,storage,auth,close,cleanup};
}
