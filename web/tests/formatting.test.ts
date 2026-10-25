import { expect, test } from 'vitest';
import {
  bytes,
  rate,
  duration,
  clock,
  relDay,
  daysLeft,
  ext,
  shortId,
  finishAt,
} from '../src/formatting';

test('formats IEC bytes, rates, durations and identifiers', () => {
  expect(bytes(0)).toBe('0 B');
  expect(bytes(1536)).toBe('1.5 KiB');
  expect(bytes(1024 ** 4)).toBe('1.0 TiB');
  expect(rate(0)).toBe('—');
  expect(rate(1024)).toBe('1.0 KiB/s');
  expect(duration(NaN)).toBe('—');
  expect(duration(-1)).toBe('—');
  expect(duration(59.1)).toBe('1m 00s');
  expect(duration(3661)).toBe('1h 01m');
  expect(daysLeft({ expiresAt: 2 * 86_400_000 }, 0)).toBe(2);
  expect(daysLeft({ expiresAt: 0 }, 1)).toBe(0);
  expect(ext('REPORT.PDF')).toBe('pdf');
  expect(ext('README')).toBe('file');
  expect(shortId('123456789')).toBe('456789');
});

test('uses local calendar days and clock across midnight and DST in America/New_York', () => {
  // The test runner is started with TZ=America/New_York; this also catches fixed UTC+8 ports.
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
    'America/New_York',
  );
  const now = new Date('2026-03-09T04:30:00Z'); // 00:30 after the spring DST day
  expect(clock(now)).toBe('00:30');
  expect(finishAt(60, () => +now)).toBe('00:31');
  expect(relDay('2026-03-09T04:01:00Z', now)).toBe('Today');
  expect(relDay('2026-03-08T05:01:00Z', now)).toBe('Yesterday'); // only 22h29 ago
  expect(relDay('2026-03-07T05:01:00Z', now)).toBe('Saturday');
  expect(relDay('2026-02-01T05:00:00Z', now)).toBe('1 Feb');
  expect(relDay('2026-03-10T04:00:00Z', now)).toBe('10 Mar');
});
