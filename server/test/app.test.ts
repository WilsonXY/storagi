import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures.js';
test('HTTP authorization covers every file path/method and CSRF/origin/host boundaries',async()=>{
 const f=await fixture();
 try{
  for(const method of ['GET','POST','PATCH','HEAD','DELETE','OPTIONS','PUT']) for(const route of ['/api/files','/api/files/00000000-0000-4000-8000-000000000000/download','/api/uploads','/api/uploads/00000000-0000-4000-8000-000000000000','/api/unknown']) {
    assert.equal((await f.request(route,{method})).status,401,method+' '+route);
  }
  assert.equal((await f.request('/api/files')).headers.get('cache-control'),'no-store');
  assert.equal((await f.request('/api/files',{headers:f.headers})).status,200);
  assert.equal((await f.request('/api/uploads',{method:'POST',headers:{cookie:f.headers.cookie,'tus-resumable':'1.0.0','upload-length':'1'}})).status,403);
  assert.equal((await f.request('/api/uploads',{method:'POST',headers:{...f.headers,origin:'https://evil.example','upload-length':'1'}})).status,403);
  assert.equal((await f.request('/api/files',{headers:{...f.headers,'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await f.request('/auth/logout',{method:'POST',headers:f.headers})).status,204);
  assert.equal((await f.request('/api/files',{headers:f.headers})).status,401);
 }finally{await f.close();}
});
