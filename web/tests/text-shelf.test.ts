import { afterEach, expect, test, vi } from 'vitest';
import shelfHTML from '../src/shelf.html?raw';
import { createTextShelf, linkFor } from '../src/text-shelf';

let dispose = () => {};
const tick = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
afterEach(() => {
  dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function mount() {
  document.body.innerHTML = shelfHTML;
  let items = [
    {
      id: 'one',
      text: 'https://example.com/read/chapter-42/',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ];
  const request = vi.fn(
    async (_path: string, method = 'GET', body?: unknown) => {
      if (method === 'POST') {
        const item = {
          ...items[0],
          id: 'two',
          text: (body as { text: string }).text,
        };
        items = [item, ...items];
        return Response.json(item, { status: 201 });
      }
      if (method === 'DELETE') {
        items = items.filter((x) => !_path.endsWith(x.id));
        return new Response(null, { status: 204 });
      }
      return Response.json({ texts: items });
    },
  );
  const toast = vi.fn();
  // The dashboard passes its shared AutoRefresh here; standalone, activation fetches Text directly.
  const scheduled = vi.fn(() => shelf.refresh().catch(() => {}));
  const shelf = createTextShelf(document.body, request, toast, scheduled);
  dispose = shelf.destroy;
  return {
    shelf,
    request,
    toast,
    scheduled,
    setItems: (value: typeof items) => {
      items = value;
    },
  };
}
const click = (s: string) => document.querySelector<HTMLElement>(s)!.click();
const draft = () => document.querySelector<HTMLTextAreaElement>('#text-draft')!;
function type(text: string) {
  draft().value = text;
  draft().dispatchEvent(new Event('input'));
}

test('only standalone HTTP(S) links get an Open action', () => {
  expect(linkFor(' https://example.com/read/chapter-42/ ')).toBe(
    'https://example.com/read/chapter-42/',
  );
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    'https://name:pass@example.com',
    'https://example.com\nnext',
    'hello https://example.com',
    'https://example.com/\u0000',
  ])
    expect(linkFor(value)).toBeNull();
});

test('text shelf loads lazily, sends exact text and clears only the sent draft', async () => {
  const { shelf, request } = mount();
  expect(request).not.toHaveBeenCalled();
  shelf.activate(true);
  await tick();
  expect(document.querySelector('[data-text-open]')?.getAttribute('href')).toBe(
    'https://example.com/read/chapter-42/',
  );
  type('  line one\nline two 🐟  ');
  document
    .querySelector('form#text-form')!
    .dispatchEvent(new Event('submit', { cancelable: true }));
  await tick();
  expect(request).toHaveBeenCalledWith('/api/texts', 'POST', {
    text: '  line one\nline two 🐟  ',
  });
  expect(draft().value).toBe('');
  expect(document.querySelector('#text-items pre')?.textContent).toBe(
    '  line one\nline two 🐟  ',
  );
});

test('clipboard denial offers selectable full text and deletion requires confirmation', async () => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  click('[data-text-copy]');
  await tick();
  const fallback = document.querySelector<HTMLTextAreaElement>(
    '#text-items textarea',
  )!;
  expect(fallback.value).toBe('https://example.com/read/chapter-42/');
  expect(fallback.selectionEnd).toBe(fallback.value.length);
  click('[data-text-delete]');
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  click('[data-text-cancel]');
  click('[data-text-delete]');
  click('[data-text-confirm]');
  await vi.advanceTimersByTimeAsync(4100);
  await tick();
  expect(request).toHaveBeenCalledWith('/api/texts/one', 'DELETE');
  expect(document.querySelectorAll('#text-items article')).toHaveLength(0);
});

test('failed send keeps draft and exposes inline retryable error; whitespace and byte limit are enforced', async () => {
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  type('   \n');
  expect(
    document.querySelector<HTMLButtonElement>('#text-send')!.disabled,
  ).toBe(true);
  type('🐟'.repeat(16385));
  expect(
    document.querySelector<HTMLButtonElement>('#text-send')!.disabled,
  ).toBe(true);
  type('keep me');
  request.mockRejectedValueOnce(new Error('Host offline'));
  document
    .querySelector('#text-form')!
    .dispatchEvent(new Event('submit', { cancelable: true }));
  await tick();
  expect(draft().value).toBe('keep me');
  expect(document.querySelector('#text-error')?.textContent).toContain(
    "Couldn't confirm the send. Your draft is still here.",
  );
  expect(
    document.querySelector<HTMLButtonElement>('#text-send')!.disabled,
  ).toBe(false);
});

test('Text has no scheduler of its own: activation asks the shared one, which filters expiry and never executes text', async () => {
  vi.useFakeTimers();
  const { shelf, request, scheduled, setItems } = mount();
  shelf.activate(true);
  shelf.activate(true);
  await tick();
  expect(scheduled).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledOnce();
  expect(document.querySelector('#text-sync')?.textContent).toBe(
    'Up to date · refreshes every 60s',
  );
  // No timer, focus or visibility listener of its own remains.
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(request).toHaveBeenCalledOnce();
  setItems([
    {
      id: 'unsafe',
      text: '<img src=x onerror=alert(1)>',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4000).toISOString(),
    },
  ]);
  await shelf.refresh();
  expect(document.querySelector('#text-items img')).toBeNull();
  expect(document.querySelector('#text-items pre')?.textContent).toContain(
    '<img',
  );
  await vi.advanceTimersByTimeAsync(5000);
  await shelf.refresh();
  expect(document.querySelectorAll('#text-items article')).toHaveLength(0);
  shelf.activate(false);
  const calls = request.mock.calls.length;
  await shelf.refresh();
  expect(request).toHaveBeenCalledTimes(calls);
  shelf.activate(true);
  expect(scheduled).toHaveBeenCalledTimes(2);
});

test('a failed Text refresh rejects for the shared retry and keeps inline guidance', async () => {
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  request.mockRejectedValueOnce(new Error('Host offline.'));
  await expect(shelf.refresh()).rejects.toThrow('Host offline.');
  expect(document.querySelector('#text-sync')?.textContent).toBe(
    'Could not refresh · retrying within 60s',
  );
  expect(document.querySelector('#text-error')?.textContent).toContain(
    'Your text shelf may be out of date. Use Refresh to retry.',
  );
  expect(document.querySelectorAll('#text-items article')).toHaveLength(1);
  await shelf.refresh();
  expect(document.querySelector<HTMLElement>('#text-error')!.hidden).toBe(true);
});

test('Text send and committed deletion immediately request the shared refresh', async () => {
  vi.useFakeTimers();
  const { shelf, scheduled } = mount();
  shelf.activate(true);
  await tick();
  type('new note');
  document
    .querySelector('#text-form')!
    .dispatchEvent(new Event('submit', { cancelable: true }));
  await tick();
  expect(scheduled).toHaveBeenCalledTimes(2);
  click('[data-text-delete]');
  click('[data-text-confirm]');
  await vi.advanceTimersByTimeAsync(4000);
  expect(scheduled).toHaveBeenCalledTimes(3);
});

test('changed deadlines refresh existing Text metadata without replacing selected content or focus', async () => {
  const { shelf, setItems } = mount();
  const item = {
    id: 'same',
    text: 'Keep this selected note',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  setItems([item]);
  shelf.activate(true);
  await tick();
  const card = document.querySelector('#text-items article')!;
  const content = card.querySelector('pre')!;
  content.focus();
  const range = document.createRange();
  range.selectNodeContents(content);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString();
  setItems([{ ...item, expiresAt }]);
  await shelf.refresh();
  expect(document.querySelector('#text-items article')).toBe(card);
  expect(card.querySelector('pre')).toBe(content);
  expect(document.activeElement).toBe(content);
  expect(selection.toString()).toBe(item.text);
  const expiry = new Date(expiresAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  expect(card.querySelector('time')!.dateTime).toBe(expiresAt);
  expect(card.querySelector('time')!.title).toBe(
    `Automatically deleted ${expiry}`,
  );
  expect(card.querySelector('.sr-only')!.textContent).toContain(
    `Expires ${expiry}`,
  );
  expect(card.querySelector('time')!.textContent).toBe('14d left');
});

test('search matches full text and a late response never overwrites a newer draft', async () => {
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  shelf.search('missing');
  expect(document.querySelectorAll('#text-items article')).toHaveLength(0);
  shelf.search('example.com');
  expect(document.querySelectorAll('#text-items article')).toHaveLength(1);
  let finish!: (r: Response) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  type('first');
  document
    .querySelector('#text-form')!
    .dispatchEvent(new Event('submit', { cancelable: true }));
  type('second');
  finish(
    Response.json({
      id: 'two',
      text: 'first',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  );
  await tick();
  expect(draft().value).toBe('second');
});

test('an older refresh cannot resurrect a deleted text', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  let finish!: (response: Response) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const refresh = shelf.refresh();
  click('[data-text-delete]');
  click('[data-text-confirm]');
  await vi.advanceTimersByTimeAsync(4100);
  await tick();
  finish(
    Response.json({
      texts: [
        {
          id: 'one',
          text: 'old',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
    }),
  );
  await refresh;
  await tick();
  expect(document.querySelectorAll('#text-items article')).toHaveLength(0);
});

test('delete already removed on the other device succeeds, Escape cancels confirmation, destroy clears private text', async () => {
  vi.useFakeTimers();
  const { shelf, request, setItems } = mount();
  shelf.activate(true);
  await tick();
  click('[data-text-delete]');
  document
    .querySelector('[data-text-cancel]')!
    .dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  expect(
    document.querySelector<HTMLElement>('.text-delete-confirm')!.hidden,
  ).toBe(true);
  click('[data-text-delete]');
  request.mockRejectedValueOnce(
    Object.assign(new Error('already gone'), { status: 404 }),
  );
  // The post-delete shared fetch must see the same server-side absence.
  setItems([]);
  click('[data-text-confirm]');
  await vi.advanceTimersByTimeAsync(4100);
  await tick();
  expect(document.querySelectorAll('#text-items article')).toHaveLength(0);
  expect(document.querySelector<HTMLElement>('#text-error')!.hidden).toBe(true);
  type('private draft');
  shelf.destroy();
  expect(draft().value).toBe('');
  expect(document.querySelector('#text-items')!.textContent).toBe('');
});

test('coarse-pointer send does not focus the composer and retains Send accessible name; capacity errors keep draft', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  type('note');
  click('#text-send');
  await tick();
  expect(document.activeElement).not.toBe(draft());
  expect(document.querySelector('#text-send span')?.textContent).toBe('Send');
  type('keep on full shelf');
  request.mockRejectedValueOnce(
    Object.assign(new Error('Your text shelf is full (100 items).'), {
      status: 409,
    }),
  );
  click('#text-send');
  await tick();
  expect(draft().value).toBe('keep on full shelf');
  expect(document.querySelector('#text-error')?.textContent).toContain(
    '100 items',
  );
});

test('unchanged polls use ETags without re-reading bodies or rewriting live status', async () => {
  const { shelf, request } = mount();
  request.mockResolvedValueOnce(
    Response.json({ texts: [] }, { headers: { ETag: 'W/"version-one"' } }),
  );
  shelf.activate(true);
  await tick();
  const status = document.querySelector('#text-sync')!;
  const observer = new MutationObserver(() => {});
  observer.observe(status, { childList: true });
  request.mockResolvedValueOnce(new Response(null, { status: 304 }));
  await shelf.refresh();
  expect(request).toHaveBeenLastCalledWith('/api/texts', 'GET', undefined, {
    'If-None-Match': 'W/"version-one"',
  });
  expect(observer.takeRecords()).toHaveLength(0);
  observer.disconnect();
});

test('late clipboard denial does not focus a fallback after leaving Text', async () => {
  let deny!: (e: Error) => void;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        new Promise((_resolve, reject) => {
          deny = reject;
        }),
    },
  });
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  click('[data-text-copy]');
  shelf.activate(false);
  const search = document.querySelector<HTMLInputElement>('#search')!;
  search.focus();
  deny(new Error('denied'));
  await tick();
  expect(document.activeElement).toBe(search);
  expect(document.querySelector('.text-copy-fallback')).toBeNull();
});

test('compact composition precedes pickup, byte count appears near the limit and actions retain context', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const items = document.querySelector('#text-items')!,
    form = document.querySelector('#text-form')!;
  expect(
    form.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(
    document.querySelector(
      '.text-intro,.text-list-heading,.text-shortcut,#text-new',
    ),
  ).toBeNull();
  expect(document.querySelector<HTMLElement>('#text-count')!.hidden).toBe(true);
  type('x'.repeat(60 * 1024));
  expect(document.querySelector<HTMLElement>('#text-count')!.hidden).toBe(
    false,
  );
  const pre = items.querySelector('pre')!;
  expect(pre.hasAttribute('aria-label')).toBe(false);
  const copy = items.querySelector('[data-text-copy]')!;
  expect(
    document.getElementById(copy.getAttribute('aria-describedby')!)
      ?.textContent,
  ).toContain('example.com');
  expect(
    items.querySelector('.text-delete-confirm')?.getAttribute('role'),
  ).toBe('group');
});

test('links have one keyboard stop and clipboard denial uses only inline recovery', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  const { shelf, toast } = mount();
  shelf.activate(true);
  await tick();
  expect(
    document.querySelector<HTMLPreElement>('#text-items pre')!.tabIndex,
  ).toBe(-1);
  click('[data-text-copy]');
  await tick();
  expect(toast).not.toHaveBeenCalled();
  const fallback = document.querySelector<HTMLTextAreaElement>(
    '.text-copy-fallback',
  )!;
  expect(
    document.getElementById(fallback.getAttribute('aria-describedby')!)
      ?.textContent,
  ).toContain('Clipboard');
});

test('draft auto-grows within a bound and shrinks after clearing', () => {
  mount();
  Object.defineProperty(draft(), 'scrollHeight', {
    configurable: true,
    get: () => (draft().value ? 600 : 62),
  });
  type('line\n'.repeat(80));
  expect(draft().style.height).toBe('240px');
  type('');
  expect(draft().style.height).toBe('62px');
});

test('removing the last text restores header focus instead of opening the phone keyboard', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  click('[data-text-delete]');
  click('[data-text-confirm]');
  await vi.advanceTimersByTimeAsync(4100);
  await tick();
  expect(document.activeElement?.id).toBe('page-title');
});

test('expiry precedes named icon-only Copy and Delete actions', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const actions = document.querySelector('.text-card-actions')!;
  expect(actions.firstElementChild?.tagName).toBe('TIME');
  const copy = actions.querySelector('[data-text-copy]')!;
  expect(copy.getAttribute('aria-label')).toBe('Copy text');
  expect(copy.textContent?.trim()).toBe('');
  expect(copy.querySelector('svg')).not.toBeNull();
});

function swipe(
  dx: number,
  dy = 0,
  cancel = false,
  target?: Element,
  pointerType = 'touch',
) {
  const card = document.querySelector<HTMLElement>('.text-card')!;
  Object.defineProperty(card, 'offsetWidth', {
    configurable: true,
    value: 400,
  });
  const pointer = (target: EventTarget, name: string, x: number, y: number) => {
    const e = new MouseEvent(name, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.defineProperties(e, {
      pointerType: { value: pointerType },
      pointerId: { value: 1 },
    });
    target.dispatchEvent(e);
  };
  pointer(target ?? card, 'pointerdown', 300, 200);
  pointer(window, 'pointermove', 300 + dx, 200 + dy);
  pointer(window, cancel ? 'pointercancel' : 'pointerup', 300 + dx, 200 + dy);
}

test('a full Text swipe offers four-second Undo before deleting; partial and vertical gestures keep text', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  swipe(-30);
  swipe(-180, 200);
  swipe(-180, 0, true);
  await tick();
  expect(
    document.querySelector('[data-text-undo]')?.hasAttribute('hidden'),
  ).not.toBe(false);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  swipe(-180);
  await tick();
  expect(
    document.querySelector('[data-text-undo]')?.hasAttribute('hidden'),
  ).toBe(false);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  await vi.advanceTimersByTimeAsync(0);
  click('[data-text-undo]');
  await vi.advanceTimersByTimeAsync(4100);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  expect(
    document.querySelector('.text-card')?.classList.contains('text-pending'),
  ).toBe(false);
  swipe(-180);
  await vi.advanceTimersByTimeAsync(4100);
  expect(request).toHaveBeenCalledWith('/api/texts/one', 'DELETE');
  expect(document.querySelector('.text-card')).toBeNull();
});

test('gesture preference, native horizontal text scrolling and leaving cancel unreleased Text swipes', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  localStorage.setItem('storagi.gestures', 'off');
  swipe(-180);
  localStorage.removeItem('storagi.gestures');
  const card = document.querySelector<HTMLElement>('.text-card')!;
  const wheel = (target: Element) =>
    target.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 180 }),
    );
  const pre = card.querySelector('pre')!;
  Object.defineProperty(pre, 'scrollWidth', { value: 400 });
  Object.defineProperty(pre, 'clientWidth', { value: 200 });
  wheel(pre);
  await vi.advanceTimersByTimeAsync(200);
  expect(card.classList.contains('text-pending')).toBe(false);
  wheel(card);
  shelf.activate(false);
  await vi.advanceTimersByTimeAsync(5000);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  shelf.activate(true);
  await tick();
  wheel(card);
  window.dispatchEvent(new Event('pagehide'));
  await vi.advanceTimersByTimeAsync(5000);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
});

test('failed swipe deletion restores the row and teardown cancels pending deletion', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  request.mockRejectedValueOnce(new Error('Try again'));
  swipe(-180);
  expect(document.querySelector('.text-deleted .m-clock')?.textContent).toBe(
    '4s',
  );
  await vi.advanceTimersByTimeAsync(4100);
  expect(
    document.querySelector('.text-card')?.classList.contains('text-pending'),
  ).toBe(false);
  expect(document.querySelector('#text-error')?.textContent).toBe('Try again');
  const calls = request.mock.calls.length;
  swipe(-180);
  shelf.destroy();
  await vi.advanceTimersByTimeAsync(5000);
  expect(request).toHaveBeenCalledTimes(calls);
});

test('flushing the Text shelf commits released deletion', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  swipe(-180);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  shelf.flush();
  await tick();
  expect(request).toHaveBeenCalledWith('/api/texts/one', 'DELETE');
});

test('mouse text selection never starts a Text swipe', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const card = document.querySelector<HTMLElement>('.text-card')!;
  Object.defineProperty(card, 'offsetWidth', {
    configurable: true,
    value: 400,
  });
  const pointer = (target: EventTarget, type: string, clientX: number) =>
    target.dispatchEvent(
      Object.assign(
        new MouseEvent(type, { bubbles: true, button: 0, clientX }),
        { pointerId: 1, pointerType: 'mouse' },
      ),
    );
  pointer(card.querySelector('pre')!, 'pointerdown', 300);
  pointer(window, 'pointermove', 50);
  pointer(window, 'pointerup', 50);
  expect(card.classList.contains('text-pending')).toBe(false);
});

test('native touch long-press on Text keeps its context menu and cancels the pending swipe', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const pre = document.querySelector('#text-items pre')!;
  pre.dispatchEvent(
    Object.assign(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 300 }),
      { pointerId: 1, pointerType: 'touch' },
    ),
  );
  const menu = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  });
  pre.dispatchEvent(menu);
  expect(menu.defaultPrevented).toBe(false);
  window.dispatchEvent(
    Object.assign(new MouseEvent('pointermove', { clientX: 50 }), {
      pointerId: 1,
      pointerType: 'touch',
    }),
  );
  window.dispatchEvent(
    Object.assign(new MouseEvent('pointerup'), {
      pointerId: 1,
      pointerType: 'touch',
    }),
  );
  expect(document.querySelector('.text-pending')).toBeNull();
});

test('native text selection cancels a pending Text swipe before handles can move', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const pre = document.querySelector('#text-items pre')!;
  pre.dispatchEvent(
    Object.assign(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 300 }),
      { pointerId: 1, pointerType: 'touch' },
    ),
  );
  const range = document.createRange();
  range.selectNodeContents(pre);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  expect(window.getSelection()!.toString()).toContain('example.com');
  document.dispatchEvent(new Event('selectionchange'));
  window.getSelection()!.removeAllRanges();
  window.dispatchEvent(
    Object.assign(new MouseEvent('pointermove', { clientX: 50 }), {
      pointerId: 1,
      pointerType: 'touch',
    }),
  );
  window.dispatchEvent(
    Object.assign(new MouseEvent('pointerup'), {
      pointerId: 1,
      pointerType: 'touch',
    }),
  );
  expect(document.querySelector('.text-pending')).toBeNull();
});

test('touch swiping directly on a Text URL offers Undo without opening it', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  swipe(-180, 0, false, document.querySelector('[data-text-open]')!);
  expect(document.querySelector('.text-pending')).not.toBeNull();
});

test('a trackpad swipe over wrapped Text content offers Undo', async () => {
  vi.useFakeTimers();
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const pre = document.querySelector('#text-items pre')!;
  pre.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 180 }),
  );
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('.text-pending')).not.toBeNull();
});

test('keyboard Undo restores Copy focus and deletion is announced once', async () => {
  vi.useFakeTimers();
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  swipe(-180);
  await vi.advanceTimersByTimeAsync(0);
  const undo = document.querySelector<HTMLButtonElement>('[data-text-undo]')!;
  undo.focus();
  undo.click();
  expect(document.activeElement).toBe(
    document.querySelector('[data-text-copy]'),
  );
  expect(document.querySelector('#text-sync')?.textContent).toContain('undone');
  swipe(-180);
  const announcement = document.querySelector('#text-sync')?.textContent;
  expect(announcement).toContain('Undo');
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelector('#text-sync')?.textContent).toBe(announcement);
});

test('Undo identifies the same note as Copy for assistive technology', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  expect(
    document
      .querySelector('[data-text-undo]')
      ?.getAttribute('aria-describedby'),
  ).toBe(
    document
      .querySelector('[data-text-copy]')
      ?.getAttribute('aria-describedby'),
  );
});

test('long shelf retention displays days instead of hundreds of hours', async () => {
  const { shelf, setItems } = mount();
  const now = Date.now();
  setItems([
    {
      id: 'long',
      text: 'A shelf note',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 86400000).toISOString(),
    },
  ]);
  shelf.activate(true);
  await tick();
  expect(document.querySelector('.text-expiry')?.textContent).toBe('30d left');
});

test('auto-grow includes the non-scrolling textarea insets and preserves its cap', () => {
  mount();
  Object.defineProperties(draft(), {
    scrollHeight: {
      configurable: true,
      get: () => (draft().value === 'long' ? 600 : draft().value ? 120 : 62),
    },
    offsetHeight: { configurable: true, value: 240 },
    clientHeight: { configurable: true, value: 154 },
  });
  type('a few lines');
  expect(draft().style.height).toBe('206px');
  type('long');
  expect(draft().style.height).toBe('240px');
  type('');
  expect(draft().style.height).toBe('148px');
});

test('desktop mouse swipes on Text row whitespace offer Undo while selectable content and controls stay native', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  const card = document.querySelector<HTMLElement>('.text-card')!;
  for (const target of [
    card,
    card.querySelector('.text-card-actions')!,
    card.querySelector('time')!,
  ]) {
    swipe(-180, 0, false, target, 'mouse');
    expect(card.classList.contains('text-pending')).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    click('[data-text-undo]');
    expect(card.classList.contains('text-pending')).toBe(false);
  }
  for (const target of [
    card.querySelector('pre')!,
    card.querySelector('a')!,
    card.querySelector('[data-text-copy]')!,
  ]) {
    swipe(-180, 0, false, target, 'mouse');
    expect(card.classList.contains('text-pending')).toBe(false);
  }
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
});

test('Text swipe uses the Inbox Deleted morph and separate countdown while retaining expiry', async () => {
  vi.useFakeTimers();
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const expiry = document.querySelector('.text-expiry')!.textContent;
  swipe(-180);
  const undo = document.querySelector('[data-text-undo]')!;
  expect(undo.closest('.morph')?.querySelector('.m-ok')?.textContent).toBe(
    '✓ Deleted',
  );
  expect(undo.closest('.morph')?.querySelector('.m-clock')?.textContent).toBe(
    '4s',
  );
  expect(document.querySelector('.text-expiry')?.textContent).toBe(expiry);
  await vi.advanceTimersByTimeAsync(1000);
  expect(undo.closest('.morph')?.querySelector('.m-clock')?.textContent).toBe(
    '3s',
  );
  expect(document.querySelector('[data-text-undo]')).toBe(undo);
});

test('confirmed Text deletion uses the same four-second Undo grace as a swipe', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  click('[data-text-delete]');
  expect(
    document.querySelector('[data-text-confirm]')?.closest('.morph'),
  ).not.toBeNull();
  click('[data-text-confirm]');
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  const undo = document.querySelector<HTMLElement>('[data-text-undo]')!;
  expect(document.activeElement).toBe(undo);
  undo.click();
  await vi.advanceTimersByTimeAsync(4100);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  click('[data-text-delete]');
  click('[data-text-confirm]');
  await vi.advanceTimersByTimeAsync(3999);
  expect(request.mock.calls.some((x) => x[1] === 'DELETE')).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledWith('/api/texts/one', 'DELETE');
});

test('committing a Text deletion shows the shared spinner and a failed DELETE restores the actions', async () => {
  vi.useFakeTimers();
  const { shelf, request } = mount();
  shelf.activate(true);
  await tick();
  let fail!: (error: Error) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  swipe(-180);
  await vi.advanceTimersByTimeAsync(4000);
  expect(document.querySelector<HTMLElement>('.text-deleting')!.hidden).toBe(
    false,
  );
  expect(document.querySelector('.text-deleting .spin')).not.toBeNull();
  expect(document.querySelector<HTMLElement>('[data-text-undo]')!.hidden).toBe(
    true,
  );
  fail(new Error('Try again'));
  await tick();
  expect(document.querySelector<HTMLElement>('.text-deleting')!.hidden).toBe(
    true,
  );
  expect(document.querySelector<HTMLElement>('[data-text-copy]')!.hidden).toBe(
    false,
  );
  expect(document.querySelector('#text-error')?.textContent).toBe('Try again');
});

test('stale Text actions cannot reopen confirmation while a row is counting down', async () => {
  vi.useFakeTimers();
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  swipe(-180);
  await vi.advanceTimersByTimeAsync(0);
  click('[data-text-delete]');
  expect(
    document.querySelector<HTMLElement>('.text-delete-confirm')!.hidden,
  ).toBe(true);
  expect(document.querySelector<HTMLElement>('.text-deleted')!.hidden).toBe(
    false,
  );
});

test('desktop blank-area swipe clears an earlier selection without changing native content selection', async () => {
  vi.useFakeTimers();
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const card = document.querySelector<HTMLElement>('.text-card')!;
  const range = document.createRange();
  range.setStart(card.querySelector('a')!.firstChild!, 0);
  range.setEnd(card.querySelector('a')!.firstChild!, 5);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  expect(selection.toString()).toBe('https');
  swipe(-180, 0, false, card.querySelector('pre')!, 'mouse');
  expect(selection.toString()).toBe('https');
  expect(card.classList.contains('text-pending')).toBe(false);
  swipe(-180, 0, false, card.querySelector('.text-card-actions')!, 'mouse');
  expect(card.classList.contains('text-pending')).toBe(true);
  expect(selection.toString()).toBe('');
});

test('confirmed deletion never steals composer focus during grace or a delayed response', async () => {
  vi.useFakeTimers();
  const { shelf, request, setItems } = mount();
  shelf.activate(true);
  await tick();
  let finish!: () => void;
  request.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = () => {
          setItems([]);
          resolve(new Response(null, { status: 204 }));
        };
      }),
  );
  click('[data-text-delete]');
  click('[data-text-confirm]');
  draft().focus();
  type('Keep typing during the grace');
  await vi.advanceTimersByTimeAsync(4000);
  expect(document.activeElement).toBe(draft());
  type('Keep typing during the request');
  finish();
  await tick();
  expect(document.querySelector('.text-card')).toBeNull();
  expect(document.activeElement).toBe(draft());
  expect(draft().value).toBe('Keep typing during the request');
});
