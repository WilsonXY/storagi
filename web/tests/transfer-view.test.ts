import { afterEach, expect, test, vi } from 'vitest';
import shelfHTML from '../src/shelf.html?raw';
import { createTransferView } from '../src/transfer-view';
let stop = () => {};
afterEach(() => { stop(); vi.useRealTimers(); document.body.replaceChildren(); });
test('progress keeps button focus, stalled speed decays, shared history survives transfers, and outcomes leave', async () => {
  vi.useFakeTimers(); document.body.innerHTML = shelfHTML;
  const view = createTransferView(document.body); stop = view.destroy;
  const t = view.add('one.zip', 10000, 'up'); t.state = 'uploading'; t.metrics.progress(0, t.size); view.render(t);
  const button = document.querySelector<HTMLButtonElement>('[data-action="pause"]')!; button.focus();
  await vi.advanceTimersByTimeAsync(1000); t.sent = 1000; t.metrics.progress(t.sent, t.size); view.render(t);
  await vi.advanceTimersByTimeAsync(1000); t.sent = 2000; t.metrics.progress(t.sent, t.size); view.render(t);
  expect(document.activeElement).toBe(button); const speed = t.metrics.speed;
  await vi.advanceTimersByTimeAsync(4000); expect(t.metrics.speed).toBeLessThan(speed);
  t.state = 'done'; view.render(t); const next = view.add('two.zip', 10000, 'up'); next.state = 'uploading'; next.metrics.progress(0, next.size); view.render(next);
  expect(next.metrics.history).toHaveLength(0); expect(document.querySelector<HTMLElement>('.chart')!.hidden).toBe(false);
  await vi.advanceTimersByTimeAsync(4000); expect(document.querySelector('.tr.leaving')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(1000); expect(document.querySelectorAll('.tr')).toHaveLength(1);
});
