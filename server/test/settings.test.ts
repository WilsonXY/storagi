import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY, type TextRow } from '../src/storage.js';

type Fixture = Awaited<ReturnType<typeof fixture>>;
const save = (f: Fixture, retentionDays: number, confirmDeletes?: number) =>
  f.request('/api/settings', {
    method: 'PUT',
    headers: { ...f.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ retentionDays, confirmDeletes }),
  });
const listing = async (f: Fixture) =>
  (await f.request('/api/files', { headers: f.headers })).json();

const postText = async (f: Fixture, text: string) => {
  const response = await f.request('/api/texts', {
    method: 'POST',
    headers: { ...f.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  assert.equal(response.status, 201);
  return response.json();
};
const textRows = (f: Fixture) =>
  f.app.storage.db
    .prepare('SELECT * FROM texts ORDER BY rowid')
    .all() as TextRow[];

test('new Text and file completions use the persisted setting and authenticated metadata after restart', async () => {
  const f = await fixture();
  try {
    assert.equal((await save(f, 14)).status, 200);
    const first = await postText(f, 'shared policy');
    assert.equal(
      Date.parse(first.expiresAt),
      Date.parse(first.createdAt) + 14 * DAY,
    );
    await f.restart();
    assert.equal((await listing(f)).retentionDays, 14);
    const session = await (
      await f.request('/api/session', { headers: f.headers })
    ).json();
    assert.equal(session.retentionDays, 14);
    const second = await postText(f, 'after restart');
    const file = f.app.storage.get(await upload(f, 'new'))!;
    assert.equal(Date.parse(second.expiresAt), file.expiresAt);
    assert.equal(file.expiresAt, file.uploadedAt! + 14 * DAY);
    assert.equal((await listing(f)).textCount, 2);
    assert.equal((await f.request('/api/session')).status, 401);
  } finally {
    await f.close();
  }
});

test('a retention save invalidates conditional Text deadlines even when item IDs do not change', async () => {
  const f = await fixture();
  try {
    const note = await postText(f, 'same body, new deadline');
    const before = await f.request('/api/texts', { headers: f.headers });
    const oldEtag = before.headers.get('etag')!;
    await before.text();
    assert.equal((await save(f, 60)).status, 200);
    const updated = await f.request('/api/texts', {
      headers: { ...f.headers, 'if-none-match': oldEtag },
    });
    assert.equal(updated.status, 200);
    const newEtag = updated.headers.get('etag')!;
    assert.notEqual(newEtag, oldEtag);
    const { texts } = await updated.json();
    assert.equal(texts.length, 1);
    assert.equal(texts[0].id, note.id);
    assert.equal(texts[0].text, note.text);
    assert.equal(texts[0].createdAt, note.createdAt);
    assert.equal(
      Date.parse(texts[0].expiresAt),
      Date.parse(note.createdAt) + 60 * DAY,
    );
    assert.equal(
      (
        await f.request('/api/texts', {
          headers: { ...f.headers, 'if-none-match': newEtag },
        })
      ).status,
      304,
    );
    assert.equal((await save(f, 60)).status, 200);
    assert.equal(
      (
        await f.request('/api/texts', {
          headers: { ...f.headers, 'if-none-match': newEtag },
        })
      ).status,
      304,
    );
  } finally {
    await f.close();
  }
});

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

for (const kind of ['files', 'Text'] as const)
  test(`${kind}-only shortening requires fresh acknowledgement when another item crosses the boundary`, async () => {
    const f = await fixture();
    try {
      const storage = f.app.storage;
      for (const age of [7 * DAY, 7 * DAY - 1]) {
        if (kind === 'files') {
          const id = await upload(f, 'boundary');
          storage.db
            .prepare('UPDATE files SET uploadedAt=? WHERE id=?')
            .run(f.now() - age, id);
        } else {
          const note = await postText(f, 'boundary');
          storage.db
            .prepare('UPDATE texts SET createdAt=? WHERE id=?')
            .run(f.now() - age, note.id);
        }
      }
      const beforeFiles = storage.rows(),
        beforeTexts = textRows(f);
      let response = await save(f, 7);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).deleteCount, 1);
      f.setNow(f.now() + 1);
      response = await save(f, 7, 1);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).deleteCount, 2);
      assert.equal(storage.retentionDays(), 30);
      assert.deepEqual(storage.rows(), beforeFiles);
      assert.deepEqual(textRows(f), beforeTexts);
      assert.equal((await save(f, 7, 2)).status, 200);
      assert.equal(storage.retentionDays(), 7);
      assert.equal((await listing(f)).files.length, 0);
      assert.equal((await listing(f)).textCount, 0);
    } finally {
      await f.close();
    }
  });

test('shortening counts both live item types and commits only within the confirmed count at the exact boundary', async () => {
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
    const notes = await Promise.all(
      ['old', 'boundary', 'next', 'expired'].map((name) => postText(f, name)),
    );
    const setTextAge = storage.db.prepare(
      'UPDATE texts SET createdAt=? WHERE id=?',
    );
    for (const [index, age] of [
      8 * DAY,
      7 * DAY,
      7 * DAY - 1,
      40 * DAY,
    ].entries())
      setTextAge.run(f.now() - age, notes[index].id);
    storage.db
      .prepare('UPDATE texts SET expiresAt=? WHERE id=?')
      .run(f.now(), notes[3].id);
    const before = storage.rows();
    const beforeTexts = textRows(f);
    const beforeEtag = storage.textsEtag();
    let response = await save(f, 7);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).deleteCount, 4);
    assert.deepEqual(
      storage.rows(),
      before,
      'conflict must change no deadlines or partials',
    );
    assert.equal((await listing(f)).retentionDays, 30);
    assert.deepEqual(textRows(f), beforeTexts);
    assert.equal(storage.textsEtag(), beforeEtag);
    // One file and one Text cross the exact <= boundary while the popup is open.
    f.setNow(f.now() + 1);
    response = await save(f, 7, 4);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).deleteCount, 6);
    assert.deepEqual(storage.rows(), before);
    assert.deepEqual(textRows(f), beforeTexts);
    assert.equal(storage.textsEtag(), beforeEtag);
    assert.equal((await listing(f)).retentionDays, 30);
    assert.equal((await save(f, 7, 6)).status, 200);
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
    const afterTexts = textRows(f);
    for (const note of notes.slice(0, 3)) {
      const row = afterTexts.find((r) => r.id === note.id)!;
      assert.equal(row.expiresAt, row.createdAt + 7 * DAY);
      assert.equal(
        (
          await f.request(`/api/texts/${note.id}`, {
            method: 'DELETE',
            headers: f.headers,
          })
        ).status,
        410,
      );
    }
    assert.deepEqual(
      afterTexts.find((r) => r.id === notes[3].id),
      beforeTexts.find((r) => r.id === notes[3].id),
    );
    assert.equal((await listing(f)).files.length, 0);
    assert.equal((await listing(f)).textCount, 0);
    await f.app.cleanup();
    assert.deepEqual(textRows(f), []);
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
    const liveText = await postText(f, 'live Text');
    const expiredText = await postText(f, 'expired Text');
    f.app.storage.db
      .prepare('UPDATE texts SET expiresAt=? WHERE id=?')
      .run(f.now(), expiredText.id);
    const expiredTextBefore = textRows(f).find((r) => r.id === expiredText.id);
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
    assert.deepEqual(
      textRows(f).find((r) => r.id === expiredText.id),
      expiredTextBefore,
    );
    assert.equal(
      textRows(f).find((r) => r.id === liveText.id)!.expiresAt,
      Date.parse(liveText.createdAt) + 90 * DAY,
    );
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
    const legacyText = await postText(f, 'legacy stored deadline');
    const legacyTextDeadline = Date.parse(legacyText.createdAt) + 30 * DAY;
    f.app.storage.db
      .prepare('UPDATE texts SET expiresAt=? WHERE id=?')
      .run(legacyTextDeadline, legacyText.id);
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
    assert.equal(
      textRows(f).find((r) => r.id === legacyText.id)!.expiresAt,
      legacyTextDeadline,
    );
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
      textRows(f).find((r) => r.id === legacyText.id)!.expiresAt,
      legacyTextDeadline,
    );
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
    await postText(f, 'rollback Text');
    const before = f.app.storage.rows();
    const beforeTexts = textRows(f);
    const beforeEtag = f.app.storage.textsEtag();
    f.app.storage.db.exec(
      "CREATE TRIGGER reject_policy BEFORE UPDATE ON settings BEGIN SELECT RAISE(ABORT,'synthetic settings failure'); END;",
    );
    assert.equal((await save(f, 60)).status, 500);
    assert.deepEqual(f.app.storage.rows(), before);
    assert.deepEqual(textRows(f), beforeTexts);
    assert.equal(f.app.storage.textsEtag(), beforeEtag);
    assert.equal((await listing(f)).retentionDays, 30);
    const freshText = await postText(f, 'future Text after rollback');
    assert.equal(
      Date.parse(freshText.expiresAt),
      Date.parse(freshText.createdAt) + 30 * DAY,
    );
    const session = await (
      await f.request('/api/session', { headers: f.headers })
    ).json();
    assert.equal(session.retentionDays, 30);
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
    await postText(f, 'protected Text');
    const beforeTexts = textRows(f);
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
    assert.deepEqual(textRows(f), beforeTexts);
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
    const liveText = await postText(f, 'live cleanup Text');
    const expiredText = await postText(f, 'expired cleanup Text');
    f.app.storage.db
      .prepare('UPDATE texts SET expiresAt=? WHERE id=?')
      .run(f.now(), expiredText.id);
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
    assert.equal(
      textRows(f).some((r) => r.id === expiredText.id),
      false,
    );
    assert.equal(
      textRows(f).find((r) => r.id === liveText.id)!.expiresAt,
      Date.parse(liveText.createdAt) + 60 * DAY,
    );
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
