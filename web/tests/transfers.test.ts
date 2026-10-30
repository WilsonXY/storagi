import { afterEach, expect, test, vi } from 'vitest';
import type { UploadOptions } from 'tus-js-client';
import { createDashboard } from '../src/dashboard';

const mocks = vi.hoisted(() => ({
  uploads: [] as {
    file: File;
    options: UploadOptions;
    start: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    resumeFromPreviousUpload: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock('tus-js-client', () => ({
  Upload: class {
    start = vi.fn();
    abort = vi.fn().mockResolvedValue(undefined);
    findPreviousUploads = vi
      .fn()
      .mockResolvedValue([
        { uploadUrl: 'http://localhost:3000/api/uploads/existing' },
      ]);
    resumeFromPreviousUpload = vi.fn();
    constructor(
      public file: File,
      public options: UploadOptions,
    ) {
      mocks.uploads.push(this);
    }
  },
  canStoreURLs: true,
}));
const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
async function mount() {
  document.body.innerHTML = '<main id="app"></main>';
  await createDashboard(document.querySelector('#app')!, {
    fetch: vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : {
                  files: [],
                  usedBytes: 0,
                  reservedBytes: 0,
                  budgetBytes: 200 * 1024 ** 3,
                },
          ),
        ),
    ),
  });
}
function select(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('#picker')!;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change'));
}
afterEach(() => {
  mocks.uploads.length = 0;
  document.body.innerHTML = '';
});

test('uploads sequentially with 8 MiB chunks, persisted resume and CSRF on every mutation', async () => {
  await mount();
  select(new File(['first'], 'first.zip'), new File(['second'], 'second.mp4'));
  await tick();
  expect(mocks.uploads).toHaveLength(1);
  const upload = mocks.uploads[0];
  expect(upload.options).toMatchObject({
    chunkSize: 8 * 1024 ** 2,
    parallelUploads: 1,
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
  });
  expect(upload.resumeFromPreviousUpload).toHaveBeenCalled();
  expect(upload.start).toHaveBeenCalledOnce();
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const xhr = { withCredentials: false };
    const setHeader = vi.fn();
    await upload.options.onBeforeRequest!({
      getMethod: () => method,
      getURL: () => '/api/uploads/id',
      getUnderlyingObject: () => xhr,
      setHeader,
    } as never);
    expect(setHeader).toHaveBeenCalledWith('X-CSRF-Token', 'test-csrf');
    expect(xhr.withCredentials).toBe(true);
  }
  upload.options.onSuccess!({} as never);
  await tick();
  expect(mocks.uploads).toHaveLength(2);
  expect(document.body.textContent).toContain('On your shelf');
});

test('pause releases the queue and resume waits its turn; cancel terminates the partial upload', async () => {
  await mount();
  select(new File(['first'], 'first.zip'), new File(['second'], 'second.mp4'));
  await tick();
  document.querySelector<HTMLButtonElement>('[data-action="pause"]')!.click();
  await tick();
  expect(mocks.uploads[0].abort).toHaveBeenCalledWith(false);
  expect(mocks.uploads).toHaveLength(2);
  document.querySelector<HTMLButtonElement>('[data-action="resume"]')!.click();
  expect(mocks.uploads[0].start).toHaveBeenCalledTimes(1);
  document.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
  await tick();
  expect(mocks.uploads[0].abort).toHaveBeenCalledWith(true);
  expect(document.body.textContent).toContain('Cancelled');
});

test('halts every upload and clears private content when the session expires', async () => {
  await mount();
  select(new File(['first'], 'first.zip'), new File(['second'], 'second.mp4'));
  await tick();
  mocks.uploads[0].options.onError!(
    Object.assign(new Error('unauthorized'), {
      originalResponse: { getStatus: () => 401 },
    }),
  );
  await tick();
  expect(document.querySelector('a[href="/auth/login"]')).not.toBeNull();
  expect(document.querySelector('#groups')).toBeNull();
  expect(mocks.uploads).toHaveLength(1);
  expect(mocks.uploads[0].abort).toHaveBeenCalledWith(false);
});

test('offers quota recovery without automatic retries and rejects cross-origin tus locations', async () => {
  await mount();
  select(new File(['first'], 'first.zip'));
  await tick();
  const options = mocks.uploads[0].options;
  expect(() =>
    options.onBeforeRequest!({
      getURL: () => 'https://attacker.invalid/api/uploads/id',
    } as never),
  ).toThrow('unsafe upload address');
  expect(
    options.onShouldRetry!(
      { originalResponse: { getStatus: () => 507 } } as never,
      0,
      options,
    ),
  ).toBe(false);
  options.onError!(
    Object.assign(new Error('full'), {
      originalResponse: { getStatus: () => 507 },
    }),
  );
  expect(document.body.textContent).toContain('Not enough space');
  expect(document.querySelector('[data-action="resume"]')?.textContent).toBe(
    'Retry',
  );
});

test('refreshes reserved storage when the server creates a partial upload', async () => {
  document.body.innerHTML = '<main id="app"></main>';
  let reservedBytes = 0;
  await createDashboard(document.querySelector('#app')!, {
    fetch: vi.fn(
      async (url: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(url) === '/api/session'
              ? { authenticated: true, csrfToken: 'test-csrf' }
              : {
                  files: [],
                  usedBytes: 0,
                  reservedBytes,
                  budgetBytes: 200 * 1024 ** 3,
                },
          ),
        ),
    ),
  });
  select(new File(['first'], 'first.zip'));
  await tick();
  reservedBytes = 16 * 1024 ** 2;
  mocks.uploads[0].options.onUploadUrlAvailable?.();
  await tick();
  expect(document.querySelector('#reserved')!.textContent).toContain(
    '16 MiB reserved',
  );
});

function drop(...entries: [File, { isDirectory: boolean } | undefined][]) {
  const event = new Event('drop', { cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: ['Files'],
      files: entries.map(([file]) => file),
      items: entries.map(([file, entry]) => ({
        kind: 'file',
        getAsFile: () => file,
        // undefined entry: a browser without the entry API
        ...(entry && { webkitGetAsEntry: () => entry }),
      })),
    },
  });
  window.dispatchEvent(event);
  return event;
}
test('a dropped folder is refused with a notice; files dropped beside it still upload', async () => {
  await mount();
  const zip = new File(['x'], 'posters.zip');
  const event = drop(
    [new File([], 'posters'), { isDirectory: true }],
    [zip, { isDirectory: false }],
  );
  await tick();
  expect(event.defaultPrevented).toBe(true);
  expect(mocks.uploads.map((upload) => upload.file)).toEqual([zip]);
  expect(
    [...document.querySelectorAll('.tr-name')].map((n) => n.textContent),
  ).toEqual(['posters.zip']);
  expect(document.querySelector('#notice span')?.textContent).toBe(
    "Folders can't be uploaded. Zip posters first.",
  );
  mocks.uploads[0].options.onSuccess!({} as never);
  await tick();
  expect(mocks.uploads).toHaveLength(1);
});
test('without the entry API a drop still uploads its files', async () => {
  await mount();
  const zip = new File(['x'], 'posters.zip');
  drop([zip, undefined]);
  await tick();
  expect(mocks.uploads.map((upload) => upload.file)).toEqual([zip]);
});
