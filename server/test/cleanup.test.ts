import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './fixtures.js';
import {FileLocks} from '../src/transfers.js';
import {DAY} from '../src/storage.js';

test('cleanup continues after a lock timeout, retains failed quota and retries next pass',async t=>{
 const f=await fixture();
 try {
  for(const size of [6,4]) {
   const response=await f.request('/api/uploads',{method:'POST',headers:{...f.headers,'upload-length':String(size),'upload-metadata':'filename eA=='}});
   assert.equal(response.status,201);
  }
  const [first,later]=f.app.storage.rows();
  assert.deepEqual(f.app.storage.usage(),{usedBytes:0,reservedBytes:10,budgetBytes:100});
  f.setNow(f.now()+DAY);
  const timeout=new Error('synthetic lock timeout'),original=FileLocks.prototype.with;
  const fault=t.mock.method(FileLocks.prototype,'with',async function(this:FileLocks,id:string,work:()=>Promise<unknown>){
   if(id===first.id)throw timeout;
   return original.call(this,id,work);
  });
  const cleanup=f.app.cleanup();
  assert.equal(f.app.cleanup(),cleanup,'overlapping calls share the failing pass');
  await assert.rejects(cleanup,error=>error===timeout);
  assert.equal(f.app.storage.get(later.id),undefined,'later independent expired row must be removed');
  await assert.rejects(access(path.join(f.app.storage.filesDir,later.id)),{code:'ENOENT'});
  assert.deepEqual(f.app.storage.get(first.id),first,'failed row remains available for retry');
  await access(path.join(f.app.storage.filesDir,first.id));
  assert.deepEqual(f.app.storage.usage(),{usedBytes:0,reservedBytes:first.size,budgetBytes:100});
  fault.mock.restore();
  await f.app.cleanup();
  assert.equal(f.app.storage.get(first.id),undefined);
  await assert.rejects(access(path.join(f.app.storage.filesDir,first.id)),{code:'ENOENT'});
  assert.deepEqual(f.app.storage.usage(),{usedBytes:0,reservedBytes:0,budgetBytes:100});
 }finally{t.mock.restoreAll();await f.close();}
});
