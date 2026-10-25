import { expect, test } from 'vitest';
import { Selection } from '../src/selection';
import { nextSort, sortFiles, groupFiles } from '../src/sorting';
const order = ['a', 'b', 'c', 'd'];
test('selection shifts from its anchor, toggles ranges and exposes header tri-state', () => {
  const s = new Selection();
  expect(s.allState(order)).toBe('none');
  s.toggle('b', order);
  s.toggle('d', order, true);
  expect([...s.ids]).toEqual(['b', 'c', 'd']);
  expect(s.allState(order)).toBe('some');
  s.toggle('d', order, true);
  expect(s.ids.size).toBe(0);
  s.set(order);
  expect(s.allState(order)).toBe('all');
  s.clear();
  expect(s.anchor).toBeNull();
  expect(s.allState([])).toBe('none');
});
test('drag ranges restore the original selection as the pointer retreats or crosses the start', () => {
  const s = new Selection();
  s.set(['d']);
  s.beginDrag('b', order);
  s.dragTo('d');
  expect([...s.ids].sort()).toEqual(['b', 'c', 'd']);
  s.dragTo('a');
  expect([...s.ids].sort()).toEqual(['a', 'b', 'd']);
  s.endDrag();
  s.dragTo('d');
  expect([...s.ids].sort()).toEqual(['a', 'b', 'd']);
  s.beginDrag('b', order);
  s.dragTo('d');
  expect([...s.ids]).toEqual(['a']);
  s.dragTo('b');
  expect([...s.ids].sort()).toEqual(['a', 'd']);
  s.endDrag();
  s.clear();
  s.toggle('missing', order, true);
  expect(s.ids.has('missing')).toBe(true);
});
const files = [
  {
    id: 'a',
    name: 'file10',
    size: 2,
    uploadedAt: '2026-03-09T04:30:00Z',
    expiresAt: 20,
  },
  {
    id: 'b',
    name: 'File2',
    size: 2,
    uploadedAt: '2026-03-08T23:30:00Z',
    expiresAt: 10,
  },
  {
    id: 'c',
    name: 'FILE2',
    size: 1,
    uploadedAt: '2026-03-09T05:30:00Z',
    expiresAt: 30,
  },
];
test('sorts naturally, ascending first, toggles direction, and keeps newest-first ties', () => {
  const name = nextSort(null, 'name');
  expect(name).toEqual({ key: 'name', dir: 1 });
  expect(sortFiles(files, name).map((f) => f.id)).toEqual(['c', 'b', 'a']);
  expect(sortFiles(files, nextSort(name, 'name')).map((f) => f.id)).toEqual([
    'a',
    'c',
    'b',
  ]);
  expect(sortFiles(files, nextSort(name, 'size')).map((f) => f.id)).toEqual([
    'c',
    'a',
    'b',
  ]);
  expect(sortFiles(files, { key: 'expires', dir: 1 }).map((f) => f.id)).toEqual(
    ['b', 'a', 'c'],
  );
  expect(sortFiles(files, null).map((f) => f.id)).toEqual(['c', 'a', 'b']);
  expect(files[0].id).toBe('a');
});
test('unsorted groups use local dates; sorted files form one run', () => {
  expect([...groupFiles(files, null, '2026-03-09T06:00:00Z').keys()]).toEqual([
    'Today',
    'Yesterday',
  ]);
  expect([...groupFiles(files, { key: 'size', dir: 1 }).keys()]).toEqual(['']);
});
