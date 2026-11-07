import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY, type TextRow } from '../src/storage.js';

type Fixture = Awaited<ReturnType<typeof fixture>>;

function delayedBody(f: Fixture, route: string, method: string, body: string) {
  let consumed!: (req: http.IncomingMessage) => void;
  const reading = new Promise<http.IncomingMessage>((resolve) => {
    consumed = resolve;
  });
  // Observe the real parser, without replacing auth, body bytes or storage.
  if (route === '/api/settings') {
    f.app.server.prependOnceListener('request', (req) => {
      assert.equal(req.url, route);
      const iterate = req[Symbol.asyncIterator].bind(req);
      req[Symbol.asyncIterator] = async function* () {
        for await (const chunk of { [Symbol.asyncIterator]: iterate }) {
          yield chunk;
          // The parser has consumed this chunk and asked for another.
          consumed(req);
        }
      };
    });
  } else {
    // Runs after readTextBody installs its data handler, before bytes arrive.
    f.app.server.once('request', (req) => {
      assert.equal(req.url, route);
      assert.ok(req.listenerCount('data') > 0);
      req.once('data', () => consumed(req));
    });
  }
  const request = http.request(f.config.origin + route, {
    method,
    headers: {
      ...f.headers,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      connection: 'close',
    },
  });
  const response = new Promise<{ status: number; body: string }>(
    (resolve, reject) => {
      request.once('error', reject);
      request.once('response', (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk.toString()));
        res.once('error', reject);
        res.once('end', () => resolve({ status: res.statusCode!, body }));
      });
    },
  );
  request.setTimeout(5000, () =>
    request.destroy(new Error('Body probe stalled')),
  );
  const bytes = Buffer.from(body);
  // Split Text inside a UTF-8 character, exercising the real decoder too.
  const split = body.includes('雪') ? bytes.indexOf(Buffer.from('雪')) + 1 : 1;
  request.write(bytes.subarray(0, split));
  return {
    request,
    reading: Promise.race([
      reading,
      response.then(() => {
        throw new Error('Response arrived before body consumption probe');
      }),
    ]),
    response,
    finish: () => request.end(bytes.subarray(split)),
  };
}

for (const route of ['/api/settings', '/api/texts'] as const) {
  for (const revocation of ['logout', 'expiry', 'valid'] as const) {
    test(`${route} delayed body ${revocation}: revalidate session before mutation`, async () => {
      const f = await fixture();
      let delayed: ReturnType<typeof delayedBody> | undefined;
      try {
        const storage = f.app.storage;
        const now = f.now();
        f.setNow(now - 2 * DAY);
        const file = await upload(f, 'retained file');
        const seed = await f.request('/api/texts', {
          method: 'POST',
          headers: { ...f.headers, 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'retained Text' }),
        });
        assert.equal(seed.status, 201);
        await seed.json();
        f.setNow(now);
        const beforeFiles = storage.rows();
        const texts = () =>
          storage.db
            .prepare('SELECT * FROM texts ORDER BY rowid')
            .all() as TextRow[];
        const beforeTexts = texts();
        const beforeEtag = storage.textsEtag();
        const beforePolicy = storage.retentionDays();
        const session = storage.db
          .prepare('SELECT expiresAt FROM sessions')
          .get() as {
          expiresAt: number;
        };
        const newText = '  delayed 雪🙂\n\t';
        delayed = delayedBody(
          f,
          route,
          route === '/api/settings' ? 'PUT' : 'POST',
          JSON.stringify(
            route === '/api/settings'
              ? { retentionDays: 1, confirmDeletes: 2 }
              : { text: newText },
          ),
        );
        const req = await delayed.reading;
        assert.equal(req.complete, false, 'body is still incomplete');
        assert.equal(req.readableEnded, false);
        assert.equal(
          (await f.request('/api/session', { headers: f.headers })).status,
          200,
          'session is valid after initial guards and partial body consumption',
        );
        if (revocation === 'logout') {
          assert.equal(
            (
              await f.request('/auth/logout', {
                method: 'POST',
                headers: f.headers,
              })
            ).status,
            204,
          );
        } else if (revocation === 'expiry') {
          f.setNow(session.expiresAt);
        } else {
          f.setNow(now + 1);
        }
        assert.equal(
          (await f.request('/api/session', { headers: f.headers })).status,
          revocation === 'valid' ? 200 : 401,
        );
        delayed.finish();
        const response = await delayed.response;
        assert.equal(
          response.status,
          revocation === 'valid'
            ? route === '/api/settings'
              ? 200
              : 201
            : 401,
          response.body,
        );
        if (revocation === 'valid' && route === '/api/settings') {
          assert.deepEqual(JSON.parse(response.body), { retentionDays: 1 });
          assert.equal(storage.retentionDays(), 1);
          assert.equal(
            storage.get(file)!.expiresAt,
            beforeFiles[0].uploadedAt! + DAY,
          );
          assert.equal(texts()[0].expiresAt, beforeTexts[0].createdAt + DAY);
          assert.notEqual(storage.textsEtag(), beforeEtag);
        } else if (revocation === 'valid') {
          const added = JSON.parse(response.body);
          assert.equal(added.text, newText);
          assert.equal(added.createdAt, new Date(f.now()).toISOString());
          assert.equal(
            added.expiresAt,
            new Date(f.now() + 30 * DAY).toISOString(),
          );
          assert.equal(storage.retentionDays(), beforePolicy);
          assert.deepEqual(storage.rows(), beforeFiles);
          assert.equal(texts().length, 2);
          assert.deepEqual(texts()[0], beforeTexts[0]);
          assert.equal(texts()[1].id, added.id);
          assert.equal(texts()[1].text, newText);
          assert.notEqual(storage.textsEtag(), beforeEtag);
        } else {
          const unchanged = () => {
            assert.equal(storage.retentionDays(), beforePolicy);
            assert.deepEqual(storage.rows(), beforeFiles);
            assert.deepEqual(texts(), beforeTexts);
            assert.equal(storage.textsEtag(), beforeEtag);
          };
          unchanged();
          await f.app.cleanup();
          unchanged();
          assert.equal(
            await readFile(path.join(storage.filesDir, file), 'utf8'),
            'retained file',
          );
        }
      } finally {
        delayed?.request.destroy();
        await f.close();
      }
    });
  }
}
