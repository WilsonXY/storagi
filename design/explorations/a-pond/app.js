// Variant A — Pond. T3 Code shell; ASCII koi swim behind the composer and pass under it.
import { NOW, bytes, rate, duration, finishAt, relDay, daysLeft, ext, shortId, ago, usage, ticks, Transfers, AutoRefresh, createHost, Selection, deferredDelete, toast, esc, wait , clock, simNow , motionPref, setMotionPref , fileDrop } from '../shared/storagi.js';
import { KoiPond, KoiMark, orbitLoader, blocks } from '../shared/koi.js';

const $ = s => document.querySelector(s);
const GiB = 1024 ** 3, MiB = 1024 ** 2;
const ICON = {
  down: '<svg class="i" viewBox="0 0 16 16"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>',
  trash: '<svg class="i" viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>',
};

// ---------- two worlds: a lived-in shelf and an empty one ----------
function makeWorld(seeded) {
  const host = createHost(), tr = new Transfers();
  if (!seeded) host.files.splice(0);
  else {
    const a = tr.add('up', 'lightroom-export-oct.zip', Math.round(2.42 * GiB)); Object.assign(a, { sent: a.size * 0.38, elapsed: 4, speed: 9.1 * MiB });
    tr.add('up', 'scans-2019-family.zip', Math.round(1.06 * GiB));
    const obs = host.files.find(f => f.name.startsWith('obs-'));
    const d = tr.download(obs); Object.assign(d, { sent: d.size * 0.22, elapsed: 4, speed: 21 * MiB });
    for (let i = 0; i < 120; i++) { const s = i / 4; tr.history.push({ up: (8.4 + 1.6 * Math.sin(s / 2.3) + 0.6 * Math.sin(s * 1.7)) * MiB, down: i < 36 ? 0 : (19 + 4 * Math.sin(s / 1.9 + 1) + 1.2 * Math.sin(s * 2.3)) * MiB }); }
  }
  tr.addEventListener('done', e => { if (e.detail.dir === 'up') { host.add(e.detail); if (world === w) renderInbox(); } });
  tr.addEventListener('change', () => { if (world === w) renderTransfers(); });
  const w = { host, tr, sel: new Selection(), hidden: new Set(), morph: new Map() };
  w.sel.addEventListener('change', () => { if (world === w) { renderInbox(); renderSelection(); } });
  return w;
}
const worlds = { shelf: makeWorld(true), empty: makeWorld(false) };
let world = worlds.shelf, mode = 'shelf', lastGood = new Date(NOW.getTime() - 60_000);

// ---------- auto-refresh ----------
const ar = new AutoRefresh(async () => {
  if (mode === 'offline') { await wait(450); throw new Error('offline'); }
  await world.host.list(); lastGood = new Date(); renderInbox(); renderUsage();
});
ar.addEventListener('change', renderFresh);

// ---------- states ----------
let pond, lockedPond, mark;
function go(next) {
  mode = next;
  for (const b of document.querySelectorAll('[data-go]')) b.setAttribute('aria-pressed', String(b.dataset.go === next));
  $('#locked').hidden = next !== 'locked'; $('#loading').hidden = next !== 'loading'; $('#app').hidden = !['shelf', 'empty', 'offline'].includes(next);
  $('.select-bar').classList.add('out');
  if (next === 'locked') { lockedPond ||= new KoiPond($('#locked-pond'), { count: innerWidth < 640 ? 4 : 7, size: innerWidth < 640 ? [110, 180] : [170, 300], font: 11, flee: 160, avoid: () => [rel($('#locked-card'), $('#locked-pond'), 0.12)] }); lockedPond.resize(); }
  if (['shelf', 'empty', 'offline'].includes(next)) {
    world = next === 'empty' ? worlds.empty : worlds.shelf;
    const narrow = innerWidth < 640;
    pond ||= new KoiPond($('#pond'), { count: narrow ? 2 : 4, size: narrow ? [80, 130] : [110, 190], font: 11, flee: 130, avoid: () => [rel($('#composer'), $('#pond'), 0.14), rel($('.lede'), $('#pond'), 0.1), rel($('.search'), $('#pond'), 0.1)] });
    pond.resize(); renderAll();
    if (next === 'offline') { for (const t of world.tr.items) if (['uploading', 'downloading', 'queued'].includes(t.state)) { world.tr.pause(t); t.held = true; } ar.now(); }
    else releaseHeld();
  }
}
function releaseHeld() { for (const t of worlds.shelf.tr.items) if (t.held) { t.held = false; worlds.shelf.tr.resume(t); } }
function rel(el, canvas, dim) { const a = el.getBoundingClientRect(), b = canvas.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, dim }; }

// ---------- inbox ----------
function visibleFiles() {
  const q = $('#search').value.trim().toLowerCase();
  return world.host.files.filter(f => !world.hidden.has(f.id) && f.name.toLowerCase().includes(q)).sort((a, b) => b.uploadedAt - a.uploadedAt);
}
let order = [];
function renderInbox() {
  const files = visibleFiles(), all = world.host.files.filter(f => !world.hidden.has(f.id)), q = $('#search').value.trim();
  order = files.map(f => f.id);
  const names = {}; for (const f of world.host.files) names[f.name] = (names[f.name] || 0) + 1;
  const groups = new Map(); for (const f of files) { const k = relDay(f.uploadedAt); groups.has(k) || groups.set(k, []); groups.get(k).push(f); }
  const focusKey = document.activeElement?.dataset?.key;
  $('#groups').innerHTML = [...groups].map(([day, list]) => `<div class="group"><h3>${day}</h3>${list.map(f => row(f, names[f.name] > 1)).join('')}</div>`).join('');
  if (focusKey) document.querySelector(`[data-key="${focusKey}"]`)?.focus();
  const empty = !all.length, offline = mode === 'offline';
  $('#empty').hidden = !empty || offline; $('.list-head').hidden = empty;
  $('#no-match').hidden = empty || files.length > 0; $('#no-match').textContent = `No filenames match “${q}”. Press Esc to clear the search.`;
  $('#offline').hidden = !offline; $('#last-good').textContent = lastGood.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (empty && !offline) { mark ||= new KoiMark($('#koi-mark'), { radius: 40 }); requestAnimationFrame(() => mark.build()); }
  $('#inbox').classList.toggle('selecting', world.sel.ids.size > 0);
  const sa = $('#select-all'), n = files.filter(f => world.sel.ids.has(f.id)).length;
  sa.checked = n > 0 && n === files.length; sa.indeterminate = n > 0 && n < files.length;
  for (const id of ['#nav-files', '#tab-files']) $(id).textContent = all.length;
}
function row(f, dup) {
  const sel = world.sel.ids.has(f.id), left = daysLeft(f), gone = f.expiresAt <= NOW, m = world.morph.get(f.id);
  const exp = gone ? 'Expired' : `${left} d left`, expCls = gone ? 'gone' : left <= 3 ? 'soon' : '';
  if (f.fresh) f.freshAt ||= Date.now();
  const fresh = f.fresh && Date.now() - f.freshAt < 2400;
  return `<div class="row${sel ? ' selected' : ''}${fresh ? ' arrived' : ''}${m?.s === 'deleted' || m?.s === 'deleting' ? ' ghost' : ''}" data-id="${f.id}"${fresh ? ` style="animation-delay:-${Date.now() - f.freshAt}ms"` : ''}>
    <label class="lead"><span class="ext">${esc(ext(f.name))}</span><input type="checkbox" class="check" data-key="c-${f.id}" aria-label="Select ${esc(f.name)}"${sel ? ' checked' : ''}></label>
    <div class="name"><strong title="${esc(f.name)}">${esc(f.name)}</strong>${dup ? `<span class="copy">copy ${shortId(f.id)}</span>` : ''}${fresh ? '<span class="new">new</span>' : ''}</div>
    <span class="cell size">${bytes(f.size)}</span><span class="cell ${expCls}">${exp}</span>
    <span class="meta-phone"><span class="size">${bytes(f.size)}</span><span class="${expCls}">${exp}</span></span>
    <div class="acts${m ? ' engaged' : ''}">${acts(f, gone, m)}</div></div>`;
}
function acts(f, gone, m) {
  const n = esc(f.name);
  if (!m) return `${gone ? '' : `<a class="icon-btn" href="#" data-dl="${f.id}" data-key="d-${f.id}" aria-label="Download ${n}" title="Download">${ICON.down}</a>`}<button type="button" class="icon-btn" data-del="${f.id}" data-key="x-${f.id}" aria-label="Delete ${n}" title="Delete this copy">${ICON.trash}</button>`;
  if (m.s === 'confirm') return `<div class="morph"><span class="m-ask">Delete copy?</span><button type="button" class="m-btn" data-cancel="${f.id}" data-key="k-${f.id}">Cancel</button><button type="button" class="m-confirm" data-confirm="${f.id}" data-key="y-${f.id}">Delete</button></div>`;
  if (m.s === 'deleted') return `<div class="morph"><span class="m-ok">✓ Deleted</span><button type="button" data-undo="${f.id}" data-key="u-${f.id}">Undo</button><span class="m-clock" data-clock="${f.id}">${m.left}s</span></div>`;
  return `<div class="morph"><span class="m-quiet"><i class="spin"></i>Deleting</span></div>`;
}

$('#groups').addEventListener('click', e => {
  const t = e.target, r = t.closest('.row'); if (!r) return; const id = r.dataset.id, f = world.host.files.find(x => x.id === id);
  if (t.closest('.lead')) { e.preventDefault(); world.sel.toggle(id, order, e.shiftKey); return; }
  const b = t.closest('[data-dl],[data-del],[data-cancel],[data-confirm],[data-undo]'); if (!b) return; e.preventDefault();
  if (b.dataset.dl) { world.tr.download(f); setTab('inbox');
togglePanel(true); flashPulse(); return; }
  if (b.dataset.del) { world.morph.set(id, { s: 'confirm' }); renderInbox(); document.querySelector(`[data-key="k-${id}"]`)?.focus(); return; }
  if (b.dataset.cancel) { world.morph.delete(id); renderInbox(); document.querySelector(`[data-key="x-${id}"]`)?.focus(); return; }
  if (b.dataset.confirm) {
    const m = { s: 'deleted', left: 6 };
    m.op = deferredDelete(world.host, [id], {
      grace: 6000,
      onTick: s => { m.left = Math.max(0, s); const c = document.querySelector(`[data-clock="${id}"]`); if (c) c.textContent = `${m.left}s`; if (s <= 0 && m.s !== 'deleting') { m.s = 'deleting'; renderInbox(); } },
      onCommit: () => { world.morph.delete(id); world.sel.ids.delete(id); renderAll(); },
    });
    world.morph.set(id, m); renderInbox(); document.querySelector(`[data-key="u-${id}"]`)?.focus(); return;
  }
  if (b.dataset.undo) { world.morph.get(id)?.op.undo(); world.morph.delete(id); renderInbox(); document.querySelector(`[data-key="x-${id}"]`)?.focus(); }
});
$('#select-all').addEventListener('click', e => { e.preventDefault(); const ids = visibleFiles().map(f => f.id); world.sel.set(ids.every(id => world.sel.ids.has(id)) ? [] : ids); });
$('#search').addEventListener('input', renderInbox);

// ---------- selection bar ----------
let lastCount = 0;
function renderSelection() {
  const ids = [...world.sel.ids], files = world.host.files.filter(f => ids.includes(f.id)), bar = $('#select-bar');
  bar.classList.toggle('out', !ids.length || !['shelf', 'empty', 'offline'].includes(mode));
  if (!ids.length) return;
  const c = $('#sel-count'); c.textContent = ids.length; if (ids.length !== lastCount) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } lastCount = ids.length;
  $('#sel-size').textContent = bytes(files.reduce((n, f) => n + f.size, 0));
  $('#sel-download').disabled = files.every(f => f.expiresAt <= NOW);
}
$('#sel-clear').onclick = () => world.sel.clear();
$('#sel-download').onclick = () => {
  const files = world.host.files.filter(f => world.sel.ids.has(f.id) && f.expiresAt > NOW);
  for (const f of files) world.tr.download(f);
  world.sel.clear(); toast(`Downloading ${files.length} ${files.length === 1 ? 'copy' : 'copies'}. Speed and finish time are in Transfers.`); flashPulse();
};
$('#sel-delete').onclick = () => {
  const ids = [...world.sel.ids], w = world;
  for (const id of ids) w.hidden.add(id);
  w.sel.clear(); renderAll();
  const op = deferredDelete(w.host, ids, { grace: 6000, onUndo: () => { for (const id of ids) w.hidden.delete(id); renderAll(); }, onCommit: () => { for (const id of ids) w.hidden.delete(id); renderAll(); } });
  toast(`${ids.length} ${ids.length === 1 ? 'copy' : 'copies'} deleted`, { action: 'Undo', onAction: () => op.undo(), ms: 6000, clockFrom: 6 });
};

// ---------- transfers panel ----------
const rows = new Map(); let rowsWorld;
function renderTransfers() {
  const tr = world.tr, list = $('#tr-list'), items = tr.items;
  if (rowsWorld !== world) { list.replaceChildren(); rows.clear(); rowsWorld = world; }
  for (const [id, li] of rows) if (!items.some(t => t.id === id)) { li.remove(); rows.delete(id); }
  for (const t of items) {
    const key = t.id;
    let li = rows.get(key);
    if (!li) {
      li = document.createElement('li'); li.className = 'tr'; li.dataset.tid = t.id;
      li.innerHTML = `<div class="tr-top"><span class="arrow ${t.dir === 'up' ? 'up' : ''}" aria-hidden="true">${t.dir === 'up' ? '↑' : '↓'}</span><span class="tr-name"></span><span class="tr-acts"></span></div><span class="blocks" aria-hidden="true"></span><div class="tr-meta"><span class="amt"></span><span class="tr-pct"></span></div><div class="tr-meta"><span class="speed"></span><span class="left"></span></div>`;
      li.querySelector('.tr-name').textContent = t.name; li.querySelector('.tr-name').title = t.name;
      rows.set(key, li); list.append(li);
    }
    const r = t.sent / t.size, live = t.state === 'uploading' || t.state === 'downloading';
    // finished and cancelled transfers show their outcome for a moment, then leave the list by themselves
    if (['done', 'cancelled'].includes(t.state)) {
      t.endedAt ||= Date.now();
      if (!t.leaving && Date.now() - t.endedAt > 4000) { t.leaving = true; setTimeout(() => { world.tr.items = world.tr.items.filter(x => x !== t); renderTransfers(); }, 360); }
    }
    li.className = `tr ${t.state}${t.leaving ? ' leaving' : ''}`;
    li.querySelector('.tr-pct').textContent = t.state === 'done' ? '✓' : `${Math.floor(r * 100)}%`;
    const tk = li.querySelector('.blocks'); tk.classList.toggle('done', t.state === 'done'); const n = blockCount(tk), on = Math.round(Math.max(0, Math.min(1, r)) * n); blockBar(tk, [[on, 'on'], [n - on, 'off']]);
    li.querySelector('.amt').textContent = t.state === 'done' ? (t.dir === 'up' ? 'On your shelf' : 'Saved to this device') : `${bytes(t.sent)} of ${bytes(t.size)}`;
    const eta = tr.eta(t);
    li.querySelector('.speed').textContent = live ? rate(t.speed) : { queued: t.dir === 'up' ? 'Waiting its turn' : 'Starting', paused: t.held ? 'Waiting for the host' : 'Paused', cancelled: 'Cancelled', done: '', error: 'Interrupted' }[t.state] || '';
    li.querySelector('.left').textContent = live ? (isFinite(eta) ? `${duration(eta)} left` : 'measuring…') : '';
    const acts = li.querySelector('.tr-acts');
    if (acts.dataset.state !== t.state) {
      acts.dataset.state = t.state;
      const list2 = live ? ['Pause', 'Cancel'] : t.state === 'paused' ? ['Resume', 'Cancel'] : t.state === 'queued' ? ['Cancel'] : [];
      acts.innerHTML = list2.map(a => `<button type="button" data-act="${a}" aria-label="${a} ${esc(t.name)}">${a}</button>`).join('');
    }
  }
  const open = tr.open();
  for (const id of ['#nav-open', '#tab-open', '#det-open']) $(id).textContent = open.length;
  $('#tr-empty').hidden = items.length > 0;
  const up = tr.speed('up'), dn = tr.speed('down');
  $('#rate-up').textContent = tr.active('up').length ? rate(up) : 'idle'; $('#rate-up').classList.toggle('idle', !tr.active('up').length);
  $('#rate-down').textContent = tr.active('down').length ? rate(dn) : 'idle'; $('#rate-down').classList.toggle('idle', !tr.active('down').length);
  $('.chart').hidden = !tr.history.some(x => x.up || x.down);
  // ASCII throughput chart: one point per second for the last 30 s, upload and download on one scale.
  const h = tr.history, pts = [];
  for (let i = Math.max(0, h.length - 120); i < h.length; i += 4) { const g = h.slice(i, i + 4); pts.push({ up: g.reduce((n, x) => n + x.up, 0) / g.length, down: g.reduce((n, x) => n + x.down, 0) / g.length }); }
  // Each half has its own zero-based scale, named by its peak; the columns resample 30 points to the panel width.
  const pre = $('#chart-up'), cw = pre._cw ||= measure(pre), width = Math.max(10, Math.floor(pre.clientWidth / cw));
  const pick = k => pts.length ? Array.from({ length: width }, (_, c) => pts[Math.min(pts.length - 1, Math.floor(c * pts.length / width))][k]) : [];
  const mu = Math.max(1, ...pts.map(p => p.up)), md = Math.max(1, ...pts.map(p => p.down));
  pre.textContent = columns(pick('up'), width, mu, 3, false); $('#chart-down').textContent = columns(pick('down'), width, md, 2, true);
  $('#chart-base').textContent = '─'.repeat(width);
  // a direction with no traffic in the window shows a dash, not the 1 B/s scale floor
  const peak = k => pts.some(p => p[k] > 0) ? rate(k === 'up' ? mu : md) : '—';
  $('#chart-max').textContent = pts.length ? `peak ↑ ${peak('up')} · ↓ ${peak('down')}` : '';
  const qe = tr.queueEta('up'), de = tr.queueEta('down'), queued = tr.items.filter(t => t.dir === 'up' && t.state === 'queued').length;
  const rowsEta = [];
  if (tr.items.some(t => t.dir === 'up' && ['queued', 'uploading'].includes(t.state))) rowsEta.push(['Uploads, est.', isFinite(qe) ? `<b>${finishAt(qe)}</b> · ${duration(qe)}` : 'measuring…', queued ? `${queued} more queued` : '']);
  if (tr.active('down').length) rowsEta.push(['Downloads, est.', isFinite(de) ? `<b>${finishAt(de)}</b> · ${duration(de)}` : 'measuring…', '']);
  $('#eta').innerHTML = rowsEta.map(([k, v, n]) => `<div><dt>${k}</dt><dd class="mono">${v}</dd>${n ? `<dd class="note">${n}</dd>` : ''}</div>`).join('') || '';
  $('#eta').hidden = !rowsEta.length;
  // folded summary line above the inbox on narrow screens
  const p = $('#pulse-line'); p.hidden = !open.length;
  if (open.length) p.innerHTML = `<span class="up">↑ ${tr.active('up').length ? rate(up) : '—'}</span><span>↓ ${tr.active('down').length ? rate(dn) : '—'}</span><span>${isFinite(qe) ? `est. ${finishAt(qe)}` : `${open.length} open`} · View</span>`;
  renderUsage();
}
// Multi-row ASCII columns. Upward rows use eighth blocks; the downward half uses upper-half blocks.
function columns(values, width, max, rowsN, down) {
  const up = ' ▁▂▃▄▅▆▇█', v = [...Array(Math.max(0, width - values.length)).fill(0), ...values];
  const out = [];
  for (let r = 0; r < rowsN; r++) {
    out.push(v.map(x => {
      const lvl = x / max * rowsN; const k = down ? lvl - r : lvl - (rowsN - 1 - r);
      if (down) return k >= 1 ? '█' : k >= 0.5 ? '▀' : k > 0.08 && r === 0 ? '▔' : ' ';
      return k >= 1 ? '█' : k <= 0 ? (r === rowsN - 1 && x > 0 ? '▁' : ' ') : up[Math.max(1, Math.round(k * 8))];
    }).join(''));
  }
  return out.join('\n');
}
function measure(el) { const s = document.createElement('span'); s.textContent = '▁▁▁▁▁▁▁▁▁▁'; s.style.visibility = 'hidden'; el.append(s); const w = s.getBoundingClientRect().width / 10; s.remove(); return w || 6.6; }
$('#tr-list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const id = +b.closest('.tr').dataset.tid, t = world.tr.items.find(x => x.id === id);
  ({ Pause: () => world.tr.pause(t), Resume: () => world.tr.resume(t), Cancel: () => world.tr.cancel(t) })[b.dataset.act]();
});

// ---------- storage ----------
function renderUsage() {
  const u = usage(world.host.files.filter(f => !world.hidden.has(f.id)), world.tr.items), m = $('#meter');
  $('#used').textContent = bytes(u.used);
  const n = blockCount(m);
  const a = u.used ? Math.max(1, Math.round(u.used / u.budget * n)) : 0, b = u.reserved ? Math.max(1, Math.round(u.reserved / u.budget * n)) : 0;
  blockBar(m, [[a, 'u'], [b, 'r'], [Math.max(0, n - a - b), 'f']]);
  $('#reserved').innerHTML = u.reserved ? `${bytes(u.free)} free<br>${bytes(u.reserved)} held for uploads` : `${bytes(u.free)} free`;
}
// Bars of small rounded blocks (meter and transfers): as many 5px blocks with 3px gaps as fit the bar's width.
function blockCount(el) { return Math.max(8, Math.floor((el.clientWidth + 3) / 8)); }
function blockBar(el, parts) {
  const key = parts.map(p => p.join(':')).join('|'); if (el._key === key) return; el._key = key;
  el.innerHTML = parts.map(([n, cls]) => `<i class="${cls}"></i>`.repeat(n)).join('');
}

// ---------- freshness ----------
function renderFresh() {
  const f = $('#fresh'), t = $('#fresh-text');
  f.classList.toggle('busy', ar.busy); f.classList.toggle('off', mode === 'offline' && !ar.busy);
  if (ar.busy) t.innerHTML = '<span class="fresh-long">Refreshing</span>…';
  else if (mode === 'offline') t.innerHTML = `<span class="fresh-long">Offline · last good </span>${lastGood.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  else t.innerHTML = `<span class="fresh-long">Updated ${clock(new Date(simNow().getTime() - (Date.now() - ar.last)))} · next in </span>${ar.remaining}s`;
  $('#refresh').setAttribute('aria-label', `Refresh now (auto-refresh in ${ar.remaining} seconds)`);
}
$('#refresh').onclick = () => ar.now();
$('#retry').onclick = async () => { mode = 'shelf'; releaseHeld(); for (const b of document.querySelectorAll('[data-go]')) b.setAttribute('aria-pressed', String(b.dataset.go === 'shelf')); await ar.now(); renderAll(); };

// ---------- tabs and sheet ----------
function setTab(tab) {
  showView('shelf');
  $('#app').dataset.tab = tab;
  $('#page-title').textContent = tab === 'transfers' && innerWidth < 1180 ? 'Transfers' : 'Inbox';
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
}
// At desktop width the Transfers panel sits beside the Inbox; the sidebar's Transfers item opens and closes it.
function togglePanel(open = $('#app').classList.contains('panel-closed')) {
  $('#app').classList.toggle('panel-closed', !open);
  $('#nav-transfers').classList.toggle('is-active', open); $('#nav-transfers').setAttribute('aria-expanded', String(open));
  if (open) $('#details').animate?.([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
}
// ---------- settings ----------
// The sidebar's Settings item opens its own view; Inbox (or any tab) returns to the shelf.
let setPond;
function showView(view) {
  const app = $('#app'), on = view === 'settings';
  app.dataset.view = view; $('#settings').hidden = !on;
  $('#nav-settings').classList.toggle('is-active', on); $('#nav-settings').toggleAttribute('aria-current', on);
  const inbox = document.querySelector('.nav-item[data-tab="inbox"]'); inbox.classList.toggle('is-active', !on); inbox.toggleAttribute('aria-current', !on);
  if (on) { $('#page-title').textContent = 'Settings'; setPond ||= new KoiPond($('#set-pond'), { count: 3, size: [110, 170], font: 10, flee: 90, pointerTarget: $('#set-pond') }); paintKoiSwitch(); }
  else if ($('#page-title').textContent === 'Settings') $('#page-title').textContent = 'Inbox';
}
function paintKoiSwitch(saved) {
  const swim = motionPref() === 'swim';
  $('#koi-switch').setAttribute('aria-checked', String(swim));
  if (saved) $('#koi-saved').textContent = swim ? 'Saved · the koi swim' : 'Saved · the koi stay still';
}
$('#koi-switch').addEventListener('click', () => { setMotionPref(motionPref() === 'swim' ? 'static' : 'swim'); paintKoiSwitch(true); });
// only real view links: #app carries data-view (the current view) too
document.addEventListener('click', e => { const v = e.target.closest('a[data-view], button[data-view]'); if (!v) return; e.preventDefault(); showView(v.dataset.view); closeSheet(); });

function flashPulse() { const p = $('#pulse-line'); p.animate?.([{ background: 'var(--koi-dim)' }, { background: 'var(--surface)' }], { duration: 900 }); }
document.addEventListener('click', e => {
  // only real tab controls: #app also carries data-tab (the current tab) and must not count as one
  const t = e.target.closest('a[data-tab], button[data-tab]'); if (!t) return; e.preventDefault();
  if (t.dataset.tab === 'transfers' && innerWidth >= 1180) { showView('shelf'); togglePanel(t.classList.contains('nav-item') ? undefined : true); closeSheet(); return; }
  setTab(t.dataset.tab); closeSheet();
});
const side = $('#side');
$('#menu-btn').onclick = () => { $('#sheet-slot').append(side.querySelector('.nav'), side.querySelector('.side-foot')); $('#sheet').hidden = false; $('#menu-btn').setAttribute('aria-expanded', 'true'); $('#sheet-close').focus(); };
function closeSheet() { if ($('#sheet').hidden) return; side.append($('#sheet-slot .nav'), $('#sheet-slot .side-foot')); $('#sheet').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
$('#sheet-close').onclick = closeSheet;

// ---------- uploads: picker, drop, keyboard ----------
const picker = $('#picker');
$('#choose').onclick = () => picker.click();
picker.onchange = () => { addFiles([...picker.files]); picker.value = ''; };
function addFiles(files) { for (const f of files) world.tr.upload({ name: f.name, size: f.size || 1 }); if (files.length) { toast(`${files.length} ${files.length === 1 ? 'file' : 'files'} queued. One uploads at a time.`); flashPulse(); } }
fileDrop({
  enabled: () => ['shelf', 'empty'].includes(mode),
  on: over => { $('#composer').classList.toggle('dragging', over); $('.composer-text').textContent = over ? 'Let go to put them on the shelf' : 'Drop files to put them on the shelf'; },
  drop: addFiles,
});
addEventListener('keydown', e => {
  const typing = e.target.matches('input, textarea');
  if (e.key === '/' && !typing) { e.preventDefault(); $('#search').focus(); }
  else if (e.key.toLowerCase() === 'u' && !typing && !e.metaKey && !e.ctrlKey && ['shelf', 'empty'].includes(mode)) picker.click();
  else if (e.key === 'Escape') {
    if (e.target === $('#search') && $('#search').value) { $('#search').value = ''; renderInbox(); return; }
    closeSheet();
    for (const [id, m] of world.morph) if (m.s === 'confirm') world.morph.delete(id);
    world.sel.clear(); renderInbox();
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !typing && mode !== 'locked') { e.preventDefault(); world.sel.set(visibleFiles().map(f => f.id)); }
});

// ---------- sign in / out ----------
// Sign out asks first, in a small pop-up above the button. It names what stops if transfers are running.
const signPop = $('#signout-pop');
function openSignout() {
  const busy = d => world.tr.items.filter(t => t.dir === d && ['uploading', 'downloading', 'queued', 'paused'].includes(t.state)).length;
  const up = busy('up'), down = busy('down'), parts = [up && `${up} upload${up > 1 ? 's' : ''}`, down && `${down} download${down > 1 ? 's' : ''}`].filter(Boolean);
  $('#signout-note').textContent = parts.length
    ? `${parts.join(' and ')} will stop.`
    : 'Your files stay on the shelf.';
  signPop.hidden = false; $('#sign-out').setAttribute('aria-expanded', 'true'); $('#signout-cancel').focus();
}
function closeSignout(refocus = true) {
  if (signPop.hidden) return; signPop.hidden = true; $('#sign-out').setAttribute('aria-expanded', 'false'); if (refocus) $('#sign-out').focus();
}
$('#sign-out').onclick = () => (signPop.hidden ? openSignout() : closeSignout());
$('#signout-cancel').onclick = () => closeSignout();
$('#signout-confirm').onclick = () => { closeSignout(false); closeSheet(); go('locked'); };
document.addEventListener('pointerdown', e => { if (!signPop.hidden && !e.target.closest('#signout-pop, #sign-out')) closeSignout(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !signPop.hidden) { e.stopPropagation(); closeSignout(); } }, true);
$('#sign-in').onclick = async e => { e.preventDefault(); go('loading'); await wait(1200); go('shelf'); };
for (const b of document.querySelectorAll('[data-go]')) b.onclick = () => go(b.dataset.go);

function renderAll() { renderInbox(); renderTransfers(); renderSelection(); renderUsage(); renderFresh(); }

// ---------- boot ----------
$('#loader').prepend(orbitLoader(56));
setTab('inbox');
togglePanel(true);
const start = new URLSearchParams(location.search).get('state');
if (start) { await worlds.shelf.host.list(); go(start); }
else { go('loading'); await world.host.list(); await wait(700); go('shelf'); }
