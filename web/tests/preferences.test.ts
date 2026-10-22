import { beforeEach, expect, test, vi } from 'vitest';
import { motionPref, setMotionPref, reduced, onMotionChange, gesturePref, setGesturePref } from '../src/preferences';
beforeEach(() => localStorage.clear());
test('persists explicit motion and gesture choices, dispatches motion changes and unsubscribes', () => {
  const motion = vi.fn(), offMotion = onMotionChange(motion);
  expect(motionPref()).toBe('swim'); expect(gesturePref()).toBe('on');
  setMotionPref('static'); setGesturePref('off'); expect(reduced()).toBe(true); expect(gesturePref()).toBe('off');
  expect(localStorage.getItem('storagi.motion')).toBe('static'); expect(localStorage.getItem('storagi.gestures')).toBe('off');
  expect(motion).toHaveBeenCalledOnce();
  offMotion(); setMotionPref('swim'); setGesturePref('on'); expect(motion).toHaveBeenCalledOnce();
});
test('ignores OS motion and invalid storage and tolerates storage denial', () => {
  const matchMedia = vi.fn(() => ({ matches: true })); vi.stubGlobal('matchMedia', matchMedia);
  localStorage.setItem('storagi.motion', 'system'); localStorage.setItem('storagi.gestures', 'invalid');
  expect(motionPref()).toBe('swim'); expect(gesturePref()).toBe('on'); expect(matchMedia).not.toHaveBeenCalled();
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  expect(motionPref()).toBe('swim'); expect(gesturePref()).toBe('on'); expect(() => setMotionPref('static')).not.toThrow(); expect(() => setGesturePref('off')).not.toThrow();
  get.mockRestore(); set.mockRestore(); vi.unstubAllGlobals();
});
