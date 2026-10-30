import { afterEach, expect, test, vi } from 'vitest';
import { deferredDelete } from '../src/deferred-delete';
afterEach(() => vi.useRealTimers());
test('holds the real delete for six seconds and emits countdown ticks', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const remove = vi.fn().mockResolvedValue(undefined),
    onCommit = vi.fn(),
    ticks: number[] = [];
  const deletion = deferredDelete(remove, {
    onCommit,
    onTick: (n) => ticks.push(n),
  });
  await vi.advanceTimersByTimeAsync(5999);
  expect(remove).not.toHaveBeenCalled();
  expect(ticks.at(-1)).toBe(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(remove).toHaveBeenCalledOnce();
  expect(onCommit).toHaveBeenCalledOnce();
  expect(ticks).toContain(0);
  deletion.undo();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(remove).toHaveBeenCalledOnce();
});
test('undo and teardown cancel safely', async () => {
  vi.useFakeTimers();
  const remove = vi.fn().mockResolvedValue(undefined),
    onUndo = vi.fn();
  const undone = deferredDelete(remove, { onUndo });
  undone.undo();
  undone.undo();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(remove).not.toHaveBeenCalled();
  expect(onUndo).toHaveBeenCalledOnce();
  const cancelled = deferredDelete(remove);
  cancelled.destroy();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(remove).not.toHaveBeenCalled();
});
test('reports rejected deletion without an unhandled timer rejection or a success callback', async () => {
  vi.useFakeTimers();
  const error = new Error('offline'),
    onError = vi.fn(),
    onCommit = vi.fn();
  deferredDelete(vi.fn().mockRejectedValue(error), { onError, onCommit });
  await vi.advanceTimersByTimeAsync(6000);
  expect(onError).toHaveBeenCalledWith(error);
  expect(onCommit).not.toHaveBeenCalled();
});
test('flush sends the delete now and ends the grace', async () => {
  vi.useFakeTimers();
  const remove = vi.fn().mockResolvedValue(undefined),
    onUndo = vi.fn(),
    onTick = vi.fn();
  const deletion = deferredDelete(remove, { onUndo, onTick });
  deletion.flush();
  expect(remove).toHaveBeenCalledOnce();
  deletion.flush();
  deletion.undo();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(remove).toHaveBeenCalledOnce();
  expect(onUndo).not.toHaveBeenCalled();
  expect(onTick.mock.calls).toEqual([[0]]);
});
