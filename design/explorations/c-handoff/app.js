// Variant C — Handoff. Two lanes: Send (drop + upload queue) and Pick up (the Inbox), with koi in the channel between.
import { createHost, Transfers, AutoRefresh, Selection, deferredDelete, toast, bytes, rate, duration, finishAt, clock, NOW, usage, ticks, ext, esc, ago, shortId, reduced } from '../shared/storagi.js';
import { KoiPond, KoiMark, orbitLoader, blocks } from '../shared/koi.js';

const GiB = 1024 ** 3, MiB = 1024 ** 2, DAY = 86_400_000;
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  up: svg('<path d="M12 16V5M7 10l5-5 5 5M5 19h14"/>'),
  down: svg('<path d="M12 5v11M7 11l5 5 5-5M5 19h14"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
  x: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  pause: svg('<path d="M9 6v12M15 6v12"/>'),
  play: svg('<path d="M8 6l10 6-10 6z"/>'),
  refresh: svg('<path d="M19 12a7 7 0 1 1-2.05-4.95M19 5v4h-4"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'width="14" height="14"'),
};
// Stand-in koi mark until the owner's favicon is added.
const KOI = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#111214"/><path d="M4 12c1.5-3 4-4.5 7-4.5 3.2 0 5.3 1.7 6.8 3.6L21 9l-1 3 1 3-3.2-2.1c-1.5 1.9-3.6 3.6-6.8 3.6-3 0-5.5-1.5-7-4.5z" fill="#ece8e1"/><circle cx="9" cy="11" r="2" fill="#ff5b35"/></svg>`;

// ---------------------------------------------------------------------------------------------
let host = createHost();
const tx = new Transfers();
const sel = new Selection();
let state = 'shelf';
let query = '';
let tab = 'pick';
let lastGood = new Date();
const hidden = new Set();            // ids hidden by a bulk delete inside its grace period
const pending = new Map();           // id -> { phase, handle, left }
const saved = new Map();             // fileId -> time a download finished
let offlinePaused = [];

function seedTransfers() {
  tx.items = [];
  const u = tx.add('up', 'lecture-08-fourier.mp4', Math.round(1.38 * GiB)); u.sent = Math.round(u.size * 0.41);
  tx.add('up', 'design-review-2026-10-21.mp4', Math.round(862 * MiB));
  const f = host.files.find(f => f.name.startsWith('lecture-07'));
  const d = tx.download(f); d.sent = Math.round(d.size * 0.22);
}

// ---------------------------------------------------------------------------------------------
const app = document.getElementById('app');
app.innerHTML = `
<header class="bar">
  <div class="brand">${KOI}<h1>Storagi</h1><span class="scope">Your shelf</span></div>
  <div class="stamp" data-live><span class="label"></span><button type="button" id="refresh" aria-label="Refresh now" title="Refresh now">${I.refresh}</button></div>
  <span class="sep-v" data-live></span>
  <div class="usage" data-live><span class="num" id="used"></span><span class="ticks" id="meter" aria-hidden="true"></span></div>
  <span class="sep-v" data-live></span>
  <button type="button" class="who" id="signout" data-live>Sign out</button>
</header>
<nav class="tabs" role="tablist" aria-label="Lanes">
  <button role="tab" id="tab-send" aria-controls="send">Send <span class="num" id="tab-send-n">0</span></button>
  <button role="tab" id="tab-pick" aria-controls="pick">Pick up <span class="num" id="tab-pick-n">0</span></button>
</nav>
<div class="loading" id="loading" hidden></div>
<main class="lanes" id="lanes">
  <section class="lane" id="send" aria-labelledby="send-title">
    <div class="lane-head"><h2 id="send-title">Send</h2><span class="agg" id="send-agg"></span></div>
    <div class="history" id="send-hist" aria-hidden="true"></div>
    <div class="lane-body">
      <div id="send-note"></div>
      <div class="drop" id="drop" role="button" tabindex="0" aria-label="Choose files to send">
        <span class="glyph">${I.up}</span>
        <p>Drag files here or <button type="button" id="choose" tabindex="-1">choose files</button></p>
        <small id="free"></small>
      </div>
      <input type="file" id="picker" multiple hidden>
      <div class="qhead" id="qhead"><span id="qcount"></span><button type="button" id="clear">Clear finished</button></div>
      <ul class="queue" id="queue" aria-label="Upload queue"></ul>
    </div>
  </section>
  <div class="channel" aria-hidden="true"><canvas id="channel"></canvas></div>
  <section class="lane" id="pick" aria-labelledby="pick-title">
    <div class="lane-head"><h2 id="pick-title">Pick up <span class="num" id="pick-n"></span></h2><span class="agg" id="pick-agg"></span></div>
    <div class="history" id="pick-hist" aria-hidden="true"></div>
    <div class="tools">
      <label class="selall"><input type="checkbox" class="check" id="selall" aria-label="Select all shown"></label>
      <label class="search">${I.search}<input type="search" id="q" placeholder="Search filenames" aria-label="Search filenames"></label>
      <span class="kbd">/</span>
    </div>
    <div class="lane-body"><div id="pick-note"></div><div id="groups"></div></div>
  </section>
</main>
<canvas class="crossing" id="crossing" aria-hidden="true"></canvas>
<canvas class="lockpond" id="lockpond" aria-hidden="true" hidden></canvas>
<div class="lockcard" id="lockcard" role="dialog" aria-labelledby="lock-title" hidden>
  <canvas id="lockmark" aria-hidden="true"></canvas>
  <h2 id="lock-title">Your shelf is locked.</h2>
  <p>Sign in with the owner's Google account. Interrupted uploads continue when you choose the same file again.</p>
  <button type="button" class="btn btn-primary" id="signin"><svg class="g" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>Continue with Google</button>
  <small>Only the owner's account can open this shelf.</small>
</div>
<div class="proto" role="group" aria-label="Prototype state"><span>state</span>${['Locked', 'Loading', 'Shelf', 'Empty', 'Offline'].map(s => `<button type="button" data-state="${s.toLowerCase()}">${s}</button>`).join('')}</div>
<div class="select-bar out" id="selbar" role="toolbar" aria-label="Selected files">
  <span class="count"><b id="seln">0</b> selected<span class="num-size" id="selsize"></span></span><span class="sep"></span>
  <button type="button" id="seldl">${I.down}<span>Download</span></button>
  <button type="button" class="danger" id="seldel">${I.trash}<span>Delete</span></button>
  <button type="button" class="x" id="selx" aria-label="Clear selection">${I.x}</button>
</div>`;
const $ = id => document.getElementById(id);
const queueEl = $('queue'), groupsEl = $('groups');

// ---------------------------------------------------------------------------------------------
// The channel: a koi pond one channel wide. Fish run along the channel, never across it.
class ChannelPond extends KoiPond {
  spawn(i, anywhere) {
    super.spawn(i, anywhere);
    const f = this.fish[i], vert = this.h > this.w, back = Math.random() < 0.5;
    f.speed *= 0.55;
    if (vert) { f.x = this.w * (0.3 + Math.random() * 0.4); f.a = (back ? -1 : 1) * Math.PI / 2; if (!anywhere) f.y = back ? this.h + f.len : -f.len; }
    else { f.y = this.h * (0.35 + Math.random() * 0.3); f.a = back ? Math.PI : 0; if (!anywhere) f.x = back ? this.w + f.len : -f.len; }
  }
  step(dt) {
    super.step(dt);
    const vert = this.h > this.w;
    for (const f of this.fish) {
      const goal = vert ? (Math.sin(f.a) >= 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.cos(f.a) >= 0 ? 0 : Math.PI);
      let d = goal - f.a; d = Math.atan2(Math.sin(d), Math.cos(d)); f.a += d * Math.min(1, dt * 2.2);
    }
  }
}
const phone = () => matchMedia('(max-width: 900px)').matches;
let channel;
function startChannel() {
  channel = new ChannelPond($('channel'), { count: phone() ? 3 : 4, size: phone() ? [44, 60] : [58, 84], font: 9, cells: true, flee: 70, ripples: true });
  addEventListener('resize', () => setTimeout(() => channel.resize(), 0));
}

// A separate full-screen pond, empty until an upload lands: one koi swims the file across.
let crossing;
function swimAcross(fromEl, toEl) {
  if (reduced() || !fromEl || !toEl) return;
  crossing ||= new KoiPond($('crossing'), { count: 0, size: [92, 110], flee: 0, cells: false, ripples: true, font: 10 });
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const sx = a.left + a.width * 0.25, sy = a.top + a.height / 2, ty = b.top + b.height / 2;
  const i = crossing.fish.length; crossing.spawn(i, true);
  const f = crossing.fish[i]; Object.assign(f, { x: sx, y: sy, a: 0, speed: 340, turn: 0 });
  const exitX = innerWidth + f.len * 1.4;
  (function steer() {
    if (!crossing.fish.includes(f)) return;
    const want = Math.atan2(ty - f.y, Math.max(40, exitX - f.x)) * 0.8;
    f.a += (want - f.a) * 0.18; f.turn = 0; f.wander = 0;
    if (f.x > innerWidth + f.len * 1.1) { crossing.fish.splice(crossing.fish.indexOf(f), 1); return; }
    requestAnimationFrame(steer);
  })();
}

// ---------------------------------------------------------------------------------------------
// Send lane
const upItems = () => tx.items.filter(t => t.dir === 'up');
function cardMeta(t) {
  const e = `<b>.${esc(ext(t.name))}</b>`;
  if (t.state === 'uploading') {
    const eta = tx.eta(t);
    return `${e} / ${bytes(t.sent)} of ${bytes(t.size)} · <span class="rate">${rate(t.speed)}</span> · ${isFinite(eta) ? duration(eta) + ' left' : 'estimating'}`;
  }
  if (t.state === 'queued') return `${e} / ${bytes(t.size)} · waiting its turn`;
  if (t.state === 'paused') return `${e} / ${bytes(t.sent)} of ${bytes(t.size)} · ${state === 'offline' ? 'waiting for the host' : 'paused'}`;
  if (t.state === 'done') return `${e} / ${bytes(t.size)} · expires in 30 d`;
  if (t.state === 'cancelled') return `${e} / cancelled, server copy released`;
  return e;
}
function cardActions(t) {
  const b = (act, icon, label) => `<button type="button" class="icon-btn" data-act="${act}" aria-label="${label} ${esc(t.name)}" title="${label}">${icon}</button>`;
  if (t.state === 'uploading') return b('pause', I.pause, 'Pause') + b('cancel', I.x, 'Cancel');
  if (t.state === 'paused') return b('resume', I.play, 'Resume') + b('cancel', I.x, 'Cancel');
  if (t.state === 'queued') return b('cancel', I.x, 'Cancel');
  return '';
}
function renderCard(t) {
  let el = queueEl.querySelector(`[data-t="${t.id}"]`);
  if (!el) {
    el = document.createElement('li'); el.className = 'card enter'; el.dataset.t = t.id;
    el.innerHTML = `<span class="ext">.${esc(ext(t.name))}</span><span class="name"></span><span class="side"><span class="pct num"></span><span class="acts"></span></span><span class="meta"></span><span class="ticks" aria-hidden="true"></span>`;
    el.querySelector('.name').textContent = t.name; el.querySelector('.name').title = t.name;
    queueEl.append(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));
  }
  el.className = `card ${t.state === 'done' ? 'done' : t.state === 'queued' ? 'waiting' : t.state}`;
  el.querySelector('.meta').innerHTML = cardMeta(t);
  const pct = el.querySelector('.pct');
  if (t.state === 'done') pct.innerHTML = `${I.check}On your shelf`;
  else pct.textContent = t.state === 'cancelled' ? '' : `${Math.floor(t.sent / t.size * 100)}%`;
  const acts = el.querySelector('.acts');
  if (acts.dataset.state !== t.state) { acts.innerHTML = cardActions(t); acts.dataset.state = t.state; }
  const tk = el.querySelector('.ticks'); tk.classList.toggle('done', t.state === 'done'); ticks(tk, t.sent / t.size);
}
function renderSend() {
  const items = upItems();
  for (const el of queueEl.querySelectorAll('[data-t]')) if (!items.some(t => String(t.id) === el.dataset.t)) el.remove();
  items.forEach(renderCard);
  const open = items.filter(t => ['queued', 'uploading', 'paused'].includes(t.state));
  const eta = tx.queueEta('up'), s = tx.speed('up');
  $('send-agg').innerHTML = !open.length ? '<span class="dim">Nothing on its way</span>'
    : s ? `<span class="rate">↑ ${rate(s)}</span> · ${open.length} left · ${isFinite(eta) ? `${duration(eta)} · done ~${finishAt(eta)}` : 'estimating'}`
    : open.every(t => t.state === 'paused') ? `${open.length} waiting · <span class="dim">${state === 'offline' ? 'host unreachable' : 'paused'}</span>` : `${open.length} left · <span class="dim">starting</span>`;
  $('qhead').hidden = !items.length;
  $('qcount').textContent = items.length ? `${open.length ? open.length + ' in the queue' : 'All sent'}` : '';
  $('clear').hidden = !items.some(t => ['done', 'cancelled'].includes(t.state));
  $('tab-send-n').textContent = open.length;
}
function history(el, key, live) {
  const n = Math.max(16, Math.floor(el.clientWidth / 6.6));
  const vals = tx.history.map(h => h[key]);
  el.innerHTML = live ? `<span class="live">${blocks(vals, n, Math.max(MiB, ...vals) * 1.35)}</span>` : '';
}

// ---------------------------------------------------------------------------------------------
// Pick up lane
function dayIndex(d) { const a = new Date(d); a.setHours(0, 0, 0, 0); const b = new Date(NOW); b.setHours(0, 0, 0, 0); return Math.round((b - a) / DAY); }
function groupOf(f) { const n = dayIndex(f.uploadedAt); return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? 'This week' : 'Older'; }
function expiresLabel(f) {
  const ms = f.expiresAt - Math.max(NOW, f.uploadedAt);
  if (ms <= 0) return { text: 'expired', soon: true, gone: true };
  if (ms < DAY) return { text: `${Math.ceil(ms / 3.6e6)} h left`, soon: true };
  const d = Math.ceil(ms / DAY); return { text: `${d} d left`, soon: d <= 3 };
}
function when(f) {
  const g = groupOf(f);
  return g === 'Today' || g === 'Yesterday' ? clock(f.uploadedAt) : new Date(f.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + clock(f.uploadedAt);
}
function visible() {
  const q = query.trim().toLowerCase();
  return host.files.filter(f => !hidden.has(f.id) && f.name.toLowerCase().includes(q)).sort((a, b) => b.uploadedAt - a.uploadedAt);
}
function renderPick() {
  const files = visible(), q = query.trim();
  const dupes = new Set(host.files.map(f => f.name).filter((n, i, all) => all.indexOf(n) !== i));
  const groups = ['Today', 'Yesterday', 'This week', 'Older'].map(g => [g, files.filter(f => groupOf(f) === g)]).filter(([, l]) => l.length);
  groupsEl.classList.toggle('picking', sel.ids.size > 0);
  if (!host.files.filter(f => !hidden.has(f.id)).length) groupsEl.innerHTML = `<p class="empty">Nothing to pick up. Files you send from any device land here, newest first.</p>`;
  else if (!files.length) groupsEl.innerHTML = `<p class="empty">No filenames match “${esc(q)}”.</p>`;
  else groupsEl.innerHTML = groups.map(([g, list]) => `<section class="group" aria-label="${g}"><div class="ghead"><span>${g}</span><span class="num">${list.length} · ${bytes(list.reduce((n, f) => n + f.size, 0))}</span></div><ul>${list.map(f => rowHtml(f, dupes.has(f.name))).join('')}</ul></section>`).join('');
  for (const f of files) updateRow(f.id);
  const total = host.files.filter(f => !hidden.has(f.id));
  $('pick-n').textContent = total.length;
  $('tab-pick-n').textContent = total.length;
  renderSelection(); renderUsage(); renderPickAgg();
}
function rowHtml(f, dup) {
  const e = expiresLabel(f);
  return `<li class="row${f.fresh ? ' fresh' : ''}${e.gone ? ' expired' : ''}" data-id="${esc(f.id)}">
    <input type="checkbox" class="check" aria-label="Select ${esc(f.name)}"${sel.ids.has(f.id) ? ' checked' : ''}${e.gone ? ' disabled' : ''}>
    <div class="who-line"><div class="name"><span title="${esc(f.name)}">${esc(f.name)}</span>${dup ? `<span class="copy">· ${shortId(f.id)}</span>` : ''}</div><div class="sub"></div><div class="ticks" aria-hidden="true" hidden></div></div>
    <div class="end"><span class="size num">${bytes(f.size)}</span><span class="acts"></span></div></li>`;
}
function updateRow(id) {
  const row = groupsEl.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!row) return;
  const f = host.files.find(x => x.id === id); if (!f) return;
  const t = tx.items.find(t => t.dir === 'down' && t.fileId === id && !['done', 'cancelled'].includes(t.state));
  const p = pending.get(id), e = expiresLabel(f);
  const sub = row.querySelector('.sub'), tk = row.querySelector('.ticks'), acts = row.querySelector('.acts');
  row.classList.toggle('sel', sel.ids.has(id));
  row.classList.toggle('gone', p?.phase === 'gone');
  let key;
  if (t) {
    const eta = tx.eta(t);
    sub.innerHTML = t.state === 'paused' ? `${state === 'offline' ? 'waiting for the host' : 'paused'} · ${bytes(t.sent)} of ${bytes(f.size)}`
      : `<span class="rate">↓ ${rate(t.speed)}</span> · ${isFinite(eta) ? `${duration(eta)} left · done ~${finishAt(eta)}` : 'estimating'}`;
    tk.hidden = false; ticks(tk, t.sent / t.size);
    key = 'dl' + t.state;
    if (acts.dataset.k !== key) acts.innerHTML = `<span class="num faint" data-pct></span><button type="button" class="icon-btn" data-row="canceldl" aria-label="Stop downloading ${esc(f.name)}" title="Stop">${I.x}</button>`;
    acts.querySelector('[data-pct]').textContent = `${Math.floor(t.sent / t.size * 100)}%`;
  } else {
    tk.hidden = true;
    const s = saved.get(id);
    sub.innerHTML = s && Date.now() - s < 8000 ? `<span class="ok">Saved to this device ✓</span>` : `${when(f)} · <span class="sz">${bytes(f.size)} · </span><span class="${e.soon ? 'soon' : ''}">${e.text}</span>`;
    key = p ? p.phase + (p.left ?? '') : e.gone ? 'expired' : 'idle';
    if (acts.dataset.k !== key) acts.innerHTML = actsHtml(f, p, e);
  }
  acts.dataset.k = key;
}
function actsHtml(f, p, e) {
  const n = esc(f.name);
  if (p?.phase === 'confirm') return `<span class="morph"><span class="m-quiet">Delete copy?</span><button type="button" class="m-quiet" data-row="keep">Cancel</button><button type="button" class="m-confirm" data-row="confirm">Delete</button></span>`;
  if (p?.phase === 'deleting') return `<span class="morph"><span class="m-quiet"><i class="spin"></i>Deleting</span></span>`;
  if (p?.phase === 'restoring') return `<span class="morph"><span class="m-quiet"><i class="spin"></i>Restoring</span></span>`;
  if (p?.phase === 'gone') return `<span class="morph"><span class="m-ok">${I.check}Deleted</span><button type="button" data-row="undo">Undo <span class="num faint">${p.left}s</span></button></span>`;
  const dl = e.gone ? `<span class="faint" style="font-size:13px;padding:0 10px">Expired</span>`
    : `<button type="button" class="dl" data-row="dl" aria-label="Download ${n}"${state === 'offline' ? ' disabled' : ''}>${I.down}<span class="lbl">Download</span></button>`;
  return dl + `<button type="button" class="icon-btn del" data-row="del" aria-label="Delete ${n}" title="Delete copy">${I.trash}</button>`;
}
function renderPickAgg() {
  const act = tx.items.filter(t => t.dir === 'down' && ['downloading', 'queued'].includes(t.state));
  const files = host.files.filter(f => !hidden.has(f.id));
  const eta = tx.queueEta('down');
  $('pick-agg').innerHTML = act.length
    ? `<span class="rate">↓ ${rate(tx.speed('down'))}</span> · ${act.length} downloading · ${isFinite(eta) ? `${duration(eta)} · done ~${finishAt(eta)}` : 'estimating'}`
    : `${files.length} copies · ${bytes(files.reduce((n, f) => n + f.size, 0))} · newest first`;
}
function renderUsage() {
  const u = usage(host.files.filter(f => !hidden.has(f.id)), tx.items);
  $('used').innerHTML = `<b>${bytes(u.used)}</b> of ${bytes(u.budget, 0)}`;
  $('used').title = `${bytes(u.reserved)} reserved for unfinished uploads · ${bytes(u.free)} free`;
  ticks($('meter'), (u.used + u.reserved) / u.budget);
  $('free').textContent = `${bytes(u.free)} free · copies expire after 30 days`;
}

// ---------------------------------------------------------------------------------------------
// Selection (Elia's multi-select: the bar appears once something is picked)
function renderSelection() {
  const ids = [...sel.ids].filter(id => host.files.some(f => f.id === id) && !hidden.has(id));
  const bar = $('selbar'), n = $('seln');
  bar.classList.toggle('out', !ids.length);
  if (n.textContent !== String(ids.length) && ids.length) { n.textContent = ids.length; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
  $('selsize').textContent = ' · ' + bytes(ids.reduce((s, id) => s + host.files.find(f => f.id === id).size, 0));
  const shown = visible().filter(f => !expiresLabel(f).gone).map(f => f.id), all = $('selall');
  const k = shown.filter(id => sel.ids.has(id)).length;
  all.checked = !!shown.length && k === shown.length; all.indeterminate = k > 0 && k < shown.length;
  groupsEl.classList.toggle('picking', ids.length > 0);
  for (const row of groupsEl.querySelectorAll('.row')) { const on = sel.ids.has(row.dataset.id); row.classList.toggle('sel', on); row.querySelector('.check').checked = on; }
}
sel.addEventListener('change', renderSelection);
groupsEl.addEventListener('click', e => {
  const box = e.target.closest('.check');
  if (box) { const id = box.closest('.row').dataset.id; sel.toggle(id, visible().map(f => f.id), e.shiftKey); return; }
  const b = e.target.closest('[data-row]'); if (!b) return;
  const id = b.closest('.row').dataset.id, f = host.files.find(x => x.id === id);
  const act = b.dataset.row;
  if (act === 'dl') { tx.download(f); renderPickAgg(); }
  if (act === 'canceldl') { const t = tx.items.find(t => t.dir === 'down' && t.fileId === id && !['done', 'cancelled'].includes(t.state)); if (t) tx.cancel(t); updateRow(id); }
  if (act === 'del') { pending.set(id, { phase: 'confirm' }); updateRow(id); groupsEl.querySelector(`[data-id="${CSS.escape(id)}"] [data-row="confirm"]`)?.focus(); }
  if (act === 'keep') { pending.delete(id); updateRow(id); }
  if (act === 'confirm') deleteOne(id);
  if (act === 'undo') pending.get(id)?.handle?.undo();
});
async function deleteOne(id) {
  const p = { phase: 'deleting' }; pending.set(id, p); updateRow(id);
  await new Promise(r => setTimeout(r, 450));
  p.phase = 'gone'; p.left = 6; sel.ids.delete(id); renderSelection(); updateRow(id);
  p.handle = deferredDelete(host, [id], {
    grace: 6000,
    onTick: left => { if (p.left !== left) { p.left = Math.max(0, left); updateRow(id); } },
    onCommit: () => { const row = groupsEl.querySelector(`[data-id="${CSS.escape(id)}"]`); row?.classList.add('collapse'); setTimeout(() => { pending.delete(id); renderPick(); }, 360); },
    onUndo: () => { p.phase = 'restoring'; updateRow(id); setTimeout(() => { pending.delete(id); updateRow(id); }, 450); },
  });
}
$('selx').onclick = () => sel.clear();
$('selall').onchange = e => { const shown = visible().filter(f => !expiresLabel(f).gone).map(f => f.id); e.target.checked ? sel.set([...new Set([...sel.ids, ...shown])]) : sel.set([...sel.ids].filter(id => !shown.includes(id))); };
$('seldl').onclick = () => {
  const list = [...sel.ids].map(id => host.files.find(f => f.id === id)).filter(Boolean);
  for (const f of list) if (!tx.items.some(t => t.fileId === f.id && ['downloading', 'queued'].includes(t.state))) tx.download(f);
  sel.clear(); toast(`Downloading ${list.length} ${list.length === 1 ? 'file' : 'files'} · ${bytes(list.reduce((n, f) => n + f.size, 0))}`);
};
$('seldel').onclick = () => {
  const ids = [...sel.ids]; if (!ids.length) return;
  ids.forEach(id => hidden.add(id)); sel.clear(); renderPick();
  const h = deferredDelete(host, ids, { grace: 6000, onCommit: () => { ids.forEach(id => hidden.delete(id)); renderPick(); }, onUndo: () => { ids.forEach(id => hidden.delete(id)); renderPick(); } });
  toast(`${ids.length} ${ids.length === 1 ? 'copy' : 'copies'} deleted`, { action: 'Undo', onAction: () => h.undo(), ms: 6000, clockFrom: 6 });
};
addEventListener('keydown', e => {
  if (e.key === 'Escape' && sel.ids.size) sel.clear();
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); $('q').focus(); }
});
$('q').addEventListener('input', e => { query = e.target.value; renderPick(); });

// ---------------------------------------------------------------------------------------------
// Uploads: drop anywhere, choose, or press the surface
const drop = $('drop'), picker = $('picker');
function addFiles(list) {
  if (state !== 'shelf' && state !== 'empty') return;
  for (const file of list) tx.upload(file);
  if (phone()) setTab('send');
}
drop.onclick = () => picker.click();
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } };
picker.onchange = () => { addFiles([...picker.files]); picker.value = ''; };
let dragDepth = 0;
addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; drop.classList.add('over'); drop.querySelector('p').firstChild.textContent = 'Drop to send, or '; });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.classList.remove('over'); drop.querySelector('p').firstChild.textContent = 'Drag files here or '; } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; drop.classList.remove('over'); drop.querySelector('p').firstChild.textContent = 'Drag files here or '; if (e.dataTransfer?.files.length) addFiles([...e.dataTransfer.files]); });
queueEl.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const t = tx.items.find(t => String(t.id) === b.closest('[data-t]').dataset.t);
  ({ pause: () => tx.pause(t), resume: () => tx.resume(t), cancel: () => { tx.cancel(t); setTimeout(() => { tx.items = tx.items.filter(x => x !== t); renderSend(); renderUsage(); }, 1400); } })[b.dataset.act]();
});
$('clear').onclick = () => tx.clearDone();

tx.addEventListener('change', () => {
  if (state === 'locked' || state === 'loading') return;
  renderSend();
  for (const t of tx.items) if (t.dir === 'down' && t.fileId) updateRow(t.fileId);
  renderPickAgg();
  history($('send-hist'), 'up', upItems().some(t => t.state !== 'done' && t.state !== 'cancelled'));
  history($('pick-hist'), 'down', tx.items.some(t => t.dir === 'down' && !['done', 'cancelled'].includes(t.state)));
});
tx.addEventListener('done', e => {
  const t = e.detail;
  if (t.dir === 'up') {
    host.add(t); const card = queueEl.querySelector(`[data-t="${t.id}"]`);
    renderPick(); const row = groupsEl.querySelector('.row.fresh');
    swimAcross(card, row || $('pick'));
    setTimeout(() => { for (const f of host.files) if (f.fresh && f.name === t.name) f.fresh = false; groupsEl.querySelector('.row.fresh')?.classList.remove('fresh'); }, 9000);
  } else { saved.set(t.fileId, Date.now()); setTimeout(() => updateRow(t.fileId), 8100); }
});

// ---------------------------------------------------------------------------------------------
// Auto-refresh: every 60 s while visible, at once when the tab comes back.
const refresher = new AutoRefresh(async () => {
  if (state === 'offline') { await new Promise(r => setTimeout(r, 300)); throw new Error('offline'); }
  if (state !== 'shelf' && state !== 'empty') return;
  await host.list(); lastGood = new Date(); renderPick();
  const fresh = host.files.filter(f => f.fresh && !f.seen);
  if (fresh.length) { fresh.forEach(f => (f.seen = true)); setTimeout(() => { fresh.forEach(f => (f.fresh = false)); renderPick(); }, 10000); }
});
refresher.addEventListener('change', () => {
  const l = document.querySelector(".stamp .label"), b = $('refresh');
  b.classList.toggle('busy', refresher.busy);
  l.innerHTML = refresher.busy ? 'Refreshing…'
    : state === 'offline' ? `Offline · retry in <span class="num">${refresher.remaining}s</span>`
    : `Updated ${ago(Date.now() - refresher.last)} · next in <span class="num">${refresher.remaining}s</span>`;
});
$('refresh').onclick = () => refresher.now();
window.__proto = { tx, host, refresher }; // prototype hooks for screenshots

// ---------------------------------------------------------------------------------------------
// Tabs on the phone
function setTab(t) {
  tab = t;
  $('tab-send').setAttribute('aria-selected', t === 'send'); $('tab-pick').setAttribute('aria-selected', t === 'pick');
  if (phone()) { $('send').toggleAttribute('data-hidden', t !== 'send'); $('pick').toggleAttribute('data-hidden', t !== 'pick'); }
  else { $('send').removeAttribute('data-hidden'); $('pick').removeAttribute('data-hidden'); }
}
$('tab-send').onclick = () => setTab('send'); $('tab-pick').onclick = () => setTab('pick');
addEventListener('resize', () => setTab(tab));

// ---------------------------------------------------------------------------------------------
// Prototype states
let lockPond, lockMark;
function setState(next) {
  const prev = state; state = next;
  document.querySelectorAll('.proto button').forEach(b => b.setAttribute('aria-pressed', b.dataset.state === next));
  document.body.classList.toggle('locked', next === 'locked');
  for (const el of document.querySelectorAll('[data-live]')) el.hidden = next === 'locked' || next === 'loading';
  $('lockcard').hidden = $('lockpond').hidden = next !== 'locked';
  $('loading').hidden = next !== 'loading';
  $('lanes').hidden = next === 'loading'; document.querySelector('.tabs').style.visibility = next === 'loading' ? 'hidden' : '';
  if (next === 'locked') {
    sel.clear();
    requestAnimationFrame(() => {
      lockPond ||= new KoiPond($('lockpond'), { count: 6, size: [150, 240], opacity: 0.85, avoid: () => { const r = $('lockcard').getBoundingClientRect(); return [{ x: r.left, y: r.top - 52, w: r.width, h: r.height, dim: 0.12 }]; } });
      lockMark ||= new KoiMark($('lockmark'), { radius: 40 });
      lockPond.resize();
    });
  }
  if (next === 'loading') {
    const l = $('loading'); l.innerHTML = ''; l.append(orbitLoader(44)); l.insertAdjacentHTML('beforeend', '<span>Opening your shelf…</span>');
    setTimeout(() => { if (state === 'loading') setState('shelf'); }, 2600);
  }
  if (prev === 'offline' && next !== 'offline') { offlinePaused.forEach(t => tx.resume(t)); offlinePaused = []; }
  if (next === 'offline') {
    offlinePaused = tx.items.filter(t => ['uploading', 'downloading', 'queued'].includes(t.state)); offlinePaused.forEach(t => tx.pause(t));
    $('send-note').innerHTML = `<div class="note" role="status"><span><b>Can't reach the host.</b> Uploads paused; they continue from the same byte when it's back.</span><button type="button" data-retry>Retry</button></div>`;
    $('pick-note').innerHTML = `<div class="note" role="status"><span><b>Couldn't refresh.</b> Showing your shelf as of ${clock(lastGood)}.</span><button type="button" data-retry>Retry</button></div>`;
    document.querySelectorAll('[data-retry]').forEach(b => (b.onclick = () => refresher.now()));
    $('pick').classList.add('stale');
  } else { $('send-note').innerHTML = $('pick-note').innerHTML = ''; $('pick').classList.remove('stale'); }
  if (next === 'empty') { host = createHost(); host.files.splice(0); tx.items = []; hidden.clear(); pending.clear(); sel.clear(); }
  if (next === 'shelf' && (prev === 'empty' || prev === 'locked' || prev === 'loading')) { if (prev === 'empty' || !host.files.length) host = createHost(); hidden.clear(); pending.clear(); seedTransfers(); }
  if (next !== 'locked' && next !== 'loading') { renderSend(); renderPick(); setTab(tab); refresher.emit(); requestAnimationFrame(() => (channel ? channel.resize() : startChannel())); }
}
document.querySelector('.proto').addEventListener('click', e => { const b = e.target.closest('[data-state]'); if (b) setState(b.dataset.state); });
$('signout').onclick = () => setState('locked');
$('signin').onclick = () => setState('loading');

// ---------------------------------------------------------------------------------------------
seedTransfers();
setState(new URLSearchParams(location.search).get('state') || 'shelf');
if (state === 'locked') startChannel();
refresher.now();
window.__proto = { tx, host, refresher }; // prototype hooks for screenshots
