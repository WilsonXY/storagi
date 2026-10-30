type Options = {
  grace?: number;
  onCommit?: () => void;
  onUndo?: () => void;
  onTick?: (seconds: number) => void;
  onError?: (error: unknown) => void;
};
// The real DELETE is deferred until the grace ends, or until flush() (the page is closing).
export function deferredDelete(
  remove: () => Promise<unknown>,
  { grace = 6000, onCommit, onUndo, onTick, onError }: Options = {},
) {
  const deadline = Date.now() + grace;
  let done = false;
  const timer = setInterval(() => {
    onTick?.(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    if (Date.now() >= deadline) void commit();
  }, 250);
  async function commit() {
    if (done) return;
    done = true;
    clearInterval(timer);
    try {
      await remove();
      onCommit?.();
    } catch (e) {
      onError?.(e);
    }
  }
  return {
    undo() {
      if (done) return;
      done = true;
      clearInterval(timer);
      onUndo?.();
    },
    flush() {
      if (done) return;
      onTick?.(0);
      void commit();
    },
    destroy() {
      done = true;
      clearInterval(timer);
    },
  };
}
