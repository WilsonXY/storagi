import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
test('tus uploads preserve duplicate names, stream exact protected bytes and ranges, delete without quota leaks', async () => {
  const f = await fixture();
  try {
    const id = await upload(f, '0123456789');
    const id2 = await upload(f, 'different');
    assert.notEqual(id, id2);
    const listing = await (
      await f.request('/api/files?q=SAME', { headers: f.headers })
    ).json();
    assert.equal(listing.files.length, 2);
    assert.equal(listing.usedBytes, 19);
    assert.equal(listing.reservedBytes, 0);
    assert.equal(listing.files[0].name, 'same.zip');
    assert.ok(listing.files[0].uploadedAt.endsWith('Z'));
    assert.ok(listing.files[0].expiresAt.endsWith('Z'));
    assert.equal(
      (
        await (
          await f.request('/api/files?q=missing', { headers: f.headers })
        ).json()
      ).files.length,
      0,
    );
    const download = '/api/files/' + id + '/download';
    assert.equal((await f.request(download)).status, 401);
    const full = await f.request(download, { headers: f.headers });
    assert.equal(full.headers.get('content-type'), 'application/octet-stream');
    assert.match(full.headers.get('content-disposition')!, /^attachment/);
    assert.equal(await full.text(), '0123456789');
    const range = await f.request(download, {
      headers: { ...f.headers, range: 'bytes=2-5' },
    });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await range.text(), '2345');
    const suffix = await f.request(download, {
      headers: { ...f.headers, range: 'bytes=-3' },
    });
    assert.equal(await suffix.text(), '789');
    assert.equal(
      (
        await f.request(download, {
          headers: { ...f.headers, range: 'bytes=100-200' },
        })
      ).status,
      416,
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
    assert.equal(
      (await f.request(download, { headers: f.headers })).status,
      404,
    );
    assert.equal(
      (
        await f.request('/api/uploads/' + id2, {
          method: 'DELETE',
          headers: f.headers,
        })
      ).status,
      204,
    );
    assert.equal(
      (await (await f.request('/api/files', { headers: f.headers })).json())
        .usedBytes,
      0,
    );
  } finally {
    await f.close();
  }
});

test('filenames reject bidi override and isolate controls while retaining ordinary Unicode', async () => {
  const f = await fixture();
  try {
    for (const character of [
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
      const created = await f.request('/api/uploads', {
        method: 'POST',
        headers: {
          ...f.headers,
          'upload-length': '1',
          'upload-metadata':
            'filename ' +
            Buffer.from('photo' + character + 'gpj.exe').toString('base64'),
        },
      });
      assert.equal(
        created.status,
        400,
        'reject U+' + character.codePointAt(0)!.toString(16),
      );
    }
    const id = await upload(f, 'ok', '日本語 café 📦.zip');
    assert.equal(f.app.storage.get(id)?.name, '日本語 café 📦.zip');
  } finally {
    await f.close();
  }
});

test('immutable download validators support If-Range matches and return full content on mismatch', async () => {
  const f = await fixture();
  try {
    const id = await upload(f, '0123456789'),
      url = '/api/files/' + id + '/download';
    const full = await f.request(url, { headers: f.headers }),
      etag = full.headers.get('etag'),
      modified = full.headers.get('last-modified');
    await full.arrayBuffer();
    assert.match(etag || '', /^"[^\"]+"$/);
    assert.ok(Number.isFinite(Date.parse(modified || '')));
    await f.restart();
    const head = await f.request(url, { method: 'HEAD', headers: f.headers });
    assert.equal(head.headers.get('etag'), etag);
    assert.equal(head.headers.get('last-modified'), modified);
    for (const validator of [etag!, modified!]) {
      const range = await f.request(url, {
        headers: { ...f.headers, range: 'bytes=2-5', 'if-range': validator },
      });
      assert.equal(range.status, 206);
      assert.equal(await range.text(), '2345');
    }
    for (const validator of [
      '"different"',
      'W/' + etag,
      'Mon, 01 Jan 1990 00:00:00 GMT',
      'invalid',
    ]) {
      const response = await f.request(url, {
        headers: { ...f.headers, range: 'bytes=2-5', 'if-range': validator },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-range'), null);
      assert.equal(await response.text(), '0123456789');
    }
  } finally {
    await f.close();
  }
});
