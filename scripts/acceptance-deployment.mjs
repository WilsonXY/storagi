// Anonymous live checks only. Never print origins, response headers, cookies or bodies.
// Run: node scripts/acceptance-deployment.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';

const metadata = JSON.parse(await readFile(`${homedir()}/.cache/storagi/stage29-sanitized-readiness.json`, 'utf8'));
const origin = new URL(metadata.origin);
assert.equal(origin.protocol, 'https:');
assert.equal(metadata.private_https_active, true);
assert.equal(metadata.funnel_enabled, false);
const output = 'artifacts/acceptance-stage30';
await mkdir(output, {recursive: true});
const proof = {kind: 'Anonymous real private endpoint; hostname redacted', started: new Date().toISOString(), requests: [], checks: [], result: 'running'};
const uuid = '00000000-0000-4000-8000-000000000030';
const routes = ['/api/session', '/api/files', `/api/files/${uuid}`, `/api/files/${uuid}/download`, '/api/uploads', `/api/uploads/${uuid}`, '/auth/logout'];
const methods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT'];
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
function request(path, method = 'GET', headers = {}, loopback = false) {
  return new Promise((resolve, reject) => {
    const transport = loopback ? http : https;
    const target = loopback ? new URL(`http://127.0.0.1:${metadata.loopback_port}${path}`) : new URL(path, origin);
    const req = transport.request(target, {method, headers}, response);
    function response(res) {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
      res.on('error', reject);
    }
    req.setTimeout(15000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}
function security(response) {
  return response.headers['cache-control'] === 'no-store' && response.headers['x-content-type-options'] === 'nosniff' && response.headers['referrer-policy'] === 'no-referrer' && response.headers['content-security-policy'] === csp;
}
async function probe(path, method, expected, scenario, headers = {}, loopback = false) {
  const response = await request(path, method, headers, loopback);
  const entry = {scenario, transport: loopback ? 'native-loopback-http' : 'private-https', method, path: new URL(path, origin).pathname, status: response.status, securityHeaders: security(response)};
  proof.requests.push(entry);
  assert.equal(response.status, expected, `${scenario}: ${method} ${entry.path} status`);
  assert.equal(entry.securityHeaders, true, `${scenario}: ${method} ${entry.path} security headers`);
  return response;
}
function check(name, passed) {
  proof.checks.push({name, passed: Boolean(passed)});
  assert.ok(passed, name);
}
try {
  for (const [scenario, headers] of [['anonymous', {}], ['forged-session', {cookie: `__Host-storagi-session=${'a'.repeat(43)}`}]] ) {
    for (const path of routes) for (const method of methods) await probe(path, method, 401, scenario, headers);
  }
  for (const [scenario, headers] of [['hostile-origin', {origin: 'https://hostile.example'}], ['cross-site', {'sec-fetch-site': 'cross-site'}]]) {
    for (const path of routes) for (const method of methods) await probe(path, method, 403, scenario, headers);
  }
  for (const path of ['/', '/auth/login', '/api/files']) await probe(path, 'GET', 400, 'exact-hostile-host', {host: 'hostile.example'}, true);
  for (const path of ['/auth/callback', '/auth/callback?error=access_denied']) {
    const response = await probe(path, 'GET', 401, 'malformed-callback');
    check('callback clears flow without creating session', response.headers['set-cookie']?.length === 1 && response.headers['set-cookie'][0].startsWith('__Host-storagi-flow=;') && response.headers['set-cookie'][0].includes('Max-Age=0'));
  }
  const shell = await probe('/', 'GET', 200, 'built-dashboard');
  check('production HTML; no mock banner', shell.body.includes('<title>Storagi') && !/SYNTHETIC PREVIEW|mock-api/i.test(shell.body));
  await probe('/', 'HEAD', 200, 'built-dashboard');
  const assets = [...shell.body.matchAll(/(?:src|href)="(\/assets\/[a-zA-Z0-9_.-]+)"/g)].map(match => match[1]);
  check('built JS and CSS linked', assets.some(path => path.endsWith('.js')) && assets.some(path => path.endsWith('.css')));
  for (const path of [...assets, '/favicon.svg']) {
    const response = await probe(path, 'GET', 200, 'built-assets');
    check('asset content type matches extension', path.endsWith('.js') ? response.headers['content-type']?.startsWith('text/javascript') : path.endsWith('.css') ? response.headers['content-type']?.startsWith('text/css') : response.headers['content-type']?.startsWith('image/svg+xml'));
    check('asset excludes mock banner and middleware marker', !/SYNTHETIC PREVIEW|mock-api/i.test(response.body));
  }
  for (const path of ['/.env', '/data/', '/server/src/app.ts', '/src/main.ts', '/mock-api', '/api/files/../../.env']) await probe(path, 'GET', 404, 'static-exclusion');
  const login = await probe('/auth/login', 'GET', 302, 'google-login-start');
  const destination = new URL(login.headers.location);
  check('Google authorization HTTPS destination', destination.origin === 'https://accounts.google.com' && destination.pathname === '/o/oauth2/v2/auth');
  check('openid only identity scope', destination.searchParams.get('scope') === 'openid');
  check('authorization code with PKCE S256/state/nonce', destination.searchParams.get('response_type') === 'code' && destination.searchParams.get('code_challenge_method') === 'S256' && ['state', 'nonce', 'code_challenge'].every(key => Boolean(destination.searchParams.get(key))));
  const callback = new URL(destination.searchParams.get('redirect_uri'));
  check('callback origin matches private HTTPS origin (redacted)', callback.origin === origin.origin && callback.pathname === '/auth/callback' && !callback.search && !callback.hash);
  const cookies = login.headers['set-cookie'] || [];
  const attributes = cookies[0]?.split(';').slice(1).map(value => value.trim().toLowerCase()) || [];
  check('one host flow cookie; Secure HttpOnly SameSite=Lax Path=/; no Domain', cookies.length === 1 && cookies[0].startsWith('__Host-storagi-flow=') && ['secure', 'httponly', 'samesite=lax', 'path=/', 'max-age=600'].every(value => attributes.includes(value)) && !attributes.some(value => value.startsWith('domain=')));
  proof.result = 'passed';
} catch {
  proof.result = 'failed';
  process.exitCode = 1;
} finally {
  proof.completed = new Date().toISOString();
  await writeFile(`${output}/http-proof.json`, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({result: proof.result, requests: proof.requests.length, checks: proof.checks.length, proof: `${output}/http-proof.json`}));
}
