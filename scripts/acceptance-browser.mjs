// MOCKED proof only. Start web's documented test:preview first.
// npm install --prefix ~/.cache/storagi/browser-harness playwright-core
// TMPDIR=~/.cache/storagi/tmp node scripts/acceptance-browser.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || `${homedir()}/.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs`).href);
const base = 'http://127.0.0.1:5174';
const artifacts = path.resolve(process.env.STORAGI_ARTIFACT_DIR || 'artifacts/acceptance-stage05');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ['--no-sandbox'], headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const evidence = { kind: 'MOCKED: real dashboard, synthetic service/authentication', browser: browser.version(), base, screenshots: [], flows: [] };

try {
  await test('MOCKED browser acceptance', async t => {
    await t.test('login shell, synthetic login and responsive Inbox', async () => {
      assert.equal((await fetch(`${base}/__test/reset`, { method: 'POST' })).status, 200);
      await fetch(`${base}/__test/session`, { method: 'POST', body: JSON.stringify({ authenticated: false }) });
      await page.goto(base);
      await page.getByRole('link', { name: /Continue with Google/ }).waitFor();
      assert.equal(await page.locator('[data-file-id]').count(), 0);
      await page.screenshot({ path: `${artifacts}/MOCKED-login-desktop.png`, fullPage: true });
      evidence.screenshots.push('MOCKED-login-desktop.png');
      await page.getByRole('link', { name: /Continue with Google/ }).click();
      await page.locator('[data-file-id]').first().waitFor();
      assert.equal(await page.locator('[data-file-id]').count(), 5);
      assert.match(await page.locator('body').innerText(), /SYNTHETIC PREVIEW/);
      for (const [width, height] of [[1440, 1000], [728, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}px`);
        await page.getByRole('button', { name: /Choose files/ }).waitFor({ state: 'visible' });
        const name = `MOCKED-inbox-${width}.png`;
        await page.screenshot({ path: `${artifacts}/${name}`, fullPage: true });
        evidence.screenshots.push(name);
      }
      evidence.flows.push('login shell; synthetic login; 1440/728/390 layouts without horizontal overflow');
    });
    await t.test('search, duplicate suffixes, download and confirmed deletion on mobile', async () => {
      const search = page.getByRole('searchbox', { name: 'Search filenames' });
      await search.fill('project-assets');
      assert.equal(await page.locator('[data-file-id]').count(), 2);
      const suffixes = await page.locator('.file-id').allTextContents();
      assert.equal(new Set(suffixes).size, 2);
      await search.fill('nothing-matches-this');
      await page.getByText('No matching files. Try another filename.').waitFor();
      await search.fill('');
      const first = page.locator('[data-file-id]').first();
      const firstId = await first.getAttribute('data-file-id');
      const downloadEvent = page.waitForEvent('download');
      await first.getByRole('link', { name: /^Download/ }).click();
      const download = await downloadEvent;
      assert.equal(download.suggestedFilename(), 'studio-walkthrough.mp4');
      await download.saveAs(`${artifacts}/MOCKED-fixture-download.txt`);
      assert.match(await readFile(`${artifacts}/MOCKED-fixture-download.txt`, 'utf8'), /Synthetic preview fixture/);
      await first.getByRole('button', { name: /^Delete/ }).click();
      await page.getByRole('dialog').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Keep file' }).click();
      assert.equal(await page.locator(`[data-file-id="${firstId}"]`).count(), 1);
      await first.getByRole('button', { name: /^Delete/ }).click();
      await page.screenshot({ path: `${artifacts}/MOCKED-delete-confirm-390.png`, fullPage: true });
      evidence.screenshots.push('MOCKED-delete-confirm-390.png');
      await page.getByRole('button', { name: 'Delete copy', exact: true }).click();
      await page.locator(`[data-file-id="${firstId}"]`).waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-file-id]').count(), 4);
      evidence.flows.push('mobile search/missing/clear; duplicate ids; synthetic download; delete cancel/confirm');
    });
    await t.test('24 MiB upload pause/resume and downloaded SHA-256 integrity', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const payload = Buffer.alloc(24 * 1024 ** 2, 0x5a);
      await writeFile(`${artifacts}/acceptance-upload.bin`, payload);
      const firstChunk = page.waitForResponse(response => response.request().method() === 'PATCH' && response.status() === 204);
      await page.locator('#picker').setInputFiles(`${artifacts}/acceptance-upload.bin`);
      await firstChunk;
      await page.getByRole('button', { name: 'Pause acceptance-upload.bin', exact: true }).click();
      await page.getByText(/Paused · ready to resume/).waitFor();
      await page.screenshot({ path: `${artifacts}/MOCKED-paused-desktop.png`, fullPage: true });
      evidence.screenshots.push('MOCKED-paused-desktop.png');
      await page.getByRole('button', { name: 'Resume acceptance-upload.bin', exact: true }).click();
      await page.locator('.transfer-status').filter({ hasText: 'On your shelf' }).waitFor({ timeout: 30000 });
      const uploaded = page.locator('[data-file-id]').filter({ hasText: 'acceptance-upload.bin' });
      await uploaded.waitFor();
      const event = page.waitForEvent('download');
      await uploaded.getByRole('link', { name: /^Download/ }).click();
      await (await event).saveAs(`${artifacts}/MOCKED-upload-download.bin`);
      assert.equal(createHash('sha256').update(await readFile(`${artifacts}/MOCKED-upload-download.bin`)).digest('hex'), createHash('sha256').update(payload).digest('hex'));
      evidence.flows.push('24 MiB synthetic upload; pause/resume; download SHA-256 match');
    });
    await t.test('reload/reselect resume and cancel release synthetic reservation', async () => {
      await writeFile(`${artifacts}/acceptance-cancel.bin`, Buffer.alloc(24 * 1024 ** 2, 0x31));
      const firstChunk = page.waitForResponse(response => response.request().method() === 'PATCH' && response.status() === 204);
      await page.locator('#picker').setInputFiles(`${artifacts}/acceptance-cancel.bin`);
      await firstChunk;
      await page.getByRole('button', { name: 'Pause acceptance-cancel.bin', exact: true }).click();
      await page.getByText(/Paused · ready to resume/).waitFor();
      await page.reload();
      await page.locator('#picker').waitFor({ state: 'attached' });
      const head = page.waitForResponse(response => response.request().method() === 'HEAD' && response.url().includes('/api/uploads/') && response.status() === 200);
      await page.locator('#picker').setInputFiles(`${artifacts}/acceptance-cancel.bin`);
      const resumed = await head;
      assert.ok(Number(resumed.headers()['upload-offset']) > 0);
      const cancelled = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().includes('/api/uploads/') && response.status() === 204);
      await page.getByRole('button', { name: 'Cancel acceptance-cancel.bin', exact: true }).click();
      await cancelled;
      await page.getByText(/Cancelled ·/).waitFor();
      const state = await (await fetch(`${base}/__test/state`)).json();
      assert.equal(state.partialCount, 0); assert.equal(state.reservedBytes, 0);
      evidence.flows.push('reload and same-original reselect uses HEAD offset > 0; cancel DELETE releases reservation');
    });
    await t.test('quota/expired-partial errors and session expiry', async () => {
      await fetch(`${base}/__test/quota`, { method: 'POST', body: JSON.stringify({ budgetBytes: 1 }) });
      await page.getByRole('button', { name: /Refresh/ }).click();
      await page.getByText(/Your shelf is full/).waitFor();
      await page.locator('#picker').setInputFiles({ name: 'full.zip', mimeType: 'application/zip', buffer: Buffer.from('synthetic') });
      await page.getByText(/Not enough space. Delete a copy or wait for expiry, then retry./).first().waitFor();
      await page.screenshot({ path: `${artifacts}/MOCKED-quota-error-desktop.png`, fullPage: true });
      evidence.screenshots.push('MOCKED-quota-error-desktop.png');
      await fetch(`${base}/__test/quota`, { method: 'POST', body: JSON.stringify({ budgetBytes: 200 * 1024 ** 3 }) });
      await fetch(`${base}/__test/failure`, { method: 'POST', body: JSON.stringify({ status: 410 }) });
      await page.locator('#picker').setInputFiles({ name: 'expired.zip', mimeType: 'application/zip', buffer: Buffer.from('synthetic') });
      await page.getByText(/Unfinished copy expired. Retry to start a new copy./).first().waitFor();
      await fetch(`${base}/__test/failure`, { method: 'POST', body: JSON.stringify({ status: 0 }) });
      await page.getByRole('button', { name: 'Retry expired.zip', exact: true }).click();
      await page.locator('[data-file-id]').filter({ hasText: 'expired.zip' }).waitFor();
      await fetch(`${base}/__test/session`, { method: 'POST', body: JSON.stringify({ authenticated: false }) });
      await page.getByRole('button', { name: /Refresh/ }).click();
      await page.getByText('Welcome back.').waitFor();
      assert.equal(await page.locator('[data-file-id]').count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${artifacts}/MOCKED-session-expired-390.png`, fullPage: true });
      evidence.screenshots.push('MOCKED-session-expired-390.png');
      evidence.flows.push('507 full shelf; 410 expired partial; retry succeeds; expired session locks Inbox');
    });
    for (const status of [401, 403]) await t.test(`resume HEAD ${status} preserves fingerprint and original reservation through sign-in`, async () => {
      await fetch(`${base}/__test/reset`, { method: 'POST' });
      await page.goto(base);
      const name = `resume-auth-${status}.bin`;
      const source = `${artifacts}/${name}`;
      await writeFile(source, Buffer.alloc(24 * 1024 ** 2, status % 251));
      // Hold later chunks at the browser boundary so pause is deterministic on fast loopback.
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/uploads/**', async route => {
        if (route.request().method() === 'PATCH' && Number(route.request().headers()['upload-offset']) > 0) {
          await gate;
          await route.abort('aborted');
        } else await route.continue();
      });
      try {
        const chunk = page.waitForResponse(response => response.request().method() === 'PATCH' && response.status() === 204);
        await page.locator('#picker').setInputFiles(source);
        await chunk;
        await page.getByRole('button', { name: `Pause ${name}`, exact: true }).click();
        await page.getByText(/Paused · ready to resume/).waitFor();
      } finally {
        release();
        await page.unrouteAll({ behavior: 'wait' });
      }
      const before = await (await fetch(`${base}/__test/state`)).json();
      assert.equal(before.partialCount, 1);
      const partial = before.partials[0];
      assert.ok(partial.offset > 0 && partial.offset < partial.size);
      const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tus::'))));
      assert.equal(Object.keys(saved).length, 1);
      assert.equal(new URL(JSON.parse(Object.values(saved)[0]).uploadUrl, base).pathname, `/api/uploads/${partial.id}`);
      await fetch(`${base}/__test/resume-auth`, { method: 'POST', body: JSON.stringify({ status }) });
      await page.reload();
      const rejected = page.waitForResponse(response => response.request().method() === 'HEAD' && response.status() === status);
      await page.locator('#picker').setInputFiles(source);
      await rejected;
      await page.getByRole('link', { name: /Continue with Google/ }).waitFor();
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tus::')))), saved);
      const denied = await (await fetch(`${base}/__test/state`)).json();
      assert.deepEqual(denied.partials, before.partials);
      assert.equal(denied.reservedBytes, before.reservedBytes);
      assert.deepEqual(denied.uploadRequests.slice(before.uploadRequests.length).map(request => request.method), ['HEAD']);
      const screenshot = `MOCKED-resume-HEAD-${status}-login.png`;
      await page.screenshot({ path: `${artifacts}/${screenshot}`, fullPage: true });
      evidence.screenshots.push(screenshot);
      await page.getByRole('link', { name: /Continue with Google/ }).click();
      const resumed = page.waitForResponse(response => response.request().method() === 'HEAD' && response.status() === 200);
      await page.locator('#picker').setInputFiles(source);
      assert.equal(Number((await resumed).headers()['upload-offset']), partial.offset);
      await page.locator('[data-file-id]').filter({ hasText: name }).waitFor({ timeout: 30000 });
      const after = await (await fetch(`${base}/__test/state`)).json();
      const requests = after.uploadRequests.slice(before.uploadRequests.length);
      assert.equal(requests.filter(request => request.method === 'POST').length, 0);
      assert.ok(requests.every(request => request.path === `/api/uploads/${partial.id}`));
      assert.equal(Number(requests.find(request => request.method === 'PATCH').offset), partial.offset);
      assert.equal(after.partialCount, 0); assert.equal(after.reservedBytes, 0);
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tus::')))), {});
      evidence.flows.push({ status, originalId: partial.id, resumedOffset: partial.offset, extraCreations: 0, fingerprintPreserved: true, requests });
    });
    for (const failure of ['500', 'network']) await t.test(`failed logout ${failure} keeps upload selection usable without reload`, async () => {
      await fetch(`${base}/__test/reset`, { method: 'POST' });
      await page.goto(base);
      await page.setViewportSize({ width: failure === '500' ? 390 : 1440, height: 1000 });
      await page.route('**/auth/logout', route => failure === 'network'
        ? route.abort('failed')
        : route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic logout unavailable.' }) }));
      try {
        await page.getByRole('button', { name: /Sign out/ }).click();
        await page.locator('#notice.error').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#picker').count(), 1);
        const name = `after-logout-${failure}.bin`, payload = Buffer.alloc(1024 * 1024, 0x67);
        await page.locator('#picker').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: payload });
        const row = page.locator('[data-file-id]').filter({ hasText: name });
        await row.waitFor();
        const id = await row.getAttribute('data-file-id');
        const response = await fetch(`${base}/api/files/${id}/download`);
        assert.equal(response.status, 200);
        assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), createHash('sha256').update(payload).digest('hex'));
        const screenshot = `MOCKED-logout-${failure}-recovered.png`;
        await page.screenshot({ path: `${artifacts}/${screenshot}`, fullPage: true });
        evidence.screenshots.push(screenshot);
        evidence.flows.push({ logoutFailure: failure, uploadAfterFailure: name, hashMatches: true, reloaded: false });
      } finally { await page.unroute('**/auth/logout'); }
    });
    await t.test('successful logout locks dashboard and stops active and queued uploads', async () => {
      await fetch(`${base}/__test/reset`, { method: 'POST' });
      await page.goto(base);
      const chunk = page.waitForResponse(response => response.request().method() === 'PATCH' && response.status() === 204);
      await page.locator('#picker').setInputFiles([
        { name: 'logout-active.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(24 * 1024 ** 2, 0x68) },
        { name: 'logout-queued.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(1024, 0x69) },
      ]);
      await chunk;
      await page.getByRole('button', { name: /Sign out/ }).click();
      await page.getByRole('link', { name: /Continue with Google/ }).waitFor();
      assert.equal(await page.locator('#picker').count(), 0);
      // Wait past the mock's 600ms chunk delay to observe stopped queue behavior.
      await page.waitForTimeout(1500);
      const state = await (await fetch(`${base}/__test/state`)).json();
      assert.equal(state.authenticated, false);
      assert.equal(state.uploadRequests.filter(request => request.method === 'POST').length, 1);
      assert.equal(state.partialCount, 1);
      assert.ok(state.partials[0].offset < state.partials[0].size);
      assert.ok(state.reservedBytes > 0, 'sign-out preserves resumable partial reservation');
      const screenshot = 'MOCKED-logout-stopped.png';
      await page.screenshot({ path: `${artifacts}/${screenshot}`, fullPage: true });
      evidence.screenshots.push(screenshot);
      evidence.flows.push({ successfulLogout: true, queuedUploadStarted: false, partialPreserved: true });
    });
    assert.deepEqual(pageErrors, [], 'No uncaught browser errors');
  });
} finally {
  await writeFile(`${artifacts}/MOCKED-evidence.json`, JSON.stringify({ ...evidence, pageErrors }, null, 2));
  console.log(`MOCKED evidence: ${artifacts}/MOCKED-evidence.json`);
  await browser.close();
}
