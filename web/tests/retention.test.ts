import { afterEach, expect, test, vi } from 'vitest';
import { createDashboard } from '../src/dashboard';

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const click = (id: string) => document.querySelector<HTMLElement>(id)!.click();
const select = (days: number) => {
  const field = document.querySelector<HTMLSelectElement>('#retention-days')!;
  field.value = String(days);
  field.dispatchEvent(new Event('change'));
};
async function mount(
  save?: (body: {
    retentionDays: number;
    confirmDeletes: number;
  }) => Response | Promise<Response>,
) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  let days = 60;
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (url === '/api/session')
      return Response.json({ authenticated: true, csrfToken: 'test-csrf' });
    if (url === '/api/settings') {
      if (save) return save(JSON.parse(String(init?.body)));
      days = JSON.parse(String(init?.body)).retentionDays;
      return Response.json({ retentionDays: days });
    }
    return Response.json({
      files: [],
      usedBytes: 0,
      reservedBytes: 0,
      budgetBytes: 1000,
      retentionDays: days,
    });
  });
  document.body.innerHTML = '<main id="app"></main>';
  dispose = await createDashboard(document.querySelector('#app')!, {
    fetch: fetcher,
  });
  return fetcher;
}

test('loads shared retention and saves a harmless change with CSRF, updating shelf copy', async () => {
  const fetcher = await mount();
  expect(
    document.querySelector<HTMLSelectElement>('#retention-days')?.value,
  ).toBe('60');
  expect(document.querySelector('#retention-copy')?.textContent).toContain(
    '60 days',
  );
  select(90);
  click('#retention-save');
  await tick();
  expect(fetcher).toHaveBeenCalledWith(
    '/api/settings',
    expect.objectContaining({
      method: 'PUT',
      credentials: 'same-origin',
      headers: expect.objectContaining({
        'X-CSRF-Token': 'test-csrf',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ retentionDays: 90, confirmDeletes: 0 }),
    }),
  );
  expect(document.querySelector('#retention-copy')?.textContent).toContain(
    '90 days',
  );
  expect(document.querySelector('#retention-status')?.textContent).toContain(
    'Saved',
  );
});

test('failed saves preserve policy and allow retry; loading blocks duplicate saves', async () => {
  let respond!: (response: Response) => void;
  const fetcher = await mount(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  select(7);
  click('#retention-save');
  click('#retention-save');
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/settings'),
  ).toHaveLength(1);
  expect(
    document.querySelector<HTMLSelectElement>('#retention-days')!.disabled,
  ).toBe(true);
  expect(document.querySelector('#retention-save')?.textContent).toBe(
    'Saving…',
  );
  respond(Response.json({ error: 'Synthetic save failure' }, { status: 500 }));
  await tick();
  expect(document.querySelector('#retention-status')?.textContent).toBe(
    'Synthetic save failure',
  );
  expect(document.querySelector('#retention-copy')?.textContent).toContain(
    '60 days',
  );
  expect(
    document.querySelector<HTMLSelectElement>('#retention-days')!.value,
  ).toBe('7');
  click('#retention-save');
  respond(Response.json({ error: 'Session expired' }, { status: 401 }));
  await tick();
  expect(document.querySelector('#locked')).not.toBeNull();
  expect(document.querySelector('#retention-form')).toBeNull();
});

test('conflict shows exact deletion count, Cancel and Escape never acknowledge; selection changes reset confirmation', async () => {
  const fetcher = await mount(() =>
    Response.json(
      { error: 'Confirmation needed.', deleteCount: 6 },
      { status: 409 },
    ),
  );
  select(7);
  click('#retention-save');
  await tick();
  const dialog =
    document.querySelector<HTMLDialogElement>('#retention-confirm')!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain('6 files will be permanently deleted');
  expect(document.querySelector('#retention-title')?.textContent).toBe(
    'Change to 7 days?',
  );
  expect(document.activeElement?.id).toBe('retention-cancel');
  click('#retention-cancel');
  expect(dialog.open).toBe(false);
  expect(document.activeElement?.id).toBe('retention-save');
  click('#retention-save');
  await tick();
  dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  expect(dialog.open).toBe(false);
  click('#retention-save');
  await tick();
  select(14);
  expect(dialog.open).toBe(false);
  click('#retention-save');
  await tick();
  const saves = fetcher.mock.calls
    .filter(([url]) => url === '/api/settings')
    .map(([, init]) => JSON.parse(String(init?.body)));
  expect(saves).toEqual([
    { retentionDays: 7, confirmDeletes: 0 },
    { retentionDays: 7, confirmDeletes: 0 },
    { retentionDays: 7, confirmDeletes: 0 },
    { retentionDays: 14, confirmDeletes: 0 },
  ]);
  expect(document.querySelector('#retention-copy')?.textContent).toContain(
    '60 days',
  );
});

test('a larger count requires a fresh click and confirming sends the displayed duration and count', async () => {
  const acknowledgements: number[] = [];
  await mount(({ confirmDeletes }) => {
    acknowledgements.push(confirmDeletes);
    if (confirmDeletes < 8)
      return Response.json(
        { error: 'Confirmation needed.', deleteCount: confirmDeletes ? 8 : 6 },
        { status: 409 },
      );
    return Response.json({ retentionDays: 7 });
  });
  select(7);
  click('#retention-save');
  await tick();
  click('#retention-apply');
  await tick();
  expect(acknowledgements).toEqual([0, 6]);
  expect(
    document.querySelector<HTMLDialogElement>('#retention-confirm')!.open,
  ).toBe(true);
  expect(document.querySelector('#retention-note')?.textContent).toContain(
    '8 files',
  );
  expect(document.activeElement?.id).toBe('retention-cancel');
  click('#retention-apply');
  await tick();
  expect(acknowledgements).toEqual([0, 6, 8]);
  expect(
    document.querySelector<HTMLDialogElement>('#retention-confirm')!.open,
  ).toBe(false);
});
