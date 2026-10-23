import { afterEach, expect, test, vi } from 'vitest';
import { createDashboard } from '../src/dashboard';
const listing = { files: [
  { id: 'old-id', name: 'archive.zip', size: 1024, uploadedAt: '2026-10-01T12:00:00Z', expiresAt: '2099-10-31T00:00:00Z' },
  { id: 'new-id', name: 'archive.zip', size: 2048, uploadedAt: '2026-10-18T12:00:00Z', expiresAt: '2099-11-17T00:00:00Z' },
], usedBytes: 3072, reservedBytes: 512, budgetBytes: 200 * 1024 ** 3 };
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
let dispose = () => {};
afterEach(() => { dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function service() {
  let status = 200;
  const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url) === '/api/session' ? { authenticated: true, csrfToken: 'test-csrf' } : listing), { status: String(url) === '/api/files' ? status : 200 }));
  return { fetcher, fail: (value: number) => { status = value; } };
}
async function mount(fetcher = service().fetcher) { document.body.innerHTML = '<main id="app"></main>'; dispose = await createDashboard(document.querySelector('#app')!, { fetch: fetcher }); }
const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
const rows = () => [...document.querySelectorAll<HTMLElement>('#groups .row')];

test('locked pond contains a static decoy and never renders private shelf data', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 })); await mount(fetcher);
  expect(document.querySelector('#locked-decoy, .locked-decoy')).not.toBeNull();
  expect(document.querySelector('a[href="/auth/login"]')?.textContent).toContain('Google');
  expect(document.querySelector('#groups')).toBeNull(); expect(document.body.textContent).not.toContain('archive.zip');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('shelf groups local days, labels duplicates, searches safely and retains sorting after refresh', async () => {
  const api = service(); await mount(api.fetcher);
  expect(rows().map(row => row.dataset.id)).toEqual(['new-id', 'old-id']);
  expect(document.querySelectorAll('.group h3')).toHaveLength(2);
  expect(rows()[0].querySelector('.copy')?.textContent).toBe('copy new-id');
  click('[data-sort="size"]'); expect(rows().map(row => row.dataset.id)).toEqual(['old-id', 'new-id']);
  expect(document.querySelectorAll('.group h3')).toHaveLength(0);
  click('#refresh'); await tick(); expect(rows().map(row => row.dataset.id)).toEqual(['old-id', 'new-id']);
  click('#sort-clear'); expect(rows()[0].dataset.id).toBe('new-id');
  const search = document.querySelector<HTMLInputElement>('#search')!; search.value = 'no match'; search.dispatchEvent(new Event('input'));
  expect(rows()).toHaveLength(0); expect(document.querySelector('#no-match')?.textContent).toContain('No filenames match');
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(rows()).toHaveLength(2);
});

test('inline deletion waits six seconds and sends CSRF; Undo never sends DELETE', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  click('[data-del="new-id"]'); expect(document.querySelector('[data-confirm="new-id"]')).not.toBeNull();
  expect(api.fetcher).toHaveBeenCalledTimes(2); click('[data-confirm="new-id"]');
  await vi.advanceTimersByTimeAsync(5999); expect(api.fetcher.mock.calls.filter(c => String(c[0]).includes('/new-id'))).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(api.fetcher).toHaveBeenCalledWith('/api/files/new-id', expect.objectContaining({ method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': 'test-csrf' } }));
  click('[data-del="old-id"]'); click('[data-confirm="old-id"]'); click('[data-undo="old-id"]');
  await vi.advanceTimersByTimeAsync(6500); expect(api.fetcher.mock.calls.filter(c => String(c[0]).includes('/old-id'))).toHaveLength(0);
});

test('select-all is tri-state and bulk Undo restores rows without deleting anything', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  click('[data-id="new-id"] .lead'); expect(document.querySelector<HTMLInputElement>('#select-all')!.indeterminate).toBe(true);
  click('#select-all'); expect(document.querySelector<HTMLInputElement>('#select-all')!.checked).toBe(true);
  expect(document.querySelector('#sel-count')?.textContent).toBe('2'); click('#sel-delete'); expect(rows()).toHaveLength(0);
  click('#notice button'); expect(rows()).toHaveLength(2); await vi.advanceTimersByTimeAsync(6500);
  expect(api.fetcher).toHaveBeenCalledTimes(2);
});

test('failed listing keeps the list visible, pins offline status, and recovers on retry', async () => {
  const api = service(); await mount(api.fetcher); api.fail(503); click('#refresh'); await tick();
  expect(document.querySelector<HTMLElement>('#offline')!.hidden).toBe(false); expect(document.title).toBe('Offline · Storagi');
  expect(rows()).toHaveLength(2); expect(document.querySelector('#fresh')?.classList.contains('off')).toBe(true);
  api.fail(200); click('#retry'); await tick(); expect(document.querySelector<HTMLElement>('#offline')!.hidden).toBe(true); expect(document.title).toBe('Storagi');
});

test('401 on refresh clears private content and explains session recovery', async () => {
  const api = service(); await mount(api.fetcher); api.fail(401); click('#refresh'); await tick();
  expect(document.querySelector('#groups')).toBeNull(); expect(document.body.textContent).not.toContain('archive.zip');
  expect(document.querySelector('.session-expired')?.textContent).toContain('choose interrupted files again');
});

test('reserved bytes count toward the full-shelf notice and meter', async () => {
  const budget = listing.budgetBytes; listing.budgetBytes = listing.usedBytes + listing.reservedBytes;
  try { await mount(); expect(document.querySelector<HTMLElement>('#full-shelf')!.hidden).toBe(false); expect(document.querySelector('#meter')?.getAttribute('aria-label')).toContain('including reserved uploads'); }
  finally { listing.budgetBytes = budget; }
});

test('sign-out popup asks before posting logout with CSRF', async () => {
  const api = service(); await mount(api.fetcher); click('#sign-out'); expect(document.querySelector<HTMLElement>('#signout-pop')!.hidden).toBe(false);
  expect(api.fetcher).toHaveBeenCalledTimes(2); click('#signout-confirm'); await tick();
  expect(api.fetcher).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST', headers: { 'X-CSRF-Token': 'test-csrf' } }));
  expect(document.querySelector('#groups')).toBeNull(); expect(document.querySelector<HTMLElement>('.session-expired')!.hidden).toBe(true);
});

test('single download calls the save picker synchronously and streams the response to disk', async () => {
  const write = vi.fn().mockResolvedValue(undefined), close = vi.fn().mockResolvedValue(undefined), abort = vi.fn().mockResolvedValue(undefined);
  const picker = vi.fn().mockResolvedValue({ createWritable: async () => ({ write, close, abort }) });
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });
  const api = service(); const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => String(url).endsWith('/download') ? new Response('fixture', { headers: { 'Content-Length': '7' } }) : api.fetcher(url));
  await mount(fetcher as typeof api.fetcher); const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  document.querySelector('[data-dl="new-id"]')!.dispatchEvent(event);
  expect(picker).toHaveBeenCalledWith({ suggestedName: 'archive.zip' }); expect(event.defaultPrevented).toBe(true);
  await tick(); expect(write).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(document.querySelector('.tr.done')?.textContent).toContain('Saved to this device');
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

test('download without a picker remains a plain browser link', async () => {
  await mount(); const a = document.querySelector<HTMLAnchorElement>('[data-dl="new-id"]')!;
  expect(a.getAttribute('href')).toBe('/api/files/new-id/download'); expect(a.hasAttribute('download')).toBe(true);
  // Suppress jsdom navigation after observing the app's handler; it must leave the default action intact.
  let prevented = true; const handler = (e: MouseEvent) => { prevented = e.defaultPrevented; e.preventDefault(); };
  document.addEventListener('click', handler, { once: true }); a.click(); expect(prevented).toBe(false);
  expect(document.querySelector('.toast')?.textContent).toContain('Downloading in your browser');
});

test('hostile filenames stay text and expired copies have no download', async () => {
  const original = { ...listing.files[0] }; listing.files[0].name = '<img src=x onerror=alert(1)>.zip'; listing.files[0].expiresAt = '2000-01-01';
  try { await mount(); const row = document.querySelector('[data-id="old-id"]')!; expect(row.querySelector('strong')?.textContent).toBe(listing.files[0].name); expect(row.querySelector('img')).toBeNull(); expect(row.querySelector('[data-dl]')).toBeNull(); expect(row.textContent).toContain('Expired'); }
  finally { listing.files[0] = original; }
});

test('initial connection failure offers a loading-screen retry', async () => {
  await mount(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  expect(document.querySelector('#loading')?.textContent).toContain('The host may be offline'); expect(document.querySelector('#retry-connection')?.textContent).toBe('Try again');
});

test('direct checkbox clicks stay checked and shift selection selects a range', async () => {
  await mount(); click('[data-id="new-id"] .check'); await tick();
  expect(document.querySelector<HTMLInputElement>('[data-id="new-id"] .check')!.checked).toBe(true);
  document.querySelector('[data-id="old-id"] .lead')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
  expect(document.querySelector('#sel-count')?.textContent).toBe('2');
});

test('bulk deletion commits each copy after the grace period', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher); click('#select-all'); click('#sel-delete');
  await vi.advanceTimersByTimeAsync(5999); expect(api.fetcher).toHaveBeenCalledTimes(2); await vi.advanceTimersByTimeAsync(1);
  for (const id of ['new-id', 'old-id']) expect(api.fetcher).toHaveBeenCalledWith(`/api/files/${id}`, expect.objectContaining({ method: 'DELETE', headers: { 'X-CSRF-Token': 'test-csrf' } }));
});

test('network failure retries automatically in ten seconds and expiry cancels pending deletion', async () => {
  vi.useFakeTimers(); const api = service(); let offline = false;
  const fetcher = vi.fn((url: RequestInfo | URL) => offline ? Promise.reject(new TypeError('Failed to fetch')) : api.fetcher(url)); await mount(fetcher);
  offline = true; click('#refresh'); await tick(); expect(document.title).toBe('Offline · Storagi');
  offline = false; await vi.advanceTimersByTimeAsync(10_000); expect(document.title).toBe('Storagi');
  click('[data-del="new-id"]'); click('[data-confirm="new-id"]'); api.fail(401); click('#refresh'); await tick();
  await vi.advanceTimersByTimeAsync(6000); expect(fetcher.mock.calls.filter(c => String(c[0]).endsWith('/new-id'))).toHaveLength(0);
});

test('streamed download has Cancel only and aborts the request and writable', async () => {
  const abort = vi.fn().mockResolvedValue(undefined), write = vi.fn().mockResolvedValue(undefined);
  const picker = vi.fn().mockResolvedValue({ createWritable: async () => ({ write, abort, close: vi.fn() }) });
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });
  let signal: AbortSignal | null | undefined;
  const api = service(); const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url).endsWith('/download')) { signal = options?.signal; return new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); } }), { headers: { 'Content-Length': '100' } }); }
    return api.fetcher(url);
  });
  await mount(fetcher as typeof api.fetcher); click('[data-dl="new-id"]'); await tick();
  expect(document.querySelectorAll('.tr [data-action]')).toHaveLength(1); click('.tr [data-action="cancel"]'); await tick();
  expect(signal?.aborted).toBe(true); expect(abort).toHaveBeenCalled(); expect(document.querySelector('.tr.cancelled')).not.toBeNull();
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

test('the download path follows the picker API, not the window width', async () => {
  const picker = vi.fn(() => new Promise(() => {})); Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker }); vi.stubGlobal('innerWidth', 390);
  await mount(); click('[data-dl="new-id"]');
  expect(picker).toHaveBeenCalledOnce(); delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

test('settings persist switches, phone menu opens, and tabs and shortcuts change views', async () => {
  await mount(); click('#nav-settings'); expect(document.querySelector<HTMLElement>('#settings')!.hidden).toBe(false);
  click('#koi-switch'); expect(localStorage.getItem('storagi.motion')).toBe('static'); click('#gesture-switch'); expect(localStorage.getItem('storagi.gestures')).toBe('off');
  click('.nav-item[data-tab="inbox"]'); click('#menu-btn'); expect(document.querySelector<HTMLElement>('#sheet')!.hidden).toBe(false); click('#sheet-close');
  vi.stubGlobal('innerWidth', 390); click('.tabs [data-tab="transfers"]'); expect(document.querySelector('#shelf-app')?.getAttribute('data-tab')).toBe('transfers');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })); expect(document.activeElement?.id).toBe('search');
  localStorage.clear();
});
test('copy follows the prototype: singular bulk toast, sort labels, sign-out note, and the page survives pagehide', async () => {
  vi.useFakeTimers(); await mount();
  click('[data-id="new-id"] .lead'); click('#sel-delete');
  expect(document.querySelector('.toast span')?.textContent).toBe('1 copy deleted'); click('#notice button');
  click('[data-sort="name"]'); expect(document.querySelector('[data-sort="name"]')!.getAttribute('aria-label')).toBe('Name, sorted A to Z');
  expect(document.querySelector('[data-sort="size"]')!.getAttribute('aria-label')).toBe('Sort by size');
  click('#sign-out'); expect(document.querySelector('#signout-note')?.textContent).toBe('Your files stay on the shelf.');
  window.dispatchEvent(new Event('pagehide')); click('#signout-cancel');
  expect(document.querySelector('#signout-pop')!.hasAttribute('hidden')).toBe(true);
});
test('a dashboard opened in a background tab still loads its list', async () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  try { const api = service(); await mount(api.fetcher); expect(api.fetcher).toHaveBeenCalledWith('/api/files', expect.anything()); expect(rows()).toHaveLength(2); }
  finally { delete (document as { visibilityState?: unknown }).visibilityState; }
});
test('leaving the page restores pending deletes instead of sending them on wake', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  click('[data-del="new-id"]'); click('[data-confirm="new-id"]'); window.dispatchEvent(new Event('pagehide'));
  await vi.advanceTimersByTimeAsync(10_000); expect(api.fetcher.mock.calls.filter(c => String(c[0]).includes('/new-id'))).toHaveLength(0);
  expect(document.querySelector('[data-del="new-id"]')).not.toBeNull();
});
test('an Undo toast is not pushed away by a later notice; the notice waits', async () => {
  vi.useFakeTimers(); await mount(); click('#select-all'); click('#sel-delete');
  click('#choose'); const picker = document.querySelector<HTMLInputElement>('#picker')!;
  Object.defineProperty(picker, 'files', { configurable: true, value: [new File(['x'], 'late.zip')] }); picker.dispatchEvent(new Event('change'));
  expect(document.querySelector('#notice span')?.textContent).toBe('2 copies deleted');
  click('#notice button'); expect(rows()).toHaveLength(2); expect(document.querySelector('#notice span')?.textContent).toBe('1 file queued');
});
test('expired copies get the friendly message, and duplicate rows name their copy for screen readers', async () => {
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: vi.fn().mockResolvedValue({ createWritable: async () => ({ write: vi.fn(), close: vi.fn(), abort: vi.fn().mockResolvedValue(undefined) }) }) });
  const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).endsWith('/download') ? new Response(JSON.stringify({ error: 'Not found' }), { status: 410 }) : api.fetcher(url));
  await mount(fetcher as typeof api.fetcher);
  const labels = [...document.querySelectorAll('[data-del]')].map(b => b.getAttribute('aria-label'));
  expect(labels).toEqual(['Delete archive.zip · copy new-id', 'Delete archive.zip · copy old-id']);
  click('[data-dl="new-id"]'); await tick();
  expect(document.querySelector('.tr.error .tr-error')?.textContent).toBe('This copy has expired or was removed. Refresh your Inbox.');
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
});
test('a failed disk write aborts the download request', async () => {
  const abort = vi.fn().mockResolvedValue(undefined), write = vi.fn().mockRejectedValue(new Error('Disk full'));
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: vi.fn().mockResolvedValue({ createWritable: async () => ({ write, close: vi.fn(), abort }) }) });
  let signal: AbortSignal | undefined; const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => { if (String(url).endsWith('/download')) { signal = options?.signal ?? undefined; return new Response('fixture'); } return api.fetcher(url); });
  await mount(fetcher as typeof api.fetcher); click('[data-dl="new-id"]'); await tick();
  expect(signal?.aborted).toBe(true); expect(abort).toHaveBeenCalled(); expect(document.querySelector('.tr.error')).not.toBeNull();
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
});
test('a touchpad sideways swipe deletes through the same six-second Undo', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  const row = document.querySelector('[data-id="new-id"]')!; row.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40 }));
  await vi.advanceTimersByTimeAsync(400); expect(document.querySelector('[data-undo="new-id"]')).not.toBeNull();
  click('[data-undo="new-id"]'); await vi.advanceTimersByTimeAsync(7000);
  expect(api.fetcher.mock.calls.filter(c => String(c[0]).includes('/new-id'))).toHaveLength(0);
});
test('a second bulk delete inside the grace keeps Undo for both batches', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  click('[data-id="new-id"] .lead'); click('#sel-delete'); click('[data-id="old-id"] .lead'); click('#sel-delete');
  expect(document.querySelector('#notice span')?.textContent).toBe('2 copies deleted');
  click('#notice button'); expect(rows()).toHaveLength(2); await vi.advanceTimersByTimeAsync(7000);
  expect(api.fetcher.mock.calls.filter(c => ((c as unknown[])[1] as RequestInit | undefined)?.method === 'DELETE')).toHaveLength(0);
});
test('a bulk delete treats an already-removed copy as deleted and still deletes the rest', async () => {
  vi.useFakeTimers(); const api = service(); const deleted: string[] = [];
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method !== 'DELETE') return api.fetcher(url);
    deleted.push(String(url)); return String(url).endsWith('/new-id') ? new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }) : new Response(null, { status: 204 });
  });
  await mount(fetcher as typeof api.fetcher); click('#select-all'); click('#sel-delete'); await vi.advanceTimersByTimeAsync(6500);
  expect(deleted).toEqual(['/api/files/new-id', '/api/files/old-id']); expect(document.querySelector('#notice')).toBeNull();
});
test('notices raised during an Undo show afterwards, in order, each message once', async () => {
  vi.useFakeTimers(); await mount(); click('#select-all'); click('#sel-delete');
  const picker = document.querySelector<HTMLInputElement>('#picker')!;
  for (const name of ['a.zip', 'b.zip']) { Object.defineProperty(picker, 'files', { configurable: true, value: [new File(['x'], name)] }); picker.dispatchEvent(new Event('change')); }
  Object.defineProperty(picker, 'files', { configurable: true, value: [new File(['x'], 'a.zip')] }); picker.dispatchEvent(new Event('change'));
  click('#notice button'); expect(document.querySelector('#notice span')?.textContent).toBe('1 file queued');
  await vi.advanceTimersByTimeAsync(4000); expect(document.querySelector('#notice span')?.textContent).toBe('a.zip is already in your transfer queue.');
});
test('a first load that fails does not claim an earlier good update', async () => {
  vi.useFakeTimers(); const api = service(); api.fail(503); await mount(api.fetcher);
  expect(document.querySelector('#last-good')?.textContent).toBe('—'); expect(document.querySelector('#fresh-text')?.textContent).toBe('Offline · last good —');
});
const deletes = (fetcher: { mock: { calls: unknown[][] } }) => fetcher.mock.calls.filter(c => (c[1] as RequestInit | undefined)?.method === 'DELETE').map(c => String(c[0]));
test('a row already deleted inline is left out of a bulk delete, so either Undo really keeps it', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  click('[data-del="new-id"]'); click('[data-confirm="new-id"]'); click('#select-all'); click('#sel-delete');
  expect(document.querySelector('#notice span')?.textContent).toBe('1 copy deleted');
  click('#notice button'); click('[data-undo="new-id"]'); await vi.advanceTimersByTimeAsync(7000);
  expect(deletes(api.fetcher)).toEqual([]);
});
test('a later bulk delete folds earlier pending batches into one fresh six-second Undo', async () => {
  vi.useFakeTimers(); const api = service(); await mount(api.fetcher);
  click('[data-id="new-id"] .lead'); click('#sel-delete'); await vi.advanceTimersByTimeAsync(3000);
  click('[data-id="old-id"] .lead'); click('#sel-delete'); await vi.advanceTimersByTimeAsync(4000);
  expect(deletes(api.fetcher)).toEqual([]); expect(document.querySelector('#notice span')?.textContent).toBe('2 copies deleted');
  click('#notice button'); await vi.advanceTimersByTimeAsync(7000); expect(deletes(api.fetcher)).toEqual([]); expect(rows()).toHaveLength(2);
});
test('a non-offline first-load failure does not print a 1970 "Updated" time', async () => {
  const api = service(); api.fail(429); await mount(api.fetcher);
  expect(document.querySelector('#fresh-text')?.textContent).toContain('Updated —');
});
test('delete failures: a single 404 counts as deleted; a 500 on one copy still deletes the rest and reports once', async () => {
  vi.useFakeTimers(); const api = service();
  let failNew = 404;
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => options?.method !== 'DELETE' ? api.fetcher(url)
    : String(url).endsWith('/new-id') ? new Response(JSON.stringify({ error: 'boom' }), { status: failNew }) : new Response(null, { status: 204 }));
  await mount(fetcher as typeof api.fetcher);
  click('[data-del="new-id"]'); click('[data-confirm="new-id"]'); await vi.advanceTimersByTimeAsync(6500);
  expect(document.querySelector('#notice')).toBeNull();
  failNew = 500; click('#select-all'); click('#sel-delete'); await vi.advanceTimersByTimeAsync(6500);
  expect(deletes(fetcher)).toEqual(['/api/files/new-id', '/api/files/new-id', '/api/files/old-id']);
  expect(document.querySelector('#notice span')?.textContent).toBe('boom');
});
test('a bulk batch whose DELETEs have started is not folded into a later Undo', async () => {
  vi.useFakeTimers(); const api = service(); let release!: () => void;
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => options?.method !== 'DELETE' ? api.fetcher(url)
    : String(url).endsWith('/new-id') ? new Promise<Response>(r => { release = () => r(new Response(null, { status: 204 })); }) : new Response(null, { status: 204 }));
  await mount(fetcher as typeof api.fetcher);
  click('[data-id="new-id"] .lead'); click('#sel-delete'); await vi.advanceTimersByTimeAsync(6500);
  click('[data-id="old-id"] .lead'); click('#sel-delete');
  expect(document.querySelector('#notice span')?.textContent).toBe('1 copy deleted');
  click('#notice button'); release(); await vi.advanceTimersByTimeAsync(7000);
  expect(deletes(fetcher)).toEqual(['/api/files/new-id']);
});
test('a replaced Undo toast cannot be pressed while it fades out', async () => {
  vi.useFakeTimers(); await mount();
  click('[data-id="new-id"] .lead'); click('#sel-delete'); click('[data-id="old-id"] .lead'); click('#sel-delete');
  const [old] = [...document.querySelectorAll<HTMLElement>('.toast')]; expect(old.id).toBe('');
  expect(old.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
});
test('rows counting down inline cannot be selected', async () => {
  vi.useFakeTimers(); await mount();
  click('[data-del="new-id"]'); click('[data-confirm="new-id"]'); click('#select-all');
  expect(document.querySelector('#sel-count')?.textContent).toBe('1');
  click('#sel-clear'); click('[data-id="new-id"] .lead'); expect(document.querySelector('#select-bar')!.classList.contains('out')).toBe(true);
});
test('a list body that fails after the headers puts the page offline', async () => {
  const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url) === '/api/files' ? new Response('<html>portal</html>') : api.fetcher(url));
  await mount(fetcher as typeof api.fetcher);
  expect(document.title).toBe('Offline · Storagi'); expect(document.querySelector<HTMLElement>('#offline')!.hidden).toBe(false);
});
test('a download stream that drops puts the page offline', async () => {
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: vi.fn().mockResolvedValue({ createWritable: async () => ({ write: vi.fn(), close: vi.fn(), abort: vi.fn().mockResolvedValue(undefined) }) }) });
  const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).endsWith('/download') ? new Response(new ReadableStream({ start(c) { c.error(new TypeError('network error')); } })) : api.fetcher(url));
  await mount(fetcher as typeof api.fetcher); click('[data-dl="new-id"]'); await tick();
  expect(document.title).toBe('Offline · Storagi'); expect(document.querySelector('.tr.error')).not.toBeNull();
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
});
test('a second swipe during the first swipe\'s exit animation cannot schedule a second delete', async () => {
  vi.useFakeTimers();
  const animate = vi.fn(() => ({ finished: new Promise(r => setTimeout(r, 200)) }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  try {
    const api = service(); await mount(api.fetcher);
    const swipe = () => document.querySelector('[data-id="new-id"]')!.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40 }));
    swipe(); await vi.advanceTimersByTimeAsync(250); swipe(); await vi.advanceTimersByTimeAsync(600);
    click('[data-undo="new-id"]'); await vi.advanceTimersByTimeAsync(7000);
    expect(deletes(api.fetcher)).toEqual([]);
  } finally { delete (HTMLElement.prototype as { animate?: unknown }).animate; }
});
test('once the grace ends the row says Deleting and offers no dead Undo', async () => {
  vi.useFakeTimers(); const api = service();
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => options?.method === 'DELETE' ? new Promise<Response>(() => {}) : api.fetcher(url));
  await mount(fetcher as typeof api.fetcher); click('[data-del="new-id"]'); click('[data-confirm="new-id"]');
  await vi.advanceTimersByTimeAsync(6300);
  expect(document.querySelector('[data-undo="new-id"]')).toBeNull(); expect(document.querySelector('[data-id="new-id"] .m-quiet')?.textContent).toBe('Deleting');
});
const slowAnimations = () => Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: vi.fn(() => ({ finished: new Promise(r => setTimeout(r, 200)) })) });
const swipeRow = (id: string) => document.querySelector(`[data-id="${id}"]`)!.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40 }));
test('a released swipe owns its row: a bulk delete during the animation leaves it out, and bulk Undo cannot leave a hidden delete behind', async () => {
  vi.useFakeTimers(); slowAnimations();
  try {
    const api = service(); await mount(api.fetcher);
    click('[data-id="new-id"] .lead'); click('[data-id="old-id"] .lead'); swipeRow('new-id');
    await vi.advanceTimersByTimeAsync(150); click('#sel-delete');
    expect(document.querySelector('#notice span')?.textContent).toBe('1 copy deleted');
    await vi.advanceTimersByTimeAsync(20); click('#notice button'); await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelector('[data-undo="new-id"]')).not.toBeNull();
    click('[data-undo="new-id"]'); await vi.advanceTimersByTimeAsync(7000);
    expect(deletes(api.fetcher)).toEqual([]);
  } finally { delete (HTMLElement.prototype as { animate?: unknown }).animate; }
});
test('the list re-renders when a swipe settles, so selection never includes the swiped row', async () => {
  vi.useFakeTimers(); slowAnimations();
  try {
    await mount(); click('[data-id="new-id"] .lead'); swipeRow('new-id');
    await vi.advanceTimersByTimeAsync(150); click('#sel-delete'); await vi.advanceTimersByTimeAsync(300);
    click('#select-all'); expect(document.querySelector('#sel-count')?.textContent).toBe('1');
    expect(document.querySelector('[data-id="new-id"]')!.classList.contains('ghost')).toBe(true);
  } finally { delete (HTMLElement.prototype as { animate?: unknown }).animate; }
});
