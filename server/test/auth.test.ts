import path from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import * as oidc from 'openid-client';
import { identity } from './helpers.js';
import { Storage } from '../src/storage.js';
import { Auth } from '../src/auth.js';

test('signed OIDC identity, PKCE, state/nonce, allowlist, replay and session revocation', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'auth-'));
  const storage = new Storage(dir, 100, 1);
  const id = await identity();
  const auth = new Auth(storage, 'https://shelf.example', '123', id.config);
  try {
    const begin = await auth.begin();
    const request = new URL(begin.url);
    assert.equal(request.searchParams.get('scope'), 'openid');
    assert.equal(request.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(request.searchParams.get('state'));
    assert.ok(request.searchParams.get('nonce'));
    id.set({ nonce: request.searchParams.get('nonce')! });
    const result = await auth.callback(
      begin.token,
      new URL(
        'https://shelf.example/auth/callback?code=synthetic&state=' +
          request.searchParams.get('state'),
      ),
    );
    assert.equal(auth.session(result.token)?.csrf, result.csrf);
    assert.ok(id.verifier());
    assert.equal(
      await oidc.calculatePKCECodeChallenge(id.verifier()),
      request.searchParams.get('code_challenge'),
    );
    await assert.rejects(
      auth.callback(
        begin.token,
        new URL(
          'https://shelf.example/auth/callback?code=x&state=' +
            request.searchParams.get('state'),
        ),
      ),
    );
    auth.revoke(result.token);
    assert.equal(auth.session(result.token), undefined);
    for (const bad of [
      { sub: '456' },
      { tamper: true },
      { expired: true },
      { nonce: 'wrong' },
      { audience: 'wrong' },
      { issuer: 'https://wrong.example' },
    ]) {
      const flow = await auth.begin();
      const params = new URL(flow.url).searchParams;
      id.set({
        sub: '123',
        tamper: false,
        expired: false,
        audience: 'synthetic-client',
        issuer: 'https://accounts.google.com',
        nonce: params.get('nonce')!,
        ...bad,
      });
      await assert.rejects(
        auth.callback(
          flow.token,
          new URL(
            'https://shelf.example/auth/callback?code=x&state=' +
              params.get('state'),
          ),
        ),
      );
    }
    const flow = await auth.begin();
    await assert.rejects(
      auth.callback(
        flow.token,
        new URL('https://shelf.example/auth/callback?code=x&state=wrong'),
      ),
    );
  } finally {
    storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('authenticated login navigation retains the current session without starting another flow', async () => {
  const { fixture } = await import('./fixtures.js');
  const f = await fixture();
  try {
    const result = await f.request('/auth/login', {
      headers: { cookie: f.headers.cookie, 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(result.status, 302);
    assert.equal(result.headers.get('location'), '/');
    assert.equal(result.headers.get('set-cookie'), null);
    assert.equal(
      (await f.request('/api/session', { headers: f.headers })).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test('anonymous login flood cannot evict an owner flow or write per-login database state', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'flow-flood-'));
  const storage = new Storage(dir, 100, 1);
  const id = await identity();
  const auth = new Auth(storage, 'https://shelf.example', '123', id.config);
  try {
    const owner = await auth.begin(),
      params = new URL(owner.url).searchParams;
    const changes = () =>
        Number(
          (
            storage.db.prepare('SELECT total_changes() AS n').get() as {
              n: number;
            }
          ).n,
        ),
      before = changes();
    for (let i = 0; i < 120; i++) await auth.begin();
    const after = changes();
    id.set({ nonce: params.get('nonce')! });
    const result = await auth.callback(
      owner.token,
      new URL(
        'https://shelf.example/auth/callback?code=owner&state=' +
          params.get('state'),
      ),
    );
    assert.ok(auth.session(result.token));
    assert.equal(after, before, 'anonymous begin must not write SQLite');
  } finally {
    storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('sealed flow cookies survive restart, reject tampering, browser swaps and expiry, and consume success once', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sealed-flow-'));
  let now = Date.now(),
    storage = new Storage(dir, 100, 1, () => now);
  const id = await identity();
  let auth = new Auth(storage, 'https://shelf.example', '123', id.config);
  const callback = (state: string) =>
    new URL(
      'https://shelf.example/auth/callback?code=reusable-synthetic-code&state=' +
        state,
    );
  try {
    const owner = await auth.begin(),
      params = new URL(owner.url).searchParams,
      state = params.get('state')!;
    const other = await auth.begin();
    id.set({ nonce: params.get('nonce')! });
    const corrupted = Buffer.from(owner.token, 'base64url');
    corrupted[20] ^= 1;
    const before = (
      storage.db.prepare('SELECT total_changes() AS n').get() as { n: number }
    ).n;
    for (const token of [
      '',
      owner.token + '=',
      corrupted.toString('base64url'),
      'x'.repeat(1025),
      other.token,
    ])
      await assert.rejects(auth.callback(token, callback(state)));
    await assert.rejects(auth.callback(owner.token, callback('wrong-state')));
    assert.equal(
      (storage.db.prepare('SELECT total_changes() AS n').get() as { n: number })
        .n,
      before,
      'invalid flow callbacks never persist state',
    );
    storage.close();
    storage = new Storage(dir, 100, 1, () => now);
    auth = new Auth(storage, 'https://shelf.example', '123', id.config);
    const results = await Promise.allSettled([
      auth.callback(owner.token, callback(state)),
      auth.callback(owner.token, callback(state)),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    await assert.rejects(auth.callback(owner.token, callback(state)));
    assert.equal(
      (
        storage.db.prepare('SELECT COUNT(*) AS n FROM flow_replays').get() as {
          n: number;
        }
      ).n,
      1,
    );
    const expired = await auth.begin(),
      expiredState = new URL(expired.url).searchParams.get('state')!;
    now += 10 * 60000;
    await assert.rejects(auth.callback(expired.token, callback(expiredState)));
    auth.prune();
    assert.equal(
      (
        storage.db.prepare('SELECT COUNT(*) AS n FROM flow_replays').get() as {
          n: number;
        }
      ).n,
      0,
    );
  } finally {
    storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('successful callback replay ledger is bounded without evicting previous successes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'flow-bound-'));
  const storage = new Storage(dir, 100, 1);
  const id = await identity();
  const auth = new Auth(storage, 'https://shelf.example', '123', id.config);
  try {
    const begin = await auth.begin(),
      params = new URL(begin.url).searchParams;
    id.set({ nonce: params.get('nonce')! });
    storage.db.transaction(() => {
      for (let i = 0; i < 1000; i++)
        storage.db
          .prepare('INSERT INTO flow_replays VALUES (?,?)')
          .run('synthetic-consumed-' + i, storage.now() + 600000);
    })();
    await assert.rejects(
      auth.callback(
        begin.token,
        new URL(
          'https://shelf.example/auth/callback?code=reusable&state=' +
            params.get('state'),
        ),
      ),
      { status: 429 },
    );
    assert.equal(
      (
        storage.db.prepare('SELECT COUNT(*) AS n FROM flow_replays').get() as {
          n: number;
        }
      ).n,
      1000,
    );
    assert.equal(
      (
        storage.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {
          n: number;
        }
      ).n,
      0,
    );
  } finally {
    storage.close();
    await rm(dir, { recursive: true, force: true });
  }
});
