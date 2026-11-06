import { afterEach, expect, test, vi } from 'vitest';
import { createDashboard } from '../src/dashboard';

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const click = (id: string) => document.querySelector<HTMLElement>(id)!.click();
const select = (days: number) => {
  click('#retention-days');
  click(`#retention-options [value="${days}"]`);
};
async function mount(
  save?: (body: {
    retentionDays: number;
    confirmDeletes: number;
  }) => Response | Promise<Response>,
  listing?: () => Promise<void>,
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
      if (save) {
        const response = await save(JSON.parse(String(init?.body)));
        if (response.ok) days = (await response.clone().json()).retentionDays;
        return response;
      }
      days = JSON.parse(String(init?.body)).retentionDays;
      return Response.json({ retentionDays: days });
    }
    const listedDays = days;
    await listing?.();
    return Response.json({
      files: [],
      usedBytes: 0,
      reservedBytes: 0,
      budgetBytes: 1000,
      retentionDays: listedDays,
    });
  });
  document.body.innerHTML = '<main id="app"></main>';
  dispose = await createDashboard(document.querySelector('#app')!, {
    fetch: fetcher,
  });
  return Object.assign(fetcher, {
    setSavedDays: (value: number) => {
      days = value;
    },
  });
}

test('duration menu marks the shared choice and selecting only changes the draft', async () => {
  const fetcher = await mount();
  const trigger = document.querySelector<HTMLButtonElement>('#retention-days')!;
  expect(trigger.tagName).toBe('BUTTON');
  expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
  click('#retention-days');
  const menu = document.querySelector<HTMLElement>('#retention-options')!;
  expect(menu.hidden).toBe(false);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const selected = menu.querySelector<HTMLButtonElement>(
    '[aria-selected="true"]',
  )!;
  expect(selected.value).toBe('60');
  expect(document.activeElement).toBe(selected);
  click('#retention-options [value="7"]');
  expect(trigger.value).toBe('7');
  expect(trigger.textContent).toContain('7 days');
  expect(menu.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/settings'),
  ).toHaveLength(0);
});

test('only a draft different from the saved duration enables saving, including direct submission', async () => {
  const fetcher = await mount();
  const save = document.querySelector<HTMLButtonElement>('#retention-save')!;
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('60');
  expect(save.disabled).toBe(true);
  document
    .querySelector('#retention-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/settings'),
  ).toHaveLength(0);
  select(7);
  expect(save.disabled).toBe(false);
  select(60);
  expect(save.disabled).toBe(true);
  select(90);
  document.querySelector<HTMLButtonElement>('#retention-save')!.focus();
  click('#retention-save');
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('90');
  expect(save.disabled).toBe(true);
  expect(document.activeElement?.id).toBe('retention-days');
});

test('successful saves give a short replayable cue only after the refresh settles', async () => {
  vi.useFakeTimers();
  let pause = false,
    release!: () => void;
  const fetcher = await mount(undefined, async () => {
    if (pause)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
  });
  click('#nav-settings');
  await tick();
  const save = document.querySelector<HTMLButtonElement>('#retention-save')!;
  expect(save.classList.contains('is-saved')).toBe(false);
  select(90);
  expect(save.classList.contains('is-saved')).toBe(false);
  pause = true;
  click('#retention-save');
  await tick();
  expect(save.getAttribute('aria-busy')).toBe('true');
  expect(save.classList.contains('is-saved')).toBe(false);
  pause = false;
  release();
  await tick();
  expect(save.disabled).toBe(true);
  expect(save.getAttribute('aria-busy')).toBe('false');
  expect(save.classList.contains('is-saved')).toBe(true);
  expect(document.querySelector('#retention-status')!.textContent).toBe('');
  vi.advanceTimersByTime(899);
  expect(save.classList.contains('is-saved')).toBe(true);
  vi.advanceTimersByTime(1);
  expect(save.classList.contains('is-saved')).toBe(false);
  select(30);
  click('#retention-save');
  await tick();
  expect(save.classList.contains('is-saved')).toBe(true);
  select(60);
  expect(save.classList.contains('is-saved')).toBe(false);
  click('#retention-save');
  await tick();
  expect(save.classList.contains('is-saved')).toBe(true);
  click('.nav-item[data-tab="inbox"]');
  expect(save.classList.contains('is-saved')).toBe(false);
  click('#nav-settings');
  await tick();
  fetcher.setSavedDays(14);
  click('#refresh');
  await tick();
  expect(save.classList.contains('is-saved')).toBe(false);
  select(30);
  click('#retention-save');
  await tick();
  expect(save.classList.contains('is-saved')).toBe(true);
  dispose();
  expect(save.classList.contains('is-saved')).toBe(false);
});

test('refresh preserves a different draft and follows new saved policy once they match', async () => {
  const fetcher = await mount();
  click('#nav-settings');
  const trigger = document.querySelector<HTMLButtonElement>('#retention-days')!;
  const save = document.querySelector<HTMLButtonElement>('#retention-save')!;
  select(7);
  click('#refresh');
  await tick();
  expect(trigger.value).toBe('7');
  expect(save.disabled).toBe(false);
  fetcher.setSavedDays(7);
  click('#refresh');
  await tick();
  expect(trigger.value).toBe('7');
  expect(save.disabled).toBe(true);
  fetcher.setSavedDays(14);
  click('#refresh');
  await tick();
  expect(trigger.value).toBe('14');
  expect(save.disabled).toBe(true);
  select(90);
  fetcher.setSavedDays(30);
  click('#refresh');
  await tick();
  expect(trigger.value).toBe('90');
  expect(save.disabled).toBe(false);
  select(30);
  expect(save.disabled).toBe(true);
});

test('reopening Settings discards the draft and refreshes the saved server duration', async () => {
  const fetcher = await mount();
  click('#nav-settings');
  await tick();
  const trigger = document.querySelector<HTMLButtonElement>('#retention-days')!;
  const save = document.querySelector<HTMLButtonElement>('#retention-save')!;
  select(7);
  click('#nav-settings');
  expect(trigger.value).toBe('7');
  click('.nav-item[data-tab="inbox"]');
  click('#nav-settings');
  expect(trigger.value).toBe('60');
  expect(save.disabled).toBe(true);
  await tick();
  click('.nav-item[data-tab="inbox"]');
  fetcher.setSavedDays(14);
  click('#nav-settings');
  await tick();
  expect(trigger.value).toBe('14');
  expect(save.disabled).toBe(true);
});

test('before the first listing loads both controls and direct saving stay disabled', async () => {
  let release!: () => void;
  const pending = mount(
    undefined,
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.disabled,
  ).toBe(true);
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(true);
  document
    .querySelector('#retention-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  release();
  const fetcher = await pending;
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/settings'),
  ).toHaveLength(0);
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('60');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(true);
});

test('a draft chosen while the Settings entry refresh is pending survives its response', async () => {
  let pause = false,
    release!: () => void;
  const fetcher = await mount(undefined, async () => {
    if (pause)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
  });
  pause = true;
  fetcher.setSavedDays(14);
  click('#nav-settings');
  await tick();
  select(7);
  release();
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('7');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(false);
  select(14);
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(true);
});

test('returning to Settings during a pending save preserves the choice for failure and retry', async () => {
  let respond!: (response: Response) => void;
  await mount(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  click('#nav-settings');
  await tick();
  select(7);
  click('#retention-save');
  click('.nav-item[data-tab="inbox"]');
  click('#nav-settings');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('7');
  respond(Response.json({ error: 'Synthetic save failure' }, { status: 500 }));
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('7');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(false);
});

test('a stale listing cannot replace the committed selection while its save refresh is pending', async () => {
  let respond!: (response: Response) => void;
  let pause = false;
  const releases: (() => void)[] = [];
  await mount(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    async () => {
      if (pause)
        await new Promise<void>((resolve) => {
          releases.push(resolve);
        });
    },
  );
  pause = true;
  click('#refresh');
  await tick();
  select(90);
  click('#retention-save');
  respond(Response.json({ retentionDays: 90 }));
  await tick();
  releases.shift()!();
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('90');
  expect(releases).toHaveLength(1);
  releases.shift()!();
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('90');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(true);
});

test('menu navigation keeps the draft until choice and Escape returns focus without dashboard shortcuts', async () => {
  await mount();
  const trigger = document.querySelector<HTMLButtonElement>('#retention-days')!;
  const menu = document.querySelector<HTMLElement>('#retention-options')!;
  const key = (value: string) =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  trigger.focus();
  key('ArrowDown');
  expect(menu.hidden).toBe(false);
  expect((document.activeElement as HTMLButtonElement).value).toBe('60');
  key('ArrowDown');
  expect((document.activeElement as HTMLButtonElement).value).toBe('90');
  key('ArrowDown');
  expect((document.activeElement as HTMLButtonElement).value).toBe('1');
  key('End');
  expect((document.activeElement as HTMLButtonElement).value).toBe('90');
  key('Home');
  expect((document.activeElement as HTMLButtonElement).value).toBe('1');
  key('ArrowUp');
  expect((document.activeElement as HTMLButtonElement).value).toBe('90');
  key('/');
  expect(menu.contains(document.activeElement)).toBe(true);
  expect(trigger.value).toBe('60');
  const escape = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  const bubbled = vi.fn();
  window.addEventListener('keydown', bubbled, { once: true });
  document.activeElement!.dispatchEvent(escape);
  window.removeEventListener('keydown', bubbled);
  expect(bubbled).not.toHaveBeenCalled();
  expect(escape.defaultPrevented).toBe(true);
  expect(menu.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
  expect(trigger.value).toBe('60');
});

test('outside pointer and focus dismiss the menu without discarding the draft', async () => {
  await mount();
  select(7);
  click('#retention-days');
  const menu = document.querySelector<HTMLElement>('#retention-options')!;
  document
    .querySelector('#retention-desc')!
    .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  expect(menu.hidden).toBe(true);
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('7');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(false);
  click('#retention-days');
  document.querySelector<HTMLButtonElement>('#retention-save')!.focus();
  expect(menu.hidden).toBe(true);
  expect(document.activeElement?.id).toBe('retention-save');
  click('#retention-days');
  vi.spyOn(
    document.querySelector('#retention-days')!,
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 300, 116, 34));
  window.dispatchEvent(new Event('scroll'));
  expect(menu.hidden).toBe(false);
  expect(menu.style.getPropertyValue('--retention-room')).toBe(
    `${innerHeight - 334 - 16}px`,
  );
});

test('an unknown focus destination during an option press does not discard its click', async () => {
  const fetcher = await mount();
  click('#retention-days');
  document.activeElement!.dispatchEvent(
    new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
  );
  expect(
    document.querySelector<HTMLElement>('#retention-options')!.hidden,
  ).toBe(false);
  (document.activeElement as HTMLElement).blur();
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(
    document.querySelector<HTMLElement>('#retention-options')!.hidden,
  ).toBe(true);
  expect(document.activeElement?.id).toBe('retention-days');
  click('#retention-days');
  click('#retention-options [value="7"]');
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
  ).toBe('7');
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/settings'),
  ).toHaveLength(0);
});

test('Tab dismisses the menu from its trigger so native tab order can continue', async () => {
  await mount();
  const trigger = document.querySelector<HTMLButtonElement>('#retention-days')!;
  const menu = document.querySelector<HTMLElement>('#retention-options')!;
  for (const shiftKey of [false, true]) {
    click('#retention-days');
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement!.dispatchEvent(tab);
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(tab.defaultPrevented).toBe(false);
  }
});

test('leaving Settings closes the menu', async () => {
  await mount();
  click('#nav-settings');
  click('#retention-days');
  click('.nav-item[data-tab="inbox"]');
  expect(
    document.querySelector<HTMLElement>('#retention-options')!.hidden,
  ).toBe(true);
  click('#nav-settings');
  expect(
    document.querySelector('#retention-days')!.getAttribute('aria-expanded'),
  ).toBe('false');
});

test('the closed duration trigger keeps select-like isolation from dashboard shortcuts', async () => {
  await mount();
  const trigger = document.querySelector<HTMLButtonElement>('#retention-days')!;
  const picker = vi.spyOn(
    document.querySelector<HTMLInputElement>('#picker')!,
    'click',
  );
  trigger.focus();
  for (const [key, ctrlKey] of [
    ['/', false],
    ['u', false],
    ['a', true],
  ] as const) {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey,
      bubbles: true,
      cancelable: true,
    });
    trigger.dispatchEvent(event);
    expect(document.activeElement).toBe(trigger);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(picker).not.toHaveBeenCalled();
});

test('loads shared retention and saves a harmless change with CSRF, updating shelf copy', async () => {
  const fetcher = await mount();
  expect(
    document.querySelector('#retention-save')?.getAttribute('aria-label'),
  ).toBe('Save retention');
  expect(document.querySelector('#retention-save svg')).not.toBeNull();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')?.value,
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
  expect(document.querySelector('#retention-status')?.textContent).toBe('');
});

test('failed saves preserve policy and allow retry; loading blocks duplicate saves', async () => {
  let respond!: (response: Response) => void;
  const fetcher = await mount(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  click('#nav-settings');
  await tick();
  select(7);
  click('#retention-days');
  click('#retention-save');
  click('#retention-save');
  click('#retention-days');
  expect(
    document.querySelector<HTMLElement>('#retention-options')!.hidden,
  ).toBe(true);
  expect(
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '#retention-options button',
      ),
    ].every((option) => option.disabled),
  ).toBe(true);
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/settings'),
  ).toHaveLength(1);
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.disabled,
  ).toBe(true);
  expect(
    document.querySelector('#retention-save')?.getAttribute('aria-label'),
  ).toBe('Saving retention…');
  expect(
    document.querySelector('#retention-save')?.getAttribute('aria-busy'),
  ).toBe('true');
  expect(
    document.querySelector('#retention-save')!.classList.contains('is-saved'),
  ).toBe(false);
  respond(Response.json({ error: 'Synthetic save failure' }, { status: 500 }));
  await tick();
  expect(document.querySelector('#retention-status')?.textContent).toBe(
    'Synthetic save failure',
  );
  expect(
    document.querySelector('#retention-save')!.classList.contains('is-saved'),
  ).toBe(false);
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(false);
  expect(document.querySelector('#retention-copy')?.textContent).toContain(
    '60 days',
  );
  expect(
    document.querySelector<HTMLButtonElement>('#retention-days')!.value,
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
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(false);
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
  click('#nav-settings');
  await tick();
  select(7);
  click('#retention-save');
  await tick();
  click('#retention-apply');
  await tick();
  expect(acknowledgements).toEqual([0, 6]);
  expect(
    document.querySelector('#retention-save')!.classList.contains('is-saved'),
  ).toBe(false);
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
    document.querySelector('#retention-save')!.classList.contains('is-saved'),
  ).toBe(true);
  expect(
    document.querySelector<HTMLDialogElement>('#retention-confirm')!.open,
  ).toBe(false);
});

test('confirmation still sends the displayed days and count if a refresh now matches its policy', async () => {
  const acknowledgements: number[] = [];
  const fetcher = await mount(({ confirmDeletes, retentionDays }) => {
    acknowledgements.push(confirmDeletes);
    return confirmDeletes
      ? Response.json({ retentionDays })
      : Response.json(
          { error: 'Confirmation needed.', deleteCount: 6 },
          { status: 409 },
        );
  });
  click('#nav-settings');
  await tick();
  select(7);
  click('#retention-save');
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(false);
  fetcher.setSavedDays(7);
  click('#refresh');
  await tick();
  expect(
    document.querySelector<HTMLButtonElement>('#retention-save')!.disabled,
  ).toBe(true);
  expect(
    document.querySelector<HTMLDialogElement>('#retention-confirm')!.open,
  ).toBe(true);
  click('#retention-apply');
  await tick();
  expect(acknowledgements).toEqual([0, 6]);
  expect(fetcher).toHaveBeenCalledWith(
    '/api/settings',
    expect.objectContaining({
      body: JSON.stringify({ retentionDays: 7, confirmDeletes: 6 }),
    }),
  );
});
