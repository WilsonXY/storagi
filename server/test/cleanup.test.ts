import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './fixtures.js';
import {FileLocks} from '../src/transfers.js';
import {DAY} from '../src/storage.js';
import {once} from 'node:events';

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

test('close waits for active cleanup and closes storage when cleanup rejects',async t=>{
 const f=await fixture();
 const failure=new Error('synthetic cleanup failure');
 let enter!:()=>void,release!:()=>void;
 const entered=new Promise<void>(resolve=>{enter=resolve;}),released=new Promise<void>(resolve=>{release=resolve;});
 let cleanup:Promise<void>|undefined,closing:Promise<void>|undefined;
 try {
  const response=await f.request('/api/uploads',{method:'POST',headers:{...f.headers,'upload-length':'6','upload-metadata':'filename eA=='}});
  assert.equal(response.status,201);
  f.setNow(f.now()+DAY);
  t.mock.method(FileLocks.prototype,'with',async()=>{enter();await released;throw failure;});
  cleanup=f.app.cleanup();
  const cleanupRejected=assert.rejects(cleanup,error=>error===failure);
  await entered;
  const httpClosed=once(f.app.server,'close');
  closing=f.app.close();
  const closeRejected=assert.rejects(closing,error=>error===failure,'close must preserve the original cleanup failure');
  await httpClosed;
  assert.equal(f.app.server.listening,false,'HTTP listener closes before cleanup finishes');
  assert.equal(f.app.storage.db.open,true,'SQLite stays open while cleanup is active');
  release();
  await cleanupRejected;
  await closeRejected;
  assert.equal(f.app.storage.db.open,false,'failed cleanup must not skip closing SQLite');
 }finally{
  release();
  await Promise.allSettled([cleanup,closing]);
  t.mock.restoreAll();
  await f.close();
 }
});
