import shelfHTML from './shelf.html?raw';
import lockedHTML from './locked.html?raw';
import { setupTransfers } from './transfers';
import { createTransferView } from './transfer-view';
import { bytes, clock, daysLeft, shortId, splitName } from './formatting';
import { AutoRefresh, OfflineRetry } from './refresh';
import { Selection } from './selection';
import {
  nextSort,
  groupFiles,
  sortFiles,
  type Sort,
  type SortKey,
} from './sorting';
import { deferredDelete, GRACE_SECONDS } from './deferred-delete';
import {
  motionPref,
  setMotionPref,
  reduced,
  gesturePref,
  setGesturePref,
  previewPref,
  setPreviewPref,
  onMotionChange,
} from './preferences';
import { KoiPond, KoiMark, orbitLoader } from './koi';
import { esc, blocks, blockCount, createToast } from './ui';
import { rowGestures } from './gestures';
export type ShelfFile = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
};
type Shelf = {
  retentionDays?: number;
  files: ShelfFile[];
  usedBytes: number;
  reservedBytes: number;
  budgetBytes: number;
};
type Writable = {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};
type SavePicker = (options: {
  suggestedName: string;
}) => Promise<{ createWritable: () => Promise<Writable> }>;
let previous = () => {};
export async function createDashboard(
  root: HTMLElement,
  dependencies = { fetch: globalThis.fetch.bind(globalThis) },
) {
  previous();
  let active = false,
    disposed = false,
    offline = false;
  let events = new AbortController();
  const cleanups: (() => void)[] = [];
  const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
    root.querySelector<T>(s)!;
  const { toast, destroy: closeToast } = createToast();
  const clear = () => {
    events.abort();
    events = new AbortController();
    while (cleanups.length) cleanups.pop()!();
    closeToast();
    document.body.classList.remove('selecting', 'painting');
    document.title = 'Storagi';
  };
  const destroy = () => {
    disposed = true;
    active = false;
    clear();
  };
  previous = destroy;
  const listen = (
    target: EventTarget,
    name: string,
    fn: (event: any) => void,
  ) => target.addEventListener(name, fn, { signal: events.signal });
  const drawing = typeof ResizeObserver !== 'undefined';
  function pond(
    canvas: string,
    options: ConstructorParameters<typeof KoiPond>[1],
  ) {
    if (!drawing) return;
    const p = new KoiPond($(canvas), options);
    cleanups.push(() => p.destroy());
    return p;
  }
  function mark(canvas: string, still = false) {
    if (!drawing) return;
    const m = new KoiMark($(canvas), { radius: 40, static: still });
    cleanups.push(() => m.destroy());
  }
  function locked(expired = false) {
    active = false;
    clear();
    root.innerHTML = lockedHTML;
    $('.session-expired').hidden = !expired;
    pond('#locked-pond', {
      count: innerWidth < 640 ? 4 : 6,
      size: innerWidth < 640 ? [110, 180] : [150, 240],
      opacity: 0.85,
      flee: 160,
      avoid: () => [relative($('#locked-card'), $('#locked-pond'), 0.55)],
      splashTarget: $('#locked'),
      canSplash: (e) => !(e.target as Element).closest('#locked-card'),
    });
    mark('#locked-mark', true);
  }
  function relative(el: HTMLElement, canvas: HTMLElement, dim: number) {
    const a = el.getBoundingClientRect(),
      b = canvas.getBoundingClientRect();
    return {
      x: a.left - b.left,
      y: a.top - b.top,
      w: a.width,
      h: a.height,
      dim,
    };
  }
  root.innerHTML =
    '<section class="loading" id="loading"><div class="loading-inner" id="loader"><p>Opening your shelf…</p></div></section>';
  const loader = orbitLoader(56);
  $('#loader').prepend(loader);
  cleanups.push(() => loader.destroy());
  let session: {
    authenticated: boolean;
    csrfToken: string;
    name?: string | null;
    picture?: string | null;
  };
  try {
    const response = await dependencies.fetch('/api/session', {
      credentials: 'same-origin',
    });
    if (disposed) return destroy;
    if (response.status === 401 || response.status === 403) {
      locked();
      return destroy;
    }
    if (!response.ok)
      throw new Error(
        'The host may be offline or your session could not be checked.',
      );
    session = await response.json();
    if (!session.authenticated || !session.csrfToken) {
      locked();
      return destroy;
    }
  } catch (error) {
    if (disposed) return destroy;
    $('#loader p').textContent =
      `The host may be offline or your session could not be checked. ${(error as Error).message}`;
    $('#loader').insertAdjacentHTML(
      'beforeend',
      '<button class="btn btn-primary" id="retry-connection">Try again</button>',
    );
    listen(
      $('#retry-connection'),
      'click',
      () => void createDashboard(root, dependencies),
    );
    return destroy;
  }
  clear();
  root.innerHTML = shelfHTML;
  active = true;
  $('#shelf-app').hidden = false;
  const avatar = $('#avatar');
  if (session.name) {
    $('#account-name').textContent = session.name;
    avatar.textContent = [...session.name][0];
  }
  if (session.picture) {
    // Swap in only once loaded, so a failed photo leaves the initial.
    const photo = new Image();
    photo.alt = '';
    photo.onload = () => avatar.replaceChildren(photo);
    photo.src = session.picture;
  }
  const app = $('#shelf-app'),
    sel = new Selection(),
    hidden = new Set<string>();
  let shelf: Shelf = {
      files: [],
      usedBytes: 0,
      reservedBytes: 0,
      budgetBytes: 0,
    },
    sort: Sort = null,
    order: string[] = [],
    emptyMark = false;
  const morph = new Map<
    string,
    {
      state: 'confirm' | 'deleted' | 'deleting';
      op?: ReturnType<typeof deferredDelete>;
      left?: number;
    }
  >();
  // A row counting down to its DELETE or sending it, inline or in a bulk batch: not selectable, and never deleted twice.
  const counting = (id: string) =>
    hidden.has(id) ||
    ['deleted', 'deleting'].includes(morph.get(id)?.state ?? '');
  // Checked live, because `order` (and the DOM) can lag a render behind while a swipe settles.
  const selectable = () => order.filter((id) => !counting(id));
  const pending = new Set<ReturnType<typeof deferredDelete>>(),
    bulkOps = new Map<ReturnType<typeof deferredDelete>, string[]>(),
    downloads = new Set<() => void>();
  cleanups.push(() => {
    for (const op of pending) op.destroy();
    for (const cancel of downloads) cancel();
  });
  // Refreshing or leaving during the grace counts as not undoing: send the DELETEs now, with keepalive so they outlive the page.
  // ponytail: Chromium allows 256 keepalive requests per frame; beyond that the rest are dropped and those copies stay. A bulk-delete endpoint lifts it.
  let leaving = false;
  listen(window, 'pagehide', () => {
    gestures.cancel();
    leaving = true;
    for (const op of [...pending]) op.flush();
    leaving = false;
    closeToast();
  });
  const transfers = createTransferView(root);
  cleanups.push(transfers.destroy);
  const mainPond = pond('#pond', {
    count: innerWidth < 640 ? 2 : 4,
    size: innerWidth < 640 ? [80, 130] : [110, 190],
    font: 11,
    flee: 130,
    avoid: () => [
      relative($('#composer'), $('#pond'), 0.32),
      relative($('.lede'), $('#pond'), 0.1),
      relative($('.search'), $('#pond'), 0.1),
    ],
    splashTarget: $('#pond-zone'),
    canSplash: (e) =>
      !(e.target as Element).closest('#composer, button, a, input'),
  });
  const stillPond = () => {
    if (mainPond) {
      mainPond.still = offline || reduced();
      if (mainPond.still) mainPond.paintStill();
      else mainPond.start();
    }
  };
  cleanups.push(onMotionChange(stillPond));
  const auto = new AutoRefresh(async () => {
    const result: Shelf = await (
      await request('/api/files')
    )
      .json()
      .catch((error) => {
        setOffline(true);
        throw error;
      });
    if (!active) return;
    const known = new Set(shelf.files.map((f) => f.id));
    const hadFiles = shelf.files.length > 0;
    shelf = result;
    renderRetention();
    for (const id of sel.ids)
      if (!shelf.files.some((f) => f.id === id)) sel.ids.delete(id);
    renderInbox();
    renderSelection();
    renderUsage();
    if (hadFiles)
      for (const row of root.querySelectorAll<HTMLElement>('#groups .row'))
        if (!known.has(row.dataset.id!)) row.classList.add('arrived');
  });
  const retry = new OfflineRetry(async () => {
    await auto.now();
    if (auto.error) throw auto.error;
  });
  cleanups.push(() => {
    auto.destroy();
    retry.destroy();
  });
  function setOffline(on: boolean) {
    if (!active) return;
    offline = on;
    app.classList.toggle('is-offline', on);
    $('#offline').hidden = !on;
    document.title = on ? 'Offline · Storagi' : 'Storagi';
    stillPond();
    if (on && !retry.active) retry.start();
    else if (!on) retry.stop();
    renderFresh();
  }
  async function request(
    path: string,
    method = 'GET',
    signal?: AbortSignal,
    body?: object,
  ) {
    let response: Response;
    try {
      response = await dependencies.fetch(path, {
        method,
        credentials: 'same-origin',
        headers:
          method === 'GET'
            ? {}
            : {
                'X-CSRF-Token': session.csrfToken,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
              },
        ...(body ? { body: JSON.stringify(body) } : {}),
        keepalive: leaving,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setOffline(true);
      throw error;
    }
    if (response.status === 401 || response.status === 403) {
      locked(true);
      throw new Error('Your session expired. Sign in again.');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status >= 500) setOffline(true);
      throw Object.assign(
        new Error(
          response.status === 404 || response.status === 410
            ? 'This copy has expired or was removed. Refresh your Inbox.'
            : body.error ||
                'The host could not complete that request. Please try again.',
        ),
        { status: response.status, deleteCount: body.deleteCount },
      );
    }
    setOffline(false);
    return response;
  }
  function renderFresh() {
    if (!active) return;
    const lastGood = auto.last ? clock(auto.last) : '—';
    $('#fresh').classList.toggle('busy', auto.busy);
    $('#fresh').classList.toggle('off', offline && !auto.busy);
    $('#fresh-text').innerHTML = auto.busy
      ? '<span class="fresh-long">Refreshing</span>…'
      : offline
        ? `Offline<span class="fresh-long"> · last good ${lastGood}</span>`
        : `<span class="fresh-long">Updated </span>${lastGood}<span class="fresh-long"> · next in ${auto.remaining}s</span>`;
    $('#last-good').textContent = lastGood;
    $('#retry-in').textContent = retry.busy
      ? 'retrying…'
      : `retrying in ${retry.remaining}s`;
    $('#refresh').setAttribute(
      'aria-label',
      `Refresh now (auto-refresh in ${auto.remaining} seconds)`,
    );
  }
  listen(auto, 'change', renderFresh);
  listen(retry, 'change', renderFresh);
  const visible = () =>
    sortFiles(
      shelf.files.filter(
        (f) =>
          !hidden.has(f.id) &&
          f.name
            .toLocaleLowerCase()
            .includes(
              $<HTMLInputElement>('#search').value.trim().toLocaleLowerCase(),
            ),
      ),
      sort,
    );
  // Rows and day labels in order: if they move, the row under a resting cursor may have changed.
  const listOrder = () =>
    [...$('#groups').querySelectorAll<HTMLElement>('.row, h3')]
      .map((el) => el.dataset.id ?? el.textContent)
      .join('\n');
  function renderInbox() {
    if (!active || gestures?.busy()) return;
    const before = previewId && listOrder();
    const files = visible(),
      all = shelf.files.filter((f) => !hidden.has(f.id));
    order = files.filter((f) => !counting(f.id)).map((f) => f.id);
    const focus = (document.activeElement as HTMLElement)?.dataset.key;
    const names = new Map<string, number>();
    for (const f of shelf.files)
      names.set(f.name, (names.get(f.name) ?? 0) + 1);
    $('#groups').innerHTML = [...groupFiles(files, sort)]
      .map(
        ([day, list]) =>
          `<div class="group${sort ? ' flat' : ''}">${day ? `<h3>${esc(day)}</h3>` : ''}${list.map((f) => row(f, (names.get(f.name) ?? 0) > 1)).join('')}</div>`,
      )
      .join('');
    // If the focused Download or Delete button was replaced by the row's Undo, focus moves to that Undo.
    if (focus) {
      const keyed = Array.from(
        root.querySelectorAll<HTMLElement>('[data-key]'),
      );
      (
        keyed.find((el) => el.dataset.key === focus) ??
        keyed.find((el) => el.dataset.key === focus.replace(/^[dx]-/, 'u-'))
      )?.focus();
    }
    for (const b of root.querySelectorAll<HTMLElement>('.sort')) {
      const on = sort?.key === b.dataset.sort;
      b.classList.toggle('on', on);
      b.querySelector('.dir')!.textContent = on
        ? sort!.dir > 0
          ? '↑'
          : '↓'
        : '';
      const key = b.dataset.sort as SortKey,
        label = sortWords[key][0];
      b.setAttribute(
        'aria-label',
        on
          ? `${label}, sorted ${sortWords[key][sort!.dir > 0 ? 1 : 2]}`
          : `Sort by ${label.toLowerCase()}`,
      );
    }
    $('#sort-clear').hidden = !sort;
    $('.list-head').hidden = !all.length;
    $('#empty').hidden = !!all.length || offline;
    $('#no-match').hidden = !all.length || !!files.length;
    $('#no-match').textContent =
      `No filenames match “${$<HTMLInputElement>('#search').value}”. Press Esc to clear the search.`;
    for (const id of ['nav-files', 'tab-files'])
      $(`#${id}`).textContent = String(all.length);
    if (!all.length && !offline && !emptyMark) {
      mark('#koi-mark');
      emptyMark = true;
    }
    if (previewId && (listOrder() !== before || !previewable(previewId)))
      hidePreview();
    syncRows();
  }
  function row(f: ShelfFile, duplicate: boolean) {
    const id = esc(f.id),
      n = esc(duplicate ? `${f.name} · copy ${shortId(f.id)}` : f.name),
      expired = +new Date(f.expiresAt) <= Date.now(),
      left = daysLeft(f),
      state = morph.get(f.id),
      [base, type] = splitName(f.name);
    const exp = expired ? 'Expired' : `${left} d left`,
      cls = expired ? 'gone' : left <= 3 ? 'soon' : '';
    const actions =
      state?.state === 'confirm'
        ? `<div class="morph"><span class="m-ask">Delete copy?</span><button data-cancel="${id}" data-key="k-${id}">Cancel</button><button class="m-confirm" data-confirm="${id}">Delete</button></div>`
        : state?.state === 'deleting'
          ? '<div class="morph"><span class="m-quiet"><i class="spin"></i>Deleting</span></div>'
          : state?.state === 'deleted'
            ? `<div class="morph"><span class="m-ok">✓ Deleted</span><button data-undo="${id}" data-key="u-${id}">Undo</button><span class="m-clock" data-clock="${id}">${state.left}s</span></div>`
            : `${expired ? '' : `<a class="icon-btn" href="/api/files/${encodeURIComponent(f.id)}/download" download data-dl="${id}" data-key="d-${id}" draggable="false" aria-label="Download ${n}" title="Download">${downIcon}</a>`}<button class="icon-btn" data-del="${id}" data-key="x-${id}" aria-label="Delete ${n}" title="Delete this copy">${trashIcon}</button>`;
    return `<div class="row${counting(f.id) ? ' ghost' : ''}" data-id="${id}"><label class="lead"><input type="checkbox" class="check" data-key="c-${id}" aria-label="Select ${n}"></label><div class="name"><strong${expired || previewPref() === 'off' || !previewKind(f.name) ? ` title="${esc(f.name)}"` : ''}>${esc(base)}</strong>${duplicate ? `<span class="copy">copy ${esc(shortId(f.id))}</span>` : ''}</div><span class="cell type">${esc(type)}</span><span class="cell size">${bytes(f.size)}</span><span class="cell ${cls}">${exp}</span><span class="meta-phone">${type ? `<span>${esc(type)}</span>` : ''}<span class="size">${bytes(f.size)}</span><span class="${cls}">${exp}</span></span><div class="acts${state ? ' engaged' : ''}">${actions}</div></div>`;
  }
  function focusKey(key: string) {
    Array.from(root.querySelectorAll<HTMLElement>('[data-key]'))
      .find((el) => el.dataset.key === key)
      ?.focus();
  }
  function syncRows() {
    for (const row of root.querySelectorAll<HTMLElement>('#groups .row')) {
      const on = sel.ids.has(row.dataset.id!);
      row.classList.toggle('selected', on);
      row.querySelector<HTMLInputElement>('.check')!.checked = on;
    }
    const state = sel.allState(selectable()),
      all = $<HTMLInputElement>('#select-all');
    all.checked = state === 'all';
    all.indeterminate = state === 'some';
    $('#inbox').classList.toggle('selecting', !!sel.ids.size);
  }
  function renderSelection() {
    const files = shelf.files.filter((f) => sel.ids.has(f.id));
    $('#select-bar').classList.toggle('out', !files.length);
    document.body.classList.toggle('selecting', !!files.length);
    const count = $('#sel-count');
    if (count.textContent !== String(files.length)) {
      count.textContent = String(files.length);
      count.classList.remove('bump');
      void count.offsetWidth;
      count.classList.add('bump');
    }
    $('#sel-size').textContent = bytes(files.reduce((n, f) => n + f.size, 0));
    $<HTMLButtonElement>('#sel-download').disabled = files.every(
      (f) => +new Date(f.expiresAt) <= Date.now(),
    );
  }
  function renderUsage() {
    $('#used').textContent = bytes(shelf.usedBytes);
    $('#budget').textContent = bytes(shelf.budgetBytes, 0);
    const meter = $('#meter'),
      n = blockCount(meter),
      ratio = (v: number) =>
        shelf.budgetBytes > 0
          ? Math.min(n, Math.round((v / shelf.budgetBytes) * n))
          : 0;
    const used = ratio(shelf.usedBytes),
      held = Math.min(n - used, ratio(shelf.reservedBytes));
    blocks(meter, [
      [used, 'u'],
      [held, 'r'],
      [n - used - held, 'f'],
    ]);
    meter.setAttribute(
      'aria-label',
      `${bytes(shelf.usedBytes + shelf.reservedBytes)} of ${bytes(shelf.budgetBytes)}, including reserved uploads`,
    );
    $('#reserved').textContent =
      `${bytes(Math.max(0, shelf.budgetBytes - shelf.usedBytes - shelf.reservedBytes))} free${shelf.reservedBytes ? `\n${bytes(shelf.reservedBytes, 0)} reserved for uploads` : ''}`;
    $('#full-shelf').hidden =
      shelf.usedBytes + shelf.reservedBytes < shelf.budgetBytes;
  }
  function deleteFiles(ids: string[], bulk = false) {
    // A row already counting down keeps its own Undo; earlier bulk batches fold into this one, with one fresh grace.
    ids = ids.filter((id) => !counting(id));
    if (!ids.length) {
      if (bulk) sel.clear();
      return;
    }
    if (bulk)
      for (const [old, oldIds] of bulkOps) {
        old.destroy();
        pending.delete(old);
        bulkOps.delete(old);
        ids = [...oldIds, ...ids];
      }
    const restore = () => {
      pending.delete(op);
      bulkOps.delete(op);
      for (const id of ids) {
        hidden.delete(id);
        morph.delete(id);
      }
      if (active) {
        renderInbox();
        renderSelection();
      }
    };
    if (bulk) for (const id of ids) hidden.add(id);
    const op = deferredDelete(
      async () => {
        bulkOps.delete(op);
        if (!active) return;
        let failed: unknown;
        // All at once: only requests started before unload are sent.
        const results = await Promise.allSettled(
          ids.map((id) =>
            request(`/api/files/${encodeURIComponent(id)}`, 'DELETE'),
          ),
        );
        results.forEach((result, i) => {
          if (
            result.status === 'rejected' &&
            ![404, 410].includes((result.reason as { status?: number }).status!)
          )
            failed ??= result.reason;
          else shelf.files = shelf.files.filter((f) => f.id !== ids[i]);
        });
        if (failed) throw failed;
      },
      {
        onTick: (seconds) => {
          for (const id of ids) {
            const state = morph.get(id);
            if (state) state.left = seconds;
            if (state && seconds <= 0 && state.state === 'deleted') {
              state.state = 'deleting';
              renderInbox();
            }
            const c = Array.from(
              root.querySelectorAll<HTMLElement>('[data-clock]'),
            ).find((el) => el.dataset.clock === id);
            if (c) c.textContent = `${seconds}s`;
          }
        },
        onUndo: restore,
        onCommit: () => {
          restore();
          if (active) void auto.now();
        },
        onError: (error) => {
          restore();
          if (active) {
            toast((error as Error).message);
            void auto.now();
          }
        },
      },
    );
    pending.add(op);
    if (!bulk)
      for (const id of ids)
        morph.set(id, { state: 'deleted', left: GRACE_SECONDS, op });
    for (const id of ids) sel.ids.delete(id);
    renderInbox();
    renderSelection();
    if (!bulk) return;
    bulkOps.set(op, ids);
    toast(`${ids.length} ${ids.length === 1 ? 'copy' : 'copies'} deleted`, {
      action: 'Undo',
      onAction: op.undo,
      ms: GRACE_SECONDS * 1000,
      clockFrom: GRACE_SECONDS,
    });
  }
  const gestures = rowGestures(
    $('#groups'),
    sel,
    selectable,
    (id) => morph.has(id),
    (id) => deleteFiles([id]),
    renderInbox,
    events.signal,
  );
  cleanups.push(gestures.destroy);
  // Whatever changed the selection (a drag replaying its starting state, too), a row being deleted never stays in it.
  listen(sel, 'change', () => {
    for (const id of sel.ids) if (counting(id)) sel.ids.delete(id);
    syncRows();
    renderSelection();
  });
  listen($('#groups'), 'click', (e: MouseEvent) => {
    const t = e.target as HTMLElement,
      row = t.closest<HTMLElement>('.row');
    if (!row) return;
    const id = row.dataset.id!,
      f = shelf.files.find((f) => f.id === id)!;
    if (t.closest('.lead')) {
      // Cancelling a click on the box makes the browser restore its old state after syncRows (HTML's legacy-canceled-activation), so only the label's click is cancelled.
      if (counting(id) || !t.matches('.check')) e.preventDefault();
      if (!counting(id)) sel.toggle(id, selectable(), e.shiftKey);
      return;
    }
    const b = t.closest<HTMLElement>(
      '[data-dl],[data-del],[data-cancel],[data-confirm],[data-undo]',
    );
    if (!b) return;
    if (counting(id) && !b.hasAttribute('data-undo')) {
      e.preventDefault();
      return;
    } // a stale button on a row already being deleted
    if (b.hasAttribute('data-dl')) {
      download(e, f);
      return;
    }
    e.preventDefault();
    if (b.hasAttribute('data-del')) {
      morph.set(id, { state: 'confirm' });
      renderInbox();
      focusKey(`k-${id}`);
    } else if (b.hasAttribute('data-cancel')) {
      morph.delete(id);
      renderInbox();
      focusKey(`x-${id}`);
    } else if (b.hasAttribute('data-confirm')) {
      deleteFiles([id]);
      focusKey(`u-${id}`);
    } else {
      morph.get(id)?.op?.undo();
      focusKey(`x-${id}`);
    }
  });
  // Resting the mouse on (or long pressing) an image, video or text row previews it. Images and videos load the server's small re-encoded copy; if that fails, the original once.
  // Browsers sniff <img> and <video> content, so the download URL works despite its octet-stream type.
  const previewBox = $('#hover-preview'),
    previews = new Map<string, HTMLElement>();
  let previewId = '',
    dismissedId = '',
    loading: { id: string; keep: boolean; cancel: () => void } | undefined,
    previewTimer: ReturnType<typeof setTimeout> | undefined,
    skeletonTimer: ReturnType<typeof setTimeout> | undefined,
    pointer = { x: 0, y: 0 },
    press: { x: number; y: number } | undefined;
  // Each video's own 6 s cap, so stopping one video never clears another's.
  const videoCaps = new WeakMap<
    HTMLVideoElement,
    ReturnType<typeof setTimeout>
  >();
  function previewKind(name: string) {
    return /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i.test(name)
      ? 'image'
      : /\.(mp4|m4v|webm|mov)$/i.test(name)
        ? 'video'
        : /\.(txt|md|markdown|log|csv|tsv|json|xml|ya?ml|toml|ini|conf|cfg|sh|py|js|ts|jsx|tsx|css|html?|c|h|cpp|java|go|rs|rb|php|sql)$/i.test(
              name,
            )
          ? 'text'
          : undefined;
  }
  // Checked again on every render and finished load, so a preview never outlives its row.
  const previewable = (id: string) => {
    const f = shelf.files.find((f) => f.id === id);
    return (
      !!f &&
      previewPref() === 'on' &&
      !counting(id) &&
      +new Date(f.expiresAt) > Date.now() &&
      !!previewKind(f.name) &&
      [...$('#groups').querySelectorAll<HTMLElement>('.row')].some(
        (row) => row.dataset.id === id,
      )
    );
  };
  const stopVideo = (video: HTMLVideoElement) => {
    clearTimeout(videoCaps.get(video));
    video.onloadeddata = video.onerror = video.ontimeupdate = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
  // One download at a time: an unfinished load is cancelled when another file is wanted.
  const cancelLoad = () => {
    loading?.cancel();
    loading = undefined;
  };
  const hidePreview = () => {
    clearTimeout(previewTimer);
    clearTimeout(skeletonTimer);
    previewId = '';
    press = undefined;
    previewBox.hidden = true;
    // Videos are not kept: hiding one, shown or still loading, stops it and its download.
    const video = previewBox.querySelector('video');
    if (video) {
      stopVideo(video);
      previewBox.replaceChildren();
    }
    if (loading && !loading.keep) cancelLoad();
  };
  cleanups.push(() => {
    hidePreview();
    cancelLoad();
  });
  // Beside the cursor, flipped to the other side near the window's right or bottom edge, and kept on screen.
  // A finger's preview goes above it when there is room, so the hand does not cover it.
  function place() {
    const w = previewBox.offsetWidth || 320,
      h = previewBox.offsetHeight || 240,
      { x, y } = pointer;
    previewBox.style.left = `${Math.max(8, x + 16 + w > innerWidth ? x - 16 - w : x + 16)}px`;
    previewBox.style.top = `${Math.max(8, Math.min(innerHeight - 8 - h, (press ? y - 16 - h >= 8 : y + 16 + h > innerHeight) ? y - 16 - h : y + 16))}px`;
  }
  function reveal(el: HTMLElement) {
    previewBox.replaceChildren(el);
    previewBox.hidden = false;
    place();
    if (el instanceof HTMLVideoElement) void el.play().catch(() => {});
  }
  function showPreview(id: string) {
    if (previewId !== id || !previewable(id)) return hidePreview();
    if (loading?.id !== id) cancelLoad();
    const ready = previews.get(id);
    if (ready) return reveal(ready);
    if (loading) return;
    const url = `/api/files/${encodeURIComponent(id)}/download`,
      small = `/api/files/${encodeURIComponent(id)}/preview`,
      kind = previewKind(shelf.files.find((f) => f.id === id)!.name),
      load = { id, keep: kind !== 'video', cancel: () => {} };
    loading = load;
    // Only the load still being tracked may finish: a cancelled one can resolve late.
    const done = (el: HTMLElement) => {
      if (loading !== load) return;
      loading = undefined;
      if (el instanceof HTMLVideoElement) {
        if (previewId === id && previewable(id)) reveal(el);
        else stopVideo(el);
        return;
      }
      previews.set(id, el);
      // ponytail: keeps the 20 newest images and text snippets, since downloads are no-store; size it by bytes if memory matters.
      if (previews.size > 20) previews.delete(previews.keys().next().value!);
      if (previewId === id) showPreview(id);
    };
    // A failed load is tried again once the mouse leaves the row and comes back.
    const failed = () => {
      if (loading !== load) return;
      load.cancel();
      loading = undefined;
      if (previewId !== id) return;
      dismissedId = id;
      hidePreview();
    };
    const fallback = (el: HTMLImageElement | HTMLVideoElement) => () => {
      if (el.getAttribute('src') === small) el.src = url;
      else failed();
    };
    if (kind === 'image') {
      const img = new Image();
      img.alt = '';
      img.onload = () => done(img);
      img.onerror = fallback(img);
      load.cancel = () => {
        img.onload = img.onerror = null;
        img.removeAttribute('src');
      };
      img.src = small;
    } else if (kind === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      // Only the first 3 seconds play, over and over; a shorter video loops whole.
      video.loop = true;
      video.ontimeupdate = () => {
        if (video.currentTime >= 3) video.currentTime = 0;
      };
      video.onloadeddata = () => done(video);
      video.onerror = fallback(video);
      load.cancel = () => stopVideo(video);
      video.src = small;
      // Browsers keep downloading ahead of the loop, so the owner capped it: 6 s after the download starts, it stops.
      // A video on show freezes on its current frame; one still loading is dropped without a preview.
      videoCaps.set(
        video,
        setTimeout(() => {
          if (previewBox.contains(video)) {
            const still = document.createElement('canvas');
            still.width = video.videoWidth;
            still.height = video.videoHeight;
            still.getContext('2d')?.drawImage(video, 0, 0);
            previewBox.replaceChildren(still);
          }
          if (loading === load) failed();
          stopVideo(video);
        }, 6000),
      );
    } else {
      const abort = new AbortController();
      load.cancel = () => abort.abort();
      void (async () => {
        try {
          const response = await dependencies.fetch(url, {
            credentials: 'same-origin',
            headers: { Range: 'bytes=0-4095' },
            signal: abort.signal,
          });
          if (!response.ok || !response.body) throw new Error('No preview');
          // Read at most 4 KiB, counted in bytes, even if the server ignored the range and sent the whole file.
          const reader = response.body.getReader(),
            bytes = new Uint8Array(4096);
          let size = 0;
          try {
            while (size < bytes.length) {
              const chunk = await reader.read();
              if (chunk.done) break;
              const part = chunk.value.subarray(0, bytes.length - size);
              bytes.set(part, size);
              size += part.length;
            }
          } finally {
            void reader.cancel().catch(() => {});
          }
          const pre = document.createElement('pre');
          // A character cut at the 4 KiB edge is dropped (stream mode) rather than shown as a replacement mark.
          pre.textContent = new TextDecoder()
            .decode(bytes.subarray(0, size), { stream: true })
            .split('\n')
            .slice(0, 16)
            .join('\n');
          done(pre);
        } catch {
          failed();
        }
      })();
    }
  }
  // A placeholder while a preview loads. A preview already loaded or on show skips it.
  const placeholder = (id: string) => {
    if (previewId !== id || previews.has(id) || !previewBox.hidden) return;
    const skeleton = document.createElement('div');
    skeleton.className = 'preview-skeleton';
    reveal(skeleton);
  };
  // Only the name column previews, the full height of the row (the phone's details line under the name and the row's own padding count), so the rest of the row stays clear for its buttons.
  const nameId = (e: PointerEvent) => {
    const t = e.target as Element,
      row = t.closest<HTMLElement>('.row');
    if (!row) return '';
    if (t.closest('.name, .meta-phone')) return row.dataset.id!;
    const name = row.querySelector('.name')!.getBoundingClientRect();
    return t === row && e.clientX >= name.left && e.clientX <= name.right
      ? row.dataset.id!
      : '';
  };
  // A finger has no hover: holding it still on a name for half a second previews that file until it lifts or moves.
  // Not while a row gesture runs: a touch straight after a tap is a drag to select.
  listen($('#groups'), 'pointerdown', (e: PointerEvent) => {
    hidePreview();
    const id = nameId(e);
    if (e.pointerType !== 'touch' || gestures.busy() || !previewable(id))
      return;
    pointer = press = { x: e.clientX, y: e.clientY };
    previewId = id;
    previewTimer = setTimeout(() => {
      if (gestures.busy()) return hidePreview();
      showPreview(id);
      placeholder(id);
    }, 500);
  });
  listen($('#groups'), 'pointermove', (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 8)
        hidePreview();
      return;
    }
    const id = nameId(e);
    // Escape dismisses the preview until the mouse leaves that name.
    if (id !== dismissedId) dismissedId = '';
    if (
      e.pointerType !== 'mouse' ||
      e.buttons ||
      id === dismissedId ||
      !previewable(id)
    )
      return hidePreview();
    pointer = { x: e.clientX, y: e.clientY };
    place();
    if (previewId === id) return;
    hidePreview();
    previewId = id;
    // A short pause, so sweeping the mouse across the list does not start a download per row.
    previewTimer = setTimeout(() => showPreview(id), 300);
    // A placeholder after 0.2 s, before the load even starts, so the mouse resting there visibly did something.
    skeletonTimer = setTimeout(() => placeholder(id), 200);
  });
  listen($('#groups'), 'pointerleave', () => {
    dismissedId = '';
    hidePreview();
  });
  listen($('#groups'), 'wheel', hidePreview);
  listen(window, 'scroll', hidePreview);
  listen($('.list-head'), 'click', (e: MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-sort]');
    if (b) {
      sort = nextSort(sort, b.dataset.sort as SortKey);
      renderInbox();
    }
  });
  listen($('#sort-clear'), 'click', () => {
    sort = null;
    renderInbox();
    $('.sort').focus();
  });
  listen($('#select-all'), 'click', () => {
    const ids = selectable();
    sel.set(sel.allState(ids) === 'all' ? [] : ids);
  });
  listen($('#search'), 'input', renderInbox);
  listen($('#refresh'), 'click', () => void auto.now());
  listen($('#retry'), 'click', () => void retry.now());
  listen($('#sel-clear'), 'click', () => sel.clear());
  listen($('#sel-delete'), 'click', () => {
    deleteFiles([...sel.ids], true);
    sel.clear();
  });
  listen($('#sel-download'), 'click', () => {
    for (const f of shelf.files.filter(
      (f) => sel.ids.has(f.id) && +new Date(f.expiresAt) > Date.now(),
    ))
      browserDownload(f);
    sel.clear();
    toast('Downloading in your browser. Allow multiple downloads if asked.');
  });
  function browserDownload(f: ShelfFile) {
    const a = document.createElement('a');
    a.href = `/api/files/${encodeURIComponent(f.id)}/download`;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
  }
  function download(event: MouseEvent, f: ShelfFile) {
    const picker = (window as Window & { showSaveFilePicker?: SavePicker })
      .showSaveFilePicker;
    if (!picker) {
      toast('Downloading in your browser');
      return;
    }
    event.preventDefault();
    const handle = picker({ suggestedName: f.name }); // Must run synchronously in the user's click.
    void streamDownload(handle, f);
  }
  async function streamDownload(handle: ReturnType<SavePicker>, f: ShelfFile) {
    const controller = new AbortController();
    let writable: Writable | undefined,
      t: ReturnType<typeof transfers.add> | undefined;
    const cancel = () => {
      controller.abort();
      void writable?.abort().catch(() => {});
      if (t) {
        t.state = 'cancelled';
        transfers.render(t);
      }
    };
    downloads.add(cancel);
    try {
      const file = await handle;
      if (!active) return;
      t = transfers.add(f.name, f.size, 'down');
      t.action = cancel;
      transfers.render(t);
      openTransfers();
      writable = await file.createWritable();
      if (controller.signal.aborted || !active) {
        await writable.abort();
        return;
      }
      const response = await request(
        `/api/files/${encodeURIComponent(f.id)}/download`,
        'GET',
        controller.signal,
      );
      if (!response.body)
        throw new Error('This browser could not stream the download.');
      t.size = Number(response.headers.get('Content-Length')) || f.size;
      t.state = 'downloading';
      t.metrics.progress(0, t.size);
      transfers.render(t);
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read().catch((error) => {
          if (!controller.signal.aborted) setOffline(true);
          throw error;
        });
        if (done) break;
        if (controller.signal.aborted)
          throw new DOMException('Cancelled', 'AbortError');
        await writable.write(value);
        t.sent += value.length;
        t.metrics.progress(t.sent, t.size);
        transfers.render(t);
      }
      if (controller.signal.aborted) return;
      await writable.close();
      t.state = 'done';
      t.sent = t.size;
      transfers.render(t);
    } catch (error) {
      const cancelled = controller.signal.aborted;
      controller.abort();
      await writable?.abort().catch(() => {});
      if (t && !cancelled && active) {
        t.state = 'error';
        t.message = (error as Error).message;
        transfers.render(t);
        toast(t.message);
      } else if ((error as Error).name !== 'AbortError' && active)
        toast((error as Error).message);
    } finally {
      downloads.delete(cancel);
    }
  }
  function view(name: string) {
    hidePreview();
    if (name !== 'settings') closeRetentionMenu();
    app.dataset.view = name;
    const settings = name === 'settings';
    $('#settings').hidden = !settings;
    $('#nav-settings').classList.toggle('is-active', settings);
    $('.nav-item[data-tab="inbox"]').classList.toggle('is-active', !settings);
    $('#page-title').textContent = settings
      ? 'Settings'
      : app.dataset.tab === 'transfers' && innerWidth < 1180
        ? 'Transfers'
        : 'Inbox';
    if (settings && !settingsPond)
      settingsPond = pond('#set-pond', {
        count: 3,
        size: [110, 170],
        font: 10,
        flee: 90,
        pointerTarget: $('#set-pond'),
        splashTarget: $('#set-pond'),
      });
  }
  let settingsPond: KoiPond | undefined;
  const retentionDays = $<HTMLButtonElement>('#retention-days'),
    retentionOptions = $('#retention-options'),
    retentionSave = $<HTMLButtonElement>('#retention-save'),
    retentionDialog = $<HTMLDialogElement>('#retention-confirm');
  const retentionPicker = retentionDays.parentElement!;
  const retentionChoices = Array.from(
    retentionOptions.querySelectorAll<HTMLButtonElement>('button'),
  );
  let retentionDirty = false,
    retentionSaving = false;
  let retentionProposal: { days: number; count: number } | undefined;
  function closeRetention() {
    retentionProposal = undefined;
    if (retentionDialog.open) retentionDialog.close();
    retentionSave.focus();
  }
  function renderRetention() {
    const days = shelf.retentionDays ?? 30;
    $('#retention-copy').textContent =
      `Kept ${days} ${days === 1 ? 'day' : 'days'}. Originals stay on your devices.`;
    if (!retentionDirty) retentionDays.value = String(days);
    $('#retention-value').textContent =
      `${retentionDays.value} ${retentionDays.value === '1' ? 'day' : 'days'}`;
    for (const option of retentionChoices) {
      option.setAttribute(
        'aria-selected',
        String(option.value === retentionDays.value),
      );
      option.disabled = retentionSaving;
    }
    if (retentionSaving) closeRetentionMenu();
    retentionDays.disabled = retentionSaving;
    retentionSave.disabled = retentionSaving;
    retentionSave.setAttribute('aria-busy', String(retentionSaving));
    retentionSave.setAttribute(
      'aria-label',
      retentionSaving ? 'Saving retention…' : 'Save retention',
    );
    retentionSave
      .querySelector('.i')!
      .toggleAttribute('hidden', retentionSaving);
    retentionSave
      .querySelector('.spin')!
      .toggleAttribute('hidden', !retentionSaving);
  }
  function closeRetentionMenu(focus = false) {
    retentionOptions.hidden = true;
    retentionDays.setAttribute('aria-expanded', 'false');
    if (focus) retentionDays.focus();
  }
  function openRetentionMenu() {
    if (retentionDays.disabled) return;
    retentionOptions.hidden = false;
    retentionDays.setAttribute('aria-expanded', 'true');
    positionRetentionMenu();
    retentionChoices
      .find((option) => option.value === retentionDays.value)!
      .focus();
  }
  function positionRetentionMenu() {
    const bounds = retentionDays.getBoundingClientRect(),
      below = Math.max(0, innerHeight - bounds.bottom - 16),
      above = Math.max(0, bounds.top - 16),
      up =
        below < Math.min(retentionOptions.scrollHeight, innerHeight / 2, 300) &&
        above > below;
    retentionOptions.classList.toggle('above', up);
    retentionOptions.style.setProperty(
      '--retention-room',
      `${Math.max(1, up ? above : below)}px`,
    );
  }
  listen(window, 'resize', () => {
    if (!retentionOptions.hidden) positionRetentionMenu();
  });
  listen(window, 'scroll', () => {
    if (!retentionOptions.hidden) positionRetentionMenu();
  });
  listen(retentionDays, 'click', () => {
    if (!retentionOptions.hidden) return closeRetentionMenu();
    openRetentionMenu();
  });
  listen(retentionPicker, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !retentionOptions.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeRetentionMenu(true);
    } else if (e.key === 'Tab' && !retentionOptions.hidden) {
      closeRetentionMenu(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (retentionOptions.hidden) return openRetentionMenu();
      const current = retentionChoices.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const index =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? retentionChoices.length - 1
            : (current +
                (e.key === 'ArrowDown' ? 1 : -1) +
                retentionChoices.length) %
              retentionChoices.length;
      retentionChoices[index].focus();
    }
  });
  for (const option of retentionChoices)
    listen(option, 'click', () => {
      if (retentionSaving) return;
      if (option.value !== retentionDays.value) {
        if (retentionDialog.open) closeRetention();
        retentionProposal = undefined;
        retentionDays.value = option.value;
        retentionDirty = true;
        $('#retention-status').textContent = '';
        renderRetention();
      }
      closeRetentionMenu(true);
    });
  listen(document, 'pointerdown', (e: PointerEvent) => {
    if (!retentionPicker.contains(e.target as Node)) closeRetentionMenu();
  });
  listen(retentionPicker, 'focusout', (e: FocusEvent) => {
    if (e.relatedTarget && !retentionPicker.contains(e.relatedTarget as Node))
      closeRetentionMenu();
  });
  async function saveRetention(days: number, confirmDeletes = 0) {
    if (retentionSaving || retentionDays.disabled) return;
    retentionSaving = true;
    renderRetention();
    $('#retention-status').textContent = '';
    try {
      const result = await (
        await request('/api/settings', 'PUT', undefined, {
          retentionDays: days,
          confirmDeletes,
        })
      ).json();
      if (!active) return;
      shelf.retentionDays = result.retentionDays;
      retentionDirty = false;
      $('#retention-status').textContent = 'Saved for all your devices.';
      await auto.now();
    } catch (error) {
      if (!active) return;
      const conflict = error as Error & {
        status?: number;
        deleteCount?: number;
      };
      if (
        conflict.status === 409 &&
        Number.isSafeInteger(conflict.deleteCount) &&
        conflict.deleteCount! > 0
      ) {
        retentionProposal = { days, count: conflict.deleteCount! };
        $('#retention-title').textContent =
          `Change to ${days} ${days === 1 ? 'day' : 'days'}?`;
        $('#retention-note').textContent =
          `${conflict.deleteCount} ${conflict.deleteCount === 1 ? 'file will' : 'files will'} be permanently deleted. Originals stay on your devices.`;
        retentionDialog.showModal();
        $('#retention-cancel').focus();
      } else $('#retention-status').textContent = conflict.message;
    } finally {
      retentionSaving = false;
      if (active) {
        renderRetention();
        if (!retentionDialog.open && document.activeElement === document.body)
          retentionSave.focus();
      }
    }
  }
  listen($('#retention-form'), 'submit', (e: SubmitEvent) => {
    e.preventDefault();
    void saveRetention(Number(retentionDays.value));
  });
  listen($('#retention-cancel'), 'click', closeRetention);
  listen(retentionDialog, 'cancel', (e: Event) => {
    e.preventDefault();
    closeRetention();
  });
  listen($('#retention-apply'), 'click', () => {
    if (!retentionDialog.open || !retentionProposal) return;
    const { days, count } = retentionProposal;
    closeRetention();
    void saveRetention(days, count);
  });
  function panel(open = app.classList.contains('panel-closed')) {
    app.classList.toggle('panel-closed', !open);
    $('#nav-transfers').classList.toggle('is-active', open);
    $('#nav-transfers').setAttribute('aria-expanded', String(open));
  }
  function tab(name: string) {
    app.dataset.tab = name;
    view('shelf');
    for (const b of root.querySelectorAll<HTMLElement>('.tabs [data-tab]'))
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
  }
  function openTransfers() {
    if (innerWidth >= 1180) {
      view('shelf');
      panel(true);
    } else tab('transfers');
  }
  function closeSheet() {
    if ($('#sheet').hidden) return;
    $('#side').append($('#sheet-slot .nav'), $('#sheet-slot .side-foot'));
    $('#sheet').hidden = true;
    $('#menu-btn').setAttribute('aria-expanded', 'false');
  }
  listen($('#menu-btn'), 'click', () => {
    $('#sheet-slot').append($('#side .nav'), $('#side .side-foot'));
    $('#sheet').hidden = false;
    $('#menu-btn').setAttribute('aria-expanded', 'true');
    $('#sheet-close').focus();
  });
  listen($('#sheet-close'), 'click', () => {
    closeSheet();
    $('#menu-btn').focus();
  });
  listen(root, 'click', (e: MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>(
      'a[data-tab],button[data-tab],a[data-view],button[data-view],.brand',
    );
    if (!b) return;
    e.preventDefault();
    closeSheet();
    if (b.dataset.view) view(b.dataset.view);
    else if (b.dataset.tab === 'transfers' && innerWidth >= 1180) {
      view('shelf');
      panel(b.classList.contains('nav-item') ? undefined : true);
    } else {
      tab(b.dataset.tab ?? 'inbox');
      if (b.classList.contains('brand'))
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  function switches() {
    $('#koi-switch').setAttribute(
      'aria-checked',
      String(motionPref() === 'swim'),
    );
    $('#gesture-switch').setAttribute(
      'aria-checked',
      String(gesturePref() === 'on'),
    );
    $('#preview-switch').setAttribute(
      'aria-checked',
      String(previewPref() === 'on'),
    );
    app.classList.toggle('gestures', gesturePref() === 'on');
  }
  listen($('#koi-switch'), 'click', () => {
    setMotionPref(reduced() ? 'swim' : 'static');
    switches();
  });
  listen($('#preview-switch'), 'click', () => {
    setPreviewPref(previewPref() === 'on' ? 'off' : 'on');
    switches();
    renderInbox();
  });
  listen($('#gesture-switch'), 'click', () => {
    setGesturePref(gesturePref() === 'on' ? 'off' : 'on');
    switches();
  });
  switches();
  const closeSignout = () => {
    $('#signout-pop').hidden = true;
    $('#sign-out').setAttribute('aria-expanded', 'false');
  };
  listen($('#sign-out'), 'click', () => {
    if (!$('#signout-pop').hidden) return closeSignout();
    const count = (dir: string) =>
        transfers.open().filter((t) => t.dir === dir).length,
      up = count('up'),
      down = count('down');
    const parts = [
      up && `${up} upload${up > 1 ? 's' : ''}`,
      down && `${down} download${down > 1 ? 's' : ''}`,
    ].filter(Boolean);
    $('#signout-note').textContent = parts.length
      ? `${parts.join(' and ')} will stop.`
      : 'Your files stay on the shelf.';
    $('#signout-pop').hidden = false;
    $('#sign-out').setAttribute('aria-expanded', 'true');
    $('#signout-cancel').focus();
  });
  listen($('#signout-cancel'), 'click', () => {
    closeSignout();
    $('#sign-out').focus();
  });
  listen($('#signout-confirm'), 'click', async () => {
    try {
      await request('/auth/logout', 'POST');
      if (active) locked();
    } catch (error) {
      if (active) {
        closeSignout();
        toast((error as Error).message);
      }
    }
  });
  listen(document, 'pointerdown', (e: PointerEvent) => {
    if (!(e.target as Element).closest('#signout-pop,#sign-out'))
      closeSignout();
  });
  listen(window, 'keydown', (e: KeyboardEvent) => {
    // The paste confirmation owns the keyboard while it is open.
    if (
      !active ||
      $<HTMLDialogElement>('#paste-confirm').open ||
      retentionDialog.open
    )
      return;
    if (!retentionOptions.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRetentionMenu(true);
      }
      return;
    }
    const typing =
      e.target instanceof Element &&
      (e.target.matches('input,textarea,select,[contenteditable]') ||
        retentionPicker.contains(e.target));
    if (e.key === '/' && !typing) {
      e.preventDefault();
      $('#search').focus();
    } else if (
      e.key.toLowerCase() === 'u' &&
      !typing &&
      !e.ctrlKey &&
      !e.metaKey
    )
      $('#picker').click();
    else if (e.key === 'Escape') {
      if (previewId) dismissedId = previewId;
      hidePreview();
      if (e.target === $('#search') && $<HTMLInputElement>('#search').value)
        $<HTMLInputElement>('#search').value = '';
      else {
        closeSheet();
        closeSignout();
        sel.clear();
        for (const [id, m] of morph)
          if (m.state === 'confirm') morph.delete(id);
      }
      renderInbox();
    } else if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 'a' &&
      !typing
    ) {
      e.preventDefault();
      sel.set(selectable());
    }
  });
  cleanups.push(
    setupTransfers(root, session.csrfToken, {
      refresh: () => auto.now(),
      retentionDays: () => shelf.retentionDays ?? 30,
      notice: (message) => toast(message),
      expired: () => locked(true),
      offline: () => setOffline(true),
      view: transfers,
      queued: (n) => {
        toast(`${n} ${n === 1 ? 'file' : 'files'} queued`, {
          action: 'View',
          onAction: openTransfers,
        });
      },
    }),
  );
  tab('inbox');
  panel(true);
  await auto.now();
  return destroy;
}
const sortWords: Record<SortKey, [string, string, string]> = {
  name: ['Name', 'A to Z', 'Z to A'],
  type: ['Type', 'A to Z', 'Z to A'],
  size: ['Size', 'smallest first', 'largest first'],
  expires: ['Expires', 'soonest first', 'latest first'],
};
const downIcon =
  '<svg class="i" viewBox="0 0 16 16"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>';
const trashIcon =
  '<svg class="i" viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>';
