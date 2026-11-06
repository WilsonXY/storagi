import { afterEach, expect, test, vi } from 'vitest';
const ponds = vi.hoisted(
  () =>
    [] as {
      id: string;
      still: boolean;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      paintStill: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    }[],
);
vi.mock('../src/koi', () => ({
  KoiPond: class {
    still = false;
    start = vi.fn();
    stop = vi.fn();
    paintStill = vi.fn();
    destroy = vi.fn();
    id: string;
    constructor(canvas: HTMLCanvasElement) {
      this.id = canvas.id;
      ponds.push(this);
    }
  },
  KoiMark: class {
    destroy() {}
  },
  orbitLoader: () =>
    Object.assign(document.createElement('div'), { destroy() {} }),
}));
import { createDashboard } from '../src/dashboard';
import { setMotionPref } from '../src/preferences';
let dispose = () => {};
afterEach(() => {
  dispose();
  localStorage.clear();
  history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  ponds.length = 0;
});
test('Text pond follows shelf visibility, motion preference, and dashboard cleanup', async () => {
  vi.stubGlobal('ResizeObserver', class {});
  vi.stubGlobal('innerWidth', 1440);
  document.body.innerHTML = '<main id="app"></main>';
  dispose = await createDashboard(document.querySelector('#app')!, {
    fetch: vi.fn(async (path) =>
      Response.json(
        String(path) === '/api/session'
          ? { authenticated: true, csrfToken: 'test-csrf' }
          : String(path) === '/api/texts'
            ? { texts: [] }
            : { files: [], usedBytes: 0, reservedBytes: 0, budgetBytes: 100 },
      ),
    ),
  });
  const files = ponds.find((p) => p.id === 'pond')!,
    text = ponds.find((p) => p.id === 'text-pond')!;
  expect(files.start).toHaveBeenCalled();
  expect(text.still).toBe(true);
  document.querySelector<HTMLElement>('.nav-item[data-tab="text"]')!.click();
  expect(text.still).toBe(false);
  expect(text.start).toHaveBeenCalled();
  expect(files.still).toBe(true);
  setMotionPref('static');
  expect(text.still).toBe(true);
  expect(text.paintStill).toHaveBeenCalled();
  setMotionPref('swim');
  expect(text.still).toBe(false);
  document.querySelector<HTMLElement>('.nav-item[data-tab="inbox"]')!.click();
  expect(text.still).toBe(true);
  vi.stubGlobal('innerWidth', 1000);
  document.querySelector<HTMLElement>('#nav-transfers')!.click();
  expect(files.still).toBe(true);
  vi.stubGlobal('innerWidth', 1440);
  window.dispatchEvent(new Event('resize'));
  expect(files.still).toBe(false);
  dispose();
  expect(files.destroy).toHaveBeenCalledOnce();
  expect(text.destroy).toHaveBeenCalledOnce();
});
