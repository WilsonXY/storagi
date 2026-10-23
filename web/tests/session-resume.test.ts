import { afterEach, expect, test, vi } from 'vitest';
import { Upload, defaultOptions, type HttpStack, type HttpResponse } from 'tus-js-client';
import { createDashboard } from '../src/dashboard';

// Run the installed browser Upload, file reader, fingerprint and WebStorage code.
// Only the HTTP transport is synthetic; no replacement resume/error logic.
vi.mock('tus-js-client', () => vi.importActual<typeof import('tus-js-client')>('tus-js-client/lib.esm/browser/index.js'));

const originalStack = defaultOptions.httpStack;
afterEach(() => { defaultOptions.httpStack = originalStack; localStorage.clear(); document.body.replaceChildren(); });

function service(logout: number | 'network' = 204) {
  let authenticated = true;
  let csrf = 'first-session';
  let headFailure = 0;
  let creations = 0;
  let holdPatch = false;
  let releasePatch = () => {};
  const aborts: { method: string; url: string }[] = [];
  const partials = new Map<string, { size: number; offset: number }>();
  const requests: { method: string; url: string; offset?: string; csrf?: string }[] = [];
  const reply = (status: number, headers: Record<string, string> = {}): HttpResponse => ({
    getStatus: () => status, getHeader: name => headers[name.toLowerCase()], getBody: () => '', getUnderlyingObject: () => ({}),
  });
  const stack: HttpStack = {
    getName: () => 'synthetic-tus-service',
    createRequest(method, url) {
      const headers: Record<string, string> = {};
      let aborted = false;
      return {
        getMethod: () => method, getURL: () => url,
        setHeader: (name, value) => { headers[name.toLowerCase()] = value; }, getHeader: name => headers[name.toLowerCase()],
        setProgressHandler() {}, getUnderlyingObject: () => ({}),
        async abort() { aborted = true; aborts.push({ method, url }); releasePatch(); },
        async send(body?: Blob) {
          requests.push({ method, url, offset: headers['upload-offset'], csrf: headers['x-csrf-token'] });
          if (method === 'PATCH' && holdPatch) {
            holdPatch = false;
            await new Promise<void>(resolve => { releasePatch = resolve; });
            if (aborted) throw new Error('Request aborted');
          }
          if (method === 'HEAD' && headFailure) {
            const status = headFailure; headFailure = 0;
            if (status === 401 || status === 403) authenticated = false;
            else partials.delete(url);
            return reply(status);
          }
          if (!authenticated) return reply(401);
          if (method !== 'HEAD' && headers['x-csrf-token'] !== csrf) return reply(403);
          if (method === 'POST') {
            const location = `${window.location.origin}/api/uploads/partial-${++creations}`;
            partials.set(location, { size: Number(headers['upload-length']), offset: 0 });
            return reply(201, { location });
          }
          const partial = partials.get(url);
          if (!partial) return reply(404);
          if (method === 'HEAD') return reply(200, { 'upload-offset': String(partial.offset), 'upload-length': String(partial.size) });
          if (method === 'PATCH') {
            if (Number(headers['upload-offset']) !== partial.offset) return reply(409);
            partial.offset += body!.size;
            if (partial.offset === partial.size) partials.delete(url);
            return reply(204, { 'upload-offset': String(partial.offset) });
          }
          return reply(405);
        },
      };
    },
  };
  defaultOptions.httpStack = stack;
  const fetcher = async (url: RequestInfo | URL) => {
    if (String(url) === '/auth/logout') {
      if (logout === 'network') throw new TypeError('Failed to fetch');
      if ([204, 401, 403].includes(logout)) authenticated = false;
      return new Response(logout === 204 ? null : JSON.stringify({ error: 'Logout failed' }), { status: logout });
    }
    return new Response(JSON.stringify(String(url) === '/api/session'
      ? { authenticated: true, csrfToken: csrf }
      : { files: [], usedBytes: 0, reservedBytes: [...partials.values()].reduce((sum, part) => sum + part.size, 0), budgetBytes: 1000 }), { status: authenticated ? 200 : 401 });
  };
  return {
    stack, requests, partials, aborts,
    get creations() { return creations; },
    failHead(status: number) { headFailure = status; },
    holdNextPatch() { holdPatch = true; },
    releasePatch() { releasePatch(); },
    signIn() { authenticated = true; csrf = 'fresh-session'; },
    async mount() { document.body.innerHTML = '<main id="app"></main>'; await createDashboard(document.querySelector('#app')!, { fetch: fetcher }); },
  };
}

function select(...files: File[]) {
  const picker = document.querySelector<HTMLInputElement>('#picker')!;
  Object.defineProperty(picker, 'files', { configurable: true, value: files });
  picker.dispatchEvent(new Event('change'));
}

async function interrupted(api: ReturnType<typeof service>, file: File) {
  const upload = new Upload(file, {
    endpoint: '/api/uploads', chunkSize: 4, httpStack: api.stack,
    headers: { 'X-CSRF-Token': 'first-session' }, retryDelays: null,
    onChunkComplete() { void upload.abort(false); },
    onError(error) { throw error; },
  });
  upload.start();
  await vi.waitFor(() => expect([...api.partials.values()]).toEqual([{ size: file.size, offset: 4 }]));
  expect(await upload.findPreviousUploads()).toHaveLength(1);
  return upload;
}

test.each([401, 403])('HEAD %i keeps the stored fingerprint and fresh sign-in resumes without another reservation', async status => {
  const api = service();
  const file = new File(['abcdefghijkl'], 'resume.zip', { lastModified: 1234 });
  const seed = await interrupted(api, file);
  const saved = await seed.findPreviousUploads();
  const storage = { ...localStorage };
  api.failHead(status);
  await api.mount();
  select(file, new File(['queued'], 'must-not-start.zip'));
  await vi.waitFor(() => expect(document.querySelector('a[href="/auth/login"]')).not.toBeNull());
  expect(document.querySelector('#groups')).toBeNull();
  expect({ ...localStorage }).toEqual(storage);
  expect(await seed.findPreviousUploads()).toEqual(saved);
  expect(api.creations).toBe(1);
  expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD']);
  expect([...api.partials.values()]).toEqual([{ size: 12, offset: 4 }]);

  api.signIn();
  await api.mount();
  select(new File(['abcdefghijkl'], 'resume.zip', { lastModified: 1234 }));
  await vi.waitFor(() => expect(document.body.textContent).toContain('On your shelf'));
  expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD', 'HEAD', 'PATCH']);
  expect(api.requests.at(-1)).toEqual({ method: 'PATCH', url: saved[0].uploadUrl, offset: '4', csrf: 'fresh-session' });
  expect(api.creations).toBe(1);
  expect(api.partials.size).toBe(0);
  expect(await seed.findPreviousUploads()).toHaveLength(0);
});

test.each([404, 410])('HEAD %i discards an expired partial and starts a fresh upload', async status => {
  const api = service();
  const file = new File(['abcdefghijkl'], 'expired.zip', { lastModified: 1234 });
  await interrupted(api, file);
  api.failHead(status);
  await api.mount();
  select(file);
  await vi.waitFor(() => expect(document.body.textContent).toContain('On your shelf'));
  expect(document.querySelector('a[href="/auth/login"]')).toBeNull();
  expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD', 'POST', 'PATCH']);
  expect(api.requests.at(-1)).toMatchObject({ offset: '0' });
  expect(api.creations).toBe(2);
  expect(api.partials.size).toBe(0);
});

test.each(['network', 500] as const)('failed logout (%s) keeps file selection and resumable queue usable', async failure => {
  const api = service(failure);
  const file = new File(['abcdefghijkl'], 'resume.zip', { lastModified: 1234 });
  const seed = await interrupted(api, file);
  const saved = await seed.findPreviousUploads();
  await api.mount();
  const picker = document.querySelector<HTMLInputElement>('#picker')!;
  document.querySelector<HTMLButtonElement>('#signout-confirm')!.click();
  await vi.waitFor(() => expect(document.querySelector('#notice')?.textContent).toContain(failure === 'network' ? 'Failed to fetch' : 'Logout failed'));
  expect(document.querySelector('#picker')).toBe(picker);
  expect(document.querySelector('a[href="/auth/login"]')).toBeNull();
  expect(await seed.findPreviousUploads()).toEqual(saved);
  expect([...api.partials.values()]).toEqual([{ size: 12, offset: 4 }]);
  const choose = vi.spyOn(picker, 'click');
  document.querySelector<HTMLButtonElement>('#choose')!.click();
  expect(choose).toHaveBeenCalledOnce();
  select(file, new File(['queued'], 'next.zip'));
  await vi.waitFor(() => expect([...document.querySelectorAll('.tr-status')].map(row => row.textContent)).toEqual([
    'On your shelf · 12 B / 12 B', 'On your shelf · 6 B / 6 B',
  ]));
  expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD', 'PATCH', 'POST', 'PATCH']);
  expect(api.requests[3]).toMatchObject({ url: saved[0].uploadUrl, offset: '4', csrf: 'first-session' });
  expect(api.creations).toBe(2);
  expect(api.partials.size).toBe(0);
  expect(await seed.findPreviousUploads()).toHaveLength(0);
});

test.each([204, 401, 403])('logout %i locks the shelf and stops active/queued transfers while preserving resume', async status => {
  const api = service(status);
  const file = new File(['abcdefghijkl'], 'resume.zip', { lastModified: 1234 });
  const seed = await interrupted(api, file);
  const saved = await seed.findPreviousUploads();
  api.holdNextPatch();
  try {
    await api.mount();
    const picker = document.querySelector<HTMLInputElement>('#picker')!;
    select(file, new File(['queued'], 'must-not-start.zip'));
    await vi.waitFor(() => expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD', 'PATCH']));
    const storage = { ...localStorage };
    const abortedBefore = api.aborts.length;
    document.querySelector<HTMLButtonElement>('#signout-confirm')!.click();
    await vi.waitFor(() => expect(document.querySelector('a[href="/auth/login"]')).not.toBeNull());
    expect(document.querySelector('#groups')).toBeNull();
    expect(api.aborts.slice(abortedBefore)).toEqual([{ method: 'PATCH', url: saved[0].uploadUrl }]);
    // Even a retained input cannot add work after the authenticated view is removed.
    Object.defineProperty(picker, 'files', { configurable: true, value: [new File(['late'], 'late.zip')] });
    picker.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD', 'PATCH']);
    expect({ ...localStorage }).toEqual(storage);
    expect(await seed.findPreviousUploads()).toEqual(saved);
    expect([...api.partials.values()]).toEqual([{ size: 12, offset: 4 }]);

    api.signIn();
    await api.mount();
    select(file);
    await vi.waitFor(() => expect(document.body.textContent).toContain('On your shelf'));
    expect(api.requests.map(request => request.method)).toEqual(['POST', 'PATCH', 'HEAD', 'PATCH', 'HEAD', 'PATCH']);
    expect(api.requests.at(-1)).toMatchObject({ url: saved[0].uploadUrl, offset: '4', csrf: 'fresh-session' });
    expect(api.creations).toBe(1);
    expect(api.partials.size).toBe(0);
    expect(await seed.findPreviousUploads()).toHaveLength(0);
  } finally { api.releasePatch(); }
});
