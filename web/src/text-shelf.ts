import { esc } from './ui';
type TextItem = {
  id: string;
  text: string;
  createdAt: string;
  expiresAt: string;
};
type Request = (
  path: string,
  method?: string,
  body?: unknown,
  headers?: Record<string, string>,
) => Promise<Response>;
const LIMIT = 64 * 1024;
export function linkFor(text: string): string | null {
  const value = text.trim();
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function createTextShelf(
  root: HTMLElement,
  request: Request,
  toast: (message: string) => void,
) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const draft = $<HTMLTextAreaElement>('#text-draft');
  const send = $<HTMLButtonElement>('#text-send');
  const events = new AbortController();
  const listen = (el: EventTarget, name: string, fn: (event: any) => void) =>
    el.addEventListener(name, fn, { signal: events.signal });
  let alive = true,
    active = false,
    sending = false,
    loaded = false,
    query = '',
    items: TextItem[] = [],
    loading: Promise<void> | undefined;
  let revision = 0,
    refreshError = false;
  let etag: string | null = null;
  const deleting = new Set<string>();
  const error = (message = '', fromRefresh = false) => {
    if (!alive) return;
    refreshError = fromRefresh;
    $('#text-error').textContent = message;
    $('#text-error').hidden = !message;
  };
  function updateDraft() {
    const size = new TextEncoder().encode(draft.value).length;
    $('#text-count').textContent =
      `${(size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} / 64 KiB`;
    send.disabled = sending || !draft.value.trim() || size > LIMIT;
    draft.setAttribute('aria-invalid', String(size > LIMIT));
    $('#text-count').classList.toggle('text-over-limit', size > LIMIT);
    $('#text-count').hidden = size < LIMIT * 0.875;
  }
  function render() {
    if (!alive) return;
    const now = Date.now();
    items = items.filter((x) => Date.parse(x.expiresAt) > now);
    $('#text-shelf').classList.toggle('has-text', items.length > 0);
    const visible = items.filter((x) =>
      x.text.toLocaleLowerCase().includes(query),
    );
    $('#nav-texts').textContent = String(items.length);
    $('#text-empty').hidden = !!visible.length;
    $('#text-empty').textContent = !loaded
      ? 'Loading your text shelf…'
      : query && !visible.length
        ? 'No text matches your search.'
        : 'Text you send appears here on your other devices.';
    const container = $('#text-items');
    // Keep existing nodes during polling: selecting text, scrolling and keyboard focus stay put.
    for (const el of container.querySelectorAll<HTMLElement>('article'))
      if (!visible.some((x) => x.id === el.dataset.textId)) el.remove();
    visible.forEach((item, index) => {
      let card = [...container.querySelectorAll<HTMLElement>('article')].find(
        (el) => el.dataset.textId === item.id,
      );
      if (!card) {
        card = document.createElement('article');
        card.className = 'text-card';
        card.dataset.textId = item.id;
        const url = linkFor(item.text);
        const expiry = new Date(item.expiresAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        const created = new Date(item.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        card.innerHTML = `<span class="sr-only" id="text-meta-${esc(item.id)}">${url ? esc(new URL(url).hostname) : 'Text'} · ${esc(created)}. Expires ${esc(expiry)}</span><pre dir="auto" tabindex="0"></pre><div class="text-card-actions"><button type="button" class="btn btn-sm text-copy" data-text-copy aria-describedby="text-meta-${esc(item.id)}">Copy</button><time class="text-expiry mono" datetime="${esc(item.expiresAt)}" title="Automatically deleted ${esc(expiry)}"></time><button type="button" class="icon-btn text-remove" data-text-delete aria-label="Delete text" title="Delete text" aria-describedby="text-meta-${esc(item.id)}"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg></button><span class="text-delete-confirm" role="group" aria-label="Delete this text?" hidden><button type="button" class="btn btn-sm" data-text-cancel aria-describedby="text-meta-${esc(item.id)}">Cancel</button><button type="button" class="btn btn-sm text-delete-now" data-text-confirm aria-describedby="text-meta-${esc(item.id)}">Delete</button></span></div>`;
        const content = card.querySelector('pre')!;
        if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.dataset.textOpen = '';
          link.setAttribute('aria-describedby', `text-meta-${item.id}`);
          link.textContent = item.text;
          link.insertAdjacentHTML(
            'beforeend',
            '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12" /></svg>',
          );
          content.append(link);
        } else content.textContent = item.text;
      }
      const minutes = Math.max(
        1,
        Math.ceil((Date.parse(item.expiresAt) - now) / 60000),
      );
      const remaining =
        minutes >= 60 ? `${Math.ceil(minutes / 60)}h left` : `${minutes}m left`;
      const time = card.querySelector('time')!;
      if (time.textContent !== remaining) time.textContent = remaining;
      if (container.children[index] !== card)
        container.insertBefore(card, container.children[index] ?? null);
    });
  }
  async function refresh() {
    if (!alive || !active) return;
    render();
    if (loading) return loading;
    const startedRevision = revision;
    loading = (async () => {
      try {
        const response = etag
          ? await request('/api/texts', 'GET', undefined, {
              'If-None-Match': etag,
            })
          : await request('/api/texts');
        const result =
          response.status === 304
            ? null
            : ((await response.json()) as { texts: TextItem[] });
        if (!alive || revision !== startedRevision) return;
        if (refreshError) error();
        if (result) {
          items = result.texts;
          etag = response.headers.get('ETag');
        }
        loaded = true;
        sync('Up to date · refreshes every 5s');
        render();
        // Send/delete errors remain visible until the user acts again.
      } catch (e) {
        if (!alive) return;
        sync('Could not refresh · retrying every 5s');
        error(
          `${(e as Error).message} Your text shelf may be out of date. Use Refresh to retry.`,
          true,
        );
        $('#text-empty').textContent = loaded
          ? 'Your text shelf may be out of date.'
          : 'Could not load your text shelf. Use Refresh to retry.';
      } finally {
        loading = undefined;
      }
    })();
    return loading;
  }
  function sync(message: string) {
    if ($('#text-sync').textContent !== message)
      $('#text-sync').textContent = message;
  }
  listen(draft, 'input', updateDraft);
  listen($('#text-form'), 'submit', async (event: SubmitEvent) => {
    event.preventDefault();
    updateDraft();
    if (send.disabled) return;
    const text = draft.value;
    sending = true;
    updateDraft();
    $('#text-send-label').textContent = 'Sending…';
    error();
    try {
      const result = await request('/api/texts', 'POST', { text });
      const item = (await result.json()) as TextItem;
      if (!alive) return;
      revision++;
      items = [item, ...items.filter((x) => x.id !== item.id)];
      loaded = true;
      if (draft.value === text) draft.value = '';
      etag = null;
      if (active) {
        query = '';
        const search = root.querySelector<HTMLInputElement>('#search');
        if (search) search.value = '';
      }
      render();
      toast('Text sent. Pick it up on your other device.');
      if (active && !window.matchMedia?.('(pointer: coarse)').matches)
        draft.focus();
      else if (document.activeElement === draft) draft.blur();
    } catch (e) {
      error(
        `${(e as Error).message} Your draft is kept. If the connection dropped, refresh to check whether it arrived before sending again.`,
      );
    } finally {
      if (alive) {
        sending = false;
        $('#text-send-label').textContent = 'Send';
        updateDraft();
      }
    }
  });
  listen(draft, 'keydown', (event: KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey) &&
      !event.isComposing
    ) {
      event.preventDefault();
      $<HTMLFormElement>('#text-form').requestSubmit();
    }
  });
  listen($('#text-items'), 'click', async (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLElement>('button');
    const card = button?.closest<HTMLElement>('article');
    const item = items.find((x) => x.id === card?.dataset.textId);
    if (!button || !card || !item || Date.parse(item.expiresAt) <= Date.now()) {
      render();
      return;
    }
    if (button.hasAttribute('data-text-copy')) {
      try {
        await navigator.clipboard.writeText(item.text);
        if (alive) toast('Copied to this device.');
      } catch {
        if (!alive || !active || !card.isConnected) return;
        let fallback = card.querySelector('textarea');
        if (!fallback) {
          fallback = document.createElement('textarea');
          fallback.className = 'text-copy-fallback';
          fallback.readOnly = true;
          fallback.setAttribute('aria-label', 'Select and copy this text');
          fallback.value = item.text;
          const hint = document.createElement('p');
          hint.className = 'muted text-copy-hint';
          hint.textContent =
            'Clipboard access is unavailable. Select and copy the text below.';
          card.append(hint, fallback);
        }
        fallback.focus();
        fallback.select();
        toast('Select and copy the highlighted text.');
      }
    } else if (
      button.hasAttribute('data-text-delete') ||
      button.hasAttribute('data-text-cancel')
    ) {
      const confirm = button.hasAttribute('data-text-delete');
      card.querySelector<HTMLElement>('.text-delete-confirm')!.hidden =
        !confirm;
      card.querySelector<HTMLElement>('[data-text-delete]')!.hidden = confirm;
      card
        .querySelector<HTMLElement>(
          confirm ? '[data-text-cancel]' : '[data-text-delete]',
        )!
        .focus();
    } else if (
      button.hasAttribute('data-text-confirm') &&
      !deleting.has(item.id)
    ) {
      deleting.add(item.id);
      button.setAttribute('disabled', '');
      error();
      try {
        await request(
          `/api/texts/${encodeURIComponent(item.id)}`,
          'DELETE',
        ).catch((e) => {
          if (e.status !== 404 && e.status !== 410) throw e;
        });
        if (!alive) return;
        revision++;
        etag = null;
        items = items.filter((x) => x.id !== item.id);
        render();
        toast('Text deleted.');
        if (active)
          (
            root.querySelector<HTMLElement>('[data-text-copy]') ?? draft
          ).focus();
      } catch (e) {
        error((e as Error).message);
      } finally {
        deleting.delete(item.id);
        button.removeAttribute('disabled');
      }
    }
  });
  listen($('#text-items'), 'keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    const card = (event.target as Element).closest('article');
    if (
      card?.querySelector<HTMLElement>('.text-delete-confirm')?.hidden === false
    )
      card.querySelector<HTMLButtonElement>('[data-text-cancel]')!.click();
  });
  const receive = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  listen(window, 'focus', receive);
  listen(document, 'visibilitychange', receive);
  const timer = setInterval(receive, 5000);
  updateDraft();
  return {
    setCount(count?: number) {
      if (!alive || active || count === undefined) return;
      $('#nav-texts').textContent = String(count);
    },
    activate(on: boolean) {
      active = on;
      if (on) void refresh();
    },
    refresh,
    search(value: string) {
      query = value.trim().toLocaleLowerCase();
      render();
    },
    destroy() {
      alive = false;
      active = false;
      clearInterval(timer);
      events.abort();
      items = [];
      draft.value = '';
      $('#text-items').replaceChildren();
    },
  };
}
