// Storagi design exploration — the koi layer.
//   KoiPond  — koi drawn in glyph cells swimming behind the interface (after stackedlol's ASCII sharks, via @sundyme).
//   KoiMark  — a stippled koi whose dots run from the cursor and spring home (after Emil Kowalski's dithered Linear icon).
//   orbitLoader — a tick ring with a solid ring passing through it (after Emil Kowalski's loader).
// Motion follows the owner's koi switch in storagi.js: swim (default) or static.
import { reduced, onMotionChange } from './storagi.js';
import { MARK } from './brand/mark.js';
// Each fish is painted as flat shapes into a small offscreen canvas, then read back one cell at a time and
// re-drawn as a character whose density follows the coverage. When motion is reduced (the owner's setting allows it) the koi are drawn as one still frame.

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
  //       opacity, ripples, flee (cursor radius, 0 to disable),
  //       splashTarget (element whose clicks drop rings into the water), canSplash(event) -> false to ignore a click
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.o = { count: 5, size: [150, 260], font: 11, cells: true, opacity: 1, ripples: true, flee: 150, speed: 1, avoid: () => [], ...opts };
    this.buf = document.createElement('canvas'); this.bctx = this.buf.getContext('2d', { willReadFrequently: true });
    this.fish = []; this.trail = []; this.waves = []; this.mouse = null; this.last = 0;
    this.resize(); addEventListener('resize', () => this.resize());
    const host = this.o.pointerTarget || window;
    host.addEventListener('pointermove', e => { const r = this.c.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top]; });
    host.addEventListener('pointerleave', () => (this.mouse = null));
    // a finger has no hover: once it lifts, the fish stop fleeing the spot it left
    for (const t of ['pointerup', 'pointercancel']) host.addEventListener(t, e => { if (e.pointerType !== 'mouse') this.mouse = null; });
    // A click on the water drops rings of ASCII waves that spread out slowly; the koi they reach dart away.
    this.o.splashTarget?.addEventListener('click', e => {
      if (this.o.canSplash?.(e) === false) return;
      const r = this.c.getBoundingClientRect(); this.splash(e.clientX - r.left, e.clientY - r.top);
    });
    this.still = reduced();
    // A pond made while its screen is hidden has no size yet: seed the fish, and in reduced motion paint the
    // still frame, whenever the canvas gets a size, not only at construction.
    new ResizeObserver(() => { if (this.dead) return; this.resize(); if (this.still) this.paintStill(); }).observe(canvas);
    // the cell grid is measured from the mono face, so measure again once it has loaded
    document.fonts?.load('500 11px "Storagi Mono"').then(() => { if (this.dead) return; this.resize(); if (this.still) this.paintStill(); });
    onMotionChange(() => { this.still = reduced(); this.still ? this.paintStill() : this.start(); });
    this.still ? this.paintStill() : this.start();
  }
  splash(x, y) {
    if (!this.w) return;
    this.waves.push({ x, y, t: 0, hit: new Set() });
    // the drop itself startles any koi close by
    if (!this.still) for (const f of this.fish) { const d = Math.hypot(f.x - x, f.y - y); if (d < 110) this.scare(f, x, y, 1 - d / 220); }
    this.start();
  }
  scare(f, x, y, k) { f.fear = Math.max(f.fear || 0, k); f.fearAt = Math.atan2(f.y - y, f.x - x); }
  start() { if (this.running || this.dead) return; this.running = true; this.last = 0; requestAnimationFrame(t => this.loop(t)); }
  seed() { if (this.seeded || !this.w) return; this.seeded = true; for (let i = 0; i < this.o.count; i++) this.spawn(i, true); }
  paintStill() { if (!this.w) return; if (!this.seeded) { this.seed(); for (let i = 0; i < 40; i++) this.step(0.05); } this.draw(); }
  destroy() { this.dead = true; this.ctx.clearRect(0, 0, this.w || 0, this.h || 0);
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = this.c.getBoundingClientRect();
    if (!r.width || !r.height) { this.w = 0; return; }
    this.w = r.width; this.h = r.height; this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.font = `500 ${this.o.font}px "Storagi Mono", "JetBrains Mono", ui-monospace, monospace`; this.ctx.textBaseline = 'top';
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
      // frightened by a wave: turn away from where it came from and dart off, calming over a second or so
      if (f.fear > 0) { want += Math.sin(f.fearAt - f.a) * 4 * f.fear; f.boost = Math.min(1, f.boost + dt * 6 * f.fear); f.fear = Math.max(0, f.fear - dt * 0.9); }
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
  // Each splash sends three rings out at WAVE.speed px/s; a ring frightens a koi once, when its crest passes the koi's head.
  stepWaves(dt) {
    for (const w of this.waves) {
      w.t += dt;
      if (this.still) continue;
      WAVE.rings.forEach((delay, i) => {
        const r = (w.t - delay) * WAVE.speed, k = waveStrength(w.t - delay, r);
        if (r <= 0 || k < 0.12) return;
        this.fish.forEach((f, j) => { const key = i * 64 + j; if (w.hit.has(key)) return; if (Math.abs(Math.hypot(f.x - w.x, f.y - w.y) - r) < 26) { w.hit.add(key); this.scare(f, w.x, w.y, Math.min(1, k * 1.3)); } });
      });
    }
    this.waves = this.waves.filter(w => w.t < WAVE.life + WAVE.rings.at(-1));
  }
  loop(t) {
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016; this.last = t;
    // a still pond runs only while click waves are spreading, then settles back to its still picture
    if (this.dead || (this.still && !this.waves.length)) { this.running = false; if (this.still && !this.dead) this.draw(); return; }
    if (!this.w) this.resize();
    this.seed();
    if (this.w && document.visibilityState === 'visible') { if (!this.still) this.step(dt); this.stepWaves(dt); this.draw(); }
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
    this.drawWaves(under, img, W);
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

// Click waves: thin rings drawn in glyphs, '~' across the top and bottom, '( )' at the sides and '/ \' between, with a
// faint '·' wake inside each. Each ring is one cell thick whichever way it faces; the koi swim over them.
const WAVE = { speed: 60, life: 2.2, rings: [0, 0.45, 0.9] };
const waveStrength = (age, r) => (age <= 0 || age >= WAVE.life ? 0 : (1 - age / WAVE.life) ** 1.6 * Math.min(1, r / 14));
function crest(dx, dy) {
  const a = Math.atan2(dy, dx), c = Math.cos(a), sn = Math.sin(a);
  if (Math.abs(sn) > 0.8) return '~';
  if (Math.abs(c) > 0.86) return c > 0 ? ')' : '(';
  return c * sn > 0 ? '\\' : '/';
}
KoiPond.prototype.drawWaves = function (under, img, W) {
  const { ctx, cw, chh } = this;
  for (const w of this.waves) {
    const reach = w.t * WAVE.speed + chh * 2;
    const c0 = Math.max(0, Math.floor((w.x - reach) / cw)), c1 = Math.min(this.cols - 1, Math.ceil((w.x + reach) / cw));
    const r0 = Math.max(0, Math.floor((w.y - reach) / chh)), r1 = Math.min(this.rows - 1, Math.ceil((w.y + reach) / chh));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = c * cw, y = r * chh, dx = x + cw / 2 - w.x, dy = y + chh / 2 - w.y, d = Math.hypot(dx, dy) || 1;
      const cell = (Math.abs(dx) * cw + Math.abs(dy) * chh) / d; // the cell's extent across the ring
      let best = 0, ch = '';
      for (const delay of WAVE.rings) {
        const age = w.t - delay, k = waveStrength(age, age * WAVE.speed); if (!k) continue;
        const off = d - age * WAVE.speed; // > 0 ahead of the crest, < 0 behind it
        const [v, g] = Math.abs(off) <= cell * 0.5 ? [k, crest(dx, dy)] : off < 0 && off > -cell * 1.5 ? [k * 0.4, '·'] : [0, ''];
        if (v > best) { best = v; ch = g; }
      }
      if (best < 0.04) continue;
      let A = 0; for (const [ex, ey] of [[0, 0], [1, 0], [0, 1], [1, 1]]) A += img[((r * 2 + ey) * W + c * 2 + ex) * 4 + 3];
      if (A >= 60) continue; // a koi is here
      let alpha = best * this.o.opacity;
      for (const q of under) if (x + cw > q.x && x < q.x + q.w && y + chh > q.y && y < q.y + q.h) { alpha *= q.dim ?? 0.18; break; }
      ctx.fillStyle = `rgba(200,206,214,${alpha * 0.85})`; ctx.fillText(ch, x, y);
    }
  }
};

// ---------------------------------------------------------------------------------------------
// The owner's mark: a kohaku curl in grayscale glyph cells, baked into brand/mark.js. KoiMark samples it by default.
const staticGrey = () => 26 + (Math.random() * 44 | 0); // fine, dark grain, as the readback bug looked
let markBytes;
// The mark is drawn in glyph cells, so its letters and cell gaps read as dark holes. Blur it (a 5×5 box) so the
// body is solid: dots follow the blurred value, and the static stays outside the fish.
const markData = () => markBytes ||= (() => {
  const raw = Uint8Array.from(atob(MARK.gray), c => c.charCodeAt(0)), out = new Uint8Array(raw.length), R = 2;
  for (let y = 0; y < MARK.h; y++) for (let x = 0; x < MARK.w; x++) {
    let sum = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < MARK.h && xx < MARK.w) { sum += raw[yy * MARK.w + xx]; n++; } }
    out[y * MARK.w + x] = sum / n;
  }
  return out;
})();

export class KoiMark {
  // A koi in stippled dots. Dots run from the pointer and spring home; the fish keeps a slow swimming wave.
  // By default the dots are sampled from the owner's mark (brand/mark.js); pass `src: null` for the drawn fish instead.
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.o = { density: 1, dot: 1.6, radius: 46, wave: 1, src: 'mark', ...opts };
    this.mouse = null; this.t = 0;
    // Mouse, pen and finger: on touch the canvas keeps the gesture (no page pan), dots follow the finger while it
    // drags, and the hole closes when it lifts (a touch has no hover, so it never sends a plain pointerleave).
    canvas.style.touchAction = 'none';
    const at = e => { const r = canvas.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', at);
    canvas.addEventListener('pointermove', at);
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(t, () => (this.mouse = null));
    this.still = reduced();
    this.build(); new ResizeObserver(() => { if (!this.dead) { this.build(); if (this.still) this.draw(); } }).observe(canvas);
    onMotionChange(() => { this.still = reduced(); this.still ? this.draw() : this.start(); });
    this.still ? this.draw() : this.start();
  }
  start() { if (this.running || this.dead) return; this.running = true; requestAnimationFrame(() => this.loop());
  }
  build() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (!r.width || !r.height) { this.w = 0; this.dots = []; return; }
    this.w = r.width; this.h = r.height; this.c.width = r.width * dpr; this.c.height = r.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const off = document.createElement('canvas'); off.width = this.w; off.height = this.h; const o = off.getContext('2d', { willReadFrequently: true });
    if (this.o.src) return this.sampleMark();
    {
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
  // Dots straight from the baked bitmap. Reading pixels back from a canvas is avoided on purpose: some browsers
  // add random noise to canvas readback as a privacy measure, which turned the mark into static.
  sampleMark() {
    const g = markData(), s = Math.min(this.w * 0.92 / MARK.w, this.h * 0.92 / MARK.h);
    const ox = (this.w - MARK.w * s) / 2, oy = (this.h - MARK.h * s) / 2, dots = [], statics = [];
    const at = (x, y) => { const bx = Math.floor((x - ox) / s), by = Math.floor((y - oy) / s); return bx >= 0 && by >= 0 && bx < MARK.w && by < MARK.h ? g[by * MARK.w + bx] : 0; };
    // The koi: one dot per cell of a jittered grid about a dot apart, so the body fills evenly with no holes.
    const step = this.o.dot * 1.15 / Math.sqrt(this.o.density);
    for (let y = 0; y < this.h; y += step) for (let x = 0; x < this.w; x += step) {
      const px = x + Math.random() * step, py = y + Math.random() * step, v = at(px, py);
      if (v / 255 < 0.12) continue;
      const c = Math.min(255, v * 1.25 | 0); // the blur dims the body a little; lift it back
      dots.push({ hx: px, hy: py, x: px, y: py, vx: 0, vy: 0, c: `rgb(${c},${c},${c})` });
    }
    // `static`: the owner kept the look of a readback bug, a fine dark grain across the canvas, outside the koi.
    if (this.o.static) for (let i = 0, n = this.w * this.h * 0.2; i < n; i++) {
      const x = Math.random() * this.w, y = Math.random() * this.h;
      if (at(x, y) / 255 >= 0.12) continue;
      const v = staticGrey(); statics.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, c: `rgb(${v},${v},${v})`, noise: true });
    }
    this.dots = statics.concat(dots); // static first, so the koi draws on top
  }
  loop() {
    if (this.dead || this.still) { this.running = false; return; }
    if (!this.w) this.build();
    if (this.w && document.visibilityState === 'visible') { this.t += 1 / 60; this.step(); this.draw(); }
    requestAnimationFrame(() => this.loop());
  }
  destroy() { this.dead = true; }
  step() {
    const R = this.o.radius, m = this.mouse;
    for (const p of this.dots) {
      const wave = p.noise ? 0 : Math.sin(this.t * 1.6 - p.hx / 34) * 2.2 * this.o.wave * (p.hx / this.w); // the grain holds still
      let ax = (p.hx - p.x) * 0.06, ay = (p.hy + wave - p.y) * 0.06;
      if (m) { const dx = p.x - m[0], dy = p.y - m[1], d = Math.hypot(dx, dy); if (d < R && d > 0.1) { const f = (1 - d / R) ** 2 * 5.5; ax += dx / d * f; ay += dy / d * f; } }
      p.vx = (p.vx + ax) * 0.82; p.vy = (p.vy + ay) * 0.82; p.x += p.vx; p.y += p.vy;
    }
  }
  draw() {
    const { ctx } = this, s = this.o.dot; ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.dots) {
      if (p.noise && !this.still && Math.random() < 0.04) { const n = staticGrey(); p.c = `rgb(${n},${n},${n})`; } // flicker
      ctx.fillStyle = p.c; const d = p.noise ? 1 : s; ctx.fillRect(p.x, p.y, d, d);
    }
  }
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
  const still = reduced(); let t0 = performance.now();
  function frame(now) {
    if (!svg.isConnected && now - t0 > 2000) return;
    const [x, y, r] = orbitAt(((now - t0) / 1500) % 1);
    ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', r);
    for (const [a, l] of ticks) { const d = Math.hypot(Math.cos(a) * 33 - x, Math.sin(a) * 33 - y); l.style.opacity = d < r + 8 ? 0 : 0.5; }
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame); return svg;
}

// The loader's path, one loop with no jump: the small ring crosses the tick ring through its centre (swelling as it
// passes), then glides back around the outside to where it started. t in [0, 1); returns [x, y, radius].
const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export function orbitAt(t) {
  const R = 50, a0 = -Math.PI / 4, a1 = Math.PI * 3 / 4; // top right, bottom left
  if (t < 0.6) {
    const e = ease(t / 0.6);
    return [R * Math.cos(a0) + e * R * (Math.cos(a1) - Math.cos(a0)), R * Math.sin(a0) + e * R * (Math.sin(a1) - Math.sin(a0)), 4 + Math.sin(e * Math.PI) * 13];
  }
  const a = a1 - ease((t - 0.6) / 0.4) * Math.PI; // back round through the bottom and the right
  return [R * Math.cos(a), R * Math.sin(a), 4];
}
