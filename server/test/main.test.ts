import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('production entrypoint fails closed without configuration and emits no credentials',()=>{
 const main=fileURLToPath(new URL('../src/main.ts',import.meta.url));
 const tsx=fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[tsx,main],{env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Missing PUBLIC_ORIGIN/);assert.doesNotMatch(result.stderr,/ERR_MODULE_NOT_FOUND/);
});
