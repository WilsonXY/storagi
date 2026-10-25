// Independent scaled HTTP/lifecycle acceptance. No production helpers or auth bypass.
// Run sequentially after final handoff: server/node_modules/.bin/tsx --test scripts/acceptance-review-fixes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';

async function bounded<T>(
  promise: Promise<T>,
  message: string,
  ms = 8000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
async function until(check: () => boolean | Promise<boolean>, message: string) {
  const end = Date.now() + 8000;
  while (!(await check())) {
    assert.ok(Date.now() < end, message);
    await delay(20);
  }
}

test(
  'independent acceptance of auth, validators, retired downloads and half-open uploads',
  { timeout: 90000 },
  async (t) => {
    const temp = `${homedir()}/.cache/storagi/tmp`;
    await mkdir(temp, { recursive: true });
    const dir = await mkdtemp(`${temp}/acceptance-fixes-`);
    const probe = http.createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = (probe.address() as { port: number }).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    const origin = `http://127.0.0.1:${port}`,
      MiB = 1024 ** 2,
      DAY = 86400000;
    const id = await identity();
    let now = Date.now();
    const config = {
      origin,
      port,
      clientId: 'synthetic-client',
      clientSecret: 'synthetic-secret',
      ownerSub: '123',
      dataDir: `${dir}/data`,
      budgetBytes: 24 * MiB,
      diskReserveBytes: 1,
    };
    const options = {
      oidc: id.config,
      now: () => now,
      freeBytes: () => 1e9,
      webDir: `${dir}/no-web`,
    };
    let app = await createApp(config, options);
    const sockets: http.ClientRequest[] = [];
    const request = (route: string, options: RequestInit = {}) =>
      fetch(origin + route, {
        signal: AbortSignal.timeout(8000),
        ...options,
        redirect: 'manual',
        headers: { connection: 'close', ...options.headers },
      });
    let owner: Record<string, string> = {};
    const begin = async () => {
      const response = await request('/auth/login');
      assert.equal(response.status, 302);
      const params = new URL(response.headers.get('location')!).searchParams;
      const cookie = response.headers
        .getSetCookie()
        .find((value) => value.startsWith('__Host-storagi-flow='))!
        .split(';')[0];
      assert.ok(cookie.length < 1100, 'flow cookie remains bounded');
      return { cookie, params };
    };
    const callback = async (
      flow: Awaited<ReturnType<typeof begin>>,
      cookie = flow.cookie,
      state = flow.params.get('state')!,
    ) => {
      id.set({
        sub: '123',
        nonce: flow.params.get('nonce')!,
        tamper: false,
        expired: false,
      });
      return request(
        `/auth/callback?code=synthetic&state=${encodeURIComponent(state)}`,
        { headers: { cookie } },
      );
    };
    const signIn = async () => {
      const result = await callback(await begin());
      assert.equal(result.status, 302);
      const cookie = result.headers
        .getSetCookie()
        .find(
          (value) =>
            value.startsWith('__Host-storagi-session=') &&
            !value.includes('Max-Age=0'),
        )!
        .split(';')[0];
      const session = await request('/api/session', { headers: { cookie } });
      assert.equal(session.status, 200);
      owner = {
        cookie,
        origin,
        'x-csrf-token': (await session.json()).csrfToken,
        'tus-resumable': '1.0.0',
      };
    };
    const create = async (name: string, size: number) => {
      const response = await request('/api/uploads', {
        method: 'POST',
        headers: {
          ...owner,
          'upload-length': String(size),
          'upload-metadata': `filename ${Buffer.from(name).toString('base64')}`,
        },
      });
      return {
        response,
        target: response.headers.has('location')
          ? new URL(response.headers.get('location')!, origin).pathname
          : '',
      };
    };
    const patch = (target: string, offset: number, body: Buffer) =>
      request(target, {
        method: 'PATCH',
        headers: {
          ...owner,
          'upload-offset': String(offset),
          'content-type': 'application/offset+octet-stream',
        },
        body,
      });
    const listing = async () => {
      const response = await request('/api/files', { headers: owner });
      assert.equal(response.status, 200);
      return response.json();
    };
    const halfOpen = async (target: string, length: number) => {
      const socket = http.request(origin + target, {
        method: 'PATCH',
        headers: {
          ...owner,
          'content-length': String(length),
          'upload-offset': '0',
          'content-type': 'application/offset+octet-stream',
        },
      });
      sockets.push(socket);
      socket.on('error', () => {});
      socket.on('response', (response) => response.resume());
      socket.write(Buffer.alloc(64 * 1024, 0x35));
      await until(
        async () =>
          (
            await stat(
              `${app.storage.filesDir}/${target.split('/').pop()}`,
            ).catch(() => ({ size: 0 }))
          ).size > 0,
        'half-open PATCH must write a prefix before testing contention',
      );
      return socket;
    };
    try {
      app.server.listen(port, '127.0.0.1');
      await once(app.server, 'listening');
      await t.test(
        'anonymous login flood preserves owner flow without database writes; tampering, expiry and concurrent replay denied',
        async () => {
          const pending = await begin();
          const changes = () =>
            app.storage.db.prepare('SELECT total_changes() AS count').get() as {
              count: number;
            };
          const before = changes().count;
          for (let i = 0; i < 125; i++) await begin();
          assert.equal(
            changes().count,
            before,
            'anonymous starts must not write or evict pending owner login',
          );
          await app.close();
          app = await createApp(config, options);
          app.server.listen(port, '127.0.0.1');
          await once(app.server, 'listening');
          const accepted = await callback(pending);
          assert.equal(accepted.status, 302);
          const afterSuccess = changes().count;
          assert.equal(
            (await callback(pending)).status,
            401,
            'successful flow replay denied',
          );
          assert.equal(
            changes().count,
            afterSuccess,
            'replay must not write another session',
          );
          const tampered = await begin();
          const token = tampered.cookie.split('=')[1];
          const altered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
          assert.equal(
            (await callback(tampered, `__Host-storagi-flow=${altered}`)).status,
            401,
          );
          assert.equal(
            (await callback(await begin(), undefined, 'forged-state')).status,
            401,
          );
          const expired = await begin();
          now += 10 * 60000;
          assert.equal((await callback(expired)).status, 401);
          const concurrent = await begin();
          const results = await Promise.all([
            callback(concurrent),
            callback(concurrent),
          ]);
          assert.deepEqual(
            results.map((response) => response.status).sort(),
            [302, 401],
          );
          await signIn();
          const original = owner.cookie;
          const navigation = await request('/auth/login', {
            headers: {
              cookie: original,
              'sec-fetch-site': 'cross-site',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-dest': 'document',
            },
          });
          assert.equal(navigation.status, 302);
          assert.equal(navigation.headers.get('location'), '/');
          assert.deepEqual(navigation.headers.getSetCookie(), []);
          assert.equal(
            (await request('/api/session', { headers: { cookie: original } }))
              .status,
            200,
          );
        },
      );
      await t.test(
        'Unicode names remain valid, bidi controls fail, immutable validators govern If-Range',
        async () => {
          for (const control of [
            '\u202a',
            '\u202b',
            '\u202c',
            '\u202d',
            '\u202e',
            '\u2066',
            '\u2067',
            '\u2068',
            '\u2069',
          ]) {
            assert.equal(
              (await create(`safe${control}txt.exe`, 0)).response.status,
              400,
            );
          }
          const bytes = Buffer.from('ordinary Unicode ✓');
          const created = await create('文档 café 🎵.zip', bytes.length);
          assert.equal(created.response.status, 201);
          assert.equal((await patch(created.target, 0, bytes)).status, 204);
          const route = `/api/files/${created.target.split('/').pop()}/download`;
          const download = await request(route, { headers: owner });
          assert.equal(download.status, 200);
          const etag = download.headers.get('etag')!,
            modified = download.headers.get('last-modified')!;
          assert.match(etag, /^"[^"\r\n]+"$/);
          assert.ok(Number.isFinite(Date.parse(modified)));
          assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
          for (const [validator, status] of [
            [etag, 206],
            [modified, 206],
            [`W/${etag}`, 200],
            ['"changed-copy"', 200],
            ['Thu, 01 Jan 1970 00:00:00 GMT', 200],
          ] as const) {
            const response = await request(route, {
              headers: { ...owner, range: 'bytes=2-4', 'if-range': validator },
            });
            assert.equal(response.status, status);
            assert.equal(response.headers.get('etag'), etag);
            assert.equal(response.headers.get('last-modified'), modified);
            assert.deepEqual(
              Buffer.from(await response.arrayBuffer()),
              status === 206 ? bytes.subarray(2, 5) : bytes,
            );
          }
          assert.equal(
            (
              await request(`/api/files/${created.target.split('/').pop()}`, {
                method: 'DELETE',
                headers: owner,
              })
            ).status,
            204,
          );
        },
      );
      await t.test(
        'stalled download allows parallel range/delete/expiry while retaining quota until its descriptor closes',
        async () => {
          const body = Buffer.alloc(16 * MiB, 0x5a);
          const created = await create('stalled.bin', body.length);
          assert.equal(created.response.status, 201);
          assert.equal((await patch(created.target, 0, body)).status, 204);
          const other = await create('unrelated-expiry.bin', 1);
          assert.equal(other.response.status, 201);
          assert.equal(
            (await patch(other.target, 0, Buffer.from('x'))).status,
            204,
          );
          const fileId = created.target.split('/').pop()!,
            route = `/api/files/${fileId}`;
          const stalled = await new Promise<http.IncomingMessage>(
            (resolve, reject) => {
              const socket = http.get(
                origin + route + '/download',
                { headers: owner },
                (response) => {
                  response.pause();
                  resolve(response);
                },
              );
              sockets.push(socket);
              socket.on('error', reject);
            },
          );
          try {
            assert.equal(stalled.statusCode, 200);
            const parallel = await request(route + '/download', {
              headers: { ...owner, range: 'bytes=2-4' },
            });
            assert.equal(parallel.status, 206);
            assert.deepEqual(
              Buffer.from(await parallel.arrayBuffer()),
              body.subarray(2, 5),
            );
            assert.equal(
              (await request(route, { method: 'DELETE', headers: owner }))
                .status,
              204,
            );
            assert.equal(
              (await request(route + '/download', { headers: owner })).status,
              404,
            );
            assert.equal(
              (await listing()).usedBytes,
              body.length + 1,
              'retired open inode still consumes the budget',
            );
            assert.equal(
              (await create('must-not-overcommit.bin', 16 * MiB)).response
                .status,
              507,
            );
            now += 31 * DAY;
            await bounded(
              app.cleanup(),
              'unrelated expired cleanup blocked by slow download',
            );
            await signIn();
            const shelf = await listing();
            assert.equal(shelf.files.length, 0);
            assert.equal(shelf.usedBytes, body.length);
            assert.equal(
              (await create('still-held.bin', 16 * MiB)).response.status,
              507,
            );
          } finally {
            stalled.destroy();
          }
          await until(
            async () => (await listing()).usedBytes === 0,
            'closing retired stream must release its quota',
          );
          const admitted = await create('after-close.bin', 16 * MiB);
          assert.equal(admitted.response.status, 201);
          assert.equal(
            (
              await request(admitted.target, {
                method: 'DELETE',
                headers: owner,
              })
            ).status,
            204,
          );
          assert.equal((await listing()).reservedBytes, 0);
        },
      );
      await t.test(
        'half-open PATCH yields promptly to resume, deletion and expiry cleanup without reviving quota',
        async () => {
          const size = MiB;
          const created = await create('half-open.bin', size);
          assert.equal(created.response.status, 201);
          const first = await halfOpen(created.target, size);
          const resumed = await request(created.target, {
            method: 'HEAD',
            headers: owner,
          });
          assert.equal(resumed.status, 200);
          const offset = Number(resumed.headers.get('upload-offset'));
          assert.ok(offset > 0 && offset < size);
          assert.equal(
            (
              await patch(
                created.target,
                offset,
                Buffer.alloc(size - offset, 0x35),
              )
            ).status,
            204,
          );
          first.destroy();
          const downloaded = await request(
            `/api/files/${created.target.split('/').pop()}/download`,
            { headers: owner },
          );
          assert.equal(downloaded.status, 200);
          assert.deepEqual(
            Buffer.from(await downloaded.arrayBuffer()),
            Buffer.alloc(size, 0x35),
          );
          assert.equal(
            (
              await request(created.target, {
                method: 'DELETE',
                headers: owner,
              })
            ).status,
            204,
          );
          for (const action of ['delete-files', 'delete-tus', 'cleanup']) {
            const partial = await create(`half-open-${action}.bin`, size);
            assert.equal(partial.response.status, 201);
            const socket = await halfOpen(partial.target, size);
            if (action !== 'cleanup') {
              const route =
                action === 'delete-files'
                  ? `/api/files/${partial.target.split('/').pop()}`
                  : partial.target;
              assert.equal(
                (await request(route, { method: 'DELETE', headers: owner }))
                  .status,
                204,
              );
            } else {
              now += DAY;
              await bounded(
                app.cleanup(),
                'expired half-open PATCH blocked cleanup',
              );
              const preserved = await request(partial.target, {
                method: 'HEAD',
                headers: owner,
              });
              assert.equal(
                preserved.status,
                200,
                'cancelling active write refreshes retention before cleanup recheck',
              );
              assert.equal(
                Number(preserved.headers.get('upload-offset')),
                64 * 1024,
              );
              assert.equal((await listing()).reservedBytes, size);
              socket.destroy();
              now += DAY;
              await bounded(
                app.cleanup(),
                'inactive cancelled partial must expire',
              );
            }
            socket.destroy();
            assert.equal(
              (
                await request(partial.target, {
                  method: 'HEAD',
                  headers: owner,
                })
              ).status,
              404,
            );
            const shelf = await listing();
            assert.equal(shelf.reservedBytes, 0);
            assert.equal(shelf.usedBytes, 0);
          }
        },
      );
    } finally {
      for (const socket of sockets) socket.destroy();
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
