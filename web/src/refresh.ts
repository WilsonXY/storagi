export type Timing = { now?: () => number; timers?: Pick<typeof globalThis, 'setInterval' | 'clearInterval'> };
type RefreshOptions = Timing & { every?: number };
export class AutoRefresh extends EventTarget {
  last: number;
  busy = false;
  error: unknown = null;
  private next: number;
  private hiddenAt: number | null = null;
  private pending?: Promise<void>;
  private dead = false;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly nowTime: () => number;
  private readonly timers: NonNullable<Timing['timers']>;
  private readonly every: number;
  constructor(private readonly fetcher: () => Promise<unknown>, options: RefreshOptions = {}) {
    super();
    this.nowTime = options.now ?? Date.now; this.timers = options.timers ?? globalThis;
    this.every = options.every ?? 60_000;
    this.last = this.nowTime(); this.next = this.last + this.every;
    if (document.visibilityState !== 'visible') this.hiddenAt = this.last;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.timer = this.timers.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.nowTime() >= this.next) void this.now(); else this.emit();
    }, 1000);
  }
  private onVisibility = () => {
    if (document.visibilityState !== 'visible') { this.hiddenAt = this.nowTime(); return; }
    const away = this.hiddenAt === null ? 0 : this.nowTime() - this.hiddenAt; this.hiddenAt = null;
    if (away > 10_000) void this.now();
  };
  get remaining() { return Math.max(0, Math.ceil((this.next - this.nowTime()) / 1000)); }
  now(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.dead || document.visibilityState !== 'visible') return Promise.resolve();
    this.busy = true;
    this.pending = (async () => {
      try { await Promise.resolve().then(() => this.dead ? undefined : this.fetcher()); if (!this.dead) { this.last = this.nowTime(); this.error = null; } }
      catch (error) { if (!this.dead) this.error = error; }
      finally { this.busy = false; this.pending = undefined; this.next = this.nowTime() + this.every; this.emit(); }
    })();
    this.emit(); return this.pending;
  }
  destroy() { this.dead = true; this.timers.clearInterval(this.timer); document.removeEventListener('visibilitychange', this.onVisibility); }
  private emit() { if (!this.dead) this.dispatchEvent(new Event('change')); }
}

export class OfflineRetry extends EventTarget {
  active = false;
  busy = false;
  error: unknown = null;
  private next = 0;
  private pending?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private dead = false;
  private readonly clock: () => number;
  private readonly timers: NonNullable<Timing['timers']>;
  constructor(private readonly fetcher: () => Promise<unknown>, options: Timing = {}) {
    super(); this.clock = options.now ?? Date.now; this.timers = options.timers ?? globalThis;
  }
  get remaining() { return this.active ? Math.max(0, Math.ceil((this.next - this.clock()) / 1000)) : 0; }
  start(error: unknown = null) {
    if (this.dead) return;
    this.error = error; this.active = true; this.next = this.clock() + 10_000;
    if (this.timer === undefined) this.timer = this.timers.setInterval(() => {
      if (!this.busy && this.clock() >= this.next) void this.now(); else this.emit();
    }, 1000);
    this.emit();
  }
  now(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.dead) return Promise.resolve();
    this.busy = true;
    this.pending = (async () => {
      try { await Promise.resolve().then(() => this.dead ? undefined : this.fetcher()); if (!this.dead) { this.error = null; this.stop(); } }
      catch (error) { if (!this.dead && this.active) { this.error = error; this.next = this.clock() + 10_000; } }
      finally { this.busy = false; this.pending = undefined; this.emit(); }
    })();
    this.emit(); return this.pending;
  }
  stop() { this.active = false; if (this.timer !== undefined) this.timers.clearInterval(this.timer); this.timer = undefined; this.emit(); }
  destroy() { this.dead = true; this.stop(); }
  private emit() { if (!this.dead) this.dispatchEvent(new Event('change')); }
}
