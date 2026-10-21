// Variant B — Ledger. Keyboard-first: j/k move, x select (shift-x range), d download, # delete, / search,
// r refresh, u upload, t transfers, ? shortcuts. ASCII lives in the data: expiry countdowns, tick bars,
// the status line and its throughput history.
import { NOW, BUDGET, bytes, rate, duration, finishAt, clock, ext, shortId, ago, usage, ticks, Transfers, AutoRefresh, createHost, Selection, deferredDelete, toast, esc } from '../shared/storagi.js';
import { KoiPond, KoiMark, orbitLoader, blocks } from '../shared/koi.js';

const GiB = 1024 ** 3, MiB = 1024 ** 2, HOUR = 3_600_000, DAY = 86_400_000;
const app = document.getElementById('app');
const picker = document.getElementById('picker');
const phone = () => matchMedia('(max-width: 640px)').matches;

let S; // everything belonging to the current state; replaced on every state switch
let gen = 0;

// ---------- helpers ----------
const kind = name => (/\.(mp4|mov|mkv|webm)$/i.test(name) ? 'video' : /\.(zip|tar\.zst|zst|7z|rar|tar|gz)$/i.test(name) ? 'archive' : 'other');
const typeOf = name => (/\.tar\.zst$/i.test(name) ? 'tar.zst' : ext(name));
const hoursLeft = f => (f.expiresAt - NOW) / HOUR;
const soon = f => hoursLeft(f) > 0 && hoursLeft(f) <= 72;
const expired = f => hoursLeft(f) <= 0;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const gib = v => (v / GiB).toFixed(1);
function left(f) {
  const h = hoursLeft(f);
  if (h <= 0) return 'expired';
  if (h < 1) return `${Math.ceil(h * 60)}m`;
  if (h < 24) return `${Math.ceil(h)}h`;
  return `${Math.ceil(h / 24)}d`;
}
function xbar(f, cells) {
  if (!cells) return '';
  const on = expired(f) ? 0 : Math.min(cells, Math.ceil(hoursLeft(f) / 24 / (30 / cells)));
  return `<span class="xbar${soon(f) ? ' soon' : ''}" aria-hidden="true"><span class="on">${'▮'.repeat(on)}</span><span class="off">${'▯'.repeat(cells - on)}</span></span>`;
}
const barCells = () => (innerWidth > 1180 ? 30 : innerWidth > 640 ? 10 : 0); // tablet: one cell per 3 days

// ---------- state machine ----------
function setState(name) {
  gen++;
  if (S) { clearInterval(S.transfers?._t); clearInterval(S.refresh?._t); clearInterval(S.histTimer); S.pond && (S.pond.dead = true); }
  document.querySelectorAll('.proto [data-state]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === name)));
  document.querySelector('.select-bar')?.remove(); document.querySelector('.toast')?.remove();
  S = { name, gen };
  if (name === 'locked') return renderLocked();
  renderShell();
  if (name === 'loading') return renderLoading();
  if (name === 'offline') return renderOffline();
  startShelf(name === 'empty');
}
document.querySelectorAll('.proto [data-state]').forEach(b => b.addEventListener('click', () => setState(b.dataset.state)));

// ---------- locked ----------
function renderLocked() {
  app.innerHTML = `<main class="locked">
    <canvas class="pond" aria-hidden="true"></canvas>
    <section class="card" aria-labelledby="lock-title">
      <div class="prompt"><img src="../shared/brand/favicon.svg" alt="" width="24" height="24"><span>storagi open --owner <span class="caret"></span></span></div>
      <h1 id="lock-title">Your shelf is locked.</h1>
      <p>Only the owner's Google account opens this shelf. Unfinished uploads resume after you sign in and reselect the file.</p>
      <a class="btn btn-primary" href="#" id="google"><span class="g">G</span> Continue with Google</a>
      <div class="meta"><span>200 GiB shelf</span><span>copies expire after 30 days</span></div>
    </section></main>`;
  const card = app.querySelector('.card');
  const pond = new KoiPond(app.querySelector('.pond'), { count: 3, size: [180, 280], font: 11, avoid: () => { const r = card.getBoundingClientRect(); return [{ x: r.left, y: r.top, w: r.width, h: r.height, dim: 0.12 }]; } });
  S.pond = pond;
  app.querySelector('#google').addEventListener('click', e => { e.preventDefault(); setState('loading'); setTimeout(() => S.name === 'loading' && setState('shelf'), 1100); });
}

// ---------- shell ----------
function renderShell() {
  app.innerHTML = `<div class="shell">
    <nav class="rail" aria-label="Storagi">
      <img class="mark" src="../shared/brand/favicon.svg" alt="Storagi" width="32" height="32">
      <a href="#" aria-current="page" title="Shelf">≡<span class="tip">Shelf</span></a>
      <button type="button" id="rail-xfer" aria-pressed="false">⇅<span class="badge" id="rail-badge"></span><span class="tip">Transfers · t</span></button>
      <button type="button" id="rail-up">↥<span class="tip">Upload · u</span></button>
      <span class="spacer"></span>
      <button type="button" id="rail-keys">?<span class="tip">Shortcuts · ?</span></button>
      <button type="button" id="rail-out">⎋<span class="tip">Sign out</span></button>
    </nav>
    <main class="canvas" id="canvas">
      <div class="title-row">
        <div><div class="h1-row"><h1>Shelf</h1><span class="scope">owner · storagi</span></div><p class="finding" id="finding">&nbsp;</p></div>
        <div class="tools">
          <label class="search"><span aria-hidden="true">/</span><input type="search" id="q" placeholder="Search filenames" aria-label="Search filenames" autocomplete="off"></label>
          <button type="button" class="btn btn-primary" id="upload">Upload <span class="kbd" style="box-shadow:none;color:#555">u</span></button>
        </div>
      </div>
      <div class="tabs" role="tablist" id="tabs"></div>
      <table class="ledger" aria-label="Files, newest first">
        <colgroup><col class="c-check"><col class="c-name"><col class="c-type"><col class="c-size"><col class="c-added"><col class="c-exp"><col class="c-act"></colgroup>
        <thead><tr><th class="c-check"><input type="checkbox" class="check" id="all" aria-label="Select all"></th><th class="c-name">Name</th><th class="c-type">Type</th><th class="c-size r">Size</th><th class="c-added">Added</th><th class="c-exp">Expires</th><th class="c-act"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
      <div class="list-foot" id="foot"></div>
    </main>
  </div>
  <section class="drawer closed" id="drawer" aria-label="Transfers">
    <div class="drawer-head"><h2>Transfers <span class="num" id="xcount"></span></h2><div class="right"><button class="btn btn-ghost" id="clear-done" type="button">Clear finished</button><button class="btn btn-ghost" id="close-drawer" type="button">Hide <span class="kbd">t</span></button></div></div>
    <ul class="xfers" id="xfers"></ul>
  </section>
  <footer class="status" id="status" aria-live="off"></footer>
  <nav class="tabbar" aria-label="Storagi">
    <button type="button" aria-current="page"><span class="g">≡</span>Shelf</button>
    <button type="button" id="tb-xfer" aria-pressed="false"><span class="g">⇅</span>Transfers<span class="badge" id="tb-badge"></span></button>
    <button type="button" id="tb-up"><span class="g">↥</span>Upload</button>
    <button type="button" id="tb-keys"><span class="g">⎋</span>Sign out</button>
  </nav>`;
  const railMark = app.querySelector('.rail .mark');
  const drawer = app.querySelector('#drawer');
  const toggleDrawer = open => {
    open = open ?? drawer.classList.contains('closed');
    drawer.classList.toggle('closed', !open);
    for (const id of ['#rail-xfer', '#tb-xfer']) app.querySelector(id).setAttribute('aria-pressed', String(open));
    syncDock();
  };
  S.toggleDrawer = toggleDrawer;
  app.querySelector('#rail-xfer').onclick = () => toggleDrawer();
  app.querySelector('#tb-xfer').onclick = () => toggleDrawer();
  app.querySelector('#close-drawer').onclick = () => toggleDrawer(false);
  app.querySelector('#clear-done').onclick = () => S.transfers?.clearDone();
  for (const id of ['#rail-up', '#tb-up', '#upload']) app.querySelector(id).onclick = () => picker.click();
  app.querySelector('#rail-keys').onclick = showKeys;
  app.querySelector('#rail-out').onclick = () => setState('locked');
  app.querySelector('#tb-keys').onclick = () => setState('locked');
  new ResizeObserver(syncDock).observe(drawer);
}
function syncDock() {
  const d = document.getElementById('drawer');
  const h = d && !d.classList.contains('closed') ? d.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--drawer-h', `${Math.round(h)}px`);
}

function renderLoading() {
  const rows = app.querySelector('#rows');
  app.querySelector('#finding').textContent = 'Checking your session…';
  rows.innerHTML = `<tr><td colspan="7"><div class="loading"><span id="ldr"></span><span>Opening your shelf</span></div></td></tr>`;
  rows.querySelector('#ldr').append(orbitLoader(44));
  app.querySelector('#tabs').innerHTML = '';
  status({ loading: true });
}

function renderOffline() {
  app.querySelector('#finding').textContent = 'Last synced at 16:04. Files and transfers resume when the host answers.';
  app.querySelector('#tabs').innerHTML = tabHtml([], 'all');
  app.querySelector('#rows').innerHTML = `<tr class="frame-note"><td colspan="7"><div class="inline"><span>The host isn't answering. Check this device's connection; your shelf is unchanged.</span><button class="btn btn-outline" id="retry" type="button">Retry now</button></div></td></tr>`;
  app.querySelector('#retry').onclick = () => setState('loading') || setTimeout(() => S.name === 'loading' && setState('shelf'), 900);
  status({ offline: true });
}

// ---------- the shelf ----------
function startShelf(empty) {
  const host = createHost();
  if (empty) host.files.splice(0);
  const transfers = new Transfers();
  const sel = new Selection();
  Object.assign(S, { host, transfers, sel, files: [], tab: 'all', q: '', cursor: 0, hidden: new Set(), ghosts: new Map(), hist: [] });
  const my = gen;

  if (!empty) {
    transfers.add('up', 'PXL_20261021_093015.mp4', Math.round(1.93 * GiB), { sent: Math.round(0.71 * GiB) });
    transfers.add('up', 'lecture-08-sampling.mp4', Math.round(862 * MiB));
    transfers.download(host.files[0]);
    if (!phone()) S.toggleDrawer(true); // on a phone the status line carries the speeds; the sheet opens on demand
  }
  transfers.addEventListener('change', () => { if (S.gen === my) { renderXfers(); status(); } });
  transfers.addEventListener('done', e => {
    if (S.gen !== my) return;
    const t = e.detail;
    if (t.dir === 'up') { host.add(t); S.files = host.files; renderRows(); toast(`${t.name} is on your shelf`); }
    else toast(`Saved ${t.name} to Downloads`);
  });
  S.histTimer = setInterval(() => { S.hist.push(transfers.speed('up') + transfers.speed('down')); if (S.hist.length > 60) S.hist.shift(); }, 1000);

  S.refresh = new AutoRefresh(async () => {
    const list = await host.list();
    if (S.gen !== my) return;
    S.files = list.slice(); renderRows(); status();
  });
  sel.addEventListener('change', () => { renderRows(); selectBar(); });

  // first load
  S.refresh.now().then(() => { if (S.gen === my) renderRows(); });
  app.querySelector('#finding').innerHTML = '&nbsp;';

  const q = app.querySelector('#q');
  q.addEventListener('input', () => { S.q = q.value.trim().toLowerCase(); S.cursor = 0; renderRows(); });
  app.querySelector('#all').addEventListener('change', e => sel.set(e.target.checked ? visible().map(f => f.id) : []));
  app.querySelector('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; S.cursor = 0; renderRows(); });
  app.querySelector('#rows').addEventListener('click', onRowClick);
  app.querySelector('#rows').addEventListener('change', e => { const c = e.target.closest('.check[data-id]'); if (c) sel.toggle(c.dataset.id, visible().map(f => f.id), e.shiftKey || S.shift); });
  app.querySelector('#rows').addEventListener('pointerdown', e => { S.shift = e.shiftKey; });
  app.querySelector('#xfers').addEventListener('click', e => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    const t = transfers.items.find(x => x.id === Number(b.closest('[data-tid]').dataset.tid));
    ({ pause: () => transfers.pause(t), resume: () => transfers.resume(t), cancel: () => transfers.cancel(t) })[b.dataset.x]();
  });
  renderXfers(); status();
}

function visible() {
  const all = S.files.filter(f => !S.hidden.has(f.id));
  return all.filter(f => (S.tab === 'all' || (S.tab === 'soon' ? soon(f) : kind(f.name) === S.tab)) && f.name.toLowerCase().includes(S.q));
}
function tabHtml(files, active) {
  const live = files.filter(f => !S.hidden?.has(f.id));
  const n = { all: live.length, video: live.filter(f => kind(f.name) === 'video').length, archive: live.filter(f => kind(f.name) === 'archive').length, soon: live.filter(soon).length };
  return [['all', 'All'], ['video', 'Videos'], ['archive', 'Archives'], ['soon', 'Expiring soon']]
    .map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === active}">${l} <span class="num">${n[k]}</span></button>`).join('');
}

function renderRows() {
  if (!S.files || !app.querySelector('#rows')) return;
  const files = visible();
  S.cursor = Math.max(0, Math.min(S.cursor, files.length - 1));
  app.querySelector('#tabs').innerHTML = tabHtml(S.files, S.tab);
  const names = {}; for (const f of S.files) names[f.name] = (names[f.name] || 0) + 1;
  const cells = barCells();
  // ghosts (deleted, inside the undo grace) keep their place in the list
  const inView = f => (S.tab === 'all' || (S.tab === 'soon' ? soon(f) : kind(f.name) === S.tab)) && f.name.toLowerCase().includes(S.q);
  const ghostRows = S.files.filter(f => S.ghosts.get(f.id)?.single && inView(f));
  let i = -1;
  let html = S.files.filter(f => inView(f) && (!S.hidden.has(f.id) || S.ghosts.get(f.id)?.single)).map(f => {
    const g = S.ghosts.get(f.id);
    if (g?.single) return `<tr class="ghost" data-ghost="${esc(f.id)}"><td colspan="7"><div class="ghost-line"><b>${esc(f.name)}</b><span>deleted</span><span class="num" data-left>${g.left}s</span><button type="button" data-undo>Undo</button></div></td></tr>`;
    i++;
    const on = S.sel.ids.has(f.id), gone = expired(f);
    return `<tr class="row${on ? ' sel' : ''}${i === S.cursor ? ' cur' : ''}${f.fresh ? ' fresh' : ''}" data-id="${esc(f.id)}">
      <td class="c-check"><input type="checkbox" class="check" data-id="${esc(f.id)}" ${on ? 'checked' : ''} aria-label="Select ${esc(f.name)}"></td>
      <td class="c-name"><span class="name"><b title="${esc(f.name)}">${esc(f.name)}</b>${names[f.name] > 1 ? `<span class="key">${shortId(f.id)}</span>` : ''}${f.fresh ? '<span class="new">new</span>' : ''}</span></td>
      <td class="c-type"><span class="type">${typeOf(f.name)}</span></td>
      <td class="c-size r"><span class="size">${bytes(f.size)}</span></td>
      <td class="c-added"><span class="added" title="${clock(f.uploadedAt)}">${iso(f.uploadedAt)}</span></td>
      <td class="c-exp">${xbar(f, cells)}<span class="xmeta">${typeOf(f.name)} · ${iso(f.uploadedAt)} · </span><span class="xdays${soon(f) ? ' soon' : gone ? ' gone' : ''}">${gone ? 'expired' : left(f)}</span><span class="xmeta">${gone ? '' : ' left'}</span></td>
      <td class="c-act"><div class="acts">${gone ? '<span class="gone-note">Expired</span>' : `<button type="button" class="dl" data-act="dl" aria-label="Download ${esc(f.name)}">↓<span class="w"> Download</span></button>`}<span class="morph" data-morph><button type="button" class="m-quiet" data-act="del" aria-label="Delete ${esc(f.name)}">Delete</button></span></div></td>
    </tr>`;
  }).join('');
  if (!files.length && !ghostRows.length) {
    const msg = S.files.length ? (S.q ? `No filename matches “${esc(S.q)}”. Press Esc to clear the search.` : 'Nothing in this view.') : 'A fresh shelf. Press u or drop files anywhere to send the first copy.';
    html = `<tr class="frame-note"><td colspan="7"><div class="inline">${S.files.length ? '' : '<canvas id="empty-koi" aria-hidden="true"></canvas>'}<span>${msg}</span></div></td></tr>`;
  }
  app.querySelector('#rows').innerHTML = html;
  const ek = app.querySelector('#empty-koi'); if (ek) new KoiMark(ek, { density: 2.2, dot: 1.2, radius: 30 });
  const all = app.querySelector('#all'); const n = files.filter(f => S.sel.ids.has(f.id)).length;
  all.checked = n > 0 && n === files.length; all.indeterminate = n > 0 && n < files.length;
  // finding: what most needs attention, computed from the rows
  const live = S.files.filter(f => !S.hidden.has(f.id));
  const exp = live.filter(soon).sort((a, b) => a.expiresAt - b.expiresAt);
  const u = usage(live, S.transfers.items);
  app.querySelector('#finding').innerHTML = !live.length ? 'Nothing stored yet. Copies stay for 30 days, then the server copy is removed.'
    : exp.length ? `<span class="num">${live.length}</span> copies · <span class="soon">${exp.length} expire within 3 days</span> — ${esc(exp[0].name)} goes at ${clock(exp[0].expiresAt)}${hoursLeft(exp[0]) < 24 ? ' today' : ''}.`
    : `<span class="num">${live.length}</span> copies, ${gib(u.used)} of 200 GiB.`;
  app.querySelector('#foot').innerHTML = live.length ? `<span>${files.length} of ${live.length} shown · newest first</span><span>Repeated names stay separate copies</span>` : '';
  setTimeout(() => { for (const f of S.files) f.fresh = false; }, 4000);
}

// ---------- row actions: download, inline delete morph with undo ----------
function onRowClick(e) {
  const tr = e.target.closest('tr[data-id]');
  const undo = e.target.closest('[data-undo]');
  if (undo) { const id = undo.closest('[data-ghost]').dataset.ghost; S.ghosts.get(id)?.handle.undo(); return; }
  if (!tr) return;
  const vis = visible(); const i = vis.findIndex(f => f.id === tr.dataset.id); if (i >= 0 && !e.target.closest('.check')) { S.cursor = i; markCursor(); }
  const act = e.target.closest('[data-act]')?.dataset.act;
  const file = S.files.find(f => f.id === tr.dataset.id);
  if (act === 'dl') startDownload([file]);
  if (act === 'del') askDelete(tr, file);
  if (act === 'cancel') resetMorph(tr, file);
  if (act === 'confirm') confirmDelete(tr, file);
}
function startDownload(files) {
  for (const f of files) if (!expired(f)) S.transfers.download(f);
  S.toggleDrawer(true);
  if (files.length > 1) toast(`Downloading ${files.length} files`);
}
function askDelete(tr, file) {
  const m = tr.querySelector('[data-morph]'); tr.querySelector('.acts').classList.add('open'); m.classList.add('asking');
  m.innerHTML = `<span class="m-quiet" style="color:var(--text)">Delete?</span><button type="button" class="m-quiet" data-act="cancel">Cancel</button><button type="button" class="m-confirm" data-act="confirm">Delete</button>`;
  m.querySelector('[data-act="confirm"]').focus();
}
function resetMorph(tr, file) {
  tr.querySelector('.acts').classList.remove('open'); tr.querySelector('[data-morph]').classList.remove('asking');
  tr.querySelector('[data-morph]').innerHTML = `<button type="button" class="m-quiet" data-act="del" aria-label="Delete ${esc(file.name)}">Delete</button>`;
}
function confirmDelete(tr, file) {
  const m = tr.querySelector('[data-morph]');
  m.innerHTML = `<span class="m-quiet"><span class="spin"></span>Deleting</span>`;
  setTimeout(() => {
    S.hidden.add(file.id);
    const g = { file, single: true, left: 6 };
    g.handle = deferredDelete(S.host, [file.id], {
      grace: 6000,
      onTick: s => { g.left = s; const el = app.querySelector(`[data-ghost="${CSS.escape(file.id)}"] [data-left]`); if (el) el.textContent = `${s}s`; },
      onCommit: () => { S.ghosts.delete(file.id); S.hidden.delete(file.id); S.files = S.host.files.slice(); renderRows(); },
      onUndo: () => {
        const line = app.querySelector(`[data-ghost="${CSS.escape(file.id)}"] .ghost-line`);
        if (line) line.innerHTML = `<span class="spin"></span><span>Restoring ${esc(file.name)}</span>`;
        setTimeout(() => { S.ghosts.delete(file.id); S.hidden.delete(file.id); renderRows(); }, 450);
      },
    });
    S.ghosts.set(file.id, g); S.sel.ids.delete(file.id); renderRows();
  }, 420);
}
function bulkDelete() {
  const ids = [...S.sel.ids]; if (!ids.length) return;
  for (const id of ids) S.hidden.add(id);
  S.sel.clear();
  const h = deferredDelete(S.host, ids, { grace: 6000, onCommit: () => { ids.forEach(id => S.hidden.delete(id)); S.files = S.host.files.slice(); renderRows(); }, onUndo: () => { ids.forEach(id => S.hidden.delete(id)); renderRows(); } });
  toast(`${ids.length} ${ids.length === 1 ? 'copy' : 'copies'} deleted`, { action: 'Undo', onAction: () => h.undo(), ms: 6000, clockFrom: 6 });
}
function markCursor() { app.querySelectorAll('#rows tr.row').forEach((r, i) => r.classList.toggle('cur', i === S.cursor)); app.querySelector('#rows tr.cur')?.scrollIntoView({ block: 'nearest' }); }

// ---------- multi-select bar ----------
function selectBar() {
  const n = S.sel.ids.size; let bar = document.querySelector('.select-bar');
  if (!n) { bar?.classList.add('out'); return; }
  const size = S.files.filter(f => S.sel.ids.has(f.id)).reduce((a, f) => a + f.size, 0);
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'select-bar out'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Selected files');
    bar.innerHTML = `<span class="count"><b></b> <span class="noun"></span></span><span class="size"></span><span class="sep"></span><button type="button" data-b="dl">↓ Download</button><button type="button" class="danger" data-b="del">Delete</button><button type="button" class="x" data-b="x" aria-label="Clear selection">×</button>`;
    bar.addEventListener('click', e => { const b = e.target.closest('[data-b]')?.dataset.b; if (b === 'dl') { startDownload(S.files.filter(f => S.sel.ids.has(f.id))); S.sel.clear(); } if (b === 'del') bulkDelete(); if (b === 'x') S.sel.clear(); });
    document.body.append(bar);
  }
  const b = bar.querySelector('b'); if (b.textContent !== String(n)) { b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  bar.querySelector('.noun').textContent = n === 1 ? 'file selected' : 'files selected';
  bar.querySelector('.size').textContent = bytes(size);
  requestAnimationFrame(() => bar.classList.remove('out'));
}

// ---------- transfers drawer ----------
function renderXfers() {
  const list = app.querySelector('#xfers'); if (!list || !S.transfers) return;
  const items = S.transfers.items;
  const open = S.transfers.open().length;
  app.querySelector('#clear-done').hidden = !items.some(t => ['done', 'cancelled'].includes(t.state));
  app.querySelector('#xcount').textContent = items.length ? `${open} open · ${items.length - open} finished` : '';
  for (const id of ['#rail-badge', '#tb-badge']) app.querySelector(id).textContent = open || '';
  if (!items.length) { list.innerHTML = '<li class="xfer"><span></span><span class="muted" style="grid-column:2/-1">No transfers. Drop files anywhere, or press u.</span></li>'; return; }
  if (list.querySelector('.muted')) list.innerHTML = '';
  for (const t of items) {
    let li = list.querySelector(`[data-tid="${t.id}"]`);
    if (!li) {
      li = document.createElement('li'); li.className = 'xfer'; li.dataset.tid = t.id;
      li.innerHTML = `<span class="dir" aria-label="${t.dir === 'up' ? 'Upload' : 'Download'}">${t.dir === 'up' ? '↑' : '↓'}</span><span class="nm"></span><span class="ticks" aria-hidden="true"></span><span class="amt"></span><span class="spd"></span><span class="eta"></span><span class="ctl"></span>`;
      li.querySelector('.nm').textContent = t.name; li.querySelector('.nm').title = t.name;
      list.append(li);
    }
    li.className = `xfer ${t.state}`;
    const pct = t.size ? t.sent / t.size : 0;
    const bar = li.querySelector('.ticks'); bar.classList.toggle('done', t.state === 'done'); ticks(bar, pct);
    li.querySelector('.amt').innerHTML = t.state === 'done' ? `<b>${bytes(t.size)}</b> ${t.dir === 'up' ? 'on shelf' : 'saved'}` : t.state === 'cancelled' ? 'cancelled' : `<b>${Math.floor(pct * 100)}%</b> · ${bytes(t.sent)} of ${bytes(t.size)}`;
    const live = t.state === 'uploading' || t.state === 'downloading';
    li.querySelector('.spd').innerHTML = live ? `<b>${rate(t.speed)}</b>` : t.state === 'queued' ? 'waiting' : t.state === 'paused' ? 'paused' : '';
    const eta = S.transfers.eta(t);
    li.querySelector('.eta').innerHTML = live ? (isFinite(eta) ? `${duration(eta)}<span class="eta-fin"> · ${finishAt(eta)}</span>` : 'measuring') : t.state === 'queued' && t.dir === 'up' ? 'after current' : '';
    const ctl = li.querySelector('.ctl');
    if (ctl.dataset.s !== t.state) {
      ctl.dataset.s = t.state;
      const acts = live ? ['pause', 'cancel'] : t.state === 'paused' ? ['resume', 'cancel'] : t.state === 'queued' ? ['cancel'] : [];
      ctl.innerHTML = acts.map(a => `<button type="button" data-x="${a}" aria-label="${a} ${esc(t.name)}">${a[0].toUpperCase() + a.slice(1)}</button>`).join('');
    }
  }
}

// ---------- status line ----------
function status(flags = {}) {
  const el = app.querySelector('#status'); if (!el) return;
  if (flags.loading) { el.innerHTML = `<span class="mode">shelf</span><span class="seg">checking session…</span>`; return; }
  if (flags.offline) { el.innerHTML = `<span class="mode">shelf</span><span class="seg"><span class="dot off">○</span> offline · last synced 16:04</span><span class="grow"></span><span class="seg"><button type="button" id="st-retry">retry · r</button></span>`; el.querySelector('#st-retry').onclick = () => app.querySelector('#retry')?.click(); return; }
  const T = S.transfers, R = S.refresh; if (!T || !R) return;
  const up = T.speed('up'), down = T.speed('down');
  const sending = T.items.filter(t => t.dir === 'up' && ['queued', 'uploading'].includes(t.state)).length;
  const receiving = T.items.filter(t => t.dir === 'down' && t.state === 'downloading').length;
  const qe = T.queueEta('up'), de = T.queueEta('down');
  const live = S.files.filter(f => !S.hidden.has(f.id)); const u = usage(live, T.items);
  const h = S.hist; const pairs = []; for (let i = 0; i < 60; i += 2) pairs.push(((h[h.length - 60 + i] || 0) + (h[h.length - 59 + i] || 0)) / 2);
  const histStr = blocks(pairs, 30, Math.max(40 * MiB, ...pairs));
  const sync = R.busy ? '⠿ syncing' : `<span class="dot">●</span> synced ${ago(Date.now() - R.last)} · next <b>${String(R.remaining).padStart(2, ' ')}s</b>`;
  el.innerHTML = `<span class="mode">shelf</span>
    <span class="seg">↑ <b>${rate(up).padStart(11)}</b>&nbsp; ↓ <b>${rate(down).padStart(11)}</b></span>
    ${sending ? `<span class="seg"><span class="pi">${sending} sending ·&nbsp;</span>ETA <b>${duration(qe)}</b><span class="opt-done">&nbsp;· done ${finishAt(qe)}</span></span>` : ''}
    ${receiving ? `<span class="seg mid opt">${receiving} receiving · ETA <b>${duration(de)}</b></span>` : ''}
    <span class="grow"></span>
    <span class="seg wide opt hist" title="Throughput, last 60 s">60s ${esc(histStr)}</span>
    <span class="seg mid opt"><b>${gib(u.used + u.reserved)}</b> of 200 GiB</span>
    <span class="seg opt">${sync}</span>`;
}
setInterval(() => { if (S && ['shelf', 'empty'].includes(S.name) && S.refresh) status(); }, 1000);

// ---------- keyboard ----------
function showKeys() {
  let d = document.querySelector('dialog.keys');
  if (!d) {
    d = document.createElement('dialog'); d.className = 'keys'; d.setAttribute('aria-labelledby', 'keys-title');
    const rows = [['j k', 'Move down / up'], ['x', 'Select the row · shift-x selects a range'], ['d', 'Download'], ['#', 'Delete (press again to confirm)'], ['/', 'Search filenames'], ['r', 'Refresh now'], ['u', 'Upload files'], ['t', 'Show or hide transfers'], ['esc', 'Clear search, selection or prompt']];
    d.innerHTML = `<h2 id="keys-title">Keyboard</h2><dl>${rows.map(([k, v]) => `<dt>${k.split(' ').map(x => `<span class="kbd">${x}</span>`).join('')}</dt><dd>${v}</dd>`).join('')}</dl><form method="dialog"><button class="btn btn-outline close">Close</button></form>`;
    document.body.append(d);
  }
  d.showModal();
}
addEventListener('keydown', e => {
  if (!S || !['shelf', 'empty'].includes(S.name)) return;
  const el = e.target instanceof Element ? e.target : document.body;
  const typing = el.matches('input[type="search"], input:not([type]), textarea');
  if (e.key === 'Escape') { if (typing) { el.value = ''; S.q = ''; el.blur(); renderRows(); } else S.sel.clear(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const vis = visible(), cur = vis[S.cursor];
  const k = e.key;
  if (k === 'j' || k === 'ArrowDown' && !el.closest('button,input')) { e.preventDefault(); S.cursor = Math.min(vis.length - 1, S.cursor + 1); markCursor(); }
  else if (k === 'k' || k === 'ArrowUp' && !el.closest('button,input')) { e.preventDefault(); S.cursor = Math.max(0, S.cursor - 1); markCursor(); }
  else if ((k === 'x' || k === 'X') && cur) S.sel.toggle(cur.id, vis.map(f => f.id), e.shiftKey);
  else if (k === 'd' && cur) startDownload([cur]);
  else if (k === '#' && cur) { const tr = app.querySelector(`#rows tr[data-id="${CSS.escape(cur.id)}"]`); if (tr.querySelector('[data-act="confirm"]')) confirmDelete(tr, cur); else askDelete(tr, cur); }
  else if (k === '/') { e.preventDefault(); app.querySelector('#q').focus(); }
  else if (k === 'r') S.refresh.now();
  else if (k === 'u') picker.click();
  else if (k === 't') S.toggleDrawer();
  else if (k === '?') showKeys();
});

// ---------- upload: picker and drop anywhere ----------
picker.addEventListener('change', () => { addUploads([...picker.files]); picker.value = ''; });
function addUploads(files) {
  if (!S?.transfers || !files.length) return;
  for (const f of files) S.transfers.upload({ name: f.name, size: Math.max(f.size, 1) });
  S.toggleDrawer(true);
}
let dragDepth = 0;
addEventListener('dragenter', e => { if (!S?.transfers) return; e.preventDefault(); if (dragDepth++ === 0) { document.body.classList.add('dropping'); const h = document.createElement('div'); h.className = 'drop-hint'; h.textContent = 'drop to upload · one at a time'; document.body.append(h); } });
addEventListener('dragover', e => { if (S?.transfers) e.preventDefault(); });
addEventListener('dragleave', () => { if (--dragDepth <= 0) endDrag(); });
addEventListener('drop', e => { e.preventDefault(); endDrag(); addUploads([...(e.dataTransfer?.files || [])]); });
function endDrag() { dragDepth = 0; document.body.classList.remove('dropping'); document.querySelector('.drop-hint')?.remove(); }
addEventListener('resize', () => { if (S?.files && S.name !== 'offline') renderRows(); syncDock(); });

// Open on the session check, then the shelf — the loader is part of the first impression.
const start = new URLSearchParams(location.search).get('state');
if (start) setState(start); else { setState('loading'); setTimeout(() => S.name === 'loading' && setState('shelf'), 1100); }
