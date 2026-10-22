import type { Timing } from './refresh';
type Options = Timing & { grace?: number; onCommit?: () => void; onUndo?: () => void; onTick?: (seconds: number) => void; onError?: (error: unknown) => void };
// The real DELETE is deferred, so closing the page during the grace keeps the server copy.
export function deferredDelete(remove: () => Promise<unknown>, { grace = 6000, onCommit, onUndo, onTick, onError, now = Date.now, timers = globalThis }: Options = {}) {
  const deadline = now() + grace;
  let done = false, error: unknown = null;
  const remaining = () => Math.max(0, Math.ceil((deadline - now()) / 1000));
  const timer = timers.setInterval(() => { onTick?.(remaining()); if (now() >= deadline) void commit(); }, 250);
  async function commit() {
    if (done) return; done = true; timers.clearInterval(timer);
    try { await remove(); onCommit?.(); } catch (e) { error = e; onError?.(e); }
  }
  return {
    get remaining() { return remaining(); }, get error() { return error; }, commit,
    undo() { if (done) return; done = true; timers.clearInterval(timer); onUndo?.(); },
    destroy() { done = true; timers.clearInterval(timer); },
  };
}
