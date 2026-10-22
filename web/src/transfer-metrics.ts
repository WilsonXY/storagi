export type ThroughputSample = { at: number; speed: number };
export type QueueProgress = { size: number; sent: number; state: string };
// One estimator per active transfer. Feed tus onProgress(sent,total) and reset on pause/resume.
export class TransferMetrics {
  speed = 0;
  sent = 0;
  total = 0;
  history: ThroughputSample[] = [];
  private previous?: number;
  private started = 0;
  private windowAt = 0;
  private windowBytes = 0;
  private samples = 0;
  constructor(private readonly now = Date.now) {}
  reset() {
    this.speed = this.sent = this.total = this.windowBytes = this.samples = 0;
    this.previous = undefined; this.history = [];
  }
  progress(sent: number, total: number, at = this.now()) {
    if (!Number.isFinite(sent) || !Number.isFinite(total) || !Number.isFinite(at) || sent < 0 || total < sent) return;
    if (this.previous !== undefined && at < this.previous) return;
    if (sent < this.sent) this.reset();
    if (this.previous === undefined) {
      this.started = this.windowAt = at; this.previous = at; this.sent = sent; this.total = total; return;
    }
    if (at === this.previous) { this.total = total; return; }
    // Interpolate sparse callbacks across exact 1 s windows; never manufacture simulated link speeds.
    const perMs = (sent - this.sent) / (at - this.previous);
    let cursor = this.previous;
    while (cursor < at) {
      const end = Math.min(at, this.windowAt + 1000);
      this.windowBytes += (end - cursor) * perMs; cursor = end;
      if (cursor === this.windowAt + 1000) {
        this.speed = this.samples++ ? this.speed * 0.7 + this.windowBytes * 0.3 : this.windowBytes;
        this.history.push({ at: cursor, speed: this.speed });
        if (this.history.length > 30) this.history.shift();
        this.windowAt = cursor; this.windowBytes = 0;
      }
    }
    this.previous = at; this.sent = sent; this.total = total;
  }
  eta() { return this.warm ? Math.max(0, this.total - this.sent) / this.speed : NaN; }
  queueEta(items: readonly QueueProgress[]) {
    const left = items.filter(t => ['queued', 'uploading', 'downloading'].includes(t.state)).reduce((n, t) => n + Math.max(0, t.size - t.sent), 0);
    return this.warm ? left / this.speed : NaN;
  }
  finishTime(seconds = this.eta()) { return Number.isFinite(seconds) ? this.now() + seconds * 1000 : NaN; }
  private get warm() { return this.previous !== undefined && this.previous - this.started >= 2000 && this.speed > 0; }
}
