import assert from 'node:assert/strict';
import {fixture} from './fixtures.js';
export async function upload(f:Awaited<ReturnType<typeof fixture>>,data:string,name='same.zip') {
 const created=await f.request('/api/uploads',{method:'POST',headers:{...f.headers,'upload-length':String(Buffer.byteLength(data)),'upload-metadata':'filename '+Buffer.from(name).toString('base64')}});
 assert.equal(created.status,201,await created.text());
 const location=created.headers.get('location')!; assert.match(location,/^\/api\/uploads\/[a-f0-9-]{36}$/);
 const patched=await f.request(location,{method:'PATCH',headers:{...f.headers,'content-type':'application/offset+octet-stream','upload-offset':'0'},body:data});
 assert.equal(patched.status,204,await patched.text());
 return location.split('/').at(-1)!;
}
