import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY } from '../src/storage.js';

test('concurrent HTTP reservations, strict protocol validation and zero-byte completion', async () => {
  const f = await fixture(10);
  try {
    const attempts = await Promise.all(
      Array.from({ length: 3 }, () =>
        f.request('/api/uploads', {
          method: 'POST',
          headers: {
            ...f.headers,
            'upload-length': '6',
            'upload-metadata': 'filename eA==',
          },
        }),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === 201).length, 1);
    assert.equal(attempts.filter((r) => r.status === 507).length, 2);
    const location = attempts
      .find((r) => r.status === 201)!
      .headers.get('location')!;
    assert.equal(
      (
        await f.request(
          '/api/files/' + location.split('/').at(-1) + '/download',
          { headers: f.headers },
        )
      ).status,
      404,
    );
    for (const headers of [
      { 'upload-length': '1e2' },
      { 'upload-length': '-1' },
      { 'upload-length': '9007199254740992' },
      { 'upload-defer-length': '1' },
      { 'upload-concat': 'partial' },
      { 'upload-length': '1', 'upload-metadata': 'filename Li4vZXZpbA==' },
    ] as Record<string, string>[]) {
      const response = await f.request('/api/uploads', {
        method: 'POST',
        headers: { ...f.headers, ...headers },
      });
      assert.equal(response.status, 400, await response.text());
    }
    const zero = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '0',
        'upload-metadata': 'filename ZW1wdHk=',
      },
    });
    assert.equal(zero.status, 201);
    const listing = await (
      await f.request('/api/files', { headers: f.headers })
    ).json();
    assert.equal(listing.files.length, 1);
    assert.equal(listing.files[0].size, 0);
    assert.equal(listing.reservedBytes, 6);
  } finally {
    await f.close();
  }
});
test('partial offsets and sessions survive restart; inactivity and completed retention reject access before cleanup', async () => {
  const f = await fixture();
  try {
    const create = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '6',
        'upload-metadata': 'filename cGFydGlhbA==',
      },
    });
    assert.equal(create.status, 201);
    const location = create.headers.get('location')!;
    assert.equal(
      (
        await f.request(location, {
          method: 'PATCH',
          headers: {
            ...f.headers,
            'content-type': 'application/offset+octet-stream',
            'upload-offset': '0',
          },
          body: 'abc',
        })
      ).status,
      204,
    );
    await f.restart();
    const head = await f.request(location, {
      method: 'HEAD',
      headers: f.headers,
    });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('upload-offset'), '3');
    assert.equal(
      (
        await f.request(location, {
          method: 'PATCH',
          headers: {
            ...f.headers,
            'content-type': 'application/offset+octet-stream',
            'upload-offset': '0',
          },
          body: 'x',
        })
      ).status,
      409,
    );
    f.setNow(f.now() + DAY - 1000);
    assert.equal(
      (
        await f.request(location, {
          method: 'PATCH',
          headers: {
            ...f.headers,
            'content-type': 'application/offset+octet-stream',
            'upload-offset': '3',
          },
          body: 'def',
        })
      ).status,
      204,
    );
    const id = location.split('/').at(-1)!;
    assert.equal(
      await (
        await f.request('/api/files/' + id + '/download', {
          headers: f.headers,
        })
      ).text(),
      'abcdef',
    );
    const row = f.app.storage.get(id)!;
    assert.equal(row.expiresAt, row.uploadedAt! + 30 * DAY);
    const partial = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '5',
        'upload-metadata': 'filename eA==',
      },
    });
    const partialLocation = partial.headers.get('location')!;
    f.setNow(f.now() + DAY);
    assert.equal(
      (await f.request(partialLocation, { method: 'HEAD', headers: f.headers }))
        .status,
      410,
    );
    await f.app.cleanup();
    assert.equal(
      f.app.storage.get(partialLocation.split('/').at(-1)!),
      undefined,
    );
    // Keep the synthetic session alive to isolate file-retention enforcement.
    f.app.storage.db
      .prepare('UPDATE sessions SET expiresAt=?')
      .run(row.expiresAt + DAY);
    f.setNow(row.expiresAt);
    assert.equal(
      (
        await f.request('/api/files/' + id + '/download', {
          headers: f.headers,
        })
      ).status,
      410,
    );
    assert.equal(
      (await (await f.request('/api/files', { headers: f.headers })).json())
        .files.length,
      0,
    );
    await f.restart();
    assert.equal(f.app.storage.usage().usedBytes, 0);
    await assert.rejects(access(path.join(f.app.storage.filesDir, id)));
  } finally {
    await f.close();
  }
});
test('startup removes untracked objects and recovers a completed interrupted write conservatively', async () => {
  const f = await fixture();
  try {
    const create = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '3',
        'upload-metadata': 'filename eA==',
      },
    });
    const id = create.headers.get('location')!.split('/').at(-1)!;
    await writeFile(path.join(f.app.storage.filesDir, id), 'abc');
    await writeFile(
      path.join(f.app.storage.filesDir, 'untracked'),
      'not a user file',
    );
    await f.restart();
    assert.equal(f.app.storage.usage().usedBytes, 3);
    assert.equal(f.app.storage.usage().reservedBytes, 0);
    await assert.rejects(
      access(path.join(f.app.storage.filesDir, 'untracked')),
    );
    assert.equal(
      await (
        await f.request('/api/files/' + id + '/download', {
          headers: f.headers,
        })
      ).text(),
      'abc',
    );
  } finally {
    await f.close();
  }
});
