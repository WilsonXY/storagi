import type { Selection } from './selection';
import { gesturePref } from './preferences';
type Swipe = { row: HTMLElement; under: HTMLElement; x: number; limit: number };
type Gesture = { id: string; pid: number; touch: boolean; lead: boolean; x: number; y: number; at: number; mode: 'pending' | 'paint' | 'swipe'; hold?: ReturnType<typeof setTimeout>; swipe?: Swipe };
export function rowGestures(groups: HTMLElement, selection: Selection, order: () => string[], engaged: (id: string) => boolean, remove: (id: string) => void, render: () => void, signal: AbortSignal) {
  let g: Gesture | undefined, wheel: { swipe: Swipe; dx: number; timer?: ReturnType<typeof setTimeout> } | undefined, eat = false, frame = 0, settling = false, dead = false;
  const on = (target: EventTarget, type: string, fn: (e: any) => void, passive = true) => target.addEventListener(type, fn, { signal, passive });
  function startSwipe(row: HTMLElement): Swipe {
    const under = document.createElement('div'); under.className = 'swipe-under'; under.setAttribute('aria-hidden', 'true'); under.textContent = 'Delete';
    under.style.top = `${row.offsetTop}px`; under.style.height = `${row.offsetHeight}px`; row.before(under); row.classList.add('swiping');
    return { row, under, x: 0, limit: Math.min(160, row.offsetWidth * .34) };
  }
  function slide(s: Swipe, dx: number) { s.x = Math.min(0, Math.max(-s.limit * 1.6, dx)); s.row.style.transform = `translateX(${s.x}px)`; s.under.classList.toggle('armed', -s.x >= s.limit); }
  function finishSwipe(s: Swipe, commit: boolean) {
    const armed = commit && -s.x >= s.limit;
    settling = true;
    const finish = () => {
      s.under.remove(); s.row.style.transform = ''; s.row.classList.remove('swiping'); settling = false;
      if (!dead) { if (armed) remove(s.row.dataset.id!); else render(); }
    };
    if (s.row.animate) {
      s.row.animate([{ transform: `translateX(${s.x}px)` }, { transform: armed ? 'translateX(-104%)' : 'none', opacity: armed ? .4 : 1 }],
        { duration: armed ? 200 : 320, easing: armed ? 'cubic-bezier(0.32, 0.72, 0, 1)' : 'cubic-bezier(0.34, 1.4, 0.64, 1)' }).finished.then(finish, finish);
    } else finish();
  }
  function paint() {
    if (!g || g.mode !== 'paint') return;
    const rows = [...groups.querySelectorAll<HTMLElement>('.row')];
    let row = rows.find(r => r.getBoundingClientRect().bottom >= g!.at) ?? rows.at(-1);
    if (row && rows.indexOf(row) > 0 && row.getBoundingClientRect().top > g.at) row = rows[rows.indexOf(row) - 1];
    if (row) selection.dragTo(row.dataset.id!);
  }
  function scrollEdge() {
    if (!g || g.mode !== 'paint') return;
    const top = (document.querySelector('.top')?.getBoundingClientRect().bottom ?? 52) + (innerWidth <= 860 ? 66 : 0), edge = 72;
    const delta = g.at > innerHeight - edge ? g.at - (innerHeight - edge) : g.at < top + edge ? g.at - (top + edge) : 0;
    if (delta) { window.scrollBy(0, delta / 4); paint(); } frame = requestAnimationFrame(scrollEdge);
  }
  function startPaint() { if (!g) return; g.mode = 'paint'; selection.beginDrag(g.id, order()); document.body.classList.add('painting'); paint(); frame = requestAnimationFrame(scrollEdge); }
  function end(commit = false) {
    if (!g) return; const old = g; g = undefined; clearTimeout(old.hold); cancelAnimationFrame(frame); document.body.classList.remove('painting');
    if (old.mode !== 'pending') { eat = true; setTimeout(() => { eat = false; }, 0); }
    if (old.mode === 'paint') { selection.endDrag(); render(); }
    if (old.swipe) finishSwipe(old.swipe, commit);
  }
  on(groups, 'pointerdown', (e: PointerEvent) => {
    if (gesturePref() !== 'on' || e.button !== 0 || g || wheel) return;
    const row = (e.target as Element).closest<HTMLElement>('.row'); if (!row || engaged(row.dataset.id!)) return;
    g = { id: row.dataset.id!, pid: e.pointerId, touch: e.pointerType === 'touch', lead: !!(e.target as Element).closest('.lead'), x: e.clientX, y: e.clientY, at: e.clientY, mode: 'pending' };
    if (g.touch && !g.lead) { const current = g; g.hold = setTimeout(() => { if (g === current && g.mode === 'pending') { startPaint(); navigator.vibrate?.(8); } }, 400); }
  });
  on(window, 'pointermove', (e: PointerEvent) => {
    if (!g || e.pointerId !== g.pid) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.mode === 'pending') {
      if (Math.hypot(dx, dy) < 8) return; clearTimeout(g.hold);
      const sideways = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!g.lead && sideways && dx < 0) { g.mode = 'swipe'; const row = [...groups.querySelectorAll<HTMLElement>('.row')].find(r => r.dataset.id === g!.id)!; g.swipe = startSwipe(row); }
      else if (g.lead || !g.touch && !sideways) startPaint(); else return end();
    }
    if (!g) return; g.at = e.clientY; if (g.mode === 'paint') paint(); if (g.swipe) slide(g.swipe, dx);
  });
  on(window, 'pointerup', (e: PointerEvent) => { if (g?.pid === e.pointerId) end(true); });
  on(window, 'pointercancel', (e: PointerEvent) => { if (g?.pid === e.pointerId) end(); });
  on(groups, 'touchmove', (e: TouchEvent) => { if (g && g.mode !== 'pending') e.preventDefault(); }, false);
  on(groups, 'contextmenu', (e: Event) => { if (g?.touch) e.preventDefault(); }, false);
  window.addEventListener('click', e => { if (eat) { eat = false; e.preventDefault(); e.stopPropagation(); } }, { capture: true, signal });
  on(groups, 'wheel', (e: WheelEvent) => {
    if (gesturePref() !== 'on' || g || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    if (!wheel) { const row = (e.target as Element).closest<HTMLElement>('.row'); if (!row || engaged(row.dataset.id!) || e.deltaX < 0) return; wheel = { swipe: startSwipe(row), dx: 0 }; }
    e.preventDefault(); wheel.dx = Math.min(0, wheel.dx - e.deltaX); slide(wheel.swipe, wheel.dx); clearTimeout(wheel.timer);
    wheel.timer = setTimeout(() => { const old = wheel!; wheel = undefined; finishSwipe(old.swipe, true); }, 140);
  }, false);
  return { busy: () => settling || !!wheel || !!g && g.mode !== 'pending', destroy() { dead = true; end(); if (wheel) { clearTimeout(wheel.timer); wheel.swipe.under.remove(); wheel = undefined; } cancelAnimationFrame(frame); } };
}
