// Optional/manual, never routine CI. Real local service/storage; synthetic signed identity.
// TMPDIR=~/.cache/storagi/tmp server/node_modules/.bin/tsx --test scripts/acceptance-large-file.ts
// Generates one 8 MiB chunk at a time; stores only the service's 2 GiB + 1 byte copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { mkdir, mkdtemp, rm, stat, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';

test(
  'local 2 GiB + 1 byte streamed tus transfer resumes after 1 GiB restart and matches SHA-256',
  { timeout: 10 * 60_000 },
  async (t) => {
    const GiB = 1024 ** 3,
      totalBytes = 2 * GiB + 1,
      chunkBytes = 8 * 1024 ** 2;
    const temp = `${homedir()}/.cache/storagi/tmp`;
    const artifacts = path.resolve(
      process.env.STORAGI_ARTIFACT_DIR ||
        'artifacts/acceptance-stage05/large-file',
    );
    await mkdir(temp, { recursive: true });
    await mkdir(artifacts, { recursive: true });
    const fs = await statfs(temp),
      freeBefore = fs.bavail * fs.bsize;
    assert.ok(
      freeBefore >= totalBytes + GiB + 64 * 1024 ** 2,
      'Need payload space plus 1 GiB disk reserve and 64 MiB overhead on persistent home storage',
    );
    console.log(
      JSON.stringify({
        phase: 'preflight',
        totalBytes,
        chunkBytes,
        freeBefore,
        tempParent: temp,
      }),
    );
    const started = Date.now(),
      dir = await mkdtemp(`${temp}/acceptance-large-`);
    let app: Awaited<ReturnType<typeof createApp>> | undefined;
    let uploadedBytes = 0,
      downloadedBytes = 0,
      restartOffset = 0,
      completed = false;
    let expectedHash = '',
      downloadedHash = '';
    try {
      const probe = http.createServer().listen(0, '127.0.0.1');
      await once(probe, 'listening');
      const port = (probe.address() as { port: number }).port;
      await new Promise<void>((resolve) => probe.close(() => resolve()));
      const origin = `http://127.0.0.1:${port}`;
      const config = {
        origin,
        clientId: 'synthetic-client',
        clientSecret: 'synthetic-secret',
        ownerSub: '123',
        dataDir: `${dir}/data`,
        budgetBytes: 4 * GiB,
        diskReserveBytes: GiB,
        port,
      };
      const id = await identity();
      app = await createApp(config, {
        oidc: id.config,
        webDir: `${dir}/no-web`,
      });
      app.server.listen(port, '127.0.0.1');
      await once(app.server, 'listening');
      const flow = await app.auth.begin(),
        params = new URL(flow.url).searchParams;
      id.set({ sub: '123', nonce: params.get('nonce')! });
      const session = await app.auth.callback(
        flow.token,
        new URL(
          `${origin}/auth/callback?code=synthetic&state=${params.get('state')}`,
        ),
      );
      const headers = {
        cookie: `__Host-storagi-session=${session.token}`,
        origin,
        'x-csrf-token': session.csrf,
        'tus-resumable': '1.0.0',
        connection: 'close',
      };
      const created = await fetch(`${origin}/api/uploads`, {
        signal: t.signal,
        method: 'POST',
        headers: {
          ...headers,
          'upload-length': String(totalBytes),
          'upload-metadata': `filename ${Buffer.from('synthetic-2GiB-plus-one.bin').toString('base64')}`,
        },
      });
      assert.equal(created.status, 201, await created.text());
      const target = new URL(created.headers.get('location')!, origin);
      assert.equal(target.origin, origin);
      const fileId = target.pathname.split('/').pop()!;
      const sourceHash = createHash('sha256'),
        chunk = Buffer.allocUnsafe(chunkBytes);
      while (uploadedBytes < totalBytes) {
        const count = Math.min(chunkBytes, totalBytes - uploadedBytes);
        chunk.fill(Math.floor(uploadedBytes / chunkBytes) % 251, 0, count);
        const body = chunk.subarray(0, count);
        sourceHash.update(body);
        const response = await fetch(target, {
          signal: t.signal,
          method: 'PATCH',
          headers: {
            ...headers,
            'upload-offset': String(uploadedBytes),
            'content-type': 'application/offset+octet-stream',
          },
          body,
        });
        assert.equal(response.status, 204, await response.text());
        uploadedBytes += count;
        assert.equal(
          Number(response.headers.get('upload-offset')),
          uploadedBytes,
        );
        if (
          uploadedBytes % (256 * 1024 ** 2) === 0 ||
          uploadedBytes === totalBytes
        ) {
          console.log(
            JSON.stringify({
              phase: 'upload',
              uploadedBytes,
              totalBytes,
              elapsedSeconds: (Date.now() - started) / 1000,
              rssBytes: process.memoryUsage().rss,
              peakRssBytes: process.resourceUsage().maxRSS * 1024,
            }),
          );
        }
        if (uploadedBytes === GiB) {
          const head = await fetch(target, {
            signal: t.signal,
            method: 'HEAD',
            headers,
          });
          assert.equal(head.status, 200);
          assert.equal(Number(head.headers.get('upload-offset')), GiB);
          assert.equal(
            (await stat(path.join(app.storage.filesDir, fileId))).size,
            GiB,
          );
          assert.equal(app.storage.usage().reservedBytes, totalBytes);
          assert.equal(app.storage.usage().usedBytes, 0);
          await app.close();
          app = await createApp(config, {
            oidc: id.config,
            webDir: `${dir}/no-web`,
          });
          app.server.listen(port, '127.0.0.1');
          await once(app.server, 'listening');
          const resumed = await fetch(target, {
            signal: t.signal,
            method: 'HEAD',
            headers,
          });
          assert.equal(resumed.status, 200);
          restartOffset = Number(resumed.headers.get('upload-offset'));
          assert.equal(restartOffset, GiB);
          console.log(
            JSON.stringify({
              phase: 'restart-resume',
              restartOffset,
              elapsedSeconds: (Date.now() - started) / 1000,
            }),
          );
        }
      }
      expectedHash = sourceHash.digest('hex');
      assert.equal(
        (await stat(path.join(app.storage.filesDir, fileId))).size,
        totalBytes,
      );
      assert.equal(app.storage.usage().usedBytes, totalBytes);
      assert.equal(app.storage.usage().reservedBytes, 0);
      const listing = await fetch(`${origin}/api/files`, {
        signal: t.signal,
        headers,
      });
      const shelf = await listing.json();
      assert.equal(shelf.files.length, 1);
      assert.equal(shelf.files[0].size, totalBytes);
      const download = await fetch(`${origin}/api/files/${fileId}/download`, {
        signal: t.signal,
        headers,
      });
      assert.equal(download.status, 200);
      assert.equal(Number(download.headers.get('content-length')), totalBytes);
      const receivedHash = createHash('sha256');
      let nextProgress = 256 * 1024 ** 2;
      // Consume the response stream directly: no full response buffer or second disk copy.
      for await (const data of download.body!) {
        receivedHash.update(data);
        downloadedBytes += data.length;
        if (downloadedBytes >= nextProgress || downloadedBytes === totalBytes) {
          console.log(
            JSON.stringify({
              phase: 'download',
              downloadedBytes,
              totalBytes,
              elapsedSeconds: (Date.now() - started) / 1000,
              rssBytes: process.memoryUsage().rss,
              peakRssBytes: process.resourceUsage().maxRSS * 1024,
            }),
          );
          nextProgress += 256 * 1024 ** 2;
        }
      }
      downloadedHash = receivedHash.digest('hex');
      assert.equal(downloadedBytes, totalBytes);
      assert.equal(downloadedHash, expectedHash);
      const deleted = await fetch(`${origin}/api/files/${fileId}`, {
        signal: t.signal,
        method: 'DELETE',
        headers,
      });
      assert.equal(deleted.status, 204);
      await deleted.text();
      assert.equal(app.storage.usage().usedBytes, 0);
      assert.equal(app.storage.usage().reservedBytes, 0);
      await assert.rejects(stat(path.join(app.storage.filesDir, fileId)), {
        code: 'ENOENT',
      });
      completed = true;
    } finally {
      if (app) await app.close();
      await rm(dir, { recursive: true, force: true });
      await assert.rejects(stat(dir), { code: 'ENOENT' });
      const fsAfter = await statfs(temp);
      const evidence = {
        kind: 'Actual local service/tus/SQLite/filesystem; SYNTHETIC signed identity and generated bytes; no WAN/Google/Android/ZIP/MP4 proof',
        completed,
        totalBytes,
        chunkBytes,
        uploadedBytes,
        downloadedBytes,
        restartOffset,
        expectedHash,
        downloadedHash,
        freeBefore,
        freeAfterCleanup: fsAfter.bavail * fsAfter.bsize,
        elapsedSeconds: (Date.now() - started) / 1000,
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        tempRemoved: true,
      };
      await writeFile(
        `${artifacts}/evidence.json`,
        JSON.stringify(evidence, null, 2),
      );
      console.log(JSON.stringify({ phase: 'complete', ...evidence }));
    }
  },
);
