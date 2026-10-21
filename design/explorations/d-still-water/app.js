// Variant D — Still water. Every state is built once and shown or hidden; canvases are started on first show.
import { createHost, Transfers, AutoRefresh, Selection, deferredDelete, toast, usage, bytes, rate, duration, finishAt,
  shortId, ago, ticks, esc, NOW, wait , fileDrop } from '../shared/storagi.js';
import { KoiPond, KoiMark, orbitLoader } from '../shared/koi.js';

const $ = s => document.querySelector(s);
const GiB = 1024 ** 3;
const host = createHost();
const files = host.files;          // the host's array: list(), remove() and add() all act on it
const hidden = new Set();          // ids waiting out their undo grace
const sel = new Selection();
const tr = new Transfers();
let state = '', loaded = false, pond, dropPond, mark, markEmpty;
// A kohaku with its patches on the body's centre line: the shared kohaku's offsets sit outside the slimmer body and clip away.
const kohaku = { name: 'kohaku', body: 'white', patches: [['koi', 0.08, 0, 0.13], ['koi', 0.31, 0.05, 0.1], ['koi', 0.5, -0.03, 0.075]] };
const fishSize = () => (innerWidth < 640 ? [110, 170] : [170, 300]);

// Seed: one upload under way, one waiting its turn, one download running, so every figure is live on load.
tr.add('up', 'IMG-export-2026-10-21.zip', Math.round(2.43 * GiB), { sent: Math.round(0.38 * 2.43 * GiB) });
tr.add('up', 'obs-2026-10-21 14-02-11.mp4', Math.round(1.62 * GiB));
tr.download(files.find(f => f.name.startsWith('lecture-07')));

// ---------- states ----------
const views = { locked: $('#locked'), loading: $('#loading'), app: $('#app') };
function show(next) {
  state = next;
  for (const b of document.querySelectorAll('.proto button')) b.setAttribute('aria-pressed', String(b.dataset.to === next));
  views.locked.hidden = next !== 'locked';
  views.loading.hidden = next !== 'loading';
  views.app.hidden = !['shelf', 'empty', 'offline'].includes(next);
  for (const id of ['shelf', 'empty', 'offline']) $('#' + id).hidden = next !== id;
  if (next !== 'shelf') sel.clear();
  if (next === 'locked') {
    const box = $('.locked-box');
    if (!pond) pond = new KoiPond($('#locked .pond'), { count: innerWidth < 640 ? 4 : 6, size: fishSize(), avoid: () => { const r = box.getBoundingClientRect(); return [{ x: r.x - 24, y: r.y - 16, w: r.width + 48, h: r.height + 32, dim: 0.16 }]; } });
    else pond.resize();
  }
  if (next === 'loading') { const slot = $('.loader-slot'); slot.replaceChildren(orbitLoader(52)); }
  if (next === 'shelf') {
    if (!mark) mark = new KoiMark($('#mark'), { radius: 42, variety: kohaku }); else mark.build();
    if (!loaded) { loaded = true; refresher.now(); }
    renderAll();
  }
  if (next === 'empty') { if (!markEmpty) markEmpty = new KoiMark($('#mark-empty'), { radius: 56, density: 0.9, variety: kohaku }); else markEmpty.build(); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-to]'); if (b) go(b.dataset.to); });
async function go(to) { if (to === 'shelf' && state !== 'shelf' && state !== 'loading') { show('loading'); await wait(900); } show(to); }
$('#login').onclick = () => go('shelf');
$('#signout').onclick = () => show('locked');

// ---------- auto-refresh: 60 s while visible, the stamp lives on the "in motion" line ----------
const refresher = new AutoRefresh(async () => { await host.list(); if (state === 'shelf') renderFiles(); });
refresher.addEventListener('change', renderStamp);
$('#refresh').onclick = () => refresher.now();
function renderStamp() {
  $('#stamp-time').textContent = refresher.busy ? 'refreshing…' : `updated ${ago(Date.now() - refresher.last)} · next in ${refresher.remaining}s`;
  $('#refresh').hidden = refresher.busy;
}

// ---------- head: the sentence and the waterline ----------
function renderHead() {
  const live = files.filter(f => !hidden.has(f.id));
  const u = usage(live, tr.items);
  $('#sentence').innerHTML = `<span class="num">${bytes(u.used)}</span> on the shelf.<br><span class="free"><span class="num">${bytes(u.free)}</span> free.</span>`;
  const el = $('#water'), ch = el._ch || (el._ch = measure(el)), n = Math.max(16, Math.floor(el.clientWidth / ch));
  const used = Math.max(u.used ? 1 : 0, Math.round(u.used / u.budget * n)), res = Math.round(u.reserved / u.budget * n);
  el.innerHTML = `<span class="used">${'~'.repeat(used)}</span><span class="res">${'≈'.repeat(res)}</span><span class="free">${'─'.repeat(Math.max(0, n - used - res))}</span>`;
  $('#water-legend').textContent = u.reserved ? `≈ ${bytes(u.reserved)} held for uploads in motion` : '';
}
function measure(el) { const s = document.createElement('span'); s.textContent = '~~~~~~~~~~'; el.append(s); const w = s.getBoundingClientRect().width / 10; s.remove(); return w || 7.8; }

// ---------- in motion: only while something moves ----------
function renderMotion() {
  const list = $('#motion-list'), items = tr.items.filter(t => t.state !== 'cancelled');
  const moving = items.filter(t => !['done'].includes(t.state));
  $('#motion').classList.toggle('idle', items.length === 0);
  $('#stamp-lead').textContent = items.length ? '' : 'Nothing in motion ·'; $('#stamp-lead').hidden = !!items.length;
  const up = tr.speed('up'), down = tr.speed('down'), qe = tr.queueEta('up');
  $('#motion-total').textContent = moving.length ? `↑ ${rate(up)}  ↓ ${rate(down)}${isFinite(qe) ? ` · uploads done ${finishAt(qe)}` : ''}` : 'all landed';
  for (const t of items) {
    let li = list.querySelector(`[data-t="${t.id}"]`);
    if (!li) {
      li = document.createElement('li'); li.className = 'tr'; li.dataset.t = t.id;
      li.innerHTML = `<span class="dir" aria-label="${t.dir === 'up' ? 'Upload' : 'Download'}">${t.dir === 'up' ? '↑' : '↓'}</span><span class="name"></span><span class="ticks" aria-hidden="true"></span><span class="speed"></span><span class="eta"></span><span class="act"></span>`;
      li.querySelector('.name').textContent = t.name; li.querySelector('.name').title = t.name;
      list.append(li);
    }
    const pct = t.size ? t.sent / t.size : 0, bar = li.querySelector('.ticks');
    bar.classList.toggle('done', t.state === 'done'); ticks(bar, pct);
    const eta = tr.eta(t);
    li.classList.toggle('done', t.state === 'done');
    li.querySelector('.speed').textContent = t.state === 'done' ? (t.dir === 'up' ? 'on shelf' : 'saved') : t.state === 'paused' ? 'paused' : t.state === 'queued' ? 'waiting' : rate(t.speed);
    li.querySelector('.eta').textContent = t.state === 'done' ? bytes(t.size)
      : t.state === 'queued' ? `${bytes(t.size)}`
      : `${Math.floor(pct * 100)}% · ${isFinite(eta) ? `${duration(eta)} · ${finishAt(eta)}` : '—'}`;
    const act = li.querySelector('.act');
    if (act.dataset.s !== t.state) {
      act.dataset.s = t.state;
      const kinds = t.state === 'uploading' || t.state === 'downloading' ? ['Pause'] : t.state === 'paused' ? ['Resume'] : t.state === 'queued' ? ['Cancel'] : [];
      act.replaceChildren(...kinds.map(k => { const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.setAttribute('aria-label', `${k} ${t.name}`); b.onclick = () => (k === 'Pause' ? tr.pause(t) : k === 'Resume' ? tr.resume(t) : tr.cancel(t)); return b; }));
    }
  }
  for (const li of [...list.children]) if (!items.some(t => String(t.id) === li.dataset.t)) li.remove();
}
tr.addEventListener('change', () => { if (state === 'shelf') { renderMotion(); renderHead(); } });
tr.addEventListener('done', e => {
  const t = e.detail;
  if (t.dir === 'up') { host.add(t); renderFiles(); }
  setTimeout(() => { t.state = 'cancelled'; tr.emit(); }, 4000);   // a landed transfer leaves the block after 4 s
});

// ---------- files grouped by day ----------
const DAY = 86_400_000;
// Sample times are the owner's (UTC+8); group and print them in that zone whatever the browser's zone is.
const TZ = 'Etc/GMT-8', dayNo = d => Math.floor((+d + 8 * 3_600_000) / DAY);
function bucket(d) { const n = Math.max(0, dayNo(NOW) - dayNo(d)); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? 'This week' : 'Earlier'; }
function when(f) { const b = bucket(f.uploadedAt); return b === 'Today' || b === 'Yesterday' ? f.uploadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : f.uploadedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }); }
function expiry(f) {
  if (f.expiresAt <= NOW) return '<span class="left gone">Expired</span>';
  const hours = Math.ceil((f.expiresAt - NOW) / 3_600_000), d = Math.floor((f.expiresAt - NOW) / DAY);
  const text = hours < 24 ? `<span class="num">${hours}</span> h left` : `<span class="num">${d}</span> ${d === 1 ? 'day' : 'days'} left`;
  return `<span class="left${d <= 3 ? ' soon' : ''}">${text}</span>`;
}
let order = [];
function renderFiles() {
  const q = $('#search').value.trim().toLowerCase();
  const live = files.filter(f => !hidden.has(f.id));
  const shown = live.filter(f => f.name.toLowerCase().includes(q)).sort((a, b) => b.uploadedAt - a.uploadedAt);
  const dupes = new Set(live.map(f => f.name).filter((n, i, a) => a.indexOf(n) !== i));
  order = shown.map(f => f.id);
  $('#count').textContent = `${live.length} ${live.length === 1 ? 'copy' : 'copies'}`;
  const groups = new Map();
  for (const f of shown) { const k = bucket(f.uploadedAt); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  $('#groups').innerHTML = [...groups].map(([k, list]) => `<section class="group"><h3>${k}</h3><ul>${list.map(f => {
    const gone = f.expiresAt <= NOW;
    return `<li class="row${sel.ids.has(f.id) ? ' sel' : ''}${f.fresh ? ' fresh' : ''}" data-id="${esc(f.id)}">
      <input class="check" type="checkbox" aria-label="Select ${esc(f.name)}"${sel.ids.has(f.id) ? ' checked' : ''}>
      <span class="who"><span class="fname" title="${esc(f.name)}">${esc(f.name)}${f.fresh ? '<span class="new">just arrived</span>' : ''}</span>
      <span class="meta">${bytes(f.size)} · ${when(f)}${dupes.has(f.name) ? ` · copy ${shortId(f.id)}` : ''}</span></span>
      <span class="acts">${gone ? '' : `<button class="btn btn-ghost" type="button" data-act="download" aria-label="Download ${esc(f.name)}">Download</button>`}<button class="btn btn-ghost" type="button" data-act="delete" aria-label="Delete ${esc(f.name)}">Delete</button></span>
      ${expiry(f)}
    </li>`; }).join('')}</ul></section>`).join('');
  $('#no-match').hidden = shown.length > 0 || !q;
  for (const f of files) if (f.fresh && !f._t) f._t = setTimeout(() => (f.fresh = false), 4000);
  renderHead(); renderSelBar();
}
$('#search').addEventListener('input', renderFiles);

// ---------- rows: select, download, inline delete with undo ----------
$('#groups').addEventListener('click', e => {
  const row = e.target.closest('.row'); if (!row) return;
  const id = row.dataset.id, f = files.find(x => x.id === id);
  if (e.target.matches('.check')) { sel.toggle(id, order, e.shiftKey); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'download') { tr.download(f); toast(`Downloading ${f.name}`); }
  if (act === 'delete') confirmDelete(row, f);
});
function morph(acts, html) { acts.classList.add('held'); acts.innerHTML = `<span class="morph">${html}</span>`; }
function confirmDelete(row, f) {
  const acts = row.querySelector('.acts');
  morph(acts, `<span class="m-quiet">Delete copy?</span><button type="button" class="m-quiet" data-m="cancel">Cancel</button><button type="button" class="m-confirm" data-m="go">Delete</button>`);
  acts.querySelector('[data-m="go"]').focus();
  acts.onclick = async e => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
    e.stopPropagation();
    if (m === 'cancel') { renderFiles(); return; }
    if (m === 'go') {
      morph(acts, `<span class="m-quiet"><span class="spin"></span>Deleting</span>`);
      await wait(450);
      row.classList.add('deleted'); hidden.add(f.id); sel.ids.delete(f.id); renderHead(); renderSelBar();
      $('#count').textContent = `${files.length - hidden.size} copies`;
      const ok = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.5 8.2l2.3 2.2 4.7-4.8" stroke="#000" stroke-width="1.8" fill="none"/></svg>';
      morph(acts, `<span class="m-ok">${ok}<span style="color:var(--text)">Deleted</span></span><button type="button" data-m="undo">Undo <span class="mono faint" data-left>6s</span></button>`);
      const job = deferredDelete(host, [f.id], {
        onTick: s => { const el = acts.querySelector('[data-left]'); if (el) el.textContent = `${Math.max(0, s)}s`; },
        onCommit: () => { hidden.delete(f.id); renderFiles(); },
      });
      acts.onclick = async ev => {
        if (!ev.target.closest('[data-m="undo"]')) return; ev.stopPropagation();
        job.undo(); morph(acts, `<span class="m-quiet"><span class="spin"></span>Restoring</span>`);
        await wait(400); hidden.delete(f.id); renderFiles();
      };
    }
  };
}

// ---------- multi-select bar ----------
sel.addEventListener('change', () => { for (const r of document.querySelectorAll('.row')) { const on = sel.ids.has(r.dataset.id); r.classList.toggle('sel', on); r.querySelector('.check').checked = on; } renderSelBar(); });
let lastN = 0;
function renderSelBar() {
  const n = sel.ids.size, bar = $('#select-bar');
  bar.classList.toggle('out', n === 0); $('#groups').classList.toggle('selecting', n > 0);
  if (n && n !== lastN) { const b = $('#sel-n'); b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  lastN = n;
  $('#sel-size').textContent = n ? bytes(files.filter(f => sel.ids.has(f.id)).reduce((s, f) => s + f.size, 0)) : '';
}
$('#sel-clear').onclick = () => sel.clear();
$('#sel-download').onclick = () => { const list = files.filter(f => sel.ids.has(f.id) && f.expiresAt > NOW); list.forEach(f => tr.download(f)); toast(`Downloading ${list.length} ${list.length === 1 ? 'copy' : 'copies'}`); sel.clear(); };
$('#sel-delete').onclick = () => {
  const ids = [...sel.ids]; ids.forEach(id => hidden.add(id)); sel.clear(); renderFiles();
  const job = deferredDelete(host, ids, { onCommit: () => { ids.forEach(id => hidden.delete(id)); renderFiles(); } });
  toast(`${ids.length} ${ids.length === 1 ? 'copy' : 'copies'} deleted`, { action: 'Undo', clockFrom: 6, ms: 6000, onAction: () => { job.undo(); ids.forEach(id => hidden.delete(id)); renderFiles(); toast('Restored'); } });
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel.ids.size) sel.clear(); });

// ---------- upload: the button, or drop anywhere (the page becomes the pond) ----------
$('#choose').onclick = () => $('#picker').click();
$('#picker').onchange = () => { for (const f of $('#picker').files) tr.upload(f); $('#picker').value = ''; };
const drop = $('#drop');
fileDrop({
  enabled: () => state === 'shelf',
  on: over => {
    drop.classList.toggle('on', over);
    if (over) { if (!dropPond) dropPond = new KoiPond($('#drop-pond'), { count: 7, size: fishSize(), opacity: 0.9, flee: 0 }); else dropPond.resize(); }
  },
  drop: files => { for (const f of files) tr.upload(f); },
});

// ---------- offline: a visible retry countdown ----------
let retry = 30; setInterval(() => { if (state === 'offline') { retry = retry <= 1 ? 30 : retry - 1; $('#retry-in').textContent = `${retry}s`; } }, 1000);

function renderAll() { renderFiles(); renderMotion(); renderStamp(); }
addEventListener('resize', () => { if (state === 'shelf') { for (const el of document.querySelectorAll('.ticks')) el._n = 0; renderHead(); renderMotion(); } });

// Opening the page checks the session first, then shows the shelf. ?state=locked|empty|offline opens a state directly.
const start = new URLSearchParams(location.search).get('state');
if (start && start !== 'shelf') show(start); else { show('loading'); setTimeout(() => show('shelf'), 1100); }
