import { Upload, canStoreURLs, type DetailedError, type UploadOptions } from 'tus-js-client';
import type { Transfer } from './transfer-view';
import { fileDrop } from './ui';

type Item = Transfer & { file: File; upload?: Upload };

export function setupTransfers(root: HTMLElement, csrfToken: string, hooks: {
  refresh: () => Promise<void>; notice: (message: string, error?: boolean) => void; expired: () => void; offline: () => void; view: ReturnType<typeof import('./transfer-view').createTransferView>; queued: (count: number) => void;
}) {
  const items: Item[] = [];
  let active: Item | undefined;
  let stopped = false;
  const picker = root.querySelector<HTMLInputElement>('#picker')!;
  const allowedURL = (url: string) => {
    const target = new URL(url, location.href);
    return target.origin === location.origin && (target.pathname === '/api/uploads' || target.pathname.startsWith('/api/uploads/'));
  };
  const render = (item: Item) => { if (!stopped) hooks.view.render(item); };
  async function pump() {
    if (active || stopped) return;
    const item = items.find(item => item.state === 'queued');
    if (!item) return;
    active = item; item.state = 'uploading'; item.metrics.reset(); item.metrics.progress(item.sent, item.file.size); render(item);
    const options: UploadOptions = {
      endpoint: '/api/uploads', chunkSize: 8 * 1024 ** 2, parallelUploads: 1,
      metadata: { filename: item.file.name, filetype: item.file.type || 'application/octet-stream' },
      storeFingerprintForResuming: true, removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      onShouldRetry(error) {
        const status = error.originalResponse?.getStatus() || 0;
        if (!stopped && status === 0) hooks.offline();
        return !stopped && (status === 0 || status >= 500 && status !== 507);
      },
      onBeforeRequest(request) {
        if (!allowedURL(request.getURL())) throw new Error('The host returned an unsafe upload address. Transfer stopped.');
        request.getUnderlyingObject().withCredentials = true;
        if (['POST', 'PATCH', 'DELETE'].includes(request.getMethod().toUpperCase())) request.setHeader('X-CSRF-Token', csrfToken);
      },
      onAfterResponse(_request, response) {
        if (!stopped && response.getStatus() >= 500 && response.getStatus() !== 507) hooks.offline();
        if (response.getStatus() === 401 || response.getStatus() === 403) {
          // Stop before tus treats a rejected resume HEAD as a missing upload and removes its URL.
          hooks.expired();
          throw new Error('Session expired. Sign in, then reselect this file.');
        }
      },
      onUploadUrlAvailable() { void hooks.refresh(); },
      onProgress(sent) { item.sent = sent; item.metrics.progress(sent, item.file.size); render(item); },
      onSuccess() {
        item.state = 'done'; item.sent = item.file.size; active = undefined; render(item);
        void hooks.refresh(); void pump();
      },
      onError(error) {
        if (stopped || item.state !== 'uploading') return;
        const status = (error as DetailedError).originalResponse?.getStatus() || 0;
        active = undefined; item.state = 'error';
        item.message = status === 401 || status === 403 ? 'Session expired. Sign in, then reselect this file.'
          : status === 413 || status === 507 ? 'Not enough space. Delete a copy or wait for expiry, then retry.'
          : status === 404 || status === 410 ? 'Unfinished copy expired. Retry to start a new copy.'
          : 'Transfer interrupted. Check your connection, then retry.';
        render(item); hooks.notice(item.message, true);
        if (status === 401 || status === 403) hooks.expired();
        else { if (!status || status >= 500 && status !== 507) hooks.offline(); void pump(); }
      },
    };
    try {
      if (!item.upload) {
        item.upload = new Upload(item.file, options);
        const previous = await item.upload.findPreviousUploads();
        const safe = previous.find(upload => upload.uploadUrl && allowedURL(upload.uploadUrl));
        if (safe) item.upload.resumeFromPreviousUpload(safe);
      }
      if (!stopped && item.state === 'uploading') item.upload.start();
    } catch {
      if (item.state !== 'uploading') return;
      active = undefined; item.state = 'error'; item.message = 'Unable to prepare this transfer. Retry, or check browser storage permissions.'; render(item); hooks.notice(item.message, true); void pump();
    }
  }
  function add(files: File[]) {
    if (stopped) return;
    let added = 0;
    for (const file of files) {
      if (items.some(item => !['done', 'cancelled'].includes(item.state) && item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
        hooks.notice(`${file.name} is already in your transfer queue.`); continue;
      }
      const item: Item = Object.assign(hooks.view.add(file.name, file.size, 'up'), { file });
      item.action = action => { void act(item, action); };
      items.push(item); added++; render(item);
    }
    if (added) hooks.queued(added);
    void pump();
  }
  picker.addEventListener('change', () => { add(Array.from(picker.files || [])); picker.value = ''; });
  root.querySelector('#choose')!.addEventListener('click', () => picker.click());
  const stopDrop = fileDrop({ enabled: () => !stopped, on: over => {
    root.querySelector('#composer')!.classList.toggle('dragging', over);
    root.querySelector('.composer-text')!.textContent = over ? 'Let go to put them on the shelf' : 'Drop files to put them on the shelf';
  }, drop: add });
  async function act(item: Item, action: string) {
    if (stopped) return;
    if (action === 'resume') { item.state = 'queued'; render(item); void pump(); return; }
    const wasActive = active === item;
    item.state = action === 'pause' ? 'paused' : 'cancelling'; render(item);
    try {
      await item.upload?.abort(action === 'cancel');
      if (action === 'cancel') { item.state = 'cancelled'; render(item); void hooks.refresh(); }
    } catch {
      item.state = 'error'; item.message = 'Could not cancel the server copy. Retry cancel when connected; reservation expires after 24 hours without activity.'; render(item); hooks.notice(item.message, true);
    } finally { if (wasActive) active = undefined; void pump(); }
  }
  if (!canStoreURLs) hooks.notice('Browser storage is unavailable. Keep this tab open: resume after closing it may not work.', true);
  return () => { stopped = true; stopDrop(); for (const item of items) if (item.upload) void item.upload.abort(false).catch(() => {}); };
}
