// Offline only: run the real script with isolated imports, never owner metadata/network.
// Run: node --experimental-vm-modules --test scripts/acceptance-deployment.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import {test} from 'node:test';
import {SourceTextModule, SyntheticModule, createContext} from 'node:vm';

const source = await readFile(new URL('./acceptance-deployment.mjs', import.meta.url), 'utf8');
const secret = 'private-canary';
const metadata = {origin: 'https://private-canary.example', private_https_active: true, funnel_enabled: false, loopback_port: 1};

async function run({input = JSON.stringify(metadata), failRead = false, failMkdir = false, failWrite = false, request = () => { throw new Error(secret); }, deadlineMs = 1000} = {}) {
  const lines = [];
  const writes = [];
  const timers = new Set();
  const deadlines = [];
  const process = {exitCode: 0};
  const context = createContext({
    URL, Buffer, process,
    console: {log: value => lines.push(String(value)), error: value => lines.push(String(value))},
    setTimeout: (fn, ms) => {
      deadlines.push(ms);
      const timer = setTimeout(fn, Math.min(ms, deadlineMs));
      timers.add(timer);
      return timer;
    },
    clearTimeout: timer => { timers.delete(timer); clearTimeout(timer); },
  });
  const imports = {
    'node:assert/strict': {default: assert},
    'node:http': {default: {request}},
    'node:https': {default: {request}},
    'node:os': {homedir: () => `/fixture/${secret}`},
    'node:fs/promises': {
      readFile: async () => { if (failRead) throw new Error(`ENOENT /fixture/${secret}`); return input; },
      mkdir: async () => { if (failMkdir) throw new Error(`EACCES /fixture/${secret}`); },
      writeFile: async (path, value) => { if (failWrite) throw new Error(`EACCES /fixture/${secret}`); writes.push(JSON.parse(value)); },
    },
  };
  const script = new SourceTextModule(source, {context});
  await script.link(name => {
    assert.ok(Object.hasOwn(imports, name), 'unexpected import in offline probe');
    const values = imports[name];
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, {context});
  });
  let uncaught = false;
  try { await script.evaluate(); } catch { uncaught = true; }
  const pendingTimers = timers.size;
  for (const timer of timers) clearTimeout(timer);
  return {uncaught, lines, writes, exitCode: process.exitCode, pendingTimers, deadlines};
}

test('initialization and proof-write failures use fixed public categories', async t => {
  for (const [name, options, failure] of [
    ['missing metadata', {failRead: true}, 'metadata'],
    ['malformed JSON', {input: `{"${secret}":`}, 'metadata'],
    ['invalid URL', {input: JSON.stringify({...metadata, origin: secret})}, 'metadata'],
    ['non-HTTPS origin', {input: JSON.stringify({...metadata, origin: `http://${secret}.example`})}, 'metadata'],
    ['inactive private route', {input: JSON.stringify({...metadata, private_https_active: false})}, 'metadata'],
    ['mkdir failure', {failMkdir: true}, 'output'],
    ['proof write failure', {failWrite: true}, 'output'],
  ]) {
    await t.test(name, async () => {
      const result = await run(options);
      assert.equal(result.uncaught, false, 'raw initialization/output exception escaped');
      assert.equal(result.exitCode, 1);
      assert.equal(result.lines.length, 1);
      assert.deepEqual(JSON.parse(result.lines[0]), {result: 'failed', failure});
      assert.equal(JSON.stringify(result).includes(secret), false, 'private value reached output/proof');
    });
  }
});

async function fixture(t, mode) {
  let sent = 0;
  let aborted = false;
  let closed;
  const firstResponseClosed = new Promise(resolve => { closed = resolve; });
  const intervals = new Set();
  const server = http.createServer((req, res) => {
    if (mode === 'reset') { res.destroy(); return; }
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (mode === 'abort') {
      res.writeHead(401);
      res.write(secret);
      setImmediate(() => res.destroy());
      return;
    }
    if (mode === 'oversize' || mode === 'continuous') {
      res.writeHead(401);
      const chunk = Buffer.alloc(mode === 'oversize' ? 64 * 1024 : 1, 'x');
      const interval = setInterval(() => {
        sent += chunk.length;
        res.write(chunk);
        if (sent >= (mode === 'oversize' ? 4 * 1024 * 1024 : 80)) res.end();
      }, mode === 'oversize' ? 2 : 5);
      intervals.add(interval);
      res.on('close', () => {
        aborted = !res.writableEnded;
        clearInterval(interval);
        intervals.delete(interval);
        closed();
      });
      return;
    }
    const path = req.url.split('?')[0];
    let status = 404;
    let body = '';
    if (req.headers.host === 'hostile.example') status = 400;
    else if (req.headers.origin || req.headers['sec-fetch-site']) status = 403;
    else if (path.startsWith('/api/') || path === '/auth/logout') status = 401;
    else if (path === '/auth/callback') {
      status = 401;
      res.setHeader('set-cookie', '__Host-storagi-flow=; Max-Age=0');
    } else if (path === '/auth/login') {
      status = 302;
      const destination = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      destination.search = new URLSearchParams({scope: 'openid', response_type: 'code', code_challenge_method: 'S256', state: secret, nonce: secret, code_challenge: secret, redirect_uri: `${metadata.origin}/auth/callback`}).toString();
      res.setHeader('location', destination.href);
      res.setHeader('set-cookie', `__Host-storagi-flow=${secret}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    } else if (path === '/') {
      status = 200;
      body = '<title>Storagi</title><script src="/assets/app.js"></script><link href="/assets/app.css">';
    } else if (['/assets/app.js', '/assets/app.css', '/favicon.svg'].includes(path)) {
      status = 200;
      body = 'fixture asset';
      res.setHeader('content-type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    }
    res.writeHead(status);
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const interval of intervals) clearInterval(interval);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.equal(server.listening, false);
  });
  return {
    request: (target, options, response) => http.request(new URL(`${target.pathname}${target.search}`, `http://127.0.0.1:${server.address().port}`), {...options, agent: false}, response),
    get sent() { return sent; },
    get aborted() { return aborted; },
    firstResponseClosed,
  };
}

function safeProbeFailure(result) {
  assert.equal(result.uncaught, false);
  assert.equal(result.exitCode, 1);
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].result, 'failed');
  assert.equal(result.writes[0].requests.length, 0, 'bounded request must fail before accepting body');
  assert.equal(result.lines.length, 1);
  assert.equal(JSON.parse(result.lines[0]).failure, 'probe');
  assert.equal(JSON.stringify(result).includes(secret), false, 'private response reached output/proof');
  assert.equal(result.pendingTimers, 0, 'request deadline leaked');
}

test('oversized native response is destroyed before buffering the entire body', async t => {
  const server = await fixture(t, 'oversize');
  const result = await run({request: server.request});
  safeProbeFailure(result);
  await server.firstResponseClosed;
  assert.equal(server.aborted, true, 'oversized request was not destroyed');
  // Allow in-flight TCP chunks beyond the 2 MiB acceptance ceiling.
  assert.ok(server.sent <= 2 * 1024 * 1024 + 256 * 1024);
});

test('continuously arriving native response hits the absolute deadline', async t => {
  const server = await fixture(t, 'continuous');
  const result = await run({request: server.request, deadlineMs: 100});
  safeProbeFailure(result);
  await server.firstResponseClosed;
  assert.equal(server.aborted, true, 'streaming request was not destroyed');
  assert.ok(result.deadlines.length > 0, 'absolute deadline was never armed');
  assert.ok(result.deadlines.every(ms => ms > 0 && ms <= 15000));
  assert.ok(server.sent > 1 && server.sent < 80, 'continuous stream was allowed to finish');
});

test('native request errors remain sanitized and clear deadlines', async t => {
  for (const mode of ['reset', 'abort']) {
    await t.test(mode, async t => {
      const server = await fixture(t, mode);
      safeProbeFailure(await run({request: server.request}));
    });
  }
});

test('ordinary completion preserves successful public proof and clears deadlines', async t => {
  const server = await fixture(t, 'normal');
  const result = await run({request: server.request});
  assert.equal(result.uncaught, false);
  assert.equal(result.exitCode, 0);
  assert.equal(result.pendingTimers, 0);
  assert.deepEqual(JSON.parse(result.lines[0]), {result: 'passed', requests: 213, checks: 15, proof: 'artifacts/acceptance-stage30/http-proof.json'});
  assert.deepEqual(Object.keys(result.writes[0]).sort(), ['checks', 'completed', 'kind', 'requests', 'result', 'started']);
  assert.ok(result.writes[0].checks.every(check => check.passed));
  assert.equal(JSON.stringify(result).includes(secret), false, 'private header/origin reached output/proof');
});
