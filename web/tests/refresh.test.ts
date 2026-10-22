import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AutoRefresh, OfflineRetry } from '../src/refresh';
let visible = true;
const visibility = () => { document.dispatchEvent(new Event('visibilitychange')); };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); visible = true; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' }); });
afterEach(() => vi.useRealTimers());
test('refreshes every 60 s visibly and suspends all requests while hidden', async () => {
  const fetcher = vi.fn().mockResolvedValue(undefined), ar = new AutoRefresh(fetcher);
  expect(ar.remaining).toBe(60); await vi.advanceTimersByTimeAsync(59_000); expect(fetcher).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000); expect(fetcher).toHaveBeenCalledTimes(1); expect(ar.last).toBe(60_000);
  visible = false; visibility(); await vi.advanceTimersByTimeAsync(120_000); await ar.now(); expect(fetcher).toHaveBeenCalledTimes(1);
  visible = true; visibility(); await vi.advanceTimersByTimeAsync(0); expect(fetcher).toHaveBeenCalledTimes(2);
  ar.destroy(); await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).toHaveBeenCalledTimes(2);
});
test('return threshold measures time away, and overlapping manual calls join the same request', async () => {
  const fetcher = vi.fn().mockResolvedValue(undefined), ar = new AutoRefresh(fetcher);
  await vi.advanceTimersByTimeAsync(20_000); visible = false; visibility(); await vi.advanceTimersByTimeAsync(10_000);
  visible = true; visibility(); expect(fetcher).not.toHaveBeenCalled();
  visible = false; visibility(); await vi.advanceTimersByTimeAsync(10_001); visible = true; visibility(); await vi.advanceTimersByTimeAsync(0); expect(fetcher).toHaveBeenCalledTimes(1);
  let release!: () => void; fetcher.mockImplementation(() => new Promise<void>(r => { release = r; }));
  const a = ar.now(), b = ar.now(); expect(a).toBe(b); expect(ar.busy).toBe(true); await vi.advanceTimersByTimeAsync(0); release(); await a; expect(ar.busy).toBe(false); expect(fetcher).toHaveBeenCalledTimes(2);
  ar.destroy();
});
test('exposes failures and clears them on successful manual/after-upload refresh', async () => {
  const error = new Error('offline'), fetcher = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined), ar = new AutoRefresh(fetcher);
  await ar.now(); expect(ar.error).toBe(error); expect(ar.remaining).toBe(60);
  await ar.now(); expect(ar.error).toBeNull(); ar.destroy();
});
test('offline retry counts down 10 s, repeats failures, supports retry now and stops on success', async () => {
  const error = new Error('offline'), fetcher = vi.fn().mockRejectedValue(error), retry = new OfflineRetry(fetcher);
  retry.start(error); expect(retry.remaining).toBe(10); await vi.advanceTimersByTimeAsync(9000); expect(retry.remaining).toBe(1); expect(fetcher).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000); expect(fetcher).toHaveBeenCalledTimes(1); expect(retry.error).toBe(error); expect(retry.remaining).toBe(10);
  await retry.now(); expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockResolvedValue(undefined); await vi.advanceTimersByTimeAsync(10_000); expect(fetcher).toHaveBeenCalledTimes(3); expect(retry.active).toBe(false); expect(retry.error).toBeNull();
  await vi.advanceTimersByTimeAsync(20_000); expect(fetcher).toHaveBeenCalledTimes(3); retry.destroy();
});
test('offline retry never overlaps and teardown cancels its timer', async () => {
  let release!: () => void; const fetcher = vi.fn(() => new Promise<void>(r => { release = r; })), retry = new OfflineRetry(fetcher);
  retry.start(); const a = retry.now(); expect(retry.now()).toBe(a); await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledTimes(1);
  retry.destroy(); release(); await a; await vi.advanceTimersByTimeAsync(20_000); expect(fetcher).toHaveBeenCalledTimes(1);
});
test('a synchronous fetcher throw does not wedge later refreshes or retries', async () => {
  const fetcher = vi.fn(() => { throw new Error('offline'); }), ar = new AutoRefresh(fetcher), retry = new OfflineRetry(fetcher);
  await ar.now(); await ar.now(); expect(fetcher).toHaveBeenCalledTimes(2);
  retry.start(); await retry.now(); await retry.now(); expect(fetcher).toHaveBeenCalledTimes(4);
  ar.destroy(); retry.destroy();
});
test('destroy prevents a request queued for the next microtask from starting', async () => {
  const fetcher = vi.fn().mockResolvedValue(undefined), ar = new AutoRefresh(fetcher), retry = new OfflineRetry(fetcher);
  const a = ar.now(), b = retry.now(); ar.destroy(); retry.destroy(); await Promise.all([a, b]);
  expect(fetcher).not.toHaveBeenCalled();
});
