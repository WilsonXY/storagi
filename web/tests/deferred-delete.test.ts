import { afterEach, expect, test, vi } from 'vitest';
import { deferredDelete } from '../src/deferred-delete';
afterEach(() => vi.useRealTimers());
test('holds the real delete for six seconds and emits countdown ticks', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const remove = vi.fn().mockResolvedValue(undefined), onCommit = vi.fn(), ticks: number[] = [];
  const deletion = deferredDelete(remove, { onCommit, onTick: n => ticks.push(n) });
  await vi.advanceTimersByTimeAsync(5999); expect(remove).not.toHaveBeenCalled(); expect(deletion.remaining).toBe(1);
  await vi.advanceTimersByTimeAsync(1); expect(remove).toHaveBeenCalledOnce(); expect(onCommit).toHaveBeenCalledOnce(); expect(ticks).toContain(0);
  deletion.undo(); await deletion.commit(); expect(remove).toHaveBeenCalledOnce();
});
test('undo and teardown cancel safely; early commit is idempotent', async () => {
  vi.useFakeTimers(); const remove = vi.fn().mockResolvedValue(undefined), onUndo = vi.fn();
  const undone = deferredDelete(remove, { onUndo }); undone.undo(); undone.undo(); await vi.advanceTimersByTimeAsync(10_000);
  expect(remove).not.toHaveBeenCalled(); expect(onUndo).toHaveBeenCalledOnce();
  const cancelled = deferredDelete(remove); cancelled.destroy(); await vi.advanceTimersByTimeAsync(10_000); expect(remove).not.toHaveBeenCalled();
  const committed = deferredDelete(remove); await committed.commit(); await vi.advanceTimersByTimeAsync(10_000); expect(remove).toHaveBeenCalledOnce();
});
test('reports rejected deletion without an unhandled timer rejection or a success callback', async () => {
  vi.useFakeTimers(); const error = new Error('offline'), onError = vi.fn(), onCommit = vi.fn();
  const deletion = deferredDelete(vi.fn().mockRejectedValue(error), { onError, onCommit });
  await vi.advanceTimersByTimeAsync(6000); expect(deletion.error).toBe(error); expect(onError).toHaveBeenCalledWith(error); expect(onCommit).not.toHaveBeenCalled();
});
