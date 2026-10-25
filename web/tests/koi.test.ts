import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { KoiPond, KoiMark, orbitAt, orbitLoader } from '../src/koi';
import { setMotionPref } from '../src/preferences';
let readback: ReturnType<typeof vi.fn>,
  disconnected: ReturnType<typeof vi.fn>,
  frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
  localStorage.clear();
  frames = new Map();
  let seq = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((fn: FrameRequestCallback) => {
      frames.set(++seq, fn);
      return seq;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  disconnected = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnected;
    },
  );
  readback = vi.fn(() => ({ data: new Uint8ClampedArray(10_000) }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    measureText: () => ({ width: 8 }),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    clip: vi.fn(),
    ellipse: vi.fn(),
    getImageData: readback,
  } as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function canvas() {
  const c = document.createElement('canvas');
  vi.spyOn(c, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 80,
    height: 60,
  } as DOMRect);
  document.body.append(c);
  return c;
}
function pointer(el: EventTarget, type: string, x = 10, y = 20) {
  el.dispatchEvent(
    Object.assign(new Event(type), {
      clientX: x,
      clientY: y,
      pointerType: 'touch',
    }),
  );
}
test('pond port supports splashes, static mode and complete teardown', () => {
  const c = canvas(),
    pond = new KoiPond(c, {
      splashTarget: c,
      canSplash: (e) => e.clientX !== 0,
    });
  expect(frames.size).toBe(1);
  pointer(c, 'click', 0);
  expect(pond.waves).toHaveLength(0);
  pointer(c, 'click');
  expect(pond.waves).toHaveLength(1);
  setMotionPref('static');
  expect(pond.still).toBe(true);
  const count = pond.waves.length;
  pond.destroy();
  pointer(c, 'click');
  setMotionPref('swim');
  expect(pond.waves).toHaveLength(count);
  expect(frames.size).toBe(0);
  expect(disconnected).toHaveBeenCalledOnce();
});
test('mark samples baked bitmap without canvas readback and releases touch drag/listeners', () => {
  const c = canvas(),
    mark = new KoiMark(c, { static: true });
  expect(readback).not.toHaveBeenCalled();
  expect(mark.dots.length).toBeGreaterThan(0);
  pointer(c, 'pointerdown');
  expect(mark.mouse).toEqual([10, 20]);
  pointer(c, 'pointermove', 30, 40);
  expect(mark.mouse).toEqual([30, 40]);
  pointer(c, 'pointerup');
  expect(mark.mouse).toBeNull();
  mark.stop();
  expect(frames.size).toBe(0);
  mark.start();
  expect(frames.size).toBe(1);
  mark.destroy();
  pointer(c, 'pointerdown');
  setMotionPref('static');
  expect(mark.mouse).toBeNull();
  expect(frames.size).toBe(0);
  expect(disconnected).toHaveBeenCalledOnce();
});
test('orbit preserves the continuous path, follows motion changes and can be destroyed', () => {
  expect(orbitAt(0)[0]).toBeCloseTo(orbitAt(1)[0]);
  expect(orbitAt(0.3)[2]).toBe(17);
  const loader = orbitLoader();
  document.body.append(loader);
  expect(loader.querySelectorAll('line')).toHaveLength(28);
  setMotionPref('static');
  expect(frames.size).toBe(0);
  setMotionPref('swim');
  expect(frames.size).toBe(1);
  loader.destroy();
  setMotionPref('static');
  setMotionPref('swim');
  expect(frames.size).toBe(0);
});
