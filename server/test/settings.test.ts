import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY } from '../src/storage.js';

type Fixture = Awaited<ReturnType<typeof fixture>>;
const save = (f: Fixture, retentionDays: number, confirmDeletes?: number) =>
  f.request('/api/settings', {
    method: 'PUT',
    headers: { ...f.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ retentionDays, confirmDeletes }),
  });
const listing = async (f: Fixture) =>
  (await f.request('/api/files', { headers: f.headers })).json();

test('default policy survives restart and saving updates existing and new completions from their original time', async () => {
  const f = await fixture();
  try {
    assert.equal((await listing(f)).retentionDays, 30);
    const existing = await upload(f, 'old');
    const original = f.app.storage.get(existing)!;
    await f.restart();
    assert.equal((await listing(f)).retentionDays, 30);
    f.setNow(f.now() + DAY);
    assert.equal((await save(f, 60)).status, 200);
    assert.equal(f.app.storage.get(existing)!.uploadedAt, original.uploadedAt);
    assert.equal(
      f.app.storage.get(existing)!.expiresAt,
      original.uploadedAt! + 60 * DAY,
    );
    await f.restart();
    assert.equal((await listing(f)).retentionDays, 60);
    const fresh = await upload(f, 'new');
    const row = f.app.storage.get(fresh)!;
    assert.equal(row.expiresAt, row.uploadedAt! + 60 * DAY);
  } finally {
    await f.close();
  }
});

test('shortening counts only live completed copies and commits only within the confirmed count at the exact boundary', async () => {
  const f = await fixture();
  try {
    const old = await upload(f, 'old');
    const boundary = await upload(f, 'boundary');
    const next = await upload(f, 'next');
    const expired = await upload(f, 'expired');
    const partialResponse = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '2',
        'upload-metadata': 'filename cGFydGlhbA==',
      },
    });
    const partial = partialResponse.headers.get('location')!.split('/').at(-1)!;
    const storage = f.app.storage;
    const setAge = storage.db.prepare(
      'UPDATE files SET uploadedAt=? WHERE id=?',
    );
    setAge.run(f.now() - 8 * DAY, old);
    setAge.run(f.now() - 7 * DAY, boundary);
    setAge.run(f.now() - 7 * DAY + 1, next);
    storage.db
      .prepare('UPDATE files SET uploadedAt=?,expiresAt=? WHERE id=?')
      .run(f.now() - 40 * DAY, f.now(), expired);
    const before = storage.rows();
    let response = await save(f, 7);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).deleteCount, 2);
    assert.deepEqual(
      storage.rows(),
      before,
      'conflict must change no deadlines or partials',
    );
    assert.equal((await listing(f)).retentionDays, 30);
    // One more copy crosses the exact <= boundary while the owner is reading the popup.
    f.setNow(f.now() + 1);
    response = await save(f, 7, 2);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).deleteCount, 3);
    assert.deepEqual(storage.rows(), before);
    assert.equal((await listing(f)).retentionDays, 30);
    assert.equal((await save(f, 7, 3)).status, 200);
    assert.equal((await listing(f)).retentionDays, 7);
    for (const id of [old, boundary, next]) {
      const row = storage.get(id)!;
      assert.equal(row.expiresAt, row.uploadedAt! + 7 * DAY);
      assert.equal(
        (await f.request(`/api/files/${id}/download`, { headers: f.headers }))
          .status,
        410,
      );
    }
    assert.deepEqual(
      storage.get(partial),
      before.find((r) => r.id === partial),
    );
    assert.deepEqual(
      storage.get(expired),
      before.find((r) => r.id === expired),
    );
    assert.equal((await listing(f)).files.length, 0);
    await f.app.cleanup();
    assert.equal(storage.get(old), undefined);
    assert.equal(storage.get(boundary), undefined);
    assert.equal(storage.get(next), undefined);
    assert.equal(storage.get(expired), undefined);
    assert.ok(storage.get(partial));
    f.setNow(storage.get(partial)!.expiresAt);
    assert.equal(
      (
        await f.request(`/api/uploads/${partial}`, {
          method: 'HEAD',
          headers: f.headers,
        })
      ).status,
      410,
    );
  } finally {
    await f.close();
  }
});

test('a smaller current deletion count is allowed and lengthening never revives expired copies', async () => {
  const f = await fixture();
  try {
    const live = await upload(f, 'live');
    const old = await upload(f, 'old');
    const expired = await upload(f, 'expired');
    f.app.storage.db
      .prepare('UPDATE files SET uploadedAt=? WHERE id=?')
      .run(f.now() - 8 * DAY, old);
    f.app.storage.db
      .prepare('UPDATE files SET expiresAt=? WHERE id=?')
      .run(f.now(), expired);
    assert.equal((await save(f, 7)).status, 409);
    assert.equal(
      (
        await f.request(`/api/files/${old}`, {
          method: 'DELETE',
          headers: f.headers,
        })
      ).status,
      204,
    );
    assert.equal((await save(f, 7, 1)).status, 200);
    const expiredBefore = f.app.storage.get(expired);
    assert.equal((await save(f, 90)).status, 200);
    assert.deepEqual(f.app.storage.get(expired), expiredBefore);
    assert.equal(
      f.app.storage.get(live)!.expiresAt,
      f.app.storage.get(live)!.uploadedAt! + 90 * DAY,
    );
    assert.equal(
      (
        await f.request(`/api/files/${expired}/download`, {
          headers: f.headers,
        })
      ).status,
      410,
    );
  } finally {
    await f.close();
  }
});

test('zero-byte and crash-recovered completions use the persisted policy without rewriting saved deadlines on startup', async () => {
  const f = await fixture();
  try {
    assert.equal((await save(f, 14)).status, 200);
    const zero = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '0',
        'upload-metadata': 'filename ZW1wdHk=',
      },
    });
    assert.equal(zero.status, 201);
    const zeroId = zero.headers.get('location')!.split('/').at(-1)!;
    const zeroRow = f.app.storage.get(zeroId)!;
    assert.equal(zeroRow.expiresAt, zeroRow.uploadedAt! + 14 * DAY);
    const create = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '3',
        'upload-metadata': 'filename cmVjb3Zlcg==',
      },
    });
    const recoveredId = create.headers.get('location')!.split('/').at(-1)!;
    await writeFile(path.join(f.app.storage.filesDir, recoveredId), 'abc');
    const { utimes } = await import('node:fs/promises');
    const completedAt = f.now() - 1000;
    await utimes(
      path.join(f.app.storage.filesDir, recoveredId),
      completedAt / 1000,
      completedAt / 1000,
    );
    // A saved deadline from a previous version must survive startup unchanged, even if it differs from policy.
    f.app.storage.db
      .prepare('UPDATE files SET expiresAt=? WHERE id=?')
      .run(zeroRow.uploadedAt! + 30 * DAY, zeroId);
    await f.restart();
    assert.equal((await listing(f)).retentionDays, 14);
    const recovered = f.app.storage.get(recoveredId)!;
    assert.ok(Math.abs(recovered.uploadedAt! - completedAt) < 1);
    assert.equal(recovered.expiresAt, recovered.uploadedAt! + 14 * DAY);
    assert.equal(
      f.app.storage.get(zeroId)!.expiresAt,
      zeroRow.uploadedAt! + 30 * DAY,
    );
    await f.restart();
    assert.deepEqual(f.app.storage.get(recoveredId), recovered);
    assert.equal(
      f.app.storage.get(zeroId)!.expiresAt,
      zeroRow.uploadedAt! + 30 * DAY,
    );
  } finally {
    await f.close();
  }
});

test('a failed settings transaction rolls back every deadline and leaves future completion policy committed', async () => {
  const f = await fixture();
  try {
    const old = await upload(f, 'old');
    const before = f.app.storage.rows();
    f.app.storage.db.exec(
      "CREATE TRIGGER reject_policy BEFORE UPDATE ON settings BEGIN SELECT RAISE(ABORT,'synthetic settings failure'); END;",
    );
    assert.equal((await save(f, 60)).status, 500);
    assert.deepEqual(f.app.storage.rows(), before);
    assert.equal((await listing(f)).retentionDays, 30);
    const fresh = await upload(f, 'fresh');
    const row = f.app.storage.get(fresh)!;
    assert.equal(row.expiresAt, row.uploadedAt! + 30 * DAY);
    assert.deepEqual(f.app.storage.get(old), before[0]);
    f.app.storage.db.exec('DROP TRIGGER reject_policy');
    assert.equal((await save(f, 60)).status, 200);
  } finally {
    await f.close();
  }
});

test('settings mutation rejects unauthenticated, cross-origin, missing CSRF and malformed requests without mutation', async () => {
  const f = await fixture();
  try {
    const id = await upload(f, 'file');
    const before = f.app.storage.get(id);
    for (const [headers, expected] of [
      [{}, 401],
      [{ ...f.headers, origin: 'https://foreign.invalid' }, 403],
      [{ ...f.headers, 'sec-fetch-site': 'cross-site' }, 403],
      [{ cookie: f.headers.cookie, origin: f.headers.origin }, 403],
      [{ ...f.headers, 'x-csrf-token': 'wrong' }, 403],
      [
        { cookie: f.headers.cookie, 'x-csrf-token': f.headers['x-csrf-token'] },
        403,
      ],
    ] as [Record<string, string>, number][]) {
      assert.equal(
        (
          await f.request('/api/settings', {
            method: 'PUT',
            headers,
            body: '{"retentionDays":60}',
          })
        ).status,
        expected,
      );
    }
    for (const value of [
      null,
      [],
      60,
      {},
      { retentionDays: '60' },
      { retentionDays: 0 },
      { retentionDays: -1 },
      { retentionDays: 2 },
      { retentionDays: 7.5 },
      { retentionDays: 9007199254740992 },
      ...[null, -1, 1.5, '1', true, 9007199254740992].map((confirmDeletes) => ({
        retentionDays: 60,
        confirmDeletes,
      })),
    ]) {
      assert.equal(
        (
          await f.request('/api/settings', {
            method: 'PUT',
            headers: f.headers,
            body: JSON.stringify(value),
          })
        ).status,
        400,
        JSON.stringify(value),
      );
    }
    assert.equal(
      (
        await f.request('/api/settings', {
          method: 'PUT',
          headers: f.headers,
          body: '{',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request('/api/settings', {
          method: 'PUT',
          headers: f.headers,
          body: ' '.repeat(1025),
        })
      ).status,
      413,
    );
    assert.deepEqual(f.app.storage.get(id), before);
    assert.equal((await listing(f)).retentionDays, 30);
    assert.equal((await save(f, 60, Number.MAX_SAFE_INTEGER)).status, 200);
  } finally {
    await f.close();
  }
});

test('cleanup overlapping the real settings save extends live copies without reviving the copy selected for unlink', async (t) => {
  const { Transfers } = await import('../src/transfers.js');
  const f = await fixture();
  try {
    const expired = await upload(f, 'expired');
    const live = await upload(f, 'live');
    const partialResponse = await f.request('/api/uploads', {
      method: 'POST',
      headers: {
        ...f.headers,
        'upload-length': '2',
        'upload-metadata': 'filename cGFydGlhbA==',
      },
    });
    const partial = partialResponse.headers.get('location')!.split('/').at(-1)!;
    const partialBefore = f.app.storage.get(partial);
    f.app.storage.db
      .prepare('UPDATE files SET expiresAt=? WHERE id=?')
      .run(f.now(), expired);
    const remove = Transfers.prototype.remove;
    let overlapped = false;
    t.mock.method(
      Transfers.prototype,
      'remove',
      async function (this: InstanceType<typeof Transfers>, id: string) {
        if (id === expired) {
          overlapped = true;
          // Cleanup already checked this expired copy under its file lock; save while deletion is pending.
          const response = await save(f, 60);
          assert.equal(response.status, 200);
          assert.equal(f.app.storage.get(expired)!.expiresAt, f.now());
        }
        await remove.call(this, id);
      },
    );
    await f.app.cleanup();
    assert.equal(overlapped, true);
    assert.equal(f.app.storage.get(expired), undefined);
    assert.equal(
      f.app.storage.get(live)!.expiresAt,
      f.app.storage.get(live)!.uploadedAt! + 60 * DAY,
    );
    assert.deepEqual(f.app.storage.get(partial), partialBefore);
  } finally {
    t.mock.restoreAll();
    await f.close();
  }
});
