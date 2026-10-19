// Actual built dashboard + actual service/storage/tus; SYNTHETIC signed identity.
// Build web first, then: server/node_modules/.bin/tsx --test scripts/acceptance-service-browser.test.ts
// Optional playwright-core lives outside the repository; see acceptance-browser.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';

test('actual service/browser upload-download-delete with synthetic signed owner identity', async () => {
  const artifacts = path.resolve(process.env.STORAGI_ARTIFACT_DIR || 'artifacts/acceptance-stage05/actual-service');
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
  const responses: { method: string; path: string; status: number; csrfPresent: boolean; offset?: string }[] = [];
  const resumeEvidence: unknown[] = [];
  const networkFailures: { method: string; path: string; error: string }[] = [];
  const relayedResponses: { path: string; status: number; hostileOrigin: boolean }[] = [];
  let phase = 'initial upload/download/delete';
  try {
    app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening');
    const flow = await app.auth.begin();
    const params = new URL(flow.url).searchParams;
    id.set({ sub: '123', nonce: params.get('nonce')! });
    let signedSession = await app.auth.callback(flow.token, new URL(`${origin}/auth/callback?code=synthetic&state=${params.get('state')}`));
    assert.ok(app.auth.session(signedSession.token), 'existing Auth must validate the signed owner identity');
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || `${homedir()}/.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs`).href);
    browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ['--no-sandbox'], headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addCookies([{ name: '__Host-storagi-session', value: signedSession.token, domain: '127.0.0.1', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', (error: Error) => pageErrors.push(error.message));
    page.on('requestfailed', (request: any) => networkFailures.push({ method: request.method(), path: new URL(request.url()).pathname, error: request.failure()?.errorText || 'unknown' }));
    page.on('response', (response: any) => {
      const request = response.request(); const route = new URL(response.url()).pathname;
      if (route.startsWith('/api/')) responses.push({ method: request.method(), path: route, status: response.status(), csrfPresent: Boolean(request.headers()['x-csrf-token']), offset: request.headers()['upload-offset'] });
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
    for (const status of [401, 403, 404, 410]) {
      phase = `HEAD${status} seed partial`;
      const name = `actual-resume-${status}.bin`, source = `${artifacts}/${name}`;
      const data = Buffer.alloc(24 * 1024 ** 2, status % 251);
      await writeFile(source, data);
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/api/uploads/**', async (route: any) => {
        if (route.request().method() === 'PATCH' && Number(route.request().headers()['upload-offset']) > 0) {
          await gate; await route.abort('aborted');
        } else await route.continue();
      });
      try {
        const firstChunk = page.waitForResponse((response: any) => response.request().method() === 'PATCH' && response.status() === 204);
        await page.locator('#picker').setInputFiles(source); await firstChunk;
        await page.getByRole('button', { name: `Pause ${name}`, exact: true }).click();
        await page.getByText(/Paused · ready to resume/).waitFor();
      } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
      const partial = app.storage.rows().find(row => row.name === name)!;
      assert.ok(partial && partial.uploadedAt === null);
      const offset = (await stat(`${app.storage.filesDir}/${partial.id}`)).size;
      assert.ok(offset > 0 && offset < partial.size);
      const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tus::'))));
      assert.equal(Object.keys(saved).length, 1);
      assert.equal(new URL(JSON.parse(Object.values(saved)[0] as string).uploadUrl, origin).pathname, `/api/uploads/${partial.id}`);
      const beforeUsage = app.storage.usage(), beforeRequests = responses.length;
      let injectOrigin = status === 403;
      if (status === 403) await page.route(`**/api/uploads/${partial.id}`, async (route: any) => {
        if (route.request().method() === 'HEAD' && injectOrigin) {
          injectOrigin = false;
          // Chromium did not preserve an Origin override on continue. Fetch the actual
          // protected response through Playwright's request layer, then relay it intact.
          const actual = await route.fetch({ headers: { ...await route.request().allHeaders(), origin: 'https://hostile.example' } });
          assert.equal(actual.status(), 403, 'real service must reject hostile Origin; never fabricate this status');
          relayedResponses.push({ path: new URL(actual.url()).pathname, status: actual.status(), hostileOrigin: true });
          await route.fulfill({ response: actual });
        } else await route.continue();
      });
      if (status === 404) {
        const deleted = await context.request.delete(`${origin}/api/uploads/${partial.id}`, { headers: { origin, 'x-csrf-token': signedSession.csrf, 'tus-resumable': '1.0.0' } });
        assert.equal(deleted.status(), 204);
      }
      if (status === 410) app.storage.db.prepare('UPDATE files SET expiresAt=0 WHERE id=?').run(partial.id);
      // Load with a valid shell session before triggering the rejected resume HEAD.
      // 401 is revoked after reload so it exercises tus, rather than the initial session check.
      await page.reload(); await page.locator('#picker').waitFor({ state: 'attached' });
      if (status === 401) app.auth.revoke(signedSession.token);
      const rejected = page.waitForResponse((response: any) => response.request().method() === 'HEAD' && response.status() === status);
      phase = `HEAD${status} rejection`;
      await page.locator('#picker').setInputFiles(source); await rejected;
      if (status === 403) await page.unrouteAll({ behavior: 'wait' });
      if (status === 401 || status === 403) {
        await page.getByRole('link', { name: /Continue with Google/ }).waitFor();
        assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tus::')))), saved);
        assert.deepEqual(app.storage.usage(), beforeUsage);
        assert.equal((await stat(`${app.storage.filesDir}/${partial.id}`)).size, offset);
        assert.deepEqual(responses.slice(beforeRequests).filter(response => response.path.startsWith('/api/uploads')).map(response => response.method), ['HEAD']);
        await page.screenshot({ path: `${artifacts}/SYNTHETIC-IDENTITY-resume-HEAD-${status}-login.png`, fullPage: true });
        // Existing signed synthetic OIDC transport supplies a fresh session; no Google UI claim.
        const fresh = await app.auth.begin(), freshParams = new URL(fresh.url).searchParams;
        id.set({ sub: '123', nonce: freshParams.get('nonce')! });
        signedSession = await app.auth.callback(fresh.token, new URL(`${origin}/auth/callback?code=synthetic&state=${freshParams.get('state')}`));
        await context.addCookies([{ name: '__Host-storagi-session', value: signedSession.token, domain: '127.0.0.1', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
        await page.goto(origin);
        const resumed = page.waitForResponse((response: any) => response.request().method() === 'HEAD' && response.status() === 200);
        await page.locator('#picker').setInputFiles(source);
        assert.equal(Number((await resumed).headers()['upload-offset']), offset);
      }
      const resumedRow = page.locator('[data-file-id]').filter({ hasText: name }); await resumedRow.waitFor({ timeout: 30000 });
      const transferRequests = responses.slice(beforeRequests).filter(response => response.path.startsWith('/api/uploads'));
      const posts = transferRequests.filter(response => response.method === 'POST');
      assert.equal(posts.length, status === 401 || status === 403 ? 0 : 1);
      const firstPatch = transferRequests.find(response => response.method === 'PATCH')!;
      assert.equal(Number(firstPatch.offset), status === 401 || status === 403 ? offset : 0);
      if (status === 401 || status === 403) assert.ok(transferRequests.every(response => response.path === `/api/uploads/${partial.id}`));
      else assert.notEqual(firstPatch.path, `/api/uploads/${partial.id}`);
      const downloadEvent = page.waitForEvent('download'); await resumedRow.getByRole('link', { name: /^Download/ }).click();
      const downloaded = await downloadEvent; await downloaded.saveAs(`${artifacts}/${name}.download`);
      assert.equal(createHash('sha256').update(await readFile(`${artifacts}/${name}.download`)).digest('hex'), createHash('sha256').update(data).digest('hex'));
      await resumedRow.getByRole('button', { name: /^Delete/ }).click(); await page.getByRole('button', { name: 'Delete copy', exact: true }).click();
      await resumedRow.waitFor({ state: 'detached' });
      if (status === 410) await app.cleanup();
      assert.equal(app.storage.usage().reservedBytes, 0); assert.equal(app.storage.usage().usedBytes, 0);
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tus::')))), {});
      resumeEvidence.push({ rejectedHead: status, originalId: partial.id, originalOffset: offset, firstResumedOffset: Number(firstPatch.offset), extraPost: posts.length, requests: transferRequests, sha256Matched: true });
    }
    assert.ok(responses.some(r => r.method === 'POST' && r.path === '/api/uploads' && r.status === 201));
    assert.ok(responses.filter(r => r.method === 'PATCH' && r.status === 204).length >= 2, '10 MiB must use multiple real tus chunks');
    assert.ok(responses.some(r => r.method === 'DELETE' && r.status === 204));
    assert.ok(responses.filter(r => ['POST', 'PATCH', 'DELETE'].includes(r.method)).every(r => r.csrfPresent));
    assert.deepEqual(pageErrors, []);
    await writeFile(`${artifacts}/evidence.json`, JSON.stringify({ kind: 'Actual built dashboard and file API; SYNTHETIC signed owner identity, no Google network. HEAD403 fetched from actual service with hostile Origin through Playwright request layer and relayed intact to browser; HEAD410 by isolated test expiry metadata.', browser: browser.version(), origin, payloadBytes: payload.length, sha256: hash, resumeEvidence, relayedResponses, responses, pageErrors, staticBuild: await readFile('web/dist/index.html', 'utf8'), result: 'passed' }, null, 2));
  } catch (error) {
    await writeFile(`${artifacts}/failure-evidence.json`, JSON.stringify({ result: 'failed', phase, error: String(error), responses, resumeEvidence, relayedResponses, pageErrors, networkFailures }, null, 2));
    throw error;
  } finally {
    if (browser) await browser.close();
    await app.close(); await rm(dir, { recursive: true, force: true });
  }
});
