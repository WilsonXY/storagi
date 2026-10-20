// Run after the service handoff: server/node_modules/.bin/tsx --test scripts/acceptance-api.test.ts
// Synthetic signed OIDC transport only; no Google credentials or production auth bypass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';

test('independent HTTP acceptance: identity, restart, integrity, reservations and expiry', async t => {
  const temp = `${homedir()}/.cache/storagi/tmp`;
  await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(`${temp}/acceptance-`);
  const id = await identity();
  const probe = http.createServer().listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const config = { origin: `http://127.0.0.1:${port}`, clientId: 'synthetic-client', clientSecret: 'synthetic-secret', ownerSub: '123', dataDir: `${dir}/data`, budgetBytes: 32, diskReserveBytes: 1, port };
  let now = Date.now();
  let app = await createApp(config, { oidc: id.config, now: () => now, freeBytes: () => 1e9, webDir: `${dir}/no-web` });
  app.server.listen(port, '127.0.0.1');
  await once(app.server, 'listening');
  let base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const request = (route: string, options: RequestInit = {}) => fetch(base + route, { ...options, redirect: 'manual', headers: { connection: 'close', ...options.headers } });
  let owner: Record<string, string> = {};
  let target = '';
  const bytes = Buffer.from('ZIP\0\x01\x02\x03\xff');
  try {
    await t.test('signed wrong-sub denied; valid Google-style cross-site callback accepted', async () => {
      for (const subject of ['456', '123']) {
        const login = await request('/auth/login');
        assert.equal(login.status, 302);
        const params = new URL(login.headers.get('location')!).searchParams;
        id.set({ sub: subject, nonce: params.get('nonce')! });
        const callback = await request(`/auth/callback?code=synthetic&state=${params.get('state')}`, { headers: { cookie: login.headers.get('set-cookie')!.split(';')[0], 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } });
        const cookie = callback.headers.getSetCookie().find(value => value.startsWith('__Host-storagi-session=') && !value.includes('Max-Age=0'));
        if (subject === '456') {
          assert.equal(callback.status, 403);
          assert.equal(cookie, undefined, 'wrong-sub must receive no session');
        } else {
          assert.equal(callback.status, 302);
          assert.match(cookie!, /HttpOnly/); assert.match(cookie!, /Secure/); assert.match(cookie!, /SameSite=Lax/);
          const session = await request('/api/session', { headers: { cookie: cookie!.split(';')[0] } });
          assert.equal(session.status, 200);
          owner = { cookie: cookie!.split(';')[0], origin: config.origin, 'x-csrf-token': (await session.json()).csrfToken, 'tus-resumable': '1.0.0' };
        }
      }
    });
    await t.test('partial bytes resume across service restart; complete bytes match SHA-256', async () => {
      const created = await request('/api/uploads', { method: 'POST', headers: { ...owner, 'upload-length': String(bytes.length), 'upload-metadata': `filename ${Buffer.from('same.zip').toString('base64')}` } });
      assert.equal(created.status, 201);
      target = new URL(created.headers.get('location')!, config.origin).pathname;
      const chunk = await request(target, { method: 'PATCH', headers: { ...owner, 'upload-offset': '0', 'content-type': 'application/offset+octet-stream' }, body: bytes.subarray(0, 3) });
      assert.equal(chunk.status, 204);
      await app.close();
      app = await createApp(config, { oidc: id.config, now: () => now, freeBytes: () => 1e9, webDir: `${dir}/no-web` });
      app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening');
      base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
      const resumed = await request(target, { method: 'HEAD', headers: owner });
      assert.equal(resumed.status, 200); assert.equal(resumed.headers.get('upload-offset'), '3');
      assert.equal((await request(target, { method: 'PATCH', headers: { ...owner, 'upload-offset': '3', 'content-type': 'application/offset+octet-stream' }, body: bytes.subarray(3) })).status, 204);
      const files = await (await request('/api/files', { headers: owner })).json();
      assert.equal(files.files.length, 1); assert.equal(files.usedBytes, bytes.length); assert.equal(files.reservedBytes, 0);
      const download = await request(`/api/files/${target.split('/').pop()}/download`, { headers: owner });
      assert.equal(download.status, 200);
      assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
      const range = await request(`/api/files/${target.split('/').pop()}/download`, { headers: { ...owner, range: 'bytes=2-4' } });
      assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(2, 5));
    });
    await t.test('known valid URLs reject every anonymous/forged method; hostile mutations fail', async () => {
      for (const cookie of ['', '__Host-storagi-session=forged']) {
        for (const route of ['/api/session', '/api/files?q=same', `/api/files/${target.split('/').pop()}`, `/api/files/${target.split('/').pop()}/download`, '/api/uploads', target]) {
          for (const method of ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT']) {
            const response = await request(route, { method, headers: { cookie } });
            assert.equal(response.status, 401, `${method} ${route} with ${cookie || 'anonymous'}`);
            assert.equal(response.headers.get('cache-control'), 'no-store');
          }
        }
      }
      for (const headers of [{ ...owner, 'x-csrf-token': '' }, { ...owner, origin: 'https://hostile.example' }, { ...owner, 'sec-fetch-site': 'cross-site' }]) {
        assert.equal((await request(`/api/files/${target.split('/').pop()}`, { method: 'DELETE', headers })).status, 403);
      }
      const hostileHostStatus = await new Promise<number | undefined>((resolve, reject) => {
        http.get(`${base}/api/files`, { headers: { cookie: owner.cookie, host: 'hostile.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
      });
      assert.equal(hostileHostStatus, 400);
    });
    await t.test('simultaneous reservations enforce quota without evicting a completed file', async () => {
      const responses = await Promise.all(Array.from({ length: 3 }, () => request('/api/uploads', { method: 'POST', headers: { ...owner, 'upload-length': '20', 'upload-metadata': `filename ${Buffer.from('same.zip').toString('base64')}` } })));
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 507, 507]);
      const listing = await (await request('/api/files', { headers: owner })).json();
      assert.equal(listing.usedBytes, bytes.length); assert.equal(listing.reservedBytes, 20); assert.equal(listing.files.length, 1);
      const partial = new URL(responses.find(r => r.status === 201)!.headers.get('location')!, config.origin).pathname;
      assert.notEqual(partial, target, 'same filename must use distinct upload ids');
      now += 86400000;
      assert.equal((await request(partial, { method: 'HEAD', headers: owner })).status, 410, 'partial expires exactly at inactivity limit');
      await app.cleanup();
      assert.equal((await (await request('/api/files', { headers: owner })).json()).reservedBytes, 0);
    });
    await t.test('session expiry rejects direct download; completed expiry survives restart', async () => {
      now += 7 * 86400000;
      assert.equal((await request(`/api/files/${target.split('/').pop()}/download`, { headers: owner })).status, 401);
      now += 23 * 86400000;
      await app.close();
      app = await createApp(config, { oidc: id.config, now: () => now, freeBytes: () => 1e9, webDir: `${dir}/no-web` });
      app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening');
      base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
      const login = await request('/auth/login'); const params = new URL(login.headers.get('location')!).searchParams;
      id.set({ sub: '123', nonce: params.get('nonce')! });
      const callback = await request(`/auth/callback?code=synthetic&state=${params.get('state')}`, { headers: { cookie: login.headers.get('set-cookie')!.split(';')[0] } });
      const cookie = callback.headers.getSetCookie().find(v => v.startsWith('__Host-storagi-session=') && !v.includes('Max-Age=0'))!.split(';')[0];
      const listing = await request('/api/files', { headers: { cookie } });
      const body = await listing.json(); assert.equal(body.files.length, 0); assert.equal(body.usedBytes, 0); assert.equal(body.reservedBytes, 0);
      assert.ok([404, 410].includes((await request(`/api/files/${target.split('/').pop()}/download`, { headers: { cookie } })).status));
    });
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
