import {tmpdir} from 'node:os';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {Storage} from '../src/storage.js';

test('atomic reservations include all partial bytes and preserve duplicate names', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'storage-'));
 const storage=new Storage(dir,10,1,()=>1000,()=>100000);
 try {
   const results=await Promise.allSettled(Array.from({length:3},(_,i)=>Promise.resolve().then(()=>storage.reserve(String(i),'same.zip',6))));
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.deepEqual(storage.usage(),{usedBytes:0,reservedBytes:6,budgetBytes:10});
   storage.forget('0');
   storage.reserve('a','same.zip',4); storage.reserve('b','same.zip',4);
   assert.equal(storage.get('a')?.name,'same.zip');
   assert.equal(storage.get('b')?.name,'same.zip');
   storage.complete('a');
   assert.deepEqual(storage.usage(),{usedBytes:4,reservedBytes:4,budgetBytes:10});
 } finally {storage.close(); await rm(dir,{recursive:true,force:true});}
});

test('disk headroom includes remaining reservations and rejects a second SQLite writer',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'disk-'));let free=10;
 const storage=new Storage(dir,100,2,Date.now,()=>free);
 try{
  storage.reserve('a','a',6);
  assert.throws(()=>storage.reserve('b','b',3),/headroom/);
  free=7;assert.throws(()=>storage.reserve('b','b',0),/headroom/);
  assert.deepEqual(storage.usage(),{usedBytes:0,reservedBytes:6,budgetBytes:100});
  assert.throws(()=>new Storage(dir,100,2),/locked/);
 }finally{storage.close();await rm(dir,{recursive:true,force:true});}
});
test('a tus metadata persistence failure rolls back its file and reservation',async()=>{
 const {Transfers}=await import('../src/transfers.js');const {Upload}=await import('@tus/server');
 const {readdir}=await import('node:fs/promises');
 const dir=await mkdtemp(path.join(tmpdir(),'rollback-'));const storage=new Storage(dir,100,1);const transfers=new Transfers(storage);
 try{
  transfers.configstore.set=async()=>{throw new Error('Injected persistence failure');};
  await assert.rejects(transfers.create(new Upload({id:'00000000-0000-4000-8000-000000000000',size:5,offset:0,metadata:{filename:'test'}})),/Injected persistence failure/);
  assert.deepEqual(storage.usage(),{usedBytes:0,reservedBytes:0,budgetBytes:100});assert.deepEqual(await readdir(storage.filesDir),[]);
 }finally{storage.close();await rm(dir,{recursive:true,force:true});}
});
