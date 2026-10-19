// Actual built dashboard + actual service/storage/tus; SYNTHETIC signed identity.
// Build web first, then: server/node_modules/.bin/tsx --test scripts/acceptance-service-browser.test.ts
// Optional playwright-core lives outside the repository; see acceptance-browser.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';

test('actual service/browser upload-download-delete with synthetic signed owner identity', async () => {
  const artifacts = path.resolve('artifacts/acceptance-stage05/actual-service');
  const temp = `${homedir()}/.cache/storagi/tmp`;
  await mkdir(artifacts, { recursive: true }); await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(`${temp}/acceptance-browser-`);
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const id = await identity();
  const app = await createApp({ origin, clientId: 'synthetic-client', clientSecret: 'synthetic-secret', ownerSub: '123', dataDir: dir, budgetBytes: 64 * 1024 ** 2, diskReserveBytes: 1, port }, { oidc: id.config, freeBytes: () => 1e9, webDir: path.resolve('web/dist') });
  let browser: any;
  const pageErrors: string[] = [];
  const responses: { method: string; path: string; status: number; csrfPresent: boolean }[] = [];
  try {
    app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening');
    const flow = await app.auth.begin();
    const params = new URL(flow.url).searchParams;
    id.set({ sub: '123', nonce: params.get('nonce')! });
    const signedSession = await app.auth.callback(flow.token, new URL(`${origin}/auth/callback?code=synthetic&state=${params.get('state')}`));
    assert.ok(app.auth.session(signedSession.token), 'existing Auth must validate the signed owner identity');
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || `${homedir()}/.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs`).href);
    browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ['--no-sandbox'], headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addCookies([{ name: '__Host-storagi-session', value: signedSession.token, domain: '127.0.0.1', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', (error: Error) => pageErrors.push(error.message));
    page.on('response', (response: any) => {
      const request = response.request(); const route = new URL(response.url()).pathname;
      if (route.startsWith('/api/')) responses.push({ method: request.method(), path: route, status: response.status(), csrfPresent: Boolean(request.headers()['x-csrf-token']) });
    });
    const sessionResponse = page.waitForResponse((response: any) => new URL(response.url()).pathname === '/api/session');
    await page.goto(origin);
    const checked = await sessionResponse;
    assert.equal(checked.status(), 200, 'Chrome must send the Secure __Host cookie on HTTP loopback; a failure is a local cookie prerequisite, not real Google proof');
    await page.locator('#picker').waitFor({ state: 'attached' });
    await page.getByText('A fresh shelf. Your next upload will appear here.').waitFor();
    assert.match(await page.locator('body').innerText(), /A fresh shelf/);
    assert.doesNotMatch(await page.locator('body').innerText(), /SYNTHETIC PREVIEW/, 'must serve the production build without mock middleware');
    const payload = Buffer.alloc(10 * 1024 ** 2, 0x6b);
    await page.locator('#picker').setInputFiles({ name: 'actual-service-synthetic.zip', mimeType: 'application/zip', buffer: payload });
    const row = page.locator('[data-file-id]').filter({ hasText: 'actual-service-synthetic.zip' });
    await row.waitFor({ timeout: 30000 });
    await page.screenshot({ path: `${artifacts}/SYNTHETIC-IDENTITY-real-service-1440.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifacts}/SYNTHETIC-IDENTITY-real-service-390.png`, fullPage: true });
    const downloadEvent = page.waitForEvent('download');
    await row.getByRole('link', { name: /^Download/ }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'actual-service-synthetic.zip');
    await download.saveAs(`${artifacts}/actual-service-download.bin`);
    const hash = createHash('sha256').update(payload).digest('hex');
    assert.equal(createHash('sha256').update(await readFile(`${artifacts}/actual-service-download.bin`)).digest('hex'), hash);
    await row.getByRole('button', { name: /^Delete/ }).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Delete copy', exact: true }).click();
    await row.waitFor({ state: 'detached' });
    await page.getByText('A fresh shelf. Your next upload will appear here.').waitFor();
    assert.equal(app.storage.usage().usedBytes, 0); assert.equal(app.storage.usage().reservedBytes, 0);
    assert.ok(responses.some(r => r.method === 'POST' && r.path === '/api/uploads' && r.status === 201));
    assert.ok(responses.filter(r => r.method === 'PATCH' && r.status === 204).length >= 2, '10 MiB must use multiple real tus chunks');
    assert.ok(responses.some(r => r.method === 'DELETE' && r.status === 204));
    assert.ok(responses.filter(r => ['POST', 'PATCH', 'DELETE'].includes(r.method)).every(r => r.csrfPresent));
    assert.deepEqual(pageErrors, []);
    await writeFile(`${artifacts}/evidence.json`, JSON.stringify({ kind: 'Actual built dashboard and file API; SYNTHETIC signed owner identity, no Google network', browser: browser.version(), origin, payloadBytes: payload.length, sha256: hash, responses, pageErrors, staticBuild: await readFile('web/dist/index.html', 'utf8'), result: 'passed' }, null, 2));
  } finally {
    if (browser) await browser.close();
    await app.close(); await rm(dir, { recursive: true, force: true });
  }
});
