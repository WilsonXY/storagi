import { afterEach, expect, test, vi } from 'vitest';
import { createDashboard } from '../src/dashboard';

const listing = {
  files: [
    { id: 'old-id', name: 'archive.zip', size: 1024, uploadedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-31T00:00:00Z' },
    { id: 'new-id', name: 'archive.zip', size: 2048, uploadedAt: '2026-10-18T00:00:00Z', expiresAt: '2026-11-17T00:00:00Z' },
  ], usedBytes: 3072, reservedBytes: 512, budgetBytes: 200 * 1024 ** 3,
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => { document.body.innerHTML = ''; });

test('protects the Inbox behind a session and offers Google login', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
  document.body.innerHTML = '<main id="app"></main>';
  await createDashboard(document.querySelector('#app')!, { fetch: fetcher });
  expect(document.querySelector('a[href="/auth/login"]')?.textContent ?? '').toContain('Google');
  expect(document.body.textContent).not.toContain('archive.zip');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

function authenticatedFetch() {
  return vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(
    String(url) === '/api/session' ? { authenticated: true, csrfToken: 'test-csrf' } : listing,
  ), { headers: { 'Content-Type': 'application/json' } }));
}

test('renders newest first, distinguishes duplicates and searches filenames', async () => {
  const fetcher = authenticatedFetch();
  document.body.innerHTML = '<main id="app"></main>';
  await createDashboard(document.querySelector('#app')!, { fetch: fetcher });
  const rows = () => [...document.querySelectorAll('[data-file-id]')];
  expect(rows().map(row => row.getAttribute('data-file-id'))).toEqual(['new-id', 'old-id']);
  expect(rows()[0].textContent).toContain('new-id');
  expect(document.body.textContent).toContain('30 days');
  const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
  search.value = 'no match';
  search.dispatchEvent(new Event('input'));
  expect(rows()).toHaveLength(0);
  expect(document.body.textContent).toContain('No matching files');
  search.value = '';
  search.dispatchEvent(new Event('input'));
  expect(rows()).toHaveLength(2);
  expect(document.querySelector('img')).toBeNull();
});

test('requires confirmation before deleting a copy and sends the session CSRF token', async () => {
  const fetcher = authenticatedFetch();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  document.body.innerHTML = '<main id="app"></main>';
  await createDashboard(document.querySelector('#app')!, { fetch: fetcher });
  document.querySelector<HTMLButtonElement>('[data-delete="new-id"]')!.click();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(true);
  document.querySelector<HTMLButtonElement>('#confirm-delete')!.click();
  await tick();
  expect(fetcher).toHaveBeenCalledWith('/api/files/new-id', expect.objectContaining({ method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': 'test-csrf' } }));
});

test('renders a hostile filename as text and keeps download and delete labels safe', async () => {
  const original = listing.files[0].name;
  listing.files[0].name = '<img src=x onerror=alert(1)>.zip';
  try {
    document.body.innerHTML = '<main id="app"></main>';
    await createDashboard(document.querySelector('#app')!, { fetch: authenticatedFetch() });
    expect(document.querySelector('[data-file-id="old-id"] strong')?.textContent).toBe(listing.files[0].name);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[data-delete="old-id"]')?.getAttribute('aria-label')).toContain(listing.files[0].name);
  } finally { listing.files[0].name = original; }
});

test('offers a useful retry when the host cannot be reached', async () => {
  document.body.innerHTML = '<main id="app"></main>';
  const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  await createDashboard(document.querySelector('#app')!, { fetch: fetcher });
  expect(document.body.textContent).toContain('The host may be offline');
  expect(document.querySelector<HTMLButtonElement>('#retry-connection')?.textContent).toBe('Try again');
});
