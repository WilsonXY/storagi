import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import {createApp} from '../src/app.js';
import {identity} from './helpers.js';
import type {Config} from '../src/config.js';
export async function fixture(budgetBytes=100) {
 const dir=await mkdtemp(path.join(tmpdir(),'app-'));
 const id=await identity();
 const probe=http.createServer().listen(0,'127.0.0.1'); await once(probe,'listening'); const port=(probe.address() as {port:number}).port; await new Promise<void>(resolve=>probe.close(()=>resolve()));
 const config:Config={origin:`http://127.0.0.1:${port}`,clientId:'synthetic-client',clientSecret:'synthetic-secret',ownerSub:'123',dataDir:path.join(dir,'data'),budgetBytes,diskReserveBytes:1,port};
 let now=Date.now();
 let app=await createApp(config,{oidc:id.config,now:()=>now,freeBytes:()=>1e9,webDir:dir+'/no-web'});
 let base='';
 async function listen(){app.server.listen(port,'127.0.0.1');await once(app.server,'listening');base='http://127.0.0.1:'+(app.server.address() as {port:number}).port;}
 await listen();
 const request=(url:string,options:RequestInit={})=>fetch(base+url,{...options,headers:{connection:'close',...options.headers},redirect:'manual'});
 const login=await request('/auth/login');assert.equal(login.status,302);const params=new URL(login.headers.get('location')!).searchParams;
 id.set({nonce:params.get('nonce')!});
 const flowCookie=login.headers.get('set-cookie')!.split(';')[0];
 const result=await request('/auth/callback?code=synthetic&state='+params.get('state'),{headers:{cookie:flowCookie,'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'}});
 assert.equal(result.status,302,'Google top-level cross-site callback must work');
 const cookie=result.headers.getSetCookie().find(c=>c.startsWith('__Host-storagi-session='))!.split(';')[0];
 const session=await request('/api/session',{headers:{cookie}});const csrf=(await session.json()).csrfToken;
 const headers={cookie,origin:config.origin,'x-csrf-token':csrf,'tus-resumable':'1.0.0'};
 return {get app(){return app;},config,dir,id,request,headers,setNow:(n:number)=>{now=n;},now:()=>now,async restart(){await app.close();app=await createApp(config,{oidc:id.config,now:()=>now,freeBytes:()=>1e9,webDir:dir+'/no-web'});await listen();},async close(){await app.close();await rm(dir,{recursive:true,force:true});}};
}
