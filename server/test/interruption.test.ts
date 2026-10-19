import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {stat} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fixture} from './fixtures.js';
test('a broken PATCH retains real received bytes and resumes after service restart with exact integrity',async()=>{
 const f=await fixture();
 try {
  const create=await f.request('/api/uploads',{method:'POST',headers:{...f.headers,'upload-length':'6','upload-metadata':'filename cGFydGlhbA=='}});assert.equal(create.status,201);const location=create.headers.get('location')!,id=location.split('/').at(-1)!;
  const request=http.request(f.config.origin+location,{method:'PATCH',headers:{...f.headers,'content-type':'application/offset+octet-stream','upload-offset':'0','content-length':'6'}});
  const broken=new Promise<void>(resolve=>request.on('error',()=>resolve()));
  request.write('abc');
  let written=0;for(let i=0;i<100;i++){written=(await stat(path.join(f.app.storage.filesDir,id))).size;if(written===3)break;await delay(10);}
  assert.equal(written,3,'actual bytes arrived on disk before socket failure');request.destroy();await broken;
  const head=await f.request(location,{method:'HEAD',headers:f.headers});assert.equal(head.status,200);assert.equal(head.headers.get('upload-offset'),'3');
  assert.equal(f.app.storage.usage().reservedBytes,6);
  await f.restart();
  const finish=await f.request(location,{method:'PATCH',headers:{...f.headers,'content-type':'application/offset+octet-stream','upload-offset':'3'},body:'def'});assert.equal(finish.status,204,await finish.text());
  assert.equal(await (await f.request('/api/files/'+id+'/download',{headers:f.headers})).text(),'abcdef');
 }finally{await f.close();}
});

test('cleanup waits for an active write and rechecks refreshed retention before deleting',async()=>{
 const {DAY}=await import('../src/storage.js');const f=await fixture();
 try{
  const create=await f.request('/api/uploads',{method:'POST',headers:{...f.headers,'upload-length':'6','upload-metadata':'filename cGFydGlhbA=='}});const location=create.headers.get('location')!,id=location.split('/').at(-1)!;
  const request=http.request(f.config.origin+location,{method:'PATCH',headers:{...f.headers,'content-type':'application/offset+octet-stream','upload-offset':'0','content-length':'6'}});
  const response=new Promise<number>((resolve,reject)=>{request.once('response',res=>{res.resume();res.once('end',()=>resolve(res.statusCode!));});request.once('error',reject);});
  request.write('abc');let written=0;for(let i=0;i<100;i++){written=(await stat(path.join(f.app.storage.filesDir,id))).size;if(written===3)break;await delay(10);}assert.equal(written,3);
  f.setNow(f.now()+DAY);let cleaned=false;const cleanup=f.app.cleanup().then(()=>{cleaned=true;});await delay(20);assert.equal(cleaned,false);
  request.end('def');assert.equal(await response,204);await cleanup;
  assert.equal(f.app.storage.get(id)?.size,6);assert.equal(await (await f.request('/api/files/'+id+'/download',{headers:f.headers})).text(),'abcdef');
 }finally{await f.close();}
});
