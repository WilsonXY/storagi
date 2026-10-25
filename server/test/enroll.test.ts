import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identity } from './helpers.js';
import { startEnrollment } from '../src/enroll.js';
test('separate loopback enrollment verifies identity without creating an application session', async () => {
  const id = await identity();
  const enrollment = await startEnrollment(id.config, 0);
  try {
    const login = new URL(enrollment.url);
    const callback = new URL(login.searchParams.get('redirect_uri')!);
    assert.equal(callback.hostname, '127.0.0.1');
    assert.equal(callback.pathname, '/callback');
    assert.equal(login.searchParams.get('scope'), 'openid');
    id.set({ nonce: login.searchParams.get('nonce')! });
    callback.searchParams.set('state', login.searchParams.get('state')!);
    callback.searchParams.set('code', 'synthetic');
    const response = await fetch(callback);
    assert.equal(response.status, 200);
    assert.doesNotMatch(
      await response.text(),
      /synthetic|access_token|id_token/,
    );
    assert.equal(await enrollment.done, '123');
    assert.ok(id.verifier());
  } finally {
    await enrollment.close();
  }
});
