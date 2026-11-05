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
  const shelf = createTextShelf(document.body, request, toast);
  dispose = shelf.destroy;
  return {
    shelf,
    request,
    toast,
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
    'Host offline',
  );
  expect(
    document.querySelector<HTMLButtonElement>('#text-send')!.disabled,
  ).toBe(false);
});

test('receiving shelf refreshes every five seconds, on focus, filters expiry and never executes text', async () => {
  vi.useFakeTimers();
  const { shelf, request, setItems } = mount();
  shelf.activate(true);
  await tick();
  setItems([
    {
      id: 'unsafe',
      text: '<img src=x onerror=alert(1)>',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4000).toISOString(),
    },
  ]);
  window.dispatchEvent(new Event('focus'));
  await tick();
  expect(document.querySelector('#text-items img')).toBeNull();
  expect(document.querySelector('#text-items pre')?.textContent).toContain(
    '<img',
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(document.querySelectorAll('#text-items article')).toHaveLength(0);
  shelf.activate(false);
  const calls = request.mock.calls.length;
  await vi.advanceTimersByTimeAsync(15000);
  expect(request).toHaveBeenCalledTimes(calls);
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
  const { shelf, request } = mount();
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
  click('[data-text-confirm]');
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
  expect(document.querySelector('#text-send span')?.textContent).toBe(
    'Send text',
  );
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

test('pickup precedes composition in DOM order, New text jumps to the draft and actions have card context', async () => {
  const { shelf } = mount();
  shelf.activate(true);
  await tick();
  const items = document.querySelector('#text-items')!;
  const form = document.querySelector('#text-form')!;
  expect(
    items.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  click('#text-new');
  expect(document.activeElement).toBe(draft());
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
