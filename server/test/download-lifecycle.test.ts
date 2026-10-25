import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';

async function promptly<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Operation blocked by paused download')),
          1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

for (const retirement of ['delete', 'expiry'])
  test(`paused download permits ranges, ${retirement} and independent expiry while retaining bytes and quota until close`, async () => {
    const data = '0123456789abcdef'.repeat(512 * 1024),
      f = await fixture(Buffer.byteLength(data) + 10);
    let request: http.ClientRequest | undefined,
      paused: http.IncomingMessage | undefined;
    try {
      const id = await upload(f, data),
        other = await upload(f, 'expired'),
        download = '/api/files/' + id + '/download';
      paused = await new Promise<http.IncomingMessage>((resolve, reject) => {
        request = http.get(
          f.config.origin + download,
          { headers: f.headers },
          (res) => {
            res.pause();
            resolve(res);
          },
        );
        request.once('error', reject);
      });
      await delay(50);
      assert.equal(
        paused.complete,
        false,
        'body exceeds local socket buffers, so server cannot finish while client is paused',
      );
      const range = await promptly(
        f.request(download, {
          headers: { ...f.headers, range: 'bytes=1-4' },
          signal: AbortSignal.timeout(1000),
        }),
      );
      assert.equal(range.status, 206);
      assert.equal(await range.text(), '1234');
      if (retirement === 'delete')
        assert.equal(
          (
            await promptly(
              f.request('/api/files/' + id, {
                method: 'DELETE',
                headers: f.headers,
              }),
            )
          ).status,
          204,
        );
      else
        f.app.storage.db
          .prepare('UPDATE files SET expiresAt=? WHERE id=?')
          .run(f.now(), id);
      f.app.storage.db
        .prepare('UPDATE files SET expiresAt=? WHERE id=?')
        .run(f.now(), other);
      await promptly(f.app.cleanup());
      assert.equal(f.app.storage.get(id), undefined);
      assert.equal(f.app.storage.get(other), undefined);
      await assert.rejects(access(path.join(f.app.storage.filesDir, id)));
      await assert.rejects(access(path.join(f.app.storage.filesDir, other)));
      assert.equal(
        (await f.request(download, { headers: f.headers })).status,
        404,
      );
      assert.equal(
        f.app.storage.usage().usedBytes,
        Buffer.byteLength(data),
        'unlinked open inode still consumes application budget',
      );
      const rejected = await f.request('/api/uploads', {
        method: 'POST',
        headers: {
          ...f.headers,
          'upload-length': '11',
          'upload-metadata': 'filename bmV3',
        },
      });
      assert.equal(rejected.status, 507);
      const hash = createHash('sha256');
      await new Promise<void>((resolve, reject) => {
        paused!.on('data', (chunk) => hash.update(chunk));
        paused!.once('end', resolve);
        paused!.once('error', reject);
        paused!.resume();
      });
      assert.equal(
        hash.digest('hex'),
        createHash('sha256').update(data).digest('hex'),
        'active descriptor remains readable after unlink',
      );
      for (let i = 0; i < 100 && f.app.storage.usage().usedBytes; i++)
        await delay(10);
      assert.equal(f.app.storage.usage().usedBytes, 0);
      assert.ok(await upload(f, 'new upload'));
    } finally {
      paused?.destroy();
      request?.destroy();
      await f.close();
    }
  });

test('download socket idle timeout closes its descriptor and releases retired quota', async () => {
  const data = 'x'.repeat(8 * 1024 ** 2),
    f = await fixture(data.length);
  let request: http.ClientRequest | undefined,
    paused: http.IncomingMessage | undefined,
    configured = 0;
  try {
    const id = await upload(f, data);
    f.app.server.on('request', (req, res) => {
      if (!req.url?.endsWith('/download')) return;
      const setTimeout = res.setTimeout;
      res.setTimeout = function (msec, callback) {
        configured = msec;
        return setTimeout.call(this, 100, callback);
      };
    });
    paused = await new Promise<http.IncomingMessage>((resolve, reject) => {
      request = http.get(
        f.config.origin + '/api/files/' + id + '/download',
        { headers: f.headers },
        (res) => {
          res.pause();
          res.on('error', () => {});
          resolve(res);
        },
      );
      request.once('error', reject);
    });
    assert.equal(
      configured,
      30000,
      'production download idle deadline is 30s; test accelerates only the socket timer',
    );
    assert.equal(
      (
        await f.request('/api/files/' + id, {
          method: 'DELETE',
          headers: f.headers,
        })
      ).status,
      204,
    );
    assert.equal(f.app.storage.usage().usedBytes, data.length);
    for (let i = 0; i < 100 && f.app.storage.usage().usedBytes; i++)
      await delay(10);
    assert.equal(
      f.app.storage.usage().usedBytes,
      0,
      'idle disconnect finally closes the unlinked descriptor',
    );
  } finally {
    paused?.destroy();
    request?.destroy();
    await f.close();
  }
});
