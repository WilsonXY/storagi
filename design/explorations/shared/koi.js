// Storagi design exploration — the koi layer.
//   KoiPond  — koi drawn in glyph cells swimming behind the interface (after stackedlol's ASCII sharks, via @sundyme).
//   KoiMark  — a stippled koi whose dots run from the cursor and spring home (after Emil Kowalski's dithered Linear icon).
//   orbitLoader — a tick ring with a solid ring passing through it (after Emil Kowalski's loader).
//   blocks   — a one-line ASCII bar chart for throughput history.
// Each fish is painted as flat shapes into a small offscreen canvas, then read back one cell at a time and
// re-drawn as a character whose density follows the coverage. Reduced motion draws one still frame.

const RAMP = ' .·:;-=+oxsSX%8@';
const PALETTE = { white: [236, 232, 225], koi: [255, 91, 53], sumi: [70, 70, 74], gold: [242, 179, 61] };
const VARIETIES = [
  { name: 'kohaku', body: 'white', patches: [['koi', 0.08, 0, 0.13], ['koi', 0.33, 0.25, 0.12], ['koi', 0.52, -0.2, 0.1]] },
  { name: 'showa', body: 'white', patches: [['koi', 0.1, 0.1, 0.12], ['sumi', 0.36, -0.2, 0.12], ['koi', 0.5, 0.2, 0.1], ['sumi', 0.66, 0, 0.07]] },
  { name: 'tancho', body: 'white', patches: [['koi', 0.07, 0, 0.09]] },
  { name: 'ogon', body: 'gold', patches: [] },
  { name: 'sanke', body: 'white', patches: [['koi', 0.2, 0.2, 0.13], ['sumi', 0.4, -0.25, 0.06], ['koi', 0.56, -0.1, 0.1], ['sumi', 0.62, 0.3, 0.05]] },
];

// Half-width of the body at s (0 = nose, 1 = tail tip), as a fraction of length.
function halfWidth(s) {
  if (s < 0.1) return 0.095 * Math.sqrt(1 - ((0.1 - s) / 0.1) ** 2);
  if (s < 0.3) return 0.095 + 0.02 * Math.sin((s - 0.1) / 0.2 * Math.PI / 2);
  if (s < 0.84) return 0.022 + 0.093 * (0.5 + 0.5 * Math.cos((s - 0.3) / 0.54 * Math.PI));
  return 0.022;
}

// Spine positions for a fish whose nose is at (x, y) heading `a`, bending with `phase` and turning by `turn`.
function spine(f, n = 24) {
  const pts = [[f.x, f.y]]; let ang = f.a + Math.PI, x = f.x, y = f.y; const step = f.len / n;
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    ang += (f.amp * Math.cos(f.phase - s * 5.2) * 0.22 + f.turn * 0.9) / n * (0.4 + s * 1.6);
    x += Math.cos(ang) * step; y += Math.sin(ang) * step; pts.push([x, y]);
  }
  return pts;
}

function paintFish(ctx, f, sx, sy) {
  const pts = spine(f), n = pts.length - 1, L = f.len;
  const at = (s, u) => { // point at spine position s, lateral offset u (fraction of L)
    const i = Math.min(n - 1, Math.floor(s * n)), t = s * n - i;
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
    return [(x0 + dx * t - dy / d * u * L) * sx, (y0 + dy * t + dx / d * u * L) * sy];
  };
  const col = (k, a = 1) => `rgba(${PALETTE[k].join(',')},${a})`;
  // fins first, fainter, so the body sits over them
  ctx.fillStyle = col(f.v.body, 0.42);
  for (const side of [1, -1]) {
    const sw = Math.sin(f.phase * 0.7 + side) * 0.05;
    poly(ctx, [at(0.2, side * 0.09), at(0.3 + sw, side * (0.27 + sw)), at(0.4, side * 0.22), at(0.33, side * 0.08)]);
    poly(ctx, [at(0.54, side * 0.05), at(0.63, side * 0.14), at(0.67, side * 0.05)]);
  }
  const tw = Math.sin(f.phase - 5.2) * 0.04;
  poly(ctx, [at(0.82, 0.02), at(1.08, 0.13 + tw), at(1.0, 0.015), at(1.08, -0.13 + tw), at(0.82, -0.02)]);
  // body
  const left = [], right = [];
  for (let i = 0; i <= 30; i++) { const s = i / 30 * 0.9; left.push(at(s, halfWidth(s))); right.push(at(s, -halfWidth(s))); }
  ctx.save(); ctx.beginPath(); trace(ctx, [...left, ...right.reverse()]); ctx.closePath();
  ctx.fillStyle = col(f.v.body); ctx.fill(); ctx.clip();
  for (const [k, s, u, r] of f.v.patches) { const [px, py] = at(s, u * 0.4); ctx.fillStyle = col(k); ctx.beginPath(); ctx.ellipse(px, py, r * 0.95 * L * sx * 1.3, r * 0.95 * L * sy, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}
const trace = (ctx, p) => { ctx.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) ctx.lineTo(q[0], q[1]); };
const poly = (ctx, p) => { ctx.beginPath(); trace(ctx, p); ctx.closePath(); ctx.fill(); };

// ---------------------------------------------------------------------------------------------
export class KoiPond {
  // opts: count, size [min,max] px, font px, cells (tinted squares behind glyphs), avoid() -> rects the fish pass under,
  //       opacity, ripples, flee (cursor radius, 0 to disable)
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.o = { count: 5, size: [150, 260], font: 11, cells: true, opacity: 1, ripples: true, flee: 150, speed: 1, avoid: () => [], ...opts };
    this.buf = document.createElement('canvas'); this.bctx = this.buf.getContext('2d', { willReadFrequently: true });
    this.fish = []; this.trail = []; this.mouse = null; this.last = 0;
    this.resize(); addEventListener('resize', () => this.resize());
    const host = this.o.pointerTarget || window;
    host.addEventListener('pointermove', e => { const r = this.c.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top]; });
    host.addEventListener('pointerleave', () => (this.mouse = null));
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A pond made while its screen is hidden has no size yet: seed the fish, and in reduced motion paint the
    // still frame, whenever the canvas gets a size, not only at construction.
    new ResizeObserver(() => { if (this.dead) return; this.resize(); if (this.still) this.paintStill(); }).observe(canvas);
    if (this.still) this.paintStill();
    else requestAnimationFrame(t => this.loop(t));
  }
  seed() { if (this.seeded || !this.w) return; this.seeded = true; for (let i = 0; i < this.o.count; i++) this.spawn(i, true); }
  paintStill() { if (!this.w) return; if (!this.seeded) { this.seed(); for (let i = 0; i < 40; i++) this.step(0.05); } this.draw(); }
  destroy() { this.dead = true; this.ctx.clearRect(0, 0, this.w || 0, this.h || 0);
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = this.c.getBoundingClientRect();
    if (!r.width || !r.height) { this.w = 0; return; }
    this.w = r.width; this.h = r.height; this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.font = `500 ${this.o.font}px "JetBrains Mono", ui-monospace, monospace`; this.ctx.textBaseline = 'top';
    this.cw = Math.ceil(this.ctx.measureText('M').width); this.chh = Math.round(this.o.font * 1.25);
    this.cols = Math.ceil(this.w / this.cw); this.rows = Math.ceil(this.h / this.chh);
    this.buf.width = this.cols * 2; this.buf.height = this.rows * 2;
  }
  spawn(i, anywhere) {
    const [a, b] = this.o.size, len = a + Math.random() * (b - a);
    const edge = Math.random() * 4 | 0, m = len;
    const x = anywhere ? Math.random() * this.w : [-m, this.w + m, Math.random() * this.w, Math.random() * this.w][edge];
    const y = anywhere ? Math.random() * this.h : [Math.random() * this.h, Math.random() * this.h, -m, this.h + m][edge];
    const toward = Math.atan2(this.h / 2 - y, this.w / 2 - x) + (Math.random() - 0.5) * 1.4;
    this.fish[i] = { x, y, a: anywhere ? Math.random() * 7 : toward, len, v: VARIETIES[(i + (Math.random() * 5 | 0)) % VARIETIES.length], phase: Math.random() * 7, amp: 1, turn: 0, wander: Math.random() * 7, speed: (26 + Math.random() * 18) * this.o.speed, boost: 0, drop: 0 };
  }
  step(dt) {
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      f.wander += dt * 0.35; let want = Math.sin(f.wander) * 0.5 + Math.sin(f.wander * 2.3 + i) * 0.25;
      if (this.mouse && this.o.flee) {
        const dx = f.x - this.mouse[0], dy = f.y - this.mouse[1], d = Math.hypot(dx, dy);
        if (d < this.o.flee) { const away = Math.atan2(dy, dx); want += Math.sin(away - f.a) * 3; f.boost = Math.min(1, f.boost + dt * 4); }
      }
      f.boost = Math.max(0, f.boost - dt * 0.6);
      f.turn += (want - f.turn) * Math.min(1, dt * 2); f.a += f.turn * dt;
      const v = f.speed * (1 + f.boost * 2.2);
      f.x += Math.cos(f.a) * v * dt; f.y += Math.sin(f.a) * v * dt;
      f.phase += dt * (2.6 + f.boost * 7); f.amp = 1 + f.boost;
      f.drop += dt; if (this.o.ripples && f.drop > 0.22) { f.drop = 0; const p = spine(f, 8)[8]; this.trail.push({ x: p[0], y: p[1], age: 0 }); }
      const m = f.len * 1.3; if (f.x < -m || f.x > this.w + m || f.y < -m || f.y > this.h + m) this.spawn(i, false);
    }
    for (const t of this.trail) t.age += dt; this.trail = this.trail.filter(t => t.age < 2.4);
  }
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
    if (this.dead) return;
    if (!this.w) this.resize();
    this.seed();
    if (this.w && document.visibilityState === 'visible') { this.step(dt); this.draw(); }
    requestAnimationFrame(n => this.loop(n));
  }
  draw() {
    const { ctx, bctx, cw, chh, cols, rows } = this, o = this.o;
    ctx.clearRect(0, 0, this.w, this.h);
    // ripples: dashes left in the water, fading
    for (const t of this.trail) { const a = (1 - t.age / 2.4) * 0.35 * o.opacity; ctx.fillStyle = `rgba(163,163,163,${a})`; ctx.fillText(t.age < 0.8 ? '-' : '·', Math.floor(t.x / cw) * cw, Math.floor(t.y / chh) * chh); }
    bctx.clearRect(0, 0, this.buf.width, this.buf.height);
    for (const f of this.fish) paintFish(bctx, f, 2 / cw, 2 / chh);
    const img = bctx.getImageData(0, 0, this.buf.width, this.buf.height).data, W = this.buf.width;
    const under = o.avoid();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let A = 0, R = 0, G = 0, B = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = ((r * 2 + dy) * W + c * 2 + dx) * 4, a = img[k + 3]; A += a; R += img[k] * a; G += img[k + 1] * a; B += img[k + 2] * a; }
      if (A < 60) continue;
      const cov = A / 1020, x = c * cw, y = r * chh;
      let alpha = o.opacity;
      for (const q of under) if (x + cw > q.x && x < q.x + q.w && y + chh > q.y && y < q.y + q.h) { alpha *= q.dim ?? 0.18; break; }
      const rgb = `${R / A | 0},${G / A | 0},${B / A | 0}`;
      if (o.cells) { ctx.fillStyle = `rgba(${rgb},${0.09 * alpha * cov})`; ctx.fillRect(x, y, cw - 1, chh - 1); }
      ctx.fillStyle = `rgba(${rgb},${alpha * (0.35 + 0.65 * cov)})`;
      const lum = (R + G + B) / A / 765, jit = (((c * 73856093) ^ (r * 19349663)) >>> 0) % 100 / 100 - 0.5;
      const k = cov < 0.6 ? cov * 6 : 4 + (lum * 0.7 + 0.3) * 10 + jit * 4;
      ctx.fillText(RAMP[Math.max(1, Math.min(RAMP.length - 1, Math.round(k)))], x, y);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The owner's mark: a kohaku curl in grayscale glyph cells (shared/brand). KoiMark samples it by default.
export const BRAND_MARK = new URL('./brand/icon-512.png', import.meta.url).href;
const marks = new Map();
function loadMark(src) {
  if (!marks.has(src)) marks.set(src, new Promise((ok, fail) => {
    const img = new Image(); img.onload = () => {
      // crop to the drawing itself: everything brighter than the black tile
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) { const k = (y * c.width + i) * 4; if (d[k] + d[k + 1] + d[k + 2] > 90) { x0 = Math.min(x0, i); y0 = Math.min(y0, y); x1 = Math.max(x1, i); y1 = Math.max(y1, y); } }
      ok({ img, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] });
    }; img.onerror = fail; img.src = src;
  }));
  return marks.get(src);
}

export class KoiMark {
  // A koi in stippled dots. Dots run from the pointer and spring home; the fish keeps a slow swimming wave.
  // By default the dots are sampled from the owner's mark; pass `src: null` for the drawn fish instead.
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.o = { density: 1, dot: 1.6, radius: 46, wave: 1, src: BRAND_MARK, ...opts };
    if (this.o.src) loadMark(this.o.src).then(m => { this.mark = m; this.build(); if (this.still) this.draw(); }).catch(() => { this.o.src = null; this.build(); });
    this.mouse = null; this.t = 0;
    canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top]; });
    canvas.addEventListener('pointerleave', () => (this.mouse = null));
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.build(); new ResizeObserver(() => { if (!this.dead) { this.build(); if (this.still) this.draw(); } }).observe(canvas);
    if (this.still) this.draw(); else requestAnimationFrame(() => this.loop());
  }
  build() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (!r.width || !r.height) { this.w = 0; this.dots = []; return; }
    this.w = r.width; this.h = r.height; this.c.width = r.width * dpr; this.c.height = r.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const off = document.createElement('canvas'); off.width = this.w; off.height = this.h; const o = off.getContext('2d', { willReadFrequently: true });
    if (this.o.src) {
      if (!this.mark) { this.dots = []; return; } // still loading
      const [bx, by, bw, bh] = this.mark.box, s = Math.min(this.w * 0.92 / bw, this.h * 0.92 / bh);
      o.drawImage(this.mark.img, bx, by, bw, bh, (this.w - bw * s) / 2, (this.h - bh * s) / 2, bw * s, bh * s);
    } else {
      const len = Math.min(this.w * 0.86, this.h * 2.6);
      paintFish(o, { x: this.w / 2 - len * 0.5, y: this.h / 2 + len * 0.04, a: Math.PI - 0.12, len, v: this.o.variety || VARIETIES[0], phase: 1.2, amp: 1.4, turn: -0.5 }, 1, 1);
    }
    const d = o.getImageData(0, 0, this.w, this.h).data, dots = [];
    const tries = this.w * this.h * (this.o.src ? 0.3 : 0.16) * this.o.density;
    for (let i = 0; i < tries; i++) {
      const x = Math.random() * this.w, y = Math.random() * this.h, k = ((y | 0) * this.w + (x | 0)) * 4;
      if (d[k + 3] < 90) continue;
      const lum = (d[k] + d[k + 1] + d[k + 2]) / 765;
      if (this.o.src && lum < 0.12) continue; // the mark's black tile and cell gaps
      const keep = d[k + 3] < 200 ? 0.35 : 0.55 + lum * 0.45;
      if (Math.random() > keep) continue;
      dots.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, c: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})` });
    }
    this.dots = dots;
  }
  loop() {
    if (this.dead) return;
    if (!this.w) this.build();
    if (this.w && document.visibilityState === 'visible') { this.t += 1 / 60; this.step(); this.draw(); }
    requestAnimationFrame(() => this.loop());
  }
  destroy() { this.dead = true; }
  step() {
    const R = this.o.radius, m = this.mouse;
    for (const p of this.dots) {
      const wave = Math.sin(this.t * 1.6 - p.hx / 34) * 2.2 * this.o.wave * (p.hx / this.w);
      let ax = (p.hx - p.x) * 0.06, ay = (p.hy + wave - p.y) * 0.06;
      if (m) { const dx = p.x - m[0], dy = p.y - m[1], d = Math.hypot(dx, dy); if (d < R && d > 0.1) { const f = (1 - d / R) ** 2 * 5.5; ax += dx / d * f; ay += dy / d * f; } }
      p.vx = (p.vx + ax) * 0.82; p.vy = (p.vy + ay) * 0.82; p.x += p.vx; p.y += p.vy;
    }
  }
  draw() { const { ctx } = this, s = this.o.dot; ctx.clearRect(0, 0, this.w, this.h); for (const p of this.dots) { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, s, s); } }
}

// ---------------------------------------------------------------------------------------------
// Tick ring with a solid ring that rises out of it, crosses, and sinks back — loops while waiting.
export function orbitLoader(size = 40, { color = 'var(--koi)' } = {}) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-50 -50 100 100'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Loading'); svg.style.overflow = 'visible'; svg.style.color = color;
  const ticks = [];
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', Math.cos(a) * 30); l.setAttribute('y1', Math.sin(a) * 30); l.setAttribute('x2', Math.cos(a) * 36); l.setAttribute('y2', Math.sin(a) * 36);
    l.setAttribute('stroke', 'currentColor'); l.setAttribute('stroke-width', 2.6); l.setAttribute('stroke-linecap', 'round'); l.style.opacity = 0.5;
    svg.append(l); ticks.push([a, l]);
  }
  const ring = document.createElementNS(ns, 'circle'); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'currentColor'); ring.setAttribute('stroke-width', 5.5); svg.append(ring);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches; let t0 = performance.now();
  function frame(now) {
    if (!svg.isConnected && now - t0 > 2000) return;
    const t = ((now - t0) / 1500) % 1, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const x = 44 - e * 88, y = -44 + e * 88, r = 4 + Math.sin(e * Math.PI) * 13;
    ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', r);
    for (const [a, l] of ticks) { const d = Math.hypot(Math.cos(a) * 33 - x, Math.sin(a) * 33 - y); l.style.opacity = d < r + 8 ? 0 : 0.5; }
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame); return svg;
}

// One line of block characters, newest on the right, scaled to `max`.
export function blocks(values, width, max) {
  const g = ' ▁▂▃▄▅▆▇█', v = values.slice(-width), top = max || Math.max(1, ...v);
  return ' '.repeat(Math.max(0, width - v.length)) + v.map(x => g[Math.min(8, Math.round(x / top * 8))]).join('');
}
// A braille spinner for inline "working" states.
export function brailleSpinner(el) { const g = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'; let i = 0; const t = setInterval(() => { if (!el.isConnected) return clearInterval(t); el.textContent = g[i++ % g.length]; }, 80); }
