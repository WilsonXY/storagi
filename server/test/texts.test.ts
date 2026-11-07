import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.js';
import { DAY } from '../src/storage.js';

const post = (f: Awaited<ReturnType<typeof fixture>>, text: unknown) =>
  f.request('/api/texts', {
    method: 'POST',
    headers: { ...f.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
const list = async (f: Awaited<ReturnType<typeof fixture>>) => {
  const response = await f.request('/api/texts', { headers: f.headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return (await response.json()).texts;
};

// Keep the synthetic test session valid when isolating retention beyond its normal seven days.
const advanceShelfClock = (
  f: Awaited<ReturnType<typeof fixture>>,
  at: number,
) => {
  f.app.storage.db.prepare('UPDATE sessions SET expiresAt=?').run(at + DAY);
  f.setNow(at);
};

test('texts preserve exact Unicode/whitespace, are newest first and survive restart without affecting file quota', async () => {
  const f = await fixture(0);
  try {
    const text = '  https://example.com/path?a=1&b=2\n雪🙂\t\n';
    const response = await post(f, text);
    assert.equal(response.status, 201);
    const first = await response.json();
    assert.match(first.id, /^[a-f0-9-]{36}$/);
    assert.equal(first.text, text);
    assert.equal(first.createdAt, new Date(f.now()).toISOString());
    assert.equal(first.expiresAt, new Date(f.now() + 30 * DAY).toISOString());
    f.setNow(f.now() + 1000);
    const second = await (await post(f, 'second')).json();
    assert.deepEqual(
      (await list(f)).map((row: { id: string }) => row.id),
      [second.id, first.id],
    );
    assert.deepEqual(f.app.storage.usage(), {
      usedBytes: 0,
      reservedBytes: 0,
      budgetBytes: 0,
    });
    await f.restart();
    assert.deepEqual(
      (await list(f)).map((row: { text: string }) => row.text),
      ['second', text],
    );
    const deleted = await f.request('/api/texts/' + first.id, {
      method: 'DELETE',
      headers: f.headers,
    });
    assert.equal(deleted.status, 204);
    assert.equal((await list(f)).length, 1);
    assert.equal(
      (
        await f.request('/api/texts/' + first.id, {
          method: 'DELETE',
          headers: f.headers,
        })
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});

test('every text operation requires owner auth and mutations require same-origin CSRF', async () => {
  const f = await fixture();
  try {
    const session = await (
      await f.request('/api/session', { headers: f.headers })
    ).json();
    assert.equal(session.authenticated, true);
    assert.equal(session.csrfToken, f.headers['x-csrf-token']);
    for (const route of [
      '/api/texts',
      '/api/texts/00000000-0000-4000-8000-000000000000',
    ]) {
      for (const method of [
        'GET',
        'POST',
        'DELETE',
        'PUT',
        'HEAD',
        'OPTIONS',
      ]) {
        assert.equal(
          (await f.request(route, { method })).status,
          401,
          method + ' ' + route,
        );
      }
    }
    for (const headers of [
      { cookie: f.headers.cookie, origin: f.headers.origin },
      { ...f.headers, origin: 'https://evil.example' },
      { ...f.headers, 'sec-fetch-site': 'cross-site' },
    ]) {
      assert.equal(
        (
          await f.request('/api/texts', {
            method: 'POST',
            headers,
            body: '{"text":"private"}',
          })
        ).status,
        403,
      );
    }
    const first = await (await post(f, 'private')).json();
    assert.equal(
      (
        await f.request('/api/texts/' + first.id, {
          method: 'DELETE',
          headers: { cookie: f.headers.cookie },
        })
      ).status,
      403,
    );
    assert.equal((await list(f)).length, 1);
    assert.equal(
      (await f.request('/api/texts', { method: 'PUT', headers: f.headers }))
        .status,
      405,
    );
    assert.equal(
      (await f.request('/api/texts/' + first.id, { headers: f.headers }))
        .status,
      405,
    );
    assert.equal(
      (
        await f.request('/api/texts/not-an-id', {
          method: 'DELETE',
          headers: f.headers,
        })
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});

test('text validation bounds UTF-8 and JSON bodies and rejects malformed/type/empty input', async () => {
  const f = await fixture();
  try {
    for (const text of ['', ' \n\t', '\ud800', null, 123, {}, [], true]) {
      const response = await post(f, text);
      assert.equal(response.status, 400, JSON.stringify(text));
      assert.ok((await response.json()).error);
    }
    for (const body of [
      '{',
      'null',
      '[]',
      '{}',
      '"private"',
      Buffer.from([123, 34, 116, 101, 120, 116, 34, 58, 34, 255, 34, 125]),
    ]) {
      assert.equal(
        (
          await f.request('/api/texts', {
            method: 'POST',
            headers: { ...f.headers, 'content-type': 'application/json' },
            body,
          })
        ).status,
        400,
        String(body),
      );
    }
    assert.equal(
      (
        await f.request('/api/texts', {
          method: 'POST',
          headers: f.headers,
          body: '{"text":"hello"}',
        })
      ).status,
      415,
    );
    assert.equal((await post(f, 'x'.repeat(65536))).status, 201);
    assert.equal((await post(f, 'x'.repeat(65537))).status, 413);
    assert.equal((await post(f, '🙂'.repeat(16384))).status, 201);
    assert.equal((await post(f, '🙂'.repeat(16385))).status, 413);
    // JSON escaping can use six body bytes per one text byte; valid text still fits.
    assert.equal((await post(f, '\u0000'.repeat(65536))).status, 201);
    assert.equal(
      (
        await f.request('/api/texts', {
          method: 'POST',
          headers: { ...f.headers, 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'x', padding: 'x'.repeat(512 * 1024) }),
        })
      ).status,
      413,
    );
    const chunks = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 10; i++)
          controller.enqueue(new TextEncoder().encode('x'.repeat(65536)));
        controller.close();
      },
    });
    const response = await f.request('/api/texts', {
      method: 'POST',
      headers: { ...f.headers, 'content-type': 'application/json' },
      body: chunks,
      duplex: 'half',
    } as RequestInit);
    assert.equal(response.status, 413);
  } finally {
    await f.close();
  }
});

test('expiry hides text immediately, cleanup removes rows, expired slots can be reused and startup prunes', async () => {
  const f = await fixture();
  try {
    const first = await (await post(f, 'expires')).json();
    const deadline = f.now() + 30 * DAY;
    f.setNow(f.now() + DAY);
    assert.equal(
      (await list(f)).length,
      1,
      'Text survives its former 24-hour cutoff',
    );
    advanceShelfClock(f, deadline - 1);
    await f.app.cleanup();
    assert.equal(
      (await list(f)).length,
      1,
      'Text remains live one millisecond before shared expiry',
    );
    advanceShelfClock(f, deadline);
    assert.deepEqual(await list(f), []);
    assert.equal(
      (
        await f.request('/api/texts/' + first.id, {
          method: 'DELETE',
          headers: f.headers,
        })
      ).status,
      410,
    );
    await f.app.cleanup();
    assert.equal(
      (
        f.app.storage.db.prepare('SELECT COUNT(*) count FROM texts').get() as {
          count: number;
        }
      ).count,
      0,
    );
    await post(f, 'startup expiry');
    advanceShelfClock(f, f.now() + 30 * DAY);
    await f.restart();
    assert.equal(
      (
        f.app.storage.db.prepare('SELECT COUNT(*) count FROM texts').get() as {
          count: number;
        }
      ).count,
      0,
    );
    for (let i = 0; i < 100; i++)
      assert.equal((await post(f, String(i))).status, 201);
    assert.equal((await post(f, 'over cap')).status, 409);
    assert.equal((await list(f)).length, 100);
    assert.equal((await list(f))[0].text, '99');
    advanceShelfClock(f, f.now() + 30 * DAY);
    assert.equal((await post(f, 'new day')).status, 201);
    assert.equal((await list(f)).length, 1);
    assert.equal(
      (
        f.app.storage.db.prepare('SELECT COUNT(*) count FROM texts').get() as {
          count: number;
        }
      ).count,
      1,
    );
  } finally {
    await f.close();
  }
});

test('file listing exposes only live text count and unchanged text polls return authenticated 304', async () => {
  const f = await fixture();
  try {
    const first = await (await post(f, 'one')).json();
    const files = await (
      await f.request('/api/files', { headers: f.headers })
    ).json();
    assert.equal(files.textCount, 1);
    assert.equal('texts' in files, false);
    const initial = await f.request('/api/texts', { headers: f.headers });
    const etag = initial.headers.get('etag')!;
    assert.ok(etag);
    await initial.arrayBuffer();
    const same = await f.request('/api/texts', {
      headers: { ...f.headers, 'if-none-match': etag },
    });
    assert.equal(same.status, 304);
    assert.equal(await same.text(), '');
    assert.equal(
      (await f.request('/api/texts', { headers: { 'if-none-match': etag } }))
        .status,
      401,
    );
    await post(f, 'two');
    const changed = await f.request('/api/texts', {
      headers: { ...f.headers, 'if-none-match': etag },
    });
    assert.equal(changed.status, 200);
    const next = changed.headers.get('etag')!;
    assert.notEqual(next, etag);
    await changed.arrayBuffer();
    await f.request('/api/texts/' + first.id, {
      method: 'DELETE',
      headers: f.headers,
    });
    assert.equal(
      (
        await f.request('/api/texts', {
          headers: { ...f.headers, 'if-none-match': next },
        })
      ).status,
      200,
    );
    advanceShelfClock(f, f.now() + 30 * DAY);
    assert.equal(
      (await (await f.request('/api/files', { headers: f.headers })).json())
        .textCount,
      0,
    );
  } finally {
    await f.close();
  }
});

test('stored Text deadlines remain authoritative across restart and expired legacy content is never revived', async () => {
  const f = await fixture();
  try {
    const first = await (await post(f, 'legacy deadline')).json();
    const legacyDeadline = f.now() + DAY;
    f.app.storage.db
      .prepare('UPDATE texts SET expiresAt=? WHERE id=?')
      .run(legacyDeadline, first.id);
    await f.restart();
    assert.equal(
      (await list(f))[0].expiresAt,
      new Date(legacyDeadline).toISOString(),
    );
    f.setNow(legacyDeadline - 1);
    assert.equal((await list(f)).length, 1);
    f.setNow(legacyDeadline);
    await f.restart();
    assert.deepEqual(await list(f), []);
    assert.equal(
      (
        f.app.storage.db.prepare('SELECT COUNT(*) count FROM texts').get() as {
          count: number;
        }
      ).count,
      0,
    );
  } finally {
    await f.close();
  }
});
