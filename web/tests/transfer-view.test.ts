import { afterEach, expect, test, vi } from 'vitest';
import shelfHTML from '../src/shelf.html?raw';
import { createTransferView } from '../src/transfer-view';
let stop = () => {};
afterEach(() => {
  stop();
  vi.useRealTimers();
  document.body.replaceChildren();
});
test('progress keeps button focus, stalled speed decays, shared history survives transfers, and outcomes leave', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = shelfHTML;
  const view = createTransferView(document.body);
  stop = view.destroy;
  const t = view.add('one.zip', 10000, 'up');
  t.state = 'uploading';
  t.metrics.progress(0, t.size);
  view.render(t);
  const button = document.querySelector<HTMLButtonElement>(
    '[data-action="pause"]',
  )!;
  button.focus();
  await vi.advanceTimersByTimeAsync(1000);
  t.sent = 1000;
  t.metrics.progress(t.sent, t.size);
  view.render(t);
  await vi.advanceTimersByTimeAsync(1000);
  t.sent = 2000;
  t.metrics.progress(t.sent, t.size);
  view.render(t);
  expect(document.activeElement).toBe(button);
  const speed = t.metrics.speed;
  await vi.advanceTimersByTimeAsync(4000);
  expect(t.metrics.speed).toBeLessThan(speed);
  t.state = 'done';
  view.render(t);
  const next = view.add('two.zip', 10000, 'up');
  next.state = 'uploading';
  next.metrics.progress(0, next.size);
  view.render(next);
  expect(document.querySelector<HTMLElement>('.chart')!.hidden).toBe(false);
  await vi.advanceTimersByTimeAsync(4000);
  expect(document.querySelector('.tr.leaving')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelectorAll('.tr')).toHaveLength(1);
});
test('Pause all and Cancel all reach every transfer they apply to', () => {
  document.body.innerHTML = shelfHTML;
  const view = createTransferView(document.body);
  stop = view.destroy;
  const calls: string[] = [];
  const make = (name: string, dir: 'up' | 'down', state: string) => {
    const t = view.add(name, 100, dir);
    t.state = state as typeof t.state;
    t.action = (action) => calls.push(`${action} ${name}`);
    view.render(t);
    return t;
  };
  const pauseAll = document.querySelector<HTMLButtonElement>('#pause-all')!,
    cancelAll = document.querySelector<HTMLButtonElement>('#cancel-all')!;
  expect(document.querySelector('.resume-note')).toBeNull();
  expect(pauseAll.hidden && cancelAll.hidden).toBe(true);
  const running = make('a', 'up', 'uploading');
  const waiting = make('b', 'up', 'queued');
  make('c', 'down', 'downloading');
  make('d', 'up', 'done');
  expect(pauseAll.textContent).toBe('Pause all');
  pauseAll.click();
  expect(calls).toEqual(['pause a', 'pause b']);
  calls.length = 0;
  cancelAll.click();
  expect(calls).toEqual(['cancel a', 'cancel b', 'cancel c']);
  calls.length = 0;
  for (const t of [running, waiting]) {
    t.state = 'paused';
    view.render(t);
  }
  expect(pauseAll.textContent).toBe('Resume all');
  pauseAll.click();
  expect(calls).toEqual(['resume a', 'resume b']);
});
