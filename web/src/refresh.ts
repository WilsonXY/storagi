export class AutoRefresh extends EventTarget {
  last = 0; // time of the last successful fetch; 0 until the first one
  busy = false;
  error: unknown = null;
  private next = Date.now() + 60_000;
  private hiddenAt: number | null = document.visibilityState === 'visible' ? null : Date.now();
  private pending?: Promise<void>;
  private again?: Promise<void>;
  private dead = false;
  private readonly timer = setInterval(() => {
    // Polling stops while the tab is hidden; now() itself always fetches (first load, manual, after an upload, offline retry).
    if (document.visibilityState !== 'visible') return;
    if (Date.now() >= this.next) void this.now(); else this.emit();
  }, 1000);
  constructor(private readonly fetcher: () => Promise<unknown>) {
    super(); document.addEventListener('visibilitychange', this.onVisibility);
  }
  private onVisibility = () => {
    if (document.visibilityState !== 'visible') { this.hiddenAt = Date.now(); return; }
    const away = this.hiddenAt === null ? 0 : Date.now() - this.hiddenAt; this.hiddenAt = null;
    if (away > 10_000) void this.now();
  };
  get remaining() { return Math.max(0, Math.ceil((this.next - Date.now()) / 1000)); }
  now(): Promise<void> {
    // A call during a fetch gets one fresh fetch after it, never the in-flight (possibly stale) answer; extra calls share it.
    if (this.pending) return this.again ??= this.pending.then(() => { this.again = undefined; return this.now(); });
    if (this.dead) return Promise.resolve();
    this.busy = true;
    this.pending = (async () => {
      // Start on the next microtask, so `pending` is set before a synchronous throw reaches `finally`.
      try { await Promise.resolve(); if (this.dead) return; await this.fetcher(); if (!this.dead) { this.last = Date.now(); this.error = null; } }
      catch (error) { if (!this.dead) this.error = error; }
      finally { this.busy = false; this.pending = undefined; this.next = Date.now() + 60_000; this.emit(); }
    })();
    this.emit(); return this.pending;
  }
  destroy() { this.dead = true; clearInterval(this.timer); document.removeEventListener('visibilitychange', this.onVisibility); }
  private emit() { if (!this.dead) this.dispatchEvent(new Event('change')); }
}

export class OfflineRetry extends EventTarget {
  active = false;
  busy = false;
  private next = 0;
  private pending?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private dead = false;
  constructor(private readonly fetcher: () => Promise<unknown>) { super(); }
  get remaining() { return this.active ? Math.max(0, Math.ceil((this.next - Date.now()) / 1000)) : 0; }
  start() {
    if (this.dead) return;
    this.active = true; this.next = Date.now() + 10_000;
    this.timer ??= setInterval(() => { if (!this.busy && Date.now() >= this.next) void this.now(); else this.emit(); }, 1000);
    this.emit();
  }
  now(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.dead) return Promise.resolve();
    this.busy = true;
    this.pending = (async () => {
      try { await Promise.resolve(); if (this.dead) return; await this.fetcher(); if (!this.dead) this.stop(); }
      catch { if (!this.dead && this.active) this.next = Date.now() + 10_000; }
      finally { this.busy = false; this.pending = undefined; this.emit(); }
    })();
    this.emit(); return this.pending;
  }
  stop() { this.active = false; clearInterval(this.timer); this.timer = undefined; this.emit(); }
  destroy() { this.dead = true; this.stop(); }
  private emit() { if (!this.dead) this.dispatchEvent(new Event('change')); }
}
