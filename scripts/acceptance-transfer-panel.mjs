// Synthetic service only. Start web's test:preview on loopback before running.
// STORAGI_PREVIEW_URL=http://127.0.0.1:5192 node scripts/acceptance-transfer-panel.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ||
      `${homedir()}/.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs`,
  ).href
);
const base = process.env.STORAGI_PREVIEW_URL || 'http://127.0.0.1:5174';
const artifacts = path.resolve(
  process.env.STORAGI_ARTIFACT_DIR || 'artifacts/transfer-toolbar',
);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_EXECUTABLE ||
    `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  args: ['--no-sandbox'],
  headless: true,
});
const errors = [];
const evidence = {
  kind: 'Synthetic service; real dashboard and browser; no real Google login',
  browser: browser.version(),
  widths: [],
  flows: [],
};
try {
  await fetch(`${base}/__test/reset`, { method: 'POST' });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const toggle = page.locator('.top #nav-transfers');
  async function animateToggle() {
    const transitions = await page.evaluate(async () => {
      document.querySelector('#nav-transfers').click();
      // Force style resolution while the opening/closing transition is running.
      getComputedStyle(document.querySelector('#details')).opacity;
      await new Promise(requestAnimationFrame);
      return document
        .getAnimations()
        .filter((animation) => {
          const target = animation.effect?.target;
          return target?.matches?.('.body, #details');
        })
        .map((animation) => ({
          duration: animation.effect.getTiming().duration,
          easing: animation.effect.getTiming().easing,
        }));
    });
    assert.ok(
      transitions.some(
        ({ duration, easing }) => duration > 0 && easing === 'ease-out',
      ),
      'Panel has a running ease-out transition',
    );
  }
  async function expanded(value) {
    await page.waitForFunction(
      (expected) =>
        document
          .querySelector('#nav-transfers')
          ?.getAttribute('aria-expanded') === String(expected),
      value,
    );
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#details').isVisible(), value);
    assert.equal(
      await page.locator('#details').evaluate((node) => node.inert),
      !value,
    );
  }
  for (const width of [1440, 1180, 1000, 728, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(base);
    await page.locator('#groups .row[data-id]').first().waitFor();
    await expanded(false);
    assert.equal(await page.locator('.nav [data-tab="transfers"]').count(), 0);
    assert.equal(await toggle.isVisible(), true);
    await page.screenshot({
      path: `${artifacts}/MOCKED-transfer-closed-${width}.png`,
      fullPage: true,
    });
    await animateToggle();
    await expanded(true);
    const bounds = await toggle.boundingBox();
    assert.ok(bounds && bounds.x + bounds.width <= width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `${artifacts}/MOCKED-transfer-open-${width}.png`,
      fullPage: true,
    });
    await animateToggle();
    await expanded(false);
    evidence.widths.push(width);
  }
  evidence.flows.push(
    'Closed by default; toolbar toggle opens/closes with running ease-out transitions in both directions; no sidebar entry or horizontal overflow at five widths',
  );

  await toggle.click();
  await expanded(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  await expanded(true);
  await page.setViewportSize({ width: 390, height: 960 });
  await expanded(true);
  await toggle.click();
  await expanded(false);
  await page.setViewportSize({ width: 1440, height: 960 });
  await expanded(false);
  evidence.flows.push(
    'Open and closed state survive resizing across the desktop panel breakpoint',
  );

  for (const width of [1440, 1000, 390]) {
    await page.setViewportSize({ width, height: 960 });
    const settings = page.locator('#nav-settings');
    if (!(await settings.isVisible())) await page.locator('#menu-btn').click();
    await settings.click();
    const bounds = await toggle.boundingBox();
    assert.ok(
      bounds && width - bounds.x - bounds.width <= 20,
      `Transfers stays at the far right on Settings at ${width}px`,
    );
    await toggle.click();
    await expanded(true);
    await toggle.click();
    await expanded(false);
  }
  evidence.flows.push(
    'Toolbar remains at the far right and can open Transfers from Settings at desktop, intermediate and phone widths',
  );

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(base);
    await page.locator('#groups .row[data-id]').first().waitFor();
    await page.locator('#picker').setInputFiles({
      name: `toolbar-proof-${width}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Synthetic transfer toolbar proof at ${width}px`),
    });
    await expanded(true);
    await page
      .locator('#tr-list .tr')
      .filter({ hasText: `toolbar-proof-${width}` })
      .waitFor();
    await page.screenshot({
      path: `${artifacts}/MOCKED-transfer-upload-${width}.png`,
      fullPage: true,
    });
    await toggle.click();
    await expanded(false);
    await page.waitForTimeout(800);
    await expanded(false);
    await toggle.click();
    await expanded(true);
    assert.match(await page.locator('#tr-list').innerText(), /On your shelf/);
    await toggle.click();
    await expanded(false);
    // Force the browser-owned download path, as used on browsers without a save picker.
    await page.evaluate(() => {
      window.showSaveFilePicker = undefined;
    });
    const download = page.waitForEvent('download');
    await page
      .locator('#groups .row[data-id]')
      .filter({ hasText: `toolbar-proof-${width}` })
      .getByRole('link', { name: /^Download/ })
      .click();
    await download;
    await expanded(true);
  }
  evidence.flows.push(
    'Uploads automatically open on desktop/phone; closing stays closed as progress completes; manual reopening retains completed transfers; browser downloads reopen',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('#groups .row[data-id]').first().waitFor();
  await expanded(false);
  await toggle.click();
  await expanded(true);
  assert.equal(
    await page
      .locator('#details')
      .evaluate((node) => getComputedStyle(node).transitionDuration),
    '0s',
  );
  await toggle.click();
  await expanded(false);
  evidence.flows.push('Reduced-motion toggle remains functional');
  assert.deepEqual(errors, []);
  await context.close();
  await writeFile(
    `${artifacts}/result.json`,
    JSON.stringify(evidence, null, 2),
  );
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await browser.close();
}
