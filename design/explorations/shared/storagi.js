// Storagi design exploration — shared behaviour for every variant.
// Sample data and a simulated host. Nothing here talks to the real service; each piece maps onto
// an existing endpoint (/api/session, /api/files, /api/uploads, /api/files/:id[/download]).

export const NOW = new Date('2026-10-21T16:04:00+08:00');
// The prototype's clock starts at NOW when the page loads, so finish times agree with the sample data.
const LOADED = Date.now();
export const simNow = () => new Date(NOW.getTime() + Date.now() - LOADED);
// Sample times are in the owner's zone (UTC+8); show them there whatever zone the browser is in.
export const TZ = 'Asia/Singapore';
const GiB = 1024 ** 3, MiB = 1024 ** 2, KiB = 1024;
export const BUDGET = 200 * GiB;
const DAY = 86_400_000;

// ---------- sample shelf: one owner moving files between a Windows desktop, a Fedora KDE laptop and an Android phone ----------
const seed = [
  ['DCIM-pixel8-2026-10-19.zip',          7.84 * GiB, '2026-10-21T09:12:00+08:00'],
  ['obs-2026-10-20 22-14-03.mp4',         3.21 * GiB, '2026-10-20T23:02:00+08:00'],
  ['thesis-draft-v7.pdf',                 4.21 * MiB, '2026-10-20T17:45:00+08:00'],
  ['screenshot.png',                    812.4 * KiB, '2026-10-20T11:20:00+08:00'],
  ['screenshot.png',                    790.1 * KiB, '2026-10-19T19:03:00+08:00'],
  ['kde-dotfiles-2026-10.tar.zst',       36.8 * MiB, '2026-10-18T21:30:00+08:00'],
  ['lecture-07-signals.mp4',              1.12 * GiB, '2026-10-15T14:10:00+08:00'],
  ['blender-koi-scene.blend',           418.0 * MiB, '2026-10-09T01:47:00+08:00'],
  ['passport-scan.pdf',                   2.30 * MiB, '2026-09-24T08:15:00+08:00'],
  ['windows-installer-backup.zip',       11.6 * GiB, '2026-09-23T20:40:00+08:00'],
  ['dji-mini-flight-0912.mp4',            2.74 * GiB, '2026-09-21T16:22:00+08:00'],
  ['old-phone-whatsapp-media.zip',        5.05 * GiB, '2026-09-19T12:00:00+08:00'],
];
const hex = n => (n >>> 0).toString(16).padStart(8, '0');
export function makeFiles() {
  return seed.map(([name, size, at], i) => {
    const uploadedAt = new Date(at);
    return { id: 'f_' + hex(0x9e3779b9 * (i + 7)) + hex(i * 2654435761), name, size: Math.round(size), uploadedAt, expiresAt: new Date(uploadedAt.getTime() + 30 * DAY) };
  });
}
// A file that "arrives" from another device on a later auto-refresh, to show why refreshing matters.
export const ARRIVAL = { name: 'PXL_20261021_080412.mp4', size: Math.round(684.2 * MiB) };

// ---------- formatting (IEC units, as the real app's bytes()) ----------
export function bytes(v, digits = 1) {
  if (!v) return '0 B';
  const u = Math.min(4, Math.floor(Math.log(v) / Math.log(1024)));
  return `${(v / 1024 ** u).toFixed(u ? digits : 0)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][u]}`;
}
export const rate = v => (v > 0 ? `${bytes(v)}/s` : '—');
export function duration(s) {
  if (!isFinite(s) || s < 0) return '—';
  s = Math.ceil(s);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m`;
}
export function clock(date) { return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }); }
export function finishAt(seconds) { return isFinite(seconds) ? clock(new Date(simNow().getTime() + seconds * 1000)) : '—'; }
export function relDay(d, now = NOW) {
  const day = x => Math.floor((new Date(x).getTime() + 8 * 3_600_000) / DAY); // calendar day in UTC+8
  const days = day(now) - day(d), a = new Date(d);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return a.toLocaleDateString('en-GB', { weekday: 'long', timeZone: TZ });
  return a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
}
export function daysLeft(file, now = NOW) { return Math.max(0, Math.floor((file.expiresAt - now) / DAY)); }
export const ext = name => (name.includes('.') ? name.split('.').pop().slice(0, 4).toLowerCase() : 'file');
export const shortId = id => id.slice(-6);
export function ago(ms) { const s = Math.round(ms / 1000); return s < 5 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`; }

// ---------- usage, computed from the rows (never typed in) ----------
export function usage(files, transfers = []) {
  const used = files.reduce((n, f) => n + f.size, 0);
  const reserved = transfers.filter(t => t.dir === 'up' && !['done', 'cancelled'].includes(t.state)).reduce((n, t) => n + (t.size - t.sent), 0);
  console.assert(used + reserved <= BUDGET, 'sample shelf exceeds budget');
  return { used, reserved, budget: BUDGET, free: BUDGET - used - reserved };
}

// ---------- ASCII tick bar (Kevser's segmented progress, as text) ----------
export function ticks(el, ratio, { glyph = '|', off = '|' } = {}) {
  const ch = el._ch || (el._ch = measureCh(el));
  const n = Math.max(8, Math.floor(el.clientWidth / ch));
  const on = Math.round(Math.max(0, Math.min(1, ratio)) * n);
  if (el._n === n && el._on === on) return;
  el._n = n; el._on = on;
  el.innerHTML = `<span class="on">${glyph.repeat(on)}</span><span class="off">${off.repeat(n - on)}</span>`;
}
function measureCh(el) { const s = document.createElement('span'); s.textContent = '||||||||||'; s.style.visibility = 'hidden'; el.append(s); const w = s.getBoundingClientRect().width / 10; s.remove(); return w || 7; }

// ---------- transfer simulator: uploads one at a time (as the real tus queue), downloads in parallel ----------
// Speed is an exponential moving average over 1 s windows; ETA = remaining / speed, shown after 2 s of samples.
export class Transfers extends EventTarget {
  constructor({ upLink = 9.5 * MiB, downLink = 24 * MiB } = {}) {
    super(); this.items = []; this.upLink = upLink; this.downLink = downLink; this.seq = 0; this.history = [];
    this._t = setInterval(() => this.tick(0.25), 250);
  }
  add(dir, name, size, extra = {}) {
    const t = { id: ++this.seq, dir, name, size, sent: 0, state: 'queued', speed: 0, window: 0, elapsed: 0, started: 0, ...extra };
    this.items.push(t); this.emit(); return t;
  }
  upload(file) { return this.add('up', file.name, file.size); }
  download(file) { return this.add('down', file.name, file.size, { fileId: file.id }); }
  pause(t) { if (['uploading', 'downloading', 'queued'].includes(t.state)) { t.state = 'paused'; t.speed = 0; this.emit(); } }
  resume(t) { if (['paused', 'error'].includes(t.state)) { t.state = 'queued'; this.emit(); } }
  cancel(t) { t.state = 'cancelled'; t.speed = 0; this.emit(); }
  clearDone() { this.items = this.items.filter(t => !['done', 'cancelled'].includes(t.state)); this.emit(); }
  active(dir) { return this.items.filter(t => t.dir === dir && (t.state === 'uploading' || t.state === 'downloading')); }
  open() { return this.items.filter(t => !['done', 'cancelled'].includes(t.state)); }
  tick(dt) {
    if (!this.items.some(t => t.state === 'uploading')) { const next = this.items.find(t => t.dir === 'up' && t.state === 'queued'); if (next) { next.state = 'uploading'; next.started = Date.now(); } }
    for (const t of this.items) if (t.dir === 'down' && t.state === 'queued') { t.state = 'downloading'; t.started = Date.now(); }
    const now = Date.now() / 1000;
    for (const dir of ['up', 'down']) {
      const act = this.active(dir); if (!act.length) continue;
      const link = (dir === 'up' ? this.upLink : this.downLink) * (0.82 + 0.3 * Math.sin(now / 3.1 + (dir === 'up' ? 0 : 2)) * Math.sin(now / 1.7) + 0.08 * Math.random());
      for (const t of act) {
        const step = Math.min(t.size - t.sent, (link / act.length) * dt);
        t.sent += step; t.window += step; t.elapsed += dt;
        if (t.elapsed % 1 < dt) { t.speed = t.speed ? t.speed * 0.7 + t.window * 0.3 : t.window; t.window = 0; }
        if (t.sent >= t.size) { t.sent = t.size; t.state = 'done'; t.speed = 0; this.dispatchEvent(new CustomEvent('done', { detail: t })); }
      }
    }
    const up = this.speed('up'), down = this.speed('down');
    this.history.push({ up, down }); if (this.history.length > 120) this.history.shift();
    this.emit();
  }
  speed(dir) { return this.active(dir).reduce((n, t) => n + t.speed, 0); }
  eta(t) { return t.elapsed >= 2 && t.speed > 0 ? (t.size - t.sent) / t.speed : NaN; }
  // Queue ETA for uploads: everything still to send, at the current upload speed.
  queueEta(dir = 'up') {
    const left = this.items.filter(t => t.dir === dir && ['queued', 'uploading', 'downloading'].includes(t.state)).reduce((n, t) => n + t.size - t.sent, 0);
    const s = this.speed(dir); const warm = this.active(dir).some(t => t.elapsed >= 2);
    return left && s && warm ? left / s : NaN;
  }
  emit() { this.dispatchEvent(new Event('change')); }
}

// ---------- auto-refresh: every 60 s while the tab is visible, at once on return, never while hidden ----------
export class AutoRefresh extends EventTarget {
  constructor(fetcher, { every = 60_000 } = {}) {
    super(); this.fetcher = fetcher; this.every = every; this.last = Date.now(); this.next = this.last + every; this.busy = false;
    this._t = setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - this.last > 10_000) this.now(); });
  }
  get remaining() { return Math.max(0, Math.ceil((this.next - Date.now()) / 1000)); }
  tick() { if (document.visibilityState !== 'visible') return; if (Date.now() >= this.next) this.now(); else this.emit(); }
  async now() {
    if (this.busy) return; this.busy = true; this.emit();
    try { await this.fetcher(); this.error = null; } catch (e) { this.error = e; }
    this.busy = false; this.last = Date.now(); this.next = this.last + this.every; this.emit();
  }
  emit() { this.dispatchEvent(new Event('change')); }
}

// ---------- the simulated host ----------
export function createHost() {
  const files = makeFiles();
  let refreshes = 0;
  return {
    files,
    async list() { await wait(380); if (++refreshes === 2) files.unshift({ id: 'f_' + hex(Date.now()) + 'a1b2c3d4', ...ARRIVAL, uploadedAt: new Date(NOW.getTime() - 60_000), expiresAt: new Date(NOW.getTime() + 30 * DAY - 60_000), fresh: true }); return files; },
    async remove(ids) { await wait(520); for (const id of ids) { const i = files.findIndex(f => f.id === id); if (i >= 0) files.splice(i, 1); } },
    add(t) { files.unshift({ id: 'f_' + hex(Date.now()) + hex(t.id * 977), name: t.name, size: t.size, uploadedAt: simNow(), expiresAt: new Date(simNow().getTime() + 30 * DAY), fresh: true }); },
  };
}
export const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- selection with shift-range (Elia's multi-select) ----------
export class Selection extends EventTarget {
  constructor() { super(); this.ids = new Set(); this.anchor = null; }
  toggle(id, order, shift) {
    if (shift && this.anchor && order) {
      const a = order.indexOf(this.anchor), b = order.indexOf(id);
      if (a >= 0 && b >= 0) { const on = !this.ids.has(id); for (const x of order.slice(Math.min(a, b), Math.max(a, b) + 1)) on ? this.ids.add(x) : this.ids.delete(x); this.emit(); return; }
    }
    this.ids.has(id) ? this.ids.delete(id) : this.ids.add(id); this.anchor = id; this.emit();
  }
  set(ids) { this.ids = new Set(ids); this.emit(); }
  clear() { this.ids.clear(); this.anchor = null; this.emit(); }
  emit() { this.dispatchEvent(new Event('change')); }
}

// ---------- delete with undo: the copy hides at once, the DELETE is sent when the grace ends ----------
// The real service deletes immediately, so the grace lives in the client; leaving the page inside it keeps the file (the safe side).
export function deferredDelete(host, ids, { grace = 6000, onCommit, onUndo, onTick } = {}) {
  let left = grace, done = false;
  const t = setInterval(() => { left -= 250; onTick?.(Math.ceil(left / 1000)); if (left <= 0) commit(); }, 250);
  async function commit() { if (done) return; done = true; clearInterval(t); await host.remove(ids); onCommit?.(); }
  return { undo() { if (done) return; done = true; clearInterval(t); onUndo?.(); }, commit };
}

// ---------- one toast at a time ----------
export function toast(message, { action, onAction, ms = 4000, clockFrom } = {}) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast out'; el.setAttribute('role', 'status');
  el.innerHTML = `<span></span>${clockFrom ? '<span class="clock"></span>' : ''}${action ? '<button type="button"></button>' : ''}`;
  el.firstChild.textContent = message;
  if (action) { const b = el.querySelector('button'); b.textContent = action; b.onclick = () => { onAction?.(); close(); }; }
  document.body.append(el); requestAnimationFrame(() => el.classList.remove('out'));
  let left = clockFrom || 0; const c = el.querySelector('.clock'); if (c) c.textContent = `${left}s`;
  const iv = clockFrom ? setInterval(() => { left--; if (c) c.textContent = `${left}s`; }, 1000) : 0;
  const to = setTimeout(close, ms);
  function close() { clearTimeout(to); clearInterval(iv); el.classList.add('out'); setTimeout(() => el.remove(), 300); }
  return { close, el };
}

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
