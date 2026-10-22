// scripts/storagi-autodeploy against a fixture origin, a stub deploy.sh and a curl shim standing in
// for the GitHub API and the Discord webhook. Never touches the network, sudo, systemd or the runtime.
// Run: server/node_modules/.bin/tsx --test scripts/autodeploy.test.ts
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'storagi-autodeploy-')));
const token = 'synthetic-webhook-token_never-printed';
const webhook = `https://discord.com/api/webhooks/123456/${token}`;
const pollerSrc = readFileSync(`${repo}/scripts/storagi-autodeploy`, 'utf8');
const manifestLine = 'live_manifest=/opt/storagi/current/BUILD_MANIFEST';
const env0 = { PATH: process.env.PATH!, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
let count = 0;
after(() => rmSync(base, { recursive: true, force: true }));

function sh(cwd: string, command: string) {
  const r = spawnSync('bash', ['-ec', command], { cwd, env: env0, encoding: 'utf8' });
  assert.equal(r.status, 0, `${command}\n${r.stdout}${r.stderr}`);
  return r.stdout.trim();
}
const write = (file: string, text: string, mode = 0o644) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text, { mode }); };
// The installed poller with only its live manifest path rewritten.
const pollerCopy = (manifest: string) => {
  assert.equal(pollerSrc.split('\n').filter(l => l === manifestLine).length, 1);
  return pollerSrc.split('\n').map(l => (l === manifestLine ? `live_manifest=${manifest}` : l)).join('\n');
};
type Run = { name?: string; status?: string; conclusion?: string | null; app?: { slug: string } };
const checkRun = (o: Run = {}) => ({ name: 'check', status: 'completed', conclusion: 'success', app: { slug: 'github-actions' }, ...o });

function fixture(live = 'v1.0.0') {
  const dir = `${base}/case${++count}`, src = `${dir}/src`, origin = `${dir}/origin.git`, home = `${dir}/home`;
  const clone = `${home}/storagi`, state = `${dir}/state`, bin = `${dir}/bin`, creds = `${dir}/creds`, manifest = `${dir}/opt/current/BUILD_MANIFEST`;
  mkdirSync(state, { recursive: true }); mkdirSync(home);
  write(manifest, `TAG=${live}\nCOMMIT=0000000000000000000000000000000000000000\n`);
  write(`${creds}/discord-webhook`, `${webhook}\n`, 0o600);
  // Stub deploy.sh: logs the tag, the commit it runs from and whether it inherited the poller's lock,
  // then exits with $FAKE_STATE/deploy-exit (default 0); exit 0 makes the tag live.
  write(`${src}/scripts/deploy.sh`, `#!/bin/sh
fd8=closed; [ -e /proc/$$/fd/8 ] && fd8=open
echo "$* $(git -C "$(dirname "$0")" rev-parse HEAD) fd8=$fd8 tmp=$TMPDIR" >> "$FAKE_STATE/deploy.log"
code=$(cat "$FAKE_STATE/deploy-exit" 2>/dev/null || echo 0)
[ "$code" = 0 ] && printf 'TAG=%s\\n' "$1" > '${manifest}'
exit "$code"
`, 0o755);
  write(`${src}/scripts/storagi-autodeploy`, pollerCopy(manifest), 0o755);
  sh(dir, `git init -q --bare -b main origin.git && git init -q -b main src && cd src && git remote add origin '${origin}'
    git add -A && git commit -qm base && git tag v1.0.0 && git push -q origin main v1.0.0 && cd .. && git clone -q '${origin}' '${clone}'`);
  // curl: a webhook post (-K config) is checked and logged; anything else is the GitHub API.
  write(`${bin}/curl`, `#!/bin/sh
STATE='${state}'
echo "$*" >> "$STATE/curl-argv.log"
[ "$1" = -q ] || exit 2
cfg=; prev=; url=
for a; do [ "$prev" = -K ] && cfg=$a; prev=$a; url=$a; done
if [ -n "$cfg" ]; then
  [ "$(cat "$cfg")" = 'url = "${webhook}"' ] || { printf 000; exit 3; }
  cat >> "$STATE/webhook.log"; echo >> "$STATE/webhook.log"
  [ -f "$STATE/webhook-down" ] && exit 7
  [ -f "$STATE/webhook-500" ] && { printf 500; exit 0; }
  printf 204; exit 0
fi
echo "$url" >> "$STATE/api.log"
[ -f "$STATE/api-down" ] && exit 7
cat "$STATE/api-body"; printf '\\n%s' "$(cat "$STATE/api-code" 2>/dev/null || echo 200)"
`, 0o755);
  const read = (name: string) => (existsSync(`${state}/${name}`) ? readFileSync(`${state}/${name}`, 'utf8') : '');
  const f = {
    dir, src, home, clone, state, manifest, creds, read,
    lines: (name: string) => read(name).split('\n').filter(Boolean),
    ci: (...runs: Run[]) => writeFileSync(`${state}/api-body`, JSON.stringify({ total_count: runs.length, check_runs: runs })),
    // A commit on main (or on a side branch) tagged and pushed; returns the commit.
    tag: (name: string, onMain = true) => sh(src, `${onMain ? '' : `git checkout -q -b side-${name}`}
      echo ${name} >> notes.txt && git add notes.txt && git commit -qm ${name} && git tag ${name}
      git push -q origin ${onMain ? 'main ' : ''}${name}${onMain ? '' : ' && git checkout -q main'}
      git rev-parse ${name}`).split('\n').pop()!,
    sha: (rev: string) => sh(src, `git rev-parse '${rev}^{commit}'`),
    stateFile: () => (existsSync(`${home}/autodeploy.state`) ? readFileSync(`${home}/autodeploy.state`, 'utf8') : ''),
    poll: (extra: Record<string, string> = {}) => {
      const r = spawnSync(`${clone}/scripts/storagi-autodeploy`, [], { env: { ...env0, PATH: `${bin}:${env0.PATH}`, HOME: home, CREDENTIALS_DIRECTORY: creds, FAKE_STATE: state, ...extra }, encoding: 'utf8' });
      if (r.error) throw r.error;
      const out = `${r.stdout}${r.stderr}`;
      // The webhook URL is a secret: never in output, curl's argv, or the state file.
      for (const text of [out, read('curl-argv.log'), f.stateFile()]) { assert.ok(!text.includes(token)); assert.ok(!text.includes('webhooks/')); }
      return { status: r.status, out };
    },
  };
  f.ci(checkRun());
  return f;
}
type Fixture = ReturnType<typeof fixture>;
const short = (sha: string) => sha.slice(0, 7);
// Nothing happened this tick beyond the given log sizes.
const quiet = (f: Fixture, before: { deploys: number; alerts: number; state: string }) => {
  assert.equal(f.lines('deploy.log').length, before.deploys);
  assert.equal(f.lines('webhook.log').length, before.alerts);
  assert.equal(f.stateFile(), before.state);
};
const mark = (f: Fixture) => ({ deploys: f.lines('deploy.log').length, alerts: f.lines('webhook.log').length, state: f.stateFile() });

test('a test copy of the poller differs from the installed one only in the live manifest path', () => {
  const copy = pollerCopy('/x').split('\n'), orig = pollerSrc.split('\n');
  assert.equal(copy.length, orig.length);
  assert.equal(copy.filter((l, i) => l !== orig[i]).length, 1);
});

test('deploys the highest semver tag on origin/main; malformed, off-main and older tags are ignored', () => {
  const f = fixture();
  for (const t of ['v1.2.0', 'v1.9.0', 'v1.10.0']) f.tag(t);
  for (const t of ['v1.11', 'v1.12.0-rc1', 'v01.13.0', 'v1.14.0.1', 'vX', 'release-2.0.0']) f.tag(t);
  f.tag('v9.9.9', false);
  const main = f.sha('HEAD'), sha = f.sha('v1.10.0');
  const r = f.poll();
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, new RegExp(`deploying v1\\.10\\.0 \\(${short(sha)}\\)`));
  // Run from the clone at origin/main, without the poller's lock, with TMPDIR in its home.
  assert.deepEqual(f.lines('deploy.log'), [`v1.10.0 ${main} fd8=closed tmp=${f.home}/.cache/storagi/tmp`]);
  assert.deepEqual(f.lines('api.log'), [`https://api.github.com/repos/WilsonXY/storagi/commits/${sha}/check-runs?check_name=check&per_page=100`]);
  assert.deepEqual(f.lines('webhook.log'), [`{"content":"Storagi v1.10.0 (${short(sha)}) is live."}`]);
  assert.equal(f.stateFile(), `v1.0.0 - live\nv1.10.0 ${sha} exit-0\n`);
  // Next tick: v1.10.0 is live; nothing to do and no API call.
  const before = mark(f), again = f.poll();
  assert.equal(again.status, 0, again.out); assert.match(again.out, /nothing to deploy \(live v1\.10\.0\)/);
  quiet(f, before); assert.equal(f.lines('api.log').length, 1);
});

test('never deploys a tag that is not newer than the live release', async t => {
  for (const [label, live] of [['equal', 'v1.2.0'], ['older', 'v2.0.0']]) await t.test(label, () => {
    const f = fixture(live); f.tag('v1.2.0');
    const r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, /nothing to deploy/);
    assert.equal(f.read('deploy.log'), ''); assert.equal(f.read('api.log'), ''); assert.equal(f.read('webhook.log'), '');
  });
});

test('CI not finished: waits for the next tick, then deploys', async t => {
  const cases: [string, Run[]][] = [
    ['no runs yet', []],
    ['in progress', [{ status: 'in_progress', conclusion: null }]],
    ['queued next to a finished run', [{}, { status: 'queued', conclusion: null }]],
    ['only another app reports "check"', [{ app: { slug: 'someone-else' } }]],
    ['only another job succeeded', [{ name: 'lint' }]],
  ];
  for (const [label, runs] of cases) await t.test(label, () => {
    const f = fixture(), sha = f.tag('v1.2.0');
    f.ci(...runs.map(checkRun));
    const before = mark(f), r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, /v1\.2\.0 \(\w+\): CI has not finished; trying again next tick/);
    quiet(f, { ...before, state: 'v1.0.0 - live\n' });
    f.ci(checkRun());
    const ok = f.poll();
    assert.equal(ok.status, 0, ok.out);
    assert.equal(f.lines('deploy.log').length, 1);
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.0 ${sha} exit-0$`, 'm'));
  });
});

test('CI failed: marks the tag failed, alerts once, never retries; a newer tag is still deployed', async t => {
  for (const [label, runs] of [['failure', [{ conclusion: 'failure' }]], ['cancelled', [{ conclusion: 'cancelled' }]], ['one of two failed', [{}, { conclusion: 'failure' }]]] as [string, Run[]][]) await t.test(label, () => {
    const f = fixture(), sha = f.tag('v1.2.0');
    f.ci(...runs.map(checkRun));
    const r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, /CI failed; not deploying/);
    assert.equal(f.read('deploy.log'), '');
    assert.deepEqual(f.lines('webhook.log'), [`{"content":"Storagi v1.2.0 (${short(sha)}): CI failed, not deployed. See journalctl -u storagi-autodeploy"}`]);
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.0 ${sha} ci-failed$`, 'm'));
    // Even if CI is re-run green, the tag is not retried automatically, and there is no second alert.
    f.ci(checkRun());
    const before = mark(f), again = f.poll();
    assert.equal(again.status, 0, again.out); assert.match(again.out, /nothing to deploy/);
    quiet(f, before); assert.equal(f.lines('api.log').length, 1);
    const newer = f.tag('v1.2.1');
    assert.equal(f.poll().status, 0);
    assert.match(f.lines('deploy.log')[0], /^v1\.2\.1 /);
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.1 ${newer} exit-0$`, 'm'));
  });
});

test('GitHub API errors and rate limits: no deploy, no state, no alert; retried next tick', async t => {
  const cases: [string, (f: Fixture) => void, RegExp][] = [
    ['rate limited 403', f => writeFileSync(`${f.state}/api-code`, '403'), /rate limit \(HTTP 403\)/],
    ['rate limited 429', f => writeFileSync(`${f.state}/api-code`, '429'), /rate limit \(HTTP 429\)/],
    ['server error', f => writeFileSync(`${f.state}/api-code`, '502'), /API error \(HTTP 502\)/],
    ['commit unknown to GitHub', f => writeFileSync(`${f.state}/api-code`, '404'), /API error \(HTTP 404\)/],
    ['unreachable', f => writeFileSync(`${f.state}/api-down`, ''), /API unreachable \(curl exit 7\)/],
    ['not JSON', f => writeFileSync(`${f.state}/api-body`, '<html>'), /unreadable GitHub API response/],
  ];
  for (const [label, arrange, reason] of cases) await t.test(label, () => {
    const f = fixture(); f.tag('v1.2.0'); arrange(f);
    const before = mark(f), r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, reason); assert.match(r.out, /trying again next tick/);
    quiet(f, { ...before, state: 'v1.0.0 - live\n' });
    for (const s of ['api-code', 'api-down']) rmSync(`${f.state}/${s}`, { force: true });
    f.ci(checkRun());
    assert.equal(f.poll().status, 0);
    assert.equal(f.lines('deploy.log').length, 1);
  });
});

test('busy (exit 75): nothing recorded, no alert, deployed on a later tick', () => {
  const f = fixture(), sha = f.tag('v1.2.0');
  writeFileSync(`${f.state}/deploy-exit`, '75');
  for (let i = 0; i < 2; i++) {
    const r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, /not deployed \(exit 75: busy, .*\); trying again next tick/);
  }
  assert.equal(f.lines('deploy.log').length, 2); assert.equal(f.read('webhook.log'), '');
  assert.equal(f.stateFile(), 'v1.0.0 - live\n');
  unlinkSync(`${f.state}/deploy-exit`);
  assert.equal(f.poll().status, 0);
  assert.equal(f.lines('deploy.log').length, 3);
  assert.deepEqual(f.lines('webhook.log'), [`{"content":"Storagi v1.2.0 (${short(sha)}) is live."}`]);
});

test('a failed deploy is alerted once and never retried; a newer tag still is', async t => {
  const cases: [number, string][] = [
    [1, 'build failed or refused before cutover, production untouched'],
    [2, 'cutover failed, rolled back, previous release healthy'],
    [3, 'MANUAL RECOVERY REQUIRED'],
    [130, 'build failed or refused before cutover, production untouched'],
  ];
  for (const [code, what] of cases) await t.test(`exit ${code}`, () => {
    const f = fixture(), sha = f.tag('v1.2.0');
    writeFileSync(`${f.state}/deploy-exit`, String(code));
    const r = f.poll();
    assert.equal(r.status, code, r.out); assert.match(r.out, /not retried automatically/);
    assert.deepEqual(f.lines('webhook.log'), [`{"content":"Storagi v1.2.0 (${short(sha)}): ${what} (exit ${code}). See journalctl -u storagi-autodeploy"}`]);
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.0 ${sha} exit-${code}$`, 'm'));
    unlinkSync(`${f.state}/deploy-exit`);
    const before = mark(f), again = f.poll();
    assert.equal(again.status, 0, again.out); assert.match(again.out, /nothing to deploy \(live v1\.0\.0\)/);
    quiet(f, before);
    f.tag('v1.3.0');
    assert.equal(f.poll().status, 0);
    assert.match(f.lines('deploy.log')[1], /^v1\.3\.0 /);
    assert.match(f.lines('webhook.log')[1], /v1\.3\.0 .* is live/);
  });
});

test('a tag rolled back by hand is not deployed again', async t => {
  await t.test('after the poller deployed it', () => {
    const f = fixture(); f.tag('v1.2.0');
    assert.equal(f.poll().status, 0);
    writeFileSync(f.manifest, 'TAG=v1.0.0\n'); // the owner's scripts/deploy.sh v1.0.0
    const before = mark(f), r = f.poll();
    assert.match(r.out, /nothing to deploy \(live v1\.0\.0\)/); quiet(f, before);
  });
  await t.test('after the owner deployed it by hand', () => {
    const f = fixture(); f.tag('v1.2.0'); f.ci(checkRun({ status: 'queued', conclusion: null }));
    writeFileSync(f.manifest, 'TAG=v1.2.0\n');
    assert.match(f.poll().out, /nothing to deploy \(live v1\.2\.0\)/);
    writeFileSync(f.manifest, 'TAG=v1.0.0\n'); f.ci(checkRun());
    const r = f.poll();
    assert.match(r.out, /nothing to deploy \(live v1\.0\.0\)/);
    assert.equal(f.read('deploy.log'), '');
  });
});

test('each tick resets the clone to origin/main and runs that poller and deploy.sh', () => {
  const f = fixture();
  writeFileSync(`${f.clone}/scripts/deploy.sh`, '#!/bin/sh\necho local edit\n'); // a tracked change in the clone
  // A newer reviewed main: its poller prints a marker as it starts.
  const poller = readFileSync(`${f.src}/scripts/storagi-autodeploy`, 'utf8').replace('set -euo pipefail\n', 'set -euo pipefail\necho new-poller-running\n');
  writeFileSync(`${f.src}/scripts/storagi-autodeploy`, poller);
  sh(f.src, 'git commit -qam new-poller');
  f.tag('v1.2.0');
  const main = f.sha('HEAD'), r = f.poll();
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out.match(/new-poller-running/g)?.length, 1, r.out);
  assert.equal(sh(f.clone, 'git rev-parse HEAD'), main);
  assert.equal(sh(f.clone, 'git status --porcelain --untracked-files=no'), '');
  assert.match(f.lines('deploy.log')[0], new RegExp(`^v1\\.2\\.0 ${main} `));
});

test('tags deleted or moved on origin are followed', async t => {
  await t.test('deleted', () => {
    const f = fixture(); f.tag('v1.2.0'); f.ci(checkRun({ status: 'queued', conclusion: null }));
    assert.match(f.poll().out, /CI has not finished/);
    assert.equal(sh(f.clone, 'git tag -l v1.2.0'), 'v1.2.0');
    sh(f.src, 'git push -q origin :refs/tags/v1.2.0'); f.ci(checkRun());
    const r = f.poll();
    assert.match(r.out, /nothing to deploy/); assert.equal(f.read('deploy.log'), '');
  });
  await t.test('moved', () => {
    const f = fixture(); f.tag('v1.2.0'); f.ci(checkRun({ status: 'queued', conclusion: null }));
    assert.match(f.poll().out, /CI has not finished/);
    sh(f.src, 'echo again >> notes.txt && git commit -qam again && git tag -f v1.2.0 >/dev/null && git push -q origin main && git push -q -f origin v1.2.0');
    const moved = f.sha('v1.2.0'); f.ci(checkRun());
    assert.equal(f.poll().status, 0);
    assert.ok(f.lines('api.log')[1].includes(`/commits/${moved}/`));
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.0 ${moved} exit-0$`, 'm'));
  });
});

test('overlapping runs: a second run skips the tick while the first holds the lock', async () => {
  const f = fixture(); f.tag('v1.2.0');
  writeFileSync(`${f.home}/autodeploy.lock`, '');
  const holder = spawn('flock', [`${f.home}/autodeploy.lock`, '/bin/sleep', '60'], { stdio: 'ignore' });
  try {
    while (spawnSync('flock', ['-n', `${f.home}/autodeploy.lock`, 'true']).status === 0) await new Promise(r => setTimeout(r, 20));
    const head = sh(f.clone, 'git rev-parse HEAD'), r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, /another run holds the lock; skipping this tick/);
    assert.equal(sh(f.clone, 'git rev-parse HEAD'), head, 'not even fetched');
    assert.equal(f.read('deploy.log'), ''); assert.equal(f.read('api.log'), '');
  } finally { holder.kill(); }
});

test('the webhook: failures change nothing, the secret stays out of argv and logs', async t => {
  const cases: [string, (f: Fixture) => void, RegExp][] = [
    ['webhook unreachable', f => writeFileSync(`${f.state}/webhook-down`, ''), /alert not sent \(curl exit 7, HTTP none\)/],
    ['webhook HTTP 500', f => writeFileSync(`${f.state}/webhook-500`, ''), /alert not sent \(curl exit 0, HTTP 500\)/],
    ['no credential', f => unlinkSync(`${f.creds}/discord-webhook`), /alert not sent: no discord-webhook credential/],
    ['not a Discord webhook URL', f => writeFileSync(`${f.creds}/discord-webhook`, `https://example.invalid/api/webhooks/1/${token}\n`), /not a Discord webhook URL/],
  ];
  for (const [label, arrange, reason] of cases) await t.test(label, () => {
    const f = fixture(), sha = f.tag('v1.2.0'); arrange(f);
    const r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, reason);
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.0 ${sha} exit-0$`, 'm'));
    assert.equal(readFileSync(f.manifest, 'utf8'), 'TAG=v1.2.0\n');
  });
  await t.test('also when the deploy failed', () => {
    const f = fixture(), sha = f.tag('v1.2.0');
    writeFileSync(`${f.state}/deploy-exit`, '2'); writeFileSync(`${f.state}/webhook-down`, '');
    const r = f.poll();
    assert.equal(r.status, 2, r.out); assert.match(r.out, /alert not sent/);
    assert.match(f.stateFile(), new RegExp(`^v1\\.2\\.0 ${sha} exit-2$`, 'm'));
    assert.equal(f.lines('deploy.log').length, 1);
  });
  await t.test('curl gets the URL in a config on a pipe, not in its arguments', () => {
    const f = fixture(); f.tag('v1.2.0');
    assert.equal(f.poll().status, 0);
    const post = f.lines('curl-argv.log').find(l => l.includes(' -K '))!;
    assert.match(post, / -K \/dev\/fd\/\d+$/);
  });
});

test('refuses without a readable live release, and retries next tick when offline', async t => {
  for (const [label, text] of [['missing', null], ['no TAG line', 'COMMIT=x\n'], ['two TAG lines', 'TAG=v1.0.0\nTAG=v9.0.0\n'], ['malformed TAG', 'TAG=v1.0.0 x\n']] as [string, string | null][]) await t.test(label, () => {
    const f = fixture(); f.tag('v1.2.0');
    if (text === null) unlinkSync(f.manifest); else writeFileSync(f.manifest, text);
    const r = f.poll();
    assert.equal(r.status, 1, r.out); assert.match(r.out, /cannot read the live release's TAG/);
    assert.equal(f.read('deploy.log'), ''); assert.equal(f.read('api.log'), '');
  });
  await t.test('origin unreachable', () => {
    const f = fixture(); f.tag('v1.2.0');
    sh(f.clone, `git remote set-url origin '${f.dir}/missing.git'`);
    const r = f.poll();
    assert.equal(r.status, 0, r.out); assert.match(r.out, /git fetch failed; trying again next tick/);
    assert.equal(f.read('deploy.log'), ''); assert.equal(f.read('api.log'), '');
  });
});
