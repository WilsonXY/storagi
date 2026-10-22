import shelfHTML from './shelf.html?raw';
import lockedHTML from './locked.html?raw';
import { setupTransfers } from './transfers';
import { createTransferView } from './transfer-view';
import { bytes, clock, daysLeft, ext, shortId } from './formatting';
import { AutoRefresh, OfflineRetry } from './refresh';
import { Selection } from './selection';
import { nextSort, groupFiles, sortFiles, type Sort, type SortKey } from './sorting';
import { deferredDelete } from './deferred-delete';
import { motionPref, setMotionPref, reduced, gesturePref, setGesturePref, onMotionChange } from './preferences';
import { KoiPond, KoiMark, orbitLoader } from './koi';
import { esc, blocks, blockCount, createToast } from './ui';
import { rowGestures } from './gestures';
export type ShelfFile = { id: string; name: string; size: number; uploadedAt: string; expiresAt: string };
type Shelf = { files: ShelfFile[]; usedBytes: number; reservedBytes: number; budgetBytes: number };
type Writable = { write: (chunk: Uint8Array) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> };
type SavePicker = (options: { suggestedName: string }) => Promise<{ createWritable: () => Promise<Writable> }>;
let previous = () => {};
export async function createDashboard(root: HTMLElement, dependencies = { fetch: globalThis.fetch.bind(globalThis) }) {
  previous(); let active = false, disposed = false, offline = false;
  let events = new AbortController(); const cleanups: (() => void)[] = [];
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const { toast, destroy: closeToast } = createToast();
  const clear = () => { events.abort(); events = new AbortController(); while (cleanups.length) cleanups.pop()!(); closeToast(); document.body.classList.remove('selecting', 'painting'); document.title = 'Storagi'; };
  const destroy = () => { disposed = true; active = false; clear(); };
  previous = destroy;
  const listen = (target: EventTarget, name: string, fn: (event: any) => void) => target.addEventListener(name, fn, { signal: events.signal });
  const drawing = typeof ResizeObserver !== 'undefined';
  function pond(canvas: string, options: ConstructorParameters<typeof KoiPond>[1]) {
    if (!drawing) return;
    const p = new KoiPond($(canvas), options); cleanups.push(() => p.destroy()); return p;
  }
  function mark(canvas: string, still = false) {
    if (!drawing) return;
    const m = new KoiMark($(canvas), { radius: 40, static: still }); cleanups.push(() => m.destroy());
  }
  function locked(expired = false) {
    active = false; clear(); root.innerHTML = lockedHTML;
    $('.session-expired').hidden = !expired;
    pond('#locked-pond', { count: innerWidth < 640 ? 4 : 6, size: innerWidth < 640 ? [110, 180] : [150, 240], opacity: .85, flee: 160, avoid: () => [relative($('#locked-card'), $('#locked-pond'), .55)], splashTarget: $('#locked'), canSplash: e => !(e.target as Element).closest('#locked-card') });
    mark('#locked-mark', true);
  }
  function relative(el: HTMLElement, canvas: HTMLElement, dim: number) { const a = el.getBoundingClientRect(), b = canvas.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, dim }; }
  root.innerHTML = '<section class="loading" id="loading"><div class="loading-inner" id="loader"><p>Opening your shelf…</p></div></section>';
  const loader = orbitLoader(56); $('#loader').prepend(loader); cleanups.push(() => loader.destroy());
  let session: { authenticated: boolean; csrfToken: string };
  try {
    const response = await dependencies.fetch('/api/session', { credentials: 'same-origin' });
    if (disposed) return destroy;
    if (response.status === 401 || response.status === 403) { locked(); return destroy; }
    if (!response.ok) throw new Error('The host may be offline or your session could not be checked.');
    session = await response.json();
    if (!session.authenticated || !session.csrfToken) { locked(); return destroy; }
  } catch (error) {
    if (disposed) return destroy;
    $('#loader p').textContent = `The host may be offline or your session could not be checked. ${(error as Error).message}`;
    $('#loader').insertAdjacentHTML('beforeend', '<button class="btn btn-primary" id="retry-connection">Try again</button>');
    listen($('#retry-connection'), 'click', () => void createDashboard(root, dependencies)); return destroy;
  }
  clear(); root.innerHTML = shelfHTML; active = true; $('#shelf-app').hidden = false;
  const app = $('#shelf-app'), sel = new Selection(), hidden = new Set<string>();
  let shelf: Shelf = { files: [], usedBytes: 0, reservedBytes: 0, budgetBytes: 0 }, sort: Sort = null, order: string[] = [], emptyMark = false;
  const morph = new Map<string, { state: 'confirm' | 'deleted'; op?: ReturnType<typeof deferredDelete>; left?: number }>();
  const transfers = createTransferView(root); cleanups.push(transfers.destroy);
  const mainPond = pond('#pond', { count: innerWidth < 640 ? 2 : 4, size: innerWidth < 640 ? [80, 130] : [110, 190], font: 11, flee: 130,
    avoid: () => [relative($('#composer'), $('#pond'), .32), relative($('.lede'), $('#pond'), .1), relative($('.search'), $('#pond'), .1)], splashTarget: $('#pond-zone'), canSplash: e => !(e.target as Element).closest('#composer, button, a, input') });
  const stillPond = () => { if (mainPond) { mainPond.still = offline || reduced(); if (mainPond.still) mainPond.paintStill(); else mainPond.start(); } };
  cleanups.push(onMotionChange(stillPond));
  const auto = new AutoRefresh(async () => {
    const result: Shelf = await (await request('/api/files')).json(); if (!active) return;
    const known = new Set(shelf.files.map(f => f.id)); const hadFiles = shelf.files.length > 0;
    shelf = result; for (const id of sel.ids) if (!shelf.files.some(f => f.id === id)) sel.ids.delete(id);
    renderInbox(); renderSelection(); renderUsage();
    if (hadFiles) for (const row of root.querySelectorAll<HTMLElement>('#groups .row')) if (!known.has(row.dataset.id!)) row.classList.add('arrived');
  });
  const retry = new OfflineRetry(async () => { await auto.now(); if (auto.error) throw auto.error; });
  cleanups.push(() => { auto.destroy(); retry.destroy(); });
  function setOffline(on: boolean) {
    if (!active) return; offline = on; app.classList.toggle('is-offline', on); $('#offline').hidden = !on;
    document.title = on ? 'Offline · Storagi' : 'Storagi'; stillPond();
    if (on && !retry.active) retry.start(); else if (!on) retry.stop(); renderFresh();
  }
  async function request(path: string, method = 'GET', signal?: AbortSignal) {
    let response: Response;
    try { response = await dependencies.fetch(path, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'X-CSRF-Token': session.csrfToken }, ...(signal ? { signal } : {}) }); }
    catch (error) { if ((error as Error).name !== 'AbortError') setOffline(true); throw error; }
    if (response.status === 401 || response.status === 403) { locked(true); throw new Error('Your session expired. Sign in again.'); }
    if (!response.ok) {
      const body = await response.json().catch(() => ({})); if (response.status >= 500) setOffline(true);
      throw new Error(body.error || (response.status === 404 || response.status === 410 ? 'This copy has expired or was removed. Refresh your Inbox.' : 'The host could not complete that request. Please try again.'));
    }
    setOffline(false); return response;
  }
  function renderFresh() {
    if (!active) return;
    $('#fresh').classList.toggle('busy', auto.busy); $('#fresh').classList.toggle('off', offline && !auto.busy);
    $('#fresh-text').innerHTML = auto.busy ? '<span class="fresh-long">Refreshing</span>…' : offline ? `Offline<span class="fresh-long"> · last good ${clock(auto.last)}</span>` : `<span class="fresh-long">Updated </span>${clock(auto.last)}<span class="fresh-long"> · next in ${auto.remaining}s</span>`;
    $('#last-good').textContent = clock(auto.last); $('#retry-in').textContent = retry.busy ? 'retrying…' : `retrying in ${retry.remaining}s`;
    $('#refresh').setAttribute('aria-label', `Refresh now (auto-refresh in ${auto.remaining} seconds)`);
  }
  listen(auto, 'change', renderFresh); listen(retry, 'change', renderFresh);
  const visible = () => sortFiles(shelf.files.filter(f => !hidden.has(f.id) && f.name.toLocaleLowerCase().includes($<HTMLInputElement>('#search').value.trim().toLocaleLowerCase())), sort);
  function renderInbox() {
    if (!active || gestures?.busy()) return;
    const files = visible(), all = shelf.files.filter(f => !hidden.has(f.id)); order = files.map(f => f.id);
    const focus = (document.activeElement as HTMLElement)?.dataset.key;
    const names = new Map<string, number>(); for (const f of shelf.files) names.set(f.name, (names.get(f.name) ?? 0) + 1);
    $('#groups').innerHTML = [...groupFiles(files, sort)].map(([day, list]) => `<div class="group${sort ? ' flat' : ''}">${day ? `<h3>${esc(day)}</h3>` : ''}${list.map(f => row(f, (names.get(f.name) ?? 0) > 1)).join('')}</div>`).join('');
    if (focus) Array.from(root.querySelectorAll<HTMLElement>('[data-key]')).find(el => el.dataset.key === focus)?.focus();
    for (const b of root.querySelectorAll<HTMLElement>('.sort')) {
      const on = sort?.key === b.dataset.sort; b.classList.toggle('on', on); b.querySelector('.dir')!.textContent = on ? sort!.dir > 0 ? '↑' : '↓' : '';
      b.setAttribute('aria-label', on ? `${b.dataset.sort}, sorted ${sort!.dir > 0 ? 'ascending' : 'descending'}` : `Sort by ${b.dataset.sort}`);
    }
    $('#sort-clear').hidden = !sort; $('.list-head').hidden = !all.length;
    $('#empty').hidden = !!all.length || offline; $('#no-match').hidden = !all.length || !!files.length;
    $('#no-match').textContent = `No filenames match “${$<HTMLInputElement>('#search').value}”. Press Esc to clear the search.`;
    for (const id of ['nav-files', 'tab-files']) $(`#${id}`).textContent = String(all.length);
    if (!all.length && !offline && !emptyMark) { mark('#koi-mark'); emptyMark = true; }
    syncRows();
  }
  function row(f: ShelfFile, duplicate: boolean) {
    const id = esc(f.id), n = esc(f.name), expired = +new Date(f.expiresAt) <= Date.now(), left = daysLeft(f), state = morph.get(f.id);
    const exp = expired ? 'Expired' : `${left} d left`, cls = expired ? 'gone' : left <= 3 ? 'soon' : '';
    const actions = state?.state === 'confirm' ? `<div class="morph"><span class="m-ask">Delete copy?</span><button data-cancel="${id}" data-key="k-${id}">Cancel</button><button class="m-confirm" data-confirm="${id}">Delete</button></div>` : state?.state === 'deleted' ? `<div class="morph"><span class="m-ok">✓ Deleted</span><button data-undo="${id}" data-key="u-${id}">Undo</button><span class="m-clock" data-clock="${id}">${state.left}s</span></div>` : `${expired ? '' : `<a class="icon-btn" href="/api/files/${encodeURIComponent(f.id)}/download" download data-dl="${id}" data-key="d-${id}" draggable="false" aria-label="Download ${n}" title="Download">${downIcon}</a>`}<button class="icon-btn" data-del="${id}" data-key="x-${id}" aria-label="Delete ${n}" title="Delete this copy">${trashIcon}</button>`;
    return `<div class="row${state?.state === 'deleted' ? ' ghost' : ''}" data-id="${id}"><label class="lead"><span class="ext">${esc(ext(f.name))}</span><input type="checkbox" class="check" data-key="c-${id}" aria-label="Select ${n}"></label><div class="name"><strong title="${n}">${n}</strong>${duplicate ? `<span class="copy">copy ${esc(shortId(f.id))}</span>` : ''}</div><span class="cell size">${bytes(f.size)}</span><span class="cell ${cls}">${exp}</span><span class="meta-phone"><span class="size">${bytes(f.size)}</span><span class="${cls}">${exp}</span></span><div class="acts${state ? ' engaged' : ''}">${actions}</div></div>`;
  }
  function focusKey(key: string) { Array.from(root.querySelectorAll<HTMLElement>('[data-key]')).find(el => el.dataset.key === key)?.focus(); }
  function syncRows() {
    for (const row of root.querySelectorAll<HTMLElement>('#groups .row')) { const on = sel.ids.has(row.dataset.id!); row.classList.toggle('selected', on); row.querySelector<HTMLInputElement>('.check')!.checked = on; }
    const state = sel.allState(order), all = $<HTMLInputElement>('#select-all'); all.checked = state === 'all'; all.indeterminate = state === 'some'; $('#inbox').classList.toggle('selecting', !!sel.ids.size);
  }
  function renderSelection() {
    const files = shelf.files.filter(f => sel.ids.has(f.id)); $('#select-bar').classList.toggle('out', !files.length); document.body.classList.toggle('selecting', !!files.length);
    $('#sel-count').textContent = String(files.length); $('#sel-size').textContent = bytes(files.reduce((n, f) => n + f.size, 0)); $<HTMLButtonElement>('#sel-download').disabled = files.every(f => +new Date(f.expiresAt) <= Date.now());
  }
  function renderUsage() {
    $('#used').textContent = bytes(shelf.usedBytes); $('#budget').textContent = bytes(shelf.budgetBytes);
    const meter = $('#meter'), n = blockCount(meter), ratio = (v: number) => shelf.budgetBytes > 0 ? Math.min(n, Math.round(v / shelf.budgetBytes * n)) : 0;
    const used = ratio(shelf.usedBytes), held = Math.min(n - used, ratio(shelf.reservedBytes)); blocks(meter, [[used, 'u'], [held, 'r'], [n - used - held, 'f']]);
    meter.setAttribute('aria-label', `${bytes(shelf.usedBytes + shelf.reservedBytes)} of ${bytes(shelf.budgetBytes)}, including reserved uploads`);
    $('#reserved').textContent = `${bytes(Math.max(0, shelf.budgetBytes - shelf.usedBytes - shelf.reservedBytes))} free${shelf.reservedBytes ? `\n${bytes(shelf.reservedBytes, 0)} reserved for uploads` : ''}`;
    $('#full-shelf').hidden = shelf.usedBytes + shelf.reservedBytes < shelf.budgetBytes;
  }
  function deleteFiles(ids: string[], bulk = false) {
    const restore = () => { for (const id of ids) { hidden.delete(id); morph.delete(id); } if (active) { renderInbox(); renderSelection(); } };
    if (bulk) for (const id of ids) hidden.add(id);
    const op = deferredDelete(async () => { for (const id of ids) { if (!active) return; await request(`/api/files/${encodeURIComponent(id)}`, 'DELETE'); shelf.files = shelf.files.filter(f => f.id !== id); } }, {
      onTick: seconds => { for (const id of ids) { const state = morph.get(id); if (state) state.left = seconds; const c = Array.from(root.querySelectorAll<HTMLElement>('[data-clock]')).find(el => el.dataset.clock === id); if (c) c.textContent = `${seconds}s`; } },
      onUndo: restore, onCommit: () => { restore(); if (active) void auto.now(); }, onError: error => { restore(); if (active) toast((error as Error).message); },
    });
    cleanups.push(op.destroy);
    if (!bulk) for (const id of ids) morph.set(id, { state: 'deleted', left: 6, op });
    for (const id of ids) sel.ids.delete(id); renderInbox(); renderSelection();
    if (bulk) toast(`${ids.length} copies deleted`, { action: 'Undo', onAction: op.undo, ms: 6000, clockFrom: 6 });
  }
  let gestures: ReturnType<typeof rowGestures> | undefined;
  gestures = rowGestures($('#groups'), sel, () => order, id => morph.has(id), id => deleteFiles([id]), renderInbox, events.signal); cleanups.push(gestures.destroy);
  listen(sel, 'change', () => { syncRows(); renderSelection(); });
  listen($('#groups'), 'click', (e: MouseEvent) => {
    const t = e.target as HTMLElement, row = t.closest<HTMLElement>('.row'); if (!row) return;
    const id = row.dataset.id!, f = shelf.files.find(f => f.id === id)!;
    if (t.closest('.lead')) { e.preventDefault(); sel.toggle(id, order, e.shiftKey); queueMicrotask(() => { if (active) syncRows(); }); return; }
    const b = t.closest<HTMLElement>('[data-dl],[data-del],[data-cancel],[data-confirm],[data-undo]'); if (!b) return;
    if (b.hasAttribute('data-dl')) { download(e, f); return; } e.preventDefault();
    if (b.hasAttribute('data-del')) { morph.set(id, { state: 'confirm' }); renderInbox(); focusKey(`k-${id}`); }
    else if (b.hasAttribute('data-cancel')) { morph.delete(id); renderInbox(); focusKey(`x-${id}`); }
    else if (b.hasAttribute('data-confirm')) { deleteFiles([id]); focusKey(`u-${id}`); }
    else { morph.get(id)?.op?.undo(); focusKey(`x-${id}`); }
  });
  listen($('.list-head'), 'click', (e: MouseEvent) => { const b = (e.target as Element).closest<HTMLElement>('[data-sort]'); if (b) { sort = nextSort(sort, b.dataset.sort as SortKey); renderInbox(); } });
  listen($('#sort-clear'), 'click', () => { sort = null; renderInbox(); $('.sort').focus(); });
  listen($('#select-all'), 'click', () => { sel.set(sel.allState(order) === 'all' ? [] : order); });
  listen($('#search'), 'input', renderInbox); listen($('#refresh'), 'click', () => void auto.now()); listen($('#retry'), 'click', () => void retry.now());
  listen($('#sel-clear'), 'click', () => sel.clear()); listen($('#sel-delete'), 'click', () => { deleteFiles([...sel.ids], true); sel.clear(); });
  listen($('#sel-download'), 'click', () => { for (const f of shelf.files.filter(f => sel.ids.has(f.id) && +new Date(f.expiresAt) > Date.now())) browserDownload(f); sel.clear(); toast('Downloading in your browser. Allow multiple downloads if asked.'); });
  function browserDownload(f: ShelfFile) { const a = document.createElement('a'); a.href = `/api/files/${encodeURIComponent(f.id)}/download`; a.download = f.name; document.body.append(a); a.click(); a.remove(); }
  function download(event: MouseEvent, f: ShelfFile) {
    const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    if (!picker || innerWidth <= 640) { toast('Downloading in your browser'); return; }
    event.preventDefault(); const handle = picker({ suggestedName: f.name }); // Must run synchronously in the user's click.
    void streamDownload(handle, f);
  }
  async function streamDownload(handle: ReturnType<SavePicker>, f: ShelfFile) {
    const controller = new AbortController(); let writable: Writable | undefined, t: ReturnType<typeof transfers.add> | undefined;
    const cancel = () => { controller.abort(); void writable?.abort().catch(() => {}); if (t) { t.state = 'cancelled'; transfers.render(t); } };
    cleanups.push(cancel);
    try {
      const file = await handle; if (!active) return;
      t = transfers.add(f.name, f.size, 'down'); t.action = cancel; transfers.render(t); openTransfers();
      writable = await file.createWritable(); if (controller.signal.aborted || !active) { await writable.abort(); return; }
      const response = await request(`/api/files/${encodeURIComponent(f.id)}/download`, 'GET', controller.signal);
      if (!response.body) throw new Error('This browser could not stream the download.');
      t.size = Number(response.headers.get('Content-Length')) || f.size; t.state = 'downloading'; t.metrics.progress(0, t.size); transfers.render(t);
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        await writable.write(value); t.sent += value.length; t.metrics.progress(t.sent, t.size); transfers.render(t);
      }
      if (controller.signal.aborted) return;
      await writable.close(); t.state = 'done'; t.sent = t.size; transfers.render(t);
    } catch (error) {
      await writable?.abort().catch(() => {});
      if (t && !controller.signal.aborted && active) { t.state = 'error'; t.message = (error as Error).message; transfers.render(t); toast(t.message); }
      else if ((error as Error).name !== 'AbortError' && active) toast((error as Error).message);
    }
  }
  function view(name: string) {
    app.dataset.view = name; const settings = name === 'settings'; $('#settings').hidden = !settings;
    $('#nav-settings').classList.toggle('is-active', settings); $('.nav-item[data-tab="inbox"]').classList.toggle('is-active', !settings);
    $('#page-title').textContent = settings ? 'Settings' : app.dataset.tab === 'transfers' && innerWidth < 1180 ? 'Transfers' : 'Inbox';
    if (settings && !settingsPond) settingsPond = pond('#set-pond', { count: 3, size: [110, 170], font: 10, flee: 90, pointerTarget: $('#set-pond'), splashTarget: $('#set-pond') });
  }
  let settingsPond: KoiPond | undefined;
  function panel(open = app.classList.contains('panel-closed')) { app.classList.toggle('panel-closed', !open); $('#nav-transfers').classList.toggle('is-active', open); $('#nav-transfers').setAttribute('aria-expanded', String(open)); }
  function tab(name: string) { app.dataset.tab = name; view('shelf'); for (const b of root.querySelectorAll<HTMLElement>('.tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === name)); }
  function openTransfers() { if (innerWidth >= 1180) { view('shelf'); panel(true); } else tab('transfers'); }
  function closeSheet() { if ($('#sheet').hidden) return; $('#side').append($('#sheet-slot .nav'), $('#sheet-slot .side-foot')); $('#sheet').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  listen($('#menu-btn'), 'click', () => { $('#sheet-slot').append($('#side .nav'), $('#side .side-foot')); $('#sheet').hidden = false; $('#menu-btn').setAttribute('aria-expanded', 'true'); $('#sheet-close').focus(); });
  listen($('#sheet-close'), 'click', () => { closeSheet(); $('#menu-btn').focus(); });
  listen(root, 'click', (e: MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>('a[data-tab],button[data-tab],a[data-view],button[data-view],.brand'); if (!b) return;
    e.preventDefault(); closeSheet();
    if (b.dataset.view) view(b.dataset.view);
    else if (b.dataset.tab === 'transfers' && innerWidth >= 1180) { view('shelf'); panel(b.classList.contains('nav-item') ? undefined : true); }
    else { tab(b.dataset.tab ?? 'inbox'); if (b.classList.contains('brand')) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  function switches(saved = '') {
    $('#koi-switch').setAttribute('aria-checked', String(motionPref() === 'swim')); $('#gesture-switch').setAttribute('aria-checked', String(gesturePref() === 'on')); app.classList.toggle('gestures', gesturePref() === 'on');
    if (saved) $(`#${saved}-saved`).textContent = 'Saved';
  }
  listen($('#koi-switch'), 'click', () => { setMotionPref(reduced() ? 'swim' : 'static'); switches('koi'); });
  listen($('#gesture-switch'), 'click', () => { setGesturePref(gesturePref() === 'on' ? 'off' : 'on'); switches('gesture'); }); switches();
  const closeSignout = () => { $('#signout-pop').hidden = true; $('#sign-out').setAttribute('aria-expanded', 'false'); };
  listen($('#sign-out'), 'click', () => { if (!$('#signout-pop').hidden) return closeSignout(); $('#signout-note').textContent = transfers.open().length ? `${transfers.open().length} transfers will stop.` : 'Your files stay on the shelf.'; $('#signout-pop').hidden = false; $('#sign-out').setAttribute('aria-expanded', 'true'); $('#signout-cancel').focus(); });
  listen($('#signout-cancel'), 'click', () => { closeSignout(); $('#sign-out').focus(); });
  listen($('#signout-confirm'), 'click', async () => { try { await request('/auth/logout', 'POST'); if (active) locked(); } catch (error) { if (active) { closeSignout(); toast((error as Error).message); } } });
  listen(document, 'pointerdown', (e: PointerEvent) => { if (!(e.target as Element).closest('#signout-pop,#sign-out')) closeSignout(); });
  listen(window, 'keydown', (e: KeyboardEvent) => {
    if (!active) return; const typing = e.target instanceof Element && e.target.matches('input,textarea,[contenteditable]');
    if (e.key === '/' && !typing) { e.preventDefault(); $('#search').focus(); }
    else if (e.key.toLowerCase() === 'u' && !typing && !e.ctrlKey && !e.metaKey) $('#picker').click();
    else if (e.key === 'Escape') { if (e.target === $('#search') && $<HTMLInputElement>('#search').value) $<HTMLInputElement>('#search').value = ''; else { closeSheet(); closeSignout(); sel.clear(); for (const [id, m] of morph) if (m.state === 'confirm') morph.delete(id); } renderInbox(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !typing) { e.preventDefault(); sel.set(order); }
  });
  cleanups.push(setupTransfers(root, session.csrfToken, { refresh: () => auto.now(), notice: message => toast(message), expired: () => locked(true), offline: () => setOffline(true), view: transfers, queued: () => { toast('Files queued', { action: 'View', onAction: openTransfers }); } }));
  listen(window, 'pagehide', destroy); tab('inbox'); panel(true); await auto.now(); return destroy;
}
const downIcon = '<svg class="i" viewBox="0 0 16 16"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>';
const trashIcon = '<svg class="i" viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>';
