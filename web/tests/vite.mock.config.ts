/** Test-only service. Never imported by the application or production Vite config. */
import { defineConfig, type Plugin } from 'vite';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const GiB = 1024 ** 3;
const csrf = 'synthetic-preview-csrf';
type Copy = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
  data?: Buffer;
};
type Partial = { name: string; size: number; offset: number; chunks: Buffer[] };
let authenticated = true;
let offline = false;
let budget = 200 * GiB;
let failure = 0;
let resumeAuthFailure = 0;
const uploadRequests: { method: string; path: string; offset?: string }[] = [];
let files: Copy[] = [];
const partials = new Map<string, Partial>();
function reset() {
  offline = false;
  authenticated = true;
  budget = 200 * GiB;
  failure = 0;
  resumeAuthFailure = 0;
  partials.clear();
  uploadRequests.length = 0;
  files = [
    ['studio-walkthrough.mp4', 2.4 * GiB],
    ['project-assets.zip', 0.82 * GiB],
    ['handoff-notes.pdf', 240 * 1024],
    ['project-assets.zip', 0.78 * GiB],
    ['weekend-selects.zip', 1.2 * GiB],
  ].map(([name, size], i) => ({
    id: `f18c501a-33aa-46d3-b3df-00000000000${i}`,
    name: String(name),
    size: Math.round(Number(size)),
    uploadedAt: new Date(Date.now() - i * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + (30 - i) * 86400000).toISOString(),
  }));
}
reset();
const used = () => files.reduce((sum, file) => sum + file.size, 0);
const reserved = () =>
  [...partials.values()].reduce((sum, file) => sum + file.size, 0);
async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024 ** 2)
      throw new Error('Synthetic harness limit is 64 MiB.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
function send(response: ServerResponse, status: number, value?: unknown) {
  response.statusCode = status;
  if (value !== undefined) {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(value));
  } else response.end();
}
async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  const path = url.pathname;
  const method = request.method || 'GET';
  if (path.startsWith('/__test/')) {
    if (path === '/__test/reset') reset();
    else if (path === '/__test/offline' && method === 'POST')
      offline = JSON.parse((await body(request)).toString()).offline;
    else if (path === '/__test/session' && method === 'POST')
      authenticated = JSON.parse(
        (await body(request)).toString(),
      ).authenticated;
    else if (path === '/__test/quota' && method === 'POST')
      budget = JSON.parse((await body(request)).toString()).budgetBytes;
    else if (path === '/__test/failure' && method === 'POST')
      failure = JSON.parse((await body(request)).toString()).status;
    else if (path === '/__test/resume-auth' && method === 'POST') {
      const status = JSON.parse((await body(request)).toString()).status;
      if (status !== 401 && status !== 403) return send(response, 400);
      resumeAuthFailure = status;
    }
    return send(response, 200, {
      authenticated,
      usedBytes: used(),
      reservedBytes: reserved(),
      budgetBytes: budget,
      partialCount: partials.size,
      partials: [...partials].map(([id, partial]) => ({
        id,
        size: partial.size,
        offset: partial.offset,
      })),
      uploadRequests,
    });
  }
  if (!path.startsWith('/api/') && !path.startsWith('/auth/')) return next();
  if (offline && path.startsWith('/api/'))
    return send(response, 503, { error: 'Synthetic host offline.' });
  if (path.startsWith('/api/uploads')) {
    uploadRequests.push({
      method,
      path,
      offset: request.headers['upload-offset'] as string | undefined,
    });
    if (uploadRequests.length > 100) uploadRequests.shift();
    if (method === 'HEAD' && resumeAuthFailure) {
      const status = resumeAuthFailure;
      resumeAuthFailure = 0;
      authenticated = false;
      return send(response, status, {
        error: 'Synthetic session expired during resume.',
      });
    }
  }
  if (path === '/auth/login') {
    authenticated = true;
    response.writeHead(302, { Location: '/' });
    return response.end();
  }
  if (!authenticated)
    return send(response, 401, { error: 'Synthetic session expired.' });
  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    request.headers['x-csrf-token'] !== csrf
  )
    return send(response, 403, { error: 'Synthetic CSRF check failed.' });
  if (path === '/auth/logout') {
    authenticated = false;
    return send(response, 204);
  }
  if (path === '/api/session')
    return send(response, 200, {
      authenticated: true,
      csrfToken: csrf,
      name: 'Synthetic Owner',
      picture:
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" fill="#2f7d6d"/><text x="14" y="19" font-size="13" text-anchor="middle" fill="#fff">SO</text></svg>',
        ),
    });
  if (path === '/api/files')
    return send(response, 200, {
      files: files.map(({ data: _data, ...file }) => file),
      usedBytes: used(),
      reservedBytes: reserved(),
      budgetBytes: budget,
    });
  const fileMatch = path.match(/^\/api\/files\/([^/]+)(\/download)?$/);
  if (fileMatch) {
    const file = files.find((file) => file.id === fileMatch[1]);
    if (!file) return send(response, 404, { error: 'Copy no longer exists.' });
    if (method === 'DELETE') {
      files = files.filter((copy) => copy !== file);
      return send(response, 204);
    }
    if (fileMatch[2] && method === 'GET') {
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
      const data =
        file.data || Buffer.from(`Synthetic preview fixture: ${file.name}\n`);
      response.setHeader('Content-Length', data.length);
      return response.end(data);
    }
  }
  if (path.startsWith('/api/uploads')) {
    response.setHeader('Tus-Resumable', '1.0.0');
    if (failure && method !== 'DELETE')
      return send(response, failure, {
        error: 'Synthetic injected upload failure.',
      });
    if (path === '/api/uploads' && method === 'POST') {
      const size = Number(request.headers['upload-length']);
      if (!Number.isSafeInteger(size) || size < 0) return send(response, 400);
      if (size > 64 * 1024 ** 2 || used() + reserved() + size > budget)
        return send(response, 507, {
          error: 'Synthetic storage budget exceeded.',
        });
      const filename = String(request.headers['upload-metadata'] || '')
        .split(',')
        .find((item) => item.startsWith('filename '))
        ?.split(' ')[1];
      const name = filename
        ? Buffer.from(filename, 'base64').toString()
        : 'untitled';
      const id = randomUUID();
      partials.set(id, { name, size, offset: 0, chunks: [] });
      response.setHeader('Location', `/api/uploads/${id}`);
      if (!size) {
        const now = Date.now();
        files.unshift({
          id,
          name,
          size,
          data: Buffer.alloc(0),
          uploadedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 30 * 86400000).toISOString(),
        });
        partials.delete(id);
      }
      return send(response, 201);
    }
    const id = path.slice('/api/uploads/'.length);
    const partial = partials.get(id);
    if (!partial) return send(response, 404);
    if (method === 'HEAD') {
      response.setHeader('Upload-Offset', String(partial.offset));
      response.setHeader('Upload-Length', String(partial.size));
      return send(response, 200);
    }
    if (method === 'DELETE') {
      partials.delete(id);
      return send(response, 204);
    }
    if (method === 'PATCH') {
      if (Number(request.headers['upload-offset']) !== partial.offset)
        return send(response, 409);
      const data = await body(request);
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!partials.has(id)) return send(response, 404);
      partial.chunks.push(data);
      partial.offset += data.length;
      if (partial.offset === partial.size) {
        const now = Date.now();
        files.unshift({
          id,
          name: partial.name,
          size: partial.size,
          data: Buffer.concat(partial.chunks),
          uploadedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 30 * 86400000).toISOString(),
        });
        partials.delete(id);
      }
      response.setHeader('Upload-Offset', String(partial.offset));
      return send(response, 204);
    }
  }
  return send(response, 404, { error: 'Unknown synthetic endpoint.' });
}
const mockService: Plugin = {
  name: 'storagi-test-only-service',
  transformIndexHtml(html) {
    return html.replace(
      '<body>',
      '<body><div class="synthetic-banner">SYNTHETIC PREVIEW · Mock service and sample files · No real Google authentication</div>',
    );
  },
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      void handle(request, response, next).catch(() => {
        if (!response.writableEnded)
          send(response, 500, { error: 'Synthetic harness request failed.' });
      });
    });
  },
};
export default defineConfig({
  server: {
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  plugins: [mockService],
});
