import path from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import * as oidc from 'openid-client';
import {identity} from './helpers.js';
import {Storage} from '../src/storage.js';
import {Auth} from '../src/auth.js';

test('signed OIDC identity, PKCE, state/nonce, allowlist, replay and session revocation',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'auth-')); const storage=new Storage(dir,100,1);
 const id=await identity(); const auth=new Auth(storage,'https://shelf.example','123',id.config);
 try {
  const begin=await auth.begin(); const request=new URL(begin.url);
  assert.equal(request.searchParams.get('scope'),'openid');
  assert.equal(request.searchParams.get('code_challenge_method'),'S256');
  assert.ok(request.searchParams.get('state')); assert.ok(request.searchParams.get('nonce'));
  id.set({nonce:request.searchParams.get('nonce')!});
  const result=await auth.callback(begin.token,new URL('https://shelf.example/auth/callback?code=synthetic&state='+request.searchParams.get('state')));
  assert.equal(auth.session(result.token)?.csrf,result.csrf);
  assert.ok(id.verifier());
  assert.equal(await oidc.calculatePKCECodeChallenge(id.verifier()),request.searchParams.get('code_challenge'));
  await assert.rejects(auth.callback(begin.token,new URL('https://shelf.example/auth/callback?code=x&state='+request.searchParams.get('state'))));
  auth.revoke(result.token); assert.equal(auth.session(result.token),undefined);
  for(const bad of [{sub:'456'},{tamper:true},{expired:true},{nonce:'wrong'},{audience:'wrong'},{issuer:'https://wrong.example'}]) {
   const flow=await auth.begin(); const params=new URL(flow.url).searchParams;
   id.set({sub:'123',tamper:false,expired:false,audience:'synthetic-client',issuer:'https://accounts.google.com',nonce:params.get('nonce')!,...bad});
   await assert.rejects(auth.callback(flow.token,new URL('https://shelf.example/auth/callback?code=x&state='+params.get('state'))));
  }
  const flow=await auth.begin(); await assert.rejects(auth.callback(flow.token,new URL('https://shelf.example/auth/callback?code=x&state=wrong')));
 } finally{storage.close();await rm(dir,{recursive:true,force:true});}
});
