import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,symlink} from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './fixtures.js';
import {upload} from './uploads.js';
test('built dashboard is a public login shell, traversal and storage paths stay private',async()=>{
 const f=await fixture();
 try{
  await mkdir(path.join(f.dir,'no-web','assets'),{recursive:true});
  await writeFile(path.join(f.dir,'no-web','index.html'),'<!doctype html><title>Storagi shell</title>');
  await writeFile(path.join(f.dir,'no-web','favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await writeFile(path.join(f.dir,'no-web','assets','main.js'),'console.log("synthetic")');
  const shell=await f.request('/',{headers:{'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'}});assert.equal(shell.status,200);assert.match(await shell.text(),/Storagi shell/);
  assert.equal((await f.request('/assets/main.js')).headers.get('content-type'),'text/javascript; charset=utf-8');
  const favicon=await f.request('/favicon.svg');assert.equal(favicon.status,200);assert.equal(favicon.headers.get('content-type'),'image/svg+xml');
  for(const route of ['/storagi.sqlite','/objects/known-id','/.env','/assets/%2e%2e%2f%2e%2e%2fstoragi.sqlite','//evil.example/api/files'])assert.notEqual((await f.request(route)).status,200);
 }finally{await f.close();}
});

test('a storage symlink into public assets is rejected before any database is written',async()=>{
 const {mkdtemp,symlink,rm,access}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {createApp}=await import('../src/app.js');const {identity}=await import('./helpers.js');
 const dir=await mkdtemp(path.join(tmpdir(),'paths-'));const webDir=path.join(dir,'web'),dataDir=path.join(dir,'private');
 try{
  await mkdir(path.join(webDir,'assets'),{recursive:true});await symlink(path.join(webDir,'assets'),dataDir);
  const id=await identity();
  await assert.rejects(createApp({origin:'https://shelf.example',clientId:'synthetic',clientSecret:'synthetic',ownerSub:'123',dataDir,budgetBytes:100,diskReserveBytes:1,port:8787},{oidc:id.config,webDir}),/separate/);
  await assert.rejects(access(path.join(webDir,'assets','storagi.sqlite')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('serves only exact brand icon paths with cacheable GET and HEAD responses',async()=>{
 const f=await fixture();
 try{
  const root=path.join(f.dir,'no-web');await mkdir(root,{recursive:true});
  const icons=['favicon.svg','favicon.ico','favicon-16.png','favicon-32.png','favicon-48.png','apple-touch-icon.png','icon-192.png','icon-512.png'];
  for(const name of [...icons,'other.png','favicon-64.png','secret.ico'])await writeFile(path.join(root,name),'synthetic icon');
  for(const name of icons){
   const response=await f.request('/'+name);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),name.endsWith('.svg')?'image/svg+xml':name.endsWith('.ico')?'image/x-icon':'image/png');assert.equal(await response.text(),'synthetic icon');assert.equal(response.headers.get('cache-control'),'public, max-age=86400');
   const head=await f.request('/'+name,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('cache-control'),'public, max-age=86400');assert.equal(await head.text(),'');
  }
  for(const route of ['/other.png','/favicon-64.png','/secret.ico','/icons/favicon.ico','/favicon.ico/extra'])assert.equal((await f.request(route)).status,404);
 }finally{await f.close();}
});

test('shell, other assets, private data and rejected icon requests remain no-store',async()=>{
 const f=await fixture();
 try{
  const root=path.join(f.dir,'no-web');await mkdir(path.join(root,'assets'),{recursive:true});
  for(const name of ['index.html','assets/main.js','assets/main.css','assets/font.woff2','assets/image.png'])await writeFile(path.join(root,name),'synthetic public asset');
  await symlink(path.join(f.dir,'data','storagi.sqlite'),path.join(root,'favicon.svg'));
  await mkdir(path.join(root,'favicon.ico'));
  for(const method of ['GET','HEAD']){
   for(const route of ['/','/index.html','/assets/main.js','/assets/main.css','/assets/font.woff2','/assets/image.png']){
    const response=await f.request(route,{method});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store',route);await response.arrayBuffer();
   }
   for(const route of ['/favicon.svg','/favicon.ico','/favicon-16.png','/other.png','/favicon.ico/extra','/assets/%2e%2e%2f%2e%2e%2fstoragi.sqlite']){
    const response=await f.request(route,{method});assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store',route);await response.arrayBuffer();
   }
  }
  const badMethod=await f.request('/favicon.ico',{method:'POST'});assert.equal(badMethod.status,405);assert.equal(badMethod.headers.get('cache-control'),'no-store');
  for(const [headers,status] of [[{},401],[f.headers,200]] as const)for(const route of ['/api/session','/api/files']){
   const response=await f.request(route,{headers});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');await response.arrayBuffer();
  }
  const id=await upload(f,'private bytes');
  for(const method of ['GET','HEAD'])for(const [headers,status] of [[{},401],[f.headers,200],[{...f.headers,range:'bytes=1-4'},206]] as const){
   const response=await f.request('/api/files/'+id+'/download',{method,headers});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');await response.arrayBuffer();
  }
 }finally{await f.close();}
});
