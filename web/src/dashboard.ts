import { setupTransfers, bytes } from './transfers';
export type ShelfFile = { id: string; name: string; size: number; uploadedAt: string; expiresAt: string };
type Shelf = { files: ShelfFile[]; usedBytes: number; reservedBytes: number; budgetBytes: number };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export async function createDashboard(root: HTMLElement, dependencies = { fetch: globalThis.fetch.bind(globalThis) }) {
  root.innerHTML = `<header><a class="brand" href="/" aria-label="Storagi home"><span class="brand-mark">s.</span>storagi<span class="brand-dot">®</span></a><span class="owner-badge">PERSONAL FILE SHELF</span></header>
    <div id="content" tabindex="-1"><p role="status">Opening your shelf…</p></div>
    <footer><span>Across devices. Within reach.</span><span>YOUR FILES, JUST PASSING THROUGH.</span></footer>`;
  const content = root.querySelector<HTMLElement>('#content')!;
  try {
    const response = await dependencies.fetch('/api/session', { credentials: 'same-origin' });
    if (!response.ok) {
      if (response.status !== 401) throw new Error('Your shelf is unavailable. Please try again.');
      content.innerHTML = `<section class="login"><p class="eyebrow">A LITTLE SPACE BETWEEN DEVICES</p><h1>Drop it here.<br>Pick it up anywhere.</h1><p>Your private shelf for the files on their way somewhere.<br>Keep your originals. We keep a copy for 30 days.</p><a class="primary google" href="/auth/login"><span aria-hidden="true">G</span> Continue with Google <span aria-hidden="true">↗</span></a><small>Only the owner's Google account can open this shelf.</small></section>`;
      return;
    }
    const session = await response.json();
    if (!session.authenticated || !session.csrfToken) throw new Error('Unable to verify your session. Please sign in again.');
    content.innerHTML = `<div class="workspace"><nav aria-label="Shelf"><span class="nav-label">WORKSPACE</span><a class="nav-active" href="#inbox"><span aria-hidden="true">▤</span> Inbox <span id="nav-count">0</span></a><div class="sidebar-note"><span class="tiny-mark" aria-hidden="true">↗</span><strong>A shelf, not an archive.</strong><p>Take what you need.<br>Leave the originals safe.</p></div><button id="logout" class="text-button">Sign out ↗</button></nav><section class="main-panel"><div class="page-heading"><div><p class="eyebrow">YOUR PRIVATE SPACE</p><h1>Room for the in-between.</h1><p>From one device to the next. Leave a copy here.</p></div><span class="private-label"><span aria-hidden="true">●</span> Owner only</span></div>
      <div id="notice" role="status" aria-live="polite" hidden></div>
      <div class="overview"><section class="dropzone" id="dropzone" aria-label="Upload files"><span class="upload-symbol" aria-hidden="true">↥</span><div><h2>A little handoff.</h2><p>Drop files here, or choose them below.</p><button class="primary" id="choose">Choose files <span aria-hidden="true">＋</span></button><input id="picker" type="file" multiple hidden><small>ZIPs, videos, and everything in between.</small></div></section><section class="storage-card" aria-label="Storage use"><div class="card-top"><span class="eyebrow">SHELF SPACE</span><span aria-hidden="true">◷</span></div><p class="storage-number" id="storage-used">—</p><p class="storage-caption" id="storage-caption">Checking available space…</p><meter id="storage-meter" min="0" max="100" value="0" aria-label="Storage including reserved uploads"></meter><p id="reserved"></p><div class="retention"><strong>30 days, then a clean slate.</strong><span>Only this server copy expires.<br>Your originals stay on your devices.</span></div></section></div>
      <section class="transfers" aria-label="Transfers"><div class="section-heading"><h2>Transfers <span id="transfer-count" class="count">0</span></h2><span class="muted">One at a time. Room to breathe.</span></div><p class="resume-note">Interrupted? Reselect the same original file on this browser to resume. Unfinished copies expire after 24 hours without activity. Keep this page open while transferring.</p><ul id="queue" aria-label="Upload queue"></ul><p id="queue-empty" class="queue-empty">No transfers in progress.</p></section>
      <section id="inbox" aria-labelledby="inbox-title"><div class="section-heading inbox-heading"><div><p class="eyebrow">READY WHEN YOU ARE</p><h2 id="inbox-title">Inbox <span id="file-count" class="count">0</span></h2></div><div class="inbox-tools"><label class="search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search filenames" placeholder="Search filenames…"></label><button id="refresh" class="secondary">Refresh <span aria-hidden="true">↻</span></button></div></div><div class="table-heading" aria-hidden="true"><span>FILE NAME</span><span>ADDED / EXPIRES</span><span>SIZE</span><span></span></div><ul id="files" aria-label="Files, newest first"></ul><p id="empty" class="empty" hidden></p><div class="inbox-bottom"><span>Newest first</span><span>Separate copies. Never overwritten.</span></div></section>
      </section></div><dialog id="delete-dialog" aria-labelledby="delete-title"><form method="dialog"><p class="eyebrow">CLEAR SOME SPACE</p><h2 id="delete-title">Delete this server copy?</h2><p id="delete-name"></p><p>Your original stays on its source device. This copy cannot be recovered.</p><div class="dialog-actions"><button value="cancel" class="secondary">Keep file</button><button id="confirm-delete" type="button" class="danger">Delete copy</button></div></form></dialog>`;
    let shelf: Shelf;
    const notice = (message: string, error = false) => {
      const node = root.querySelector<HTMLElement>('#notice')!;
      if (!node) return;
      node.textContent = message; node.hidden = !message; node.className = error ? 'notice error' : 'notice';
    };
    let stopTransfers = () => {};
    const showLogin = () => {
      stopTransfers();
      content.innerHTML = `<section class="login"><p class="eyebrow">YOUR SHELF IS LOCKED</p><h1>Welcome back.</h1><p>Your session expired. Sign in, then reselect any interrupted files to resume.</p><a class="primary" href="/auth/login">Continue with Google ↗</a></section>`;
    };
    async function request(path: string, method = 'GET') {
      const result = await dependencies.fetch(path, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'X-CSRF-Token': session.csrfToken } });
      if (result.status === 401 || result.status === 403) { showLogin(); throw new Error('Your session expired. Sign in again.'); }
      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        throw new Error(result.status === 404 || result.status === 410 ? 'This copy has expired or was removed. Refresh your Inbox.' : body.error || 'The host could not complete that request. Please try again.');
      }
      return result;
    }
    function renderFiles() {
      if (!shelf) return;
      const search = root.querySelector<HTMLInputElement>('input[type="search"]')!.value.trim().toLocaleLowerCase();
      const files = shelf.files.filter(file => file.name.toLocaleLowerCase().includes(search)).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      root.querySelector('#files')!.innerHTML = files.map(file => {
        const expired = new Date(file.expiresAt).getTime() <= Date.now();
        const name = escape(file.name); const id = escape(file.id); const key = escape(file.id.slice(-8));
        const extension = file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE';
        return `<li class="file-row" data-file-id="${id}"><div class="file-title"><span class="file-icon" aria-hidden="true">${escape(extension)}</span><div><strong>${name}</strong><span class="file-id">COPY · ${key}</span></div></div><div class="file-dates"><span>${date(file.uploadedAt)}</span><span class="${expired ? 'expired' : ''}">${expired ? 'Expired' : 'Expires ' + date(file.expiresAt)}</span></div><span class="file-size">${bytes(file.size)}</span><div class="file-actions">${expired ? '<span class="muted">Expired</span>' : `<a class="icon-button" href="/api/files/${encodeURIComponent(file.id)}/download" download aria-label="Download ${name} · ${key}" title="Download">↓</a>`}<button class="icon-button delete-button" data-delete="${id}" aria-label="Delete ${name} · ${key}" title="Delete copy">×</button></div></li>`;
      }).join('');
      const empty = root.querySelector<HTMLElement>('#empty')!;
      empty.hidden = files.length > 0;
      empty.textContent = search ? 'No matching files. Try another filename.' : 'A fresh shelf. Your next upload will appear here.';
      root.querySelector('#file-count')!.textContent = String(files.length);
      root.querySelector('#nav-count')!.textContent = String(shelf.files.length);
    }
    async function refresh() {
      try {
        shelf = await (await request('/api/files')).json();
        renderFiles();
        root.querySelector('#storage-used')!.textContent = bytes(shelf.usedBytes);
        root.querySelector('#storage-caption')!.textContent = `of ${bytes(shelf.budgetBytes)} used`;
        (root.querySelector('#storage-meter') as HTMLMeterElement).value = Math.min(100, (shelf.usedBytes + shelf.reservedBytes) / shelf.budgetBytes * 100);
        root.querySelector('#reserved')!.textContent = `${bytes(shelf.reservedBytes)} reserved for unfinished uploads`;
        if (shelf.usedBytes + shelf.reservedBytes >= shelf.budgetBytes) notice('Your shelf is full. Delete a copy or wait for one to expire, then retry your upload.', true);
      } catch (error) { notice(error instanceof Error ? error.message : 'Unable to refresh your Inbox.', true); }
    }
    root.querySelector('input[type="search"]')!.addEventListener('input', renderFiles);
    root.querySelector('#refresh')!.addEventListener('click', () => void refresh());
    let deletion: ShelfFile | undefined;
    const dialog = root.querySelector<HTMLDialogElement>('#delete-dialog')!;
    root.querySelector('#files')!.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-delete]');
      if (!button) return;
      deletion = shelf.files.find(file => file.id === button.dataset.delete);
      if (!deletion) return;
      root.querySelector('#delete-name')!.textContent = `${deletion.name} · ${deletion.id.slice(-8)}`;
      dialog.showModal();
    });
    root.querySelector('#confirm-delete')!.addEventListener('click', async () => {
      if (!deletion) return;
      const button = root.querySelector<HTMLButtonElement>('#confirm-delete')!;
      button.disabled = true;
      try { await request(`/api/files/${encodeURIComponent(deletion.id)}`, 'DELETE'); dialog.close(); notice('Server copy deleted. Your original is safe.'); await refresh(); }
      catch (error) { dialog.close(); notice((error as Error).message, true); }
      finally { button.disabled = false; }
    });
    root.querySelector('#logout')!.addEventListener('click', async () => {
      stopTransfers();
      try { await request('/auth/logout', 'POST'); showLogin(); }
      catch (error) { notice((error as Error).message, true); }
    });
    stopTransfers = setupTransfers(root, session.csrfToken, { refresh, notice, expired: showLogin });
    await refresh();
  } catch {
    content.innerHTML = `<section class="login"><p class="eyebrow">CONNECTION INTERRUPTED</p><h1>A pause between devices.</h1><p role="alert">The host may be offline or your session could not be checked. Check your connection and try again.</p><button class="primary" id="retry-connection">Try again</button></section>`;
    root.querySelector('#retry-connection')!.addEventListener('click', () => void createDashboard(root, dependencies));
  }
}
