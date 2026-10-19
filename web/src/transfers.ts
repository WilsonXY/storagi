import { Upload, canStoreURLs, type DetailedError, type UploadOptions } from 'tus-js-client';
export function bytes(value: number) {
  if (!value) return '0 B';
  const unit = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: unit ? 1 : 0 })} ${['B', 'KiB', 'MiB', 'GiB'][unit]}`;
}


type Item = {
  id: number; file: File; upload?: Upload; sent: number;
  state: 'queued' | 'uploading' | 'paused' | 'error' | 'done' | 'cancelled' | 'cancelling';
  message: string;
};

export function setupTransfers(root: HTMLElement, csrfToken: string, hooks: {
  refresh: () => Promise<void>; notice: (message: string, error?: boolean) => void; expired: () => void;
}) {
  const items: Item[] = [];
  let active: Item | undefined;
  let stopped = false;
  const queue = root.querySelector<HTMLElement>('#queue')!;
  const picker = root.querySelector<HTMLInputElement>('#picker')!;
  const dropzone = root.querySelector<HTMLElement>('#dropzone')!;
  const allowedURL = (url: string) => {
    const target = new URL(url, location.href);
    return target.origin === location.origin && (target.pathname === '/api/uploads' || target.pathname.startsWith('/api/uploads/'));
  };
  const label = (item: Item) => ({ queued: 'Waiting its turn', uploading: 'Uploading', paused: 'Paused · ready to resume', error: item.message, done: 'On your shelf', cancelled: 'Cancelled', cancelling: 'Cancelling…' })[item.state];
  function render(item: Item) {
    if (stopped) return;
    let row = queue.querySelector<HTMLElement>(`[data-transfer="${item.id}"]`);
    if (!row) {
      row = document.createElement('li'); row.dataset.transfer = String(item.id); row.className = 'transfer-row';
      row.innerHTML = '<div class="transfer-info"><strong></strong><span class="transfer-status"></span><progress max="100" value="0"></progress></div><div class="transfer-actions"></div>';
      row.querySelector('strong')!.textContent = item.file.name;
      row.querySelector('progress')!.setAttribute('aria-label', `Upload progress for ${item.file.name}`);
      queue.append(row);
    }
    row.querySelector('.transfer-status')!.textContent = `${label(item)} · ${bytes(item.sent)} / ${bytes(item.file.size)}`;
    const progress = row.querySelector('progress')!;
    progress.value = item.state === 'done' ? 100 : item.file.size ? item.sent / item.file.size * 100 : 0;
    const actions = row.querySelector('.transfer-actions')!;
    const actionList = item.state === 'uploading' ? ['pause', 'cancel'] : item.state === 'paused' || item.state === 'error' ? ['resume', 'cancel'] : item.state === 'queued' ? ['cancel'] : [];
    // Keep controls intact on progress updates so keyboard focus survives each chunk.
    if (actions.getAttribute('data-state') !== item.state) {
      actions.replaceChildren(...actionList.map(action => {
        const button = document.createElement('button');
        button.className = 'secondary'; button.dataset.action = action;
        button.textContent = action === 'resume' && item.state === 'error' ? 'Retry' : action[0].toUpperCase() + action.slice(1);
        button.setAttribute('aria-label', `${button.textContent} ${item.file.name}`);
        return button;
      }));
      actions.setAttribute('data-state', item.state);
    }
    root.querySelector('#queue-empty')!.setAttribute('hidden', '');
    root.querySelector('#transfer-count')!.textContent = String(items.filter(item => !['done', 'cancelled'].includes(item.state)).length);
  }
  async function pump() {
    if (active || stopped) return;
    const item = items.find(item => item.state === 'queued');
    if (!item) return;
    active = item; item.state = 'uploading'; render(item);
    const options: UploadOptions = {
      endpoint: '/api/uploads', chunkSize: 8 * 1024 ** 2, parallelUploads: 1,
      metadata: { filename: item.file.name, filetype: item.file.type || 'application/octet-stream' },
      storeFingerprintForResuming: true, removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      onShouldRetry(error) {
        const status = error.originalResponse?.getStatus() || 0;
        return !stopped && (status === 0 || status >= 500 && status !== 507);
      },
      onBeforeRequest(request) {
        if (!allowedURL(request.getURL())) throw new Error('The host returned an unsafe upload address. Transfer stopped.');
        request.getUnderlyingObject().withCredentials = true;
        if (['POST', 'PATCH', 'DELETE'].includes(request.getMethod().toUpperCase())) request.setHeader('X-CSRF-Token', csrfToken);
      },
      onUploadUrlAvailable() { void hooks.refresh(); },
      onProgress(sent) { item.sent = sent; render(item); },
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
        else void pump();
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
      active = undefined; item.state = 'error'; item.message = 'Unable to prepare this transfer. Retry, or check browser storage permissions.'; render(item); void pump();
    }
  }
  function add(files: File[]) {
    if (stopped) return;
    for (const file of files) {
      if (items.some(item => !['done', 'cancelled'].includes(item.state) && item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
        hooks.notice(`${file.name} is already in your transfer queue.`); continue;
      }
      const item: Item = { id: items.length, file, sent: 0, state: 'queued', message: '' };
      items.push(item); render(item);
    }
    void pump();
  }
  picker.addEventListener('change', () => { add(Array.from(picker.files || [])); picker.value = ''; });
  root.querySelector('#choose')!.addEventListener('click', () => picker.click());
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('dragging'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', event => {
    event.preventDefault(); dropzone.classList.remove('dragging');
    if (event.dataTransfer) add(Array.from(event.dataTransfer.files));
  });
  queue.addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    const row = button?.closest<HTMLElement>('[data-transfer]');
    if (!button || !row) return;
    const item = items[Number(row.dataset.transfer)];
    const action = button.dataset.action;
    if (action === 'resume') { item.state = 'queued'; render(item); void pump(); return; }
    const wasActive = active === item;
    item.state = action === 'pause' ? 'paused' : 'cancelling'; render(item);
    try {
      await item.upload?.abort(action === 'cancel');
      if (action === 'cancel') { item.state = 'cancelled'; render(item); void hooks.refresh(); }
    } catch {
      item.state = 'error'; item.message = 'Could not cancel the server copy. Retry cancel when connected; reservation expires after 24 hours without activity.'; render(item); hooks.notice(item.message, true);
    } finally { if (wasActive) active = undefined; void pump(); }
  });
  if (!canStoreURLs) hooks.notice('Browser storage is unavailable. Keep this tab open: resume after closing it may not work.', true);
  return () => { stopped = true; for (const item of items) if (item.upload) void item.upload.abort(false).catch(() => {}); };
}
