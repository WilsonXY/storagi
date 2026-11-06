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
    const navigate = async (page: any, name: string) => {
      const nav = page.locator(
        name === 'settings'
          ? '.nav-item[data-view="settings"]'
          : `.nav-item[data-tab="${name}"]`,
      );
      if (!(await nav.isVisible())) await page.locator('#menu-btn').click();
      await nav.click();
      await page
        .locator(
          name === 'settings'
            ? '#settings'
            : name === 'text'
              ? '#text-shelf'
              : name === 'transfers'
                ? '#details'
                : '#inbox',
        )
        .waitFor({ state: 'visible' });
    };
    const settled = async (page: any) => {
      await page.evaluate(
        'Promise.all(document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))',
      );
    };
    const sender = await desktop.newPage();
    const receiver = await phone.newPage();
    let releaseLoading!: () => void;
    const loadingGate = new Promise<void>((resolve) => {
      releaseLoading = resolve;
    });
    let initialText = true;
    await sender.route('**/api/texts', async (route: any) => {
      if (initialText && route.request().method() === 'GET') {
        initialText = false;
        await loadingGate;
      }
      await route.continue();
    });
    for (const page of [sender, receiver]) {
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e: Error) => errors.push(e.message));
      await page.goto(origin + '/#text');
      await page.locator('#text-shelf').waitFor({ state: 'visible' });
      if (page === sender) {
        await sender
          .locator('#text-empty')
          .filter({ hasText: 'Loading' })
          .waitFor();
        await settled(sender);
        await sender.screenshot({
          path: path.join(artifacts, 'text-loading-1440.png'),
          fullPage: true,
        });
        releaseLoading();
        await sender
          .locator('#text-empty')
          .filter({ hasText: 'Text you send' })
          .waitFor();
        await sender.unroute('**/api/texts');
      }
    }
    // Owner's refinement: one navigation location and a quiet, recognisable koi surface.
    for (const page of [sender, receiver]) {
      assert.equal(
        await page.locator('.center .tabs, .text-intro').count(),
        0,
        'no repeated shelf navigation or hero',
      );
      assert.equal(
        await page.locator('#text-shelf h2, #text-shelf h3').count(),
        0,
        'no redundant Text headings',
      );
      await page.locator('#text-pond').waitFor({ state: 'visible' });
      assert.equal(
        await page
          .locator('#text-draft')
          .evaluate((el: HTMLElement) => getComputedStyle(el).resize),
        'none',
      );

      await page.waitForFunction(
        "(() => {const c=document.querySelector('#text-pond');if(!c?.width||!c?.height)return false;return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)})()",
      );
    }
    await sender.screenshot({
      path: path.join(artifacts, 'text-empty-1440.png'),
      fullPage: true,
    });
    await receiver.screenshot({
      path: path.join(artifacts, 'text-empty-390.png'),
      fullPage: true,
    });
    await receiver.locator('#text-draft').fill('Keyboard probe');
    await receiver.locator('#text-draft').focus();
    const focusStyle = await receiver
      .locator('#text-draft')
      .evaluate((el: HTMLElement) => {
        const style = getComputedStyle(el);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      });
    assert.equal(focusStyle.outline, 'none', 'no red or orange input outline');
    const focusColor = focusStyle.shadow.match(/rgb\((\d+), (\d+), (\d+)\)/);
    assert.ok(
      focusColor &&
        focusColor[1] === focusColor[2] &&
        focusColor[2] === focusColor[3],
      'input keeps a neutral visible focus cue',
    );
    await receiver.screenshot({
      path: path.join(artifacts, 'text-input-focus-390.png'),
      fullPage: true,
    });
    await receiver.keyboard.press('Tab');
    assert.equal(
      await receiver.evaluate(() => document.activeElement?.id),
      'text-send',
      'composer keyboard order follows visible order',
    );
    await receiver.locator('#text-draft').fill('');
    await receiver.evaluate(() =>
      (document.activeElement as HTMLElement)?.blur(),
    );
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
    const copyControl = receiver.getByRole('button', {
      name: 'Copy text',
      exact: true,
    });
    assert.equal(
      (await copyControl.textContent()).trim(),
      '',
      'Copy is an icon rather than a text label',
    );
    assert.equal(await copyControl.locator('svg').count(), 1);
    const pickup = await copyControl.boundingBox();
    const expiry = await receiver.locator('.text-expiry').boundingBox();
    assert.ok(
      expiry && pickup && expiry.x < pickup.x,
      'expiry is left of the right-aligned copy icon',
    );
    assert.ok(
      pickup && pickup.y >= 0 && pickup.y + pickup.height <= 844,
      'phone pickup action is visible without scrolling',
    );
    const water = await receiver.locator('#text-pond').boundingBox();
    assert.ok(
      water &&
        pickup &&
        water.y + water.height > pickup.y + pickup.height + 100,
      'phone koi have open water beyond the input and first card',
    );
    assert.ok(
      water!.height >= 844 - 80 && water!.height <= 844,
      'pond covers the available phone viewport without a long-list-sized canvas',
    );
    await receiver.screenshot({
      path: path.join(artifacts, 'text-phone-390.png'),
      fullPage: true,
    });
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
    await sender.locator('#notice').waitFor({ state: 'visible' });
    await settled(sender);
    await sender.screenshot({
      path: path.join(artifacts, 'text-copied-1440.png'),
      fullPage: true,
    });

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
    await receiver.screenshot({
      path: path.join(artifacts, 'text-clipboard-fallback-390.png'),
      fullPage: true,
    });
    for (const [width, height] of [
      [390, 844],
      [728, 900],
      [1440, 1000],
      [1920, 1080],
    ]) {
      await sender.setViewportSize({ width, height });
      assert.ok(
        await sender.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `no overflow at ${width}`,
      );
      await sender.evaluate(() => window.scrollTo(0, 0));
      await sender.screenshot({
        path: path.join(artifacts, `text-${width}.png`),
        fullPage: true,
      });
    }
    // Sidebar navigation stays available at the old sidebar/transfer-panel breakpoint.
    await sender.setViewportSize({ width: 1000, height: 900 });
    await navigate(sender, 'transfers');
    assert.equal(
      await sender.locator('.nav-item[data-tab="transfers"]').isVisible(),
      true,
    );
    await navigate(sender, 'text');
    await receiver.locator('#menu-btn').click();
    await receiver.screenshot({
      path: path.join(artifacts, 'text-menu-390.png'),
      fullPage: true,
    });
    await receiver.locator('.nav-item[data-tab="inbox"]').click();
    await receiver.locator('#inbox').waitFor({ state: 'visible' });
    await navigate(receiver, 'text');
    await sender.setViewportSize({ width: 1440, height: 1000 });
    await receiver.screenshot({
      path: path.join(artifacts, 'text-menu-focus-390.png'),
      fullPage: true,
    });
    assert.equal(
      await receiver.evaluate(() => document.activeElement?.id),
      'page-title',
    );
    await receiver.locator('#text-draft').fill('x'.repeat(60 * 1024));
    assert.equal(await receiver.locator('#text-count').isVisible(), true);
    await settled(receiver);
    await receiver.screenshot({
      path: path.join(artifacts, 'text-near-limit-390.png'),
      fullPage: true,
    });
    await receiver.locator('#text-draft').fill('x'.repeat(65 * 1024));
    assert.equal(await receiver.locator('#text-send').isDisabled(), true);
    await receiver.screenshot({
      path: path.join(artifacts, 'text-over-limit-390.png'),
      fullPage: true,
    });
    await receiver.locator('#text-draft').fill('');
    const exact =
      '  A note from the phone\nsecond line 🐟\n' +
      Array.from(
        { length: 18 },
        (_, i) => `Detail ${i + 1}: synthetic handoff notes.`,
      ).join('\n') +
      '  ';

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
    await settled(sender);
    await sender.screenshot({
      path: path.join(artifacts, 'text-long-1440.png'),
      fullPage: true,
    });
    await receiver.screenshot({
      path: path.join(artifacts, 'text-long-390.png'),
      fullPage: true,
    });
    await sender
      .getByRole('searchbox', { name: 'Search text' })
      .fill('second line');
    assert.equal(await sender.locator('#text-items article').count(), 1);
    await sender.getByRole('searchbox').fill('nothing-matches-this-query');
    assert.equal(await sender.locator('#text-items article').count(), 0);
    await sender.screenshot({
      path: path.join(artifacts, 'text-no-match-1440.png'),
      fullPage: true,
    });
    await sender.getByRole('searchbox').fill('');
    await sender.locator('[data-text-delete]').first().click();
    await settled(sender);
    await sender.screenshot({
      path: path.join(artifacts, 'text-delete-1440.png'),
      fullPage: true,
    });
    await sender.locator('[data-text-cancel]').first().click();
    assert.equal(await sender.locator('#text-items article').count(), 2);
    await sender.locator('[data-text-delete]').first().click();
    await sender.locator('[data-text-confirm]').first().click();
    await receiver
      .locator('#text-items article')
      .nth(1)
      .waitFor({ state: 'detached' });
    assert.equal(await receiver.locator('#text-items article').count(), 1);
    await sender.locator('#notice').waitFor({ state: 'detached' });
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
    await settled(sender);
    await sender.screenshot({
      path: path.join(artifacts, 'text-error-1440.png'),
      fullPage: true,
    });
    await sender.unroute('**/api/texts');
    // A fresh receiver page keeps gesture proof separate from clipboard recovery.
    await receiver.reload();
    await receiver.locator('[data-text-copy]').waitFor();
    // A native phone touch swipe uses the same red reveal and Undo rhythm as Inbox.
    const cdp = await phone.newCDPSession(receiver);
    const swipe = async (distance: number, cancel = false, capture = false) => {
      const row = receiver.locator('#text-items article').first();
      await row.scrollIntoViewIfNeeded();
      const box = await row.locator('.text-card-actions').boundingBox();
      const x = box.x + box.width * 0.65,
        y = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 6; step++)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x - (distance * step) / 6, y }],
        });
      if (capture)
        await receiver.screenshot({
          path: path.join(artifacts, 'text-swipe-390.png'),
          fullPage: true,
        });
      await cdp.send('Input.dispatchTouchEvent', {
        type: cancel ? 'touchCancel' : 'touchEnd',
        touchPoints: [],
      });
      await settled(receiver);
    };
    await swipe(35);
    assert.equal(
      await receiver.locator('[data-text-undo]').isVisible(),
      false,
      'short swipe snaps back',
    );
    await swipe(220, true);
    assert.equal(
      await receiver.locator('[data-text-undo]').isVisible(),
      false,
      'cancelled swipe keeps text',
    );
    await swipe(220, false, true);
    await receiver.locator('[data-text-undo]').waitFor();
    await receiver.screenshot({
      path: path.join(artifacts, 'text-swipe-undo-390.png'),
      fullPage: true,
    });
    await receiver.locator('[data-text-undo]').click();
    await receiver.locator('[data-text-copy]').waitFor();
    assert.equal(
      await receiver.locator('#text-items article').count(),
      1,
      'Undo restores text',
    );
    await receiver.evaluate(() =>
      localStorage.setItem('storagi.gestures', 'off'),
    );
    await swipe(220);
    assert.equal(
      await receiver.locator('[data-text-undo]').isVisible(),
      false,
      'gesture preference off keeps text',
    );
    await receiver.evaluate(() =>
      localStorage.setItem('storagi.gestures', 'on'),
    );
    await swipe(220);
    await receiver.locator('[data-text-undo]').waitFor();
    await receiver
      .locator('#text-items article')
      .waitFor({ state: 'detached' });
    await sender.locator('#text-items article').waitFor({ state: 'detached' });
    await cdp.detach();
    // The existing file shelf still uploads and lists files.
    await navigate(sender, 'inbox');
    await sender.locator('#picker').setInputFiles({
      name: 'handoff-proof.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('synthetic file'),
    });
    await sender
      .locator('#groups .row')
      .filter({ hasText: 'handoff-proof' })
      .waitFor();
    await navigate(sender, 'text');
    await sender.locator('#text-draft').fill('Synthetic scroll proof');
    await sender.locator('#text-send').click();
    await sender.locator('#text-error').waitFor({ state: 'hidden' });
    await sender.evaluate(async () => {
      const session = await (await fetch('/api/session')).json();
      for (let i = 0; i < 15; i++) {
        const response = await fetch('/api/texts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': session.csrfToken,
          },
          body: JSON.stringify({
            text: `Synthetic note ${i + 1}\nFull-page koi scroll proof.`,
          }),
        });
        if (!response.ok)
          throw new Error(`Fixture send failed: ${response.status}`);
      }
    });
    await sender.locator('#refresh').click();
    await sender.locator('#text-items article').nth(14).waitFor();
    await sender.setViewportSize({ width: 1440, height: 1400 });
    await sender.evaluate(() => window.scrollTo(0, 0));
    await sender.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await sender.locator('#notice').waitFor({ state: 'detached' });
    const tallPond = await sender.locator('#text-pond').boundingBox();
    assert.ok(
      tallPond && tallPond.y <= 80 && tallPond.y + tallPond.height >= 1395,
      'koi fills tall desktop beyond old 640px cap',
    );
    await sender.screenshot({
      path: path.join(artifacts, 'text-tall-1440.png'),
    });
    await sender.locator('#text-items article').last().scrollIntoViewIfNeeded();
    await sender.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const scrolledPond = await sender.locator('#text-pond').boundingBox();
    assert.ok(
      scrolledPond &&
        scrolledPond.y <= 80 &&
        scrolledPond.y + scrolledPond.height >= 1395 &&
        scrolledPond.height <= 1400,
      'koi follows long-list scrolling with a viewport-sized canvas',
    );
    await sender.screenshot({
      path: path.join(artifacts, 'text-scrolled-1440.png'),
    });
    await sender.setViewportSize({ width: 1440, height: 1000 });
    now += 86400001;
    await app.cleanup();
    await sender.locator('#refresh').click();
    await sender.waitForFunction(
      () => document.querySelectorAll('#text-items article').length === 0,
    );
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
            'native phone touch swipe short/cancel/Undo/commit and cross-device deletion',
            'safe external link opens',
            'exact clipboard copy',
            'denied clipboard native selection',
            '390/728/1440/1920 no overflow',
            'phone to desktop exact multiline Unicode',
            'search',
            'delete cancel/confirm and cross-device disappearance',
            'failed send preserves draft',
            'existing file upload',
            'expiry cleanup',
            'unauthenticated denial',
            'full-height desktop koi and viewport-sized long-list scrolling',
            'zero browser errors',
            'sidebar/menu-only navigation including 1000px Transfers',
            'real koi canvas on desktop and phone',
            'quiet hierarchy without central tabs or repeated headings',
            'composer keyboard order',
            'full viewport koi, neutral input focus, right-aligned icon Copy and left expiry, grip-free auto-grow',
            'settled loading/copy/delete/near-limit/long-text/error proof',
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
