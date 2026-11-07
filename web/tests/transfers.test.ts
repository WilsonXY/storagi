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
async function mount(retentionDays = 30, firstListing?: Promise<Response>) {
  document.body.innerHTML = '<main id="app"></main>';
  let initial = firstListing;
  await createDashboard(document.querySelector('#app')!, {
    fetch: vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === '/api/files' && initial) {
        const response = initial;
        initial = undefined;
        return response;
      }
      if (String(url) === '/api/texts') return Response.json({ texts: [] });
      return Response.json(
        String(url) === '/api/session'
          ? { authenticated: true, csrfToken: 'test-csrf', retentionDays }
          : {
              retentionDays: 60,
              files: [],
              usedBytes: 0,
              reservedBytes: 0,
              budgetBytes: 200 * 1024 ** 3,
            },
      );
    }),
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
              ? {
                  authenticated: true,
                  csrfToken: 'test-csrf',
                  retentionDays: 30,
                }
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

type Entry = [File, { isDirectory: boolean } | undefined];
const drop = (...entries: Entry[]) => transfer('drop', entries);
const paste = (...entries: Entry[]) => transfer('paste', entries);
function transfer(
  type: 'drop' | 'paste',
  entries: Entry[],
  { text = !entries.length, target = window as EventTarget } = {},
) {
  const event = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(
    event,
    type === 'drop' ? 'dataTransfer' : 'clipboardData',
    {
      value: {
        types: [
          ...(entries.length ? ['Files'] : []),
          ...(text ? ['text/plain'] : []),
        ],
        files: entries.map(([file]) => file),
        items: entries.map(([file, entry]) => ({
          kind: 'file',
          getAsFile: () => file,
          // undefined entry: a browser without the entry API
          ...(entry && { webkitGetAsEntry: () => entry }),
        })),
      },
    },
  );
  target.dispatchEvent(event);
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
// jsdom has no modal dialogs: open and close by the attribute. Like a browser, close fires its event a task later.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  if (!this.open) return;
  this.open = false;
  setTimeout(() => this.dispatchEvent(new Event('close')));
};
const confirmBox = () =>
  document.querySelector<HTMLDialogElement>('#paste-confirm')!;
const listed = () =>
  [...confirmBox().querySelectorAll('li')].map((li) => li.textContent);
const press = (id: string) =>
  document.querySelector<HTMLButtonElement>(id)!.click();
test('pasted files wait for confirmation, and a pasted folder is refused like a dropped one', async () => {
  await mount();
  const shot = new File(['x'], 'image.png');
  const event = paste(
    [shot, { isDirectory: false }],
    [new File([], 'posters'), { isDirectory: true }],
  );
  await tick();
  expect(event.defaultPrevented).toBe(true);
  expect(document.querySelector('#notice span')?.textContent).toBe(
    "Folders can't be uploaded. Zip posters first.",
  );
  expect(confirmBox().open).toBe(true);
  expect(confirmBox().querySelector('#paste-title')!.textContent).toBe(
    'Upload 1 pasted file?',
  );
  expect(listed()).toEqual(['image.png1 B']);
  expect(confirmBox().querySelector('#paste-note')!.textContent).toContain(
    'Kept 60 days.',
  );
  expect(mocks.uploads).toHaveLength(0);
  press('#paste-upload');
  await tick();
  expect(confirmBox().open).toBe(false);
  expect(mocks.uploads.map((upload) => upload.file)).toEqual([shot]);
});
test('cancelling or dismissing a paste uploads nothing; a second paste joins the open list', async () => {
  await mount();
  const a = new File(['x'], 'a.png'),
    b = new File(['yy'], 'b.zip');
  paste([a, { isDirectory: false }]);
  paste([b, { isDirectory: false }]);
  await tick();
  expect(confirmBox().querySelector('#paste-title')!.textContent).toBe(
    'Upload 2 pasted files?',
  );
  expect(listed()).toEqual(['a.png1 B', 'b.zip2 B']);
  press('#paste-cancel');
  await tick();
  expect(confirmBox().open).toBe(false);
  // Escape closes a modal dialog without a button.
  paste([a, { isDirectory: false }]);
  await tick();
  expect(listed()).toEqual(['a.png1 B']);
  confirmBox().close();
  press('#paste-upload');
  await tick();
  expect(mocks.uploads).toHaveLength(0);
});
test('a pasted file name is shown as text, never as markup', async () => {
  await mount();
  paste([new File(['x'], '<img src=x onerror=alert(1)>.png'), undefined]);
  await tick();
  expect(confirmBox().querySelector('img')).toBeNull();
  expect(listed()[0]).toContain('<img src=x onerror=alert(1)>.png');
});
test('pasting text is left alone', async () => {
  await mount();
  const event = paste();
  await tick();
  expect(event.defaultPrevented).toBe(false);
  expect(confirmBox().open).toBe(false);
});
test('a clipboard with text and a file pastes text into a field, and offers the file elsewhere', async () => {
  await mount();
  const shot = new File(['x'], 'image.png');
  const mixed = (target: EventTarget) =>
    transfer('paste', [[shot, { isDirectory: false }]], { text: true, target });
  const typed = mixed(document.querySelector('#search')!);
  await tick();
  expect(typed.defaultPrevented).toBe(false);
  expect(confirmBox().open).toBe(false);
  // A checkbox can't take text, so the file is offered.
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  document.body.append(checkbox);
  expect(mixed(checkbox).defaultPrevented).toBe(true);
  await tick();
  expect(confirmBox().open).toBe(true);
  press('#paste-cancel');
  checkbox.remove();
  expect(mixed(document.body).defaultPrevented).toBe(true);
  await tick();
  expect(confirmBox().open).toBe(true);
  expect(mocks.uploads).toHaveLength(0);
});
test('dashboard shortcuts stay quiet while the paste confirmation is open', async () => {
  await mount();
  const picker = vi.spyOn(
    document.querySelector<HTMLInputElement>('#picker')!,
    'click',
  );
  paste([new File(['x'], 'a.png'), undefined]);
  await tick();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
  expect(picker).not.toHaveBeenCalled();
  press('#paste-cancel');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
  expect(picker).toHaveBeenCalledOnce();
});
test('a paste right after Cancel starts a fresh list that survives the late close event', async () => {
  await mount();
  const a = new File(['x'], 'a.png'),
    b = new File(['yy'], 'b.png');
  paste([a, undefined]);
  await tick();
  press('#paste-cancel');
  paste([b, undefined]);
  expect(listed()).toEqual(['b.png2 B']);
  await tick();
  press('#paste-upload');
  await tick();
  expect(mocks.uploads.map((upload) => upload.file)).toEqual([b]);
});

test('composers omit retention sentences while paste confirmation keeps the latest listed policy', async () => {
  await mount(45);
  expect(document.querySelector('#composer .composer-hint')).toBeNull();
  expect(document.querySelector('#text-hint')).toBeNull();
  const describedBy = document
    .querySelector('#text-draft')!
    .getAttribute('aria-describedby')!
    .split(/\s+/);
  for (const id of describedBy)
    expect(document.getElementById(id)).not.toBeNull();
  paste([new File(['x'], 'policy.txt'), { isDirectory: false }]);
  await tick();
  expect(document.querySelector('#paste-note')?.textContent).toContain(
    'Kept 60 days',
  );
});

test('paste policy uses committed session metadata while its first listing is pending, then follows the listing', async () => {
  let release!: (response: Response) => void;
  const pending = mount(
    7,
    new Promise<Response>((resolve) => {
      release = resolve;
    }),
  );
  await tick();
  const file = new File(['x'], 'shared-policy.txt');
  paste([file, { isDirectory: false }]);
  await tick();
  const initialNote = document.querySelector('#paste-note')!.textContent;
  press('#paste-cancel');
  release(
    Response.json({
      retentionDays: 14,
      files: [],
      usedBytes: 0,
      reservedBytes: 0,
      budgetBytes: 200 * 1024 ** 3,
    }),
  );
  await pending;
  paste([file, { isDirectory: false }]);
  await tick();
  expect(initialNote).toContain('Kept 7 days.');
  expect(document.querySelector('#paste-note')!.textContent).toContain(
    'Kept 14 days.',
  );
});
