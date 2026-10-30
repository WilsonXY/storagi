export const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function blocks(el: HTMLElement, parts: [number, string][]) {
  const key = JSON.stringify(parts);
  if (el.dataset.blocks === key) return;
  el.dataset.blocks = key;
  el.innerHTML = parts
    .map(([n, cls]) => `<i class="${cls}"></i>`.repeat(Math.max(0, n)))
    .join('');
}
export const blockCount = (el: HTMLElement) =>
  Math.max(8, Math.floor((el.clientWidth + 3) / 8));
export function createToast() {
  type Options = {
    action?: string;
    onAction?: () => void;
    ms?: number;
    clockFrom?: number;
  };
  let close = () => {},
    undoing = false,
    waiting: [string, Options][] = [];
  // A notice never pushes an Undo toast away; it waits, in order. A newer Undo toast replaces the old one (the caller folds both into it).
  const toast = (message: string, options: Options = {}) => {
    if (undoing && !options.clockFrom) {
      if (!waiting.some(([m]) => m === message))
        waiting.push([message, options]);
      return;
    }
    const keep = waiting;
    waiting = [];
    close();
    waiting = keep;
    undoing = !!options.clockFrom;
    const el = document.createElement('div');
    el.className = 'toast out';
    el.id = 'notice';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span></span>';
    el.firstElementChild!.textContent = message;
    let left = options.clockFrom ?? 0;
    const clock = document.createElement('span');
    clock.className = 'clock';
    if (left) {
      clock.textContent = `${left}s`;
      el.append(clock);
    }
    if (options.action) {
      const b = document.createElement('button');
      b.textContent = options.action;
      b.onclick = () => {
        options.onAction?.();
        close();
      };
      el.append(b);
    }
    document.body.append(el);
    requestAnimationFrame(() => el.classList.remove('out'));
    const iv = setInterval(() => {
      clock.textContent = `${Math.max(0, --left)}s`;
    }, 1000);
    const to = setTimeout(() => close(), options.ms ?? 4000);
    close = () => {
      clearInterval(iv);
      clearTimeout(to);
      el.classList.add('out');
      el.removeAttribute('id');
      el.inert = true;
      el.querySelector('button')?.setAttribute('disabled', '');
      setTimeout(() => el.remove(), 300);
      close = () => {};
      undoing = false;
      const next = waiting.shift();
      if (next) toast(...next);
    };
  };
  return {
    toast,
    destroy: () => {
      waiting = [];
      close();
    },
  };
}
export function fileDrop(options: {
  enabled: () => boolean;
  on: (over: boolean) => void;
  drop: (files: File[], folders: string[]) => void;
}) {
  const events = new AbortController();
  let active = false,
    timer: ReturnType<typeof setTimeout>;
  const set = (on: boolean) => {
    if (active !== on) {
      active = on;
      options.on(on);
    }
  };
  const end = () => {
    clearTimeout(timer);
    set(false);
  };
  for (const type of ['dragenter', 'dragover', 'drop'])
    window.addEventListener(
      type,
      (event) => {
        const e = event as DragEvent;
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
        e.preventDefault();
        if (!options.enabled()) return end();
        if (type === 'drop') {
          end();
          // A dropped folder arrives as a File; only its entry tells them apart.
          // Without the entry API, everything is treated as a file.
          const files: File[] = [],
            folders: string[] = [];
          for (const item of Array.from(e.dataTransfer!.items)) {
            const file = item.kind === 'file' && item.getAsFile();
            if (!file) continue;
            if (item.webkitGetAsEntry?.()?.isDirectory) folders.push(file.name);
            else files.push(file);
          }
          options.drop(files, folders);
        } else {
          set(true);
          clearTimeout(timer);
          timer = setTimeout(end, 150);
        }
      },
      { signal: events.signal },
    );
  for (const type of ['dragend', 'blur'])
    window.addEventListener(type, end, { signal: events.signal });
  return () => {
    events.abort();
    end();
  };
}
