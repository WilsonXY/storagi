// Real built dashboard and service; synthetic signed identity and empty file fixtures only.
// npm run build --prefix web
// TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test scripts/acceptance-retention-browser.test.ts
// Optional local playwright-core and Chromium: see acceptance-browser.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from '../server/src/app.js';
import { identity } from '../server/test/helpers.js';
import { DAY } from '../server/src/storage.js';

test('retention Settings uses a styled duration menu, real atomic saves and native confirmation at desktop and phone widths', async () => {
  const artifacts = path.resolve(
    process.env.STORAGI_ARTIFACT_DIR || 'artifacts/retention',
  );
  await mkdir(artifacts, { recursive: true });
  const dir = await mkdtemp(path.join(tmpdir(), 'retention-browser-'));
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
      port,
      dataDir: dir,
      clientId: 'synthetic-client',
      clientSecret: 'synthetic-secret',
      ownerSub: '123',
      budgetBytes: 1000,
      diskReserveBytes: 1,
    },
    {
      oidc: id.config,
      now: () => now,
      freeBytes: () => 1e9,
      webDir: path.resolve('web/dist'),
    },
  );
  let browser: any;
  const errors: string[] = [],
    saves: { status: number; body: unknown }[] = [];
  try {
    app.server.listen(port, '127.0.0.1');
    await once(app.server, 'listening');
    const flow = await app.auth.begin();
    const params = new URL(flow.url).searchParams;
    id.set({ sub: '123', nonce: params.get('nonce')! });
    const signed = await app.auth.callback(
      flow.token,
      new URL(
        `${origin}/auth/callback?code=synthetic&state=${params.get('state')}`,
      ),
    );
    const { chromium } = await import(
      pathToFileURL(
        process.env.PLAYWRIGHT_MODULE ||
          `${homedir()}/.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs`,
      ).href
    );
    browser = await chromium.launch({
      executablePath:
        process.env.CHROME_EXECUTABLE ||
        `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
      args: ['--no-sandbox'],
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const cookie = {
      name: '__Host-storagi-session',
      value: signed.token,
      domain: '127.0.0.1',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    };
    await context.addCookies([cookie]);
    const markSyntheticProof = () =>
      document.addEventListener('DOMContentLoaded', () => {
        const banner = document.createElement('div');
        banner.dataset.syntheticProof = 'true';
        banner.textContent =
          'SYNTHETIC PROOF · Real dashboard and service · Signed test identity · Empty sample files';
        banner.style.cssText =
          'padding:6px 12px;background:#24584b;color:#fff;font:12px sans-serif;text-align:center';
        document.body.prepend(banner);
      });
    await context.addInitScript(markSyntheticProof);
    app.storage.saveRetention(60);
    for (const [i, age] of [0, 7 * DAY - 1, 8 * DAY, 15 * DAY].entries()) {
      const file = randomUUID();
      app.storage.reserve(file, `synthetic-copy-${i}.txt`, 0);
      await writeFile(path.join(app.storage.filesDir, file), '');
      app.storage.complete(file, now - age);
    }
    const before = app.storage.rows();
    const page = await context.newPage();
    const navigate = async (selector: string) => {
      if (await page.locator('#menu-btn').isVisible())
        await page.locator('#menu-btn').click();
      await page.locator(selector).click();
    };
    const chooseDays = async (days: number) => {
      await page.locator('#retention-days').click();
      await page
        .getByRole('option', {
          name: `${days} ${days === 1 ? 'day' : 'days'}`,
          exact: true,
        })
        .click();
    };
    page.on('pageerror', (e: Error) => errors.push(e.message));
    page.on('response', async (r: any) => {
      if (new URL(r.url()).pathname === '/api/settings')
        saves.push({ status: r.status(), body: r.request().postDataJSON() });
    });
    await page.goto(origin);
    await page
      .locator('#retention-days:not([disabled])')
      .waitFor({ state: 'attached' });
    for (const [width, height] of [
      [1440, 1000],
      [728, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await navigate('.nav-item[data-tab="inbox"]');
      const inboxRight = await page
        .locator('#fresh')
        .evaluate((el) => el.getBoundingClientRect().right);
      await navigate('#nav-settings');
      const settingsEdge = await page.locator('#fresh').evaluate((el) => {
        const header = el.closest('header')!;
        return {
          right: el.getBoundingClientRect().right,
          expected:
            header.getBoundingClientRect().right -
            parseFloat(getComputedStyle(header).paddingRight),
        };
      });
      assert.ok(
        Math.abs(settingsEdge.right - inboxRight) < 1,
        `Settings status matches Inbox at ${width}px`,
      );
      assert.ok(
        Math.abs(settingsEdge.right - settingsEdge.expected) < 1,
        `Settings status respects the right header padding at ${width}px`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(
      await page.locator('#retention-days').getAttribute('value'),
      '60',
    );
    assert.equal(await page.locator('#retention-save').isDisabled(), true);
    assert.ok(
      await page
        .locator('#retention-save')
        .evaluate((el) => Number(getComputedStyle(el).opacity) < 1),
    );
    await chooseDays(7);
    assert.equal(await page.locator('#retention-save').isDisabled(), false);
    await chooseDays(60);
    assert.equal(await page.locator('#retention-save').isDisabled(), true);
    await chooseDays(7);
    await navigate('.nav-item[data-tab="inbox"]');
    await navigate('#nav-settings');
    assert.equal(
      await page.locator('#retention-days').getAttribute('value'),
      '60',
    );
    assert.equal(await page.locator('#retention-save').isDisabled(), true);
    const triggerBounds = await page.locator('#retention-days').boundingBox();
    await page.mouse.move(
      triggerBounds!.x + triggerBounds!.width / 2,
      triggerBounds!.y + triggerBounds!.height / 2,
    );
    await page.mouse.down();
    assert.equal(
      await page
        .locator('#retention-days')
        .evaluate((el) => getComputedStyle(el).transform),
      'none',
      'pressing the duration trigger has no scale motion',
    );
    await page.mouse.up();
    assert.deepEqual(
      await page.locator('#retention-options').evaluate((el) => ({
        name: getComputedStyle(el).animationName,
        active: el.getAnimations().length,
      })),
      { name: 'none', active: 0 },
      'the real duration menu has no opening animation',
    );
    await page.keyboard.press('Escape');
    await page.screenshot({
      path: path.join(artifacts, 'settings-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    const controls = await page.evaluate(() => {
      const trigger = document
        .querySelector('#retention-days')!
        .getBoundingClientRect();
      const save = document
        .querySelector('#retention-save')!
        .getBoundingClientRect();
      return { trigger: trigger.height, save: save.height, width: save.width };
    });
    assert.deepEqual(controls, { trigger: 34, save: 34, width: 34 });
    await page.locator('#retention-days').focus();
    await page.keyboard.press('Enter');
    assert.equal(
      await page.evaluate(
        () => (document.activeElement as HTMLButtonElement)?.value,
      ),
      '60',
    );
    await page.keyboard.press('End');
    await page.keyboard.press('Space');
    assert.equal(
      await page.locator('#retention-days').getAttribute('value'),
      '90',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    assert.equal(
      await page.locator('#retention-days').getAttribute('value'),
      '1',
    );
    assert.equal(saves.length, 0, 'choosing a duration never submits the form');
    await chooseDays(60);
    await page.locator('#retention-days').click();
    await page
      .locator('#retention-options [value="60"]')
      .evaluate((el) => (el as HTMLElement).blur());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#retention-options').isVisible(), false);
    await page.locator('#retention-days').click();
    await page
      .locator('#retention-options [value="60"]')
      .evaluate((el) =>
        el.dispatchEvent(
          new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
        ),
      );
    assert.equal(await page.locator('#retention-options').isVisible(), true);
    await page.getByRole('option', { name: '7 days', exact: true }).click();
    assert.equal(
      await page.locator('#retention-days').getAttribute('value'),
      '7',
    );
    await chooseDays(60);
    await page.locator('#retention-days').click();
    for (const [width, height] of [
      [1440, 1000],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (width === 390)
        assert.equal(
          await page
            .getByRole('option', { name: '1 day', exact: true })
            .evaluate((el: HTMLElement) => el.getBoundingClientRect().height),
          44,
        );
      await page.screenshot({
        path: path.join(artifacts, `duration-menu-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.keyboard.press('Escape');
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'retention-days',
    );
    await chooseDays(7);
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'retention-save',
    );
    assert.equal(await page.locator('#retention-options').isVisible(), false);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#retention-options').isVisible(), false);
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest('.retention-picker') === null,
      ),
      true,
    );
    for (const [width, height] of [
      [844, 390],
      [740, 360],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator('#retention-days').click();
      await page.keyboard.press('End');
      await page
        .locator('#retention-options')
        .evaluate((el) =>
          Promise.all(
            el.getAnimations().map((animation) => animation.finished),
          ),
        );
      const bounds = await page.locator('#retention-options').evaluate((el) => {
        const menu = el.getBoundingClientRect(),
          option = document.activeElement!.getBoundingClientRect();
        return {
          top: menu.top,
          bottom: menu.bottom,
          optionBottom: option.bottom,
        };
      });
      assert.ok(
        bounds.top >= 0 &&
          bounds.bottom <= height &&
          bounds.optionBottom <= height,
        `menu and last option fit ${width}×${height}`,
      );
      await page.screenshot({
        path: path.join(artifacts, `duration-menu-${width}.png`),
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await chooseDays(7);
    await page.locator('#retention-save').click();
    await page.locator('#retention-confirm[open]').waitFor();
    assert.equal(await page.locator('#retention-save.is-saved').count(), 0);
    assert.deepEqual(
      await page.evaluate(() =>
        [
          'retention-title',
          'retention-note',
          'retention-cancel',
          'retention-apply',
        ].map((id) => getComputedStyle(document.getElementById(id)!).fontSize),
      ),
      ['15px', '13px', '13px', '13px'],
    );

    assert.match(
      await page.locator('#retention-note').innerText(),
      /2 files will be permanently deleted/,
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'retention-cancel',
    );
    assert.deepEqual(app.storage.rows(), before);
    assert.equal(app.storage.retentionDays(), 60);
    for (const [width, height] of [
      [1440, 1000],
      [728, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: path.join(artifacts, `confirmation-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.keyboard.press('Escape');
    await page.locator('#retention-confirm').waitFor({ state: 'hidden' });
    assert.deepEqual(app.storage.rows(), before);
    assert.equal(saves.length, 1);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'retention-save',
    );
    await page.locator('#retention-save').click();
    await page.locator('#retention-confirm[open]').waitFor();
    await page.locator('#retention-cancel').click();
    assert.deepEqual(app.storage.rows(), before);
    await chooseDays(14);
    await page.locator('#retention-save').click();
    await page.locator('#retention-confirm[open]').waitFor();
    assert.match(
      await page.locator('#retention-note').innerText(),
      /1 file will be permanently deleted/,
    );
    assert.deepEqual(saves.at(-1)?.body, {
      retentionDays: 14,
      confirmDeletes: 0,
    });
    await page.locator('#retention-cancel').click();
    await chooseDays(7);
    await page.locator('#retention-save').click();
    await page.locator('#retention-confirm[open]').waitFor();
    now += 1;
    await page.locator('#retention-apply').click();
    await page
      .locator('#retention-note')
      .filter({ hasText: '3 files' })
      .waitFor();
    assert.deepEqual(app.storage.rows(), before);
    assert.equal(app.storage.retentionDays(), 60);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'retention-cancel',
    );
    await page.screenshot({
      path: path.join(artifacts, 'confirmation-increased-phone.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.locator('#retention-apply').click();
    await page
      .locator('#retention-save[disabled][aria-busy="false"]')
      .waitFor();
    const sampleFeedback = () =>
      page.locator('#retention-save').evaluate((el) => {
        const animations = el
          .getAnimations({ subtree: true })
          .filter((a) => a instanceof CSSAnimation);
        const duration = Math.max(
          ...animations.map((a) => Number(a.effect!.getTiming().duration)),
        );
        const samples = [0, duration / 2, duration - 1].map((time) => {
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = time;
          }
          const rect = el.getBoundingClientRect();
          return {
            colorOpacity: Number(getComputedStyle(el, '::before').opacity),
            transform: getComputedStyle(el).transform,
            width: rect.width,
            height: rect.height,
          };
        });
        for (const animation of animations)
          animation.currentTime = duration / 2;
        return {
          saved: el.classList.contains('is-saved'),
          count: animations.length,
          duration,
          backgroundImage: getComputedStyle(el, '::before').backgroundImage,
          color: getComputedStyle(el, '::before').backgroundColor,
          disabled: (el as HTMLButtonElement).disabled,
          samples,
        };
      });
    const pulse = await sampleFeedback();
    assert.equal(pulse.saved, true);
    assert.equal(pulse.disabled, true);
    assert.ok(pulse.count > 0);
    assert.ok(pulse.duration >= 600 && pulse.duration <= 1200);
    assert.equal(pulse.backgroundImage, 'none');
    assert.equal(pulse.color, 'rgb(63, 192, 122)');
    assert.ok(pulse.samples[0].colorOpacity < 0.1);
    assert.ok(pulse.samples[1].colorOpacity > 0.5);
    assert.ok(pulse.samples[2].colorOpacity < 0.1);
    for (const sample of pulse.samples) {
      assert.equal(sample.transform, 'none');
      assert.equal(sample.width, pulse.samples[0].width);
      assert.equal(sample.height, pulse.samples[0].height);
    }
    await page.screenshot({
      path: path.join(artifacts, 'save-pulse-peak-phone.png'),
      fullPage: true,
      animations: 'allow',
    });
    await page.locator('#retention-save').evaluate((el) => {
      for (const animation of el.getAnimations({ subtree: true }))
        animation.play();
    });
    await page
      .locator('#retention-save.is-saved')
      .waitFor({ state: 'detached' });
    assert.ok(
      await page
        .locator('#retention-save')
        .evaluate((el) => Number(getComputedStyle(el).opacity) < 1),
    );
    assert.equal(await page.locator('#retention-status').textContent(), '');
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'retention-days',
      'completed save restores keyboard focus',
    );
    assert.equal(
      await page.locator('#retention-days').getAttribute('value'),
      '7',
    );
    assert.equal(app.storage.retentionDays(), 7);
    assert.equal(
      app.storage
        .rows()
        .filter((r) => r.uploadedAt !== null && r.expiresAt > now).length,
      1,
    );
    await page.screenshot({
      path: path.join(artifacts, 'saved-phone.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await chooseDays(60);
    await page.locator('#retention-save').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#retention-copy')
        ?.textContent?.includes('60 days'),
    );
    assert.equal(await page.locator('#retention-save').isDisabled(), true);
    assert.equal(
      await page
        .locator('#retention-confirm')
        .evaluate((el: HTMLDialogElement) => el.open),
      false,
    );
    assert.equal(
      app.storage
        .rows()
        .filter((r) => r.uploadedAt !== null && r.expiresAt > now).length,
      1,
      'lengthening does not revive the three expired copies',
    );
    const other = await browser.newContext();
    await other.addCookies([cookie]);
    const device = await other.newPage();
    await device.goto(origin);
    await device.waitForFunction(() =>
      document
        .querySelector('#retention-copy')
        ?.textContent?.includes('60 days'),
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await chooseDays(90);
    await page.locator('#retention-save').click();
    await page.locator('#retention-save.is-saved').waitFor();
    const reduced = await sampleFeedback();
    assert.equal(reduced.count, pulse.count);
    assert.equal(reduced.duration, pulse.duration);
    assert.deepEqual(reduced.samples, pulse.samples);
    assert.equal(reduced.backgroundImage, 'none');
    assert.equal(reduced.color, pulse.color);
    assert.equal(reduced.disabled, true);
    assert.ok(reduced.samples[0].colorOpacity < 0.1);
    assert.ok(reduced.samples[1].colorOpacity > 0.5);
    assert.ok(reduced.samples[2].colorOpacity < 0.1);
    for (const sample of reduced.samples) {
      assert.equal(sample.transform, 'none');
      assert.equal(sample.width, reduced.samples[0].width);
      assert.equal(sample.height, reduced.samples[0].height);
    }
    await page.screenshot({
      path: path.join(artifacts, 'save-feedback-reduced-motion.png'),
      fullPage: true,
      animations: 'allow',
    });
    await page.locator('#retention-save').evaluate((el) => {
      for (const animation of el.getAnimations({ subtree: true }))
        animation.play();
    });
    await page
      .locator('#retention-save.is-saved')
      .waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // A separate, unaltered recording shows the real one-shot timing and replay.
    const recording = await browser.newContext({
      viewport: { width: 728, height: 640 },
      reducedMotion: 'reduce',
      recordVideo: {
        dir: path.join(artifacts, 'video'),
        size: { width: 728, height: 640 },
      },
    });
    await recording.addCookies([cookie]);
    await recording.addInitScript(markSyntheticProof);
    const demo = await recording.newPage();
    await demo.goto(origin);
    await demo.locator('[data-synthetic-proof]').evaluate((el) => {
      el.textContent += ' · Reduced motion emulated';
    });
    await demo
      .locator('#retention-days:not([disabled])')
      .waitFor({ state: 'attached' });
    if (await demo.locator('#menu-btn').isVisible())
      await demo.locator('#menu-btn').click();
    await demo.locator('#nav-settings').click();
    await demo.waitForTimeout(1500);
    for (const days of [60, 90]) {
      await demo.locator('#retention-days').click();
      await demo
        .getByRole('option', { name: `${days} days`, exact: true })
        .click();
      await demo.waitForTimeout(900);
      await demo.locator('#retention-save').click();
      await demo.locator('#retention-save.is-saved').waitFor();
      await demo
        .locator('#retention-save.is-saved')
        .waitFor({ state: 'detached' });
      await demo.waitForTimeout(1800);
    }
    await recording.close();
    await demo.video()!.saveAs(path.join(artifacts, 'save-pulse.webm'));
    assert.deepEqual(errors, []);
    await writeFile(
      path.join(artifacts, 'result.json'),
      JSON.stringify(
        {
          kind: 'real service and built dashboard; synthetic signed identity and empty files',
          browser: browser.version(),
          widths: [1440, 728, 390],
          saves,
          pulse,
          reduced,
          recordingMotion: 'reduce',
          errors,
          result: 'PASS',
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
