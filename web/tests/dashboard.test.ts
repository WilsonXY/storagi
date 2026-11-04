import { afterEach, expect, test, vi } from 'vitest';
import { createDashboard } from '../src/dashboard';
const listing = {
  files: [
    {
      id: 'old-id',
      name: 'archive.zip',
      size: 1024,
      uploadedAt: '2026-10-01T12:00:00Z',
      expiresAt: '2099-10-31T00:00:00Z',
    },
    {
      id: 'new-id',
      name: 'archive.zip',
      size: 2048,
      uploadedAt: '2026-10-18T12:00:00Z',
      expiresAt: '2099-11-17T00:00:00Z',
    },
  ],
  usedBytes: 3072,
  reservedBytes: 512,
  budgetBytes: 200 * 1024 ** 3,
};
const tick = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
let dispose = () => {};
afterEach(() => {
  dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function service() {
  let status = 200;
  const fetcher = vi.fn(
    async (url: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          String(url) === '/api/session'
            ? { authenticated: true, csrfToken: 'test-csrf' }
            : listing,
        ),
        { status: String(url) === '/api/files' ? status : 200 },
      ),
  );
  return {
    fetcher,
    fail: (value: number) => {
      status = value;
    },
  };
}
async function mount(fetcher = service().fetcher) {
  document.body.innerHTML = '<main id="app"></main>';
  dispose = await createDashboard(document.querySelector('#app')!, {
    fetch: fetcher,
  });
}
const click = (selector: string) =>
  document.querySelector<HTMLElement>(selector)!.click();
const rows = () => [...document.querySelectorAll<HTMLElement>('#groups .row')];

test('locked pond contains a static decoy and never renders private shelf data', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
  await mount(fetcher);
  expect(document.querySelector('#locked-decoy, .locked-decoy')).not.toBeNull();
  expect(
    document.querySelector('a[href="/auth/login"]')?.textContent,
  ).toContain('Google');
  expect(document.querySelector('#groups')).toBeNull();
  expect(document.body.textContent).not.toContain('archive.zip');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('account shows the Google name as text and swaps in the photo only once it loads', async () => {
  const photos: HTMLImageElement[] = [];
  vi.stubGlobal(
    'Image',
    class extends Image {
      constructor() {
        super();
        photos.push(this);
      }
    },
  );
  const account = async (name: string) => {
    await mount(
      vi.fn(
        async (url: RequestInfo | URL) =>
          new Response(
            JSON.stringify(
              String(url) === '/api/session'
                ? {
                    authenticated: true,
                    csrfToken: 'test-csrf',
                    name,
                    picture: 'https://lh3.googleusercontent.com/a/photo',
                  }
                : listing,
            ),
          ),
      ),
    );
    return document.querySelector('#avatar')!;
  };
  let avatar = await account('Ada Lovelace');
  expect(document.querySelector('#account-name')?.textContent).toBe(
    'Ada Lovelace',
  );
  expect(avatar.textContent).toBe('A');
  expect(avatar.querySelector('img')).toBeNull();
  expect(photos.at(-1)!.src).toBe('https://lh3.googleusercontent.com/a/photo');
  photos.at(-1)!.dispatchEvent(new Event('load'));
  expect(avatar.querySelector('img')).toBe(photos.at(-1));
  dispose();
  avatar = await account('<img src=x onerror=alert(1)>');
  expect(document.querySelector('#account-name')?.textContent).toBe(
    '<img src=x onerror=alert(1)>',
  );
  expect(document.querySelector('#account-name img')).toBeNull();
  photos.at(-1)!.dispatchEvent(new Event('error'));
  expect(avatar.textContent).toBe('<');
  expect(avatar.querySelector('img')).toBeNull();
});

test('shelf groups local days, labels duplicates, searches safely and retains sorting after refresh', async () => {
  const api = service();
  await mount(api.fetcher);
  expect(rows().map((row) => row.dataset.id)).toEqual(['new-id', 'old-id']);
  expect(document.querySelectorAll('.group h3')).toHaveLength(2);
  expect(rows()[0].querySelector('.copy')?.textContent).toBe('copy new-id');
  click('[data-sort="size"]');
  expect(rows().map((row) => row.dataset.id)).toEqual(['old-id', 'new-id']);
  expect(document.querySelectorAll('.group h3')).toHaveLength(0);
  click('#refresh');
  await tick();
  expect(rows().map((row) => row.dataset.id)).toEqual(['old-id', 'new-id']);
  click('#sort-clear');
  expect(rows()[0].dataset.id).toBe('new-id');
  const search = document.querySelector<HTMLInputElement>('#search')!;
  search.value = 'no match';
  search.dispatchEvent(new Event('input'));
  expect(rows()).toHaveLength(0);
  expect(document.querySelector('#no-match')?.textContent).toContain(
    'No filenames match',
  );
  search.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  expect(rows()).toHaveLength(2);
});

test('inline deletion waits four seconds and sends CSRF; Undo never sends DELETE', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('[data-del="new-id"]');
  expect(document.querySelector('[data-confirm="new-id"]')).not.toBeNull();
  expect(api.fetcher).toHaveBeenCalledTimes(2);
  click('[data-confirm="new-id"]');
  await vi.advanceTimersByTimeAsync(3999);
  expect(
    api.fetcher.mock.calls.filter((c) => String(c[0]).includes('/new-id')),
  ).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(api.fetcher).toHaveBeenCalledWith(
    '/api/files/new-id',
    expect.objectContaining({
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'test-csrf' },
    }),
  );
  click('[data-del="old-id"]');
  click('[data-confirm="old-id"]');
  click('[data-undo="old-id"]');
  await vi.advanceTimersByTimeAsync(6500);
  expect(
    api.fetcher.mock.calls.filter((c) => String(c[0]).includes('/old-id')),
  ).toHaveLength(0);
});

test('select-all is tri-state and bulk Undo restores rows without deleting anything', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('[data-id="new-id"] .lead');
  expect(
    document.querySelector<HTMLInputElement>('#select-all')!.indeterminate,
  ).toBe(true);
  click('#select-all');
  expect(document.querySelector<HTMLInputElement>('#select-all')!.checked).toBe(
    true,
  );
  expect(document.querySelector('#sel-count')?.textContent).toBe('2');
  click('#sel-delete');
  expect(rows()).toHaveLength(0);
  click('#notice button');
  expect(rows()).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(6500);
  expect(api.fetcher).toHaveBeenCalledTimes(2);
});

test('failed listing keeps the list visible, pins offline status, and recovers on retry', async () => {
  const api = service();
  await mount(api.fetcher);
  api.fail(503);
  click('#refresh');
  await tick();
  expect(document.querySelector<HTMLElement>('#offline')!.hidden).toBe(false);
  expect(document.title).toBe('Offline · Storagi');
  expect(rows()).toHaveLength(2);
  expect(document.querySelector('#fresh')?.classList.contains('off')).toBe(
    true,
  );
  api.fail(200);
  click('#retry');
  await tick();
  expect(document.querySelector<HTMLElement>('#offline')!.hidden).toBe(true);
  expect(document.title).toBe('Storagi');
});

test('401 on refresh clears private content and explains session recovery', async () => {
  const api = service();
  await mount(api.fetcher);
  api.fail(401);
  click('#refresh');
  await tick();
  expect(document.querySelector('#groups')).toBeNull();
  expect(document.body.textContent).not.toContain('archive.zip');
  expect(document.querySelector('.session-expired')?.textContent).toContain(
    'choose interrupted files again',
  );
});

test('reserved bytes count toward the full-shelf notice and meter', async () => {
  const budget = listing.budgetBytes;
  listing.budgetBytes = listing.usedBytes + listing.reservedBytes;
  try {
    await mount();
    expect(document.querySelector<HTMLElement>('#full-shelf')!.hidden).toBe(
      false,
    );
    expect(
      document.querySelector('#meter')?.getAttribute('aria-label'),
    ).toContain('including reserved uploads');
  } finally {
    listing.budgetBytes = budget;
  }
});

test('sign-out popup asks before posting logout with CSRF', async () => {
  const api = service();
  await mount(api.fetcher);
  click('#sign-out');
  expect(document.querySelector<HTMLElement>('#signout-pop')!.hidden).toBe(
    false,
  );
  expect(api.fetcher).toHaveBeenCalledTimes(2);
  click('#signout-confirm');
  await tick();
  expect(api.fetcher).toHaveBeenCalledWith(
    '/auth/logout',
    expect.objectContaining({
      method: 'POST',
      headers: { 'X-CSRF-Token': 'test-csrf' },
    }),
  );
  expect(document.querySelector('#groups')).toBeNull();
  expect(document.querySelector<HTMLElement>('.session-expired')!.hidden).toBe(
    true,
  );
});

test('single download calls the save picker synchronously and streams the response to disk', async () => {
  const write = vi.fn().mockResolvedValue(undefined),
    close = vi.fn().mockResolvedValue(undefined),
    abort = vi.fn().mockResolvedValue(undefined);
  const picker = vi.fn().mockResolvedValue({
    createWritable: async () => ({ write, close, abort }),
  });
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: picker,
  });
  const api = service();
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) =>
      String(url).endsWith('/download')
        ? new Response('fixture', { headers: { 'Content-Length': '7' } })
        : api.fetcher(url),
  );
  await mount(fetcher as typeof api.fetcher);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  document.querySelector('[data-dl="new-id"]')!.dispatchEvent(event);
  expect(picker).toHaveBeenCalledWith({ suggestedName: 'archive.zip' });
  expect(event.defaultPrevented).toBe(true);
  await tick();
  expect(write).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(document.querySelector('.tr.done')?.textContent).toContain(
    'Saved to this device',
  );
  delete (window as Window & { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
});

test('download without a picker remains a plain browser link', async () => {
  await mount();
  const a = document.querySelector<HTMLAnchorElement>('[data-dl="new-id"]')!;
  expect(a.getAttribute('href')).toBe('/api/files/new-id/download');
  expect(a.hasAttribute('download')).toBe(true);
  // Suppress jsdom navigation after observing the app's handler; it must leave the default action intact.
  let prevented = true;
  const handler = (e: MouseEvent) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', handler, { once: true });
  a.click();
  expect(prevented).toBe(false);
  expect(document.querySelector('.toast')?.textContent).toContain(
    'Downloading in your browser',
  );
});

test('hostile filenames stay text and expired copies have no download', async () => {
  const original = { ...listing.files[0] };
  listing.files[0].name = '<img src=x onerror=alert(1)>.zip';
  listing.files[0].expiresAt = '2000-01-01';
  try {
    await mount();
    const row = document.querySelector('[data-id="old-id"]')!;
    expect(row.querySelector('strong')?.textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
    expect(row.querySelector('strong')?.getAttribute('title')).toBe(
      listing.files[0].name,
    );
    expect(row.querySelector('.cell.type')?.textContent).toBe('zip');
    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('[data-dl]')).toBeNull();
    expect(row.textContent).toContain('Expired');
  } finally {
    listing.files[0] = original;
  }
});

test('initial connection failure offers a loading-screen retry', async () => {
  await mount(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  expect(document.querySelector('#loading')?.textContent).toContain(
    'The host may be offline',
  );
  expect(document.querySelector('#retry-connection')?.textContent).toBe(
    'Try again',
  );
});

test('direct checkbox clicks stay checked and shift selection selects a range', async () => {
  await mount();
  const box = document.querySelector<HTMLInputElement>(
    '[data-id="new-id"] .check',
  )!;
  // Checked before any microtask: a real click runs them before the browser restores a cancelled box.
  box.click();
  expect(box.checked).toBe(true);
  box.click();
  expect(box.checked).toBe(false);
  box.click();
  expect(box.checked).toBe(true);
  document.querySelector('[data-id="old-id"] .lead')!.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    }),
  );
  expect(document.querySelector('#sel-count')?.textContent).toBe('2');
});

test('bulk deletion commits each copy after the grace period', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('#select-all');
  click('#sel-delete');
  await vi.advanceTimersByTimeAsync(3999);
  expect(api.fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  for (const id of ['new-id', 'old-id'])
    expect(api.fetcher).toHaveBeenCalledWith(
      `/api/files/${id}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: { 'X-CSRF-Token': 'test-csrf' },
      }),
    );
});

test('network failure retries automatically in ten seconds and expiry cancels pending deletion', async () => {
  vi.useFakeTimers();
  const api = service();
  let offline = false;
  const fetcher = vi.fn((url: RequestInfo | URL) =>
    offline
      ? Promise.reject(new TypeError('Failed to fetch'))
      : api.fetcher(url),
  );
  await mount(fetcher);
  offline = true;
  click('#refresh');
  await tick();
  expect(document.title).toBe('Offline · Storagi');
  offline = false;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(document.title).toBe('Storagi');
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  api.fail(401);
  click('#refresh');
  await tick();
  await vi.advanceTimersByTimeAsync(6000);
  expect(
    fetcher.mock.calls.filter((c) => String(c[0]).endsWith('/new-id')),
  ).toHaveLength(0);
});

test('streamed download has Cancel only and aborts the request and writable', async () => {
  const abort = vi.fn().mockResolvedValue(undefined),
    write = vi.fn().mockResolvedValue(undefined);
  const picker = vi.fn().mockResolvedValue({
    createWritable: async () => ({ write, abort, close: vi.fn() }),
  });
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: picker,
  });
  let signal: AbortSignal | null | undefined;
  const api = service();
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).endsWith('/download')) {
        signal = options?.signal;
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array([1]));
            },
          }),
          { headers: { 'Content-Length': '100' } },
        );
      }
      return api.fetcher(url);
    },
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-dl="new-id"]');
  await tick();
  expect(document.querySelectorAll('.tr [data-action]')).toHaveLength(1);
  click('.tr [data-action="cancel"]');
  await tick();
  expect(signal?.aborted).toBe(true);
  expect(abort).toHaveBeenCalled();
  expect(document.querySelector('.tr.cancelled')).not.toBeNull();
  delete (window as Window & { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
});

test('the download path follows the picker API, not the window width', async () => {
  const picker = vi.fn(() => new Promise(() => {}));
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: picker,
  });
  vi.stubGlobal('innerWidth', 390);
  await mount();
  click('[data-dl="new-id"]');
  expect(picker).toHaveBeenCalledOnce();
  delete (window as Window & { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
});

test('settings persist switches, phone menu opens, and tabs and shortcuts change views', async () => {
  await mount();
  click('#nav-settings');
  expect(document.querySelector<HTMLElement>('#settings')!.hidden).toBe(false);
  click('#koi-switch');
  expect(localStorage.getItem('storagi.motion')).toBe('static');
  click('#gesture-switch');
  expect(localStorage.getItem('storagi.gestures')).toBe('off');
  click('.nav-item[data-tab="inbox"]');
  click('#menu-btn');
  expect(document.querySelector<HTMLElement>('#sheet')!.hidden).toBe(false);
  click('#sheet-close');
  vi.stubGlobal('innerWidth', 390);
  click('.tabs [data-tab="transfers"]');
  expect(document.querySelector('#shelf-app')?.getAttribute('data-tab')).toBe(
    'transfers',
  );
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: '/', bubbles: true }),
  );
  expect(document.activeElement?.id).toBe('search');
  localStorage.clear();
});
test('copy follows the prototype: singular bulk toast, sort labels, sign-out note, and the page survives pagehide', async () => {
  vi.useFakeTimers();
  await mount();
  click('[data-id="new-id"] .lead');
  click('#sel-delete');
  expect(document.querySelector('.toast span')?.textContent).toBe(
    '1 copy deleted',
  );
  click('#notice button');
  click('[data-sort="name"]');
  expect(
    document.querySelector('[data-sort="name"]')!.getAttribute('aria-label'),
  ).toBe('Name, sorted A to Z');
  expect(
    document.querySelector('[data-sort="size"]')!.getAttribute('aria-label'),
  ).toBe('Sort by size');
  click('#sign-out');
  expect(document.querySelector('#signout-note')?.textContent).toBe(
    'Your files stay on the shelf.',
  );
  window.dispatchEvent(new Event('pagehide'));
  click('#signout-cancel');
  expect(document.querySelector('#signout-pop')!.hasAttribute('hidden')).toBe(
    true,
  );
});
test('a dashboard opened in a background tab still loads its list', async () => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  try {
    const api = service();
    await mount(api.fetcher);
    expect(api.fetcher).toHaveBeenCalledWith('/api/files', expect.anything());
    expect(rows()).toHaveLength(2);
  } finally {
    delete (document as { visibilityState?: unknown }).visibilityState;
  }
});
test('leaving the page sends pending deletes at once, inline and folded bulk, so they survive unload', async () => {
  vi.useFakeTimers();
  const api = service(),
    three = {
      ...listing,
      files: [
        ...listing.files,
        { ...listing.files[0], id: 'third-id', name: 'third.zip' },
      ],
    };
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) =>
      options?.method === 'DELETE'
        ? new Promise<Response>(() => {})
        : String(url) === '/api/files'
          ? new Response(JSON.stringify(three))
          : api.fetcher(url),
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  click('[data-id="old-id"] .lead');
  click('#sel-delete');
  click('[data-id="third-id"] .lead');
  click('#sel-delete');
  window.dispatchEvent(new Event('pagehide'));
  const sent = (fetcher.mock.calls as unknown[][]).filter(
    (c) => (c[1] as RequestInit | undefined)?.method === 'DELETE',
  );
  expect(sent.map((c) => String(c[0])).sort()).toEqual([
    '/api/files/new-id',
    '/api/files/old-id',
    '/api/files/third-id',
  ]);
  for (const c of sent)
    expect(c[1]).toEqual(expect.objectContaining({ keepalive: true }));
  // Restored from the back/forward cache before the DELETEs answer: no Undo that can no longer undo.
  await vi.advanceTimersByTimeAsync(10_000);
  expect(deletes(fetcher)).toHaveLength(3);
  expect(document.querySelector('[data-undo]')).toBeNull();
  expect(document.querySelector('#notice button')).toBeNull();
});
test('a delete whose grace simply runs out does not use keepalive', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  await vi.advanceTimersByTimeAsync(6500);
  const call = (api.fetcher.mock.calls as unknown[][]).find(
    (c) => (c[1] as RequestInit | undefined)?.method === 'DELETE',
  )!;
  expect(call[1]).toEqual(expect.objectContaining({ keepalive: false }));
});
test('an Undo toast is not pushed away by a later notice; the notice waits', async () => {
  vi.useFakeTimers();
  await mount();
  click('#select-all');
  click('#sel-delete');
  click('#choose');
  const picker = document.querySelector<HTMLInputElement>('#picker')!;
  Object.defineProperty(picker, 'files', {
    configurable: true,
    value: [new File(['x'], 'late.zip')],
  });
  picker.dispatchEvent(new Event('change'));
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '2 copies deleted',
  );
  click('#notice button');
  expect(rows()).toHaveLength(2);
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '1 file queued',
  );
});
test('expired copies get the friendly message, and duplicate rows name their copy for screen readers', async () => {
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: vi.fn().mockResolvedValue({
      createWritable: async () => ({
        write: vi.fn(),
        close: vi.fn(),
        abort: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });
  const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith('/download')
      ? new Response(JSON.stringify({ error: 'Not found' }), { status: 410 })
      : api.fetcher(url),
  );
  await mount(fetcher as typeof api.fetcher);
  const labels = [...document.querySelectorAll('[data-del]')].map((b) =>
    b.getAttribute('aria-label'),
  );
  expect(labels).toEqual([
    'Delete archive.zip · copy new-id',
    'Delete archive.zip · copy old-id',
  ]);
  click('[data-dl="new-id"]');
  await tick();
  expect(document.querySelector('.tr.error .tr-error')?.textContent).toBe(
    'This copy has expired or was removed. Refresh your Inbox.',
  );
  delete (window as Window & { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
});
test('a failed disk write aborts the download request', async () => {
  const abort = vi.fn().mockResolvedValue(undefined),
    write = vi.fn().mockRejectedValue(new Error('Disk full'));
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: vi.fn().mockResolvedValue({
      createWritable: async () => ({ write, close: vi.fn(), abort }),
    }),
  });
  let signal: AbortSignal | undefined;
  const api = service();
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).endsWith('/download')) {
        signal = options?.signal ?? undefined;
        return new Response('fixture');
      }
      return api.fetcher(url);
    },
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-dl="new-id"]');
  await tick();
  expect(signal?.aborted).toBe(true);
  expect(abort).toHaveBeenCalled();
  expect(document.querySelector('.tr.error')).not.toBeNull();
  delete (window as Window & { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
});
test('a touchpad sideways swipe deletes through the same four-second Undo', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  const row = document.querySelector('[data-id="new-id"]')!;
  row.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40 }),
  );
  await vi.advanceTimersByTimeAsync(400);
  expect(document.querySelector('[data-undo="new-id"]')).not.toBeNull();
  expect(document.querySelector('[data-clock="new-id"]')?.textContent).toBe(
    '4s',
  );
  click('[data-undo="new-id"]');
  await vi.advanceTimersByTimeAsync(7000);
  expect(
    api.fetcher.mock.calls.filter((c) => String(c[0]).includes('/new-id')),
  ).toHaveLength(0);
});
test('a second bulk delete inside the grace keeps Undo for both batches', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('[data-id="new-id"] .lead');
  click('#sel-delete');
  click('[data-id="old-id"] .lead');
  click('#sel-delete');
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '2 copies deleted',
  );
  click('#notice button');
  expect(rows()).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(7000);
  expect(
    api.fetcher.mock.calls.filter(
      (c) =>
        ((c as unknown[])[1] as RequestInit | undefined)?.method === 'DELETE',
    ),
  ).toHaveLength(0);
});
test('a bulk delete treats an already-removed copy as deleted and still deletes the rest', async () => {
  vi.useFakeTimers();
  const api = service();
  const deleted: string[] = [];
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method !== 'DELETE') return api.fetcher(url);
      deleted.push(String(url));
      return String(url).endsWith('/new-id')
        ? new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
        : new Response(null, { status: 204 });
    },
  );
  await mount(fetcher as typeof api.fetcher);
  click('#select-all');
  click('#sel-delete');
  await vi.advanceTimersByTimeAsync(6500);
  expect(deleted).toEqual(['/api/files/new-id', '/api/files/old-id']);
  expect(document.querySelector('#notice')).toBeNull();
});
test('notices raised during an Undo show afterwards, in order, each message once', async () => {
  vi.useFakeTimers();
  await mount();
  click('#select-all');
  click('#sel-delete');
  const picker = document.querySelector<HTMLInputElement>('#picker')!;
  for (const name of ['a.zip', 'b.zip']) {
    Object.defineProperty(picker, 'files', {
      configurable: true,
      value: [new File(['x'], name)],
    });
    picker.dispatchEvent(new Event('change'));
  }
  Object.defineProperty(picker, 'files', {
    configurable: true,
    value: [new File(['x'], 'a.zip')],
  });
  picker.dispatchEvent(new Event('change'));
  click('#notice button');
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '1 file queued',
  );
  await vi.advanceTimersByTimeAsync(4000);
  expect(document.querySelector('#notice span')?.textContent).toBe(
    'a.zip is already in your transfer queue.',
  );
});
test('a first load that fails does not claim an earlier good update', async () => {
  vi.useFakeTimers();
  const api = service();
  api.fail(503);
  await mount(api.fetcher);
  expect(document.querySelector('#last-good')?.textContent).toBe('—');
  expect(document.querySelector('#fresh-text')?.textContent).toBe(
    'Offline · last good —',
  );
});
const deletes = (fetcher: { mock: { calls: unknown[][] } }) =>
  fetcher.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE')
    .map((c) => String(c[0]));
test('a row already deleted inline is left out of a bulk delete, so either Undo really keeps it', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  click('#select-all');
  click('#sel-delete');
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '1 copy deleted',
  );
  click('#notice button');
  click('[data-undo="new-id"]');
  await vi.advanceTimersByTimeAsync(7000);
  expect(deletes(api.fetcher)).toEqual([]);
});
test('a later bulk delete folds earlier pending batches into one fresh four-second Undo', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  click('[data-id="new-id"] .lead');
  click('#sel-delete');
  await vi.advanceTimersByTimeAsync(2000);
  click('[data-id="old-id"] .lead');
  click('#sel-delete');
  await vi.advanceTimersByTimeAsync(3000);
  expect(deletes(api.fetcher)).toEqual([]);
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '2 copies deleted',
  );
  click('#notice button');
  await vi.advanceTimersByTimeAsync(7000);
  expect(deletes(api.fetcher)).toEqual([]);
  expect(rows()).toHaveLength(2);
});
test('a non-offline first-load failure does not print a 1970 "Updated" time', async () => {
  const api = service();
  api.fail(429);
  await mount(api.fetcher);
  expect(document.querySelector('#fresh-text')?.textContent).toContain(
    'Updated —',
  );
});
test('delete failures: a single 404 counts as deleted; a 500 on one copy still deletes the rest and reports once', async () => {
  vi.useFakeTimers();
  const api = service();
  let failNew = 404;
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) =>
      options?.method !== 'DELETE'
        ? api.fetcher(url)
        : String(url).endsWith('/new-id')
          ? new Response(JSON.stringify({ error: 'boom' }), { status: failNew })
          : new Response(null, { status: 204 }),
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  await vi.advanceTimersByTimeAsync(6500);
  expect(document.querySelector('#notice')).toBeNull();
  failNew = 500;
  click('#select-all');
  click('#sel-delete');
  await vi.advanceTimersByTimeAsync(6500);
  expect(deletes(fetcher)).toEqual([
    '/api/files/new-id',
    '/api/files/new-id',
    '/api/files/old-id',
  ]);
  expect(document.querySelector('#notice span')?.textContent).toBe('boom');
});
test('a bulk batch whose DELETEs have started is not folded into a later Undo', async () => {
  vi.useFakeTimers();
  const api = service();
  let release!: () => void;
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) =>
      options?.method !== 'DELETE'
        ? api.fetcher(url)
        : String(url).endsWith('/new-id')
          ? new Promise<Response>((r) => {
              release = () => r(new Response(null, { status: 204 }));
            })
          : new Response(null, { status: 204 }),
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-id="new-id"] .lead');
  click('#sel-delete');
  await vi.advanceTimersByTimeAsync(6500);
  click('[data-id="old-id"] .lead');
  click('#sel-delete');
  expect(document.querySelector('#notice span')?.textContent).toBe(
    '1 copy deleted',
  );
  click('#notice button');
  release();
  await vi.advanceTimersByTimeAsync(7000);
  expect(deletes(fetcher)).toEqual(['/api/files/new-id']);
});
test('a replaced Undo toast cannot be pressed while it fades out', async () => {
  vi.useFakeTimers();
  await mount();
  click('[data-id="new-id"] .lead');
  click('#sel-delete');
  click('[data-id="old-id"] .lead');
  click('#sel-delete');
  const [old] = [...document.querySelectorAll<HTMLElement>('.toast')];
  expect(old.id).toBe('');
  expect(old.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
});
test('rows counting down inline cannot be selected', async () => {
  vi.useFakeTimers();
  await mount();
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  click('#select-all');
  expect(document.querySelector('#sel-count')?.textContent).toBe('1');
  click('#sel-clear');
  click('[data-id="new-id"] .lead');
  expect(document.querySelector('#select-bar')!.classList.contains('out')).toBe(
    true,
  );
});
test('a list body that fails after the headers puts the page offline', async () => {
  const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url) === '/api/files'
      ? new Response('<html>portal</html>')
      : api.fetcher(url),
  );
  await mount(fetcher as typeof api.fetcher);
  expect(document.title).toBe('Offline · Storagi');
  expect(document.querySelector<HTMLElement>('#offline')!.hidden).toBe(false);
});
test('a download stream that drops puts the page offline', async () => {
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: vi.fn().mockResolvedValue({
      createWritable: async () => ({
        write: vi.fn(),
        close: vi.fn(),
        abort: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });
  const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith('/download')
      ? new Response(
          new ReadableStream({
            start(c) {
              c.error(new TypeError('network error'));
            },
          }),
        )
      : api.fetcher(url),
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-dl="new-id"]');
  await tick();
  expect(document.title).toBe('Offline · Storagi');
  expect(document.querySelector('.tr.error')).not.toBeNull();
  delete (window as Window & { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
});
test("a second swipe during the first swipe's exit animation cannot schedule a second delete", async () => {
  vi.useFakeTimers();
  const animate = vi.fn(() => ({
    finished: new Promise((r) => setTimeout(r, 200)),
  }));
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  });
  try {
    const api = service();
    await mount(api.fetcher);
    const swipe = () =>
      document.querySelector('[data-id="new-id"]')!.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: 40,
        }),
      );
    swipe();
    await vi.advanceTimersByTimeAsync(250);
    swipe();
    await vi.advanceTimersByTimeAsync(600);
    click('[data-undo="new-id"]');
    await vi.advanceTimersByTimeAsync(7000);
    expect(deletes(api.fetcher)).toEqual([]);
  } finally {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  }
});
test('once the grace ends the row says Deleting and offers no dead Undo', async () => {
  vi.useFakeTimers();
  const api = service();
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) =>
      options?.method === 'DELETE'
        ? new Promise<Response>(() => {})
        : api.fetcher(url),
  );
  await mount(fetcher as typeof api.fetcher);
  click('[data-del="new-id"]');
  click('[data-confirm="new-id"]');
  await vi.advanceTimersByTimeAsync(6300);
  expect(document.querySelector('[data-undo="new-id"]')).toBeNull();
  expect(
    document.querySelector('[data-id="new-id"] .m-quiet')?.textContent,
  ).toBe('Deleting');
});
const slowAnimations = () =>
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: vi.fn(() => ({ finished: new Promise((r) => setTimeout(r, 200)) })),
  });
const swipeRow = (id: string) =>
  document
    .querySelector(`[data-id="${id}"]`)!
    .dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40 }),
    );
test('a released swipe owns its row: a bulk delete during the animation leaves it out, and bulk Undo cannot leave a hidden delete behind', async () => {
  vi.useFakeTimers();
  slowAnimations();
  try {
    const api = service();
    await mount(api.fetcher);
    click('[data-id="new-id"] .lead');
    click('[data-id="old-id"] .lead');
    swipeRow('new-id');
    await vi.advanceTimersByTimeAsync(150);
    click('#sel-delete');
    expect(document.querySelector('#notice span')?.textContent).toBe(
      '1 copy deleted',
    );
    await vi.advanceTimersByTimeAsync(20);
    click('#notice button');
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelector('[data-undo="new-id"]')).not.toBeNull();
    click('[data-undo="new-id"]');
    await vi.advanceTimersByTimeAsync(7000);
    expect(deletes(api.fetcher)).toEqual([]);
  } finally {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  }
});
test('the list re-renders when a swipe settles, so selection never includes the swiped row', async () => {
  vi.useFakeTimers();
  slowAnimations();
  try {
    await mount();
    click('[data-id="new-id"] .lead');
    swipeRow('new-id');
    await vi.advanceTimersByTimeAsync(150);
    click('#sel-delete');
    await vi.advanceTimersByTimeAsync(300);
    click('#select-all');
    expect(document.querySelector('#sel-count')?.textContent).toBe('1');
    expect(
      document.querySelector('[data-id="new-id"]')!.classList.contains('ghost'),
    ).toBe(true);
  } finally {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  }
});
test("the swiped row's stale buttons do nothing while it settles, so its Undo survives", async () => {
  vi.useFakeTimers();
  slowAnimations();
  try {
    const api = service();
    await mount(api.fetcher);
    swipeRow('new-id');
    await vi.advanceTimersByTimeAsync(150);
    click('[data-del="new-id"]');
    document.querySelector<HTMLElement>('[data-cancel="new-id"]')?.click();
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelector('[data-undo="new-id"]')).not.toBeNull();
    click('[data-undo="new-id"]');
    await vi.advanceTimersByTimeAsync(7000);
    expect(deletes(api.fetcher)).toEqual([]);
  } finally {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  }
});
test('Ctrl+A while a swipe settles leaves the swiped row out', async () => {
  vi.useFakeTimers();
  slowAnimations();
  try {
    await mount();
    swipeRow('new-id');
    await vi.advanceTimersByTimeAsync(150);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelector('#sel-count')?.textContent).toBe('1');
  } finally {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  }
});
test('leaving the page before a touchpad swipe is released cancels it instead of deleting later', async () => {
  vi.useFakeTimers();
  const api = service();
  await mount(api.fetcher);
  swipeRow('new-id');
  window.dispatchEvent(new Event('pagehide'));
  await vi.advanceTimersByTimeAsync(7000);
  expect(deletes(api.fetcher)).toEqual([]);
  expect(document.querySelector('[data-undo="new-id"]')).toBeNull();
});
const pointer = (
  target: EventTarget,
  type: string,
  y: number,
  pointerType = 'mouse',
) =>
  target.dispatchEvent(
    Object.assign(
      new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: 10,
        clientY: y,
      }),
      { pointerId: 1, pointerType },
    ),
  );
test('confirming a delete in the middle of a drag-select drops that row from the selection for good', async () => {
  vi.useFakeTimers();
  await mount();
  click('[data-del="old-id"]');
  pointer(
    document.querySelector('[data-id="new-id"] .lead')!,
    'pointerdown',
    0,
  );
  pointer(window, 'pointermove', 20);
  expect(document.querySelector('#sel-count')?.textContent).toBe('2');
  click('[data-confirm="old-id"]');
  pointer(window, 'pointermove', 30);
  pointer(window, 'pointerup', 30);
  expect(document.querySelector('#sel-count')?.textContent).toBe('1');
});
test('on touch, a quick second tap on a row paints from it; a slow one or a button tap first does not', async () => {
  vi.useFakeTimers();
  await mount();
  // Rows 60 px tall from y=700; jsdom's innerHeight is 768, so both rows sit in the bottom edge-scroll band.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const top = 700 + rows().indexOf(this as HTMLElement) * 60;
      return { top, bottom: top + 60 } as DOMRect;
    },
  );
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  const name = (i: number) => rows()[i].querySelector('.name')!;
  const count = () => document.querySelector('#sel-count')?.textContent ?? '0';
  const touch = (target: EventTarget, type: string, y: number) =>
    pointer(target, type, y, 'touch');
  const tap = (target: Element, y: number) => {
    touch(target, 'pointerdown', y);
    touch(window, 'pointerup', y);
  };
  const touchstartCancelled = (target: Element) =>
    !target.dispatchEvent(
      new Event('touchstart', { bubbles: true, cancelable: true }),
    );
  tap(name(0), 730);
  await vi.advanceTimersByTimeAsync(500);
  touch(name(0), 'pointerdown', 730);
  expect(touchstartCancelled(name(0))).toBe(false);
  touch(window, 'pointermove', 790);
  touch(window, 'pointerup', 790);
  tap(rows()[0].querySelector('[data-del]')!, 730);
  touch(name(0), 'pointerdown', 730);
  touch(window, 'pointermove', 790);
  touch(window, 'pointerup', 790);
  expect(count()).toBe('0');
  tap(name(0), 730);
  await vi.advanceTimersByTimeAsync(150);
  touch(name(0), 'pointerdown', 730);
  expect(touchstartCancelled(name(0))).toBe(true);
  touch(window, 'pointermove', 790);
  touch(window, 'pointerup', 790);
  expect(count()).toBe('2');
  // A double tap without a drag toggles one row, even in the edge band: edge scrolling waits for a drag.
  scroll.mockClear();
  tap(name(1), 790);
  await vi.advanceTimersByTimeAsync(150);
  touch(name(1), 'pointerdown', 790);
  await vi.advanceTimersByTimeAsync(200);
  touch(window, 'pointerup', 790);
  expect(count()).toBe('1');
  expect(scroll).not.toHaveBeenCalled();
});
test('a swipe that replaces the focused Delete button moves focus to its Undo', async () => {
  vi.useFakeTimers();
  await mount();
  document.querySelector<HTMLElement>('[data-del="new-id"]')!.focus();
  swipeRow('new-id');
  await vi.advanceTimersByTimeAsync(300);
  expect((document.activeElement as HTMLElement | null)?.dataset.undo).toBe(
    'new-id',
  );
});
test('a mouse resting on an image row previews it once loaded, reuses it, and the setting turns previews off', async () => {
  vi.useFakeTimers();
  const images: HTMLImageElement[] = [];
  vi.stubGlobal(
    'Image',
    class extends Image {
      constructor() {
        super();
        images.push(this);
      }
    },
  );
  const photo = {
    id: 'img-id',
    name: 'Photo.JPG',
    size: 4096,
    uploadedAt: '2026-10-18T12:00:00Z',
    expiresAt: '2099-11-17T00:00:00Z',
  };
  await mount(
    vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : { ...listing, files: [...listing.files, photo] },
          ),
        ),
    ),
  );
  const box = document.querySelector<HTMLElement>('#hover-preview')!,
    groups = document.querySelector('#groups')!;
  const tip = (id: string) =>
    document.querySelector(`[data-id="${id}"] strong`)!.getAttribute('title');
  // The name tooltip would cover the preview, so only rows without one keep it.
  expect(tip('img-id')).toBeNull();
  expect(tip('new-id')).toBe('archive.zip');
  const move = (
    id: string,
    pointerType = 'mouse',
    buttons = 0,
    part = '.name',
  ) =>
    document.querySelector(`[data-id="${id}"] ${part}`)!.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), {
        clientX: 100,
        clientY: 100,
        pointerType,
        buttons,
      }),
    );
  move('new-id');
  move('img-id', 'touch');
  move('img-id', 'mouse', 1);
  // The rest of the row, outside the name, shows nothing.
  move('img-id', 'mouse', 0, '.cell.size');
  vi.advanceTimersByTime(1000);
  expect(images).toHaveLength(0);
  move('img-id');
  vi.advanceTimersByTime(100);
  expect(images).toHaveLength(0);
  vi.advanceTimersByTime(300);
  expect(images).toHaveLength(1);
  expect(images[0].getAttribute('src')).toBe('/api/files/img-id/download');
  expect(box.hidden).toBe(true);
  images[0].dispatchEvent(new Event('load'));
  expect(box.hidden).toBe(false);
  expect(box.firstElementChild).toBe(images[0]);
  groups.dispatchEvent(new Event('pointerleave'));
  expect(box.hidden).toBe(true);
  move('img-id');
  vi.advanceTimersByTime(400);
  expect(box.hidden).toBe(false);
  expect(images).toHaveLength(1);
  move('img-id', 'mouse', 0, '.cell.type');
  expect(box.hidden).toBe(true);
  move('img-id');
  vi.advanceTimersByTime(400);
  expect(box.hidden).toBe(false);
  groups.dispatchEvent(new Event('pointerleave'));
  click('#nav-settings');
  click('#preview-switch');
  expect(localStorage.getItem('storagi.previews')).toBe('off');
  expect(
    document.querySelector('#preview-switch')?.getAttribute('aria-checked'),
  ).toBe('false');
  click('.nav-item[data-tab="inbox"]');
  move('img-id');
  vi.advanceTimersByTime(1000);
  expect(box.hidden).toBe(true);
  expect(tip('img-id')).toBe('Photo.JPG');
  localStorage.clear();
});
test('a finger held still on a name previews it above the finger until it lifts or moves', async () => {
  vi.useFakeTimers();
  const images: HTMLImageElement[] = [];
  vi.stubGlobal(
    'Image',
    class extends Image {
      constructor() {
        super();
        images.push(this);
      }
    },
  );
  const photo = {
    id: 'img-id',
    name: 'photo.png',
    size: 4096,
    uploadedAt: '2026-10-18T12:00:00Z',
    expiresAt: '2099-11-17T00:00:00Z',
  };
  await mount(
    vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : { ...listing, files: [photo] },
          ),
        ),
    ),
  );
  const box = document.querySelector<HTMLElement>('#hover-preview')!,
    groups = document.querySelector('#groups')!;
  const touch = (type: string, x = 100, part = '.name', y = 300) =>
    document.querySelector(`[data-id="img-id"] ${part}`)!.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true }), {
        clientX: x,
        clientY: y,
        pointerType: 'touch',
        buttons: 1,
        button: 0,
      }),
    );
  // Only the name cell, as with the mouse.
  touch('pointerdown', 100, '.cell.size');
  vi.advanceTimersByTime(1000);
  expect(images).toHaveLength(0);
  touch('pointerup', 100, '.cell.size');
  vi.advanceTimersByTime(400);
  touch('pointerdown');
  vi.advanceTimersByTime(400);
  expect(images).toHaveLength(0);
  // A finger never rests perfectly still: a small wobble keeps the press.
  touch('pointermove', 104);
  vi.advanceTimersByTime(100);
  expect(images).toHaveLength(1);
  images[0].dispatchEvent(new Event('load'));
  expect(box.hidden).toBe(false);
  // Above the finger, so the hand does not cover it.
  expect(box.style.top).toBe('44px');
  touch('pointermove', 104);
  expect(box.hidden).toBe(false);
  // Lifting the finger ends the press (a touch sends pointerleave after pointerup).
  groups.dispatchEvent(new Event('pointerleave'));
  expect(box.hidden).toBe(true);
  // Moving away, to scroll or swipe, hides it too.
  touch('pointerdown');
  vi.advanceTimersByTime(500);
  expect(box.hidden).toBe(false);
  touch('pointermove', 120);
  expect(box.hidden).toBe(true);
  // A quick tap shows nothing.
  touch('pointerdown');
  vi.advanceTimersByTime(200);
  touch('pointerup');
  groups.dispatchEvent(new Event('pointerleave'));
  vi.advanceTimersByTime(100);
  expect(box.hidden).toBe(true);
  // A second touch straight after a tap selects by dragging, so holding it still shows no preview.
  touch('pointerdown');
  vi.advanceTimersByTime(1000);
  expect(box.hidden).toBe(true);
  touch('pointerup');
  groups.dispatchEvent(new Event('pointerleave'));
  vi.advanceTimersByTime(1000);
  // In a short landscape window with no room above the finger, the preview stays on screen below it.
  const height = innerHeight;
  Object.defineProperty(window, 'innerHeight', {
    value: 390,
    configurable: true,
  });
  try {
    touch('pointerdown', 100, '.name', 180);
    vi.advanceTimersByTime(500);
    expect(box.hidden).toBe(false);
    expect(box.style.top).toBe(`${390 - 8 - 240}px`);
  } finally {
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      configurable: true,
    });
  }
});
test('image previews follow the list: one load at a time, and stale or dismissed previews hide', async () => {
  vi.useFakeTimers();
  const images: HTMLImageElement[] = [];
  vi.stubGlobal(
    'Image',
    class extends Image {
      constructor() {
        super();
        images.push(this);
      }
    },
  );
  const photo = (id: string) => ({
    id,
    name: `${id}.png`,
    size: 4096,
    uploadedAt: '2026-10-18T12:00:00Z',
    expiresAt: '2099-11-17T00:00:00Z',
  });
  let files = [photo('a'), photo('b'), ...listing.files];
  await mount(
    vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : { ...listing, files },
          ),
        ),
    ),
  );
  const box = document.querySelector<HTMLElement>('#hover-preview')!,
    groups = document.querySelector('#groups')!;
  const move = (id: string) =>
    document.querySelector(`[data-id="${id}"] .name`)!.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), {
        clientX: 100,
        clientY: 100,
        pointerType: 'mouse',
        buttons: 0,
      }),
    );
  const hover = (id: string) => {
    move(id);
    vi.advanceTimersByTime(400);
  };
  // Leaving before the load finishes and coming back reuses the same load.
  hover('a');
  groups.dispatchEvent(new Event('pointerleave'));
  hover('a');
  expect(images).toHaveLength(1);
  // Moving to another image cancels the unfinished one.
  hover('b');
  expect(images).toHaveLength(2);
  expect(images[0].hasAttribute('src')).toBe(false);
  images[1].dispatchEvent(new Event('load'));
  expect(box.hidden).toBe(false);
  // Escape dismisses it, and resting on the same row does not reopen it.
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  expect(box.hidden).toBe(true);
  hover('b');
  expect(box.hidden).toBe(true);
  hover('a');
  hover('b');
  expect(box.hidden).toBe(false);
  // A horizontal wheel swipe hides it.
  groups.dispatchEvent(new Event('wheel'));
  expect(box.hidden).toBe(true);
  hover('b');
  expect(box.hidden).toBe(false);
  // A refresh that removes the hovered file hides its preview.
  files = files.filter((f) => f.id !== 'b');
  click('#refresh');
  await tick();
  expect(box.hidden).toBe(true);
  // A load that finishes after its file left the list never shows.
  hover('a');
  const late = images.at(-1)!;
  files = files.filter((f) => f.id !== 'a');
  click('#refresh');
  await tick();
  late.dispatchEvent(new Event('load'));
  expect(box.hidden).toBe(true);
  // Opening Settings hides the preview.
  files = [photo('c'), ...listing.files];
  click('#refresh');
  await tick();
  hover('c');
  images.at(-1)!.dispatchEvent(new Event('load'));
  expect(box.hidden).toBe(false);
  click('#nav-settings');
  expect(box.hidden).toBe(true);
});
test('image previews retry after a failed load, hide when rows move, cancel for a cached image, and stay dismissed after a second Escape', async () => {
  vi.useFakeTimers();
  const images: HTMLImageElement[] = [];
  vi.stubGlobal(
    'Image',
    class extends Image {
      constructor() {
        super();
        images.push(this);
      }
    },
  );
  const photo = (id: string, day = 18) => ({
    id,
    name: `${id}.png`,
    size: 4096,
    uploadedAt: `2026-10-${day}T12:00:00Z`,
    expiresAt: '2099-11-17T00:00:00Z',
  });
  let files = [photo('a'), photo('b')];
  await mount(
    vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : { ...listing, files },
          ),
        ),
    ),
  );
  const box = document.querySelector<HTMLElement>('#hover-preview')!,
    groups = document.querySelector('#groups')!;
  const hover = (id: string) => {
    document.querySelector(`[data-id="${id}"] .name`)!.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), {
        clientX: 100,
        clientY: 100,
        pointerType: 'mouse',
        buttons: 0,
      }),
    );
    vi.advanceTimersByTime(400);
  };
  // A failed load is retried once the mouse comes back to the row.
  hover('a');
  images[0].dispatchEvent(new Event('error'));
  expect(box.hidden).toBe(true);
  hover('a');
  expect(images).toHaveLength(1);
  groups.dispatchEvent(new Event('pointerleave'));
  hover('a');
  expect(images).toHaveLength(2);
  images[1].dispatchEvent(new Event('load'));
  expect(box.hidden).toBe(false);
  // Moving to a cached image cancels the unfinished load of another one.
  hover('b');
  expect(images).toHaveLength(3);
  hover('a');
  expect(box.hidden).toBe(false);
  expect(images[2].hasAttribute('src')).toBe(false);
  // A second Escape keeps the preview dismissed on the same row.
  for (let i = 0; i < 2; i++)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  hover('a');
  expect(box.hidden).toBe(true);
  hover('b');
  hover('a');
  expect(box.hidden).toBe(false);
  // A refresh that inserts a row above moves the hovered file away from the cursor.
  files = [photo('c', 20), ...files];
  click('#refresh');
  await tick();
  expect(box.hidden).toBe(true);
  // A refresh that changes nothing keeps it.
  hover('a');
  expect(box.hidden).toBe(false);
  click('#refresh');
  await tick();
  expect(box.hidden).toBe(false);
});
test('videos preview a muted loop of their first seconds, and text files their first lines, fetched as a range', async () => {
  vi.useFakeTimers();
  const videos: HTMLVideoElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      const el = create(tag, options);
      if (el instanceof HTMLVideoElement) videos.push(el);
      return el;
    },
  );
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const file = (id: string, name: string) => ({
    id,
    name,
    size: 1024 ** 3,
    uploadedAt: '2026-10-18T12:00:00Z',
    expiresAt: '2099-11-17T00:00:00Z',
  });
  const text = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`)
    .join('\n')
    .replace('line 2', '<b>line 2</b>');
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url) === '/api/files/notes-id/download'
      ? new Response(text, { status: 206 })
      : new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : {
                  ...listing,
                  files: [
                    file('clip-id', 'Clip.MP4'),
                    file('notes-id', 'notes.md'),
                    ...listing.files,
                  ],
                },
          ),
        ),
  );
  await mount(fetcher);
  const box = document.querySelector<HTMLElement>('#hover-preview')!,
    groups = document.querySelector('#groups')!;
  const hover = (id: string) => {
    document.querySelector(`[data-id="${id}"] .name`)!.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), {
        clientX: 100,
        clientY: 100,
        pointerType: 'mouse',
        buttons: 0,
      }),
    );
    vi.advanceTimersByTime(400);
  };
  hover('clip-id');
  expect(videos).toHaveLength(1);
  const video = videos[0];
  expect(video.getAttribute('src')).toBe('/api/files/clip-id/download');
  expect(video.muted).toBe(true);
  expect(box.hidden).toBe(true);
  video.dispatchEvent(new Event('loadeddata'));
  expect(box.hidden).toBe(false);
  expect(box.firstElementChild).toBe(video);
  expect(play).toHaveBeenCalled();
  // Only the first few seconds play, over and over.
  Object.defineProperty(video, 'currentTime', { value: 3.2, writable: true });
  video.dispatchEvent(new Event('timeupdate'));
  expect(video.currentTime).toBe(0);
  // Hiding stops the video and its download.
  groups.dispatchEvent(new Event('pointerleave'));
  expect(box.hidden).toBe(true);
  expect(video.hasAttribute('src')).toBe(false);
  expect(box.querySelector('video')).toBeNull();
  // Text: the first 4 KiB as a range, shown as plain text, first lines only.
  hover('notes-id');
  await tick();
  const call = fetcher.mock.calls.find(
    ([url]) => String(url) === '/api/files/notes-id/download',
  ) as unknown as [string, RequestInit];
  expect(new Headers(call[1].headers).get('Range')).toBe('bytes=0-4095');
  expect(box.hidden).toBe(false);
  const pre = box.querySelector('pre')!;
  expect(pre.querySelector('b')).toBeNull();
  expect(pre.textContent!.split('\n')).toHaveLength(16);
  expect(pre.textContent).toContain('<b>line 2</b>');
  // A text preview is kept, so coming back does not fetch it again.
  groups.dispatchEvent(new Event('pointerleave'));
  hover('notes-id');
  await tick();
  expect(box.querySelector('pre')).toBe(pre);
  expect(
    fetcher.mock.calls.filter(
      ([url]) => String(url) === '/api/files/notes-id/download',
    ),
  ).toHaveLength(1);
  vi.restoreAllMocks();
});
test('a video still loading stops when hidden, a cancelled text read cannot untrack the next load, text stays within 4 KiB, and short videos loop', async () => {
  vi.useFakeTimers();
  const videos: HTMLVideoElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      const el = create(tag, options);
      if (el instanceof HTMLVideoElement) videos.push(el);
      return el;
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const file = (id: string, name: string) => ({
    id,
    name,
    size: 1024 ** 2,
    uploadedAt: '2026-10-18T12:00:00Z',
    expiresAt: '2099-11-17T00:00:00Z',
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const fetcher = vi.fn(async (url: RequestInfo | URL) => {
    if (String(url) === '/api/files/slow-id/download') {
      await held;
      return new Response('late text', { status: 206 });
    }
    // A server that ignores the range and sends 12 000 bytes of three-byte characters.
    if (String(url) === '/api/files/wide-id/download')
      return new Response('€'.repeat(4000), { status: 200 });
    return new Response(
      JSON.stringify(
        String(url) === '/api/session'
          ? { authenticated: true, csrfToken: 'test-csrf' }
          : {
              ...listing,
              files: [
                file('clip-id', 'clip.webm'),
                file('slow-id', 'slow.txt'),
                file('wide-id', 'wide.txt'),
                ...listing.files,
              ],
            },
      ),
    );
  });
  await mount(fetcher);
  const box = document.querySelector<HTMLElement>('#hover-preview')!,
    groups = document.querySelector('#groups')!;
  const hover = (id: string) => {
    document.querySelector(`[data-id="${id}"] .name`)!.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true }), {
        clientX: 100,
        clientY: 100,
        pointerType: 'mouse',
        buttons: 0,
      }),
    );
    vi.advanceTimersByTime(400);
  };
  // Leaving a video before it loads stops its download.
  hover('clip-id');
  expect(videos[0].loop).toBe(true);
  groups.dispatchEvent(new Event('pointerleave'));
  expect(videos[0].hasAttribute('src')).toBe(false);
  // A text read finishing after it was cancelled does not untrack the video that replaced it.
  hover('slow-id');
  hover('clip-id');
  release();
  await tick();
  expect(box.hidden).toBe(true);
  groups.dispatchEvent(new Event('pointerleave'));
  expect(videos[1].hasAttribute('src')).toBe(false);
  // 6 s after a video starts loading, it freezes on its current frame and its download stops.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  hover('clip-id');
  const capped = videos[2];
  capped.dispatchEvent(new Event('loadeddata'));
  expect(box.firstElementChild).toBe(capped);
  vi.advanceTimersByTime(5000);
  expect(capped.hasAttribute('src')).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(capped.hasAttribute('src')).toBe(false);
  expect(box.hidden).toBe(false);
  expect(box.firstElementChild?.tagName).toBe('CANVAS');
  groups.dispatchEvent(new Event('pointerleave'));
  // One still loading at 6 s is dropped without a preview.
  hover('clip-id');
  vi.advanceTimersByTime(6000);
  expect(videos[3].hasAttribute('src')).toBe(false);
  videos[3].dispatchEvent(new Event('loadeddata'));
  expect(box.hidden).toBe(true);
  groups.dispatchEvent(new Event('pointerleave'));
  // A video that fails while loading cannot cancel the cap of the next one.
  hover('clip-id');
  vi.advanceTimersByTime(1000);
  videos[4].dispatchEvent(new Event('error'));
  groups.dispatchEvent(new Event('pointerleave'));
  hover('clip-id');
  videos[5].dispatchEvent(new Event('loadeddata'));
  vi.advanceTimersByTime(6000);
  expect(videos[5].hasAttribute('src')).toBe(false);
  groups.dispatchEvent(new Event('pointerleave'));
  // At most 4 KiB is read and decoded, counted in bytes.
  hover('wide-id');
  await tick();
  const shown = new TextEncoder().encode(
    box.querySelector('pre')!.textContent!,
  );
  expect(shown.length).toBeLessThanOrEqual(4096);
  expect(shown.length).toBeGreaterThan(4000);
  vi.restoreAllMocks();
});
