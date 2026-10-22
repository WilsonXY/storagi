import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './fixtures.js';
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

test('serves only exact brand icon paths with their MIME types',async()=>{
 const f=await fixture();
 try{
  const root=path.join(f.dir,'no-web');await mkdir(root,{recursive:true});
  const icons=['favicon.ico','favicon-16.png','favicon-32.png','favicon-48.png','apple-touch-icon.png','icon-192.png','icon-512.png'];
  for(const name of [...icons,'other.png','favicon-64.png','secret.ico'])await writeFile(path.join(root,name),'synthetic icon');
  for(const name of icons){
   const response=await f.request('/'+name);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),name.endsWith('.ico')?'image/x-icon':'image/png');assert.equal(await response.text(),'synthetic icon');
   const head=await f.request('/'+name,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  for(const route of ['/other.png','/favicon-64.png','/secret.ico','/icons/favicon.ico','/favicon.ico/extra'])assert.equal((await f.request(route)).status,404);
 }finally{await f.close();}
});
