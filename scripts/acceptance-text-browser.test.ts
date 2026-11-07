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
          : name === 'transfers'
            ? '#nav-transfers'
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
    const morphAppearance = (page: any, selector: string) =>
      page.locator(selector).evaluate((el: HTMLElement) => {
        const props = [
          'fontFamily',
          'fontSize',
          'fontWeight',
          'borderRadius',
          'backgroundColor',
          'boxShadow',
          'color',
          'height',
        ] as const;
        return [
          el,
          el.querySelector('.m-ok')!,
          el.querySelector('button')!,
          el.querySelector('.m-clock')!,
        ].map((node) => {
          const style = getComputedStyle(node);
          return Object.fromEntries(props.map((key) => [key, style[key]]));
        });
      });
    const proveToastCenter = async (page: any, content = true) => {
      await page.locator('#notice').waitFor({ state: 'visible' });
      await page.waitForFunction(
        () => !document.querySelector('#notice')?.classList.contains('out'),
      );
      await settled(page);
      const toast = await page.locator('#notice').boundingBox();
      const form = content
        ? await page.locator('#text-form').boundingBox()
        : null;
      const width = page.viewportSize().width;
      const center = form ? form.x + form.width / 2 : width / 2;
      assert.ok(
        Math.abs(toast.x + toast.width / 2 - center) <= 1,
        `toast shares ${content ? 'Text content' : 'viewport'} center at ${width}px`,
      );
      assert.ok(
        toast.x >= 0 && toast.x + toast.width <= width,
        'centered toast stays within viewport bounds',
      );
      if (content && !(await page.locator('#notice button').count())) {
        const message = await page
          .locator('#notice > span')
          .first()
          .boundingBox();
        assert.ok(
          Math.abs(
            message.x + message.width / 2 - (toast.x + toast.width / 2),
          ) <= 1,
          'text-only notification message is centered inside its pill',
        );
      }
    };
    const proveFocus = async (page: any, selector: string, shot: string) => {
      const control = page.locator(selector).first();
      await control.scrollIntoViewIfNeeded();
      await page.keyboard.press('Tab');
      await control.focus();
      const result = await control.evaluate((el: HTMLElement) => {
        const style = getComputedStyle(el);
        const gap = Math.max(
          0,
          parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
        );
        const clipped: string[] = [];
        for (const rect of el.getClientRects()) {
          for (
            let parent = el.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            const ps = getComputedStyle(parent),
              box = parent.getBoundingClientRect();
            const left = box.left + parent.clientLeft,
              top = box.top + parent.clientTop;
            if (
              /hidden|clip|auto|scroll/.test(ps.overflowX) &&
              (rect.left - gap < left - 0.5 ||
                rect.right + gap > left + parent.clientWidth + 0.5)
            )
              clipped.push(parent.id || parent.tagName);
            if (
              /hidden|clip|auto|scroll/.test(ps.overflowY) &&
              (rect.top - gap < top - 0.5 ||
                rect.bottom + gap > top + parent.clientHeight + 0.5)
            )
              clipped.push(parent.id || parent.tagName);
          }
        }
        return {
          visible: el.matches(':focus-visible'),
          outline: style.outlineStyle,
          clipped,
        };
      });
      assert.ok(
        result.visible && result.outline !== 'none',
        `${selector} has a visible keyboard focus cue`,
      );
      assert.deepEqual(
        result.clipped,
        [],
        `${selector} focus outline is not clipped by an ancestor`,
      );
      await page.screenshot({ path: path.join(artifacts, shot) });
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
      await page.clock.install();
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
      const formBox = await page.locator('#text-form').boundingBox();
      const editorBox = await page.locator('#text-draft').boundingBox();
      assert.ok(
        formBox &&
          editorBox &&
          Math.abs(formBox.x - editorBox.x) < 1 &&
          Math.abs(formBox.y - editorBox.y) < 1 &&
          Math.abs(formBox.width - editorBox.width) < 1 &&
          Math.abs(formBox.height - editorBox.height) < 1,
        'native textarea covers the entire composer form',
      );
      assert.equal(
        await page.locator('#text-hint,#composer .composer-hint').count(),
        0,
        'neither composer has a Kept sentence',
      );
      for (const [dx, dy] of [
        [8, 8],
        [formBox.width - 8, 8],
        [8, formBox.height - 8],
        [formBox.width / 2, formBox.height - 8],
        [formBox.width / 2, formBox.height / 2],
      ]) {
        const x = formBox.x + dx,
          y = formBox.y + dy;
        assert.equal(
          await page.evaluate(
            ({ x, y }) => document.elementFromPoint(x, y)?.id,
            { x, y },
          ),
          'text-draft',
          'blank composer area hits the actual textarea',
        );
        await page.locator('#text-draft').fill('');
        await page.locator('#page-title').focus();
        if (page === receiver) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          'text-draft',
          'clicking composer whitespace activates native editing',
        );
        await page.keyboard.type('Surface probe');
        assert.equal(
          await page.locator('#text-draft').inputValue(),
          'Surface probe',
        );
      }
      await page.locator('#text-draft').fill('');
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await settled(page);
      const surfaces = await page.evaluate(() =>
        ['#composer', '#text-form'].map((selector) => {
          const style = getComputedStyle(document.querySelector(selector)!);
          return {
            background: style.backgroundColor,
            shadow: style.boxShadow,
            radius: style.borderRadius,
          };
        }),
      );
      assert.deepEqual(
        surfaces[0],
        surfaces[1],
        'Text reuses Inbox composer card styling',
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
    assert.equal(
      await receiver
        .locator('#text-draft')
        .evaluate((el: HTMLElement) => getComputedStyle(el).fontFamily),
      await receiver
        .locator('body')
        .evaluate((el: HTMLElement) => getComputedStyle(el).fontFamily),
      'composer uses Storagi interface font',
    );
    await receiver.locator('#text-draft').focus();
    const focusStyle = await receiver
      .locator('#text-draft')
      .evaluate((el: HTMLElement) => {
        const style = getComputedStyle(el);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      });
    assert.equal(focusStyle.outline, 'none', 'no red or orange input outline');
    assert.equal(
      focusStyle.shadow,
      'none',
      'no inner input frame while typing',
    );
    await receiver.screenshot({
      path: path.join(artifacts, 'text-input-focus-390.png'),
      fullPage: true,
    });
    for (const page of [sender, receiver]) {
      for (const colorScheme of ['dark', 'light'] as const) {
        await page.emulateMedia({ forcedColors: 'active', colorScheme });
        const contrast = await page.evaluate(() => {
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'Canvas';
          document.body.append(probe);
          const canvas = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const draft = document.querySelector('#text-draft')!;
          const style = getComputedStyle(draft);
          return {
            canvas,
            borders: [
              style.borderTopColor,
              style.borderRightColor,
              style.borderBottomColor,
              style.borderLeftColor,
            ],
            foreground: style.color,
          };
        });
        assert.notEqual(
          contrast.foreground,
          contrast.canvas,
          'forced-colour draft text remains distinct from Canvas',
        );
        assert.deepEqual(
          contrast.borders,
          Array(4).fill(contrast.canvas),
          'native spacing borders blend into Canvas in contrast themes',
        );
        await page.screenshot({
          path: path.join(
            artifacts,
            `text-contrast-${colorScheme}-${page === receiver ? 390 : 1440}.png`,
          ),
          fullPage: true,
        });
      }
      await page.emulateMedia({ forcedColors: 'none', colorScheme: null });
    }
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
    // Advance the shared 60-second scheduler without a minute of wall time.
    await receiver.clock.fastForward(60_000);
    await receiver
      .locator('#text-items pre')
      .filter({ hasText: link })
      .waitFor();
    const textFont = await receiver
      .locator('#text-items pre')
      .first()
      .evaluate((el: HTMLElement) => {
        const s = getComputedStyle(el);
        return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight };
      });
    assert.equal(
      textFont.size,
      '16px',
      'received text has the requested larger reading size',
    );
    assert.equal(
      textFont.family,
      await receiver
        .locator('body')
        .evaluate((el: HTMLElement) => getComputedStyle(el).fontFamily),
      'received notes use Storagi interface font',
    );
    assert.equal(
      await receiver.locator('.text-expiry').textContent(),
      '30d left',
    );
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
    await receiver.setViewportSize({ width: 728, height: 900 });
    assert.equal(
      await receiver.evaluate(() => matchMedia('(pointer: coarse)').matches),
      true,
    );
    const tabletCopy = await receiver.locator('[data-text-copy]').boundingBox();
    assert.ok(
      tabletCopy && tabletCopy.width >= 44 && tabletCopy.height >= 44,
      'coarse-pointer tablet Copy target is at least 44px',
    );
    const tabletTrash = await receiver
      .locator('[data-text-delete]')
      .boundingBox();
    assert.ok(
      tabletTrash && tabletTrash.width >= 44 && tabletTrash.height >= 44,
      'coarse-pointer tablet Delete target is at least 44px',
    );
    await receiver.screenshot({
      path: path.join(artifacts, 'text-touch-tablet-728.png'),
    });
    await receiver.setViewportSize({ width: 390, height: 844 });
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
    for (const width of [390, 728, 860, 861, 1000, 1440, 1920]) {
      await sender.setViewportSize({ width, height: 1000 });
      await sender.locator('[data-text-copy]').click();
      await proveToastCenter(sender);
      if ([390, 861, 1440, 1920].includes(width))
        await sender.screenshot({
          path: path.join(artifacts, `text-toast-copy-${width}.png`),
          fullPage: true,
        });
    }
    // Layout fixtures use the existing duplicate-transfer notice format, including an unbroken filename.
    for (const width of [861, 1000, 1100, 1440, 390]) {
      for (const name of [
        'chapter '.repeat(12) + 'handoff.txt',
        'x'.repeat(150) + '.txt',
      ]) {
        await sender.setViewportSize({ width, height: 1000 });
        const previousNotice = await sender.locator('#notice').elementHandle();
        await sender.locator('[data-text-copy]').click();
        await sender.waitForFunction((old: HTMLElement | null) => {
          const notice = document.querySelector('#notice');
          return !!notice && notice !== old;
        }, previousNotice);
        await previousNotice?.dispose();
        const message = `${name} is already in your transfer queue.`;
        await sender
          .locator('#notice > span')
          .first()
          .evaluate((el: HTMLElement, value: string) => {
            el.textContent = value;
          }, message);
        await proveToastCenter(sender);
        assert.equal(
          await sender.locator('#notice > span').first().textContent(),
          message,
          'long-message fixture remains on the live notice during layout proof',
        );
        const bounds = await sender
          .locator('#notice')
          .evaluate((el: HTMLElement) => ({
            scroll: el.scrollWidth,
            client: el.clientWidth,
          }));
        assert.ok(
          bounds.scroll <= bounds.client + 1,
          'long filename text wraps inside the centered toast',
        );
        if (width === 861 || width === 390)
          await sender.screenshot({
            path: path.join(
              artifacts,
              `text-toast-long-${name.startsWith('x') ? 'unbroken' : 'spaced'}-${width}.png`,
            ),
            fullPage: true,
          });
      }
    }
    // A visible toast follows resize without being recreated.
    await sender.setViewportSize({ width: 1440, height: 1000 });
    await sender.locator('[data-text-copy]').click();
    await proveToastCenter(sender);
    const sameToast = await sender.locator('#notice').elementHandle();
    await sender.setViewportSize({ width: 728, height: 1000 });
    await proveToastCenter(sender);
    await sender.setViewportSize({ width: 1440, height: 1000 });
    await proveToastCenter(sender);
    assert.equal(
      await sameToast.evaluate(
        (el: HTMLElement) => el === document.querySelector('#notice'),
      ),
      true,
      'resize keeps the same live toast node',
    );
    await sameToast.dispose();
    // Other screens retain their existing viewport-centered notifications.
    await navigate(sender, 'inbox');
    await proveToastCenter(sender, false);
    await navigate(sender, 'text');
    await sender.locator('[data-text-copy]').click();
    await navigate(sender, 'settings');
    await proveToastCenter(sender, false);
    await navigate(sender, 'text');
    await sender.locator('[data-text-copy]').click();
    await proveToastCenter(sender);
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
    const fallbackFocus = await receiver
      .locator('.text-copy-fallback')
      .evaluate((el: HTMLElement) => ({
        outline: getComputedStyle(el).outlineStyle,
        shadow: getComputedStyle(el).boxShadow,
      }));
    assert.equal(
      fallbackFocus.outline,
      'none',
      'clipboard recovery input has no orange outline',
    );
    const fallbackColor = fallbackFocus.shadow.match(
      /rgb\((\d+), (\d+), (\d+)\)/,
    );
    assert.ok(
      fallbackColor &&
        fallbackColor[1] === fallbackColor[2] &&
        fallbackColor[2] === fallbackColor[3],
      'clipboard recovery keeps neutral inset focus',
    );
    assert.equal(
      await receiver
        .locator('[data-text-copy]')
        .evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor),
      'rgba(0, 0, 0, 0)',
      'touch Copy leaves no sticky hover square',
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
    // The toolbar toggle stays available at the sidebar/transfer-panel breakpoint.
    await sender.setViewportSize({ width: 1000, height: 900 });
    await navigate(sender, 'transfers');
    assert.equal(await sender.locator('.top #nav-transfers').isVisible(), true);
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
    const proveDraftFooter = async (
      page: any,
      state: string,
      width: number,
    ) => {
      await settled(page);
      let reference: Buffer | undefined;
      for (const [position, fraction] of [
        ['top', 0],
        ['middle', 0.5],
        ['end', 1],
      ] as const) {
        await page
          .locator('#text-draft')
          .evaluate((el: HTMLTextAreaElement, f: number) => {
            el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * f);
          }, fraction);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        const viewportBottom = await page
          .locator('#text-draft')
          .evaluate(
            (el: HTMLTextAreaElement) =>
              el.getBoundingClientRect().top + el.clientTop + el.clientHeight,
          );
        const send = await page.locator('#text-send').boundingBox();
        const count = await page.locator('#text-count').boundingBox();
        if (width === 390 || position === 'middle')
          await page.screenshot({
            path: path.join(
              artifacts,
              `text-draft-${state}-${position}-${width}.png`,
            ),
          });
        assert.ok(
          viewportBottom <= Math.min(send.y, count.y) - 6,
          `${width}px ${state} ${position}: actual native scrolling viewport ends above both controls`,
        );
        const form = await page.locator('#text-form').boundingBox();
        const footer = await page.locator('.text-compose-foot').boundingBox();
        const band = await page.screenshot({
          clip: {
            x: Math.ceil(form.x) + 2,
            y: Math.ceil(footer.y),
            width: Math.floor(form.width) - 4,
            height: Math.floor(form.y + form.height) - Math.ceil(footer.y) - 1,
          },
        });
        if (reference)
          assert.ok(
            band.equals(reference),
            `${width}px ${state}: rendered footer pixels remain unchanged while the draft scrolls`,
          );
        else reference = band;
      }
    };
    await receiver.locator('#text-draft').fill('x'.repeat(60 * 1024));
    assert.equal(await receiver.locator('#text-count').isVisible(), true);
    const longEditor = await receiver
      .locator('#text-draft')
      .evaluate((el: HTMLTextAreaElement) => ({
        height: el.getBoundingClientRect().height,
        formHeight: el.form!.getBoundingClientRect().height,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
    assert.ok(
      longEditor.height <= 240 &&
        Math.abs(longEditor.formHeight - longEditor.height) < 1 &&
        longEditor.scrollHeight > longEditor.clientHeight,
      'long drafts scroll inside the bounded full-card editor',
    );
    await proveDraftFooter(receiver, 'enabled', 390);
    const counterBox = await receiver.locator('#text-count').boundingBox();
    assert.equal(
      await receiver.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.id,
        {
          x: counterBox.x + counterBox.width / 2,
          y: counterBox.y + counterBox.height / 2,
        },
      ),
      'text-draft',
      'counter overlay lets editing clicks pass through',
    );

    await settled(receiver);
    await receiver.screenshot({
      path: path.join(artifacts, 'text-near-limit-390.png'),
      fullPage: true,
    });
    await receiver.locator('#text-draft').fill('x'.repeat(65 * 1024));
    assert.equal(await receiver.locator('#text-send').isDisabled(), true);
    await proveDraftFooter(receiver, 'disabled', 390);
    await receiver.screenshot({
      path: path.join(artifacts, 'text-over-limit-390.png'),
      fullPage: true,
    });
    await receiver.locator('#text-draft').fill('');
    await sender.locator('#text-draft').fill('x'.repeat(60 * 1024));
    await proveDraftFooter(sender, 'enabled', 1440);
    await sender.locator('#text-draft').fill('x'.repeat(65 * 1024));
    await proveDraftFooter(sender, 'disabled', 1440);
    await sender.locator('#text-draft').fill('');
    const exact =
      '  A note from the phone\nsecond line 🐟\n' +
      Array.from(
        { length: 18 },
        (_, i) => `Detail ${i + 1}: synthetic handoff notes.`,
      ).join('\n') +
      '  ';

    await receiver.locator('#text-draft').fill(exact);
    await receiver.locator('#text-send').click();
    await receiver
      .locator('#text-items pre')
      .filter({ hasText: 'A note from the phone' })
      .waitFor();
    await sender.locator('#refresh').click();
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
    await proveFocus(receiver, '#text-items pre', 'text-keyboard-note-390.png');
    await proveFocus(
      receiver,
      '[data-text-open]',
      'text-keyboard-link-390.png',
    );
    await proveFocus(
      receiver,
      '[data-text-delete]',
      'text-keyboard-trash-390.png',
    );
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
    await sender.locator('#text-draft').fill('Typing while deletion finishes');
    await sender.locator('#text-draft').focus();
    await sender
      .locator('#notice')
      .filter({ hasText: 'Text deleted.' })
      .waitFor();
    await proveToastCenter(sender);
    await sender.screenshot({
      path: path.join(artifacts, 'text-toast-deleted-1440.png'),
      fullPage: true,
    });
    await receiver.locator('#refresh').click();
    await receiver
      .locator('#text-items article')
      .nth(1)
      .waitFor({ state: 'detached' });
    assert.equal(await receiver.locator('#text-items article').count(), 1);
    assert.equal(
      await sender
        .locator('#text-draft')
        .evaluate((el: HTMLElement) => document.activeElement === el),
      true,
      'confirmed deletion never steals focus from continued typing',
    );
    assert.equal(
      await sender.locator('#text-draft').inputValue(),
      'Typing while deletion finishes',
    );
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
    // Start gesture proof with a fresh page after separately proving failed-send preservation.
    await sender.reload();
    await sender.locator('[data-text-copy]').waitFor();
    // Real mouse input from the same row chrome used by Inbox (not a synthetic wheel).
    await sender.setViewportSize({ width: 1440, height: 1000 });
    const mouseSwipe = async (distance: number, capture = false) => {
      const row = sender.locator('#text-items article').first();
      await row.scrollIntoViewIfNeeded();
      const box = await row.locator('.text-card-actions').boundingBox();
      const x = box.x + box.width * 0.65,
        y = box.y + box.height / 2;
      await sender.mouse.move(x, y);
      await sender.mouse.down();
      await sender.mouse.move(x - distance, y, { steps: 8 });
      if (distance >= 180) {
        assert.equal(
          await row.evaluate((el: HTMLElement) =>
            el.classList.contains('swiping'),
          ),
          true,
          'desktop mouse left-drag starts the same delete gesture as Inbox',
        );
        if (capture)
          await sender.screenshot({
            path: path.join(artifacts, 'text-mouse-swipe-1440.png'),
            fullPage: true,
          });
      }
      await sender.mouse.up();
      await settled(sender);
    };
    await mouseSwipe(35);
    assert.equal(
      await sender.locator('[data-text-undo]').isVisible(),
      false,
      'short desktop mouse drag snaps back without deletion',
    );
    const desktopRowHeight = (
      await sender.locator('#text-items article').first().boundingBox()
    ).height;
    await mouseSwipe(220, true);
    await sender.locator('[data-text-undo]').waitFor();
    assert.equal(
      await sender.locator('.text-card .morph .m-ok').textContent(),
      '✓ Deleted',
      'Text uses Inbox Deleted/Undo/countdown morph',
    );
    assert.match(
      await sender.locator('.text-card .morph .m-clock').textContent(),
      /^[1-4]s$/,
    );
    assert.ok(
      Math.abs(
        (await sender.locator('#text-items article').first().boundingBox())
          .height - desktopRowHeight,
      ) < 0.5,
      'desktop row stays the same height during Undo',
    );
    const textDesktopMorph = await morphAppearance(
      sender,
      '.text-card .morph:visible',
    );
    await sender.screenshot({
      path: path.join(artifacts, 'text-mouse-undo-1440.png'),
      fullPage: true,
    });
    await sender.locator('[data-text-undo]').click();
    await sender.locator('[data-text-copy]').waitFor();
    // A native phone touch swipe uses the same red reveal and Undo rhythm as Inbox.
    const pagesBeforeSwipes = phone.pages().length;
    const cdp = await phone.newCDPSession(receiver);
    const swipe = async (
      distance: number,
      cancel = false,
      capture = false,
      target = '.text-card-actions',
    ) => {
      const row = receiver.locator('#text-items article').first();
      await row.scrollIntoViewIfNeeded();
      const box = await row.locator(target).boundingBox();
      const x =
          box.x + box.width * (target === '.text-card-actions' ? 0.65 : 0.8),
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
      if (capture) {
        const shape = await row.evaluate((el: HTMLElement) => {
          const style = getComputedStyle(el);
          const under = el.previousElementSibling as HTMLElement;
          const strip = under.getBoundingClientRect(),
            box = el.getBoundingClientRect();
          return {
            radius: style.borderRadius,
            stripRadius: getComputedStyle(under).borderRadius,
            inset: parseFloat(style.paddingLeft),
            topInset: parseFloat(style.paddingTop),
            aligned:
              Math.abs(strip.top - box.top) < 1 &&
              Math.abs(strip.height - box.height) < 1,
          };
        });
        assert.equal(
          shape.radius,
          shape.stripRadius,
          'dragged row and Inbox delete reveal share rounded shape',
        );
        assert.ok(
          parseFloat(shape.radius) > 0 &&
            shape.inset > 0 &&
            shape.topInset > 0 &&
            shape.aligned,
          'phone drag surface has consistent padding and aligned reveal bounds',
        );
      }
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
    const phoneRowHeight = (
      await receiver.locator('#text-items article').first().boundingBox()
    ).height;
    await swipe(220, false, true, '[data-text-open]');
    await receiver.locator('[data-text-undo]').waitFor();
    assert.ok(
      Math.abs(
        (await receiver.locator('#text-items article').first().boundingBox())
          .height - phoneRowHeight,
      ) < 0.5,
      'phone row stays the same height during Undo',
    );
    const textPhoneMorph = await morphAppearance(
      receiver,
      '.text-card .morph:visible',
    );
    await receiver.screenshot({
      path: path.join(artifacts, 'text-swipe-undo-390.png'),
      fullPage: true,
    });
    await receiver.locator('[data-text-undo]').click();
    assert.equal(
      phone.pages().length,
      pagesBeforeSwipes,
      'swiping the URL does not open it',
    );
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
    await receiver
      .locator('#notice')
      .filter({ hasText: 'Text deleted.' })
      .waitFor();
    await proveToastCenter(receiver);
    await receiver.screenshot({
      path: path.join(artifacts, 'text-toast-deleted-390.png'),
      fullPage: true,
    });
    await sender.locator('#refresh').click();
    await sender.locator('#text-items article').waitFor({ state: 'detached' });
    // Swiping a plain note body and a desktop trackpad over wrapped text both work.
    await receiver
      .locator('#text-draft')
      .fill('A plain note for native swipe proof.');
    await receiver.locator('#text-send').click();
    await receiver
      .locator('#text-items pre')
      .filter({ hasText: 'A plain note' })
      .waitFor();
    await swipe(220, false, false, 'pre');
    await receiver.locator('[data-text-undo]').waitFor();
    await receiver.locator('[data-text-undo]').click();
    await sender.locator('#refresh').click();
    await sender
      .locator('#text-items pre')
      .filter({ hasText: 'A plain note' })
      .waitFor();
    const noteBox = await sender.locator('#text-items pre').boundingBox();
    await sender.mouse.move(
      noteBox.x + noteBox.width / 2,
      noteBox.y + noteBox.height / 2,
    );
    await sender.mouse.wheel(220, 0);
    await sender.locator('[data-text-undo]').waitFor();
    await sender.screenshot({
      path: path.join(artifacts, 'text-trackpad-1440.png'),
      fullPage: true,
    });
    await proveFocus(sender, '[data-text-undo]', 'text-keyboard-undo-1440.png');
    await sender.keyboard.press('Enter');
    assert.equal(
      await sender
        .locator('[data-text-copy]')
        .evaluate((el: HTMLElement) => document.activeElement === el),
      true,
      'keyboard Undo restores Copy focus',
    );
    const selectionPoints = await sender
      .locator('#text-items pre')
      .evaluate((el: HTMLElement) => {
        const range = document.createRange();
        range.setStart(el.firstChild!, 2);
        range.setEnd(el.firstChild!, 14);
        const rect = range.getBoundingClientRect();
        return { x: rect.left, end: rect.right, y: rect.top + rect.height / 2 };
      });
    await sender.mouse.move(selectionPoints.x, selectionPoints.y);
    await sender.mouse.down();
    await sender.mouse.move(selectionPoints.end, selectionPoints.y, {
      steps: 8,
    });
    await sender.mouse.up();
    assert.ok(
      await sender.evaluate(() => (getSelection()?.toString().length ?? 0) > 3),
      'ordinary desktop dragging selects part of the actual note',
    );
    assert.equal(
      await sender.locator('[data-text-undo]').isVisible(),
      false,
      'native text selection never schedules deletion',
    );
    // Keep the real selection: pressing non-selectable row chrome must clear it naturally.
    await mouseSwipe(220);
    await sender.locator('[data-text-undo]').waitFor();
    assert.equal(
      await sender.evaluate(() => getSelection()?.toString()),
      '',
      'starting a blank-area mouse swipe clears the stale selection',
    );
    await sender.screenshot({
      path: path.join(artifacts, 'text-mouse-after-selection-1440.png'),
      fullPage: true,
    });
    await sender.locator('[data-text-undo]').click();
    await swipe(220, false, false, 'pre');
    await receiver.locator('[data-text-undo]').waitFor();
    await receiver
      .locator('#text-items article')
      .waitFor({ state: 'detached' });
    await sender.locator('#refresh').click();
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
    // Upload opens the transfer panel: sample both edges in the same layout frame.
    const chooseRightAligned = await sender.evaluate(() => {
      const card = document.querySelector('#composer')!.getBoundingClientRect();
      const button = document.querySelector('#choose')!.getBoundingClientRect();
      const gap = card.right - button.right;
      return card.width > 0 && button.width > 0 && gap >= 0 && gap <= 20;
    });
    assert.ok(
      chooseRightAligned,
      'Choose files remains right-aligned after removing helper copy',
    );
    await sender.screenshot({
      path: path.join(artifacts, 'inbox-no-retention-1440.png'),
      fullPage: true,
    });
    const fileFont = await sender
      .locator('#groups .name strong')
      .first()
      .evaluate((el: HTMLElement) => {
        const s = getComputedStyle(el);
        return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight };
      });
    assert.equal(
      textFont.family,
      fileFont.family,
      'received Text uses the actual Inbox filename font',
    );
    assert.equal(
      textFont.weight,
      fileFont.weight,
      'received Text keeps Inbox filename weight',
    );
    const deadlines = await sender.evaluate(async () => {
      const files = await (await fetch('/api/files')).json();
      const session = await (await fetch('/api/session')).json();
      return { file: files.files[0], days: session.retentionDays };
    });
    assert.equal(deadlines.days, 30);
    assert.equal(
      Date.parse(deadlines.file.expiresAt) -
        Date.parse(deadlines.file.uploadedAt),
      30 * 86400000,
    );
    // Compare against the actual Inbox morph, not a separately restyled imitation.
    await sender.locator('[data-del]').first().click();
    await sender.locator('[data-confirm]').first().click();
    assert.deepEqual(
      await morphAppearance(sender, '#groups .morph'),
      textDesktopMorph,
      'desktop Text Deleted/Undo/countdown appearance exactly matches Inbox',
    );
    await sender.screenshot({
      path: path.join(artifacts, 'inbox-delete-undo-1440.png'),
      fullPage: true,
    });
    await sender.locator('[data-undo]').first().click();
    await navigate(receiver, 'inbox');
    await receiver.locator('#refresh').click();
    await receiver.locator('#groups .row').waitFor();
    await receiver.locator('[data-del]').first().click();
    await receiver.locator('[data-confirm]').first().click();
    assert.deepEqual(
      await morphAppearance(receiver, '#groups .morph'),
      textPhoneMorph,
      'phone Text Deleted/Undo/countdown appearance exactly matches Inbox',
    );
    await receiver.screenshot({
      path: path.join(artifacts, 'inbox-delete-undo-390.png'),
      fullPage: true,
    });
    await receiver.locator('[data-undo]').first().click();
    await navigate(receiver, 'text');
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
    // Exercise the shared scheduler against real authenticated endpoints in both views.
    // Fake browser time keeps cadence/recovery proof independent of wall-clock minutes.
    for (const view of ['inbox', 'text']) {
      await navigate(sender, view);
      const paths =
        view === 'text' ? ['/api/files', '/api/texts'] : ['/api/files'];
      const refreshed = () =>
        Promise.all(
          paths.map((pathname) =>
            sender.waitForResponse(
              (response: any) =>
                new URL(response.url()).pathname === pathname &&
                response.request().method() === 'GET' &&
                (response.ok() || response.status() === 304),
            ),
          ),
        );
      await sender.clock.pauseAt(await sender.evaluate(() => Date.now() + 100));
      await Promise.all([refreshed(), sender.locator('#refresh').click()]);
      await sender.locator('#fresh.busy').waitFor({ state: 'detached' });
      let gets = 0;
      const count = (request: any) => {
        if (
          request.method() === 'GET' &&
          paths.includes(new URL(request.url()).pathname)
        )
          gets++;
      };
      sender.on('request', count);
      await sender.clock.fastForward(59_000);
      assert.equal(gets, 0, `${view} does not poll before 60 seconds`);
      // AutoRefresh checks its deadline on a one-second ticker.
      await Promise.all([refreshed(), sender.clock.fastForward(2000)]);
      await sender.locator('#fresh.busy').waitFor({ state: 'detached' });
      assert.ok(
        gets >= paths.length,
        `${view} uses the shared 60-second cadence`,
      );

      await sender.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const beforeHidden = gets;
      await sender.clock.fastForward(60_000);
      assert.equal(gets, beforeHidden, `${view} suspends polling while hidden`);
      await Promise.all([
        refreshed(),
        sender.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        }),
      ]);
      await sender.locator('#fresh.busy').waitFor({ state: 'detached' });
      await sender.evaluate(() => {
        delete (document as any).visibilityState;
      });

      await desktop.setOffline(true);
      await sender.locator('#refresh').click();
      await sender.locator('#offline').waitFor({ state: 'visible' });
      await sender.locator('#fresh.busy').waitFor({ state: 'detached' });
      await desktop.setOffline(false);
      await Promise.all([refreshed(), sender.clock.fastForward(10_000)]);
      await sender.locator('#offline').waitFor({ state: 'hidden' });
      await sender.clock.resume();
      sender.off('request', count);
      await Promise.all([refreshed(), sender.locator('#refresh').click()]);
    }
    await navigate(sender, 'text');
    await sender.screenshot({
      path: path.join(artifacts, 'shared-refresh-recovered-1440.png'),
      fullPage: true,
    });
    // Keep synthetic sessions alive to isolate shared content expiry beyond seven days.
    app.storage.db
      .prepare('UPDATE sessions SET expiresAt=?')
      .run(now + 31 * 86400000);
    now += 30 * 86400000 + 1;
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
            'desktop to phone automatic receipt through shared 60-second cadence (browser fake time); explicit refresh for subsequent cross-device gesture checks',
            'native phone touch swipe on URL and note bodies, short/cancel/Undo/commit, preference and cross-device deletion',
            'desktop mouse drag from row chrome plus trackpad over wrapped notes and keyboard Undo focus',
            'actual Inbox/Text Deleted-Undo-countdown style parity on desktop and phone; rounded aligned phone drag surface',
            'mouse deletion after native note selection without test-clearing it; continued typing retains focus through confirmed deletion; stable row height',
            'unclipped keyboard focus on note, URL, trash and Undo',
            '44px coarse-pointer tablet actions',
            'neutral clipboard fallback and no touch Copy hover square',
            'safe external link opens',
            'exact clipboard copy',
            'denied clipboard native selection',
            '390/728/1440/1920 no overflow',
            'phone to desktop exact multiline Unicode',
            'search',
            'delete cancel/confirm and cross-device disappearance',
            'failed send preserves draft',
            'existing file upload',
            'shared 30-day file/Text expiry and cleanup with authoritative existing deadlines',
            'Inbox composer surface and filename typography reused; no inner input focus frame',
            'no composer Kept sentences; native textarea full-card geometry and mouse/touch whitespace editing',
            'native scrolling viewport and rendered footer pixels stay clear at top/middle/end, enabled/disabled, phone/desktop',
            'forced-colours light/dark palettes preserve frameless native editing on phone/desktop',
            'unauthenticated denial',
            'full-height desktop koi and viewport-sized long-list scrolling',
            'Text copied/deleted notifications align with content across sidebar breakpoint/resize; Inbox/settings retain viewport centering',
            'long duplicate-transfer and unbroken-filename notice text wraps within the content bounds; resize preserves toast identity',
            'both views: shared 60-second cadence, hidden-tab suspension/return and existing 10-second offline recovery against actual service',
            'zero browser errors',
            'sidebar/menu shelf navigation and toolbar Transfers including 1000px',
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
