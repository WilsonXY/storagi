// Actual built dashboard and service; synthetic signed owner identity, isolated data, loopback only.
// Build web first, then run with server/node_modules/.bin/tsx --test scripts/acceptance-text-browser.test.ts.
// Optional browser installation follows scripts/acceptance-browser.mjs; no production authentication bypass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';

test('text moves between two browser devices using the actual authenticated service', async () => {
  const artifacts = path.resolve('artifacts/text-handoff');
  const temp = path.join(homedir(), '.cache/storagi/tmp');
  await mkdir(temp, { recursive: true });
  await mkdir(artifacts, { recursive: true });
  const dir = await mkdtemp(path.join(temp, 'text-browser-'));
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const id = await identity();
  let now = Date.now();
  const app = await createApp(
    {
      origin,
      clientId: 'synthetic-client',
      clientSecret: 'synthetic-secret',
      ownerSub: '123',
      dataDir: dir,
      budgetBytes: 1024 ** 2,
      diskReserveBytes: 1,
      port,
    },
    {
      oidc: id.config,
      now: () => now,
      freeBytes: () => 1e9,
      webDir: path.resolve('web/dist'),
    },
  );
  let browser: any;
  const errors: string[] = [];
  try {
    app.server.listen(port, '127.0.0.1');
    await once(app.server, 'listening');
    const { chromium } = await import(
      pathToFileURL(
        process.env.PLAYWRIGHT_MODULE ||
          path.join(
            homedir(),
            '.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs',
          ),
      ).href
    );
    browser = await chromium.launch({
      executablePath:
        process.env.CHROME_EXECUTABLE ||
        path.join(
          homedir(),
          '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
        ),
      args: ['--no-sandbox'],
      headless: true,
    });
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    for (const context of [desktop, phone]) {
      const flow = await app.auth.begin();
      const params = new URL(flow.url).searchParams;
      id.set({ nonce: params.get('nonce')! });
      const signed = await app.auth.callback(
        flow.token,
        new URL(
          `${origin}/auth/callback?code=synthetic&state=${params.get('state')}`,
        ),
      );
      await context.addCookies([
        {
          name: '__Host-storagi-session',
          value: signed.token,
          domain: '127.0.0.1',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }
    const sender = await desktop.newPage();
    const receiver = await phone.newPage();
    for (const page of [sender, receiver]) {
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e: Error) => errors.push(e.message));
      await page.goto(origin + '/#text');
      await page.locator('#text-shelf').waitFor({ state: 'visible' });
    }
    const link = 'https://example.com/read/chapter-42/';
    await sender.locator('#text-draft').fill(link);
    await sender.locator('#text-send').click();
    await sender.locator('#text-items pre').filter({ hasText: link }).waitFor();
    // The receiving page needs no manual refresh. Allow its five-second poll.
    await receiver
      .locator('#text-items pre')
      .filter({ hasText: link })
      .waitFor();
    assert.equal(
      await receiver.locator('[data-text-open]').getAttribute('href'),
      link,
    );
    const pickup = await receiver.locator('[data-text-copy]').boundingBox();
    assert.ok(
      pickup && pickup.y >= 0 && pickup.y + pickup.height <= 844,
      'phone pickup action is visible without scrolling',
    );
    await receiver.locator('.tabs [data-tab="text"]').focus();
    await receiver.keyboard.press('Tab');
    assert.equal(
      await receiver.evaluate(() => document.activeElement?.id),
      'text-new',
    );
    await receiver.keyboard.press('Tab');
    assert.equal(
      await receiver.evaluate(() => document.activeElement?.tagName),
      'PRE',
    );
    await receiver.keyboard.press('Tab');
    assert.ok(
      await receiver
        .locator('[data-text-copy]')
        .evaluate((el: HTMLElement) => el === document.activeElement),
      'keyboard reaches visible pickup before composer',
    );
    await receiver.locator('#text-new').click();
    assert.equal(
      await receiver.evaluate(() => document.activeElement?.id),
      'text-draft',
    );
    // Open in a new tab; intercept only the external navigation, never contact that site.
    await phone.route('https://example.com/**', (route: any) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<p>Synthetic destination for open-link proof</p>',
      }),
    );
    const popup = receiver.waitForEvent('popup');
    await receiver.locator('[data-text-open]').click();
    const opened = await popup;
    await opened.waitForLoadState();
    assert.equal(opened.url(), link);
    await opened.close();
    await sender.locator('[data-text-copy]').click();
    assert.equal(
      await sender.evaluate(() => navigator.clipboard.readText()),
      link,
    );
    // Denied clipboard on a phone still leaves an explicit native selection path.
    await receiver.evaluate(
      "Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:()=>Promise.reject(new Error('Synthetic clipboard denial'))}})",
    );
    await receiver.locator('[data-text-copy]').click();
    await receiver.locator('.text-copy-fallback').waitFor();
    assert.equal(
      await receiver.locator('.text-copy-fallback').inputValue(),
      link,
    );
    await sender.locator('#notice').waitFor({ state: 'detached' });
    for (const [width, height] of [
      [390, 844],
      [728, 900],
      [1440, 1000],
    ]) {
      await sender.setViewportSize({ width, height });
      assert.ok(
        await sender.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `no overflow at ${width}`,
      );
      await sender.locator('.tabs [data-tab="text"]').scrollIntoViewIfNeeded();
      await sender.screenshot({
        path: path.join(artifacts, `text-${width}.png`),
        fullPage: true,
      });
    }
    const exact = '  A note from the phone\nsecond line 🐟  ';
    await receiver.locator('#text-draft').fill(exact);
    await receiver.locator('#text-send').click();
    await sender
      .locator('#text-items pre')
      .filter({ hasText: 'A note from the phone' })
      .waitFor();
    assert.equal(
      await sender.locator('#text-items pre').first().textContent(),
      exact,
    );
    await sender
      .getByRole('searchbox', { name: 'Search text' })
      .fill('second line');
    assert.equal(await sender.locator('#text-items article').count(), 1);
    await sender.getByRole('searchbox').fill('');
    await sender.locator('[data-text-delete]').first().click();
    await sender.locator('[data-text-cancel]').first().click();
    assert.equal(await sender.locator('#text-items article').count(), 2);
    await sender.locator('[data-text-delete]').first().click();
    await sender.locator('[data-text-confirm]').first().click();
    await receiver
      .locator('#text-items article')
      .nth(1)
      .waitFor({ state: 'detached' });
    assert.equal(await receiver.locator('#text-items article').count(), 1);
    // An unavailable host retains a draft and exposes a useful error.
    await sender.route('**/api/texts', (route: any) =>
      route.request().method() === 'POST'
        ? route.abort('failed')
        : route.continue(),
    );
    await sender.locator('#text-draft').fill('keep this draft');
    await sender.locator('#text-send').click();
    await sender.locator('#text-error').waitFor({ state: 'visible' });
    assert.equal(
      await sender.locator('#text-draft').inputValue(),
      'keep this draft',
    );
    await sender.unroute('**/api/texts');
    // The existing file shelf still uploads and lists files.
    await sender.locator('.tabs [data-tab="inbox"]').click();
    await sender.locator('#picker').setInputFiles({
      name: 'handoff-proof.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('synthetic file'),
    });
    await sender
      .locator('#groups .row')
      .filter({ hasText: 'handoff-proof' })
      .waitFor();
    await sender.locator('.tabs [data-tab="text"]').click();
    now += 86400001;
    await app.cleanup();
    await sender.locator('#refresh').click();
    await sender.locator('#text-items article').waitFor({ state: 'detached' });
    assert.equal((await fetch(origin + '/api/texts')).status, 401);
    assert.deepEqual(errors, []);
    await writeFile(
      path.join(artifacts, 'result.json'),
      JSON.stringify(
        {
          kind: 'actual dashboard + service; synthetic signed owner identity; two isolated browser contexts',
          passed: true,
          checks: [
            'desktop to phone automatic receipt',
            'safe external link opens',
            'exact clipboard copy',
            'denied clipboard native selection',
            '390/728/1440 no overflow',
            'phone to desktop exact multiline Unicode',
            'search',
            'delete cancel/confirm and cross-device disappearance',
            'failed send preserves draft',
            'existing file upload',
            'expiry cleanup',
            'unauthenticated denial',
            'zero browser errors',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
