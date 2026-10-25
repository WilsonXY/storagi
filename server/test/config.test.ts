import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
const env = {
  PUBLIC_ORIGIN: 'https://shelf.example',
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  OWNER_GOOGLE_SUB: '123456789',
  DATA_DIR: '/var/lib/storagi',
};
test('configuration fails closed and permits only explicit HTTPS origin and bound owner', () => {
  assert.throws(() => loadConfig({}));
  assert.throws(() =>
    loadConfig({ ...env, PUBLIC_ORIGIN: 'http://shelf.example' }),
  );
  assert.throws(() =>
    loadConfig({ ...env, PUBLIC_ORIGIN: 'https://shelf.example/path' }),
  );
  assert.throws(() => loadConfig({ ...env, OWNER_GOOGLE_SUB: '' }));
  assert.throws(() => loadConfig({ ...env, BUDGET_BYTES: 'NaN' }));
  assert.throws(() => loadConfig({ ...env, DATA_DIR: './web/dist' }));
  assert.equal(loadConfig(env).budgetBytes, 200 * 1024 ** 3);
  assert.equal(loadConfig(env).origin, 'https://shelf.example');
});
