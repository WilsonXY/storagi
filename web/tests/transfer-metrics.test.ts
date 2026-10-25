import { expect, test } from 'vitest';
import { TransferMetrics } from '../src/transfer-metrics';

test('tus callbacks feed one-second windows and EMA; ETA warms up after two seconds', () => {
  let now = 0;
  const m = new TransferMetrics(() => now);
  m.progress(0, 10_000);
  now = 500;
  m.progress(500, 10_000);
  expect(m.speed).toBe(0);
  expect(m.eta()).toBeNaN();
  now = 1000;
  m.progress(1000, 10_000);
  expect(m.speed).toBe(1000);
  expect(m.eta()).toBeNaN();
  now = 2000;
  m.progress(3000, 10_000);
  expect(m.speed).toBe(1300);
  expect(m.eta()).toBeCloseTo(7000 / 1300);
});
test('sparse callbacks fill windows at observed throughput', () => {
  const m = new TransferMetrics(() => 0);
  m.progress(0, 100_000, 0);
  m.progress(35_000, 100_000, 35_000);
  expect(m.speed).toBe(1000);
});
test('resume baseline avoids counting old bytes; reset excludes paused time and stalled windows decay', () => {
  const m = new TransferMetrics(() => 0);
  m.progress(5000, 10_000, 0);
  m.progress(6000, 10_000, 1000);
  m.progress(7000, 10_000, 2000);
  expect(m.speed).toBe(1000);
  m.progress(7000, 10_000, 3000);
  expect(m.speed).toBe(700);
  m.reset();
  m.progress(7000, 10_000, 100_000);
  m.progress(8000, 10_000, 101_000);
  expect(m.eta()).toBeNaN();
  expect(m.speed).toBe(1000);
  m.progress(10_000, 10_000, 102_000);
  expect(m.eta()).toBe(0);
  m.progress(0, 10_000, 103_000);
  expect(m.speed).toBe(0);
  expect(m.eta()).toBeNaN();
});
