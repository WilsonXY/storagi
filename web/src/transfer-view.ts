import { bytes, rate, duration, finishAt } from './formatting';
import { TransferMetrics } from './transfer-metrics';
import { blocks, blockCount } from './ui';
export type Transfer = {
  id: number; name: string; size: number; sent: number; dir: 'up' | 'down'; metrics: TransferMetrics;
  state: 'queued' | 'uploading' | 'downloading' | 'paused' | 'error' | 'done' | 'cancelled' | 'cancelling';
  message: string; action?: (action: string) => void; ended?: number; leaving?: boolean;
};
export function createTransferView(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const items: Transfer[] = [], history: { up: number; down: number }[] = [];
  let serial = 0, dead = false;
  const live = (t: Transfer) => ['uploading', 'downloading'].includes(t.state);
  const open = () => items.filter(t => !['done', 'cancelled'].includes(t.state));
  function render(t: Transfer) {
    if (dead) return;
    let row = $(`#tr-list [data-tid="${t.id}"]`);
    if (!row) {
      row = document.createElement('li'); row.className = 'tr'; row.dataset.tid = String(t.id);
      row.innerHTML = '<div class="tr-top"><span class="arrow" aria-hidden="true"></span><span class="tr-name"></span><span class="tr-acts"></span></div><span class="blocks" aria-hidden="true"></span><div class="tr-meta"><span class="amt"></span><span class="tr-pct"></span></div><div class="tr-meta"><span class="speed"></span><span class="left"></span></div><p class="tr-error" hidden></p><span class="tr-status sr-only"></span>';
      row.querySelector('.tr-name')!.textContent = t.name; row.querySelector('.tr-name')!.setAttribute('title', t.name);
      const arrow = row.querySelector('.arrow')!; arrow.textContent = t.dir === 'up' ? '↑' : '↓'; arrow.classList.toggle('up', t.dir === 'up');
      $('#tr-list').append(row);
    }
    row.className = `tr ${t.state}${t.leaving ? ' leaving' : ''}`;
    const ratio = t.size ? Math.min(1, t.sent / t.size) : t.state === 'done' ? 1 : 0;
    const status = ({ queued: 'Waiting its turn', uploading: 'Uploading', downloading: 'Downloading', paused: 'Paused · ready to resume', error: t.message, done: t.dir === 'up' ? 'On your shelf' : 'Saved to this device', cancelled: 'Cancelled', cancelling: 'Cancelling…' })[t.state];
    row.querySelector('.tr-status')!.textContent = `${status} · ${bytes(t.sent)} / ${bytes(t.size)}`;
    row.querySelector('.amt')!.textContent = t.state === 'done' ? status : `${bytes(t.sent)} of ${bytes(t.size)}`;
    row.querySelector('.tr-pct')!.textContent = t.state === 'done' ? '✓' : `${Math.floor(ratio * 100)}%`;
    row.querySelector('.speed')!.textContent = live(t) ? rate(t.metrics.speed) : t.state === 'error' ? 'Interrupted' : t.state === 'done' ? '' : status;
    row.querySelector('.left')!.textContent = live(t) ? Number.isFinite(t.metrics.eta()) ? `${duration(t.metrics.eta())} left` : 'measuring…' : '';
    const error = row.querySelector<HTMLElement>('.tr-error')!; error.hidden = t.state !== 'error'; error.textContent = t.message;
    const bar = row.querySelector<HTMLElement>('.blocks')!, n = blockCount(bar), on = Math.round(ratio * n);
    bar.classList.toggle('done', t.state === 'done'); blocks(bar, [[on, 'on'], [n - on, 'off']]);
    const acts = row.querySelector<HTMLElement>('.tr-acts')!;
    if (acts.dataset.state !== t.state) {
      acts.dataset.state = t.state;
      const actions = t.dir === 'down' ? (live(t) || t.state === 'queued' ? ['cancel'] : []) : t.state === 'uploading' ? ['pause', 'cancel'] : ['paused', 'error'].includes(t.state) ? ['resume', 'cancel'] : t.state === 'queued' ? ['cancel'] : [];
      acts.replaceChildren(...actions.map(action => {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.action = action;
        b.textContent = action === 'resume' && t.state === 'error' ? 'Retry' : action[0].toUpperCase() + action.slice(1);
        b.setAttribute('aria-label', `${b.textContent} ${t.name}`); b.onclick = () => t.action?.(action); return b;
      }));
    }
    if (['done', 'cancelled'].includes(t.state)) t.ended ??= Date.now();
    summary();
  }
  function summary() {
    const active = (dir: string) => items.filter(t => t.dir === dir && live(t));
    const up = active('up').reduce((s, t) => s + t.metrics.speed, 0), down = active('down').reduce((s, t) => s + t.metrics.speed, 0);
    for (const id of ['nav-open', 'tab-open', 'det-open']) $(`#${id}`).textContent = String(open().length);
    $('#tr-empty').hidden = items.length > 0;
    for (const [dir, speed] of [['up', up], ['down', down]] as const) { const el = $(`#rate-${dir}`); el.textContent = active(dir).length ? rate(speed) : 'idle'; el.classList.toggle('idle', !active(dir).length); }
    const eta = (dir: string) => {
      const ts = items.filter(t => t.dir === dir && ['queued', 'uploading', 'downloading'].includes(t.state));
      const speed = active(dir).reduce((s, t) => s + (Number.isFinite(t.metrics.eta()) ? t.metrics.speed : 0), 0);
      return ts.length && speed > 0 ? ts.reduce((s, t) => s + t.size - t.sent, 0) / speed : NaN;
    };
    $('#eta').replaceChildren();
    for (const [dir, label] of [['up', 'Uploads'], ['down', 'Downloads']]) {
      const pending = items.filter(t => t.dir === dir && ['queued', 'uploading', 'downloading'].includes(t.state)); if (!pending.length) continue;
      const row = document.createElement('div'), seconds = eta(dir), queued = pending.filter(t => t.state === 'queued').length;
      row.innerHTML = `<dt>${label}, est.</dt><dd class="mono">${Number.isFinite(seconds) ? `<b>${finishAt(seconds)}</b> · ${duration(seconds)}` : 'measuring…'}</dd>${queued ? `<dd class="note">${queued} more queued</dd>` : ''}`; $('#eta').append(row);
    }
    $('#eta').hidden = !$('#eta').children.length;
    const pulse = $('#pulse-line'); pulse.hidden = !open().length;
    pulse.innerHTML = `<span class="up">↑ ${active('up').length ? rate(up) : '—'}</span><span>↓ ${active('down').length ? rate(down) : '—'}</span><span>${Number.isFinite(eta('up')) ? `est. ${finishAt(eta('up'))}` : `${open().length} open`} · View</span>`;
    return { up, down };
  }
  const timer = setInterval(() => {
    if (!root.isConnected) return;
    for (const t of [...items]) {
      if (live(t)) { t.metrics.progress(t.sent, t.size); render(t); }
      if (t.ended && Date.now() - t.ended >= 4000) {
        if (!t.leaving) { t.leaving = true; render(t); }
        else { $(`[data-tid="${t.id}"]`)?.remove(); items.splice(items.indexOf(t), 1); }
      }
    }
    history.push(summary()); if (history.length > 30) history.shift();
    $('.chart').hidden = !history.some(p => p.up || p.down);
    const width = Math.max(10, Math.floor($('#chart-up').clientWidth / 6.6)), peak = (key: 'up' | 'down') => Math.max(1, ...history.map(p => p[key]));
    for (const [dir, n] of [['up', 3], ['down', 2]] as const) {
      const values = Array.from({ length: width }, (_, i) => history[Math.min(history.length - 1, Math.floor(i * history.length / width))][dir]);
      $(`#chart-${dir}`).textContent = Array.from({ length: n }, (_, r) => values.map(x => {
        const level = x / peak(dir) * n - (dir === 'up' ? n - r - 1 : r);
        return dir === 'down' ? level >= 1 ? '█' : level >= .5 ? '▀' : level > .08 && r === 0 ? '▔' : ' ' : ' ▁▂▃▄▅▆▇█'[Math.max(0, Math.min(8, Math.ceil(level * 8)))];
      }).join('')).join('\n');
    }
    $('#chart-base').textContent = '─'.repeat(width);
    $('#chart-max').textContent = `peak ↑ ${peak('up') > 1 ? rate(peak('up')) : '—'} · ↓ ${peak('down') > 1 ? rate(peak('down')) : '—'}`;
  }, 1000);
  summary();
  return { items, open, render, add(name: string, size: number, dir: 'up' | 'down'): Transfer {
    const t: Transfer = { id: serial++, name, size, dir, sent: 0, state: 'queued', message: '', metrics: new TransferMetrics() }; items.push(t); return t;
  }, destroy() { dead = true; clearInterval(timer); } };
}
